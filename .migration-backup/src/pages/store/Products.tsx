import { useState, useEffect, useRef } from 'react';
import { Plus, Search, CreditCard as Edit2, Trash2, Package, ToggleLeft, ToggleRight, X, Image as ImageIcon } from 'lucide-react';
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
  active: boolean;
  category_id: string | null;
  store_categories: { name: string } | null;
}

interface Category { id: string; name: string; }

const EMPTY: Omit<Product, 'id' | 'store_categories'> = {
  name: '', description: '', price: 0, stock_qty: 0, image_url: '', active: true, category_id: null,
};

export default function Products() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const sid = profile?.school_id;

  useEffect(() => { if (sid) { loadProducts(); loadCategories(); } }, [sid]);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from('store_products')
      .select('*, store_categories(name)')
      .eq('school_id', sid!)
      .order('created_at', { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  }

  async function loadCategories() {
    const { data } = await supabase.from('store_categories').select('id, name').eq('school_id', sid!).order('name');
    setCategories(data ?? []);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY });
    setImagePreview('');
    setModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, description: p.description, price: p.price, stock_qty: p.stock_qty, image_url: p.image_url, active: p.active, category_id: p.category_id });
    setImagePreview(p.image_url);
    setModal(true);
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${sid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: data.publicUrl }));
      setImagePreview(data.publicUrl);
    }
    setUploading(false);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('store_products').update({ ...form, price: Number(form.price), stock_qty: Number(form.stock_qty) }).eq('id', editing.id);
    } else {
      await supabase.from('store_products').insert({ ...form, school_id: sid, price: Number(form.price), stock_qty: Number(form.stock_qty) });
    }
    setSaving(false);
    setModal(false);
    loadProducts();
  }

  async function toggleActive(p: Product) {
    await supabase.from('store_products').update({ active: !p.active }).eq('id', p.id);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
  }

  async function del(id: string) {
    if (!confirm('Delete this product?')) return;
    await supabase.from('store_products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 text-sm mt-1">{products.length} products in store</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found</p>
          <p className="text-sm">Add your first product to the store</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border transition-all hover:shadow-md ${p.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="h-36 bg-slate-100 rounded-t-2xl overflow-hidden flex items-center justify-center relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.store_categories?.name ?? 'Uncategorised'}</p>
                  </div>
                  <button onClick={() => toggleActive(p)} className="flex-shrink-0 mt-0.5">
                    {p.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-base font-bold text-emerald-600">₦{Number(p.price).toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.stock_qty === 0 ? 'bg-red-100 text-red-600' : p.stock_qty < 5 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                    {p.stock_qty === 0 ? 'Out of stock' : `${p.stock_qty} in stock`}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => del(p.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. School Polo Shirt" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (₦)</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock Qty</label>
              <input type="number" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="">None</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Product description..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Product Image</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
            {imagePreview ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image_url: '' })); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-slate-600 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-sm">Click to upload image</span>
                  </>
                )}
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">Or paste a URL below</p>
            <input
              value={form.image_url}
              onChange={e => { setForm(f => ({ ...f, image_url: e.target.value })); setImagePreview(e.target.value); }}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim() || uploading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
