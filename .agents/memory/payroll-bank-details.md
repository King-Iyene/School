---
name: Payroll bank details storage
description: How bank/payment details are stored in payroll records without extra DB columns
---

Bank name, account number, account name are stored as a JSON string in `payroll_records.notes`:
`{"bank_name":"First Bank","account_number":"1234567890","account_name":"John Doe","note":"optional"}`

`parseNotes()` tries JSON.parse; falls back to treating notes as plain text.
`buildNotes()` stringifies the BankDetails object.

**Why:** Adding columns to payroll_records requires user to run SQL in Supabase. JSON-in-notes avoids that friction while still snapshotting bank details per-month voucher.

**How to apply:** Any code reading/writing payroll notes must use parseNotes/buildNotes helpers (both defined in Payroll.tsx). PayrollReport.tsx has its own getBankDetails() copy for display.

If the school later wants proper columns: `ALTER TABLE payroll_records ADD COLUMN bank_name text, ADD COLUMN account_number text, ADD COLUMN account_name text;` and migrate.
