import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, CalendarDays, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface WeekDay {
  id: string;
  name: string;
  is_weekend: boolean;
  sort_order: number;
}

const DEFAULT_DAYS = [
  { name: 'Monday',    is_weekend: false, sort_order: 1 },
  { name: 'Tuesday',   is_weekend: false, sort_order: 2 },
  { name: 'Wednesday', is_weekend: false, sort_order: 3 },
  { name: 'Thursday',  is_weekend: false, sort_order: 4 },
  { name: 'Friday',    is_weekend: false, sort_order: 5 },
];

export default function WeekDays() {
  const { profile } = useAuth();
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WeekDay | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    is_weekend: false,
    sort_order: 0
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.school_id) fetchWeekDays();
  }, [profile?.school_id]);

  async function fetchWeekDays() {
    setLoading(true);
    setDbError('');

    const { data, error } = await supabase
      .from('school_week_days')
      .select('*')
      .eq('school_id', profile!.school_id)
      .order('sort_order', { ascending: true });

    if (error) {
      setDbError(`Database error: ${error.message}. Make sure you have run the latest migration (sync_supabase.ps1).`);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      // Auto-seed default Mon–Fri
      const rows = DEFAULT_DAYS.map((d) => ({ ...d, school_id: profile!.school_id }));
      const { data: seeded, error: seedError } = await supabase
        .from('school_week_days')
        .insert(rows)
        .select();

      if (seedError) {
        setDbError(`Could not seed defaults: ${seedError.message}. Make sure you have run sync_supabase.ps1 to apply the latest migration.`);
      } else {
        setWeekDays(seeded || []);
      }
    } else {
      setWeekDays(data);
    }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', is_weekend: false, sort_order: weekDays.length + 1 });
    setModalOpen(true);
  }

  function openEdit(day: WeekDay) {
    setEditing(day);
    setForm({
      name: day.name,
      is_weekend: day.is_weekend,
      sort_order: day.sort_order,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    
    const payload = {
      school_id: profile!.school_id,
      name: form.name,
      is_weekend: form.is_weekend,
      sort_order: form.sort_order
    };

    if (editing) {
      await supabase.from('school_week_days').upsert({ ...payload, id: editing.id });
    } else {
      await supabase.from('school_week_days').insert(payload);
    }

    setSaving(false);
    setModalOpen(false);
    fetchWeekDays();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this week day? This will remove all timetable routines assigned to this day.')) return;
    await supabase.from('school_week_days').delete().eq('id', id);
    fetchWeekDays();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Week Days</h1>
          <p className="text-sm text-slate-500 mt-1">Manage physical instructional days and weekends for your school</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Week Day
        </button>
      </div>

      {dbError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <span>{dbError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Day Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Is Weekend?</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sort Order</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {weekDays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDays size={32} className="opacity-20" />
                      <p>No week days defined. Add generic days such as Monday to continue.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                weekDays.map((day) => (
                  <tr key={day.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{day.name}</td>
                    <td className="px-4 py-3">
                      {day.is_weekend ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{day.sort_order}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(day)}
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(day.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        title={editing ? 'Edit Week Day' : 'Add Week Day'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Day Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Monday"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="1"
            />
            <p className="text-xs text-slate-500 mt-1">Determines the display order in the Timetable</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="relative flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.is_weekend}
                onChange={(e) => setForm({ ...form, is_weekend: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <span className="text-sm font-medium text-slate-700">Is Weekend?</span>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
