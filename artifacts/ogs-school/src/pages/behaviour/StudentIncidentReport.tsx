import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Search, User, AlertTriangle, Shield, ShieldAlert, Clock, CheckCircle, ArrowUpCircle, FileText } from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';

interface ClassItem {
  id: string;
  name: string;
  section: string;
}

interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  role?: string;
}

interface IncidentRecord {
  id: string;
  incident_date: string;
  description: string;
  action_taken: string;
  status: string;
  incident?: any;
  class?: any;
  assigned_by_profile?: any;
}

export default function StudentIncidentReport() {
  const { profile } = useAuth();
  if (!profile) return null;

  const [searchMode, setSearchMode] = useState<'search' | 'class'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentProfile[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classStudents, setClassStudents] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', profile?.school_id || '')
      .order('name');
    if (data) setClasses(data);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    setSearched(true);
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('school_id', profile?.school_id || '')
      .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`)
      .limit(20);
    if (data) setSearchResults(data);
    setLoadingSearch(false);
  }

  async function handleClassChange(classId: string) {
    setSelectedClass(classId);
    setSelectedStudent(null);
    setRecords([]);
    if (!classId) { setClassStudents([]); return; }
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('class_id', classId)
      .eq('school_id', profile?.school_id || '');
    
    if (error) {
      console.error('Error fetching class students:', error);
    } else if (data) {
      setClassStudents(data);
    }
  }

  async function selectStudent(student: StudentProfile) {
    setSelectedStudent(student);
    setLoadingRecords(true);
    const { data } = await supabase
      .from('student_behaviour_records')
      .select(`
        id, incident_date, description, action_taken, status,
        incident:behaviour_incidents(name, severity, points_deducted),
        class:classes(name),
        assigned_by_profile:profiles(first_name, last_name)
      `)
      .eq('school_id', profile?.school_id || '')
      .eq('student_id', student.id)
      .order('incident_date', { ascending: false });
    if (data) setRecords(data as any);
    setLoadingRecords(false);
  }

  const totalIncidents = records.length;
  const minorCount = records.filter(r => r.incident?.severity === 'minor').length;
  const moderateCount = records.filter(r => r.incident?.severity === 'moderate').length;
  const majorCount = records.filter(r => r.incident?.severity === 'major').length;
  const totalPoints = records.reduce((sum, r) => sum + (r.incident?.points_deducted || 0), 0);

  function severityBadge(severity: string) {
    if (severity === 'minor') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Shield size={10} /> Minor</span>;
    if (severity === 'moderate') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><AlertTriangle size={10} /> Moderate</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ShieldAlert size={10} /> Major</span>;
  }

  function statusBadge(status: string) {
    if (status === 'pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={10} /> Pending</span>;
    if (status === 'resolved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={10} /> Resolved</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ArrowUpCircle size={10} /> Escalated</span>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-app-text">Student Incident Report</h2>
        <p className="text-sm text-app-text-muted hidden sm:block">View behaviour incident history for individual students</p>
      </div>

      <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-5">
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setSearchMode('search'); setSelectedStudent(null); setRecords([]); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${searchMode === 'search' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}
          >
            Search
          </button>
          <button
            onClick={() => { setSearchMode('class'); setSelectedStudent(null); setRecords([]); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${searchMode === 'class' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-app-text-muted hover:bg-slate-200'}`}
          >
            By Class
          </button>
        </div>

        {searchMode === 'search' ? (
          <div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name or admission number..."
                  className="bg-app-surface text-app-text w-full pl-9 pr-3 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loadingSearch}
                className="px-4 py-2 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {loadingSearch ? '...' : 'Search'}
              </button>
            </div>
            {searched && searchResults.length === 0 && (
              <p className="text-sm text-app-text-muted text-center py-4">No students found matching your search</p>
            )}
            {searchResults.length > 0 && (
              <div className="border border-app-border rounded-xl divide-y divide-app-border max-h-56 overflow-y-auto">
                {searchResults.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left ${selectedStudent?.id === s.id ? 'bg-emerald-50' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-app-text">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-app-text-muted">ID: {s.admission_number}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Select Class</label>
              <select
                value={selectedClass}
                onChange={e => handleClassChange(e.target.value)}
                className="w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface"
              >
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Select Student</label>
              <select
                value={selectedStudent?.id || ''}
                onChange={e => {
                  const s = classStudents.find(s => s.id === e.target.value);
                  if (s) selectStudent(s);
                }}
                disabled={!selectedClass}
                className="w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface disabled:bg-app-surface-alt disabled:text-app-text-muted"
              >
                <option value="">-- Choose Student --</option>
                {classStudents.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {selectedStudent && (
        <>
          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-app-text">{selectedStudent.first_name} {selectedStudent.last_name}</h3>
                <p className="text-sm text-app-text-muted">Admission No: {selectedStudent.admission_number}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-app-surface-alt rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-app-text">{totalIncidents}</p>
                <p className="text-xs text-app-text-muted mt-0.5">Total</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{minorCount}</p>
                <p className="text-xs text-blue-500 mt-0.5">Minor</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{moderateCount}</p>
                <p className="text-xs text-amber-500 mt-0.5">Moderate</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{majorCount}</p>
                <p className="text-xs text-red-500 mt-0.5">Major</p>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">{totalPoints}</p>
                <p className="text-xs text-orange-500 mt-0.5">Points Deducted</p>
              </div>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border">
              <h3 className="text-base font-semibold text-app-text flex items-center gap-2"><FileText size={16} className="text-emerald-600" /> Incident History</h3>
            </div>
            {loadingRecords ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-app-text-muted">
                <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                <p>No incidents recorded for this student</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-app-border min-w-[600px]">
                  <thead className="bg-app-surface-alt">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Incident Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Severity</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Action Taken</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Assigned By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {records.map(record => {
                      const incident = Array.isArray(record.incident) ? record.incident[0] : record.incident;
                      const assigner = Array.isArray(record.assigned_by_profile) ? record.assigned_by_profile[0] : record.assigned_by_profile;

                      return (
                        <tr key={record.id} className="hover:bg-app-surface-alt transition-colors">
                          <td className="px-5 py-3.5 text-sm text-app-text">{new Date(record.incident_date).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 text-sm font-medium text-app-text">{incident?.name || '—'}</td>
                          <td className="px-5 py-3.5">{incident ? severityBadge(incident.severity) : '—'}</td>
                          <td className="px-5 py-3.5 text-sm text-app-text-muted max-w-xs truncate">{record.description || record.action_taken || '—'}</td>
                          <td className="px-5 py-3.5">{statusBadge(record.status)}</td>
                          <td className="px-5 py-3.5 text-sm text-app-text-muted">
                            {assigner ? `${assigner.first_name} ${assigner.last_name}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedStudent && (
        <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
          <User size={48} className="mb-3 text-slate-300" />
          <p className="text-base font-medium">Select a student to view their incident report</p>
          <p className="text-sm mt-1">Use the search or class browser above</p>
        </div>
      )}
    </div>
  );
}
