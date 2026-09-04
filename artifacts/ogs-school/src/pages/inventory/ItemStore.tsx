import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Warehouse } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface Store {
  id: string;
  name: string;
  location: string;
  description: string;
  school_id: string;
}

export default function ItemStore() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', location: '', description: '' });

  useEffect(() => {
    fetchStores();
  }, []);

  async function fetchStores() {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_stores')
      .select('*')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setStores(data as Store[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: '', location: '', description: '' });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(store: Store) {
    setEditId(store.id);
    setForm({
      name: store.name || '',
      location: store.location || '',
      description: store.description || '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      location: form.location,
      description: form.description,
      school_id: profile?.school_id,
    };
    let res;
    if (editId) {
      res = await supabase.from('inventory_stores').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('inventory_stores').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchStores();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this store?')) return;
    await supabase.from('inventory_stores').delete().eq('id', id);
    fetchStores();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <Warehouse size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Item Stores</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Store
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : stores.length === 0 ? (
          <div className="p-12 text-center">
            <Warehouse size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No stores found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {stores.map(store => (
                  <tr key={store.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{store.name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{store.location || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{store.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(store)}
                          className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(store.id)}
                          className="text-app-text-muted hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
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
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Store' : 'Add Store'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Name</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Store name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Location</label>
            <input
              className={INPUT_CLASS}
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder="e.g. Block A, Room 101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-app-border text-app-text-muted hover:bg-app-surface-alt"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
