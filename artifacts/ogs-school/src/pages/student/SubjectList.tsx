import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
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

export default function SubjectList() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      const { data: enroll } = await supabase
        .from('student_enrollments')
        .select('class_id, classes(id, name, level, section)')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      const classId = enroll?.class_id;
      setClassInfo(enroll?.classes as any);
      if (classId) {
        const { data } = await supabase
          .from('class_subjects')
          .select('*, subjects(id, name, code, type), profiles!teacher_id(first_name, last_name)')
          .eq('class_id', classId);
        setSubjects(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  const cls = classInfo as any;
  const className = cls ? `${cls.level || ''}${cls.section ? '-' + cls.section : ''}` : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">My Subjects</h1>
        <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-1.5 rounded-full">
          {subjects.length} {subjects.length === 1 ? 'Subject' : 'Subjects'}
        </span>
      </div>

      {subjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No subjects assigned</p>
          <p className="text-sm text-slate-400 mt-1">Your subjects will appear here once assigned</p>
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
                  <p className={`text-xs font-mono font-semibold ${colors.text} mb-2`}>{sub.code}</p>
                )}
                {className && (
                  <p className="text-xs text-slate-500 mb-2">Class: {className}</p>
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
    </div>
  );
}
