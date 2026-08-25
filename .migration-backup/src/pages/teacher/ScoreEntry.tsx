import { useEffect, useState } from 'react';
import { Save, CheckCircle, AlertCircle, BookOpen, ChevronRight, XCircle } from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface SubjectStatus {
  id: string;
  name: string;
  code: string;
  enrolled: number;
  entered: number;
}

export default function ScoreEntry() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';

  const [classes, setClasses] = useState<any[]>([]);
  const [subjectStatuses, setSubjectStatuses] = useState<SubjectStatus[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, any>>({});
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [exclusionIds, setExclusionIds] = useState<Record<string, string>>({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  useEffect(() => { loadMeta(); }, [profile]);

  useEffect(() => {
    if (selectedClass && selectedTerm && selectedYear) {
      setSelectedSubject('');
      loadSubjectStatuses();
    }
  }, [selectedClass, selectedTerm, selectedYear]);

  useEffect(() => {
    if (selectedClass && selectedSubject && selectedTerm && selectedYear) loadStudentScores();
  }, [selectedClass, selectedSubject, selectedTerm, selectedYear]);

  async function loadMeta() {
    if (!profile?.id || !profile?.school_id) return;

    const [yearsRes, termRes] = await Promise.all([
      supabase.from('academic_years')
        .select('id, name, is_current')
        .eq('school_id', profile.school_id ?? '')
        .order('name', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
    ]);

    const years = yearsRes.data ?? [];
    const termData = termRes.data ?? [];

    setAcademicYears(years);
    setTerms(termData);

    const currentYear = years.find((y: any) => y.is_current) || years[0];
    if (currentYear) {
      setSelectedYear(currentYear.id);

      if (isAdmin) {
        const { data: allClasses } = await supabase.from('classes')
          .select('id, name, level, section')
          .eq('school_id', profile.school_id ?? '')
          .order('name');
        setClasses(allClasses ?? []);
        if (allClasses && allClasses.length > 0) setSelectedClass(allClasses[0].id);
      } else {
        const [subRes, fmTableRes, fmClassesRes] = await Promise.all([
          supabase.from('subject_teacher_assignments')
            .select('class_id, classes(id, name, level, section)')
            .eq('teacher_id', profile.id)
            .eq('academic_year_id', currentYear.id),
          supabase.from('class_teachers')
            .select('class_id, classes(id, name, level, section)')
            .eq('teacher_id', profile.id)
            .eq('academic_year_id', currentYear.id),
          supabase.from('classes')
            .select('id, name, level, section')
            .eq('class_teacher_id', profile.id),
        ]);
        const combined = [
          ...(subRes.data ?? []).map(d => d.classes),
          ...(fmTableRes.data ?? []).map(d => d.classes),
          ...(fmClassesRes.data ?? []),
        ].filter(Boolean);
        const uniqueClasses = [...new Map(combined.map((c: any) => [c.id, c])).values()];
        setClasses(uniqueClasses);
        if (uniqueClasses.length > 0) setSelectedClass((uniqueClasses[0] as any)?.id);
      }

      const { data: ayt } = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', currentYear.id)
        .eq('is_current', true)
        .maybeSingle();
      if (ayt?.term_id) setSelectedTerm(ayt.term_id);
    }
  }

  async function loadSubjectStatuses() {
    if (!profile?.id || !selectedYear || !selectedClass || !selectedTerm) return;
    setLoadingStatuses(true);

    let subjectQuery = supabase
      .from('subject_teacher_assignments')
      .select('subject_id, subjects(id, name, code)')
      .eq('class_id', selectedClass)
      .eq('academic_year_id', selectedYear);

    if (!isAdmin) {
      subjectQuery = subjectQuery.eq('teacher_id', profile.id);
    }

    const [subjectRes, enrollRes, gradeRes] = await Promise.all([
      subjectQuery,
      supabase.from('student_enrollments').select('student_id')
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .eq('academic_year_id', selectedYear),
      supabase.from('grades')
        .select('student_id, subject_id, ca1_score, ca3_score, exam_score')
        .eq('class_id', selectedClass)
        .eq('term_id', selectedTerm)
        .eq('academic_year_id', selectedYear),
    ]);

    const uniqueStudentIds = new Set((enrollRes.data ?? []).map((e: any) => e.student_id).filter(Boolean));
    const enrolledCount = uniqueStudentIds.size;

    const countMap: Record<string, Set<string>> = {};
    (gradeRes.data ?? []).forEach((g: any) => {
      const hasScore = (Number(g.ca1_score) || 0) + (Number(g.ca3_score) || 0) + (Number(g.exam_score) || 0) > 0;
      if (hasScore && uniqueStudentIds.has(g.student_id)) {
        if (!countMap[g.subject_id]) countMap[g.subject_id] = new Set();
        countMap[g.subject_id].add(g.student_id);
      }
    });

    const subs = (subjectRes.data ?? [])
      .map((row: any) => row.subjects)
      .filter(Boolean);
    const uniqueSubs = [...new Map(subs.map((s: any) => [s.id, s])).values()];

    const statuses: SubjectStatus[] = uniqueSubs.map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code ?? '',
      enrolled: enrolledCount,
      entered: countMap[s.id]?.size ?? 0,
    }));
    setSubjectStatuses(statuses);
    if (statuses.length > 0) setSelectedSubject(statuses[0].id);
    setLoadingStatuses(false);
  }

  async function loadStudentScores() {
    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedYear) return;
    setLoadingStudents(true);
    const [enrollRes, gradeRes, exclusionRes] = await Promise.all([
      supabase.from('student_enrollments')
        .select('*, students(*)')
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .eq('academic_year_id', selectedYear),
      supabase.from('grades')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term_id', selectedTerm)
        .eq('academic_year_id', selectedYear),
      supabase.from('student_subject_exclusions')
        .select('id, student_id')
        .eq('subject_id', selectedSubject)
        .eq('academic_year_id', selectedYear),
    ]);
    const rawStudents = (enrollRes.data ?? []).map(e => e.students).filter(Boolean);
    const uniqueStudents = [...new Map(rawStudents.map((s: any) => [s.id, s])).values()];
    setStudents(uniqueStudents);
    const map: Record<string, any> = {};
    (gradeRes.data ?? []).forEach(g => { map[g.student_id] = g; });
    setGrades(map);

    const exMap: Record<string, boolean> = {};
    const exIds: Record<string, string> = {};
    (exclusionRes.data ?? []).forEach((e: any) => {
      exMap[e.student_id] = true;
      exIds[e.student_id] = e.id;
    });
    setExcluded(exMap);
    setExclusionIds(exIds);

    setLoadingStudents(false);
  }

  function updateGrade(studentId: string, field: string, raw: string) {
    const val = parseFloat(raw);
    setSaveError('');
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [field]: isNaN(val) ? '' : val },
    }));
  }

  async function toggleExclude(studentId: string) {
    if (!profile?.school_id) return;
    const isExcluded = !!excluded[studentId];
    setSaveError('');

    if (isExcluded) {
      const exId = exclusionIds[studentId];
      if (exId) {
        const { error } = await supabase.from('student_subject_exclusions').delete().eq('id', exId);
        if (error) { setSaveError(`Failed to restore: ${error.message}`); return; }
      }
      setExcluded(prev => { const n = { ...prev }; delete n[studentId]; return n; });
      setExclusionIds(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    } else {
      const existingGrade = grades[studentId];
      if (existingGrade?.id) {
        await supabase.from('grades').delete().eq('id', existingGrade.id);
      }
      const { data, error } = await supabase.from('student_subject_exclusions').insert({
        school_id: profile.school_id,
        student_id: studentId,
        subject_id: selectedSubject,
        class_id: selectedClass,
        academic_year_id: selectedYear,
        term_id: selectedTerm,
        reason: 'Does not offer this subject',
        created_by: profile.id,
      }).select('id').maybeSingle();
      if (error) { setSaveError(`Failed to exclude: ${error.message}`); return; }
      setExcluded(prev => ({ ...prev, [studentId]: true }));
      if (data?.id) setExclusionIds(prev => ({ ...prev, [studentId]: data.id }));
      setGrades(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    }
  }

  function getTotal(studentId: string) {
    const g = grades[studentId] || {};
    return (Number(g.ca1_score) || 0) + (Number(g.ca3_score) || 0) + (Number(g.exam_score) || 0);
  }

  function getGrade(total: number) {
    if (total >= 75) return { grade: 'A1', color: 'text-emerald-600' };
    if (total >= 70) return { grade: 'B2', color: 'text-blue-600' };
    if (total >= 65) return { grade: 'B3', color: 'text-blue-500' };
    if (total >= 60) return { grade: 'C4', color: 'text-amber-600' };
    if (total >= 55) return { grade: 'C5', color: 'text-amber-500' };
    if (total >= 50) return { grade: 'C6', color: 'text-amber-400' };
    if (total >= 45) return { grade: 'D7', color: 'text-orange-500' };
    if (total >= 40) return { grade: 'E8', color: 'text-red-500' };
    return { grade: 'F9', color: 'text-red-600' };
  }

  async function saveScores() {
    setSaving(true);
    setSaveError('');

    const records = students
      .filter(s => !excluded[s.id])
      .map(s => {
        const g = grades[s.id] || {};
        const ca1 = g.ca1_score === '' || g.ca1_score === undefined || g.ca1_score === null ? 0 : Number(g.ca1_score);
        const ca3 = g.ca3_score === '' || g.ca3_score === undefined || g.ca3_score === null ? 0 : Number(g.ca3_score);
        const exam = g.exam_score === '' || g.exam_score === undefined || g.exam_score === null ? 0 : Number(g.exam_score);
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
          grade: getGrade(total).grade,
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
    await loadStudentScores();
    await loadSubjectStatuses();
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  const selectedSubjectInfo = subjectStatuses.find(s => s.id === selectedSubject);
  const selectedClassName = classes.find(c => (c as any)?.id === selectedClass);
  const classLabel = selectedClassName
    ? ((selectedClassName as any)?.name || `${(selectedClassName as any)?.level}${(selectedClassName as any)?.section}`)
    : '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Score Entry</h2>
          <p className="text-slate-500 text-sm">
            {isAdmin ? 'Enter and manage student scores for any class and subject' : 'Record student scores for your assigned subjects'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {classes.map(c => <option key={(c as any)?.id} value={(c as any)?.id}>{(c as any)?.name || `${(c as any)?.level}${(c as any)?.section}`}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Term</label>
            <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Academic Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-xs text-slate-400 pb-2">
              {loadingStatuses ? 'Loading subjects...' : `${subjectStatuses.length} subject${subjectStatuses.length !== 1 ? 's' : ''} found`}
            </div>
          </div>
        </div>
      </div>

      {subjectStatuses.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {isAdmin ? `All Subjects — ${classLabel}` : `Your Subjects — ${classLabel}`}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {subjectStatuses.map(sub => {
              const pct = sub.enrolled > 0 ? (sub.entered / sub.enrolled) * 100 : 0;
              const isComplete = sub.entered >= sub.enrolled && sub.enrolled > 0;
              const isSelected = sub.id === selectedSubject;
              return (
                <button key={sub.id} onClick={() => setSelectedSubject(sub.id)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 truncate">{sub.name}</span>
                    {isComplete
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : sub.entered > 0
                        ? <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        : <BookOpen className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                    <div className={`h-1.5 rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{sub.entered}/{sub.enrolled} students</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedSubject && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{selectedSubjectInfo?.name}</h3>
              <p className="text-xs text-slate-400">{classLabel} · Untick a student to mark them as not offering this subject</p>
            </div>
            {selectedSubjectInfo && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selectedSubjectInfo.entered >= selectedSubjectInfo.enrolled && selectedSubjectInfo.enrolled > 0 ? 'bg-emerald-100 text-emerald-700' : selectedSubjectInfo.entered > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {selectedSubjectInfo.entered >= selectedSubjectInfo.enrolled && selectedSubjectInfo.enrolled > 0 ? 'Complete' : selectedSubjectInfo.entered > 0 ? 'In Progress' : 'Not Started'}
              </span>
            )}
          </div>

          {loadingStudents ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No active students in this class</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase px-3 py-3 w-16" title="Tick = offers this subject">Offers</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Student</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase px-3 py-3 w-20">CA /10</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase px-3 py-3 w-20">Test /30</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase px-3 py-3 w-20">Exam /60</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase px-3 py-3 w-20">Total</th>
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase px-3 py-3 w-16">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, idx) => {
                    const isOut = !!excluded[s.id];
                    const total = getTotal(s.id);
                    const { grade, color } = getGrade(total);
                    return (
                      <tr key={s.id} className={`transition-colors ${isOut ? 'bg-slate-50/80 opacity-60' : `hover:bg-slate-50/60 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" checked={!isOut} onChange={() => toggleExclude(s.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer"
                            title={isOut ? 'Check to restore: student offers this subject' : 'Uncheck to mark: student does not offer this subject'} />
                        </td>
                        <td className="px-5 py-2.5">
                          <button onClick={() => navigate(`/student-profile?id=${s.id}`)} className="text-left hover:text-emerald-600 transition-colors group">
                            <p className={`text-sm font-medium ${isOut ? 'text-slate-500 line-through' : 'text-slate-800 group-hover:text-emerald-600'}`}>{s.last_name}, {s.first_name}</p>
                            {s.admission_number && <p className="text-xs text-slate-400">{s.admission_number}</p>}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max="10" disabled={isOut}
                            value={isOut ? '' : (grades[s.id]?.['ca1_score'] ?? '')}
                            onChange={e => updateGrade(s.id, 'ca1_score', e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white disabled:bg-slate-100 disabled:text-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max="30" disabled={isOut}
                            value={isOut ? '' : (grades[s.id]?.['ca3_score'] ?? '')}
                            onChange={e => updateGrade(s.id, 'ca3_score', e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white disabled:bg-slate-100 disabled:text-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max="60" disabled={isOut}
                            value={isOut ? '' : (grades[s.id]?.['exam_score'] ?? '')}
                            onChange={e => updateGrade(s.id, 'exam_score', e.target.value)}
                            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white disabled:bg-slate-100 disabled:text-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-sm font-bold ${isOut ? 'text-slate-300' : 'text-slate-800'}`}>{isOut ? '—' : total}</span>
                        </td>
                        <td className={`px-3 py-2 text-center font-bold text-sm ${isOut ? 'text-slate-300' : color}`}>{isOut ? '—' : grade}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {saveError && (
            <div className="mx-5 my-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {isAdmin ? 'Scores saved directly to student records. Unticked students are excluded from results.' : 'Scores are saved per subject. Class teacher will compile the final results.'}
            </p>
            <button onClick={saveScores} disabled={saving || students.length === 0}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              {saved
                ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                : <><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Scores'}<ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {!selectedSubject && subjectStatuses.length === 0 && !loadingStatuses && selectedClass && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No subjects assigned</p>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? 'No subjects have been assigned to this class yet.' : 'Contact your administrator to assign subjects to you for this class.'}
          </p>
        </div>
      )}
    </div>
  );
}