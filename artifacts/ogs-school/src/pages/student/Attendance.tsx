import { useEffect, useState } from 'react';
import { UserCheck, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';

const statusVariant: Record<string, any> = { present: 'success', absent: 'error', late: 'warning', excused: 'info' };

export default function StudentAttendance() {
  const { profile } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => { loadAttendance(); }, [profile, month]);

  async function loadAttendance() {
    if (!profile?.id) return;
    setLoading(true);
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0];
    const { data } = await supabase.from('student_attendance').select('*, classes(name, level, section)').eq('student_id', profile.id).gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
    setAttendance(data ?? []);
    setLoading(false);
  }

  const stats = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    excused: attendance.filter(a => a.status === 'excused').length,
    total: attendance.length,
  };
  const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Attendance</h2>
          <p className="text-slate-500 text-sm">Track your attendance records</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <p className="text-3xl font-bold text-slate-800">{rate}%</p>
          <p className="text-xs text-slate-500 mt-1">Rate</p>
        </div>
        {[
          { label: 'Present', count: stats.present, color: 'text-emerald-600' },
          { label: 'Absent', count: stats.absent, color: 'text-red-500' },
          { label: 'Late', count: stats.late, color: 'text-amber-600' },
          { label: 'Excused', count: stats.excused, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Day</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : attendance.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">No attendance records for this month</td></tr>
            ) : attendance.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{new Date(a.date).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{new Date(a.date).toLocaleString('default', { weekday: 'long' })}</td>
                <td className="px-5 py-3"><Badge label={a.status} variant={statusVariant[a.status]} /></td>
                <td className="px-5 py-3 text-sm text-slate-500">{a.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
