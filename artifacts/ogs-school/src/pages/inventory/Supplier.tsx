import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  school_id: string;
}

export default function Supplier() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setSuppliers(data as Supplier[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: '', contact_person: '', email: '', phone: '', address: '', notes: '' });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditId(s.id);
    setForm({
      name: s.name || '',
      contact_person: s.contact_person || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      contact_person: form.contact_person,
      email: form.email,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
      school_id: profile?.school_id,
    };
    let res;
    if (editId) {
      res = await supabase.from('suppliers').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('suppliers').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchSuppliers();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this supplier?')) return;
    await supabase.from('suppliers').delete().eq('id', id);
    fetchSuppliers();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-app-primary text-white p-2 rounded-xl">
            <Truck size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Suppliers</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Supplier
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Truck size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No suppliers found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Contact Person</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{s.name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{s.contact_person || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{s.email || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{s.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Name</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Supplier name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Contact Person</label>
              <input
                className={INPUT_CLASS}
                value={form.contact_person}
                onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))}
                placeholder="Contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Phone</label>
              <input
                className={INPUT_CLASS}
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Email</label>
            <input
              type="email"
              className={INPUT_CLASS}
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Address</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Supplier address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Notes</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Additional notes"
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
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-app-primary hover:opacity-90 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
