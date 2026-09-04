import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { ThemeProvider } from './context/ThemeContext';
import NotificationListener from './components/shared/NotificationListener';
import Login from './pages/auth/Login';
import Layout from './components/layout/Layout';
import { FeatureGuard } from './components/guards/FeatureGuard';
import AccountLockout from './components/guards/AccountLockout';
import { getRequiredFeatureForPath } from './components/layout/navConfig';
import { useTenantSettings } from './context/TenantContext';
import { useLocation, navigate, isElectron } from './components/hooks/useLocation';

import Landing from './pages/public/Landing';
import Onboarding from './pages/public/Onboarding';
import SaasAdminDashboard from './pages/saas-admin/SaasAdminDashboard';
import Billing from './pages/billing/Billing';

import SuperAdminDashboard from './pages/super-admin/Dashboard';
import Classes from './pages/super-admin/Classes';
import Subjects from './pages/super-admin/Subjects';
import AcademicYears from './pages/super-admin/AcademicYears';
import Settings from './pages/super-admin/Settings';
import SchoolSetup from './pages/super-admin/SchoolSetup';

import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherMyClasses from './pages/teacher/MyClasses';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherGrades from './pages/teacher/Grades';
import ScoreEntry from './pages/teacher/ScoreEntry';
import ClassResults from './pages/teacher/ClassResults';
import TeacherAssignments from './pages/teacher/Assignments';

import StudentAssignments from './pages/student/Assignments';
import StudentGrades from './pages/student/Grades';
import StudentAttendance from './pages/student/Attendance';
import StudentFees from './pages/student/Fees';

import ParentDashboard from './pages/parent/Dashboard';
import ParentGrades from './pages/parent/Grades';
import ParentAttendance from './pages/parent/Attendance';
import ParentFees from './pages/parent/Fees';

import AccountantDashboard from './pages/accountant/Dashboard';
import FeeStructures from './pages/accountant/FeeStructures';
import FeePayments from './pages/accountant/FeePayments';

import Announcements from './pages/shared/Announcements';
import StudentProfileView from './pages/shared/StudentProfile';
import Events from './pages/shared/Events';
import Reports from './pages/shared/Reports';
import Students from './pages/shared/Students';
import Timetable from './pages/shared/Timetable';
import GroupTimetable from './pages/shared/GroupTimetable';
import NoticeBoard from './pages/shared/NoticeBoard';
import Backup from './pages/shared/Backup';
import Notifications from './pages/shared/Notifications';

import AdmissionQuery from './pages/admin-section/AdmissionQuery';
import VisitorBook from './pages/admin-section/VisitorBook';
import Complaint from './pages/admin-section/Complaint';
import PostalReceive from './pages/admin-section/PostalReceive';
import PostalDispatch from './pages/admin-section/PostalDispatch';
import PhoneCallLog from './pages/admin-section/PhoneCallLog';
import AdminSetup from './pages/admin-section/AdminSetup';
import StudentCertificate from './pages/admin-section/StudentCertificate';
import StudentIDCard from './pages/admin-section/StudentIDCard';

import AcademicTeachers from './pages/academic/Teachers';
import Sections from './pages/academic/Sections';
import Classrooms from './pages/academic/Classrooms';
import TimeSlots from './pages/academic/TimeSlots';
import AssignSubject from './pages/academic/AssignSubject';
import AssignClassTeacher from './pages/academic/AssignClassTeacher';
import WeekDays from './pages/academic/WeekDays';


import GradeScale from './pages/exam/GradeScale';
import ExamSetup from './pages/exam/ExamSetup';
import ExamSchedule from './pages/exam/ExamSchedule';
import ExamAttendance from './pages/exam/ExamAttendance';
import AddExam from './pages/exam/AddExam';
import MarksRegister from './pages/exam/MarksRegister';
import QuestionBank from './pages/exam/QuestionBank';
import ResultsHub from './pages/exam/ResultsHub';
import AIAssistant from './pages/shared/AIAssistant';

