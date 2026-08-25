/*
  # Create Test User Accounts

  Creates one demo account for each portal role with password: School@2025
*/

DO $$
DECLARE
  v_school_id uuid := (SELECT id FROM schools LIMIT 1);
  v_admin_id uuid;
  v_teacher_id uuid;
  v_student_id uuid;
  v_parent_id uuid;
  v_accountant_id uuid;
BEGIN
  -- Super Admin
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@okrika.edu.ng';
  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, is_sso_user, deleted_at
    ) VALUES (
      v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin@okrika.edu.ng', extensions.crypt('School@2025', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"first_name":"Chukwuemeka","last_name":"Okafor","role":"super_admin"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '', false, null
    );
  END IF;
  INSERT INTO profiles (id, school_id, role, first_name, last_name, email, phone, gender, is_active)
  VALUES (v_admin_id, v_school_id, 'super_admin', 'Chukwuemeka', 'Okafor', 'admin@okrika.edu.ng', '+234 803 000 0001', 'male', true)
  ON CONFLICT (id) DO UPDATE SET school_id = v_school_id, role = 'super_admin', first_name = 'Chukwuemeka', last_name = 'Okafor';

  -- Teacher
  SELECT id INTO v_teacher_id FROM auth.users WHERE email = 'teacher@okrika.edu.ng';
  IF v_teacher_id IS NULL THEN
    v_teacher_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, is_sso_user, deleted_at
    ) VALUES (
      v_teacher_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'teacher@okrika.edu.ng', extensions.crypt('School@2025', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"first_name":"Ngozi","last_name":"Amadi","role":"teacher"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '', false, null
    );
  END IF;
  INSERT INTO profiles (id, school_id, role, first_name, last_name, email, phone, gender, staff_id, is_active)
  VALUES (v_teacher_id, v_school_id, 'teacher', 'Ngozi', 'Amadi', 'teacher@okrika.edu.ng', '+234 803 000 0002', 'female', 'TCH-001', true)
  ON CONFLICT (id) DO UPDATE SET school_id = v_school_id, role = 'teacher', first_name = 'Ngozi', last_name = 'Amadi';

  -- Student
  SELECT id INTO v_student_id FROM auth.users WHERE email = 'student@okrika.edu.ng';
  IF v_student_id IS NULL THEN
    v_student_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, is_sso_user, deleted_at
    ) VALUES (
      v_student_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'student@okrika.edu.ng', extensions.crypt('School@2025', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"first_name":"Emeka","last_name":"Nwosu","role":"student"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '', false, null
    );
  END IF;
  INSERT INTO profiles (id, school_id, role, first_name, last_name, email, phone, gender, student_id, is_active)
  VALUES (v_student_id, v_school_id, 'student', 'Emeka', 'Nwosu', 'student@okrika.edu.ng', '+234 803 000 0003', 'male', 'OGS/2024/001', true)
  ON CONFLICT (id) DO UPDATE SET school_id = v_school_id, role = 'student', first_name = 'Emeka', last_name = 'Nwosu';

  -- Parent
  SELECT id INTO v_parent_id FROM auth.users WHERE email = 'parent@okrika.edu.ng';
  IF v_parent_id IS NULL THEN
    v_parent_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, is_sso_user, deleted_at
    ) VALUES (
      v_parent_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'parent@okrika.edu.ng', extensions.crypt('School@2025', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"first_name":"Blessing","last_name":"Nwosu","role":"parent"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '', false, null
    );
  END IF;
  INSERT INTO profiles (id, school_id, role, first_name, last_name, email, phone, gender, is_active)
  VALUES (v_parent_id, v_school_id, 'parent', 'Blessing', 'Nwosu', 'parent@okrika.edu.ng', '+234 803 000 0004', 'female', true)
  ON CONFLICT (id) DO UPDATE SET school_id = v_school_id, role = 'parent', first_name = 'Blessing', last_name = 'Nwosu';

  INSERT INTO parent_student_links (parent_id, student_id, relationship, is_primary)
  VALUES (v_parent_id, v_student_id, 'parent', true)
  ON CONFLICT (parent_id, student_id) DO NOTHING;

  -- Accountant
  SELECT id INTO v_accountant_id FROM auth.users WHERE email = 'accountant@okrika.edu.ng';
  IF v_accountant_id IS NULL THEN
    v_accountant_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, is_sso_user, deleted_at
    ) VALUES (
      v_accountant_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'accountant@okrika.edu.ng', extensions.crypt('School@2025', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"first_name":"Tunde","last_name":"Adekunle","role":"accountant"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '', '', '', '', false, null
    );
  END IF;
  INSERT INTO profiles (id, school_id, role, first_name, last_name, email, phone, gender, staff_id, is_active)
  VALUES (v_accountant_id, v_school_id, 'accountant', 'Tunde', 'Adekunle', 'accountant@okrika.edu.ng', '+234 803 000 0005', 'male', 'ACC-001', true)
  ON CONFLICT (id) DO UPDATE SET school_id = v_school_id, role = 'accountant', first_name = 'Tunde', last_name = 'Adekunle';

END $$;
