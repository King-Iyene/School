/*
  # Promote Denzel Iyene to Head Teacher

  1. Changes
    - Updates profiles.role for denzel.iyene@okrika.edu.ng from 'teacher' to 'head_teacher'
  2. Security
    - No RLS changes; existing head_teacher policies apply
*/

UPDATE profiles
SET role = 'head_teacher'
WHERE email = 'denzel.iyene@okrika.edu.ng';