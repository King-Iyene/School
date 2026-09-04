import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

interface ClassRecord { id: string; name: string; }
interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; }

interface Student {
  id: string;
  student_id: string;
  students?: { first_name: string; last_name: string; admission_number: string };
}

interface FeesMasterItem {
  id: string;
  fees_type_id: string;
  amount: number;
  due_date: string;
  is_mandatory: boolean;
  fees_types?: { name: string };
  paid_amount: number;
  balance: number;
  status: 'paid' | 'partially_paid' | 'unpaid';
}

interface FeesDiscount { id: string; name: string; discount_type: 'percentage' | 'fixed'; discount_value: number; }
interface PaymentMethod { id: string; name: string; }

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

const EMPTY_COLLECT_FORM = {
  fees_master_id: '',
  amount_paid: 0,
  discount_id: '',
  fine_amount: 0,
  payment_method_id: '',
  receipt_no: '',
  payment_date: '',
  remarks: '',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

const statusColors: Record<string, string> = { paid: 'success', partially_paid: 'warning', unpaid: 'error' };

export default function CollectFees() {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [discounts, setDiscounts] = useState<FeesDiscount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [searchName, setSearchName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [feesMasterItems, setFeesMasterItems] = useState<FeesMasterItem[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [collectForm, setCollectForm] = useState(EMPTY_COLLECT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function fetchLookups() {
    const [{ data: cls }, { data: years }, { data: trms }, { data: discs }, { data: pms }] = await Promise.all([
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('academic_years').select('id, name').order('name', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
      supabase.from('fees_discounts').select('id, name, discount_type, discount_value').order('name'),
      supabase.from('payment_methods_list').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (cls) setClasses(cls);
    if (years) setAcademicYears(years);
    if (trms) setTerms(trms);
    if (discs) setDiscounts(discs);
    if (pms) setPaymentMethods(pms);
  }

  async function fetchStudents() {
    if (!selectedClass || !selectedYear || !selectedTerm) return;
    setLoadingStudents(true);
    const { data } = await supabase
      .from('student_enrollments')
      .select('id, student_id, students(first_name, last_name, admission_number)')
      .eq('class_id', selectedClass)
      .eq('academic_year_id', selectedYear);

    let result = (data || []).map((s: any) => ({
      ...s,
      students: Array.isArray(s.students) ? s.students[0] : s.students,
    }));

    if (searchName) {
      result = result.filter((s: any) => {
        const fullName = `${s.students?.first_name ?? ''} ${s.students?.last_name ?? ''}`.toLowerCase();
        return fullName.includes(searchName.toLowerCase());
      });
    }
    setStudents(result);
    setLoadingStudents(false);
  }

  async function fetchFeesMasterForStudent(student: Student) {
    if (!selectedClass || !selectedYear || !selectedTerm) return;
    setLoadingFees(true);

    let query = supabase
      .from('fees_master')
      .select('id, fees_group_id, fees_type_id, amount, due_date, is_mandatory, fees_types(name)')
      .eq('class_id', selectedClass)
      .eq('academic_year_id', selectedYear)
      .or(`term_id.eq.${selectedTerm},term_id.is.null`);

    const { data: allFees } = await query;

    const { data: paidFees } = await supabase
      .from('fees_collections')
      .select('fees_master_id, amount_paid')
      .eq('student_id', student.student_id)
      .eq('approval_status', 'approved');

    const paidMap: Record<string, number> = {};
    (paidFees || []).forEach((p: any) => {
      paidMap[p.fees_master_id] = (paidMap[p.fees_master_id] || 0) + Number(p.amount_paid || 0);
    });

    const items: FeesMasterItem[] = (allFees || []).map((f: any) => {
      const paid = paidMap[f.id] || 0;
      const balance = Math.max(0, f.amount - paid);
      const status = balance <= 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid';
      return {
        ...f,
        fees_types: Array.isArray(f.fees_types) ? f.fees_types[0] : f.fees_types,
        paid_amount: paid,
        balance,
        status,
      };
    });

    setFeesMasterItems(items);
    setLoadingFees(false);
  }

  useEffect(() => { fetchLookups(); }, []);
  useEffect(() => { fetchStudents(); }, [selectedClass, selectedYear, selectedTerm, searchName]);

  async function openCollectModal(student: Student) {
    setSelectedStudent(student);
    setCollectForm({ ...EMPTY_COLLECT_FORM, payment_date: new Date().toISOString().split('T')[0] });
    setError('');
    setSuccessMsg('');
    setModalOpen(true);
    await fetchFeesMasterForStudent(student);
  }

  async function handleCollect() {
    if (!collectForm.fees_master_id || !collectForm.payment_method_id || !collectForm.payment_date) {
      setError('Fees item, payment method, and payment date are required.');
      return;
    }
    if (!collectForm.amount_paid || Number(collectForm.amount_paid) <= 0) {
      setError('Amount paid must be greater than 0.');
      return;
    }
    setSaving(true);
    setError('');

    const receiptNo = collectForm.receipt_no || `RCP-${new Date().getFullYear()}-${selectedTerm ? 'T' + (terms.findIndex(t => t.id === selectedTerm) + 1) : 'T0'}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

    const payload = {
      school_id: profile?.school_id,
      student_id: selectedStudent?.student_id,
      fees_master_id: collectForm.fees_master_id,
      amount: Number(collectForm.amount_paid),
      amount_paid: Number(collectForm.amount_paid),
      discount_amount: discountAmount,
      fine_amount: Number(collectForm.fine_amount) || 0,
      net_amount: totalDue,
      payment_method: paymentMethods.find(m => m.id === collectForm.payment_method_id)?.name || 'cash',
      receipt_no: receiptNo,
      payment_date: collectForm.payment_date,
      notes: collectForm.remarks,
      collected_by: user?.id,
      academic_year_id: selectedYear,
      term_id: selectedTerm,
      approval_status: 'pending',
    };

    const { error: insertError } = await supabase.from('fees_collections').insert([payload]);
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    logActivity(profile, {
      action: 'fee.payment_recorded',
      entityType: 'fee_payment',
      studentId: selectedStudent?.student_id ?? null,
      details: { student: selectedStudent?.students ? `${selectedStudent.students.first_name} ${selectedStudent.students.last_name}` : '', amount: `₦${Number(collectForm.amount_paid).toLocaleString()}`, receipt: receiptNo },
    });
    setSaving(false);
    setSuccessMsg(`Payment submitted for approval. Receipt: ${receiptNo}. Awaiting super admin confirmation.`);
    setCollectForm(EMPTY_COLLECT_FORM);
    await fetchFeesMasterForStudent(selectedStudent!);
  }

  const selectedFeeItem = feesMasterItems.find((f) => f.id === collectForm.fees_master_id);

  function computeDiscount(): number {
    if (!collectForm.discount_id || !selectedFeeItem) return 0;
    const disc = discounts.find((d) => d.id === collectForm.discount_id);
    if (!disc) return 0;
    if (disc.discount_type === 'percentage') return (selectedFeeItem.balance * disc.discount_value) / 100;
    return disc.discount_value;
  }

  const discountAmount = computeDiscount();
  const totalDue = selectedFeeItem
    ? selectedFeeItem.balance - discountAmount + Number(collectForm.fine_amount || 0)
    : 0;

  const canLoad = selectedClass && selectedYear && selectedTerm;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Collect Fees</h1>
      </div>

      {/* Filters */}
      <div className="bg-app-surface rounded-2xl border border-app-border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Class <span className="text-red-400">*</span></label>
            <select className={INPUT_CLASS} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Academic Year <span className="text-red-400">*</span></label>
            <select className={INPUT_CLASS} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">Select year</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Term <span className="text-red-400">*</span></label>
            <select className={INPUT_CLASS} value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">Select term</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Search Student</label>
            <input className={INPUT_CLASS} value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Search by name..." />
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {!canLoad ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <p className="text-sm">Select a class, academic year, and term to load students.</p>
          </div>
        ) : loadingStudents ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <p className="text-sm">No students found for the selected class.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Student Name</th>
                <th className="px-4 py-3 text-left font-medium">Student ID</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">
                    {s.students ? `${s.students.first_name} ${s.students.last_name}` : 'Unknown'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-app-text-muted">{s.students?.admission_number || '--'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openCollectModal(s)} className="bg-app-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Collect Fees
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Collect Fees Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Collect Fees - ${selectedStudent?.students?.first_name ?? ''} ${selectedStudent?.students?.last_name ?? ''}`}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          {successMsg && <p className="text-emerald-600 text-sm bg-emerald-50 rounded-xl px-3 py-2">{successMsg}</p>}

          {loadingFees ? (
            <p className="text-sm text-app-text-muted text-center py-4">Loading fees...</p>
          ) : feesMasterItems.length === 0 ? (
            <div className="text-center py-6 text-app-text-muted">
              <p className="text-sm">No fee items configured for this term and class.</p>
            </div>
          ) : (
            <>
              {/* Fee Status Summary */}
              <div className="border border-app-border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-app-surface-alt text-app-text-muted uppercase">
                      <th className="px-3 py-2 text-left">Fee Item</th>
                      <th className="px-3 py-2 text-right">Due</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {feesMasterItems.map(f => (
                      <tr key={f.id} className={f.status === 'paid' ? 'opacity-50' : ''}>
                        <td className="px-3 py-2 font-medium text-app-text">{f.fees_types?.name}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(f.amount)}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(f.paid_amount)}</td>
                        <td className="px-3 py-2 text-right text-orange-600 font-medium">{formatCurrency(f.balance)}</td>
                        <td className="px-3 py-2 text-center"><Badge label={f.status.replace('_', ' ')} variant={statusColors[f.status] || 'default'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Select Fee Item to Pay</label>
                <select className={INPUT_CLASS} value={collectForm.fees_master_id} onChange={e => setCollectForm({...collectForm, fees_master_id: e.target.value})}>
                  <option value="">Select fee item</option>
                  {feesMasterItems.filter(f => f.status !== 'paid').map(f => (
                    <option key={f.id} value={f.id}>
                      {f.fees_types?.name} - Balance: {formatCurrency(f.balance)} {f.is_mandatory ? '(Mandatory)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFeeItem && (
                <div className="bg-app-surface-alt rounded-xl p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-app-text-muted">Amount Due (Balance):</span>
                    <span className="font-medium">{formatCurrency(selectedFeeItem.balance)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>- {formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  {Number(collectForm.fine_amount) > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Fine:</span>
                      <span>+ {formatCurrency(Number(collectForm.fine_amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-app-text border-t border-app-border pt-1 mt-1">
                    <span>Net Payable:</span>
                    <span>{formatCurrency(totalDue)}</span>
                  </div>
                  {collectForm.amount_paid > 0 && (
                    <div className="flex justify-between text-orange-600 font-medium">
                      <span>Balance After Payment:</span>
                      <span>{formatCurrency(Math.max(0, totalDue - Number(collectForm.amount_paid)))}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Amount Paid (N)</label>
                  <input type="number" min="0" className={INPUT_CLASS} value={collectForm.amount_paid} onChange={e => setCollectForm({...collectForm, amount_paid: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Fine Amount (N)</label>
                  <input type="number" min="0" className={INPUT_CLASS} value={collectForm.fine_amount} onChange={e => setCollectForm({...collectForm, fine_amount: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Discount (Optional)</label>
                <select className={INPUT_CLASS} value={collectForm.discount_id} onChange={e => setCollectForm({...collectForm, discount_id: e.target.value})}>
                  <option value="">No discount</option>
                  {discounts.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.discount_type === 'percentage' ? `${d.discount_value}%` : formatCurrency(d.discount_value)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Payment Method</label>
                  <select className={INPUT_CLASS} value={collectForm.payment_method_id} onChange={e => setCollectForm({...collectForm, payment_method_id: e.target.value})}>
                    <option value="">Select method</option>
                    {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Payment Date</label>
                  <input type="date" className={INPUT_CLASS} value={collectForm.payment_date} onChange={e => setCollectForm({...collectForm, payment_date: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-muted mb-1">Receipt No (auto-generated if blank)</label>
                <input className={INPUT_CLASS} value={collectForm.receipt_no} onChange={e => setCollectForm({...collectForm, receipt_no: e.target.value})} placeholder="e.g. RCP-2026-T1-00001" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors">Close</button>
                <button onClick={handleCollect} disabled={saving} className="px-5 py-2.5 text-sm bg-app-primary hover:opacity-90 text-white font-medium rounded-xl transition-colors disabled:opacity-60">
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
