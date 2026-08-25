import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  basic_salary?: number;
}

interface PayrollRecord {
  id?: string;
  staff_id: string;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  notes?: string;
  status: 'pending' | 'paid';
  payment_date?: string;
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

const inputClass =
  'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

function roleBadge(role: string) {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700';
    case 'teacher': return 'bg-blue-100 text-blue-700';
    case 'accountant': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default function Payroll() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [filterRole, setFilterRole] = useState('teacher');
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [payrollMap, setPayrollMap] = useState<Record<string, PayrollRecord>>({});
  const [loading, setLoading] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const [genForm, setGenForm] = useState({
    basic_salary: '',
    allowances: '',
    deductions: '',
    notes: '',
    status: 'pending' as 'pending' | 'paid',
    payment_date: '',
  });

  const netSalary =
    (Number(genForm.basic_salary) || 0) +
    (Number(genForm.allowances) || 0) -
    (Number(genForm.deductions) || 0);

  const fetchData = async () => {
    if (!filterRole) return;
    setLoading(true);
    const [staffRes, payrollRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name, role, basic_salary')
        .eq('role', filterRole)
        .order('first_name'),
      supabase
        .from('payroll_records')
        .select('*')
        .eq('month', filterMonth)
        .eq('year', filterYear),
    ]);
    if (staffRes.data) setStaffList(staffRes.data);
    if (payrollRes.data) {
      const map: Record<string, PayrollRecord> = {};
      payrollRes.data.forEach((p) => { map[p.staff_id] = p; });
      setPayrollMap(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterRole, filterMonth, filterYear]);

  const openGenerate = (staff: Profile) => {
    setSelectedStaff(staff);
    const existing = payrollMap[staff.id];
    if (existing) {
      setGenForm({
        basic_salary: String(existing.basic_salary),
        allowances: String(existing.allowances),
        deductions: String(existing.deductions),
        notes: existing.notes || '',
        status: existing.status,
        payment_date: existing.payment_date || '',
      });
    } else {
      setGenForm({
        basic_salary: staff.basic_salary != null ? String(staff.basic_salary) : '',
        allowances: '0',
        deductions: '0',
        notes: '',
        status: 'pending',
        payment_date: '',
      });
    }
    setError('');
    setGenerateModalOpen(true);
  };

  const handleSavePayroll = async () => {
    if (!selectedStaff) return;
    if (!genForm.basic_salary) { setError('Basic salary is required.'); return; }
    setSaving(true);
    setError('');
    const payload: PayrollRecord = {
      staff_id: selectedStaff.id,
      month: filterMonth,
      year: filterYear,
      basic_salary: Number(genForm.basic_salary),
      allowances: Number(genForm.allowances) || 0,
      deductions: Number(genForm.deductions) || 0,
      net_salary: netSalary,
      notes: genForm.notes.trim() || undefined,
      status: genForm.status,
      payment_date: genForm.payment_date || undefined,
    };
    const existing = payrollMap[selectedStaff.id];
    if (existing?.id) {
      const { error: err } = await supabase.from('payroll_records').update(payload).eq('id', existing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('payroll_records').upsert(
        { ...payload },
        { onConflict: 'staff_id,month,year' }
      );
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setGenerateModalOpen(false);
    fetchData();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Payroll</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Role</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Month</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Year</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
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
        <div className="text-center py-16 text-slate-400 text-sm">No staff found for the selected filters.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Staff</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Role</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Basic Salary</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Allowances</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Deductions</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Net Salary</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.map((s) => {
                const pr = payrollMap[s.id];
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {`${s.first_name || ''} ${s.last_name || ''}`.trim() || 'N/A'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(s.role)}`}>
                        {s.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-700">
                      {pr ? pr.basic_salary.toLocaleString() : (s.basic_salary != null ? s.basic_salary.toLocaleString() : '-')}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{pr ? pr.allowances.toLocaleString() : '-'}</td>
                    <td className="px-5 py-3.5 text-right text-red-500">{pr ? pr.deductions.toLocaleString() : '-'}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{pr ? pr.net_salary.toLocaleString() : '-'}</td>
                    <td className="px-5 py-3.5">
                      {pr ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pr.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {pr.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Not Generated</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openGenerate(s)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {pr ? 'Edit' : 'Generate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={generateModalOpen} onClose={() => setGenerateModalOpen(false)} title={`Generate Payroll — ${selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : ''}`}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Basic Salary</label>
            <input
              type="number"
              className={inputClass}
              placeholder="e.g. 5000"
              value={genForm.basic_salary}
              onChange={(e) => setGenForm({ ...genForm, basic_salary: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Allowances</label>
              <input
                type="number"
                className={inputClass}
                placeholder="0"
                value={genForm.allowances}
                onChange={(e) => setGenForm({ ...genForm, allowances: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Deductions</label>
              <input
                type="number"
                className={inputClass}
                placeholder="0"
                value={genForm.deductions}
                onChange={(e) => setGenForm({ ...genForm, deductions: e.target.value })}
              />
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-emerald-700">Net Salary</span>
              <span className="text-lg font-bold text-emerald-700">{netSalary.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select
              className={inputClass}
              value={genForm.status}
              onChange={(e) => setGenForm({ ...genForm, status: e.target.value as 'pending' | 'paid' })}
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {genForm.status === 'paid' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Date</label>
              <input
                type="date"
                className={inputClass}
                value={genForm.payment_date}
                onChange={(e) => setGenForm({ ...genForm, payment_date: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className={inputClass}
              placeholder="Optional notes..."
              rows={2}
              value={genForm.notes}
              onChange={(e) => setGenForm({ ...genForm, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setGenerateModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePayroll}
              disabled={saving}
              className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Payroll'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
