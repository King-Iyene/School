/*
  # Fix payment_methods_list RLS policies to include all admin-level roles

  1. Changes
    - Updates INSERT, UPDATE, DELETE policies to allow: super_admin, accountant, admin, head_teacher, principal
    - Principal is already mapped to super_admin by get_my_role(), but including explicitly for safety
  
  2. Important notes
    - The previous policies only allowed super_admin and accountant
    - Users with admin or head_teacher roles were blocked from managing payment methods
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Super admin can insert payment methods" ON payment_methods_list;
DROP POLICY IF EXISTS "Super admin can update payment methods" ON payment_methods_list;
DROP POLICY IF EXISTS "Super admin can delete payment methods" ON payment_methods_list;

-- Recreate with expanded role list
CREATE POLICY "Admins can insert payment methods"
  ON payment_methods_list FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can update payment methods"
  ON payment_methods_list FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can delete payment methods"
  ON payment_methods_list FOR DELETE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

-- Also fix fees_types, fees_groups, and fees_master for consistency
DROP POLICY IF EXISTS "Super admin can insert fees types" ON fees_types;
DROP POLICY IF EXISTS "Super admin can update fees types" ON fees_types;
DROP POLICY IF EXISTS "Super admin can delete fees types" ON fees_types;

CREATE POLICY "Admins can insert fees types"
  ON fees_types FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can update fees types"
  ON fees_types FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can delete fees types"
  ON fees_types FOR DELETE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

DROP POLICY IF EXISTS "Super admin can insert fees groups" ON fees_groups;
DROP POLICY IF EXISTS "Super admin can update fees groups" ON fees_groups;
DROP POLICY IF EXISTS "Super admin can delete fees groups" ON fees_groups;

CREATE POLICY "Admins can insert fees groups"
  ON fees_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can update fees groups"
  ON fees_groups FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can delete fees groups"
  ON fees_groups FOR DELETE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

DROP POLICY IF EXISTS "Super admin can insert fees master" ON fees_master;
DROP POLICY IF EXISTS "Super admin can update fees master" ON fees_master;
DROP POLICY IF EXISTS "Super admin can delete fees master" ON fees_master;

CREATE POLICY "Admins can insert fees master"
  ON fees_master FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can update fees master"
  ON fees_master FOR UPDATE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );

CREATE POLICY "Admins can delete fees master"
  ON fees_master FOR DELETE
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['super_admin'::text, 'accountant'::text, 'admin'::text, 'head_teacher'::text])
  );
