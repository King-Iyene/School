import { useState, useEffect } from 'react';
import { ShoppingBag, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  notes: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  store_products: { name: string; image_url: string } | null;
}

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
  refunded: 'bg-slate-100 text-slate-600',
};

const STATUS_MSG: Record<string, string> = {
  pending: 'Your order has been received and is awaiting review.',
  confirmed: 'Your order has been confirmed and will be processed soon.',
  processing: 'Your order is being prepared.',
  ready: 'Your order is ready for pickup at the school office!',
  delivered: 'Order delivered. Thank you!',
  cancelled: 'This order was cancelled.',
};

export default function MyOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => { if (profile?.id) load(); }, [profile?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('store_orders')
      .select('id, total_amount, status, payment_status, notes, created_at')
      .eq('ordered_by', profile!.id)
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  async function viewOrder(order: Order) {
    setSelected(order);
    setLoadingItems(true);
    const { data } = await supabase
      .from('store_order_items')
      .select('*, store_products(name, image_url)')
      .eq('order_id', order.id);
    setItems(data ?? []);
    setLoadingItems(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Orders</h1>
        <p className="text-slate-500 text-sm mt-1">Track your store orders and payment status</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders yet</p>
          <p className="text-sm mt-1">Visit the School Store to place your first order</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <button
              key={order.id}
              onClick={() => viewOrder(order)}
              className="w-full bg-white rounded-2xl border border-slate-200 p-4 text-left hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="text-right space-y-1.5">
                  <p className="font-bold text-slate-900">₦{Number(order.total_amount).toLocaleString()}</p>
                  <div className="flex gap-1.5 justify-end flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {order.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_COLORS[order.payment_status ?? 'unpaid']}`}>
                      {order.payment_status ?? 'unpaid'}
                    </span>
                  </div>
                </div>
              </div>
              {order.status === 'ready' && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-medium">
                  Ready for pickup at school office
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Order Details">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">#{selected.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-slate-500">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[selected.status] ?? ''}`}>{selected.status}</span>
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${PAY_COLORS[selected.payment_status ?? 'unpaid']}`}>{selected.payment_status ?? 'unpaid'}</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700">
              {STATUS_MSG[selected.status] ?? 'Order in progress.'}
            </div>

            {selected.notes && <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-xl p-3">{selected.notes}</p>}

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Items</p>
              {loadingItems ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.store_products?.image_url ? (
                          <img src={item.store_products.image_url} alt={item.store_products.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{item.store_products?.name}</p>
                        <p className="text-xs text-slate-400">Qty: {item.quantity} × ₦{Number(item.unit_price).toLocaleString()}</p>
                      </div>
                      <span className="font-semibold text-sm text-slate-800">₦{(Number(item.unit_price) * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-slate-900 pt-2">
                    <span>Total</span>
                    <span>₦{Number(selected.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {(selected.payment_status === 'unpaid' || selected.payment_status == null) && selected.status !== 'cancelled' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                Payment of <strong>₦{Number(selected.total_amount).toLocaleString()}</strong> is due at the school office when collecting your order.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
