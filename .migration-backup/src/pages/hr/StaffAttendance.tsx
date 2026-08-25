import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';

interface AttendanceRecord {
  staff_id: string;
  status: AttendanceStatus;
  is_locked: boolean;
}

const ROLES = ['super_admin', 'teacher', 'accountant', 'staff'];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'on_leave', label: 'On Leave' },
];

const statusColor: Record<string, string> = {
  present: 'text-emerald-600',
  absent: 'text-red-500',
  late: 'text-amber-500',
  half_day: 'text-blue-500',
  on_leave: 'text-purple-500',
  holiday: 'text-sky-500',
};

function getInitials(p: Profile) {
  return `${(p.first_name || '?')[0]}${(p.last_name || '?')[0]}`.toUpperCase();
}

export default function StaffAttendance() {
  const { profile } = useAuth();
  const [selectedRole, setSelectedRole] = useState('teacher');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isHoliday, setIsHoliday] = useState(false);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const fetchStaff = async () => {
    if (!selectedRole) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('role', selectedRole)
      .order('first_name');
    if (data) setStaffList(data);
    setLoading(false);
  };

  const fetchExistingAttendance = async () => {
    if (!selectedDate || !selectedRole || staffList.length === 0) return;
    const ids = staffList.map((s) => s.id);
    const { data } = await supabase
      .from('staff_attendance_records')
      .select('staff_id, status, is_locked')
      .eq('date', selectedDate)
      .in('staff_id', ids);

    if (data && data.length > 0) {
      const map: Record<string, AttendanceStatus> = {};
      data.forEach((r) => { map[r.staff_id] = r.status; });
      setAttendance((prev) => {
        const next = { ...prev };
        staffList.forEach((s) => {
          next[s.id] = map[s.id] || 'present';
        });
        return next;
      });
      setIsLocked(data[0].is_locked || false);
      const isAllHoliday = data.every(r => r.status === 'holiday' || r.status === 'on_leave');
      setIsHoliday(isAllHoliday);
    } else {
      const next: Record<string, AttendanceStatus> = {};
      staffList.forEach((s) => { next[s.id] = 'present'; });
      setAttendance(next);
      setIsLocked(false);
      setIsHoliday(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [selectedRole]);

  useEffect(() => {
    if (staffList.length > 0) {
      fetchExistingAttendance();
    }
  }, [staffList, selectedDate]);

  const setStatus = (staffId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [staffId]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const records = staffList.map((s) => ({
      school_id: profile?.school_id,
      staff_id: s.id,
      date: selectedDate,
      status: isHoliday ? 'holiday' as AttendanceStatus : (attendance[s.id] || 'present'),
      is_locked: true,
    }));
    const { error } = await supabase
      .from('staff_attendance_records')
      .upsert(records, { onConflict: 'staff_id,date' });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setIsLocked(true);
    } else {
      alert(`Error saving attendance: ${error.message}`);
    }
  };

  const summary = {
    present: staffList.filter((s) => !isHoliday && attendance[s.id] === 'present').length,
    absent: staffList.filter((s) => !isHoliday && attendance[s.id] === 'absent').length,
    late: staffList.filter((s) => !isHoliday && attendance[s.id] === 'late').length,
    half_day: staffList.filter((s) => !isHoliday && attendance[s.id] === 'half_day').length,
    on_leave: staffList.filter((s) => isHoliday || attendance[s.id] === 'on_leave' || attendance[s.id] === 'holiday' as AttendanceStatus).length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Staff Attendance</h1>
        <button
          onClick={handleSave}
          disabled={saving || staffList.length === 0 || isLocked}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving...' : isLocked ? 'Saved & Locked' : 'Save Attendance'}
        </button>
      </div>

      {isLocked && (
        <div className="mb-4 bg-amber-50 border border-amber-200 flex items-center pr-4 pl-3 py-3 rounded-xl gap-3">
          <div className="flex-shrink-0 bg-amber-100 text-amber-600 p-1.5 rounded-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-800">Attendance is Locked</h3>
            <p className="text-xs font-medium text-amber-700 mt-0.5">The attendance for this date has already been submitted and saved. Changes can no longer be made.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Role</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
            <input
              type="date"
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input
              id="is_holiday"
              type="checkbox"
              className="w-4 h-4 accent-emerald-500"
              checked={isHoliday}
              disabled={isLocked}
              onChange={(e) => setIsHoliday(e.target.checked)}
            />
            <label htmlFor="is_holiday" className="text-sm font-medium text-slate-700">Mark as Holiday</label>
          </div>
        </div>
      </div>

      {saved && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          Attendance saved successfully.
        </div>
      )}

      {staffList.length > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Present', count: summary.present, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'Absent', count: summary.absent, color: 'bg-red-50 border-red-200 text-red-600' },
            { label: 'Late', count: summary.late, color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: 'Half Day', count: summary.half_day, color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'On Leave', count: summary.on_leave, color: 'bg-purple-50 border-purple-200 text-purple-700' },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-2xl border p-4 ${color}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No staff found for selected role.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Staff</th>
                <th className="px-5 py-3.5 font-semibold text-slate-600 text-center" colSpan={5}>
                  {isHoliday ? 'Holiday (All On Leave)' : 'Attendance Status'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {getInitials(s)}
                      </div>
                      <span className="font-medium text-slate-800">
                        {`${s.first_name || ''} ${s.last_name || ''}`.trim()}
                      </span>
                    </div>
                  </td>
                  {STATUS_OPTIONS.map((opt) => {
                    const isChecked = isHoliday
                      ? (opt.value === 'on_leave' || opt.value === 'holiday')
                      : attendance[s.id] === opt.value;
                    const isDisabled = isHoliday || isLocked;

                    return (
                      <td key={opt.value} className="px-3 py-4 text-center">
                        <label className={`flex flex-col items-center gap-1.5 ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name={`status-${s.id}`}
                            value={opt.value}
                            checked={isChecked}
                            onChange={() => !isDisabled && setStatus(s.id, opt.value)}
                            disabled={isDisabled}
                            className="accent-emerald-500 w-4 h-4"
                          />
                          <span className={`text-xs font-medium ${statusColor[opt.value]}`}>{opt.label}</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
