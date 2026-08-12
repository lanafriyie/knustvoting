create extension if not exists pgcrypto;

create table if not exists public.electoral_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'DEPARTMENT',
  code text,
  created_at timestamptz not null default now()
);

create table if not exists public.election_room_members (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  role_in_room text not null,
  jurisdiction_id uuid references public.electoral_jurisdictions(id),
  room_id uuid references public.election_rooms(id) on delete cascade,
  candidate_id uuid references public.candidates(id),
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_election_room_members_student on public.election_room_members(student_id);
create index if not exists idx_election_room_members_room on public.election_room_members(room_id);

create table if not exists public.elections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  jurisdiction_id uuid references public.electoral_jurisdictions(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'SCHEDULED',
  is_active boolean not null default false,
  is_paused boolean not null default false,
  created_by uuid,
  expected_voters integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.election_rooms (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  room_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  status text not null default 'ACTIVE',
  is_locked boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id) on delete cascade,
  full_name text not null,
  position text not null,
  manifesto text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.voter_audit_logs (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id) on delete cascade,
  student_id uuid,
  event_type text not null default 'vote_cast',
  constituency text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.student_constituency_selections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique,
  constituency text not null,
  locked_at timestamptz not null default now()
);

create table if not exists public.anonymous_ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id) on delete cascade,
  student_id uuid not null,
  votes jsonb not null,
  vote_hash text not null,
  submitted_at timestamptz not null default now(),
  unique (election_id, student_id)
);

create table if not exists public.election_result_publications (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections(id) on delete cascade,
  published_by uuid,
  published_at timestamptz not null default now(),
  summary jsonb not null
);

