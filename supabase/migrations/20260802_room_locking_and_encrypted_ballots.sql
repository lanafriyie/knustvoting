-- Create encrypted_ballots table for storing encrypted votes
create table if not exists public.encrypted_ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  room_id uuid references public.election_rooms(id) on delete set null,
  student_id uuid not null,
  encrypted_payload text not null,
  ballot_hash text not null,
  submitted_at timestamptz not null default now(),
  verified boolean not null default false,
  unique (election_id, student_id)
);

create index if not exists idx_encrypted_ballots_election on public.encrypted_ballots(election_id);
create index if not exists idx_encrypted_ballots_student on public.encrypted_ballots(student_id);
create index if not exists idx_encrypted_ballots_room on public.encrypted_ballots(room_id);

-- RPC to set room locked status (HEAD/DEPUTY only)
create or replace function public.set_room_locked_status(
  p_student_id uuid,
  p_room_id uuid,
  p_is_locked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_room public.election_rooms%rowtype;
begin
  -- Verify caller is HEAD or DEPUTY in this room
  select role_in_room into v_role
  from public.election_room_members
  where student_id = p_student_id
    and room_id = p_room_id
    and role_in_room in ('HEAD', 'DEPUTY')
  limit 1;

  if coalesce(v_role, '') not in ('HEAD', 'DEPUTY') then
    raise exception 'Unauthorized: only HEAD or DEPUTY can lock/unlock election rooms';
  end if;

  -- Get room details
  select * into v_room from public.election_rooms where id = p_room_id;
  if not found then
    raise exception 'Election room not found';
  end if;

  -- Update is_locked status
  update public.election_rooms
  set is_locked = p_is_locked
  where id = p_room_id;

  return jsonb_build_object(
    'room_id', p_room_id,
    'is_locked', p_is_locked,
    'action', case when p_is_locked then 'LOCKED' else 'UNLOCKED' end,
    'changed_by', p_student_id,
    'changed_at', now()
  );
end;
$$;

-- RPC to submit anonymous vote with room lock check
create or replace function public.submit_anonymous_vote(
  p_student_id uuid,
  p_election_id uuid,
  p_room_id uuid,
  p_encrypted_payload text,
  p_ballot_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_locked boolean;
  v_ballot_id uuid;
  v_audit_id uuid;
begin
  -- Check if election room is locked
  select is_locked into v_is_locked
  from public.election_rooms
  where id = p_room_id
    and election_id = p_election_id;

  if v_is_locked = true then
    raise exception 'ROOM_LOCKED: Election room is currently locked by EC.';
  end if;

  -- Check if student already voted in this election
  if exists (
    select 1
    from public.encrypted_ballots
    where election_id = p_election_id
      and student_id = p_student_id
  ) then
    raise exception 'DOUBLE_VOTE: You have already cast your vote in this election.';
  end if;

  -- Insert encrypted ballot
  insert into public.encrypted_ballots (
    election_id,
    room_id,
    student_id,
    encrypted_payload,
    ballot_hash,
    verified
  ) values (
    p_election_id,
    p_room_id,
    p_student_id,
    p_encrypted_payload,
    p_ballot_hash,
    true
  ) returning id into v_ballot_id;

  -- Record audit log
  insert into public.voter_audit_logs (
    election_id,
    student_id,
    event_type,
    payload
  ) values (
    p_election_id,
    p_student_id,
    'vote_cast',
    jsonb_build_object(
      'ballot_id', v_ballot_id,
      'room_id', p_room_id,
      'ballot_hash', p_ballot_hash,
      'timestamp', now()
    )
  ) returning id into v_audit_id;

  return jsonb_build_object(
    'success', true,
    'ballot_id', v_ballot_id,
    'audit_id', v_audit_id,
    'ballot_hash', p_ballot_hash,
    'submitted_at', now()
  );
end;
$$;

-- Grant permissions
grant select, insert, update on public.encrypted_ballots to authenticated;
grant execute on function public.set_room_locked_status(uuid, uuid, boolean) to authenticated;
grant execute on function public.submit_anonymous_vote(uuid, uuid, uuid, text, text) to authenticated;
