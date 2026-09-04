import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ExternalLink, Filter, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface SyllabusItem {
  id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  term_id: string;
  title: string;
  content: string;
  file_url: string;
  classes?: { name: string };
  subjects?: { name: string };
  academic_years?: { name: string };
}

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; name: string; }
interface AcademicYearOption { id: string; name: string; }
interface TermOption { id: string; name: string; }

const isTeacher = (role?: string) => role === 'teacher';

export default function Syllabus() {
  const { profile } = useAuth();
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teacherSubjectMap, setTeacherSubjectMap] = useState<Record<string, SubjectOption[]>>({});
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterSubjects, setFilterSubjects] = useState<SubjectOption[]>([]);
  const [form, setForm] = useState({
    class_id: '',
    subject_id: '',
    academic_year_id: '',
    term_id: '',
    title: '',
    content: '',
    file_url: '',
  });

  useEffect(() => {
    if (profile?.id) {
      loadReferenceData();
      fetchItems();
    }
  }, [profile]);

  useEffect(() => { fetchItems(); }, [filterClass, filterSubject]);

  async function loadReferenceData() {
    await Promise.all([fetchAcademicYears(), fetchTerms()]);
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

    const subjectMap: Record<string, SubjectOption[]> = {};
    for (const row of (staRes.data ?? [])) {
      const cls = (row as any).classes;
      const subj = (row as any).subjects;
      if (cls && subj) {
        if (!subjectMap[cls.id]) subjectMap[cls.id] = [];
        if (!subjectMap[cls.id].find((s: SubjectOption) => s.id === subj.id)) {
          subjectMap[cls.id].push({ id: subj.id, name: subj.name });
        }
      }
    }
    setTeacherSubjectMap(subjectMap);

    const classSources = [
      ...(staRes.data ?? []).map((d: any) => d.classes),
      ...(ctRes.data ?? []).map((d: any) => d.classes),
      ...(fmRes.data ?? []),
    ].filter(Boolean);
    const uniqueClasses = [...new Map(classSources.map((c: any) => [c.id, c])).values()] as ClassOption[];
    setTeacherClasses(uniqueClasses);
  }

  async function fetchSubjectsForClass(classId: string, target: 'form' | 'filter') {
    if (!classId) {
      if (target === 'form') setSubjects([]);
      else setFilterSubjects([]);
      return;
    }
    let result: SubjectOption[] = [];
    if (isTeacher(profile?.role)) {
      result = teacherSubjectMap[classId] ?? [];
    } else {
      const { data } = await supabase
        .from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId);
      result = ((data ?? []).map((d: any) => d.subjects).filter(Boolean)) as SubjectOption[];
    }
    if (target === 'form') setSubjects(result);
    else setFilterSubjects(result);
  }

  async function fetchAcademicYears() {
    const { data } = await supabase.from('academic_years').select('id, name').order('name');
    if (data) setAcademicYears(data);
  }

  async function fetchTerms() {
    const { data } = await supabase.from('terms').select('id, name').order('name');
    if (data) setTerms(data);
  }

  async function fetchItems() {
    setLoading(true);
    let query = supabase
      .from('syllabus_items')
      .select('*, classes(name), subjects(name), academic_years(name)')
      .order('created_at', { ascending: false });
    if (filterClass) query = query.eq('class_id', filterClass);
    if (filterSubject) query = query.eq('subject_id', filterSubject);
    const { data } = await query;
    if (data) setItems(data as SyllabusItem[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setSubjects([]);
    setForm({ class_id: '', subject_id: '', academic_year_id: '', term_id: '', title: '', content: '', file_url: '' });
    setModalOpen(true);
  }

  function openEdit(item: SyllabusItem) {
    setEditId(item.id);
    setSaveError('');
    setForm({
      class_id: item.class_id || '',
      subject_id: item.subject_id || '',
      academic_year_id: item.academic_year_id || '',
      term_id: item.term_id || '',
      title: item.title || '',
      content: item.content || '',
      file_url: item.file_url || '',
    });
    if (item.class_id) fetchSubjectsForClass(item.class_id, 'form');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) { setSaveError('Title is required.'); return; }
    setSaving(true);
    const payload: Record<string, any> = {
      class_id: form.class_id || null,
      subject_id: form.subject_id || null,
      academic_year_id: form.academic_year_id || null,
      term_id: form.term_id || null,
      title: form.title,
      content: form.content,
      file_url: form.file_url,
    };
    if (!editId) {
      payload.school_id = profile?.school_id;
      payload.uploaded_by = profile?.id;
    }
    let res;
    if (editId) {
      res = await supabase.from('syllabus_items').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('syllabus_items').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this syllabus item?')) return;
    await supabase.from('syllabus_items').delete().eq('id', id);
    fetchItems();
  }

  const displayClasses = isTeacher(profile?.role) ? teacherClasses : allClasses;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-emerald-500 text-white p-1.5 sm:p-2 rounded-xl shrink-0">
            <FileText size={18} />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-app-text truncate">Syllabus</h1>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0">
          <Plus size={16} />
          <span className="hidden sm:inline">Add Syllabus</span>
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-app-text-muted" />
          <span className="text-sm font-medium text-app-text-muted">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={filterClass}
            onChange={e => {
              setFilterClass(e.target.value);
              setFilterSubject('');
              fetchSubjectsForClass(e.target.value, 'filter');
            }}
            className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            <option value="">All Classes</option>
            {displayClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            disabled={!filterClass}>
            <option value="">All Subjects</option>
            {filterSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {(filterClass || filterSubject) && (
            <button onClick={() => { setFilterClass(''); setFilterSubject(''); setFilterSubjects([]); }}
              className="flex items-center gap-1 text-sm text-app-text-muted hover:text-app-text">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No syllabus items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Class</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Academic Year</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">File</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{item.title}</td>
                    <td className="px-4 py-3 text-app-text-muted">{item.classes?.name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{item.subjects?.name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{item.academic_years?.name || '-'}</td>
                    <td className="px-4 py-3">
                      {item.file_url ? (
                        <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700">
                          <ExternalLink size={13} /> View
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(item)}
                          className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="text-app-text-muted hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
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
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Syllabus' : 'Add Syllabus'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class</label>
              <select className={INPUT_CLASS} value={form.class_id}
                onChange={e => {
                  setForm(p => ({ ...p, class_id: e.target.value, subject_id: '' }));
                  fetchSubjectsForClass(e.target.value, 'form');
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Academic Year</label>
              <select className={INPUT_CLASS} value={form.academic_year_id}
                onChange={e => setForm(p => ({ ...p, academic_year_id: e.target.value }))}>
                <option value="">Select Year</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Term</label>
              <select className={INPUT_CLASS} value={form.term_id}
                onChange={e => setForm(p => ({ ...p, term_id: e.target.value }))}>
                <option value="">Select Term</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title <span className="text-red-500">*</span></label>
            <input required className={INPUT_CLASS} value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Syllabus title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Content</label>
            <textarea className={INPUT_CLASS} rows={4} value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Syllabus content..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">File URL</label>
            <input className={INPUT_CLASS} value={form.file_url}
              onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-app-border text-app-text-muted hover:bg-app-surface-alt">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60">
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
