import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarChart2, AlertTriangle, Clock, CheckCircle, ArrowUpCircle, Shield, ShieldAlert, FileBarChart } from 'lucide-react';

interface SummaryStats {
  total: number;
  pending: number;
  resolved: number;
  escalated: number;
  minor: number;
  moderate: number;
  major: number;
}

interface StudentRow {
  student_id: string;
  student_name: string;
  class_name: string;
  incident_count: number;
  last_incident: string;
  latest_status: string;
}

export default function BehaviourReport() {
  const { profile } = useAuth();
  if (!profile) return null;
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState<SummaryStats>({ total: 0, pending: 0, resolved: 0, escalated: 0, minor: 0, moderate: 0, major: 0 });
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, []);

  async function fetchReport() {
    setLoading(true);
    const { data } = await supabase
      .from('student_behaviour_records')
      .select(`
        id, incident_date, status,
        student:students(id, first_name, last_name, admission_number),
        incident:behaviour_incidents(severity),
        class:classes(name)
      `)
      .eq('school_id', profile?.school_id || '')
      .gte('incident_date', dateFrom)
      .lte('incident_date', dateTo);

    if (!data) { setLoading(false); return; }

    const newStats: SummaryStats = { total: data.length, pending: 0, resolved: 0, escalated: 0, minor: 0, moderate: 0, major: 0 };
    const studentMap: Record<string, StudentRow> = {};

    data.forEach((r: any) => {
      if (r.status === 'pending') newStats.pending++;
      else if (r.status === 'resolved') newStats.resolved++;
      else if (r.status === 'escalated') newStats.escalated++;

      const incident = Array.isArray(r.incident) ? r.incident[0] : r.incident;
      const student = Array.isArray(r.student) ? r.student[0] : r.student;
      const cls = Array.isArray(r.class) ? r.class[0] : r.class;

      const severity = incident?.severity;
      if (severity === 'minor') newStats.minor++;
      else if (severity === 'moderate') newStats.moderate++;
      else if (severity === 'major') newStats.major++;

      const sid = student?.id || 'unknown';
      if (!studentMap[sid]) {
        studentMap[sid] = {
          student_id: student?.admission_number || '—',
          student_name: student ? `${student.first_name} ${student.last_name}` : '—',
          class_name: cls?.name || '—',
          incident_count: 0,
          last_incident: r.incident_date,
          latest_status: r.status,
        };
      }
      studentMap[sid].incident_count++;
      if (new Date(r.incident_date) > new Date(studentMap[sid].last_incident)) {
        studentMap[sid].last_incident = r.incident_date;
        studentMap[sid].latest_status = r.status;
      }
    });

    setStats(newStats);
    setStudentRows(Object.values(studentMap).sort((a, b) => b.incident_count - a.incident_count));
    setLoading(false);
  }

  const maxSeverity = Math.max(stats.minor, stats.moderate, stats.major, 1);

  function statusBadge(status: string) {
    if (status === 'pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={10} /> Pending</span>;
    if (status === 'resolved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={10} /> Resolved</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ArrowUpCircle size={10} /> Escalated</span>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-app-text">Behaviour Report</h2>
        <p className="text-sm text-app-text-muted hidden sm:block">Overview of behaviour incidents across the school</p>
      </div>

      <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-app-text mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-app-text mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg"><FileBarChart size={16} className="text-emerald-600" /></div>
                <span className="text-xs font-medium text-app-text-muted">Total Incidents</span>
              </div>
              <p className="text-3xl font-bold text-app-text">{stats.total}</p>
            </div>
            <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-amber-100 rounded-lg"><Clock size={16} className="text-amber-600" /></div>
                <span className="text-xs font-medium text-app-text-muted">Pending</span>
              </div>
              <p className="text-3xl font-bold text-amber-700">{stats.pending}</p>
            </div>
            <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg"><CheckCircle size={16} className="text-emerald-600" /></div>
                <span className="text-xs font-medium text-app-text-muted">Resolved</span>
              </div>
              <p className="text-3xl font-bold text-emerald-700">{stats.resolved}</p>
            </div>
            <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-100 rounded-lg"><ArrowUpCircle size={16} className="text-red-600" /></div>
                <span className="text-xs font-medium text-app-text-muted">Escalated</span>
              </div>
              <p className="text-3xl font-bold text-red-700">{stats.escalated}</p>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border p-5">
            <h3 className="text-base font-semibold text-app-text mb-4 flex items-center gap-2">
              <BarChart2 size={18} className="text-emerald-600" /> Incidents by Severity
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-20 flex items-center gap-1 text-xs text-blue-700 font-medium shrink-0">
                  <Shield size={12} /> Minor
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${(stats.minor / maxSeverity) * 100}%` }}
                  >
                    {stats.minor > 0 && <span className="text-xs text-white font-medium">{stats.minor}</span>}
                  </div>
                </div>
                <span className="w-7 text-right text-sm text-app-text-muted font-medium shrink-0">{stats.minor}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 flex items-center gap-1 text-xs text-amber-700 font-medium shrink-0">
                  <AlertTriangle size={12} /> Moderate
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${(stats.moderate / maxSeverity) * 100}%` }}
                  >
                    {stats.moderate > 0 && <span className="text-xs text-white font-medium">{stats.moderate}</span>}
                  </div>
                </div>
                <span className="w-7 text-right text-sm text-app-text-muted font-medium shrink-0">{stats.moderate}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 flex items-center gap-1 text-xs text-red-700 font-medium shrink-0">
                  <ShieldAlert size={12} /> Major
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${(stats.major / maxSeverity) * 100}%` }}
                  >
                    {stats.major > 0 && <span className="text-xs text-white font-medium">{stats.major}</span>}
                  </div>
                </div>
                <span className="w-7 text-right text-sm text-app-text-muted font-medium shrink-0">{stats.major}</span>
              </div>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border">
              <h3 className="text-base font-semibold text-app-text">Student Incident Summary</h3>
            </div>
            {studentRows.length === 0 ? (
              <div className="text-center py-12 text-app-text-muted">
                <FileBarChart size={36} className="mx-auto mb-2 text-slate-300" />
                <p>No incident data for the selected date range</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-app-border min-w-[480px]">
                  <thead className="bg-app-surface-alt">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Student</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Class</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Incidents</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Last Incident</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-app-text-muted uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {studentRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-app-surface-alt transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-app-text">{row.student_name}</p>
                          <p className="text-xs text-app-text-muted">{row.student_id}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-app-text-muted">{row.class_name}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            {row.incident_count}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-app-text-muted">{new Date(row.last_incident).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">{statusBadge(row.latest_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
