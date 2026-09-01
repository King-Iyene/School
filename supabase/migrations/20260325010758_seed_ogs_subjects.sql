/*
  # Seed OGS Subjects

  ## Summary
  Inserts 29 subjects and assigns them to the appropriate classes.

  ## Category Mapping (uses allowed values: core, elective, vocational)
  - core: Mathematics, English Language, Civic Education, Digital Technology
  - vocational: Business Studies, Basic Technology, Music, Home Economics,
                Computer Studies, Technical Drawing
  - elective: all science, arts, general, and religious subjects

  ## Assignment
  - JSS subjects (16): JSS 1 A, JSS 1 B, JSS 2, JSS 3
  - SSS subjects (19 combining Science + Arts): SSS 1, SSS 2, SSS 3
*/

DO $$
DECLARE
  v_school_id uuid := (SELECT id FROM schools LIMIT 1);

  cid_jss1a uuid; cid_jss1b uuid; cid_jss2 uuid; cid_jss3 uuid;
  cid_sss1  uuid; cid_sss2  uuid; cid_sss3 uuid;

  sid_math   uuid; sid_eng    uuid; sid_civic  uuid; sid_digi   uuid;
  sid_biz    uuid; sid_tech   uuid; sid_music  uuid; sid_home   uuid;
  sid_comp   uuid; sid_tdraw  uuid;
  sid_lit    uuid; sid_lieng  uuid; sid_govt   uuid; sid_crs    uuid;
  sid_econ   uuid; sid_comm   uuid; sid_acct   uuid;
  sid_bsci   uuid; sid_bio    uuid; sid_chem   uuid; sid_phy    uuid;
  sid_fmath  uuid; sid_agric  uuid;
  sid_social uuid; sid_geo    uuid; sid_live   uuid; sid_phe    uuid;
  sid_french uuid; sid_vern   uuid;

