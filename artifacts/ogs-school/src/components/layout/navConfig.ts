import { Sparkles, LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, Calendar, DollarSign, Bell, Settings, School, UserCheck, BarChart2, FileText, CreditCard, BookMarked, Award, MessageCircle, BookUser, AlertCircle, Mail, MailOpen, Phone, SlidersHorizontal, ScrollText, BadgeCheck, Clock, Building, Building2, Briefcase, Receipt, TrendingUp, TrendingDown, Tag, Map, Truck, Megaphone, HardDrive, Monitor, ArrowRightLeft, Percent, Book, LayoutGrid, UserCog, CheckSquare, CalendarCheck, BarChart, Download, FolderOpen, ClipboardCheck, Globe, AtSign, MessageSquare, Umbrella, ShieldCheck, RefreshCw, Package, Store, PackagePlus, PackageCheck, ShoppingCart, ShoppingBag, Send, UserPlus, BookCopy, List, Upload, User, Activity, History, Star, Bus, Eye, Flag, Shield, Home } from 'lucide-react';
import { UserRole, PlanTier } from '../../lib/types';
import { Feature, isFeatureEnabledForPlan } from '../../lib/planFeatures';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  group?: string;
}

// ── Plan gating ────────────────────────────────────────────────────────────
// Applied in filterNavByPlan() below, independent of the (very long) role nav
// arrays further down this file. Add new gated groups/paths here rather than
// annotating every NavItem — most modules gate by nav `group` name; a few
// items need a narrower, path-specific override (e.g. the Finance group is
// split between fee-collection and full accounting).
const GROUP_FEATURE_MAP: Record<string, Feature> = {
  'HR & Leave': 'hr_payroll',
  'HR': 'hr_payroll',
  'Leave': 'hr_payroll',
  'Transport': 'transport',
  'Dormitory': 'dormitory',
  'Library': 'library_inventory_store',
  'Inventory': 'library_inventory_store',
  'Online Store': 'library_inventory_store',
  'Store': 'library_inventory_store',
  'Bulk Print': 'bulk_printing',
  'Messaging': 'sms_email_broadcasts',
  'Lesson Plan': 'lesson_plan_workflow',
  'Finance': 'payment_gateway_collections',
};

// Path-specific overrides win over the group default above.
const PATH_FEATURE_OVERRIDES: Record<string, Feature> = {
  '/finance/income': 'financial_accounting',
  '/finance/expense': 'financial_accounting',
  '/finance/bank-accounts': 'financial_accounting',
  '/finance/chart-of-accounts': 'financial_accounting',
  '/exam/question-bank': 'cbt_engine',
  '/reports/online-exam': 'cbt_engine',
};

export function filterNavByPlan(items: NavItem[], planTier?: PlanTier): NavItem[] {
  return items.filter(item => {
    const feature = PATH_FEATURE_OVERRIDES[item.path] ?? (item.group ? GROUP_FEATURE_MAP[item.group] : undefined);
    if (!feature) return true;
    return isFeatureEnabledForPlan(planTier, feature);
  });
}

