import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ParentGrades() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [grades, setGrades] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChildren(); }, [profile]);
  useEffect(() => { if (selectedChild && selectedTerm) loadGrades(); }, [selectedChild, selectedTerm]);

  async function loadChildren() {
    if (!profile?.id || !profile?.school_id) return;
    const [linkRes, currentYearRes, termRes] = await Promise.all([
      supabase.from('parent_student_links').select('*, students!student_id(id, first_name, last_name)').eq('parent_id', profile.id),
      supabase.from('academic_years').select('id').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle(),
      supabase.from('terms').select('*').order('name'),
    ]);
    const kids = (linkRes.data ?? []).map(l => (l as any).students).filter(Boolean);
    setChildren(kids);
    const termData = termRes.data ?? [];
    setTerms(termData);
    if (kids.length > 0) setSelectedChild((kids[0] as any).id);
    const currentYear = currentYearRes.data;
    if (currentYear?.id) {
      const { data: ayt } = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', currentYear.id)
        .eq('is_current', true)
        .maybeSingle();
      if (ayt?.term_id) setSelectedTerm(ayt.term_id);
      else if (termData.length > 0) setSelectedTerm(termData[termData.length - 1].id);
    } else if (termData.length > 0) {
      setSelectedTerm(termData[termData.length - 1].id);
    }
    setLoading(false);
  }

  async function loadGrades() {
    setLoading(true);
    const [gradesRes, exclusionRes] = await Promise.all([
      supabase.from('grades').select('*, academic_year_id, subjects(name, code)').eq('student_id', selectedChild).eq('term_id', selectedTerm).order('total_score', { ascending: false }),
      supabase.from('student_subject_exclusions').select('subject_id, academic_year_id, term_id').eq('student_id', selectedChild),
    ]);
    // Year- and term-aware: an exclusion applies when academic_year_id matches AND
    // (term_id is null = whole year, or term_id equals the grade's term).
    const exclusions = exclusionRes.data ?? [];
    const isExcluded = (g: any) => exclusions.some((e: any) =>
      e.subject_id === g.subject_id && e.academic_year_id === g.academic_year_id &&
      (e.term_id == null || e.term_id === g.term_id));
    const rows = (gradesRes.data ?? []).map(g => ({ ...g, _excluded: isExcluded(g) }));
    setGrades(rows);
    setLoading(false);
  }

  function getGradeColor(grade: string) {
    if (!grade) return 'text-app-text-muted bg-app-surface-alt';
    if (grade.startsWith('A')) return 'text-emerald-600 bg-emerald-50';
    if (grade.startsWith('B')) return 'text-blue-600 bg-blue-50';
    if (grade.startsWith('C')) return 'text-amber-600 bg-amber-50';
    return 'text-red-500 bg-red-50';
  }

  const selectedChildName = children.find(c => (c as any).id === selectedChild);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-app-text">Grades Overview</h2>
        <p className="text-app-text-muted text-sm">View your children's academic results</p>
      </div>

      <div className="flex gap-3">
        <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface">
          {children.map(c => <option key={(c as any).id} value={(c as any).id}>{(c as any).first_name} {(c as any).last_name}</option>)}
        </select>
        <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface">
          {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedChildName && (
        <div className="bg-emerald-50 rounded-xl p-3 text-sm text-emerald-700 font-medium">
          Showing grades for {(selectedChildName as any).first_name} {(selectedChildName as any).last_name}
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-app-border bg-app-surface-alt">
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Subject</th>
              <th className="text-center text-xs font-semibold text-app-text-muted uppercase px-3 py-3">CA1</th>
              <th className="text-center text-xs font-semibold text-app-text-muted uppercase px-3 py-3">CA2</th>
              <th className="text-center text-xs font-semibold text-app-text-muted uppercase px-3 py-3">CA3</th>
              <th className="text-center text-xs font-semibold text-app-text-muted uppercase px-3 py-3">Exam</th>
              <th className="text-center text-xs font-semibold text-app-text-muted uppercase px-3 py-3">Total</th>
              <th className="text-center text-xs font-semibold text-app-text-muted uppercase px-3 py-3">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-app-text-muted">Loading...</td></tr>
            ) : grades.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-app-text-muted">No grades for this term</td></tr>
            ) : grades.map(g => (
              <tr key={g.id} className="hover:bg-app-surface-alt transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-app-text">
                  {(g.subjects as any)?.name}
                </td>
                <td className="px-3 py-3 text-center text-sm text-app-text-muted">{g.ca1_score || 0}</td>
                <td className="px-3 py-3 text-center text-sm text-app-text-muted">{g.ca2_score || 0}</td>
                <td className="px-3 py-3 text-center text-sm text-app-text-muted">{g.ca3_score || 0}</td>
                <td className="px-3 py-3 text-center text-sm text-app-text-muted">{g.exam_score || 0}</td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-app-text">{g.total_score || 0}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${getGradeColor(g.grade)}`}>{g.grade || '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
