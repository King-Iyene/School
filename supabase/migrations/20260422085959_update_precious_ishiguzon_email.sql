/*
  # Fix email typo for Corp Precious O. Ishiguzon
  Updates login email from precious.ishiiguzon@okrika.edu.ng
  to precious.ishiguzon@okrika.edu.ng (removes duplicate 'i')
*/

-- Update auth login email
UPDATE auth.users
SET email = 'precious.ishiguzon@okrika.edu.ng',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = 'e49d5a92-4542-42bf-821a-b8740afb2a70';

-- Update profile record
UPDATE profiles
SET email = 'precious.ishiguzon@okrika.edu.ng',
    updated_at = now()
WHERE id = 'e49d5a92-4542-42bf-821a-b8740afb2a70';