const superAdminNav: NavItem[] = [
  // ── Top level (always visible) ──────────────────────────────────────────────
  { label: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'Announcements',path: '/announcements',icon: Bell },
  { label: 'Events',       path: '/events',       icon: Calendar },
  { label: 'Notice Board', path: '/notice-board', icon: Megaphone },
  { label: 'Notifications',path: '/notifications',icon: Bell },
  { label: 'My Profile',    path: '/my-profile',    icon: User },

  // ── Student Information ─────────────────────────────────────────────────────
  { label: 'Student Admission',     path: '/student-mgmt/admission',         icon: UserPlus,    group: 'Student Information' },
  { label: 'Prospective Students',  path: '/prospective-students',            icon: ClipboardCheck, group: 'Student Information' },
  { label: 'Student List',          path: '/students',                        icon: Users,       group: 'Student Information' },
  { label: 'Parents',               path: '/parents',                         icon: Users,       group: 'Student Information' },
  { label: 'Attendance Overview',   path: '/student-mgmt/attendance-overview',icon: BarChart2,   group: 'Student Information' },
  { label: 'Student Attendance',    path: '/student-mgmt/attendance',         icon: UserCheck,   group: 'Student Information' },
  { label: 'Attendance Report',     path: '/student-mgmt/attendance-report',  icon: BarChart2,   group: 'Student Information' },
  { label: 'Student Promote',       path: '/student-mgmt/promote',            icon: TrendingUp,  group: 'Student Information' },
  { label: 'School Prefects',       path: '/student-mgmt/prefects',           icon: Shield,      group: 'Student Information' },
  { label: 'Alumni',                path: '/student-mgmt/alumni',             icon: GraduationCap, group: 'Student Information' },
  { label: 'Clubs & Societies',     path: '/clubs',                           icon: Flag,        group: 'Student Information' },

  // ── Academics ────────────────────────────────────────────────────────────────
  { label: 'Classes',               path: '/classes',                     icon: GraduationCap, group: 'Academics' },
  { label: 'Subjects',              path: '/subjects',                    icon: BookOpen,      group: 'Academics' },
  { label: 'Sections',              path: '/academic/sections',           icon: LayoutGrid,    group: 'Academics' },
  { label: 'Classrooms',            path: '/academic/classrooms',         icon: Building,      group: 'Academics' },
  { label: 'Assign Subject',        path: '/academic/assign-subject',     icon: BookUser,      group: 'Academics' },
  { label: 'Form Master / Mistress',path: '/academic/assign-class-teacher',icon: UserCog,      group: 'Academics' },
  { label: 'Week Days',             path: '/academic/weekdays',           icon: CalendarCheck, group: 'Academics' },
  { label: 'Timetable',             path: '/timetable',                   icon: Calendar,      group: 'Academics' },
  { label: 'Group Timetable',       path: '/group-timetable',             icon: LayoutGrid,    group: 'Academics' },
  { label: 'Periods',               path: '/academic/time-setup',         icon: Clock,         group: 'Academics' },
  { label: 'Academic Years',        path: '/academic-years',              icon: Calendar,      group: 'Academics' },

  // ── Examination ──────────────────────────────────────────────────────────────
  { label: 'Add Exam',           path: '/exam/add-exam',         icon: FileText,      group: 'Examination' },
  { label: 'Exam Setup',         path: '/exam/exam-setup',       icon: Settings,      group: 'Examination' },
  { label: 'Exam Schedule',      path: '/exam/exam-schedule',    icon: Calendar,      group: 'Examination' },
  { label: 'Score Entry',        path: '/teacher/score-entry',   icon: Award,         group: 'Examination' },
  { label: 'Class Results',      path: '/teacher/class-results', icon: BarChart2,     group: 'Examination' },
  { label: 'Marks Register',     path: '/exam/marks-register',   icon: ClipboardList, group: 'Examination' },
  { label: 'Results Hub',        path: '/exam/results',          icon: Award,         group: 'Examination' },
  { label: 'Exam Attendance',    path: '/exam/exam-attendance',  icon: UserCheck,     group: 'Examination' },
  { label: 'Marks Grade',        path: '/exam/grade-scale',      icon: Star,          group: 'Examination' },
  { label: 'Report Cards',       path: '/reports/progress-card', icon: ScrollText,    group: 'Examination' },
  { label: 'Question Bank',      path: '/exam/question-bank',    icon: BookCopy,      group: 'Examination' },

  // ── Lesson Plan ──────────────────────────────────────────────────────────────
  { label: 'Lessons',                path: '/lesson-plan/lessons',       icon: BookOpen,      group: 'Lesson Plan' },
  { label: 'Topics',                 path: '/lesson-plan/topics',        icon: List,          group: 'Lesson Plan' },
  { label: 'Topic Overview',         path: '/lesson-plan/topic-overview',icon: Eye,           group: 'Lesson Plan' },
  { label: 'Lesson Plan',            path: '/lesson-plan/plan',          icon: ClipboardList, group: 'Lesson Plan' },
  { label: 'Lesson Plan Overview',   path: '/lesson-plan/overview',      icon: FolderOpen,    group: 'Lesson Plan' },

  // ── Content & Assignments ────────────────────────────────────────────────────
  { label: 'Upload Content',   path: '/teacher/upload-content',     icon: Upload,        group: 'Content' },
  { label: 'Assignments',      path: '/assignments',                icon: ClipboardList, group: 'Content' },
  { label: 'Study Material',   path: '/content/study-material',     icon: BookOpen,      group: 'Content' },
  { label: 'Syllabus',         path: '/content/syllabus',           icon: ScrollText,    group: 'Content' },
  { label: 'Other Downloads',  path: '/content/other-downloads',    icon: Download,      group: 'Content' },

  // ── Behaviour Records ────────────────────────────────────────────────────────
  { label: 'Incidents Types',   path: '/behaviour/incidents', icon: AlertCircle,     group: 'Behaviour' },
  { label: 'Assign Incident',   path: '/behaviour/assign',    icon: UserPlus,        group: 'Behaviour' },
  { label: 'Student Report',    path: '/behaviour/student-report', icon: User,       group: 'Behaviour' },
  { label: 'Behaviour Report',  path: '/behaviour/reports',   icon: BarChart2,       group: 'Behaviour' },
  { label: 'Class Report',      path: '/behaviour/class-report', icon: GraduationCap,group: 'Behaviour' },
  { label: 'Incident Report',   path: '/behaviour/incident-report', icon: FileText,  group: 'Behaviour' },
  { label: 'Affective Domain',  path: '/behaviour/affective', icon: Award,           group: 'Behaviour' },
  { label: 'Psychomotor Domain',path: '/behaviour/psychomotor',icon: Activity,        group: 'Behaviour' },
  { label: 'Domain Report',     path: '/behaviour/domain-report', icon: BarChart,    group: 'Behaviour' },
  { label: 'Settings',          path: '/behaviour/settings',  icon: Settings,        group: 'Behaviour' },

  // ── HR & Leave ───────────────────────────────────────────────────────────────
  { label: 'Teachers',            path: '/academic/teachers',          icon: Users,      group: 'HR & Leave' },
  { label: 'Staff List',          path: '/hr/staff-list',              icon: Briefcase,  group: 'HR & Leave' },
  { label: 'Staff Attendance',    path: '/hr/staff-attendance',        icon: UserCheck,  group: 'HR & Leave' },
  { label: 'Attendance Report',   path: '/hr/staff-attendance-report', icon: BarChart2,  group: 'HR & Leave' },
  { label: 'Leave Type',          path: '/hr/leave-type',              icon: Calendar,   group: 'HR & Leave' },
  { label: 'Leave Define',        path: '/hr/leave-define',            icon: FileText,   group: 'HR & Leave' },
  { label: 'Apply Leave',         path: '/hr/apply-leave',             icon: ClipboardList, group: 'HR & Leave' },
  { label: 'Approve Leave',       path: '/hr/approve-leave',           icon: CheckSquare, group: 'HR & Leave' },
  { label: 'Payroll',             path: '/hr/payroll',                 icon: Receipt,    group: 'HR & Leave' },
  { label: 'Payroll Report',      path: '/hr/payroll-report',          icon: BarChart,   group: 'HR & Leave' },
  { label: 'Staff Assessment',    path: '/hr/staff-assessment',        icon: ClipboardList, group: 'HR & Leave' },
  { label: 'Requisitions',          path: '/hr/requisitions',            icon: FileText,      group: 'HR & Leave' },
  { label: 'Staff Accommodation',   path: '/hr/staff-accommodation',     icon: Home,          group: 'HR & Leave' },
  { label: 'HOD Reports',           path: '/hr/hod-reports',             icon: ClipboardList, group: 'HR & Leave' },
  { label: 'Departments',           path: '/hr/departments',             icon: Building2,     group: 'HR & Leave' },
  { label: 'Committees',            path: '/hr/committees',              icon: Users,         group: 'HR & Leave' },

  // ── Finance ──────────────────────────────────────────────────────────────────
  { label: 'Collect Fees',        path: '/finance/collect-fees',         icon: DollarSign,    group: 'Finance' },
  { label: 'Fees Master',         path: '/finance/fees-master',          icon: ClipboardList, group: 'Finance' },
  { label: 'Fees Group',          path: '/finance/fees-group',           icon: FolderOpen,    group: 'Finance' },
  { label: 'Fees Type',           path: '/finance/fees-type',            icon: Tag,           group: 'Finance' },
  { label: 'Fees Discount',       path: '/finance/fees-discount',        icon: Percent,       group: 'Finance' },
  { label: 'Student Debt',         path: '/finance/fees-carry-forward',   icon: ArrowRightLeft, group: 'Finance' },
  { label: 'Fee Structures',      path: '/fee-structures',               icon: DollarSign,    group: 'Finance' },
  { label: 'Fee Payments',        path: '/fee-payments',                 icon: CreditCard,    group: 'Finance' },
  { label: 'Income',              path: '/finance/income',               icon: TrendingUp,    group: 'Finance' },
  { label: 'Expense',             path: '/finance/expense',              icon: TrendingDown,  group: 'Finance' },
  { label: 'Bank Accounts',       path: '/finance/bank-accounts',        icon: Building,      group: 'Finance' },
  { label: 'Chart of Accounts',   path: '/finance/chart-of-accounts',    icon: LayoutDashboard, group: 'Finance' },
  { label: 'Payment Methods',     path: '/finance/payment-methods',      icon: CreditCard,    group: 'Finance' },

  // ── Library ──────────────────────────────────────────────────────────────────
  { label: 'Book List',           path: '/library/books',              icon: List,      group: 'Library' },
  { label: 'Book Categories',     path: '/library/book-categories',    icon: Tag,       group: 'Library' },
  { label: 'Add Member',          path: '/library/members',            icon: UserPlus,  group: 'Library' },
  { label: 'Issue / Return Book', path: '/library/book-issues',        icon: BookMarked,group: 'Library' },
  { label: 'All Issued Books',    path: '/library/all-issued',         icon: BookCopy,  group: 'Library' },

  // ── Transport ────────────────────────────────────────────────────────────────
  { label: 'Routes',       path: '/transport/routes',      icon: Map,   group: 'Transport' },
  { label: 'Vehicles',     path: '/transport/vehicles',    icon: Truck, group: 'Transport' },
  { label: 'Assignments',  path: '/transport/assignments', icon: Users, group: 'Transport' },

  // ── Dormitory ────────────────────────────────────────────────────────────────
  { label: 'Buildings',          path: '/dormitory/buildings',    icon: School,    group: 'Dormitory' },
  { label: 'Room Types',         path: '/dormitory/room-types',   icon: LayoutGrid,group: 'Dormitory' },
  { label: 'Rooms',              path: '/dormitory/rooms',        icon: Building,  group: 'Dormitory' },
  { label: 'Assignments',        path: '/dormitory/assignments',  icon: Users,     group: 'Dormitory' },
  { label: 'Dormitory Report',   path: '/dormitory/report',       icon: BarChart2, group: 'Dormitory' },

  // ── Inventory ────────────────────────────────────────────────────────────────
  { label: 'Asset Register',     path: '/inventory/assets',           icon: Package,   group: 'Inventory' },
  { label: 'Locations & Rooms',  path: '/inventory/locations',        icon: Building,  group: 'Inventory' },
  { label: 'Asset Categories',   path: '/inventory/asset-categories', icon: Tag,       group: 'Inventory' },
  { label: 'Issue to Staff',     path: '/inventory/issue-item',       icon: ArrowRightLeft, group: 'Inventory' },

  // ── Reports ──────────────────────────────────────────────────────────────────
  { label: 'Student Report',       path: '/reports/student',        icon: Users,         group: 'Reports' },
  { label: 'Guardian Reports',     path: '/reports/guardian',       icon: User,          group: 'Reports' },
  { label: 'Student History',      path: '/reports/history',        icon: History,       group: 'Reports' },
  { label: 'Student Login Report', path: '/reports/login',          icon: Activity,      group: 'Reports' },
  { label: 'Fees Statement',       path: '/reports/fees-statement', icon: DollarSign,    group: 'Reports' },
  { label: 'Balance Fees',         path: '/reports/balance-fees',   icon: BarChart,      group: 'Reports' },
  { label: 'Transaction Report',   path: '/reports/transactions',   icon: ArrowRightLeft,group: 'Reports' },
  { label: 'Class Report',         path: '/reports/class',          icon: GraduationCap, group: 'Reports' },
  { label: 'Exam Routine',         path: '/reports/exam-routine',   icon: Calendar,      group: 'Reports' },
  { label: 'Teacher Routine',      path: '/reports/teacher-routine',icon: Clock,         group: 'Reports' },
  { label: 'Merit List',           path: '/reports/merit-list',     icon: Star,          group: 'Reports' },
  { label: "Principal's List",     path: '/reports/principals-list',icon: GraduationCap, group: 'Reports' },
  { label: 'Online Exam Report',   path: '/reports/online-exam',    icon: Monitor,       group: 'Reports' },
  { label: 'Mark Sheet',           path: '/reports/mark-sheet',     icon: FileText,      group: 'Reports' },
  { label: 'Tabulation Sheet',     path: '/reports/tabulation',     icon: List,          group: 'Reports' },
  { label: 'Progress Card',        path: '/reports/progress-card',  icon: TrendingUp,    group: 'Reports' },
  { label: 'Student Fine Report',  path: '/reports/fines',          icon: AlertCircle,   group: 'Reports' },
  { label: 'User Log',             path: '/reports/user-log',       icon: ClipboardList, group: 'Reports' },
  { label: 'Activity Log',         path: '/activity-log',           icon: Activity,      group: 'Reports' },

  // ── Admin Section ────────────────────────────────────────────────────────────
  { label: 'Admission Query',  path: '/admission-query',     icon: MessageCircle,    group: 'Admin Section' },
  { label: 'Visitor Book',     path: '/visitor-book',        icon: BookUser,         group: 'Admin Section' },
  { label: 'Complaint',        path: '/complaint',           icon: AlertCircle,      group: 'Admin Section' },
  { label: 'Postal Receive',   path: '/postal-receive',      icon: MailOpen,         group: 'Admin Section' },
  { label: 'Postal Dispatch',  path: '/postal-dispatch',     icon: Mail,             group: 'Admin Section' },
  { label: 'Phone Call Log',   path: '/phone-call-log',      icon: Phone,            group: 'Admin Section' },
  { label: 'Admin Setup',      path: '/admin-setup',         icon: SlidersHorizontal,group: 'Admin Section' },
  { label: 'Certificates',     path: '/student-certificate', icon: ScrollText,       group: 'Admin Section' },
  { label: 'ID Cards',         path: '/student-id-card',     icon: BadgeCheck,       group: 'Admin Section' },

  // ── Bulk Print ───────────────────────────────────────────────────────────────
  { label: 'ID Card Print',        path: '/bulk-print/id-card',              icon: BadgeCheck, group: 'Bulk Print' },
  { label: 'Certificate Print',    path: '/bulk-print/certificate',          icon: Award,      group: 'Bulk Print' },
  { label: 'Payroll Print',        path: '/bulk-print/payroll',              icon: Receipt,    group: 'Bulk Print' },
  { label: 'Fees Invoice Print',   path: '/bulk-print/fees-invoice',         icon: FileText,   group: 'Bulk Print' },
  { label: 'Invoice Settings',     path: '/bulk-print/fees-invoice-settings',icon: Settings,   group: 'Bulk Print' },

  // ── Online Store ─────────────────────────────────────────────────────────────
  { label: 'Store Overview',  path: '/store',            icon: ShoppingCart,  group: 'Online Store' },
  { label: 'Products',        path: '/store/products',   icon: Package,       group: 'Online Store' },
  { label: 'Categories',      path: '/store/categories', icon: Tag,           group: 'Online Store' },
  { label: 'Orders',          path: '/store/orders',     icon: ShoppingBag,   group: 'Online Store' },

  // ── Messaging ────────────────────────────────────────────────────────────────
  { label: 'Messages',              path: '/messaging/inbox',              icon: Mail,          group: 'Messaging' },
  { label: 'WhatsApp',              path: '/messaging/whatsapp',           icon: MessageCircle, group: 'Messaging' },
  { label: 'Notification Settings', path: '/messaging/notifications',      icon: Bell,          group: 'Messaging' },

  // ── System Settings (always last) ────────────────────────────────────────────
  { label: 'School Setup',         path: '/school-setup',              icon: School,       group: 'System Settings' },
  { label: 'General Setting',      path: '/system/general',            icon: Globe,        group: 'System Settings' },
  { label: 'Role Permission',      path: '/system/role-permission',    icon: ShieldCheck,  group: 'System Settings' },
  { label: 'Holiday',              path: '/system/holiday',            icon: Umbrella,     group: 'System Settings' },
  { label: 'Weekend',              path: '/system/weekend',            icon: CalendarCheck,group: 'System Settings' },
  { label: 'SMS Settings',         path: '/system/sms',                icon: MessageSquare,group: 'System Settings' },
  { label: 'Email Setting',        path: '/system/email',              icon: AtSign,       group: 'System Settings' },
  { label: 'Payment Methods',      path: '/finance/payment-methods',   icon: CreditCard,   group: 'System Settings' },
  { label: 'Backup',               path: '/backup',                    icon: HardDrive,    group: 'System Settings' },
  { label: 'Update System',        path: '/system/update',             icon: RefreshCw,    group: 'System Settings' },
];

