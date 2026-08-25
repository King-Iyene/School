/*
  # Optimize RLS Policies - Fix Auth Function Calls (Fixed)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
    - This prevents re-evaluation for each row
    - Significantly improves query performance at scale

  2. Tables Fixed
    - student_enrollments, parent_student_links, attendance, assignments
    - assignment_submissions, grades, fee_structures, fee_payments
    - timetable, announcements, events, notifications, online_exam_submissions
    - leave_applications, staff_attendance_records, payroll_records
    - homework_submissions, todo_items, store_categories, store_products
    - store_order_items, store_orders, messages, whatsapp_settings
    - whatsapp_logs, notification_triggers, staff_hr_details, profiles
    - clubs, club_teachers, club_members, prefect_positions, prefect_assignments
*/

-- Fix student_enrollments policies
DROP POLICY IF EXISTS "Students can view own enrollments" ON student_enrollments;
CREATE POLICY "Students can view own enrollments" ON student_enrollments
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

-- Fix parent_student_links policies
DROP POLICY IF EXISTS "Parents can view own links" ON parent_student_links;
CREATE POLICY "Parents can view own links" ON parent_student_links
  FOR SELECT TO authenticated
  USING (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can insert parent links" ON parent_student_links;
CREATE POLICY "Admins can insert parent links" ON parent_student_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update parent links" ON parent_student_links;
CREATE POLICY "Admins can update parent links" ON parent_student_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage parent links" ON parent_student_links;
CREATE POLICY "Admins can manage parent links" ON parent_student_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix attendance policies
DROP POLICY IF EXISTS "Students can view own attendance" ON attendance;
CREATE POLICY "Students can view own attendance" ON attendance
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view children attendance" ON attendance;
CREATE POLICY "Parents can view children attendance" ON attendance
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT student_id FROM parent_student_links
      WHERE parent_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Teachers can record attendance" ON attendance;
CREATE POLICY "Teachers can record attendance" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Teachers can update attendance" ON attendance;
CREATE POLICY "Teachers can update attendance" ON attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

-- Fix assignments policies
DROP POLICY IF EXISTS "Students in class can view assignments" ON assignments;
CREATE POLICY "Students in class can view assignments" ON assignments
  FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM profiles
      WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
CREATE POLICY "Teachers can create assignments" ON assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Teachers can update own assignments" ON assignments;
CREATE POLICY "Teachers can update own assignments" ON assignments
  FOR UPDATE TO authenticated
  USING (teacher_id = (select auth.uid()));

-- Fix assignment_submissions policies
DROP POLICY IF EXISTS "Students can view own submissions" ON assignment_submissions;
CREATE POLICY "Students can view own submissions" ON assignment_submissions
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Teachers can view submissions" ON assignment_submissions;
CREATE POLICY "Teachers can view submissions" ON assignment_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Students can submit assignments" ON assignment_submissions;
CREATE POLICY "Students can submit assignments" ON assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can update own submissions" ON assignment_submissions;
CREATE POLICY "Students can update own submissions" ON assignment_submissions
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Teachers can grade submissions" ON assignment_submissions;
CREATE POLICY "Teachers can grade submissions" ON assignment_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

-- Fix grades policies
DROP POLICY IF EXISTS "Students can view own grades" ON grades;
CREATE POLICY "Students can view own grades" ON grades
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view children grades" ON grades;
CREATE POLICY "Parents can view children grades" ON grades
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT student_id FROM parent_student_links
      WHERE parent_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can view grades" ON grades;
CREATE POLICY "Teachers and admins can view grades" ON grades
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Teachers can insert grades" ON grades;
CREATE POLICY "Teachers can insert grades" ON grades
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Teachers can update grades" ON grades;
CREATE POLICY "Teachers can update grades" ON grades
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

-- Fix fee_structures policies
DROP POLICY IF EXISTS "Accountants can insert fee structures" ON fee_structures;
CREATE POLICY "Accountants can insert fee structures" ON fee_structures
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('accountant', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Accountants can update fee structures" ON fee_structures;
CREATE POLICY "Accountants can update fee structures" ON fee_structures
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('accountant', 'super_admin', 'admin')
    )
  );

-- Fix fee_payments policies
DROP POLICY IF EXISTS "Students can view own payments" ON fee_payments;
CREATE POLICY "Students can view own payments" ON fee_payments
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view children payments" ON fee_payments;
CREATE POLICY "Parents can view children payments" ON fee_payments
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT student_id FROM parent_student_links
      WHERE parent_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Accountants and admins can view all payments" ON fee_payments;
CREATE POLICY "Accountants and admins can view all payments" ON fee_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('accountant', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Accountants can record payments" ON fee_payments;
CREATE POLICY "Accountants can record payments" ON fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('accountant', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Accountants can update payments" ON fee_payments;
CREATE POLICY "Accountants can update payments" ON fee_payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('accountant', 'super_admin', 'admin')
    )
  );

