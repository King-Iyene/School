/*
  # Fix calculate_grade Function Search Path V2

  1. Security Improvements
    - Make search_path immutable for calculate_grade function
    - Prevents potential SQL injection via search_path manipulation
    - Explicitly set search_path to public schema

  2. Changes
    - Drop and recreate function with proper security settings
    - Add SECURITY DEFINER and SET search_path
    - Ensure function runs with immutable search path
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS public.calculate_grade(numeric);

-- Recreate it with proper security settings
CREATE OR REPLACE FUNCTION public.calculate_grade(total numeric)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grade_letter text;
BEGIN
  -- Get the grade letter based on the score
  SELECT grade INTO grade_letter
  FROM grade_scales
  WHERE school_id = (
    SELECT school_id FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  )
  AND total >= min_score
  AND total <= max_score
  LIMIT 1;
  
  -- If no grade found, return default
  IF grade_letter IS NULL THEN
    IF total >= 90 THEN RETURN 'A';
    ELSIF total >= 80 THEN RETURN 'B';
    ELSIF total >= 70 THEN RETURN 'C';
    ELSIF total >= 60 THEN RETURN 'D';
    ELSIF total >= 50 THEN RETURN 'E';
    ELSE RETURN 'F';
    END IF;
  END IF;
  
  RETURN grade_letter;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_grade(numeric) TO authenticated;
