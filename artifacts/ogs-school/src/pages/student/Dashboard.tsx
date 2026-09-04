import { useEffect, useState } from 'react';
import { BookOpen, Award, UserCheck, ClipboardList, TrendingUp, Link as LinkIcon, FileText } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ subjects: 0, presentDays: 0, totalDays: 0, assignments: 0, avgGrade: 0 });
  const [recentGrades, setRecentGrades] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const [enrollRes, attRes, assignRes, gradeRes, annRes] = await Promise.all([
        supabase.from('student_enrollments').select('*, classes(id)').eq('student_id', profile.id).eq('status', 'active').maybeSingle(),
        supabase.from('student_attendance').select('status').eq('student_id', profile.id),
        supabase.from('assignments').select('*, subjects(name), classes(name, level, section)').in('class_id', []).limit(5),
        supabase.from('grades').select('*, subjects(name)').eq('student_id', profile.id).order('updated_at', { ascending: false }).limit(5),
        supabase.from('announcements').select('*').eq('school_id', profile.school_id ?? '').contains('target_roles', [profile.role]).order('created_at', { ascending: false }).limit(3),
      ]);

      const classId = (enrollRes.data?.classes as any)?.id;
      let assignData: any[] = [];
      if (classId) {
        const { data } = await supabase.from('assignments').select('*, subjects(name)').eq('class_id', classId).eq('status', 'active').order('due_date').limit(5);
        assignData = data ?? [];
      }

      const att = attRes.data ?? [];
      const presentDays = att.filter(a => a.status === 'present').length;
      const grades = gradeRes.data ?? [];
      const avgGrade = grades.length > 0 ? grades.reduce((sum, g) => sum + (g.total_score || 0), 0) / grades.length : 0;

      setStats({ subjects: grades.length, presentDays, totalDays: att.length, assignments: assignData.filter(a => new Date(a.due_date) > new Date()).length, avgGrade: Math.round(avgGrade) });
      setRecentGrades(grades);
      setAssignments(assignData);
      setAnnouncements(annRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  const attendanceRate = stats.totalDays > 0 ? Math.round((stats.presentDays / stats.totalDays) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-app-text">Hello, {profile?.first_name}!</h2>
        <p className="text-app-text-muted mt-1">Track your academic progress and stay up to date</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Average Score" value={`${stats.avgGrade}%`} icon={Award} color="emerald" />
        <StatCard title="Attendance Rate" value={`${attendanceRate}%`} icon={UserCheck} color="blue" />
        <StatCard title="Pending Assignments" value={stats.assignments} icon={ClipboardList} color="amber" />
        <StatCard title="Subjects Taken" value={stats.subjects} icon={BookOpen} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DashboardCalendar />
          
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
            <div className="p-5 border-b border-app-border">
              <h3 className="font-semibold text-app-text text-sm">Upcoming Assignments</h3>
            </div>
            <div className="divide-y divide-app-border">
              {assignments.slice(0, 4).length === 0 ? (
                <div className="p-5 text-center text-app-text-muted text-xs">No pending assignments</div>
              ) : assignments.slice(0, 4).map(a => (
                <div key={a.id} className="p-4 hover:bg-app-surface-alt transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-app-text truncate">{a.title}</p>
                      <p className="text-[11px] text-app-text-muted truncate">{(a.subjects as any)?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-amber-600 font-medium">Due: {new Date(a.due_date).toLocaleDateString()}</p>
                    <div className="flex gap-1.5">
                      {a.source_url && (
                        <a href={a.source_url} target="_blank" rel="noopener noreferrer" title="Source URL" className="text-blue-500 hover:text-blue-600 transition-colors">
                          <LinkIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {a.file_url && (
                        <a href={a.file_url} target="_blank" rel="noopener noreferrer" title="View Attachment" className="text-amber-500 hover:text-amber-600">
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
            <div className="p-5 border-b border-app-border flex items-center justify-between">
              <h3 className="font-semibold text-app-text text-sm">Recent Grades</h3>
              <button onClick={() => navigate('/grades')} className="text-xs text-emerald-600 hover:underline">View all</button>
            </div>
            <div className="divide-y divide-app-border">
              {loading ? (
                <div className="p-5 text-center text-app-text-muted text-sm">Loading...</div>
              ) : recentGrades.length === 0 ? (
                <div className="p-5 text-center text-app-text-muted text-sm">No grades recorded yet</div>
              ) : recentGrades.slice(0, 5).map(g => {
                const gradeColor = g.grade?.startsWith('A') ? 'text-emerald-600 bg-emerald-50' : g.grade?.startsWith('B') ? 'text-blue-600 bg-blue-50' : g.grade?.startsWith('C') ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
                return (
                  <div key={g.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-app-text truncate max-w-[120px]">{(g.subjects as any)?.name}</p>
                      <p className="text-[10px] text-app-text-muted">{g.total_score}/100</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${gradeColor}`}>{g.grade}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
            <div className="p-5 border-b border-app-border">
              <h3 className="font-semibold text-app-text text-sm">Announcements</h3>
            </div>
            <div className="divide-y divide-app-border">
              {announcements.length === 0 ? (
                <div className="p-5 text-center text-app-text-muted text-xs">No announcements</div>
              ) : announcements.map(a => (
                <div key={a.id} className="p-4">
                  <p className="text-sm font-medium text-app-text truncate">{a.title}</p>
                  <p className="text-[10px] text-app-text-muted mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
