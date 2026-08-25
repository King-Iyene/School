import { useState, useEffect } from 'react';
import { Search, Users, Phone, Mail, BookOpen, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TeacherInfo() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [teachersLoading, setTeachersLoading] = useState(false);

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
    async function loadTeachers() {
      if (!selectedChild) return;
      setTeachersLoading(true);
      const { data: enroll } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .eq('student_id', selectedChild)
        .eq('status', 'active')
        .maybeSingle();
      const classId = enroll?.class_id;
      if (!classId) { setTeachers([]); setTeachersLoading(false); return; }

      const { data: assignments } = await supabase
        .from('class_subjects')
        .select('teacher_id, subjects(name, code)')
        .eq('class_id', classId)
        .not('teacher_id', 'is', null);

      const teacherMap: Record<string, { id: string; subjects: string[] }> = {};
      for (const a of assignments ?? []) {
        if (!a.teacher_id) continue;
        if (!teacherMap[a.teacher_id]) teacherMap[a.teacher_id] = { id: a.teacher_id, subjects: [] };
        const subName = (a.subjects as any)?.name;
        if (subName) teacherMap[a.teacher_id].subjects.push(subName);
      }

      const ids = Object.keys(teacherMap);
      if (ids.length === 0) { setTeachers([]); setTeachersLoading(false); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', ids);

      const merged = (profiles ?? []).map(p => ({
        ...p,
        subjects: teacherMap[p.id]?.subjects || [],
      }));
      setTeachers(merged);
      setTeachersLoading(false);
    }
    loadTeachers();
  }, [selectedChild]);

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = `${t.first_name} ${t.last_name}`.toLowerCase();
    const subs = t.subjects.join(' ').toLowerCase();
    return name.includes(q) || subs.includes(q);
  });

  const initials = (t: any) => `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`.toUpperCase();
  const avatarColors = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];

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
        <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
        {teachers.length > 0 && (
          <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-1.5 rounded-full">
            {teachers.length} Teachers
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
          <div className="flex flex-wrap items-center gap-3">
            {children.length > 1 && (
              <div className="relative">
                <select
                  value={selectedChild}
                  onChange={e => setSelectedChild(e.target.value)}
                  className="appearance-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white pr-9"
                >
                  {children.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or subject..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              />
            </div>
          </div>

          {teachersLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">{search ? 'No teachers match your search' : 'No teachers assigned'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((teacher, i) => {
                const color = avatarColors[i % avatarColors.length];
                return (
                  <div key={teacher.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-base font-bold shrink-0`}>
                        {initials(teacher)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 truncate">{teacher.first_name} {teacher.last_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Teacher</p>
                      </div>
                    </div>
                    {teacher.subjects.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">Subjects</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {teacher.subjects.map((s: string, j: number) => (
                            <span key={j} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      {teacher.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-xs text-slate-600 truncate">{teacher.email}</p>
                        </div>
                      )}
                      {teacher.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-xs text-slate-600">{teacher.phone}</p>
                        </div>
                      )}
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
