
/*
  # Update Atonke Dede's Email and Name

  ## Changes
  - Corrects the teacher's email from atoke.dede@okrika.edu.ng → atonke.dede@okrika.edu.ng
  - Corrects first_name spelling from "Atoke" → "Atonke" in all relevant places

  ## Tables Updated
  - `auth.users` — login email + raw_user_meta_data first_name
  - `public.profiles` — email field
  - `public.staff_records` — email and first_name fields

  ## Notes
  - User ID: 265e6d24-4fdd-4313-a408-4d948536d5ef
*/

-- 1. Update auth.users email and metadata first_name
UPDATE auth.users
SET
  email = 'atonke.dede@okrika.edu.ng',
  raw_user_meta_data = jsonb_set(
    jsonb_set(raw_user_meta_data, '{first_name}', '"Atonke"'),
    '{email}', '"atonke.dede@okrika.edu.ng"'
  ),
  updated_at = now()
WHERE id = '265e6d24-4fdd-4313-a408-4d948536d5ef';

-- 2. Update profiles email
UPDATE public.profiles
SET
  email = 'atonke.dede@okrika.edu.ng',
  updated_at = now()
WHERE id = '265e6d24-4fdd-4313-a408-4d948536d5ef';

-- 3. Update staff_records email and first_name
UPDATE public.staff_records
SET
  email = 'atonke.dede@okrika.edu.ng',
  first_name = 'Atonke',
  updated_at = now()
WHERE id = '265e6d24-4fdd-4313-a408-4d948536d5ef';
