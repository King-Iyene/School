/*
  # Seed All User Accounts

  ## Summary
  Creates all OGS user accounts with the correct school_id and proper auth.identities entries.
  All accounts use password: School@2025
  
  ## Accounts
  - admin@okrika.edu.ng (super_admin)
  - principal@okrika.edu.ng (super_admin)
  - teacher@okrika.edu.ng (teacher - demo)
  - student@okrika.edu.ng (student - demo)
  - parent@okrika.edu.ng (parent - demo)
  - accountant@okrika.edu.ng (accountant - demo)
  - All 30 OGS staff teachers
*/

CREATE OR REPLACE FUNCTION public.create_ogs_user(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_staff_id text DEFAULT NULL,
  p_student_id text DEFAULT NULL,
  p_phone text DEFAULT '',
  p_gender text DEFAULT 'male'
) RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_school_id uuid := (SELECT id FROM schools LIMIT 1);
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

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
      p_email,
      extensions.crypt('School@2025', extensions.gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'role', p_role),
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
      p_email,
      'email',
      jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true),
      now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END IF;

  INSERT INTO public.profiles (
    id, school_id, role, first_name, last_name, email, phone,
    gender, staff_id, student_id, is_active
  ) VALUES (
    v_user_id, v_school_id, p_role, p_first_name, p_last_name,
    p_email, p_phone, p_gender, p_staff_id, p_student_id, true
  )
  ON CONFLICT (id) DO UPDATE SET
    school_id = v_school_id,
    role = p_role,
    first_name = p_first_name,
    last_name = p_last_name,
    email = p_email,
    is_active = true,
    staff_id = COALESCE(p_staff_id, profiles.staff_id),
    student_id = COALESCE(p_student_id, profiles.student_id);
END;
$$;

