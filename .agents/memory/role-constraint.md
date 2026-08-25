---
name: Role constraint updates
description: What needs to change when adding a new user role to the system
---

Adding a new role requires changes in TWO places:
1. **Frontend** — update ROLES/STAFF_ROLES arrays in: Payroll.tsx, PayrollReport.tsx, navConfig.ts, Users.tsx, App.tsx, types.ts (UserRole union), and any role-specific components (StaffList, StaffIDCardPrint, StaffAssessment, TeacherProfileView).
2. **Supabase DB** — user must run SQL in Supabase SQL Editor to drop and re-add the `profiles_role_check` constraint with the new role value included.

**Why:** Supabase has a CHECK constraint on `profiles.role` column. If the constraint isn't updated, inserting/updating a profile with the new role throws a DB error even though the frontend code is correct.

**How to apply:** After any frontend role addition, provide the user with ready-to-run SQL:
```sql
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin','admin','principal','head_teacher','teacher','nur_prim_teacher','non_teaching_staff','matron','porter','cleaner','admin_support','student','parent','accountant','security_officer','diocesan_official'));
```
