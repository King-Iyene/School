import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface TimeSlot {
  id: string;
  period_name: string;
  time_type: 'class' | 'exam' | 'break';
  start_time: string;
  end_time: string;
  sort_order: number;
  school_id: string;
}

interface FormData {
  period_name: string;
  time_type: 'class' | 'exam' | 'break';
  start_time: string;
  end_time: string;
  sort_order: string;
}

const initialForm: FormData = {
  period_name: '',
  time_type: 'class',
  start_time: '',
  end_time: '',
  sort_order: '',
};

const typeColors: Record<string, string> = {
  class: 'bg-emerald-100 text-emerald-700',
  exam: 'bg-red-100 text-red-700',
  break: 'bg-amber-100 text-amber-700',
};

export default function TimeSlots() {
  const { profile } = useAuth();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile?.school_id) fetchTimeSlots();
  }, [profile?.school_id]);

  async function fetchTimeSlots() {
    setLoading(true);
    const { data } = await supabase
      .from('time_slots')
      .select('*')
      .eq('school_id', profile!.school_id)
      .order('sort_order', { ascending: true });
    setTimeSlots(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(initialForm);
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(slot: TimeSlot) {
    setEditing(slot);
    setForm({
      period_name: slot.period_name,
      time_type: slot.time_type,
      start_time: slot.start_time,
      end_time: slot.end_time,
      sort_order: slot.sort_order?.toString() || '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.period_name.trim() || !form.start_time || !form.end_time) return;
    setSaving(true);
    const payload = {
      period_name: form.period_name,
      time_type: form.time_type,
      start_time: form.start_time,
      end_time: form.end_time,
      sort_order: form.sort_order ? parseInt(form.sort_order) : 0,
    };
    if (editing) {
      const res = await supabase.from('time_slots').upsert({ ...payload, id: editing.id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('time_slots').insert({ ...payload, school_id: profile!.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchTimeSlots();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this time slot?')) return;
    await supabase.from('time_slots').delete().eq('id', id);
    fetchTimeSlots();
  }

  function formatTime(time: string) {
    if (!time) return '-';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Time Slots</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage periods, breaks, and exam slots</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Time Slot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Period Name</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Type</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Start Time</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">End Time</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Order</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {timeSlots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">No time slots found</td>
                </tr>
              ) : (
                timeSlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 font-medium text-app-text">{slot.period_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${typeColors[slot.time_type] || 'bg-slate-100 text-app-text'}`}>
                        {slot.time_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{formatTime(slot.start_time)}</td>
                    <td className="px-4 py-3 text-app-text-muted">{formatTime(slot.end_time)}</td>
                    <td className="px-4 py-3 text-app-text-muted">{slot.sort_order}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(slot)}
                          className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(slot.id)}
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
        title={editing ? 'Edit Time Slot' : 'Add Time Slot'}
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Period Name</label>
            <input
              type="text"
              value={form.period_name}
              onChange={(e) => setForm({ ...form, period_name: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              placeholder="e.g. Period 1, Lunch Break"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Type</label>
            <select
              value={form.time_type}
              onChange={(e) => setForm({ ...form, time_type: e.target.value as FormData['time_type'] })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            >
              <option value="class">Class</option>
              <option value="exam">Exam</option>
              <option value="break">Break</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              placeholder="e.g. 1, 2, 3"
              min={0}
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
