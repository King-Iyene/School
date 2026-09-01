/*
  # Fix handle_new_user trigger search_path

  ## Problem
  The handle_new_user trigger function has no search_path configured (proconfig: null).
  When called from the auth context, it cannot resolve the 'profiles' table, causing
  "Database error creating new user" on every auth.admin.createUser() call.

  ## Fix
  Recreate the function with SET search_path = public so it reliably finds the profiles table.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
