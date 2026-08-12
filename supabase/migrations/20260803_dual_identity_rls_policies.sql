-- Dual-Identity Architecture: RLS Policies & Authorization Enforcement
-- Ensures EC officers cannot override their voter identity when casting votes

-- Create ec_jurisdiction_assignments table (if not exists)
CREATE TABLE IF NOT EXISTS public.ec_jurisdiction_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE,
  jurisdiction_id UUID NOT NULL REFERENCES public.electoral_jurisdictions(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL,  -- 'EC_HEAD', 'EC_DEPUTY', 'EC_COMMISSIONER'
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ec_assignments_student ON public.ec_jurisdiction_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_ec_assignments_jurisdiction ON public.ec_jurisdiction_assignments(jurisdiction_id);

-- Create vote_personal_status view (shows if EC member has voted in specific election)
CREATE OR REPLACE VIEW public.ec_member_vote_status AS
SELECT 
  ec.student_id,
  ec.jurisdiction_id,
  ec.role_type,
  e.id as election_id,
  e.title as election_title,
  CASE WHEN val.id IS NOT NULL THEN true ELSE false END as has_voted,
  val.created_at as voted_at
FROM public.ec_jurisdiction_assignments ec
CROSS JOIN public.elections e
LEFT JOIN public.voter_audit_logs val 
  ON val.student_id = ec.student_id 
  AND val.election_id = e.id
  AND val.event_type = 'vote_cast';

-- RPC: Check if user is EC authorized for election
CREATE OR REPLACE FUNCTION public.is_ec_authorized_for_election(
  p_student_id UUID,
  p_election_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_role_type TEXT;
  v_election_jurisdiction_id UUID;
BEGIN
  -- Get election's jurisdiction
  SELECT jurisdiction_id INTO v_election_jurisdiction_id
  FROM public.elections
  WHERE id = p_election_id;

  IF v_election_jurisdiction_id IS NULL THEN
    RETURN jsonb_build_object('is_authorized', false, 'reason', 'Election not found');
  END IF;

  -- Check if student has EC assignment for this jurisdiction
  SELECT role_type INTO v_role_type
  FROM public.ec_jurisdiction_assignments
  WHERE student_id = p_student_id
    AND jurisdiction_id = v_election_jurisdiction_id;

  v_is_authorized := COALESCE(v_role_type IS NOT NULL, false);

  RETURN jsonb_build_object(
    'is_authorized', v_is_authorized,
    'role_type', v_role_type,
    'student_id', p_student_id,
    'election_id', p_election_id
  );
END;
$$;

-- RPC: Get EC member's personal vote status in specific election
CREATE OR REPLACE FUNCTION public.get_ec_member_vote_status(
  p_student_id UUID,
  p_election_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_voted BOOLEAN;
  v_voted_at TIMESTAMPTZ;
BEGIN
  -- Check if this EC member has voted in the election
  SELECT true, val.created_at INTO v_has_voted, v_voted_at
  FROM public.voter_audit_logs val
  WHERE val.student_id = p_student_id
    AND val.election_id = p_election_id
    AND val.event_type = 'vote_cast'
  LIMIT 1;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'election_id', p_election_id,
    'has_voted', COALESCE(v_has_voted, false),
    'voted_at', v_voted_at
  );
END;
$$;

-- RLS Policy: Ensure voters cannot query other voters' audit logs
ALTER TABLE public.voter_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_cannot_audit_specific_voter"
  ON public.voter_audit_logs
  FOR SELECT
  USING (
    -- EC can only see aggregate stats (via RPC), not individual voter logs
    -- Viewers must be verified by business logic to avoid student_id disclosure
    auth.uid() = student_id  -- Voters can only see their own entry
    OR
    (EXISTS (
      SELECT 1 FROM public.ec_jurisdiction_assignments eca
      WHERE eca.student_id = auth.uid()
      AND eca.jurisdiction_id = (
        SELECT jurisdiction_id FROM public.elections
        WHERE id = voter_audit_logs.election_id
      )
    ) AND student_id IS NULL)  -- EC can only see anonymized/aggregate entries
  );

-- RLS Policy: Ensure vote submission bypasses EC role checks
ALTER TABLE public.encrypted_ballots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voter_can_submit_ballot"
  ON public.encrypted_ballots
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()  -- Only own vote submission
  );

CREATE POLICY "voter_can_view_own_ballot"
  ON public.encrypted_ballots
  FOR SELECT
  USING (
    student_id = auth.uid()  -- Only see own ballot (for verification)
  );

-- CRITICAL: RPC enforces voter anonymity even for EC members
-- The submit_anonymous_vote RPC MUST NOT check EC role - it treats all as voters
-- This is already implemented in 20260802_room_locking_and_encrypted_ballots.sql

-- RLS Policy: EC can view jurisdiction assignments (but not edit others')
ALTER TABLE public.ec_jurisdiction_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_can_view_own_assignment"
  ON public.ec_jurisdiction_assignments
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.ec_jurisdiction_assignments eca
      WHERE eca.student_id = auth.uid()
        AND eca.role_type IN ('EC_HEAD', 'EC_DEPUTY')
        AND eca.jurisdiction_id = ec_jurisdiction_assignments.jurisdiction_id
    )
  );

CREATE POLICY "only_super_admin_can_insert_ec_assignments"
  ON public.ec_jurisdiction_assignments
  FOR INSERT
  WITH CHECK (false);  -- Prevent client inserts; use backend admin function

-- Grant permissions
GRANT SELECT ON public.ec_jurisdiction_assignments TO authenticated;
GRANT SELECT ON public.ec_member_vote_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ec_authorized_for_election(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ec_member_vote_status(UUID, UUID) TO authenticated;

-- Audit log RLS remains minimal - backend handles authorization
GRANT SELECT, INSERT ON public.voter_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.encrypted_ballots TO authenticated;