const teacherNav: NavItem[] = [
  { label: 'Dashboard',     path: '/dashboard',               icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'My Classes',    path: '/my-classes',              icon: GraduationCap },
  { label: 'Students',      path: '/students',                icon: Users },
  { label: 'Notice Board',  path: '/notice-board',            icon: Megaphone },
  { label: 'Announcements', path: '/announcements',           icon: Bell },
  { label: 'My Profile',    path: '/my-profile',              icon: User },

  { label: 'Score Entry',      path: '/teacher/score-entry',      icon: Award,        group: 'Examination' },
  { label: 'Class Results',    path: '/teacher/class-results',    icon: BarChart2,    group: 'Examination' },
  { label: 'Results Hub',      path: '/exam/results',             icon: Award,        group: 'Examination' },
  { label: 'Question Bank',    path: '/exam/question-bank',       icon: BookCopy,     group: 'Examination' },

  { label: 'Attendance',       path: '/attendance',               icon: UserCheck,    group: 'Classroom' },
  { label: 'Timetable',        path: '/timetable',                icon: Calendar,     group: 'Classroom' },
  { label: 'Group Timetable', path: '/group-timetable',          icon: LayoutGrid,   group: 'Classroom' },

  { label: 'Assignments',     path: '/assignments',             icon: ClipboardList,group: 'Content' },
  { label: 'Study Material',  path: '/content/study-material',  icon: BookOpen,    group: 'Content' },
  { label: 'Syllabus',        path: '/content/syllabus',        icon: ScrollText,  group: 'Content' },

  { label: 'Apply Leave',      path: '/hr/apply-leave',       icon: ClipboardList, group: 'HR' },
  { label: 'Staff Assessment', path: '/hr/staff-assessment',  icon: ClipboardList, group: 'HR' },
  { label: 'Requisitions',     path: '/hr/requisitions',      icon: FileText,      group: 'HR' },
  { label: 'HOD Reports',      path: '/hr/hod-reports',       icon: ClipboardList, group: 'HR' },
  { label: 'My Department',    path: '/hr/departments',       icon: Building2,     group: 'HR' },
  { label: 'My Committees',    path: '/hr/committees',        icon: Users,         group: 'HR' },

  { label: 'Complaint',         path: '/complaint',              icon: AlertCircle, group: 'Admin' },

  { label: 'Clubs & Societies', path: '/clubs',                  icon: Flag,    group: 'Student Life' },
  { label: 'School Prefects',   path: '/student-mgmt/prefects',  icon: Shield,  group: 'Student Life' },

  { label: 'Assign Incident',   path: '/behaviour/assign',    icon: UserPlus,        group: 'Behaviour' },
  { label: 'Student Report',    path: '/behaviour/student-report', icon: User,       group: 'Behaviour' },
  { label: 'Behaviour Report',  path: '/behaviour/reports',   icon: BarChart2,       group: 'Behaviour' },
];