import LeaveType from './pages/hr/LeaveType';
import LeaveDefine from './pages/hr/LeaveDefine';
import ApplyLeave from './pages/hr/ApplyLeave';
import ApproveLeave from './pages/hr/ApproveLeave';
import StaffList from './pages/hr/StaffList';
import StaffAttendance from './pages/hr/StaffAttendance';
import StaffAttendanceReport from './pages/hr/StaffAttendanceReport';
import Payroll from './pages/hr/Payroll';
import PayrollReport from './pages/hr/PayrollReport';
import StaffAssessment from './pages/hr/StaffAssessment';
import Requisition from './pages/hr/Requisition';

import ChartOfAccounts from './pages/finance/ChartOfAccounts';
import PaymentMethods from './pages/finance/PaymentMethods';
import BankAccounts from './pages/finance/BankAccounts';
import Income from './pages/finance/Income';
import Expense from './pages/finance/Expense';
import FeesGroup from './pages/finance/FeesGroup';
import FeesType from './pages/finance/FeesType';
import FeesMaster from './pages/finance/FeesMaster';
import FeesDiscount from './pages/finance/FeesDiscount';
import CollectFees from './pages/finance/CollectFees';
import FeesCarryForward from './pages/finance/FeesCarryForward';

import StudyMaterial from './pages/content/StudyMaterial';
import Syllabus from './pages/content/Syllabus';
import OtherDownloads from './pages/content/OtherDownloads';

import BookList from './pages/library/BookList';
import BookIssues from './pages/library/BookIssues';
import BookCategories from './pages/library/BookCategories';
import AddMember from './pages/library/AddMember';
import AllIssuedBooks from './pages/library/AllIssuedBooks';

import TransportRoutes from './pages/transport/Routes';
import Vehicles from './pages/transport/Vehicles';
import TransportAssignment from './pages/transport/TransportAssignment';

import DormitoryRooms from './pages/dormitory/Rooms';
import DormitoryAssignment from './pages/dormitory/DormitoryAssignment';
import RoomType from './pages/dormitory/RoomType';
import DormitoryBuildings from './pages/dormitory/DormitoryBuildings';
import DormitoryReport from './pages/dormitory/DormitoryReport';

import UploadContent from './pages/teacher/UploadContent';

import StudentAdmission from './pages/student-mgmt/StudentAdmission';
import StudentAttendanceMgmt from './pages/student-mgmt/StudentAttendance';
import StudentAttendanceReport from './pages/student-mgmt/StudentAttendanceReport';
import AttendanceOverview from './pages/student-mgmt/AttendanceOverview';

import StudentProfile from './pages/student/Profile';
import DownloadCenter from './pages/student/DownloadCenter';
import StudentExaminations from './pages/student/Examinations';
import StudentSubjects from './pages/student/SubjectList';
import StudentTeachers from './pages/student/TeacherInfo';
import StudentLibrary from './pages/student/LibraryPanel';
import StudentTransport from './pages/student/TransportPanel';
import StudentDormitory from './pages/student/DormitoryPanel';

import ParentExamResult from './pages/parent/ExamResult';
import ParentSubjects from './pages/parent/Subjects';
import ParentTeachers from './pages/parent/TeacherInfo';
import ParentTransport from './pages/parent/TransportPanel';
import ParentDormitory from './pages/parent/DormitoryPanel';

import ReportStudent from './pages/reports/StudentReport';
import ReportGuardian from './pages/reports/GuardianReports';
import ReportHistory from './pages/reports/StudentHistory';
import ReportLogin from './pages/reports/StudentLoginReport';
import ReportFees from './pages/reports/FeesStatement';
import ReportBalanceFees from './pages/reports/BalanceFeesReport';
import ReportTransactions from './pages/reports/TransactionReport';
import ReportClass from './pages/reports/ClassReport';
import ReportExamRoutine from './pages/reports/ExamRoutine';
import ReportTeacherRoutine from './pages/reports/TeacherClassRoutine';
import ReportMeritList from './pages/reports/MeritListReport';
import ReportPrincipalsList from './pages/reports/PrincipalsListReport';
import ReportOnlineExam from './pages/reports/OnlineExamReport';
import ReportMarkSheet from './pages/reports/MarkSheetReport';
import ReportTabulation from './pages/reports/TabulationSheetReport';
import ReportProgressCard from './pages/reports/ProgressCardReport';
import ReportFines from './pages/reports/StudentFineReport';
import ReportUserLog from './pages/reports/UserLog';

