import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { FileText, Download, Printer, Copy, CheckCircle, Search, ChevronDown } from 'lucide-react';

interface Skill { id: string; name: string; sort_order: number; domain: string; }
interface StudentRating { student_id: string; student_name: string; admission_number: string; ratings: Record<string, number>; }
interface Class { id: string; name: string; }
interface Term { id: string; name: string; }
interface AcademicYear { id: string; name: string; }

const RATING_LABELS: Record<number, string> = { 1: 'Fair', 2: 'Normal', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };
const DOMAIN_OPTIONS = [{ value: 'affective', label: 'Affective Domain' }, { value: 'psychomotor', label: 'Psychomotor Domain' }];

function getRatingColor(r: number) {
  if (r === 5) return 'bg-emerald-100 text-emerald-800';
  if (r === 4) return 'bg-blue-100 text-blue-800';
  if (r === 3) return 'bg-sky-100 text-sky-700';
  if (r === 2) return 'bg-amber-100 text-amber-700';
  if (r === 1) return 'bg-red-100 text-red-700';
  return 'text-slate-300';
}

export default function DomainRatingReport() {
  const { profile } = useAuth();
  if (!profile) return null;

  const printRef = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [rows, setRows] = useState<StudentRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState({ domain: 'affective', class_id: '', term_id: '', year_id: '' });

  const schoolId = profile?.school_id;

  useEffect(() => { loadBaseData(); }, [schoolId]);
  useEffect(() => {
    if (filters.class_id && filters.year_id) loadReport();
    else setRows([]);
  }, [filters]);

  async function loadBaseData() {
    if (!schoolId) return;
    const [classRes, termRes, yearRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('terms').select('id, name').order('name'),
      supabase.from('academic_years').select('id, name').eq('school_id', schoolId).order('name'),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (termRes.data) setTerms(termRes.data);
    if (yearRes.data) {
      setYears(yearRes.data);
      const last = yearRes.data[yearRes.data.length - 1];
      if (last) setFilters(f => ({ ...f, year_id: last.id }));
    }
  }

  async function loadReport() {
    setLoading(true);
    const skillRes = await supabase
      .from('domain_skill_definitions')
      .select('id, name, sort_order, domain')
      .eq('school_id', schoolId)
      .eq('domain', filters.domain)
      .eq('is_active', true)
      .order('sort_order');

    const skillList: Skill[] = skillRes.data || [];
    setSkills(skillList);

    if (skillList.length === 0) { setRows([]); setLoading(false); return; }

    const studentsRes = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, admission_number')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('class_id', filters.class_id)
      .order('full_name');

    const students: any[] = studentsRes.data || [];
    if (students.length === 0) { setRows([]); setLoading(false); return; }

    let rQuery = supabase
      .from('student_domain_ratings')
      .select('student_id, skill_id, rating')
      .eq('school_id', schoolId)
      .eq('class_id', filters.class_id)
      .eq('academic_year_id', filters.year_id)
      .in('skill_id', skillList.map(s => s.id));

    if (filters.term_id) rQuery = rQuery.eq('term_id', filters.term_id);
    else rQuery = rQuery.is('term_id', null);

    const { data: rData } = await rQuery;
    const rMap: Record<string, Record<string, number>> = {};
    (rData || []).forEach((r: any) => {
      if (!rMap[r.student_id]) rMap[r.student_id] = {};
      rMap[r.student_id][r.skill_id] = r.rating;
    });

    const reportRows: StudentRating[] = students.map((s: any) => ({
      student_id: s.id,
      student_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      admission_number: s.admission_number || '',
      ratings: rMap[s.id] || {},
    }));

    setRows(reportRows);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=1100,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>Domain Rating Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 16px; }
        h2 { text-align: center; margin-bottom: 4px; }
        p { text-align: center; color: #666; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; }
        th { background: #f5f5f5; font-weight: 600; }
        td:first-child, th:first-child { text-align: left; min-width: 140px; }
        .rotate { writing-mode: vertical-rl; transform: rotate(180deg); display: inline-block; max-height: 80px; }
        @media print { body { margin: 0; } }
      </style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  }

  function buildCSVData(delimiter: string) {
    const className = classes.find(c => c.id === filters.class_id)?.name || '';
    const domainLabel = DOMAIN_OPTIONS.find(d => d.value === filters.domain)?.label || '';
    const header = ['Student Name', 'Admission No', ...skills.map(s => s.name)].join(delimiter);
    const dataRows = filtered.map(row =>
      [row.student_name, row.admission_number, ...skills.map(s => row.ratings[s.id] || '')].join(delimiter)
    );
    return `${domainLabel} - ${className}\n\n${header}\n${dataRows.join('\n')}`;
  }

  function handleCSV() {
    const content = buildCSVData(',');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domain-rating-report-${filters.domain}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  }

  function handleExcel() {
    const content = buildCSVData('\t');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domain-rating-report-${filters.domain}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Excel file downloaded');
  }

  function handleCopy() {
    const content = buildCSVData('\t');
    navigator.clipboard.writeText(content).then(() => showToast('Copied to clipboard'));
  }

  const filtered = rows.filter(r =>
    !search || r.student_name.toLowerCase().includes(search.toLowerCase()) || r.admission_number.toLowerCase().includes(search.toLowerCase())
  );

  const className = classes.find(c => c.id === filters.class_id)?.name || '';
  const termName = terms.find(t => t.id === filters.term_id)?.name || 'All Terms';
  const yearName = years.find(y => y.id === filters.year_id)?.name || '';
  const domainLabel = DOMAIN_OPTIONS.find(d => d.value === filters.domain)?.label || '';

  function avgRating(row: StudentRating) {
    const vals = skills.map(s => row.ratings[s.id]).filter(Boolean) as number[];
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  return (
    <div className="space-y-5">


      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <CheckCircle className="h-4 w-4" /> {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Domain Rating Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">View and export student domain ratings</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button onClick={handleCSV} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <FileText className="h-4 w-4" /> CSV
          </button>
          <button onClick={handleExcel} className="flex items-center gap-2 px-3 py-2 border border-emerald-300 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50 transition-colors">
            <Download className="h-4 w-4" /> Excel
          </button>
          <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Domain</label>
            <div className="relative">
              <select
                value={filters.domain}
                onChange={e => setFilters(f => ({ ...f, domain: e.target.value as any }))}
                className="appearance-none border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {DOMAIN_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Academic Year</label>
            <select
              value={filters.year_id}
              onChange={e => setFilters(f => ({ ...f, year_id: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Year</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select
              value={filters.class_id}
              onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Term</label>
            <select
              value={filters.term_id}
              onChange={e => setFilters(f => ({ ...f, term_id: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="ml-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search Student</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Name or admission..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
              />
            </div>
          </div>
        </div>
      </div>

      {!filters.class_id || !filters.year_id ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center text-slate-400 text-sm">
          Select a domain, class, and academic year to generate the report
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div ref={printRef}>
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-semibold text-slate-800 text-center">{domainLabel} Rating Report</h2>
              <p className="text-sm text-slate-500 text-center mt-0.5">
                {className} &bull; {yearName} &bull; {termName}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                No rating data found for the selected filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-2 text-slate-600 font-medium sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[160px]">
                        Student
                      </th>
                      {skills.map(skill => (
                        <th key={skill.id} className="px-2 py-2 text-center min-w-[90px]">
                          <div className="flex items-end justify-center h-20">
                            <span className="text-slate-600 font-medium text-xs" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                              {skill.name}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center text-slate-600 font-medium min-w-[70px]">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, idx) => {
                      const avg = avgRating(row);
                      return (
                        <tr key={row.student_id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          <td className="px-4 py-2 sticky left-0 bg-inherit z-10 border-r border-slate-100">
                            <div className="font-medium text-slate-800">{row.student_name}</div>
                            {row.admission_number && <div className="text-xs text-slate-400">{row.admission_number}</div>}
                          </td>
                          {skills.map(skill => {
                            const r = row.ratings[skill.id];
                            return (
                              <td key={skill.id} className="px-2 py-2 text-center">
                                {r ? (
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getRatingColor(r)}`} title={RATING_LABELS[r]}>
                                    {r}
                                  </span>
                                ) : (
                                  <span className="text-slate-200 text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            {avg ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${parseFloat(avg) >= 4 ? 'bg-emerald-100 text-emerald-800' : parseFloat(avg) >= 3 ? 'bg-blue-100 text-blue-800' : parseFloat(avg) >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {avg}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-3">
                {[1,2,3,4,5].map(n => (
                  <span key={n} className={`px-2 py-0.5 rounded font-medium ${getRatingColor(n)}`}>{n} = {RATING_LABELS[n]}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
