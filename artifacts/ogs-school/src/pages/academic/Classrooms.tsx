import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Classroom {
  id: string;
  room_no: string;
  building: string;
  capacity: number;
  school_id: string;
}

interface FormData {
  room_no: string;
  building: string;
  capacity: string;
}

const initialForm: FormData = { room_no: '', building: '', capacity: '' };

export default function Classrooms() {
  const { profile } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile?.school_id) fetchClassrooms();
  }, [profile?.school_id]);

  async function fetchClassrooms() {
    setLoading(true);
    const { data } = await supabase
      .from('classrooms')
      .select('*')
      .eq('school_id', profile!.school_id)
      .order('room_no');
    setClassrooms(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(initialForm);
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(classroom: Classroom) {
    setEditing(classroom);
    setForm({
      room_no: classroom.room_no,
      building: classroom.building || '',
      capacity: classroom.capacity?.toString() || '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.room_no.trim()) return;
    setSaving(true);
    const payload = {
      room_no: form.room_no,
      building: form.building,
      capacity: form.capacity ? parseInt(form.capacity) : null,
    };
    if (editing) {
      const res = await supabase.from('classrooms').update(payload).eq('id', editing.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('classrooms').insert({ ...payload, school_id: profile!.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchClassrooms();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this classroom?')) return;
    await supabase.from('classrooms').delete().eq('id', id);
    fetchClassrooms();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Classrooms</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage classrooms and their details</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Classroom
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Class Name</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Building</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Capacity</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-app-text-muted">No classrooms found</td>
                </tr>
              ) : (
                classrooms.map((classroom) => (
                  <tr key={classroom.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 font-medium text-app-text">{classroom.room_no}</td>
                    <td className="px-4 py-3 text-app-text-muted">{classroom.building || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{classroom.capacity ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(classroom)}
                          className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(classroom.id)}
                          className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Classroom' : 'Add Classroom'}
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Class Name</label>
            <input
              type="text"
              value={form.room_no}
              onChange={(e) => setForm({ ...form, room_no: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              placeholder="e.g. Nursery 1A, JSS 1B"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Building</label>
            <input
              type="text"
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              placeholder="e.g. Main Block"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Capacity</label>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              placeholder="e.g. 40"
              min={1}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
