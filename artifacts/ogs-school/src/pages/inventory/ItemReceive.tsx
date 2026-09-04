import { useState, useEffect } from 'react';
import { PackagePlus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface InventoryItem {
  id: string;
  name: string;
  item_code: string;
  unit_price: number;
  current_stock: number;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ReceiveRow {
  id: string;
  receive_date: string;
  invoice_number: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string;
  inventory_items?: { name: string } | null;
  suppliers?: { name: string } | null;
}

export default function ItemReceive() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [receipts, setReceipts] = useState<ReceiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({
    item_id: '',
    supplier_id: '',
    quantity: '',
    unit_price: '',
    total_price: '',
    receive_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchItems();
    fetchSuppliers();
    fetchReceipts();
  }, []);

  useEffect(() => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    setForm(p => ({ ...p, total_price: (qty * price).toFixed(2) }));
  }, [form.quantity, form.unit_price]);

  async function fetchItems() {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, item_code, unit_price, current_stock')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setItems(data as InventoryItem[]);
  }

  async function fetchSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setSuppliers(data as SupplierOption[]);
  }

  async function fetchReceipts() {
    setLoading(true);
    const { data } = await supabase
      .from('item_receives')
      .select('*, inventory_items(name), suppliers(name)')
      .eq('school_id', profile?.school_id)
      .order('receive_date', { ascending: false })
      .limit(50);
    if (data) setReceipts(data as ReceiveRow[]);
    setLoading(false);
  }

  function selectItem(item: InventoryItem) {
    setSelectedItem(item);
    setItemSearch(item.name);
    setShowItemDropdown(false);
    setForm(p => ({ ...p, item_id: item.id, unit_price: String(item.unit_price || '') }));
  }

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (i.item_code || '').toLowerCase().includes(itemSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_id) return;
    setSaving(true);
    setSaveError('');
    const qty = Number(form.quantity);
    const payload = {
      item_id: form.item_id,
      supplier_id: form.supplier_id || null,
      quantity: qty,
      unit_price: Number(form.unit_price),
      total_price: Number(form.total_price),
      receive_date: form.receive_date,
      invoice_number: form.invoice_number,
      notes: form.notes,
      school_id: profile?.school_id,
    };
    const res = await supabase.from('item_receives').insert([payload]);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }

    const { data: currentItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', form.item_id)
      .single();
    if (currentItem) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: (currentItem.current_stock || 0) + qty })
        .eq('id', form.item_id);
    }

    setSaving(false);
    setForm({
      item_id: '',
      supplier_id: '',
      quantity: '',
      unit_price: '',
      total_price: '',
      receive_date: new Date().toISOString().split('T')[0],
      invoice_number: '',
      notes: '',
    });
    setSelectedItem(null);
    setItemSearch('');
    fetchReceipts();
    fetchItems();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 text-white p-2 rounded-xl">
          <PackagePlus size={20} />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Receive Items</h1>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-6">
        <h2 className="text-base font-semibold text-app-text mb-4">New Receipt</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="relative">
            <label className="block text-sm font-medium text-app-text mb-1">Item</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
              <input
                className="border border-app-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
                placeholder="Search item by name or code..."
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setShowItemDropdown(true); setSelectedItem(null); setForm(p => ({ ...p, item_id: '' })); }}
                onFocus={() => setShowItemDropdown(true)}
              />
            </div>
            {showItemDropdown && itemSearch && (
              <div className="absolute z-10 mt-1 w-full bg-app-surface border border-app-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-app-text-muted">No items found</div>
                ) : (
                  filteredItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors"
                    >
                      <span className="font-medium text-app-text">{item.name}</span>
                      {item.item_code && <span className="ml-2 text-app-text-muted text-xs">{item.item_code}</span>}
                      <span className="ml-2 text-app-text-muted text-xs">Stock: {item.current_stock}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Supplier</label>
              <select
                className={INPUT_CLASS}
                value={form.supplier_id}
                onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
              >
                <option value="">Select supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Invoice Number</label>
              <input
                className={INPUT_CLASS}
                value={form.invoice_number}
                onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
                placeholder="INV-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                className={INPUT_CLASS}
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Unit Price (₦)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className={INPUT_CLASS}
                value={form.unit_price}
                onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Total Price (₦)</label>
              <input
                readOnly
                className="border border-app-border rounded-xl px-3 py-2.5 text-sm bg-app-surface-alt text-app-text-muted w-full"
                value={form.total_price}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Receive Date</label>
            <input
              type="date"
              required
              className={INPUT_CLASS}
              value={form.receive_date}
              onChange={e => setForm(p => ({ ...p, receive_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Notes</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || !form.item_id}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Receipt'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <h2 className="text-base font-semibold text-app-text">Recent Receipts</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center">
            <PackagePlus size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No receipts yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Invoice No</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Supplier</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {receipts.map(r => (
                  <tr key={r.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 text-app-text-muted">{r.receive_date ? new Date(r.receive_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted font-mono text-xs">{r.invoice_number || '-'}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{r.inventory_items?.name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{r.suppliers?.name || '-'}</td>
                    <td className="px-4 py-3 text-app-text">{r.quantity}</td>
                    <td className="px-4 py-3 text-app-text font-medium">₦{Number(r.total_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
