-- Fix RPC Functions to remove non-existent columns

CREATE OR REPLACE FUNCTION update_prospective_student(
  p_id uuid,
  p_payload jsonb
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
    status = COALESCE((p_payload->>'status'), status),
    updated_at = now()
  WHERE id = p_id
  RETURNING to_jsonb(prospective_students.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Prospective student not found';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION update_admission_payment(
  p_reference text,
  p_payload jsonb
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
    status = COALESCE((p_payload->>'status'), status),
    verified_at = COALESCE((p_payload->>'verified_at')::timestamp with time zone, verified_at)
    -- updated_at removed as it does not exist in this table
  WHERE paystack_reference = p_reference
  RETURNING to_jsonb(admission_payments.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Admission payment not found';
  END IF;

  RETURN v_result;
END;
$$;
