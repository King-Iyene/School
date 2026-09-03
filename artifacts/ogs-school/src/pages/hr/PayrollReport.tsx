import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';

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
    title?: string;
    account_number?: string;
    bank_name?: string;
  };
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

const fmt = (n: number) => `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getBankDetails(notes?: string): { bank_name: string; account_number: string } {
  try {
    const p = JSON.parse(notes ?? '{}');
    return { bank_name: p.bank_name ?? '', account_number: p.account_number ?? '' };
  } catch {
    return { bank_name: '', account_number: '' };
  }
}

export default function PayrollReport() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const currentDate = new Date();
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentDate.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear());
  const [hideNoAccount, setHideNoAccount] = useState(true);
  const [hideAdmins, setHideAdmins] = useState(true);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPrintConfig, setShowPrintConfig] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    recipientTitle: 'The Manager',
    bankName: '',
    bankBranch: '',
    schoolAccount: '',
    schoolAccountName: '',
    bishopName: '',
    principalName: '',
  });
  const pc = (k: keyof typeof printConfig, v: string) => setPrintConfig(p => ({ ...p, [k]: v }));

  useEffect(() => {
    setPrintConfig(p => ({ ...p, schoolAccountName: p.schoolAccountName || settings.school_name }));
  }, [settings.school_name]);

  // Auto-fill principal and vice-principal names from profiles
  useEffect(() => {
    if (!profile?.school_id) return;
    const makeName = (d: { title?: string; first_name?: string; last_name?: string }) => {
      const t = d.title ? d.title + ' ' : '';
      return `${t}${d.first_name ?? ''} ${d.last_name ?? ''}`.trim();
    };
    supabase
      .from('profiles')
      .select('first_name, last_name, title, role')
      .eq('school_id', profile.school_id)
      .in('role', ['principal', 'vice_principal'])
      .then(({ data }) => {
        if (!data) return;
        const principal = data.find(d => d.role === 'principal');

        setPrintConfig(p => ({
          ...p,
          principalName: p.principalName || (principal ? makeName(principal) : ''),
        }));
      });
  }, [profile?.school_id]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  useEffect(() => { fetchData(); }, [filterRole, filterStatus, filterMonth, filterYear, hideNoAccount, hideAdmins]);

  async function fetchData() {
    setLoading(true);
    let query = supabase
      .from('payroll_records')
      .select('*, profiles(first_name, last_name, role, title, account_number, bank_name)')
      .eq('month', filterMonth)
      .eq('year', filterYear)
      .order('created_at', { ascending: false });

    if (filterStatus) query = query.eq('status', filterStatus);

    const { data } = await query;
    if (data) {
      let filtered = filterRole
        ? data.filter(r => r.profiles?.role === filterRole)
        : data;

      // Remove entries with net_salary of exactly 1000
      filtered = filtered.filter(r => r.net_salary !== 1000);

      // Optionally hide entries without an account number
      if (hideNoAccount) {
        filtered = filtered.filter(r => {
          const bank = getBankDetails(r.notes);
          const acct = r.profiles?.account_number || bank.account_number;
          return acct && acct.trim() !== '';
        });
      }

      // Optionally hide admin / super_admin roles
      if (hideAdmins) {
        filtered = filtered.filter(r => !['admin', 'super_admin'].includes(r.profiles?.role ?? ''));
      }

      // Deduplicate: keep only the most recent record per staff_id
      const seen = new Set<string>();
      filtered = filtered.filter(r => {
        if (seen.has(r.staff_id)) return false;
        seen.add(r.staff_id);
        return true;
      });

      setRows(filtered);
    }
    setLoading(false);
  }

  const totals = {
    basic_salary: rows.reduce((s, r) => s + (r.basic_salary || 0), 0),
    allowances:   rows.reduce((s, r) => s + (r.allowances || 0), 0),
    deductions:   rows.reduce((s, r) => s + (r.deductions || 0), 0),
    net_salary:   rows.reduce((s, r) => s + ((r.basic_salary || 0) + (r.allowances || 0) - (r.deductions || 0)), 0),
  };

  const staffName = (r: PayrollRow) =>
    r.profiles
      ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || 'Unknown'
      : 'Unknown';

  const handlePrint = () => {
    const monthLabel = MONTHS.find(m => m.value === filterMonth)?.label ?? '';
    const now = new Date();
    const day = now.getDate();
    const ord = ['th','st','nd','rd'][((day % 100) - 20) % 10] ?? ['th','st','nd','rd'][day % 100] ?? 'th';
    const dateStr = `${day}${ord} ${monthLabel}`;
    const origin = window.location.origin;
    const win = window.open('', '_blank', 'width=950,height=1100');
    if (!win) return;
    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join(' &nbsp;|&nbsp; ');
    win.document.write(`<!DOCTYPE html><html><head>
