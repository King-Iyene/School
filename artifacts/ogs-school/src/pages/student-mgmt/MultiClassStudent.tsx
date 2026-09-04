import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Users, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface EnrollmentRow {
  student_id: string;
  class_id: string;
  enrollment_date: string;
  status: string;
  academic_year_id: string;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
}

interface MultiClassRecord {
  student: StudentProfile;
  enrollments: Array<{
    class_id: string;
    class_name: string;
    enrollment_date: string;
    status: string;
    academic_year_id: string;
  }>;
}

const MultiClassStudent: React.FC = () => {
  const { profile } = useAuth();
  const [records, setRecords] = useState<MultiClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ studentId: string; classId: string; academicYearId: string } | null>(null);

  useEffect(() => {
    if (profile?.school_id) fetchMultiClassStudents();
  }, [profile?.school_id]);

  const fetchMultiClassStudents = async () => {
    setLoading(true);

    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student_id, class_id, enrollment_date, status, academic_year_id');

    if (!enrollments) {
      setLoading(false);
      return;
    }

    const grouped: Record<string, EnrollmentRow[]> = {};
    for (const e of enrollments) {
      const key = `${e.student_id}__${e.academic_year_id}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    }

    const multiClassKeys = Object.keys(grouped).filter((k) => grouped[k].length > 1);

    if (multiClassKeys.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const studentIds = [...new Set(multiClassKeys.map((k) => k.split('__')[0]))];
    const classIds = [...new Set(enrollments.flatMap((e) => e.class_id))];

    const [{ data: profileData }, { data: classData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, first_name, last_name, student_id')
        .in('id', studentIds)
        .eq('school_id', profile?.school_id),
      supabase.from('classes').select('id, name, section').in('id', classIds),
    ]);

    const classMap: Record<string, ClassInfo> = {};
    if (classData) classData.forEach((c) => (classMap[c.id] = c));

    const studentMap: Record<string, StudentProfile> = {};
    if (profileData) profileData.forEach((p) => (studentMap[p.id] = p));

    const result: MultiClassRecord[] = multiClassKeys.map((key) => {
      const studentId = key.split('__')[0];
      const rows = grouped[key];
      return {
        student: studentMap[studentId] || { id: studentId, first_name: 'Unknown', last_name: '', student_id: '' },
        enrollments: rows.map((r) => {
          const cls = classMap[r.class_id];
          return {
            class_id: r.class_id,
            class_name: cls ? `${cls.name} ${cls.section || ''}`.trim() : r.class_id,
            enrollment_date: r.enrollment_date,
            status: r.status,
            academic_year_id: r.academic_year_id,
          };
        }),
      };
    });

    setRecords(result);
    setLoading(false);
  };

  const handleRemoveEnrollment = async () => {
    if (!confirmRemove) return;
    const { studentId, classId, academicYearId } = confirmRemove;
    setRemovingKey(`${studentId}__${classId}`);

    await supabase
      .from('student_enrollments')
      .delete()
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId);

    setConfirmRemove(null);
    setRemovingKey(null);
    await fetchMultiClassStudents();
  };

  return (
    <div className="min-h-screen bg-app-surface-alt p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Users className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-app-text">Multi-Class Students</h1>
              <p className="text-app-text-muted text-sm">Students enrolled in more than one class in the same academic year</p>
            </div>
          </div>
          <button
            onClick={fetchMultiClassStudents}
            disabled={loading}
            className="flex items-center gap-2 border border-app-border text-app-text-muted px-4 py-2 rounded-lg hover:bg-app-surface-alt transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-12 text-center">
            <Users size={48} className="mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-semibold text-app-text-muted mb-1">No Multi-Class Enrollments</h3>
            <p className="text-app-text-muted text-sm">No students are currently enrolled in multiple classes in the same academic year.</p>
          </div>
        )}

        {!loading && records.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Found <strong>{records.length}</strong> student(s) with multiple class enrollments. Review and remove duplicate enrollments as needed.
              </p>
            </div>

            {records.map((record) => (
              <div key={record.student.id} className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 border-b border-app-border bg-app-surface-alt">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    {record.student.first_name.charAt(0)}{record.student.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-app-text">
                      {record.student.first_name} {record.student.last_name}
                    </p>
                    <p className="text-xs text-app-text-muted">Student ID: {record.student.student_id || 'N/A'}</p>
                  </div>
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                    {record.enrollments.length} classes
                  </span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-left bg-app-surface-alt">
                      <th className="px-5 py-2.5 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Class</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Status</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-app-text-muted uppercase tracking-wide">Enrollment Date</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-app-text-muted uppercase tracking-wide text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {record.enrollments.map((enr, idx) => (
                      <tr key={`${enr.class_id}-${idx}`} className="hover:bg-app-surface-alt">
                        <td className="px-5 py-3 font-medium text-app-text">{enr.class_name}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                              enr.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-app-text-muted'
                            }`}
                          >
                            {enr.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-app-text-muted">
                          {enr.enrollment_date
                            ? new Date(enr.enrollment_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() =>
                              setConfirmRemove({
                                studentId: record.student.id,
                                classId: enr.class_id,
                                academicYearId: enr.academic_year_id,
                              })
                            }
                            disabled={removingKey === `${record.student.id}__${enr.class_id}`}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50 ml-auto"
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="font-semibold text-app-text text-lg">Remove Enrollment</h3>
            </div>
            <p className="text-app-text-muted text-sm mb-6">
              Are you sure you want to remove this student from the class? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm border border-app-border rounded-lg text-app-text-muted hover:bg-app-surface-alt transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveEnrollment}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiClassStudent;