import AssetTracker from './pages/inventory/AssetTracker';
import AssetLocations from './pages/inventory/AssetLocations';
import AssetCategories from './pages/inventory/AssetCategories';
import IssueItem from './pages/inventory/IssueItem';

import MyProfile from './pages/hr/MyProfile';
import StaffAccommodation from './pages/hr/StaffAccommodation';
import HodReports from './pages/hr/HodReports';
import Committees from './pages/hr/Committees';
import Departments from './pages/hr/Departments';

import AdminAttendancePage from './pages/super-admin/AdminAttendancePage';
import FeeManagementPage from './pages/super-admin/FeeManagementPage';
import StaffPage from './pages/super-admin/StaffPage';

import StudentPortal from './pages/student/StudentPortal';
import ParentPortal from './pages/parent/ParentPortal';
import SecurityDashboard from './pages/security/Dashboard';
import DiocesanDashboard from './pages/diocesan/Dashboard';

import GeneralSetting from './pages/system-settings/GeneralSetting';
import Appearance from './pages/system-settings/Appearance';
import EmailSetting from './pages/system-settings/EmailSetting';
import SmsSetting from './pages/system-settings/SmsSetting';
import Holiday from './pages/system-settings/Holiday';
import Weekend from './pages/system-settings/Weekend';
import RolePermission from './pages/system-settings/RolePermission';
import UpdateSystem from './pages/system-settings/UpdateSystem';

import StudentPromote from './pages/student-mgmt/StudentPromote';
import SMSSendingTime from './pages/student-mgmt/SMSSendingTime';

import LessonPlanLessons from './pages/lesson-plan/Lessons';
import LessonPlanTopics from './pages/lesson-plan/Topics';
import LessonPlanTopicOverview from './pages/lesson-plan/TopicOverview';
import LessonPlan from './pages/lesson-plan/LessonPlan';
import LessonPlanOverview from './pages/lesson-plan/LessonPlanOverview';

import IDCardPrint from './pages/bulk-print/IDCardPrint';
import CertificatePrint from './pages/bulk-print/CertificatePrint';
import PayrollBulkPrint from './pages/bulk-print/PayrollBulkPrint';
import FeesInvoicePrint from './pages/bulk-print/FeesInvoicePrint';
import FeesInvoiceSettings from './pages/bulk-print/FeesInvoiceSettings';

import BehaviourIncidents from './pages/behaviour/Incidents';
import AssignIncident from './pages/behaviour/AssignIncident';
import StudentIncidentReport from './pages/behaviour/StudentIncidentReport';
import BehaviourReport from './pages/behaviour/BehaviourReport';
import ClassSectionReport from './pages/behaviour/ClassSectionReport';
import IncidentWiseReport from './pages/behaviour/IncidentWiseReport';
import BehaviourSettings from './pages/behaviour/BehaviourSettings';
import AffectiveDomainRating from './pages/behaviour/AffectiveDomainRating';
import PsychomotorDomainRating from './pages/behaviour/PsychomotorDomainRating';
import DomainRatingReport from './pages/behaviour/DomainRatingReport';

import StoreDashboard from './pages/store/StoreDashboard';
import StoreProducts from './pages/store/Products';
import StoreCategories from './pages/store/StoreCategories';
import StoreOrders from './pages/store/Orders';
import StoreShop from './pages/store/Shop';
import StoreMyOrders from './pages/store/MyOrders';

import MessagingInbox from './pages/messaging/Inbox';
import WhatsAppChannel from './pages/messaging/WhatsApp';
import NotificationSettings from './pages/messaging/NotificationSettings';

import AdmissionForm from './pages/admission/AdmissionForm';
import AdmissionPayment from './pages/admission/AdmissionPayment';
import ExamScheduling from './pages/admission/ExamScheduling';
import ProspectiveStudents from './pages/admission/ProspectiveStudents';
import ApplicationStatus from './pages/admission/ApplicationStatus';
import TeacherProfileView from './pages/teacher/TeacherProfileView';
import Clubs from './pages/clubs/Clubs';
import ClubDetail from './pages/clubs/ClubDetail';
import Prefects from './pages/student-mgmt/Prefects';
import Parents from './pages/student-mgmt/Parents';
import SetPassword from './pages/auth/SetPassword';
import MfaChallenge from './pages/auth/MfaChallenge';
import AccountSecurity from './pages/shared/AccountSecurity';
import Alumni from './pages/student-mgmt/Alumni';
import ActivityLogPage from './pages/admin-section/ActivityLog';

