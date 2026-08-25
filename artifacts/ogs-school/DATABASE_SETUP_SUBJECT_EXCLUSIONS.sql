-- ============================================================
-- OGS School Portal — Subject exclusions ("does not offer").
-- An excluded subject's score STAYS in the database and is still
-- shown on results, but must NOT count toward the student's total,
-- average or class position.
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query
--
-- What it does:
--  1. Lets staff delete grade rows (the mark register's "remove
--     score" button was silently failing without this).
--  2. Lets any authenticated user of the same school READ the
--     student_subject_exclusions table, so students/parents compute
--     the same exclusion-aware averages as staff views.
--  3. Cleans up the previous install: the one-time grade DELETE and
--     the insert/update-blocking trigger are removed, because scores
--     must now be kept.
-- ============================================================

-- 1) Staff (non-student/parent, same school) may delete grades
drop policy if exists "staff can delete grades in their school" on public.grades;
create policy "staff can delete grades in their school"
  on public.grades for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.students s on s.id = grades.student_id
      where p.id = auth.uid()
        and p.role not in ('student', 'parent')
        and p.school_id = s.school_id
    )
  );

-- 2) Any authenticated user in the same school may read exclusions
--    (students/parents need this so their pages compute the same
--    exclusion-aware averages and positions as staff views).
alter table public.student_subject_exclusions enable row level security;
drop policy if exists "same school can read subject exclusions" on public.student_subject_exclusions;
create policy "same school can read subject exclusions"
  on public.student_subject_exclusions for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.school_id = student_subject_exclusions.school_id
    )
  );

-- 3) Clean up the previous install — scores are now KEPT, so the
--    trigger/function that blocked saving grades for excluded
--    subjects must be removed. (Idempotent: safe if never installed.)
drop trigger if exists trg_block_excluded_subject_grades on public.grades;
drop function if exists public.block_excluded_subject_grades();
