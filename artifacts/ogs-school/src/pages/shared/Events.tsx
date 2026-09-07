import { useEffect, useState } from 'react';
import { Plus, Calendar as CalIcon, Trash2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import { downloadEventICS, downloadEventsICS } from '../../lib/ics';

const INPUT = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30';

const EVENT_TYPES = [
  { value: 'academic', label: 'Academic', color: 'bg-blue-100 text-blue-700' },
  { value: 'sports', label: 'Sports', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cultural', label: 'Cultural', color: 'bg-amber-100 text-amber-700' },
  { value: 'holiday', label: 'Holiday', color: 'bg-rose-100 text-rose-700' },
  { value: 'examination', label: 'Examination', color: 'bg-orange-100 text-orange-700' },
  { value: 'general', label: 'General', color: 'bg-slate-100 text-app-text-muted' },
];

const typeColor = (type: string) => EVENT_TYPES.find(t => t.value === type)?.color ?? 'bg-slate-100 text-app-text-muted';

interface EventItem {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_type: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string;
  created_at: string;
}

const emptyForm = {
  title: '',
  description: '',
  event_date: new Date().toISOString().split('T')[0],
  event_type: 'academic',
  all_day: true,
  start_time: '',
  end_time: '',
};

export default function Events() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const school_name = settings.school_name;
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canCreate = ['super_admin', 'admin', 'principal', 'teacher', 'accountant'].includes(profile?.role ?? '');

  useEffect(() => { load(); }, [profile?.school_id]);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('event_date');
    setEvents((data ?? []) as EventItem[]);
    setLoading(false);
  }

  function openAdd() {
    setError('');
    setForm({ ...emptyForm, event_date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.event_date) { setError('Title and event date are required.'); return; }
    setSaving(true);
    setError('');

    const { error: err } = await supabase.from('events').insert({
      title: form.title.trim(),
      description: form.description.trim(),
      event_date: form.event_date,
      event_type: form.event_type,
      all_day: form.all_day,
      start_time: form.all_day ? null : (form.start_time || null),
      end_time: form.all_day ? null : (form.end_time || null),
      school_id: profile?.school_id,
      created_by: profile?.id,
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setShowModal(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    await supabase.from('events').delete().eq('id', id);
    load();
  }

  const today = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.event_date >= today);
  const past = events.filter(e => e.event_date < today);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">School Events</h2>
          <p className="text-app-text-muted text-sm">Calendar of academic and school activities</p>
        </div>
        <div className="flex items-center gap-2">
          {upcoming.length > 0 && (
            <button
              onClick={() => downloadEventsICS(upcoming, `${school_name} Events`)}
              className="flex items-center gap-2 bg-app-surface text-app-text border border-app-border hover:bg-app-surface-alt px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Export to Calendar
            </button>
          )}
          {canCreate && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Event
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-app-text-muted">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
          <CalIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No events yet</p>
          {canCreate && <p className="text-app-text-muted text-sm mt-1">Click "Add Event" to create one</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm">
              <div className="p-4 border-b border-app-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="font-semibold text-app-text">Upcoming Events</h3>
                <span className="text-xs text-app-text-muted bg-slate-100 px-2 py-0.5 rounded-full">{upcoming.length}</span>
              </div>
              <div className="divide-y divide-app-border">
                {upcoming.map(ev => (
                  <EventRow key={ev.id} ev={ev} canDelete={canCreate} onDelete={() => handleDelete(ev.id)} schoolName={school_name} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm opacity-75">
              <div className="p-4 border-b border-app-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <h3 className="font-semibold text-app-text-muted">Past Events</h3>
                <span className="text-xs text-app-text-muted bg-slate-100 px-2 py-0.5 rounded-full">{past.length}</span>
              </div>
              <div className="divide-y divide-app-border">
                {past.slice(0, 5).map(ev => (
                  <EventRow key={ev.id} ev={ev} canDelete={canCreate} onDelete={() => handleDelete(ev.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Event" size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title <span className="text-red-500">*</span></label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className={INPUT}
              placeholder="Event title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className={`${INPUT} resize-none`}
              rows={3}
              placeholder="Event description (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Event Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => setForm({ ...form, event_date: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Event Type</label>
              <select
                value={form.event_type}
                onChange={e => setForm({ ...form, event_type: e.target.value })}
                className={`${INPUT} bg-app-surface`}
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-app-surface-alt rounded-xl border border-app-border">
            <div>
              <p className="text-sm font-medium text-app-text">All Day Event</p>
              <p className="text-xs text-app-text-muted">Turn off to set specific start/end times</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, all_day: !form.all_day })}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.all_day ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-app-surface rounded-full shadow transition-transform ${form.all_day ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Start Time</label>
                <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">End Time</label>
                <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className={INPUT} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.event_date}
              className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Add Event'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EventRow({ ev, canDelete, onDelete, schoolName }: { ev: EventItem; canDelete: boolean; onDelete: () => void; schoolName?: string }) {
  const d = new Date(ev.event_date);
  const color = EVENT_TYPES.find(t => t.value === ev.event_type)?.color ?? 'bg-slate-100 text-app-text-muted';
  return (
    <div className="p-4 flex items-center gap-4">
      <div className="bg-app-surface-alt border border-app-border rounded-xl p-3 text-center min-w-[56px]">
        <p className="text-xl font-bold text-app-text leading-none">{d.getDate()}</p>
        <p className="text-xs font-medium text-app-text-muted">{d.toLocaleString('default', { month: 'short' })}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-app-text">{ev.title}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${color}`}>{ev.event_type}</span>
          {ev.all_day && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">All Day</span>}
        </div>
        {ev.description && <p className="text-sm text-app-text-muted mt-0.5 truncate">{ev.description}</p>}
        {!ev.all_day && ev.start_time && (
          <p className="text-xs text-app-text-muted mt-0.5">{ev.start_time}{ev.end_time ? ` — ${ev.end_time}` : ''}</p>
        )}
      </div>
      <button
        onClick={() => downloadEventICS(ev, schoolName)}
        title="Add to calendar"
        className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-surface-alt rounded-lg transition-colors flex-shrink-0"
      >
        <Download className="w-4 h-4" />
      </button>
      {canDelete && (
        <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