const studentNav: NavItem[] = [
  { label: 'Dashboard',    path: '/dashboard',          icon: LayoutDashboard },
  { label: 'Profile',      path: '/student/profile',    icon: User },
  { label: 'Notice Board', path: '/notice-board',       icon: Megaphone },

  { label: 'Attendance',    path: '/attendance',              icon: UserCheck,  group: 'Academics' },
  { label: 'Subjects',      path: '/student/subjects',        icon: BookOpen,   group: 'Academics' },
  { label: 'Assignments',   path: '/student/assignments',     icon: ClipboardList, group: 'Academics' },
  { label: 'Downloads',     path: '/student/downloads',       icon: Download,   group: 'Academics' },

  { label: 'Examinations', path: '/student/examinations', icon: Award,    group: 'Examination' },
  { label: 'Results',      path: '/grades',               icon: ScrollText, group: 'Examination' },

  { label: 'Fees',      path: '/fees',               icon: DollarSign, group: 'Finance' },

  { label: 'Teachers',   path: '/student/teachers', icon: Users,    group: 'Info' },
  { label: 'Library',    path: '/student/library',  icon: Book,     group: 'Info' },
  { label: 'Transport',  path: '/student/transport',icon: Bus,      group: 'Info' },
  { label: 'Dormitory',  path: '/student/dormitory',icon: Building, group: 'Info' },

  { label: 'School Store', path: '/store/shop', icon: ShoppingCart, group: 'Store' },
  { label: 'My Orders',    path: '/store/my-orders', icon: ShoppingBag, group: 'Store' },
];

const parentNav: NavItem[] = [
  { label: 'Dashboard',   path: '/dashboard', icon: LayoutDashboard },
  { label: 'My Children', path: '/children',  icon: Users },
  { label: 'Notice Board',path: '/notice-board', icon: Megaphone },

  { label: 'Attendance',    path: '/attendance',             icon: UserCheck,     group: 'Academics' },
  { label: 'Subjects',      path: '/parent/subjects',        icon: BookOpen,      group: 'Academics' },

  { label: 'Exam Result', path: '/parent/exam-result', icon: Award, group: 'Examination' },

  { label: 'Fees', path: '/fees', icon: DollarSign, group: 'Finance' },

  { label: 'Teachers',   path: '/parent/teachers',  icon: Users,    group: 'Info' },
  { label: 'Transport',  path: '/parent/transport', icon: Bus,      group: 'Info' },
  { label: 'Dormitory',  path: '/parent/dormitory', icon: Building, group: 'Info' },

  { label: 'School Store', path: '/store/shop',       icon: ShoppingCart, group: 'Store' },
  { label: 'My Orders',    path: '/store/my-orders',  icon: ShoppingBag,  group: 'Store' },
];

