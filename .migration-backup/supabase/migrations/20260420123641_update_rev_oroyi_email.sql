
/*
  # Update Rev Emmanuel Oroyi's Email

  ## Changes
  - Updates login email from rev.oroyi@okrika.edu.ng → emmanuel.oraoyi@okrika.edu.ng

  ## Tables Updated
  - `auth.users` — login email + raw_user_meta_data email field
  - `public.profiles` — email field
  - `public.staff_records` — email field

  ## Notes
  - User ID: d0d8f26d-11ee-4767-bf86-2a489d6fc960
*/

-- 1. Update auth.users email and metadata
UPDATE auth.users
SET
  email = 'emmanuel.oraoyi@okrika.edu.ng',
  raw_user_meta_data = jsonb_set(raw_user_meta_data, '{email}', '"emmanuel.oraoyi@okrika.edu.ng"'),
  updated_at = now()
WHERE id = 'd0d8f26d-11ee-4767-bf86-2a489d6fc960';

-- 2. Update profiles email
UPDATE public.profiles
SET
  email = 'emmanuel.oraoyi@okrika.edu.ng',
  updated_at = now()
WHERE id = 'd0d8f26d-11ee-4767-bf86-2a489d6fc960';

-- 3. Update staff_records email
UPDATE public.staff_records
SET
  email = 'emmanuel.oraoyi@okrika.edu.ng',
  updated_at = now()
WHERE id = 'd0d8f26d-11ee-4767-bf86-2a489d6fc960';
