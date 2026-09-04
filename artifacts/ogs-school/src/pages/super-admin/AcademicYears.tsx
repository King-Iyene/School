import { useEffect, useRef, useState } from 'react';
import {
  Plus, Calendar, CheckCircle, Pencil, ChevronRight, BookOpen,
  Lock, Trash2, AlertTriangle, X, CheckCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { AcademicYear, Term, AcademicYearTerm } from '../../lib/types';
import Modal from '../../components/common/Modal';

const TERM_ORDER = ['First Term', 'Second Term', 'Third Term'];
const TERM_SHORT: Record<string, string> = {
  'First Term': '1st',
  'Second Term': '2nd',
  'Third Term': '3rd',
};

interface AcademicYearTermWithName extends AcademicYearTerm {
  terms?: { name: string };
}

interface YearWithTermDates extends AcademicYear {
  termDates: AcademicYearTermWithName[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface FieldErrors {
  name?: string;
  start_date?: string;
  end_date?: string;
}

export default function AcademicYears() {
  const { profile } = useAuth();
  const [years, setYears] = useState<YearWithTermDates[]>([]);
  const [globalTerms, setGlobalTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showYearModal, setShowYearModal] = useState(false);
  const [showEditYearModal, setShowEditYearModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditTermModal, setShowEditTermModal] = useState(false);

  // Subjects of edit / delete
  const [editingAYT, setEditingAYT] = useState<AcademicYearTermWithName | null>(null);
  const [editingYear, setEditingYear] = useState<YearWithTermDates | null>(null);
  const [deletingYear, setDeletingYear] = useState<YearWithTermDates | null>(null);
  const [linkedCount, setLinkedCount] = useState(0);
  const [loadingLinked, setLoadingLinked] = useState(false);

  // Forms
  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '' });
  const [yearEditForm, setYearEditForm] = useState({ name: '', start_date: '', end_date: '' });
  const [termForm, setTermForm] = useState({ start_date: '', end_date: '' });

  // Validation
  const [yearFieldErrors, setYearFieldErrors] = useState<FieldErrors>({});
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [termError, setTermError] = useState('');

  // Actions
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  useEffect(() => { loadData(); }, [profile]);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function loadData() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [yearRes, termRes, aytRes] = await Promise.all([
      supabase.from('academic_years').select('*').eq('school_id', profile.school_id).order('start_date', { ascending: false }),
      supabase.from('terms').select('*').order('name'),
      supabase.from('academic_year_terms').select('*, terms(name)'),
    ]);

    const fetchedYears = yearRes.data ?? [];
    const terms = termRes.data ?? [];
    const ayt = (aytRes.data ?? []) as AcademicYearTermWithName[];

    setGlobalTerms(terms);

    const combined: YearWithTermDates[] = fetchedYears.map(y => {
      const yearAYTs = ayt.filter(a => a.academic_year_id === y.id);
      const ordered = TERM_ORDER
        .map(name => yearAYTs.find(a => a.terms?.name === name))
        .filter(Boolean) as AcademicYearTermWithName[];
      return { ...y, termDates: ordered };
    });
    setYears(combined);
    setLoading(false);
  }

  // ─── Create Year ──────────────────────────────────────────────────────────

  async function saveYear() {
    const errors: FieldErrors = {};
    if (!yearForm.name.trim()) errors.name = 'Year name is required.';
    else if (years.some(y => y.name.trim().toLowerCase() === yearForm.name.trim().toLowerCase())) {
      errors.name = 'An academic year with this name already exists.';
    }
    if (!yearForm.start_date) errors.start_date = 'Start date is required.';
    if (!yearForm.end_date) errors.end_date = 'End date is required.';
    if (yearForm.start_date && yearForm.end_date && yearForm.start_date >= yearForm.end_date) {
      errors.end_date = 'End date must be after start date.';
    }
    setYearFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    const { data: newYear, error } = await supabase
      .from('academic_years')
      .insert({ name: yearForm.name.trim(), start_date: yearForm.start_date, end_date: yearForm.end_date, school_id: profile?.school_id, is_current: false })
      .select()
      .maybeSingle();
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }

    if (newYear && globalTerms.length > 0) {
      await supabase.from('academic_year_terms').insert(
        globalTerms.map(t => ({ academic_year_id: newYear.id, term_id: t.id, start_date: null, end_date: null, is_current: false }))
      );
    }
    setSaving(false);
    setShowYearModal(false);
    setYearForm({ name: '', start_date: '', end_date: '' });
    setYearFieldErrors({});
    await loadData();
    showToast('Academic year created successfully');
  }

  // ─── Set Current Year / Term ──────────────────────────────────────────────

  async function setCurrentYear(year: AcademicYear) {
    await supabase.from('academic_years').update({ is_current: false }).eq('school_id', profile?.school_id ?? '');
    await supabase.from('academic_years').update({ is_current: true }).eq('id', year.id);
    loadData();
  }

  async function setCurrentTerm(ayt: AcademicYearTermWithName) {
    await supabase.from('academic_year_terms').update({ is_current: false }).eq('academic_year_id', ayt.academic_year_id);
    await supabase.from('academic_year_terms').update({ is_current: true }).eq('id', ayt.id);
    loadData();
  }

  // ─── Edit Term Dates ──────────────────────────────────────────────────────

  function openEditTerm(ayt: AcademicYearTermWithName) {
    setEditingAYT(ayt);
    setTermForm({ start_date: ayt.start_date ?? '', end_date: ayt.end_date ?? '' });
    setTermError('');
    setShowEditTermModal(true);
  }

  async function saveTermDates() {
    if (!editingAYT) return;
    if (!termForm.start_date || !termForm.end_date) { setTermError('Both dates are required.'); return; }
    if (termForm.start_date >= termForm.end_date) { setTermError('Start date must be before end date.'); return; }
    setSaving(true);
    setTermError('');
    const { error } = await supabase
      .from('academic_year_terms')
      .update({ start_date: termForm.start_date, end_date: termForm.end_date })
      .eq('id', editingAYT.id);
    setSaving(false);
    if (error) { setTermError(error.message); return; }
    setShowEditTermModal(false);
    setEditingAYT(null);
    await loadData();
    showToast('Term dates updated successfully');
  }

  // ─── Edit Year ────────────────────────────────────────────────────────────

  function openEditYear(year: YearWithTermDates) {
    setEditingYear(year);
    setYearEditForm({ name: year.name, start_date: year.start_date, end_date: year.end_date });
    setEditFieldErrors({});
    setShowEditYearModal(true);
  }

  async function saveEditYear() {
    if (!editingYear) return;
    const errors: FieldErrors = {};
    const nameVal = yearEditForm.name.trim();
    if (!nameVal) errors.name = 'Year name is required.';
    else if (years.some(y => y.id !== editingYear.id && y.name.trim().toLowerCase() === nameVal.toLowerCase())) {
      errors.name = 'Another academic year with this name already exists.';
    }
    if (!yearEditForm.start_date) errors.start_date = 'Start date is required.';
    if (!yearEditForm.end_date) errors.end_date = 'End date is required.';
    if (yearEditForm.start_date && yearEditForm.end_date && yearEditForm.start_date >= yearEditForm.end_date) {
      errors.end_date = 'End date must be after start date.';
    }
    setEditFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    const { error } = await supabase
      .from('academic_years')
      .update({ name: nameVal, start_date: yearEditForm.start_date, end_date: yearEditForm.end_date })
      .eq('id', editingYear.id);
    setSaving(false);
    if (error) { setEditFieldErrors({ name: error.message }); return; }

    setShowEditYearModal(false);
    setEditingYear(null);
    await loadData();
    showToast('Academic year updated successfully');
  }

  // ─── Delete Year ──────────────────────────────────────────────────────────

  async function openDeleteYear(year: YearWithTermDates) {
    if (year.is_current) {
      showToast('Cannot delete the active academic year. Set another year as current first.', 'error');
      return;
    }
    setDeletingYear(year);
    setDeleteError('');
    setLinkedCount(0);
    setShowDeleteConfirm(true);

    // Count linked records (enrollments)
    setLoadingLinked(true);
    const { count } = await supabase
      .from('student_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', year.id);
    setLinkedCount(count ?? 0);
    setLoadingLinked(false);
  }

  async function confirmDeleteYear() {
    if (!deletingYear) return;
    setDeleting(true);
    setDeleteError('');
    // Delete academic_year_terms first (may not cascade)
    await supabase.from('academic_year_terms').delete().eq('academic_year_id', deletingYear.id);
    // Delete the year itself
    const { error } = await supabase.from('academic_years').delete().eq('id', deletingYear.id);
    setDeleting(false);
    if (error) { setDeleteError(error.message); return; }
    setShowDeleteConfirm(false);
    setDeletingYear(null);
    await loadData();
    showToast('Academic year deleted successfully');
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const currentYear = years.find(y => y.is_current);
  const currentAYT = currentYear?.termDates.find(a => a.is_current);
  const inputClass = 'w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-app-surface';
  const inputErrorClass = 'w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 bg-app-surface';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Toast stack */}
      <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-in slide-in-from-right duration-300 ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {t.type === 'success'
              ? <CheckCheck className="w-4 h-4 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            }
            {t.message}
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Academic Calendar</h1>
          <p className="text-app-text-muted text-sm mt-0.5">Manage academic years and configure term date ranges</p>
        </div>
        <button
          onClick={() => { setShowYearModal(true); setYearFieldErrors({}); setYearForm({ name: '', start_date: '', end_date: '' }); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-100"
        >
          <Plus className="w-4 h-4" />
          New Academic Year
        </button>
      </div>

      {/* Fixed terms notice */}
      <div className="bg-app-surface-alt border border-app-border rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-app-text-muted" />
        </div>
        <div>
          <p className="font-medium text-app-text text-sm">3 Fixed Global Terms</p>
          <p className="text-app-text-muted text-xs mt-0.5">
            The system uses <strong>First Term</strong>, <strong>Second Term</strong>, and <strong>Third Term</strong> across all modules.
            Configure date ranges for each term within every academic year below.
          </p>
        </div>
      </div>

      {/* Active session banner */}
      {(currentYear || currentAYT) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Active Session</p>
            <p className="text-emerald-700 text-sm mt-0.5">
              {currentYear?.name ?? '—'}
              {currentAYT && <span className="mx-1.5 text-emerald-400">/</span>}
              {currentAYT?.terms?.name ?? ''}
              {currentAYT?.start_date && currentAYT?.end_date && (
                <span className="text-emerald-500 text-xs ml-2">
                  ({new Date(currentAYT.start_date).toLocaleDateString()} – {new Date(currentAYT.end_date).toLocaleDateString()})
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Year list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : years.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm py-20 text-center">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No academic years yet</p>
          <p className="text-app-text-muted text-sm mt-1">Click "New Academic Year" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {years.map(year => (
            <div key={year.id} className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
              {/* Year header row */}
              <div className={`px-5 py-4 border-b border-app-border flex items-center justify-between gap-3 flex-wrap ${year.is_current ? 'bg-emerald-50/60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${year.is_current ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Calendar className={`w-4 h-4 ${year.is_current ? 'text-emerald-600' : 'text-app-text-muted'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-app-text text-base">{year.name}</h3>
                      {year.is_current && (
                        <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Current Year
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-app-text-muted mt-0.5">
                      {new Date(year.start_date).toLocaleDateString()} – {new Date(year.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {!year.is_current && (
                    <button
                      onClick={() => setCurrentYear(year)}
                      className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold border border-emerald-200 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-all"
                      title="Set as current academic year"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Set as Current
                    </button>
                  )}

                  <button
                    onClick={() => openEditYear(year)}
                    className="flex items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text font-medium border border-app-border hover:border-slate-400 bg-app-surface hover:bg-app-surface-alt px-3 py-1.5 rounded-lg transition-all"
                    title="Edit academic year"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Year
                  </button>

                  {year.is_current ? (
                    <button
                      disabled
                      className="flex items-center gap-1.5 text-xs text-slate-300 border border-app-border bg-app-surface-alt px-2.5 py-1.5 rounded-lg cursor-not-allowed"
                      title="Cannot delete the active academic year — set another year as current first"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => openDeleteYear(year)}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 bg-app-surface hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all"
                      title="Delete academic year"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Term cards */}
              <div className="p-5">
                {year.termDates.length === 0 ? (
                  <p className="text-sm text-amber-600">Term date records not found for this year.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {year.termDates.map((ayt, idx) => {
                      const termName = ayt.terms?.name ?? '';
                      const hasDates = !!(ayt.start_date && ayt.end_date);
                      return (
                        <div
                          key={ayt.id}
                          className={`relative rounded-xl border p-4 transition-all ${
                            ayt.is_current
                              ? 'border-emerald-300 bg-emerald-50 shadow-sm shadow-emerald-100'
                              : 'border-app-border bg-app-surface-alt/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 ${ayt.is_current ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-app-text-muted'}`}>
                                {TERM_SHORT[termName] ?? '—'}
                              </span>
                              <div>
                                <p className="font-semibold text-app-text text-sm">{termName}</p>
                                {ayt.is_current && (
                                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Active</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => openEditTerm(ayt)}
                              className="text-app-text-muted hover:text-app-text transition-colors p-1 rounded-lg hover:bg-slate-100"
                              title="Configure term dates"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs space-y-1 mb-3">
                            {hasDates ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-app-text-muted">Start</span>
                                  <span className="font-medium text-app-text">{new Date(ayt.start_date!).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-app-text-muted">End</span>
                                  <span className="font-medium text-app-text">{new Date(ayt.end_date!).toLocaleDateString()}</span>
                                </div>
                              </>
                            ) : (
                              <p className="text-amber-500 italic">Dates not configured</p>
                            )}
                          </div>

                          {ayt.is_current ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Active Term
                            </div>
                          ) : (
                            <button
                              onClick={() => setCurrentTerm(ayt)}
                              className="flex items-center gap-1 text-xs text-app-text-muted hover:text-emerald-600 font-medium transition-colors group"
                            >
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              Set as Current
                            </button>
                          )}

                          {idx < year.termDates.length - 1 && (
                            <div className="hidden sm:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                              <ChevronRight className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Create Academic Year ─────────────────────────────────────── */}
      <Modal isOpen={showYearModal} onClose={() => { setShowYearModal(false); setYearFieldErrors({}); }} title="New Academic Year" size="sm">
        <div className="space-y-4">
          <p className="text-xs bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-blue-700">
            Creating a year automatically sets up 3 term slots. Configure their date ranges after creating.
          </p>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Year Name</label>
            <input
              value={yearForm.name}
              onChange={e => { setYearForm({ ...yearForm, name: e.target.value }); setYearFieldErrors(p => ({ ...p, name: undefined })); }}
              placeholder="e.g. 2026/2027"
              className={yearFieldErrors.name ? inputErrorClass : inputClass}
            />
            {yearFieldErrors.name && <p className="text-red-500 text-xs mt-1">{yearFieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Start Date</label>
            <input
              type="date"
              value={yearForm.start_date}
              onChange={e => { setYearForm({ ...yearForm, start_date: e.target.value }); setYearFieldErrors(p => ({ ...p, start_date: undefined })); }}
              className={yearFieldErrors.start_date ? inputErrorClass : inputClass}
            />
            {yearFieldErrors.start_date && <p className="text-red-500 text-xs mt-1">{yearFieldErrors.start_date}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">End Date</label>
            <input
              type="date"
              value={yearForm.end_date}
              onChange={e => { setYearForm({ ...yearForm, end_date: e.target.value }); setYearFieldErrors(p => ({ ...p, end_date: undefined })); }}
              className={yearFieldErrors.end_date ? inputErrorClass : inputClass}
            />
            {yearFieldErrors.end_date && <p className="text-red-500 text-xs mt-1">{yearFieldErrors.end_date}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowYearModal(false); setYearFieldErrors({}); }} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
            <button onClick={saveYear} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Creating...' : 'Create Year'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Edit Academic Year ───────────────────────────────────────── */}
      <Modal
        isOpen={showEditYearModal}
        onClose={() => { setShowEditYearModal(false); setEditingYear(null); setEditFieldErrors({}); }}
        title="Edit Academic Year"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Year Name</label>
            <input
              value={yearEditForm.name}
              onChange={e => { setYearEditForm({ ...yearEditForm, name: e.target.value }); setEditFieldErrors(p => ({ ...p, name: undefined })); }}
              placeholder="e.g. 2025/2026"
              className={editFieldErrors.name ? inputErrorClass : inputClass}
            />
            {editFieldErrors.name && <p className="text-red-500 text-xs mt-1">{editFieldErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Start Date</label>
            <input
              type="date"
              value={yearEditForm.start_date}
              onChange={e => { setYearEditForm({ ...yearEditForm, start_date: e.target.value }); setEditFieldErrors(p => ({ ...p, start_date: undefined })); }}
              className={editFieldErrors.start_date ? inputErrorClass : inputClass}
            />
            {editFieldErrors.start_date && <p className="text-red-500 text-xs mt-1">{editFieldErrors.start_date}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">End Date</label>
            <input
              type="date"
              value={yearEditForm.end_date}
              onChange={e => { setYearEditForm({ ...yearEditForm, end_date: e.target.value }); setEditFieldErrors(p => ({ ...p, end_date: undefined })); }}
              className={editFieldErrors.end_date ? inputErrorClass : inputClass}
            />
            {editFieldErrors.end_date && <p className="text-red-500 text-xs mt-1">{editFieldErrors.end_date}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setShowEditYearModal(false); setEditingYear(null); setEditFieldErrors({}); }}
              className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button onClick={saveEditYear} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Delete Academic Year ─────────────────────────────────────── */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeletingYear(null); setDeleteError(''); }}
        title="Delete Academic Year"
        size="sm"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{deleteError}</div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">This action cannot be undone.</p>
              <p>
                Are you sure you want to delete <strong>{deletingYear?.name}</strong>?
                This will permanently remove all associated term date configurations for this year.
              </p>
            </div>
          </div>

          {loadingLinked ? (
            <div className="flex items-center gap-2 text-sm text-app-text-muted">
              <div className="w-4 h-4 border-2 border-app-border border-t-transparent rounded-full animate-spin" />
              Checking linked records…
            </div>
          ) : linkedCount > 0 ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">
                <strong>Warning:</strong> {linkedCount} student enrollment{linkedCount !== 1 ? 's are' : ' is'} linked to this academic year.
                Deleting it will not remove those records, but they will lose their year reference.
              </p>
            </div>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeletingYear(null); setDeleteError(''); }}
              className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteYear}
              disabled={deleting || loadingLinked}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete Year'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Edit Term Dates ──────────────────────────────────────────── */}
      <Modal
        isOpen={showEditTermModal}
        onClose={() => { setShowEditTermModal(false); setEditingAYT(null); setTermError(''); }}
        title={editingAYT ? `Configure ${editingAYT.terms?.name ?? 'Term'} Dates` : 'Configure Term'}
        size="sm"
      >
        <div className="space-y-4">
          {termError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{termError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Start Date</label>
            <input type="date" value={termForm.start_date} onChange={e => setTermForm({ ...termForm, start_date: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">End Date</label>
            <input type="date" value={termForm.end_date} onChange={e => setTermForm({ ...termForm, end_date: e.target.value })} className={inputClass} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowEditTermModal(false); setEditingAYT(null); setTermError(''); }} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
            <button onClick={saveTermDates} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Dates'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
