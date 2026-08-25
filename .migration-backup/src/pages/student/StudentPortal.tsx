import { useEffect, useState } from 'react';
import { BookOpen, UserCheck, Award, Bell, TrendingUp, Calendar, CreditCard } from 'lucide-react';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

interface Enrollment {
  class_id: string;
  classes?: { name: string; level: string; section: string };
}

interface AttSummary { present: number; absent: number; late: number; total: number; }
interface ExamResult { subject_name: string; total: number; grade: string; }
interface Announcement { id: string; title: string; content: string; created_at: string; is_pinned: boolean; }
interface FeeSummary { total_fees: number; total_paid: number; balance: number; }

function getWAECGrade(score: number): string {
  if (score >= 75) return 'A1';
  if (score >= 70) return 'B2';
  if (score >= 65) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'E8';
  return 'F9';
}

function gradeColor(grade: string) {
  if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700';
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (grade.startsWith('C')) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

export default function StudentPortal() {
  const { profile } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [att, setAtt] = useState<AttSummary>({ present: 0, absent: 0, late: 0, total: 0 });
  const [results, setResults] = useState<ExamResult[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fees, setFees] = useState<FeeSummary>({ total_fees: 0, total_paid: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => { if (profile?.id) load(); }, [profile?.id]);

  async function load() {
    const [enrollRes, attRes, marksRes, annRes, feeStructRes, feePayRes] = await Promise.all([
      supabase.from('student_enrollments').select('class_id, classes(name, level, section)').eq('student_id', profile!.id).eq('status', 'active').maybeSingle(),
      supabase.from('student_attendance').select('status').eq('student_id', profile!.id),
      supabase.from('exam_marks_records').select('subject_id, ca1, ca2, ca3, exam, subjects(name)').eq('student_id', profile!.id).eq('is_absent', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('announcements').select('id, title, content, created_at, is_pinned').eq('school_id', profile!.school_id ?? '').contains('target_roles', [profile!.role]).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5),
      supabase.from('fee_structures').select('amount').eq('school_id', profile!.school_id ?? ''),
      supabase.from('fee_payments').select('amount_paid').eq('student_id', profile!.id),
    ]);

    if (enrollRes.data) setEnrollment(enrollRes.data as unknown as Enrollment);

    const attData = attRes.data ?? [];
    setAtt({
      present: attData.filter(a => a.status === 'present').length,
      absent: attData.filter(a => a.status === 'absent').length,
      late: attData.filter(a => a.status === 'late').length,
      total: attData.length,
    });

    const marksData = marksRes.data ?? [];
    const subjectMap: Record<string, { total: number; count: number; name: string }> = {};
    marksData.forEach((m: any) => {
      const sid = m.subject_id;
      const total = (m.ca1_marks||0) + (m.ca2_marks||0) + (m.ca3_marks||0) + (m.exam_marks||0);
      if (!subjectMap[sid]) subjectMap[sid] = { total: 0, count: 0, name: m.subjects?.name ?? 'Subject' };
      subjectMap[sid].total += total;
      subjectMap[sid].count += 1;
    });
    const resultRows = Object.values(subjectMap).map(s => ({
      subject_name: s.name,
      total: Math.round(s.total / s.count),
      grade: getWAECGrade(Math.round(s.total / s.count)),
    })).sort((a, b) => b.total - a.total);
    setResults(resultRows.slice(0, 8));

    setAnnouncements((annRes.data ?? []) as Announcement[]);

    const totalFees = (feeStructRes.data ?? []).reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
    const totalPaid = (feePayRes.data ?? []).reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
    setFees({ total_fees: totalFees, total_paid: totalPaid, balance: totalFees - totalPaid });

    setLoading(false);
  }

  const attRate = att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : 0;
  const className = enrollment ? ((enrollment.classes as any)?.name || `${(enrollment.classes as any)?.level ?? ''}${(enrollment.classes as any)?.section ?? ''}`) : 'Not enrolled';

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <p className="text-emerald-100 text-sm font-medium">{greeting},</p>
        <h2 className="text-2xl font-bold mt-0.5">{profile?.first_name} {profile?.last_name}</h2>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5 text-sm">
            <BookOpen className="w-4 h-4" />
            <span>{className}</span>
          </div>
          {profile?.student_id && (
            <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5 text-sm">
              <span>ID: {profile.student_id}</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading your dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{attRate}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Attendance Rate</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{results.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Subjects Taken</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{results.length > 0 ? Math.round(results.reduce((s, r) => s + r.total, 0) / results.length) : 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Avg Score</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${fees.balance > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <CreditCard className={`w-5 h-5 ${fees.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
              </div>
              <p className={`text-2xl font-bold ${fees.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₦{fees.balance.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">Fee Balance</p>
            </div>
          </div>

          <DashboardCalendar />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Attendance Summary</h3>
                <button onClick={() => navigate('/attendance')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Details</button>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Present', count: att.present, color: 'emerald' },
                  { label: 'Absent', count: att.absent, color: 'red' },
                  { label: 'Late', count: att.late, color: 'amber' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full bg-${color}-500`} />
                      <span className="text-sm text-slate-600">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: att.total > 0 ? `${(count / att.total) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>Total Days: {att.total}</span>
                  <span className="font-semibold text-emerald-600">Rate: {attRate}%</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Latest Results</h3>
                <button onClick={() => navigate('/student/examinations')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
              </div>
              {results.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No exam results yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {results.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.subject_name}</p>
                        <p className="text-xs text-slate-400">Score: {r.total}/100</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.total >= 70 ? 'bg-emerald-500' : r.total >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${r.total}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${gradeColor(r.grade)}`}>{r.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">Announcements</h3>
                </div>
                <button onClick={() => navigate('/announcements')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
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

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">Fee Status</h3>
                </div>
                <button onClick={() => navigate('/fees')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Details</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Fees</span>
                  <span className="text-sm font-semibold text-slate-800">₦{fees.total_fees.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Amount Paid</span>
                  <span className="text-sm font-semibold text-emerald-600">₦{fees.total_paid.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: fees.total_fees > 0 ? `${Math.min(100, (fees.total_paid / fees.total_fees) * 100)}%` : '0%' }}
                  />
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl ${fees.balance > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                  <span className={`text-sm font-medium ${fees.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fees.balance > 0 ? 'Outstanding Balance' : 'Fully Paid'}
                  </span>
                  <span className={`text-base font-bold ${fees.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₦{fees.balance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Examinations', path: '/student/examinations', icon: Award },
              { label: 'Attendance', path: '/attendance', icon: UserCheck },
              { label: 'Subjects', path: '/student/subjects', icon: BookOpen },
            ].map(({ label, path, icon: Icon }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                </div>
                <span className="text-xs font-medium text-slate-600 group-hover:text-emerald-700 transition-colors">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
