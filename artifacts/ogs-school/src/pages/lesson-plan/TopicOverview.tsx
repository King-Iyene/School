import { useState, useEffect } from 'react';
import { BookOpen, Target, Package, Clock, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Lesson {
  id: string;
  title: string;
  lesson_number: number;
  description: string;
  duration_minutes: number;
  status: 'draft' | 'active' | 'completed';
  classes: { name: string; level: string; section: string } | null;
  subjects: { name: string; code: string } | null;
}

interface Topic {
  id: string;
  topic_number: number;
  title: string;
  overview: string;
  objectives: string;
  resources: string;
  duration_minutes: number;
  status: 'draft' | 'active' | 'completed';
  lesson_id: string;
}

const statusConfig = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-app-text-muted' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

export default function TopicOverview() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (profile?.school_id) {
      fetchLessons();
    }
  }, [profile?.school_id]);

  useEffect(() => {
    if (selectedLesson) {
      fetchTopicsForLesson(selectedLesson);
      setSelectedTopic('');
      setTopic(null);
      const found = lessons.find((l) => l.id === selectedLesson) || null;
      setLesson(found);
    } else {
      setTopics([]);
      setSelectedTopic('');
      setTopic(null);
      setLesson(null);
    }
  }, [selectedLesson]);

  useEffect(() => {
    if (selectedTopic) {
      fetchTopicDetail(selectedTopic);
    } else {
      setTopic(null);
    }
  }, [selectedTopic]);

  async function fetchLessons() {
    setLoadingLessons(true);
    const { data } = await supabase
      .from('lessons')
      .select(`
        id, title, lesson_number, description, duration_minutes, status,
        classes ( name, level, section ),
        subjects ( name, code )
      `)
      .eq('school_id', profile!.school_id)
      .order('lesson_number', { ascending: true });
    setLessons((data as unknown as Lesson[]) || []);
    setLoadingLessons(false);
  }

  async function fetchTopicsForLesson(lessonId: string) {
    setLoadingTopics(true);
    const { data } = await supabase
      .from('topics')
      .select('id, topic_number, title, overview, objectives, resources, duration_minutes, status, lesson_id')
      .eq('lesson_id', lessonId)
      .eq('school_id', profile!.school_id)
      .order('topic_number', { ascending: true });
    setTopics(data || []);
    setLoadingTopics(false);
  }

  async function fetchTopicDetail(topicId: string) {
    setLoadingDetail(true);
    const { data } = await supabase
      .from('topics')
      .select('id, topic_number, title, overview, objectives, resources, duration_minutes, status, lesson_id')
      .eq('id', topicId)
      .single();
    setTopic(data || null);
    setLoadingDetail(false);
  }

  function getClassName(cls: { name: string; level: string; section: string }) {
    return cls.name || [cls.level, cls.section].filter(Boolean).join(' ');
  }

  function renderTextBlock(text: string) {
    if (!text) return <p className="text-app-text-muted italic text-sm">Not provided</p>;
    const lines = text.split('\n').filter((l) => l.trim());
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-app-text">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            {line}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app-text">Topic Overview</h1>
        <p className="text-sm text-app-text-muted mt-1">View detailed topic information including objectives and resources</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-medium text-app-text-muted mb-1">Select Lesson</label>
          {loadingLessons ? (
            <div className="border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-muted bg-app-surface">Loading lessons...</div>
          ) : (
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface"
            >
              <option value="">Choose a lesson...</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  Lesson {l.lesson_number}: {l.title}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-app-text-muted mb-1">Select Topic</label>
          {loadingTopics ? (
            <div className="border border-app-border rounded-lg px-3 py-2 text-sm text-app-text-muted bg-app-surface">Loading topics...</div>
          ) : (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={!selectedLesson}
              className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Choose a topic...</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  Topic {t.topic_number}: {t.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!selectedLesson && (
        <div className="flex flex-col items-center justify-center h-48 text-app-text-muted bg-app-surface rounded-xl border border-app-border border-dashed">
          <BookOpen size={32} className="mb-2 opacity-40" />
          <p className="text-sm">Select a lesson to get started</p>
        </div>
      )}

      {selectedLesson && lesson && !selectedTopic && (
        <div className="bg-app-surface rounded-xl border border-app-border p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Lesson {lesson.lesson_number}
                </span>
                {lesson.subjects && (
                  <span className="text-xs text-app-text-muted">{lesson.subjects.name}</span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-app-text">{lesson.title}</h2>
              {lesson.classes && (
                <p className="text-sm text-app-text-muted mt-0.5">{getClassName(lesson.classes)}</p>
              )}
              {lesson.description && (
                <p className="text-sm text-app-text-muted mt-2">{lesson.description}</p>
              )}
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[lesson.status]?.className || statusConfig.draft.className}`}>
              {statusConfig[lesson.status]?.label || 'Draft'}
            </span>
          </div>
          {topics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-app-border">
              <p className="text-xs font-medium text-app-text-muted mb-2">{topics.length} topic{topics.length !== 1 ? 's' : ''} in this lesson</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTopic(t.id)}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-app-text-muted rounded-lg transition-colors"
                  >
                    {t.topic_number}. {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTopic && loadingDetail && (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading topic details...</div>
      )}

      {selectedTopic && !loadingDetail && topic && lesson && (
        <div className="space-y-4">
          <div className="bg-app-surface rounded-xl border border-app-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Topic {topic.topic_number}
                  </span>
                  <span className="text-xs text-app-text-muted">from Lesson {lesson.lesson_number}: {lesson.title}</span>
                </div>
                <h2 className="text-xl font-bold text-app-text">{topic.title}</h2>
                {lesson.subjects && (
                  <p className="text-sm text-app-text-muted mt-0.5">{lesson.subjects.name}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {topic.duration_minutes > 0 && (
                  <div className="flex items-center gap-1 text-xs text-app-text-muted">
                    <Clock size={13} />
                    <span>{topic.duration_minutes} min</span>
                  </div>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[topic.status]?.className || statusConfig.draft.className}`}>
                  {statusConfig[topic.status]?.label || 'Draft'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-app-surface rounded-xl border border-app-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <BookOpen size={16} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-app-text">Overview</h3>
              </div>
              {topic.overview ? (
                <p className="text-sm text-app-text leading-relaxed">{topic.overview}</p>
              ) : (
                <p className="text-app-text-muted italic text-sm">No overview provided</p>
              )}
            </div>

            <div className="bg-app-surface rounded-xl border border-app-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Target size={16} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-app-text">Learning Objectives</h3>
              </div>
              {renderTextBlock(topic.objectives)}
            </div>

            <div className="bg-app-surface rounded-xl border border-app-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Package size={16} className="text-amber-600" />
                </div>
                <h3 className="font-semibold text-app-text">Resources & Materials</h3>
              </div>
              {renderTextBlock(topic.resources)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
