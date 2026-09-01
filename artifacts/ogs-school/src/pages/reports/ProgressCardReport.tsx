import { useState, useEffect, useCallback } from 'react';
import { Search, Printer, User, BookOpen, Award, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getWAECGrade, getOverallRemark } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';

interface Exam { id: string; name: string; }
interface SearchResult {
  id: string;
  full_name: string;
  admission_number: string;
  class_name: string;
}
interface SubjectMark {
  subject_id: string;
  subject_name: string;
  ca: number;
  test: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  is_absent: boolean;
  subject_position?: number;
  subject_class_size?: number;
  subject_average?: number;
}


function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


function gradeColor(grade: string) {
  if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (grade.startsWith('B')) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (grade.startsWith('C')) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

export default function ProgressCardReport() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SearchResult | null>(null);
  const [marks, setMarks] = useState<SubjectMark[]>([]);
  const [overallRank, setOverallRank] = useState<{ pos: number; size: number } | null>(null);
  const [classOverallAverage, setClassOverallAverage] = useState<number | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (profile?.school_id) {
      supabase
        .from('exams')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .order('name')
        .then(({ data }) => { if (data) setExams(data); });
    }
  }, [profile?.school_id]);

  const searchStudents = useCallback(async (query: string) => {
    if (!query.trim() || !profile?.school_id) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id, classes(name)')
      .eq('school_id', profile.school_id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,admission_number.ilike.%${query}%`)
      .limit(10);

    setSearchResults(
      (students ?? []).map((s: any) => ({
        id: s.id,
        full_name: `${s.first_name} ${s.last_name}`,
        admission_number: s.admission_number ?? '',
        class_name: s.classes?.name ?? 'Unknown',
      }))
    );
    setLoadingSearch(false);
  }, [profile?.school_id]);

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStudents]);

  useEffect(() => {
    if (!selectedStudent || !selectedExam) {
      setMarks([]);
      return;
    }
    loadMarks();
  }, [selectedStudent, selectedExam]);

  async function loadMarks() {
    if (!selectedStudent || !selectedExam) return;
    setLoadingMarks(true);

    // Fetch student's class for ranking
    const { data: studentData } = await supabase
      .from('students')
      .select('class_id')
      .eq('id', selectedStudent.id)
      .maybeSingle();

    const [studentRecordsRes, allClassRecordsRes] = await Promise.all([
      supabase
        .from('exam_marks_records')
        .select('subject_id, ca1, ca3, exam, is_absent, subjects(name)')
        .eq('exam_name_id', selectedExam)
        .eq('student_id', selectedStudent.id),
      studentData?.class_id
        ? supabase
            .from('exam_marks_records')
            .select('student_id, subject_id, ca1, ca3, exam, is_absent')
            .eq('exam_name_id', selectedExam)
            .eq('class_id', studentData.class_id)
        : Promise.resolve({ data: [] }),
    ]);

    const allClassRecords: any[] = (allClassRecordsRes as any).data ?? [];

    // Per-subject totals across class (excluding absent / zero scores)
    const subjectTotalsMap: Record<string, number[]> = {};
    const subjectStudentMap: Record<string, Set<string>> = {};
    for (const r of allClassRecords) {
      const t = (r.ca1 ?? 0) + (r.ca3 ?? 0) + (r.exam ?? 0);
      if (r.is_absent || t <= 0) continue;
      if (!subjectTotalsMap[r.subject_id]) subjectTotalsMap[r.subject_id] = [];
      subjectTotalsMap[r.subject_id].push(t);
      if (!subjectStudentMap[r.subject_id]) subjectStudentMap[r.subject_id] = new Set();
      subjectStudentMap[r.subject_id].add(r.student_id);
    }
    const subjectAverages: Record<string, number> = {};
    for (const [sid, totals] of Object.entries(subjectTotalsMap)) {
      subjectAverages[sid] = totals.reduce((s, n) => s + n, 0) / totals.length;
      totals.sort((a, b) => b - a);
    }

    // Overall rank using each student's average across non-zero subjects (dense ranking for ties)
    const studentSums: Record<string, { sum: number; count: number }> = {};
    for (const r of allClassRecords) {
      const t = (r.ca1 ?? 0) + (r.ca3 ?? 0) + (r.exam ?? 0);
      if (r.is_absent || t <= 0) continue;
      if (!studentSums[r.student_id]) studentSums[r.student_id] = { sum: 0, count: 0 };
      studentSums[r.student_id].sum += t;
      studentSums[r.student_id].count += 1;
    }
    const studentAvgList = Object.entries(studentSums).map(([id, v]) => ({
      id,
      avg: v.count > 0 ? v.sum / v.count : 0,
    }));
    if (studentAvgList.length > 0) {
      const me = studentAvgList.find(x => x.id === selectedStudent.id);
      if (me) {
        const uniqueHigher = new Set(studentAvgList.filter(x => x.avg > me.avg).map(x => x.avg.toFixed(4))).size;
        setOverallRank({ pos: uniqueHigher + 1, size: studentAvgList.length });
      } else {
        setOverallRank(null);
      }
      const classMean = studentAvgList.reduce((s, x) => s + x.avg, 0) / studentAvgList.length;
      setClassOverallAverage(classMean);
    } else {
      setOverallRank(null);
      setClassOverallAverage(null);
    }

    const result: SubjectMark[] = (studentRecordsRes.data ?? []).map((r: any) => {
      const ca = r.ca1 ?? 0;
      const test = r.ca3 ?? 0;
      const examVal = r.exam ?? 0;
      const total = r.is_absent ? 0 : ca + test + examVal;
      const { grade, remark } = getWAECGrade(total);

      let subject_position: number | undefined;
      let subject_class_size: number | undefined;
      const subjectAvg = subjectAverages[r.subject_id];
      if (!r.is_absent && total > 0 && subjectTotalsMap[r.subject_id]) {
        const sorted = subjectTotalsMap[r.subject_id];
        subject_position = sorted.filter(s => s > total).length + 1;
        subject_class_size = subjectStudentMap[r.subject_id]?.size ?? sorted.length;
      }

      return {
        subject_id: r.subject_id,
        subject_name: r.subjects?.name ?? 'Unknown Subject',
        ca,
        test,
        exam: examVal,
        total,
        grade: r.is_absent ? 'ABS' : grade,
        remark: r.is_absent ? 'Absent' : remark,
        is_absent: r.is_absent ?? false,
        subject_position,
        subject_class_size,
        subject_average: subjectAvg,
      };
    });

    result.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    // Exclude subjects where the student scored 0 and is not absent (no meaningful result)
    setMarks(result.filter(m => m.is_absent || m.total > 0));
    setLoadingMarks(false);
  }

  function selectStudent(student: SearchResult) {
    setSelectedStudent(student);
    setSearchQuery(student.full_name);
    setShowDropdown(false);
    setSearchResults([]);
  }

  function clearStudent() {
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    setMarks([]);
  }

  const presentMarks = marks.filter(m => !m.is_absent);
  const aggregate = presentMarks.reduce((sum, m) => sum + m.total, 0);
  const average = presentMarks.length > 0 ? (aggregate / presentMarks.length).toFixed(1) : '0.0';
  const examName = exams.find(e => e.id === selectedExam)?.name ?? '';

  function handlePrint() {
    if (!selectedStudent || !marks.length) return;
    const origin = window.location.origin;
    const win = window.open('', '_blank');
    if (!win) return;

    const rows = marks.map(m => `
      <tr>
        <td>${m.subject_name}</td>
        <td class="num">${m.is_absent ? '-' : m.ca}</td>
        <td class="num">${m.is_absent ? '-' : m.test}</td>
        <td class="num">${m.is_absent ? '-' : m.exam}</td>
        <td class="num total">${m.is_absent ? 'ABS' : m.total}</td>
        <td class="num">${m.subject_average != null ? m.subject_average.toFixed(1) : '-'}</td>
        <td class="num pos">${m.subject_position ? getOrdinal(m.subject_position) : '-'}</td>
        <td class="num">${m.grade}</td>
        <td>${m.remark}</td>
      </tr>
    `).join('');

    const overallAvgNum = presentMarks.length > 0 ? aggregate / presentMarks.length : 0;
    const overallRemark = getOverallRemark(overallAvgNum);
    const overallPosText = overallRank ? `${getOrdinal(overallRank.pos)} of ${overallRank.size}` : '—';
    const classAvgText = classOverallAverage != null ? classOverallAverage.toFixed(2) + '%' : '—';

    const primaryColor = settings.primary_color || '#1a3a5c';
    const secondaryColor = settings.secondary_color || '#1a6b3a';
    const contactLine = [settings.phone && `Tel: ${settings.phone}`, settings.email && `Email: ${settings.email}`].filter(Boolean).join(' | ');

    win.document.write(`<!DOCTYPE html>
<html><head>
  <title>Result Card - ${selectedStudent.full_name}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13px; color: #000; margin: 20px; }
    .info { border: 1px solid #ccc; padding: 8px 12px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f9f9f9; }
    .lbl { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #666; padding: 5px 8px; }
    th { background: #e8e8e8; font-size: 11px; text-transform: uppercase; text-align: center; }
    td.num { text-align: center; }
    td.total { font-weight: bold; background: #f5f5f5; }
    .summary { margin-top: 10px; border: 1px solid #000; padding: 6px 12px; display: flex; justify-content: space-around; background: #f0f0f0; }
    td.pos { font-weight: bold; color: #1a3a5c; }
    .overall { margin-top: 14px; border: 2px solid #000; padding: 10px 14px; background: #fafafa; }
    .overall h4 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; text-align: center; letter-spacing: 1px; }
    .overall-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .overall-item { text-align: center; padding: 4px; border-right: 1px dashed #aaa; }
    .overall-item:last-child { border-right: none; }
    .overall-lbl { font-size: 10px; text-transform: uppercase; color: #555; }
    .overall-val { font-size: 15px; font-weight: bold; margin-top: 2px; }
    .overall-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .key { font-size: 10px; color: #555; margin-top: 8px; border-top: 1px dashed #ccc; padding-top: 4px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="display:block;margin:0 0 16px auto;padding:8px 24px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Print</button>
  <div style="margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px">
      <img src="${settings.logo_url || origin + '/ogs_logo_bg.png'}" alt="${settings.school_name} Logo" style="width:78px;height:78px;object-fit:contain"/>
      <div style="flex:1;text-align:center;padding:0 14px">
        <div style="font-size:19pt;font-weight:900;letter-spacing:1.5px;color:${primaryColor};font-family:'Times New Roman',serif;line-height:1.1">${settings.school_name.toUpperCase()}</div>
        ${settings.motto ? `<div style="font-size:9pt;font-style:italic;color:${secondaryColor};font-weight:600;margin:3px 0">${settings.motto}</div>` : ''}
        ${settings.address ? `<div style="font-size:8.5pt;color:#333;line-height:1.5">${settings.address}</div>` : ''}
        <div style="font-size:9pt;font-weight:bold;color:${primaryColor};margin-top:2px">Office of the Principal</div>
        ${contactLine ? `<div style="font-size:7.5pt;color:#555;margin-top:2px">${contactLine}</div>` : ''}
      </div>
      <div style="width:72px"></div>
    </div>
    <div style="border-top:3px solid ${primaryColor};border-bottom:1px solid ${secondaryColor};height:4px;margin:0 0 10px 0"></div>
    <div style="text-align:center;font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin:6px 0 2px">STUDENT RESULT CARD</div>
    <div style="text-align:center;font-size:12px;color:#444;margin-bottom:6px">${examName}</div>
  </div>
  <div class="info">
    <div><span class="lbl">Name:</span> ${selectedStudent.full_name}</div>
    <div><span class="lbl">Admission No.:</span> ${selectedStudent.admission_number || '—'}</div>
    <div><span class="lbl">Class:</span> ${selectedStudent.class_name}</div>
    <div><span class="lbl">Exam:</span> ${examName}</div>
  </div>
  <div class="overall">
    <h4>Overall Performance Summary</h4>
    <div class="overall-grid-5">
      <div class="overall-item"><div class="overall-lbl">Total Score</div><div class="overall-val">${aggregate}</div></div>
      <div class="overall-item"><div class="overall-lbl">Overall Average</div><div class="overall-val">${overallAvgNum.toFixed(2)}%</div></div>
      <div class="overall-item"><div class="overall-lbl">Class Average</div><div class="overall-val">${classAvgText}</div></div>
      <div class="overall-item"><div class="overall-lbl">Position</div><div class="overall-val">${overallPosText}</div></div>
      <div class="overall-item"><div class="overall-lbl">Remark</div><div class="overall-val">${overallRemark}</div></div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Subject</th><th>CA (10)</th><th>Test (30)</th><th>Exam (60)</th><th>Total (100)</th><th>Class Avg</th><th>Position</th><th>Grade</th><th>Remark</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    <span><strong>Subjects Sat:</strong> ${presentMarks.length}</span>
    <span><strong>Aggregate:</strong> ${aggregate}</span>
    <span><strong>Average:</strong> ${average}</span>
  </div>
  <div class="key">Grading: A1=75-100 (Excellent), B2=70-74, B3=65-69 (Very Good/Good), C4-C6=50-64 (Credit), D7=45-49, E8=40-44 (Pass), F9=0-39 (Fail)</div>
</body></html>`);
    win.document.close();
  }

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
  const hasResults = selectedStudent && selectedExam && marks.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Report Cards</h1>
          <p className="text-slate-500 text-sm mt-0.5">Search any student and view their exam result card</p>
        </div>
        {hasResults && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Card
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Student Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) clearStudent();
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by name or admission number..."
                className="w-full border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {selectedStudent && (
                <button onClick={clearStudent} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {loadingSearch ? (
                    <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
                  ) : (
                    searchResults.map(student => (
                      <button
                        key={student.id}
                        onClick={() => selectStudent(student)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <div className="font-medium text-slate-800 text-sm">{student.full_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          ADM: {student.admission_number || '—'} · {student.class_name}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Exam / Term</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose an exam...</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        {selectedStudent && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="font-semibold text-emerald-800 text-sm">{selectedStudent.full_name}</div>
              <div className="text-xs text-emerald-600">
                ADM: {selectedStudent.admission_number || '—'} · Class: {selectedStudent.class_name}
              </div>
            </div>
          </div>
        )}
      </div>

      {!selectedStudent || !selectedExam ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Search for a student and select an exam</p>
          <p className="text-slate-400 text-sm mt-1">Results will appear here</p>
        </div>
      ) : loadingMarks ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading results...</p>
        </div>
      ) : marks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
          <Award className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No results found</p>
          <p className="text-slate-400 text-sm mt-1">No marks recorded for this student in the selected exam</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Subjects Sat', value: String(presentMarks.length), color: 'text-slate-800' },
              { label: 'Aggregate', value: String(aggregate), color: 'text-slate-800' },
              { label: 'Average', value: average, color: 'text-emerald-600' },
              {
                label: 'Overall Grade',
                value: getWAECGrade(parseFloat(average)).grade,
                color: parseFloat(average) >= 50 ? 'text-emerald-600' : 'text-red-600',
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm text-center">Overall Performance Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-100">
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Total Score</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{aggregate}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Overall Average</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {(presentMarks.length > 0 ? aggregate / presentMarks.length : 0).toFixed(2)}%
                </p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Class Average</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {classOverallAverage != null ? classOverallAverage.toFixed(2) + '%' : '—'}
                </p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Overall Position</p>
                <p className="text-2xl font-black text-blue-600 mt-1">
                  {overallRank ? getOrdinal(overallRank.pos) : '—'}
                </p>
                {overallRank && <p className="text-[10px] text-slate-400 mt-0.5">of {overallRank.size}</p>}
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Remark</p>
                {(() => {
                  const avgNum = presentMarks.length > 0 ? aggregate / presentMarks.length : 0;
                  const r = getOverallRemark(avgNum);
                  const cls = avgNum >= 70 ? 'text-emerald-600' : avgNum >= 50 ? 'text-amber-600' : 'text-red-600';
                  return <p className={`text-xl font-black mt-1 ${cls}`}>{r}</p>;
                })()}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{selectedStudent.full_name} — {examName}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Class: {selectedStudent.class_name} · ADM: {selectedStudent.admission_number || '—'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Subject</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      <div>CA</div><div className="text-xs font-normal text-slate-400">max 10</div>
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      <div>Test</div><div className="text-xs font-normal text-slate-400">max 30</div>
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      <div>Exam</div><div className="text-xs font-normal text-slate-400">max 60</div>
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Total (100)</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Class Avg</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Position</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Grade</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {marks.map(m => (
                    <tr key={m.subject_id} className={`hover:bg-slate-50 transition-colors ${m.is_absent ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3 font-medium text-slate-800">{m.subject_name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{m.is_absent ? '—' : m.ca}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{m.is_absent ? '—' : m.test}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{m.is_absent ? '—' : m.exam}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-black text-base ${m.is_absent ? 'text-slate-300' : 'text-slate-800'}`}>
                          {m.is_absent ? 'ABS' : m.total}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {m.subject_average != null ? m.subject_average.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {m.subject_position ? getOrdinal(m.subject_position) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!m.is_absent && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${gradeColor(m.grade)}`}>
                            {m.grade}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{m.remark}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-5 py-3 font-bold text-slate-700">Total / Average</td>
                    <td colSpan={3} />
                    <td className="px-4 py-3 text-center font-black text-slate-800">{aggregate}</td>
                    <td colSpan={4} className="px-4 py-3 text-center text-sm text-slate-500">
                      Avg: <strong className="text-slate-700">{average}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
