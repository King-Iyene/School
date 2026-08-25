/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add covering indexes for all foreign key constraints
    - Improves JOIN performance and query optimization
    - Prevents full table scans on foreign key lookups

  2. Tables Affected
    - academic_years, admin_setup, admission_exam_bookings, admission_exam_slots
    - admission_followups, admission_payments, admission_queries, announcements
    - assessment_weights, assignment_submissions, assignments, attendance
    - bank_accounts, behaviour_incidents, book_categories, book_issues, books
    - chart_of_accounts, class_routines, class_subjects, class_teachers, classes
    - classrooms, club_teachers, clubs, complaints, disabled_students
    - And many more (comprehensive index coverage)
*/

-- Academic Years
CREATE INDEX IF NOT EXISTS idx_academic_years_school_id ON academic_years(school_id);

-- Admin Setup
CREATE INDEX IF NOT EXISTS idx_admin_setup_school_id ON admin_setup(school_id);

-- Admission System
CREATE INDEX IF NOT EXISTS idx_admission_exam_bookings_slot_id ON admission_exam_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_admission_exam_slots_school_id ON admission_exam_slots(school_id);
CREATE INDEX IF NOT EXISTS idx_admission_followups_assigned_to ON admission_followups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admission_followups_created_by ON admission_followups(created_by);
CREATE INDEX IF NOT EXISTS idx_admission_followups_query_id ON admission_followups(query_id);
CREATE INDEX IF NOT EXISTS idx_admission_followups_school_id ON admission_followups(school_id);
CREATE INDEX IF NOT EXISTS idx_admission_payments_prospective_student_id ON admission_payments(prospective_student_id);
CREATE INDEX IF NOT EXISTS idx_admission_queries_assigned_to ON admission_queries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admission_queries_created_by ON admission_queries(created_by);
CREATE INDEX IF NOT EXISTS idx_admission_queries_school_id ON admission_queries(school_id);
CREATE INDEX IF NOT EXISTS idx_prospective_students_school_id ON prospective_students(school_id);

-- Announcements
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_school_id ON announcements(school_id);
CREATE INDEX IF NOT EXISTS idx_announcements_target_class_id ON announcements(target_class_id);