-- Fix timetable policies
DROP POLICY IF EXISTS "Admins can manage timetable insert" ON timetable;
CREATE POLICY "Admins can manage timetable insert" ON timetable
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can manage timetable update" ON timetable;
CREATE POLICY "Admins can manage timetable update" ON timetable
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix announcements policies
DROP POLICY IF EXISTS "Staff can create announcements" ON announcements;
CREATE POLICY "Staff can create announcements" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Authors and admins can update announcements" ON announcements;
CREATE POLICY "Authors and admins can update announcements" ON announcements
  FOR UPDATE TO authenticated
  USING (
    author_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix events policies
DROP POLICY IF EXISTS "Admins can create events" ON events;
CREATE POLICY "Admins can create events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update events" ON events;
CREATE POLICY "Admins can update events" ON events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Fix online_exam_submissions policies
DROP POLICY IF EXISTS "Students can view own submissions" ON online_exam_submissions;
CREATE POLICY "Students can view own submissions" ON online_exam_submissions
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can insert own submissions" ON online_exam_submissions;
CREATE POLICY "Students can insert own submissions" ON online_exam_submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students and admin can update submissions" ON online_exam_submissions;
CREATE POLICY "Students and admin can update submissions" ON online_exam_submissions
  FOR UPDATE TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

-- Fix leave_applications policies
DROP POLICY IF EXISTS "Staff can view own leave applications" ON leave_applications;
CREATE POLICY "Staff can view own leave applications" ON leave_applications
  FOR SELECT TO authenticated
  USING (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can insert leave applications" ON leave_applications;
CREATE POLICY "Staff can insert leave applications" ON leave_applications
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Super admin can update leave applications" ON leave_applications;
CREATE POLICY "Super admin can update leave applications" ON leave_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can delete leave applications" ON leave_applications;
CREATE POLICY "Super admin can delete leave applications" ON leave_applications
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix staff_attendance_records policies
DROP POLICY IF EXISTS "School members can view staff attendance" ON staff_attendance_records;
CREATE POLICY "School members can view staff attendance" ON staff_attendance_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.school_id = staff_attendance_records.school_id
    )
  );

-- Fix payroll_records policies
DROP POLICY IF EXISTS "Staff can view own payroll" ON payroll_records;
CREATE POLICY "Staff can view own payroll" ON payroll_records
  FOR SELECT TO authenticated
  USING (staff_id = (select auth.uid()));

-- Fix homework_submissions policies
DROP POLICY IF EXISTS "School members can view homework submissions" ON homework_submissions;
CREATE POLICY "School members can view homework submissions" ON homework_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN homework_records h ON h.id = homework_submissions.homework_id
      WHERE p.id = (select auth.uid())
      AND p.school_id = h.school_id
    )
  );

DROP POLICY IF EXISTS "Students can insert own submissions" ON homework_submissions;
CREATE POLICY "Students can insert own submissions" ON homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Update homework submissions" ON homework_submissions;
CREATE POLICY "Update homework submissions" ON homework_submissions
  FOR UPDATE TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('teacher', 'super_admin', 'admin')
    )
  );

-- Fix todo_items policies
DROP POLICY IF EXISTS "Users can view own todos" ON todo_items;
CREATE POLICY "Users can view own todos" ON todo_items
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own todos" ON todo_items;
CREATE POLICY "Users can insert own todos" ON todo_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own todos" ON todo_items;
CREATE POLICY "Users can update own todos" ON todo_items
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own todos" ON todo_items;
CREATE POLICY "Users can delete own todos" ON todo_items
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix store_categories policies
DROP POLICY IF EXISTS "All school users can read store categories" ON store_categories;
CREATE POLICY "All school users can read store categories" ON store_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.school_id = store_categories.school_id
    )
  );

DROP POLICY IF EXISTS "Super admins can insert store categories" ON store_categories;
CREATE POLICY "Super admins can insert store categories" ON store_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admins can update store categories" ON store_categories;
CREATE POLICY "Super admins can update store categories" ON store_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admins can delete store categories" ON store_categories;
CREATE POLICY "Super admins can delete store categories" ON store_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix store_products policies
DROP POLICY IF EXISTS "Authenticated users can view active products" ON store_products;
CREATE POLICY "Authenticated users can view active products" ON store_products
  FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Super admins can insert products" ON store_products;
CREATE POLICY "Super admins can insert products" ON store_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admins can update products" ON store_products;
CREATE POLICY "Super admins can update products" ON store_products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admins can delete products" ON store_products;
CREATE POLICY "Super admins can delete products" ON store_products
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix store_order_items policies
DROP POLICY IF EXISTS "Users can view items of their own orders" ON store_order_items;
CREATE POLICY "Users can view items of their own orders" ON store_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_orders
      WHERE store_orders.id = store_order_items.order_id
      AND store_orders.student_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert order items for their own orders" ON store_order_items;
CREATE POLICY "Users can insert order items for their own orders" ON store_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_orders
      WHERE store_orders.id = store_order_items.order_id
      AND store_orders.student_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can delete order items" ON store_order_items;
