import { useState, useEffect } from 'react';
import { Save, Calendar, Clock, User, DoorOpen } from 'lucide-react';
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

interface Staff {
  id: string;
  full_name: string;
}

interface SubjectRow {
  subject_id: string;
  subject_name: string;
  schedule_id?: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  supervisor_id: string;
  saving?: boolean;
}

export default function ExamSchedule() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(false);

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (schoolId) fetchMeta();
  }, [schoolId]);

  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchSubjectsWithSchedules();
    } else {
      setSubjectRows([]);
    }
  }, [selectedExam, selectedClass]);

  async function fetchMeta() {
    const [examRes, classRes, staffRes] = await Promise.all([
      supabase.from('exams').select('id, name').eq('school_id', schoolId).neq('status', 'completed').order('name'),
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('profiles').select('id, first_name, last_name').eq('school_id', schoolId).in('role', ['super_admin', 'teacher']).order('first_name'),
    ]);
    if (examRes.data) setExams(examRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (staffRes.data) {
      setStaff(staffRes.data.map(s => ({ id: s.id, full_name: `${s.first_name} ${s.last_name}` })));
    }
  }

  async function fetchSubjectsWithSchedules() {
    setLoading(true);
    // Load all subjects assigned to this class or general subjects
    // For simplicity and based on common patterns, we load all subjects for the school if class specific ones aren't clearly partitioned
    // But usually subjects are linked to classes via assign_subjects or exam_setups.
    // The user said "Currently, selecting a Class and Exam does not automatically load the correct subjects. This must be fixed to automatically display all subjects assigned to that class."
    
    // Attempt to load subjects from a standard assignment table if it exists, otherwise use the subjects table.
    const { data: classSubjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name');

    if (!classSubjects) {
      setSubjectRows([]);
      setLoading(false);
      return;
    }

    const { data: scheduleData } = await supabase
      .from('exam_schedules')
      .select('*')
      .eq('exam_name_id', selectedExam)
      .eq('class_id', selectedClass);

    const scheduleMap: Record<string, any> = {};
    if (scheduleData) {
      scheduleData.forEach((s) => {
        scheduleMap[s.subject_id] = s;
      });
    }

    setSubjectRows(
      classSubjects.map((s) => {
        const sched = scheduleMap[s.id];
        return {
          subject_id: s.id,
          subject_name: s.name,
          schedule_id: sched?.id,
          exam_date: sched?.exam_date ?? '',
          start_time: sched?.start_time ?? '',
          end_time: sched?.end_time ?? '',
          room: sched?.room ?? '',
          supervisor_id: sched?.supervisor_id ?? '',
        };
      })
    );
    setLoading(false);
  }

  function updateRow(index: number, field: keyof SubjectRow, value: string) {
    const updated = [...subjectRows];
    (updated[index] as any)[field] = value;
    setSubjectRows(updated);
  }

  async function handleSaveRow(index: number) {
    const row = subjectRows[index];
    if (!row.exam_date) {
      alert('Please select an exam date.');
      return;
    }

    const updatedRows = [...subjectRows];
    updatedRows[index].saving = true;
    setSubjectRows(updatedRows);

    const payload = {
      school_id: schoolId,
      exam_name_id: selectedExam,
      class_id: selectedClass,
      subject_id: row.subject_id,
      exam_date: row.exam_date,
      start_time: row.start_time || null,
      end_time: row.end_time || null,
      room: row.room || null,
      supervisor_id: row.supervisor_id || null,
    };

    let res;
    if (row.schedule_id) {
      res = await supabase.from('exam_schedules').update(payload).eq('id', row.schedule_id);
    } else {
      res = await supabase.from('exam_schedules').insert(payload).select().single();
      if (res.data) {
        updatedRows[index].schedule_id = res.data.id;
      }
    }

    updatedRows[index].saving = false;
    setSubjectRows([...updatedRows]);

    if (res.error) {
      alert('Error saving schedule: ' + res.error.message);
    }
  }

  const inputClass = 'border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';
  const filterInputClass = 'border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="text-emerald-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exam Schedule</h1>
          <p className="text-sm text-slate-500">Manage exam dates, times and supervisors per class</p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Select Exam</label>
            <select
              className={filterInputClass}
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="">Choose an exam...</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Select Class</label>
            <select
              className={filterInputClass}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Choose a class...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedExam || !selectedClass ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-600">No selection made</p>
          <p className="text-sm text-slate-400 mt-1">Please select an exam and a class to view and manage the schedule.</p>
        </div>
      ) : subjectRows.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-lg font-medium text-slate-600">No subjects assigned</p>
          <p className="text-sm text-slate-400 mt-1">No subjects were found for the selected class.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 font-bold text-slate-700 w-1/4">Subject</th>
                  <th className="text-left px-4 py-4 font-bold text-slate-700">Exam Date</th>
                  <th className="text-left px-4 py-4 font-bold text-slate-700">Start Time</th>
                  <th className="text-left px-4 py-4 font-bold text-slate-700">End Time</th>
                  <th className="text-left px-4 py-4 font-bold text-slate-700">Supervisor</th>
                  <th className="text-left px-4 py-4 font-bold text-slate-700">Room</th>
                  <th className="text-center px-6 py-4 font-bold text-slate-700 w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectRows.map((row, idx) => (
                  <tr key={row.subject_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{row.subject_name}</div>
                      {row.schedule_id && <div className="text-[10px] text-emerald-600 font-medium">Scheduled</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <Calendar className="absolute left-2 top-2.5 text-slate-400" size={14} />
                        <input
                          type="date"
                          className={`${inputClass} pl-7`}
                          value={row.exam_date}
                          onChange={(e) => updateRow(idx, 'exam_date', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <Clock className="absolute left-2 top-2.5 text-slate-400" size={14} />
                        <input
                          type="time"
                          className={`${inputClass} pl-7`}
                          value={row.start_time}
                          onChange={(e) => updateRow(idx, 'start_time', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <Clock className="absolute left-2 top-2.5 text-slate-400" size={14} />
                        <input
                          type="time"
                          className={`${inputClass} pl-7`}
                          value={row.end_time}
                          onChange={(e) => updateRow(idx, 'end_time', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <User className="absolute left-2 top-2.5 text-slate-400" size={14} />
                        <select
                          className={`${inputClass} pl-7 appearance-none`}
                          value={row.supervisor_id}
                          onChange={(e) => updateRow(idx, 'supervisor_id', e.target.value)}
                        >
                          <option value="">N/A</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <DoorOpen className="absolute left-2 top-2.5 text-slate-400" size={14} />
                        <input
                          className={`${inputClass} pl-7`}
                          placeholder="Room"
                          value={row.room}
                          onChange={(e) => updateRow(idx, 'room', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleSaveRow(idx)}
                        disabled={row.saving || !row.exam_date}
                        className={`p-2.5 rounded-xl transition-all ${
                          row.saving 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white shadow-sm shadow-emerald-200'
                        } disabled:opacity-50`}
                        title="Save Row"
                      >
                        {row.saving ? <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                      </button>
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