<title>Payment for ${monthLabel} ${filterYear} Salary</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:40px;font-size:13px;color:#111}
.meta{display:flex;justify-content:flex-end;font-size:12px;margin-bottom:18px}
.address{font-size:13px;margin-bottom:14px;line-height:1.8}
.subject{text-align:center;font-weight:bold;text-decoration:underline;font-size:14px;margin:14px 0 10px}
.body-text{font-size:13px;line-height:1.7;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
th{background:#000;color:#fff;padding:8px 10px;text-align:left;font-size:12px;border:1px solid #000}
th.r{text-align:right}
td{padding:7px 10px;border:1px solid #999;font-size:12px}
td.c{text-align:center}
td.r{text-align:right}
tfoot td{font-weight:bold;background:#e8e8e8;border:1px solid #555}
.closing{font-size:13px;margin-top:6px;line-height:1.8}
.sigs{display:flex;justify-content:space-between;margin-top:56px}
.sig-block{text-align:left;width:32%}
.sig-name{font-weight:bold;font-size:12px;border-top:1px solid #333;padding-top:5px;margin-top:44px}
.sig-title{font-size:11px;color:#555;margin-top:2px}
@media print{body{padding:20px}}
</style></head><body>
<div style="margin-bottom:18px">
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
<div class="meta">${dateStr}</div>
<div class="address">
  ${printConfig.recipientTitle},<br>
  ${printConfig.bankName},<br>
  ${printConfig.bankBranch}.
</div>
<p class="address">Sir,</p>
<div class="subject">PAYMENT FOR ${monthLabel.toUpperCase()} ${filterYear} SALARY</div>
<p class="body-text">From our account with you, <strong>${printConfig.schoolAccount}</strong> ${printConfig.schoolAccountName}, take as instruction to credit, <strong>${monthLabel}, ${filterYear}</strong> Salary into the following Staff Account with your bank:</p>
<table>
<thead>
<tr>
  <th style="width:40px">S/NO.</th>
  <th>STAFF NAMES</th>
  <th>BANK NAME</th>
  <th>ACCOUNT NO.</th>
  <th class="r">SALARY AMOUNT (₦)</th>
</tr>
</thead>
<tbody>
${rows.map((r, i) => {
  const bankFromNotes = getBankDetails(r.notes);
  const acctNo = r.profiles?.account_number || bankFromNotes.account_number || '—';
  const bankNm = r.profiles?.bank_name || bankFromNotes.bank_name || '—';
  const honorific = r.profiles?.title ? r.profiles.title + ' ' : '';
  const name = r.profiles
    ? `${honorific}${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim()
    : 'Unknown';
  return `<tr>
    <td class="c">${i + 1}.</td>
    <td>${name}</td>
    <td>${bankNm}</td>
    <td>${acctNo}</td>
    <td class="r">${((r.basic_salary || 0) + (r.allowances || 0) - (r.deductions || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
  </tr>`;
}).join('')}
</tbody>
<tfoot>
<tr>
  <td colspan="4" style="text-align:right;font-weight:bold;border:1px solid #555;background:#e8e8e8">TOTAL</td>
  <td class="r">${totals.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
</tr>
</tfoot>
</table>
<div class="closing">
  <p>Thank you for your usual cooperation.</p>
  <br><p>Yours faithfully</p>
</div>
<div class="sigs">
  <div class="sig-block">
    <div class="sig-name">${printConfig.bishopName}</div>
    <div class="sig-title">Diocesan Bishop</div>
  </div>
  <div class="sig-block">
    <div class="sig-name">${printConfig.principalName}</div>
    <div class="sig-title">Principal</div>
  </div>
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 350);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Payroll Report</h1>
        {rows.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print Report
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Role</label>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Month</label>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[90px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Year</label>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {/* Toggle filters */}
          <div className="flex flex-col gap-2 justify-end pb-0.5">
            <label className="block text-xs font-medium text-slate-500">Exclude</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHideNoAccount(v => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  hideNoAccount
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${hideNoAccount ? 'bg-red-500' : 'bg-slate-300'}`} />
                No Account No.
              </button>
              <button
                type="button"
                onClick={() => setHideAdmins(v => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  hideAdmins
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${hideAdmins ? 'bg-red-500' : 'bg-slate-300'}`} />
                Admins
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Letter / print config */}
      <div className="bg-white rounded-2xl border border-slate-200">
        <button
          onClick={() => setShowPrintConfig(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-2xl transition-colors"
        >
          <span>✉ Letter Settings (Salary Voucher)</span>
          <svg className={`w-4 h-4 transition-transform text-slate-400 ${showPrintConfig ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showPrintConfig && (
          <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100">
            {([
              { k: 'recipientTitle', label: 'Recipient (e.g. The Manager)' },
              { k: 'bankName',       label: 'Bank Name' },
              { k: 'bankBranch',     label: 'Bank Branch & City' },
              { k: 'schoolAccount',  label: 'School Account No.' },
              { k: 'schoolAccountName', label: 'School Account Name' },
              { k: 'bishopName',     label: 'Diocesan Bishop Name' },
              { k: 'principalName',  label: 'Principal Name' },
            ] as { k: keyof typeof printConfig; label: string }[]).map(({ k, label }) => (
              <div key={k}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                <input
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
                  value={printConfig[k]}
                  onChange={e => pc(k, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Basic', value: fmt(totals.basic_salary), color: 'text-slate-800' },
            { label: 'Total Allowances', value: fmt(totals.allowances), color: 'text-emerald-600' },
            { label: 'Total Deductions', value: fmt(totals.deductions), color: 'text-red-500' },
            { label: 'Total Net Salary', value: fmt(totals.net_salary), color: 'text-emerald-700' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
          No payroll records found for the selected filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Staff</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Bank</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Account No.</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Basic</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Allowances</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Deductions</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Net</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => {
                const bank = getBankDetails(r.notes);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{staffName(r)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {ROLE_LABEL[r.profiles?.role ?? ''] ?? (r.profiles?.role ?? '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{bank.bank_name || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs font-mono">{bank.account_number || '—'}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{fmt(r.basic_salary)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600">{fmt(r.allowances)}</td>
                    <td className="px-5 py-3.5 text-right text-red-500">{fmt(r.deductions)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{fmt((r.basic_salary || 0) + (r.allowances || 0) - (r.deductions || 0))}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-5 py-3.5 font-bold text-slate-800" colSpan={4}>Grand Total ({rows.length} staff)</td>
                <td className="px-5 py-3.5 text-right font-bold text-slate-800">{fmt(totals.basic_salary)}</td>
                <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{fmt(totals.allowances)}</td>
                <td className="px-5 py-3.5 text-right font-bold text-red-500">{fmt(totals.deductions)}</td>
                <td className="px-5 py-3.5 text-right font-bold text-emerald-700">{fmt(totals.net_salary)}</td>
                <td className="px-5 py-3.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
