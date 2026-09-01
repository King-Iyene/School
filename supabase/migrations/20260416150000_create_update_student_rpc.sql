-- RPC Function to update student records via POST (bypassing browser PATCH issues)
CREATE OR REPLACE FUNCTION update_student(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_school_id uuid;
  v_is_admin boolean;
BEGIN
  -- 1. Check if the current user is a super_admin
  SELECT 
    role = 'super_admin',
    school_id 
  INTO v_is_admin, v_school_id
  FROM profiles 
  WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can update student records via RPC';
  END IF;

  -- 2. Update the student record
  -- We use jsonb_populate_record to dynamically update the fields present in the payload
  UPDATE students
  SET 
    first_name = COALESCE((p_payload->>'first_name'), first_name),
    last_name = COALESCE((p_payload->>'last_name'), last_name),
    admission_number = COALESCE((p_payload->>'admission_number'), admission_number),
    class_id = COALESCE((p_payload->>'class_id')::uuid, class_id),
    section = COALESCE((p_payload->>'section'), section),
    gender = COALESCE((p_payload->>'gender'), gender),
    date_of_birth = COALESCE((p_payload->>'date_of_birth')::date, date_of_birth),
    blood_group = COALESCE((p_payload->>'blood_group'), blood_group),
    religion = COALESCE((p_payload->>'religion'), religion),
    nationality = COALESCE((p_payload->>'nationality'), nationality),
    address = COALESCE((p_payload->>'address'), address),
    city = COALESCE((p_payload->>'city'), city),
    guardian_name = COALESCE((p_payload->>'guardian_name'), guardian_name),
    guardian_phone = COALESCE((p_payload->>'guardian_phone'), guardian_phone),
    guardian_email = COALESCE((p_payload->>'guardian_email'), guardian_email),
    state_of_origin = COALESCE((p_payload->>'state_of_origin'), state_of_origin),
    lga = COALESCE((p_payload->>'lga'), lga),
    phone = COALESCE((p_payload->>'phone'), phone),
    email = COALESCE((p_payload->>'email'), email),
    status = COALESCE((p_payload->>'status'), status),
    updated_at = now()
  WHERE id = p_id 
  AND school_id = v_school_id -- Ensure isolation
  RETURNING to_jsonb(students.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Student not found or access denied';
  END IF;

  RETURN v_result;
END;
$$;
