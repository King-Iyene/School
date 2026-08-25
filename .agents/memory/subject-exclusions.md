---
name: Subject exclusions semantics
description: How excluded subjects are treated in results (kept, shown flagged, not counted)
---
Rule: a student_subject_exclusions row means the subject's score is KEPT in `grades` and displayed with NO visible marker (school adds any note by hand at print time, for consistency), but skipped in totals/averages/positions on every result view (report print, class broadsheet, student/parent portals, result cards). Only the admin subjects tab and marks register show an "Not offered" indicator for staff.
**Why:** School decision (Aug 2026): scores must remain visible/auditable; earlier delete-based semantics destroyed data. Do NOT reintroduce grade deletion or blocking triggers for exclusions.
**How to apply:** Exclusion matches when academic_year_id matches AND (term_id is null OR equals the displayed term). Any new results view must fetch exclusions with a silent `?? []` fallback (RLS may block) and mirror the existing skip-total<=0 pattern.