const securityOfficerNav: NavItem[] = [
  // ── Top level ────────────────────────────────────────────────────────────────
  { label: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'Notice Board', path: '/notice-board', icon: Megaphone },
  { label: 'Announcements',path: '/announcements',icon: Bell },
  { label: 'My Profile',   path: '/my-profile',   icon: User },

  // ── Campus Security ───────────────────────────────────────────────────────────
  { label: 'Visitor Book',    path: '/visitor-book',     icon: BookUser,      group: 'Campus Security' },
  { label: 'Complaint Log',   path: '/complaint',        icon: AlertCircle,   group: 'Campus Security' },
  { label: 'Phone Call Log',  path: '/phone-call-log',   icon: Phone,         group: 'Campus Security' },

  // ── Students ──────────────────────────────────────────────────────────────────
  { label: 'Student List',    path: '/students',                    icon: Users,    group: 'Students' },
  { label: 'School Prefects', path: '/student-mgmt/prefects',       icon: Shield,   group: 'Students' },
  { label: 'Clubs & Societies',path: '/clubs',                      icon: Flag,     group: 'Students' },

  // ── Behaviour ─────────────────────────────────────────────────────────────────
  { label: 'Assign Incident',  path: '/behaviour/assign',          icon: UserPlus,  group: 'Behaviour' },
  { label: 'Student Report',   path: '/behaviour/student-report',  icon: User,      group: 'Behaviour' },
  { label: 'Behaviour Report', path: '/behaviour/reports',         icon: BarChart2, group: 'Behaviour' },

  // ── Staff & Facilities ────────────────────────────────────────────────────────
  { label: 'Staff Attendance',  path: '/hr/staff-attendance',     icon: UserCheck, group: 'Staff & Facilities' },
  { label: 'Transport',         path: '/transport/assignments',   icon: Truck,     group: 'Staff & Facilities' },
  { label: 'Dormitory Report',  path: '/dormitory/report',        icon: Building,  group: 'Staff & Facilities' },
];

const accountantNav: NavItem[] = [
  { label: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'Students',     path: '/students',     icon: Users },
  { label: 'Announcements',path: '/announcements',icon: Bell },
  { label: 'My Profile',   path: '/my-profile',   icon: User },

  { label: 'Collect Fees',      path: '/finance/collect-fees',       icon: DollarSign,      group: 'Finance' },
  { label: 'Fees Master',       path: '/finance/fees-master',        icon: ClipboardList,   group: 'Finance' },
  { label: 'Fees Group',        path: '/finance/fees-group',         icon: FolderOpen,      group: 'Finance' },
  { label: 'Fees Type',         path: '/finance/fees-type',          icon: Tag,             group: 'Finance' },
  { label: 'Fees Discount',     path: '/finance/fees-discount',      icon: Percent,         group: 'Finance' },
  { label: 'Student Debt',      path: '/finance/fees-carry-forward', icon: ArrowRightLeft,  group: 'Finance' },
  { label: 'Fee Structures',    path: '/fee-structures',             icon: DollarSign,      group: 'Finance' },
  { label: 'Fee Payments',      path: '/fee-payments',               icon: CreditCard,      group: 'Finance' },
  { label: 'Income',            path: '/finance/income',             icon: TrendingUp,      group: 'Finance' },
  { label: 'Expense',           path: '/finance/expense',            icon: TrendingDown,    group: 'Finance' },
  { label: 'Bank Accounts',     path: '/finance/bank-accounts',      icon: Building,        group: 'Finance' },
  { label: 'Chart of Accounts', path: '/finance/chart-of-accounts',  icon: LayoutDashboard, group: 'Finance' },
  { label: 'Payment Methods',   path: '/finance/payment-methods',    icon: CreditCard,      group: 'Finance' },
  { label: 'Reports',           path: '/reports',                    icon: BarChart2,       group: 'Finance' },
  { label: 'Requisitions',      path: '/hr/requisitions',            icon: FileText,        group: 'Finance' },

  { label: 'Academic Years', path: '/academic-years', icon: Calendar, group: 'Settings' },
];

