import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Section {
  id: string;
  name: string;
  description: string;
  school_id: string;
}

interface FormData {
  name: string;
  description: string;
}

const initialForm: FormData = { name: '', description: '' };

export default function Sections() {
  const { profile } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile?.school_id) fetchSections();
  }, [profile?.school_id]);

  async function fetchSections() {
    setLoading(true);
    const { data } = await supabase
      .from('sections')
      .select('*')
      .eq('school_id', profile!.school_id)
      .order('name');
    setSections(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(initialForm);
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(section: Section) {
    setEditing(section);
    setForm({ name: section.name, description: section.description });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      const res = await supabase
        .from('sections')
        .update({ name: form.name, description: form.description })
        .eq('id', editing.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase
        .from('sections')
        .insert({ name: form.name, description: form.description, school_id: profile!.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchSections();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this section?')) return;
    await supabase.from('sections').delete().eq('id', id);
    fetchSections();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Sections</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage class sections</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Section
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Description</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-app-text-muted">No sections found</td>
                </tr>
              ) : (
                sections.map((section) => (
                  <tr key={section.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 font-medium text-app-text">{section.name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{section.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(section)}
                          className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(section.id)}
                          className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Section' : 'Add Section'}
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              placeholder="e.g. A, B, Morning"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              rows={3}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
