-- Migration: Add is_locked to staff_attendance_records
ALTER TABLE staff_attendance_records ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