const principalNav: NavItem[] = [
  // ── Top level ───────────────────────────────────────────────────────────────
  { label: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'Announcements', path: '/announcements', icon: Bell },
  { label: 'Events',        path: '/events',        icon: Calendar },
  { label: 'Notice Board',  path: '/notice-board',  icon: Megaphone },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'My Profile',    path: '/my-profile',    icon: User },

  // ── Student Information ──────────────────────────────────────────────────────
  { label: 'Student Admission',    path: '/student-mgmt/admission',        icon: UserPlus,       group: 'Student Information' },
  { label: 'Student List',         path: '/students',                       icon: Users,          group: 'Student Information' },
  { label: 'Parents',              path: '/parents',                        icon: Users,          group: 'Student Information' },
  { label: 'Attendance Overview',  path: '/student-mgmt/attendance-overview',icon: BarChart2,     group: 'Student Information' },
  { label: 'Student Attendance',   path: '/student-mgmt/attendance',        icon: UserCheck,      group: 'Student Information' },
  { label: 'Attendance Report',    path: '/student-mgmt/attendance-report', icon: BarChart2,      group: 'Student Information' },
  { label: 'Student Promote',      path: '/student-mgmt/promote',           icon: TrendingUp,     group: 'Student Information' },
  { label: 'School Prefects',      path: '/student-mgmt/prefects',          icon: Shield,         group: 'Student Information' },
  { label: 'Alumni',               path: '/student-mgmt/alumni',            icon: GraduationCap,  group: 'Student Information' },
  { label: 'Clubs & Societies',    path: '/clubs',                          icon: Flag,           group: 'Student Information' },

  // ── Academics ─────────────────────────────────────────────────────────────────
  { label: 'Classes',               path: '/classes',                     icon: GraduationCap, group: 'Academics' },
  { label: 'Subjects',              path: '/subjects',                    icon: BookOpen,      group: 'Academics' },
  { label: 'Assign Subject',        path: '/academic/assign-subject',     icon: BookUser,      group: 'Academics' },
  { label: 'Form Master / Mistress',path: '/academic/assign-class-teacher',icon: UserCog,      group: 'Academics' },
  { label: 'Timetable',             path: '/timetable',                   icon: Calendar,      group: 'Academics' },
  { label: 'Group Timetable',       path: '/group-timetable',             icon: LayoutGrid,    group: 'Academics' },
  { label: 'Academic Years',        path: '/academic-years',              icon: Calendar,      group: 'Academics' },

  // ── Classroom (teacher-mode) ──────────────────────────────────────────────────
  { label: 'My Classes',   path: '/my-classes',             icon: GraduationCap, group: 'Classroom' },
  { label: 'Attendance',   path: '/attendance',             icon: UserCheck,     group: 'Classroom' },

  // ── Examination ──────────────────────────────────────────────────────────────
  { label: 'Add Exam',      path: '/exam/add-exam',         icon: FileText,      group: 'Examination' },
  { label: 'Exam Setup',    path: '/exam/exam-setup',       icon: Settings,      group: 'Examination' },
  { label: 'Exam Schedule', path: '/exam/exam-schedule',    icon: Calendar,      group: 'Examination' },
  { label: 'Score Entry',   path: '/teacher/score-entry',   icon: Award,         group: 'Examination' },
  { label: 'Class Results', path: '/teacher/class-results', icon: BarChart2,     group: 'Examination' },
  { label: 'Marks Register',path: '/exam/marks-register',   icon: ClipboardList, group: 'Examination' },
  { label: 'Results Hub',   path: '/exam/results',          icon: Award,         group: 'Examination' },
  { label: 'Exam Attendance',path: '/exam/exam-attendance', icon: UserCheck,     group: 'Examination' },
  { label: 'Marks Grade',   path: '/exam/grade-scale',      icon: Star,          group: 'Examination' },
  { label: 'Report Cards',  path: '/reports/progress-card', icon: ScrollText,    group: 'Examination' },

  // ── Content & Assignments ────────────────────────────────────────────────────
  { label: 'Assignments',     path: '/assignments',             icon: ClipboardList, group: 'Content' },
  { label: 'Study Material',  path: '/content/study-material',  icon: BookOpen,      group: 'Content' },
  { label: 'Syllabus',        path: '/content/syllabus',        icon: ScrollText,    group: 'Content' },
  { label: 'Other Downloads', path: '/content/other-downloads', icon: Download,      group: 'Content' },

  // ── Behaviour Records ────────────────────────────────────────────────────────
  { label: 'Incidents Types',  path: '/behaviour/incidents',       icon: AlertCircle, group: 'Behaviour' },
  { label: 'Assign Incident',  path: '/behaviour/assign',          icon: UserPlus,    group: 'Behaviour' },
  { label: 'Student Report',   path: '/behaviour/student-report',  icon: User,        group: 'Behaviour' },
  { label: 'Behaviour Report', path: '/behaviour/reports',         icon: BarChart2,   group: 'Behaviour' },
  { label: 'Class Report',     path: '/behaviour/class-report',    icon: GraduationCap, group: 'Behaviour' },
  { label: 'Affective Domain', path: '/behaviour/affective',       icon: Award,       group: 'Behaviour' },
  { label: 'Psychomotor Domain',path: '/behaviour/psychomotor',    icon: Activity,    group: 'Behaviour' },
  { label: 'Domain Report',    path: '/behaviour/domain-report',   icon: BarChart,    group: 'Behaviour' },

  // ── HR & Leave ───────────────────────────────────────────────────────────────
  { label: 'Teachers',          path: '/academic/teachers',          icon: Users,         group: 'HR & Leave' },
  { label: 'Staff List',        path: '/hr/staff-list',              icon: Briefcase,     group: 'HR & Leave' },
  { label: 'Staff Attendance',  path: '/hr/staff-attendance',        icon: UserCheck,     group: 'HR & Leave' },
  { label: 'Attendance Report', path: '/hr/staff-attendance-report', icon: BarChart2,     group: 'HR & Leave' },
  { label: 'Leave Type',        path: '/hr/leave-type',              icon: Calendar,      group: 'HR & Leave' },
  { label: 'Leave Define',      path: '/hr/leave-define',            icon: FileText,      group: 'HR & Leave' },
  { label: 'Apply Leave',       path: '/hr/apply-leave',             icon: ClipboardList, group: 'HR & Leave' },
  { label: 'Approve Leave',     path: '/hr/approve-leave',           icon: CheckSquare,   group: 'HR & Leave' },
  { label: 'Payroll',           path: '/hr/payroll',                 icon: Receipt,       group: 'HR & Leave' },
  { label: 'Payroll Report',    path: '/hr/payroll-report',          icon: BarChart,      group: 'HR & Leave' },
  { label: 'Staff Assessment',    path: '/hr/staff-assessment',        icon: ClipboardList, group: 'HR & Leave' },
  { label: 'Requisitions',        path: '/hr/requisitions',            icon: FileText,      group: 'HR & Leave' },
  { label: 'Staff Accommodation', path: '/hr/staff-accommodation',     icon: Home,          group: 'HR & Leave' },
  { label: 'HOD Reports',         path: '/hr/hod-reports',             icon: ClipboardList, group: 'HR & Leave' },
  { label: 'Departments',         path: '/hr/departments',             icon: Building2,     group: 'HR & Leave' },
  { label: 'Committees',          path: '/hr/committees',              icon: Users,         group: 'HR & Leave' },

  // ── Finance (oversight) ──────────────────────────────────────────────────────
  { label: 'Collect Fees',  path: '/finance/collect-fees', icon: DollarSign,    group: 'Finance' },
  { label: 'Fee Structures',path: '/fee-structures',       icon: DollarSign,    group: 'Finance' },
  { label: 'Fee Payments',  path: '/fee-payments',         icon: CreditCard,    group: 'Finance' },
  { label: 'Income',        path: '/finance/income',       icon: TrendingUp,    group: 'Finance' },
  { label: 'Expense',       path: '/finance/expense',      icon: TrendingDown,  group: 'Finance' },

  // ── Reports ──────────────────────────────────────────────────────────────────
  { label: 'Student Report',  path: '/reports/student',       icon: Users,         group: 'Reports' },
  { label: 'Fees Statement',  path: '/reports/fees-statement',icon: DollarSign,    group: 'Reports' },
  { label: 'Balance Fees',    path: '/reports/balance-fees',  icon: BarChart,      group: 'Reports' },
  { label: 'Class Report',    path: '/reports/class',         icon: GraduationCap, group: 'Reports' },
  { label: 'Exam Routine',    path: '/reports/exam-routine',  icon: Calendar,      group: 'Reports' },
  { label: 'Merit List',       path: '/reports/merit-list',      icon: Star,          group: 'Reports' },
  { label: "Principal's List", path: '/reports/principals-list', icon: GraduationCap, group: 'Reports' },
  { label: 'Mark Sheet',       path: '/reports/mark-sheet',      icon: FileText,      group: 'Reports' },
  { label: 'Tabulation Sheet', path: '/reports/tabulation',      icon: List,          group: 'Reports' },
  { label: 'Progress Card',    path: '/reports/progress-card',   icon: TrendingUp,    group: 'Reports' },
  { label: 'Activity Log',     path: '/activity-log',            icon: Activity,      group: 'Reports' },

  // ── Admin Section ────────────────────────────────────────────────────────────
  { label: 'Admission Query', path: '/admission-query',   icon: MessageCircle,     group: 'Admin Section' },
  { label: 'Visitor Book',    path: '/visitor-book',      icon: BookUser,          group: 'Admin Section' },
  { label: 'Complaint',       path: '/complaint',         icon: AlertCircle,       group: 'Admin Section' },
  { label: 'Postal Receive',  path: '/postal-receive',    icon: MailOpen,          group: 'Admin Section' },
  { label: 'Postal Dispatch', path: '/postal-dispatch',   icon: Mail,              group: 'Admin Section' },
  { label: 'Phone Call Log',  path: '/phone-call-log',    icon: Phone,             group: 'Admin Section' },
  { label: 'Certificates',    path: '/student-certificate',icon: ScrollText,       group: 'Admin Section' },
  { label: 'ID Cards',        path: '/student-id-card',   icon: BadgeCheck,        group: 'Admin Section' },

  // ── Messaging ────────────────────────────────────────────────────────────────
  { label: 'Messages',              path: '/messaging/inbox',         icon: Mail,          group: 'Messaging' },
  { label: 'WhatsApp',              path: '/messaging/whatsapp',      icon: MessageCircle, group: 'Messaging' },
  { label: 'Notification Settings', path: '/messaging/notifications', icon: Bell,          group: 'Messaging' },

  // ── System Settings (limited) ─────────────────────────────────────────────────
  { label: 'School Setup', path: '/school-setup',   icon: School,       group: 'System Settings' },
  { label: 'Holiday',      path: '/system/holiday', icon: Umbrella,     group: 'System Settings' },
  { label: 'Weekend',      path: '/system/weekend', icon: CalendarCheck, group: 'System Settings' },
];

