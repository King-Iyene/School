import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { Plus, Home, LogOut, AlertCircle, Copy, ExternalLink } from 'lucide-react';

const SQL_SETUP = `-- Option A: Fresh install (table does not exist yet)
CREATE TABLE IF NOT EXISTS staff_accommodation_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  room_id uuid REFERENCES asset_rooms(id) ON DELETE SET NULL,
  location_type text NOT NULL DEFAULT 'staff_quarter',
  room_label text,
  assigned_date date NOT NULL DEFAULT current_date,
  vacated_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE staff_accommodation_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_access" ON staff_accommodation_assignments
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- Note: Buildings and rooms are managed under Inventory → Locations & Rooms`;

const SQL_MIGRATE = `-- Run this if your table was created before the asset_rooms migration
-- (fixes: "violates foreign key constraint room_id_fkey")
ALTER TABLE staff_accommodation_assignments DROP COLUMN IF EXISTS room_id;
ALTER TABLE staff_accommodation_assignments
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES asset_rooms(id) ON DELETE SET NULL;`;

const ic = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-app-surface';

interface Assignment {
  id: string;
  staff_id: string;
  room_id: string | null;
  location_type: string;
  room_label: string | null;
  assigned_date: string;
  vacated_date: string | null;
  status: string;
  notes: string | null;
  profiles?: { first_name: string; last_name: string; role: string } | null;
  asset_rooms?: { name: string; asset_locations?: { name: string } | null } | null;
}

interface StaffOption { id: string; first_name: string; last_name: string; role: string }
interface RoomOption { id: string; name: string; location_id: string; location_name: string }
interface LocationOption { id: string; name: string; type: string }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  vacated: 'bg-slate-100 text-app-text-muted',
};

const TYPE_LABELS: Record<string, string> = {
  staff_quarter: 'Staff Quarter',
  office: 'Office',
  other: 'Other',
};

