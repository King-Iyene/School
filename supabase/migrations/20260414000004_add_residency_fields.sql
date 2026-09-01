-- Add State of Origin and LGA fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state_of_origin text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lga text DEFAULT '';

ALTER TABLE students ADD COLUMN IF NOT EXISTS state_of_origin text DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS lga text DEFAULT '';
