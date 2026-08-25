import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, BedDouble } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface DormitoryRoom {
  id: string;
  room_no: string;
  room_type: string;
  capacity: number;
  cost_per_term: number;
  floor: string;
  building: string;
  description: string;
  is_active: boolean;
}

const ROOM_TYPES = ['dormitory', 'double', 'other', 'single', 'suite'];

export default function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<DormitoryRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    room_no: '',
    room_type: 'dormitory',
    capacity: '',
    cost_per_term: '',
    floor: '',
    building: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    setLoading(true);
    const { data } = await supabase
      .from('dormitory_rooms')
      .select('*')
      .order('room_no');
    if (data) setRooms(data as DormitoryRoom[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setForm({
      room_no: '',
      room_type: 'dormitory',
      capacity: '',
      cost_per_term: '',
      floor: '',
      building: '',
      description: '',
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(room: DormitoryRoom) {
    setEditId(room.id);
    setSaveError('');
    setForm({
      room_no: room.room_no || '',
      room_type: room.room_type || 'dormitory',
      capacity: room.capacity != null ? String(room.capacity) : '',
      cost_per_term: room.cost_per_term != null ? String(room.cost_per_term) : '',
      floor: room.floor || '',
      building: room.building || '',
      description: room.description || '',
      is_active: room.is_active ?? true,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      room_no: form.room_no,
      room_type: form.room_type,
      capacity: form.capacity !== '' ? Number(form.capacity) : null,
      cost_per_term: form.cost_per_term !== '' ? Number(form.cost_per_term) : null,
      floor: form.floor,
      building: form.building,
      description: form.description,
      is_active: form.is_active,
    };
    let res;
    if (editId) {
      res = await supabase.from('dormitory_rooms').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('dormitory_rooms').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchRooms();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this room?')) return;
    await supabase.from('dormitory_rooms').delete().eq('id', id);
    fetchRooms();
  }

  async function toggleActive(room: DormitoryRoom) {
    await supabase
      .from('dormitory_rooms')
      .update({ is_active: !room.is_active })
      .eq('id', room.id);
    fetchRooms();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <BedDouble size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Dormitory Rooms</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Room
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center">
            <BedDouble size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No rooms found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Room No</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Capacity</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Cost/Term</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Floor</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Building</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map(room => (
                  <tr key={room.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{room.room_no}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{room.room_type}</td>
                    <td className="px-4 py-3 text-slate-600">{room.capacity ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {room.cost_per_term != null ? `₦${Number(room.cost_per_term).toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{room.floor || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{room.building || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(room)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          room.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {room.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(room)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Room' : 'Add Room'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room No</label>
              <input
                required
                className={INPUT_CLASS}
                value={form.room_no}
                onChange={e => setForm(p => ({ ...p, room_no: e.target.value }))}
                placeholder="e.g. A101"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
              <select
                className={INPUT_CLASS}
                value={form.room_type}
                onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))}
              >
                {ROOM_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
              <input
                type="number"
                min="1"
                className={INPUT_CLASS}
                value={form.capacity}
                onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                placeholder="Number of beds"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost per Term (₦)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={INPUT_CLASS}
                value={form.cost_per_term}
                onChange={e => setForm(p => ({ ...p, cost_per_term: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
              <input
                className={INPUT_CLASS}
                value={form.floor}
                onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                placeholder="e.g. Ground, 1st"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Building</label>
              <input
                className={INPUT_CLASS}
                value={form.building}
                onChange={e => setForm(p => ({ ...p, building: e.target.value }))}
                placeholder="e.g. Block A"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="room_is_active"
              checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="accent-emerald-500"
            />
            <label htmlFor="room_is_active" className="text-sm text-slate-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
