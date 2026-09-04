import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, BookOpen, CheckCircle, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface AcademicYear { id: string; name: string; }
interface Term { id: string; name: string; }

interface Exam {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string | null;
  name: string;
  exam_type: string;
  start_date: string;
  end_date: string;
  status: string;
  academic_years?: { name: string };
  terms?: { name: string };
}

interface FormData {
  name: string;
  exam_type: string;
  academic_year_id: string;
  term_id: string;
  start_date: string;
  end_date: string;
}

const defaultForm: FormData = {
  name: '',
  exam_type: 'terminal',
  academic_year_id: '',
  term_id: '',
  start_date: '',
  end_date: '',
};

const EXAM_TYPES = [
  { value: 'terminal', label: 'Terminal Exam' },
  { value: 'midterm', label: 'Mid-Term' },
  { value: 'mock', label: 'Mock Exam' },
  { value: 'unit-test', label: 'Unit Test' },
  { value: 'annual', label: 'Annual' },
];

export default function AddExam() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [allTerms, setAllTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<FormData>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const schoolId = profile?.school_id;
  const filteredTerms = allTerms;

  useEffect(() => { if (schoolId) fetchAll(); }, [schoolId]);

  async function fetchAll() {
    setLoading(true);
    const [examRes, yearRes, termRes] = await Promise.all([
      supabase
        .from('exams')
        .select('*, academic_years(name), terms(name)')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
      supabase.from('academic_years').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('terms').select('id, name').order('name'),
    ]);
    if (examRes.data) setExams(examRes.data);
    if (yearRes.data) {
      setAcademicYears(yearRes.data);
      const current = yearRes.data.find((y: any) => y.is_current) ?? yearRes.data[yearRes.data.length - 1];
      if (current) setForm(f => ({ ...f, academic_year_id: current.id }));
    }
    if (termRes.data) setAllTerms(termRes.data);
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setSaveError('');
    const currentYear = academicYears.find((y: any) => y.is_current) ?? academicYears[academicYears.length - 1];
    setForm({
      name: '',
      exam_type: 'terminal',
      academic_year_id: currentYear?.id ?? '',
      term_id: '',
      start_date: '',
      end_date: '',
    });
    setModalOpen(true);
  }

  function openEdit(exam: Exam) {
    setEditingId(exam.id);
    setSaveError('');
    setForm({
      name: exam.name,
      exam_type: exam.exam_type,
      academic_year_id: exam.academic_year_id,
      term_id: exam.term_id ?? '',
      start_date: exam.start_date,
      end_date: exam.end_date,
    });
    setModalOpen(true);
  }

  function openDelete(id: string) {
    setDeleteId(id);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.academic_year_id || !form.term_id || !form.start_date || !form.end_date) {
      setSaveError('All fields are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    const payload = {
      name: form.name,
      exam_type: form.exam_type,
      academic_year_id: form.academic_year_id,
      term_id: form.term_id,
      start_date: form.start_date,
      end_date: form.end_date,
      school_id: schoolId,
      status: editingId ? undefined : 'draft',
    };
    let res;
    if (editingId) {
      const { status: _, ...updatePayload } = payload;
      res = await supabase.from('exams').update(updatePayload).eq('id', editingId);
    } else {
      res = await supabase.from('exams').insert(payload);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('exams').delete().eq('id', deleteId);
    setDeleteModalOpen(false);
    setDeleteId(null);
    fetchAll();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('exams').update({ status }).eq('id', id);
    fetchAll();
  }

  function statusBadge(status: string) {
    if (status === 'active')
      return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-medium">Active</span>;
    if (status === 'completed')
      return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">Completed</span>;
    return <span className="bg-slate-100 text-app-text-muted px-2 py-0.5 rounded-full text-xs font-medium">Draft</span>;
  }

  const inputClass = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-app-text">Add Exam</h1>
            <p className="text-sm text-app-text-muted mt-0.5">Create and manage exams per session and term</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Exam
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 text-app-text-muted">
          <p className="text-lg font-medium">No exams found</p>
          <p className="text-sm mt-1">Click "Add Exam" to create one for a session and term.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-app-border">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Session</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Term</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Start Date</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">End Date</th>
                <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{exam.name}</td>
                  <td className="px-4 py-3 text-app-text-muted capitalize">{exam.exam_type.replace('-', ' ')}</td>
                  <td className="px-4 py-3 text-app-text-muted">{exam.academic_years?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {exam.terms?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">{exam.start_date ? new Date(exam.start_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-app-text-muted">{exam.end_date ? new Date(exam.end_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">{statusBadge(exam.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {exam.status === 'draft' && (
                        <button
                          onClick={() => updateStatus(exam.id, 'active')}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-medium transition-colors"
                        >
                          <PlayCircle size={13} /> Activate
                        </button>
                      )}
                      {exam.status === 'active' && (
                        <button
                          onClick={() => updateStatus(exam.id, 'completed')}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors"
                        >
                          <CheckCircle size={13} /> Complete
                        </button>
                      )}
                      <button onClick={() => openEdit(exam)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => openDelete(exam.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Exam' : 'Add Exam'}>
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Exam Name <span className="text-red-500">*</span></label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. First Term Examination"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Exam Type</label>
            <select className={inputClass} value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value })}>
              {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Session <span className="text-red-500">*</span></label>
              <select
                className={inputClass}
                value={form.academic_year_id}
                onChange={(e) => setForm({ ...form, academic_year_id: e.target.value, term_id: '' })}
              >
                <option value="">Select session</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Term <span className="text-red-500">*</span></label>
              <select
                className={inputClass}
                value={form.term_id}
                onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                disabled={!form.academic_year_id}
              >
                <option value="">{form.academic_year_id ? 'Select term' : 'Pick session first'}</option>
                {filteredTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Start Date <span className="text-red-500">*</span></label>
              <input type="date" className={inputClass} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">End Date <span className="text-red-500">*</span></label>
              <input type="date" className={inputClass} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.academic_year_id || !form.term_id || !form.start_date || !form.end_date}
              className="px-4 py-2 text-sm rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Exam">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">Are you sure you want to delete this exam? This action cannot be undone.</p>
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
