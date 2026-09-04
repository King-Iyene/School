import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface DormitoryBuilding {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'mixed';
  total_capacity: number;
  school_id: string;
}

export default function DormitoryBuildings() {
  const { profile } = useAuth();
  const [buildings, setBuildings] = useState<DormitoryBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    gender: 'mixed' as 'male' | 'female' | 'mixed',
    total_capacity: '',
  });

  useEffect(() => {
    fetchBuildings();
  }, []);

  async function fetchBuildings() {
    setLoading(true);
    const { data } = await supabase
      .from('dormitory_buildings')
      .select('*')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setBuildings(data as DormitoryBuilding[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setForm({ name: '', description: '', gender: 'mixed', total_capacity: '' });
    setModalOpen(true);
  }

  function openEdit(b: DormitoryBuilding) {
    setEditId(b.id);
    setSaveError('');
    setForm({
      name: b.name || '',
      description: b.description || '',
      gender: b.gender || 'mixed',
      total_capacity: b.total_capacity != null ? String(b.total_capacity) : '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      gender: form.gender,
      total_capacity: form.total_capacity !== '' ? Number(form.total_capacity) : 0,
      school_id: profile?.school_id,
    };
    let res;
    if (editId) {
      res = await supabase.from('dormitory_buildings').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('dormitory_buildings').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchBuildings();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this building?')) return;
    await supabase.from('dormitory_buildings').delete().eq('id', id);
    fetchBuildings();
  }

  function genderBadge(gender: string) {
    if (gender === 'male') return 'bg-blue-100 text-blue-700';
    if (gender === 'female') return 'bg-pink-100 text-pink-700';
    return 'bg-emerald-100 text-emerald-700';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-app-primary text-white p-2 rounded-xl">
            <Building2 size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Dormitory Buildings</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Building
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : buildings.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No buildings found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Gender</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Total Capacity</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Description</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {buildings.map(b => (
                  <tr key={b.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${genderBadge(b.gender)}`}>
                        {b.gender}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text">{b.total_capacity}</td>
                    <td className="px-4 py-3 text-app-text-muted">{b.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(b)}
                          className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="text-app-text-muted hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Building' : 'Add Building'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Name</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Building name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Gender</label>
              <select
                className={INPUT_CLASS}
                value={form.gender}
                onChange={e => setForm(p => ({ ...p, gender: e.target.value as 'male' | 'female' | 'mixed' }))}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Total Capacity</label>
              <input
                type="number"
                min="0"
                required
                className={INPUT_CLASS}
                value={form.total_capacity}
                onChange={e => setForm(p => ({ ...p, total_capacity: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-app-border text-app-text-muted hover:bg-app-surface-alt"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-app-primary hover:opacity-90 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
