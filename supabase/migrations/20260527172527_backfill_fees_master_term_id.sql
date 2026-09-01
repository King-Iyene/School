/*
  # Backfill fees_master term_id and add NOT NULL constraint

  1. Changes
    - Backfills all NULL term_id records based on due_date month ranges:
      - Sep-Dec → First Term (00000000-0000-0000-0000-000000000001)
      - Jan-Mar → Second Term (00000000-0000-0000-0000-000000000002)
      - Apr-Jul → Third Term (00000000-0000-0000-0000-000000000003)
    - Any remaining NULL records (no due_date or Aug) default to First Term
    - Adds NOT NULL constraint to term_id to prevent future NULL values

  2. Important notes
    - All 12 existing NULL records have due_date in April, so they get assigned to Third Term
    - After this migration, term_id is always required on fees_master
*/

-- Assign Third Term to records with due dates in Apr–Jul
UPDATE fees_master
SET term_id = '00000000-0000-0000-0000-000000000003'
WHERE term_id IS NULL
  AND due_date IS NOT NULL
  AND EXTRACT(MONTH FROM due_date) BETWEEN 4 AND 7;

-- Assign First Term to records with due dates in Sep–Dec
UPDATE fees_master
SET term_id = '00000000-0000-0000-0000-000000000001'
WHERE term_id IS NULL
  AND due_date IS NOT NULL
  AND EXTRACT(MONTH FROM due_date) BETWEEN 9 AND 12;

-- Assign Second Term to records with due dates in Jan–Mar
UPDATE fees_master
SET term_id = '00000000-0000-0000-0000-000000000002'
WHERE term_id IS NULL
  AND due_date IS NOT NULL
  AND EXTRACT(MONTH FROM due_date) BETWEEN 1 AND 3;

-- Catch-all: assign First Term to any remaining NULL records
UPDATE fees_master
SET term_id = '00000000-0000-0000-0000-000000000001'
WHERE term_id IS NULL;

-- Add NOT NULL constraint now that all records have a term_id
ALTER TABLE fees_master ALTER COLUMN term_id SET NOT NULL;