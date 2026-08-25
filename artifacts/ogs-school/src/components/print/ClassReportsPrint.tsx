import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { getOverallRemark, remarkForGrade, principalRemarkForAvg } from '../../lib/grading';
import OGSLetterhead from './OGSLetterhead';

interface Props {
  classId: string;
  termId: string;
  academicYearId: string;
  studentIds: string[];
  onClose: () => void;
}

interface StudentPacket {
  student: any;
  grades: any[];
  attendance: { present: number; absent: number; late: number; total: number };
  comments: any;
  outstandingFees: number;
  overallRank: { pos: number; size: number } | null;
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


export default function ClassReportsPrint({ classId, termId, academicYearId, studentIds, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: studentIds.length });
  const [packets, setPackets] = useState<StudentPacket[]>([]);
  const [cls, setCls] = useState<any>(null);
  const [termSettings, setTermSettings] = useState<any>(null);
  const [termName, setTermName] = useState('');
  const [yearName, setYearName] = useState('');
  const [formTeacher, setFormTeacher] = useState<any>(null);
  const [subjectAverages, setSubjectAverages] = useState<Record<string, number>>({});
  const [subjectPositions, setSubjectPositions] = useState<Record<string, Record<string, { pos: number; size: number }>>>({});
  const [classOverallAverage, setClassOverallAverage] = useState<number | null>(null);
  const [showFees, setShowFees] = useState(false);

  useEffect(() => { loadAll(); }, [classId, termId, academicYearId]);

