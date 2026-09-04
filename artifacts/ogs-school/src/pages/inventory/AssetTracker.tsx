import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Package, CheckCircle, AlertTriangle, XCircle, ArrowLeftRight, ChevronDown, X, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-app-surface';

interface AssetCategory { id: string; name: string; color: string; }
interface AssetLocation { id: string; name: string; type: string; }
interface AssetRoom { id: string; name: string; location_id: string; }
interface Asset {
  id: string;
  name: string;
  category_id: string | null;
  location_id: string | null;
  room_id: string | null;
  quantity: number;
  condition: 'good' | 'fair' | 'poor' | 'damaged';
  description: string;
  serial_number: string;
  purchase_date: string;
  unit_price: number | null;
  notes: string;
  asset_categories?: { name: string } | null;
  asset_locations?: { name: string } | null;
  asset_rooms?: { name: string } | null;
}

const CONDITIONS = [
  { value: 'good',    label: 'Good',    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'fair',    label: 'Fair',    bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  { value: 'poor',    label: 'Poor',    bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  { value: 'damaged', label: 'Damaged', bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
];

function ConditionBadge({ condition }: { condition: string }) {
  const c = CONDITIONS.find(x => x.value === condition) ?? CONDITIONS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

const BLANK_FORM = { name: '', category_id: '', location_id: '', room_id: '', quantity: '1', condition: 'good', description: '', serial_number: '', purchase_date: '', unit_price: '', notes: '' };

export default function AssetTracker() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [rooms, setRooms] = useState<AssetRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [search, setSearch] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterCond, setFilterCond] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchAll(); }, [profile?.school_id]);

  async function fetchAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [assetsRes, catsRes, locsRes, roomsRes] = await Promise.all([
      supabase.from('assets').select('*, asset_categories(name), asset_locations(name), asset_rooms(name)')
        .eq('school_id', profile.school_id).order('name'),
      supabase.from('asset_categories').select('id, name, color').eq('school_id', profile.school_id).order('name'),
      supabase.from('asset_locations').select('id, name, type').eq('school_id', profile.school_id).order('name'),
      supabase.from('asset_rooms').select('id, name, location_id').eq('school_id', profile.school_id).order('name'),
    ]);
    setAssets((assetsRes.data ?? []) as Asset[]);
    setCategories(catsRes.data ?? []);
    setLocations(locsRes.data ?? []);
    setRooms(roomsRes.data ?? []);
    setLoading(false);
  }

  const availableRooms = useMemo(() =>
    form.location_id ? rooms.filter(r => r.location_id === form.location_id) : rooms,
    [form.location_id, rooms]);

  const filterRooms = useMemo(() =>
    filterLoc ? rooms.filter(r => r.location_id === filterLoc) : rooms,
    [filterLoc, rooms]);

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q) ||
        (a.asset_locations as any)?.name?.toLowerCase().includes(q) ||
        (a.asset_rooms as any)?.name?.toLowerCase().includes(q) ||
        (a.asset_categories as any)?.name?.toLowerCase().includes(q)
      );
    }
    if (filterLoc) list = list.filter(a => a.location_id === filterLoc);
    if (filterRoom) list = list.filter(a => a.room_id === filterRoom);
    if (filterCat) list = list.filter(a => a.category_id === filterCat);
    if (filterCond) list = list.filter(a => a.condition === filterCond);
    return list;
  }, [assets, search, filterLoc, filterRoom, filterCat, filterCond]);

  const stats = useMemo(() => ({
    total: assets.reduce((s, a) => s + a.quantity, 0),
    good: assets.filter(a => a.condition === 'good').reduce((s, a) => s + a.quantity, 0),
    attention: assets.filter(a => a.condition === 'fair' || a.condition === 'poor').reduce((s, a) => s + a.quantity, 0),
    damaged: assets.filter(a => a.condition === 'damaged').reduce((s, a) => s + a.quantity, 0),
  }), [assets]);

  function openAdd() {
    setEditId(null);
    setForm({ ...BLANK_FORM });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(a: Asset) {
    setEditId(a.id);
    setForm({
      name: a.name,
      category_id: a.category_id ?? '',
      location_id: a.location_id ?? '',
      room_id: a.room_id ?? '',
      quantity: String(a.quantity),
      condition: a.condition,
      description: a.description ?? '',
      serial_number: a.serial_number ?? '',
      purchase_date: a.purchase_date ?? '',
      unit_price: a.unit_price != null ? String(a.unit_price) : '',
      notes: a.notes ?? '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  function setF(k: string, v: string) {
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === 'location_id') next.room_id = '';
      return next;
    });
    setSaveError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError('Item name is required.'); return; }
    setSaving(true);
    const payload: any = {
      school_id: profile?.school_id,
      name: form.name.trim(),
      category_id: form.category_id || null,
      location_id: form.location_id || null,
      room_id: form.room_id || null,
      quantity: parseInt(form.quantity) || 1,
      condition: form.condition,
      description: form.description.trim() || null,
      serial_number: form.serial_number.trim() || null,
      purchase_date: form.purchase_date || null,
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from('assets').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('assets').insert(payload));
    }
    if (error) { setSaveError(error.message); setSaving(false); return; }
    setModalOpen(false);
    await fetchAll();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('assets').delete().eq('id', id);
    setDeleteId(null);
    await fetchAll();
  }

  const activeFilters = [filterLoc, filterRoom, filterCat, filterCond].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Asset Register</h2>
          <p className="text-app-text-muted text-sm">Master tracker of all school property — furniture, equipment, bedding and more</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-200">
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Items', value: stats.total, icon: Package, bg: 'bg-app-surface-alt', text: 'text-app-text', iconBg: 'bg-slate-200' },
          { label: 'Good Condition', value: stats.good, icon: CheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-200' },
          { label: 'Needs Attention', value: stats.attention, icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-200' },
          { label: 'Damaged', value: stats.damaged, icon: XCircle, bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-200' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-white/60`}>
            <div className="flex items-center gap-3">
              <div className={`${s.iconBg} w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-4.5 h-4.5 ${s.text}`} />
              </div>
              <div>
                <div className={`text-2xl font-black ${s.text}`}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-app-text-muted font-medium">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items, location, room, serial…"
              className="w-full border border-app-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || activeFilters > 0 ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-app-border text-app-text-muted hover:border-app-border'}`}>
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters > 0 && <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button onClick={() => { setFilterLoc(''); setFilterRoom(''); setFilterCat(''); setFilterCond(''); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-app-border text-sm text-app-text-muted hover:text-red-500 hover:border-red-200 transition-colors">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Building</label>
              <select value={filterLoc} onChange={e => { setFilterLoc(e.target.value); setFilterRoom(''); }}
                className={INPUT}>
                <option value="">All Buildings</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Room / Office</label>
              <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)} className={INPUT}>
                <option value="">All Rooms</option>
                {filterRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Category</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={INPUT}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Condition</label>
              <select value={filterCond} onChange={e => setFilterCond(e.target.value)} className={INPUT}>
                <option value="">All Conditions</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-app-border flex items-center justify-between">
          <span className="text-xs font-semibold text-app-text-muted">{filteredAssets.length} item{filteredAssets.length !== 1 ? 's' : ''} {search || activeFilters > 0 ? 'found' : 'total'}</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-app-text-muted text-sm">Loading assets…</div>
        ) : filteredAssets.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="font-medium text-app-text-muted">
              {search || activeFilters > 0 ? 'No assets match your filters' : 'No assets recorded yet'}
            </p>
            <p className="text-sm text-app-text-muted mt-1">
              {search || activeFilters > 0 ? 'Try adjusting your search or filters' : 'Click "Add Asset" to start building your register'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Building</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Room / Office</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-center px-4 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Condition</th>
                  <th className="text-right px-5 py-3 font-semibold text-app-text-muted text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {filteredAssets.map((a, idx) => (
                  <tr key={a.id} className={`hover:bg-app-surface-alt/70 transition-colors ${idx % 2 === 1 ? 'bg-app-surface-alt/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-app-text">{a.name}</div>
                      {a.serial_number && <div className="text-xs text-app-text-muted mt-0.5">S/N: {a.serial_number}</div>}
                      {a.description && <div className="text-xs text-app-text-muted truncate max-w-[200px]">{a.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {(a.asset_categories as any)?.name
                        ? <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-app-text-muted">{(a.asset_categories as any).name}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-app-text">
                      {(a.asset_locations as any)?.name ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-app-text-muted">
                      {(a.asset_rooms as any)?.name ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-base font-bold text-app-text">{a.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ConditionBadge condition={a.condition} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(a)}
                          className="p-1.5 rounded-lg text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(a.id)}
                          className="p-1.5 rounded-lg text-app-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Asset' : 'Add Asset'}>
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Item Name <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Student Desk, Single Bed, Standing Fan" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Category</label>
              <select value={form.category_id} onChange={e => setF('category_id', e.target.value)} className={INPUT}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setF('quantity', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Building / Block</label>
              <select value={form.location_id} onChange={e => setF('location_id', e.target.value)} className={INPUT}>
                <option value="">Select building</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Room / Office</label>
              <select value={form.room_id} onChange={e => setF('room_id', e.target.value)} className={INPUT} disabled={!form.location_id && availableRooms.length === 0}>
                <option value="">Select room</option>
                {availableRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Condition</label>
              <div className="grid grid-cols-4 gap-2">
                {CONDITIONS.map(c => (
                  <button type="button" key={c.value} onClick={() => setF('condition', c.value)}
                    className={`py-2 rounded-xl border-2 text-xs font-semibold transition-all ${form.condition === c.value ? `${c.bg} ${c.text} border-current` : 'border-app-border text-app-text-muted hover:border-app-border'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Serial / Tag No.</label>
              <input value={form.serial_number} onChange={e => setF('serial_number', e.target.value)} placeholder="Optional" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Unit Value (₦)</label>
              <input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setF('unit_price', e.target.value)} placeholder="Optional" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => setF('purchase_date', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Description</label>
              <input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Optional" className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-app-text-muted mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="Any extra notes…" className={`${INPUT} resize-none`} />
            </div>
          </div>
          {saveError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Asset">
        <div className="p-1 space-y-4">
          <p className="text-sm text-app-text-muted">Are you sure you want to remove this asset from the register? This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button onClick={() => handleDelete(deleteId!)} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
