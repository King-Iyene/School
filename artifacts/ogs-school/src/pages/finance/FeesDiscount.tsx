import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface FeesDiscount {
  id: string;
  name: string;
  discount_code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  description: string;
}

const INPUT_CLASS =
  'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM: Omit<FeesDiscount, 'id'> = {
  name: '',
  discount_code: '',
  discount_type: 'percentage',
  discount_value: 0,
  description: '',
};

export default function FeesDiscount() {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState<FeesDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<FeesDiscount, 'id'>>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeesDiscount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchDiscounts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('fees_discounts')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) setDiscounts(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchDiscounts();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(d: FeesDiscount) {
    setForm({
      name: d.name,
      discount_code: d.discount_code,
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      description: d.description,
    });
    setEditId(d.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(d: FeesDiscount) {
    setDeleteTarget(d);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.discount_code.trim() || !form.discount_value) {
      setError('Name, discount code, and value are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { ...form, discount_value: Number(form.discount_value) };
    if (editId) {
      const { error } = await supabase.from('fees_discounts').update(payload).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('fees_discounts').insert([payload]);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchDiscounts();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('fees_discounts').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchDiscounts();
  }

  function formatValue(d: FeesDiscount): string {
    return d.discount_type === 'percentage' ? `${d.discount_value}%` : `₦${d.discount_value.toLocaleString()}`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Fees Discount</h1>
        <button
          onClick={openCreate}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Discount
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading...</div>
        ) : discounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <span className="text-4xl mb-3">🏷️</span>
            <p className="text-sm">No discounts found. Add your first discount.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Value</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{d.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-app-text-muted">{d.discount_code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        d.discount_type === 'percentage'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {d.discount_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald-600">{formatValue(d)}</td>
                  <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{d.description}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(d)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(d)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Discount' : 'Add Discount'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Name</label>
            <input
              className={INPUT_CLASS}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Staff Child Discount"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Discount Code</label>
              <input
                className={INPUT_CLASS}
                value={form.discount_code}
                onChange={(e) => setForm({ ...form, discount_code: e.target.value })}
                placeholder="e.g. STAFF10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Discount Type</label>
              <select
                className={INPUT_CLASS}
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">
              Discount Value {form.discount_type === 'percentage' ? '(%)' : '(₦)'}
            </label>
            <input
              type="number"
              min="0"
              max={form.discount_type === 'percentage' ? 100 : undefined}
              className={INPUT_CLASS}
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
              placeholder={form.discount_type === 'percentage' ? '0 - 100' : '0.00'}
            />
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

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Discount">
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
