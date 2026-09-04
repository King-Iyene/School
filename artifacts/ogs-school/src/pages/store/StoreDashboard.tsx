import { useState, useEffect } from 'react';
import { ShoppingBag, Package, ShoppingCart, TrendingUp, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

export default function StoreDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ products: 0, categories: 0, orders: 0, pending: 0, revenue: 0, lowStock: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.school_id) return;
    const sid = profile.school_id;

    Promise.all([
      supabase.from('store_products').select('id, stock_qty', { count: 'exact' }).eq('school_id', sid),
      supabase.from('store_categories').select('id', { count: 'exact' }).eq('school_id', sid),
      supabase.from('store_orders').select('id, total_amount, status', { count: 'exact' }).eq('school_id', sid),
      supabase.from('store_orders')
        .select('id, status, total_amount, created_at, ordered_by, profiles!store_orders_ordered_by_fkey(first_name, last_name)')
        .eq('school_id', sid)
        .order('created_at', { ascending: false })
        .limit(6),
    ]).then(([products, categories, orders, recent]) => {
      const allOrders = orders.data ?? [];
      const pending = allOrders.filter(o => o.status === 'pending').length;
      const revenue = allOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount), 0);
      const lowStock = (products.data ?? []).filter((p: any) => p.stock_qty > 0 && p.stock_qty < 5).length;
      setStats({
        products: products.count ?? 0,
        categories: categories.count ?? 0,
        orders: orders.count ?? 0,
        pending,
        revenue,
        lowStock,
      });
      setRecentOrders(recent.data ?? []);
      setLoading(false);
    });
  }, [profile?.school_id]);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    processing: 'bg-sky-100 text-sky-700',
    ready: 'bg-emerald-100 text-emerald-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text">School Store</h1>
        <p className="text-app-text-muted text-sm mt-1">Sell uniforms, books, stationery and more</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Products', value: stats.products, icon: Package, color: 'bg-blue-50 text-blue-600', action: '/store/products' },
              { label: 'Categories', value: stats.categories, icon: Tag, color: 'bg-violet-50 text-violet-600', action: '/store/categories' },
              { label: 'Total Orders', value: stats.orders, icon: ShoppingCart, color: 'bg-emerald-50 text-emerald-600', action: '/store/orders' },
              { label: 'Pending', value: stats.pending, icon: ShoppingBag, color: 'bg-amber-50 text-amber-600', action: '/store/orders' },
              { label: 'Revenue (₦)', value: `${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-50 text-green-600', action: '/store/orders' },
              { label: 'Low Stock', value: stats.lowStock, icon: AlertCircle, color: 'bg-red-50 text-red-600', action: '/store/products' },
            ].map(card => (
              <button
                key={card.label}
                onClick={() => navigate(card.action)}
                className="bg-app-surface rounded-2xl border border-app-border p-4 text-left hover:shadow-md hover:border-app-border transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-app-text">{card.value}</p>
                <p className="text-xs text-app-text-muted mt-0.5">{card.label}</p>
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-app-surface rounded-2xl border border-app-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-app-text">Recent Orders</h2>
                <button onClick={() => navigate('/store/orders')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
              </div>
              {recentOrders.length === 0 ? (
                <p className="text-app-text-muted text-sm text-center py-8">No orders yet</p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b border-app-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-app-text">
                          {order.profiles?.first_name} {order.profiles?.last_name}
                        </p>
                        <p className="text-xs text-app-text-muted">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-app-text">₦{Number(order.total_amount).toLocaleString()}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] ?? 'bg-slate-100 text-app-text-muted'}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-app-surface rounded-2xl border border-app-border p-5">
              <h2 className="font-semibold text-app-text mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Add Product', icon: Package, path: '/store/products', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                  { label: 'Add Category', icon: Tag, path: '/store/categories', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
                  { label: 'View Orders', icon: ShoppingCart, path: '/store/orders', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                  { label: 'Sales Report', icon: TrendingUp, path: '/store/orders', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.path)}
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl font-medium text-sm transition-colors ${a.color}`}
                  >
                    <a.icon className="w-4 h-4 flex-shrink-0" />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
