-- Requisitions: itemized expenses + "Reimbursed from Account" stage
-- Run this in the Supabase SQL Editor.

-- 1. Itemized list of expenses/requests printed on the requisition form
alter table public.requisitions
  add column if not exists items jsonb;

-- 2. Allow the new 'reimbursed' status (stage after Retired)
alter table public.requisitions
  drop constraint if exists requisitions_status_check;
alter table public.requisitions
  add constraint requisitions_status_check
  check (status in ('pending','approved','rejected','disbursed','retired','reimbursed'));
