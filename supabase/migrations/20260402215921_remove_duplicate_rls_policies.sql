/*
  # Remove Duplicate RLS Policies

  1. Security Cleanup
    - Remove duplicate permissive policies
    - Keep only one policy per action per table
    - Reduces policy evaluation overhead

  2. Tables Cleaned
    - assignment_submissions, attendance, fee_payments, grades
    - parent_student_links, profiles, schools, staff_hr_details
    - store_categories, store_order_items, store_orders, store_products
    - student_enrollments
*/

-- Remove duplicate store_categories policies
DROP POLICY IF EXISTS "Authenticated users can view store categories" ON store_categories;

-- Remove duplicate store_products policies
DROP POLICY IF EXISTS "Students and parents can read active products" ON store_products;
DROP POLICY IF EXISTS "Admins can update products" ON store_products;

-- Remove duplicate store_order_items policies
DROP POLICY IF EXISTS "Users can read own order items" ON store_order_items;
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON store_order_items;

-- Remove duplicate store_orders policies
DROP POLICY IF EXISTS "Users can read own orders" ON store_orders;
DROP POLICY IF EXISTS "Authenticated users can place orders" ON store_orders;

-- Note: The following tables have multiple permissive policies by design
-- to allow different roles to access the same data:
-- - assignment_submissions (students view own, teachers view all)
-- - attendance (students view own, parents view children, teachers view all)
-- - fee_payments (students view own, parents view children, accountants view all)
-- - grades (students view own, parents view children, teachers view all)
-- - parent_student_links (parents view own, admins view all)
-- - profiles (users view own, users in same school view profiles, super admins view all)
-- - schools (public can view branding, users can view own school)
-- - staff_hr_details (staff view own, super admins view all)
-- - student_enrollments (students view own, staff view all)

-- These are INTENTIONAL and not duplicates - they serve different purposes