DO $$
BEGIN
  -- Core portal demo accounts
  PERFORM public.create_ogs_user('admin@okrika.edu.ng',       'Chukwuemeka', 'Okafor',       'super_admin', 'ADM-000', null, '+234 803 000 0001', 'male');
  PERFORM public.create_ogs_user('principal@okrika.edu.ng',   'Kelvin',      'Sampson',      'super_admin', 'OGS/PRN/001', null, '09034210590', 'male');
  PERFORM public.create_ogs_user('teacher@okrika.edu.ng',     'Ngozi',       'Amadi',        'teacher',     'TCH-001', null, '+234 803 000 0002', 'female');
  PERFORM public.create_ogs_user('student@okrika.edu.ng',     'Emeka',       'Nwosu',        'student',     null, 'OGS/2024/001', '+234 803 000 0003', 'male');
  PERFORM public.create_ogs_user('parent@okrika.edu.ng',      'Blessing',    'Nwosu',        'parent',      null, null, '+234 803 000 0004', 'female');
  PERFORM public.create_ogs_user('accountant@okrika.edu.ng',  'Tunde',       'Adekunle',     'accountant',  'ACC-001', null, '+234 803 000 0005', 'male');

  -- OGS Staff Teachers (all teacher role)
  PERFORM public.create_ogs_user('kelvin.sampson@okrika.edu.ng',       'Kelvin',        'Sampson',       'super_admin', 'ADM-002', null, '09034210590', 'male');
  PERFORM public.create_ogs_user('denzel.iyene@okrika.edu.ng',         'Denzel',        'Iyene',         'teacher', 'TCH-002');
  PERFORM public.create_ogs_user('enefaka.emmanuel@okrika.edu.ng',     'Enefaka',       'Emmanuel',      'teacher', 'TCH-003');
  PERFORM public.create_ogs_user('aggo.boma@okrika.edu.ng',            'Aggo',          'Boma',          'teacher', 'TCH-004');
  PERFORM public.create_ogs_user('samgentle.aches@okrika.edu.ng',      'Sam-Gentle',    'Aches',         'teacher', 'TCH-005');
  PERFORM public.create_ogs_user('atorudibo.diepiriye@okrika.edu.ng',  'Atorudibo',     'Diepiriye',     'teacher', 'TCH-006');
  PERFORM public.create_ogs_user('boma.amakiri@okrika.edu.ng',         'Boma A.',       'Amakiri',       'teacher', 'TCH-007');
  PERFORM public.create_ogs_user('emmanuel.achese@okrika.edu.ng',      'Emmanuel',      'Achese',        'teacher', 'TCH-008');
  PERFORM public.create_ogs_user('patience.oluwakorede@okrika.edu.ng', 'Patience',      'Oluwakorede',   'teacher', 'TCH-009', null, '', 'female');
  PERFORM public.create_ogs_user('nemi.golden@okrika.edu.ng',          'Rev Nemi',      'Golden',        'teacher', 'TCH-010');
  PERFORM public.create_ogs_user('sonia.obaseki@okrika.edu.ng',        'Sonia O.',      'Obaseki',       'teacher', 'TCH-011', null, '', 'female');
  PERFORM public.create_ogs_user('precious.amoni@okrika.edu.ng',       'Precious D.',   'Amoni',         'teacher', 'TCH-012', null, '', 'female');
  PERFORM public.create_ogs_user('atamuno.ibedein@okrika.edu.ng',      'Atamuno',       'Ibedein',       'teacher', 'TCH-013');
  PERFORM public.create_ogs_user('boma.joshua@okrika.edu.ng',          'Boma',          'Joshua',        'teacher', 'TCH-014');
  PERFORM public.create_ogs_user('dikibo.ibiteli@okrika.edu.ng',       'Dr Dikibo',     'Ibiteli',       'teacher', 'TCH-015');
  PERFORM public.create_ogs_user('rev.oroyi@okrika.edu.ng',            'Rev Emmanuel',  'Oroyi',         'teacher', 'TCH-016');
  PERFORM public.create_ogs_user('lawrence.tamunobelema@okrika.edu.ng','Lawrence',      'Tamunobelema',  'teacher', 'TCH-017');
  PERFORM public.create_ogs_user('ruth.irisiominabo@okrika.edu.ng',    'Ruth',          'Irisiominabo',  'teacher', 'TCH-018', null, '', 'female');
  PERFORM public.create_ogs_user('asitoka.israel@okrika.edu.ng',       'Asitoka',       'Israel',        'teacher', 'TCH-019');
  PERFORM public.create_ogs_user('irene.daniel@okrika.edu.ng',         'Irene',         'Daniel A.',     'teacher', 'TCH-020', null, '', 'female');
  PERFORM public.create_ogs_user('ebitimitula.owupele@okrika.edu.ng',  'Ebitimitula',   'Owupele',       'teacher', 'TCH-021');
  PERFORM public.create_ogs_user('comfort.alale@okrika.edu.ng',        'Comfort',       'Alale',         'teacher', 'TCH-022', null, '', 'female');
  PERFORM public.create_ogs_user('doris.igonibo@okrika.edu.ng',        'Doris',         'Igonibo',       'teacher', 'TCH-023', null, '', 'female');
  PERFORM public.create_ogs_user('timiebi.fubara@okrika.edu.ng',       'Timiebi',       'Fubara',        'teacher', 'TCH-024', null, '', 'female');
  PERFORM public.create_ogs_user('victor.ordu@okrika.edu.ng',          'Victor',        'Ordu',          'teacher', 'TCH-025');
  PERFORM public.create_ogs_user('peace.sunday@okrika.edu.ng',         'Peace',         'Sunday',        'teacher', 'TCH-026', null, '', 'female');
  PERFORM public.create_ogs_user('godpower.waribo@okrika.edu.ng',      'Godpower',      'Waribo',        'teacher', 'TCH-027');
  PERFORM public.create_ogs_user('boma.wokoma@okrika.edu.ng',          'Boma',          'Wokoma',        'teacher', 'TCH-028');
  PERFORM public.create_ogs_user('christiana.amadi@okrika.edu.ng',     'Christiana',    'Amadi',         'teacher', 'TCH-029', null, '', 'female');
  PERFORM public.create_ogs_user('keziah.solomon@okrika.edu.ng',       'Keziah',        'Solomon',       'teacher', 'TCH-030', null, '', 'female');
END $$;

DROP FUNCTION IF EXISTS public.create_ogs_user(text, text, text, text, text, text, text, text);
