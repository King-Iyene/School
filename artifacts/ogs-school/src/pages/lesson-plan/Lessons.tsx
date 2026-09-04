import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Class {
  id: string;
  name: string;
  level: string;
  section: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  academic_year_id: string;
  duration_minutes: number;
  status: 'draft' | 'active' | 'completed';
  classes: { name: string; level: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

interface FormData {
  class_id: string;
  subject_id: string;
  title: string;
  description: string;
  lesson_number: string;
  duration_minutes: string;
  status: 'draft' | 'active' | 'completed';
}

const initialForm: FormData = {
  class_id: '',
  subject_id: '',
  title: '',
  description: '',
  lesson_number: '',
  duration_minutes: '',
  status: 'draft',
};

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-app-text-muted' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

export default function Lessons() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    if (profile?.school_id) {
      loadReferenceData();
      fetchLessons();
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchLessons();
    }
  }, [filterClass, filterSubject]);

  async function loadReferenceData() {
    const [classesRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select('id, name, level, section').eq('school_id', profile!.school_id).order('name'),
      supabase.from('subjects').select('id, name, code').eq('school_id', profile!.school_id).order('name'),
    ]);
    setClasses(classesRes.data || []);
    setSubjects(subjectsRes.data || []);
  }

  async function fetchLessons() {
    setLoading(true);
    let query = supabase
      .from('lessons')
      .select(`
        id, lesson_number, title, description, class_id, subject_id,
        teacher_id, academic_year_id, duration_minutes, status,
        classes ( name, level, section ),
        subjects ( name, code )
      `)
      .eq('school_id', profile!.school_id)
      .order('lesson_number', { ascending: true });

    if (filterClass) query = query.eq('class_id', filterClass);
    if (filterSubject) query = query.eq('subject_id', filterSubject);

    const { data } = await query;
    setLessons((data as unknown as Lesson[]) || []);
    setLoading(false);
  }

  function getClassName(cls: { name: string; level: string; section: string }) {
    return cls.name || [cls.level, cls.section].filter(Boolean).join(' ');
  }

  function openAdd() {
    setEditing(null);
    setForm(initialForm);
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(lesson: Lesson) {
    setEditing(lesson);
    setSaveError('');
    setForm({
      class_id: lesson.class_id,
      subject_id: lesson.subject_id,
      title: lesson.title,
      description: lesson.description || '',
      lesson_number: String(lesson.lesson_number),
      duration_minutes: String(lesson.duration_minutes),
      status: lesson.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.class_id || !form.subject_id || !form.title || !form.lesson_number) return;
    setSaving(true);
    const payload = {
      class_id: form.class_id,
      subject_id: form.subject_id,
      title: form.title,
      description: form.description,
      lesson_number: parseInt(form.lesson_number),
      duration_minutes: parseInt(form.duration_minutes) || 0,
      status: form.status,
    };
    let res;
    if (editing) {
      res = await supabase.from('lessons').update(payload).eq('id', editing.id);
    } else {
      res = await supabase.from('lessons').insert({ ...payload, school_id: profile!.school_id });
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchLessons();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lesson? This will also delete all associated topics and plans.')) return;
    await supabase.from('lessons').delete().eq('id', id);
    fetchLessons();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Lessons</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage lesson units for your classes</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Lesson
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary bg-app-surface"
        >
          <option value="">All Classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{getClassName(cls)}</option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary bg-app-surface"
        >
          <option value="">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={sub.id}>{sub.name} {sub.code ? `(${sub.code})` : ''}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">#</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Title</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Class</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-app-text-muted">No lessons found</td>
                </tr>
              ) : (
                lessons.map((lesson) => {
                  const status = statusConfig[lesson.status] || statusConfig.draft;
                  return (
                    <tr key={lesson.id} className="border-b border-app-border hover:bg-app-surface-alt">
                      <td className="px-4 py-3 text-app-text-muted font-mono">{lesson.lesson_number}</td>
                      <td className="px-4 py-3 font-medium text-app-text">{lesson.title}</td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {lesson.subjects ? lesson.subjects.name : '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {lesson.classes ? getClassName(lesson.classes) : '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {lesson.duration_minutes ? `${lesson.duration_minutes} min` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(lesson)}
                            className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit lesson"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(lesson.id)}
                            className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete lesson"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Lesson' : 'Add Lesson'}
        size="lg"
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class</label>
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{getClassName(cls)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
              <select
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              >
                <option value="">Select subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name} {sub.code ? `(${sub.code})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Lesson title"
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the lesson"
              rows={3}
              className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Lesson Number</label>
              <input
                type="number"
                value={form.lesson_number}
                onChange={(e) => setForm({ ...form, lesson_number: e.target.value })}
                placeholder="1"
                min="1"
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Duration (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                placeholder="60"
                min="0"
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormData['status'] })}
                className="bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-app-primary hover:opacity-90 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Lesson'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
