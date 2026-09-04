import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Class {
  id: string;
  name: string;
  level: string;
  section: string;
}

interface Lesson {
  id: string;
  title: string;
  lesson_number: number;
  class_id: string;
}

interface Topic {
  id: string;
  title: string;
  topic_number: number;
  lesson_id: string;
}

interface LessonPlanRecord {
  id: string;
  topic_id: string;
  school_id: string;
  teacher_id: string;
  plan_date: string;
  introduction: string;
  development: string;
  conclusion: string;
  materials: string;
  evaluation: string;
  homework_notes: string;
  notes: string;
  status: 'draft' | 'active' | 'completed';
}

interface FormData {
  plan_date: string;
  introduction: string;
  development: string;
  conclusion: string;
  materials: string;
  evaluation: string;
  homework_notes: string;
  notes: string;
  status: 'draft' | 'active' | 'completed';
}

const initialForm: FormData = {
  plan_date: new Date().toISOString().split('T')[0],
  introduction: '',
  development: '',
  conclusion: '',
  materials: '',
  evaluation: '',
  homework_notes: '',
  notes: '',
  status: 'draft',
};

export default function LessonPlan() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [existingPlan, setExistingPlan] = useState<LessonPlanRecord | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile?.school_id) {
      fetchClasses();
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (selectedClass) {
      fetchLessonsForClass(selectedClass);
      setSelectedLesson('');
      setSelectedTopic('');
      setExistingPlan(null);
    } else {
      setLessons([]);
      setTopics([]);
      setSelectedLesson('');
      setSelectedTopic('');
      setExistingPlan(null);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedLesson) {
      fetchTopicsForLesson(selectedLesson);
      setSelectedTopic('');
      setExistingPlan(null);
    } else {
      setTopics([]);
      setSelectedTopic('');
      setExistingPlan(null);
    }
  }, [selectedLesson]);

  useEffect(() => {
    if (selectedTopic) {
      fetchExistingPlan(selectedTopic);
    } else {
      setExistingPlan(null);
      setForm(initialForm);
    }
  }, [selectedTopic]);

  async function fetchClasses() {
    setLoading(true);
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, section')
      .eq('school_id', profile!.school_id)
      .order('name');
    setClasses(data || []);
    setLoading(false);
  }

  async function fetchLessonsForClass(classId: string) {
    setLoadingLessons(true);
    const { data } = await supabase
      .from('lessons')
      .select('id, title, lesson_number, class_id')
      .eq('school_id', profile!.school_id)
      .eq('class_id', classId)
      .order('lesson_number', { ascending: true });
    setLessons(data || []);
    setLoadingLessons(false);
  }

  async function fetchTopicsForLesson(lessonId: string) {
    setLoadingTopics(true);
    const { data } = await supabase
      .from('topics')
      .select('id, title, topic_number, lesson_id')
      .eq('school_id', profile!.school_id)
      .eq('lesson_id', lessonId)
      .order('topic_number', { ascending: true });
    setTopics(data || []);
    setLoadingTopics(false);
  }

  async function fetchExistingPlan(topicId: string) {
    setLoadingPlan(true);
    const { data } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('topic_id', topicId)
      .eq('school_id', profile!.school_id)
      .maybeSingle();
    if (data) {
      setExistingPlan(data as LessonPlanRecord);
      setForm({
        plan_date: data.plan_date || new Date().toISOString().split('T')[0],
        introduction: data.introduction || '',
        development: data.development || '',
        conclusion: data.conclusion || '',
        materials: data.materials || '',
        evaluation: data.evaluation || '',
        homework_notes: data.homework_notes || '',
        notes: data.notes || '',
        status: data.status || 'draft',
      });
    } else {
      setExistingPlan(null);
      setForm(initialForm);
    }
    setLoadingPlan(false);
  }

  async function handleSave() {
    if (!selectedTopic) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    const payload = {
      topic_id: selectedTopic,
      school_id: profile!.school_id,
      teacher_id: profile!.id,
      plan_date: form.plan_date,
      introduction: form.introduction,
      development: form.development,
      conclusion: form.conclusion,
      materials: form.materials,
      evaluation: form.evaluation,
      homework_notes: form.homework_notes,
      notes: form.notes,
      status: form.status,
    };
    let res;
    if (existingPlan) {
      res = await supabase.from('lesson_plans').update(payload).eq('id', existingPlan.id);
    } else {
      res = await supabase.from('lesson_plans').insert(payload).select().single();
      if (!res.error && res.data) setExistingPlan(res.data as LessonPlanRecord);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function getClassName(cls: Class) {
    return cls.name || [cls.level, cls.section].filter(Boolean).join(' ');
  }

  const canSave = selectedTopic && form.introduction;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Lesson Plan</h1>
          <p className="text-sm text-app-text-muted mt-1">Create and manage detailed lesson plans for each topic</p>
        </div>
        {selectedTopic && (
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saved ? (
              <>
                <CheckCircle size={16} />
                Saved
              </>
            ) : (
              <>
                <Save size={16} />
                {saving ? 'Saving...' : existingPlan ? 'Update Plan' : 'Save Plan'}
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
          {loading ? (
            <div className="border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-muted bg-app-surface">Loading...</div>
          ) : (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
            >
              <option value="">Select class...</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{getClassName(cls)}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-app-text-muted mb-1">Lesson</label>
          {loadingLessons ? (
            <div className="border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-muted bg-app-surface">Loading...</div>
          ) : (
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              disabled={!selectedClass}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select lesson...</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>Lesson {l.lesson_number}: {l.title}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-app-text-muted mb-1">Topic</label>
          {loadingTopics ? (
            <div className="border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-muted bg-app-surface">Loading...</div>
          ) : (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={!selectedLesson}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select topic...</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>Topic {t.topic_number}: {t.title}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!selectedTopic && (
        <div className="flex flex-col items-center justify-center h-48 text-app-text-muted bg-app-surface rounded-xl border border-app-border border-dashed">
          <Save size={32} className="mb-2 opacity-40" />
          <p className="text-sm">Select a class, lesson, and topic to create or view a lesson plan</p>
        </div>
      )}

      {selectedTopic && loadingPlan && (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading plan...</div>
      )}

      {selectedTopic && !loadingPlan && (
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          {existingPlan && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <CheckCircle size={15} />
              <span>Existing plan loaded. Changes will update the existing plan.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-app-surface rounded-xl border border-app-border p-4">
              <label className="block text-sm font-semibold text-app-text mb-2">Plan Date</label>
              <input
                type="date"
                value={form.plan_date}
                onChange={(e) => setForm({ ...form, plan_date: e.target.value })}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="bg-app-surface rounded-xl border border-app-border p-4">
              <label className="block text-sm font-semibold text-app-text mb-2">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormData['status'] })}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="bg-app-surface rounded-xl border border-app-border p-4">
            <label className="block text-sm font-semibold text-app-text mb-2">
              Introduction
              <span className="text-red-400 ml-1">*</span>
            </label>
            <textarea
              value={form.introduction}
              onChange={(e) => setForm({ ...form, introduction: e.target.value })}
              placeholder="How will you introduce and engage students with the topic?"
              rows={4}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="bg-app-surface rounded-xl border border-app-border p-4">
            <label className="block text-sm font-semibold text-app-text mb-2">Development</label>
            <textarea
              value={form.development}
              onChange={(e) => setForm({ ...form, development: e.target.value })}
              placeholder="Main instructional activities and content delivery..."
              rows={5}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="bg-app-surface rounded-xl border border-app-border p-4">
            <label className="block text-sm font-semibold text-app-text mb-2">Conclusion</label>
            <textarea
              value={form.conclusion}
              onChange={(e) => setForm({ ...form, conclusion: e.target.value })}
              placeholder="How will you wrap up the lesson and reinforce learning?"
              rows={3}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-app-surface rounded-xl border border-app-border p-4">
              <label className="block text-sm font-semibold text-app-text mb-2">Materials</label>
              <textarea
                value={form.materials}
                onChange={(e) => setForm({ ...form, materials: e.target.value })}
                placeholder="List required materials and resources..."
                rows={3}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <div className="bg-app-surface rounded-xl border border-app-border p-4">
              <label className="block text-sm font-semibold text-app-text mb-2">Evaluation</label>
              <textarea
                value={form.evaluation}
                onChange={(e) => setForm({ ...form, evaluation: e.target.value })}
                placeholder="How will you assess student learning?"
                rows={3}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-app-surface rounded-xl border border-app-border p-4">
              <label className="block text-sm font-semibold text-app-text mb-2">Homework / Assignment Notes</label>
              <textarea
                value={form.homework_notes}
                onChange={(e) => setForm({ ...form, homework_notes: e.target.value })}
                placeholder="Any homework or follow-up assignments..."
                rows={3}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <div className="bg-app-surface rounded-xl border border-app-border p-4">
              <label className="block text-sm font-semibold text-app-text mb-2">Additional Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any other notes or observations..."
                rows={3}
                className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 pb-6">
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saved ? (
                <>
                  <CheckCircle size={16} />
                  Saved Successfully
                </>
              ) : (
                <>
                  <Save size={16} />
                  {saving ? 'Saving...' : existingPlan ? 'Update Plan' : 'Save Plan'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
