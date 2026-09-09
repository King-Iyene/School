import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Monitor, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import type { Subject } from '../../lib/types';

interface OnlineExamRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  online_exam_settings: {
    exam_id: string;
    subject_id: string | null;
    difficulty: string | null;
    question_count: number;
    duration_minutes: number;
    pass_percentage: number;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_result_immediately: boolean;
    instructions: string;
    is_published: boolean;
  } | null;
  subjects?: { name: string };
}

interface FormData {
  name: string;
  start_date: string;
  end_date: string;
  subject_id: string;
  difficulty: string;
  question_count: number;
  duration_minutes: number;
  pass_percentage: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_result_immediately: boolean;
  instructions: string;
}

const defaultForm: FormData = {
  name: '',
  start_date: '',
  end_date: '',
  subject_id: '',
  difficulty: '',
  question_count: 20,
  duration_minutes: 30,
  pass_percentage: 40,
  shuffle_questions: true,
  shuffle_options: true,
  show_result_immediately: true,
  instructions: '',
};

const inputClass = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

export default function OnlineExamSetup() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<OnlineExamRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<FormData>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const schoolId = profile?.school_id;

  useEffect(() => { if (schoolId) fetchAll(); }, [schoolId]);

  async function fetchAll() {
    setLoading(true);
    const [examRes, subjectRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, name, start_date, end_date, online_exam_settings(*)')
        .eq('school_id', schoolId)
        .eq('type', 'online')
        .order('start_date', { ascending: false }),
      supabase.from('subjects').select('id, school_id, name, code, category').eq('school_id', schoolId).order('name'),
    ]);
    if (examRes.data) setExams(examRes.data as any);
    if (subjectRes.data) setSubjects(subjectRes.data as any);
    setLoading(false);
  }

  function subjectName(id: string | null) {
    return subjects.find(s => s.id === id)?.name ?? 'Any subject';
  }

  function openAdd() {
    setEditingId(null);
    setSaveError('');
    setForm(defaultForm);
    setModalOpen(true);
  }

  function openEdit(exam: OnlineExamRow) {
    setEditingId(exam.id);
    setSaveError('');
    const s = exam.online_exam_settings;
    setForm({
      name: exam.name,
      start_date: exam.start_date ?? '',
      end_date: exam.end_date ?? '',
      subject_id: s?.subject_id ?? '',
      difficulty: s?.difficulty ?? '',
      question_count: s?.question_count ?? 20,
      duration_minutes: s?.duration_minutes ?? 30,
      pass_percentage: s?.pass_percentage ?? 40,
      shuffle_questions: s?.shuffle_questions ?? true,
      shuffle_options: s?.shuffle_options ?? true,
      show_result_immediately: s?.show_result_immediately ?? true,
      instructions: s?.instructions ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !schoolId) {
      setSaveError('Exam name is required.');
      return;
    }
    setSaving(true);
    setSaveError('');

    let examId = editingId;
    if (editingId) {
      const { error } = await supabase
        .from('exams')
        .update({ name: form.name, start_date: form.start_date || null, end_date: form.end_date || null })
        .eq('id', editingId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase
        .from('exams')
        .insert({
          school_id: schoolId,
          name: form.name,
          type: 'online',
          exam_type: 'unit-test',
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          status: 'active',
        })
        .select('id')
        .single();
      if (error || !data) { setSaveError(error?.message ?? 'Could not create exam.'); setSaving(false); return; }
      examId = data.id;
    }

    const settingsPayload = {
      exam_id: examId,
      school_id: schoolId,
      subject_id: form.subject_id || null,
      difficulty: form.difficulty || null,
      question_count: form.question_count,
      duration_minutes: form.duration_minutes,
      pass_percentage: form.pass_percentage,
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      show_result_immediately: form.show_result_immediately,
      instructions: form.instructions,
      created_by: profile?.id ?? null,
    };
    const { error: settingsErr } = await supabase.from('online_exam_settings').upsert(settingsPayload, { onConflict: 'exam_id' });
    if (settingsErr) { setSaveError(settingsErr.message); setSaving(false); return; }

    setSaving(false);
    setModalOpen(false);
    fetchAll();
  }

  async function togglePublish(exam: OnlineExamRow) {
    if (!exam.online_exam_settings) return;
    await supabase
      .from('online_exam_settings')
      .update({ is_published: !exam.online_exam_settings.is_published })
      .eq('exam_id', exam.id);
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('exams').delete().eq('id', deleteId);
    setDeleteModalOpen(false);
    setDeleteId(null);
    fetchAll();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor size={24} className="text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-app-text">Online Exam Setup</h1>
            <p className="text-sm text-app-text-muted mt-0.5">Configure timed CBT exams drawn from the question bank</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Online Exam
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted">
          <p className="text-lg font-medium">No online exams yet</p>
          <p className="text-sm mt-1">Click "New Online Exam" to configure one from your question bank.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-app-border">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Subject</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Questions</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Duration</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Window</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{exam.name}</td>
                  <td className="px-4 py-3 text-app-text-muted">{subjectName(exam.online_exam_settings?.subject_id ?? null)}</td>
                  <td className="px-4 py-3 text-app-text-muted">{exam.online_exam_settings?.question_count ?? '—'}</td>
                  <td className="px-4 py-3 text-app-text-muted">{exam.online_exam_settings?.duration_minutes ?? '—'} min</td>
                  <td className="px-4 py-3 text-app-text-muted">
                    {exam.start_date ? new Date(exam.start_date).toLocaleDateString() : '—'}
                    {' – '}
                    {exam.end_date ? new Date(exam.end_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {exam.online_exam_settings?.is_published ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">Published</span>
                    ) : (
                      <span className="bg-slate-100 text-app-text-muted px-2 py-0.5 rounded-full text-xs font-medium">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => togglePublish(exam)}
                        title={exam.online_exam_settings?.is_published ? 'Unpublish' : 'Publish'}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors"
                      >
                        {exam.online_exam_settings?.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                        {exam.online_exam_settings?.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => openEdit(exam)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => { setDeleteId(exam.id); setDeleteModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Online Exam' : 'New Online Exam'} size="lg">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Exam Name <span className="text-red-500">*</span></label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics CBT Test" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Opens</label>
              <input type="date" className={inputClass} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Closes</label>
              <input type="date" className={inputClass} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
              <select className={inputClass} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">Any subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Difficulty</label>
              <select className={inputClass} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="">Any difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Questions</label>
              <input type="number" min={1} className={inputClass} value={form.question_count} onChange={(e) => setForm({ ...form, question_count: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Duration (min)</label>
              <input type="number" min={1} className={inputClass} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Pass %</label>
              <input type="number" min={0} max={100} className={inputClass} value={form.pass_percentage} onChange={(e) => setForm({ ...form, pass_percentage: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Instructions</label>
            <textarea className={inputClass} rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Shown to students before they start the exam" />
          </div>
          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm text-app-text">
              <input type="checkbox" checked={form.shuffle_questions} onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })} />
              Shuffle questions
            </label>
            <label className="flex items-center gap-2 text-sm text-app-text">
              <input type="checkbox" checked={form.shuffle_options} onChange={(e) => setForm({ ...form, shuffle_options: e.target.checked })} />
              Shuffle answer options
            </label>
            <label className="flex items-center gap-2 text-sm text-app-text">
              <input type="checkbox" checked={form.show_result_immediately} onChange={(e) => setForm({ ...form, show_result_immediately: e.target.checked })} />
              Show result immediately
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="px-4 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Online Exam">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">Are you sure you want to delete this online exam? Student attempts tied to it will also be removed. This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
