import { useEffect, useState } from 'react';
import { Users, Award, UserCheck, DollarSign, BookOpen } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

export default function ParentDashboard() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const { data: links } = await supabase.from('parent_student_links').select('*, students!student_id(id, first_name, last_name, admission_number)').eq('parent_id', profile.id);
      const childProfiles = (links ?? []).map(l => (l as any).students).filter(Boolean);
      setChildren(childProfiles);

      const childStats: Record<string, any> = {};
      for (const child of childProfiles) {
        const [gradeRes, attRes, enrollRes] = await Promise.all([
          supabase.from('grades').select('total_score').eq('student_id', (child as any).id).order('updated_at', { ascending: false }).limit(5),
          supabase.from('student_attendance').select('status').eq('student_id', (child as any).id),
          supabase.from('student_enrollments').select('*, classes(name, level, section)').eq('student_id', (child as any).id).eq('status', 'active').maybeSingle(),
        ]);
        const grades = gradeRes.data ?? [];
        const att = attRes.data ?? [];
        const avg = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.total_score || 0), 0) / grades.length) : 0;
        const presentCount = att.filter(a => a.status === 'present').length;
        const attRate = att.length > 0 ? Math.round((presentCount / att.length) * 100) : 0;
        childStats[(child as any).id] = { avg, attRate, className: (enrollRes.data?.classes as any)?.name || `${(enrollRes.data?.classes as any)?.level || ''}${(enrollRes.data?.classes as any)?.section || ''}` };
      }
      setStats(childStats);

      const { data: ann } = await supabase.from('announcements').select('*').eq('school_id', profile.school_id ?? '').contains('target_roles', [profile.role]).order('created_at', { ascending: false }).limit(5);
      setAnnouncements(ann ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Welcome, {profile?.first_name}!</h2>
        <p className="text-slate-500 mt-1">Monitor your children's academic progress</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="My Children" value={children.length} icon={Users} color="emerald" />
        <StatCard title="Announcements" value={announcements.length} icon={BookOpen} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardCalendar />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">School Announcements</h3>
            <button onClick={() => navigate('/announcements')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
          </div>
          <div className="divide-y divide-slate-100">
            {announcements.length === 0 ? (
              <div className="p-5 text-center text-slate-400 text-sm">No announcements</div>
            ) : announcements.map(a => (
              <div key={a.id} className="p-4">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.content}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          My Children
        </h3>
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : children.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No children linked to your account</p>
            <p className="text-sm text-slate-400 mt-1">Contact the school administrator to link your children</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {children.map(child => (
              <div key={(child as any).id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600">
                    {(child as any).first_name?.[0]}{(child as any).last_name?.[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-lg">{(child as any).first_name} {(child as any).last_name}</h3>
                    <p className="text-sm text-slate-500">{stats[(child as any).id]?.className || 'Class not assigned'} · ID: {(child as any).student_id || '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats[(child as any).id]?.avg ?? 0}%</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Average Grade</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats[(child as any).id]?.attRate ?? 0}%</p>
                    <p className="text-xs text-blue-700 mt-0.5">Attendance Rate</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigate('/grades')} className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">View Grades</button>
                  <button onClick={() => navigate('/fees')} className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Fee Status</button>
                  <button onClick={() => navigate('/attendance')} className="flex-1 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Attendance</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