  async function loadAll() {
    const [classRes, termRes, yearRes, settingsRes, classGradesRes, exclusionsRes, studentsRes, attRes, commentsRes] = await Promise.all([
      supabase.from('classes').select('id, name, level, section, class_teacher_id, school_id').eq('id', classId).maybeSingle(),
      supabase.from('terms').select('name').eq('id', termId).maybeSingle(),
      supabase.from('academic_years').select('name').eq('id', academicYearId).maybeSingle(),
      supabase.from('class_term_settings').select('*').eq('class_id', classId).eq('term_id', termId).eq('academic_year_id', academicYearId).maybeSingle(),
      supabase.from('grades').select('student_id, subject_id, total_score, ca1_score, ca3_score, exam_score').eq('class_id', classId).eq('term_id', termId).eq('academic_year_id', academicYearId),
      supabase.from('student_subject_exclusions').select('student_id, subject_id').eq('academic_year_id', academicYearId),
      supabase.from('students').select('*').in('id', studentIds),
      supabase.from('student_attendance').select('student_id, status').in('student_id', studentIds),
      supabase.from('report_card_comments').select('*, form_teacher:form_teacher_signed_by(first_name, last_name), principal:principal_signed_by(first_name, last_name)').in('student_id', studentIds).eq('term_id', termId).eq('academic_year_id', academicYearId),
    ]);

    const clsData = classRes.data;
    setCls(clsData);

    if (clsData?.class_teacher_id) {
      const { data: ft } = await supabase.from('profiles').select('first_name, last_name').eq('id', clsData.class_teacher_id).maybeSingle();
      setFormTeacher(ft);
    }

    setTermSettings(settingsRes.data);
    setTermName(termRes.data?.name ?? '');
    setYearName(yearRes.data?.name ?? '');

    const exclusionSet = new Set<string>((exclusionsRes.data ?? []).map((e: any) => `${e.student_id}:${e.subject_id}`));

    const allClassGrades = classGradesRes.data ?? [];

    const subjectGroup: Record<string, { studentId: string; total: number }[]> = {};
    for (const g of allClassGrades) {
      if (exclusionSet.has(`${g.student_id}:${g.subject_id}`)) continue;
      const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
      if (total == null || total <= 0) continue;
      if (!subjectGroup[g.subject_id]) subjectGroup[g.subject_id] = [];
      subjectGroup[g.subject_id].push({ studentId: g.student_id, total });
    }

    const averages: Record<string, number> = {};
    const posByStudent: Record<string, Record<string, { pos: number; size: number }>> = {};
    for (const [sid, entries] of Object.entries(subjectGroup)) {
      const sorted = [...entries].sort((a, b) => b.total - a.total);
      averages[sid] = entries.reduce((s, e) => s + e.total, 0) / entries.length;
      for (const entry of entries) {
        const pos = sorted.filter(e => e.total > entry.total).length + 1;
        if (!posByStudent[entry.studentId]) posByStudent[entry.studentId] = {};
        posByStudent[entry.studentId][sid] = { pos, size: sorted.length };
      }
    }
    setSubjectAverages(averages);
    setSubjectPositions(posByStudent);

    const studentSums: Record<string, { sum: number; count: number }> = {};
    for (const g of allClassGrades) {
      if (exclusionSet.has(`${g.student_id}:${g.subject_id}`)) continue;
      const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
      if (total == null || total <= 0) continue;
      if (!studentSums[g.student_id]) studentSums[g.student_id] = { sum: 0, count: 0 };
      studentSums[g.student_id].sum += total;
      studentSums[g.student_id].count += 1;
    }
    const studentAverages = Object.entries(studentSums).map(([sid, v]) => ({ sid, avg: v.count > 0 ? v.sum / v.count : 0 }));
    const classMean = studentAverages.length > 0 ? studentAverages.reduce((s, x) => s + x.avg, 0) / studentAverages.length : null;
    setClassOverallAverage(classMean);

    const rankMap: Record<string, { pos: number; size: number }> = {};
    for (const sa of studentAverages) {
      const uniqueHigher = new Set(studentAverages.filter(x => x.avg > sa.avg).map(x => x.avg.toFixed(4))).size;
      rankMap[sa.sid] = { pos: uniqueHigher + 1, size: studentAverages.length };
    }

    const { data: studentGrades } = await supabase
      .from('grades')
      .select('*, subjects(name, code)')
      .in('student_id', studentIds)
      .eq('class_id', classId)
      .eq('term_id', termId)
      .eq('academic_year_id', academicYearId)
      .order('total_score', { ascending: false, nullsFirst: false });

    const gradesByStudent: Record<string, any[]> = {};
    for (const g of studentGrades ?? []) {
      if (exclusionSet.has(`${g.student_id}:${g.subject_id}`)) continue;
      const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
      if (!total || total <= 0) continue;
      if (!gradesByStudent[g.student_id]) gradesByStudent[g.student_id] = [];
      gradesByStudent[g.student_id].push(g);
    }

    const attendanceByStudent: Record<string, { present: number; absent: number; late: number; total: number }> = {};
    for (const a of attRes.data ?? []) {
      if (!attendanceByStudent[a.student_id]) attendanceByStudent[a.student_id] = { present: 0, absent: 0, late: 0, total: 0 };
      const box = attendanceByStudent[a.student_id];
      box.total += 1;
      if (a.status === 'present') box.present += 1;
      else if (a.status === 'absent') box.absent += 1;
      else if (a.status === 'late') box.late += 1;
    }

    const commentsByStudent: Record<string, any> = {};
    for (const c of commentsRes.data ?? []) {
      commentsByStudent[c.student_id] = c;
    }

    const feesMasterData = await supabase
      .from('fees_master')
      .select('amount, class_id')
      .eq('academic_year_id', academicYearId)
      .or(`class_id.eq.${classId},class_id.is.null`);
    const totalDueBase = (feesMasterData.data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const { data: feesPaid } = await supabase
      .from('fees_collections')
      .select('student_id, net_amount')
      .in('student_id', studentIds)
      .eq('academic_year_id', academicYearId);
    const paidByStudent: Record<string, number> = {};
    for (const p of feesPaid ?? []) {
      paidByStudent[p.student_id] = (paidByStudent[p.student_id] ?? 0) + Number(p.net_amount || 0);
    }

    const studentMap = new Map<string, any>();
    for (const s of studentsRes.data ?? []) studentMap.set(s.id, s);

    const built: StudentPacket[] = [];
    for (const sid of studentIds) {
      const s = studentMap.get(sid);
      if (!s) continue;
      const cmt = commentsByStudent[sid];
      let outstanding = 0;
      if (cmt?.outstanding_fees_override != null) {
        outstanding = Number(cmt.outstanding_fees_override);
      } else {
        outstanding = Math.max(0, totalDueBase - (paidByStudent[sid] ?? 0));
      }
      built.push({
        student: s,
        grades: gradesByStudent[sid] ?? [],
        attendance: attendanceByStudent[sid] ?? { present: 0, absent: 0, late: 0, total: 0 },
        comments: cmt,
        outstandingFees: outstanding,
        overallRank: rankMap[sid] ?? null,
      });
      setProgress({ done: built.length, total: studentIds.length });
    }

    built.sort((a, b) => (a.overallRank?.pos ?? 999) - (b.overallRank?.pos ?? 999));
    setPackets(built);
    setLoading(false);
    setTimeout(() => window.print(), 800);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 text-sm font-semibold">Compiling class reports...</p>
          <p className="text-slate-400 text-xs mt-1">{progress.done} / {progress.total} students</p>
        </div>
      </div>
    );
  }

  const classLabel = cls ? (cls.name || `${cls.level ?? ''}${cls.section ? ' ' + cls.section : ''}`) : '—';
  const formTeacherName = formTeacher ? `${formTeacher.first_name ?? ''} ${formTeacher.last_name ?? ''}`.trim() : '';

