
/*
  # Update Ruth Irisiominabo's Email

  ## Changes
  - Updates login email from ruth.irisiominabo@okrika.edu.ng → ruth.irisominabo@okrika.edu.ng

  ## Tables Updated
  - `auth.users` — login email + raw_user_meta_data email field
  - `public.profiles` — email field
  - `public.staff_records` — email field

  ## Notes
  - User ID: 6ca7a5c1-2374-49bc-aaaa-bd9ec89cdff0
*/

-- 1. Update auth.users email and metadata
UPDATE auth.users
SET
  email = 'ruth.irisominabo@okrika.edu.ng',
  raw_user_meta_data = jsonb_set(raw_user_meta_data, '{email}', '"ruth.irisominabo@okrika.edu.ng"'),
  updated_at = now()
WHERE id = '6ca7a5c1-2374-49bc-aaaa-bd9ec89cdff0';

-- 2. Update profiles email
UPDATE public.profiles
SET
  email = 'ruth.irisominabo@okrika.edu.ng',
  updated_at = now()
WHERE id = '6ca7a5c1-2374-49bc-aaaa-bd9ec89cdff0';

-- 3. Update staff_records email
UPDATE public.staff_records
SET
  email = 'ruth.irisominabo@okrika.edu.ng',
  updated_at = now()
WHERE id = '6ca7a5c1-2374-49bc-aaaa-bd9ec89cdff0';
