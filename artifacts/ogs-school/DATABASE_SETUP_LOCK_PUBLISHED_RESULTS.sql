-- ============================================================
-- OGS School Portal — Lock scores once results are published.
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query
--
-- After a class's results are published for a term, only the
-- Super Admin or Principal can add, change or delete scores for
-- that class/term. Everyone else is blocked at the database level
-- (so it cannot be bypassed), until results are unpublished.
-- ============================================================

-- Helper: is the caller allowed to edit published results?
create or replace function public.can_edit_published_results()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('super_admin', 'principal')
  );
$$;

-- Helper: is a class/term/year published?
create or replace function public.results_are_published(p_class uuid, p_term uuid, p_year uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.result_compilations rc
    where rc.class_id = p_class
      and rc.term_id = p_term
      and rc.academic_year_id = p_year
      and rc.status = 'published'
  );
$$;

-- 1) Lock the grades table.
--    On UPDATE both the old row's context and the new row's context are
--    checked, so a locked score cannot be "moved" to an unpublished
--    class/term to sneak an edit through.
create or replace function public.block_grades_when_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hit boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') and public.results_are_published(old.class_id, old.term_id, old.academic_year_id) then
    hit := true;
  end if;
  if not hit and tg_op in ('INSERT', 'UPDATE') and public.results_are_published(new.class_id, new.term_id, new.academic_year_id) then
    hit := true;
  end if;

  if hit and not public.can_edit_published_results() then
    raise exception 'Results for this class and term have been published. Only the Super Admin or Principal can change scores (or unpublish the results first).';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_grades_when_published on public.grades;
create trigger trg_block_grades_when_published
  before insert or update or delete on public.grades
  for each row execute function public.block_grades_when_published();

-- 2) Lock the exam marks register (raw CA/Test/Exam entries),
--    which is linked to a term through its exam.
create or replace function public.exam_marks_published(p_exam uuid, p_class uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.exams e
    join public.result_compilations rc
      on rc.class_id = p_class
     and rc.term_id = e.term_id
     and rc.academic_year_id = e.academic_year_id
     and rc.status = 'published'
    where e.id = p_exam
  );
$$;

create or replace function public.block_exam_marks_when_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hit boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') and public.exam_marks_published(old.exam_name_id, old.class_id) then
    hit := true;
  end if;
  if not hit and tg_op in ('INSERT', 'UPDATE') and public.exam_marks_published(new.exam_name_id, new.class_id) then
    hit := true;
  end if;

  if hit and not public.can_edit_published_results() then
    raise exception 'Results for this class and term have been published. Only the Super Admin or Principal can change scores (or unpublish the results first).';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_exam_marks_when_published on public.exam_marks_records;
create trigger trg_block_exam_marks_when_published
  before insert or update or delete on public.exam_marks_records
  for each row execute function public.block_exam_marks_when_published();
