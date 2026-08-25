import { useEffect, useState } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const TYPES = [
  { key: 'source', label: 'Admission Sources', description: 'Where enquiries come from' },
  { key: 'purpose', label: 'Visit Purposes', description: 'Reasons for visitor access' },
  { key: 'complaint_type', label: 'Complaint Types', description: 'Categories of complaints' },
  { key: 'reference', label: 'References', description: 'Reference categories for postal' },
];

interface Item { id: string; name: string; description?: string; }

export default function AdminSetup() {
  const { profile } = useAuth();
  const [data, setData] = useState<Record<string, Item[]>>({ source: [], purpose: [], complaint_type: [], reference: [] });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { loadAll(); }, [profile]);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data: rows } = await supabase.from('admin_setup').select('*').eq('school_id', profile.school_id).order('name');
    const grouped: Record<string, Item[]> = { source: [], purpose: [], complaint_type: [], reference: [] };
    (rows ?? []).forEach((r: any) => { if (grouped[r.type]) grouped[r.type].push(r); });
    setData(grouped);
    setLoading(false);
  }

  async function handleAdd(type: string) {
    if (!newValue.trim() || !profile?.school_id) return;
    setSaving(true);
    const res = await supabase.from('admin_setup').insert({ school_id: profile.school_id, type, name: newValue.trim() });
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setAdding(null);
    setNewValue('');
    loadAll();
    setSaving(false);
  }

  async function handleEdit(id: string) {
    if (!editValue.trim()) return;
    setSaving(true);
    const res = await supabase.from('admin_setup').update({ name: editValue.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setEditingId(null);
    loadAll();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await supabase.from('admin_setup').delete().eq('id', id);
    loadAll();
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Admin Setup</h2>
        <p className="text-slate-500 text-sm">Manage lookup values used across the admin section</p>
      </div>
      {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {TYPES.map(type => (
          <div key={type.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{type.label}</p>
                <p className="text-xs text-slate-500">{type.description}</p>
              </div>
              <button
                onClick={() => { setAdding(type.key); setNewValue(''); }}
                className="flex items-center gap-1 text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {adding === type.key && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50">
                  <input
                    autoFocus
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(type.key); if (e.key === 'Escape') setAdding(null); }}
                    placeholder="Enter value..."
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button onClick={() => handleAdd(type.key)} disabled={saving} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setAdding(null)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              )}
              {data[type.key].length === 0 && adding !== type.key ? (
                <p className="px-4 py-4 text-sm text-slate-400 italic">No items yet. Click Add to create one.</p>
              ) : data[type.key].map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 group">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEdit(item.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <button onClick={() => handleEdit(item.id)} disabled={saving} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-slate-700">{item.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(item.id); setEditValue(item.name); }} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">{data[type.key].length} {data[type.key].length === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
