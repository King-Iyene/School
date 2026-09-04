import { useState, useEffect } from 'react';
import { Save, Printer, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getWAECGrade } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';

interface Exam {
  id: string;
  name: string;
  term_id: string | null;
  academic_year_id: string | null;
}
interface ClassItem { id: string; name: string; }
interface Subject { id: string; name: string; }

interface StudentRow {
  student_id: string;
  enrollment_id: string;
  full_name: string;
  admission_number?: string;
  record_id?: string;
  ca: string;
  test: string;
  exam: string;
  is_absent: boolean;
  offers: boolean;
  exclusion_id?: string;
  status: 'complete' | 'pending_exam' | 'not_started';
}


function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function MarksRegister() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultsLocked, setResultsLocked] = useState(false);
  // Only the Super Admin or Principal may edit scores after results are published
  const canEditPublished = profile?.role === 'super_admin' || profile?.role === 'principal';
  const [generatingCards, setGeneratingCards] = useState(false);
  const [showStatus, setShowStatus] = useState<'success' | 'error' | null>(null);

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (schoolId) fetchMeta();
  }, [schoolId]);

  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [selectedExam, selectedClass, selectedSubject]);

  async function fetchMeta() {
    const [examRes, classRes, subjectRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, name, term_id, academic_year_id')
        .eq('school_id', schoolId)
        .neq('status', 'completed')
        .order('name'),
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
    ]);
    if (examRes.data) setExams(examRes.data);
    if (classRes.data) setClasses(classRes.data);
    if (subjectRes.data) setSubjects(subjectRes.data);
  }

  async function fetchStudents() {
    setLoading(true);
    const selectedExamData = exams.find(e => e.id === selectedExam);
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('id, student_id, students(first_name, last_name, admission_number)')
      .eq('class_id', selectedClass)
      .eq('status', 'active')
      .order('students(first_name)');

    if (!enrollments) { setStudents([]); setLoading(false); return; }

    const studentIds = enrollments.map((e) => e.student_id);
    const [recordsRes, exclusionRes, pubRes] = await Promise.all([
      supabase
        .from('exam_marks_records')
        .select('id, student_id, ca1, ca3, exam, is_absent')
        .eq('exam_name_id', selectedExam)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .in('student_id', studentIds),
      selectedExamData?.academic_year_id
        ? supabase
            .from('student_subject_exclusions')
            .select('id, student_id, term_id')
            .eq('subject_id', selectedSubject)
            .eq('academic_year_id', selectedExamData.academic_year_id)
            .in('student_id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
      selectedExamData?.term_id && selectedExamData?.academic_year_id
        ? supabase
            .from('result_compilations')
            .select('status')
            .eq('class_id', selectedClass)
            .eq('term_id', selectedExamData.term_id)
            .eq('academic_year_id', selectedExamData.academic_year_id)
            .eq('status', 'published')
            .maybeSingle()
        : Promise.resolve({ data: null as any }),
    ]);

    setResultsLocked(!!pubRes.data && !canEditPublished);

    const recordMap: Record<string, any> = {};
    (recordsRes.data ?? []).forEach((r: any) => { recordMap[r.student_id] = r; });
    // Only exclusions that apply to this exam's term: term_id null = whole year.
    const examTermId = selectedExamData?.term_id ?? null;
    const exMap: Record<string, string> = {};
    (exclusionRes.data ?? []).forEach((e: any) => {
      if (e.term_id != null && e.term_id !== examTermId) return;
      // Prefer the term-specific exclusion id over a year-wide one if both exist
      if (!exMap[e.student_id] || e.term_id != null) exMap[e.student_id] = e.id;
    });

    setStudents(enrollments.map((e) => {
      const s = e.students as any;
      const rec = recordMap[e.student_id];
      const exId = exMap[e.student_id];
      const hasCaOrTest = rec && ((rec.ca1 ?? 0) > 0 || (rec.ca3 ?? 0) > 0);
      const hasExam = rec && (rec.exam ?? 0) > 0;
      const status: StudentRow['status'] = !rec
        ? 'not_started'
        : hasExam
        ? 'complete'
        : hasCaOrTest
        ? 'pending_exam'
        : 'not_started';
      return {
        student_id: e.student_id,
        enrollment_id: e.id,
        full_name: s ? `${s.first_name} ${s.last_name}` : 'Unknown',
        admission_number: s?.admission_number ?? '',
        record_id: rec?.id,
        ca: rec ? String(rec.ca1 ?? '') : '',
        test: rec ? String(rec.ca3 ?? '') : '',
        exam: rec ? String(rec.exam ?? '') : '',
        is_absent: rec?.is_absent ?? false,
        offers: !exId,
        exclusion_id: exId,
        status,
      };
    }));
    setLoading(false);
  }

  async function toggleOffers(idx: number) {
    if (resultsLocked) return;
    const student = students[idx];
    const selectedExamData = exams.find(e => e.id === selectedExam);
    if (!schoolId || !selectedExamData?.academic_year_id) return;

    setShowStatus(null);
    if (student.offers) {
      // Mark as not offering. Scores are KEPT — the exclusion flags them as not counted.
      const { data, error } = await supabase.from('student_subject_exclusions').insert({
        school_id: schoolId,
        student_id: student.student_id,
        subject_id: selectedSubject,
        class_id: selectedClass,
        academic_year_id: selectedExamData.academic_year_id,
        term_id: selectedExamData.term_id,
        reason: 'Does not offer this subject',
        created_by: profile?.id,
      }).select('id').maybeSingle();

      // Only flip local state after the mutation succeeds; otherwise keep prior state.
      if (error) {
        console.error(error);
        setShowStatus('error');
        return;
      }
      updateStudent(idx, 'offers', false);
      updateStudent(idx, 'exclusion_id', data?.id);
    } else {
      if (student.exclusion_id) {
        const { error } = await supabase.from('student_subject_exclusions').delete().eq('id', student.exclusion_id);
        if (error) {
          console.error(error);
          setShowStatus('error');
          return;
        }
      }
      updateStudent(idx, 'offers', true);
      updateStudent(idx, 'exclusion_id', undefined);
    }
  }

  function updateStudent(index: number, field: keyof StudentRow, value: any) {
    const updated = [...students];
    (updated[index] as any)[field] = value;
    setStudents(updated);
  }

  function calcTotal(row: StudentRow): number {
    return (parseFloat(row.ca) || 0) + (parseFloat(row.test) || 0) + (parseFloat(row.exam) || 0);
  }

  async function handleSaveAll() {
    if (!selectedExam || !selectedClass || !selectedSubject || resultsLocked) return;
    setSaving(true);
    setShowStatus(null);

    const selectedExamData = exams.find(e => e.id === selectedExam);

    const upserts = students
      .filter(s => s.offers && !s.is_absent)
      .filter(s => (parseFloat(s.ca) || 0) > 0 || (parseFloat(s.test) || 0) > 0 || (parseFloat(s.exam) || 0) > 0 || s.record_id)
      .map((s) => {
        const caVal = parseFloat(s.ca) || 0;
        const testVal = parseFloat(s.test) || 0;
        const examVal = parseFloat(s.exam) || 0;
        return {
          school_id: schoolId,
          exam_name_id: selectedExam,
          class_id: selectedClass,
          subject_id: selectedSubject,
          student_id: s.student_id,
          ca1: caVal,
          ca2: 0,
          ca3: testVal,
          exam: examVal,
          total: caVal + testVal + examVal,
          is_absent: false,
        };
      });
    // Also save absent students who have a record
    const absentUpserts = students
      .filter(s => s.offers && s.is_absent)
      .map((s) => ({
        school_id: schoolId,
        exam_name_id: selectedExam,
        class_id: selectedClass,
        subject_id: selectedSubject,
        student_id: s.student_id,
        ca1: 0, ca2: 0, ca3: 0, exam: 0, total: 0,
        is_absent: true,
      }));
    const allUpserts = [...upserts, ...absentUpserts];

    const { error } = await supabase
      .from('exam_marks_records')
      .upsert(allUpserts, { onConflict: 'exam_name_id,student_id,subject_id' });

    if (!error && selectedExamData?.term_id && selectedExamData?.academic_year_id) {
      const gradesUpserts = students.filter(s => s.offers && !s.is_absent).filter(s => (parseFloat(s.ca)||0)>0||(parseFloat(s.test)||0)>0||(parseFloat(s.exam)||0)>0||s.record_id).map((s) => {
        const caVal = parseFloat(s.ca) || 0;
        const testVal = parseFloat(s.test) || 0;
        const examVal = parseFloat(s.exam) || 0;
        const total = caVal + testVal + examVal;
        return {
          school_id: schoolId,
          student_id: s.student_id,
          class_id: selectedClass,
          subject_id: selectedSubject,
          term_id: selectedExamData.term_id,
          academic_year_id: selectedExamData.academic_year_id,
          ca1_score: caVal,
          ca2_score: 0,
          ca3_score: testVal,
          exam_score: examVal,
          total_score: total,
          grade: getWAECGrade(total).grade,
          updated_at: new Date().toISOString(),
        };
      });
      await supabase
        .from('grades')
        .upsert(gradesUpserts, { onConflict: 'student_id,subject_id,term_id' });
    }

    setSaving(false);
    if (error) {
      console.error(error);
      setShowStatus('error');
    } else {
      setShowStatus('success');
      fetchStudents();
      setTimeout(() => setShowStatus(null), 3000);
    }
  }

  async function handleGenerateResultCards() {
    if (!selectedExam || !selectedClass) return;
    setGeneratingCards(true);
    const selectedExamData = exams.find(e => e.id === selectedExam);
    const [schoolRes, enrollRes, marksRes, exclusionRes] = await Promise.all([
      supabase.from('schools').select('name, address, phone, motto').eq('id', profile?.school_id ?? '').maybeSingle(),
      supabase.from('student_enrollments').select('id, student_id, students(first_name, last_name, admission_number)').eq('class_id', selectedClass).eq('status', 'active'),
      supabase.from('exam_marks_records').select('student_id, subject_id, ca1, ca3, exam, is_absent').eq('exam_name_id', selectedExam).eq('class_id', selectedClass),
      selectedExamData?.academic_year_id
        ? supabase.from('student_subject_exclusions').select('student_id, subject_id, term_id').eq('academic_year_id', selectedExamData.academic_year_id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    // Term-aware: term_id null = whole year, else must match this exam's term.
    const examTermId = selectedExamData?.term_id ?? null;
    const exclusionSet = new Set<string>(
      (exclusionRes.data ?? [])
        .filter((e: any) => e.term_id == null || e.term_id === examTermId)
        .map((e: any) => `${e.student_id}:${e.subject_id}`)
    );
    const isExcluded = (sid: string, subj: string) => exclusionSet.has(`${sid}:${subj}`);
    setGeneratingCards(false);

    const school = schoolRes.data;
    const enrollments = enrollRes.data ?? [];
    const allMarks = marksRes.data ?? [];
    const examName = exams.find(e => e.id === selectedExam)?.name ?? 'Exam';
    const className = classes.find(c => c.id === selectedClass)?.name ?? 'Class';

    const subjectMap: Record<string, string> = {};
    subjects.forEach(s => { subjectMap[s.id] = s.name; });

    const subjectIds = [...new Set(allMarks.map(m => m.subject_id))];

    const studentTotals: Record<string, number> = {};
    const studentAverages: Record<string, number> = {};
    enrollments.forEach(e => {
      // A compiled record counts even when its total is 0 (missed exam). Only absent
      // and excluded records are skipped.
      const scoringSubjects = allMarks.filter(m => m.student_id === e.student_id && !m.is_absent && !isExcluded(e.student_id, m.subject_id));
      const total = scoringSubjects.reduce((sum, m) => sum + (m.ca1 || 0) + (m.ca3 || 0) + (m.exam || 0), 0);
      studentTotals[e.student_id] = total;
      studentAverages[e.student_id] = scoringSubjects.length > 0 ? total / scoringSubjects.length : 0;
    });

    const sorted = [...enrollments].sort((a, b) => (studentAverages[b.student_id] || 0) - (studentAverages[a.student_id] || 0));
    const positionMap: Record<string, number> = {};
    let curPos = 1;
    sorted.forEach((e, idx) => {
      if (idx > 0 && studentAverages[e.student_id] < studentAverages[sorted[idx - 1].student_id]) curPos = idx + 1;
      positionMap[e.student_id] = curPos;
    });

    // Per-subject class positions and class sizes (compiled, non-absent, non-excluded records).
    const subjectPositionMap: Record<string, Record<string, number>> = {};
    const subjectClassSizeMap: Record<string, number> = {};
    subjectIds.forEach(sid => {
      const recs = allMarks
        .filter(m => m.subject_id === sid && !m.is_absent && !isExcluded(m.student_id, m.subject_id))
        .map(m => ({ student_id: m.student_id, total: (m.ca1 || 0) + (m.ca3 || 0) + (m.exam || 0) }))
        .sort((a, b) => b.total - a.total);
      subjectClassSizeMap[sid] = recs.length;
      let pos = 1;
      recs.forEach((r, idx) => {
        if (idx > 0 && r.total < recs[idx - 1].total) pos = idx + 1;
        if (!subjectPositionMap[r.student_id]) subjectPositionMap[r.student_id] = {};
        subjectPositionMap[r.student_id][sid] = pos;
      });
    });

    const origin = window.location.origin;
    const schoolName = settings.school_name || 'School Portal';
    const logoSrc = settings.logo_url || `${origin}/default-logo.png`;
    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`]
      .filter(Boolean)
      .join(' | ');
    const cardsHTML = enrollments.map(e => {
      const s = e.students as any;
      const studentName = s ? `${s.first_name} ${s.last_name}` : 'Unknown';
      const admNumber = s?.admission_number ?? '\u2014';
      const studentMarks = allMarks.filter(m => m.student_id === e.student_id);
      const totalScore = studentTotals[e.student_id] || 0;
      const subjectCount = studentMarks.filter(m => !m.is_absent && !isExcluded(e.student_id, m.subject_id)).length;
      const average = subjectCount > 0 ? (totalScore / subjectCount).toFixed(1) : '0.0';
      const position = positionMap[e.student_id] ?? 1;

      const studentSubjectPos = subjectPositionMap[e.student_id] ?? {};
      const subjectRows = subjectIds.map(sid => {
        const rec = studentMarks.find(m => m.subject_id === sid);
        // Skip subjects with no record
        if (!rec) return '';
        if (rec.is_absent) {
          return `<tr><td>${subjectMap[sid] || 'Subject'}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td class="remark-abs">ABS</td></tr>`;
        }
        const total = (rec.ca1 || 0) + (rec.ca3 || 0) + (rec.exam || 0);
        // A compiled record (even total 0 = missed exam) displays and counts.
        // Excluded subjects render exactly like normal rows — no visible marker —
        // but are already skipped from totals/averages/positions above.
        const { grade, remark } = getWAECGrade(total);
        const gradeClass = grade.startsWith('A') ? 'grade-a' : grade.startsWith('B') ? 'grade-b' : grade.startsWith('C') ? 'grade-c' : grade === 'D7' || grade === 'E8' ? 'grade-d' : 'grade-f';
        const pos = studentSubjectPos[sid];
        const classSize = subjectClassSizeMap[sid] ?? '-';
        const posText = pos != null ? `${getOrdinal(pos)}/${classSize}` : '-';
        return `<tr>
          <td>${subjectMap[sid] || 'Subject'}</td>
          <td class="num">${rec.ca1 ?? '-'}</td>
          <td class="num">${rec.ca3 ?? '-'}</td>
          <td class="num">${rec.exam ?? '-'}</td>
          <td class="num total-col">${total}</td>
          <td class="num pos-col">${posText}</td>
          <td class="${gradeClass}">${grade} - ${remark}</td>
        </tr>`;
      }).join('');

      return `<div class="card">
        <div class="header">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px">
            <img src="${logoSrc}" alt="${schoolName} Logo" style="width:68px;height:68px;object-fit:contain"/>
            <div style="flex:1;text-align:center;padding:0 12px">
              <div style="font-size:17pt;font-weight:900;letter-spacing:1.5px;color:${primaryColor};font-family:'Times New Roman',serif;line-height:1.1">${schoolName.toUpperCase()}</div>
              ${settings.motto ? `<div style="font-size:8.5pt;font-style:italic;color:${secondaryColor};font-weight:600;margin:3px 0">${settings.motto}</div>` : ''}
              ${settings.address ? `<div style="font-size:8pt;color:#333;line-height:1.4">${settings.address}</div>` : ''}
              <div style="font-size:8pt;font-weight:bold;color:${primaryColor};margin-top:2px">Office of the Principal</div>
              ${contactLine ? `<div style="font-size:7pt;color:#555;margin-top:2px">${contactLine}</div>` : ''}
            </div>
            <div style="width:63px"></div>
          </div>
          <div style="border-top:3px solid ${primaryColor};border-bottom:1px solid ${secondaryColor};height:4px;margin:0 0 8px 0"></div>
          <div class="report-title">STUDENT RESULT CARD &mdash; ${examName.toUpperCase()}</div>
        </div>
        <div class="info-grid">
          <div><span class="lbl">Student Name:</span> ${studentName}</div>
          <div><span class="lbl">Admission No.:</span> ${admNumber}</div>
          <div><span class="lbl">Class:</span> ${className}</div>
          <div><span class="lbl">Exam:</span> ${examName}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Subject</th><th>CA (10)</th><th>Test (30)</th><th>Exam (60)</th><th>Total (100)</th><th>Position</th><th>Grade &amp; Remark</th>
            </tr>
          </thead>
          <tbody>${subjectRows}</tbody>
        </table>
        <div class="summary-row">
          <div class="summary-item"><span class="lbl">Total Score:</span> <strong>${totalScore}</strong></div>
          <div class="summary-item"><span class="lbl">Average:</span> <strong>${average}</strong></div>
          <div class="summary-item"><span class="lbl">Position:</span> <strong>${getOrdinal(position)} of ${enrollments.length}</strong></div>
          <div class="summary-item"><span class="lbl">Subjects:</span> <strong>${subjectCount}</strong></div>
        </div>
        <div class="grading-key">
          <strong>Grading Key:</strong> A1=75-100 (Excellent), B2=70-74 (Very Good), B3=65-69 (Good),
          C4=60-64, C5=55-59, C6=50-54 (Credit), D7=45-49, E8=40-44 (Pass), F9=0-39 (Fail)
        </div>
        <div class="comments-section">
          <div class="comment-box">
            <div class="lbl">Form Master's Comment:</div>
            <div class="comment-line"></div><div class="comment-line"></div>
          </div>
          <div class="comment-box" style="margin-top:8px">
            <div class="lbl">Principal's Comment:</div>
            <div class="comment-line"></div><div class="comment-line"></div>
          </div>
        </div>
        <div class="signatures">
          <div class="sig-item"><div class="sig-line"></div><div>Form Master's Signature &amp; Date</div></div>
          <div class="sig-item"><div class="stamp-box">School Stamp</div></div>
          <div class="sig-item"><div class="sig-line"></div><div>Principal's Signature &amp; Date</div></div>
        </div>
      </div>`;
    }).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Result Cards &mdash; ${className} &mdash; ${examName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 13px; background: #fff; color: #000; }
    .card { border: 2px solid #000; padding: 18px 22px; margin: 0 auto 30px; max-width: 740px; }
    @media print {
      body { padding: 0; }
      .card { page-break-after: always; margin: 0 auto; border: 2px solid #000; }
      .card:last-child { page-break-after: auto; }
      .no-print { display: none; }
    }
    .header { margin-bottom: 12px; }
    .report-title { font-size: 14px; font-weight: bold; margin-top: 8px; background: #1a1a1a; color: #fff; padding: 4px 10px; display: inline-block; letter-spacing: 0.5px; text-align: center; width: 100%; box-sizing: border-box; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin: 10px 0; font-size: 13px; border: 1px solid #ccc; padding: 8px 10px; background: #f9f9f9; }
    .lbl { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
    th, td { border: 1px solid #555; padding: 5px 7px; }
    th { background: #e8e8e8; font-weight: bold; text-align: center; font-size: 11px; text-transform: uppercase; }
    td.num { text-align: center; }
    td.total-col { font-weight: bold; background: #f5f5f5; }
    td.grade-a { color: #0a6a0a; font-weight: bold; }
    td.grade-b { color: #004d99; font-weight: bold; }
    td.grade-c { color: #7a5200; font-weight: bold; }
    td.grade-d { color: #8a5e00; }
    td.grade-f { color: #c0392b; font-weight: bold; }
    td.remark-abs { color: #888; font-style: italic; }
    td.pos-col { font-weight: bold; color: #1a3a5c; font-size: 11px; }
    .summary-row { display: flex; justify-content: space-around; border: 1px solid #000; padding: 7px 10px; margin: 8px 0; background: #f0f0f0; }
    .summary-item { font-size: 13px; }
    .grading-key { font-size: 10px; color: #555; margin: 6px 0; border-top: 1px dashed #ccc; padding-top: 5px; }
    .comments-section { margin: 10px 0; }
    .comment-box { border: 1px solid #aaa; padding: 7px 10px; }
    .comment-line { border-bottom: 1px dotted #aaa; height: 20px; margin-top: 4px; }
    .signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; }
    .sig-item { text-align: center; width: 200px; font-size: 11px; }
    .sig-line { border-top: 1px solid #000; width: 160px; margin: 0 auto 5px; padding-top: 3px; }
    .stamp-box { border: 2px solid #999; width: 100px; height: 70px; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #aaa; font-style: italic; }
    .print-btn { display: block; margin: 20px auto; padding: 10px 30px; font-size: 15px; background: #059669; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">Print All Result Cards</button>
  ${cardsHTML}
</body>
</html>`);
    win.document.close();
  }

  const inputClass = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';
  const cellInputClass = 'border border-app-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-center font-bold';
  const allSelected = selectedExam && selectedClass && selectedSubject;
  const canGenerate = selectedExam && selectedClass;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Marks Register</h1>
          <p className="text-sm text-app-text-muted mt-0.5">Enter student marks — CA (10) + Test (30) + Exam (60) = 100</p>
        </div>
        <div className="flex items-center gap-3">
          {showStatus === 'success' && (
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm animate-in fade-in slide-in-from-right-4">
              <CheckCircle size={16} /> Marks saved successfully
            </div>
          )}
          {showStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-red-600 font-medium text-sm animate-in fade-in slide-in-from-right-4">
              <AlertCircle size={16} /> Failed to save marks
            </div>
          )}
          {canGenerate && (
            <button
              onClick={handleGenerateResultCards}
              disabled={generatingCards}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Printer size={16} />
              {generatingCards ? 'Generating...' : 'Generate Result Cards'}
            </button>
          )}
          {allSelected && (
            <button
              onClick={handleSaveAll}
              disabled={saving || students.length === 0 || resultsLocked}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 active:scale-95"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save All Marks'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-5 mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">Select Exam</label>
            <select className={inputClass} value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
              <option value="">Choose an exam...</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">Select Class</label>
            <select className={inputClass} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">Choose a class...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-app-text-muted uppercase tracking-wider mb-1.5 ml-1">Select Subject</label>
            <select className={inputClass} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              <option value="">Choose a subject...</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !allSelected ? (
        <div className="text-center py-24 bg-app-surface-alt rounded-2xl border border-dashed border-app-border">
          <Printer size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-app-text-muted">Configuration Required</p>
          <p className="text-sm text-app-text-muted mt-1">Please select an exam, class, and subject to begin mark entry.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-24 bg-app-surface-alt rounded-2xl border border-dashed border-app-border">
          <p className="text-lg font-medium text-app-text-muted">No students enrolled</p>
          <p className="text-sm text-app-text-muted mt-1">No active student enrollments found for the selected class.</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
          {resultsLocked && (
            <div className="flex items-center gap-2 px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-700 font-medium">
              Results for this class and term have been published — scores are locked. Only the Super Admin or Principal can make changes.
            </div>
          )}
          {/* Summary bar */}
          {(() => {
            const offering = students.filter(s => s.offers && !s.is_absent);
            const complete = offering.filter(s => s.status === 'complete').length;
            const pending = offering.filter(s => s.status === 'pending_exam').length;
            const notStarted = offering.filter(s => s.status === 'not_started').length;
            return (
              <div className="flex items-center gap-4 px-6 py-3 border-b border-app-border bg-app-surface-alt text-xs font-semibold">
                <span className="text-app-text-muted">{offering.length} students</span>
                <span className="flex items-center gap-1.5 text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{complete} Complete</span>
                <span className="flex items-center gap-1.5 text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{pending} Pending Exam</span>
                <span className="flex items-center gap-1.5 text-app-text-muted"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />{notStarted} Not Started</span>
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-6 py-4 font-bold text-app-text">#</th>
                  <th className="text-center px-3 py-4 font-bold text-app-text" title="Tick if student offers this subject">Offers</th>
                  <th className="text-left px-4 py-4 font-bold text-app-text">Student Name</th>
                  <th className="text-center px-3 py-4 font-bold text-app-text">
                    <div>CA</div>
                    <div className="text-xs font-normal text-app-text-muted">max 10</div>
                  </th>
                  <th className="text-center px-3 py-4 font-bold text-app-text">
                    <div>Test</div>
                    <div className="text-xs font-normal text-app-text-muted">max 30</div>
                  </th>
                  <th className="text-center px-3 py-4 font-bold text-app-text">
                    <div>Exam</div>
                    <div className="text-xs font-normal text-app-text-muted">max 60</div>
                  </th>
                  <th className="text-center px-3 py-4 font-bold text-app-text">Total (100)</th>
                  <th className="text-center px-3 py-4 font-bold text-app-text">Grade</th>
                  <th className="text-center px-3 py-4 font-bold text-app-text">Status</th>
                  <th className="text-center px-6 py-4 font-bold text-app-text">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {students.map((student, idx) => ({ student, idx })).filter(x => x.student.offers).map(({ student, idx }, displayIdx) => {
                  const total = calcTotal(student);
                  const { grade } = getWAECGrade(total);
                  const gradeColor = grade.startsWith('A') ? 'text-emerald-600 bg-emerald-50' : grade.startsWith('B') ? 'text-blue-600 bg-blue-50' : grade.startsWith('C') ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
                  return (
                    <tr key={student.student_id} className={`hover:bg-app-surface-alt transition-colors ${!student.offers ? 'bg-slate-100/60 opacity-60' : student.is_absent ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4 text-app-text-muted font-medium">{displayIdx + 1}</td>
                      <td className="px-3 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={student.offers}
                          disabled={resultsLocked}
                          onChange={() => toggleOffers(idx)}
                          className="w-4 h-4 rounded border-app-border text-emerald-600 focus:ring-emerald-500/30 cursor-pointer disabled:cursor-not-allowed"
                          title={student.offers ? 'Uncheck to mark: student does not offer this subject' : 'Check to restore: student offers this subject'}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className={`font-semibold ${student.offers ? 'text-app-text' : 'text-app-text-muted line-through'}`}>{student.full_name}</div>
                        <div className="text-[10px] text-app-text-muted font-medium">ADM: {student.admission_number || '\u2014'}</div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <input
                          type="number"
                          className={`${cellInputClass} w-16 ${student.is_absent ? 'opacity-30' : 'text-app-text'}`}
                          value={student.ca}
                          disabled={student.is_absent || !student.offers || resultsLocked}
                          onChange={(e) => updateStudent(idx, 'ca', e.target.value)}
                          placeholder="0"
                          min="0"
                          max="10"
                        />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <input
                          type="number"
                          className={`${cellInputClass} w-16 ${student.is_absent ? 'opacity-30' : 'text-app-text'}`}
                          value={student.test}
                          disabled={student.is_absent || !student.offers || resultsLocked}
                          onChange={(e) => updateStudent(idx, 'test', e.target.value)}
                          placeholder="0"
                          min="0"
                          max="30"
                        />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <input
                          type="number"
                          className={`${cellInputClass} w-16 ${student.is_absent ? 'opacity-30' : 'text-app-text'}`}
                          value={student.exam}
                          disabled={student.is_absent || !student.offers || resultsLocked}
                          onChange={(e) => updateStudent(idx, 'exam', e.target.value)}
                          placeholder="0"
                          min="0"
                          max="60"
                        />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-base font-black ${!student.offers || student.is_absent ? 'text-slate-300' : 'text-app-text'}`}>
                          {!student.offers ? 'N/O' : student.is_absent ? '\u2014' : total}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        {student.offers && !student.is_absent && total > 0 && (
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tight ${gradeColor}`}>{grade}</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-center">
                        {!student.offers ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-app-text-muted">N/O</span>
                        ) : student.is_absent ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-500">Absent</span>
                        ) : student.status === 'complete' ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">✓ Complete</span>
                        ) : student.status === 'pending_exam' ? (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">⏳ Pending Exam</span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-app-text-muted">Not Started</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          disabled={!student.offers || resultsLocked}
                          onClick={() => updateStudent(idx, 'is_absent', !student.is_absent)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border ${
                            student.is_absent
                              ? 'bg-red-500 text-white border-red-500 shadow-sm shadow-red-200'
                              : 'bg-app-surface text-app-text-muted border-app-border hover:border-red-200 hover:text-red-500'
                          }`}
                        >
                          {student.is_absent ? 'ABSENT' : 'PRESENT'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {students.some(s => !s.offers) && (
            <div className="border-t border-app-border bg-app-surface-alt px-6 py-4">
              <p className="text-xs font-bold text-app-text-muted uppercase tracking-wide mb-2">
                Not offering this subject ({students.filter(s => !s.offers).length})
              </p>
              <div className="flex flex-wrap gap-2">
                {students.map((student, idx) => !student.offers && (
                  <span key={student.student_id} className="inline-flex items-center gap-2 bg-app-surface border border-app-border rounded-full pl-3 pr-1.5 py-1 text-xs text-app-text-muted">
                    {student.full_name}
                    <button
                      onClick={() => toggleOffers(idx)}
                      disabled={resultsLocked}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Restore: student offers this subject"
                    >
                      Restore
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
