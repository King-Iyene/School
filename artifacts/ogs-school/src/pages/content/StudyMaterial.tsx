import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Download, Filter, X, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface StudyMaterial {
  id: string;
  title: string;
  class_id: string;
  subject_id: string;
  description: string;
  content_type: string;
  file_url: string;
  available_for: string[];
  is_published: boolean;
  created_at: string;
  classes?: { name: string };
  subjects?: { name: string };
}

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; name: string; }

const CONTENT_TYPES = ['document', 'pdf', 'video', 'link', 'image', 'other'];
const AVAILABLE_FOR_OPTIONS = ['students', 'teachers', 'all'];

const contentTypeBadgeColor: Record<string, string> = {
  document: 'bg-blue-100 text-blue-700',
  pdf: 'bg-red-100 text-red-700',
  video: 'bg-teal-100 text-teal-700',
  link: 'bg-yellow-100 text-yellow-700',
  image: 'bg-green-100 text-green-700',
  other: 'bg-slate-100 text-app-text',
};

const isTeacher = (role?: string) => role === 'teacher';

export default function StudyMaterial() {
  const { profile } = useAuth();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);   // for admin/principal
  const [teacherClasses, setTeacherClasses] = useState<ClassOption[]>([]); // teacher's own
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  // Map of classId -> subjects the teacher teaches in that class
  const [teacherSubjectMap, setTeacherSubjectMap] = useState<Record<string, SubjectOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterContentType, setFilterContentType] = useState('');
  const [form, setForm] = useState({
    title: '',
    class_id: '',
    subject_id: '',
    description: '',
    content_type: 'document',
    file_url: '',
    available_for: ['students'] as string[],
    is_published: true,
  });

  useEffect(() => {
    if (profile?.id) {
      loadReferenceData();
      fetchMaterials();
    }
  }, [profile]);

  useEffect(() => {
    fetchMaterials();
  }, [filterClass, filterContentType]);

  async function loadReferenceData() {
    if (isTeacher(profile?.role)) {
      await loadTeacherScopedData();
    } else {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      if (data) setAllClasses(data);
    }
  }

  async function loadTeacherScopedData() {
    if (!profile?.school_id) return;

    const { data: yearData } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('is_current', true)
      .maybeSingle();
    const yearId = yearData?.id ?? '';

    // Fetch all subject assignments for this teacher grouped by class
    const [staRes, ctRes, fmRes] = await Promise.all([
      supabase.from('subject_teacher_assignments')
        .select('class_id, subject_id, classes(id, name), subjects(id, name)')
        .eq('teacher_id', profile.id)
        .eq('academic_year_id', yearId),
      supabase.from('class_teachers')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', profile.id)
        .eq('academic_year_id', yearId),
      supabase.from('classes')
        .select('id, name')
        .eq('class_teacher_id', profile.id),
    ]);

    // Build subject map: classId -> subject[]
    const subjectMap: Record<string, SubjectOption[]> = {};
    for (const row of (staRes.data ?? [])) {
      const cls = (row as any).classes;
      const subj = (row as any).subjects;
      if (cls && subj) {
        if (!subjectMap[cls.id]) subjectMap[cls.id] = [];
        if (!subjectMap[cls.id].find(s => s.id === subj.id)) {
          subjectMap[cls.id].push({ id: subj.id, name: subj.name });
        }
      }
    }
    setTeacherSubjectMap(subjectMap);

    // Collect all classes
    const classSources = [
      ...(staRes.data ?? []).map((d: any) => d.classes),
      ...(ctRes.data ?? []).map((d: any) => d.classes),
      ...(fmRes.data ?? []),
    ].filter(Boolean);
    const uniqueClasses = [...new Map(classSources.map((c: any) => [c.id, c])).values()] as ClassOption[];
    setTeacherClasses(uniqueClasses);
  }

  async function fetchSubjectsForClass(classId: string) {
    if (!classId) { setSubjects([]); return; }
    if (isTeacher(profile?.role)) {
      setSubjects(teacherSubjectMap[classId] ?? []);
    } else {
      const { data } = await supabase
        .from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId);
      setSubjects(((data ?? []).map((d: any) => d.subjects).filter(Boolean)) as SubjectOption[]);
    }
  }

  async function fetchMaterials() {
    setLoading(true);
    let query = supabase
      .from('study_materials')
      .select('*, classes(name), subjects(name)')
      .order('created_at', { ascending: false });
    if (filterClass) query = query.eq('class_id', filterClass);
    if (filterContentType) query = query.eq('content_type', filterContentType);
    const { data } = await query;
    if (data) setMaterials(data as StudyMaterial[]);
    setLoading(false);
  }

  function openModal() {
    setSaveError('');
    setSubjects([]);
    setForm({
      title: '',
      class_id: '',
      subject_id: '',
      description: '',
      content_type: 'document',
      file_url: '',
      available_for: ['students'],
      is_published: true,
    });
    setModalOpen(true);
  }

  function handleAvailableForChange(value: string) {
    setForm(prev => {
      const current = prev.available_for;
      if (current.includes(value)) {
        return { ...prev, available_for: current.filter(v => v !== value) };
      }
      return { ...prev, available_for: [...current, value] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) { setSaveError('Title is required.'); return; }
    setSaving(true);
    const res = await supabase.from('study_materials').insert([{
      title: form.title,
      class_id: form.class_id || null,
      subject_id: form.subject_id || null,
      description: form.description,
      content_type: form.content_type,
      file_url: form.file_url,
      available_for: form.available_for,
      is_published: form.is_published,
      school_id: profile?.school_id,
      uploaded_by: profile?.id,
    }]);
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchMaterials();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this study material?')) return;
    await supabase.from('study_materials').delete().eq('id', id);
    fetchMaterials();
  }

  const displayClasses = isTeacher(profile?.role) ? teacherClasses : allClasses;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-app-primary text-white p-1.5 sm:p-2 rounded-xl shrink-0">
            <BookOpen size={18} />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-app-text truncate">Study Material</h1>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Material</span>
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-app-text-muted" />
          <span className="text-sm font-medium text-app-text-muted">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">All Classes</option>
            {displayClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterContentType}
            onChange={e => setFilterContentType(e.target.value)}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">All Types</option>
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          {(filterClass || filterContentType) && (
            <button
              onClick={() => { setFilterClass(''); setFilterContentType(''); }}
              className="flex items-center gap-1 text-sm text-app-text-muted hover:text-app-text"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : materials.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No study materials found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Class</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Available For</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">File</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {materials.map(m => (
                  <tr key={m.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{m.title}</td>
                    <td className="px-4 py-3 text-app-text-muted">{m.classes?.name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{m.subjects?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${contentTypeBadgeColor[m.content_type] || 'bg-slate-100 text-app-text'}`}>
                        {m.content_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {Array.isArray(m.available_for) ? m.available_for.join(', ') : m.available_for}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {m.file_url ? (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700">
                          <Download size={14} /> Download
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(m.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Study Material">
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title <span className="text-red-500">*</span></label>
            <input required className={INPUT_CLASS} value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Material title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class</label>
              <select className={INPUT_CLASS} value={form.class_id}
                onChange={e => {
                  setForm(p => ({ ...p, class_id: e.target.value, subject_id: '' }));
                  fetchSubjectsForClass(e.target.value);
                }}>
                <option value="">Select Class</option>
                {displayClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
              <select className={INPUT_CLASS} value={form.subject_id}
                onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))}
                disabled={!form.class_id}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea className={INPUT_CLASS} rows={3} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Content Type</label>
              <select className={INPUT_CLASS} value={form.content_type}
                onChange={e => setForm(p => ({ ...p, content_type: e.target.value }))}>
                {CONTENT_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">File URL</label>
              <input className={INPUT_CLASS} value={form.file_url}
                onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">Available For</label>
            <div className="flex gap-4">
              {AVAILABLE_FOR_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-app-text-muted cursor-pointer">
                  <input type="checkbox" checked={form.available_for.includes(opt)}
                    onChange={() => handleAvailableForChange(opt)} className="accent-emerald-500" />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_published" checked={form.is_published}
              onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))}
              className="accent-emerald-500" />
            <label htmlFor="is_published" className="text-sm text-app-text">Published</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-app-border text-app-text-muted hover:bg-app-surface-alt">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-app-primary hover:opacity-90 text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Material'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
