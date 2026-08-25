-- Final robustness attempt for admission RPCs

-- 1. Use text for ID and cast inside to bypass type mismatches
CREATE OR REPLACE FUNCTION final_update_prospective_student(
  uuid_param text,
  status_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE prospective_students
  SET 
    status = status_param,
    updated_at = now()
  WHERE id = uuid_param::uuid;

  RETURN FOUND;
END;
$$;

-- 2. Similar for payment
CREATE OR REPLACE FUNCTION final_update_admission_payment(
  reference_param text,
  status_param text,
  verified_at_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admission_payments
  SET 
    status = status_param,
    verified_at = verified_at_param::timestamptz
  WHERE paystack_reference = reference_param;

  RETURN FOUND;
END;
$$;
