import { useEffect, useState } from 'react';
import { Plus, Search, Receipt, TrendingUp, CreditCard as Edit2, Trash2, Printer, ChevronDown, ChevronUp, Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

interface Term { id: string; name: string; }
interface ClassRecord { id: string; name: string; }
interface FeeStructure { id: string; name: string; amount: number; }

interface PaymentRow {
  id: string;
  student_id: string;
  fee_structure_id: string;
  amount_paid: number;
  total_fee_amount: number;
  balance_remaining: number;
  payment_method: string;
  payment_date: string;
  receipt_number: string;
  status: string;
  notes: string;
  term_id: string | null;
  fee_name: string;
  source: 'fee_payments' | 'fees_collections';
  students?: { first_name: string; last_name: string; admission_number: string };
}

interface Installment {
  id: string;
  amount_paid: number;
  payment_method: string;
  receipt_number: string;
  payment_date: string;
  notes: string;
  created_at: string;
}

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'cheque', 'online', 'pos'];
const STATUS_OPTIONS = ['paid', 'partially_paid', 'unpaid', 'pending'];
const statusColors: Record<string, string> = { paid: 'success', partially_paid: 'warning', partial: 'warning', pending: 'default', unpaid: 'error', overdue: 'error' };

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

function generateReceiptNumber(termId: string | null, terms: Term[]): string {
  const term = terms.find(t => t.id === termId);
  const termNo = term ? (term.name.includes('First') ? 'T1' : term.name.includes('Second') ? 'T2' : 'T3') : 'T0';
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `RCP-${year}-${termNo}-${seq}`;
}

