-- Phase E: Ensure unique constraint on election_room_members prevents duplicate assignments
ALTER TABLE IF EXISTS public.election_room_members
ADD CONSTRAINT unique_room_member_per_student UNIQUE (room_id, student_id);

-- Create index for efficient member lookups by room
CREATE INDEX IF NOT EXISTS idx_election_room_members_room_active 
ON public.election_room_members(room_id, role_in_room);

-- Create a view for easily querying room members with candidate details
CREATE OR REPLACE VIEW room_members_with_candidates AS
SELECT 
  erm.id,
  erm.room_id,
  erm.student_id,
  erm.role_in_room,
  erm.candidate_id,
  erm.assigned_at,
  c.full_name AS candidate_name,
  c.position AS candidate_position,
  er.election_id,
  e.title AS election_title
FROM election_room_members erm
LEFT JOIN candidates c ON erm.candidate_id = c.id
LEFT JOIN election_rooms er ON erm.room_id = er.id
LEFT JOIN elections e ON er.election_id = e.id;
