import { useEffect, useState, useRef } from 'react';
import { GraduationCap, Users, CheckCircle, AlertCircle, Printer, RefreshCw, Award, Lock } from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface SubjectCol {
  id: string;
  name: string;
  code: string;
  teacherName: string;
  hasScores: boolean;
}

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  scores: Record<string, { ca1: number; ca2: number; ca3: number; exam: number; total: number; grade: string }>;
  aggregate: number;
  average: number;
  position: number;
}

export default function ClassResults() {
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';

  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [terms, setTerms] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  const [subjects, setSubjects] = useState<SubjectCol[]>([]);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [compilation, setCompilation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  useEffect(() => { loadMeta(); }, [profile]);
  useEffect(() => {
    if (selectedClass && selectedTerm && selectedYear) loadResults();
  }, [selectedClass, selectedTerm, selectedYear]);

  async function loadMeta() {
    if (!profile?.id || !profile?.school_id) return;

    const [yearRes, termRes, schoolRes] = await Promise.all([
      supabase.from('academic_years').select('*').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle(),
      supabase.from('terms').select('*').order('name'),
      supabase.from('schools').select('name').eq('id', profile.school_id).maybeSingle(),
    ]);

    const currentYear = yearRes.data;
    const termData = termRes.data ?? [];

    setSchoolName(schoolRes.data?.name ?? '');
    setTerms(termData);
    setAcademicYears(currentYear ? [currentYear] : []);

    if (currentYear) {
      const { data: ayt } = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', currentYear.id)
        .eq('is_current', true)
        .maybeSingle();
      if (ayt?.term_id) setSelectedTerm(ayt.term_id);
    }
    if (currentYear) {
      setSelectedYear(currentYear.id);

      if (isAdmin) {
        // Super Admin, Admin, Principal — see all classes in the school
        const { data: allClasses } = await supabase
          .from('classes')
          .select('id, name, level, section')
          .eq('school_id', profile.school_id)
          .order('name');
        const classList = allClasses ?? [];
        setMyClasses(classList);
        setIsClassTeacher(true);
        if (classList.length > 0) setSelectedClass(classList[0].id);
      } else {
        // Teachers — only Form Master classes
        const [fmTableRes, fmClassesRes] = await Promise.all([
          supabase.from('class_teachers')
            .select('class_id, classes(id, name, level, section)')
            .eq('teacher_id', profile.id)
            .eq('academic_year_id', currentYear.id),
          supabase.from('classes')
            .select('id, name, level, section')
            .eq('class_teacher_id', profile.id),
        ]);

        const combined = [
          ...(fmTableRes.data ?? []).map(d => d.classes),
          ...(fmClassesRes.data ?? []),
        ].filter(Boolean);

        const uniqueClasses = [...new Map(combined.map((c: any) => [c.id, c])).values()];
        setMyClasses(uniqueClasses);
        setIsClassTeacher(uniqueClasses.length > 0);

        if (uniqueClasses.length > 0) {
          setSelectedClass((uniqueClasses[0] as any)?.id);
        }
      }
    }
    setMetaLoaded(true);
  }

  async function loadResults() {
    if (!selectedClass || !selectedYear || !selectedTerm) return;
    setLoading(true);
    try {
      const [subjectRes, enrollRes, gradesRes, compilationRes] = await Promise.all([
        supabase.from('subject_teacher_assignments')
          .select('subject_id, teacher_id, subjects(id, name, code), profiles(first_name, last_name)')
          .eq('class_id', selectedClass)
          .eq('academic_year_id', selectedYear),
        supabase.from('student_enrollments')
          .select('*, students(id, first_name, last_name, admission_number)')
          .eq('class_id', selectedClass)
          .eq('status', 'active')
          .eq('academic_year_id', selectedYear),
        supabase.from('grades')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('term_id', selectedTerm)
          .eq('academic_year_id', selectedYear),
        supabase.from('result_compilations')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('term_id', selectedTerm)
          .eq('academic_year_id', selectedYear)
          .maybeSingle(),
      ]);

      const subjectList = (subjectRes.data ?? []).map(d => {
        const teacher = d.profiles as any;
        return {
          id: (d.subjects as any)?.id,
          name: (d.subjects as any)?.name,
          code: (d.subjects as any)?.code ?? '',
          teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unassigned',
          hasScores: false,
        };
      }).filter(s => s.id);

      const gradeMap: Record<string, Record<string, any>> = {};
      (gradesRes.data ?? []).forEach(g => {
        if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {};
        gradeMap[g.student_id][g.subject_id] = g;
      });

      // A subject is only considered "has scores" if at least one student has a non-zero total.
      // Zero-score placeholder rows (created by earlier saves) should not count as "ready".
      const subjectHasScores = new Set<string>();
      Object.values(gradeMap).forEach(subMap => {
        Object.entries(subMap).forEach(([sid, g]: [string, any]) => {
          const total = (Number(g.ca1_score) || 0) + (Number(g.ca2_score) || 0) + (Number(g.ca3_score) || 0) + (Number(g.exam_score) || 0);
          if (total > 0) subjectHasScores.add(sid);
        });
      });
      const enrichedSubjects = subjectList.map(s => ({ ...s, hasScores: subjectHasScores.has(s.id) }));
      setSubjects(enrichedSubjects);

      const students = (enrollRes.data ?? []).map(e => e.students).filter(Boolean) as any[];

      const rows: StudentRow[] = students.map(s => {
        const scores: StudentRow['scores'] = {};
        let aggregate = 0;
        let subjectCount = 0;
        enrichedSubjects.forEach(sub => {
          const g = gradeMap[s.id]?.[sub.id];
          const ca1 = g?.ca1_score ?? 0;
          const ca2 = g?.ca2_score ?? 0;
          const ca3 = g?.ca3_score ?? 0;
          const exam = g?.exam_score ?? 0;
          const total = ca1 + ca2 + ca3 + exam;
          scores[sub.id] = { ca1, ca2, ca3, exam, total, grade: gradeFromTotal(total) };
          // Only count subjects with non-zero totals toward aggregate/average
          if (g && total > 0) { aggregate += total; subjectCount++; }
        });
        const average = subjectCount > 0 ? aggregate / subjectCount : 0;
        return { id: s.id, firstName: s.first_name, lastName: s.last_name, studentId: s.student_id ?? '', scores, aggregate, average, position: 0 };
      });

      const sorted = [...rows].sort((a, b) => b.average - a.average);
      let pos = 1;
      sorted.forEach((r, i) => {
        if (i > 0 && r.average < sorted[i - 1].average) pos = i + 1;
        r.position = pos;
      });

      setStudentRows(sorted);
      setCompilation(compilationRes.data);
    } finally {
      setLoading(false);
    }
  }

  function gradeFromTotal(total: number): string {
    if (total >= 75) return 'A1';
    if (total >= 70) return 'B2';
    if (total >= 65) return 'B3';
    if (total >= 60) return 'C4';
    if (total >= 55) return 'C5';
    if (total >= 50) return 'C6';
    if (total >= 45) return 'D7';
    if (total >= 40) return 'E8';
    return 'F9';
  }

  function gradeColor(grade: string): string {
    if (grade.startsWith('A')) return 'text-emerald-600 font-bold';
    if (grade.startsWith('B')) return 'text-blue-600 font-bold';
    if (grade.startsWith('C')) return 'text-amber-600 font-semibold';
    return 'text-red-500 font-semibold';
  }

  async function compileResults() {
    if (!profile?.school_id) return;
    setCompiling(true);
    const record = {
      school_id: profile.school_id,
      class_id: selectedClass,
      term_id: selectedTerm,
      academic_year_id: selectedYear,
      compiled_by: profile.id,
      compiled_at: new Date().toISOString(),
      status: compilation?.status === 'compiled' ? 'published' : 'compiled',
      updated_at: new Date().toISOString(),
    };
    await supabase.from('result_compilations').upsert(record, { onConflict: 'class_id,term_id,academic_year_id' });
    await loadResults();
    setCompiling(false);
  }

  function handlePrint() {
    const termName = terms.find(t => t.id === selectedTerm)?.name ?? '';
    const yearName = academicYears.find(y => y.id === selectedYear)?.name ?? '';
    const className = myClasses.find(c => (c as any)?.id === selectedClass);
    const classLabel = className ? ((className as any)?.name || `${(className as any)?.level}${(className as any)?.section}`) : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Class Results - ${classLabel}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 9px; margin: 12px; color: #111; }
  h1 { text-align: center; font-size: 14px; margin: 0 0 2px; }
  h2 { text-align: center; font-size: 11px; font-weight: normal; margin: 0 0 8px; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 3px 4px; text-align: center; white-space: nowrap; }
  th { background: #f0f0f0; font-size: 8px; }
  td.name { text-align: left; min-width: 100px; }
  .pos { font-weight: bold; }
  .total { font-weight: bold; }
  @media print { body { margin: 5mm; } }
</style>
</head>
<body>
<h1>${schoolName}</h1>
<h2>Class Results Broadsheet — ${classLabel} | ${termName} | ${yearName}</h2>
<table>
<thead>
<tr>
  <th>#</th>
  <th class="name" style="text-align:left">Student</th>
  ${subjects.map(s => `<th>${s.name}<br/>(${s.code || '-'})</th>`).join('')}
  <th>Aggregate</th>
  <th>Average</th>
  <th>Position</th>
</tr>
</thead>
<tbody>
${studentRows.map((r, i) => `
<tr>
  <td>${i + 1}</td>
  <td class="name">${r.lastName}, ${r.firstName}</td>
  ${subjects.map(s => {
    const sc = r.scores[s.id];
    return `<td>${sc && sc.total > 0 ? sc.total : '-'}</td>`;
  }).join('')}
  <td class="total">${r.aggregate}</td>
  <td>${r.average.toFixed(1)}</td>
  <td class="pos">${r.position}${ordinalSuffix(r.position)}</td>
</tr>`).join('')}
</tbody>
</table>
<p style="margin-top:10px; font-size:8px; color:#666">Generated: ${new Date().toLocaleString()} | Compiled by: ${profile?.first_name} ${profile?.last_name}</p>
</body>
</html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  function ordinalSuffix(n: number) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  const classLabel = (() => {
    const c = myClasses.find(c => (c as any)?.id === selectedClass);
    return c ? ((c as any)?.name || `${(c as any)?.level}${(c as any)?.section}`) : '';
  })();

  const allSubjectsHaveScores = subjects.length > 0 && subjects.every(s => s.hasScores);
  const pendingSubjects = subjects.filter(s => !s.hasScores);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Class Results</h2>
          <p className="text-slate-500 text-sm">
            {!metaLoaded
              ? 'Loading...'
              : isAdmin
                ? 'View and compile results for any class'
                : isClassTeacher
                  ? 'Compile and manage results for your class'
                  : 'Restricted to Form Masters only'}
          </p>
        </div>
        {isClassTeacher && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <GraduationCap className="w-3.5 h-3.5" /> {isAdmin ? 'All Classes' : 'Form Master'}
          </span>
        )}
      </div>

      {metaLoaded && isClassTeacher && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                {myClasses.map(c => <option key={(c as any)?.id} value={(c as any)?.id}>{(c as any)?.name || `${(c as any)?.level}${(c as any)?.section}`}</option>)}
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
          </div>
        </div>
      )}

      {isClassTeacher && compilation && (
        <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-2 text-sm ${compilation.status === 'published' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          {compilation.status === 'published'
            ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            : <Award className="w-4 h-4 text-amber-600 flex-shrink-0" />}
          <span className={compilation.status === 'published' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
            Results {compilation.status === 'published' ? 'Published' : 'Compiled'}
          </span>
          <span className="text-slate-400 hidden sm:inline">—</span>
          <span className="text-slate-500 text-xs sm:text-sm">{new Date(compilation.compiled_at).toLocaleString()}</span>
        </div>
      )}

      {isClassTeacher && pendingSubjects.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Pending Subject Scores</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {pendingSubjects.map(s => s.name).join(', ')} — scores not yet entered by subject teachers
              </p>
            </div>
          </div>
        </div>
      )}

      {!metaLoaded ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      ) : !isClassTeacher ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center px-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Access</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Class Results are restricted to Form Masters only. You must be assigned as the Form Master of a class to view its results broadsheet.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading results...</p>
        </div>
      ) : studentRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No students enrolled</p>
          <p className="text-slate-400 text-sm mt-1">No active students found in {classLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" ref={printRef}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-slate-800">{classLabel} — Results Broadsheet</h3>
              <p className="text-xs text-slate-400">{studentRows.length} students · {subjects.length} subjects</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isClassTeacher && (
                <button onClick={compileResults} disabled={compiling || studentRows.length === 0}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${compilation?.status === 'compiled' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                  {compiling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span className="hidden sm:inline">{compilation?.status === 'compiled' ? 'Publish Results' : compilation?.status === 'published' ? 'Re-Compile' : 'Compile Results'}</span>
                </button>
              )}
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print Broadsheet</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-100">Student</th>
                  {subjects.map(s => (
                    <th key={s.id} className="text-center px-2 py-3 min-w-[70px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[80px]">{s.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.hasScores ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {s.hasScores ? 'Ready' : 'Pending'}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center text-xs font-semibold text-slate-500 px-3 py-3 bg-slate-100 border-l border-slate-200">Aggregate</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-3 py-3 bg-slate-100">Average</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-3 py-3 bg-slate-100">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentRows.map((row, idx) => (
                  <tr key={row.id} className={`hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                    <td className="px-4 py-2.5 sticky left-0 bg-white border-r border-slate-100 z-10">
                      <button onClick={() => navigate(`/student-profile?id=${row.id}`)} className="text-left hover:text-emerald-600 transition-colors group">
                        <p className="text-sm font-medium text-slate-800 whitespace-nowrap group-hover:text-emerald-600">{row.lastName}, {row.firstName}</p>
                        {row.studentId && <p className="text-xs text-slate-400">{row.studentId}</p>}
                      </button>
                    </td>
                    {subjects.map(s => {
                      const sc = row.scores[s.id];
                      const hasScore = sc && sc.total > 0;
                      return (
                        <td key={s.id} className="px-2 py-2.5 text-center">
                          {hasScore ? (
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-semibold text-slate-800">{sc.total}</span>
                              <span className={`text-xs ${gradeColor(sc.grade)}`}>{sc.grade}</span>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center bg-slate-50/50 border-l border-slate-100">
                      <span className="text-sm font-bold text-slate-800">{row.aggregate}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center bg-slate-50/50">
                      <span className="text-sm text-slate-600">{row.average.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center bg-slate-50/50">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${row.position === 1 ? 'bg-amber-100 text-amber-700' : row.position === 2 ? 'bg-slate-100 text-slate-700' : row.position === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>
                        {row.position}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Class Size: <strong className="text-slate-700">{studentRows.length}</strong></span>
              <span>Subjects: <strong className="text-slate-700">{subjects.length}</strong></span>
              <span>Subjects Ready: <strong className="text-emerald-600">{subjects.filter(s => s.hasScores).length}</strong></span>
              {studentRows.length > 0 && (
                <span>Class Average: <strong className="text-slate-700">
                  {(studentRows.reduce((sum, r) => sum + r.average, 0) / studentRows.length).toFixed(1)}
                </strong></span>
              )}
              {studentRows.length > 0 && (
                <span>Highest Aggregate: <strong className="text-emerald-600">{studentRows[0]?.aggregate}</strong></span>
              )}
            </div>
          </div>
        </div>
      )}

      {isClassTeacher && subjects.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">Subject Teachers Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {subjects.map(s => (
              <div key={s.id} className={`p-3 rounded-xl border ${s.hasScores ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700 truncate">{s.name}</span>
                  {s.hasScores
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-slate-500 truncate">{s.teacherName}</p>
                <p className={`text-xs mt-0.5 font-medium ${s.hasScores ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {s.hasScores ? 'Scores entered' : 'Awaiting scores'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
