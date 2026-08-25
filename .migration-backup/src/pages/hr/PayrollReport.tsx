import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface PayrollRow {
  id: string;
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
  profiles?: {
    first_name: string;
    last_name: string;
    role: string;
  };
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

function roleBadge(role: string) {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700';
    case 'teacher': return 'bg-blue-100 text-blue-700';
    case 'accountant': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default function PayrollReport() {
  const { user } = useAuth();
  const currentDate = new Date();
  const [filterRole, setFilterRole] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('payroll_records')
      .select('*, profiles(first_name, last_name, role)')
      .eq('month', filterMonth)
      .eq('year', filterYear)
      .order('created_at', { ascending: false });

    if (filterRole) {
      query = query.eq('profiles.role', filterRole);
    }

    const { data } = await query;
    if (data) {
      const filtered = filterRole
        ? data.filter((r) => r.profiles?.role === filterRole)
        : data;
      setRows(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterRole, filterMonth, filterYear]);

  const totals = {
    basic_salary: rows.reduce((sum, r) => sum + (r.basic_salary || 0), 0),
    allowances: rows.reduce((sum, r) => sum + (r.allowances || 0), 0),
    deductions: rows.reduce((sum, r) => sum + (r.deductions || 0), 0),
    net_salary: rows.reduce((sum, r) => sum + (r.net_salary || 0), 0),
  };

  const staffName = (r: PayrollRow) =>
    r.profiles ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || 'Unknown' : 'Unknown';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Payroll Report</h1>
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
              <option value="">All Roles</option>
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

      {rows.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Basic', value: totals.basic_salary, color: 'text-slate-800' },
            { label: 'Total Allowances', value: totals.allowances, color: 'text-emerald-600' },
            { label: 'Total Deductions', value: totals.deductions, color: 'text-red-500' },
            { label: 'Total Net Salary', value: totals.net_salary, color: 'text-emerald-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No payroll records found for the selected filters.</div>
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
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Payment Date</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{staffName(r)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(r.profiles?.role || '')}`}>
                      {(r.profiles?.role || '-').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-700">{r.basic_salary.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-emerald-600">{r.allowances.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-red-500">{r.deductions.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{r.net_salary.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-slate-600">{r.payment_date || '-'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-5 py-3.5 font-bold text-slate-800" colSpan={2}>Grand Total</td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">{totals.basic_salary.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{totals.allowances.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right font-bold text-red-500">{totals.deductions.toLocaleString()}</td>
                <td className="px-5 py-3.5 text-right font-bold text-emerald-700">{totals.net_salary.toLocaleString()}</td>
                <td className="px-5 py-3.5" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
