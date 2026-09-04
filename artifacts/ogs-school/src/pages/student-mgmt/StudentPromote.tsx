import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpCircle, CheckCircle2, AlertCircle } from 'lucide-react';

interface AcademicYear {
  id: string;
  name: string;
}

interface ClassRoom {
  id: string;
  name: string;
}

interface EnrolledStudent {
  id: string;
  student_id: string;
  roll_number: string | null;
  profile: {
    id: string;
    full_name: string;
    student_id?: string;
  };
  result: 'pass' | 'fail' | 'repeat';
  selected: boolean;
  thirdTermAvg: number | null;
}

const THIRD_TERM_ID = '00000000-0000-0000-0000-000000000003';
const PASS_MARK = 40;

export default function StudentPromote() {
  const { user, profile } = useAuth();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);

  const [fromYearId, setFromYearId] = useState('');
  const [fromClassId, setFromClassId] = useState('');
  const [toYearId, setToYearId] = useState('');
  const [toClassId, setToClassId] = useState('');

  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGraduating, setIsGraduating] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      const [{ data: years }, { data: cls }] = await Promise.all([
        supabase.from('academic_years').select('id, name').order('name'),
        supabase.from('classes').select('id, name').order('name'),
      ]);
      setAcademicYears(years || []);
      setClasses(cls || []);
    }
    loadMeta();
  }, []);

  async function loadStudents() {
    if (!fromYearId || !fromClassId) return;
    setLoadingStudents(true);
    setStudents([]);
    setSuccessCount(null);
    setError(null);

    const { data, error } = await supabase
      .from('student_enrollments')
      .select('id, student_id, student:students(id, first_name, last_name, admission_number, roll_number)')
      .eq('academic_year_id', fromYearId)
      .eq('class_id', fromClassId)
      .eq('status', 'active');

    if (error) { setError(error.message); setLoadingStudents(false); return; }

    // Third-term averages decide the default result: >= 40% pass, below 40% repeat.
    // Subjects the student does not offer (exclusions) and zero scores don't count.
    const [gradesRes, exclRes] = await Promise.all([
      supabase
        .from('grades')
        .select('student_id, subject_id, total_score')
        .eq('class_id', fromClassId)
        .eq('academic_year_id', fromYearId)
        .eq('term_id', THIRD_TERM_ID),
      supabase
        .from('student_subject_exclusions')
        .select('student_id, subject_id, term_id')
        .eq('academic_year_id', fromYearId),
    ]);
    const excluded = new Set(
      (exclRes.data ?? [])
        .filter((e: any) => e.term_id == null || e.term_id === THIRD_TERM_ID)
        .map((e: any) => `${e.student_id}:${e.subject_id}`),
    );
    const sums: Record<string, { sum: number; count: number }> = {};
    for (const g of gradesRes.data ?? []) {
      if (excluded.has(`${g.student_id}:${g.subject_id}`)) continue;
      const t = g.total_score ?? 0;
      if (t <= 0) continue;
      (sums[g.student_id] ||= { sum: 0, count: 0 });
      sums[g.student_id].sum += t;
      sums[g.student_id].count += 1;
    }

    const mapped: EnrolledStudent[] = (data || []).map((row: any) => {
      const s = row.student;
      const agg = sums[row.student_id];
      const avg = agg && agg.count > 0 ? agg.sum / agg.count : null;
      return {
        id: row.id,
        student_id: row.student_id,
        roll_number: s?.roll_number ?? null,
        profile: {
          id: s?.id || '',
          full_name: s ? `${s.first_name} ${s.last_name}` : 'Unknown',
          student_id: s?.admission_number || '',
        },
        result: (avg != null && avg < PASS_MARK ? 'repeat' : 'pass') as 'pass' | 'repeat',
        selected: true,
        thirdTermAvg: avg,
      };
    });

    setStudents(mapped);
    setLoadingStudents(false);
  }

  function toggleSelect(id: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  }

  function toggleSelectAll() {
    const allSelected = students.every((s) => s.selected);
    setStudents((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  }

  function setResult(id: string, result: 'pass' | 'fail' | 'repeat') {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, result } : s)));
  }

  async function handlePromote() {
    const selected = students.filter((s) => s.selected);
    if (!selected.length || !toYearId || (!toClassId && !isGraduating)) return;

    // Promoting/graduating into the same academic year would overwrite the
    // very enrollment row we're promoting from, corrupting the student's
    // history. The target must be a different (next) academic year.
    if (toYearId === fromYearId) {
      setError('The "To Academic Year" must be different from the "From Academic Year". Select the next academic year.');
      return;
    }

    setPromoting(true);
    setError(null);
    setSuccessCount(null);

    let count = 0;
    let historyFailures = 0;
    const failures: string[] = [];
    for (const student of selected) {
      const stepErrors: string[] = [];

      // Promotion history is a log — its failure should not block the actual
      // class/status update, but it is surfaced as a warning below.
      const { error: promoErr } = await supabase
        .from('student_promotions')
        .insert({
          student_id: student.student_id,
          from_year_id: fromYearId,
          from_class_id: fromClassId,
          to_year_id: toYearId,
          to_class_id: isGraduating ? null : toClassId,
          result: student.result,
          promoted_by: user?.id ?? null,
        });
      if (promoErr) historyFailures++;

      // Update student table status and class.
      // Note: the update_student RPC skips null values, so for graduation we
      // must clear class_id with a direct table update afterwards.
      if (isGraduating) {
        const { error: rpcErr } = await supabase.rpc('update_student', {
          p_id: student.student_id,
          p_payload: { status: 'graduated' }
        });
        if (rpcErr) stepErrors.push(`status: ${rpcErr.message}`);
        const { error: clearErr, count: cleared } = await supabase
          .from('students')
          .update({ class_id: null }, { count: 'exact' })
          .eq('id', student.student_id);
        if (clearErr) stepErrors.push(`class: ${clearErr.message}`);
        else if (cleared === 0) stepErrors.push('class: not updated (permission denied)');
      } else {
        const { error: rpcErr } = await supabase.rpc('update_student', {
          p_id: student.student_id,
          p_payload: { class_id: toClassId, status: 'active' }
        });
        if (rpcErr) stepErrors.push(`class/status: ${rpcErr.message}`);
      }

      const { error: enrollErr } = await supabase
        .from('student_enrollments')
        .upsert(
          {
            student_id: student.student_id,
            academic_year_id: toYearId,
            class_id: isGraduating ? null : toClassId,
            status: isGraduating ? 'graduated' : 'active',
          },
          { onConflict: 'student_id,academic_year_id' }
        );
      if (enrollErr) stepErrors.push(`enrollment: ${enrollErr.message}`);

      // Close out the old enrollment so the student no longer shows as
      // "active" in the previous class/year (otherwise they reappear in the
      // list and the promotion looks like it did nothing).
      if (!enrollErr) {
        let { error: closeErr } = await supabase
          .from('student_enrollments')
          .update({ status: isGraduating ? 'graduated' : 'promoted' })
          .eq('id', student.id);
        // Older databases don't allow the 'promoted' status yet
        // (see DATABASE_SETUP_ACTIVITY_LOG.sql); fall back to 'withdrawn'.
        if (closeErr && closeErr.code === '23514' && !isGraduating) {
          ({ error: closeErr } = await supabase
            .from('student_enrollments')
            .update({ status: 'withdrawn' })
            .eq('id', student.id));
        }
        if (closeErr) stepErrors.push(`old enrollment: ${closeErr.message}`);
      }

      if (stepErrors.length === 0) {
        count++;
        logActivity(profile, {
          action: isGraduating ? 'student.graduated' : 'student.promoted',
          entityType: 'student',
          studentId: student.student_id,
          details: {
            name: student.profile.full_name,
            ...(isGraduating ? {} : { to_class: classes.find(c => c.id === toClassId)?.name ?? '' }),
          },
        });
      } else {
        failures.push(`${student.profile.full_name} — ${stepErrors.join('; ')}`);
      }
    }

    setSuccessCount(count);
    const messages: string[] = [];
    if (failures.length > 0) {
      const shown = failures.slice(0, 5).join('\n');
      const more = failures.length > 5 ? `\n…and ${failures.length - 5} more` : '';
      messages.push(`${failures.length} student(s) could not be ${isGraduating ? 'graduated' : 'promoted'}:\n${shown}${more}`);
    }
    if (historyFailures > 0) {
      messages.push(`Note: the promotion history record could not be saved for ${historyFailures} student(s) (database permissions). The promotion itself still applied where no other errors are shown.`);
    }
    if (messages.length > 0) setError(messages.join('\n\n'));
    setPromoting(false);

    if (count > 0) {
      loadStudents();
    }
  }

  const selectedCount = students.filter((s) => s.selected).length;
  const canPromote = selectedCount > 0 && toYearId && (toClassId || isGraduating);
  const allSelected = students.length > 0 && students.every((s) => s.selected);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-50 p-2 rounded-lg">
          <ArrowUpCircle className="text-emerald-600" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-app-text">Student Promote</h1>
          <p className="text-sm text-app-text-muted">Promote students to the next academic year or class</p>
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-app-text mb-4">Step 1 — Filter Students</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">From Academic Year</label>
            <select
              value={fromYearId}
              onChange={(e) => { setFromYearId(e.target.value); setStudents([]); setSuccessCount(null); }}
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
            >
              <option value="">Select year...</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1.5">From Class</label>
            <select
              value={fromClassId}
              onChange={(e) => { setFromClassId(e.target.value); setStudents([]); setSuccessCount(null); }}
              className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
            >
              <option value="">Select class...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={loadStudents}
          disabled={!fromYearId || !fromClassId || loadingStudents}
          className="mt-4 px-5 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {loadingStudents ? 'Loading...' : 'Load Students'}
        </button>
      </div>

      {students.length > 0 && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-app-text mb-4">Step 2 — Set Promotion Target</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">To Academic Year <span className="text-red-500">*</span></label>
              <select
                value={toYearId}
                onChange={(e) => setToYearId(e.target.value)}
                className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full"
              >
                <option value="">Select year...</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1.5">To Class <span className="text-red-500">*</span></label>
              <div className="flex flex-col gap-2">
                <select
                  value={toClassId}
                  onChange={(e) => setToClassId(e.target.value)}
                  disabled={isGraduating}
                  className="border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full disabled:bg-app-surface-alt"
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input 
                    type="checkbox" 
                    checked={isGraduating} 
                    onChange={e => {
                      setIsGraduating(e.target.checked);
                      if (e.target.checked) setToClassId('');
                    }}
                    className="rounded accent-emerald-500"
                  />
                  <span className="text-sm font-semibold text-emerald-600">Mark as Graduated / Passed Out (Final Year Students)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {successCount !== null && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 size={15} />
          Successfully promoted {successCount} student{successCount !== 1 ? 's' : ''}.
        </div>
      )}

      {students.length > 0 && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
            <span className="text-sm font-medium text-app-text">
              {students.length} student{students.length !== 1 ? 's' : ''} found
              {selectedCount > 0 && <span className="ml-2 text-emerald-600">({selectedCount} selected)</span>}
            </span>
            <button
              onClick={handlePromote}
              disabled={!canPromote || promoting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-app-primary hover:opacity-90 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <ArrowUpCircle size={15} />
              {promoting ? 'Promoting...' : `Promote Selected (${selectedCount})`}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="px-5 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded accent-emerald-500"
                  />
                </th>
                <th className="text-left px-5 py-3 font-medium text-app-text-muted">Student Name</th>
                <th className="text-left px-5 py-3 font-medium text-app-text-muted">Student ID</th>
                <th className="text-left px-5 py-3 font-medium text-app-text-muted">Roll No.</th>
                <th className="text-center px-5 py-3 font-medium text-app-text-muted">3rd Term Avg</th>
                <th className="text-center px-5 py-3 font-medium text-app-text-muted">
                  <div className="flex flex-col items-center gap-1">
                    <span>Result</span>
                    <div className="flex gap-2">
                      <button onClick={() => setStudents(prev => prev.map(s => ({ ...s, result: 'pass' })))} className="text-[10px] text-emerald-600 hover:underline">All Pass</button>
                      <button onClick={() => setStudents(prev => prev.map(s => ({ ...s, result: 'repeat' })))} className="text-[10px] text-amber-600 hover:underline">All Repeat</button>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {students.map((student) => (
                <tr
                  key={student.id}
                  className={`hover:bg-app-surface-alt transition-colors ${!student.selected ? 'opacity-50' : ''}`}
                >
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={student.selected}
                      onChange={() => toggleSelect(student.id)}
                      className="rounded accent-emerald-500"
                    />
                  </td>
                  <td className="px-5 py-3 font-medium text-app-text">
                    {student.profile?.full_name || '—'}
                  </td>
                  <td className="px-5 py-3 text-app-text-muted">
                    {student.profile?.student_id || '—'}
                  </td>
                  <td className="px-5 py-3 text-app-text-muted">
                    {student.roll_number || '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {student.thirdTermAvg != null ? (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        student.thirdTermAvg >= PASS_MARK
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {student.thirdTermAvg.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-app-text-muted">No results</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-3">
                      {(['pass', 'fail', 'repeat'] as const).map((r) => (
                        <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`result-${student.id}`}
                            value={r}
                            checked={student.result === r}
                            onChange={() => setResult(student.id, r)}
                            className="accent-emerald-500"
                          />
                          <span
                            className={`text-xs font-medium capitalize ${
                              r === 'pass'
                                ? 'text-emerald-600'
                                : r === 'fail'
                                ? 'text-red-500'
                                : 'text-amber-500'
                            }`}
                          >
                            {r}
                          </span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadingStudents && students.length === 0 && fromYearId && fromClassId && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-14 flex flex-col items-center justify-center text-app-text-muted">
          <ArrowUpCircle size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No active enrollments found for the selected filters.</p>
        </div>
      )}
    </div>
  );
}
