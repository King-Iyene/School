/*
  # Fix admission_queries status check constraint

  ## Problem
  The existing check constraint only allows: active, inactive, converted, closed
  But the application uses 'follow_up' as a valid status value when logging follow-ups.

  ## Changes
  - Drop the existing admission_queries_status_check constraint
  - Add a new constraint that includes 'follow_up' as a valid status
*/

ALTER TABLE admission_queries
  DROP CONSTRAINT IF EXISTS admission_queries_status_check;

ALTER TABLE admission_queries
  ADD CONSTRAINT admission_queries_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'follow_up'::text, 'converted'::text, 'closed'::text]));
