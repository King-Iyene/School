import { useState, useEffect } from 'react';
import { ShoppingCart, Package, Plus, Minus, X, CheckCircle, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_qty: number;
  image_url: string;
  category_id: string | null;
  store_categories: { name: string } | null;
}

interface CartItem {
  product: Product;
  qty: number;
}

export default function Shop() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');

  const sid = profile?.school_id;

  useEffect(() => { if (sid) { load(); loadCats(); } }, [sid]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('store_products')
      .select('*, store_categories(name)')
      .eq('school_id', sid!)
      .eq('active', true)
      .gt('stock_qty', 0)
      .order('name');
    setProducts(data ?? []);
    setLoading(false);
  }

  async function loadCats() {
    const { data } = await supabase.from('store_categories').select('id, name').eq('school_id', sid!).order('name');
    setCategories(data ?? []);
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock_qty) return prev;
        return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(i => {
        if (i.product.id !== productId) return i;
        const newQty = i.qty + delta;
        if (newQty <= 0) return null;
        if (newQty > i.product.stock_qty) return i;
        return { ...i, qty: newQty };
      })
      .filter(Boolean) as CartItem[]
    );
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  async function placeOrder() {
    if (!profile || cart.length === 0) return;
    setPlacing(true);
    const { data: order, error } = await supabase
      .from('store_orders')
      .insert({
        school_id: sid,
        ordered_by: profile.id,
        total_amount: cartTotal,
        status: 'pending',
        payment_status: 'unpaid',
        notes,
      })
      .select('id')
      .single();

    if (error || !order) { setPlacing(false); return; }

    await supabase.from('store_order_items').insert(
      cart.map(i => ({
        order_id: order.id,
        product_id: i.product.id,
        quantity: i.qty,
        unit_price: i.product.price,
      }))
    );

    setCart([]);
    setNotes('');
    setPlacing(false);
    setCheckoutOpen(false);
    setCartOpen(false);
    setSuccessOpen(true);
    load();
  }

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCat === '' || p.category_id === selectedCat;
    return matchSearch && matchCat;
  });

  const cartQty = (productId: string) => cart.find(i => i.product.id === productId)?.qty ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">School Store</h1>
          <p className="text-app-text-muted text-sm mt-1">Browse and order uniforms, books, stationery and more</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
          />
        </div>
        <div className="relative">
          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-app-text-muted">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products available</p>
          <p className="text-sm">Check back later for new items</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(product => {
            const inCart = cartQty(product.id);
            return (
              <div key={product.id} className="bg-app-surface rounded-2xl border border-app-border overflow-hidden hover:shadow-lg hover:border-app-border transition-all group">
                <div className="h-44 bg-slate-100 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-emerald-600 font-medium mb-1">{product.store_categories?.name ?? 'General'}</p>
                  <p className="font-semibold text-app-text line-clamp-1">{product.name}</p>
                  {product.description && (
                    <p className="text-xs text-app-text-muted mt-1 line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-app-text">₦{Number(product.price).toLocaleString()}</span>
                    <span className="text-xs text-app-text-muted">{product.stock_qty} left</span>
                  </div>
                  <div className="mt-3">
                    {inCart === 0 ? (
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add to Cart
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-1">
                        <button onClick={() => updateQty(product.id, -1)} className="w-9 h-9 rounded-lg bg-app-surface border border-emerald-200 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold text-emerald-800 text-sm">{inCart} in cart</span>
                        <button onClick={() => updateQty(product.id, 1)} className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white hover:bg-emerald-700 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={cartOpen} onClose={() => setCartOpen(false)} title="Your Cart">
        {cart.length === 0 ? (
          <div className="text-center py-10 text-app-text-muted">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 py-3 border-b border-app-border last:border-0">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-app-text truncate">{item.product.name}</p>
                    <p className="text-xs text-app-text-muted">₦{Number(item.product.price).toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-lg border border-app-border flex items-center justify-center text-app-text-muted hover:bg-app-surface-alt">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-lg border border-app-border flex items-center justify-center text-app-text-muted hover:bg-app-surface-alt">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right w-20">
                    <p className="text-sm font-bold text-app-text">₦{(item.product.price * item.qty).toLocaleString()}</p>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-xs text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-app-border pt-4 flex items-center justify-between">
              <span className="font-semibold text-app-text">Total</span>
              <span className="text-xl font-bold text-app-text">₦{cartTotal.toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCartOpen(false)} className="flex-1 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">
                Continue Shopping
              </button>
              <button
                onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Confirm Order">
        <div className="space-y-4">
          <div className="bg-app-surface-alt rounded-xl p-4 space-y-2">
            {cart.map(item => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span className="text-app-text-muted">{item.product.name} × {item.qty}</span>
                <span className="font-medium text-app-text">₦{(item.product.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-app-border pt-2 flex justify-between font-bold text-app-text">
              <span>Total</span>
              <span>₦{cartTotal.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special instructions or size requirements..."
              className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            Payment is collected at the school office when your order is ready for pickup.
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCheckoutOpen(false)} className="flex-1 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Cancel</button>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {placing ? 'Placing...' : 'Place Order'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={successOpen} onClose={() => setSuccessOpen(false)} title="">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-app-text mb-2">Order Placed!</h3>
          <p className="text-app-text-muted text-sm mb-6">Your order has been received. You will be notified when it is ready for pickup. Payment is due at the school office.</p>
          <button
            onClick={() => setSuccessOpen(false)}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
          >
            Continue Shopping
          </button>
        </div>
      </Modal>
    </div>
  );
}
