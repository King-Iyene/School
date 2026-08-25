import { useEffect, useState } from 'react';
import { Save, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../components/hooks/useLocation';

export default function TeacherGrades() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, any>>({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadMeta(); }, [profile]);
  useEffect(() => { if (selectedClass) loadClassSubjects(); }, [selectedClass]);
  useEffect(() => { if (selectedClass && selectedSubject && selectedTerm && selectedYear) loadGrades(); }, [selectedClass, selectedSubject, selectedTerm, selectedYear]);

  async function loadMeta() {
    if (!profile?.id || !profile?.school_id) return;
    const [yearRes, termRes] = await Promise.all([
      supabase.from('academic_years').select('*').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle(),
      supabase.from('terms').select('*').order('name'),
    ]);

    const currentYear = yearRes.data;
    const termData = termRes.data ?? [];

    setAcademicYears(currentYear ? [currentYear] : []);
    setTerms(termData);

    if (currentYear) {
      setSelectedYear(currentYear.id);
      const subBase = supabase.from('subject_teacher_assignments')
        .select('class_id, classes(id, name, level, section)')
        .eq('academic_year_id', currentYear.id);
      const fmTableBase = supabase.from('class_teachers')
        .select('class_id, classes(id, name, level, section)')
        .eq('academic_year_id', currentYear.id);

      const [subRes, fmTableRes, fmClassesRes] = await Promise.all([
        isAdmin ? subBase : subBase.eq('teacher_id', profile.id),
        isAdmin ? fmTableBase : fmTableBase.eq('teacher_id', profile.id),
        isAdmin
          ? supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id ?? '')
          : supabase.from('classes').select('id, name, level, section').eq('class_teacher_id', profile.id)
      ]);

      const combined = [
        ...(subRes.data ?? []).map(d => d.classes),
        ...(fmTableRes.data ?? []).map(d => d.classes),
        ...(fmClassesRes.data ?? [])
      ].filter(Boolean);

      const uniqueClasses = [...new Map(combined.map((c: any) => [c.id, c])).values()];
      setClasses(uniqueClasses);
      if (uniqueClasses.length > 0) setSelectedClass((uniqueClasses[0] as any)?.id);
    }

    if (currentYear?.id) {
      const { data: ayt } = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', currentYear.id)
        .eq('is_current', true)
        .maybeSingle();
      if (ayt?.term_id) setSelectedTerm(ayt.term_id);
    }
  }

  async function loadClassSubjects() {
    if (!selectedClass || !selectedYear) return;
    const subjectsQuery = supabase.from('subject_teacher_assignments')
      .select('*, subjects(id, name)')
      .eq('class_id', selectedClass)
      .eq('academic_year_id', selectedYear);
    const { data } = await (isAdmin ? subjectsQuery : subjectsQuery.eq('teacher_id', profile?.id ?? ''));
    const subs = (data ?? []).map(d => d.subjects).filter(Boolean);
    setSubjects(subs);
    if (subs.length > 0) setSelectedSubject((subs[0] as any)?.id);
  }

  async function loadGrades() {
    setLoading(true);
    const [enrollRes, gradeRes] = await Promise.all([
      supabase.from('student_enrollments')
        .select('*, students(id, first_name, last_name, admission_number)')
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .eq('academic_year_id', selectedYear),
      supabase.from('grades')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term_id', selectedTerm)
        .eq('academic_year_id', selectedYear),
    ]);
    setStudents((enrollRes.data ?? []).map(e => e.students).filter(Boolean));
    const map: Record<string, any> = {};
    (gradeRes.data ?? []).forEach(g => { map[g.student_id] = g; });
    setGrades(map);
    setLoading(false);
  }

  function updateGrade(studentId: string, field: string, raw: string) {
    const val = parseFloat(raw);
    setSaveError('');
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [field]: isNaN(val) ? '' : val },
    }));
  }

  function getTotal(studentId: string) {
    const g = grades[studentId] || {};
    return (Number(g.ca1_score) || 0) + (Number(g.ca3_score) || 0) + (Number(g.exam_score) || 0);
  }

  function getGrade(total: number) {
    if (total >= 75) return 'A1'; if (total >= 70) return 'B2'; if (total >= 65) return 'B3';
    if (total >= 60) return 'C4'; if (total >= 55) return 'C5'; if (total >= 50) return 'C6';
    if (total >= 45) return 'D7'; if (total >= 40) return 'E8'; return 'F9';
  }

  async function saveGrades() {
    setSaving(true);
    setSaveError('');

    const records = students
      .map(s => {
        const g = grades[s.id] || {};
        const ca1 = g.ca1_score === '' || g.ca1_score == null ? 0 : Number(g.ca1_score);
        const ca3 = g.ca3_score === '' || g.ca3_score == null ? 0 : Number(g.ca3_score);
        const exam = g.exam_score === '' || g.exam_score == null ? 0 : Number(g.exam_score);
        const total = ca1 + ca3 + exam;

        const hasExistingRecord = !!g.id;
        const hasAnyScore = ca1 > 0 || ca3 > 0 || exam > 0;
        if (!hasExistingRecord && !hasAnyScore) return null;

        return {
          student_id: s.id,
          class_id: selectedClass,
          subject_id: selectedSubject,
          term_id: selectedTerm,
          academic_year_id: selectedYear,
          ca1_score: ca1,
          ca2_score: 0,
          ca3_score: ca3,
          exam_score: exam,
          grade: getGrade(total),
          teacher_id: profile?.id,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    if (records.length === 0) {
      setSaving(false);
      setSaveError('No scores to save. Enter at least one score before saving.');
      return;
    }

    const { error } = await supabase
      .from('grades')
      .upsert(records, { onConflict: 'student_id,subject_id,class_id,term_id,academic_year_id' });

    if (error) {
      setSaveError(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaved(true);
    await loadGrades();
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Grade Entry</h2>
        <p className="text-slate-500 text-sm">Enter and manage student assessment scores</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {classes.map(c => <option key={(c as any)?.id} value={(c as any)?.id}>{(c as any)?.name || `${(c as any)?.level}${(c as any)?.section}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {subjects.map(s => <option key={(s as any)?.id} value={(s as any)?.id}>{(s as any)?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Term</label>
            <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Academic Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading students...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No students enrolled in this class</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Student</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-3">CA /20</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-3">Test /20</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-3">Exam /60</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-3">Total</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase px-2 py-3">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(s => {
                  const total = getTotal(s.id);
                  const grade = getGrade(total);
                  const gradeColor = grade.startsWith('A') ? 'text-emerald-600' : grade.startsWith('B') ? 'text-blue-600' : grade.startsWith('C') ? 'text-amber-600' : 'text-red-500';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2">
                        <button onClick={() => navigate(`/student-profile?id=${s.id}`)} className="text-left group">
                          <p className="text-sm font-medium text-slate-800 group-hover:text-emerald-600 transition-colors">{s.first_name} {s.last_name}</p>
                          {s.admission_number && <p className="text-xs text-slate-400">{s.admission_number}</p>}
                        </button>
                      </td>
                      {([['ca1_score', 20], ['ca3_score', 20], ['exam_score', 60]] as [string, number][]).map(([field, max]) => (
                        <td key={field} className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            max={max}
                            value={grades[s.id]?.[field] ?? ''}
                            onChange={e => updateGrade(s.id, field, e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold text-slate-800">{total}</td>
                      <td className={`px-2 py-2 text-center font-bold ${gradeColor}`}>{grade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {saveError && (
            <div className="mx-4 my-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="p-4 border-t border-slate-100 flex justify-end">
            <button onClick={saveGrades} disabled={saving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Grades'}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
