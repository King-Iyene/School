import { useEffect, useState } from 'react';
import { BookOpen, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TeacherMyClasses() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const [classData, setClassData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { loadClasses(); }, [profile]);

  async function loadClasses() {
    if (!profile?.id) return;
    setLoading(true);

    // Fetch current academic year
    const { data: yearData } = await supabase.from('academic_years')
      .select('id')
      .eq('school_id', profile.school_id ?? '')
      .eq('is_current', true)
      .maybeSingle();
    const yearId = yearData?.id;

    const subBase = supabase.from('subject_teacher_assignments')
      .select('*, classes(id, name, level, section), subjects(id, name, code)')
      .eq('academic_year_id', yearId ?? '');
    const fmTableBase = supabase.from('class_teachers')
      .select('class_id, classes(id, name, level, section)')
      .eq('academic_year_id', yearId ?? '');

    const [subRes, fmTableRes, fmClassesRes] = await Promise.all([
      isAdmin ? subBase : subBase.eq('teacher_id', profile.id),
      isAdmin ? fmTableBase : fmTableBase.eq('teacher_id', profile.id),
      isAdmin
        ? supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id ?? '')
        : supabase.from('classes').select('id, name, level, section').eq('class_teacher_id', profile.id)
    ]);

    const classMap: Record<string, any> = {};
    
    // Add classes from all sources
    (subRes.data ?? []).forEach(d => {
      const cls = d.classes as any;
      if (!cls) return;
      if (!classMap[cls.id]) classMap[cls.id] = { ...cls, subjects: [] };
      if (d.subjects) classMap[cls.id].subjects.push(d.subjects);
    });

    (fmTableRes.data ?? []).forEach(d => {
      const cls = d.classes as any;
      if (cls && !classMap[cls.id]) classMap[cls.id] = { ...cls, subjects: [] };
    });

    (fmClassesRes.data ?? []).forEach(cls => {
      if (cls && !classMap[cls.id]) classMap[cls.id] = { ...cls, subjects: [] };
    });

    const classes = Object.values(classMap);
    const enriched = await Promise.all(classes.map(async cls => {
      const { count } = await supabase.from('student_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', cls.id)
        .eq('status', 'active')
        .eq('academic_year_id', yearId ?? '');
      return { ...cls, studentCount: count ?? 0 };
    }));
    setClassData(enriched);
    setLoading(false);
  }

  function toggleExpand(classId: string) {
    const s = new Set(expanded);
    s.has(classId) ? s.delete(classId) : s.add(classId);
    setExpanded(s);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">My Classes</h2>
        <p className="text-slate-500 text-sm">Classes and subjects assigned to you</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : classData.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No classes assigned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classData.map(cls => (
            <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleExpand(cls.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                    {cls.level}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">{cls.name || `${cls.level}${cls.section}`}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{cls.studentCount} students</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{cls.subjects.length} subjects</span>
                    </div>
                  </div>
                </div>
                {expanded.has(cls.id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {expanded.has(cls.id) && (
                <div className="border-t border-slate-100 px-5 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Subjects I Teach</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.subjects.map((s: any) => (
                      <span key={s.id} className="bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg font-medium">
                        {s.name} <span className="text-slate-400 text-xs">{s.code}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
