import { useState, useEffect } from 'react';
import { Download, FileText, BookOpen, FolderOpen, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const TABS = ['Study Material', 'Syllabus', 'Other Downloads'] as const;
type Tab = typeof TABS[number];

export default function DownloadCenter() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Study Material');
  const [classId, setClassId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClass() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      setClassId(data?.class_id || null);
    }
    loadClass();
  }, [profile]);

  useEffect(() => {
    async function loadSubjects() {
      if (!classId) return;
      const { data } = await supabase
        .from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId);
      const unique: any[] = [];
      const seen = new Set();
      for (const sa of data ?? []) {
        const sub = sa.subjects as any;
        if (sub && !seen.has(sub.id)) {
          seen.add(sub.id);
          unique.push(sub);
        }
      }
      setSubjects(unique);
    }
    loadSubjects();
  }, [classId]);

  useEffect(() => {
    async function loadItems() {
      if (!classId) { setLoading(false); return; }
      setLoading(true);
      const contentTypeMap: Record<Tab, string> = {
        'Study Material': 'study_material',
        'Syllabus': 'syllabus',
        'Other Downloads': 'other',
      };
      const ct = contentTypeMap[activeTab];
      let query = supabase
        .from('assignments')
        .select('*, subjects(id, name)')
        .eq('class_id', classId)
        .eq('content_type', ct);
      if (subjectFilter) query = query.eq('subject_id', subjectFilter);
      const { data } = await query.order('created_at', { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    }
    loadItems();
  }, [classId, activeTab, subjectFilter]);

  const tabIcons: Record<Tab, React.ReactNode> = {
    'Study Material': <BookOpen className="w-4 h-4" />,
    'Syllabus': <FileText className="w-4 h-4" />,
    'Other Downloads': <FolderOpen className="w-4 h-4" />,
  };

  const isUrl = (s: string) => {
    try { new URL(s); return true; } catch { return false; }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-app-text">Download Center</h1>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-app-surface text-emerald-700 shadow-sm' : 'text-app-text-muted hover:text-app-text'}`}
          >
            {tabIcons[tab]}
            {tab}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-app-text-muted" />
        <select
          value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value)}
          className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface"
        >
          <option value="">All Subjects</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No {activeTab} available</p>
          <p className="text-sm text-app-text-muted mt-1">Check back later for new uploads</p>
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <div className="divide-y divide-app-border">
            {items.map(item => {
              const subject = item.subjects as any;
              const hasFile = item.file_url && isUrl(item.file_url);
              return (
                <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-app-surface-alt transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-app-text truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {subject?.name && (
                          <span className="text-xs bg-slate-100 text-app-text-muted px-2 py-0.5 rounded-full">{subject.name}</span>
                        )}
                        <span className="text-xs text-app-text-muted">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 shrink-0">
                    {hasFile ? (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-app-text-muted bg-slate-100 px-3 py-2 rounded-xl">No file</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
