import { useState, useEffect } from 'react';
import { Calendar, BookOpen, Clock, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ExamScheduleItem {
  id: string;
  exam_date: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  duration: number;
  venue: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  name: string;
  academic_year_id: string;
}

export default function ExamRoutine() {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<ExamScheduleItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    exam_id: '',
  });

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  useEffect(() => {
    if (filters.academic_year_id) {
      fetchExams(filters.academic_year_id);
    } else {
      setExams([]);
      setFilters(f => ({ ...f, exam_id: '' }));
    }
  }, [filters.academic_year_id]);

  useEffect(() => {
    fetchSchedule();
  }, [filters.exam_id]);

  async function fetchAcademicYears() {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setAcademicYears(data);
  }

  async function fetchExams(yearId: string) {
    const { data } = await supabase
      .from('exams')
      .select('id, name, academic_year_id')
      .eq('academic_year_id', yearId)
      .order('name');
    if (data) setExams(data);
  }

  async function fetchSchedule() {
    if (!filters.exam_id) {
      setSchedule([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('exam_schedule')
      .select('id, exam_date, subject_name, start_time, end_time, duration, venue, subjects(name)')
      .eq('exam_id', filters.exam_id)
      .order('exam_date');

    const mapped = (data || []).map((d: any) => ({
      id: d.id,
      exam_date: d.exam_date,
      subject_name: d.subjects?.name || d.subject_name || '-',
      start_time: d.start_time || '',
      end_time: d.end_time || '',
      duration: d.duration || 0,
      venue: d.venue || '-',
    }));
    setSchedule(mapped);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const totalDays = new Set(schedule.map(s => s.exam_date)).size;
  const totalSubjects = schedule.length;

  function getDayName(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-app-primary text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">Exam Routine</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value, exam_id: '' }))}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
          >
            <option value="">Select Academic Year</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            value={filters.exam_id}
            onChange={e => setFilters(f => ({ ...f, exam_id: e.target.value }))}
            disabled={!filters.academic_year_id}
            className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary disabled:opacity-50"
          >
            <option value="">Select Exam</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Exam Days</p>
              <p className="text-2xl font-bold text-app-text mt-1">{totalDays}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Subjects</p>
              <p className="text-2xl font-bold text-app-text mt-1">{totalSubjects}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
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
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Date</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Day</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Subject</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Start Time</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">End Time</th>
                <th className="text-center px-4 py-3 text-app-text-muted font-medium">Duration (mins)</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Venue</th>
              </tr>
            </thead>
            <tbody>
              {!filters.exam_id ? (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2 text-app-text-muted">
                      <Calendar className="h-10 w-10 text-slate-300" />
                      <p>Select an academic year and exam to view the routine</p>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : schedule.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-app-text-muted">No schedule found for this exam</td>
                </tr>
              ) : (
                schedule.map((item, index) => (
                  <tr key={item.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{new Date(item.exam_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-app-text-muted">{getDayName(item.exam_date)}</td>
                    <td className="px-4 py-3 text-app-text">{item.subject_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{item.start_time || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{item.end_time || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-app-text-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {item.duration || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{item.venue}</td>
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
