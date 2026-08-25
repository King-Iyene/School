export type UserRole =
  | "super_admin"
  | "admin"
  | "principal"
  | "head_teacher"
  | "teacher"
  | "student"
  | "parent"
  | "accountant"
  | "security_officer"
  | "diocesan_official";

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
  subjects?: { id: string; name: string; code: string };
  classes?: { id: string; name: string };
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  notes: string;
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
  subjects?: { id: string; name: string; code: string };
  profiles?: { id: string; first_name: string; last_name: string };
  classes?: { id: string; name: string };
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  classes?: { id: string; name: string; level: string };
  subjects?: { id: string; name: string; code: string };
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  status: string;
  classes?: { id: string; name: string; level: string };
}

export interface FeePayment {
  id: string;
  student_id: string;
  amount_paid: number;
  payment_date: string;
  status: string;
  fee_structures?: { name: string; amount: number };
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
  created_at: string;
}
