import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

interface AttendanceRecord {
  staff_id: string;
  date: string;
  status: string;
}

const ROLES = ['super_admin', 'teacher', 'accountant', 'staff'];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function statusCode(status: string): string {
  switch (status) {
    case 'present': return 'P';
    case 'absent': return 'A';
    case 'late': return 'L';
    case 'half_day': return 'H';
    case 'on_leave': return 'OL';
    default: return '-';
  }
}

function statusCellClass(status: string): string {
  switch (status) {
    case 'present': return 'text-emerald-600 font-semibold';
    case 'absent': return 'text-red-500 font-semibold';
    case 'late': return 'text-amber-500 font-semibold';
    case 'half_day': return 'text-blue-500 font-semibold';
    case 'on_leave': return 'text-purple-500 font-semibold';
    default: return 'text-slate-300';
  }
}

export default function StaffAttendanceReport() {
  const currentDate = new Date();
  const [filterRole, setFilterRole] = useState('teacher');
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
  const dayColumns = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const fetchData = async () => {
    if (!filterRole) return;
    setLoading(true);
    const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
    const endDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const [staffRes, recordsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', filterRole)
        .order('first_name'),
      supabase
        .from('staff_attendance_records')
        .select('staff_id, date, status')
        .gte('date', startDate)
        .lte('date', endDate),
    ]);

    if (staffRes.data) setStaffList(staffRes.data);
    if (recordsRes.data) setRecords(recordsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Live connection to immediately reflect new attendance saved
    const channel = supabase.channel('staff-attendance-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_attendance_records' },
        () => {
          fetchData(); // Trigger fresh fetch to get the updated status
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterRole, filterMonth, filterYear]);

  const getStatusForDay = (staffId: string, day: number): string => {
    const dateStr = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = records.find((r) => r.staff_id === staffId && r.date === dateStr);
    return rec ? rec.status : '';
  };

  const getSummary = (staffId: string) => {
    const staffRecords = records.filter((r) => r.staff_id === staffId);
    return {
      present: staffRecords.filter((r) => r.status === 'present').length,
      absent: staffRecords.filter((r) => r.status === 'absent').length,
      late: staffRecords.filter((r) => r.status === 'late').length,
      half_day: staffRecords.filter((r) => r.status === 'half_day').length,
      on_leave: staffRecords.filter((r) => r.status === 'on_leave').length,
    };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Staff Attendance Report</h1>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Role</label>
            <select
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Month</label>
            <select
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Year</label>
            <select
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm">No staff found for selected filters.</div>
      ) : (
        <>
          <div className="bg-app-surface rounded-2xl border border-app-border overflow-x-auto mb-6">
            <table className="text-xs min-w-max">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted sticky left-0 bg-app-surface-alt min-w-[160px]">Staff</th>
                  {dayColumns.map((d) => (
                    <th key={d} className="px-2 py-3.5 font-semibold text-app-text-muted min-w-[32px] text-center">{d}</th>
                  ))}
                  <th className="px-3 py-3.5 font-semibold text-emerald-600 text-center whitespace-nowrap">P</th>
                  <th className="px-3 py-3.5 font-semibold text-red-500 text-center whitespace-nowrap">A</th>
                  <th className="px-3 py-3.5 font-semibold text-amber-500 text-center whitespace-nowrap">L</th>
                  <th className="px-3 py-3.5 font-semibold text-blue-500 text-center whitespace-nowrap">H</th>
                  <th className="px-3 py-3.5 font-semibold text-purple-500 text-center whitespace-nowrap">OL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {staffList.map((s) => {
                  const summary = getSummary(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-app-surface-alt transition-colors">
                      <td className="px-4 py-3 font-medium text-app-text sticky left-0 bg-app-surface">
                        {`${s.first_name || ''} ${s.last_name || ''}`.trim() || 'N/A'}
                      </td>
                      {dayColumns.map((d) => {
                        const status = getStatusForDay(s.id, d);
                        return (
                          <td key={d} className={`px-2 py-3 text-center ${statusCellClass(status)}`}>
                            {statusCode(status)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center font-semibold text-emerald-600">{summary.present}</td>
                      <td className="px-3 py-3 text-center font-semibold text-red-500">{summary.absent}</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-500">{summary.late}</td>
                      <td className="px-3 py-3 text-center font-semibold text-blue-500">{summary.half_day}</td>
                      <td className="px-3 py-3 text-center font-semibold text-purple-500">{summary.on_leave}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-app-surface-alt rounded-2xl border border-app-border p-4">
            <p className="text-xs font-semibold text-app-text-muted mb-2">Legend</p>
            <div className="flex flex-wrap gap-4 text-xs">
              {[
                { code: 'P', label: 'Present', color: 'text-emerald-600' },
                { code: 'A', label: 'Absent', color: 'text-red-500' },
                { code: 'L', label: 'Late', color: 'text-amber-500' },
                { code: 'H', label: 'Half Day', color: 'text-blue-500' },
                { code: 'OL', label: 'On Leave', color: 'text-purple-500' },
                { code: '-', label: 'No Record', color: 'text-slate-300' },
              ].map(({ code, label, color }) => (
                <div key={code} className="flex items-center gap-1.5">
                  <span className={`font-bold ${color}`}>{code}</span>
                  <span className="text-app-text-muted">= {label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
