import { useEffect, useState } from 'react';
import { Plus, DollarSign, CreditCard as Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

interface FeeStructure {
  id: string;
  name: string;
  description: string;
  amount: number;
  class_level: string;
  term_id: string | null;
  academic_year_id: string | null;
  due_date: string | null;
  is_mandatory: boolean;
  terms?: { name: string };
  academic_years?: { name: string };
}

interface AcademicYear { id: string; name: string; is_current?: boolean; }
interface Term { id: string; name: string; }

const LEVELS = ['all', 'JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white';

export default function FeeStructures() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editFee, setEditFee] = useState<FeeStructure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeStructure | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', amount: '', class_level: 'all', term_id: '', academic_year_id: '', due_date: '', is_mandatory: true });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Filters
  const [filterTerm, setFilterTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => { loadData(); }, [profile]);

  async function loadData() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [feeRes, yearRes, termRes] = await Promise.all([
      supabase.from('fee_structures').select('*, terms(name), academic_years(name)').eq('school_id', profile.school_id).order('created_at', { ascending: false }),
      supabase.from('academic_years').select('*').eq('school_id', profile.school_id),
      supabase.from('terms').select('*').order('name'),
    ]);
    setFees((feeRes.data ?? []).map((f: any) => ({
      ...f,
      terms: Array.isArray(f.terms) ? f.terms[0] : f.terms,
      academic_years: Array.isArray(f.academic_years) ? f.academic_years[0] : f.academic_years,
    })));
    setYears(yearRes.data ?? []);
    setTerms(termRes.data ?? []);
    setLoading(false);
  }

  const filteredFees = fees.filter(f => {
    if (filterTerm && f.term_id !== filterTerm) return false;
    if (filterYear && f.academic_year_id !== filterYear) return false;
    return true;
  });

  function openCreate() {
    setEditFee(null);
    setForm({ name: '', description: '', amount: '', class_level: 'all', term_id: terms[0]?.id ?? '', academic_year_id: years.find(y => y.is_current)?.id ?? '', due_date: '', is_mandatory: true });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(fee: FeeStructure) {
    setEditFee(fee);
    setForm({ name: fee.name, description: fee.description, amount: String(fee.amount), class_level: fee.class_level, term_id: fee.term_id ?? '', academic_year_id: fee.academic_year_id ?? '', due_date: fee.due_date ?? '', is_mandatory: fee.is_mandatory });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.amount) { setSaveError('Name and amount are required.'); return; }
    setSaving(true);
    const data: any = { name: form.name, description: form.description, amount: parseFloat(form.amount), class_level: form.class_level, term_id: form.term_id || null, academic_year_id: form.academic_year_id || null, due_date: form.due_date || null, is_mandatory: form.is_mandatory, school_id: profile?.school_id };
    if (editFee) {
      const res = await supabase.from('fee_structures').update(data).eq('id', editFee.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('fee_structures').insert(data);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setShowModal(false);
    loadData();
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('fee_structures').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    loadData();
  }

  const totalAmount = filteredFees.reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fee Structures</h2>
          <p className="text-slate-500 text-sm">Define and manage school fee categories</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20">
          <Plus className="w-4 h-4" /> Add Fee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-3 rounded-xl"><DollarSign className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Fee Items</p>
              <p className="text-2xl font-bold text-slate-800">{filteredFees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-3 rounded-xl"><DollarSign className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Amount (Filtered)</p>
              <p className="text-2xl font-bold text-slate-800">N{totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Term</label>
            <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className={inputCls}>
              <option value="">All Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={inputCls}>
              <option value="">All Years</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Fee Name</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Amount</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Class Level</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Term</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Academic Year</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Mandatory</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Due Date</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : filteredFees.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">No fee structures defined</td></tr>
            ) : filteredFees.map(fee => (
              <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">{fee.name}</p>
                  {fee.description && <p className="text-xs text-slate-500">{fee.description}</p>}
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-emerald-600">N{Number(fee.amount).toLocaleString()}</td>
                <td className="px-5 py-3"><Badge label={fee.class_level === 'all' ? 'All Classes' : fee.class_level} variant="info" /></td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {fee.terms?.name || 'All'}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">{fee.academic_years?.name || 'All'}</td>
                <td className="px-5 py-3"><Badge label={fee.is_mandatory ? 'Mandatory' : 'Optional'} variant={fee.is_mandatory ? 'success' : 'default'} /></td>
                <td className="px-5 py-3 text-sm text-slate-500">{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '--'}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(fee)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {isSuperAdmin && (
                      <button onClick={() => { setDeleteTarget(fee); setShowDeleteModal(true); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editFee ? 'Edit Fee Structure' : 'Add Fee Structure'}>
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fee Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. School Fees, Development Levy" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (N)</label>
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class Level</label>
              <select value={form.class_level} onChange={e => setForm({...form, class_level: e.target.value})} className={inputCls}>
                {LEVELS.map(l => <option key={l} value={l}>{l === 'all' ? 'All Classes' : l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
              <select value={form.term_id} onChange={e => setForm({...form, term_id: e.target.value})} className={inputCls}>
                <option value="">All Terms</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year</label>
              <select value={form.academic_year_id} onChange={e => setForm({...form, academic_year_id: e.target.value})} className={inputCls}>
                <option value="">All Years</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className={inputCls} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_mandatory} onChange={e => setForm({...form, is_mandatory: e.target.checked})} className="w-4 h-4 rounded text-emerald-500" />
            <span className="text-sm text-slate-700">Mandatory fee</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : editFee ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Fee Structure">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