  return createPortal((
    <>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          body > *:not(#print-class-reports) { display: none !important; }
          #print-class-reports {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            background: white !important;
            z-index: auto !important;
          }
          #print-class-reports .print-page {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-card {
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-card:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
        @media screen {
          #print-class-reports {
            position: fixed;
            inset: 0;
            background: white;
            z-index: 100;
            overflow-y: auto;
            padding: 16px;
          }
          .print-card { margin-bottom: 24px; }
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

      <div id="print-class-reports">
        <div className="print-page">
          <div className="flex items-center justify-end gap-4 mb-3 print:hidden">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showFees}
                onChange={e => setShowFees(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              Show outstanding fees
            </label>
            <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors">Close</button>
            <button onClick={() => window.print()} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">Print All ({packets.length})</button>
          </div>

          {packets.map(pkt => {
            const overallTotal = pkt.grades.reduce((sum: number, g: any) => {
              const t = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
              return sum + (t || 0);
            }, 0);
            const overallAvg = pkt.grades.length > 0 ? overallTotal / pkt.grades.length : 0;
            const overallRemark = pkt.grades.length > 0 ? getOverallRemark(overallAvg) : '';
            const remarkColor =
              overallAvg >= 80 ? '#0a6a0a' :
              overallAvg >= 70 ? '#15803d' :
              overallAvg >= 60 ? '#b45309' :
              overallAvg >= 50 ? '#a16207' :
              overallAvg >= 40 ? '#c2410c' : '#b91c1c';
            const attPct = pkt.attendance.total > 0 ? Math.round((pkt.attendance.present / pkt.attendance.total) * 100) : 0;
            const studentPositions = subjectPositions[pkt.student.id] ?? {};

            return (
              <div key={pkt.student.id} className="print-card" style={{ border: '2px double #1a3a5c', padding: '8px 10px', background: '#fff' }}>
                <OGSLetterhead compact />

                <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '10pt', fontWeight: 'bold', background: '#1a3a5c', color: 'white', padding: '2px 14px', display: 'inline-block', borderRadius: '3px', letterSpacing: '0.5px' }}>
                    STUDENT ACADEMIC REPORT
                  </div>
                  <span style={{ fontSize: '8.5pt', color: '#555', marginLeft: '8px' }}>
                    {yearName} &middot; {termName}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px', fontSize: '8.5pt', border: '1px solid #ccc', borderRadius: '4px', padding: '5px 8px' }}>
                  {[
                    ['Name', `${pkt.student?.first_name ?? ''} ${pkt.student?.last_name ?? ''}`],
                    ['Class', classLabel],
                    ['Adm No.', pkt.student?.admission_number ?? '—'],
                    ['Session', yearName || '—'],
                    ['Gender', pkt.student?.gender ?? '—'],
                    ['Term', termName || '—'],
                    ['DOB', pkt.student?.date_of_birth ? new Date(pkt.student.date_of_birth).toLocaleDateString() : '—'],
                    ['Form Teacher', formTeacherName || '—'],
                  ].map(([label, val], i) => (
                    <div key={i} className="info-row">
                      <span style={{ color: '#555' }}>{label}:</span>
                      <span style={{ fontWeight: 600, textTransform: label === 'Gender' ? 'capitalize' : 'none' }}>{val}</span>
                    </div>
                  ))}
                </div>

                {pkt.grades.length > 0 && (
                  <div style={{ marginBottom: '6px', border: '1.5px solid #1a3a5c', borderRadius: '4px', padding: '4px 6px', background: '#f8fafc' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                      <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total</div>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.1 }}>{overallTotal}</div>
                        <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>/{pkt.grades.length * 100}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Average</div>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.1 }}>{overallAvg.toFixed(2)}</div>
                        <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>{pkt.grades.length} subj</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Class Avg</div>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.1 }}>{classOverallAverage != null ? classOverallAverage.toFixed(2) : '—'}</div>
                        <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>mean</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '2px', borderRight: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Position</div>
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', color: '#1a3a5c', lineHeight: 1.1 }}>{pkt.overallRank ? getOrdinal(pkt.overallRank.pos) : '—'}</div>
                        <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>{pkt.overallRank ? `/${pkt.overallRank.size}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '2px' }}>
                        <div style={{ fontSize: '7pt', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Remark</div>
                        <div style={{ fontSize: '9.5pt', fontWeight: 'bold', color: remarkColor, marginTop: '2px' }}>{overallRemark}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '6px' }}>
                  {pkt.grades.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic', fontSize: '9pt' }}>No academic records available for this period.</p>
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
                        {pkt.grades.map((g: any) => {
                          const total = g.total_score ?? ((g.ca1_score || 0) + (g.ca3_score || 0) + (g.exam_score || 0));
                          const subAvg = subjectAverages[g.subject_id];
                          const subPos = studentPositions[g.subject_id];
                          return (
                            <tr key={g.id}>
                              <td>{(g.subjects as any)?.name ?? '—'}</td>
                              <td style={{ textAlign: 'center' }}>{g.ca1_score ?? '—'}</td>
                              <td style={{ textAlign: 'center' }}>{g.ca3_score ?? '—'}</td>
                              <td style={{ textAlign: 'center' }}>{g.exam_score ?? '—'}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{total}</td>
                              <td style={{ textAlign: 'center', color: '#555' }}>{subAvg != null ? subAvg.toFixed(1) : '—'}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1a3a5c' }}>{subPos ? `${getOrdinal(subPos.pos)}/${subPos.size}` : '—'}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{g.grade ?? '—'}</td>
                              <td style={{ textAlign: 'center' }}>{remarkForGrade(g.grade)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px' }}>
                    <div className="section-title">ATTENDANCE</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 8px' }}>
                      <div className="info-row"><span>Present:</span><span style={{ fontWeight: 600 }}>{pkt.attendance.present}</span></div>
                      <div className="info-row"><span>Absent:</span><span style={{ fontWeight: 600 }}>{pkt.attendance.absent}</span></div>
                      <div className="info-row"><span>Late:</span><span style={{ fontWeight: 600 }}>{pkt.attendance.late}</span></div>
                      <div className="info-row"><span>Total:</span><span style={{ fontWeight: 600 }}>{pkt.attendance.total}</span></div>
                      <div className="info-row" style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '1px' }}>
                        <span>Attendance Rate:</span><span style={{ fontWeight: 700, color: '#15803d' }}>{attPct}%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px' }}>
                    <div className="section-title">FEES &amp; CALENDAR</div>
                    {showFees && <div className="info-row"><span>Outstanding:</span><span style={{ fontWeight: 700, color: pkt.outstandingFees > 0 ? '#b91c1c' : '#15803d' }}>{fmtMoney(pkt.outstandingFees)}</span></div>}
                    <div className="info-row"><span>Next Term Fees:</span><span style={{ fontWeight: 600 }}>{fmtMoney(termSettings?.next_term_fees)}</span></div>
                    <div className="info-row"><span>Other Fees:</span><span style={{ fontWeight: 600 }}>{fmtMoney(termSettings?.other_fees)}</span></div>
                    <div className="info-row"><span>Vacation:</span><span style={{ fontWeight: 600 }}>{fmtDate(termSettings?.vacation_date)}</span></div>
                    <div className="info-row" style={{ borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '1px' }}>
                      <span>Next Term Begins:</span><span style={{ fontWeight: 700, color: '#1a3a5c' }}>{fmtDate(termSettings?.next_term_begins)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px', marginBottom: '4px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Social Behaviour: </span>
                    <span style={{ fontSize: '8.5pt', fontStyle: pkt.comments?.social_behaviour_remark ? 'normal' : 'italic', color: pkt.comments?.social_behaviour_remark ? '#1a1a1a' : '#aaa' }}>
                      {pkt.comments?.social_behaviour_remark || '__________________________________________________________'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '4px', borderTop: '1px dashed #eee', paddingTop: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>Form Teacher:</span>
                      <span style={{ flex: 1, fontSize: '8.5pt', fontStyle: pkt.comments?.form_teacher_comment ? 'normal' : 'italic', color: pkt.comments?.form_teacher_comment ? '#1a1a1a' : '#aaa' }}>
                        {pkt.comments?.form_teacher_comment || '___________________________________'}
                      </span>
                      <span style={{ fontSize: '7.5pt', color: '#777', whiteSpace: 'nowrap' }}>
                        Sign: <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                          {pkt.comments?.form_teacher
                            ? `${pkt.comments.form_teacher.first_name ?? ''} ${pkt.comments.form_teacher.last_name ?? ''}`.trim()
                            : (formTeacherName || '___________')}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #eee', paddingTop: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '7.5pt', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>Principal:</span>
                      <span style={{ flex: 1, fontSize: '8.5pt', fontStyle: 'normal', color: '#1a1a1a' }}>
                        {pkt.comments?.principal_comment || (pkt.grades.length > 0 ? principalRemarkForAvg(overallAvg) : '___________________________________')}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '7.5pt', color: '#777', whiteSpace: 'nowrap' }}>
                        <img src="/kelvin_signature_.jpeg" alt="Principal Signature" style={{ height: '18px', objectFit: 'contain' }} />
                        <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                          {pkt.comments?.principal
                            ? `${pkt.comments.principal.first_name ?? ''} ${pkt.comments.principal.last_name ?? ''}`.trim()
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
            );
          })}
        </div>
      </div>
    </>
  ), document.body);
}
