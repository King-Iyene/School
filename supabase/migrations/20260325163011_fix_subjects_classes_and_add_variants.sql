/*
  # Fix Subjects, Classes and Add B-variant Senior Classes

  ## Changes
  1. Remove duplicate subjects - keep first ID of each duplicate pair
  2. Rename existing SSS/JSS classes to include A suffix  
  3. Add B-variant classes for all senior secondary classes (SSS 1B, SSS 2B, SSS 3B)
  4. Add B-variant classes for junior secondary (JSS 2B, JSS 3B)

  ## Subjects Cleaned
  Removed: duplicate Agricultural Science, Biology, Chemistry, CRS, Civic Education,
  Commerce, Economics, English Language, Further Mathematics, Geography, Government,
  Literature in English, Mathematics, Music, Physics

  ## Classes Updated
  - JSS 2 → JSS 2A, JSS 3 → JSS 3A
  - SSS 1 → SSS 1A, SSS 2 → SSS 2A, SSS 3 → SSS 3A
  - Added SSS 1B, SSS 2B, SSS 3B, JSS 2B, JSS 3B
*/

-- Step 1: Update any references in class_subjects to use the kept subject IDs (first in each pair)
UPDATE class_subjects SET subject_id = '00689cde-6138-4629-b3dc-af27452debc3' WHERE subject_id = '2644ef59-6f34-41a0-bfd7-88150e1f53ed';
UPDATE class_subjects SET subject_id = '12688f17-072e-429a-889e-471762d5bb9f' WHERE subject_id = '4f93216b-0d59-4bcc-abf4-89ee14aafd51';
UPDATE class_subjects SET subject_id = '0131bdb4-2799-473b-a370-9a34a158428a' WHERE subject_id = '51e5fbd7-43c7-41f8-a342-80a7f3f2ffd5';
UPDATE class_subjects SET subject_id = 'a6325655-e430-4761-bec6-ad45d2b8ff5a' WHERE subject_id = 'e07167af-1e08-4e7c-a269-afa7f8f0958f';
UPDATE class_subjects SET subject_id = '7cfa71d8-44b0-40b5-b805-bbcd30d999d5' WHERE subject_id = 'c12aaeae-1229-43df-be02-b15ed8d0fb60';
UPDATE class_subjects SET subject_id = '5764a423-026c-4b31-a8d9-4f8d532f0c68' WHERE subject_id = 'c36f8d98-d55d-436a-ad1d-adc936c9c8c5';
UPDATE class_subjects SET subject_id = '6c61486e-a287-4246-84e2-673a7bc89195' WHERE subject_id = 'a8032462-fde5-4d8d-8d1b-70b2183cc036';
UPDATE class_subjects SET subject_id = '328f1851-2965-480c-a771-7870ccd2a3a0' WHERE subject_id = '6d4012a2-9076-4d27-ad0b-9421cc1c1e72';
UPDATE class_subjects SET subject_id = '31f59fbe-3b34-4fd1-a425-11e163efd579' WHERE subject_id = 'd0ae8533-c49a-46c3-b9a3-b08a4afe6a0a';
UPDATE class_subjects SET subject_id = '4521448d-3b4c-4c26-ac8c-cf08c29380a3' WHERE subject_id = 'f8617340-3264-4df2-add9-b638372f4cb7';
UPDATE class_subjects SET subject_id = '8a527360-e9e4-4a92-b6a8-dc9d27f79ab9' WHERE subject_id = 'bfa7e0f7-deae-402f-8fdc-f09d88a32216';
UPDATE class_subjects SET subject_id = 'bad4dfe8-f630-4073-8588-621aaea579b3' WHERE subject_id = 'c200ddda-d12a-45be-970f-9b09fdbfcaa2';
UPDATE class_subjects SET subject_id = '16a6f980-2d44-49b5-a2b4-2fef1266c940' WHERE subject_id = 'f68bf254-e57b-450d-a81c-d55755f5d7a1';
UPDATE class_subjects SET subject_id = 'de4b8127-f493-4502-841f-1836ed236774' WHERE subject_id = 'fb10654c-465e-4ac7-a695-d677cfc71f98';
UPDATE class_subjects SET subject_id = '6a3b8936-c0ba-423e-b7bb-51e6ecf757b8' WHERE subject_id = 'cca5da9c-c61b-4b77-9b0f-1220c4c6cf36';

