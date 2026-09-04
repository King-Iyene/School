import { useState, useEffect } from 'react';
import { ShoppingCart, Search, ChevronDown, Eye, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_reference: string;
  paid_at: string | null;
  notes: string;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  store_products: { name: string } | null;
}

const STATUSES = ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Online'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-sky-100 text-sky-700',
  ready: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PAY_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  refunded: 'bg-slate-100 text-app-text-muted',
};

export default function Orders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [payForm, setPayForm] = useState({ method: 'Cash', reference: '' });

  const sid = profile?.school_id;

  useEffect(() => { if (sid) load(); }, [sid]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select('*, profiles!store_orders_ordered_by_fkey(first_name, last_name)')
      .eq('school_id', sid!)
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  async function viewOrder(order: Order) {
    setSelected(order);
    setPayForm({ method: order.payment_method || 'Cash', reference: order.payment_reference || '' });
    setLoadingItems(true);
    const { data } = await supabase
      .from('store_order_items')
      .select('*, store_products(name)')
      .eq('order_id', order.id);
    setItems(data ?? []);
    setLoadingItems(false);
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    setUpdating(true);
    await supabase.from('store_orders').update({ status }).eq('id', selected.id);
    setUpdating(false);
    setSelected(prev => prev ? { ...prev, status } : null);
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status } : o));
  }

  async function markPaid() {
    if (!selected) return;
    setUpdating(true);
    const updates = {
      payment_status: 'paid',
      payment_method: payForm.method,
      payment_reference: payForm.reference,
      paid_at: new Date().toISOString(),
    };
    await supabase.from('store_orders').update(updates).eq('id', selected.id);
    setUpdating(false);
    const updated = { ...selected, ...updates };
    setSelected(updated);
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, ...updates } : o));
  }

  async function markRefunded() {
    if (!selected) return;
    setUpdating(true);
    await supabase.from('store_orders').update({ payment_status: 'refunded' }).eq('id', selected.id);
    setUpdating(false);
    setSelected(prev => prev ? { ...prev, payment_status: 'refunded' } : null);
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, payment_status: 'refunded' } : o));
  }

  const filtered = orders.filter(o => {
    const name = `${o.profiles?.first_name ?? ''} ${o.profiles?.last_name ?? ''}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchStatus = filterStatus === '' || o.status === filterStatus;
    const matchPayment = filterPayment === '' || o.payment_status === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  });

  const totalRevenue = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + Number(o.total_amount), 0);
  const pendingPayment = orders.filter(o => o.payment_status === 'unpaid' && o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text">Orders</h1>
        <p className="text-app-text-muted text-sm mt-1">{orders.length} total orders</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: orders.length, color: 'bg-app-surface-alt text-app-text' },
          { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Revenue Collected', value: `₦${totalRevenue.toLocaleString()}`, color: 'bg-green-50 text-green-700' },
          { label: 'Outstanding', value: `₦${pendingPayment.toLocaleString()}`, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color} border border-white/50`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer name..." className="w-full pl-10 pr-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface" />
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="appearance-none pl-4 pr-8 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
        </div>
        <div className="relative">
          <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="appearance-none pl-4 pr-8 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface">
            <option value="">All payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders found</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-alt">
                <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Amount</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Status</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Payment</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-b border-app-border last:border-0 hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5 font-medium text-app-text">{o.profiles?.first_name} {o.profiles?.last_name}</td>
                  <td className="px-5 py-3.5 text-app-text-muted">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-app-text">₦{Number(o.total_amount).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[o.status] ?? 'bg-slate-100 text-app-text-muted'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAY_COLORS[o.payment_status ?? 'unpaid'] ?? 'bg-slate-100 text-app-text-muted'}`}>
                      {o.payment_status ?? 'unpaid'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => viewOrder(o)} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Order Details">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-app-text">{selected.profiles?.first_name} {selected.profiles?.last_name}</p>
                <p className="text-sm text-app-text-muted">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[selected.status] ?? ''}`}>{selected.status}</span>
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${PAY_COLORS[selected.payment_status ?? 'unpaid'] ?? ''}`}>{selected.payment_status ?? 'unpaid'}</span>
              </div>
            </div>

            {selected.notes && <p className="text-sm text-app-text-muted bg-app-surface-alt rounded-xl p-3">{selected.notes}</p>}

            <div>
              <p className="text-sm font-semibold text-app-text mb-2">Items</p>
              {loadingItems ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-app-border last:border-0">
                      <span className="text-app-text">{item.store_products?.name} <span className="text-app-text-muted">× {item.quantity}</span></span>
                      <span className="font-medium">₦{(Number(item.unit_price) * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-app-text pt-2">
                    <span>Total</span>
                    <span>₦{Number(selected.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {(selected.payment_status === 'unpaid' || selected.payment_status == null) && selected.status !== 'cancelled' && (
              <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Record Payment
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-app-text mb-1">Payment Method</label>
                    <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text mb-1">Reference (optional)</label>
                    <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="Receipt no., etc." className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <button
                  onClick={markPaid}
                  disabled={updating}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Mark as Paid
                </button>
              </div>
            )}

            {selected.payment_status === 'paid' && (
              <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Payment Received
                </p>
                <p className="text-xs text-green-700">Method: {selected.payment_method}</p>
                {selected.payment_reference && <p className="text-xs text-green-700">Ref: {selected.payment_reference}</p>}
                {selected.paid_at && <p className="text-xs text-green-700">At: {new Date(selected.paid_at).toLocaleString()}</p>}
                <button onClick={markRefunded} disabled={updating} className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Mark as Refunded
                </button>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-app-text mb-2">Update Order Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={updating || s === selected.status}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${s === selected.status ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'} disabled:opacity-50`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
