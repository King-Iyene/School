import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface Category {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  item_code: string;
  category_id: string;
  store_id: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  unit_price: number;
  school_id: string;
  inventory_categories?: { name: string } | null;
  inventory_stores?: { name: string } | null;
}

export default function ItemList() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({
    name: '',
    item_code: '',
    category_id: '',
    store_id: '',
    unit: '',
    current_stock: '',
    reorder_level: '',
    unit_price: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchStores();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [filterCategory]);

  async function fetchCategories() {
    const { data } = await supabase
      .from('inventory_categories')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setCategories(data as Category[]);
  }

  async function fetchStores() {
    const { data } = await supabase
      .from('inventory_stores')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setStores(data as Store[]);
  }

  async function fetchItems() {
    setLoading(true);
    let query = supabase
      .from('inventory_items')
      .select('*, inventory_categories(name), inventory_stores(name)')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (filterCategory) query = query.eq('category_id', filterCategory);
    const { data } = await query;
    if (data) setItems(data as InventoryItem[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: '', item_code: '', category_id: '', store_id: '', unit: '', current_stock: '', reorder_level: '', unit_price: '' });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditId(item.id);
    setForm({
      name: item.name || '',
      item_code: item.item_code || '',
      category_id: item.category_id || '',
      store_id: item.store_id || '',
      unit: item.unit || '',
      current_stock: item.current_stock != null ? String(item.current_stock) : '',
      reorder_level: item.reorder_level != null ? String(item.reorder_level) : '',
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      item_code: form.item_code,
      category_id: form.category_id || null,
      store_id: form.store_id || null,
      unit: form.unit,
      current_stock: form.current_stock !== '' ? Number(form.current_stock) : 0,
      reorder_level: form.reorder_level !== '' ? Number(form.reorder_level) : 0,
      unit_price: form.unit_price !== '' ? Number(form.unit_price) : 0,
      school_id: profile?.school_id,
    };
    let res;
    if (editId) {
      res = await supabase.from('inventory_items').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('inventory_items').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await supabase.from('inventory_items').delete().eq('id', id);
    fetchItems();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <Package size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Inventory Items</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-app-text mb-1">Filter by Category</label>
          <select
            className="border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Item Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Store</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Unit</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Stock</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Unit Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {items.map(item => {
                  const isLow = item.current_stock <= item.reorder_level;
                  return (
                    <tr key={item.id} className="hover:bg-app-surface-alt/50">
                      <td className="px-4 py-3 font-medium text-app-text">
                        <div className="flex items-center gap-2">
                          {item.name}
                          {isLow && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-red-100 text-red-700">
                              <AlertTriangle size={11} />
                              Low
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-app-text-muted font-mono text-xs">{item.item_code || '-'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{item.inventory_categories?.name || '-'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{item.inventory_stores?.name || '-'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{item.unit || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-app-text font-medium">₦{Number(item.unit_price).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-app-text-muted hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Item' : 'Add Item'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Name</label>
              <input
                required
                className={INPUT_CLASS}
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Item name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Item Code</label>
              <input
                className={INPUT_CLASS}
                value={form.item_code}
                onChange={e => setForm(p => ({ ...p, item_code: e.target.value }))}
                placeholder="e.g. ITM-001"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Category</label>
              <select
                className={INPUT_CLASS}
                value={form.category_id}
                onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Store</label>
              <select
                className={INPUT_CLASS}
                value={form.store_id}
                onChange={e => setForm(p => ({ ...p, store_id: e.target.value }))}
              >
                <option value="">Select store</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Unit</label>
              <input
                className={INPUT_CLASS}
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. pcs, kg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Current Stock</label>
              <input
                type="number"
                min="0"
                className={INPUT_CLASS}
                value={form.current_stock}
                onChange={e => setForm(p => ({ ...p, current_stock: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                className={INPUT_CLASS}
                value={form.reorder_level}
                onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Unit Price (₦)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={INPUT_CLASS}
              value={form.unit_price}
              onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
              placeholder="0.00"
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