-- Update grades table references
UPDATE grades SET subject_id = '00689cde-6138-4629-b3dc-af27452debc3' WHERE subject_id = '2644ef59-6f34-41a0-bfd7-88150e1f53ed';
UPDATE grades SET subject_id = '12688f17-072e-429a-889e-471762d5bb9f' WHERE subject_id = '4f93216b-0d59-4bcc-abf4-89ee14aafd51';
UPDATE grades SET subject_id = '0131bdb4-2799-473b-a370-9a34a158428a' WHERE subject_id = '51e5fbd7-43c7-41f8-a342-80a7f3f2ffd5';
UPDATE grades SET subject_id = 'a6325655-e430-4761-bec6-ad45d2b8ff5a' WHERE subject_id = 'e07167af-1e08-4e7c-a269-afa7f8f0958f';
UPDATE grades SET subject_id = '7cfa71d8-44b0-40b5-b805-bbcd30d999d5' WHERE subject_id = 'c12aaeae-1229-43df-be02-b15ed8d0fb60';
UPDATE grades SET subject_id = '5764a423-026c-4b31-a8d9-4f8d532f0c68' WHERE subject_id = 'c36f8d98-d55d-436a-ad1d-adc936c9c8c5';
UPDATE grades SET subject_id = '6c61486e-a287-4246-84e2-673a7bc89195' WHERE subject_id = 'a8032462-fde5-4d8d-8d1b-70b2183cc036';
UPDATE grades SET subject_id = '328f1851-2965-480c-a771-7870ccd2a3a0' WHERE subject_id = '6d4012a2-9076-4d27-ad0b-9421cc1c1e72';
UPDATE grades SET subject_id = '31f59fbe-3b34-4fd1-a425-11e163efd579' WHERE subject_id = 'd0ae8533-c49a-46c3-b9a3-b08a4afe6a0a';
UPDATE grades SET subject_id = '4521448d-3b4c-4c26-ac8c-cf08c29380a3' WHERE subject_id = 'f8617340-3264-4df2-add9-b638372f4cb7';
UPDATE grades SET subject_id = '8a527360-e9e4-4a92-b6a8-dc9d27f79ab9' WHERE subject_id = 'bfa7e0f7-deae-402f-8fdc-f09d88a32216';
UPDATE grades SET subject_id = 'bad4dfe8-f630-4073-8588-621aaea579b3' WHERE subject_id = 'c200ddda-d12a-45be-970f-9b09fdbfcaa2';
UPDATE grades SET subject_id = '16a6f980-2d44-49b5-a2b4-2fef1266c940' WHERE subject_id = 'f68bf254-e57b-450d-a81c-d55755f5d7a1';
UPDATE grades SET subject_id = 'de4b8127-f493-4502-841f-1836ed236774' WHERE subject_id = 'fb10654c-465e-4ac7-a695-d677cfc71f98';
UPDATE grades SET subject_id = '6a3b8936-c0ba-423e-b7bb-51e6ecf757b8' WHERE subject_id = 'cca5da9c-c61b-4b77-9b0f-1220c4c6cf36';

-- Step 2: Delete the duplicate subjects
DELETE FROM subjects WHERE id IN (
  '2644ef59-6f34-41a0-bfd7-88150e1f53ed',
  '4f93216b-0d59-4bcc-abf4-89ee14aafd51',
  '51e5fbd7-43c7-41f8-a342-80a7f3f2ffd5',
  'e07167af-1e08-4e7c-a269-afa7f8f0958f',
  'c12aaeae-1229-43df-be02-b15ed8d0fb60',
  'c36f8d98-d55d-436a-ad1d-adc936c9c8c5',
  'a8032462-fde5-4d8d-8d1b-70b2183cc036',
  '6d4012a2-9076-4d27-ad0b-9421cc1c1e72',
  'd0ae8533-c49a-46c3-b9a3-b08a4afe6a0a',
  'f8617340-3264-4df2-add9-b638372f4cb7',
  'bfa7e0f7-deae-402f-8fdc-f09d88a32216',
  'c200ddda-d12a-45be-970f-9b09fdbfcaa2',
  'f68bf254-e57b-450d-a81c-d55755f5d7a1',
  'fb10654c-465e-4ac7-a695-d677cfc71f98',
  'cca5da9c-c61b-4b77-9b0f-1220c4c6cf36'
);

-- Step 3: Rename existing classes to include A suffix
UPDATE classes SET name = 'JSS 2A', section = 'A' WHERE name = 'JSS 2';
UPDATE classes SET name = 'JSS 3A', section = 'A' WHERE name = 'JSS 3';
UPDATE classes SET name = 'SSS 1A', section = 'A' WHERE name = 'SSS 1';
UPDATE classes SET name = 'SSS 2A', section = 'A' WHERE name = 'SSS 2';
UPDATE classes SET name = 'SSS 3A', section = 'A' WHERE name = 'SSS 3';

-- Step 4: Get school_id for seeding new classes
DO $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;

  IF v_school_id IS NOT NULL THEN
    -- Add B-variant junior classes
    INSERT INTO classes (school_id, name, level, section, capacity)
    VALUES
      (v_school_id, 'JSS 2B', 'JSS2', 'B', 40),
      (v_school_id, 'JSS 3B', 'JSS3', 'B', 40),
      (v_school_id, 'SSS 1B', 'SS1',  'B', 40),
      (v_school_id, 'SSS 2B', 'SS2',  'B', 40),
      (v_school_id, 'SSS 3B', 'SS3',  'B', 40)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
