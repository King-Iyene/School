import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, Shield, ShieldAlert, ChevronDown, ChevronUp, Users, BarChart2 } from 'lucide-react';

interface IncidentTypeSummary {
  id: string;
  name: string;
  severity: 'minor' | 'moderate' | 'major';
  points_deducted: number;
  count: number;
  affected_students: number;
  students: StudentAssigned[];
}

interface StudentAssigned {
  profile_id: string;
  student_name: string;
  student_id: string;
  class_name: string;
  incident_date: string;
  status: string;
}

export default function IncidentWiseReport() {
  const { profile } = useAuth();
  if (!profile) return null;
  const [incidentSummaries, setIncidentSummaries] = useState<IncidentTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  async function fetchReport() {
    setLoading(true);
    const { data: incidentTypes } = await supabase
      .from('behaviour_incidents')
      .select('id, name, severity, points_deducted')
      .eq('school_id', profile?.school_id || '');

    const { data: records } = await supabase
      .from('student_behaviour_records')
      .select(`
        id, incident_id, incident_date, status, student_id,
        student:students(id, first_name, last_name, admission_number),
        class:classes(name)
      `)
      .eq('school_id', profile?.school_id || '');
    
    if (!profile?.school_id || !incidentTypes || !records) { setLoading(false); return; }

    const summaries: IncidentTypeSummary[] = incidentTypes.map(itype => {
      const typeRecords = records.filter((r: any) => r.incident_id === itype.id);
      const studentSet = new Set<string>();
      const students: StudentAssigned[] = [];

      typeRecords.forEach((r: any) => {
        const student = Array.isArray(r.student) ? r.student[0] : r.student;
        const cls = Array.isArray(r.class) ? r.class[0] : r.class;

        const sid = student?.id || r.student_id;
        studentSet.add(sid);
        students.push({
          profile_id: sid,
          student_name: student ? `${student.first_name} ${student.last_name}` : '—',
          student_id: student?.admission_number || '—',
          class_name: cls?.name || '—',
          incident_date: r.incident_date,
          status: r.status,
        });
      });

      return {
        id: itype.id,
        name: itype.name,
        severity: itype.severity,
        points_deducted: itype.points_deducted,
        count: typeRecords.length,
        affected_students: studentSet.size,
        students: students.sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime()),
      };
    });

    setIncidentSummaries(summaries.sort((a, b) => b.count - a.count));
    setLoading(false);
  }

  const maxCount = Math.max(...incidentSummaries.map(i => i.count), 1);

  function severityBadge(severity: string) {
    if (severity === 'minor') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Shield size={11} /> Minor</span>;
    if (severity === 'moderate') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><AlertTriangle size={11} /> Moderate</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ShieldAlert size={11} /> Major</span>;
  }

  function barColor(severity: string) {
    if (severity === 'minor') return 'bg-blue-400';
    if (severity === 'moderate') return 'bg-amber-400';
    return 'bg-red-400';
  }

  function statusDot(status: string) {
    if (status === 'pending') return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />;
    if (status === 'resolved') return <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />;
    return <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">


      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Incident Type Report</h1>
        <p className="text-sm text-gray-500 mt-1">View occurrence statistics for each behaviour incident type</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : incidentSummaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <BarChart2 size={40} className="mb-3 text-gray-300" />
          <p className="text-base font-medium">No incident types defined</p>
          <p className="text-sm mt-1">Add incident types in the Incident Types management page</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <BarChart2 size={18} className="text-emerald-600" /> Most Common Incidents
            </h2>
            <div className="space-y-3">
              {incidentSummaries.map(incident => (
                <div key={incident.id} className="flex items-center gap-4">
                  <div className="w-40 text-sm text-gray-700 font-medium truncate" title={incident.name}>{incident.name}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                    <div
                      className={`h-full ${barColor(incident.severity)} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                      style={{ width: `${Math.max((incident.count / maxCount) * 100, incident.count > 0 ? 5 : 0)}%` }}
                    >
                      {incident.count > 0 && <span className="text-xs text-white font-semibold">{incident.count}</span>}
                    </div>
                  </div>
                  <div className="w-16 text-right">{severityBadge(incident.severity)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {incidentSummaries.map(incident => (
              <div key={incident.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">{severityBadge(incident.severity)}</div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">{incident.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{incident.points_deducted} points deducted per incident</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xl font-bold text-emerald-700">{incident.count}</p>
                      <p className="text-xs text-gray-500">Occurrences</p>
                    </div>
                    <div className="text-center flex items-center gap-1">
                      <Users size={14} className="text-gray-400" />
                      <div>
                        <p className="text-xl font-bold text-gray-700">{incident.affected_students}</p>
                        <p className="text-xs text-gray-500">Students</p>
                      </div>
                    </div>
                    <div className="text-gray-400">
                      {expandedId === incident.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </button>

                {expandedId === incident.id && (
                  <div className="border-t border-gray-100">
                    {incident.students.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No students assigned to this incident type</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Incident Date</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {incident.students.map((s, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3.5">
                                  <p className="text-sm font-medium text-gray-800">{s.student_name}</p>
                                  <p className="text-xs text-gray-400">{s.student_id}</p>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-gray-600">{s.class_name}</td>
                                <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(s.incident_date).toLocaleDateString()}</td>
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                    {statusDot(s.status)}
                                    <span className="capitalize">{s.status}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
