import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import FeeStructureBuilder from './FeeStructureBuilder';

interface FeesGroup { id: string; name: string; }
interface FeesType { id: string; name: string; fees_group_id: string; }
interface ClassRecord { id: string; name: string; level?: string; }
interface AcademicYear { id: string; name: string; start_date: string; end_date: string; is_current: boolean; }
interface Term { id: string; name: string; }

interface FeesMasterRecord {
  id: string;
  fees_group_id: string;
  fees_type_id: string;
  class_id: string;
  academic_year_id: string;
  term_id: string | null;
  amount: number;
  due_date: string;
  is_mandatory: boolean;
  fees_types?: { name: string };
  classes?: { name: string; level?: string };
  academic_years?: { name: string; start_date?: string };
  terms?: { name: string };
}

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  fees_group_id: '',
  fees_type_id: '',
  class_id: '',
  academic_year_id: '',
  term_id: '',
  amount: 0,
  due_date: '',
  is_mandatory: true,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

export default function FeesMaster() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<FeesMasterRecord[]>([]);
  const [groups, setGroups] = useState<FeesGroup[]>([]);
  const [allTypes, setAllTypes] = useState<FeesType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<FeesType[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeesMasterRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);

  // Filters
  const [filterTerm, setFilterTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [showFuture, setShowFuture] = useState(false);

  async function fetchLookups() {
    const [{ data: grps }, { data: types }, { data: cls }, { data: years }, { data: trms }] = await Promise.all([
      supabase.from('fees_groups').select('id, name').order('name'),
      supabase.from('fees_types').select('id, name, fees_group_id').order('name'),
      supabase.from('classes').select('id, name, level').order('name'),
      supabase.from('academic_years').select('id, name, start_date, end_date, is_current').order('name', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
    ]);
    if (grps) setGroups(grps);
    if (types) setAllTypes(types);
    if (cls) setClasses(cls);
    if (years) setAcademicYears(years);
    if (trms) setTerms(trms);
  }

  async function fetchRecords() {
    setLoading(true);
    const { data, error } = await supabase
      .from('fees_master')
      .select('*, fees_types(name), classes(name, level), academic_years(name, start_date), terms(name)')
      .order('created_at', { ascending: false });
    if (!error && data) setRecords(data);
    setLoading(false);
  }

  useEffect(() => { fetchLookups(); fetchRecords(); }, []);

  useEffect(() => {
    if (form.fees_group_id) {
      setFilteredTypes(allTypes.filter((t) => t.fees_group_id === form.fees_group_id));
    } else {
      setFilteredTypes(allTypes);
    }
  }, [form.fees_group_id, allTypes]);

  const today = new Date().toISOString().split('T')[0];

  const visibleYears = showFuture
    ? academicYears
    : academicYears.filter(y => y.start_date <= today || y.is_current);

  const futureYearIds = new Set(
    academicYears.filter(y => y.start_date > today && !y.is_current).map(y => y.id)
  );

  const filteredRecords = records.filter(r => {
    if (filterTerm && r.term_id !== filterTerm) return false;
    if (filterClass && r.class_id !== filterClass) return false;
    if (filterYear && r.academic_year_id !== filterYear) return false;
    if (!showFuture && futureYearIds.has(r.academic_year_id)) return false;
    return true;
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM, term_id: terms[0]?.id || '' });
    setEditId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(rec: FeesMasterRecord) {
    setForm({
      fees_group_id: rec.fees_group_id,
      fees_type_id: rec.fees_type_id,
      class_id: rec.class_id,
      academic_year_id: rec.academic_year_id,
      term_id: rec.term_id || '',
      amount: rec.amount,
      due_date: rec.due_date,
      is_mandatory: rec.is_mandatory,
    });
    setEditId(rec.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(rec: FeesMasterRecord) {
    setDeleteTarget(rec);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.fees_type_id || !form.class_id || !form.academic_year_id || !form.amount || !form.term_id) {
      setError('Fees type, class, academic year, term, and amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { ...form, amount: Number(form.amount), term_id: form.term_id || null };
    if (editId) {
      const { error } = await supabase.from('fees_master').update(payload).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('fees_master').insert([{ ...payload, school_id: profile?.school_id }]);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchRecords();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('fees_master').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchRecords();
  }

  if (showBuilder) {
    return <FeeStructureBuilder onClose={() => { setShowBuilder(false); fetchRecords(); }} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Fees Master</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBuilder(true)} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            + Setup Fee Structure
          </button>
          <button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            + Add Fees Master
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Term</label>
            <select className={INPUT_CLASS} value={filterTerm} onChange={e => setFilterTerm(e.target.value)}>
              <option value="">All Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
            <select className={INPUT_CLASS} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
            <select className={INPUT_CLASS} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All Years</option>
              {visibleYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setShowFuture(!showFuture)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors w-full justify-center ${
                showFuture ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showFuture ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showFuture ? 'Showing Future' : 'Hide Future'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-sm">No fees master records found. Add your first entry.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Fees Type</th>
                <th className="px-4 py-3 text-left font-medium">Class</th>
                <th className="px-4 py-3 text-left font-medium">Term</th>
                <th className="px-4 py-3 text-left font-medium">Academic Year</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Due Date</th>
                <th className="px-4 py-3 text-left font-medium">Mandatory</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((rec) => {
                const isFuture = futureYearIds.has(rec.academic_year_id);
                return (
                  <tr key={rec.id} className={`hover:bg-slate-50 transition-colors ${isFuture ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{rec.fees_types?.name}</td>
                    <td className="px-4 py-3 text-slate-600">{rec.classes?.name}{rec.classes?.level ? ` (${rec.classes.level})` : ''}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {rec.terms?.name || '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <span className="flex items-center gap-1.5">
                        {rec.academic_years?.name}
                        {isFuture && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500">Future</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{formatCurrency(rec.amount)}</td>
                    <td className="px-4 py-3 text-slate-500">{rec.due_date || '--'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rec.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                        {rec.is_mandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(rec)} className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">Edit</button>
                      <button onClick={() => openDelete(rec)} className="text-red-500 hover:text-red-600 font-medium text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Fees Master' : 'Add Fees Master'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fees Group</label>
              <select className={INPUT_CLASS} value={form.fees_group_id} onChange={(e) => setForm({ ...form, fees_group_id: e.target.value, fees_type_id: '' })}>
                <option value="">Select group</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fees Type</label>
              <select className={INPUT_CLASS} value={form.fees_type_id} onChange={(e) => setForm({ ...form, fees_type_id: e.target.value })}>
                <option value="">Select type</option>
                {filteredTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
              <select className={INPUT_CLASS} value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
              <select className={INPUT_CLASS} value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}>
                <option value="">Select year</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Term</label>
            <select className={INPUT_CLASS} value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
              <option value="">Select term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (N)</label>
              <input type="number" min="0" className={INPUT_CLASS} value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
              <input type="date" className={INPUT_CLASS} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm({ ...form, is_mandatory: !form.is_mandatory })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.is_mandatory ? 'bg-emerald-500' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_mandatory ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-slate-600">Mandatory</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Fees Master">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Are you sure you want to delete this fees master record? This action cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="px-5 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
