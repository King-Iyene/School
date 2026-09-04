import { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, UserPlus, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  class_name: string;
  section_name: string;
  gender: string;
  date_of_birth: string;
  guardian_name: string;
  guardian_phone: string;
  status: string;
  created_at: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

export default function StudentReport() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    class_id: '',
    section_id: '',
    gender: '',
    status: '',
  });

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [filters]);

  useEffect(() => {
    if (filters.class_id) {
      fetchSections(filters.class_id);
    } else {
      setSections([]);
      setFilters(f => ({ ...f, section_id: '' }));
    }
  }, [filters.class_id]);

  async function fetchFiltersData() {
    const [yearsRes, classesRes] = await Promise.all([
      supabase.from('academic_years').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('classes').select('id, name').eq('school_id', profile?.school_id).order('name'),
    ]);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
    if (classesRes.data) setClasses(classesRes.data);
  }

  async function fetchSections(classId: string) {
    const { data } = await supabase
      .from('sections')
      .select('id, name, class_id')
      .eq('class_id', classId)
      .order('name');
    if (data) setSections(data);
  }

  async function fetchStudents() {
    setLoading(true);
    let query = supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id, classes(name), gender, date_of_birth, guardian_name, guardian_phone, status, created_at')
      .eq('school_id', profile?.school_id)
      .order('first_name');

    if (filters.gender) query = query.eq('gender', filters.gender);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    const { data } = await query;
    setStudents(data || []);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const currentYear = new Date().getFullYear();
  const newAdmissions = students.filter(s => new Date(s.created_at).getFullYear() === currentYear).length;
  const maleCount = students.filter(s => s.gender?.toLowerCase() === 'male').length;
  const femaleCount = students.filter(s => s.gender?.toLowerCase() === 'female').length;

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">Student Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            value={filters.class_id}
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value, section_id: '' }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.section_id}
            onChange={e => setFilters(f => ({ ...f, section_id: e.target.value }))}
            disabled={!filters.class_id}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">All Sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={filters.gender}
            onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>

          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Students</p>
              <p className="text-2xl font-bold text-app-text mt-1">{students.length}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Male</p>
              <p className="text-2xl font-bold text-app-text mt-1">{maleCount}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <UserCheck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Female</p>
              <p className="text-2xl font-bold text-app-text mt-1">{femaleCount}</p>
            </div>
            <div className="bg-pink-100 p-3 rounded-lg">
              <UserX className="h-6 w-6 text-pink-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">New Admissions</p>
              <p className="text-2xl font-bold text-app-text mt-1">{newAdmissions}</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <UserPlus className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">#</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Admission No</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Section</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Gender</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">DOB</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Guardian</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-app-text-muted">No students found</td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{student.first_name} {student.last_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{student.admission_number || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{student.classes?.name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">-</td>
                    <td className="px-4 py-3 text-app-text-muted capitalize">{student.gender || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{student.guardian_name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{student.guardian_phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {student.status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