-- Assessment Weights
CREATE INDEX IF NOT EXISTS idx_assessment_weights_academic_year_id ON assessment_weights(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_assessment_weights_school_id ON assessment_weights(school_id);

-- Assignments
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_term_id ON assignments(term_id);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_by ON attendance(recorded_by);

-- Finance
CREATE INDEX IF NOT EXISTS idx_bank_accounts_school_id ON bank_accounts(school_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_school_id ON chart_of_accounts(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_list_school_id ON payment_methods_list(school_id);

-- Behaviour
CREATE INDEX IF NOT EXISTS idx_behaviour_incidents_school_id ON behaviour_incidents(school_id);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_records_assigned_by ON student_behaviour_records(assigned_by);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_records_class_id ON student_behaviour_records(class_id);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_records_incident_id ON student_behaviour_records(incident_id);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_records_school_id ON student_behaviour_records(school_id);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_records_section_id ON student_behaviour_records(section_id);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_records_student_id ON student_behaviour_records(student_id);

-- Library
CREATE INDEX IF NOT EXISTS idx_book_categories_school_id ON book_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_book_id ON book_issues(book_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_school_id ON book_issues(school_id);
CREATE INDEX IF NOT EXISTS idx_books_category_id ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_school_id ON books(school_id);
CREATE INDEX IF NOT EXISTS idx_library_members_profile_id ON library_members(profile_id);

-- Classes and Routines
CREATE INDEX IF NOT EXISTS idx_class_routines_academic_year_id ON class_routines(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_routines_classroom_id ON class_routines(classroom_id);
CREATE INDEX IF NOT EXISTS idx_class_routines_school_id ON class_routines(school_id);
CREATE INDEX IF NOT EXISTS idx_class_routines_subject_id ON class_routines(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_routines_teacher_id ON class_routines(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_routines_time_slot_id ON class_routines(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_subject_id ON class_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher_id ON class_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_academic_year_id ON class_teachers(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_school_id ON class_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON class_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year_id ON classes(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_classes_class_teacher_id ON classes(class_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_school_id ON classrooms(school_id);
CREATE INDEX IF NOT EXISTS idx_sections_class_id ON sections(class_id);
CREATE INDEX IF NOT EXISTS idx_sections_school_id ON sections(school_id);

-- Clubs
CREATE INDEX IF NOT EXISTS idx_club_teachers_profile_id ON club_teachers(profile_id);
CREATE INDEX IF NOT EXISTS idx_clubs_academic_year_id ON clubs(academic_year_id);

-- Complaints
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_created_by ON complaints(created_by);
CREATE INDEX IF NOT EXISTS idx_complaints_school_id ON complaints(school_id);

-- Students
CREATE INDEX IF NOT EXISTS idx_disabled_students_disabled_by ON disabled_students(disabled_by);
CREATE INDEX IF NOT EXISTS idx_disabled_students_school_id ON disabled_students(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student_id ON parent_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_student_categories_school_id ON student_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_student_groups_school_id ON student_groups(school_id);
CREATE INDEX IF NOT EXISTS idx_student_group_members_student_id ON student_group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- Dormitory
CREATE INDEX IF NOT EXISTS idx_dormitory_assignments_academic_year_id ON dormitory_assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_assignments_room_id ON dormitory_assignments(room_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_assignments_school_id ON dormitory_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_assignments_student_id ON dormitory_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_buildings_school_id ON dormitory_buildings(school_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_rooms_building_id ON dormitory_rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_rooms_room_type_id ON dormitory_rooms(room_type_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_rooms_school_id ON dormitory_rooms(school_id);
CREATE INDEX IF NOT EXISTS idx_room_types_school_id ON room_types(school_id);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_school_id ON events(school_id);

-- Exams
CREATE INDEX IF NOT EXISTS idx_exam_attendance_records_class_id ON exam_attendance_records(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_attendance_records_school_id ON exam_attendance_records(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_attendance_records_student_id ON exam_attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attendance_records_subject_id ON exam_attendance_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_records_class_id ON exam_marks_records(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_records_school_id ON exam_marks_records(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_records_student_id ON exam_marks_records(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_records_subject_id ON exam_marks_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_names_academic_year_id ON exam_names(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exam_names_school_id ON exam_names(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_names_term_id ON exam_names(term_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_school_id ON exam_results(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student_id ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_subject_id ON exam_results(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedule_school_id ON exam_schedule(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedule_subject_id ON exam_schedule(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_class_id ON exam_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_school_id ON exam_schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_subject_id ON exam_schedules(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_setups_class_id ON exam_setups(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_setups_school_id ON exam_setups(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_setups_subject_id ON exam_setups(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_academic_year_id ON exams(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exams_term_id ON exams(term_id);
CREATE INDEX IF NOT EXISTS idx_grade_scales_school_id ON grade_scales(school_id);
CREATE INDEX IF NOT EXISTS idx_online_exam_questions_question_id ON online_exam_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_online_exam_submissions_student_id ON online_exam_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_online_exams_exam_name_id ON online_exams(exam_name_id);
CREATE INDEX IF NOT EXISTS idx_online_exams_school_id ON online_exams(school_id);
CREATE INDEX IF NOT EXISTS idx_online_exams_subject_id ON online_exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_class_id ON question_bank(class_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_question_group_id ON question_bank(question_group_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_school_id ON question_bank(school_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_subject_id ON question_bank(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_class_id ON question_groups(class_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_school_id ON question_groups(school_id);
CREATE INDEX IF NOT EXISTS idx_question_groups_subject_id ON question_groups(subject_id);

-- Finance Records
CREATE INDEX IF NOT EXISTS idx_expense_records_account_id ON expense_records(account_id);
CREATE INDEX IF NOT EXISTS idx_expense_records_bank_account_id ON expense_records(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_expense_records_created_by ON expense_records(created_by);
CREATE INDEX IF NOT EXISTS idx_expense_records_payment_method_id ON expense_records(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_expense_records_school_id ON expense_records(school_id);
CREATE INDEX IF NOT EXISTS idx_income_records_account_id ON income_records(account_id);
CREATE INDEX IF NOT EXISTS idx_income_records_bank_account_id ON income_records(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_income_records_created_by ON income_records(created_by);
CREATE INDEX IF NOT EXISTS idx_income_records_payment_method_id ON income_records(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_income_records_school_id ON income_records(school_id);

-- Fees
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee_structure_id ON fee_payments(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_recorded_by ON fee_payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id ON fee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_academic_year_id ON fee_structures(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_school_id ON fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_term_id ON fee_structures(term_id);
CREATE INDEX IF NOT EXISTS idx_fees_carry_forward_carried_by ON fees_carry_forward(carried_by);
CREATE INDEX IF NOT EXISTS idx_fees_carry_forward_from_year_id ON fees_carry_forward(from_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_carry_forward_school_id ON fees_carry_forward(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_carry_forward_student_id ON fees_carry_forward(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_carry_forward_to_year_id ON fees_carry_forward(to_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_collections_academic_year_id ON fees_collections(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_collections_collected_by ON fees_collections(collected_by);
CREATE INDEX IF NOT EXISTS idx_fees_collections_discount_id ON fees_collections(discount_id);
CREATE INDEX IF NOT EXISTS idx_fees_collections_fees_master_id ON fees_collections(fees_master_id);
CREATE INDEX IF NOT EXISTS idx_fees_collections_school_id ON fees_collections(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_discounts_school_id ON fees_discounts(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_groups_school_id ON fees_groups(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_academic_year_id ON fees_master(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_class_id ON fees_master(class_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_fees_group_id ON fees_master(fees_group_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_fees_type_id ON fees_master(fees_type_id);
CREATE INDEX IF NOT EXISTS idx_fees_master_school_id ON fees_master(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_types_fees_group_id ON fees_types(fees_group_id);
CREATE INDEX IF NOT EXISTS idx_fees_types_school_id ON fees_types(school_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_fee_structure_id ON student_fee_payments(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_recorded_by ON student_fee_payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_school_id ON student_fee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_payments_student_id ON student_fee_payments(student_id);

-- Grades
CREATE INDEX IF NOT EXISTS idx_grades_academic_year_id ON grades(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_grades_class_id ON grades(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_teacher_id ON grades(teacher_id);
CREATE INDEX IF NOT EXISTS idx_grades_term_id ON grades(term_id);

-- Holiday
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_academic_year_id ON holiday_calendar(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_school_id ON holiday_calendar(school_id);

-- Homework
CREATE INDEX IF NOT EXISTS idx_homework_records_school_id ON homework_records(school_id);
CREATE INDEX IF NOT EXISTS idx_homework_records_subject_id ON homework_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_homework_records_teacher_id ON homework_records(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id ON homework_submissions(student_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_categories_school_id ON inventory_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_school_id ON inventory_items(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_store_id ON inventory_items(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stores_school_id ON inventory_stores(school_id);
CREATE INDEX IF NOT EXISTS idx_item_issues_created_by ON item_issues(created_by);
CREATE INDEX IF NOT EXISTS idx_item_issues_issued_to ON item_issues(issued_to);
CREATE INDEX IF NOT EXISTS idx_item_issues_item_id ON item_issues(item_id);
CREATE INDEX IF NOT EXISTS idx_item_issues_school_id ON item_issues(school_id);
CREATE INDEX IF NOT EXISTS idx_item_receives_created_by ON item_receives(created_by);
CREATE INDEX IF NOT EXISTS idx_item_receives_item_id ON item_receives(item_id);
CREATE INDEX IF NOT EXISTS idx_item_receives_school_id ON item_receives(school_id);
CREATE INDEX IF NOT EXISTS idx_item_receives_supplier_id ON item_receives(supplier_id);
CREATE INDEX IF NOT EXISTS idx_item_sells_created_by ON item_sells(created_by);
CREATE INDEX IF NOT EXISTS idx_item_sells_item_id ON item_sells(item_id);
CREATE INDEX IF NOT EXISTS idx_item_sells_school_id ON item_sells(school_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_school_id ON suppliers(school_id);

-- Leave Management
CREATE INDEX IF NOT EXISTS idx_leave_allocations_academic_year_id ON leave_allocations(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_leave_allocations_leave_type_id ON leave_allocations(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_allocations_school_id ON leave_allocations(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_approved_by ON leave_applications(approved_by);
CREATE INDEX IF NOT EXISTS idx_leave_applications_leave_type_id ON leave_applications(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_applications_school_id ON leave_applications(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_school_id ON leave_types(school_id);

-- Lesson Plans
CREATE INDEX IF NOT EXISTS idx_lesson_plans_school_id ON lesson_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_id ON lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_topic_id ON lesson_plans(topic_id);
CREATE INDEX IF NOT EXISTS idx_lessons_academic_year_id ON lessons(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_lessons_class_id ON lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons(subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_id ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_topics_lesson_id ON topics(lesson_id);
CREATE INDEX IF NOT EXISTS idx_topics_school_id ON topics(school_id);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);

-- Notices
CREATE INDEX IF NOT EXISTS idx_notice_board_items_published_by ON notice_board_items(published_by);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Other Downloads
CREATE INDEX IF NOT EXISTS idx_other_downloads_school_id ON other_downloads(school_id);
CREATE INDEX IF NOT EXISTS idx_other_downloads_uploaded_by ON other_downloads(uploaded_by);

-- Payroll
CREATE INDEX IF NOT EXISTS idx_payroll_records_school_id ON payroll_records(school_id);

-- Phone Logs
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_created_by ON phone_call_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_phone_call_logs_school_id ON phone_call_logs(school_id);

-- Postal
CREATE INDEX IF NOT EXISTS idx_postal_dispatches_created_by ON postal_dispatches(created_by);
CREATE INDEX IF NOT EXISTS idx_postal_dispatches_school_id ON postal_dispatches(school_id);
CREATE INDEX IF NOT EXISTS idx_postal_receives_created_by ON postal_receives(created_by);
CREATE INDEX IF NOT EXISTS idx_postal_receives_school_id ON postal_receives(school_id);

-- Prefects
CREATE INDEX IF NOT EXISTS idx_prefect_assignments_academic_year_id ON prefect_assignments(academic_year_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_category_id ON profiles(category_id);
CREATE INDEX IF NOT EXISTS idx_profiles_class_id ON profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_section_id ON profiles(section_id);

-- Results
CREATE INDEX IF NOT EXISTS idx_result_compilations_academic_year_id ON result_compilations(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_result_compilations_compiled_by ON result_compilations(compiled_by);
CREATE INDEX IF NOT EXISTS idx_result_compilations_school_id ON result_compilations(school_id);

-- Staff
CREATE INDEX IF NOT EXISTS idx_staff_attendance_records_school_id ON staff_attendance_records(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_committees_profile_id ON staff_committees(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_committees_school_id ON staff_committees(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_disciplinary_profile_id ON staff_disciplinary(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_disciplinary_school_id ON staff_disciplinary(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_profile_id ON staff_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_school_id ON staff_documents(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_hr_details_school_id ON staff_hr_details(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_profile_id ON staff_qualifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_school_id ON staff_qualifications(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_records_school_id ON staff_records(school_id);

-- Store
CREATE INDEX IF NOT EXISTS idx_store_categories_school_id ON store_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_order_id ON store_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_product_id ON store_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_student_id ON store_orders(student_id);

-- Student Assessments
CREATE INDEX IF NOT EXISTS idx_student_assessments_academic_year_id ON student_assessments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_assessments_class_id ON student_assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_student_assessments_exam_name_id ON student_assessments(exam_name_id);
CREATE INDEX IF NOT EXISTS idx_student_assessments_school_id ON student_assessments(school_id);
CREATE INDEX IF NOT EXISTS idx_student_assessments_section_id ON student_assessments(section_id);
CREATE INDEX IF NOT EXISTS idx_student_assessments_student_id ON student_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_assessments_subject_id ON student_assessments(subject_id);

-- Student Attendance
CREATE INDEX IF NOT EXISTS idx_student_attendance_class_id ON student_attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_recorded_by ON student_attendance(recorded_by);
CREATE INDEX IF NOT EXISTS idx_student_attendance_school_id ON student_attendance(school_id);

-- Student Certificates
CREATE INDEX IF NOT EXISTS idx_student_certificates_created_by ON student_certificates(created_by);
CREATE INDEX IF NOT EXISTS idx_student_certificates_school_id ON student_certificates(school_id);

-- Student Documents
CREATE INDEX IF NOT EXISTS idx_student_documents_school_id ON student_documents(school_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id ON student_documents(student_id);

-- Student Domain Ratings
CREATE INDEX IF NOT EXISTS idx_student_domain_ratings_academic_year_id ON student_domain_ratings(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_domain_ratings_rated_by ON student_domain_ratings(rated_by);
CREATE INDEX IF NOT EXISTS idx_student_domain_ratings_school_id ON student_domain_ratings(school_id);
CREATE INDEX IF NOT EXISTS idx_student_domain_ratings_skill_id ON student_domain_ratings(skill_id);
CREATE INDEX IF NOT EXISTS idx_student_domain_ratings_term_id ON student_domain_ratings(term_id);

-- Student Enrollments
CREATE INDEX IF NOT EXISTS idx_student_enrollments_academic_year_id ON student_enrollments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_id ON student_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_term_id ON student_enrollments(term_id);

-- Student ID Cards
CREATE INDEX IF NOT EXISTS idx_student_id_cards_created_by ON student_id_cards(created_by);
CREATE INDEX IF NOT EXISTS idx_student_id_cards_school_id ON student_id_cards(school_id);

-- Student Promotions
CREATE INDEX IF NOT EXISTS idx_student_promotions_from_class_id ON student_promotions(from_class_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_from_year_id ON student_promotions(from_year_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_promoted_by ON student_promotions(promoted_by);
CREATE INDEX IF NOT EXISTS idx_student_promotions_school_id ON student_promotions(school_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_student_id ON student_promotions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_to_class_id ON student_promotions(to_class_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_to_year_id ON student_promotions(to_year_id);

-- Study Materials
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_subject_id ON study_materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_uploaded_by ON study_materials(uploaded_by);

-- Subject Teacher Assignments
CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_academic_year_id ON subject_teacher_assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_school_id ON subject_teacher_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_subject_id ON subject_teacher_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_teacher_assignments_teacher_id ON subject_teacher_assignments(teacher_id);

-- Subjects
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);

-- Syllabus
CREATE INDEX IF NOT EXISTS idx_syllabus_items_academic_year_id ON syllabus_items(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_class_id ON syllabus_items(class_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_school_id ON syllabus_items(school_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_subject_id ON syllabus_items(subject_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_term_id ON syllabus_items(term_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_items_uploaded_by ON syllabus_items(uploaded_by);

-- Terms
CREATE INDEX IF NOT EXISTS idx_terms_academic_year_id ON terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_terms_school_id ON terms(school_id);

-- Time Slots
CREATE INDEX IF NOT EXISTS idx_time_slots_school_id ON time_slots(school_id);

-- Timetable
CREATE INDEX IF NOT EXISTS idx_timetable_class_id ON timetable(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_subject_id ON timetable(subject_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher_id ON timetable(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_term_id ON timetable(term_id);

-- Todos
CREATE INDEX IF NOT EXISTS idx_todo_items_school_id ON todo_items(school_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_id ON todo_items(user_id);

-- Transport
CREATE INDEX IF NOT EXISTS idx_transport_assignments_academic_year_id ON transport_assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_route_id ON transport_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_school_id ON transport_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_vehicle_id ON transport_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_school_id ON transport_routes(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_route_id ON transport_vehicles(route_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_school_id ON transport_vehicles(school_id);

-- Visitors
CREATE INDEX IF NOT EXISTS idx_visitors_created_by ON visitors(created_by);
CREATE INDEX IF NOT EXISTS idx_visitors_school_id ON visitors(school_id);

-- WhatsApp
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_by ON whatsapp_logs(sent_by);
