import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getOverallRemark, remarkForGrade, principalRemarkForAvg } from '../../lib/grading';
import OGSLetterhead from './OGSLetterhead';

interface Props {
  studentId: string;
  termId?: string;
  academicYearId?: string;
  classId?: string;
  onClose: () => void;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return '\u20A6' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function StudentReportPrint({ studentId, termId, academicYearId, classId: propClassId, onClose }: Props) {
  const [student, setStudent] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjectPositions, setSubjectPositions] = useState<Record<string, { pos: number; size: number }>>({});
  const [subjectAverages, setSubjectAverages] = useState<Record<string, number>>({});
  const [overallRank, setOverallRank] = useState<{ pos: number; size: number } | null>(null);
  const [classOverallAverage, setClassOverallAverage] = useState<number | null>(null);
  const [termInfo, setTermInfo] = useState<{ termName: string; yearName: string } | null>(null);
  const [attendance, setAttendance] = useState<{ present: number; absent: number; late: number; total: number }>({ present: 0, absent: 0, late: 0, total: 0 });
  const [school, setSchool] = useState<any>(null);
  const [comments, setComments] = useState<any>(null);
  const [termSettings, setTermSettings] = useState<any>(null);
  const [outstandingFees, setOutstandingFees] = useState<number>(0);
  const [showFees, setShowFees] = useState(false);
  const [formTeacher, setFormTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [studentId, termId, academicYearId]);

