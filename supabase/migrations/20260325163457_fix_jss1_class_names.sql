/*
  # Fix JSS 1 A/B names to remove extra space
*/
UPDATE classes SET name = 'JSS 1A' WHERE name = 'JSS 1 A';
UPDATE classes SET name = 'JSS 1B' WHERE name = 'JSS 1 B';