const headTeacherNav: NavItem[] = [
  // ── Top level ───────────────────────────────────────────────────────────────
  { label: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'Announcements', path: '/announcements', icon: Bell },
  { label: 'Events',        path: '/events',        icon: Calendar },
  { label: 'Notice Board',  path: '/notice-board',  icon: Megaphone },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'My Profile',    path: '/my-profile',    icon: User },

  // ── Student Information (view) ───────────────────────────────────────────────
  { label: 'Student List',         path: '/students',                        icon: Users,          group: 'Student Information' },
  { label: 'Parents',              path: '/parents',                         icon: Users,          group: 'Student Information' },
  { label: 'Attendance Overview',  path: '/student-mgmt/attendance-overview',icon: BarChart2,      group: 'Student Information' },
  { label: 'Student Attendance',   path: '/student-mgmt/attendance',         icon: UserCheck,      group: 'Student Information' },
  { label: 'Attendance Report',    path: '/student-mgmt/attendance-report',  icon: BarChart2,      group: 'Student Information' },
  { label: 'School Prefects',      path: '/student-mgmt/prefects',           icon: Shield,         group: 'Student Information' },
  { label: 'Clubs & Societies',    path: '/clubs',                           icon: Flag,           group: 'Student Information' },

  // ── Academics (school-wide view) ─────────────────────────────────────────────
  { label: 'Classes',               path: '/classes',                     icon: GraduationCap, group: 'Academics' },
  { label: 'Subjects',              path: '/subjects',                    icon: BookOpen,      group: 'Academics' },
  { label: 'Assign Subject',        path: '/academic/assign-subject',     icon: BookUser,      group: 'Academics' },
  { label: 'Form Master / Mistress',path: '/academic/assign-class-teacher',icon: UserCog,      group: 'Academics' },
  { label: 'Timetable',             path: '/timetable',                   icon: Calendar,      group: 'Academics' },
  { label: 'Group Timetable',       path: '/group-timetable',             icon: LayoutGrid,    group: 'Academics' },

  // ── Classroom ─────────────────────────────────────────────────────────────────
  { label: 'My Classes',   path: '/my-classes',             icon: GraduationCap, group: 'Classroom' },
  { label: 'Attendance',   path: '/attendance',             icon: UserCheck,     group: 'Classroom' },

  // ── Examination (school-wide) ────────────────────────────────────────────────
  { label: 'Add Exam',      path: '/exam/add-exam',         icon: FileText,      group: 'Examination' },
  { label: 'Exam Setup',    path: '/exam/exam-setup',       icon: Settings,      group: 'Examination' },
  { label: 'Exam Schedule', path: '/exam/exam-schedule',    icon: Calendar,      group: 'Examination' },
  { label: 'Score Entry',   path: '/teacher/score-entry',   icon: Award,         group: 'Examination' },
  { label: 'Class Results', path: '/teacher/class-results', icon: BarChart2,     group: 'Examination' },
  { label: 'Marks Register',path: '/exam/marks-register',   icon: ClipboardList, group: 'Examination' },
  { label: 'Results Hub',   path: '/exam/results',          icon: Award,         group: 'Examination' },
  { label: 'Exam Attendance',path: '/exam/exam-attendance', icon: UserCheck,     group: 'Examination' },
  { label: 'Marks Grade',   path: '/exam/grade-scale',      icon: Star,          group: 'Examination' },
  { label: 'Report Cards',  path: '/reports/progress-card', icon: ScrollText,    group: 'Examination' },
  { label: 'Question Bank', path: '/exam/question-bank',    icon: BookCopy,      group: 'Examination' },

  // ── Lesson Plan ──────────────────────────────────────────────────────────────
  { label: 'Lessons',                path: '/lesson-plan/lessons',       icon: BookOpen,      group: 'Lesson Plan' },
  { label: 'Topics',                 path: '/lesson-plan/topics',        icon: List,          group: 'Lesson Plan' },
  { label: 'Lesson Plan',            path: '/lesson-plan/plan',          icon: ClipboardList, group: 'Lesson Plan' },
  { label: 'Lesson Plan Overview',   path: '/lesson-plan/overview',      icon: FolderOpen,    group: 'Lesson Plan' },

  // ── Content & Assignments ────────────────────────────────────────────────────
  { label: 'Upload Content',   path: '/teacher/upload-content',     icon: Upload,        group: 'Content' },
  { label: 'Assignments',      path: '/assignments',                icon: ClipboardList, group: 'Content' },
  { label: 'Study Material',   path: '/content/study-material',     icon: BookOpen,      group: 'Content' },
  { label: 'Syllabus',         path: '/content/syllabus',           icon: ScrollText,    group: 'Content' },
  { label: 'Other Downloads',  path: '/content/other-downloads',    icon: Download,      group: 'Content' },

  // ── Behaviour Records ────────────────────────────────────────────────────────
  { label: 'Incidents Types',  path: '/behaviour/incidents',       icon: AlertCircle,   group: 'Behaviour' },
  { label: 'Assign Incident',  path: '/behaviour/assign',          icon: UserPlus,      group: 'Behaviour' },
  { label: 'Student Report',   path: '/behaviour/student-report',  icon: User,          group: 'Behaviour' },
  { label: 'Behaviour Report', path: '/behaviour/reports',         icon: BarChart2,     group: 'Behaviour' },
  { label: 'Class Report',     path: '/behaviour/class-report',    icon: GraduationCap, group: 'Behaviour' },
  { label: 'Affective Domain', path: '/behaviour/affective',       icon: Award,         group: 'Behaviour' },
  { label: 'Psychomotor Domain',path: '/behaviour/psychomotor',    icon: Activity,      group: 'Behaviour' },
  { label: 'Domain Report',    path: '/behaviour/domain-report',   icon: BarChart,      group: 'Behaviour' },

  // ── HR (view) ────────────────────────────────────────────────────────────────
  { label: 'Teachers',          path: '/academic/teachers',          icon: Users,         group: 'HR' },
  { label: 'Staff List',        path: '/hr/staff-list',              icon: Briefcase,     group: 'HR' },

  { label: 'Apply Leave',         path: '/hr/apply-leave',             icon: ClipboardList, group: 'HR' },
  { label: 'Requisitions',        path: '/hr/requisitions',            icon: FileText,      group: 'HR' },
  { label: 'Staff Accommodation', path: '/hr/staff-accommodation',     icon: Home,          group: 'HR' },
  { label: 'HOD Reports',         path: '/hr/hod-reports',             icon: ClipboardList, group: 'HR' },
  { label: 'Departments',         path: '/hr/departments',             icon: Building2,     group: 'HR' },
  { label: 'Committees',          path: '/hr/committees',              icon: Users,         group: 'HR' },

  // ── Reports ──────────────────────────────────────────────────────────────────
  { label: 'Student Report',  path: '/reports/student',       icon: Users,         group: 'Reports' },
  { label: 'Class Report',    path: '/reports/class',         icon: GraduationCap, group: 'Reports' },
  { label: 'Exam Routine',    path: '/reports/exam-routine',  icon: Calendar,      group: 'Reports' },
  { label: 'Merit List',      path: '/reports/merit-list',    icon: Star,          group: 'Reports' },
  { label: 'Mark Sheet',      path: '/reports/mark-sheet',    icon: FileText,      group: 'Reports' },
  { label: 'Tabulation Sheet',path: '/reports/tabulation',    icon: List,          group: 'Reports' },
  { label: 'Progress Card',   path: '/reports/progress-card', icon: TrendingUp,    group: 'Reports' },

  // ── Messaging ────────────────────────────────────────────────────────────────
  { label: 'Messages',              path: '/messaging/inbox',         icon: Mail,          group: 'Messaging' },
];

