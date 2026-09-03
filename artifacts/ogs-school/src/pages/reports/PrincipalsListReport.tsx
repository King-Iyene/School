import { useState, useEffect, useRef } from 'react';
import { Trophy, Star, Award, Printer, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';

interface PrincipalRecord {
  rank: number;
  student_id: string;
  student_name: string;
  class_name: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number;
  grade: string;
  scholarship: boolean;
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

function getGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

const SCHOLARSHIP_SLOTS = 4;
const LIST_SIZE = 10;

export default function PrincipalsListReport() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const printRef = useRef<HTMLDivElement>(null);

  const [records, setRecords] = useState<PrincipalRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [examLabel, setExamLabel] = useState('');
  const [yearLabel, setYearLabel] = useState('');

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchExams(selectedYear);
      setSelectedExam('');
      setRecords([]);
    } else {
      setExams([]);
      setSelectedExam('');
      setRecords([]);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedExam) {
      fetchResults();
      const e = exams.find(x => x.id === selectedExam);
      if (e) setExamLabel(e.name);
    } else {
      setRecords([]);
    }
  }, [selectedExam]);

  async function fetchBaseData() {
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

  async function fetchResults() {
    setLoading(true);
    const { data } = await supabase
      .from('exam_marks_records')
      .select('student_id, ca1, ca3, exam, is_absent, students!student_id(first_name, last_name, class_name)')
      .eq('exam_name_id', selectedExam);

    // Aggregate per student: sum ca1+ca3+exam across all subjects (max 100 each)
    const map = new Map<string, { obtained: number; total: number; class_name: string; name: string }>();
    (data || []).forEach((r: any) => {
      if (r.is_absent) return;
      const score = (r.ca1 ?? 0) + (r.ca3 ?? 0) + (r.exam ?? 0);
      if (score <= 0) return;
      const existing = map.get(r.student_id);
      if (existing) {
        existing.obtained += score;
        existing.total += 100;
      } else {
        map.set(r.student_id, {
          obtained: score,
          total: 100,
          class_name: r.students?.class_name || '-',
          name: r.students?.first_name
            ? `${r.students.first_name} ${r.students.last_name}`
            : 'Unknown',
        });
      }
    });

    const ranked: PrincipalRecord[] = Array.from(map.entries())
      .map(([id, s]) => {
        const pct = s.total > 0 ? Math.round((s.obtained / s.total) * 100) : 0;
        return {
          rank: 0,
          student_id: id,
          student_name: s.name,
          class_name: s.class_name,
          obtained_marks: s.obtained,
          total_marks: s.total,
          percentage: pct,
          grade: getGrade(pct),
          scholarship: false,
        };
      })
      .sort((a, b) => b.percentage - a.percentage || b.obtained_marks - a.obtained_marks)
      .slice(0, LIST_SIZE)
      .map((r, idx) => ({ ...r, rank: idx + 1, scholarship: idx < SCHOLARSHIP_SLOTS }));

    setRecords(ranked);
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  const scholarshipCount = records.filter(r => r.scholarship).length;

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #principals-list-print, #principals-list-print * { visibility: visible; }
          #principals-list-print { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-emerald-600" />
            Principal's List
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Top {LIST_SIZE} students for the term — top {SCHOLARSHIP_SLOTS} receive scholarship next term
          </p>
        </div>
        {records.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print List
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={selectedYear}
            onChange={e => {
              setSelectedYear(e.target.value);
              const y = academicYears.find(a => a.id === e.target.value);
              if (y) setYearLabel(y.name);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select Academic Year *</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
            disabled={!selectedYear}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">Select Term / Exam *</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4 no-print">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">School Champion</p>
                <p className="text-base font-bold text-slate-800 mt-1 truncate">{records[0]?.student_name}</p>
                <p className="text-sm text-emerald-600">{records[0]?.percentage}% · {records[0]?.class_name}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-lg">
                <Trophy className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">On Principal's List</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{records.length}</p>
                <p className="text-sm text-slate-400">of all students</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Star className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Scholarships Next Term</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{scholarshipCount}</p>
                <p className="text-sm text-slate-400">students awarded</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-lg">
                <Award className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table (screen view) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-600 font-medium w-14">Rank</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Class</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Obtained</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Total</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">%</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Grade</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Scholarship</th>
              </tr>
            </thead>
            <tbody>
              {!selectedExam ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Select an academic year and term to generate the Principal's List
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">Loading results…</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No results found for this term</td>
                </tr>
              ) : (
                records.map(r => (
                  <tr
                    key={r.student_id}
                    className={`border-b transition-colors ${
                      r.rank === 1
                        ? 'bg-amber-50'
                        : r.rank === 2
                        ? 'bg-slate-50'
                        : r.rank === 3
                        ? 'bg-orange-50'
                        : r.scholarship
                        ? 'bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      {r.rank === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          <Trophy className="h-3 w-3" />1st
                        </span>
                      ) : r.rank === 2 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">2nd</span>
                      ) : r.rank === 3 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">3rd</span>
                      ) : (
                        <span className="text-slate-600 font-medium">{r.rank}th</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.student_name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.class_name}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.obtained_marks}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{r.total_marks}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{r.percentage}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.percentage >= 70 ? 'bg-emerald-100 text-emerald-800'
                        : r.percentage >= 50 ? 'bg-blue-100 text-blue-800'
                        : r.percentage >= 40 ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                      }`}>{r.grade}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.scholarship ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          <Award className="h-3 w-3" />Awarded
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Print View ── */}
      {records.length > 0 && (
        <div id="principals-list-print" ref={printRef} className="hidden print:block bg-white p-10 text-black" style={{ display: 'none' }}>
          {/* School Header */}
          <div className="text-center mb-8 border-b-2 border-black pb-6">
            <h1 className="text-2xl font-extrabold uppercase tracking-wide">{settings.school_name || 'School Portal'}</h1>
            <p className="text-sm mt-1">Port Harcourt, Rivers State</p>
            <div className="mt-4">
              <h2 className="text-xl font-bold uppercase border border-black inline-block px-8 py-2 tracking-widest">
                Principal's List
              </h2>
            </div>
            <p className="mt-3 text-sm font-medium">
              Academic Year: <strong>{yearLabel}</strong> &nbsp;|&nbsp; Term: <strong>{examLabel}</strong>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Top {LIST_SIZE} students by overall academic performance · Top {SCHOLARSHIP_SLOTS} awarded scholarship for the following term
            </p>
          </div>

          {/* Print Table */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border border-gray-400">
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Rank</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-bold">Student Name</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-bold">Class</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Marks Obtained</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Total Marks</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Percentage</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Grade</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Scholarship</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.student_id} className={r.scholarship ? 'bg-gray-50 font-medium' : ''}>
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                    {r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : r.rank === 3 ? '3rd' : `${r.rank}th`}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">{r.student_name}</td>
                  <td className="border border-gray-300 px-3 py-2">{r.class_name}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{r.obtained_marks}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{r.total_marks}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold">{r.percentage}%</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{r.grade}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    {r.scholarship ? '✓ Awarded' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Scholarship Note */}
          <div className="mt-6 border border-gray-400 rounded p-4 bg-gray-50">
            <p className="font-bold text-sm mb-1">Scholarship Award Note:</p>
            <p className="text-sm">
              The following {SCHOLARSHIP_SLOTS} students ranked 1st–{SCHOLARSHIP_SLOTS} on this list are hereby awarded scholarship for the next term:
            </p>
            <ol className="mt-2 list-decimal list-inside text-sm space-y-1">
              {records.filter(r => r.scholarship).map(r => (
                <li key={r.student_id}>
                  <strong>{r.student_name}</strong> ({r.class_name}) — {r.percentage}%
                </li>
              ))}
            </ol>
          </div>

          {/* Signatures */}
          <div className="mt-10 grid grid-cols-2 gap-16">
            <div className="text-center">
              <div className="border-t-2 border-black pt-2">
                <p className="font-bold text-sm">Principal's Signature</p>
                <p className="text-xs text-gray-500 mt-1">Kelvin Sampson Fubara</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-black pt-2">
                <p className="font-bold text-sm">Date</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            This document is an official record of {settings.school_name || 'School Portal'} — generated from the school management portal.
          </p>
        </div>
      )}
    </div>
  );
}
