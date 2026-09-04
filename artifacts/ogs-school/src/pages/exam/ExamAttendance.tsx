import { useState, useEffect } from 'react';
import { Save, CheckCircle, XCircle, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Exam {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface AttendanceRow {
  student_id: string;
  full_name: string;
  admission_number?: string;
  record_id?: string;
  status: 'present' | 'absent';
  is_locked: boolean;
}

export default function ExamAttendance() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [students, setStudents] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (schoolId) fetchMeta();
  }, [schoolId]);

  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject && selectedDate) {
      fetchAttendance();
    } else {
      setStudents([]);
    }
  }, [selectedExam, selectedClass, selectedSubject, selectedDate]);

  async function fetchMeta() {
    const [examRes, classRes, subjectRes] = await Promise.all([
      supabase.from('exams').select('id, name').eq('school_id', schoolId).neq('status', 'completed').order('name'),
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    ]);
    if (examRes.data) setExams(examRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (subjectRes.data) setSubjects(subjectRes.data);
  }

  async function fetchAttendance() {
    setLoading(true);
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('id, student_id, students(first_name, last_name, admission_number)')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('students(first_name)');

    if (!enrollments) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const studentIds = enrollments.map((e) => e.student_id);

    const { data: records } = await supabase
      .from('exam_attendance_records')
      .select('id, student_id, status, is_locked')
      .eq('exam_name_id', selectedExam)
      .eq('class_id', selectedClass)
      .eq('subject_id', selectedSubject)
      .eq('attendance_date', selectedDate)
      .in('student_id', studentIds);

    const recordMap: Record<string, any> = {};
    if (records) {
      records.forEach((r) => {
        recordMap[r.student_id] = r;
      });
    }

    setStudents(
      enrollments.map((e) => {
        const student = e.students as any;
        const rec = recordMap[e.student_id];
        return {
          student_id: e.student_id,
          full_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
          admission_number: student?.admission_number ?? '',
          record_id: rec?.id,
          status: rec?.status ?? 'present',
          is_locked: rec?.is_locked ?? false,
        };
      })
    );
    setLoading(false);
  }

  function setAll(status: 'present' | 'absent') {
    setStudents(students.map((s) => s.is_locked ? s : { ...s, status }));
  }

  async function handleSaveAll(lock = false) {
    if (!selectedExam || !selectedClass || !selectedSubject || !selectedDate) return;
    
    if (lock) {
      const confirmLock = window.confirm("Are you sure you want to submit and lock attendance? You won't be able to edit it later.");
      if (!confirmLock) return;
      setLocking(true);
    } else {
      setSaving(true);
    }

    const upserts = students.map((s) => ({
      school_id: schoolId,
      exam_name_id: selectedExam,
      class_id: selectedClass,
      subject_id: selectedSubject,
      student_id: s.student_id,
      attendance_date: selectedDate,
      status: s.status,
      is_locked: lock ? true : s.is_locked,
    }));

    await supabase
      .from('exam_attendance_records')
      .upsert(upserts, { onConflict: 'exam_name_id,student_id,subject_id,attendance_date' });
      
    setSaving(false);
    setLocking(false);
    fetchAttendance();
  }

  const inputClass =
    'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

  const allSelected = selectedExam && selectedClass && selectedSubject && selectedDate;
  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const allLocked = students.length > 0 && students.every(s => s.is_locked);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Exam Attendance</h1>
          <p className="text-sm text-app-text-muted mt-0.5">Mark and lock student attendance for specific exams securely</p>
        </div>
        {allSelected && students.length > 0 && (
          <div className="flex items-center gap-2">
            {!allLocked && (
              <>
                <button
                  onClick={() => handleSaveAll(false)}
                  disabled={saving || locking}
                  className="flex items-center gap-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={() => handleSaveAll(true)}
                  disabled={saving || locking}
                  className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md disabled:opacity-50"
                >
                  <Lock size={16} />
                  {locking ? 'Locking...' : 'Submit & Lock'}
                </button>
              </>
            )}
            {allLocked && (
              <span className="flex items-center gap-1.5 text-app-text-muted bg-slate-100 px-4 py-2 rounded-xl text-sm border border-app-border">
                <Lock size={16} className="text-app-text-muted" />
                Records Locked
              </span>
            )}
          </div>
        )}
      </div>

      <div className="bg-app-surface-alt rounded-2xl border border-app-border p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">
              Exam
            </label>
            <select
              className={`${inputClass} bg-app-surface`}
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="">Select exam</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">
              Class
            </label>
            <select
              className={`${inputClass} bg-app-surface`}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">
              Subject
            </label>
            <select
              className={`${inputClass} bg-app-surface`}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">
              Date
            </label>
            <input
              type="date"
              className={`${inputClass} bg-app-surface`}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !allSelected ? (
        <div className="text-center py-20 bg-app-surface rounded-2xl border border-dashed border-app-border">
          <CheckCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-app-text-muted">Complete selection</p>
          <p className="text-sm text-app-text-muted mt-1">Exam, class, subject and date are required to see attendance.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-20 bg-app-surface rounded-2xl border border-dashed border-app-border">
          <p className="text-lg font-medium text-app-text-muted">No students enrolled</p>
          <p className="text-sm text-app-text-muted mt-1">No students found for the selected class.</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 bg-app-surface-alt border-b border-app-border">
            <div className="flex items-center gap-5 text-sm">
              <span className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-200/50">
                <CheckCircle size={16} /> {presentCount} Present
              </span>
              <span className="flex items-center gap-2 text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                <XCircle size={16} /> {absentCount} Absent
              </span>
            </div>
            {!allLocked && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAll('present')}
                  className="text-xs font-bold border border-emerald-200 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => setAll('absent')}
                  className="text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
                >
                  Mark All Absent
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt/50 border-b border-app-border">
                <tr>
                  <th className="text-left px-6 py-4 font-bold text-app-text w-16">#</th>
                  <th className="text-left px-4 py-4 font-bold text-app-text">Student Name</th>
                  <th className="text-center px-4 py-4 font-bold text-app-text">
                    Attendance Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {students.map((student, idx) => (
                  <tr
                    key={student.student_id}
                    className={`hover:bg-app-surface-alt transition-colors ${
                      student.status === 'absent' ? 'bg-red-50/20' : ''
                    } ${student.is_locked ? 'opacity-70 bg-app-surface-alt/50' : ''}`}
                  >
                    <td className="px-6 py-4 text-app-text-muted font-medium">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-app-text">{student.full_name}</div>
                      <div className="text-[10px] text-app-text-muted font-medium mt-0.5">ADM: {student.admission_number || '—'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-8 text-base">
                        <label className={`flex items-center gap-2 ${student.is_locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name={`attendance-${student.student_id}`}
                            value="present"
                            checked={student.status === 'present'}
                            disabled={student.is_locked}
                            onChange={() => {
                              if (student.is_locked) return;
                              const updated = [...students];
                              updated[idx].status = 'present';
                              setStudents(updated);
                            }}
                            className="w-4 h-4 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className={`font-semibold ${student.status === 'present' ? 'text-emerald-600' : 'text-app-text-muted'}`}>Present</span>
                        </label>
                        <label className={`flex items-center gap-2 ${student.is_locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name={`attendance-${student.student_id}`}
                            value="absent"
                            checked={student.status === 'absent'}
                            disabled={student.is_locked}
                            onChange={() => {
                              if (student.is_locked) return;
                              const updated = [...students];
                              updated[idx].status = 'absent';
                              setStudents(updated);
                            }}
                            className="w-4 h-4 accent-red-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className={`font-semibold ${student.status === 'absent' ? 'text-red-500' : 'text-app-text-muted'}`}>Absent</span>
                        </label>
                        {student.is_locked && (
                          <div title="Locked" className="-ml-4"><Lock size={14} className="text-app-text-muted" /></div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