  async function loadData() {
    let enrollQuery = supabase
      .from('student_enrollments')
      .select('*, classes(id, name, level, section, class_teacher_id), academic_years(id, name), terms(id, name)')
      .eq('student_id', studentId)
      .eq('status', 'active');
    if (academicYearId) enrollQuery = (enrollQuery as any).eq('academic_year_id', academicYearId);

    const [studentRes, enrollRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).maybeSingle(),
      (enrollQuery as any).maybeSingle(),
    ]);

    setStudent(studentRes.data);
    setEnrollment(enrollRes.data);

    if (studentRes.data?.school_id) {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name, motto, logo_url, address, phone')
        .eq('id', studentRes.data.school_id)
        .maybeSingle();
      setSchool(schoolData);
    }

    let resolvedTermId = termId;
    let resolvedYearId = academicYearId;

    if (!resolvedTermId) {
      const { data: latestGrade } = await supabase
        .from('grades')
        .select('term_id, academic_year_id, terms(name), academic_years(name)')
        .eq('student_id', studentId)
        .not('total_score', 'is', null)
        .order('academic_year_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestGrade) {
        resolvedTermId = latestGrade.term_id;
        resolvedYearId = latestGrade.academic_year_id;
        setTermInfo({
          termName: (latestGrade.terms as any)?.name ?? '',
          yearName: (latestGrade.academic_years as any)?.name ?? '',
        });
      } else {
        setTermInfo({
          termName: (enrollRes.data?.terms as any)?.name ?? '',
          yearName: (enrollRes.data?.academic_years as any)?.name ?? '',
        });
      }
    } else {
      const [tRes, yRes] = await Promise.all([
        supabase.from('terms').select('name').eq('id', resolvedTermId).maybeSingle(),
        resolvedYearId
          ? supabase.from('academic_years').select('name').eq('id', resolvedYearId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setTermInfo({
        termName: tRes.data?.name ?? (enrollRes.data?.terms as any)?.name ?? '',
        yearName: yRes.data?.name ?? (enrollRes.data?.academic_years as any)?.name ?? '',
      });
    }

    let gradesQuery = supabase
      .from('grades')
      .select('*, subjects(name, code)')
      .eq('student_id', studentId)
      .order('total_score', { ascending: false, nullsFirst: false });

    if (resolvedTermId) gradesQuery = gradesQuery.eq('term_id', resolvedTermId);
    if (resolvedYearId) gradesQuery = gradesQuery.eq('academic_year_id', resolvedYearId);

    const classId = (enrollRes.data?.classes as any)?.id;
    if (classId) gradesQuery = gradesQuery.eq('class_id', classId);

    let classGradesQuery = supabase
      .from('grades')
      .select('student_id, subject_id, total_score, ca1_score, ca3_score, exam_score');
    if (classId) classGradesQuery = classGradesQuery.eq('class_id', classId);
    if (resolvedTermId) classGradesQuery = classGradesQuery.eq('term_id', resolvedTermId);
    if (resolvedYearId) classGradesQuery = classGradesQuery.eq('academic_year_id', resolvedYearId);

    const exclusionsQuery = resolvedYearId
      ? supabase.from('student_subject_exclusions').select('student_id, subject_id, term_id').eq('academic_year_id', resolvedYearId)
      : Promise.resolve({ data: [] as any[] });

    const classEnrollmentsQuery = classId && resolvedYearId
      ? supabase.from('student_enrollments').select('student_id').eq('class_id', classId).eq('academic_year_id', resolvedYearId).eq('status', 'active')
      : Promise.resolve({ data: [] as any[] });

    const [gradesRes, attRes, classGradesRes, exclusionsRes, classEnrollmentsRes] = await Promise.all([
      gradesQuery,
      supabase.from('student_attendance').select('status').eq('student_id', studentId),
      classId ? classGradesQuery : Promise.resolve({ data: [] }),
      exclusionsQuery,
      classEnrollmentsQuery,
    ]);

    // Term-aware: an exclusion applies when term_id is null (whole year) or matches the displayed term.
    const exclusionSet = new Set<string>(
      ((exclusionsRes as any).data ?? [])
        .filter((e: any) => e.term_id == null || e.term_id === resolvedTermId)
        .map((e: any) => `${e.student_id}:${e.subject_id}`)
    );

    // Only rank against students actually enrolled in this class for this year
    const enrolledInClass = new Set(((classEnrollmentsRes as any).data ?? []).map((e: any) => e.student_id));

    const allGrades = gradesRes.data ?? [];
    // A compiled grade row (total 0 = missed exam) still counts. Keep every row that
    // exists in the DB with a non-null total; excluded rows are shown but flagged.
    const filteredGrades = allGrades
      .filter(g => {
        const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
        return total != null && total >= 0;
      })
      .map(g => ({ ...g, _excluded: exclusionSet.has(`${g.student_id}:${g.subject_id}`) }));
    setGrades(filteredGrades);

    const rawClassGrades: any[] = (classGradesRes as any).data ?? [];
    // Filter to enrolled students only (fall back to all if no enrollment data)
    const allClassGrades = enrolledInClass.size > 0
      ? rawClassGrades.filter(g => enrolledInClass.has(g.student_id))
      : rawClassGrades;
    const subjectGroup: Record<string, { studentId: string; total: number }[]> = {};
    for (const g of allClassGrades) {
      if (exclusionSet.has(`${g.student_id}:${g.subject_id}`)) continue;
      const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
      if (total == null) continue; // zero counts; only skip rows with no total at all
      if (!subjectGroup[g.subject_id]) subjectGroup[g.subject_id] = [];
      subjectGroup[g.subject_id].push({ studentId: g.student_id, total });
    }

    const positions: Record<string, { pos: number; size: number }> = {};
    const averages: Record<string, number> = {};
    for (const [sid, entries] of Object.entries(subjectGroup)) {
      const sorted = [...entries].sort((a, b) => b.total - a.total);
      averages[sid] = entries.reduce((s, e) => s + e.total, 0) / entries.length;
      const studentEntry = sorted.find(e => e.studentId === studentId);
      if (studentEntry) {
        const pos = sorted.filter(e => e.total > studentEntry.total).length + 1;
        positions[sid] = { pos, size: sorted.length };
      }
    }
    setSubjectPositions(positions);
    setSubjectAverages(averages);

    const studentSums: Record<string, { sum: number; count: number }> = {};
    for (const g of allClassGrades) {
      if (exclusionSet.has(`${g.student_id}:${g.subject_id}`)) continue;
      const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
      if (total == null) continue; // zero counts; only skip rows with no total at all
      if (!studentSums[g.student_id]) studentSums[g.student_id] = { sum: 0, count: 0 };
      studentSums[g.student_id].sum += total;
      studentSums[g.student_id].count += 1;
    }
    const studentAverages = Object.entries(studentSums).map(([sid, v]) => ({
      sid,
      avg: v.count > 0 ? v.sum / v.count : 0,
    }));
    if (studentAverages.length > 0) {
      const me = studentAverages.find(x => x.sid === studentId);
      if (me) {
        const uniqueHigher = new Set(studentAverages.filter(x => x.avg > me.avg).map(x => x.avg.toFixed(4))).size;
        setOverallRank({ pos: uniqueHigher + 1, size: studentAverages.length });
      } else {
        setOverallRank(null);
      }
      const classMean = studentAverages.reduce((s, x) => s + x.avg, 0) / studentAverages.length;
      setClassOverallAverage(classMean);
    } else {
      setOverallRank(null);
      setClassOverallAverage(null);
    }

    const attData = attRes.data ?? [];
    setAttendance({
      present: attData.filter(a => a.status === 'present').length,
      absent: attData.filter(a => a.status === 'absent').length,
      late: attData.filter(a => a.status === 'late').length,
      total: attData.length,
    });

    if (resolvedTermId && resolvedYearId) {
      const { data: cmtData } = await supabase
        .from('report_card_comments')
        .select('*, form_teacher:form_teacher_signed_by(first_name, last_name), principal:principal_signed_by(first_name, last_name)')
        .eq('student_id', studentId)
        .eq('term_id', resolvedTermId)
        .eq('academic_year_id', resolvedYearId)
        .maybeSingle();
      setComments(cmtData);

      if (classId) {
        const { data: settingsData } = await supabase
          .from('class_term_settings')
          .select('*')
          .eq('class_id', classId)
          .eq('term_id', resolvedTermId)
          .eq('academic_year_id', resolvedYearId)
          .maybeSingle();
        setTermSettings(settingsData);
      }

      if (cmtData?.outstanding_fees_override != null) {
        setOutstandingFees(Number(cmtData.outstanding_fees_override));
      } else {
        // Resolve classId: prop (most reliable) → enrollment → fallback query
        let feeClassId = propClassId || classId;
        if (!feeClassId) {
          const { data: anyEnroll } = await supabase
            .from('student_enrollments')
            .select('classes(id)')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .maybeSingle();
          feeClassId = (anyEnroll?.classes as any)?.id;
        }

        // Build fees_master query scoped to class (or school-wide) + year + term
        const classFilter = feeClassId
          ? `class_id.eq.${feeClassId},class_id.is.null`
          : 'class_id.is.null';
        let fmQuery = supabase
          .from('fees_master')
          .select('id, amount')
          .eq('academic_year_id', resolvedYearId)
          .or(classFilter);
        if (resolvedTermId) fmQuery = (fmQuery as any).or(`term_id.eq.${resolvedTermId},term_id.is.null`);

        const [feesRes, paidRes] = await Promise.all([
          fmQuery,
          supabase
            .from('fees_collections')
            .select('fees_master_id, amount_paid')
            .eq('student_id', studentId),
        ]);

        // Sum amount_paid per fee item, then compute outstanding balance per item
        const paidMap: Record<string, number> = {};
        for (const p of (paidRes.data ?? []) as any[]) {
          paidMap[p.fees_master_id] = (paidMap[p.fees_master_id] || 0) + Number(p.amount_paid || 0);
        }
        const outstanding = ((feesRes.data ?? []) as any[]).reduce((sum, item) => {
          return sum + Math.max(0, Number(item.amount) - (paidMap[item.id] || 0));
        }, 0);
        setOutstandingFees(outstanding);
      }
    }

    const ftId = (enrollRes.data?.classes as any)?.class_teacher_id;
    if (ftId) {
      const { data: ft } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', ftId)
        .maybeSingle();
      setFormTeacher(ft);
    }

    setLoading(false);
    setTimeout(() => window.print(), 600);
  }

  const cls = enrollment?.classes as any;
  const classLabel = cls
    ? cls.name || `${cls.level ?? ''}${cls.section ? ' ' + cls.section : ''}`
    : '—';
  const attPct =
    attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
  const displayTerm = termInfo ?? {
    termName: (enrollment?.terms as any)?.name ?? '',
    yearName: (enrollment?.academic_years as any)?.name ?? '',
  };


  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Generating report card...</p>
        </div>
      </div>
    );
  }

  // Excluded subjects still display but must NOT count toward total/average.
  const countedGrades = grades.filter(g => !g._excluded);
  const hasExcluded = grades.some(g => g._excluded);
  const overallTotal = countedGrades.reduce((sum, g) => {
    const t = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
    return sum + (t || 0);
  }, 0);
  const overallAvg = countedGrades.length > 0 ? overallTotal / countedGrades.length : 0;
  const overallRemark = countedGrades.length > 0 ? getOverallRemark(overallAvg) : '';
  const remarkColor =
    overallAvg >= 80 ? '#0a6a0a' :
    overallAvg >= 70 ? '#15803d' :
    overallAvg >= 60 ? '#b45309' :
    overallAvg >= 50 ? '#a16207' :
    overallAvg >= 40 ? '#c2410c' : '#b91c1c';

  const formTeacherName = formTeacher
    ? `${formTeacher.first_name ?? ''} ${formTeacher.last_name ?? ''}`.trim()
    : '';

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body * { visibility: hidden !important; }
          #print-report, #print-report * { visibility: visible !important; }
          #print-report {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-page { padding: 0 !important; }
          .print-card { page-break-inside: avoid; }
        }
        @media screen {
          #print-report {
            position: fixed;
            inset: 0;
            background: white;
            z-index: 100;
            overflow-y: auto;
            padding: 16px;
          }
        }
        .print-page {
          max-width: 794px;
          margin: 0 auto;
          font-family: 'Times New Roman', serif;
          font-size: 9pt;
          color: #1a1a1a;
          line-height: 1.25;
        }
        .print-table { width: 100%; border-collapse: collapse; }
        .print-table th, .print-table td { border: 1px solid #aaa; padding: 2px 4px; font-size: 8.5pt; line-height: 1.2; }
        .print-table th { background: #f0fdf4; font-weight: bold; }
        .info-row { display: flex; justify-content: space-between; padding: 1px 0; font-size: 8.5pt; }
        .section-title {
          font-weight: bold; font-size: 8.5pt; color: #15803d;
          margin-bottom: 3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;
          letter-spacing: 0.3px;
        }
      `}</style>

      <div id="print-report">
        <div className="print-page">
          <div className="flex items-center justify-between mb-3 print:hidden">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showFees}
                onChange={e => setShowFees(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              Show outstanding fees
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Print / Save PDF
              </button>
            </div>
          </div>

          <div className="print-card" style={{ border: '2px double #1a3a5c', padding: '8px 10px', background: '#fff' }}>
            <OGSLetterhead compact />

            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <div
                style={{
                  fontSize: '10pt',
                  fontWeight: 'bold',
                  background: '#1a3a5c',
                  color: 'white',
                  padding: '2px 14px',
                  display: 'inline-block',
                  borderRadius: '3px',
                  letterSpacing: '0.5px',
                }}
              >
                STUDENT ACADEMIC REPORT
              </div>
              <span style={{ fontSize: '8.5pt', color: '#555', marginLeft: '8px' }}>
                {displayTerm.yearName} &middot; {displayTerm.termName || 'All Terms'}
              </span>
            </div>

            {/* Student info + class info combined into one tight grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
              marginBottom: '6px', fontSize: '8.5pt',
              border: '1px solid #ccc', borderRadius: '4px', padding: '5px 8px',
            }}>
              {[
                ['Name', `${student?.first_name ?? ''} ${student?.last_name ?? ''}`],
                ['Class', classLabel],
                ['Adm No.', student?.admission_number ?? '—'],
                ['Session', displayTerm.yearName || '—'],
                ['Gender', student?.gender ?? '—'],
                ['Term', displayTerm.termName || '—'],
                ['DOB', student?.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—'],
                ['Form Teacher', formTeacherName || '—'],
              ].map(([label, val], i) => (
                <div key={i} className="info-row">
                  <span style={{ color: '#555' }}>{label}:</span>
                  <span style={{ fontWeight: 600, textTransform: label === 'Gender' ? 'capitalize' : 'none' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Overall summary */}
            {grades.length > 0 && (
              <div style={{
                marginBottom: '6px',
                border: '1.5px solid #1a3a5c',
                borderRadius: '4px',
                padding: '4px 6px',
                background: '#f8fafc',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                  <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total</div>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.1 }}>{overallTotal}</div>
                    <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>/{countedGrades.length * 100}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Average</div>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.1 }}>{overallAvg.toFixed(2)}</div>
                    <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>{countedGrades.length} subj</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Class Avg</div>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.1 }}>
                      {classOverallAverage != null ? classOverallAverage.toFixed(2) : '—'}
                    </div>
                    <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>mean</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Position</div>
                    <div style={{ fontSize: '11pt', fontWeight: 'bold', color: '#1a3a5c', lineHeight: 1.1 }}>
                      {overallRank ? getOrdinal(overallRank.pos) : '—'}
                    </div>
                    <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>
                      {overallRank ? `/${overallRank.size}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '2px' }}>
                    <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Remark</div>
                    <div style={{ fontSize: '9.5pt', fontWeight: 'bold', color: remarkColor, marginTop: '2px' }}>{overallRemark}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Grades table */}
            <div style={{ marginBottom: '6px' }}>
              {grades.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', fontSize: '9pt' }}>
                  No academic records available for this period.
                </p>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Subject</th>
                      <th style={{ width: '28px', textAlign: 'center' }}>CA</th>
                      <th style={{ width: '28px', textAlign: 'center' }}>Test</th>
                      <th style={{ width: '30px', textAlign: 'center' }}>Exam</th>
                      <th style={{ width: '36px', textAlign: 'center' }}>Total</th>
                      <th style={{ width: '40px', textAlign: 'center' }}>Cls Avg</th>
                      <th style={{ width: '46px', textAlign: 'center' }}>Position</th>
                      <th style={{ width: '32px', textAlign: 'center' }}>Grade</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map(g => {
                      const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
                      const subAvg = subjectAverages[g.subject_id];
                      const subPos = subjectPositions[g.subject_id];
                      const excluded = g._excluded;
                      return (
                        <tr key={g.id}>
                          <td>{(g.subjects as any)?.name ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>{g.ca1_score ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>{g.ca3_score ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>{g.exam_score ?? '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{total}</td>
                          <td style={{ textAlign: 'center', color: excluded ? '#94a3b8' : '#555' }}>
                            {excluded ? '—' : (subAvg != null ? subAvg.toFixed(1) : '—')}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: excluded ? '#94a3b8' : '#1a3a5c' }}>
                            {excluded ? '—' : (subPos ? `${getOrdinal(subPos.pos)}/${subPos.size}` : '—')}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{excluded ? '—' : (g.grade ?? '—')}</td>
                          <td style={{ textAlign: 'center' }}>{excluded ? '—' : remarkForGrade(g.grade)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Attendance + Fees combined grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px' }}>
                <div className="section-title">ATTENDANCE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 8px' }}>
                  <div className="info-row"><span>Present:</span><span style={{ fontWeight: 600 }}>{attendance.present}</span></div>
                  <div className="info-row"><span>Absent:</span><span style={{ fontWeight: 600 }}>{attendance.absent}</span></div>
                  <div className="info-row"><span>Late:</span><span style={{ fontWeight: 600 }}>{attendance.late}</span></div>
                  <div className="info-row"><span>Total:</span><span style={{ fontWeight: 600 }}>{attendance.total}</span></div>
                  <div className="info-row" style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '1px' }}>
                    <span>Attendance Rate:</span><span style={{ fontWeight: 700, color: '#15803d' }}>{attPct}%</span>
                  </div>
                </div>
              </div>
              <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px' }}>
                <div className="section-title">FEES &amp; CALENDAR</div>
                {showFees && (
                  <div className="info-row">
                    <span>Outstanding:</span>
                    <span style={{ fontWeight: 700, color: outstandingFees > 0 ? '#b91c1c' : '#15803d' }}>{fmtMoney(outstandingFees)}</span>
                  </div>
                )}
                <div className="info-row"><span>Next Term Fees:</span><span style={{ fontWeight: 600 }}>{fmtMoney(termSettings?.next_term_fees)}</span></div>
                <div className="info-row"><span>Other Fees:</span><span style={{ fontWeight: 600 }}>{fmtMoney(termSettings?.other_fees)}</span></div>
                <div className="info-row"><span>Vacation:</span><span style={{ fontWeight: 600 }}>{fmtDate(termSettings?.vacation_date)}</span></div>
                <div className="info-row" style={{ borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '1px' }}>
                  <span>Next Term Begins:</span><span style={{ fontWeight: 700, color: '#1a3a5c' }}>{fmtDate(termSettings?.next_term_begins)}</span>
                </div>
              </div>
            </div>

            {/* Staff comments / signatures - full width, compact */}
            <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px', marginBottom: '4px' }}>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Social Behaviour: </span>
                <span style={{
                  fontSize: '8.5pt',
                  fontStyle: comments?.social_behaviour_remark ? 'normal' : 'italic',
                  color: comments?.social_behaviour_remark ? '#1a1a1a' : '#aaa',
                }}>
                  {comments?.social_behaviour_remark || '__________________________________________________________'}
                </span>
              </div>

              <div style={{ marginBottom: '4px', borderTop: '1px dashed #eee', paddingTop: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>Form Teacher:</span>
                  <span style={{
                    flex: 1,
                    fontSize: '8.5pt',
                    fontStyle: comments?.form_teacher_comment ? 'normal' : 'italic',
                    color: comments?.form_teacher_comment ? '#1a1a1a' : '#aaa',
                  }}>
                    {comments?.form_teacher_comment || '___________________________________'}
                  </span>
                  <span style={{ fontSize: '7.5pt', color: '#777', whiteSpace: 'nowrap' }}>
                    Sign: <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                      {comments?.form_teacher
                        ? `${comments.form_teacher.first_name ?? ''} ${comments.form_teacher.last_name ?? ''}`.trim()
                        : (formTeacherName || '___________')}
                    </span>
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #eee', paddingTop: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>Principal:</span>
                  <span style={{
                    flex: 1,
                    fontSize: '8.5pt',
                    fontStyle: 'normal',
                    color: '#1a1a1a',
                  }}>
                    {comments?.principal_comment || (grades.length > 0 ? principalRemarkForAvg(overallAvg) : '___________________________________')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '7.5pt', color: '#777', whiteSpace: 'nowrap' }}>
                    <img src="/kelvin_signature_.jpeg" alt="Principal Signature" style={{ height: '18px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                      {comments?.principal
                        ? `${comments.principal.first_name ?? ''} ${comments.principal.last_name ?? ''}`.trim()
                        : 'Kelvin S. Fubara'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '7pt', color: '#888', borderTop: '1px solid #eee', paddingTop: '3px', marginTop: '2px' }}>
              Generated by OGS School Management System &middot; {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
