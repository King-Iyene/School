import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface ClassRecord { id: string; name: string; }
interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; }

interface DebtRecord {
  id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  academic_year_id: string;
  amount_owed: number;
  reason: string;
  students?: { first_name: string; last_name: string; admission_number: string };
  classes?: { name: string };
  terms?: { name: string };
  academic_years?: { name: string };
}

const INPUT_CLASS = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  student_id: '',
  class_id: '',
  term_id: '',
  academic_year_id: '',
  amount_owed: 0,
  reason: '',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

export default function FeesCarryForward() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'accountant';
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [students, setStudents] = useState<{ id: string; first_name: string; last_name: string; admission_number: string; class_id: string }[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  const [records, setRecords] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DebtRecord | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DebtRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchLookups() {
    const [{ data: cls }, { data: years }, { data: trms }, { data: studs }] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('academic_years').select('id, name').eq('school_id', profile?.school_id).order('name', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
      supabase.from('students').select('id, first_name, last_name, admission_number, class_id').eq('school_id', profile?.school_id).order('first_name'),
    ]);
    if (cls) setClasses(cls);
    if (years) setAcademicYears(years);
    if (trms) setTerms(trms);
    if (studs) setStudents(studs);
  }

  async function fetchRecords() {
    if (!profile?.school_id) return;
    setLoading(true);
    let query = supabase
      .from('student_debts')
      .select('*, students(first_name, last_name, admission_number), classes(name), terms(name), academic_years(name)')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false });

    if (selectedClass) query = query.eq('class_id', selectedClass);
    if (selectedTerm) query = query.eq('term_id', selectedTerm);
    if (selectedYear) query = query.eq('academic_year_id', selectedYear);

    const { data, error } = await query;
    if (!error && data) {
      setRecords(data.map((r: any) => ({
        ...r,
        students: Array.isArray(r.students) ? r.students[0] : r.students,
        classes: Array.isArray(r.classes) ? r.classes[0] : r.classes,
        terms: Array.isArray(r.terms) ? r.terms[0] : r.terms,
        academic_years: Array.isArray(r.academic_years) ? r.academic_years[0] : r.academic_years,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { if (profile?.school_id) fetchLookups(); }, [profile?.school_id]);
  useEffect(() => { fetchRecords(); }, [selectedClass, selectedTerm, selectedYear, profile?.school_id]);

  const totalDebt = records.reduce((sum, r) => sum + Number(r.amount_owed), 0);

  function openAdd() {
    setEditRecord(null);
    setForm({ ...EMPTY_FORM, class_id: selectedClass, term_id: selectedTerm || terms[0]?.id || '', academic_year_id: selectedYear || academicYears[0]?.id || '' });
    setError('');
    setModalOpen(true);
  }

  function openEdit(rec: DebtRecord) {
    setEditRecord(rec);
    setForm({
      student_id: rec.student_id,
      class_id: rec.class_id,
      term_id: rec.term_id,
      academic_year_id: rec.academic_year_id,
      amount_owed: rec.amount_owed,
      reason: rec.reason,
    });
    setError('');
    setModalOpen(true);
  }

  function openDelete(rec: DebtRecord) {
    setDeleteTarget(rec);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.student_id || !form.term_id || !form.academic_year_id || !form.amount_owed) {
      setError('Student, term, academic year, and amount are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      amount_owed: Number(form.amount_owed),
      school_id: profile?.school_id,
      recorded_by: user?.id,
    };

    if (editRecord) {
      const { error } = await supabase.from('student_debts').update(payload).eq('id', editRecord.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('student_debts').insert([payload]);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchRecords();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('student_debts').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchRecords();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Student Debt Tracker</h1>
          <p className="text-sm text-app-text-muted mt-1">Track and manage outstanding student fees by term</p>
        </div>
        <button onClick={openAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          + Record Debt
        </button>
      </div>

      {/* Summary */}
      <div className="bg-app-surface rounded-2xl border border-app-border p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-3 rounded-xl">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm text-app-text-muted">Total Outstanding Debt ({records.length} records)</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalDebt)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-app-surface rounded-2xl border border-app-border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
            <select className={INPUT_CLASS} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Term</label>
            <select className={INPUT_CLASS} value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="">All Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Academic Year</label>
            <select className={INPUT_CLASS} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">All Years</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <p className="text-sm">No debt records found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Student Name</th>
                <th className="px-4 py-3 text-left font-medium">Admission No.</th>
                <th className="px-4 py-3 text-left font-medium">Class</th>
                <th className="px-4 py-3 text-left font-medium">Term</th>
                <th className="px-4 py-3 text-left font-medium">Academic Year</th>
                <th className="px-4 py-3 text-left font-medium">Amount Owed</th>
                <th className="px-4 py-3 text-left font-medium">Reason</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {records.map(rec => (
                <tr key={rec.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">
                    {rec.students ? `${rec.students.first_name} ${rec.students.last_name}` : 'Unknown'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-app-text-muted">{rec.students?.admission_number || '--'}</td>
                  <td className="px-4 py-3 text-app-text-muted">{rec.classes?.name || '--'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {rec.terms?.name || '--'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">{rec.academic_years?.name || '--'}</td>
                  <td className="px-4 py-3 font-medium text-orange-600">{formatCurrency(rec.amount_owed)}</td>
                  <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{rec.reason || '--'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => openEdit(rec)} className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">Edit</button>
                    {isSuperAdmin && (
                      <button onClick={() => openDelete(rec)} className="text-red-500 hover:text-red-600 font-medium text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRecord ? 'Edit Debt Record' : 'Record Debt'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
              <select className={INPUT_CLASS} value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value, student_id: ''})}>
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Term</label>
              <select className={INPUT_CLASS} value={form.term_id} onChange={e => setForm({...form, term_id: e.target.value})}>
                <option value="">Select term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Student</label>
            <select className={INPUT_CLASS} value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} disabled={!form.class_id}>
              <option value="">{form.class_id ? 'Select student' : 'Select a class first'}</option>
              {students.filter(s => s.class_id === form.class_id).map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Academic Year</label>
              <select className={INPUT_CLASS} value={form.academic_year_id} onChange={e => setForm({...form, academic_year_id: e.target.value})}>
                <option value="">Select year</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Amount Owed (N)</label>
              <input type="number" min="0" className={INPUT_CLASS} value={form.amount_owed} onChange={e => setForm({...form, amount_owed: parseFloat(e.target.value) || 0})} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Reason</label>
            <textarea className={INPUT_CLASS} rows={3} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Reason for outstanding debt..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : editRecord ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Debt Record">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete this debt record for{' '}
            <span className="font-semibold text-app-text">
              {deleteTarget?.students ? `${deleteTarget.students.first_name} ${deleteTarget.students.last_name}` : 'Unknown'}
            </span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
