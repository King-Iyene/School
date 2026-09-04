import { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const INPUT_CLASS = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface InventoryItemOption {
  id: string;
  name: string;
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
  inventory_items?: { name: string } | null;
  suppliers?: { name: string } | null;
}

export default function ItemReceiveList() {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<ReceiveRow[]>([]);
  const [items, setItems] = useState<InventoryItemOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [filterFrom, filterTo, filterItem, filterSupplier]);

  async function fetchFilters() {
    const [{ data: itemData }, { data: supData }] = await Promise.all([
      supabase.from('inventory_items').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('suppliers').select('id, name').eq('school_id', profile?.school_id).order('name'),
    ]);
    if (itemData) setItems(itemData as InventoryItemOption[]);
    if (supData) setSuppliers(supData as SupplierOption[]);
  }

  async function fetchReceipts() {
    setLoading(true);
    let query = supabase
      .from('item_receives')
      .select('*, inventory_items(name), suppliers(name)')
      .eq('school_id', profile?.school_id)
      .order('receive_date', { ascending: false });

    if (filterFrom) query = query.gte('receive_date', filterFrom);
    if (filterTo) query = query.lte('receive_date', filterTo);
    if (filterItem) query = query.eq('item_id', filterItem);
    if (filterSupplier) query = query.eq('supplier_id', filterSupplier);

    const { data } = await query;
    if (data) setReceipts(data as ReceiveRow[]);
    setLoading(false);
  }

  const totalValue = receipts.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 text-white p-2 rounded-xl">
          <ClipboardList size={20} />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Item Receive List</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 flex items-center gap-4">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-xl">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-xs text-app-text-muted">Total Records</p>
            <p className="text-2xl font-bold text-app-text">{receipts.length}</p>
          </div>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border p-4 flex items-center gap-4">
          <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-xs text-app-text-muted">Total Value</p>
            <p className="text-2xl font-bold text-app-text">₦{totalValue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">From Date</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">To Date</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Item</label>
            <select
              className={INPUT_CLASS}
              value={filterItem}
              onChange={e => setFilterItem(e.target.value)}
            >
              <option value="">All Items</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Supplier</label>
            <select
              className={INPUT_CLASS}
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No receipts found.</p>
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
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Quantity</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Unit Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Total Price</th>
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
                    <td className="px-4 py-3 text-app-text">₦{Number(r.unit_price).toLocaleString()}</td>
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
