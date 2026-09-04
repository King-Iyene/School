import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, AlertTriangle, Shield, ShieldAlert, Clock, CheckCircle, ArrowUpCircle } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  level: string;
  section: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

interface IncidentType {
  id: string;
  name: string;
  severity: 'minor' | 'moderate' | 'major';
  points_deducted: number;
}

interface RecentRecord {
  id: string;
  incident_date: string;
  status: string;
  description: string;
  action_taken: string;
  student?: any;
  incident?: any;
  class?: any;
}

const defaultForm = {
  class_id: '',
  student_id: '',
  incident_id: '',
  incident_date: new Date().toISOString().slice(0, 10),
  description: '',
  action_taken: '',
  status: 'pending' as 'pending' | 'resolved' | 'escalated',
};

export default function AssignIncident() {
  const { profile } = useAuth();
  if (!profile) return null;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([]);
  const [form, setForm] = useState({ ...defaultForm });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchIncidentTypes();
    fetchRecentRecords();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, section')
      .eq('school_id', profile?.school_id || '')
      .order('name');
    if (data) setClasses(data);
  }

  async function fetchIncidentTypes() {
    const { data } = await supabase
      .from('behaviour_incidents')
      .select('id, name, severity, points_deducted')
      .eq('school_id', profile?.school_id || '')
      .order('name');
    if (data) setIncidentTypes(data);
  }

  async function fetchRecentRecords() {
    const { data } = await supabase
      .from('student_behaviour_records')
      .select(`
        id, incident_date, status, description, action_taken,
        student:students(first_name, last_name, admission_number),
        incident:behaviour_incidents(name, points_deducted, severity),
        class:classes(name, level, section)
      `)
      .eq('school_id', profile?.school_id || '')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRecentRecords(data as any);
  }

  async function handleClassChange(classId: string) {
    setForm(prev => ({ ...prev, class_id: classId, student_id: '' }));
    if (!classId) { setStudents([]); return; }
    if (!profile?.school_id) {
      setErrorMsg('Session error: No school ID found');
      return;
    }
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .eq('class_id', classId)
      .eq('school_id', profile?.school_id || '');
    
    if (data && data.length === 0) {}
    
    if (error) {
      setErrorMsg('Failed to load students for this class. ' + error.message);
    } else if (data) {
      if (data.length === 0) {
        setErrorMsg('No active students found for this class.');
      } else {
        setStudents(data);
      }
    }
    setLoadingStudents(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!form.class_id || !form.student_id || !form.incident_id || !form.incident_date) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);

    const selectedClass = classes.find(c => c.id === form.class_id);
    const { error } = await supabase.from('student_behaviour_records').insert({
      school_id: profile?.school_id || '',
      student_id: form.student_id,
      incident_id: form.incident_id,
      class_id: form.class_id,
      assigned_by: profile?.id || '',
      incident_date: form.incident_date,
      description: form.description,
      action_taken: form.action_taken,
      status: form.status,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('Incident assigned successfully.');
      setForm({ ...defaultForm });
      setStudents([]);
      fetchRecentRecords();
    }
    setSubmitting(false);
  }

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
    <div className="p-6 max-w-4xl mx-auto">


      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app-text">Assign Behaviour Incident</h1>
        <p className="text-sm text-app-text-muted mt-1">Record a behaviour incident for a student</p>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-6 mb-8">
        {successMsg && (
          <div className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class <span className="text-red-500">*</span></label>
              <select
                value={form.class_id}
                onChange={e => handleClassChange(e.target.value)}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Student <span className="text-red-500">*</span></label>
              <select
                value={form.student_id}
                onChange={e => setForm(prev => ({ ...prev, student_id: e.target.value }))}
                disabled={!form.class_id || loadingStudents}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-app-surface-alt disabled:text-app-text-muted"
              >
                <option value="">{loadingStudents ? 'Loading...' : 'Select Student'}</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Incident Type <span className="text-red-500">*</span></label>
              <select
                value={form.incident_id}
                onChange={e => setForm(prev => ({ ...prev, incident_id: e.target.value }))}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Incident Type</option>
                {incidentTypes.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.severity})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Incident Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.incident_date}
                onChange={e => setForm(prev => ({ ...prev, incident_date: e.target.value }))}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description of Incident</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Describe what happened..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Action Taken</label>
            <textarea
              value={form.action_taken}
              onChange={e => setForm(prev => ({ ...prev, action_taken: e.target.value }))}
              rows={2}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Describe the action taken..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-60"
            >
              <UserPlus size={16} />
              {submitting ? 'Assigning...' : 'Assign Incident'}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-app-text mb-4">Recent Incidents</h2>
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          {recentRecords.length === 0 ? (
            <div className="text-center py-10 text-app-text-muted text-sm">No recent incident records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-app-border">
                <thead className="bg-app-surface-alt">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Class</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Incident</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-app-text-muted uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {recentRecords.map(record => {
                    const student = Array.isArray(record.student) ? record.student[0] : record.student;
                    const incident = Array.isArray(record.incident) ? record.incident[0] : record.incident;
                    const cls = Array.isArray(record.class) ? record.class[0] : record.class;

                    return (
                      <tr key={record.id} className="hover:bg-app-surface-alt transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-app-text">
                          {student ? `${student.first_name} ${student.last_name}` : '—'}
                          {student?.admission_number && <span className="block text-xs text-app-text-muted">{student.admission_number}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-app-text-muted">{cls?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-app-text">{incident?.name || '—'}</td>
                        <td className="px-4 py-3">{incident ? severityBadge(incident.severity) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-app-text-muted">{new Date(record.incident_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{statusBadge(record.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
