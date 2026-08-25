/*
  # Fix profiles role constraint and handle_new_user trigger

  ## Summary
  - Add 'admin' to the profiles_role_check constraint (needed for principal/VP accounts)
  - Fix handle_new_user trigger to gracefully handle any role from user metadata
  - Add 'admin' as an allowed role in App routing
*/

-- 1. Update the role check to include 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['super_admin','teacher','student','parent','accountant','admin']));

-- 2. Fix the handle_new_user trigger to be resilient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
  
  -- Validate role, default to 'teacher' for unknown roles
  IF v_role NOT IN ('super_admin','teacher','student','parent','accountant','admin') THEN
    v_role := 'teacher';
  END IF;

  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
