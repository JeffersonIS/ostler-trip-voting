-- Run this file once in Supabase: SQL Editor > New query > Run.
-- The app never receives PIN hashes or any other household's ballot.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ballots (
  name text primary key check (name in (
    'Scott / Delene', 'Jackson / Katie', 'Harrison / Jerika',
    'Jefferson / Amber', 'Benson', 'Wilson / Emily', 'Amanda', 'Saydi / Dave'
  )),
  pin_hash text not null,
  votes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ballots enable row level security;
revoke all on table public.ballots from anon, authenticated;

-- Household-list migration for existing projects.
alter table public.ballots drop constraint if exists ballots_name_check;
alter table public.ballots add constraint ballots_name_check check (name in (
  'Scott / Delene', 'Jackson / Katie', 'Harrison / Jerika',
  'Jefferson / Amber', 'Benson', 'Wilson / Emily', 'Amanda', 'Saydi / Dave'
));

create or replace function public.ballot_exists(p_name text)
returns boolean
language sql
security definer
set search_path = public
as $$ select exists(select 1 from public.ballots where name = p_name); $$;

create or replace function public.create_ballot(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_name not in ('Scott / Delene', 'Jackson / Katie', 'Harrison / Jerika', 'Jefferson / Amber', 'Benson', 'Wilson / Emily', 'Amanda', 'Saydi / Dave')
     or p_pin !~ '^[0-9]{4}$' then
    raise exception 'Invalid ballot setup';
  end if;
  insert into public.ballots (name, pin_hash)
  values (p_name, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  return '{}'::jsonb;
exception when unique_violation then
  raise exception 'Unable to verify that PIN. Please try again.';
end;
$$;

create or replace function public.get_ballot(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare result jsonb;
begin
  select votes into result from public.ballots
    where name = p_name and pin_hash = extensions.crypt(p_pin, pin_hash);
  if result is null then raise exception 'Unable to verify that PIN. Please try again.'; end if;
  return result;
end;
$$;

create or replace function public.save_ballot(p_name text, p_pin text, p_votes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if jsonb_typeof(p_votes) <> 'object' then raise exception 'Invalid ballot'; end if;
  if exists (
    select 1 from public.ballots
    where name = p_name
      and pin_hash = extensions.crypt(p_pin, pin_hash)
      and votes ? '_submittedAt'
  ) then
    raise exception 'Ballot is locked';
  end if;
  update public.ballots set votes = p_votes, updated_at = now()
    where name = p_name and pin_hash = extensions.crypt(p_pin, pin_hash);
  if not found then raise exception 'Unable to verify that PIN. Please try again.'; end if;
  return p_votes;
end;
$$;

revoke all on function public.ballot_exists(text) from public;
revoke all on function public.create_ballot(text, text) from public;
revoke all on function public.get_ballot(text, text) from public;
revoke all on function public.save_ballot(text, text, jsonb) from public;
grant execute on function public.ballot_exists(text) to anon;
grant execute on function public.create_ballot(text, text) to anon;
grant execute on function public.get_ballot(text, text) to anon;
grant execute on function public.save_ballot(text, text, jsonb) to anon;

-- ADMIN SETUP (run after creating an email/password user in Authentication > Users).
-- Replace the placeholder with that user's email, then run this block.
-- Do not use a broad "authenticated" policy: it would let every account read votes.
drop policy if exists "Admin manages ballots" on public.ballots;
create policy "Admin manages ballots" on public.ballots
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'REPLACE_WITH_ADMIN_EMAIL')
  with check ((auth.jwt() ->> 'email') = 'REPLACE_WITH_ADMIN_EMAIL');

-- PIN-ONLY ADMIN (run this block to use the /admin Jefferson / Amber PIN gate).
-- These functions verify the PIN against its existing bcrypt hash and are the
-- only anonymous path that can read or modify the ballots table.
drop function if exists public.admin_list_ballots(text);
create or replace function public.admin_list_ballots(p_admin_pin text)
returns table(ballot_name text, ballot_votes jsonb, ballot_updated_at timestamptz)
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.ballots where name = 'Jefferson / Amber' and pin_hash = extensions.crypt(p_admin_pin, pin_hash)) then raise exception 'Not authorized'; end if;
  return query select b.name, b.votes, b.updated_at from public.ballots b order by b.name;
end;
$$;

create or replace function public.admin_save_ballot(p_admin_pin text, p_name text, p_votes jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.ballots where name = 'Jefferson / Amber' and pin_hash = extensions.crypt(p_admin_pin, pin_hash)) or jsonb_typeof(p_votes) <> 'object' then raise exception 'Not authorized'; end if;
  update public.ballots set votes = p_votes, updated_at = now() where name = p_name;
  if not found then raise exception 'Ballot not found'; end if;
  return p_votes;
end;
$$;

create or replace function public.admin_delete_ballot(p_admin_pin text, p_name text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if p_name = 'Jefferson / Amber' or not exists (select 1 from public.ballots where name = 'Jefferson / Amber' and pin_hash = extensions.crypt(p_admin_pin, pin_hash)) then raise exception 'Not authorized'; end if;
  delete from public.ballots where name = p_name;
end;
$$;

create or replace function public.admin_create_ballot(p_admin_pin text, p_name text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.ballots where name = 'Jefferson / Amber' and pin_hash = extensions.crypt(p_admin_pin, pin_hash))
     or p_name not in ('Scott / Delene', 'Jackson / Katie', 'Harrison / Jerika', 'Jefferson / Amber', 'Benson', 'Wilson / Emily', 'Amanda', 'Saydi / Dave')
     or p_pin !~ '^[0-9]{4}$' then raise exception 'Not authorized'; end if;
  insert into public.ballots (name, pin_hash) values (p_name, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  return '{}'::jsonb;
exception when unique_violation then raise exception 'Ballot already exists';
end;
$$;

revoke all on function public.admin_list_ballots(text) from public;
revoke all on function public.admin_save_ballot(text, text, jsonb) from public;
revoke all on function public.admin_delete_ballot(text, text) from public;
revoke all on function public.admin_create_ballot(text, text, text) from public;
grant execute on function public.admin_list_ballots(text) to anon;
grant execute on function public.admin_save_ballot(text, text, jsonb) to anon;
grant execute on function public.admin_delete_ballot(text, text) to anon;
grant execute on function public.admin_create_ballot(text, text, text) to anon;

-- PUBLIC RESULTS: exposes submitted vote JSON only; PIN hashes and unsubmitted
-- ballots remain inaccessible.
create or replace function public.public_results()
returns table(household text, votes jsonb)
language sql security definer set search_path = public
as $$
  select b.name, b.votes
  from public.ballots b
  where b.votes ? '_submittedAt'
  order by b.name;
$$;

revoke all on function public.public_results() from public;
grant execute on function public.public_results() to anon;
