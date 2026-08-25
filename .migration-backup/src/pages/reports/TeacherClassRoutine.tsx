import { useState, useEffect } from 'react';
import { CalendarDays, Download, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Teacher {
  id: string;
  full_name: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface RoutineSlot {
  id: string;
  day: string;
  time_slot: string;
  class_name: string;
  section_name: string;
  subject_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherClassRoutine() {
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [routineSlots, setRoutineSlots] = useState<RoutineSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    teacher_id: '',
    academic_year_id: '',
  });

  useEffect(() => {
    fetchTeachersAndYears();
  }, []);

  useEffect(() => {
    if (filters.teacher_id) {
      fetchRoutine();
    } else {
      setRoutineSlots([]);
      setTimeSlots([]);
    }
  }, [filters.teacher_id, filters.academic_year_id]);

  async function fetchTeachersAndYears() {
    const [teachersRes, yearsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['teacher', 'head_teacher'])
        .eq('school_id', profile?.school_id)
        .order('full_name'),
      supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', profile?.school_id)
        .order('name'),
    ]);
    if (teachersRes.data) setTeachers(teachersRes.data);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
  }

  async function fetchRoutine() {
    setLoading(true);
    let query = supabase
      .from('class_routines')
      .select('id, day, time_slot, class_name, section_name, subject_name')
      .eq('teacher_id', filters.teacher_id)
      .order('time_slot');

    if (filters.academic_year_id) {
      query = query.eq('academic_year_id', filters.academic_year_id);
    }

    const { data } = await query;
    const slots = data || [];
    setRoutineSlots(slots);

    const uniqueSlots = Array.from(new Set(slots.map((s: RoutineSlot) => s.time_slot))).sort() as string[];
    setTimeSlots(uniqueSlots);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  function getSlot(timeSlot: string, day: string) {
    return routineSlots.find(s => s.time_slot === timeSlot && s.day === day);
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Teacher Class Routine</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={filters.teacher_id}
            onChange={e => setFilters(f => ({ ...f, teacher_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select Teacher</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>

          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!filters.teacher_id ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center gap-3 text-slate-400">
          <CalendarDays className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-medium">Select a teacher to view their class routine</p>
          <p className="text-sm">Choose a teacher from the dropdown above</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          Loading...
        </div>
      ) : routineSlots.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center gap-3 text-slate-400">
          <Info className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-medium">No routine data available</p>
          <p className="text-sm">No class routine has been assigned to this teacher yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-slate-600 font-medium w-32">Time Slot</th>
                  {DAYS.map(day => (
                    <th key={day} className="text-center px-3 py-3 text-slate-600 font-medium">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(slot => (
                  <tr key={slot} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700 bg-slate-50">{slot}</td>
                    {DAYS.map(day => {
                      const cell = getSlot(slot, day);
                      return (
                        <td key={day} className="px-3 py-3 text-center">
                          {cell ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                              <p className="font-medium text-emerald-800 text-xs">{cell.subject_name}</p>
                              <p className="text-emerald-600 text-xs mt-0.5">{cell.class_name} {cell.section_name}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filters.teacher_id && routineSlots.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="font-semibold text-slate-700">Detailed Schedule</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Day</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Time Slot</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Class</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Section</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Subject</th>
                </tr>
              </thead>
              <tbody>
                {routineSlots.map((slot, index) => (
                  <tr key={slot.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 text-slate-600">{slot.day}</td>
                    <td className="px-4 py-3 text-slate-600">{slot.time_slot}</td>
                    <td className="px-4 py-3 text-slate-800">{slot.class_name}</td>
                    <td className="px-4 py-3 text-slate-600">{slot.section_name}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">{slot.subject_name}</td>
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
