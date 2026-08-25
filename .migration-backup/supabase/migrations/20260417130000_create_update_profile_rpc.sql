-- RPC Function to update profile records via POST (bypassing browser PATCH issues)
CREATE OR REPLACE FUNCTION update_profile(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass direct RLS blocks if needed
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_school_id uuid;
  v_my_role text;
  v_my_id uuid := auth.uid();
BEGIN
  -- 1. Get current user's role and school_id
  SELECT role, school_id INTO v_my_role, v_school_id
  FROM profiles
  WHERE id = v_my_id;

  -- 2. Authorization check:
  -- User can update their own profile OR a super_admin of the same school can update it
  IF NOT (v_my_id = p_id OR (v_my_role = 'super_admin' AND EXISTS (
    SELECT 1 FROM profiles WHERE id = p_id AND school_id = v_school_id
  ))) THEN
    RAISE EXCEPTION 'Unauthorized: Access denied for profile update';
  END IF;

  -- 3. Update the profile record
  -- We allow updating specific fields that are commonly changed
  UPDATE profiles
  SET 
    first_name = COALESCE((p_payload->>'first_name'), first_name),
    last_name = COALESCE((p_payload->>'last_name'), last_name),
    phone = COALESCE((p_payload->>'phone'), phone),
    gender = COALESCE((p_payload->>'gender'), gender),
    address = COALESCE((p_payload->>'address'), address),
    is_active = COALESCE((p_payload->>'is_active')::boolean, is_active),
    basic_salary = COALESCE((p_payload->>'basic_salary')::numeric, basic_salary),
    role = COALESCE((p_payload->>'role'), role),
    updated_at = now()
  WHERE id = p_id
  RETURNING to_jsonb(profiles.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Profile not found or update failed';
  END IF;

  RETURN v_result;
END;
$$;
