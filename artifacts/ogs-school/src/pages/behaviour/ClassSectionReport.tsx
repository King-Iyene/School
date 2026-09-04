import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Users, AlertTriangle, Shield, ShieldAlert, BookOpen } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  level: string;
  section: string;
}

interface StudentSummary {
  student_id: string;
  student_name: string;
  profile_id: string;
  total: number;
  minor: number;
  moderate: number;
  major: number;
  last_incident: string;
}

interface ClassSummary {
  class_id: string;
  class_name: string;
  total_incidents: number;
  students_affected: number;
  students: StudentSummary[];
}

export default function ClassSectionReport() {
  const { profile } = useAuth();
  if (!profile) return null;
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [filteredSummary, setFilteredSummary] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    fetchClasses();
    fetchAllClassSummaries();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, section')
      .eq('school_id', profile?.school_id || '')
      .order('name');
    if (data) setClasses(data);
  }

  async function fetchAllClassSummaries() {
    setLoading(true);
    const { data } = await supabase
      .from('student_behaviour_records')
      .select(`
        id, incident_date, student_id,
        incident:behaviour_incidents(severity),
        class:classes(id, name),
        student:students(id, first_name, last_name, admission_number)
      `)
      .eq('school_id', profile?.school_id || '');

    if (data) {
      const classMap: Record<string, ClassSummary> = {};
      data.forEach((r: any) => {
        const cls = Array.isArray(r.class) ? r.class[0] : r.class;
        const student = Array.isArray(r.student) ? r.student[0] : r.student;
        const incident = Array.isArray(r.incident) ? r.incident[0] : r.incident;

        const cid = cls?.id || 'unknown';
        const cname = cls?.name || 'Unknown Class';
        if (!classMap[cid]) {
          classMap[cid] = { class_id: cid, class_name: cname, total_incidents: 0, students_affected: 0, students: [] };
        }
        classMap[cid].total_incidents++;

        const sid = student?.id || r.student_id;
        let studentEntry = classMap[cid].students.find(s => s.profile_id === sid);
        if (!studentEntry) {
          studentEntry = {
            profile_id: sid,
            student_id: student?.admission_number || '—',
            student_name: student ? `${student.first_name} ${student.last_name}` : '—',
            total: 0, minor: 0, moderate: 0, major: 0,
            last_incident: r.incident_date,
          };
          classMap[cid].students.push(studentEntry);
        }
        studentEntry.total++;
        const sev = incident?.severity;
        if (sev === 'minor') studentEntry.minor++;
        else if (sev === 'moderate') studentEntry.moderate++;
        else if (sev === 'major') studentEntry.major++;
        if (new Date(r.incident_date) > new Date(studentEntry.last_incident)) {
          studentEntry.last_incident = r.incident_date;
        }
      });

      Object.values(classMap).forEach(c => {
        c.students_affected = c.students.length;
        c.students.sort((a, b) => b.total - a.total);
      });

      setClassSummaries(Object.values(classMap).sort((a, b) => b.total_incidents - a.total_incidents));
    }
    setLoading(false);
    setInitialLoad(false);
  }

  function handleClassFilter(classId: string) {
    setSelectedClass(classId);
    if (!classId) {
      setFilteredSummary(null);
      return;
    }
    const summary = classSummaries.find(c => c.class_id === classId) || null;
    setFilteredSummary(summary);
  }

  const displaySummaries = selectedClass ? (filteredSummary ? [filteredSummary] : []) : classSummaries;

  return (
    <div className="p-6 max-w-6xl mx-auto">


      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app-text">Class Behaviour Report</h1>
        <p className="text-sm text-app-text-muted mt-1">Behaviour incident summary organized by class</p>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5 mb-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Filter by Class</label>
            <select
              value={selectedClass}
              onChange={e => handleClassFilter(e.target.value)}
              className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary min-w-48"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchAllClassSummaries}
            disabled={loading}
            className="px-4 py-2 bg-app-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && initialLoad ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displaySummaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-app-text-muted bg-app-surface rounded-xl border border-app-border">
          <BookOpen size={40} className="mb-3 text-gray-300" />
          <p className="text-base font-medium">No incident data found</p>
          {selectedClass && <p className="text-sm mt-1">No incidents recorded for the selected class</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {displaySummaries.map(cls => (
            <div key={cls.class_id} className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
              <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <BookOpen size={18} className="text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-app-text">{cls.class_name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-700">{cls.total_incidents}</p>
                    <p className="text-xs text-app-text-muted">Total Incidents</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <Users size={16} className="text-app-text-muted" />
                      <p className="text-2xl font-bold text-app-text">{cls.students_affected}</p>
                    </div>
                    <p className="text-xs text-app-text-muted">Students Affected</p>
                  </div>
                </div>
              </div>

              {cls.students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-app-border">
                    <thead className="bg-app-surface-alt">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Student</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Total</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">
                          <span className="flex items-center gap-1 text-blue-600"><Shield size={12} /> Minor</span>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">
                          <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={12} /> Moderate</span>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">
                          <span className="flex items-center gap-1 text-red-600"><ShieldAlert size={12} /> Major</span>
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Last Incident</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                      {cls.students.map((s, idx) => (
                        <tr key={idx} className="hover:bg-app-surface-alt transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium text-app-text">{s.student_name}</p>
                            <p className="text-xs text-app-text-muted">{s.student_id}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">{s.total}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {s.minor > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{s.minor}</span>
                            ) : <span className="text-sm text-app-text-muted">—</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            {s.moderate > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{s.moderate}</span>
                            ) : <span className="text-sm text-app-text-muted">—</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            {s.major > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{s.major}</span>
                            ) : <span className="text-sm text-app-text-muted">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-app-text-muted">{new Date(s.last_incident).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-app-text-muted text-sm">No student incidents recorded for this class</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
