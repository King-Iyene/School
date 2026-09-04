import { useState, useEffect } from 'react';
import { Upload, FileText, Pencil, Trash2, Plus, BookOpen, ScrollText, FolderOpen, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; name: string; }

interface UploadItem {
  id: string;
  title: string;
  content_type: string;
  description: string;
  class_id?: string;
  subject_id?: string;
  file_url: string;
  created_at: string;
  classes?: { name: string };
  subjects?: { name: string };
  source_table: 'assignments' | 'study_materials' | 'syllabus_items' | 'other_downloads';
}

interface FormData {
  title: string;
  content_type: string;
  description: string;
  class_id: string;
  subject_id: string;
  file_url: string;
  due_date: string;
}

const defaultForm: FormData = {
  title: '',
  content_type: 'study_material',
  description: '',
  class_id: '',
  subject_id: '',
  file_url: '',
  due_date: '',
};

const CONTENT_TYPES = [
  { value: 'assignment',     label: 'Assignment' },
  { value: 'other',          label: 'Other Download' },
  { value: 'study_material', label: 'Study Material' },
  { value: 'syllabus',       label: 'Syllabus' },
];

const TYPE_COLORS: Record<string, string> = {
  assignment: 'bg-amber-100 text-amber-700',
  study_material: 'bg-blue-100 text-blue-700',
  syllabus: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-app-text-muted',
};

const TYPE_ICONS: Record<string, typeof FileText> = {
  assignment: ClipboardList,
  study_material: BookOpen,
  syllabus: ScrollText,
  other: FolderOpen,
};