export default function StaffAccommodation() {
  const { profile } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'principal', 'head_teacher'].includes(profile?.role || '');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [vacateId, setVacateId] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active');
  const [selectedLocation, setSelectedLocation] = useState('');

  const [form, setForm] = useState({
    staff_id: '',
    location_type: 'staff_quarter',
    location_id: '',
    room_id: '',
    room_label: '',
    assigned_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchAssignments(), fetchStaff(), fetchLocationsAndRooms()]);
    setLoading(false);
  }

  async function fetchAssignments() {
    const { data, error } = await supabase
      .from('staff_accommodation_assignments')
      .select('*, profiles(first_name, last_name, role), asset_rooms(name, asset_locations(name))')
      .eq('school_id', profile?.school_id)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.message?.toLowerCase().includes('relation') || error.code === '42P01') setShowSql(true);
    } else {
      setAssignments(data || []);
    }
  }

  async function fetchStaff() {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', profile?.school_id)
      .not('role', 'in', '("student","parent")')
      .order('first_name');
    setStaff(data || []);
  }

  async function fetchLocationsAndRooms() {
    const [locRes, roomRes] = await Promise.all([
      supabase.from('asset_locations').select('id, name, type').eq('school_id', profile?.school_id).order('name'),
      supabase.from('asset_rooms').select('id, name, location_id, asset_locations(name)').eq('school_id', profile?.school_id).order('name'),
    ]);
    setLocations(locRes.data || []);
    setRooms((roomRes.data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      location_id: r.location_id,
      location_name: r.asset_locations?.name || '',
    })));
  }

  function resetForm() {
    setForm({
      staff_id: '', location_type: 'staff_quarter', location_id: '',
      room_id: '', room_label: '', assigned_date: new Date().toISOString().split('T')[0], notes: '',
    });
    setSelectedLocation('');
    setSaveError('');
  }

  async function save() {
    if (!form.staff_id) { setSaveError('Please select a staff member.'); return; }
    if (!form.room_id && !form.room_label.trim()) {
      setSaveError('Please select a room or enter a location label.'); return;
    }
    setSaving(true); setSaveError('');

    // Build a room label fallback from the selected room (used if FK fails)
    const selectedRoom = rooms.find(r => r.id === form.room_id);
    const fallbackLabel = selectedRoom
      ? (selectedRoom.location_name ? `${selectedRoom.location_name} — ${selectedRoom.name}` : selectedRoom.name)
      : form.room_label.trim();

    const payload = {
      school_id: profile?.school_id,
      staff_id: form.staff_id,
      location_type: form.location_type,
      room_id: form.room_id || null,
      room_label: form.room_label.trim() || null,
      assigned_date: form.assigned_date,
      status: 'active',
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from('staff_accommodation_assignments').insert(payload);

    if (!error) {
      setSaving(false);
      setModalOpen(false);
      resetForm();
      fetchAssignments();
      return;
    }

    // FK violation on room_id → DB still has old dormitory_rooms reference
    // Auto-retry without room_id, storing the room name in room_label instead
    if (error.code === '23503' && error.message.includes('room_id')) {
      setShowMigration(true);
      const { error: retryErr } = await supabase.from('staff_accommodation_assignments').insert({
        ...payload,
        room_id: null,
        room_label: fallbackLabel || null,
      });
      setSaving(false);
      if (!retryErr) {
        setModalOpen(false);
        resetForm();
        fetchAssignments();
      } else {
        setSaveError(retryErr.message);
      }
      return;
    }

    setSaving(false);
    if (error.message?.toLowerCase().includes('relation') || error.code === '42P01') setShowSql(true);
    setSaveError(error.message);
  }

  async function vacate(id: string) {
    await supabase.from('staff_accommodation_assignments')
      .update({ status: 'vacated', vacated_date: new Date().toISOString().split('T')[0] })
      .eq('id', id);
    setVacateId(null);
    fetchAssignments();
  }

  function copySQL() {
    navigator.clipboard.writeText(SQL_SETUP).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  // Rooms filtered by selected location in the form
  const roomsForLocation = form.location_id
    ? rooms.filter(r => r.location_id === form.location_id)
    : rooms;

  const filtered = assignments.filter(a => filterStatus === 'all' || a.status === filterStatus);

  function getLocationLabel(a: Assignment) {
    if (a.asset_rooms) {
      const bld = a.asset_rooms.asset_locations?.name;
      return bld ? `${bld} — ${a.asset_rooms.name}` : a.asset_rooms.name;
    }
    return a.room_label || '—';
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-text">Staff Accommodation</h1>
          <p className="text-sm text-app-text-muted mt-0.5">
            Assign staff to quarters, rooms, or offices.
            <span className="text-app-text-muted"> Buildings and rooms are managed under <strong>Inventory → Locations & Rooms</strong>.</span>
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus size={16} /> New Assignment
          </button>
        )}
      </div>

      {showSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle size={16} /> Table not found — run this SQL in Supabase SQL Editor first:
          </p>
          <pre className="bg-amber-100 rounded-xl p-3 text-xs overflow-x-auto text-amber-900 whitespace-pre-wrap">{SQL_SETUP}</pre>
          <div className="flex gap-3 mt-3">
            <button onClick={copySQL} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
              <Copy size={12} />{copied ? 'Copied!' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowSql(false)} className="text-amber-700 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {showMigration && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-red-800 mb-1 flex items-center gap-2">
            <AlertCircle size={16} /> Database schema needs updating
          </p>
          <p className="text-red-700 text-xs mb-2">
            Your <code>room_id</code> column still references an old table. The assignment was saved using the room name as a text label. Run the SQL below in the <strong>Supabase SQL Editor</strong> to fix this permanently — after that, room linking will work correctly.
          </p>
          <pre className="bg-red-100 rounded-xl p-3 text-xs overflow-x-auto text-red-900 whitespace-pre-wrap">{SQL_MIGRATE}</pre>
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => { navigator.clipboard.writeText(SQL_MIGRATE).then(() => { setCopiedMigration(true); setTimeout(() => setCopiedMigration(false), 2000); }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
            >
              <Copy size={12} />{copiedMigration ? 'Copied!' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowMigration(false)} className="text-red-700 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {/* No locations hint */}
      {!loading && locations.length === 0 && !showSql && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm flex items-start gap-3">
          <ExternalLink size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-800">No buildings/rooms set up yet.</p>
            <p className="text-blue-600 mt-0.5">Go to <strong>Inventory → Locations & Rooms</strong> to add your buildings and rooms first, then come back here to assign staff.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['active', 'vacated', 'all'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-app-text-muted self-center">{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-app-text-muted py-8">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center text-app-text-muted">
          <Home size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {filterStatus === 'all' ? '' : filterStatus} assignments found.</p>
          {isAdmin && <p className="text-xs mt-1">Click "New Assignment" to get started.</p>}
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                {['Staff Member', 'Type', 'Building / Room', 'Assigned', 'Status', 'Notes', isAdmin ? 'Action' : ''].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-app-text">
                      {a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : '—'}
                    </div>
                    <div className="text-xs text-app-text-muted capitalize">{a.profiles?.role?.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">{TYPE_LABELS[a.location_type] || a.location_type}</td>
                  <td className="px-4 py-3 text-app-text-muted">{getLocationLabel(a)}</td>
                  <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">{a.assigned_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[a.status] || 'bg-slate-100 text-app-text-muted'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted max-w-[160px] truncate">{a.notes || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {a.status === 'active' && (
                        <button onClick={() => setVacateId(a.id)}
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
                          <LogOut size={13} /> Vacate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New Assignment Modal ─────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Staff Accommodation Assignment">
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Staff Member *</label>
            <select className={ic} value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
              <option value="">Select staff member</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role?.replace(/_/g, ' ')})</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Location Type *</label>
            <select className={ic} value={form.location_type} onChange={e => setForm(f => ({ ...f, location_type: e.target.value }))}>
              <option value="staff_quarter">Staff Quarter / Accommodation</option>
              <option value="office">Office</option>
              <option value="other">Other</option>
            </select>
          </div>

          {locations.length > 0 ? (
            <>
              <div>
                <label className="text-xs text-app-text-muted mb-1 block">Building / Block</label>
                <select className={ic} value={form.location_id}
                  onChange={e => setForm(f => ({ ...f, location_id: e.target.value, room_id: '' }))}>
                  <option value="">— All buildings —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-app-text-muted mb-1 block">Room / Office</label>
                <select className={ic} value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value, room_label: '' }))}>
                  <option value="">— Select a room —</option>
                  {roomsForLocation.map(r => (
                    <option key={r.id} value={r.id}>
                      {form.location_id ? r.name : `${r.location_name ? r.location_name + ' — ' : ''}${r.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              No buildings/rooms found. Go to <strong>Inventory → Locations & Rooms</strong> to add them first.
            </div>
          )}

          <div>
            <label className="text-xs text-app-text-muted mb-1 block">
              Custom Label <span className="text-app-text-muted">{rooms.length > 0 ? '(use if not in the list above)' : '(enter location manually)'}</span>
            </label>
            <input className={ic} value={form.room_label}
              onChange={e => setForm(f => ({ ...f, room_label: e.target.value, room_id: e.target.value ? '' : f.room_id }))}
              placeholder="e.g. Block A Room 3, Principal's Office, Gate House" />
          </div>

          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Assigned Date *</label>
            <input type="date" className={ic} value={form.assigned_date} onChange={e => setForm(f => ({ ...f, assigned_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Notes</label>
            <textarea className={ic} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
          </div>

          {saveError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={13} />{saveError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Assignment'}
            </button>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-app-text rounded-xl text-sm font-medium">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── Vacate Confirm ──────────────────────────────────────── */}
      <Modal isOpen={!!vacateId} onClose={() => setVacateId(null)} title="Confirm Vacate">
        <div className="space-y-4 p-1">
          <p className="text-sm text-app-text-muted">Mark this staff accommodation assignment as vacated?</p>
          <div className="flex gap-3">
            <button onClick={() => vacate(vacateId!)}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600">
              Yes, Vacate
            </button>
            <button onClick={() => setVacateId(null)} className="px-4 py-2.5 bg-slate-100 text-app-text rounded-xl text-sm font-medium">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
