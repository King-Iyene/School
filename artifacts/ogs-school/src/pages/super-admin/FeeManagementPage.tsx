import { useEffect, useState } from 'react';
import { DollarSign, Plus, Trash2, CreditCard as Edit2, Search, Printer, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import { cache } from '../../utils/cache';

type Tab = 'categories' | 'payments' | 'receipts' | 'approvals';

interface FeeCategory {
  id: string;
  name: string;
  description: string;
  amount: number;
  class_level: string;
  due_date: string | null;
  is_mandatory: boolean;
}

interface ClassOption { id: string; name: string; level: string; section: string; }

interface StudentResult {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string | null;
  classes?: { name: string; level: string } | { name: string; level: string }[];
}

interface FeeWithPaid extends FeeCategory {
  paid: number;
  balance: number;
}

interface Payment {
  id: string;
  student_id: string;
  fee_structure_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  notes: string;
  students?: { first_name: string; last_name: string; admission_number: string };
  fee_structures?: { name: string };
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors';

const EMPTY_CAT = { name: '', description: '', amount: '', class_level: '', due_date: '', is_mandatory: true };
const EMPTY_PAY = { amount_paid: '', payment_method: 'cash', receipt_number: '', notes: '', payment_date: new Date().toISOString().split('T')[0] };
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'card', 'online'];

export default function FeeManagementPage() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [tab, setTab] = useState<Tab>('approvals');

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<FeeCategory | null>(null);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState('');

  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [studentFees, setStudentFees] = useState<FeeWithPaid[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForFee, setPayForFee] = useState<FeeWithPaid | null>(null);
  const [payForm, setPayForm] = useState(EMPTY_PAY);
  const [savingPay, setSavingPay] = useState(false);
  const [payError, setPayError] = useState('');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPay, setLoadingPay] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const pageSize = 100;

  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState('');

  useEffect(() => { loadCategories(); loadClasses(); }, [profile?.school_id]);
  useEffect(() => { if (tab === 'receipts') loadPayments(); }, [tab, currentPage]);
  useEffect(() => { if (tab === 'approvals') loadPendingPayments(); }, [tab]);
  useEffect(() => {
    if (!studentSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => searchStudents(), 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadPendingPayments() {
    if (!profile?.school_id) return;
    setLoadingPending(true);
    const { data } = await supabase
      .from('fees_collections')
      .select('id, student_id, amount_paid, payment_method, receipt_no, payment_date, notes, created_at, collected_by, students(first_name, last_name, admission_number), fees_master(fees_types(name))')
      .eq('school_id', profile.school_id)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const collectorIds = [...new Set(data.map((d: any) => d.collected_by).filter(Boolean))];
      const { data: collectorProfiles } = collectorIds.length > 0
        ? await supabase.from('profiles').select('id, first_name, last_name').in('id', collectorIds)
        : { data: [] };
      const collectorMap: Record<string, any> = {};
      (collectorProfiles || []).forEach((p: any) => { collectorMap[p.id] = p; });
      const enriched = data.map((d: any) => ({ ...d, collector: collectorMap[d.collected_by] || null }));
      setPendingPayments(enriched);
    } else {
      setPendingPayments([]);
    }
    setLoadingPending(false);
  }

  async function approvePayment(id: string) {
    setProcessingId(id);
    const { error } = await supabase
      .from('fees_collections')
      .update({ approval_status: 'approved', approved_by: profile?.id, approved_at: new Date().toISOString() })
      .eq('id', id);
    setProcessingId('');
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Payment approved successfully.');
    setPendingPayments(prev => prev.filter(p => p.id !== id));
  }

  async function openRejectModal(payment: any) {
    setRejectTarget(payment);
    setRejectReason('');
    setRejectModalOpen(true);
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setProcessingId(rejectTarget.id);
    const { error } = await supabase
      .from('fees_collections')
      .update({ approval_status: 'rejected', approved_by: profile?.id, approved_at: new Date().toISOString(), rejection_reason: rejectReason.trim() })
      .eq('id', rejectTarget.id);
    setProcessingId('');
    setRejectModalOpen(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Payment rejected.');
    setPendingPayments(prev => prev.filter(p => p.id !== rejectTarget.id));
    setRejectTarget(null);
  }

  async function loadClasses() {
    if (!profile?.school_id) return;
    const data = await cache.fetch(`classes_${profile.school_id}`, async () => {
      const { data: d, error } = await supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id).order('level').order('section');
      if (error) throw error;
      return d || [];
    }, 86400000); // 24h
    setClasses(data);
  }

  async function loadCategories() {
    if (!profile?.school_id) return;
    setLoadingCat(true);
    const data = await cache.fetch(`fee_cats_${profile.school_id}`, async () => {
      const { data: d, error } = await supabase.from('fee_structures').select('*').eq('school_id', profile.school_id).order('class_level').order('name');
      if (error) throw error;
      return d || [];
    }, 3600000); // 1h
    setCategories(data);
    setLoadingCat(false);
  }

  function openAddCat() {
    setEditCat(null);
    setCatError('');
    setCatForm(EMPTY_CAT);
    setShowCatModal(true);
  }

  function openEditCat(c: FeeCategory) {
    setEditCat(c);
    setCatError('');
    setCatForm({ name: c.name, description: c.description ?? '', amount: String(c.amount), class_level: c.class_level ?? '', due_date: c.due_date ?? '', is_mandatory: c.is_mandatory });
    setShowCatModal(true);
  }

  async function saveCat() {
    if (!profile?.school_id || !catForm.name.trim() || !catForm.amount) return;
    setSavingCat(true);
    setCatError('');
    const payload = { name: catForm.name.trim(), description: catForm.description, amount: parseFloat(catForm.amount), class_level: catForm.class_level, due_date: catForm.due_date || null, is_mandatory: catForm.is_mandatory };
    let res;
    if (editCat) {
      res = await supabase.from('fee_structures').update(payload).eq('id', editCat.id);
    } else {
      res = await supabase.from('fee_structures').insert({ ...payload, school_id: profile.school_id });
    }
    if (res.error) { setCatError(res.error.message); setSavingCat(false); return; }
    setShowCatModal(false);
    await loadCategories();
    setSavingCat(false);
    showToast(editCat ? 'Fee category updated.' : 'Fee category added.');
  }

  async function deleteCat(id: string) {
    if (!confirm('Delete this fee category?')) return;
    await supabase.from('fee_structures').delete().eq('id', id);
    await loadCategories();
    showToast('Fee category deleted.');
  }

  async function searchStudents() {
    if (!profile?.school_id || !studentSearch.trim()) return;
    setSearching(true);
    const q = studentSearch.trim();
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id, classes(name, level)')
      .eq('school_id', profile.school_id)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_number.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(8);
    setSearchResults((data as any) ?? []);
    setSearching(false);
  }

  async function selectStudent(s: StudentResult) {
    setSelectedStudent(s);
    setSearchResults([]);
    setStudentSearch('');
    if (!s.classes) { setStudentFees([]); return; }
    const sLevel = Array.isArray(s.classes) ? s.classes[0]?.level : s.classes?.level;
    if (!sLevel) { setStudentFees([]); return; }
    setLoadingFees(true);
    const [catRes, payRes] = await Promise.all([
      supabase.from('fee_structures').select('*').eq('school_id', profile!.school_id).eq('class_level', sLevel),
      supabase.from('student_fee_payments').select('fee_structure_id, amount_paid').eq('student_id', s.id).eq('school_id', profile!.school_id),
    ]);
    const cats: FeeCategory[] = catRes.data ?? [];
    const paidMap: Record<string, number> = {};
    (payRes.data ?? []).forEach((p: { fee_structure_id: string; amount_paid: number }) => {
      paidMap[p.fee_structure_id] = (paidMap[p.fee_structure_id] ?? 0) + p.amount_paid;
    });
    setStudentFees(cats.map(c => ({ ...c, paid: paidMap[c.id] ?? 0, balance: c.amount - (paidMap[c.id] ?? 0) })));
    setLoadingFees(false);
  }

  function openPayModal(fee: FeeWithPaid) {
    setPayForFee(fee);
    setPayError('');
    setPayForm({ ...EMPTY_PAY, amount_paid: String(fee.balance > 0 ? fee.balance : ''), receipt_number: `RCP-${Date.now().toString().slice(-6)}` });
    setShowPayModal(true);
  }

  async function savePayment() {
    if (!profile?.school_id || !selectedStudent || !payForFee || !payForm.amount_paid) return;
    setSavingPay(true);
    setPayError('');
    const { error } = await supabase.from('student_fee_payments').insert({
      school_id: profile.school_id,
      student_id: selectedStudent.id,
      fee_structure_id: payForFee.id,
      amount_paid: parseFloat(payForm.amount_paid),
      payment_date: payForm.payment_date,
      payment_method: payForm.payment_method,
      receipt_number: payForm.receipt_number,
      notes: payForm.notes,
      recorded_by: profile.id,
    });
    if (error) { setPayError(error.message); setSavingPay(false); return; }
    setShowPayModal(false);
    cache.invalidate('receipts_');
    await selectStudent(selectedStudent);
    setSavingPay(false);
    showToast('Payment recorded successfully.');
  }

  async function loadPayments() {
    if (!profile?.school_id) return;
    setLoadingPay(true);
    try {
      const cacheKey = `receipts_p${currentPage}_s${pageSize}_${profile.school_id}`;
      const result = await cache.fetch(cacheKey, async () => {
        const query = supabase
          .from('student_fee_payments')
          .select('*, students(first_name, last_name, admission_number), fee_structures(name)', { count: 'exact' })
          .eq('school_id', profile.school_id)
          .order('payment_date', { ascending: false });

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error: sError } = await query.range(from, to);
        if (sError) throw sError;
        return { data: data || [], count: count || 0 };
      }, 3600000);

      setPayments(result.data);
      setTotalPayments(result.count);
    } catch (err: any) {
      showToast(`Fetch Error: ${err.message}`, 'error');
    } finally {
      setLoadingPay(false);
    }
  }

  function printReceipt(p: Payment) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${p.receipt_number}</title>
      <style>body{font-family:Arial,sans-serif;max-width:400px;margin:40px auto;padding:20px}h2{text-align:center;margin-bottom:4px}.school{text-align:center;color:#666;margin-bottom:20px}.divider{border-top:2px dashed #ccc;margin:16px 0}.row{display:flex;justify-content:space-between;margin:8px 0;font-size:14px}.label{color:#666}.value{font-weight:600}.total{font-size:18px;color:#059669}.footer{text-align:center;margin-top:24px;font-size:12px;color:#999}</style></head>
      <body>
      <h2>PAYMENT RECEIPT</h2>
      <p class="school">${settings.school_name || 'School Portal'}</p>
      <div class="divider"></div>
      <div class="row"><span class="label">Receipt No.</span><span class="value">${p.receipt_number}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="label">Student</span><span class="value">${p.students?.first_name} ${p.students?.last_name}</span></div>
      <div class="row"><span class="label">Admission No.</span><span class="value">${p.students?.admission_number}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="label">Fee Type</span><span class="value">${p.fee_structures?.name}</span></div>
      <div class="row"><span class="label">Payment Method</span><span class="value">${p.payment_method.replace('_', ' ')}</span></div>
      <div class="row"><span class="label">Amount Paid</span><span class="value total">₦${Number(p.amount_paid).toLocaleString()}</span></div>
      <div class="divider"></div>
      <p class="footer">Thank you for your payment.<br/>This is an official receipt.</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'approvals', label: `Pending Approvals${pendingPayments.length ? ` (${pendingPayments.length})` : ''}` },
    { key: 'categories', label: 'Fee Categories' },
    { key: 'payments', label: 'Student Payments' },
    { key: 'receipts', label: 'Receipts' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fee Management</h2>
          <p className="text-slate-500 text-sm">Manage fee categories, record payments, and print receipts</p>
        </div>
      </div>

      {toast && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${toastType === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {toast}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-slate-800">Pending Fee Payment Approvals</h3>
            </div>
            <button onClick={loadPendingPayments} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Refresh</button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Student', 'Fee Type', 'Amount', 'Method', 'Receipt', 'Date', 'Collected By', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingPending ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
                ) : pendingPayments.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10">
                    <CheckCircle className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No pending payments to approve.</p>
                  </td></tr>
                ) : pendingPayments.map(p => {
                  const student = Array.isArray(p.students) ? p.students[0] : p.students;
                  const feeType = Array.isArray(p.fees_master) ? p.fees_master[0] : p.fees_master;
                  const collector = p.collector;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{student?.first_name} {student?.last_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{student?.admission_number}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{feeType?.fees_types?.name || '--'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{Number(p.amount_paid).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 capitalize">{p.payment_method?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{p.receipt_no || '--'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{collector?.first_name} {collector?.last_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => approvePayment(p.id)}
                            disabled={processingId === p.id}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(p)}
                            disabled={processingId === p.id}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openAddCat} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Fee Category
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['SL', 'Name', 'Class Level', 'Amount', 'Due Date', 'Mandatory', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingCat ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10">
                    <DollarSign className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No fee categories yet.</p>
                  </td></tr>
                ) : categories.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.class_level || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700">₦{Number(c.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{c.due_date ? new Date(c.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.is_mandatory ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {c.is_mandatory ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditCat(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteCat(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">Search Student</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="Type student name or admission number..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching...</span>}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {searchResults.map(s => (
                  <button key={s.id} onClick={() => selectStudent(s)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-left">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700 flex-shrink-0">
                      {s.first_name[0]}{s.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400">{s.admission_number} · {Array.isArray(s.classes) ? s.classes[0]?.level : s.classes?.level || 'No class'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudent && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-semibold text-emerald-700">
                    {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                    <p className="text-xs text-slate-400">{selectedStudent.admission_number} · {selectedStudent.classes?.level || 'No class assigned'}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingFees ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Loading fees...</div>
              ) : studentFees.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                  No fee categories found for {selectedStudent.classes?.level || 'this student\'s class'}.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">Fee Summary</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Fee Type', 'Total', 'Paid', 'Balance', ''].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentFees.map(fee => (
                        <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-800">{fee.name}</p>
                            {fee.is_mandatory && <span className="text-xs text-red-400">Mandatory</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">₦{Number(fee.amount).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-emerald-600 font-medium">₦{Number(fee.paid).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${fee.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                              ₦{Number(fee.balance).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => openPayModal(fee)} className="text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium">
                              Record Payment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">Total</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">₦{studentFees.reduce((a, f) => a + Number(f.amount), 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-600">₦{studentFees.reduce((a, f) => a + Number(f.paid), 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-bold text-red-500">₦{studentFees.reduce((a, f) => a + Number(f.balance), 0).toLocaleString()}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {!selectedStudent && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Search for a student to view their fees and record payments</p>
            </div>
          )}
        </div>
      )}

      {tab === 'receipts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Receipt No.', 'Student', 'Fee Type', 'Amount', 'Method', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingPay ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10">
                    <DollarSign className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No payments recorded yet.</p>
                  </td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.receipt_number || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{p.students?.first_name} {p.students?.last_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.students?.admission_number}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.fee_structures?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700">₦{Number(p.amount_paid).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{p.payment_method?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => printReceipt(p)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
                        <Printer className="w-3.5 h-3.5" /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalPayments)} of {totalPayments} receipt{totalPayments !== 1 ? 's' : ''}
              </div>
              {Math.ceil(totalPayments / pageSize) > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Previous</button>
                  <div className="text-sm font-medium text-slate-600 px-2">Page {currentPage} of {Math.ceil(totalPayments / pageSize)}</div>
                  <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalPayments / pageSize), p + 1))} disabled={currentPage === Math.ceil(totalPayments / pageSize)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Next</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title={editCat ? 'Edit Fee Category' : 'Add Fee Category'} size="lg">
        <div className="space-y-4">
          {catError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{catError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className={inputCls} placeholder="e.g. School Fees" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₦) <span className="text-red-500">*</span></label>
              <input type="number" value={catForm.amount} onChange={e => setCatForm({ ...catForm, amount: e.target.value })} className={inputCls} placeholder="e.g. 25000" min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class Level</label>
              <select value={catForm.class_level} onChange={e => setCatForm({ ...catForm, class_level: e.target.value })} className={`${inputCls} bg-white`}>
                <option value="">All Classes</option>
                {Array.from(new Set(classes.map(c => c.level))).map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" value={catForm.due_date} onChange={e => setCatForm({ ...catForm, due_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} className={inputCls} placeholder="Optional description" />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-700">Mandatory Fee</p>
              <p className="text-xs text-slate-400">Students are required to pay this fee</p>
            </div>
            <button
              type="button"
              onClick={() => setCatForm({ ...catForm, is_mandatory: !catForm.is_mandatory })}
              className={`relative w-11 h-6 rounded-full transition-colors ${catForm.is_mandatory ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${catForm.is_mandatory ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCatModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={saveCat} disabled={savingCat || !catForm.name.trim() || !catForm.amount} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {savingCat ? 'Saving...' : editCat ? 'Update' : 'Add Category'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Reject Payment">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Please provide a reason for rejecting this payment.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className={`${inputCls} min-h-[80px]`}
              placeholder="Enter reason for rejection..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setRejectModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={confirmReject} disabled={!rejectReason.trim() || !!processingId} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {processingId ? 'Processing...' : 'Reject Payment'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Record Payment">
        <div className="space-y-4">
          {payError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{payError}</div>}
          {payForFee && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-sm font-semibold text-slate-700">{payForFee.name}</p>
              <div className="flex gap-4 mt-1 text-xs text-slate-500">
                <span>Total: <strong className="text-slate-700">₦{Number(payForFee.amount).toLocaleString()}</strong></span>
                <span>Paid: <strong className="text-emerald-600">₦{Number(payForFee.paid).toLocaleString()}</strong></span>
                <span>Balance: <strong className="text-red-500">₦{Number(payForFee.balance).toLocaleString()}</strong></span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₦) <span className="text-red-500">*</span></label>
              <input type="number" value={payForm.amount_paid} onChange={e => setPayForm({ ...payForm, amount_paid: e.target.value })} className={inputCls} min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
              <input type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })} className={`${inputCls} bg-white`}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt Number</label>
              <input value={payForm.receipt_number} onChange={e => setPayForm({ ...payForm, receipt_number: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} className={inputCls} placeholder="Optional notes" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={savePayment} disabled={savingPay || !payForm.amount_paid} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {savingPay ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
