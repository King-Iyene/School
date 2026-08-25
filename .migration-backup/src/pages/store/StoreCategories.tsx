import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Category { id: string; name: string; description: string; }

export default function StoreCategories() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  const sid = profile?.school_id;

  useEffect(() => { if (sid) load(); }, [sid]);

  async function load() {
    setLoading(true);
    const [catRes, prodRes] = await Promise.all([
      supabase.from('store_categories').select('*').eq('school_id', sid!).order('name'),
      supabase.from('store_products').select('category_id').eq('school_id', sid!),
    ]);
    setCategories(catRes.data ?? []);
    const counts: Record<string, number> = {};
    (prodRes.data ?? []).forEach((p: any) => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
    });
    setProductCounts(counts);
    setLoading(false);
  }

  function openAdd() { setEditing(null); setForm({ name: '', description: '' }); setModal(true); }
  function openEdit(c: Category) { setEditing(c); setForm({ name: c.name, description: c.description }); setModal(true); }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('store_categories').update(form).eq('id', editing.id);
    } else {
      await supabase.from('store_categories').insert({ ...form, school_id: sid });
    }
    setSaving(false);
    setModal(false);
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this category? Products in this category will become uncategorised.')) return;
    await supabase.from('store_categories').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Store Categories</h1>
          <p className="text-slate-500 text-sm mt-1">Organise products into categories</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No categories yet</p>
          <p className="text-sm">Create categories like Uniforms, Textbooks, Stationery</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                  <Tag className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => del(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-slate-800">{c.name}</p>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.description || 'No description'}</p>
              <p className="text-xs text-emerald-600 font-medium mt-3">{productCounts[c.id] ?? 0} product{(productCounts[c.id] ?? 0) !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Uniforms" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="What products are in this category?" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim()} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