function AppContent() {
  const { user, profile, loading, signOut, passwordRecovery, mfaRequired } = useAuth();
  const { tenant } = useTenantSettings();
  const path = useLocation();

  useEffect(() => {
    if (user && profile && path === '/login') {
      navigate('/dashboard');
    }
  }, [user, profile, path]);

  const publicPaths = ['/apply', '/admission', '/admission-payment', '/schedule-exam', '/application-status', '/landing', '/onboarding'];
  if (publicPaths.includes(path)) {
    if (path === '/apply') { navigate('/admission'); return null; }
    if (path === '/admission') return <AdmissionForm />;
    if (path === '/admission-payment') return <AdmissionPayment />;
    if (path === '/schedule-exam') return <ExamScheduling />;
    if (path === '/application-status') return <ApplicationStatus />;
    if (path === '/landing') return <Landing />;
    if (path === '/onboarding') return <Onboarding />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-violet/30 border-t-brand-indigo rounded-full animate-spin mx-auto mb-4" />
          <p className="text-app-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (passwordRecovery) {
    return <SetPassword />;
  }

  if (mfaRequired) {
    return <MfaChallenge />;
  }

  if (!user || !profile) {
    if (path !== '/login') {
      if (isElectron) {
        window.location.hash = '/login';
      } else {
        window.history.replaceState({}, '', '/login');
      }
    }
    return <Login />;
  }

  const role = profile.role;

  const getPage = () => {
    switch (path) {
      case '/':
      case '/dashboard':
      case '/student-portal':
        if (role === 'student') return <StudentPortal />;
        if (role === 'super_admin' || role === 'admin' || role === 'principal') return <SuperAdminDashboard />;
        if (role === 'teacher' || role === 'head_teacher' || role === 'nur_prim_teacher' || role === 'non_teaching_staff' || role === 'matron' || role === 'porter' || role === 'cleaner' || role === 'admin_support') return <TeacherDashboard />;
        if (role === 'parent') return <ParentPortal />;
        if (role === 'accountant') return <AccountantDashboard />;
        if (role === 'security_officer') return <SecurityDashboard />;
        if (role === 'diocesan_official') return <DiocesanDashboard />;
        return <SuperAdminDashboard />;

      case '/parent-portal':
        if (role === 'parent') return <ParentPortal />;
        return <SuperAdminDashboard />;

      case '/saas-admin':
        if (!profile.is_platform_owner) return <SuperAdminDashboard />;
        return <SaasAdminDashboard />;
      case '/billing': return <Billing />;
      case '/staff': return <StaffPage />;
      case '/classes': return <Classes />;
      case '/subjects': return <Subjects />;
      case '/academic-years': return <AcademicYears />;
      case '/settings': return <Settings />;

      case '/my-classes':
        if (role === 'teacher' || role === 'principal' || role === 'head_teacher' || role === 'nur_prim_teacher') return <TeacherMyClasses />;
        return <StudentGrades />;

      case '/attendance':
        if (role === 'super_admin') return <AdminAttendancePage />;
        if (role === 'teacher' || role === 'principal' || role === 'head_teacher' || role === 'nur_prim_teacher') return <TeacherAttendance />;
        if (role === 'student') return <StudentAttendance />;
        if (role === 'parent') return <ParentAttendance />;
        return <TeacherAttendance />;

      case '/grades':
        if (role === 'teacher' || role === 'super_admin' || role === 'principal' || role === 'head_teacher' || role === 'nur_prim_teacher') return <TeacherGrades />;
        if (role === 'student') return <StudentGrades />;
        if (role === 'parent') return <ParentGrades />;
        return <TeacherGrades />;

      case '/assignments': return <TeacherAssignments />;
      case '/fee-structures': return <FeeStructures />;
      case '/fee-payments': return <FeePayments />;

      case '/fees':
        if (role === 'student') return <StudentFees />;
        if (role === 'parent') return <ParentFees />;
        return <FeePayments />;

      case '/announcements': return <Announcements />;
      case '/events': return <Events />;
      case '/reports': return <Reports />;
      case '/students': return <Students />;
      case '/fee-management': return <FeeManagementPage />;
      case '/timetable': return <Timetable />;
      case '/group-timetable': return <GroupTimetable />;
      case '/children': return <ParentDashboard />;
      case '/notice-board': return <NoticeBoard />;
      case '/backup': return <Backup />;
      case '/notifications': return <Notifications />;

      case '/admission-query': return <AdmissionQuery />;
      case '/prospective-students': return <ProspectiveStudents />;
      case '/visitor-book': return <VisitorBook />;
      case '/complaint': return <Complaint />;
      case '/postal-receive': return <PostalReceive />;
      case '/postal-dispatch': return <PostalDispatch />;
      case '/phone-call-log': return <PhoneCallLog />;
      case '/admin-setup': return <AdminSetup />;
      case '/student-certificate': return <StudentCertificate />;
      case '/student-id-card': return <StudentIDCard />;

      case '/academic/teachers': return <AcademicTeachers />;

      case '/academic/sections':
      case '/sections': return <Sections />;
      case '/academic/classrooms':
      case '/classrooms': return <Classrooms />;
      case '/academic/time-slots': return <TimeSlots />;
      case '/academic/time-setup':
      case '/class-exam-time': return <TimeSlots />;
      case '/academic/assign-subject':
      case '/assign-subject': return <AssignSubject />;
      case '/academic/assign-class-teacher':
      case '/class-teacher': return <AssignClassTeacher />;
      case '/academic/weekdays':
      case '/weekdays': return <WeekDays />;


      case '/exam/add-exam':
      case '/add-exam': return <AddExam />;
      case '/exam/grade-scale': return <GradeScale />;
      case '/exam/exam-setup': return <ExamSetup />;
      case '/exam/exam-schedule':
      case '/exam-schedule': return <ExamSchedule />;
      case '/exam/exam-attendance': return <ExamAttendance />;
      case '/exam/marks-register': return <MarksRegister />;
      case '/exam/question-bank': return <QuestionBank />;
      case '/ai-assistant': return <AIAssistant />;
      case '/exam/results':
      case '/results-hub': return <ResultsHub />;

      case '/hr/leave-type': return <LeaveType />;
      case '/hr/leave-define': return <LeaveDefine />;
      case '/hr/apply-leave': return <ApplyLeave />;
      case '/hr/approve-leave': return <ApproveLeave />;
      case '/hr/staff-list': return <StaffList />;
      case '/hr/staff-attendance': return <StaffAttendance />;
      case '/hr/staff-attendance-report': return <StaffAttendanceReport />;
      case '/hr/payroll': return <Payroll />;
      case '/hr/payroll-report': return <PayrollReport />;
      case '/hr/staff-assessment': return <StaffAssessment />;
      case '/hr/requisitions': return <Requisition />;

      case '/finance/chart-of-accounts': return <ChartOfAccounts />;
      case '/finance/payment-methods': return <PaymentMethods />;
      case '/finance/bank-accounts': return <BankAccounts />;
      case '/finance/income': return <Income />;
      case '/finance/expense': return <Expense />;
      case '/finance/fees-group': return <FeesGroup />;
      case '/finance/fees-type': return <FeesType />;
      case '/finance/fees-master': return <FeesMaster />;
      case '/finance/fees-discount': return <FeesDiscount />;
      case '/finance/collect-fees': return <CollectFees />;
      case '/finance/fees-carry-forward': return <FeesCarryForward />;

      case '/content/study-material': return <StudyMaterial />;
      case '/content/syllabus': return <Syllabus />;
      case '/content/other-downloads': return <OtherDownloads />;

      case '/library/books': return <BookList />;
      case '/library/book-issues': return <BookIssues />;
      case '/library/book-categories': return <BookCategories />;
      case '/library/members': return <AddMember />;
      case '/library/all-issued': return <AllIssuedBooks />;

      case '/transport/routes': return <TransportRoutes />;
      case '/transport/vehicles': return <Vehicles />;
      case '/transport/assignments': return <TransportAssignment />;

      case '/dormitory/rooms': return <DormitoryRooms />;
      case '/dormitory/assignments': return <DormitoryAssignment />;
      case '/dormitory/room-types': return <RoomType />;
      case '/dormitory/buildings': return <DormitoryBuildings />;
      case '/dormitory/report': return <DormitoryReport />;

      case '/inventory/assets': return <AssetTracker />;
      case '/inventory/locations': return <AssetLocations />;
      case '/inventory/asset-categories': return <AssetCategories />;
      case '/inventory/issue-item': return <IssueItem />;

      case '/my-profile': return <MyProfile />;
      case '/account-security': return <AccountSecurity />;
      case '/hr/staff-accommodation': return <StaffAccommodation />;
      case '/hr/hod-reports': return <HodReports />;
      case '/hr/committees': return <Committees />;
      case '/hr/departments': return <Departments />;

      case '/system/general': return <GeneralSetting />;
      case '/system/appearance': return <Appearance />;
      case '/system/email': return <EmailSetting />;
      case '/system/sms': return <SmsSetting />;
      case '/system/holiday': return <Holiday />;
      case '/system/weekend': return <Weekend />;
      case '/system/role-permission': return <RolePermission />;
      case '/system/update': return <UpdateSystem />;

      case '/teacher/upload-content': return <UploadContent />;
      case '/teacher/score-entry': return <ScoreEntry />;
      case '/teacher/class-results': return <ClassResults />;
      case '/student-profile': return <StudentProfileView />;
      case '/teacher-profile': return <TeacherProfileView />;

      case '/clubs': return <Clubs />;
      case '/club-detail': return <ClubDetail />;
      case '/student-mgmt/prefects': return <Prefects />;

      case '/student-mgmt/admission': return <StudentAdmission />;
      case '/student-mgmt/attendance-overview': return <AttendanceOverview />;
      case '/student-mgmt/attendance': return <StudentAttendanceMgmt />;
      case '/student-mgmt/attendance-report': return <StudentAttendanceReport />;
      case '/student-mgmt/promote': return <StudentPromote />;
      case '/student-mgmt/alumni': return <Alumni />;
      case '/parents': return <Parents />;
      case '/activity-log': return <ActivityLogPage />;
      case '/student-mgmt/sms-time': return <SMSSendingTime />;

      case '/lesson-plan/lessons': return <LessonPlanLessons />;
      case '/lesson-plan/topics': return <LessonPlanTopics />;
      case '/lesson-plan/topic-overview': return <LessonPlanTopicOverview />;
      case '/lesson-plan/plan': return <LessonPlan />;
      case '/lesson-plan/overview': return <LessonPlanOverview />;

      case '/bulk-print/id-card': return <IDCardPrint />;
      case '/bulk-print/certificate': return <CertificatePrint />;
      case '/bulk-print/payroll': return <PayrollBulkPrint />;
      case '/bulk-print/fees-invoice': return <FeesInvoicePrint />;
      case '/bulk-print/fees-invoice-settings': return <FeesInvoiceSettings />;


      case '/behaviour/incidents': return <BehaviourIncidents />;
      case '/behaviour/assign': return <AssignIncident />;
      case '/behaviour/student-report': return <StudentIncidentReport />;
      case '/behaviour/report':
      case '/behaviour/reports': return <BehaviourReport />;
      case '/behaviour/class-report': return <ClassSectionReport />;
      case '/behaviour/incident-report': return <IncidentWiseReport />;
      case '/behaviour/affective':
      case '/behaviour/affective-domain': return <AffectiveDomainRating />;
      case '/behaviour/psychomotor':
      case '/behaviour/psychomotor-domain': return <PsychomotorDomainRating />;
      case '/behaviour/domain-report': return <DomainRatingReport />;
      case '/behaviour/settings': return <BehaviourSettings />;

      case '/store': return <StoreDashboard />;
      case '/store/products': return <StoreProducts />;
      case '/store/categories': return <StoreCategories />;
      case '/store/orders': return <StoreOrders />;
      case '/store/shop': return <StoreShop />;
      case '/store/my-orders': return <StoreMyOrders />;

      case '/messaging/inbox': return <MessagingInbox />;
      case '/messaging/whatsapp': return <WhatsAppChannel />;
      case '/messaging/notifications': return <NotificationSettings />;

      case '/student/profile': return <StudentProfile />;
      case '/student/assignments': return <StudentAssignments />;
      case '/student/downloads': return <DownloadCenter />;
      case '/student/examinations': return <StudentExaminations />;
      case '/student/subjects': return <StudentSubjects />;
      case '/student/teachers': return <StudentTeachers />;
      case '/student/library': return <StudentLibrary />;
      case '/student/transport': return <StudentTransport />;
      case '/student/dormitory': return <StudentDormitory />;

      case '/parent/exam-result': return <ParentExamResult />;
      case '/parent/subjects': return <ParentSubjects />;
      case '/parent/teachers': return <ParentTeachers />;
      case '/parent/transport': return <ParentTransport />;
      case '/parent/dormitory': return <ParentDormitory />;

      case '/reports/student': return <ReportStudent />;
      case '/reports/guardian': return <ReportGuardian />;
      case '/reports/history': return <ReportHistory />;
      case '/reports/login': return <ReportLogin />;
      case '/reports/fees-statement': return <ReportFees />;
      case '/reports/balance-fees': return <ReportBalanceFees />;
      case '/reports/transactions': return <ReportTransactions />;
      case '/reports/class': return <ReportClass />;
      case '/reports/exam-routine': return <ReportExamRoutine />;
      case '/reports/teacher-routine': return <ReportTeacherRoutine />;
      case '/reports/merit-list': return <ReportMeritList />;
      case '/reports/principals-list': return <ReportPrincipalsList />;
      case '/reports/online-exam': return <ReportOnlineExam />;
      case '/reports/mark-sheet': return <ReportMarkSheet />;
      case '/reports/tabulation': return <ReportTabulation />;
      case '/reports/progress-card': return <ReportProgressCard />;
      case '/reports/fines': return <ReportFines />;
      case '/reports/user-log': return <ReportUserLog />;

      case '/login': {
        if (role === 'super_admin' || role === 'admin' || role === 'principal') return <SuperAdminDashboard />;
        if (role === 'teacher' || role === 'head_teacher') return <TeacherDashboard />;
        if (role === 'student') return <StudentPortal />;
        if (role === 'parent') return <ParentPortal />;
        if (role === 'accountant') return <AccountantDashboard />;
        if (role === 'security_officer') return <SecurityDashboard />;
        if (role === 'diocesan_official') return <DiocesanDashboard />;
        return <SuperAdminDashboard />;
      }

      default:
        if (role === 'super_admin' || role === 'admin' || role === 'principal') return <SuperAdminDashboard />;
        if (role === 'teacher' || role === 'head_teacher') return <TeacherDashboard />;
        if (role === 'student') return <StudentPortal />;
        if (role === 'parent') return <ParentPortal />;
        if (role === 'accountant') return <AccountantDashboard />;
        if (role === 'security_officer') return <SecurityDashboard />;
        if (role === 'diocesan_official') return <DiocesanDashboard />;
        return <SuperAdminDashboard />;
    }
  };

  if (!profile.school_id && role === 'super_admin' && profile.is_platform_owner) {
    return <SaasAdminDashboard />;
  }

  if (!profile.school_id && (role === 'super_admin' || role === 'admin' || role === 'principal' || role === 'head_teacher')) {
    return <SchoolSetup />;
  }

  if (!profile.school_id && role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-app-text mb-2">Account Not Configured</h2>
          <p className="text-app-text-muted text-sm mb-4">
            Your account has not been assigned to a school yet. Please contact your administrator.
          </p>
          <button onClick={signOut} className="px-4 py-2 bg-app-surface-alt text-app-text rounded-xl text-sm font-medium hover:bg-app-border transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (tenant && (tenant.status === 'suspended' || tenant.status === 'canceled')) {
    return <AccountLockout />;
  }

  const requiredFeature = getRequiredFeatureForPath(path);

  return (
    <Layout>
      <FeatureGuard feature={requiredFeature}>
        {getPage()}
      </FeatureGuard>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <ThemeProvider>
          <NotificationListener />
          <AppContent />
        </ThemeProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