create table if not exists public.candidate_agent_signoffs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.election_rooms(id) on delete cascade,
  election_id uuid references public.elections(id) on delete cascade,
  student_id uuid not null,
  member_id uuid references public.election_room_members(id) on delete set null,
  acknowledgement text,
  turnout_snapshot jsonb,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.record_candidate_agent_signoff(
  p_student_id uuid,
  p_room_id uuid,
  p_election_id uuid,
  p_member_id uuid,
  p_acknowledgement text,
  p_turnout_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role_in_room into v_role
  from public.election_room_members
  where student_id = p_student_id
    and id = p_member_id
    and room_id = p_room_id;

  if coalesce(v_role, '') <> 'CANDIDATE_AGENT' then
    raise exception 'Unauthorized: only assigned Candidate Agents may sign off';
  end if;

  insert into public.candidate_agent_signoffs (
    room_id,
    election_id,
    student_id,
    member_id,
    acknowledgement,
    turnout_snapshot
  ) values (
    p_room_id,
    p_election_id,
    p_student_id,
    p_member_id,
    p_acknowledgement,
    p_turnout_snapshot
  )
  returning jsonb_build_object(
    'id', id,
    'room_id', room_id,
    'election_id', election_id,
    'student_id', student_id,
    'member_id', member_id,
    'acknowledgement', acknowledgement,
    'turnout_snapshot', turnout_snapshot,
    'signed_at', signed_at
  );
end;
$$;

create table if not exists public.election_room_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid,
  student_id uuid,
  socket_id text,
  is_connected boolean not null default true,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create or replace function public.set_election_poll_status(
  p_student_id uuid,
  p_election_id uuid,
  p_open boolean,
  p_pause boolean,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_election public.elections%rowtype;
  v_status text;
begin
  select role_in_room
    into v_role
  from public.election_room_members
  where student_id = p_student_id
  order by created_at desc
  limit 1;

  if coalesce(v_role, '') not in ('HEAD', 'DEPUTY') then
    raise exception 'Unauthorized: only HEAD or DEPUTY officers can change poll status';
  end if;

  select * into v_election from public.elections where id = p_election_id;
  if not found then
    raise exception 'Election not found';
  end if;

  if v_election.jurisdiction_id is not null then
    if not exists (
      select 1
      from public.election_room_members
      where student_id = p_student_id
        and jurisdiction_id = v_election.jurisdiction_id
        and role_in_room in ('HEAD', 'DEPUTY')
    ) then
      raise exception 'Unauthorized: officer is not scoped to the election jurisdiction';
    end if;
  end if;

  v_status := case
    when p_action = 'OPEN_POLLS' then 'ACTIVE'
    when p_action = 'PAUSE_POLLS' then 'PAUSED'
    when p_action = 'CLOSE_POLLS' then 'CLOSED'
    else v_election.status
  end;

  update public.elections
  set is_active = p_open,
      is_paused = p_pause,
      status = v_status
  where id = p_election_id;

  return jsonb_build_object(
    'election_id', p_election_id,
    'status', v_status,
    'is_active', p_open,
    'is_paused', p_pause
  );
end;
$$;

create or replace function public.get_election_room_turnout(p_election_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
with turnout as (
  select count(distinct student_id) as ballots
  from public.voter_audit_logs
  where election_id = p_election_id
    and event_type = 'vote_cast'
),
expected as (
  select coalesce(expected_voters, 0) as expected_voters
  from public.elections
  where id = p_election_id
)
select jsonb_build_object(
  'election_id', p_election_id,
  'turnout_count', coalesce(turnout.ballots, 0),
  'expected_voters', coalesce(expected.expected_voters, 0),
  'turnout_percentage', case
    when coalesce(expected.expected_voters, 0) > 0 then round((coalesce(turnout.ballots, 0)::numeric / expected.expected_voters::numeric) * 100.0, 2)
    else null
  end
)
from turnout, expected;
$$;

create or replace function public.get_room_active_sessions(p_room_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'room_id', p_room_id,
  'active_sessions', coalesce(count(*), 0)
)
from public.election_room_sessions
where room_id = p_room_id
  and is_connected = true
  and last_seen_at > now() - interval '5 minutes';
$$;

create or replace function public.create_election_room(
  p_student_id uuid,
  p_election_id uuid,
  p_status text,
  p_is_locked boolean,
  p_room_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_election public.elections%rowtype;
  v_code text;
begin
  select role_in_room
    into v_role
  from public.election_room_members m
  join public.election_rooms r on r.id = m.room_id
  where m.student_id = p_student_id
    and m.role_in_room in ('HEAD', 'DEPUTY')
  limit 1;

  if coalesce(v_role, '') not in ('HEAD', 'DEPUTY') then
    raise exception 'Unauthorized: only HEAD or DEPUTY officers can create election rooms';
  end if;

  select * into v_election from public.elections where id = p_election_id;
  if not found then
    raise exception 'Election not found';
  end if;

  v_code := coalesce(p_room_code, encode(gen_random_bytes(8), 'hex'));

  insert into public.election_rooms (election_id, room_code, status, is_locked, is_active, created_by)
  values (p_election_id, v_code, coalesce(p_status, 'ACTIVE'), coalesce(p_is_locked, false), true, p_student_id)
  returning id, election_id, room_code, status, is_locked, is_active
  into v_room;

  return jsonb_build_object(
    'id', v_room.id,
    'election_id', v_room.election_id,
    'room_code', v_room.room_code,
    'status', v_room.status,
    'is_locked', v_room.is_locked,
    'is_active', v_room.is_active
  );
end;
$$;

create or replace function public.assign_election_room_member(
  p_student_id uuid,
  p_room_id uuid,
  p_assigned_student_id uuid,
  p_role text,
  p_candidate_id uuid default null
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
  select * into v_room from public.election_rooms where id = p_room_id;
  if not found then
    raise exception 'Room not found';
  end if;

  select role_in_room into v_role
  from public.election_room_members m
  where m.student_id = p_student_id
    and m.jurisdiction_id = (select jurisdiction_id from public.elections where id = v_room.election_id)
    and m.role_in_room in ('HEAD', 'DEPUTY')
  limit 1;

  if coalesce(v_role, '') not in ('HEAD', 'DEPUTY') then
    raise exception 'Unauthorized: only HEAD or DEPUTY can assign members';
  end if;

  if upper(coalesce(p_role, '')) = 'CANDIDATE_AGENT' and p_candidate_id is null then
    raise exception 'A represented candidate must be provided for CANDIDATE_AGENT role';
  end if;

  insert into public.election_room_members (room_id, student_id, role_in_room, candidate_id, assigned_by)
  values (p_room_id, p_assigned_student_id, upper(p_role), p_candidate_id, p_student_id)
  returning jsonb_build_object(
    'id', id,
    'room_id', room_id,
    'student_id', student_id,
    'role_in_room', role_in_room,
    'candidate_id', candidate_id,
    'assigned_by', assigned_by
  );
end;
$$;

create or replace function public.revoke_election_room_member(
  p_student_id uuid,
  p_room_id uuid,
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role_in_room into v_role
  from public.election_room_members m
  where m.student_id = p_student_id
    and m.room_id = p_room_id
    and m.role_in_room = 'HEAD'
  limit 1;

  if coalesce(v_role, '') <> 'HEAD' then
    raise exception 'Unauthorized: only HEAD can revoke room membership';
  end if;

  delete from public.election_room_members
  where id = p_member_id
    and room_id = p_room_id;

  return jsonb_build_object('revoked', true, 'member_id', p_member_id);
end;
$$;

create or replace function public.get_user_room_membership(p_student_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'member_id', m.id,
  'role_in_room', m.role_in_room,
  'room_id', m.room_id,
  'candidate_id', m.candidate_id,
  'candidate_name', c.full_name,
  'room_code', r.room_code,
  'room_status', r.status,
  'room_locked', r.is_locked,
  'room_active', r.is_active,
  'election_id', r.election_id,
  'election_title', e.title,
  'election_jurisdiction_id', e.jurisdiction_id
)
from public.election_room_members m
left join public.election_rooms r on r.id = m.room_id
left join public.elections e on e.id = r.election_id
left join public.candidates c on c.id = m.candidate_id
where m.student_id = p_student_id
order by m.assigned_at desc
limit 1;
$$;

create or replace function public.get_candidate_room_announcement(p_student_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'room_id', m.room_id,
  'room_code', r.room_code,
  'election_id', r.election_id,
  'election_title', e.title,
  'candidate_id', c.id,
  'candidate_name', c.full_name,
  'role_in_room', m.role_in_room
)
from public.election_room_members m
join public.election_rooms r on r.id = m.room_id
join public.elections e on e.id = r.election_id
join public.candidates c on c.id = m.candidate_id
where m.student_id = p_student_id
  and upper(m.role_in_room) = 'CANDIDATE_AGENT'
order by m.assigned_at desc
limit 1;
$$;

create or replace function public.get_active_or_scheduled_elections()
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_agg(jsonb_build_object(
  'id', id,
  'title', title,
  'start_time', start_time,
  'end_time', end_time,
  'status', status,
  'is_active', is_active,
  'jurisdiction_id', jurisdiction_id
) order by start_time desc)
from public.elections
where status in ('ACTIVE','PAUSED','SCHEDULED');
$$;

create or replace function public.get_room_details(p_room_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_build_object(
  'room_id', r.id,
  'room_code', r.room_code,
  'status', r.status,
  'is_locked', r.is_locked,
  'is_active', r.is_active,
  'election_id', r.election_id,
  'election_title', e.title,
  'election_status', e.status,
  'election_start_time', e.start_time,
  'election_end_time', e.end_time
)
from public.election_rooms r
join public.elections e on e.id = r.election_id
where r.id = p_room_id;
$$;

create or replace function public.get_room_members(p_room_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
select jsonb_agg(jsonb_build_object(
  'member_id', m.id,
  'student_id', m.student_id,
  'role_in_room', m.role_in_room,
  'candidate_id', m.candidate_id,
  'candidate_name', c.full_name,
  'assigned_at', m.assigned_at
) order by m.assigned_at desc)
from public.election_room_members m
left join public.candidates c on c.id = m.candidate_id
where m.room_id = p_room_id;
$$;

create or replace function public.get_constituency_breakdown(p_election_id uuid)
returns table (constituency text, ballots bigint)
language sql
security definer
set search_path = public
as $$
select coalesce(s.constituency, 'Unspecified') as constituency,
       count(distinct l.student_id) as ballots
from public.voter_audit_logs l
left join public.student_constituency_selections s on s.student_id = l.student_id
where l.election_id = p_election_id
  and l.event_type = 'vote_cast'
group by coalesce(s.constituency, 'Unspecified')
order by ballots desc;
$$;

create or replace function public.tally_and_decrypt_results(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_hash text;
  v_candidate_totals jsonb;
begin
  select count(*)
    into v_total
  from public.anonymous_ballots
  where election_id = p_election_id;

  select encode(digest(string_agg(coalesce(id::text, '') || ':' || coalesce(student_id::text, '') || ':' || coalesce(votes::text, ''), '|'), 'sha256'), 'hex')
    into v_hash
  from public.anonymous_ballots
  where election_id = p_election_id;

  select jsonb_agg(jsonb_build_object(
    'candidate_name', candidate_name,
    'position', position,
    'votes', votes_count
  ))
    into v_candidate_totals
  from (
    select c.full_name as candidate_name,
           c.position,
           count(*) as votes_count
    from public.anonymous_ballots ab
    cross join lateral jsonb_array_elements(ab.votes::jsonb) as ballot_item(item)
    left join public.candidates c on c.id::text = ballot_item.item->>'candidate_id'
    where ab.election_id = p_election_id
    group by c.full_name, c.position
    order by c.position, c.full_name
  ) as tally;

  return jsonb_build_object(
    'total_ballots', coalesce(v_total, 0),
    'hash_log', coalesce(v_hash, 'no-ballots'),
    'candidate_totals', coalesce(v_candidate_totals, '[]'::jsonb)
  );
end;
$$;

create or replace function public.publish_results_to_aim(p_election_id uuid, p_publish boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  select public.tally_and_decrypt_results(p_election_id) into v_summary;

  insert into public.election_result_publications (election_id, published_by, summary)
  values (p_election_id, auth.uid(), jsonb_build_object(
    'published', p_publish,
    'summary', v_summary
  ));

  return jsonb_build_object(
    'published', p_publish,
    'summary', v_summary
  );
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.electoral_jurisdictions to authenticated;
grant select, insert, update, delete on public.election_room_members to authenticated;
grant select, insert, update, delete on public.elections to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;
grant select, insert, update, delete on public.voter_audit_logs to authenticated;
grant select, insert, update, delete on public.student_constituency_selections to authenticated;
grant select, insert, update, delete on public.anonymous_ballots to authenticated;
grant select, insert, update, delete on public.election_result_publications to authenticated;
grant select, insert, update, delete on public.candidate_agent_signoffs to authenticated;
grant select, insert, update, delete on public.election_room_sessions to authenticated;

grant execute on function public.set_election_poll_status(uuid, uuid, boolean, boolean, text) to authenticated;
grant execute on function public.get_election_room_turnout(uuid) to authenticated;
grant execute on function public.get_room_active_sessions(uuid) to authenticated;
grant execute on function public.create_election_room(uuid, uuid, text, boolean, text) to authenticated;
grant execute on function public.assign_election_room_member(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.revoke_election_room_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_user_room_membership(uuid) to authenticated;
grant execute on function public.get_candidate_room_announcement(uuid) to authenticated;
grant execute on function public.get_room_members(uuid) to authenticated;
grant execute on function public.get_active_or_scheduled_elections() to authenticated;
grant execute on function public.get_room_details(uuid) to authenticated;
grant execute on function public.record_candidate_agent_signoff(uuid, uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.get_constituency_breakdown(uuid) to authenticated;
grant execute on function public.tally_and_decrypt_results(uuid) to authenticated;
grant execute on function public.publish_results_to_aim(uuid, boolean) to authenticated;
