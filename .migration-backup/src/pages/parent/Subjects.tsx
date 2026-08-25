import { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const SUBJECT_COLORS = [
  { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
  { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-700' },
  { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'bg-violet-100 text-violet-600', text: 'text-violet-700' },
  { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
  { bg: 'bg-rose-50', border: 'border-rose-100', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
  { bg: 'bg-cyan-50', border: 'border-cyan-100', icon: 'bg-cyan-100 text-cyan-600', text: 'text-cyan-700' },
  { bg: 'bg-orange-50', border: 'border-orange-100', icon: 'bg-orange-100 text-orange-600', text: 'text-orange-700' },
  { bg: 'bg-teal-50', border: 'border-teal-100', icon: 'bg-teal-100 text-teal-600', text: 'text-teal-700' },
];

export default function Subjects() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [classInfo, setClassInfo] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

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
    async function loadSubjects() {
      if (!selectedChild) return;
      setSubjectsLoading(true);
      const { data: enroll } = await supabase
        .from('student_enrollments')
        .select('class_id, classes(id, name, level, section)')
        .eq('student_id', selectedChild)
        .eq('status', 'active')
        .maybeSingle();
      setClassInfo(enroll?.classes as any);
      const classId = enroll?.class_id;
      if (classId) {
        const { data } = await supabase
          .from('class_subjects')
          .select('*, subjects(id, name, code, type), profiles!teacher_id(first_name, last_name)')
          .eq('class_id', classId);
        setSubjects(data ?? []);
      } else {
        setSubjects([]);
      }
      setSubjectsLoading(false);
    }
    loadSubjects();
  }, [selectedChild]);

  const cls = classInfo as any;
  const className = cls ? `${cls.level || ''}${cls.section ? '-' + cls.section : ''}` : '';
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
        {subjects.length > 0 && (
          <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-1.5 rounded-full">
            {subjects.length} {subjects.length === 1 ? 'Subject' : 'Subjects'}
          </span>
        )}
      </div>

      {children.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No children linked to your account</p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="relative w-64">
              <select
                value={selectedChild}
                onChange={e => setSelectedChild(e.target.value)}
                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white pr-9"
              >
                {children.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}

          {subjectsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No subjects assigned</p>
              <p className="text-sm text-slate-400 mt-1">
                {selectedChildObj ? `${(selectedChildObj as any).first_name}'s subjects have not been set up yet` : ''}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {subjects.map((sa, i) => {
                const sub = sa.subjects as any;
                const teacher = sa.profiles as any;
                const colors = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                return (
                  <div key={sa.id} className={`${colors.bg} ${colors.border} border rounded-2xl p-5 hover:shadow-md transition-shadow`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center`}>
                        <BookOpen className="w-5 h-5" />
                      </div>
                      {sub?.type && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${colors.text} bg-white/60`}>
                          {sub.type}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-1">{sub?.name || '—'}</h3>
                    {sub?.code && (
                      <p className={`text-xs font-mono font-semibold ${colors.text} mb-1`}>{sub.code}</p>
                    )}
                    {className && (
                      <p className="text-xs text-slate-500 mb-1">Class: {className}</p>
                    )}
                    {teacher && (
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/40">
                        <div className={`w-5 h-5 rounded-full ${colors.icon} flex items-center justify-center text-xs font-bold`}>
                          {teacher.first_name?.[0]}
                        </div>
                        <p className="text-xs text-slate-600 truncate">{teacher.first_name} {teacher.last_name}</p>
                      </div>
                    )}
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
