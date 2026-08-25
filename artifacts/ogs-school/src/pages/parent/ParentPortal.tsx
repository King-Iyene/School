import { useEffect, useState } from 'react';
import { Users, UserCheck, Award, CreditCard, Bell, BookOpen, ChevronRight } from 'lucide-react';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { getWAECGrade as waecOf } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
}

interface ChildData {
  className: string;
  attRate: number;
  present: number;
  absent: number;
  late: number;
  totalDays: number;
  avgScore: number;
  subjectsCount: number;
  totalFees: number;
  totalPaid: number;
  feeBalance: number;
}

interface Announcement { id: string; title: string; content: string; created_at: string; is_pinned: boolean; }

export default function ParentPortal() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [childData, setChildData] = useState<Record<string, ChildData>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => { if (profile?.id) load(); }, [profile?.id]);

  async function load() {
    const [linkRes, annRes] = await Promise.all([
      supabase.from('parent_student_links').select('*, students!student_id(id, first_name, last_name, admission_number)').eq('parent_id', profile!.id),
      supabase.from('announcements').select('id, title, content, created_at, is_pinned').eq('school_id', profile!.school_id ?? '').contains('target_roles', [profile!.role]).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5),
    ]);

    const childProfiles: Child[] = ((linkRes.data ?? []).map((l: any) => l.students).filter(Boolean)) as Child[];
    setChildren(childProfiles);
    setAnnouncements((annRes.data ?? []) as Announcement[]);

    const dataMap: Record<string, ChildData> = {};
    await Promise.all(childProfiles.map(async child => {
      const [enrollRes, attRes, marksRes, feeStructRes, feePayRes] = await Promise.all([
        supabase.from('student_enrollments').select('class_id, classes(name, level, section)').eq('student_id', child.id).eq('status', 'active').maybeSingle(),
        supabase.from('student_attendance').select('status').eq('student_id', child.id),
        supabase.from('exam_marks_records').select('subject_id, ca1, ca2, ca3, exam').eq('student_id', child.id).eq('is_absent', false).limit(50),
        supabase.from('fee_structures').select('amount').eq('school_id', profile!.school_id ?? ''),
        supabase.from('fee_payments').select('amount_paid').eq('student_id', child.id),
      ]);

      const enrollData = enrollRes.data as any;
      const className = enrollData ? (enrollData.classes?.name || `${enrollData.classes?.level ?? ''}${enrollData.classes?.section ?? ''}`) : 'No class';

      const attData = attRes.data ?? [];
      const present = attData.filter((a: any) => a.status === 'present').length;
      const absent = attData.filter((a: any) => a.status === 'absent').length;
      const late = attData.filter((a: any) => a.status === 'late').length;
      const totalDays = attData.length;
      const attRate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;

      const marksData = marksRes.data ?? [];
      const subjectTotals: Record<string, number[]> = {};
      marksData.forEach((m: any) => {
        const total = (m.ca1||0) + (m.ca2||0) + (m.ca3||0) + (m.exam||0);
        if (!subjectTotals[m.subject_id]) subjectTotals[m.subject_id] = [];
        subjectTotals[m.subject_id].push(total);
      });
      const subjectAvgs = Object.values(subjectTotals).map(scores => scores.reduce((a, b) => a + b, 0) / scores.length);
      const avgScore = subjectAvgs.length > 0 ? Math.round(subjectAvgs.reduce((a, b) => a + b, 0) / subjectAvgs.length) : 0;

      const totalFees = (feeStructRes.data ?? []).reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
      const totalPaid = (feePayRes.data ?? []).reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);

      dataMap[child.id] = { className, attRate, present, absent, late, totalDays, avgScore, subjectsCount: subjectAvgs.length, totalFees, totalPaid, feeBalance: totalFees - totalPaid };
    }));

    setChildData(dataMap);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl p-6 text-white">
        <p className="text-blue-100 text-sm font-medium">{greeting},</p>
        <h2 className="text-2xl font-bold mt-0.5">{profile?.first_name} {profile?.last_name}</h2>
        <p className="text-blue-100 text-sm mt-2">Monitor your children's academic progress and school activities</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-800">{children.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Children</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <Bell className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-800">{announcements.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Announcements</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <CreditCard className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">
            ₦{Object.values(childData).reduce((s, d) => s + (d.feeBalance || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Total Due</p>
        </div>
      </div>

      <DashboardCalendar />

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : children.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No children linked yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Go to "My Children" to link your ward using their admission number</p>
          <button
            onClick={() => navigate('/children')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            Link a Child →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">My Children</h3>
            <button
              onClick={() => navigate('/children')}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              + Link a Child
            </button>
          </div>
          {children.map(child => {
            const d = childData[child.id];
            if (!d) return null;
            return (
              <div key={child.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-base font-bold text-blue-700 flex-shrink-0">
                        {child.first_name?.[0]}{child.last_name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 text-lg">{child.first_name} {child.last_name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-sm text-slate-500">{d.className}</span>
                          {child.student_id && <span className="text-xs text-slate-400 font-mono">ID: {child.student_id}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
                  <div className="bg-white p-4 text-center">
                    <p className={`text-xl font-bold ${d.attRate >= 75 ? 'text-emerald-600' : d.attRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{d.attRate}%</p>
                    <p className="text-xs text-slate-500 mt-1">Attendance</p>
                    <div className="flex justify-center gap-2 mt-1.5 text-xs">
                      <span className="text-emerald-600">{d.present}P</span>
                      <span className="text-red-500">{d.absent}A</span>
                      <span className="text-amber-500">{d.late}L</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 text-center">
                    <p className={`text-xl font-bold ${d.avgScore >= 70 ? 'text-emerald-600' : d.avgScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{d.avgScore}</p>
                    <p className="text-xs text-slate-500 mt-1">Avg Score</p>
                    <p className="text-xs font-medium mt-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.avgScore >= 70 ? 'bg-emerald-100 text-emerald-700' : d.avgScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {waecOf(d.avgScore).grade}
                      </span>
                    </p>
                  </div>
                  <div className="bg-white p-4 text-center">
                    <p className="text-xl font-bold text-blue-600">{d.subjectsCount}</p>
                    <p className="text-xs text-slate-500 mt-1">Subjects</p>
                    <button onClick={() => navigate('/grades')} className="text-xs text-blue-500 hover:underline mt-1.5">View results</button>
                  </div>
                  <div className="bg-white p-4 text-center">
                    <p className={`text-xl font-bold ${d.feeBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>₦{d.feeBalance.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{d.feeBalance > 0 ? 'Fee Balance' : 'Fully Paid'}</p>
                    <button onClick={() => navigate('/fees')} className="text-xs text-blue-500 hover:underline mt-1.5">Pay fees</button>
                  </div>
                </div>

                <div className="p-4 flex flex-wrap gap-2">
                  {[
                    { label: 'Attendance', path: '/attendance' },
                    { label: 'Exam Results', path: '/parent/exam-result' },
                    { label: 'Fees', path: '/fees' },
                    { label: 'Subjects', path: '/parent/subjects' },
                  ].map(({ label, path }) => (
                    <button key={path} onClick={() => navigate(path)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-lg transition-colors font-medium">
                      {label} <ChevronRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-800">School Announcements</h3>
          </div>
          <button onClick={() => navigate('/announcements')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">View all</button>
        </div>
        {announcements.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No announcements</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {announcements.map(a => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  {a.is_pinned && <span className="mt-0.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Pinned</span>}
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.content}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
