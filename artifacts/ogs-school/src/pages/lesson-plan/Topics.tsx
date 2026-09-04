import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Lesson {
  id: string;
  title: string;
  lesson_number: number;
}

interface Topic {
  id: string;
  topic_number: number;
  title: string;
  overview: string;
  objectives: string;
  resources: string;
  lesson_id: string;
  duration_minutes: number;
  status: 'draft' | 'active' | 'completed';
  lessons: { title: string; lesson_number: number } | null;
}

interface FormData {
  lesson_id: string;
  title: string;
  overview: string;
  objectives: string;
  resources: string;
  topic_number: string;
  duration_minutes: string;
  status: 'draft' | 'active' | 'completed';
}

const initialForm: FormData = {
  lesson_id: '',
  title: '',
  overview: '',
  objectives: '',
  resources: '',
  topic_number: '',
  duration_minutes: '',
  status: 'draft',
};

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-app-text-muted' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

export default function Topics() {
  const { profile } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [filterLesson, setFilterLesson] = useState('');

  useEffect(() => {
    if (profile?.school_id) {
      loadLessons();
      fetchTopics();
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchTopics();
    }
  }, [filterLesson]);

  async function loadLessons() {
    const { data } = await supabase
      .from('lessons')
      .select('id, title, lesson_number')
      .eq('school_id', profile!.school_id)
      .order('lesson_number', { ascending: true });
    setLessons(data || []);
  }

  async function fetchTopics() {
    setLoading(true);
    let query = supabase
      .from('topics')
      .select(`
        id, topic_number, title, overview, objectives, resources,
        lesson_id, duration_minutes, status,
        lessons ( title, lesson_number )
      `)
      .eq('school_id', profile!.school_id)
      .order('topic_number', { ascending: true });

    if (filterLesson) query = query.eq('lesson_id', filterLesson);

    const { data } = await query;
    setTopics((data as unknown as Topic[]) || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(initialForm);
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(topic: Topic) {
    setEditing(topic);
    setSaveError('');
    setForm({
      lesson_id: topic.lesson_id,
      title: topic.title,
      overview: topic.overview || '',
      objectives: topic.objectives || '',
      resources: topic.resources || '',
      topic_number: String(topic.topic_number),
      duration_minutes: String(topic.duration_minutes),
      status: topic.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.lesson_id || !form.title || !form.topic_number) return;
    setSaving(true);
    const payload = {
      lesson_id: form.lesson_id,
      title: form.title,
      overview: form.overview,
      objectives: form.objectives,
      resources: form.resources,
      topic_number: parseInt(form.topic_number),
      duration_minutes: parseInt(form.duration_minutes) || 0,
      status: form.status,
    };
    let res;
    if (editing) {
      res = await supabase.from('topics').update(payload).eq('id', editing.id);
    } else {
      res = await supabase.from('topics').insert({ ...payload, school_id: profile!.school_id });
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchTopics();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Topics</h1>
          <p className="text-sm text-app-text-muted mt-1">Manage topics within each lesson</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Topic
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={filterLesson}
          onChange={(e) => setFilterLesson(e.target.value)}
          className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
        >
          <option value="">All Lessons</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              Lesson {lesson.lesson_number}: {lesson.title}
            </option>
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
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Lesson</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-app-text-muted">No topics found</td>
                </tr>
              ) : (
                topics.map((topic) => {
                  const status = statusConfig[topic.status] || statusConfig.draft;
                  return (
                    <tr key={topic.id} className="border-b border-app-border hover:bg-app-surface-alt">
                      <td className="px-4 py-3 text-app-text-muted font-mono">{topic.topic_number}</td>
                      <td className="px-4 py-3 font-medium text-app-text">{topic.title}</td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {topic.lessons
                          ? `Lesson ${topic.lessons.lesson_number}: ${topic.lessons.title}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {topic.duration_minutes ? `${topic.duration_minutes} min` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(topic)}
                            className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit topic"
                          >
                            <Edit2 size={15} />
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
        title={editing ? 'Edit Topic' : 'Add Topic'}
        size="lg"
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Lesson</label>
            <select
              value={form.lesson_id}
              onChange={(e) => setForm({ ...form, lesson_id: e.target.value })}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select lesson</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  Lesson {lesson.lesson_number}: {lesson.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Topic title"
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Overview</label>
            <textarea
              value={form.overview}
              onChange={(e) => setForm({ ...form, overview: e.target.value })}
              placeholder="Topic overview"
              rows={3}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Objectives</label>
            <textarea
              value={form.objectives}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })}
              placeholder="Learning objectives (one per line)"
              rows={3}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Resources</label>
            <textarea
              value={form.resources}
              onChange={(e) => setForm({ ...form, resources: e.target.value })}
              placeholder="Materials and resources"
              rows={2}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Topic Number</label>
              <input
                type="number"
                value={form.topic_number}
                onChange={(e) => setForm({ ...form, topic_number: e.target.value })}
                placeholder="1"
                min="1"
                className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Duration (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                placeholder="45"
                min="0"
                className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormData['status'] })}
                className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Topic'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
