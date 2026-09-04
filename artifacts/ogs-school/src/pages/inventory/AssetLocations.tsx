import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2, DoorOpen, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface';

interface AssetLocation { id: string; name: string; type: string; notes: string; }
interface AssetRoom { id: string; name: string; location_id: string; notes: string; }

const LOCATION_TYPES = ['Building', 'Block', 'Hostel', 'Hall', 'Laboratory', 'Library', 'Field', 'Other'];

export default function AssetLocations() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [rooms, setRooms] = useState<AssetRoom[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [locModal, setLocModal] = useState(false);
  const [editLocId, setEditLocId] = useState<string | null>(null);
  const [locForm, setLocForm] = useState({ name: '', type: 'Building', notes: '' });

  const [roomModal, setRoomModal] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({ name: '', notes: '' });

  const [deleteLocId, setDeleteLocId] = useState<string | null>(null);
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [profile?.school_id]);

  async function fetchAll() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [locRes, roomRes] = await Promise.all([
      supabase.from('asset_locations').select('*').eq('school_id', profile.school_id).order('name'),
      supabase.from('asset_rooms').select('*').eq('school_id', profile.school_id).order('name'),
    ]);
    const locs = locRes.data ?? [];
    setLocations(locs);
    setRooms(roomRes.data ?? []);
    if (!selectedLoc && locs.length > 0) setSelectedLoc(locs[0].id);
    setLoading(false);
  }

  // ── Locations ──────────────────────────────────────────────────────────────
  function openAddLoc() {
    setEditLocId(null);
    setLocForm({ name: '', type: 'Building', notes: '' });
    setSaveError('');
    setLocModal(true);
  }
  function openEditLoc(l: AssetLocation) {
    setEditLocId(l.id);
    setLocForm({ name: l.name, type: l.type ?? 'Building', notes: l.notes ?? '' });
    setSaveError('');
    setLocModal(true);
  }
  async function handleLocSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locForm.name.trim()) { setSaveError('Name is required.'); return; }
    setSaving(true);
    const payload = { school_id: profile?.school_id, name: locForm.name.trim(), type: locForm.type, notes: locForm.notes.trim() || null };
    let error;
    if (editLocId) {
      ({ error } = await supabase.from('asset_locations').update(payload).eq('id', editLocId));
    } else {
      ({ error } = await supabase.from('asset_locations').insert(payload));
    }
    if (error) { setSaveError(error.message); setSaving(false); return; }
    setLocModal(false);
    await fetchAll();
    setSaving(false);
  }
  async function handleDeleteLoc(id: string) {
    await supabase.from('asset_locations').delete().eq('id', id);
    if (selectedLoc === id) setSelectedLoc(null);
    setDeleteLocId(null);
    await fetchAll();
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────
  function openAddRoom() {
    if (!selectedLoc) return;
    setEditRoomId(null);
    setRoomForm({ name: '', notes: '' });
    setSaveError('');
    setRoomModal(true);
  }
  function openEditRoom(r: AssetRoom) {
    setEditRoomId(r.id);
    setRoomForm({ name: r.name, notes: r.notes ?? '' });
    setSaveError('');
    setRoomModal(true);
  }
  async function handleRoomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomForm.name.trim()) { setSaveError('Room name is required.'); return; }
    setSaving(true);
    const payload = { school_id: profile?.school_id, location_id: selectedLoc, name: roomForm.name.trim(), notes: roomForm.notes.trim() || null };
    let error;
    if (editRoomId) {
      ({ error } = await supabase.from('asset_rooms').update(payload).eq('id', editRoomId));
    } else {
      ({ error } = await supabase.from('asset_rooms').insert(payload));
    }
    if (error) { setSaveError(error.message); setSaving(false); return; }
    setRoomModal(false);
    await fetchAll();
    setSaving(false);
  }
  async function handleDeleteRoom(id: string) {
    await supabase.from('asset_rooms').delete().eq('id', id);
    setDeleteRoomId(null);
    await fetchAll();
  }

  const selectedLocation = locations.find(l => l.id === selectedLoc);
  const locRooms = rooms.filter(r => r.location_id === selectedLoc);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-app-text">Locations & Rooms</h2>
        <p className="text-app-text-muted text-sm">Define buildings, blocks and the rooms/offices inside them</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buildings panel */}
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-app-text">Buildings / Blocks</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-app-text-muted font-medium">{locations.length}</span>
            </div>
            <button onClick={openAddLoc}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-app-text-muted text-sm">Loading…</div>
          ) : locations.length === 0 ? (
            <div className="py-14 text-center">
              <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-app-text-muted text-sm">No buildings added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-app-border">
              {locations.map(l => {
                const roomCount = rooms.filter(r => r.location_id === l.id).length;
                const isSelected = selectedLoc === l.id;
                return (
                  <div key={l.id} onClick={() => setSelectedLoc(l.id)}
                    className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors group ${isSelected ? 'bg-emerald-50 border-l-2 border-emerald-500' : 'hover:bg-app-surface-alt border-l-2 border-transparent'}`}>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm ${isSelected ? 'text-emerald-700' : 'text-app-text'}`}>{l.name}</div>
                      <div className="text-xs text-app-text-muted mt-0.5">{l.type} · {roomCount} room{roomCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={ev => { ev.stopPropagation(); openEditLoc(l); }}
                        className="p-1.5 rounded-lg text-app-text-muted hover:text-emerald-600 hover:bg-app-surface transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={ev => { ev.stopPropagation(); setDeleteLocId(l.id); }}
                        className="p-1.5 rounded-lg text-app-text-muted hover:text-red-500 hover:bg-app-surface transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-emerald-500' : 'text-slate-300'}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rooms panel */}
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-app-text">
                {selectedLocation ? selectedLocation.name : 'Rooms / Offices'}
              </h3>
              {selectedLocation && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-app-text-muted font-medium">{locRooms.length}</span>
              )}
            </div>
            <button onClick={openAddRoom} disabled={!selectedLoc}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus className="w-3.5 h-3.5" /> Add Room
            </button>
          </div>

          {!selectedLoc ? (
            <div className="py-14 text-center">
              <ChevronRight className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-app-text-muted text-sm">Select a building to manage its rooms</p>
            </div>
          ) : locRooms.length === 0 ? (
            <div className="py-14 text-center">
              <DoorOpen className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-app-text-muted text-sm">No rooms in this building yet</p>
              <button onClick={openAddRoom} className="mt-3 text-xs text-blue-600 underline">Add first room</button>
            </div>
          ) : (
            <div className="divide-y divide-app-border">
              {locRooms.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-app-surface-alt transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-app-text">{r.name}</div>
                    {r.notes && <div className="text-xs text-app-text-muted truncate">{r.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditRoom(r)}
                      className="p-1.5 rounded-lg text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteRoomId(r.id)}
                      className="p-1.5 rounded-lg text-app-text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Building modal */}
      <Modal isOpen={locModal} onClose={() => setLocModal(false)} title={editLocId ? 'Edit Building' : 'Add Building'}>
        <form onSubmit={handleLocSubmit} className="p-1 space-y-4">
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Name <span className="text-red-400">*</span></label>
            <input value={locForm.name} onChange={e => { setLocForm(p => ({ ...p, name: e.target.value })); setSaveError(''); }}
              placeholder="e.g. Admin Block, Dormitory A, Science Lab" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Type</label>
            <select value={locForm.type} onChange={e => setLocForm(p => ({ ...p, type: e.target.value }))} className={INPUT}>
              {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Notes</label>
            <textarea value={locForm.notes} onChange={e => setLocForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${INPUT} resize-none`} placeholder="Optional" />
          </div>
          {saveError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLocModal(false)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-app-primary hover:opacity-90 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : editLocId ? 'Save' : 'Add Building'}</button>
          </div>
        </form>
      </Modal>

      {/* Room modal */}
      <Modal isOpen={roomModal} onClose={() => setRoomModal(false)} title={editRoomId ? 'Edit Room' : `Add Room — ${selectedLocation?.name ?? ''}`}>
        <form onSubmit={handleRoomSubmit} className="p-1 space-y-4">
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Room / Office Name <span className="text-red-400">*</span></label>
            <input value={roomForm.name} onChange={e => { setRoomForm(p => ({ ...p, name: e.target.value })); setSaveError(''); }}
              placeholder="e.g. Principal's Office, Dormitory 1, Room 5A" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Notes</label>
            <textarea value={roomForm.notes} onChange={e => setRoomForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${INPUT} resize-none`} placeholder="Optional" />
          </div>
          {saveError && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRoomModal(false)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-app-primary hover:opacity-90 text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : editRoomId ? 'Save' : 'Add Room'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete location confirm */}
      <Modal isOpen={!!deleteLocId} onClose={() => setDeleteLocId(null)} title="Delete Building">
        <div className="p-1 space-y-4">
          <p className="text-sm text-app-text-muted">This will delete the building and all its rooms. Assets assigned here will lose their location. Are you sure?</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteLocId(null)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button onClick={() => handleDeleteLoc(deleteLocId!)} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
          </div>
        </div>
      </Modal>

      {/* Delete room confirm */}
      <Modal isOpen={!!deleteRoomId} onClose={() => setDeleteRoomId(null)} title="Delete Room">
        <div className="p-1 space-y-4">
          <p className="text-sm text-app-text-muted">Are you sure you want to delete this room? Assets assigned here will lose their room assignment.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteRoomId(null)} className="px-4 py-2 rounded-xl border border-app-border text-sm text-app-text-muted hover:bg-app-surface-alt">Cancel</button>
            <button onClick={() => handleDeleteRoom(deleteRoomId!)} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
