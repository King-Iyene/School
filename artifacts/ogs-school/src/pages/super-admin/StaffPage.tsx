import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, Briefcase, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface StaffRecord {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
  email: string;
  subject: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  deductions: number;
  date_joined: string | null;
  status: string;
}

const ROLES = ['teacher', 'accountant', 'admin', 'librarian', 'security_officer', 'support', 'other'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors';

const emptyForm = {
  staff_id: '', first_name: '', last_name: '', role: 'teacher',
  phone: '', email: '', subject: '',
  basic_salary: '', housing_allowance: '', transport_allowance: '',
  other_allowances: '', deductions: '', date_joined: '', status: 'active',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
};

const roleColors: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-700',
  accountant: 'bg-amber-100 text-amber-700',
  admin: 'bg-emerald-100 text-emerald-700',
  librarian: 'bg-teal-100 text-teal-700',
  security_officer: 'bg-red-100 text-red-700',
  support: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600',
};

import { cache } from '../../utils/cache';

export default function StaffPage() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<StaffRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPaySlip, setShowPaySlip] = useState(false);
  const [paySlipStaff, setPaySlipStaff] = useState<StaffRecord | null>(null);
  const [paySlipMonth, setPaySlipMonth] = useState(MONTHS[new Date().getMonth()]);
  const [paySlipYear, setPaySlipYear] = useState(String(new Date().getFullYear()));
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => { loadStaff(); }, [profile?.school_id, currentPage, search, filterRole]);

  async function loadStaff() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      const cacheKey = `staff_p${currentPage}_s${pageSize}_r${filterRole}_q${search}_${profile.school_id}`;
      const result = await cache.fetch(cacheKey, async () => {
        let query = supabase
          .from('staff_records')
          .select('*', { count: 'exact' })
          .eq('school_id', profile.school_id)
          .order('created_at', { ascending: false });

        if (filterRole) query = query.eq('role', filterRole);
        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,staff_id.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error: sError } = await query.range(from, to);
        if (sError) throw sError;
        return { data: data || [], count: count || 0 };
      }, 3600000);

      setStaff(result.data);
      setTotalCount(result.count);
    } catch (err: any) {
      setError(`Fetch Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function generateStaffId(): Promise<string> {
    if (!profile?.school_id) return '';
    const year = new Date().getFullYear();
    const { count } = await supabase.from('staff_records').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id);
    const next = String((count ?? 0) + 1).padStart(3, '0');
    return `STF/${year}/${next}`;
  }

  function openAdd() {
    setEditItem(null);
    setError('');
    setForm(emptyForm);
    setShowModal(true);
    generateStaffId().then(sid => setForm(f => ({ ...f, staff_id: sid })));
  }

  function openEdit(s: StaffRecord) {
    setEditItem(s);
    setError('');
    setForm({
      staff_id: s.staff_id, first_name: s.first_name, last_name: s.last_name,
      role: s.role, phone: s.phone ?? '', email: s.email ?? '',
      subject: s.subject ?? '', basic_salary: String(s.basic_salary ?? ''),
      housing_allowance: String(s.housing_allowance ?? ''),
      transport_allowance: String(s.transport_allowance ?? ''),
      other_allowances: String(s.other_allowances ?? ''),
      deductions: String(s.deductions ?? ''),
      date_joined: s.date_joined ?? '', status: s.status,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id || !form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    setError('');
    const payload = {
      staff_id: form.staff_id.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      phone: form.phone,
      email: form.email,
      subject: form.subject,
      basic_salary: parseFloat(form.basic_salary) || 0,
      housing_allowance: parseFloat(form.housing_allowance) || 0,
      transport_allowance: parseFloat(form.transport_allowance) || 0,
      other_allowances: parseFloat(form.other_allowances) || 0,
      deductions: parseFloat(form.deductions) || 0,
      date_joined: form.date_joined || null,
      status: form.status,
      updated_at: new Date().toISOString(),
    };
    let res;
    if (editItem) {
      res = await supabase.from('staff_records').update(payload).eq('id', editItem.id);
    } else {
      res = await supabase.from('staff_records').insert({ ...payload, school_id: profile.school_id });
    }
    if (res.error) { setError(res.error.message); setSaving(false); return; }
    setShowModal(false);
    cache.invalidate('staff_');
    await loadStaff();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this staff record? This cannot be undone.')) return;
    await supabase.from('staff_records').delete().eq('id', id);
    cache.invalidate('staff_');
    await loadStaff();
  }

  function openPaySlip(s: StaffRecord) {
    setPaySlipStaff(s);
    setPaySlipMonth(MONTHS[new Date().getMonth()]);
    setPaySlipYear(String(new Date().getFullYear()));
    setShowPaySlip(true);
  }

  async function printPaySlip() {
    if (!paySlipStaff) return;
    const s = paySlipStaff;
    const { data: school } = await supabase.from('schools').select('name, address, phone').eq('id', profile!.school_id!).maybeSingle();
    const gross = (s.basic_salary || 0) + (s.housing_allowance || 0) + (s.transport_allowance || 0) + (s.other_allowances || 0);
    const net = gross - (s.deductions || 0);

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Pay Slip — ${s.first_name} ${s.last_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; max-width: 620px; margin: 30px auto; padding: 0 20px; }
    @media print { body { margin: 0; } .no-print { display: none; } }
    .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 16px; }
    .school-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .school-sub { font-size: 11px; color: #555; margin-top: 3px; }
    .payslip-title { font-size: 15px; font-weight: bold; margin-top: 10px; background: #1a1a1a; color: #fff; padding: 5px 12px; display: inline-block; }
    .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; border: 1px solid #ccc; padding: 10px 14px; margin-bottom: 14px; background: #f9f9f9; font-size: 13px; }
    .row { display: flex; justify-content: space-between; }
    .lbl { font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
    th, td { border: 1px solid #ccc; padding: 7px 10px; }
    th { background: #e8e8e8; font-weight: bold; text-align: left; }
    .amount { text-align: right; }
    .total-row td { font-weight: bold; background: #f5f5f5; }
    .net-row td { font-weight: bold; font-size: 15px; background: #1a1a1a; color: #fff; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
    .sig-item { text-align: center; width: 180px; font-size: 12px; }
    .sig-line { border-top: 1px solid #000; margin-bottom: 5px; }
    .print-btn { display: block; margin: 20px auto; padding: 10px 30px; font-size: 14px; background: #059669; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">Print Pay Slip</button>
  <div class="header">
    <div class="school-name">${school?.name ?? 'School'}</div>
    <div class="school-sub">${school?.address ?? ''} ${school?.phone ? '| Tel: ' + school.phone : ''}</div>
    <div class="payslip-title">SALARY PAY SLIP — ${paySlipMonth.toUpperCase()} ${paySlipYear}</div>
  </div>
  <div class="info-section">
    <div><span class="lbl">Staff Name:</span> ${s.first_name} ${s.last_name}</div>
    <div><span class="lbl">Staff ID:</span> ${s.staff_id}</div>
    <div><span class="lbl">Designation:</span> ${s.role.charAt(0).toUpperCase() + s.role.slice(1)}</div>
    <div><span class="lbl">Subject:</span> ${s.subject || '—'}</div>
    <div><span class="lbl">Pay Period:</span> ${paySlipMonth} ${paySlipYear}</div>
    <div><span class="lbl">Date Joined:</span> ${s.date_joined ? new Date(s.date_joined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
  </div>
  <table>
    <thead>
      <tr><th>Earnings</th><th class="amount">Amount (₦)</th></tr>
    </thead>
    <tbody>
      <tr><td>Basic Salary</td><td class="amount">${Number(s.basic_salary || 0).toLocaleString()}</td></tr>
      <tr><td>Housing Allowance</td><td class="amount">${Number(s.housing_allowance || 0).toLocaleString()}</td></tr>
      <tr><td>Transport Allowance</td><td class="amount">${Number(s.transport_allowance || 0).toLocaleString()}</td></tr>
      <tr><td>Other Allowances</td><td class="amount">${Number(s.other_allowances || 0).toLocaleString()}</td></tr>
      <tr class="total-row"><td>Gross Earnings</td><td class="amount">₦${Number(gross).toLocaleString()}</td></tr>
    </tbody>
  </table>
  <table>
    <thead>
      <tr><th>Deductions</th><th class="amount">Amount (₦)</th></tr>
    </thead>
    <tbody>
      <tr><td>Total Deductions (Tax / Pension / Others)</td><td class="amount">${Number(s.deductions || 0).toLocaleString()}</td></tr>
    </tbody>
  </table>
  <table>
    <tbody>
      <tr class="net-row"><td>NET PAY</td><td class="amount">₦${Number(net).toLocaleString()}</td></tr>
    </tbody>
  </table>
  <div class="signatures">
    <div class="sig-item">
      <div class="sig-line"></div>
      Staff Signature &amp; Date
    </div>
    <div class="sig-item">
      <div class="sig-line"></div>
      Accountant's Signature
    </div>
    <div class="sig-item">
      <div class="sig-line"></div>
      Principal's Signature
    </div>
  </div>
</body>
</html>`);
    win.document.close();
    setShowPaySlip(false);
  }

  const netPay = (s: StaffRecord) => (s.basic_salary||0) + (s.housing_allowance||0) + (s.transport_allowance||0) + (s.other_allowances||0) - (s.deductions||0);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Staff</h2>
          <p className="text-slate-500 text-sm">Manage staff records and pay slips</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search by name, ID, email..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        </div>
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setCurrentPage(1); }} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['SL', 'Staff ID', 'Full Name', 'Role', 'Phone', 'Email', 'Subject', 'Date Joined', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={10} className="text-center py-10 text-slate-400">Loading...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10">
                <Briefcase className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">{totalCount === 0 ? 'No staff records yet. Click Add Staff to begin.' : 'No staff match the filter.'}</p>
              </td></tr>
            ) : staff.map((s, idx) => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-700">{s.staff_id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                      {s.first_name[0]}{s.last_name[0]}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[s.role] ?? 'bg-slate-100 text-slate-600'}`}>
                    {s.role.charAt(0).toUpperCase() + s.role.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.phone || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.email || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{s.subject || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{s.date_joined ? new Date(s.date_joined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openPaySlip(s)} title="Pay Slip" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Printer className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} staff member{totalCount !== 1 ? 's' : ''}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <div className="text-sm font-medium text-slate-600 px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Staff' : 'Add Staff'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name <span className="text-red-500">*</span></label>
              <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={inputCls} placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={inputCls} placeholder="Last name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff ID</label>
              <input value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={`${inputCls} bg-white`}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="Phone number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="Email address" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject {form.role === 'teacher' && <span className="text-blue-500">(Teacher)</span>}</label>
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputCls} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date Joined</label>
              <input type="date" value={form.date_joined} onChange={e => setForm({ ...form, date_joined: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="pt-1 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Salary Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Basic Salary (₦)</label>
                <input type="number" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: e.target.value })} className={inputCls} placeholder="0" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Housing Allowance (₦)</label>
                <input type="number" value={form.housing_allowance} onChange={e => setForm({ ...form, housing_allowance: e.target.value })} className={inputCls} placeholder="0" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transport Allowance (₦)</label>
                <input type="number" value={form.transport_allowance} onChange={e => setForm({ ...form, transport_allowance: e.target.value })} className={inputCls} placeholder="0" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Other Allowances (₦)</label>
                <input type="number" value={form.other_allowances} onChange={e => setForm({ ...form, other_allowances: e.target.value })} className={inputCls} placeholder="0" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deductions (₦)</label>
                <input type="number" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} className={inputCls} placeholder="0" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${inputCls} bg-white`}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.first_name.trim() || !form.last_name.trim()} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editItem ? 'Update Staff' : 'Add Staff'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPaySlip} onClose={() => setShowPaySlip(false)} title="Generate Pay Slip">
        <div className="space-y-4">
          {paySlipStaff && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-sm font-semibold text-slate-800">{paySlipStaff.first_name} {paySlipStaff.last_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{paySlipStaff.staff_id} · {paySlipStaff.role.charAt(0).toUpperCase() + paySlipStaff.role.slice(1)}</p>
              <p className="text-sm font-semibold text-emerald-600 mt-1">Net Pay: ₦{netPay(paySlipStaff).toLocaleString()}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
              <select value={paySlipMonth} onChange={e => setPaySlipMonth(e.target.value)} className={`${inputCls} bg-white`}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
              <input value={paySlipYear} onChange={e => setPaySlipYear(e.target.value)} className={inputCls} placeholder="2026" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowPaySlip(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={printPaySlip} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">
              <Printer className="w-4 h-4" /> Print Pay Slip
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
