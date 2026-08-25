-- ============================================================
-- OGS School Portal — Activity Log setup + Promotion history fix
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Activity log table: records every important action taken by staff
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  user_name text not null default 'Unknown',
  user_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  student_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_school_created_idx
  on public.activity_logs (school_id, created_at desc);
create index if not exists activity_logs_student_idx
  on public.activity_logs (student_id, created_at desc);

alter table public.activity_logs enable row level security;

-- Staff can WRITE log entries, but only as themselves and only for their own school
drop policy if exists "staff can insert activity logs" on public.activity_logs;
create policy "staff can insert activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role not in ('student', 'parent')
        and p.school_id = activity_logs.school_id
    )
  );

-- Staff can READ log entries from their own school only.
-- (The Activity Log page itself is limited to super_admin/admin/principal in the app;
-- class teachers see a student's activity on the profile History tab.)
drop policy if exists "staff can read activity logs" on public.activity_logs;
drop policy if exists "staff can select activity logs" on public.activity_logs;
create policy "staff can select activity logs"
  on public.activity_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role not in ('student', 'parent')
        and p.school_id = activity_logs.school_id
    )
  );

-- 2) Promotion history fix (task: allow promotion records to be saved)
-- Admins could not save promotion/graduation history because inserts were blocked.
-- Insert: only admins, and only for students of their own school.
drop policy if exists "staff can insert student promotions" on public.student_promotions;
create policy "staff can insert student promotions"
  on public.student_promotions for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      join public.students s on s.id = student_promotions.student_id
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin', 'principal')
        and s.school_id = p.school_id
    )
  );

-- Read: staff of the same school as the student
drop policy if exists "staff can read student promotions" on public.student_promotions;
drop policy if exists "staff can select student promotions" on public.student_promotions;
create policy "staff can select student promotions"
  on public.student_promotions for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.students s on s.id = student_promotions.student_id
      where p.id = auth.uid()
        and p.role not in ('student', 'parent')
        and s.school_id = p.school_id
    )
  );

-- ---------------------------------------------------------------
-- Allow 'promoted' as an enrollment status.
-- When students are promoted, their old year's enrollment is closed
-- with status 'promoted' so they stop showing as active in the old
-- class. Older databases only allowed active/withdrawn/graduated/
-- suspended, so this extends the check constraint.
-- ---------------------------------------------------------------
alter table public.student_enrollments
  drop constraint if exists student_enrollments_status_check;
alter table public.student_enrollments
  add constraint student_enrollments_status_check
  check (status in ('active', 'withdrawn', 'graduated', 'suspended', 'promoted'));

-- Relabel the enrollments the Promote page closed with the fallback
-- 'withdrawn' status on 11 Aug 2026 (before 'promoted' was allowed).
-- Deliberately narrow: only that class/year batch, and only students
-- who do have the newer active enrollment created by that promotion.
update public.student_enrollments e
set status = 'promoted'
where e.status = 'withdrawn'
  and e.academic_year_id = '7bd1d805-7e8e-458a-8570-bf4dd8849824'
  and e.class_id = '1424cb7d-c7bb-4ce2-9cf0-8f5d1b092e97'
  and exists (
    select 1 from public.student_enrollments n
    where n.student_id = e.student_id
      and n.status = 'active'
      and n.academic_year_id = '988b21c1-8b91-4701-9f58-f0ab067608d6'
      and n.class_id = '9c91caa3-3aa4-4d57-880b-763bb3424a95'
  );
