import { useState, useEffect } from 'react';
import { ClipboardList, ChevronDown, Filter, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function Homework() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [classId, setClassId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [assLoading, setAssLoading] = useState(false);

  useEffect(() => {
    async function loadChildren() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('parent_student_links')
        .select('*, students!student_id(id, first_name, last_name)')
        .eq('parent_id', profile.id);
      const kids = (data ?? []).map(l => (l as any).students).filter(Boolean);
      setChildren(kids);
      if (kids.length > 0) setSelectedChild((kids[0] as any).id);
      setLoading(false);
    }
    loadChildren();
  }, [profile]);

  useEffect(() => {
    async function loadClass() {
      if (!selectedChild) return;
      const { data } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .eq('student_id', selectedChild)
        .eq('status', 'active')
        .maybeSingle();
      setClassId(data?.class_id || null);
    }
    loadClass();
  }, [selectedChild]);

  useEffect(() => {
    async function loadAssignments() {
      if (!classId) { setAssignments([]); return; }
      setAssLoading(true);
      let query = supabase
        .from('assignments')
        .select('*, subjects(id, name)')
        .eq('class_id', classId)
        .in('content_type', ['assignment', 'homework'])
        .order('due_date', { ascending: true });
      if (subjectFilter) query = query.eq('subject_id', subjectFilter);
      const { data } = await query;
      setAssignments(data ?? []);

      const { data: subData } = await supabase
        .from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId);
      const unique: any[] = [];
      const seen = new Set();
      for (const sa of subData ?? []) {
        const sub = sa.subjects as any;
        if (sub && !seen.has(sub.id)) { seen.add(sub.id); unique.push(sub); }
      }
      setSubjects(unique);
      setAssLoading(false);
    }
    loadAssignments();
  }, [classId, subjectFilter]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getStatus = (dueDate: string) => {
    if (!dueDate) return { label: 'No Date', color: 'bg-slate-100 text-app-text-muted' };
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
    if (diff === 0) return { label: 'Due Today', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700' };
  };

  const selectedChildObj = children.find(c => c.id === selectedChild);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-app-text">Homework & Assignments</h1>

      {children.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No children linked to your account</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {children.length > 1 && (
              <div className="relative">
                <select
                  value={selectedChild}
                  onChange={e => setSelectedChild(e.target.value)}
                  className="appearance-none border border-app-border rounded-xl px-4 py-2.5 text-sm font-medium text-app-text focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface pr-9"
                >
                  {children.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
              </div>
            )}
            <div className="relative flex items-center gap-2">
              <Filter className="w-4 h-4 text-app-text-muted" />
              <select
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                className="appearance-none border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-app-surface pr-9"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
            </div>
          </div>

          {assLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-12 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-app-text-muted font-medium">No assignments found</p>
              <p className="text-sm text-app-text-muted mt-1">
                {selectedChildObj ? `No homework assigned to ${(selectedChildObj as any).first_name}'s class yet` : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const subject = a.subjects as any;
                const status = getStatus(a.due_date);
                return (
                  <div key={a.id} className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-app-text">{a.title}</h3>
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                        </div>
                        {subject?.name && (
                          <span className="inline-block mt-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                            {subject.name}
                          </span>
                        )}
                        {a.description && (
                          <p className="text-sm text-app-text-muted mt-2 line-clamp-2">{a.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-app-text-muted">Due Date</p>
                        <p className={`text-sm font-semibold mt-0.5 ${status.label === 'Overdue' ? 'text-red-600' : status.label === 'Due Today' ? 'text-amber-600' : 'text-app-text'}`}>
                          {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
