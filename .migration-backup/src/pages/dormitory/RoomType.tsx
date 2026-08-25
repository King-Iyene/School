import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, BedDouble } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface RoomType {
  id: string;
  name: string;
  description: string;
  capacity: number;
  cost_per_term: number;
  school_id: string;
}

export default function RoomType() {
  const { profile } = useAuth();
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    capacity: '',
    cost_per_term: '',
  });

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  async function fetchRoomTypes() {
    setLoading(true);
    const { data } = await supabase
      .from('room_types')
      .select('*')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setRoomTypes(data as RoomType[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setForm({ name: '', description: '', capacity: '', cost_per_term: '' });
    setModalOpen(true);
  }

  function openEdit(rt: RoomType) {
    setEditId(rt.id);
    setSaveError('');
    setForm({
      name: rt.name || '',
      description: rt.description || '',
      capacity: rt.capacity != null ? String(rt.capacity) : '',
      cost_per_term: rt.cost_per_term != null ? String(rt.cost_per_term) : '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      capacity: form.capacity !== '' ? Number(form.capacity) : 0,
      cost_per_term: form.cost_per_term !== '' ? Number(form.cost_per_term) : 0,
      school_id: profile?.school_id,
    };
    let res;
    if (editId) {
      res = await supabase.from('room_types').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('room_types').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchRoomTypes();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this room type?')) return;
    await supabase.from('room_types').delete().eq('id', id);
    fetchRoomTypes();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <BedDouble size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Room Types</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Room Type
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : roomTypes.length === 0 ? (
          <div className="p-12 text-center">
            <BedDouble size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No room types found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Capacity</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Cost Per Term</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomTypes.map(rt => (
                  <tr key={rt.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{rt.name}</td>
                    <td className="px-4 py-3 text-slate-600">{rt.description || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">
                        {rt.capacity} beds
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      ₦{Number(rt.cost_per_term).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(rt)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(rt.id)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Room Type' : 'Add Room Type'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Standard, Deluxe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacity (beds)</label>
              <input
                type="number"
                min="1"
                required
                className={INPUT_CLASS}
                value={form.capacity}
                onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost Per Term (₦)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className={INPUT_CLASS}
                value={form.cost_per_term}
                onChange={e => setForm(p => ({ ...p, cost_per_term: e.target.value }))}
                placeholder="0.00"
              />
            </div>
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
