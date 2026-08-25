---
name: Students list caching & graduated exclusion
description: Cache-key bump rule for Students list/export queries; graduated students live in Alumni module
---
- The staff Students page caches its list AND its CSV export for 1 hour with versioned cache keys (`students_vN_...`, `students_export_vN_...`). Any change to either query's filters must bump BOTH keys or users see stale results for up to an hour.
- **Why:** query changed to exclude `status='graduated'` (Alumni module); export was initially missed and still included graduates.
- **How to apply:** whenever editing filters in the Students page, bump both cache keys in the same change.
- Graduated students are intentionally hidden from Students and shown in the Alumni page instead; their profile/results remain accessible via the shared StudentProfile.
- `activity_logs` table + RLS (and `student_promotions` policies) are created by `artifacts/ogs-school/DATABASE_SETUP_ACTIVITY_LOG.sql`, which the user must run in the Supabase SQL editor — no service key available for DDL. Client logging (`lib/activityLog.ts`) silent-fails until then.
