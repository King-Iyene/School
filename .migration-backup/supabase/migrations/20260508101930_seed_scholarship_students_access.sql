/*
  # Seed Scholarship Students with Login Access

  ## Summary
  Adds a "Scholarship" student category and seeds 20 scholarship students as
  students with login access. Each scholar gets:
    - an auth.users row (password School@2025)
    - an auth.identities row (email provider)
    - a public.profiles row (role: student, category: Scholarship)
    - a public.students row (status: active)
  They can log into the Student Portal using their scholarship code (e.g.
  KDSAU10002001) which resolves to <code>@student.okrika.edu.ng.

  ## Changes
  1. Creates the Scholarship student category (idempotent).
  2. Inserts auth users + identities + profiles + students rows for 20 scholars.
  3. All inserts are guarded so the migration can be re-run safely.

  ## Security
  Uses standard RLS-enabled tables. No policies are modified; scholarship
  students inherit the normal student role permissions.
*/

DO $$
DECLARE
  v_school_id uuid;
  v_category_id uuid;
  v_user_id uuid;
  v_scholars constant text[][] := ARRAY[
    ARRAY['Amaka','Udo','KDSAU10002001'],
    ARRAY['Tunde','Balogun','KDSTB10002002'],
    ARRAY['Chika','Nwosu','KDSCN10002003'],
    ARRAY['Femi','Adeyemi','KDSFA10002004'],
    ARRAY['Blessing','Okon','KDSBO10002005'],
    ARRAY['Emeka','Ibe','KDSEI10002006'],
    ARRAY['Zara','Bello','KDSZB10002007'],
    ARRAY['Daniel','Eze','KDSDE10002008'],
    ARRAY['Kemi','Afolabi','KDSKA10002009'],
    ARRAY['Victor','James','KDSVJ10002010'],
    ARRAY['Anita','Obi','KDSAO10002011'],
    ARRAY['Samuel','Peters','KDSSP10002012'],
    ARRAY['Rita','Etim','KDSRE10002013'],
    ARRAY['Uche','Okafor','KDSUO10002014'],
    ARRAY['Miriam','Lawal','KDSML10002015'],
    ARRAY['Kelvin','Duke','KDSKD10002016'],
    ARRAY['Esther','Moses','KDSEM10002017'],
    ARRAY['Frank','Danjuma','KDSFD10002018'],
    ARRAY['Joy','Bassey','KDSJB10002019'],
    ARRAY['Ibrahim','Sani','KDSIS10002020']
  ];
  i int;
  v_first text;
  v_last text;
  v_code text;
  v_email text;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;

  SELECT id INTO v_category_id
  FROM student_categories
  WHERE name = 'Scholarship' AND (school_id = v_school_id OR school_id IS NULL)
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO student_categories (school_id, name, description)
    VALUES (v_school_id, 'Scholarship', 'Students enrolled via the scholarship examination')
    RETURNING id INTO v_category_id;
  END IF;

  FOR i IN 1 .. array_length(v_scholars, 1) LOOP
    v_first := v_scholars[i][1];
    v_last := v_scholars[i][2];
    v_code := v_scholars[i][3];
    v_email := lower(v_code) || '@student.okrika.edu.ng';

    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, aud, role, email,
        encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_user_meta_data, raw_app_meta_data,
        is_sso_user, deleted_at,
        confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        v_email,
        extensions.crypt('School@2025', extensions.gen_salt('bf', 10)),
        now(), now(), now(),
        jsonb_build_object('first_name', v_first, 'last_name', v_last, 'role', 'student'),
        '{"provider":"email","providers":["email"]}'::jsonb,
        false, null,
        '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, provider,
        identity_data, created_at, updated_at, last_sign_in_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        v_email,
        'email',
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        now(), now(), now()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;

    INSERT INTO public.profiles (
      id, school_id, role, first_name, last_name, email,
      student_id, admission_number, category_id, is_active
    ) VALUES (
      v_user_id, v_school_id, 'student', v_first, v_last, v_email,
      v_code, v_code, v_category_id, true
    )
    ON CONFLICT (id) DO UPDATE
      SET category_id = EXCLUDED.category_id,
          student_id = EXCLUDED.student_id,
          admission_number = EXCLUDED.admission_number,
          is_active = true;

    IF NOT EXISTS (SELECT 1 FROM students WHERE admission_number = v_code) THEN
      INSERT INTO students (
        id, school_id, admission_number, first_name, last_name,
        status, email
      ) VALUES (
        v_user_id, v_school_id, v_code, v_first, v_last,
        'active', v_email
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
