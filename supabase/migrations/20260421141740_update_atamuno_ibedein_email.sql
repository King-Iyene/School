/*
  # Update Atamuno Ibedein Email

  Corrects a typo in the login email for Atamuno Ibedein:
  - Old: atamuno.ibedein@okrika.edu.ng
  - New: atamuno.ibiedein@okrika.edu.ng

  1. Updates auth.users (the login credential)
  2. Updates profiles (the app-level user record)
*/

-- Update the auth identity/user email
UPDATE auth.users
SET
  email = 'atamuno.ibiedein@okrika.edu.ng',
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE id = 'd61ccb7e-bb39-4a28-b3dc-56ff572f5458';

-- Update the email in auth.identities (used for sign-in lookup)
UPDATE auth.identities
SET
  identity_data = jsonb_set(identity_data, '{email}', '"atamuno.ibiedein@okrika.edu.ng"'),
  updated_at = now()
WHERE user_id = 'd61ccb7e-bb39-4a28-b3dc-56ff572f5458'
  AND provider = 'email';

-- Update the profiles table
UPDATE profiles
SET
  email = 'atamuno.ibiedein@okrika.edu.ng',
  updated_at = now()
WHERE id = 'd61ccb7e-bb39-4a28-b3dc-56ff572f5458';
