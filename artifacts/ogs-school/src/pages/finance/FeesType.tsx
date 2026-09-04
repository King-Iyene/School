import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface FeesGroup {
  id: string;
  name: string;
}

interface FeesType {
  id: string;
  name: string;
  fees_code: string;
  fees_group_id: string;
  description: string;
  fees_groups?: { name: string };
}

const INPUT_CLASS =
  'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  name: '',
  fees_code: '',
  fees_group_id: '',
  description: '',
};

export default function FeesType() {
  const { profile } = useAuth();
  const [types, setTypes] = useState<FeesType[]>([]);
  const [groups, setGroups] = useState<FeesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeesType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchGroups() {
    const { data } = await supabase.from('fees_groups').select('id, name').order('name');
    if (data) setGroups(data);
  }

  async function fetchTypes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('fees_types')
      .select('*, fees_groups(name)')
      .order('name', { ascending: true });
    if (!error && data) setTypes(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchGroups();
    fetchTypes();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(t: FeesType) {
    setForm({
      name: t.name,
      fees_code: t.fees_code,
      fees_group_id: t.fees_group_id,
      description: t.description,
    });
    setEditId(t.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(t: FeesType) {
    setDeleteTarget(t);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.fees_code.trim() || !form.fees_group_id) {
      setError('Name, fees code, and group are required.');
      return;
    }
    setSaving(true);
    setError('');
    if (editId) {
      const { error } = await supabase.from('fees_types').update(form).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('fees_types').insert([{ ...form, school_id: profile?.school_id }]);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchTypes();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('fees_types').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchTypes();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Fees Type</h1>
        <button
          onClick={openCreate}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Fees Type
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading...</div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <span className="text-4xl mb-3">🏷️</span>
            <p className="text-sm">No fees types found. Add your first type.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Fees Code</th>
                <th className="px-4 py-3 text-left font-medium">Group</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {types.map((t) => (
                <tr key={t.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-app-text-muted bg-app-surface-alt rounded">{t.fees_code}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      {t.fees_groups?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{t.description}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(t)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(t)}
                      className="text-red-500 hover:text-red-600 font-medium text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Fees Type' : 'Add Fees Type'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Name</label>
            <input
              className={INPUT_CLASS}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Tuition Fee"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Fees Code</label>
              <input
                className={INPUT_CLASS}
                value={form.fees_code}
                onChange={(e) => setForm({ ...form, fees_code: e.target.value })}
                placeholder="e.g. TUI-001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Fees Group</label>
              <select
                className={INPUT_CLASS}
                value={form.fees_group_id}
                onChange={(e) => setForm({ ...form, fees_group_id: e.target.value })}
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Fees Type">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete <span className="font-semibold text-app-text">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
