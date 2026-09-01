/*
  # Add fee payment approval workflow

  1. Modified Tables
    - `fees_collections`
      - `approval_status` (text, default 'pending') - tracks whether payment is pending, approved, or rejected
      - `approved_by` (uuid, nullable) - references the admin who approved/rejected
      - `approved_at` (timestamptz, nullable) - when the approval/rejection occurred
      - `rejection_reason` (text, nullable) - reason if rejected

  2. Important Notes
    - All new payments will default to 'pending' status
    - Only approved payments count toward student balances
    - Super admins can approve or reject pending payments
    - Existing records are set to 'approved' to maintain continuity
*/

-- Add approval columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees_collections' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE fees_collections ADD COLUMN approval_status text DEFAULT 'pending' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees_collections' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE fees_collections ADD COLUMN approved_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees_collections' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE fees_collections ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fees_collections' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE fees_collections ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Mark all existing records as approved so they continue to count
UPDATE fees_collections SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Add constraint to limit valid statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'fees_collections_approval_status_check'
  ) THEN
    ALTER TABLE fees_collections ADD CONSTRAINT fees_collections_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Index for quick lookup of pending approvals
CREATE INDEX IF NOT EXISTS idx_fees_collections_approval_status ON fees_collections(approval_status) WHERE approval_status = 'pending';