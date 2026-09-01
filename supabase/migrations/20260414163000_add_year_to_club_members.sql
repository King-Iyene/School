-- Add academic_year_id to club_members
ALTER TABLE club_members ADD COLUMN academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL;

-- Update unique constraint to allow a student to be in the same club in different years
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_club_id_student_id_key;
ALTER TABLE club_members ADD CONSTRAINT club_members_club_id_student_id_academic_year_key UNIQUE (club_id, student_id, academic_year_id);

-- Create a policy for year-based filtering if needed (existing ones are broad enough)
