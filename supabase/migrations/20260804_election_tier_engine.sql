-- Phase: Voter Dashboard & Dynamic Eligibility Engine (First-Year Hall Rule)
-- Adds explicit election tier and student academic session eligibility columns

-- ─────────────────────────────────────────────
-- 1. Add explicit tier column to elections
--    Values: SRC, DEPARTMENT, COLLEGE, CONSTITUENCY, HALL
-- ─────────────────────────────────────────────
ALTER TABLE IF EXISTS public.elections
  ADD COLUMN IF NOT EXISTS tier text;

-- Add index on tier for fast filtering
CREATE INDEX IF NOT EXISTS idx_elections_tier ON public.elections(tier);

-- ─────────────────────────────────────────────
-- 2. Add eligibility columns to student_academic_sessions
--    (idempotent so it can run alongside existing student session data)
-- ─────────────────────────────────────────────
ALTER TABLE IF EXISTS public.student_academic_sessions
  ADD COLUMN IF NOT EXISTS hall_code text,
  ADD COLUMN IF NOT EXISTS college_code text,
  ADD COLUMN IF NOT EXISTS department_code text,
  ADD COLUMN IF NOT EXISTS year_of_study integer,
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS biometrics_completed_current_semester boolean default false;

-- ─────────────────────────────────────────────
-- 3. Reference data: KNUST Hall jurisdictions
--    (Unity, Katanga, Independence, Africa, etc.)
--    Used to scope Hall elections to first-year students matching their hall_code
-- ─────────────────────────────────────────────
INSERT INTO public.electoral_jurisdictions (name, tier, code)
VALUES
  ('Unity Hall', 'HALL', 'UNITY'),
  ('Katanga Hall', 'HALL', 'KATANGA'),
  ('Independence Hall', 'HALL', 'INDEPENDENCE'),
  ('Africa Hall', 'HALL', 'AFRICA'),
  ('Republic Hall', 'HALL', 'REPUBLIC'),
  ('University Hall', 'HALL', 'REPUBLIC'),
  ('Queens Hall', 'HALL', 'QUEENS'),
  ('Continental Hall', 'HALL', 'CONTINENTAL')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. Seed reference elections with explicit tier values
--    (idempotent — only inserted if not already present by title)
-- ─────────────────────────────────────────────
INSERT INTO public.electoral_jurisdictions (name, tier, code)
VALUES
  ('College of Engineering', 'COLLEGE', 'COE'),
  ('Department of Computer Engineering', 'DEPARTMENT', 'COE'),
  ('Constituency — Ayeduase', 'CONSTITUENCY', 'AYEDUASE'),
  ('Constituency — Kotei/Gaza', 'CONSTITUENCY', 'KOTEI'),
  ('Constituency — Campus', 'CONSTITUENCY', 'CAMPUS'),
  ('Constituency — Bomso', 'CONSTITUENCY', 'BOMSO'),
  ('Constituency — Kentinkrono', 'CONSTITUENCY', 'KENTINKRONO'),
  ('SRC Executive Council', 'SRC', 'SRC')
ON CONFLICT (name) DO NOTHING;
