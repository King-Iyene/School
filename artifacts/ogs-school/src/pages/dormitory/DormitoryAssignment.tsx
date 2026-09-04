import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Filter, X, BedDouble, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface DormitoryAssignment {
  id: string;
  student_id: string;
  room_id: string;
  academic_year_id: string;
  check_in_date: string;
  check_out_date: string | null;
  status: string;
  students?: { first_name: string; last_name: string; admission_number: string };
  dormitory_rooms?: { room_no: string; room_type: string };
}

interface RoomOption {
  id: string;
  room_no: string;
  capacity: number;
  room_type: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  vacated: 'bg-slate-100 text-app-text-muted',
  transferred: 'bg-blue-100 text-blue-700',
};

const STATUSES = ['active', 'vacated', 'transferred'];

export default function DormitoryAssignment() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<DormitoryAssignment[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filterRoom, setFilterRoom] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [form, setForm] = useState({
    student_id: '',
    room_id: '',
    academic_year_id: '',
    check_in_date: '',
  });

  useEffect(() => {
    fetchRooms();
    fetchAcademicYears();
    fetchProfiles();
    fetchAssignments();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [filterRoom, filterStatus]);

  async function fetchRooms() {
    const { data } = await supabase
      .from('dormitory_rooms')
      .select('id, room_no, capacity, room_type')
      .eq('is_active', true)
      .order('room_no');
    if (data) setRooms(data as RoomOption[]);
  }

  async function fetchAcademicYears() {
    const { data } = await supabase.from('academic_years').select('id, name').order('name');
    if (data) setAcademicYears(data);
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('status', 'active')
      .order('last_name');
    if (data) {
      setProfiles(data.map(s => ({
        id: s.id,
        full_name: `${s.first_name} ${s.last_name} (${s.admission_number || ''})`
      })));
    }
  }

  async function fetchAssignments() {
    setLoading(true);
    let query = supabase
      .from('dormitory_assignments')
      .select('*, students(first_name, last_name, admission_number), dormitory_rooms(room_no, room_type)')
      .order('check_in_date', { ascending: false });
    if (filterRoom) query = query.eq('room_id', filterRoom);
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data } = await query;
    if (data) setAssignments(data as DormitoryAssignment[]);
    setLoading(false);
  }

  function openAdd() {
    setStudentSearch('');
    setSaveError('');
    setForm({
      student_id: '',
      room_id: '',
      academic_year_id: academicYears[0]?.id || '',
      check_in_date: new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await supabase.from('dormitory_assignments').insert([{
      student_id: form.student_id,
      room_id: form.room_id,
      academic_year_id: form.academic_year_id || null,
      check_in_date: form.check_in_date,
      status: 'active',
    }]);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchAssignments();
  }

  async function handleVacate(id: string) {
    if (!confirm('Mark this student as vacated?')) return;
    await supabase
      .from('dormitory_assignments')
      .update({
        status: 'vacated',
        check_out_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', id);
    fetchAssignments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this assignment?')) return;
    await supabase.from('dormitory_assignments').delete().eq('id', id);
    fetchAssignments();
  }

  const filteredProfiles = studentSearch
    ? profiles.filter(p => p.full_name?.toLowerCase().includes(studentSearch.toLowerCase()))
    : profiles;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-app-primary text-white p-2 rounded-xl">
            <BedDouble size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Dormitory Assignments</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Assignment
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-app-text-muted" />
          <span className="text-sm font-medium text-app-text-muted">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterRoom}
            onChange={e => setFilterRoom(e.target.value)}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">All Rooms</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.room_no}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {(filterRoom || filterStatus) && (
            <button
              onClick={() => { setFilterRoom(''); setFilterStatus(''); }}
              className="flex items-center gap-1 text-sm text-app-text-muted hover:text-app-text"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <BedDouble size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No dormitory assignments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Student</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Room</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Check-in</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Check-out</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">
                      {a.students ? `${a.students.first_name} ${a.students.last_name}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.dormitory_rooms ? (
                        <span>
                          {a.dormitory_rooms.room_no}{' '}
                          <span className="text-app-text-muted text-xs">({a.dormitory_rooms.room_type})</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.check_in_date ? new Date(a.check_in_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {a.check_out_date ? new Date(a.check_out_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-slate-100 text-app-text'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.status === 'active' && (
                          <button
                            onClick={() => handleVacate(a.id)}
                            title="Vacate"
                            className="text-app-text-muted hover:text-orange-600 p-1 rounded-lg hover:bg-orange-50 transition-colors"
                          >
                            <LogOut size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(a.id)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Dormitory Assignment">
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Search Student</label>
            <input
              className={INPUT_CLASS}
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Type student name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Student</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.student_id}
              onChange={e => setForm(p => ({ ...p, student_id: e.target.value }))}
            >
              <option value="">Select Student</option>
              {filteredProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Room</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.room_id}
              onChange={e => setForm(p => ({ ...p, room_id: e.target.value }))}
            >
              <option value="">Select Room</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.room_no} - {r.room_type} (cap: {r.capacity})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Academic Year</label>
            <select
              className={INPUT_CLASS}
              value={form.academic_year_id}
              onChange={e => setForm(p => ({ ...p, academic_year_id: e.target.value }))}
            >
              <option value="">Select Year</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Check-in Date</label>
            <input
              required
              type="date"
              className={INPUT_CLASS}
              value={form.check_in_date}
              onChange={e => setForm(p => ({ ...p, check_in_date: e.target.value }))}
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
              {saving ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
