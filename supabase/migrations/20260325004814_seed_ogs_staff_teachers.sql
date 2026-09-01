/*
  # Seed OGS Teachers and Staff

  ## Summary
  Inserts all teachers, principals, and non-academic staff from the
  Okrika Grammar School employee list into auth.users, profiles, and staff_records.

  ## Changes
  - Updates profiles_role_check to allow 'admin' role for principals and admin staff
  - Creates 30 auth user accounts (password: School@2025)
  - Creates corresponding profile records
  - Creates corresponding staff_records entries

  ## Roles Mapping
  - CSV "Teacher" → profiles.role = 'teacher'
  - CSV "Admin" (Principals, Non-Academic) → profiles.role = 'admin'

  ## Notes
  - All accounts use password: School@2025
  - Emails generated as firstname.lastname@okrika.edu.ng
  - Staff IDs assigned sequentially
  - ON CONFLICT guards prevent duplicate insertion
*/

-- 1. Extend role check to allow 'admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['super_admin','teacher','student','parent','accountant','admin']));

-- 2. Seed all staff
DO $$
DECLARE
  v_school_id uuid := (SELECT id FROM schools LIMIT 1);
  staff RECORD;
  v_id uuid;
BEGIN

  FOR staff IN SELECT * FROM (VALUES
    ('savoiur.dtech@okrika.edu.ng',      'Savoiur D.',        'D Tech',        'admin',   'ADM-001', 'Non-Academic Staff'),
    ('kelvin.sampson@okrika.edu.ng',     'Kelvin',            'Sampson',       'admin',   'ADM-002', 'Principal'),
    ('denzel.iyene@okrika.edu.ng',       'Denzel',            'Iyene',         'teacher', 'TCH-002', 'Non-Academic Staff'),
    ('abbeykalio.anibibia@okrika.edu.ng','Abbey-Kalio',       'Anibibia',      'admin',   'ADM-003', 'Principal'),
    ('enefaka.emmanuel@okrika.edu.ng',   'Enefaka',           'Emmanuel',      'teacher', 'TCH-003', 'Academic Staff'),
    ('aggo.boma@okrika.edu.ng',          'Aggo',              'Boma',          'teacher', 'TCH-004', 'Academic Staff'),
    ('samgentle.aches@okrika.edu.ng',    'Sam-Gentle',        'Aches',         'teacher', 'TCH-005', 'Academic Staff'),
    ('atorudibo.diepiriye@okrika.edu.ng','Atorudibo Gospel',  'Diepiriye',     'teacher', 'TCH-006', 'Academic Staff'),
    ('boma.amakiri@okrika.edu.ng',       'Boma A.',           'Amakiri',       'teacher', 'TCH-007', 'Academic Staff'),
    ('emmanuel.achese@okrika.edu.ng',    'Emmanuel',          'Achese',        'teacher', 'TCH-008', 'Academic Staff'),
    ('patience.oluwakorede@okrika.edu.ng','Patience',         'Oluwakorede',   'teacher', 'TCH-009', 'Academic Staff'),
    ('nemi.golden@okrika.edu.ng',        'Rev Nemi',          'Golden',        'teacher', 'TCH-010', 'Academic Staff'),
    ('sonia.obaseki@okrika.edu.ng',      'Sonia O.',          'Obaseki',       'teacher', 'TCH-011', 'Academic Staff'),
    ('precious.amoni@okrika.edu.ng',     'Precious D.',       'Amoni',         'teacher', 'TCH-012', 'Academic Staff'),
    ('atamuno.ibedein@okrika.edu.ng',    'Atamuno Genesis',   'Ibedein',       'teacher', 'TCH-013', 'Academic Staff'),
    ('boma.joshua@okrika.edu.ng',        'Boma',              'Joshua',        'teacher', 'TCH-014', 'Academic Staff'),
    ('dikibo.ibiteli@okrika.edu.ng',     'Dr Dikibo Sunday',  'Ibiteli',       'teacher', 'TCH-015', 'Academic Staff'),
    ('rev.oroyi@okrika.edu.ng',          'Rev Emmanuel',      'Oroyi',         'teacher', 'TCH-016', 'Academic Staff'),
    ('lawrence.tamunobelema@okrika.edu.ng','Lawrence',        'Tamunobelema',  'teacher', 'TCH-017', 'Academic Staff'),
    ('ruth.irisiominabo@okrika.edu.ng',  'Ruth',              'Irisiominabo',  'teacher', 'TCH-018', 'Academic Staff'),
    ('asitoka.israel@okrika.edu.ng',     'Asitoka',           'Israel',        'teacher', 'TCH-019', 'Academic Staff'),
    ('irene.daniel@okrika.edu.ng',       'Irene',             'Daniel A.',     'teacher', 'TCH-020', 'Academic Staff'),
    ('atoke.dede@okrika.edu.ng',         'Atoke',             'Dede',          'teacher', 'TCH-021', 'Academic Staff'),
    ('aduko.philip@okrika.edu.ng',       'Aduko',             'Philip',        'teacher', 'TCH-022', 'Academic Staff'),
    ('iyeaneomi.cyrus@okrika.edu.ng',    'Iyeaneomi',         'Cyrus',         'teacher', 'TCH-023', 'Academic Staff'),
    ('roseline.nwamaghinna@okrika.edu.ng','Corp Roseline',    'Nwamaghinna',   'teacher', 'TCH-024', 'Academic Staff'),
    ('rosemary.thompson@okrika.edu.ng',  'Corp Rosemary E.',  'Thompson',      'teacher', 'TCH-025', 'Academic Staff'),
    ('precious.ishiiguzon@okrika.edu.ng','Corp Precious O.',  'Ishiiguzon',    'teacher', 'TCH-026', 'Academic Staff'),
    ('abasiofon.usoroh@okrika.edu.ng',   'Corp Abasiofon O.','Usoroh',         'teacher', 'TCH-027', 'Academic Staff'),
    ('kd.admin@okrika.edu.ng',           'KD Squares',        'Admin',         'admin',   'ADM-004', 'Non-Academic Staff')
  ) AS t(email, first_name, last_name, profile_role, staff_id_val, designation)
  LOOP
    SELECT id INTO v_id FROM auth.users WHERE email = staff.email;

    IF v_id IS NULL THEN
      v_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_user_meta_data, raw_app_meta_data,
        confirmation_token, recovery_token, email_change_token_new,
        email_change, is_sso_user, deleted_at
      ) VALUES (
        v_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        staff.email,
        extensions.crypt('School@2025', extensions.gen_salt('bf')),
        now(), now(), now(),
        jsonb_build_object('first_name', staff.first_name, 'last_name', staff.last_name, 'role', staff.profile_role),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '', '', '', '', false, null
      );
    END IF;

    INSERT INTO public.profiles (
      id, school_id, role, first_name, last_name, email, staff_id, is_active
    ) VALUES (
      v_id, v_school_id, staff.profile_role,
      staff.first_name, staff.last_name, staff.email,
      staff.staff_id_val, true
    )
    ON CONFLICT (id) DO UPDATE SET
      school_id  = EXCLUDED.school_id,
      role       = EXCLUDED.role,
      first_name = EXCLUDED.first_name,
      last_name  = EXCLUDED.last_name,
      staff_id   = EXCLUDED.staff_id;

    INSERT INTO public.staff_records (
      id, school_id, staff_id, first_name, last_name, role, email, status
    ) VALUES (
      v_id, v_school_id, staff.staff_id_val,
      staff.first_name, staff.last_name,
      staff.designation, staff.email, 'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      staff_id   = EXCLUDED.staff_id,
      first_name = EXCLUDED.first_name,
      last_name  = EXCLUDED.last_name,
      role       = EXCLUDED.role,
      email      = EXCLUDED.email;

  END LOOP;
END $$;
