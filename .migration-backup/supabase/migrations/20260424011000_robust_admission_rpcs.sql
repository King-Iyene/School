-- Robust RPC functions for admission updates

-- 1. Create robust version of prospective student update
CREATE OR REPLACE FUNCTION rpc_update_prospective_student(
  p_id uuid,
  p_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE prospective_students
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN 'error: record not found';
  END IF;

  RETURN 'success';
END;
$$;

-- 2. Create robust version of admission payment update
CREATE OR REPLACE FUNCTION rpc_update_admission_payment(
  p_reference text,
  p_status text,
  p_verified_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admission_payments
  SET 
    status = p_status,
    verified_at = p_verified_at
  WHERE paystack_reference = p_reference;

  IF NOT FOUND THEN
    RETURN 'error: record not found';
  END IF;

  RETURN 'success';
END;
$$;
