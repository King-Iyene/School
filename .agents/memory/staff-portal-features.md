---
name: Staff portal new tables
description: New DB tables and profile columns needed for staff portal features (accommodation, HOD reports, My Profile bank/NOK details)
---

## New profile columns (ALTER TABLE)
Run once in Supabase SQL Editor to enable MyProfile bank + NOK fields:
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS next_of_kin_address text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS staff_id_no text;
```

## New tables
- `staff_accommodation_assignments` — staff assigned to quarters/offices
- `hod_reports` — departmental reports submitted by HODs

Both tables need SQL + RLS policy (shown in in-app banners when table is missing; error code 42P01 triggers the banner).

**Why:** Supabase schema cache returns 42P01 when a table or column doesn't exist, so each page checks for that error code and surfaces a copy-SQL banner rather than silently failing.

**How to apply:** When any of these features shows the amber SQL banner, copy and run the SQL in Supabase SQL Editor, then refresh. No code changes needed.
