import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, ChevronRight, Zap, CheckCircle, CalendarDays } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';

const ROLES = ['accountant', 'staff', 'super_admin', 'teacher'];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present',  label: 'Present'  },
  { value: 'absent',   label: 'Absent'   },
  { value: 'late',     label: 'Late'     },
  { value: 'half_day', label: 'Half Day' },
  { value: 'on_leave', label: 'On Leave' },
];

const statusColor: Record<string, string> = {
  present:  'text-emerald-600',
  absent:   'text-red-500',
  late:     'text-amber-500',
  half_day: 'text-blue-500',
  on_leave: 'text-purple-500',
  holiday:  'text-sky-500',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(dateStr: string) { return DAY_LABELS[new Date(dateStr + 'T00:00:00').getDay()]; }
function shortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}
function isWeekend(dateStr: string) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return dow === 0 || dow === 6;
}
function prevWeekday(dateStr: string): string {
  let d = addDays(dateStr, -1);
  for (let i = 0; i < 7; i++) { if (!isWeekend(d)) return d; d = addDays(d, -1); }
  return dateStr;
}
function nextWeekday(dateStr: string): string {
  const t = todayStr();
  let d = addDays(dateStr, 1);
  for (let i = 0; i < 7; i++) { if (d > t) return t; if (!isWeekend(d)) return d; d = addDays(d, 1); }
  return dateStr;
}
function recentWeekdays(n: number): string[] {
  const days: string[] = [];
  let cur = todayStr();
  let iters = 0;
  while (days.length < n && iters < 40) { if (!isWeekend(cur)) days.push(cur); cur = addDays(cur, -1); iters++; }
  return days;
}
function getInitials(p: Profile) {
  return `${(p.first_name || '?')[0]}${(p.last_name || '?')[0]}`.toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function StaffAttendance() {
  const { profile } = useAuth();

  const [selectedRole, setSelectedRole] = useState('teacher');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [isHoliday, setIsHoliday]       = useState(false);
  const [staffList, setStaffList]       = useState<Profile[]>([]);
  const [attendance, setAttendance]     = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  // Date navigation
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set());
  const recentDays = useMemo(() => recentWeekdays(12), []);
  const today = todayStr();
  const missingCount = recentDays.filter(d => d !== today && !recordedDates.has(d)).length;

  // Bulk fill
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [bulkFrom, setBulkFrom]     = useState('');
  const [bulkTo, setBulkTo]         = useState('');
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDone, setBulkDone]     = useState(false);

  const bulkDays = useMemo(() => {
    if (!bulkFrom || !bulkTo || bulkFrom > bulkTo) return [];
    const days: string[] = [];
    let d = bulkFrom;
    let iters = 0;
    while (d <= bulkTo && d <= today && iters < 200) {
      if (!isWeekend(d)) days.push(d);
      d = addDays(d, 1); iters++;
    }
    return days;
  }, [bulkFrom, bulkTo, today]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { fetchStaff(); }, [selectedRole]);
  useEffect(() => { if (staffList.length > 0) { fetchExistingAttendance(); } }, [staffList, selectedDate]);
  useEffect(() => { if (staffList.length > 0) loadRecordedDates(); }, [staffList]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  async function fetchStaff() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('role', selectedRole)
      .order('first_name');
    if (data) setStaffList(data);
    setLoading(false);
  }

  async function fetchExistingAttendance() {
    if (!selectedDate || staffList.length === 0) return;
    const ids = staffList.map(s => s.id);
    const { data } = await supabase
      .from('staff_attendance_records')
      .select('staff_id, status')
      .eq('date', selectedDate)
      .in('staff_id', ids);

    const map: Record<string, AttendanceStatus> = {};
    if (data && data.length > 0) {
      data.forEach(r => { map[r.staff_id] = r.status; });
      const allHoliday = data.every(r => r.status === 'holiday' || r.status === 'on_leave');
      setIsHoliday(allHoliday);
    } else {
      setIsHoliday(false);
    }
    const next: Record<string, AttendanceStatus> = {};
    staffList.forEach(s => { next[s.id] = map[s.id] || 'present'; });
    setAttendance(next);
  }

  async function loadRecordedDates() {
    if (staffList.length === 0) return;
    const ids = staffList.map(s => s.id);
    const from = addDays(today, -90);
    const { data } = await supabase
      .from('staff_attendance_records')
      .select('date')
      .in('staff_id', ids)
      .gte('date', from);
    setRecordedDates(new Set((data ?? []).map((r: any) => r.date as string)));
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function setStatus(staffId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [staffId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    staffList.forEach(s => { next[s.id] = status; });
    setAttendance(next);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    const records = staffList.map(s => ({
      school_id: profile?.school_id,
      staff_id: s.id,
      date: selectedDate,
      status: isHoliday ? ('holiday' as AttendanceStatus) : (attendance[s.id] || 'present'),
      is_locked: true,
    }));
    const { error } = await supabase
      .from('staff_attendance_records')
      .upsert(records, { onConflict: 'staff_id,date' });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setRecordedDates(prev => new Set([...prev, selectedDate]));
    } else {
      alert(`Error saving attendance: ${error.message}`);
    }
  }

  async function doBulkFill() {
    if (bulkDays.length === 0 || staffList.length === 0) return;
    setBulkSaving(true);
    const records = staffList.flatMap(s =>
      bulkDays.map(day => ({
        school_id: profile?.school_id,
        staff_id: s.id,
        date: day,
        status: bulkStatus,
        is_locked: true,
      }))
    );
    const { error } = await supabase
      .from('staff_attendance_records')
      .upsert(records, { onConflict: 'staff_id,date' });
    if (!error) {
      setRecordedDates(prev => new Set([...prev, ...bulkDays]));
      setBulkDone(true); setTimeout(() => setBulkDone(false), 3000);
      setBulkFrom(''); setBulkTo('');
    } else {
      alert('Bulk fill failed. Please try again.');
    }
    setBulkSaving(false);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = {
    present:  staffList.filter(s => !isHoliday && attendance[s.id] === 'present').length,
    absent:   staffList.filter(s => !isHoliday && attendance[s.id] === 'absent').length,
    late:     staffList.filter(s => !isHoliday && attendance[s.id] === 'late').length,
    half_day: staffList.filter(s => !isHoliday && attendance[s.id] === 'half_day').length,
    on_leave: staffList.filter(s => isHoliday || attendance[s.id] === 'on_leave' || (attendance[s.id] as string) === 'holiday').length,
  };

  const inputCls = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Staff Attendance</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkOpen(o => !o)}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${bulkOpen ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}>
            <Zap size={15} /> Bulk Fill
          </button>
          <button onClick={handleSave} disabled={saving || staffList.length === 0}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 space-y-4">

        {/* Role + holiday row */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Role</label>
            <select className={inputCls} value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2.5">
            <input id="is_holiday" type="checkbox" className="w-4 h-4 accent-emerald-500"
              checked={isHoliday} onChange={e => setIsHoliday(e.target.checked)} />
            <label htmlFor="is_holiday" className="text-sm font-medium text-slate-700 cursor-pointer">Mark as Holiday</label>
          </div>
        </div>

        {/* Date navigator */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setSelectedDate(prevWeekday(selectedDate))} title="Previous weekday"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="date" value={selectedDate} max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            <button onClick={() => setSelectedDate(nextWeekday(selectedDate))} disabled={selectedDate >= today} title="Next weekday"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedDate !== today && (
              <button onClick={() => setSelectedDate(today)}
                className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors">
                Today
              </button>
            )}
            {missingCount > 0 && staffList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                <CalendarDays className="w-3 h-3" /> {missingCount} day{missingCount !== 1 ? 's' : ''} unfilled
              </span>
            )}
          </div>

          {/* Recent days chip strip */}
          <div className="mt-2.5 flex gap-1.5 flex-wrap">
            {recentDays.map(d => {
              const isSelected = d === selectedDate;
              const isRecorded = recordedDates.has(d);
              const isTdy      = d === today;
              return (
                <button key={d} onClick={() => setSelectedDate(d)} title={d}
                  className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors leading-tight
                    ${isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isRecorded
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : isTdy
                          ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                          : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                    }`}>
                  <span className="font-semibold">{dayLabel(d)}</span>
                  <span className="opacity-75">{shortDate(d)}</span>
                  {isRecorded && !isSelected && <span className="text-emerald-500 text-[9px]">✓</span>}
                  {!isRecorded && !isTdy && !isSelected && <span className="text-red-400 text-[9px]">–</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mark-all quick buttons */}
        {staffList.length > 0 && !isHoliday && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium mr-1">Mark all:</span>
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => markAll(opt.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${statusColor[opt.value]} bg-slate-50 hover:bg-slate-100 border border-slate-200`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Bulk fill panel */}
        {bulkOpen && (
          <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-violet-800">Bulk Fill Staff Attendance</p>
              <p className="text-xs text-violet-600 mt-0.5">
                Fill all <span className="font-medium">{selectedRole}</span> staff with one status across a date range. Weekends are skipped automatically.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                <input type="date" value={bulkFrom} max={today} onChange={e => setBulkFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                <input type="date" value={bulkTo} min={bulkFrom || undefined} max={today} onChange={e => setBulkTo(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status for all</label>
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as AttendanceStatus)} className={inputCls}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {bulkDays.length > 0 && (
              <p className="text-xs text-violet-700 bg-violet-100 rounded-lg px-3 py-2">
                <span className="font-semibold">{bulkDays.length} weekday{bulkDays.length !== 1 ? 's' : ''}</span> will be filled for{' '}
                <span className="font-semibold">{staffList.length} staff member{staffList.length !== 1 ? 's' : ''}</span>:{' '}
                {bulkDays.slice(0, 4).map(d => `${dayLabel(d)} ${shortDate(d)}`).join(', ')}
                {bulkDays.length > 4 ? ` … +${bulkDays.length - 4} more` : ''}
              </p>
            )}
            {bulkFrom && bulkTo && bulkDays.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">No weekdays in this range.</p>
            )}
            {bulkDone && (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Bulk fill complete!
              </p>
            )}
            <div className="flex items-center gap-2">
              <button onClick={doBulkFill}
                disabled={bulkSaving || bulkDays.length === 0 || staffList.length === 0}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                <Zap size={14} />
                {bulkSaving ? 'Filling…' : `Fill ${bulkDays.length > 0 ? bulkDays.length : ''} Day${bulkDays.length !== 1 ? 's' : ''}`}
              </button>
              <button onClick={() => setBulkOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {saved && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          Attendance saved successfully.
        </div>
      )}

      {/* ── Summary cards ── */}
      {staffList.length > 0 && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Present',  count: summary.present,  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { label: 'Absent',   count: summary.absent,   color: 'bg-red-50 border-red-200 text-red-600' },
            { label: 'Late',     count: summary.late,     color: 'bg-amber-50 border-amber-200 text-amber-700' },
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

      {/* ── Staff table ── */}
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
              {staffList.map(s => (
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
                  {STATUS_OPTIONS.map(opt => {
                    const isChecked = isHoliday
                      ? (opt.value === 'on_leave' || opt.value === 'holiday')
                      : attendance[s.id] === opt.value;
                    return (
                      <td key={opt.value} className="px-3 py-4 text-center">
                        <label className={`flex flex-col items-center gap-1.5 ${isHoliday ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name={`status-${s.id}`}
                            value={opt.value}
                            checked={isChecked}
                            onChange={() => !isHoliday && setStatus(s.id, opt.value)}
                            disabled={isHoliday}
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