const diocesanOfficialNav: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },

  // ── Inventory ────────────────────────────────────────────────────────────────
  { label: 'Asset Register',    path: '/inventory/assets',           icon: Package,  group: 'Inventory' },
  { label: 'Locations & Rooms', path: '/inventory/locations',        icon: Building, group: 'Inventory' },
  { label: 'Asset Categories',  path: '/inventory/asset-categories', icon: Tag,      group: 'Inventory' },

  // ── Reports ──────────────────────────────────────────────────────────────────
  { label: 'Student Report',       path: '/reports/student',        icon: Users,          group: 'Reports' },
  { label: 'Guardian Reports',     path: '/reports/guardian',       icon: User,           group: 'Reports' },
  { label: 'Student History',      path: '/reports/history',        icon: History,        group: 'Reports' },
  { label: 'Student Login Report', path: '/reports/login',          icon: Activity,       group: 'Reports' },
  { label: 'Fees Statement',       path: '/reports/fees-statement', icon: DollarSign,     group: 'Reports' },
  { label: 'Balance Fees',         path: '/reports/balance-fees',   icon: BarChart,       group: 'Reports' },
  { label: 'Transaction Report',   path: '/reports/transactions',   icon: ArrowRightLeft, group: 'Reports' },
  { label: 'Class Report',         path: '/reports/class',          icon: GraduationCap,  group: 'Reports' },
  { label: 'Exam Routine',         path: '/reports/exam-routine',   icon: Calendar,       group: 'Reports' },
  { label: 'Teacher Routine',      path: '/reports/teacher-routine',icon: Clock,          group: 'Reports' },
  { label: 'Merit List',           path: '/reports/merit-list',     icon: Star,           group: 'Reports' },
  { label: 'Online Exam Report',   path: '/reports/online-exam',    icon: Monitor,        group: 'Reports' },
  { label: 'Mark Sheet',           path: '/reports/mark-sheet',     icon: FileText,       group: 'Reports' },
  { label: 'Tabulation Sheet',     path: '/reports/tabulation',     icon: List,           group: 'Reports' },
  { label: 'Progress Card',        path: '/reports/progress-card',  icon: TrendingUp,     group: 'Reports' },
  { label: 'Student Fine Report',  path: '/reports/fines',          icon: AlertCircle,    group: 'Reports' },
  { label: 'User Log',             path: '/reports/user-log',       icon: ClipboardList,  group: 'Reports' },
];

const nurPrimTeacherNav: NavItem[] = teacherNav;

const nonTeachingStaffNav: NavItem[] = [
  { label: 'Dashboard',     path: '/dashboard',          icon: LayoutDashboard },
  { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
  { label: 'Notice Board',  path: '/notice-board',       icon: Megaphone },
  { label: 'Announcements', path: '/announcements',      icon: Bell },
  { label: 'My Profile',    path: '/my-profile',         icon: User },
  { label: 'Apply Leave',      path: '/hr/apply-leave',      icon: ClipboardList, group: 'Leave' },
  { label: 'Staff Assessment', path: '/hr/staff-assessment', icon: ClipboardList, group: 'Leave' },
  { label: 'Requisitions',     path: '/hr/requisitions',     icon: FileText,      group: 'Leave' },
  { label: 'Complaint',        path: '/complaint',            icon: AlertCircle,   group: 'Admin' },
];

export function getNavItems(role?: UserRole, planTier?: PlanTier): NavItem[] {
  // Whole-role gates: these roles only exist as Enterprise-tier modules
  // (Campus Security / Multi-Branch oversight), so on a lower plan they fall
  // back to just a Dashboard link rather than disappearing entirely.
  if (role === 'security_officer' && !isFeatureEnabledForPlan(planTier, 'campus_security')) {
    return [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }];
  }
  if (role === 'diocesan_official' && !isFeatureEnabledForPlan(planTier, 'multi_branch')) {
    return [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }];
  }

  const items = (() => {
    switch (role) {
      case 'super_admin':
      case 'admin': return superAdminNav;
      case 'principal': return principalNav;
      case 'head_teacher': return headTeacherNav;
      case 'teacher': return teacherNav;
      case 'nur_prim_teacher': return nurPrimTeacherNav;
      case 'non_teaching_staff':
      case 'matron':
      case 'porter':
      case 'cleaner':
      case 'admin_support': return nonTeachingStaffNav;
      case 'student': return studentNav;
      case 'parent': return parentNav;
      case 'accountant': return accountantNav;
      case 'security_officer': return securityOfficerNav;
      case 'diocesan_official': return diocesanOfficialNav;
      default: return [];
    }
  })();

  return filterNavByPlan(items, planTier);
}

// path -> group, merged across every role's nav array, for route-level
// enforcement. filterNavByPlan only ever hides nav *links* -- it never
// stopped someone from typing a gated URL directly, so App.tsx looks up
// getRequiredFeatureForPath(path) and enforces it with <FeatureGuard> around
// the actual page render, independent of which nav (if any) links to it.
const PATH_TO_GROUP: Record<string, string> = {};
for (const items of [
  superAdminNav, teacherNav, studentNav, parentNav, securityOfficerNav,
  accountantNav, principalNav, headTeacherNav, diocesanOfficialNav,
  nonTeachingStaffNav,
]) {
  for (const item of items) {
    if (item.group && !(item.path in PATH_TO_GROUP)) PATH_TO_GROUP[item.path] = item.group;
  }
}

export function getRequiredFeatureForPath(path: string): Feature | undefined {
  return PATH_FEATURE_OVERRIDES[path] ?? (PATH_TO_GROUP[path] ? GROUP_FEATURE_MAP[PATH_TO_GROUP[path]] : undefined);
}
