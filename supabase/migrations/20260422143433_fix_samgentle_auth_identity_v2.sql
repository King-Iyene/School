/*
  # Fix Sam-Gentle Aches login (v2)
  Inserts the missing email identity — email column is generated, excluded from INSERT.
*/

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'ca1f2e7a-9376-4fdb-a659-b68e28573279',
  'samgentle.aches@okrika.edu.ng',
  'email',
  jsonb_build_object(
    'sub',            'ca1f2e7a-9376-4fdb-a659-b68e28573279',
    'email',          'samgentle.aches@okrika.edu.ng',
    'email_verified', true,
    'provider',       'email'
  ),
  now(),
  now(),
  now()
)
ON CONFLICT DO NOTHING;
