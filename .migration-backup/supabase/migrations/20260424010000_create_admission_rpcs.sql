-- RPC Functions to update admission records via POST (bypassing browser PATCH issues)

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
    exam_date = COALESCE((p_payload->>'exam_date')::date, exam_date),
    exam_start_time = COALESCE((p_payload->>'exam_start_time')::time, exam_start_time),
    exam_end_time = COALESCE((p_payload->>'exam_end_time')::time, exam_end_time),
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
    verified_at = COALESCE((p_payload->>'verified_at')::timestamp with time zone, verified_at),
    updated_at = now()
  WHERE paystack_reference = p_reference
  RETURNING to_jsonb(admission_payments.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Admission payment not found';
  END IF;

  RETURN v_result;
END;
$$;
