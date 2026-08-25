---
name: Enrollment status constraint
description: Allowed student_enrollments.status values and promote-flow closing rule
---
`student_enrollments.status` check constraint allows only: active, withdrawn, graduated, suspended (plus 'promoted' after the user runs the constraint-extension SQL appended to DATABASE_SETUP_ACTIVITY_LOG.sql).
**Why:** Promote must close the old-year enrollment or students reappear as active in two years (broke Promote in Aug 2026). Code writes 'promoted', falls back to 'withdrawn' on error 23514.
**How to apply:** Never leave two active enrollments per student; when adding statuses, extend the check constraint via user-run SQL (no service key).
