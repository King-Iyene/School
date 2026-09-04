import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { Printer, Plus, X, CheckCircle, XCircle, Banknote, Upload, FileText, ChevronDown } from 'lucide-react';
import { sendWebPush } from '../../hooks/usePushSubscription';

interface Requisition {
  id: string;
  school_id: string;
  requester_id: string;
  title: string;
  description: string | null;
  amount: number;
  date_needed: string | null;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'retired' | 'reimbursed';
  items: { description: string; amount: number }[] | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  disbursed_by: string | null;
  disbursed_at: string | null;
  receipt_url: string | null;
  created_at: string;
  requester?: { first_name: string; last_name: string; role: string; staff_id: string | null };
  reviewer?: { first_name: string; last_name: string } | null;
  disburser?: { first_name: string; last_name: string } | null;
}

function amountInWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function below1000(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + below1000(n % 100) : '');
  }
  const n = Math.floor(num);
  const kobo = Math.round((num - n) * 100);
  if (n === 0 && kobo === 0) return 'Zero Naira Only';
  let result = '';
  if (n >= 1000000) result += below1000(Math.floor(n / 1000000)) + ' Million ';
  if (Math.floor(n / 1000) % 1000 > 0) result += below1000(Math.floor(n / 1000) % 1000) + ' Thousand ';
  if (n % 1000 > 0) result += below1000(n % 1000);
  result = result.trim() + ' Naira';
  if (kobo > 0) result += ' and ' + below1000(kobo) + ' Kobo';
  return result + ' Only';
}

const SETUP_SQL = `-- Run once in your Supabase SQL Editor:

create table if not exists public.requisitions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  requester_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12,2) not null,
  date_needed date,
  account_name text,
  account_number text,
  bank_name text,
  items jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','disbursed','retired','reimbursed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  disbursed_by uuid references public.profiles(id),
  disbursed_at timestamptz,
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.requisitions enable row level security;
create policy "requisitions_access" on public.requisitions for all
  using (
    auth.uid() = requester_id or
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.school_id = requisitions.school_id
        and p.role in ('super_admin','admin','principal','accountant')
    )
  ) with check (true);

-- OPTIONAL: Storage bucket for receipt uploads
-- Go to Supabase Dashboard → Storage → New Bucket
-- Name: receipts   Public: true`;

