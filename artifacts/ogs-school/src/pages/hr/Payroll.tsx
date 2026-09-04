import { useState, useEffect, useRef } from 'react';
import { Printer, X, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import type { TenantSettings } from '../../lib/types';
import Modal from '../../components/common/Modal';

interface StaffProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  basic_salary: number | null;
  staff_id: string;
  phone?: string;
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

interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
  note: string;
}

const MONTHS = [
  { value: 1, label: 'January' },  { value: 2, label: 'February' },
  { value: 3, label: 'March' },    { value: 4, label: 'April' },
  { value: 5, label: 'May' },      { value: 6, label: 'June' },
  { value: 7, label: 'July' },     { value: 8, label: 'August' },
  { value: 9, label: 'September' },{ value: 10, label: 'October' },
  { value: 11, label: 'November' },{ value: 12, label: 'December' },
];

const STAFF_ROLES: { value: string; label: string }[] = [
  { value: 'accountant',         label: 'Accountant' },
  { value: 'admin',              label: 'Admin' },
  { value: 'admin_support',      label: 'Admin Support' },
  { value: 'cleaner',            label: 'Cleaner' },
  { value: 'head_teacher',       label: 'Head Teacher' },
  { value: 'matron',             label: 'Matron' },
  { value: 'non_teaching_staff', label: 'Non-Teaching Staff' },
  { value: 'nur_prim_teacher',   label: 'Nur & Prim Teacher' },
  { value: 'porter',             label: 'Porter' },
  { value: 'principal',          label: 'Principal' },
  { value: 'security_officer',   label: 'Security Officer' },
  { value: 'super_admin',        label: 'Super Admin' },
  { value: 'teacher',            label: 'Teacher' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(STAFF_ROLES.map(r => [r.value, r.label]));

const inputClass = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';
const fmt = (n: number) => `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parseNotes(notes?: string): BankDetails {
  try {
    const p = JSON.parse(notes ?? '{}');
    return {
      bank_name: p.bank_name ?? '',
      account_number: p.account_number ?? '',
      account_name: p.account_name ?? '',
      note: p.note ?? '',
    };
  } catch {
    return { bank_name: '', account_number: '', account_name: '', note: notes ?? '' };
  }
}

function buildNotes(b: BankDetails): string {
  return JSON.stringify(b);
}

// ─── Salary Voucher ───────────────────────────────────────────────────────────

interface VoucherProps {
  record: PayrollRecord;
  staff: StaffProfile;
  settings: TenantSettings;
  onClose: () => void;
}

function SalaryVoucher({ record, staff, settings, onClose }: VoucherProps) {
  const bank = parseNotes(record.notes);
  const monthLabel = MONTHS.find(m => m.value === record.month)?.label ?? '';
  const roleLabel = ROLE_LABEL[staff.role] ?? staff.role.replace(/_/g, ' ');
  const schoolName = settings.school_name;

  const handlePrint = () => {
    const origin = window.location.origin;
    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return;
    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join(' | ');
    win.document.write(`<!DOCTYPE html><html><head>
<title>Salary Voucher – ${staff.first_name} ${staff.last_name} – ${monthLabel} ${record.year}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:36px;color:#111;font-size:13px}
  .voucher-title{background:${primaryColor};color:#fff;text-align:center;font-size:14px;font-weight:bold;letter-spacing:3px;padding:8px 0;margin:14px 0 6px;border-radius:3px}
  .period{text-align:center;font-size:13px;color:#444;margin-bottom:16px}
  hr{border:none;border-top:1.5px solid ${primaryColor};margin:14px 0}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:16px}
  .field-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.8px}
  .field-value{font-size:13px;font-weight:600;color:#111;margin-top:2px}
  .bank-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:12px 16px;margin-bottom:16px}
  .bank-title{font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead th{background:#f1f5f9;padding:8px 12px;font-size:11px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0}
  thead th:last-child{text-align:right}
  tbody td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
  tbody td:last-child{text-align:right}
  .total-row td{background:${primaryColor};color:#fff;font-weight:bold;font-size:15px;border-radius:2px}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:44px}
  .sig-block{text-align:center}
  .sig-line{border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555;margin-top:32px}
  .note-text{font-size:12px;color:#555;margin-bottom:14px}
  @media print{body{padding:16px}}
</style>
</head><body>
  <div style="margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px">
      <img src="${settings.logo_url || origin + '/default-logo.png'}" alt="${schoolName} Logo" style="width:70px;height:70px;object-fit:contain"/>
      <div style="flex:1;text-align:center;padding:0 12px">
        <div style="font-size:16pt;font-weight:900;letter-spacing:1.5px;color:${primaryColor};font-family:'Times New Roman',serif;line-height:1.1">${schoolName.toUpperCase()}</div>
        ${settings.motto ? `<div style="font-size:8.5pt;font-style:italic;color:${secondaryColor};font-weight:600;margin:3px 0">${settings.motto}</div>` : ''}
        ${settings.address ? `<div style="font-size:8pt;color:#333;line-height:1.5">${settings.address}</div>` : ''}
        <div style="font-size:8.5pt;font-weight:bold;color:${primaryColor};margin-top:2px">Office of the Principal</div>
        ${contactLine ? `<div style="font-size:7pt;color:#555;margin-top:2px">${contactLine}</div>` : ''}
      </div>
      <div style="width:65px"></div>
    </div>
    <div style="border-top:3px solid ${primaryColor};border-bottom:1px solid ${secondaryColor};height:4px;margin:0 0 10px 0"></div>
  </div>
  <div class="voucher-title">S A L A R Y &nbsp; V O U C H E R</div>
  <div class="period">${monthLabel} ${record.year}</div>
  <hr/>
  <div class="grid2">
    <div><div class="field-label">Staff Name</div><div class="field-value">${staff.first_name} ${staff.last_name}</div></div>
    <div><div class="field-label">Designation / Role</div><div class="field-value">${roleLabel}</div></div>
    <div><div class="field-label">Staff ID</div><div class="field-value">${staff.staff_id || '—'}</div></div>
    <div><div class="field-label">Status</div><div class="field-value">${record.status === 'paid' ? 'PAID' : 'PENDING'}${record.payment_date ? ' · ' + record.payment_date : ''}</div></div>
  </div>
  ${bank.bank_name || bank.account_number ? `
  <div class="bank-box">
    <div class="bank-title">Bank Details</div>
    <div class="grid2" style="margin-bottom:0">
      <div><div class="field-label">Bank Name</div><div class="field-value">${bank.bank_name || '—'}</div></div>
      <div><div class="field-label">Account Number</div><div class="field-value">${bank.account_number || '—'}</div></div>
      <div style="grid-column:1/-1"><div class="field-label">Account Name</div><div class="field-value">${bank.account_name || '—'}</div></div>
    </div>
  </div>` : ''}
  <table>
    <thead><tr><th>Description</th><th>Amount (₦)</th></tr></thead>
    <tbody>
      <tr><td>Basic Salary</td><td>${record.basic_salary.toLocaleString(undefined, {minimumFractionDigits:2})}</td></tr>
      <tr><td>Allowances</td><td>+ ${record.allowances.toLocaleString(undefined, {minimumFractionDigits:2})}</td></tr>
      <tr><td>Deductions</td><td>− ${record.deductions.toLocaleString(undefined, {minimumFractionDigits:2})}</td></tr>
    </tbody>
    <tfoot><tr class="total-row"><td>Net Salary</td><td>₦ ${(record.basic_salary + record.allowances - record.deductions).toLocaleString(undefined, {minimumFractionDigits:2})}</td></tr></tfoot>
  </table>
  ${bank.note ? `<p class="note-text"><strong>Notes:</strong> ${bank.note}</p>` : ''}
  <div class="sigs">
    <div class="sig-block"><div class="sig-line">Prepared By</div></div>
    <div class="sig-block">
      <div class="sig-line">Approved By</div>
      <div style="font-size:10px;color:#555;margin-top:5px">Principal</div>
    </div>
    <div class="sig-block"><div class="sig-line">Staff Signature</div></div>
  </div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border sticky top-0 bg-app-surface rounded-t-2xl">
          <h2 className="text-base font-bold text-app-text">Salary Voucher</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-1.5 rounded-xl transition-colors">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center pb-3 border-b-2 border-slate-800">
            <p className="text-lg font-bold text-app-text uppercase tracking-wider">{schoolName}</p>
            {settings.address && <p className="text-xs text-app-text-muted mt-0.5">{settings.address}</p>}
            <div className="inline-block mt-2 bg-slate-800 text-white text-xs font-bold tracking-widest px-6 py-1.5 rounded">
              SALARY VOUCHER
            </div>
            <p className="text-sm text-app-text-muted mt-1.5">{monthLabel} {record.year}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Staff Name', value: `${staff.first_name} ${staff.last_name}` },
              { label: 'Role', value: roleLabel },
              { label: 'Staff ID', value: staff.staff_id || '—' },
              { label: 'Status', value: record.status === 'paid' ? 'PAID' : 'PENDING' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs text-app-text-muted uppercase tracking-wide">{f.label}</p>
                <p className="font-semibold text-app-text mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>

          {(bank.bank_name || bank.account_number) && (
            <div className="bg-app-surface-alt border border-app-border rounded-xl p-3">
              <p className="text-xs font-bold text-app-text-muted uppercase tracking-wide mb-2">Bank Details</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-app-text-muted">Bank</p><p className="font-medium text-app-text">{bank.bank_name || '—'}</p></div>
                <div><p className="text-xs text-app-text-muted">Account No.</p><p className="font-medium text-app-text font-mono">{bank.account_number || '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-app-text-muted">Account Name</p><p className="font-medium text-app-text">{bank.account_name || '—'}</p></div>
              </div>
            </div>
          )}

          <div className="border border-app-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                <tr><td className="px-4 py-2.5 text-app-text">Basic Salary</td><td className="px-4 py-2.5 text-right text-app-text">{fmt(record.basic_salary)}</td></tr>
                <tr><td className="px-4 py-2.5 text-app-text">Allowances</td><td className="px-4 py-2.5 text-right text-emerald-600">+ {fmt(record.allowances)}</td></tr>
                <tr><td className="px-4 py-2.5 text-app-text">Deductions</td><td className="px-4 py-2.5 text-right text-red-500">− {fmt(record.deductions)}</td></tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td className="px-4 py-3 font-bold">Net Salary</td>
                  <td className="px-4 py-3 text-right font-bold text-base">{fmt(record.basic_salary + record.allowances - record.deductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {bank.note && (
            <p className="text-sm text-app-text-muted"><span className="font-medium text-app-text-muted">Notes: </span>{bank.note}</p>
          )}

          <div className="grid grid-cols-3 gap-4 pt-2">
            {['Prepared By', 'Approved By', 'Staff Signature'].map(label => (
              <div key={label} className="text-center">
                <div className="h-8 border-b border-slate-400 mb-1" />
                <p className="text-xs text-app-text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Payroll Component ───────────────────────────────────────────────────

export default function Payroll() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const currentDate = new Date();
  const [filterRole, setFilterRole] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [search, setSearch] = useState('');
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [payrollMap, setPayrollMap] = useState<Record<string, PayrollRecord>>({});
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [voucherRecord, setVoucherRecord] = useState<PayrollRecord | null>(null);
  const [voucherStaff, setVoucherStaff] = useState<StaffProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'sheet'>('records');
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [selectedPayrollStaffIds, setSelectedPayrollStaffIds] = useState<Set<string>>(new Set());
  const [autoGenResult, setAutoGenResult] = useState<{ generated: number; noSalary: string[] } | null>(null);
  const fetchRequestId = useRef(0);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const [form, setForm] = useState({
    basic_salary: '',
    allowances: '0',
    deductions: '0',
    bank_name: '',
    account_number: '',
    account_name: '',
    note: '',
    status: 'pending' as 'pending' | 'paid',
    payment_date: '',
    updateSalary: false,
  });

  const netSalary =
    (Number(form.basic_salary) || 0) +
    (Number(form.allowances) || 0) -
    (Number(form.deductions) || 0);

  useEffect(() => { fetchData(); }, [filterRole, filterMonth, filterYear, profile?.school_id]);

  useEffect(() => {
    setSelectedPayrollStaffIds(new Set());
    setAutoGenResult(null);
  }, [filterRole, filterMonth, filterYear, search]);

  async function fetchData() {
    if (!profile?.school_id) return false;
    const requestId = ++fetchRequestId.current;
    setLoading(true);

    let staffQ = supabase
      .from('profiles')
      .select('id, first_name, last_name, role, basic_salary, staff_id, phone')
      .eq('school_id', profile.school_id)
      .eq('is_active', true)
      .not('role', 'in', '("student","parent","diocesan_official")')
      .order('first_name');

    if (filterRole) staffQ = staffQ.eq('role', filterRole);

    const [staffRes, payrollRes] = await Promise.all([
      staffQ,
      supabase
        .from('payroll_records')
        .select('*')
        .eq('month', filterMonth)
        .eq('year', filterYear),
    ]);

    if (requestId !== fetchRequestId.current) return false;

    if (staffRes.error || payrollRes.error) {
      setStaffList([]);
      setPayrollMap({});
      setSelectedPayrollStaffIds(new Set());
      setPageError(
        `Could not load payroll data: ${staffRes.error?.message ?? payrollRes.error?.message ?? 'Unknown error'}`
      );
      setLoading(false);
      return false;
    }

    const staff = staffRes.data ?? [];
    const map: Record<string, PayrollRecord> = {};
    (payrollRes.data ?? []).forEach(p => { map[p.staff_id] = p; });
    setStaffList(staff);
    setPayrollMap(map);
    setPageError('');
    const currentStaffIds = new Set(staff.map(item => item.id));
    setSelectedPayrollStaffIds(previous => new Set(
      [...previous].filter(staffId => currentStaffIds.has(staffId) && !map[staffId])
    ));
    setLoading(false);
    return true;
  }

  function handlePrintSheet() {
    const sheetRows = displayed.filter(s => payrollMap[s.id]);
    const total = sheetRows.reduce((sum, s) => { const r = payrollMap[s.id]; return sum + (r ? (r.basic_salary + r.allowances - r.deductions) : 0); }, 0);
    const origin = window.location.origin;
    const win = window.open('', '_blank', 'width=1050,height=1100');
    if (!win) return;
    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join(' &nbsp;|&nbsp; ');
    win.document.write(`<!DOCTYPE html><html><head>
<title>Salary Sheet – ${monthLabel} ${filterYear}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:36px;font-size:12px;color:#111}
.title-bar{background:${primaryColor};color:#fff;text-align:center;padding:9px;font-size:13px;font-weight:bold;letter-spacing:2px;margin:14px 0 20px;border-radius:3px}
table{width:100%;border-collapse:collapse;font-size:11px}
thead th{background:#f1f5f9;padding:8px 7px;text-align:left;font-size:10px;color:#64748b;border-bottom:2px solid #e2e8f0;white-space:nowrap}
thead th.r{text-align:right}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:7px 7px;border-bottom:1px solid #e8edf2}
tbody td.r{text-align:right}
.total-row td{font-weight:bold;background:${primaryColor};color:#fff;padding:9px 7px;font-size:12px}
.total-row td.r{text-align:right}
.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:48px;margin-top:64px}
.sig-line{border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555;text-align:center;margin-top:44px}
.date{text-align:right;font-size:10px;color:#999;margin-bottom:8px}
@media print{body{padding:16px}}
</style></head><body>
<div style="margin-bottom:16px">
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px">
    <img src="${settings.logo_url || origin + '/default-logo.png'}" alt="${settings.school_name} Logo" style="width:82px;height:82px;object-fit:contain"/>
    <div style="flex:1;text-align:center;padding:0 16px">
      <div style="font-size:20pt;font-weight:900;letter-spacing:1.5px;color:${primaryColor};font-family:'Times New Roman',serif;line-height:1.1">${settings.school_name.toUpperCase()}</div>
      ${settings.motto ? `<div style="font-size:9pt;font-style:italic;color:${secondaryColor};font-weight:600;margin:3px 0">${settings.motto}</div>` : ''}
      ${settings.address ? `<div style="font-size:8.5pt;color:#333;line-height:1.5">${settings.address}</div>` : ''}
      <div style="font-size:9pt;font-weight:bold;color:${primaryColor};margin-top:2px">Office of the Principal</div>
      ${contactLine ? `<div style="font-size:7.5pt;color:#555;margin-top:2px">${contactLine}</div>` : ''}
    </div>
    <div style="width:76px"></div>
  </div>
  <div style="border-top:3px solid ${primaryColor};border-bottom:1px solid ${secondaryColor};height:4px;margin:0 0 12px 0"></div>
</div>
<div class="title-bar">MONTHLY SALARY PAYMENT SHEET &nbsp;—&nbsp; ${monthLabel.toUpperCase()} ${filterYear}</div>
<div class="date">Printed: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
<table>
<thead><tr>
  <th style="width:32px">S/N</th>
  <th>Staff Name</th>
  <th>Role</th>
  <th>Bank</th>
  <th>Account Name</th>
  <th>Account Number</th>
  <th class="r">Net Salary (₦)</th>
</tr></thead>
<tbody>
${sheetRows.map((s, i) => {
  const pr = payrollMap[s.id];
  const bank = parseNotes(pr?.notes);
  const rl = ROLE_LABEL[s.role] ?? s.role.replace(/_/g, ' ');
  return `<tr>
    <td>${i + 1}</td>
    <td>${s.first_name} ${s.last_name}</td>
    <td>${rl}</td>
    <td>${bank.bank_name || '—'}</td>
    <td>${bank.account_name || '—'}</td>
    <td>${bank.account_number || '—'}</td>
    <td class="r">${((pr?.basic_salary ?? 0) + (pr?.allowances ?? 0) - (pr?.deductions ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
  </tr>`;
}).join('')}
</tbody>
<tfoot><tr class="total-row">
  <td colspan="6">GRAND TOTAL (${sheetRows.length} staff)</td>
  <td class="r">&#8358; ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
</tr></tfoot>
</table>
<div class="sigs">
  <div><div class="sig-line">Prepared By (Accountant)</div></div>
  <div>
    <div class="sig-line">Approved By</div>
    <div style="font-size:10px;color:#555;text-align:center;margin-top:5px">Principal</div>
  </div>
  <div><div class="sig-line">Bank Receiving Officer</div></div>
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 350);
  }

  async function openGenerate(staff: StaffProfile) {
    setSelectedStaff(staff);
    const existing = payrollMap[staff.id];

    if (existing) {
      const bank = parseNotes(existing.notes);
      setForm({
        basic_salary: String(existing.basic_salary),
        allowances: String(existing.allowances),
        deductions: String(existing.deductions),
        bank_name: bank.bank_name,
        account_number: bank.account_number,
        account_name: bank.account_name,
        note: bank.note,
        status: existing.status,
        payment_date: existing.payment_date || '',
        updateSalary: false,
      });
    } else {
      // Try to get bank details from most recent previous record
      let bankDetails: BankDetails = { bank_name: '', account_number: '', account_name: '', note: '' };
      const { data: prev } = await supabase
        .from('payroll_records')
        .select('notes')
        .eq('staff_id', staff.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev?.notes) bankDetails = parseNotes(prev.notes);

      setForm({
        basic_salary: staff.basic_salary != null ? String(staff.basic_salary) : '',
        allowances: '0',
        deductions: '0',
        bank_name: bankDetails.bank_name,
        account_number: bankDetails.account_number,
        account_name: bankDetails.account_name,
        note: bankDetails.note,
        status: 'pending',
        payment_date: '',
        updateSalary: false,
      });
    }
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!selectedStaff) return;
    if (autoGenerating) {
      setError('Wait for the selected payroll generation to finish before editing an individual record.');
      return;
    }
    if (!form.basic_salary) { setError('Basic salary is required.'); return; }
    setSaving(true);
    setError('');

    const notesStr = buildNotes({
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim(),
      account_name: form.account_name.trim(),
      note: form.note.trim(),
    });

    const payload: PayrollRecord = {
      staff_id: selectedStaff.id,
      month: filterMonth,
      year: filterYear,
      basic_salary: Number(form.basic_salary),
      allowances: Number(form.allowances) || 0,
      deductions: Number(form.deductions) || 0,
      net_salary: netSalary,
      notes: notesStr,
      status: form.status,
      payment_date: form.payment_date || undefined,
    };

    const existing = payrollMap[selectedStaff.id];
    let saveErr = null;
    if (existing?.id) {
      const { error: e } = await supabase.from('payroll_records').update(payload).eq('id', existing.id);
      saveErr = e;
    } else {
      const { error: e } = await supabase.from('payroll_records').upsert(payload, { onConflict: 'staff_id,month,year' });
      saveErr = e;
    }

    if (saveErr) { setError(saveErr.message); setSaving(false); return; }

    if (form.updateSalary) {
      await supabase.from('profiles').update({ basic_salary: Number(form.basic_salary) }).eq('id', selectedStaff.id);
      setStaffList(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, basic_salary: Number(form.basic_salary) } : s));
    }

    setSaving(false);
    setModalOpen(false);
    fetchData();
  }

  async function handleGenerateSelected() {
    const selectedForGeneration = staffList.filter(
      staff => selectedPayrollStaffIds.has(staff.id) && !payrollMap[staff.id]
    );

    if (selectedForGeneration.length === 0) {
      setPageError('Select at least one staff member who does not already have a payroll record.');
      return;
    }

    const noSalaryStaff = selectedForGeneration.filter(s => !s.basic_salary || s.basic_salary <= 0);
    const withSalary = selectedForGeneration.filter(s => s.basic_salary && s.basic_salary > 0);

    if (withSalary.length === 0) {
      setAutoGenResult({
        generated: 0,
        noSalary: noSalaryStaff.map(s => `${s.first_name} ${s.last_name}`),
      });
      return;
    }

    if (!confirm(`Generate ${monthLabel} ${filterYear} payroll for ${withSalary.length} selected staff member${withSalary.length !== 1 ? 's' : ''}?${noSalaryStaff.length > 0 ? `\n\n${noSalaryStaff.length} selected staff member${noSalaryStaff.length !== 1 ? 's have' : ' has'} no salary set and will be skipped.` : ''}`)) return;

    setAutoGenerating(true);
    setAutoGenResult(null);
    setPageError('');

    // Fetch most recent previous payroll records for bank details
    const staffIds = withSalary.map(s => s.id);
    const { data: prevRecords, error: previousRecordsError } = await supabase
      .from('payroll_records')
      .select('staff_id, notes, year, month')
      .in('staff_id', staffIds)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (previousRecordsError) {
      setAutoGenerating(false);
      setPageError('Could not load previous payroll details: ' + previousRecordsError.message);
      return;
    }

    // Build map: staffId → most recent notes
    const prevNotesMap: Record<string, string> = {};
    (prevRecords ?? []).forEach(r => {
      if (!prevNotesMap[r.staff_id]) prevNotesMap[r.staff_id] = r.notes ?? '';
    });

    // Build payroll records to insert
    const records: PayrollRecord[] = withSalary.map(s => {
      const basic = s.basic_salary ?? 0;
      return {
        staff_id: s.id,
        month: filterMonth,
        year: filterYear,
        basic_salary: basic,
        allowances: 0,
        deductions: 0,
        net_salary: basic,
        notes: prevNotesMap[s.id] ?? buildNotes({ bank_name: '', account_number: '', account_name: '', note: '' }),
        status: 'pending',
      };
    });

    const { data: insertedRecords, error: insertErr } = await supabase
      .from('payroll_records')
      .insert(records)
      .select('staff_id');

    setAutoGenerating(false);
    if (insertErr) {
      await fetchData();
      setPageError('Selected payroll generation failed: ' + insertErr.message);
    } else if (!insertedRecords || insertedRecords.length !== records.length) {
      await fetchData();
      setPageError('Payroll could not be created for every selected staff member. The list has been refreshed; review it and try again.');
    } else {
      setAutoGenResult({
        generated: insertedRecords.length,
        noSalary: noSalaryStaff.map(s => `${s.first_name} ${s.last_name}`),
      });
      setSelectedPayrollStaffIds(new Set());
      await fetchData();
    }
  }

  const displayed = staffList.filter(s =>
    !search || `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );
  const selectableDisplayed = displayed.filter(s => !payrollMap[s.id]);
  const allSelectableDisplayedSelected = selectableDisplayed.length > 0
    && selectableDisplayed.every(s => selectedPayrollStaffIds.has(s.id));
  const sheetRows = displayed.filter(s => payrollMap[s.id]);

  function togglePayrollStaff(staffId: string) {
    setSelectedPayrollStaffIds(previous => {
      const next = new Set(previous);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }

  function toggleAllDisplayedStaff() {
    setSelectedPayrollStaffIds(previous => {
      const next = new Set(previous);
      if (allSelectableDisplayedSelected) {
        selectableDisplayed.forEach(staff => next.delete(staff.id));
      } else {
        selectableDisplayed.forEach(staff => next.add(staff.id));
      }
      return next;
    });
  }

  const existingRecord = selectedStaff ? payrollMap[selectedStaff.id] : undefined;
  const salaryChanged = selectedStaff && form.basic_salary &&
    Number(form.basic_salary) !== (selectedStaff.basic_salary ?? undefined);

  const monthLabel = MONTHS.find(m => m.value === filterMonth)?.label ?? '';

  const summaryPaid = displayed.filter(s => payrollMap[s.id]?.status === 'paid').length;
  const summaryPending = displayed.filter(s => payrollMap[s.id]?.status === 'pending').length;
  const summaryNone = displayed.filter(s => !payrollMap[s.id]).length;
  const totalNet = displayed.reduce((sum, s) => { const r = payrollMap[s.id]; return sum + (r ? (r.basic_salary + r.allowances - r.deductions) : 0); }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Payroll</h1>
          <p className="text-sm text-app-text-muted mt-0.5">{monthLabel} {filterYear}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'records' && (
            <button
              onClick={handleGenerateSelected}
              disabled={autoGenerating || loading || selectedPayrollStaffIds.size === 0}
              className="flex items-center gap-2 bg-app-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {autoGenerating
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                : <><Zap className="w-4 h-4" /> Generate selected ({selectedPayrollStaffIds.size})</>}
            </button>
          )}
          {activeTab === 'sheet' && sheetRows.length > 0 && (
            <button onClick={handlePrintSheet} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <Printer className="w-4 h-4" /> Print Salary Sheet
            </button>
          )}
        </div>
      </div>

      {pageError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-red-700 flex-1">{pageError}</p>
          <button
            type="button"
            onClick={() => setPageError('')}
            className="p-1 text-red-400 hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
            aria-label="Dismiss payroll error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auto-generate result banner */}
      {autoGenResult && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${autoGenResult.generated > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-app-surface-alt border-app-border'}`}>
          {autoGenResult.generated > 0
            ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 text-app-text-muted flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${autoGenResult.generated > 0 ? 'text-emerald-800' : 'text-app-text-muted'}`}>
              {autoGenResult.generated > 0
                ? `${autoGenResult.generated} payroll record${autoGenResult.generated !== 1 ? 's' : ''} generated for ${monthLabel} ${filterYear}`
                : `No payroll records were generated for ${monthLabel} ${filterYear}`}
            </p>
            {autoGenResult.noSalary.length > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠ Skipped (no salary set): {autoGenResult.noSalary.join(', ')}
              </p>
            )}
          </div>
          <button onClick={() => setAutoGenResult(null)} className="p-1 text-app-text-muted hover:text-app-text rounded-lg transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'records' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-muted hover:text-app-text'}`}
        >
          Payroll Records
        </button>
        <button
          onClick={() => setActiveTab('sheet')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sheet' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-muted hover:text-app-text'}`}
        >
          Monthly Salary Sheet
        </button>
      </div>

      {/* Filters */}
      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Role</label>
            <select disabled={autoGenerating} className="border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All Staff</option>
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Month</label>
            <select disabled={autoGenerating} className="border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Year</label>
            <select disabled={autoGenerating} className="border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-app-text-muted mb-1.5">Search</label>
            <input disabled={autoGenerating} className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Search name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {activeTab === 'records' && displayed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Net Payroll', value: fmt(totalNet), color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Paid', value: String(summaryPaid), color: 'text-emerald-600', bg: 'bg-app-surface' },
            { label: 'Pending', value: String(summaryPending), color: 'text-amber-600', bg: 'bg-app-surface' },
            { label: 'Not Generated', value: String(summaryNone), color: 'text-app-text-muted', bg: 'bg-app-surface' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl border border-app-border p-4 text-center`}>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-app-text-muted mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Payroll Records Table */}
      {activeTab === 'records' && (loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm bg-app-surface rounded-2xl border border-app-border">
          No active staff found. Check your filters.
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left pl-5 pr-2 py-3.5 font-semibold text-app-text-muted w-12">
                  <input
                    type="checkbox"
                    checked={allSelectableDisplayedSelected}
                    onChange={toggleAllDisplayedStaff}
                    disabled={selectableDisplayed.length === 0 || autoGenerating}
                    aria-label="Select all visible staff without payroll records"
                    title="Select all visible staff without payroll records"
                    className="w-4 h-4 rounded border-app-border text-emerald-500 focus:ring-app-primary disabled:opacity-40"
                  />
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Staff</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Role</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Base (Profile)</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">{monthLabel} Basic</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Net</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {displayed.map(s => {
                const pr = payrollMap[s.id];
                return (
                  <tr key={s.id} className="hover:bg-app-surface-alt transition-colors">
                    <td className="pl-5 pr-2 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedPayrollStaffIds.has(s.id)}
                        onChange={() => togglePayrollStaff(s.id)}
                        disabled={!!pr || autoGenerating}
                        aria-label={`Select ${s.first_name} ${s.last_name} for ${monthLabel} payroll`}
                        title={pr ? `Payroll already exists for ${monthLabel} ${filterYear}` : `Add ${s.first_name} ${s.last_name} to selected payroll`}
                        className="w-4 h-4 rounded border-app-border text-emerald-500 focus:ring-app-primary disabled:opacity-40"
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-app-text">{s.first_name} {s.last_name}</p>
                      {s.staff_id && <p className="text-xs text-app-text-muted font-mono">{s.staff_id}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-app-text-muted">
                        {ROLE_LABEL[s.role] ?? s.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-app-text-muted text-xs">
                      {s.basic_salary != null ? `₦${s.basic_salary.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-app-text">
                      {pr ? `₦${pr.basic_salary.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-app-text">
                      {pr ? fmt(pr.basic_salary + pr.allowances - pr.deductions) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {pr ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pr.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {pr.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-app-text-muted">
                          Not Generated
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openGenerate(s)}
                          disabled={autoGenerating}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-white disabled:opacity-40 disabled:cursor-not-allowed ${pr ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                        >
                          {pr ? 'Edit' : 'Generate'}
                        </button>
                        {pr && (
                          <button
                            onClick={() => { setVoucherStaff(s); setVoucherRecord(pr); }}
                            title="Print Voucher"
                            className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Monthly Salary Sheet */}
      {activeTab === 'sheet' && (loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sheetRows.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm bg-app-surface rounded-2xl border border-app-border">
          No payroll records for {monthLabel} {filterYear}. Switch to &ldquo;Payroll Records&rdquo; to generate them first.
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted w-10">S/N</th>
                <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted">Staff Name</th>
                <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted">Role</th>
                <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted">Bank</th>
                <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted">Account Name</th>
                <th className="text-left px-4 py-3.5 font-semibold text-app-text-muted">Account No.</th>
                <th className="text-right px-4 py-3.5 font-semibold text-app-text-muted">Net Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {sheetRows.map((s, i) => {
                const pr = payrollMap[s.id];
                const bank = parseNotes(pr?.notes);
                return (
                  <tr key={s.id} className="hover:bg-app-surface-alt transition-colors">
                    <td className="px-4 py-3.5 text-app-text-muted text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5 font-medium text-app-text">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-slate-100 text-app-text-muted px-2 py-0.5 rounded-full">
                        {ROLE_LABEL[s.role] ?? s.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-app-text-muted">{bank.bank_name || '—'}</td>
                    <td className="px-4 py-3.5 text-app-text-muted">{bank.account_name || '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-app-text-muted">{bank.account_number || '—'}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-app-text">{fmt((pr?.basic_salary ?? 0) + (pr?.allowances ?? 0) - (pr?.deductions ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800">
                <td colSpan={6} className="px-4 py-3.5 font-bold text-white text-sm">
                  GRAND TOTAL ({sheetRows.length} staff)
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-white">
                  {fmt(sheetRows.reduce((sum, s) => { const r = payrollMap[s.id]; return sum + (r ? (r.basic_salary + r.allowances - r.deductions) : 0); }, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Generate / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${existingRecord ? 'Edit' : 'Generate'} Payroll — ${selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : ''}`}
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}

          {/* Salary */}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Basic Salary (₦)</label>
            <input type="number" className={inputClass} placeholder="e.g. 50000" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: e.target.value, updateSalary: false })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">Allowances (₦)</label>
              <input type="number" className={inputClass} placeholder="0" value={form.allowances} onChange={e => setForm({ ...form, allowances: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">Deductions (₦)</label>
              <input type="number" className={inputClass} placeholder="0" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} />
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-emerald-700 font-medium">Net Salary</span>
            <span className="text-lg font-bold text-emerald-700">{fmt(netSalary)}</span>
          </div>

          {/* Salary increase option */}
          {salaryChanged && (
            <label className="flex items-start gap-2.5 cursor-pointer bg-blue-50 border border-blue-200 rounded-xl p-3">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600"
                checked={form.updateSalary}
                onChange={e => setForm({ ...form, updateSalary: e.target.checked })}
              />
              <span className="text-sm text-blue-800">
                <span className="font-semibold">Update {selectedStaff?.first_name}'s base salary to {fmt(Number(form.basic_salary))} for future months</span>
                <span className="block text-xs text-blue-500 mt-0.5">
                  Current base: {selectedStaff?.basic_salary != null ? fmt(selectedStaff.basic_salary) : 'not set'} · Older vouchers won't change.
                </span>
              </span>
            </label>
          )}

          {/* Bank details */}
          <div className="border border-app-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-app-text">Bank / Payment Details</p>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Bank Name</label>
              <input className={inputClass} placeholder="e.g. First Bank of Nigeria" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Account Number</label>
                <input className={inputClass} placeholder="0123456789" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Account Name</label>
                <input className={inputClass} placeholder="As on bank records" value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">Status</label>
              <select className={inputClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'pending' | 'paid' })}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {form.status === 'paid' && (
              <div>
                <label className="block text-sm font-medium text-app-text mb-1.5">Payment Date</label>
                <input type="date" className={inputClass} value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Notes</label>
            <textarea className={inputClass} placeholder="Optional notes…" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-app-text-muted border border-app-border rounded-xl hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-white bg-app-primary hover:opacity-90 rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Payroll'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Voucher overlay */}
      {voucherRecord && voucherStaff && (
        <SalaryVoucher
          record={voucherRecord}
          staff={voucherStaff}
          settings={settings}
          onClose={() => { setVoucherRecord(null); setVoucherStaff(null); }}
        />
      )}
    </div>
  );
}
