import { useEffect, useState } from 'react';
import { Users, BookOpen, ClipboardList, UserCheck, CheckCircle, Clock, GraduationCap, AlertCircle, BarChart2 } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';
import TodoWidget from '../../components/dashboard/TodoWidget';
import TeacherTimetable from './TeacherTimetable';
import { cache } from '../../utils/cache';

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const [stats, setStats] = useState({ subjects: 0, students: 0, assignments: 0, attendance: 0 });
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [myClass, setMyClass] = useState<any>(null);
  const [classPendingSubjects, setClassPendingSubjects] = useState<any[]>([]);
  const [classStudentCount, setClassStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const today = new Date().toISOString().split('T')[0];

      // Fetch current academic year and term first (cached for 1 day)
      const yearId = await cache.fetch('current_academic_year_id', async () => {
        const { data } = await supabase.from('academic_years').select('id').eq('school_id', profile.school_id ?? '').eq('is_current', true).maybeSingle();
        return data?.id;
      }, 86400000);

      let termId: string | undefined;
      if (yearId) {
        termId = await cache.fetch(`current_term_id_${yearId}`, async () => {
          const { data } = await supabase
            .from('academic_year_terms')
            .select('term_id')
            .eq('academic_year_id', yearId)
            .eq('is_current', true)
            .maybeSingle();
          return data?.term_id;
        }, 86400000);
      }

      // Fetch main data
      const subjectAssignBase = supabase.from('subject_teacher_assignments')
        .select('class_id, subject_id')
        .eq('academic_year_id', yearId ?? '');
      const classTeacherBase = supabase.from('class_teachers')
        .select('class_id, classes(id, name, level, section)')
        .eq('academic_year_id', yearId ?? '');
      const assignBase = supabase.from('assignments')
        .select('*, subjects(name), classes(name, level, section)')
        .order('created_at', { ascending: false })
        .limit(5);
      const classBaseSchool = supabase.from('classes')
        .select('id, name, level, section')
        .eq('school_id', profile.school_id ?? '');
      const classBaseOwn = supabase.from('classes')
        .select('id, name, level, section')
        .eq('class_teacher_id', profile.id);

      const [classSubjectRes, classTeacherRes, assignRes, annRes, classRes] = await Promise.all([
        isAdmin ? subjectAssignBase : subjectAssignBase.eq('teacher_id', profile.id),
        isAdmin ? classTeacherBase : classTeacherBase.eq('teacher_id', profile.id),
        isAdmin ? assignBase : assignBase.eq('teacher_id', profile.id),

        supabase.from('announcements')
          .select('*, profiles(first_name, last_name)')
          .eq('school_id', profile.school_id ?? '')
          .contains('target_roles', [profile.role])
          .order('created_at', { ascending: false })
          .limit(3),

        isAdmin ? classBaseSchool : classBaseOwn,
      ]);

      const assignmentsData = classSubjectRes.data || [];
      const formMastersFromTable = (classTeacherRes.data || []).map((d: any) => d.classes);
      const formMastersFromClasses = classRes.data || [];
      const allFormMasters = [...formMastersFromTable, ...formMastersFromClasses].filter(Boolean);
      const uniqueFormMasters = [...new Map(allFormMasters.map((c: any) => [c.id, c])).values()];
      
      const classIds = [...new Set([
        ...assignmentsData.map((c: any) => c.class_id), 
        ...uniqueFormMasters.map((c: any) => c.id)
      ].filter(Boolean))];
      const displaySubjectCount = assignmentsData.length;
      
      let studentCount = 0;
      if (classIds.length > 0) {
        const { count } = await supabase.from('student_enrollments')
          .select('id', { count: 'exact', head: true })
          .in('class_id', classIds)
          .eq('status', 'active')
          .eq('academic_year_id', yearId ?? '');
        studentCount = count ?? 0;
      }

      const assignCountQuery = supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('status', 'active');
      const { count: assignCount } = await (isAdmin ? assignCountQuery : assignCountQuery.eq('teacher_id', profile.id));
      const attendCountQuery = supabase.from('student_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .in('status', ['present', 'late']);
      const { count: attendCount } = await (isAdmin ? attendCountQuery : attendCountQuery.eq('recorded_by', profile.id));

      setStats({ subjects: displaySubjectCount, students: studentCount, assignments: assignCount ?? 0, attendance: attendCount ?? 0 });
      setRecentAssignments(assignRes.data ?? []);
      setAnnouncements(annRes.data ?? []);
      
      const activeFormMasterClass = uniqueFormMasters[0];

      if (activeFormMasterClass) {
        setMyClass(activeFormMasterClass);

        const [enrollRes, subjectRes] = await Promise.all([
          supabase.from('student_enrollments').select('id', { count: 'exact', head: true })
            .eq('class_id', (activeFormMasterClass as any)?.id)
            .eq('status', 'active')
            .eq('academic_year_id', yearId ?? ''),
          supabase.from('subject_teacher_assignments').select('subject_id, teacher_id, subjects(name), profiles(first_name, last_name)')
            .eq('class_id', (activeFormMasterClass as any)?.id)
            .eq('academic_year_id', yearId ?? ''),
        ]);
        setClassStudentCount(enrollRes.count ?? 0);

        if (termId && yearId) {
          const subjectIds = (subjectRes.data ?? []).map(d => d.subject_id);
          const { data: gradesData } = await supabase.from('grades').select('subject_id').eq('class_id', (activeFormMasterClass as any)?.id).eq('term_id', termId).eq('academic_year_id', yearId).in('subject_id', subjectIds);
          const enteredSubjectIds = new Set((gradesData ?? []).map(g => g.subject_id));
          const pending = (subjectRes.data ?? []).filter(d => !enteredSubjectIds.has(d.subject_id)).map(d => ({
            subjectName: (d.subjects as any)?.name,
            teacherName: d.profiles ? `${(d.profiles as any)?.first_name} ${(d.profiles as any)?.last_name}` : 'Unassigned',
          }));
          setClassPendingSubjects(pending);
        }
      }

      setLoading(false);
    }
    load();
  }, [profile]);

  const classLabel = myClass ? (myClass.name || `${myClass.level}${myClass.section}`) : '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Good day, {profile?.first_name}!</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {myClass ? `Form Master — ${classLabel}${stats.subjects > 0 ? ' · Subject Teacher' : ''}` : 'Subject Teacher'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="My Subjects" value={stats.subjects} icon={BookOpen} color="blue" />
        <StatCard title="Total Students" value={stats.students} icon={Users} color="emerald" />
        <StatCard title="Active Assignments" value={stats.assignments} icon={ClipboardList} color="amber" />
        <StatCard title="Attendance Today" value={stats.attendance} icon={UserCheck} color="slate" />
      </div>

      {myClass && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">My Class — {classLabel}</h3>
                <p className="text-xs text-slate-400">{classStudentCount} students enrolled</p>
              </div>
            </div>
            <button onClick={() => navigate('/teacher/class-results')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View Results
            </button>
          </div>
          {classPendingSubjects.length === 0 ? (
            <div className="px-5 py-4 flex items-center gap-3 text-sm text-emerald-700">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <span>All subject teachers have entered scores for the current term</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700">{classPendingSubjects.length} subject{classPendingSubjects.length > 1 ? 's' : ''} pending score entry</span>
              </div>
              {classPendingSubjects.slice(0, 4).map((s, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-slate-700">{s.subjectName}</span>
                  <span className="text-xs text-slate-400">{s.teacherName}</span>
                </div>
              ))}
              {classPendingSubjects.length > 4 && (
                <div className="px-5 py-2 text-xs text-slate-400">+{classPendingSubjects.length - 4} more</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Score Entry', path: '/teacher/score-entry', icon: CheckCircle, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
            { label: 'Timetable', path: '/timetable', icon: Clock, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
            { label: 'Class Results', path: '/teacher/class-results', icon: BarChart2, color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
            { label: 'Take Attendance', path: '/attendance', icon: UserCheck, color: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
            { label: 'New Assignment', path: '/assignments', icon: ClipboardList, color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
            { label: 'My Classes', path: '/my-classes', icon: BookOpen, color: 'bg-slate-50 text-slate-600 hover:bg-slate-100' },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)} className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${action.color}`}>
              <action.icon className="w-5 h-5" />
              <span className="text-xs font-medium text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TeacherTimetable />
          <DashboardCalendar />
        </div>

        <div className="space-y-6">
          <TodoWidget userId={profile?.id} schoolId={profile?.school_id ?? undefined} isSuperAdmin={false} />
        </div>
      </div>
    </div>
  );
}