BEGIN

  SELECT id INTO cid_jss1a FROM public.classes WHERE school_id = v_school_id AND name = 'JSS 1 A';
  SELECT id INTO cid_jss1b FROM public.classes WHERE school_id = v_school_id AND name = 'JSS 1 B';
  SELECT id INTO cid_jss2  FROM public.classes WHERE school_id = v_school_id AND name = 'JSS 2';
  SELECT id INTO cid_jss3  FROM public.classes WHERE school_id = v_school_id AND name = 'JSS 3';
  SELECT id INTO cid_sss1  FROM public.classes WHERE school_id = v_school_id AND name = 'SSS 1';
  SELECT id INTO cid_sss2  FROM public.classes WHERE school_id = v_school_id AND name = 'SSS 2';
  SELECT id INTO cid_sss3  FROM public.classes WHERE school_id = v_school_id AND name = 'SSS 3';

  INSERT INTO public.subjects (id, school_id, name, code, category) VALUES
    (gen_random_uuid(), v_school_id, 'Mathematics',                  'MATH',  'core'),
    (gen_random_uuid(), v_school_id, 'English Language',             'ENG',   'core'),
    (gen_random_uuid(), v_school_id, 'Civic Education',              'CIV',   'core'),
    (gen_random_uuid(), v_school_id, 'Digital Technology',           'DIGI',  'core'),
    (gen_random_uuid(), v_school_id, 'Business Studies',             'BIZ',   'vocational'),
    (gen_random_uuid(), v_school_id, 'Basic Technology',             'BTECH', 'vocational'),
    (gen_random_uuid(), v_school_id, 'Music',                        'MUS',   'vocational'),
    (gen_random_uuid(), v_school_id, 'Home Economics',               'HOME',  'vocational'),
    (gen_random_uuid(), v_school_id, 'Computer Studies',             'COMP',  'vocational'),
    (gen_random_uuid(), v_school_id, 'Technical Drawing',            'TDRAW', 'vocational'),
    (gen_random_uuid(), v_school_id, 'Literature',                   'LIT',   'elective'),
    (gen_random_uuid(), v_school_id, 'Literature in English',        'LIENG', 'elective'),
    (gen_random_uuid(), v_school_id, 'Government',                   'GOVT',  'elective'),
    (gen_random_uuid(), v_school_id, 'Christian Religious Studies',  'CRS',   'elective'),
    (gen_random_uuid(), v_school_id, 'Economics',                    'ECON',  'elective'),
    (gen_random_uuid(), v_school_id, 'Commerce',                     'COMM',  'elective'),
    (gen_random_uuid(), v_school_id, 'Accounting',                   'ACCT',  'elective'),
    (gen_random_uuid(), v_school_id, 'Basic Science',                'BSCI',  'elective'),
    (gen_random_uuid(), v_school_id, 'Biology',                      'BIO',   'elective'),
    (gen_random_uuid(), v_school_id, 'Chemistry',                    'CHEM',  'elective'),
    (gen_random_uuid(), v_school_id, 'Physics',                      'PHY',   'elective'),
    (gen_random_uuid(), v_school_id, 'Further Mathematics',          'FMATH', 'elective'),
    (gen_random_uuid(), v_school_id, 'Agricultural Science',         'AGRIC', 'elective'),
    (gen_random_uuid(), v_school_id, 'Social Studies',               'SOC',   'elective'),
    (gen_random_uuid(), v_school_id, 'Geography',                    'GEO',   'elective'),
    (gen_random_uuid(), v_school_id, 'Livestock Farming',            'LIVE',  'elective'),
    (gen_random_uuid(), v_school_id, 'Physical and Health Education','PHE',   'elective'),
    (gen_random_uuid(), v_school_id, 'French',                       'FRN',   'elective'),
    (gen_random_uuid(), v_school_id, 'Vernacular',                   'VERN',  'elective');

  SELECT id INTO sid_math   FROM public.subjects WHERE school_id = v_school_id AND code = 'MATH';
  SELECT id INTO sid_eng    FROM public.subjects WHERE school_id = v_school_id AND code = 'ENG';
  SELECT id INTO sid_civic  FROM public.subjects WHERE school_id = v_school_id AND code = 'CIV';
  SELECT id INTO sid_digi   FROM public.subjects WHERE school_id = v_school_id AND code = 'DIGI';
  SELECT id INTO sid_biz    FROM public.subjects WHERE school_id = v_school_id AND code = 'BIZ';
  SELECT id INTO sid_tech   FROM public.subjects WHERE school_id = v_school_id AND code = 'BTECH';
  SELECT id INTO sid_music  FROM public.subjects WHERE school_id = v_school_id AND code = 'MUS';
  SELECT id INTO sid_home   FROM public.subjects WHERE school_id = v_school_id AND code = 'HOME';
  SELECT id INTO sid_comp   FROM public.subjects WHERE school_id = v_school_id AND code = 'COMP';
  SELECT id INTO sid_tdraw  FROM public.subjects WHERE school_id = v_school_id AND code = 'TDRAW';
  SELECT id INTO sid_lit    FROM public.subjects WHERE school_id = v_school_id AND code = 'LIT';
  SELECT id INTO sid_lieng  FROM public.subjects WHERE school_id = v_school_id AND code = 'LIENG';
  SELECT id INTO sid_govt   FROM public.subjects WHERE school_id = v_school_id AND code = 'GOVT';
  SELECT id INTO sid_crs    FROM public.subjects WHERE school_id = v_school_id AND code = 'CRS';
  SELECT id INTO sid_econ   FROM public.subjects WHERE school_id = v_school_id AND code = 'ECON';
  SELECT id INTO sid_comm   FROM public.subjects WHERE school_id = v_school_id AND code = 'COMM';
  SELECT id INTO sid_acct   FROM public.subjects WHERE school_id = v_school_id AND code = 'ACCT';
  SELECT id INTO sid_bsci   FROM public.subjects WHERE school_id = v_school_id AND code = 'BSCI';
  SELECT id INTO sid_bio    FROM public.subjects WHERE school_id = v_school_id AND code = 'BIO';
  SELECT id INTO sid_chem   FROM public.subjects WHERE school_id = v_school_id AND code = 'CHEM';
  SELECT id INTO sid_phy    FROM public.subjects WHERE school_id = v_school_id AND code = 'PHY';
  SELECT id INTO sid_fmath  FROM public.subjects WHERE school_id = v_school_id AND code = 'FMATH';
  SELECT id INTO sid_agric  FROM public.subjects WHERE school_id = v_school_id AND code = 'AGRIC';
  SELECT id INTO sid_social FROM public.subjects WHERE school_id = v_school_id AND code = 'SOC';
  SELECT id INTO sid_geo    FROM public.subjects WHERE school_id = v_school_id AND code = 'GEO';
  SELECT id INTO sid_live   FROM public.subjects WHERE school_id = v_school_id AND code = 'LIVE';
  SELECT id INTO sid_phe    FROM public.subjects WHERE school_id = v_school_id AND code = 'PHE';
  SELECT id INTO sid_french FROM public.subjects WHERE school_id = v_school_id AND code = 'FRN';
  SELECT id INTO sid_vern   FROM public.subjects WHERE school_id = v_school_id AND code = 'VERN';

  -- JSS 1 A (16 subjects)
  INSERT INTO public.class_subjects (id, class_id, subject_id) VALUES
    (gen_random_uuid(), cid_jss1a, sid_math),  (gen_random_uuid(), cid_jss1a, sid_eng),
    (gen_random_uuid(), cid_jss1a, sid_civic), (gen_random_uuid(), cid_jss1a, sid_biz),
    (gen_random_uuid(), cid_jss1a, sid_tech),  (gen_random_uuid(), cid_jss1a, sid_lit),
    (gen_random_uuid(), cid_jss1a, sid_music), (gen_random_uuid(), cid_jss1a, sid_home),
    (gen_random_uuid(), cid_jss1a, sid_crs),   (gen_random_uuid(), cid_jss1a, sid_social),
    (gen_random_uuid(), cid_jss1a, sid_agric), (gen_random_uuid(), cid_jss1a, sid_vern),
    (gen_random_uuid(), cid_jss1a, sid_bsci),  (gen_random_uuid(), cid_jss1a, sid_phe),
    (gen_random_uuid(), cid_jss1a, sid_french),(gen_random_uuid(), cid_jss1a, sid_digi),
    -- JSS 1 B
    (gen_random_uuid(), cid_jss1b, sid_math),  (gen_random_uuid(), cid_jss1b, sid_eng),
    (gen_random_uuid(), cid_jss1b, sid_civic), (gen_random_uuid(), cid_jss1b, sid_biz),
    (gen_random_uuid(), cid_jss1b, sid_tech),  (gen_random_uuid(), cid_jss1b, sid_lit),
    (gen_random_uuid(), cid_jss1b, sid_music), (gen_random_uuid(), cid_jss1b, sid_home),
    (gen_random_uuid(), cid_jss1b, sid_crs),   (gen_random_uuid(), cid_jss1b, sid_social),
    (gen_random_uuid(), cid_jss1b, sid_agric), (gen_random_uuid(), cid_jss1b, sid_vern),
    (gen_random_uuid(), cid_jss1b, sid_bsci),  (gen_random_uuid(), cid_jss1b, sid_phe),
    (gen_random_uuid(), cid_jss1b, sid_french),(gen_random_uuid(), cid_jss1b, sid_digi),
    -- JSS 2
    (gen_random_uuid(), cid_jss2, sid_math),  (gen_random_uuid(), cid_jss2, sid_eng),
    (gen_random_uuid(), cid_jss2, sid_civic), (gen_random_uuid(), cid_jss2, sid_biz),
    (gen_random_uuid(), cid_jss2, sid_tech),  (gen_random_uuid(), cid_jss2, sid_lit),
    (gen_random_uuid(), cid_jss2, sid_music), (gen_random_uuid(), cid_jss2, sid_home),
    (gen_random_uuid(), cid_jss2, sid_crs),   (gen_random_uuid(), cid_jss2, sid_social),
    (gen_random_uuid(), cid_jss2, sid_agric), (gen_random_uuid(), cid_jss2, sid_vern),
    (gen_random_uuid(), cid_jss2, sid_bsci),  (gen_random_uuid(), cid_jss2, sid_phe),
    (gen_random_uuid(), cid_jss2, sid_french),(gen_random_uuid(), cid_jss2, sid_digi),
    -- JSS 3
    (gen_random_uuid(), cid_jss3, sid_math),  (gen_random_uuid(), cid_jss3, sid_eng),
    (gen_random_uuid(), cid_jss3, sid_civic), (gen_random_uuid(), cid_jss3, sid_biz),
    (gen_random_uuid(), cid_jss3, sid_tech),  (gen_random_uuid(), cid_jss3, sid_lit),
    (gen_random_uuid(), cid_jss3, sid_music), (gen_random_uuid(), cid_jss3, sid_home),
    (gen_random_uuid(), cid_jss3, sid_crs),   (gen_random_uuid(), cid_jss3, sid_social),
    (gen_random_uuid(), cid_jss3, sid_agric), (gen_random_uuid(), cid_jss3, sid_vern),
    (gen_random_uuid(), cid_jss3, sid_bsci),  (gen_random_uuid(), cid_jss3, sid_phe),
    (gen_random_uuid(), cid_jss3, sid_french),(gen_random_uuid(), cid_jss3, sid_digi),
    -- SSS 1 (Science + Arts combined: 19 subjects)
    (gen_random_uuid(), cid_sss1, sid_eng),   (gen_random_uuid(), cid_sss1, sid_math),
    (gen_random_uuid(), cid_sss1, sid_civic), (gen_random_uuid(), cid_sss1, sid_comp),
    (gen_random_uuid(), cid_sss1, sid_digi),  (gen_random_uuid(), cid_sss1, sid_bio),
    (gen_random_uuid(), cid_sss1, sid_chem),  (gen_random_uuid(), cid_sss1, sid_phy),
    (gen_random_uuid(), cid_sss1, sid_fmath), (gen_random_uuid(), cid_sss1, sid_agric),
    (gen_random_uuid(), cid_sss1, sid_tdraw), (gen_random_uuid(), cid_sss1, sid_geo),
    (gen_random_uuid(), cid_sss1, sid_live),  (gen_random_uuid(), cid_sss1, sid_lieng),
    (gen_random_uuid(), cid_sss1, sid_govt),  (gen_random_uuid(), cid_sss1, sid_crs),
    (gen_random_uuid(), cid_sss1, sid_econ),  (gen_random_uuid(), cid_sss1, sid_comm),
    (gen_random_uuid(), cid_sss1, sid_acct),
    -- SSS 2
    (gen_random_uuid(), cid_sss2, sid_eng),   (gen_random_uuid(), cid_sss2, sid_math),
    (gen_random_uuid(), cid_sss2, sid_civic), (gen_random_uuid(), cid_sss2, sid_comp),
    (gen_random_uuid(), cid_sss2, sid_digi),  (gen_random_uuid(), cid_sss2, sid_bio),
    (gen_random_uuid(), cid_sss2, sid_chem),  (gen_random_uuid(), cid_sss2, sid_phy),
    (gen_random_uuid(), cid_sss2, sid_fmath), (gen_random_uuid(), cid_sss2, sid_agric),
    (gen_random_uuid(), cid_sss2, sid_tdraw), (gen_random_uuid(), cid_sss2, sid_geo),
    (gen_random_uuid(), cid_sss2, sid_live),  (gen_random_uuid(), cid_sss2, sid_lieng),
    (gen_random_uuid(), cid_sss2, sid_govt),  (gen_random_uuid(), cid_sss2, sid_crs),
    (gen_random_uuid(), cid_sss2, sid_econ),  (gen_random_uuid(), cid_sss2, sid_comm),
    (gen_random_uuid(), cid_sss2, sid_acct),
    -- SSS 3
    (gen_random_uuid(), cid_sss3, sid_eng),   (gen_random_uuid(), cid_sss3, sid_math),
    (gen_random_uuid(), cid_sss3, sid_civic), (gen_random_uuid(), cid_sss3, sid_comp),
    (gen_random_uuid(), cid_sss3, sid_digi),  (gen_random_uuid(), cid_sss3, sid_bio),
    (gen_random_uuid(), cid_sss3, sid_chem),  (gen_random_uuid(), cid_sss3, sid_phy),
    (gen_random_uuid(), cid_sss3, sid_fmath), (gen_random_uuid(), cid_sss3, sid_agric),
    (gen_random_uuid(), cid_sss3, sid_tdraw), (gen_random_uuid(), cid_sss3, sid_geo),
    (gen_random_uuid(), cid_sss3, sid_live),  (gen_random_uuid(), cid_sss3, sid_lieng),
    (gen_random_uuid(), cid_sss3, sid_govt),  (gen_random_uuid(), cid_sss3, sid_crs),
    (gen_random_uuid(), cid_sss3, sid_econ),  (gen_random_uuid(), cid_sss3, sid_comm),
    (gen_random_uuid(), cid_sss3, sid_acct);

END $$;
