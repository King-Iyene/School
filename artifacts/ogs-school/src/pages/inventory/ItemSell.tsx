import { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface InventoryItem {
  id: string;
  name: string;
  current_stock: number;
  unit_price: number;
}

interface SellRow {
  id: string;
  sell_date: string;
  buyer_name: string;
  buyer_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string;
  inventory_items?: { name: string } | null;
}

export default function ItemSell() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sells, setSells] = useState<SellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stockError, setStockError] = useState('');
  const [form, setForm] = useState({
    item_id: '',
    quantity: '',
    unit_price: '',
    total_price: '',
    sell_date: new Date().toISOString().split('T')[0],
    buyer_name: '',
    buyer_type: 'external' as 'student' | 'staff' | 'external',
    notes: '',
  });

  useEffect(() => {
    fetchItems();
    fetchSells();
  }, []);

  useEffect(() => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unit_price) || 0;
    setForm(p => ({ ...p, total_price: (qty * price).toFixed(2) }));

    const item = items.find(i => i.id === form.item_id);
    if (item && qty > item.current_stock) {
      setStockError(`Insufficient stock. Available: ${item.current_stock}`);
    } else {
      setStockError('');
    }
  }, [form.quantity, form.unit_price, form.item_id, items]);

  async function fetchItems() {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, current_stock, unit_price')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setItems(data as InventoryItem[]);
  }

  async function fetchSells() {
    setLoading(true);
    const { data } = await supabase
      .from('item_sells')
      .select('*, inventory_items(name)')
      .eq('school_id', profile?.school_id)
      .order('sell_date', { ascending: false })
      .limit(50);
    if (data) setSells(data as SellRow[]);
    setLoading(false);
  }

  function handleItemChange(itemId: string) {
    const item = items.find(i => i.id === itemId);
    setForm(p => ({
      ...p,
      item_id: itemId,
      unit_price: item ? String(item.unit_price || '') : '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stockError) return;
    setSaving(true);
    setSaveError('');
    const qty = Number(form.quantity);
    const payload = {
      item_id: form.item_id,
      quantity: qty,
      unit_price: Number(form.unit_price),
      total_price: Number(form.total_price),
      sell_date: form.sell_date,
      buyer_name: form.buyer_name,
      buyer_type: form.buyer_type,
      notes: form.notes,
      school_id: profile?.school_id,
    };
    const res = await supabase.from('item_sells').insert([payload]);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }

    const { data: currentItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', form.item_id)
      .single();
    if (currentItem) {
      await supabase
        .from('inventory_items')
        .update({ current_stock: (currentItem.current_stock || 0) - qty })
        .eq('id', form.item_id);
    }

    setSaving(false);
    setForm({
      item_id: '',
      quantity: '',
      unit_price: '',
      total_price: '',
      sell_date: new Date().toISOString().split('T')[0],
      buyer_name: '',
      buyer_type: 'external',
      notes: '',
    });
    fetchSells();
    fetchItems();
  }

  function buyerTypeBadge(type: string) {
    if (type === 'student') return 'bg-blue-100 text-blue-700';
    if (type === 'staff') return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-600';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 text-white p-2 rounded-xl">
          <ShoppingCart size={20} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Sell Items</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">New Sale</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.item_id}
              onChange={e => handleItemChange(e.target.value)}
            >
              <option value="">Select item</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buyer Name</label>
              <input
                required
                className={INPUT_CLASS}
                value={form.buyer_name}
                onChange={e => setForm(p => ({ ...p, buyer_name: e.target.value }))}
                placeholder="Buyer's name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Buyer Type</label>
              <select
                className={INPUT_CLASS}
                value={form.buyer_type}
                onChange={e => setForm(p => ({ ...p, buyer_type: e.target.value as 'student' | 'staff' | 'external' }))}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="external">External</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                className={INPUT_CLASS}
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
              />
              {stockError && <p className="text-red-600 text-xs mt-1">{stockError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price (₦)</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Price (₦)</label>
              <input
                readOnly
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-600 w-full"
                value={form.total_price}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sell Date</label>
            <input
              type="date"
              required
              className={INPUT_CLASS}
              value={form.sell_date}
              onChange={e => setForm(p => ({ ...p, sell_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
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
              disabled={saving || !!stockError || !form.item_id}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-700">Recent Sales</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : sells.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No sales yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Buyer</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sells.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600">{s.sell_date ? new Date(s.sell_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.inventory_items?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.buyer_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${buyerTypeBadge(s.buyer_type)}`}>
                        {s.buyer_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.quantity}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">₦{Number(s.total_price).toLocaleString()}</td>
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
