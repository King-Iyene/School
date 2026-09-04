import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface GradeScale {
  id: string;
  grade_name: string;
  min_mark: number;
  max_mark: number;
  grade: string;
  gpa: number;
  remark: string;
  sort_order: number;
}

interface FormData {
  grade_name: string;
  min_mark: string;
  max_mark: string;
  grade: string;
  gpa: string;
  remark: string;
  sort_order: string;
}

const defaultForm: FormData = {
  grade_name: '',
  min_mark: '',
  max_mark: '',
  grade: '',
  gpa: '',
  remark: '',
  sort_order: '',
};

export default function GradeScale() {
  const { user } = useAuth();
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetchScales();
  }, []);

  async function fetchScales() {
    setLoading(true);
    const { data } = await supabase
      .from('grade_scales')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setScales(data);
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setSaveError('');
    setForm(defaultForm);
    setModalOpen(true);
  }

  function openEdit(scale: GradeScale) {
    setEditingId(scale.id);
    setSaveError('');
    setForm({
      grade_name: scale.grade_name,
      min_mark: String(scale.min_mark),
      max_mark: String(scale.max_mark),
      grade: scale.grade,
      gpa: String(scale.gpa),
      remark: scale.remark ?? '',
      sort_order: String(scale.sort_order),
    });
    setModalOpen(true);
  }

  function openDelete(id: string) {
    setDeleteId(id);
    setDeleteModalOpen(true);
  }

  function isFormValid() {
    return (
      form.grade_name.trim() !== '' &&
      form.min_mark !== '' &&
      form.max_mark !== '' &&
      form.grade.trim() !== '' &&
      form.gpa !== ''
    );
  }

  async function handleSave() {
    if (!isFormValid()) return;
    setSaving(true);
    const payload = {
      grade_name: form.grade_name,
      min_mark: parseFloat(form.min_mark),
      max_mark: parseFloat(form.max_mark),
      grade: form.grade,
      gpa: parseFloat(form.gpa),
      remark: form.remark,
      sort_order: parseInt(form.sort_order) || 0,
    };
    let res;
    if (editingId) {
      res = await supabase.from('grade_scales').update(payload).eq('id', editingId);
    } else {
      res = await supabase.from('grade_scales').insert(payload);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchScales();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('grade_scales').delete().eq('id', deleteId);
    setDeleteModalOpen(false);
    setDeleteId(null);
    fetchScales();
  }

  const inputClass =
    'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Marks Grade</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Grade Scale
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : scales.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted">
          <p className="text-lg font-medium">No grade scales found</p>
          <p className="text-sm mt-1">Click "Add Grade Scale" to create one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-app-border">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Grade Name</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Min Mark</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Max Mark</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Grade</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">GPA</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Remark</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Sort Order</th>
                <th className="text-right px-4 py-3 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {scales.map((scale) => (
                <tr key={scale.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{scale.grade_name}</td>
                  <td className="px-4 py-3 text-app-text-muted">{scale.min_mark}</td>
                  <td className="px-4 py-3 text-app-text-muted">{scale.max_mark}</td>
                  <td className="px-4 py-3">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {scale.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">{scale.gpa}</td>
                  <td className="px-4 py-3 text-app-text-muted">{scale.remark ?? '—'}</td>
                  <td className="px-4 py-3 text-app-text-muted">{scale.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(scale)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => openDelete(scale.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Grade Scale' : 'Add Grade Scale'}
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                Grade Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.grade_name}
                onChange={(e) => setForm({ ...form, grade_name: e.target.value })}
                placeholder="e.g. Excellent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                Grade <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g. A1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                Min Mark <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={form.min_mark}
                onChange={(e) => setForm({ ...form, min_mark: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                Max Mark <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={inputClass}
                value={form.max_mark}
                onChange={(e) => setForm({ ...form, max_mark: e.target.value })}
                placeholder="100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                GPA <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="4"
                className={inputClass}
                value={form.gpa}
                onChange={(e) => setForm({ ...form, gpa: e.target.value })}
                placeholder="0.0 - 4.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Sort Order</label>
              <input
                type="number"
                className={inputClass}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Remark</label>
            <input
              className={inputClass}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="Optional remark"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isFormValid()}
              className="px-4 py-2 text-sm rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Grade Scale"
      >
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete this grade scale? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