CREATE POLICY "Admins can delete order items" ON store_order_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix store_orders policies
DROP POLICY IF EXISTS "Users can view their own orders" ON store_orders;
CREATE POLICY "Users can view their own orders" ON store_orders
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can place orders" ON store_orders;
CREATE POLICY "Users can place orders" ON store_orders
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update order status" ON store_orders;
CREATE POLICY "Admins can update order status" ON store_orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete orders" ON store_orders;
CREATE POLICY "Admins can delete orders" ON store_orders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix messages policies
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
CREATE POLICY "Users can view messages they sent or received" ON messages
  FOR SELECT TO authenticated
  USING (
    sender_id = (select auth.uid()) OR
    recipient_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can send messages" ON messages;
CREATE POLICY "Authenticated users can send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;
CREATE POLICY "Recipients can mark messages as read" ON messages
  FOR UPDATE TO authenticated
  USING (recipient_id = (select auth.uid()));

DROP POLICY IF EXISTS "Senders and admins can delete messages" ON messages;
CREATE POLICY "Senders and admins can delete messages" ON messages
  FOR DELETE TO authenticated
  USING (
    sender_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix whatsapp_settings policies
DROP POLICY IF EXISTS "Admins can read own school whatsapp settings" ON whatsapp_settings;
CREATE POLICY "Admins can read own school whatsapp settings" ON whatsapp_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert whatsapp settings" ON whatsapp_settings;
CREATE POLICY "Admins can insert whatsapp settings" ON whatsapp_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update whatsapp settings" ON whatsapp_settings;
CREATE POLICY "Admins can update whatsapp settings" ON whatsapp_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix whatsapp_logs policies
DROP POLICY IF EXISTS "Admins and teachers can view WhatsApp logs" ON whatsapp_logs;
CREATE POLICY "Admins and teachers can view WhatsApp logs" ON whatsapp_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Admins and teachers can insert WhatsApp logs" ON whatsapp_logs;
CREATE POLICY "Admins and teachers can insert WhatsApp logs" ON whatsapp_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Admins can delete WhatsApp logs" ON whatsapp_logs;
CREATE POLICY "Admins can delete WhatsApp logs" ON whatsapp_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix notification_triggers policies
DROP POLICY IF EXISTS "Admins can read notification triggers" ON notification_triggers;
CREATE POLICY "Admins can read notification triggers" ON notification_triggers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert notification triggers" ON notification_triggers;
CREATE POLICY "Admins can insert notification triggers" ON notification_triggers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update notification triggers" ON notification_triggers;
CREATE POLICY "Admins can update notification triggers" ON notification_triggers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix staff_hr_details policies
DROP POLICY IF EXISTS "Staff view own HR details" ON staff_hr_details;
CREATE POLICY "Staff view own HR details" ON staff_hr_details
  FOR SELECT TO authenticated
  USING (profile_id = (select auth.uid()));

-- Fix profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- Fix clubs policies
DROP POLICY IF EXISTS "Super admin can insert clubs" ON clubs;
CREATE POLICY "Super admin can insert clubs" ON clubs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can update clubs" ON clubs;
CREATE POLICY "Super admin can update clubs" ON clubs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can delete clubs" ON clubs;
CREATE POLICY "Super admin can delete clubs" ON clubs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix club_teachers policies
DROP POLICY IF EXISTS "Super admin can insert club teachers" ON club_teachers;
CREATE POLICY "Super admin can insert club teachers" ON club_teachers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can update club teachers" ON club_teachers;
CREATE POLICY "Super admin can update club teachers" ON club_teachers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can delete club teachers" ON club_teachers;
CREATE POLICY "Super admin can delete club teachers" ON club_teachers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix club_members policies
DROP POLICY IF EXISTS "Super admin and teachers can insert club members" ON club_members;
CREATE POLICY "Super admin and teachers can insert club members" ON club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Super admin and teachers can update club members" ON club_members;
CREATE POLICY "Super admin and teachers can update club members" ON club_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Super admin and teachers can delete club members" ON club_members;
CREATE POLICY "Super admin and teachers can delete club members" ON club_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

-- Fix prefect_positions policies
DROP POLICY IF EXISTS "Super admin can insert prefect positions" ON prefect_positions;
CREATE POLICY "Super admin can insert prefect positions" ON prefect_positions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can update prefect positions" ON prefect_positions;
CREATE POLICY "Super admin can update prefect positions" ON prefect_positions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can delete prefect positions" ON prefect_positions;
CREATE POLICY "Super admin can delete prefect positions" ON prefect_positions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Fix prefect_assignments policies
DROP POLICY IF EXISTS "Super admin can insert prefect assignments" ON prefect_assignments;
CREATE POLICY "Super admin can insert prefect assignments" ON prefect_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can update prefect assignments" ON prefect_assignments;
CREATE POLICY "Super admin can update prefect assignments" ON prefect_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Super admin can delete prefect assignments" ON prefect_assignments;
CREATE POLICY "Super admin can delete prefect assignments" ON prefect_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('super_admin', 'admin')
    )
  );
