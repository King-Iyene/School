-- Clean up duplicate subjects
-- 1. Identify duplicates based on school_id and name
CREATE TEMP TABLE duplicates AS
SELECT id,
       ROW_NUMBER() OVER (PARTITION BY school_id, LOWER(TRIM(name)) ORDER BY created_at ASC) as rn,
       (SELECT id FROM subjects s2 
        WHERE s2.school_id = s1.school_id 
        AND LOWER(TRIM(s2.name)) = LOWER(TRIM(s1.name)) 
        ORDER BY created_at ASC LIMIT 1) as keep_id
FROM subjects s1;

-- 2. Update references in class_subjects to point to the 'keep_id'
UPDATE class_subjects
SET subject_id = d.keep_id
FROM duplicates d
WHERE class_subjects.subject_id = d.id
AND d.rn > 1;

-- 3. Update references in grades
UPDATE grades
SET subject_id = d.keep_id
FROM duplicates d
WHERE grades.subject_id = d.id
AND d.rn > 1;

-- 4. Delete the duplicate subject records
DELETE FROM subjects
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

DROP TABLE duplicates;

-- 5. Add unique constraints
ALTER TABLE subjects ADD CONSTRAINT subjects_school_name_unique UNIQUE (school_id, name);
-- Only add unique constraint on code if it's not empty/null for multiple records (tricky in Postgres)
-- But we can do a unique index on non-empty codes
-- CREATE UNIQUE INDEX subjects_school_code_unique_idx ON subjects (school_id, code) WHERE (code IS NOT NULL AND code <> '');
