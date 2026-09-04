import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

interface StudentCategory {
  id: string;
  name: string;
  description: string | null;
  student_count?: number;
}

interface FormState {
  name: string;
  description: string;
}

const defaultForm: FormState = { name: '', description: '' };

export default function StudentCategory() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentCategory | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchCategories() {
    setLoading(true);
    const { data, error } = await supabase
      .from('student_categories')
      .select('id, name, description')
      .order('name');

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const ids = (data || []).map((c: StudentCategory) => c.id);
    let counts: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: countData } = await supabase
        .from('profiles')
        .select('category_id')
        .in('category_id', ids)
        .eq('role', 'student');

      if (countData) {
        for (const row of countData as { category_id: string }[]) {
          counts[row.category_id] = (counts[row.category_id] || 0) + 1;
        }
      }
    }

    const enriched = (data || []).map((c: StudentCategory) => ({
      ...c,
      student_count: counts[c.id] || 0,
    }));

    setCategories(enriched);
    setLoading(false);
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(cat: StudentCategory) {
    setEditTarget(cat);
    setForm({ name: cat.name, description: cat.description || '' });
    setError(null);
    setModalOpen(true);
  }

  function openDelete(cat: StudentCategory) {
    setDeleteTarget(cat);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    if (editTarget) {
      const { error } = await supabase
        .from('student_categories')
        .update({ name: form.name.trim(), description: form.description.trim() || null })
        .eq('id', editTarget.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from('student_categories')
        .insert({ name: form.name.trim(), description: form.description.trim() || null });
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setModalOpen(false);
    fetchCategories();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('student_categories')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) { setError(error.message); return; }
    setDeleteModalOpen(false);
    fetchCategories();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg">
            <Tag className="text-emerald-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-app-text">Student Category</h1>
            <p className="text-sm text-app-text-muted">Manage student categories</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <Tag size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No categories found. Add one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-5 py-3 font-medium text-app-text-muted">Name</th>
                <th className="text-left px-5 py-3 font-medium text-app-text-muted">Description</th>
                <th className="text-center px-5 py-3 font-medium text-app-text-muted">Students</th>
                <th className="text-right px-5 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5 font-medium text-app-text">{cat.name}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{cat.description || <span className="italic text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 font-semibold rounded-full px-3 py-0.5 text-xs">
                      {cat.student_count ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-app-text-muted hover:text-emerald-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => openDelete(cat)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-app-text-muted hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
              placeholder="e.g. General, Special Needs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full resize-none"
              rows={3}
              placeholder="Optional description..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-app-text-muted hover:text-app-text border border-app-border rounded-xl hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-app-primary hover:opacity-90 text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Category">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete <span className="font-semibold text-app-text">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-sm text-app-text-muted border border-app-border rounded-xl hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-5 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
