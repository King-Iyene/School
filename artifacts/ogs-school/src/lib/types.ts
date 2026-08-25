export type UserRole = 'super_admin' | 'admin' | 'principal' | 'head_teacher' | 'teacher' | 'nur_prim_teacher' | 'non_teaching_staff' | 'matron' | 'porter' | 'cleaner' | 'admin_support' | 'student' | 'parent' | 'accountant' | 'security_officer' | 'diocesan_official';

export interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  motto: string;
  established_year: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  school_id: string | null;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  date_of_birth: string | null;
  avatar_url: string;
  admission_number?: string;
  staff_id: string;
  student_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  name: string;
  created_at: string;
}

export interface AcademicYearTerm {
  id: string;
  academic_year_id: string;
  term_id: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  terms?: Term;
  academic_years?: AcademicYear;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  level: string;
  section: string;
  class_teacher_id: string | null;
  capacity: number;
  academic_year_id: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  category: string;
  created_at: string;
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  created_at: string;
  subjects?: Subject;
  profiles?: Profile;
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string | null;
  enrollment_date: string;
  status: string;
  created_at: string;
  classes?: Class;
  profiles?: Profile;
  academic_years?: AcademicYear;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  recorded_by: string | null;
  notes: string;
  created_at: string;
  profiles?: Profile;
}

export interface Grade {
  id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  academic_year_id: string;
  ca1_score: number;
  ca2_score: number;
  ca3_score: number;
  exam_score: number;
  total_score: number;
  grade: string;
  remark: string;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
  subjects?: Subject;
  profiles?: Profile;
}

export interface Assignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  term_id: string | null;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  status: string;
  created_at: string;
  subjects?: Subject;
  classes?: Class;
  profiles?: Profile;
}

export interface FeeStructure {
  id: string;
  school_id: string;
  name: string;
  description: string;
  amount: number;
  class_level: string;
  term_id: string | null;
  academic_year_id: string | null;
  due_date: string | null;
  is_mandatory: boolean;
  created_at: string;
}

export interface FeePayment {
  id: string;
  student_id: string;
  fee_structure_id: string;
  school_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  status: string;
  notes: string;
  recorded_by: string | null;
  created_at: string;
  fee_structures?: FeeStructure;
  profiles?: Profile;
}

export interface Announcement {
  id: string;
  school_id: string;
  author_id: string;
  title: string;
  content: string;
  target_roles: string[];
  target_class_id: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface Event {
  id: string;
  school_id: string;
  title: string;
  description: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  event_type: string;
  created_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

export interface Timetable {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  term_id: string | null;
  created_at: string;
  subjects?: Subject;
  profiles?: Profile;
  classes?: Class;
}

export interface QuestionBankItem {
  id: string;
  school_id: string;
  subject_id: string | null;
  created_by: string | null;
  question_text: string;
  question_type: 'objective' | 'theory';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subjects?: Subject;
}

export interface TodoItem {
  id: string;
  school_id: string;
  user_id: string;
  assigned_to: string | null;
  created_by: string | null;
  title: string;
  description: string;
  completed: boolean;
  due_date: string | null;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
  completed_at: string | null;
  profiles?: Profile; // For creator or assignee info if joined
}