export default function FeePayments() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
  const [deletePayment, setDeletePayment] = useState<PaymentRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentTarget, setInstallmentTarget] = useState<PaymentRow | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [form, setForm] = useState({ student_id: '', fee_structure_id: '', amount_paid: '', payment_method: 'cash', receipt_number: '', status: 'paid', notes: '', term_id: '' });
  const [installmentForm, setInstallmentForm] = useState({ amount_paid: '', payment_method: 'cash', receipt_number: '', payment_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { loadData(); }, [profile]);

  async function loadData() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [payRes, legacyPayRes, studRes, feeRes, termRes, classRes] = await Promise.all([
      supabase
        .from('fee_payments')
        .select('*, fee_structures(name, amount), students!student_id(first_name, last_name, admission_number)')
        .eq('school_id', profile.school_id)
        .order('payment_date', { ascending: false }),
      supabase
        .from('fees_collections')
        .select('*, fees_master(amount, fees_types(name), term_id), students!student_id(first_name, last_name, admission_number)')
        .eq('school_id', profile.school_id)
        .order('payment_date', { ascending: false }),
      supabase.from('profiles').select('id, first_name, last_name, admission_number').eq('role', 'student').eq('school_id', profile.school_id),
      supabase.from('fee_structures').select('id, name, amount').eq('school_id', profile.school_id),
      supabase.from('terms').select('id, name').order('name'),
      supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name'),
    ]);

    const merged: PaymentRow[] = [
      ...(payRes.data ?? []).map((p: any) => ({
        ...p,
        fee_name: p.fee_structures?.name || 'Fee',
        total_fee_amount: Number(p.total_fee_amount) || Number(p.fee_structures?.amount) || 0,
        balance_remaining: Number(p.balance_remaining) || 0,
        students: Array.isArray(p.students) ? p.students[0] : p.students,
        source: 'fee_payments' as const,
      })),
      ...(legacyPayRes.data ?? []).map((p: any) => ({
        ...p,
        fee_name: p.fees_master?.fees_types?.name || 'Fee',
        fee_structure_id: p.fees_master_id,
        amount_paid: p.amount || p.amount_paid || 0,
        total_fee_amount: Number(p.fees_master?.amount) || 0,
        balance_remaining: Math.max(0, Number(p.fees_master?.amount || 0) - Number(p.amount || p.amount_paid || 0)),
        status: Number(p.amount || p.amount_paid || 0) >= Number(p.fees_master?.amount || 0) ? 'paid' : 'partially_paid',
        receipt_number: p.receipt_no,
        term_id: p.term_id || p.fees_master?.term_id || null,
        students: Array.isArray(p.students) ? p.students[0] : p.students,
        source: 'fees_collections' as const,
      })),
    ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    setPayments(merged);
    setStudents(studRes.data ?? []);
    setFeeStructures(feeRes.data ?? []);
    setTerms(termRes.data ?? []);
    setClasses(classRes.data ?? []);
    setLoading(false);
  }

  const filtered = payments.filter((p) => {
    const name = `${p.students?.first_name || ''} ${p.students?.last_name || ''}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !(p.receipt_number || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTerm && p.term_id !== filterTerm) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterDateFrom && p.payment_date < filterDateFrom) return false;
    if (filterDateTo && p.payment_date > filterDateTo) return false;
    return true;
  });

  const totalCollected = filtered.filter(p => p.status === 'paid' || p.status === 'partially_paid').reduce((sum, p) => sum + Number(p.amount_paid), 0);

  function openCreate() {
    setEditPayment(null);
    setForm({ student_id: '', fee_structure_id: '', amount_paid: '', payment_method: 'cash', receipt_number: '', status: 'paid', notes: '', term_id: terms[0]?.id || '' });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(payment: PaymentRow) {
    setEditPayment(payment);
    setForm({
      student_id: payment.student_id,
      fee_structure_id: payment.fee_structure_id || '',
      amount_paid: String(payment.amount_paid),
      payment_method: payment.payment_method || 'cash',
      receipt_number: payment.receipt_number || '',
      status: payment.status || 'paid',
      notes: payment.notes || '',
      term_id: payment.term_id || '',
    });
    setSaveError('');
    setShowModal(true);
  }

  function openDelete(payment: PaymentRow) {
    setDeletePayment(payment);
    setShowDeleteModal(true);
  }

  async function handleSave() {
    if (!form.student_id || !form.amount_paid) { setSaveError('Student and amount are required.'); return; }
    setSaving(true);
    setSaveError('');

    const fee = feeStructures.find(f => f.id === form.fee_structure_id);
    const totalFee = fee ? fee.amount : parseFloat(form.amount_paid);
    const amountPaid = parseFloat(form.amount_paid);
    const balance = Math.max(0, totalFee - amountPaid);
    const computedStatus = amountPaid >= totalFee ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid';

    const payload: any = {
      student_id: form.student_id,
      fee_structure_id: form.fee_structure_id || null,
      amount_paid: amountPaid,
      total_fee_amount: totalFee,
      balance_remaining: balance,
      payment_method: form.payment_method,
      receipt_number: form.receipt_number?.trim() || generateReceiptNumber(form.term_id, terms),
      status: form.status === 'paid' || form.status === 'partially_paid' ? computedStatus : form.status,
      notes: form.notes,
      term_id: form.term_id || null,
      school_id: profile?.school_id,
      recorded_by: profile?.id,
      payment_date: new Date().toISOString(),
    };

    let res;
    if (editPayment && editPayment.source === 'fee_payments') {
      res = await supabase.from('fee_payments').update(payload).eq('id', editPayment.id);
    } else {
      res = await supabase.from('fee_payments').insert(payload);
    }

    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setShowModal(false);
    setSaving(false);
    loadData();
  }

  async function handleDelete() {
    if (!deletePayment) return;
    setSaving(true);
    if (deletePayment.source === 'fee_payments') {
      await supabase.from('fee_payments').delete().eq('id', deletePayment.id);
    } else {
      await supabase.from('fees_collections').delete().eq('id', deletePayment.id);
    }
    setSaving(false);
    setShowDeleteModal(false);
    setDeletePayment(null);
    loadData();
  }

  async function openInstallments(payment: PaymentRow) {
    setInstallmentTarget(payment);
    setInstallmentForm({ amount_paid: '', payment_method: 'cash', receipt_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
    setSaveError('');

    const colName = payment.source === 'fee_payments' ? 'fee_payment_id' : 'fees_collection_id';
    const { data } = await supabase
      .from('fee_payment_installments')
      .select('*')
      .eq(colName, payment.id)
      .order('payment_date', { ascending: false });
    setInstallments(data ?? []);
    setShowInstallmentModal(true);
  }

  async function handleAddInstallment() {
    if (!installmentTarget || !installmentForm.amount_paid || !installmentForm.payment_date) { setSaveError('Amount and date are required.'); return; }
    setSaving(true);
    setSaveError('');

    const payload: any = {
      amount_paid: parseFloat(installmentForm.amount_paid),
      payment_method: installmentForm.payment_method,
      receipt_number: installmentForm.receipt_number || generateReceiptNumber(installmentTarget.term_id, terms),
      payment_date: installmentForm.payment_date,
      notes: installmentForm.notes,
      recorded_by: profile?.id,
    };

    if (installmentTarget.source === 'fee_payments') {
      payload.fee_payment_id = installmentTarget.id;
    } else {
      payload.fees_collection_id = installmentTarget.id;
    }

    const { error } = await supabase.from('fee_payment_installments').insert(payload);
    if (error) { setSaveError(error.message); setSaving(false); return; }

    const newTotalPaid = Number(installmentTarget.amount_paid) + parseFloat(installmentForm.amount_paid);
    const newBalance = Math.max(0, installmentTarget.total_fee_amount - newTotalPaid);
    const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

    if (installmentTarget.source === 'fee_payments') {
      await supabase.from('fee_payments').update({
        amount_paid: newTotalPaid,
        balance_remaining: newBalance,
        status: newStatus,
      }).eq('id', installmentTarget.id);
    } else {
      await supabase.from('fees_collections').update({
        amount_paid: newTotalPaid,
        amount: newTotalPaid,
      }).eq('id', installmentTarget.id);
    }

    setSaving(false);
    setShowInstallmentModal(false);
    loadData();
  }

  function printReceipt(payment: PaymentRow) {
    const termName = terms.find(t => t.id === payment.term_id)?.name || '';
    const studentName = `${payment.students?.first_name || ''} ${payment.students?.last_name || ''}`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt - ${payment.receipt_number}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
      .header h1 { margin: 0; color: #1e293b; font-size: 20px; }
      .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
      .receipt-no { text-align: right; font-size: 12px; color: #64748b; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
      td:first-child { color: #64748b; width: 40%; }
      td:last-child { font-weight: 500; color: #1e293b; }
      .total { background: #f8fafc; font-weight: 700; }
      .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="header">
      <h1>Okrika Grammar School</h1>
      <p>Payment Receipt</p>
    </div>
    <div class="receipt-no">Receipt: <strong>${payment.receipt_number || 'N/A'}</strong></div>
    <table>
      <tr><td>Student Name</td><td>${studentName}</td></tr>
      <tr><td>Admission No.</td><td>${payment.students?.admission_number || 'N/A'}</td></tr>
      <tr><td>Fee Item</td><td>${payment.fee_name}</td></tr>
      <tr><td>Term</td><td>${termName}</td></tr>
      <tr><td>Amount Due</td><td>${formatCurrency(payment.total_fee_amount)}</td></tr>
      <tr class="total"><td>Amount Paid</td><td>${formatCurrency(Number(payment.amount_paid))}</td></tr>
      <tr><td>Balance</td><td>${formatCurrency(payment.balance_remaining)}</td></tr>
      <tr><td>Payment Method</td><td style="text-transform:capitalize">${(payment.payment_method || '').replace('_', ' ')}</td></tr>
      <tr><td>Date</td><td>${new Date(payment.payment_date).toLocaleDateString()}</td></tr>
      <tr><td>Status</td><td style="text-transform:capitalize">${(payment.status || '').replace('_', ' ')}</td></tr>
    </table>
    <div class="footer">This is a computer-generated receipt. | Printed: ${new Date().toLocaleString()}</div>
    <script>window.print();</script>
    </body></html>`);
    w.document.close();
  }

  function exportCSV() {
    const headers = ['Student Name', 'Admission No', 'Fee Item', 'Amount Paid', 'Total Fee', 'Balance', 'Method', 'Status', 'Date', 'Receipt'];
    const rows = filtered.map(p => [
      `${p.students?.first_name || ''} ${p.students?.last_name || ''}`,
      p.students?.admission_number || '',
      p.fee_name,
      p.amount_paid,
      p.total_fee_amount,
      p.balance_remaining,
      p.payment_method,
      p.status,
      p.payment_date,
      p.receipt_number || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fee_payments_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fee Payments</h2>
          <p className="text-slate-500 text-sm">Record and track student fee payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-3 rounded-xl"><TrendingUp className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Collected</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalCollected)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-3 rounded-xl"><Receipt className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-800">{filtered.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student name or receipt..." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors ${showFilters ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 pt-3 border-t border-slate-100">
              <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className={inputCls}>
                <option value="">All Terms</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className={inputCls}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} placeholder="From" className={inputCls} />
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} placeholder="To" className={inputCls} />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Student</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Fee Item</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Amount Paid</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Balance</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Method</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Receipt</th>
                {isAdmin && <th className="text-right text-xs font-semibold text-slate-500 uppercase px-5 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">No payments found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{p.students?.first_name} {p.students?.last_name}</p>
                    {p.students?.admission_number && <p className="text-xs text-slate-500">{p.students.admission_number}</p>}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600 font-medium">{p.fee_name}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(Number(p.amount_paid))}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {p.balance_remaining > 0 ? <span className="text-orange-600 font-medium">{formatCurrency(p.balance_remaining)}</span> : <span className="text-slate-400">--</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500 capitalize">{(p.payment_method || '').replace('_', ' ')}</td>
                  <td className="px-5 py-3"><Badge label={(p.status || 'paid').replace('_', ' ')} variant={statusColors[p.status] || 'default'} /></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {p.receipt_number ? (
                      <button onClick={() => printReceipt(p)} className="text-xs text-emerald-600 hover:text-emerald-700 font-mono flex items-center gap-1 hover:underline">
                        <Printer className="w-3 h-3" /> {p.receipt_number}
                      </button>
                    ) : <span className="text-slate-300">--</span>}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(p.status === 'partially_paid' || p.balance_remaining > 0) && (
                          <button onClick={() => openInstallments(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Add Installment">
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isSuperAdmin && (
                          <button onClick={() => openDelete(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record/Edit Payment Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editPayment ? 'Edit Payment' : 'Record Payment'}>
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Student</label>
            <select value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} className={inputCls}>
              <option value="">Select student</option>
              {students.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fee Item</label>
            <select value={form.fee_structure_id} onChange={e => { const fee = feeStructures.find(f => f.id === e.target.value); setForm({...form, fee_structure_id: e.target.value, amount_paid: fee ? String(fee.amount) : form.amount_paid}); }} className={inputCls}>
              <option value="">Select fee</option>
              {feeStructures.map(f => <option key={f.id} value={f.id}>{f.name} - {formatCurrency(f.amount)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
            <select value={form.term_id} onChange={e => setForm({...form, term_id: e.target.value})} className={inputCls}>
              <option value="">Select term</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {form.fee_structure_id && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Due:</span>
                <span className="font-semibold">{formatCurrency(feeStructures.find(f => f.id === form.fee_structure_id)?.amount || 0)}</span>
              </div>
              {form.amount_paid && (
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Balance after payment:</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(Math.max(0, (feeStructures.find(f => f.id === form.fee_structure_id)?.amount || 0) - parseFloat(form.amount_paid || '0')))}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount Paid (N)</label>
              <input type="number" value={form.amount_paid} onChange={e => setForm({...form, amount_paid: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} className={inputCls}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Number</label>
              <input value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})} placeholder="Auto-generated if blank" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputCls}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.student_id || !form.amount_paid} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : editPayment ? 'Update' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Payment">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this payment record for{' '}
            <span className="font-semibold text-slate-800">
              {deletePayment?.students?.first_name} {deletePayment?.students?.last_name}
            </span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Installment Modal */}
      <Modal isOpen={showInstallmentModal} onClose={() => setShowInstallmentModal(false)} title="Add Installment Payment">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          {installmentTarget && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Fee Item:</span><span className="font-medium">{installmentTarget.fee_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Due:</span><span className="font-medium">{formatCurrency(installmentTarget.total_fee_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Already Paid:</span><span className="font-medium text-emerald-600">{formatCurrency(Number(installmentTarget.amount_paid))}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 mt-1"><span className="text-slate-700 font-semibold">Remaining Balance:</span><span className="font-bold text-orange-600">{formatCurrency(installmentTarget.balance_remaining)}</span></div>
            </div>
          )}

          {installments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Payment History</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {installments.map(inst => (
                  <div key={inst.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-2.5 text-xs">
                    <div>
                      <span className="font-medium text-slate-700">{formatCurrency(inst.amount_paid)}</span>
                      <span className="text-slate-400 ml-2">{inst.payment_method.replace('_', ' ')}</span>
                    </div>
                    <span className="text-slate-400">{new Date(inst.payment_date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (N)</label>
              <input type="number" max={installmentTarget?.balance_remaining || 0} value={installmentForm.amount_paid} onChange={e => setInstallmentForm({...installmentForm, amount_paid: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
              <input type="date" value={installmentForm.payment_date} onChange={e => setInstallmentForm({...installmentForm, payment_date: e.target.value})} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
              <select value={installmentForm.payment_method} onChange={e => setInstallmentForm({...installmentForm, payment_method: e.target.value})} className={inputCls}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt No.</label>
              <input value={installmentForm.receipt_number} onChange={e => setInstallmentForm({...installmentForm, receipt_number: e.target.value})} placeholder="Auto-generated" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input value={installmentForm.notes} onChange={e => setInstallmentForm({...installmentForm, notes: e.target.value})} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowInstallmentModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddInstallment} disabled={saving || !installmentForm.amount_paid || !installmentForm.payment_date} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Add Installment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
