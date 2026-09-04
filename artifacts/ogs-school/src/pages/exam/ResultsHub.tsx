import { useEffect, useMemo, useState } from 'react';
import { Award, FileText, Lock, Unlock, Search, Filter, Settings, MessageSquare, X, Save, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import { getOverallRemark } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';
import StudentReportPrint from '../../components/print/StudentReportPrint';
import ClassReportsPrint from '../../components/print/ClassReportsPrint';

interface FilterOption { id: string; name: string; }

interface StudentRow {
  student_id: string;
  full_name: string;
  admission_number: string;
  total: number;
  average: number;
  subject_count: number;
  position: number | null;
  remark: string;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


function remarkBadge(r: string): string {
  switch (r) {
    case 'Excellent': return 'bg-emerald-100 text-emerald-700';
    case 'Very Good': return 'bg-blue-100 text-blue-700';
    case 'Good': return 'bg-amber-100 text-amber-700';
    case 'Pass': return 'bg-orange-100 text-orange-700';
    default: return 'bg-red-100 text-red-700';
  }
}

export default function ResultsHub() {
  const { profile } = useAuth();
  const [years, setYears] = useState<FilterOption[]>([]);
  const [terms, setTerms] = useState<FilterOption[]>([]);
  const [classes, setClasses] = useState<FilterOption[]>([]);
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [compilation, setCompilation] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [classTeacherId, setClassTeacherId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const isPrincipal = profile?.role === 'super_admin' || profile?.role === 'principal';
  const canPublish = isAdmin || profile?.role === 'teacher';
  const isFormTeacher = !!profile?.id && classTeacherId === profile.id;
  const canEditTermSettings = isAdmin || profile?.role === 'accountant';
  const canEditFormTeacherComment = isAdmin || isFormTeacher;

  useEffect(() => { loadFilters(); }, [profile?.school_id]);
  useEffect(() => { if (yearId && termId && classId) loadResults(); else setRows([]); }, [yearId, termId, classId]);
  useEffect(() => {
    (async () => {
      if (!classId) { setClassTeacherId(null); return; }
      const { data } = await supabase.from('classes').select('class_teacher_id').eq('id', classId).maybeSingle();
      setClassTeacherId(data?.class_teacher_id ?? null);
    })();
  }, [classId]);

  async function loadFilters() {
    if (!profile?.school_id) return;
    const isPrivileged = ['super_admin', 'admin', 'principal'].includes(profile?.role ?? '');

    const classQuery = isPrivileged
      ? supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id).order('name')
      : supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id).eq('class_teacher_id', profile.id).order('name');

    const [yRes, tRes, cRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_current').eq('school_id', profile.school_id).order('name', { ascending: false }),
      supabase.from('terms').select('id, name').order('name'),
      classQuery,
    ]);
    setYears((yRes.data ?? []).map((y: any) => ({ id: y.id, name: y.name })));
    setTerms((tRes.data ?? []).map((t: any) => ({ id: t.id, name: t.name })));
    const loadedClasses = (cRes.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name || `${c.level ?? ''}${c.section ? '-' + c.section : ''}`,
    }));
    setClasses(loadedClasses);
    const current = (yRes.data ?? []).find((y: any) => y.is_current);
    if (current) setYearId(current.id);
    // Auto-select the only class for form teachers
    if (!isPrivileged && loadedClasses.length === 1) setClassId(loadedClasses[0].id);
  }

  async function loadResults() {
    setLoading(true);

    const [gradesRes, compRes, exclusionsRes] = await Promise.all([
      supabase
        .from('grades')
        .select('student_id, subject_id, total_score, ca1_score, ca3_score, exam_score')
        .eq('class_id', classId)
        .eq('term_id', termId)
        .eq('academic_year_id', yearId),
      supabase
        .from('result_compilations')
        .select('id, status')
        .eq('class_id', classId)
        .eq('term_id', termId)
        .eq('academic_year_id', yearId)
        .maybeSingle(),
      supabase
        .from('student_subject_exclusions')
        .select('student_id, subject_id')
        .eq('academic_year_id', yearId),
    ]);

    setCompilation(compRes.data ? { id: compRes.data.id, status: compRes.data.status } : null);

    const exclusionSet = new Set<string>((exclusionsRes.data ?? []).map((e: any) => `${e.student_id}:${e.subject_id}`));

    const sums: Record<string, { sum: number; count: number }> = {};
    for (const g of gradesRes.data ?? []) {
      if (exclusionSet.has(`${g.student_id}:${(g as any).subject_id}`)) continue;
      const t = (g as any).total_score ?? (((g as any).ca1_score || 0) + ((g as any).ca3_score || 0) + ((g as any).exam_score || 0));
      if (t == null || t <= 0) continue;
      if (!sums[g.student_id]) sums[g.student_id] = { sum: 0, count: 0 };
      sums[g.student_id].sum += t;
      sums[g.student_id].count += 1;
    }
    const allStudentIds = Object.keys(sums);
    if (allStudentIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Cross-reference with enrollments to exclude students from other classes
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('academic_year_id', yearId)
      .eq('status', 'active');

    const enrolledSet = new Set((enrollments ?? []).map((e: any) => e.student_id));
    // Fall back to all if enrollment table has no data for this class yet
    const studentIds = enrolledSet.size > 0
      ? allStudentIds.filter(id => enrolledSet.has(id))
      : allStudentIds;

    if (studentIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .in('id', studentIds);

    const studentMap = new Map<string, { full_name: string; admission_number: string }>();
    for (const s of students ?? []) {
      studentMap.set(s.id, {
        full_name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        admission_number: s.admission_number ?? '',
      });
    }

    const aggList = studentIds.map(sid => {
      const v = sums[sid];
      return {
        sid,
        avg: v.count > 0 ? v.sum / v.count : 0,
        sum: v.sum,
        count: v.count,
      };
    });

    const built: StudentRow[] = aggList.map(a => {
      const higher = new Set(aggList.filter(x => x.avg > a.avg).map(x => x.avg.toFixed(4))).size;
      const meta = studentMap.get(a.sid);
      return {
        student_id: a.sid,
        full_name: meta?.full_name || '—',
        admission_number: meta?.admission_number || '',
        total: a.sum,
        average: a.avg,
        subject_count: a.count,
        position: higher + 1,
        remark: getOverallRemark(a.avg),
      };
    });

    built.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    setRows(built);
    setLoading(false);
  }

  async function togglePublish() {
    if (!canPublish || !profile?.school_id || !classId || !termId || !yearId) return;
    setBusy(true);

    if (!compilation) {
      const { data, error } = await supabase
        .from('result_compilations')
        .insert({
          school_id: profile.school_id,
          class_id: classId,
          term_id: termId,
          academic_year_id: yearId,
          compiled_by: profile.id,
          compiled_at: new Date().toISOString(),
          status: 'published',
          notes: '',
        })
        .select('id, status')
        .maybeSingle();
      if (!error && data) {
        setCompilation({ id: data.id, status: data.status });
        logActivity(profile, {
          action: 'result.published',
          entityType: 'result',
          entityId: data.id,
          details: { class: classes.find(c => c.id === classId)?.name ?? '', term: terms.find(t => t.id === termId)?.name ?? '' },
        });
      }
    } else {
      const next = compilation.status === 'published' ? 'compiled' : 'published';
      const { error } = await supabase
        .from('result_compilations')
        .update({
          status: next,
          compiled_by: profile.id,
          compiled_at: new Date().toISOString(),
        })
        .eq('id', compilation.id);
      if (!error) {
        setCompilation({ ...compilation, status: next });
        logActivity(profile, {
          action: next === 'published' ? 'result.published' : 'result.compiled',
          entityType: 'result',
          entityId: compilation.id,
          details: { class: classes.find(c => c.id === classId)?.name ?? '', term: terms.find(t => t.id === termId)?.name ?? '', ...(next !== 'published' ? { note: 'unpublished' } : {}) },
        });
      }
    }

    setBusy(false);
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.full_name.toLowerCase().includes(q) ||
      r.admission_number.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const classAvg = rows.reduce((s, r) => s + r.average, 0) / rows.length;
    const passed = rows.filter(r => r.average >= 50).length;
    return { classAvg, passed };
  }, [rows]);

  const isPublished = compilation?.status === 'published';

  if (viewing) {
    return (
      <StudentReportPrint
        studentId={viewing}
        termId={termId}
        academicYearId={yearId}
        classId={classId}
        onClose={() => setViewing(null)}
      />
    );
  }

  if (printingAll) {
    return (
      <ClassReportsPrint
        classId={classId}
        termId={termId}
        academicYearId={yearId}
        studentIds={filteredRows.map(r => r.student_id)}
        onClose={() => setPrintingAll(false)}
      />
    );
  }

  const isPrivileged = ['super_admin', 'admin', 'principal'].includes(profile?.role ?? '');
  const isTeacher = profile?.role === 'teacher';
  const hasNoAccess = !isPrivileged && !isTeacher;
  const isTeacherWithNoClass = isTeacher && classes.length === 0;

  if (hasNoAccess || isTeacherWithNoClass) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Results Hub</h1>
          <p className="text-app-text-muted text-sm mt-0.5">Browse, manage and publish term results by session, term and class</p>
        </div>
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-20 text-center">
          <Lock className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <p className="text-app-text-muted font-semibold text-lg">Access Restricted</p>
          <p className="text-app-text-muted text-sm mt-1 max-w-sm mx-auto">
            {isTeacherWithNoClass
              ? 'You are not assigned as a form master for any class. Only form masters can access this section.'
              : 'Only form masters, administrators, and the principal can access the Results Hub.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-app-text">Results Hub</h1>
        <p className="text-app-text-muted text-sm mt-0.5">Browse, manage and publish term results by session, term and class</p>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-app-text-muted uppercase tracking-wider mb-1.5">Academic Session</label>
            <select value={yearId} onChange={e => setYearId(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30">
              <option value="">Select session...</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-app-text-muted uppercase tracking-wider mb-1.5">Term</label>
            <select value={termId} onChange={e => setTermId(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30">
              <option value="">Select term...</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-app-text-muted uppercase tracking-wider mb-1.5">Class</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30">
              <option value="">Select class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!yearId || !termId || !classId ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <Filter className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">Select session, term and class</p>
          <p className="text-app-text-muted text-sm mt-1">Choose all three filters to load results</p>
        </div>
      ) : loading ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-app-text-muted text-sm">Loading results...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-16 text-center">
          <Award className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No results recorded</p>
          <p className="text-app-text-muted text-sm mt-1">No grades have been entered for this class, term and session yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
              <p className="text-2xl font-black text-app-text">{rows.length}</p>
              <p className="text-xs text-app-text-muted mt-0.5">Students</p>
            </div>
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
              <p className="text-2xl font-black text-emerald-600">{stats?.classAvg.toFixed(2)}%</p>
              <p className="text-xs text-app-text-muted mt-0.5">Class Average</p>
            </div>
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 text-center">
              <p className="text-2xl font-black text-blue-600">{stats?.passed}/{rows.length}</p>
              <p className="text-xs text-app-text-muted mt-0.5">Passed (≥50%)</p>
            </div>
            <div className={`rounded-2xl border shadow-sm p-4 text-center ${isPublished ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-sm font-bold uppercase ${isPublished ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isPublished ? 'Published' : 'Unpublished'}
              </p>
              <div className="mt-2 flex flex-col gap-1.5 items-center">
                {canPublish && (
                  <button
                    onClick={togglePublish}
                    disabled={busy}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${isPublished ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                  >
                    {isPublished ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {busy ? 'Saving...' : isPublished ? 'Unpublish' : 'Publish Results'}
                  </button>
                )}
                {canEditTermSettings && (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-800 text-white"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Term Settings
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-app-border flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-semibold text-app-text">Student Results</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintingAll(true)}
                  disabled={filteredRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-app-primary hover:opacity-90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Print report cards for all students in this class"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print All ({filteredRows.length})
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or admission no..."
                    className="bg-app-surface text-app-text border border-app-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-64"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-app-surface-alt border-b border-app-border">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-app-text-muted">Pos</th>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Student</th>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">ADM No.</th>
                    <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Subjects</th>
                    <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Total</th>
                    <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Average</th>
                    <th className="text-center px-4 py-3 font-semibold text-app-text-muted">Remark</th>
                    <th className="text-right px-5 py-3 font-semibold text-app-text-muted">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredRows.map(r => (
                    <tr key={r.student_id} className="hover:bg-app-surface-alt transition-colors">
                      <td className="px-5 py-3 font-bold text-app-text">{r.position ? getOrdinal(r.position) : '—'}</td>
                      <td className="px-4 py-3 font-medium text-app-text">{r.full_name}</td>
                      <td className="px-4 py-3 text-app-text-muted text-xs font-mono">{r.admission_number}</td>
                      <td className="px-4 py-3 text-center text-app-text-muted">{r.subject_count}</td>
                      <td className="px-4 py-3 text-center font-semibold text-app-text">{r.total}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600">{r.average.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${remarkBadge(r.remark)}`}>{r.remark}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {(canEditFormTeacherComment || isPrincipal) && (
                            <button
                              onClick={() => setEditingStudent(r)}
                              className="inline-flex items-center gap-1.5 text-app-text-muted hover:text-app-text text-sm font-semibold"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Comments
                            </button>
                          )}
                          <button
                            onClick={() => setViewing(r.student_id)}
                            className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 text-sm font-semibold"
                          >
                            <FileText className="w-4 h-4" />
                            View Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showSettings && (
        <TermSettingsModal
          schoolId={profile!.school_id}
          classId={classId}
          termId={termId}
          yearId={yearId}
          onClose={() => setShowSettings(false)}
        />
      )}

      {editingStudent && (
        <StudentCommentsModal
          schoolId={profile!.school_id}
          classId={classId}
          termId={termId}
          yearId={yearId}
          studentId={editingStudent.student_id}
          studentName={editingStudent.full_name}
          canEditFormTeacher={canEditFormTeacherComment}
          canEditPrincipal={isPrincipal}
          currentUserId={profile!.id}
          onClose={() => setEditingStudent(null)}
        />
      )}
    </div>
  );
}

interface TermSettingsModalProps {
  schoolId: string;
  classId: string;
  termId: string;
  yearId: string;
  onClose: () => void;
}

function TermSettingsModal({ schoolId, classId, termId, yearId, onClose }: TermSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [nextTermFees, setNextTermFees] = useState('');
  const [otherFees, setOtherFees] = useState('');
  const [nextTermBegins, setNextTermBegins] = useState('');
  const [vacationDate, setVacationDate] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('class_term_settings')
        .select('*')
        .eq('class_id', classId)
        .eq('term_id', termId)
        .eq('academic_year_id', yearId)
        .maybeSingle();
      if (data) {
        setRecordId(data.id);
        setNextTermFees(data.next_term_fees != null ? String(data.next_term_fees) : '');
        setOtherFees(data.other_fees != null ? String(data.other_fees) : '');
        setNextTermBegins(data.next_term_begins ?? '');
        setVacationDate(data.vacation_date ?? '');
      }
      setLoading(false);
    })();
  }, [classId, termId, yearId]);

  async function save() {
    setSaving(true);
    const payload = {
      school_id: schoolId,
      class_id: classId,
      term_id: termId,
      academic_year_id: yearId,
      next_term_fees: nextTermFees ? Number(nextTermFees) : 0,
      other_fees: otherFees ? Number(otherFees) : 0,
      next_term_begins: nextTermBegins || null,
      vacation_date: vacationDate || null,
      updated_at: new Date().toISOString(),
    };
    if (recordId) {
      await supabase.from('class_term_settings').update(payload).eq('id', recordId);
    } else {
      await supabase.from('class_term_settings').insert(payload);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h3 className="font-bold text-app-text">Class Term Settings</h3>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text"><X className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="py-12 text-center"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Next Term Fees (NGN)</label>
              <input type="number" value={nextTermFees} onChange={e => setNextTermFees(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Other Fees (NGN)</label>
              <input type="number" value={otherFees} onChange={e => setOtherFees(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Vacation Date</label>
              <input type="date" value={vacationDate} onChange={e => setVacationDate(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Next Term Begins</label>
              <input type="date" value={nextTermBegins} onChange={e => setNextTermBegins(e.target.value)} className="bg-app-surface text-app-text w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-app-text bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-app-primary hover:opacity-90 rounded-lg disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StudentCommentsModalProps {
  schoolId: string;
  classId: string;
  termId: string;
  yearId: string;
  studentId: string;
  studentName: string;
  canEditFormTeacher: boolean;
  canEditPrincipal: boolean;
  currentUserId: string;
  onClose: () => void;
}

function StudentCommentsModal({ schoolId, classId, termId, yearId, studentId, studentName, canEditFormTeacher, canEditPrincipal, currentUserId, onClose }: StudentCommentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [behaviour, setBehaviour] = useState('');
  const [formTeacherComment, setFormTeacherComment] = useState('');
  const [principalComment, setPrincipalComment] = useState('');
  const [outstandingOverride, setOutstandingOverride] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('report_card_comments')
        .select('*')
        .eq('student_id', studentId)
        .eq('term_id', termId)
        .eq('academic_year_id', yearId)
        .maybeSingle();
      if (data) {
        setRecordId(data.id);
        setBehaviour(data.social_behaviour_remark ?? '');
        setFormTeacherComment(data.form_teacher_comment ?? '');
        setPrincipalComment(data.principal_comment ?? '');
        setOutstandingOverride(data.outstanding_fees_override != null ? String(data.outstanding_fees_override) : '');
      }
      setLoading(false);
    })();
  }, [studentId, termId, yearId]);

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();
    const base: any = {
      school_id: schoolId,
      student_id: studentId,
      term_id: termId,
      academic_year_id: yearId,
      class_id: classId,
      updated_at: now,
    };
    if (canEditFormTeacher) {
      base.social_behaviour_remark = behaviour;
      base.form_teacher_comment = formTeacherComment;
      base.form_teacher_signed_by = currentUserId;
      base.form_teacher_signed_at = now;
      base.outstanding_fees_override = outstandingOverride === '' ? null : Number(outstandingOverride);
    }
    if (canEditPrincipal) {
      base.principal_comment = principalComment;
      base.principal_signed_by = currentUserId;
      base.principal_signed_at = now;
    }
    if (recordId) {
      await supabase.from('report_card_comments').update(base).eq('id', recordId);
    } else {
      await supabase.from('report_card_comments').insert(base);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border sticky top-0 bg-app-surface">
          <div>
            <h3 className="font-bold text-app-text">Report Comments</h3>
            <p className="text-xs text-app-text-muted mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text"><X className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="py-12 text-center"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Social Behaviour Remark</label>
              <textarea
                rows={2}
                value={behaviour}
                onChange={e => setBehaviour(e.target.value)}
                disabled={!canEditFormTeacher}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 disabled:bg-app-surface-alt"
                placeholder="e.g. Polite, respectful, cooperates well with peers..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Form Teacher's Comment</label>
              <textarea
                rows={3}
                value={formTeacherComment}
                onChange={e => setFormTeacherComment(e.target.value)}
                disabled={!canEditFormTeacher}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 disabled:bg-app-surface-alt"
                placeholder="Form teacher's comments on the student's overall performance..."
              />
              {!canEditFormTeacher && <p className="text-[11px] text-app-text-muted mt-1">Only the form teacher or an admin can edit this.</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Principal's Comment</label>
              <textarea
                rows={3}
                value={principalComment}
                onChange={e => setPrincipalComment(e.target.value)}
                disabled={!canEditPrincipal}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 disabled:bg-app-surface-alt"
                placeholder="Principal's comments..."
              />
              {!canEditPrincipal && <p className="text-[11px] text-app-text-muted mt-1">Only the principal or super admin can edit this.</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-app-text-muted uppercase mb-1.5">Outstanding Fees Override (NGN)</label>
              <input
                type="number"
                value={outstandingOverride}
                onChange={e => setOutstandingOverride(e.target.value)}
                disabled={!canEditFormTeacher}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 disabled:bg-app-surface-alt"
                placeholder="Leave blank to auto-calculate from finance module"
              />
              <p className="text-[11px] text-app-text-muted mt-1">Optional. Leave blank to use the value from the fees module.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-app-text bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button
                onClick={save}
                disabled={saving || (!canEditFormTeacher && !canEditPrincipal)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-app-primary hover:opacity-90 rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
