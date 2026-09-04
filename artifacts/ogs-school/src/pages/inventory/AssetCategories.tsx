import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-app-surface';

const COLORS = [
  { value: 'amber',   label: 'Amber',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  { value: 'blue',    label: 'Blue',    bg: 'bg-blue-100',    text: 'text-blue-700'    },
  { value: 'cyan',    label: 'Cyan',    bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
  { value: 'emerald', label: 'Green',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { value: 'slate',   label: 'Grey',    bg: 'bg-slate-100',   text: 'text-app-text'   },
  { value: 'orange',  label: 'Orange',  bg: 'bg-orange-100',  text: 'text-orange-700'  },
  { value: 'purple',  label: 'Purple',  bg: 'bg-purple-100',  text: 'text-purple-700'  },
  { value: 'rose',    label: 'Rose',    bg: 'bg-rose-100',    text: 'text-rose-700'    },
];

function colorClass(color: string) {
  return COLORS.find(c => c.value === color) ?? COLORS[0];
}

interface AssetCategory { id: string; name: string; color: string; }

export default function AssetCategories() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', color: 'slate' });

  useEffect(() => { fetchCategories(); }, [profile?.school_id]);

  async function fetchCategories() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase.from('asset_categories').select('*').eq('school_id', profile.school_id).order('name');
    setCategories(data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setForm({ name: '', color: 'slate' });
    setSaveError('');
    setModalOpen(true);
  }
  function openEdit(c: AssetCategory) {
    setEditId(c.id);
    setForm({ name: c.name, color: c.color ?? 'slate' });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError('Category name is required.'); return; }
    setSaving(true);
    const payload = { school_id: profile?.school_id, name: form.name.trim(), color: form.color };
    let error;
    if (editId) {
      ({ error } = await supabase.from('asset_categories').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('asset_categories').insert(payload));
    }
    if (error) { setSaveError(error.message); setSaving(false); return; }
    setModalOpen(false);
    await fetchCategories();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('asset_categories').delete().eq('id', id);
    setDeleteId(null);
    await fetchCategories();
  }

  const SUGGESTED = ['Bedding', 'Books & Stationery', 'Cleaning', 'Electronics', 'Equipment', 'Furniture', 'Kitchen', 'Sports', 'Tools', 'Vehicles'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Asset Categories</h2>
          <p className="text-app-text-muted text-sm">Group assets by type — furniture, bedding, electronics and more</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-200">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {!loading && categories.length === 0 && (
        <div className="bg-app-surface rounded-2xl border border-app-border p-6">
          <p className="text-sm font-medium text-app-text-muted mb-3">Suggested categories to get started:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => { setForm({ name: s, color: 'slate' }); setEditId(null); setSaveError(''); setModalOpen(true); }}
                className="text-sm px-3 py-1.5 rounded-full border border-dashed border-app-border text-app-text-muted hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-14 text-center text-app-text-muted text-sm">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center">
            <Tag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-app-text-muted font-medium">No categories yet</p>
          </div>
        ) : (
          <div className="divide-y divide-app-border">
            {categories.map(c => {
              const cls = colorClass(c.color);
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-app-surface-alt transition-colors group">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${cls.bg} ${cls.text}`}>{c.name}</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(c.id)}
                      className="p-1.5 rounded-lg text-app-text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleSubmit} className="p-1 space-y-4">
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setSaveError(''); }}
              placeholder="e.g. Furniture, Bedding, Electronics" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-2">Colour</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(col => (
                <button type="button" key={col.value} onClick={() => setForm(p => ({ ...p, color: col.value }))}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all ${col.bg} ${col.text} ${form.color === col.value ? 'border-current ring-2 ring-offset-1 ring-current/30' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-app-text-muted">Preview:</span>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${colorClass(form.color).bg} ${colorClass(form.color).text}`}>
              {form.name || 'Category Name'}
            </span>
          </div>
          {saveError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : editId ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Category">
        <div className="p-1 space-y-4">
          <p className="text-sm text-app-text-muted">Assets in this category will become uncategorised. Delete anyway?</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button onClick={() => handleDelete(deleteId!)} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
