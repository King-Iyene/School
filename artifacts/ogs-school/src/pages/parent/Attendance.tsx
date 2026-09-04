import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';

const statusVariant: Record<string, any> = { present: 'success', absent: 'error', late: 'warning', excused: 'info' };

export default function ParentAttendance() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChildren(); }, [profile]);
  useEffect(() => { if (selectedChild) loadAttendance(); }, [selectedChild, month]);

  async function loadChildren() {
    if (!profile?.id) return;
    const { data } = await supabase.from('parent_student_links').select('*, students!student_id(id, first_name, last_name)').eq('parent_id', profile.id);
    const kids = (data ?? []).map(l => l.students).filter(Boolean);
    setChildren(kids);
    if (kids.length > 0) setSelectedChild((kids[0] as any).id);
    setLoading(false);
  }

  async function loadAttendance() {
    setLoading(true);
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0];
    const { data } = await supabase.from('student_attendance').select('*').eq('student_id', selectedChild).gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
    setAttendance(data ?? []);
    setLoading(false);
  }

  const stats = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    total: attendance.length,
  };
  const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-app-text">Attendance Overview</h2>
        <p className="text-app-text-muted text-sm">Monitor your children's school attendance</p>
      </div>
      <div className="flex gap-3">
        <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-app-surface">
          {children.map(c => <option key={(c as any).id} value={(c as any).id}>{(c as any).first_name} {(c as any).last_name}</option>)}
        </select>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Attendance Rate', value: `${rate}%`, color: 'text-app-text' },
          { label: 'Present', value: stats.present, color: 'text-emerald-600' },
          { label: 'Absent', value: stats.absent, color: 'text-red-500' },
          { label: 'Late', value: stats.late, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-app-text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-app-border bg-app-surface-alt">
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Day</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-app-text-muted">Loading...</td></tr>
            ) : attendance.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-app-text-muted">No records for this month</td></tr>
            ) : attendance.map(a => (
              <tr key={a.id} className="hover:bg-app-surface-alt transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-app-text">{new Date(a.date).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-sm text-app-text-muted">{new Date(a.date).toLocaleString('default', { weekday: 'long' })}</td>
                <td className="px-5 py-3"><Badge label={a.status} variant={statusVariant[a.status]} /></td>
                <td className="px-5 py-3 text-sm text-app-text-muted">{a.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
