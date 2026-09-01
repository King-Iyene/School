-- Drop and recreate RPC functions to ensure clean state and unique parameter names

DROP FUNCTION IF EXISTS update_prospective_student(uuid, jsonb);
DROP FUNCTION IF EXISTS update_prospective_student(id uuid, payload jsonb); -- Possible old name
DROP FUNCTION IF EXISTS update_prospective_student(p_id uuid, p_payload jsonb);

DROP FUNCTION IF EXISTS update_admission_payment(text, jsonb);
DROP FUNCTION IF EXISTS update_admission_payment(reference text, payload jsonb); -- Possible old name
DROP FUNCTION IF EXISTS update_admission_payment(p_reference text, p_payload jsonb);

CREATE OR REPLACE FUNCTION update_prospective_student(
  id_param uuid,
  payload_param jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE prospective_students
  SET 
    status = COALESCE((payload_param->>'status'), status),
    updated_at = now()
  WHERE id = id_param
  RETURNING to_jsonb(prospective_students.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Prospective student not found';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION update_admission_payment(
  reference_param text,
  payload_param jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE admission_payments
  SET 
    status = COALESCE((payload_param->>'status'), status),
    verified_at = COALESCE((payload_param->>'verified_at')::timestamp with time zone, verified_at)
  WHERE paystack_reference = reference_param
  RETURNING to_jsonb(admission_payments.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Admission payment not found';
  END IF;

  RETURN v_result;
END;
$$;
