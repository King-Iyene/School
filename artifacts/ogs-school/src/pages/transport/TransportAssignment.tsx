import React, { useState, useEffect } from 'react';
import { Filter, X, MapPin, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface ClassOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  name: string;
  class_id: string;
}

interface AcademicYearOption {
  id: string;
  name: string;
}

interface RouteOption {
  id: string;
  route_name: string;
}

interface VehicleOption {
  id: string;
  vehicle_no: string;
  route_id: string;
}

interface Enrollment {
  id: string;
  student_id: string;
  students?: { 
    first_name: string; 
    last_name: string; 
    admission_number: string;
  };
  transport_assignments?: TransportAssignmentRecord[];
}

interface TransportAssignmentRecord {
  id: string;
  student_id: string;
  academic_year_id: string;
  route_id: string;
  vehicle_id: string;
  stop_name: string;
  fare: number;
  transport_routes?: { route_name: string };
  transport_vehicles?: { vehicle_no: string };
}

export default function TransportAssignment() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [form, setForm] = useState({
    route_id: '',
    vehicle_id: '',
    stop_name: '',
    fare: '',
    academic_year_id: '',
  });

  useEffect(() => {
    fetchClasses();
    fetchSections();
    fetchAcademicYears();
    fetchRoutes();
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (filterClass || filterSection) {
      fetchEnrollments();
    } else {
      setEnrollments([]);
    }
  }, [filterClass, filterSection]);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    if (data) setClasses(data);
  }

  async function fetchSections() {
    const { data } = await supabase.from('sections').select('id, name, class_id').order('name');
    if (data) setSections(data);
  }

  async function fetchAcademicYears() {
    const { data } = await supabase.from('academic_years').select('id, name').order('name');
    if (data) setAcademicYears(data);
  }

  async function fetchRoutes() {
    const { data } = await supabase
      .from('transport_routes')
      .select('id, route_name')
      .eq('is_active', true)
      .order('route_name');
    if (data) setRoutes(data);
  }

  async function fetchVehicles() {
    const { data } = await supabase
      .from('transport_vehicles')
      .select('id, vehicle_no, route_id')
      .eq('is_active', true)
      .order('vehicle_no');
    if (data) setVehicles(data);
  }

  async function fetchEnrollments() {
    setLoading(true);
    let query = supabase
      .from('student_enrollments')
      .select(`
        id,
        student_id,
        students!student_id(first_name, last_name, admission_number),
        transport_assignments(
          id,
          student_id,
          academic_year_id,
          route_id,
          vehicle_id,
          stop_name,
          fare,
          transport_routes(route_name),
          transport_vehicles(vehicle_no)
        )
      `);
    if (filterClass) query = query.eq('class_id', filterClass);
    if (filterSection) query = query.eq('section_id', filterSection);
    const { data } = await query;
    if (data) setEnrollments(data as Enrollment[]);
    setLoading(false);
  }

  function openAssignModal(enrollment: Enrollment) {
    const student = enrollment.students as any;
    setSelectedStudentId(enrollment.student_id);
    setSelectedStudentName(student ? `${student.first_name} ${student.last_name}` : 'Student');
    const existing = enrollment.transport_assignments?.[0];
    setForm({
      route_id: existing?.route_id || '',
      vehicle_id: existing?.vehicle_id || '',
      stop_name: existing?.stop_name || '',
      fare: existing?.fare != null ? String(existing.fare) : '',
      academic_year_id: existing?.academic_year_id || (academicYears[0]?.id || ''),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) return;
    setSaving(true);
    await supabase.from('transport_assignments').upsert(
      {
        student_id: selectedStudentId,
        academic_year_id: form.academic_year_id,
        route_id: form.route_id || null,
        vehicle_id: form.vehicle_id || null,
        stop_name: form.stop_name,
        fare: form.fare !== '' ? Number(form.fare) : null,
      },
      { onConflict: 'student_id,academic_year_id' }
    );
    setSaving(false);
    setModalOpen(false);
    fetchEnrollments();
  }

  const filteredSections = filterClass
    ? sections.filter(s => s.class_id === filterClass)
    : sections;

  const filteredVehicles = form.route_id
    ? vehicles.filter(v => v.route_id === form.route_id)
    : vehicles;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-app-primary text-white p-2 rounded-xl">
          <MapPin size={20} />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Transport Assignment</h1>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-app-text-muted" />
          <span className="text-sm font-medium text-app-text-muted">Filter Students</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">All Sections</option>
            {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {(filterClass || filterSection) && (
            <button
              onClick={() => { setFilterClass(''); setFilterSection(''); }}
              className="flex items-center gap-1 text-sm text-app-text-muted hover:text-app-text"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {!filterClass && !filterSection ? (
          <div className="p-12 text-center">
            <MapPin size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">Select a class or section to view students.</p>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : enrollments.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No students found for the selected class/section.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Route</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Vehicle</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Stop</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Fare</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {enrollments.map(enr => {
                  const assignment = enr.transport_assignments?.[0];
                  return (
                    <tr key={enr.id} className="hover:bg-app-surface-alt/50">
                      <td className="px-4 py-3 font-medium text-app-text">
                        {enr.students ? `${enr.students.first_name} ${enr.students.last_name}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {assignment?.transport_routes?.route_name || (
                          <span className="text-app-text-muted text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {assignment?.transport_vehicles?.vehicle_no || '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">{assignment?.stop_name || '-'}</td>
                      <td className="px-4 py-3 text-app-text">
                        {assignment?.fare != null ? `₦${Number(assignment.fare).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openAssignModal(enr)}
                          className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-medium px-2 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={12} />
                          {assignment ? 'Change' : 'Assign'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Assign Transport - ${selectedStudentName}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Academic Year</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.academic_year_id}
              onChange={e => setForm(p => ({ ...p, academic_year_id: e.target.value }))}
            >
              <option value="">Select Year</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Route</label>
            <select
              className={INPUT_CLASS}
              value={form.route_id}
              onChange={e => setForm(p => ({ ...p, route_id: e.target.value, vehicle_id: '' }))}
            >
              <option value="">Select Route</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Vehicle</label>
            <select
              className={INPUT_CLASS}
              value={form.vehicle_id}
              onChange={e => setForm(p => ({ ...p, vehicle_id: e.target.value }))}
            >
              <option value="">Select Vehicle</option>
              {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Stop Name</label>
              <input
                className={INPUT_CLASS}
                value={form.stop_name}
                onChange={e => setForm(p => ({ ...p, stop_name: e.target.value }))}
                placeholder="Bus stop name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Fare (₦)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={INPUT_CLASS}
                value={form.fare}
                onChange={e => setForm(p => ({ ...p, fare: e.target.value }))}
                placeholder="0.00"
              />
            </div>
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