const ADMIN_ROLES = ['super_admin', 'admin', 'principal', 'accountant'];
const fmt = (n: number) => `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inputClass = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700'  },
  approved:  { label: 'Approved',  bg: 'bg-blue-50',    text: 'text-blue-700'   },
  rejected:  { label: 'Rejected',  bg: 'bg-red-50',     text: 'text-red-700'    },
  disbursed: { label: 'Disbursed', bg: 'bg-purple-50',  text: 'text-purple-700' },
  retired:   { label: 'Retired',   bg: 'bg-emerald-50', text: 'text-emerald-700'},
  reimbursed:{ label: 'Reimbursed from Account', bg: 'bg-teal-50', text: 'text-teal-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-app-text-muted' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// Escape user-provided text before interpolating into print HTML (XSS guard)
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Print once all images in the popup have loaded (with a safety timeout)
function printWhenReady(win: Window) {
  const imgs = Array.from(win.document.images);
  const waits = imgs.map(img => img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); }));
  const timeout = new Promise<void>(r => setTimeout(r, 2500));
  Promise.race([Promise.all(waits).then(() => undefined), timeout]).then(() => setTimeout(() => win.print(), 100));
}

function dateStr(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Requisition() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const isAdmin = profile ? ADMIN_ROLES.includes(profile.role) : false;

  const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'retirement'>(() => isAdmin ? 'all' : 'mine');
  const [list, setList] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const schoolName = settings.school_name;

  const [showForm, setShowForm] = useState(false);
  const emptyItem = { description: '', amount: '' };
  const [form, setForm] = useState({ title: '', description: '', amount: '', date_needed: '', account_name: '', account_number: '', bank_name: '' });
  const [items, setItems] = useState<{ description: string; amount: string }[]>([{ ...emptyItem }]);
  const validItems = items.filter(it => it.description.trim() && Number(it.amount) > 0);
  const itemsTotal = validItems.reduce((s, it) => s + Number(it.amount), 0);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [detailReq, setDetailReq] = useState<Requisition | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [syncingExpense, setSyncingExpense] = useState(false);
  const [syncExpenseMsg, setSyncExpenseMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const principalName = '';

  async function sendReqNotification(recipientIds: string[], title: string, message: string) {
    if (!profile?.school_id || !profile?.id || recipientIds.length === 0) return;
    try {
      await supabase.rpc('create_notification_bulk', {
        p_school_id: profile.school_id,
        p_sender_id: profile.id,
        p_recipient_ids: recipientIds,
        p_title: title,
        p_message: message,
        p_type: 'info',
        p_notification_type: 'alert',
        p_target_type: 'individual',
        p_target_role: null,
        p_target_class_id: null,
        p_scheduled_at: null,
        p_attachments: [],
        p_metadata: { url: '/hr/requisitions' },
      });
    } catch { }
    // Also deliver via Web Push so recipients get notified even with the tab closed
    sendWebPush(recipientIds, title, message, '/hr/requisitions');
  }

  useEffect(() => {
    fetchList();
  }, [activeTab, profile?.id, profile?.school_id]);

  async function fetchList() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('requisitions')
        .select(`*, requester:requester_id(first_name,last_name,role,staff_id), reviewer:reviewed_by(first_name,last_name), disburser:disbursed_by(first_name,last_name)`)
        .order('created_at', { ascending: false });

      if (activeTab === 'mine') {
        q = q.eq('requester_id', profile.id);
      } else if (activeTab === 'retirement') {
        q = q.eq('school_id', profile.school_id!).eq('status', 'disbursed');
      } else {
        q = q.eq('school_id', profile.school_id!);
      }

      const { data, error } = await q;
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01' || error.message.includes('schema cache') || error.message.includes('requisitions')) {
          setSetupNeeded(true);
        }
        setLoading(false);
        return;
      }
      setSetupNeeded(false);
      setList((data as unknown as Requisition[]) ?? []);
    } catch {
      setSetupNeeded(true);
    }
    setLoading(false);
  }

  async function submitForm() {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    // Total comes from itemized list when present, otherwise the manual amount field
    const totalAmount = validItems.length > 0 ? itemsTotal : Number(form.amount);
    if (!totalAmount || totalAmount <= 0) { setFormError('Add at least one item with an amount, or enter a total amount.'); return; }
    setFormSaving(true);
    setFormError('');
    const itemsPayload = validItems.length > 0
      ? validItems.map(it => ({ description: it.description.trim(), amount: Number(it.amount) }))
      : null;
    const basePayload = {
      school_id: profile!.school_id,
      requester_id: profile!.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount: totalAmount,
      date_needed: form.date_needed || null,
      account_name: form.account_name.trim() || null,
      account_number: form.account_number.trim() || null,
      bank_name: form.bank_name.trim() || null,
      status: 'pending',
    };
    let { error } = await supabase.from('requisitions').insert({ ...basePayload, items: itemsPayload });
    if (error && itemsPayload && /items/.test(error.message)) {
      // DB doesn't have the items column yet — fold items into the description instead
      const itemLines = itemsPayload.map((it, i) => `${i + 1}. ${it.description} — ₦${it.amount.toLocaleString()}`).join('\n');
      const retry = await supabase.from('requisitions').insert({
        ...basePayload,
        description: [basePayload.description, itemLines].filter(Boolean).join('\n'),
      });
      error = retry.error;
    }
    setFormSaving(false);
    if (error) { setFormError(error.message); return; }
    setShowForm(false);
    setForm({ title: '', description: '', amount: '', date_needed: '', account_name: '', account_number: '', bank_name: '' });
    setItems([{ ...emptyItem }]);
    fetchList();

    // Notify all approvers (admin, principal, accountant) in the school
    const { data: approvers } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', profile!.school_id!)
      .in('role', ['super_admin', 'admin', 'principal', 'accountant'])
      .neq('id', profile!.id);
    if (approvers && approvers.length > 0) {
      const requesterName = `${profile!.first_name} ${profile!.last_name}`.trim();
      sendReqNotification(
        approvers.map(a => a.id),
        `New Requisition: ${form.title.trim()}`,
        `${requesterName} submitted a requisition for ₦${totalAmount.toLocaleString()} — pending your approval.`
      );
    }
  }

  async function createExpenseRecord(req: Requisition): Promise<string | null> {
    if (!profile?.school_id) return 'No school context';

    const [{ data: acctRows }, { data: pmRows }] = await Promise.all([
      supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('school_id', profile.school_id)
        .ilike('account_name', '%imprest%')
        .limit(1),
      supabase
        .from('payment_methods_list')
        .select('id')
        .eq('school_id', profile.school_id)
        .ilike('name', '%cash%')
        .limit(1),
    ]);

    const expDate = req.disbursed_at
      ? req.disbursed_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const requesterName = req.requester
      ? `${req.requester.first_name} ${req.requester.last_name}`.trim()
      : '';

    // Build payload — only include FK fields if found; passing null can violate NOT NULL constraints
    const payload: Record<string, unknown> = {
      school_id: profile.school_id,
      source_name: `Requisition: ${req.title}`,
      expense_date: expDate,
      amount: req.amount,
      reference_no: `REQ-${req.id.slice(0, 8).toUpperCase()}`,
      description: [
        req.description,
        requesterName ? `Requested by ${requesterName}` : '',
      ].filter(Boolean).join(' | '),
    };
    if (acctRows?.[0]?.id) payload.account_id = acctRows[0].id;
    if (pmRows?.[0]?.id) payload.payment_method_id = pmRows[0].id;

    const { error } = await supabase.from('expense_records').insert([payload]);
    return error ? error.message : null;
  }

  async function deleteRequisition(req: Requisition) {
    setActionSaving(true);
    setActionError('');
    const refNo = `REQ-${req.id.slice(0, 8).toUpperCase()}`;
    // Remove linked expense record (if any) first
    if (profile?.school_id) {
      await supabase.from('expense_records')
        .delete()
        .eq('reference_no', refNo)
        .eq('school_id', profile.school_id);
    }
    const { error } = await supabase.from('requisitions').delete().eq('id', req.id);
    if (error) { setActionError(error.message); setActionSaving(false); return; }
    setActionSaving(false);
    setDetailReq(null);
    setDeleteConfirm(false);
    fetchList();
  }

  async function syncExpense(req: Requisition) {
    setSyncingExpense(true);
    setSyncExpenseMsg('');
    const expErr = await createExpenseRecord(req);
    if (expErr) {
      setSyncExpenseMsg(`Failed: ${expErr}`);
    } else {
      setSyncExpenseMsg('Expense record created in Finance → Expense ✓');
    }
    setSyncingExpense(false);
  }

  async function doAction(req: Requisition, action: 'approve' | 'reject' | 'disburse' | 'retire' | 'reimburse') {
    setActionSaving(true);
    setActionError('');
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (action === 'approve') {
      updates.status = 'approved';
      updates.reviewed_by = profile!.id;
      updates.reviewed_at = new Date().toISOString();
      updates.review_notes = reviewNotes.trim() || null;
    } else if (action === 'reject') {
      updates.status = 'rejected';
      updates.reviewed_by = profile!.id;
      updates.reviewed_at = new Date().toISOString();
      updates.review_notes = reviewNotes.trim() || null;
    } else if (action === 'disburse') {
      updates.status = 'disbursed';
      updates.disbursed_by = profile!.id;
      updates.disbursed_at = new Date().toISOString();
    } else if (action === 'retire') {
      updates.status = 'retired';
    } else if (action === 'reimburse') {
      updates.status = 'reimbursed';
    }

    const { error } = await supabase.from('requisitions').update(updates).eq('id', req.id);
    if (error) { setActionSaving(false); setActionError(error.message); return; }

    // Notify the requester of the outcome
    if (req.requester_id && req.requester_id !== profile!.id) {
      const actorName = `${profile!.first_name} ${profile!.last_name}`.trim();
      const notifTitle =
        action === 'approve'  ? `Requisition Approved: ${req.title}` :
        action === 'reject'   ? `Requisition Rejected: ${req.title}` :
        action === 'disburse' ? `Requisition Disbursed: ${req.title}` :
        action === 'reimburse' ? `Requisition Reimbursed: ${req.title}` : '';
      const notifMsg =
        action === 'approve'  ? `Your requisition for ₦${req.amount.toLocaleString()} was approved by ${actorName}.` :
        action === 'reject'   ? `Your requisition for ₦${req.amount.toLocaleString()} was rejected by ${actorName}.${reviewNotes.trim() ? ' Note: ' + reviewNotes.trim() : ''}` :
        action === 'disburse' ? `Your requisition for ₦${req.amount.toLocaleString()} has been disbursed by ${actorName}.` :
        action === 'reimburse' ? `Your requisition for ₦${req.amount.toLocaleString()} has been reimbursed from account by ${actorName}.` : '';
      if (notifTitle) sendReqNotification([req.requester_id], notifTitle, notifMsg);
    }

    if (action === 'disburse') {
      const expErr = await createExpenseRecord({ ...req, disbursed_at: new Date().toISOString() });
      if (expErr) {
        // Disbursed OK but expense link failed — show error, keep panel open so user can retry via Sync
        setActionError(`Disbursed ✓ — but expense record failed: ${expErr}. Use "Sync to Expense" to retry.`);
        setActionSaving(false);
        fetchList();
        return;
      }
    }

    setActionSaving(false);
    setDetailReq(null);
    setReviewNotes('');
    fetchList();
  }

  async function uploadReceipt(req: Requisition, file: File) {
    setUploadingReceipt(true);
    setReceiptError('');
    const ext = file.name.split('.').pop();
    const path = `${profile!.school_id}/${req.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
    if (upErr) {
      setReceiptError(`Upload failed: ${upErr.message}. Paste a URL instead if storage is unavailable.`);
      setUploadingReceipt(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path);
    const url = urlData.publicUrl;
    await supabase.from('requisitions').update({ receipt_url: url, updated_at: new Date().toISOString() }).eq('id', req.id);
    setUploadingReceipt(false);
    fetchList();
    if (detailReq?.id === req.id) setDetailReq({ ...detailReq, receipt_url: url });
  }

  async function saveReceiptUrl(req: Requisition, url: string) {
    if (!url.trim()) return;
    await supabase.from('requisitions').update({ receipt_url: url.trim(), updated_at: new Date().toISOString() }).eq('id', req.id);
    fetchList();
    if (detailReq?.id === req.id) setDetailReq({ ...detailReq, receipt_url: url.trim() });
  }

  function printRetirement() {
    const pending = list.filter(r => r.status === 'disbursed');
    const total = pending.reduce((s, r) => s + r.amount, 0);
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;
    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join(' &nbsp;|&nbsp; ');
    win.document.write(`<!DOCTYPE html><html><head>
<title>Pending Retirement – ${esc(schoolName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:36px;font-size:13px;color:#111}
h1{font-size:18px;font-weight:bold;text-align:center;text-transform:uppercase;color:${primaryColor}}
h2{font-size:13px;text-align:center;color:#555;margin-top:4px}
.lh{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px}
.lh img{width:72px;height:72px;object-fit:contain}
.lh .c{flex:1;text-align:center;padding:0 14px}
.lh .name{font-size:20pt;font-weight:900;letter-spacing:1.5px;color:${primaryColor};font-family:'Times New Roman',serif;line-height:1.1}
.lh .motto{font-size:9pt;font-style:italic;color:${secondaryColor};font-weight:600;margin:2px 0}
.lh .addr{font-size:8.5pt;color:#333;line-height:1.5}
.lh .office{font-size:9pt;font-weight:bold;color:${primaryColor};margin-top:2px}
.lh .contact{font-size:8pt;color:#555;margin-top:2px}
.rule{border-top:3px solid ${primaryColor};border-bottom:1px solid ${secondaryColor};height:4px;margin:0 0 10px}
.title-bar{background:${primaryColor};color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:bold;letter-spacing:2px;margin:14px 0 20px;border-radius:3px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0}
thead th.r{text-align:right}
tbody td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
tbody td.r{text-align:right}
.total-row td{font-weight:bold;background:${primaryColor};color:#fff;padding:9px 10px}
.total-row td.r{text-align:right}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}
.sig-line{border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555;text-align:center;margin-top:60px}
.sig-name{font-size:12px;font-weight:bold;color:#111;margin-bottom:2px}
.date{text-align:right;font-size:11px;color:#777;margin-bottom:10px}
@media print{body{padding:16px}}
</style></head><body>
<div class="lh">
  <img src="${settings.logo_url || '/default-logo.png'}" alt="${esc(schoolName)} Logo" />
  <div class="c">
    <div class="name">${esc(schoolName).toUpperCase()}</div>
    ${settings.motto ? `<div class="motto">${esc(settings.motto)}</div>` : ''}
    ${settings.address ? `<div class="addr">${esc(settings.address)}</div>` : ''}
    <div class="office">Office of the Principal</div>
    ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
  </div>
  <div style="width:72px"></div>
</div>
<div class="rule"></div>
<div class="title-bar">PENDING RETIREMENT LIST — DISBURSED REQUISITIONS</div>
<div class="date">Printed: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}</div>
<table>
<thead><tr>
  <th>S/N</th><th>Staff Name</th><th>Purpose</th><th>Date Needed</th><th>Bank</th><th>Account Number</th><th>Account Name</th><th class="r">Amount (₦)</th>
</tr></thead>
<tbody>
${pending.map((r, i) => `<tr>
  <td>${i + 1}</td>
  <td>${r.requester ? esc(`${r.requester.first_name} ${r.requester.last_name}`) : '—'}</td>
  <td>${esc(r.title)}</td>
  <td>${r.date_needed ? new Date(r.date_needed).toLocaleDateString('en-GB') : '—'}</td>
  <td>${esc(r.bank_name) || '—'}</td>
  <td>${esc(r.account_number) || '—'}</td>
  <td>${esc(r.account_name) || '—'}</td>
  <td class="r">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
</tr>`).join('')}
</tbody>
<tfoot><tr class="total-row"><td colspan="7">TOTAL</td><td class="r">₦ ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></tfoot>
</table>
<div class="sigs">
  <div>
    <div class="sig-line">${principalName ? `<div class="sig-name">${esc(principalName)}</div>` : ''}Prepared By (Principal)</div>
  </div>
  <div>
    <div class="sig-line">Authorised By (Bishop)</div>
  </div>
</div>
</body></html>`);
    win.document.close();
    printWhenReady(win);
  }

  function printRequisitionForm(req: Requisition) {
    const pvNo = `REQ-${req.id.slice(0, 8).toUpperCase()}`;
    const formDate = req.date_needed
      ? new Date(req.date_needed).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const requesterName = req.requester
      ? `${req.requester.first_name} ${req.requester.last_name}`.trim() : '';
    const reviewerName = req.reviewer
      ? `${req.reviewer.first_name} ${req.reviewer.last_name}`.trim() : '';
    const descLines = (req.description || '').split('\n').filter(l => l.trim());
    // Prefer the structured item list; fall back to title + description lines
    const allItems: { desc: string; amount: string }[] =
      req.items && req.items.length > 0
        ? req.items.map(it => ({ desc: it.description, amount: `₦${it.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` }))
        : [
            { desc: req.title, amount: `₦${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
            ...descLines.map(d => ({ desc: d, amount: '' })),
          ];
    while (allItems.length < 20) allItems.push({ desc: '', amount: '' });
    const rows = allItems.slice(0, 20);
    const words = amountInWords(req.amount);
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (!win) return;
    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join(' &nbsp;|&nbsp; ');
    win.document.write(`<!DOCTYPE html><html><head>
<title>Requisition – ${esc(req.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:32px;font-size:12px;color:#111}
.lh{display:flex;align-items:center;justify-content:space-between;padding-bottom:8px}
.lh img{width:72px;height:72px;object-fit:contain}
.lh .c{flex:1;text-align:center;padding:0 14px}
.lh .name{font-size:20pt;font-weight:900;letter-spacing:1.5px;color:${primaryColor};font-family:'Times New Roman',serif;line-height:1.1}
.lh .motto{font-size:9pt;font-style:italic;color:${secondaryColor};font-weight:600;margin:2px 0}
.lh .addr{font-size:8.5pt;color:#333;line-height:1.5}
.lh .office{font-size:9pt;font-weight:bold;color:${primaryColor};margin-top:2px}
.lh .contact{font-size:8pt;color:#555;margin-top:2px}
.rule{border-top:3px solid ${primaryColor};border-bottom:1px solid ${secondaryColor};height:4px;margin:0 0 10px}
.form-type{font-size:14px;font-weight:bold;text-transform:uppercase;text-decoration:underline;text-align:center;margin:4px 0 8px;letter-spacing:1px}
.meta{display:flex;justify-content:space-between;align-items:flex-end;margin:10px 0 6px;font-size:12px;gap:8px}
.meta .f{display:flex;align-items:baseline;gap:5px;flex:1}
.meta .f label{font-weight:bold;white-space:nowrap;font-size:12px}
.meta .f .v{border-bottom:1px solid #333;flex:1;min-width:80px;padding:0 3px 1px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #333;padding:5px 8px}
th{background:#eaeaea;font-weight:bold;text-align:left}
.sn{width:36px;text-align:center}
.amt{width:140px;text-align:right}
tfoot td{font-weight:bold;background:#eaeaea}
.words{margin:9px 0 14px;font-size:12px;line-height:1.6}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:18px}
.sb{font-size:11px}
.sl{border-top:1px solid #111;padding-top:4px;margin-top:30px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px}
.sl-label{font-size:10px;color:#555;margin-top:2px}
.sig-space{border-top:1px solid #111;margin-top:40px;padding-top:4px;font-size:10px;color:#555}
@media print{body{padding:16px}}
</style></head><body>
<div class="lh">
  <img src="${settings.logo_url || '/default-logo.png'}" alt="${esc(schoolName)} Logo" />
  <div class="c">
    <div class="name">${esc(schoolName).toUpperCase()}</div>
    ${settings.motto ? `<div class="motto">${esc(settings.motto)}</div>` : ''}
    ${settings.address ? `<div class="addr">${esc(settings.address)}</div>` : ''}
    <div class="office">Office of the Principal</div>
    ${contactLine ? `<div class="contact">${contactLine}</div>` : ''}
  </div>
  <div style="width:72px"></div>
</div>
<div class="rule"></div>
<div class="form-type">Requisition Form</div>
<div class="meta">
  <div class="f" style="flex:3"><label>TITLE:</label><span class="v">${esc(req.title)}</span></div>
  <div class="f"><label>PV NO:</label><span class="v">${pvNo}</span></div>
  <div class="f"><label>DATE:</label><span class="v">${formDate}</span></div>
</div>
<table>
<thead><tr><th class="sn">S/N</th><th>Description</th><th class="amt">Amount (₦)</th></tr></thead>
<tbody>
${rows.map((item, i) => `<tr style="height:22px"><td class="sn">${i + 1}.</td><td>${esc(item.desc)}</td><td class="amt">${item.amount}</td></tr>`).join('')}
</tbody>
<tfoot>
<tr><td colspan="2" style="text-align:right">TOTAL</td><td class="amt">₦${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
</tfoot>
</table>
<div class="words"><strong>AMOUNT IN WORDS:</strong> ${words}</div>
<div class="sigs">
  <div class="sb">
    <div class="sl">${esc(requesterName)}</div>
    <div class="sl-label">NAME OF APPLICANT</div>
    <div class="sig-space">SIGNATURE</div>
  </div>
  <div class="sb">
    <div class="sl">${esc(principalName) || '&nbsp;'}</div>
    <div class="sl-label">PRINCIPAL / APPROVED BY</div>
    <div class="sig-space">SIGNATURE</div>
  </div>
</div>
</body></html>`);
    win.document.close();
    printWhenReady(win);
  }

  const filtered = list.filter(r => !statusFilter || r.status === statusFilter);
  const tabs = isAdmin
    ? [{ id: 'mine', label: 'My Requests' }, { id: 'all', label: 'All Requests' }, { id: 'retirement', label: 'Pending Retirement' }]
    : [{ id: 'mine', label: 'My Requests' }];

  if (setupNeeded) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-app-text">Requisitions</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="font-semibold text-amber-800 mb-2">Database table not found</p>
          <p className="text-sm text-amber-700 mb-3">Run the SQL below in your Supabase SQL Editor to create the requisitions table.</p>
          <button onClick={() => setShowSql(v => !v)} className="text-sm font-medium text-amber-700 underline mb-3">
            {showSql ? 'Hide' : 'Show'} SQL
          </button>
          {showSql && (
            <pre className="bg-app-surface border border-amber-200 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap text-app-text font-mono">
              {SETUP_SQL}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Requisitions</h1>
          <p className="text-sm text-app-text-muted mt-0.5">Submit and track expense requests</p>
        </div>
        {activeTab === 'mine' && (
          <button
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New Request
          </button>
        )}
        {activeTab === 'retirement' && (
          <button
            onClick={printRetirement}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Printer className="w-4 h-4" /> Print List
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="bg-app-surface rounded-2xl border border-app-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-app-text">New Requisition</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-app-text-muted hover:text-app-text rounded-xl hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Purpose / Title <span className="text-red-400">*</span></label>
              <input className={inputClass} placeholder="e.g. Purchase of stationery" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Description</label>
              <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Optional details…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {/* Itemized expenses / requests */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Expenses / Request Items</label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-app-text-muted w-5 text-right">{i + 1}.</span>
                    <input
                      className={inputClass}
                      placeholder="e.g. Boarders feeding ₦270,000/week × 4 weeks"
                      value={it.description}
                      onChange={e => setItems(arr => arr.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    />
                    <input
                      type="number" min="0" step="0.01"
                      className={`${inputClass} !w-36 text-right`}
                      placeholder="Amount (₦)"
                      value={it.amount}
                      onChange={e => setItems(arr => arr.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                    />
                    {items.length > 1 && (
                      <button onClick={() => setItems(arr => arr.filter((_, j) => j !== i))} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg" title="Remove item">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setItems(arr => [...arr, { ...emptyItem }])} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                  {validItems.length > 0 && (
                    <p className="text-sm font-bold text-app-text">Total: {fmt(itemsTotal)}</p>
                  )}
                </div>
              </div>
            </div>
            {validItems.length === 0 && (
              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1.5">Amount (₦) <span className="text-red-400">*</span></label>
                <input type="number" min="0" step="0.01" className={inputClass} placeholder="0.00 — or itemize above" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Date Needed</label>
              <input type="date" className={inputClass} value={form.date_needed} onChange={e => setForm(f => ({ ...f, date_needed: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Bank Name</label>
              <input className={inputClass} placeholder="e.g. Access Bank" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Account Number</label>
              <input className={inputClass} placeholder="0000000000" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1.5">Account Name</label>
              <input className={inputClass} placeholder="Name on account" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={submitForm} disabled={formSaving} className="bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              {formSaving ? 'Submitting…' : 'Submit Request'}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-app-text text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Retirement notice */}
      {activeTab === 'retirement' && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800">
          These are disbursed requisitions awaiting retirement (receipt submission). Use <strong>Print List</strong> to generate a bank-payment/accountability sheet.
        </div>
      )}

      {/* Status filter (all tab) */}
      {activeTab === 'all' && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-app-text-muted">Filter by status:</label>
          <select className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted text-sm bg-app-surface rounded-2xl border border-app-border">
          {activeTab === 'mine' ? 'You have no requisitions yet. Click "New Request" to submit one.' :
           activeTab === 'retirement' ? 'No disbursed requisitions pending retirement.' :
           'No requisitions found.'}
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Purpose</th>
                {(activeTab === 'all' || activeTab === 'retirement') && (
                  <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Requested By</th>
                )}
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Amount</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Date Needed</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-app-text-muted">Submitted</th>
                <th className="text-right px-5 py-3.5 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {filtered.map(req => (
                <tr key={req.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-app-text">{req.title}</p>
                    {req.description && <p className="text-xs text-app-text-muted mt-0.5 truncate max-w-[220px]">{req.description}</p>}
                  </td>
                  {(activeTab === 'all' || activeTab === 'retirement') && (
                    <td className="px-5 py-3.5">
                      {req.requester ? (
                        <p className="text-app-text">{req.requester.first_name} {req.requester.last_name}</p>
                      ) : '—'}
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-right font-semibold text-app-text">{fmt(req.amount)}</td>
                  <td className="px-5 py-3.5 text-app-text-muted text-xs">{dateStr(req.date_needed)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={req.status} /></td>
                  <td className="px-5 py-3.5 text-xs text-app-text-muted">{dateStr(req.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => { setDetailReq(req); setReviewNotes(''); setActionError(''); setReceiptError(''); }}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {activeTab === 'retirement' && filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-800">
                  <td colSpan={5} className="px-5 py-3 font-bold text-white text-sm">TOTAL ({filtered.length} items)</td>
                  <td className="px-5 py-3 text-right font-bold text-white">{fmt(filtered.reduce((s, r) => s + r.amount, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Detail / Action Modal */}
      {detailReq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailReq(null)}>
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border sticky top-0 bg-app-surface rounded-t-2xl z-10">
              <h2 className="text-base font-bold text-app-text">Requisition Detail</h2>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => printRequisitionForm(detailReq)}
                    className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Form
                  </button>
                )}
                <button onClick={() => setDetailReq(null)} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Header info */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-app-text text-base">{detailReq.title}</p>
                  {detailReq.description && <p className="text-sm text-app-text-muted mt-1">{detailReq.description}</p>}
                </div>
                <StatusBadge status={detailReq.status} />
              </div>

              {/* Itemized list */}
              {detailReq.items && detailReq.items.length > 0 && (
                <div className="border border-app-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-app-border">
                      {detailReq.items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-app-text-muted text-xs w-6">{i + 1}.</td>
                          <td className="px-3 py-2 text-app-text">{it.description}</td>
                          <td className="px-3 py-2 text-right font-medium text-app-text">{fmt(it.amount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-app-surface-alt">
                        <td colSpan={2} className="px-3 py-2 text-xs font-bold text-app-text-muted uppercase">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-app-text">{fmt(detailReq.items.reduce((s, it) => s + it.amount, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Amount', value: fmt(detailReq.amount) },
                  { label: 'Date Needed', value: dateStr(detailReq.date_needed) },
                  { label: 'Submitted', value: dateStr(detailReq.created_at) },
                  { label: 'Requested By', value: detailReq.requester ? `${detailReq.requester.first_name} ${detailReq.requester.last_name}` : '—' },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-app-text-muted uppercase tracking-wide font-medium">{f.label}</p>
                    <p className="font-semibold text-app-text mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Bank details */}
              {(detailReq.bank_name || detailReq.account_number || detailReq.account_name) && (
                <div className="bg-app-surface-alt rounded-xl p-4 text-sm space-y-1">
                  <p className="text-xs font-bold text-app-text-muted uppercase tracking-wide mb-2">Bank Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detailReq.bank_name && <div><p className="text-xs text-app-text-muted">Bank</p><p className="font-medium">{detailReq.bank_name}</p></div>}
                    {detailReq.account_number && <div><p className="text-xs text-app-text-muted">Account No.</p><p className="font-medium font-mono">{detailReq.account_number}</p></div>}
                    {detailReq.account_name && <div className="col-span-2"><p className="text-xs text-app-text-muted">Account Name</p><p className="font-medium">{detailReq.account_name}</p></div>}
                  </div>
                </div>
              )}

              {/* Review info */}
              {detailReq.reviewer && (
                <div className="text-sm">
                  <p className="text-xs text-app-text-muted uppercase tracking-wide font-medium">Review</p>
                  <p className="text-app-text mt-0.5">
                    {detailReq.status === 'rejected' ? 'Rejected' : 'Approved'} by {detailReq.reviewer.first_name} {detailReq.reviewer.last_name}
                    {detailReq.reviewed_at ? ` on ${dateStr(detailReq.reviewed_at)}` : ''}
                  </p>
                  {detailReq.review_notes && <p className="text-app-text-muted mt-0.5 italic">{detailReq.review_notes}</p>}
                </div>
              )}

              {/* Disbursal info */}
              {detailReq.disburser && (
                <div className="text-sm">
                  <p className="text-xs text-app-text-muted uppercase tracking-wide font-medium">Disbursement</p>
                  <p className="text-app-text mt-0.5">
                    Disbursed by {detailReq.disburser.first_name} {detailReq.disburser.last_name}
                    {detailReq.disbursed_at ? ` on ${dateStr(detailReq.disbursed_at)}` : ''}
                  </p>
                </div>
              )}

              {/* Sync to Expense (admin only, for disbursed/retired) */}
              {['disbursed','retired','reimbursed'].includes(detailReq.status) && isAdmin && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Finance Link</p>
                  <p className="text-xs text-purple-600">
                    Creates (or re-creates) this disbursement as an expense in <strong>Finance → Expense</strong>, tied to the Imprest account.
                    Safe to run again if it wasn't synced previously.
                  </p>
                  {syncExpenseMsg && (
                    <p className={`text-xs font-medium ${syncExpenseMsg.startsWith('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                      {syncExpenseMsg}
                    </p>
                  )}
                  <button
                    onClick={() => { setSyncExpenseMsg(''); syncExpense(detailReq); }}
                    disabled={syncingExpense}
                    className="flex items-center gap-1.5 bg-app-primary hover:opacity-90 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    {syncingExpense ? 'Syncing…' : 'Sync to Expense'}
                  </button>
                </div>
              )}

              {/* Receipt section */}
              {['disbursed','retired','reimbursed'].includes(detailReq.status) && (
                <div className="border border-app-border rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-app-text-muted uppercase tracking-wide">Receipt</p>
                  {detailReq.receipt_url ? (
                    <div className="flex items-center gap-3">
                      <a href={detailReq.receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium underline underline-offset-2">
                        <FileText className="w-4 h-4" /> View Receipt
                      </a>
                      {detailReq.status === 'disbursed' && isAdmin && (
                        <button onClick={() => doAction(detailReq, 'retire')} disabled={actionSaving} className="ml-auto bg-app-primary hover:opacity-90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {actionSaving ? 'Marking…' : 'Mark as Retired'}
                        </button>
                      )}
                    </div>
                  ) : (
                    detailReq.requester_id === profile?.id || isAdmin ? (
                      <div className="space-y-2">
                        <p className="text-xs text-app-text-muted">Upload the receipt/proof of expenditure:</p>
                        <div className="flex gap-2">
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (file) await uploadReceipt(detailReq, file);
                            }}
                          />
                          <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploadingReceipt}
                            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" /> {uploadingReceipt ? 'Uploading…' : 'Upload File'}
                          </button>
                        </div>
                        <ReceiptUrlInput onSave={url => saveReceiptUrl(detailReq, url)} />
                        {receiptError && <p className="text-xs text-red-600">{receiptError}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-app-text-muted italic">No receipt uploaded yet.</p>
                    )
                  )}
                </div>
              )}

              {/* Admin actions */}
              {isAdmin && (
                <div className="border-t border-app-border pt-4 space-y-3">
                  {detailReq.status === 'pending' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-app-text-muted mb-1.5">Notes (optional)</label>
                        <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Add a note for the requester…" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => doAction(detailReq, 'approve')} disabled={actionSaving} className="flex items-center gap-1.5 bg-app-primary hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                          <CheckCircle className="w-4 h-4" /> {actionSaving ? 'Saving…' : 'Approve'}
                        </button>
                        <button onClick={() => doAction(detailReq, 'reject')} disabled={actionSaving} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </>
                  )}
                  {detailReq.status === 'approved' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-app-text-muted mb-1.5">Notes (optional — required if declining)</label>
                        <textarea className={`${inputClass} resize-none`} rows={2} placeholder="Add a note for the requester…" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => doAction(detailReq, 'disburse')} disabled={actionSaving} className="flex items-center gap-1.5 bg-app-primary hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                          <Banknote className="w-4 h-4" /> {actionSaving ? 'Saving…' : 'Mark as Disbursed'}
                        </button>
                        <button onClick={() => doAction(detailReq, 'reject')} disabled={actionSaving} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                          <XCircle className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    </>
                  )}
                  {detailReq.status === 'disbursed' && detailReq.receipt_url && (
                    <button onClick={() => doAction(detailReq, 'retire')} disabled={actionSaving} className="flex items-center gap-1.5 bg-app-primary hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                      <CheckCircle className="w-4 h-4" /> {actionSaving ? 'Saving…' : 'Mark as Retired'}
                    </button>
                  )}
                  {detailReq.status === 'retired' && (
                    <button onClick={() => doAction(detailReq, 'reimburse')} disabled={actionSaving} className="flex items-center gap-1.5 bg-app-primary hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
                      <Banknote className="w-4 h-4" /> {actionSaving ? 'Saving…' : 'Mark as Reimbursed from Account'}
                    </button>
                  )}
                </div>
              )}

              {actionError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{actionError}</p>}

              {/* Admin delete */}
              {isAdmin && (
                <div className="border-t border-red-100 pt-3">
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-red-600 font-medium">Delete this request and its linked expense record?</span>
                      <button
                        onClick={() => deleteRequisition(detailReq)}
                        disabled={actionSaving}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {actionSaving ? 'Deleting…' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        className="text-xs text-app-text-muted hover:text-app-text px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="text-xs text-red-500 hover:text-red-600 font-medium hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Delete Request
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptUrlInput({ onSave }: { onSave: (url: string) => void }) {
  const [url, setUrl] = useState('');
  return (
    <div className="flex gap-2">
      <input
        className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-app-primary/30 flex-1"
        placeholder="Or paste a URL to receipt…"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <button
        onClick={() => { onSave(url); setUrl(''); }}
        className="bg-slate-200 hover:bg-slate-300 text-app-text text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        Save
      </button>
    </div>
  );
}
