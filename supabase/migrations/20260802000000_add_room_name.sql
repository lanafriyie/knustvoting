-- Phase E: Add room_name column to election_rooms for room creation modal
ALTER TABLE IF EXISTS public.election_rooms
ADD COLUMN IF NOT EXISTS room_name text;

-- Add index on room_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_election_rooms_room_name ON public.election_rooms(room_name);
