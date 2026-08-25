-- ============================================================
-- OGS School Portal — Let parents find their child by admission number
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query
--
-- Why: security rules only let parents see students already linked
-- to them, so the "Link a Child" search always returned no results.
-- This adds a safe lookup that returns only the child's name and
-- admission number, and lets a parent create their own link.
-- ============================================================

-- 1) Safe student lookup for the "Link a Child" flow
create or replace function public.find_student_for_link(adm text)
returns table (
  id uuid,
  first_name text,
  last_name text,
  admission_number text,
  gender text,
  school_id uuid
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.first_name, s.last_name, s.admission_number, s.gender, s.school_id
  from public.students s
  where s.admission_number = trim(adm)
    and s.status = 'active'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
        and (p.school_id is null or p.school_id = s.school_id)
    )
  limit 1;
$$;

revoke all on function public.find_student_for_link(text) from public;
grant execute on function public.find_student_for_link(text) to authenticated;

-- 2) Parents may link themselves to a student (only as themselves)
drop policy if exists "parents can link their own children" on public.parent_student_links;
create policy "parents can link their own children"
  on public.parent_student_links for insert
  to authenticated
  with check (
    parent_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'parent'
    )
  );

-- 3) Parents may unlink their own children
drop policy if exists "parents can unlink their own children" on public.parent_student_links;
create policy "parents can unlink their own children"
  on public.parent_student_links for delete
  to authenticated
  using (parent_id = auth.uid());