export default function UploadContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const [activeTab, setActiveTab] = useState<'uploads' | 'new'>('uploads');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [editingItem, setEditingItem] = useState<UploadItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<UploadItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [currentYearId, setCurrentYearId] = useState('');
  const [currentTermId, setCurrentTermId] = useState('');

  useEffect(() => {
    if (profile?.id) {
      fetchReferenceData();
      fetchUploads();
    }
  }, [profile]);

  async function fetchReferenceData() {
    if (!profile?.school_id) return;

    // Get current academic year + term
    const { data: yearData } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('is_current', true)
      .maybeSingle();
    const yearId = yearData?.id ?? '';
    setCurrentYearId(yearId);

    if (yearId) {
      const { data: ayt } = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', yearId)
        .eq('is_current', true)
        .maybeSingle();
      if (ayt?.term_id) setCurrentTermId(ayt.term_id);
    }

    // Fetch teacher's classes via subject assignments + form master
    const subBase = supabase.from('subject_teacher_assignments')
      .select('class_id, classes(id, name)')
      .eq('academic_year_id', yearId);
    const fmBase = supabase.from('class_teachers')
      .select('class_id, classes(id, name)')
      .eq('academic_year_id', yearId);

    const [subRes, fmRes, fmClassRes] = await Promise.all([
      isAdmin ? subBase : subBase.eq('teacher_id', profile.id),
      isAdmin ? fmBase : fmBase.eq('teacher_id', profile.id),
      isAdmin
        ? supabase.from('classes').select('id, name').eq('school_id', profile.school_id ?? '')
        : supabase.from('classes').select('id, name').eq('class_teacher_id', profile.id),
    ]);

    const combined = [
      ...(subRes.data ?? []).map(d => d.classes),
      ...(fmRes.data ?? []).map(d => d.classes),
      ...(fmClassRes.data ?? []),
    ].filter(Boolean);
    const unique = [...new Map(combined.map((c: any) => [c.id, c])).values()] as ClassOption[];
    setClasses(unique);
  }

  async function loadSubjectsForClass(classId: string) {
    if (!classId) { setSubjects([]); return; }
    const { data } = await supabase
      .from('class_subjects')
      .select('subjects(id, name)')
      .eq('class_id', classId);
    setSubjects(((data ?? []).map((d: any) => d.subjects).filter(Boolean)) as SubjectOption[]);
  }

  async function fetchUploads() {
    if (!profile?.id) return;
    setLoading(true);

    const assignBase = supabase.from('assignments')
      .select('id, title, description, class_id, subject_id, file_url, created_at, classes(name), subjects(name)')
      .order('created_at', { ascending: false });
    const studyBase = supabase.from('study_materials')
      .select('id, title, description, class_id, subject_id, file_url, created_at, classes(name), subjects(name)')
      .order('created_at', { ascending: false });
    const syllabusBase = supabase.from('syllabus_items')
      .select('id, title, content, class_id, subject_id, file_url, created_at, classes(name), subjects(name)')
      .order('created_at', { ascending: false });
    const otherBase = supabase.from('other_downloads')
      .select('id, title, description, file_url, created_at')
      .order('created_at', { ascending: false });

    const [assignRes, studyRes, syllabusRes, otherRes] = await Promise.all([
      isAdmin ? assignBase : assignBase.eq('teacher_id', profile.id),
      isAdmin ? studyBase : studyBase.eq('uploaded_by', profile.id),
      isAdmin ? syllabusBase : syllabusBase.eq('uploaded_by', profile.id),
      isAdmin ? otherBase : otherBase.eq('uploaded_by', profile.id),
    ]);

    const all: UploadItem[] = [
      ...(assignRes.data ?? []).map((r: any) => ({ ...r, content_type: 'assignment', source_table: 'assignments' as const })),
      ...(studyRes.data ?? []).map((r: any) => ({ ...r, source_table: 'study_materials' as const, content_type: 'study_material' })),
      ...(syllabusRes.data ?? []).map((r: any) => ({ ...r, description: r.content, source_table: 'syllabus_items' as const, content_type: 'syllabus' })),
      ...(otherRes.data ?? []).map((r: any) => ({ ...r, source_table: 'other_downloads' as const, content_type: 'other' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setUploads(all);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!form.title) { setSaveError('Title is required.'); return; }
    if ((form.content_type === 'assignment' || form.content_type === 'study_material' || form.content_type === 'syllabus') && !form.class_id) {
      setSaveError('Class is required for this content type.');
      return;
    }
    setSaving(true);
    setSaveError('');

    let error: any = null;

    if (form.content_type === 'assignment') {
      if (!form.due_date) { setSaveError('Due date is required for assignments.'); setSaving(false); return; }
      const res = await supabase.from('assignments').insert({
        title: form.title,
        description: form.description,
        class_id: form.class_id,
        subject_id: form.subject_id || null,
        file_url: form.file_url,
        due_date: form.due_date,
        max_score: 100,
        status: 'active',
        teacher_id: profile!.id,
        term_id: currentTermId || null,
      });
      error = res.error;
    } else if (form.content_type === 'study_material') {
      const res = await supabase.from('study_materials').insert({
        title: form.title,
        description: form.description,
        class_id: form.class_id || null,
        subject_id: form.subject_id || null,
        file_url: form.file_url,
        content_type: 'document',
        available_for: ['students', 'teachers'],
        is_published: true,
        uploaded_by: profile!.id,
        school_id: profile!.school_id,
      });
      error = res.error;
    } else if (form.content_type === 'syllabus') {
      const res = await supabase.from('syllabus_items').insert({
        title: form.title,
        content: form.description,
        class_id: form.class_id || null,
        subject_id: form.subject_id || null,
        file_url: form.file_url,
        academic_year_id: currentYearId || null,
        term_id: currentTermId || null,
        uploaded_by: profile!.id,
        school_id: profile!.school_id,
      });
      error = res.error;
    } else {
      const res = await supabase.from('other_downloads').insert({
        title: form.title,
        description: form.description,
        file_url: form.file_url,
        available_for: 'all',
        uploaded_by: profile!.id,
        school_id: profile!.school_id,
      });
      error = res.error;
    }

    if (error) { setSaveError(error.message); setSaving(false); return; }
    setSaving(false);
    setForm(defaultForm);
    setSubjects([]);
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 3000);
    fetchUploads();
    setActiveTab('uploads');
  }

  function openEdit(item: UploadItem) {
    setEditingItem(item);
    setForm({
      title: item.title,
      content_type: item.content_type,
      description: item.description ?? '',
      class_id: item.class_id ?? '',
      subject_id: item.subject_id ?? '',
      file_url: item.file_url ?? '',
      due_date: '',
    });
    if (item.class_id) loadSubjectsForClass(item.class_id);
    setSaveError('');
    setEditModalOpen(true);
  }

  async function handleEditSave() {
    if (!editingItem || !form.title) return;
    setSaving(true);
    setSaveError('');

    let error: any = null;

    if (editingItem.source_table === 'assignments') {
      const res = await supabase.from('assignments').update({
        title: form.title,
        description: form.description,
        class_id: form.class_id,
        subject_id: form.subject_id || null,
        file_url: form.file_url,
      }).eq('id', editingItem.id);
      error = res.error;
    } else if (editingItem.source_table === 'study_materials') {
      const res = await supabase.from('study_materials').update({
        title: form.title,
        description: form.description,
        class_id: form.class_id || null,
        subject_id: form.subject_id || null,
        file_url: form.file_url,
      }).eq('id', editingItem.id);
      error = res.error;
    } else if (editingItem.source_table === 'syllabus_items') {
      const res = await supabase.from('syllabus_items').update({
        title: form.title,
        content: form.description,
        class_id: form.class_id || null,
        subject_id: form.subject_id || null,
        file_url: form.file_url,
      }).eq('id', editingItem.id);
      error = res.error;
    } else {
      const res = await supabase.from('other_downloads').update({
        title: form.title,
        description: form.description,
        file_url: form.file_url,
      }).eq('id', editingItem.id);
      error = res.error;
    }

    if (error) { setSaveError(error.message); setSaving(false); return; }
    setSaving(false);
    setEditModalOpen(false);
    setEditingItem(null);
    fetchUploads();
  }

  async function handleDelete() {
    if (!deleteItem) return;
    await supabase.from(deleteItem.source_table).delete().eq('id', deleteItem.id);
    setDeleteModalOpen(false);
    setDeleteItem(null);
    fetchUploads();
  }

  const inputClass = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';
  const showClassSubject = (type: string) => type !== 'other';

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Upload size={24} className="text-emerald-600" />
        <h1 className="text-2xl font-bold text-app-text">Upload Content</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-app-border">
        {(['uploads', 'new'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-app-text-muted hover:text-app-text'
            }`}
          >
            {tab === 'uploads' ? 'My Uploads' : 'Upload New'}
          </button>
        ))}
      </div>

      {activeTab === 'new' && (
        <div className="bg-app-surface border border-app-border rounded-xl p-6 max-w-2xl">
          {submitSuccess && (
            <div className="mb-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium">
              Content uploaded successfully!
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {saveError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                Content Type
              </label>
              <select
                className={inputClass}
                value={form.content_type}
                onChange={(e) => {
                  setForm({ ...defaultForm, content_type: e.target.value });
                  setSubjects([]);
                }}
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Enter title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">
                {form.content_type === 'syllabus' ? 'Content' : 'Description'}
              </label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            {showClassSubject(form.content_type) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">
                    Class {form.content_type !== 'other' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    className={inputClass}
                    value={form.class_id}
                    onChange={(e) => {
                      setForm({ ...form, class_id: e.target.value, subject_id: '' });
                      loadSubjectsForClass(e.target.value);
                    }}
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
                  <select
                    className={inputClass}
                    value={form.subject_id}
                    onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    disabled={!form.class_id}
                  >
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">File URL / Link</label>
              <input
                className={inputClass}
                value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            {form.content_type === 'assignment' && (
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={saving || !form.title}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
              >
                <Plus size={15} />
                {saving ? 'Uploading...' : 'Upload Content'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'uploads' && (
        <>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-16 text-app-text-muted">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium">No uploads yet</p>
              <p className="text-sm mt-1">Switch to "Upload New" tab to add content.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-app-border">
              <table className="w-full text-sm">
                <thead className="bg-app-surface-alt border-b border-app-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Class</th>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Subject</th>
                    <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {uploads.map((item) => {
                    const Icon = TYPE_ICONS[item.content_type] ?? FileText;
                    return (
                      <tr key={`${item.source_table}-${item.id}`} className="hover:bg-app-surface-alt transition-colors">
                        <td className="px-4 py-3 font-medium text-app-text">
                          <div className="flex items-center gap-2">
                            <Icon size={14} className="text-app-text-muted shrink-0" />
                            {item.title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLORS[item.content_type] ?? 'bg-slate-100 text-app-text-muted'}`}>
                            {item.content_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-app-text-muted">{item.classes?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-app-text-muted">{item.subjects?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-app-text-muted">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => { setDeleteItem(item); setDeleteModalOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); setEditingItem(null); }} title="Edit Upload">
        <div className="space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {saveError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">
              {editingItem?.source_table === 'syllabus_items' ? 'Content' : 'Description'}
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {editingItem?.source_table !== 'other_downloads' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Class</label>
                <select
                  className={inputClass}
                  value={form.class_id}
                  onChange={(e) => {
                    setForm({ ...form, class_id: e.target.value, subject_id: '' });
                    loadSubjectsForClass(e.target.value);
                  }}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
                <select
                  className={inputClass}
                  value={form.subject_id}
                  onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                  disabled={!form.class_id}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">File URL / Link</label>
            <input
              className={inputClass}
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setEditModalOpen(false); setEditingItem(null); }}
              className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              disabled={saving || !form.title}
              className="px-4 py-2 text-sm rounded-xl bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setDeleteItem(null); }} title="Delete Upload">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete <strong>{deleteItem?.title}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setDeleteModalOpen(false); setDeleteItem(null); }}
              className="px-4 py-2 text-sm rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
