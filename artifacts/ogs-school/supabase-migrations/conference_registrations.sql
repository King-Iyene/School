-- Conference registrations for the 2026 Wakirike Be-Se Bible Study Conference & Mega Crusade
-- Public form at /conference-registration inserts into this table.

create table if not exists public.conference_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 200),
  church text not null check (char_length(church) between 1 and 200),
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%.__%')),
  phone text not null check (char_length(phone) between 5 and 30),
  is_couple boolean not null default false,
  spouse_name text check (spouse_name is null or char_length(spouse_name) <= 200),
  spouse_phone text check (spouse_phone is null or char_length(spouse_phone) <= 30),
  created_at timestamptz not null default now()
);

alter table public.conference_registrations enable row level security;

-- Anyone (including anonymous visitors) may register
drop policy if exists "Public can register for conference" on public.conference_registrations;
create policy "Public can register for conference"
  on public.conference_registrations
  for insert
  to anon, authenticated
  with check (true);

-- Only staff/admin roles can view registrations (not students or parents)
drop policy if exists "Authenticated can view conference registrations" on public.conference_registrations;
drop policy if exists "Staff can view conference registrations" on public.conference_registrations;
create policy "Staff can view conference registrations"
  on public.conference_registrations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin', 'principal', 'head_teacher', 'accountant')
    )
  );
