import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, UserCheck, Users, CreditCard as Edit2, Search, Calendar, MapPin, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';

function getClubIdFromUrl() {
  const params = getSearchParams();
  return { id: params.get('id') ?? '', year: params.get('year') ?? '' };
}

const MEMBER_ROLES = [
  { value: 'president',            label: 'President' },
  { value: 'vice_president',       label: 'Vice President' },
  { value: 'secretary',            label: 'Secretary' },
  { value: 'assistant_secretary',  label: 'Asst. Secretary' },
  { value: 'treasurer',            label: 'Treasurer' },
  { value: 'pro',                  label: 'P.R.O' },
  { value: 'welfare_officer',      label: 'Welfare Officer' },
  { value: 'member',               label: 'Member' },
];

const ROLE_COLORS: Record<string, string> = {
  president:           'bg-amber-100 text-amber-800',
  vice_president:      'bg-orange-100 text-orange-700',
  secretary:           'bg-blue-100 text-blue-700',
  assistant_secretary: 'bg-cyan-100 text-cyan-700',
  treasurer:           'bg-emerald-100 text-emerald-700',
  pro:                 'bg-rose-100 text-rose-700',
  welfare_officer:     'bg-violet-100 text-violet-700',
  member:              'bg-slate-100 text-slate-600',
};

const TEACHER_ROLES = ['patron', 'co-patron', 'advisor'];

interface ClubMember {
  id: string;
  student_id: string;
  role: string;
  joined_at: string | null;
  is_active: boolean;
  student_name?: string;
  student_class?: string;
  avatar_url?: string | null;
}

interface ClubTeacher {
  id: string;
  profile_id: string;
  role: string;
  teacher_name?: string;
  avatar_url?: string | null;
}

interface Club {
  id: string;
  name: string;
  description: string | null;
  category: string;
  meeting_day: string | null;
  meeting_time: string | null;
  meeting_venue: string | null;
  is_active: boolean;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number?: string | null;
  avatar_url?: string | null;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  staff_id?: string;
}

const TABS = [
  { key: 'members',  label: 'Members & Executives', icon: Users },
  { key: 'teachers', label: 'Patrons / Advisors',   icon: UserCheck },
];

export default function ClubDetail() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'teacher';
  const isAdmin = role === 'super_admin' || role === 'principal';
  const canManage = role === 'super_admin' || role === 'principal' || role === 'teacher';
  const { id: clubId, year: initialYear } = getClubIdFromUrl();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [teachers, setTeachers] = useState<ClubTeacher[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [tab, setTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const tabLoaded = useRef<Record<string, boolean>>({});

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [teacherResults, setTeacherResults] = useState<Teacher[]>([]);
  const [addMemberRole, setAddMemberRole] = useState('member');
  const [addTeacherRole, setAddTeacherRole] = useState('patron');
  const [addMemberDate, setAddMemberDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [editRole, setEditRole] = useState('member');

  useEffect(() => {
    if (!clubId) { navigate('/clubs'); return; }
    loadInitialData();
  }, [clubId]);

  useEffect(() => {
    if (selectedYear) {
      loadMembers();
    }
  }, [selectedYear]);

  async function loadInitialData() {
    const [{ data: yData }, { data: cData }] = await Promise.all([
      supabase.from('academic_years').select('*').order('start_date', { ascending: false }),
      supabase.from('clubs').select('*').eq('id', clubId).maybeSingle()
    ]);
    setYears(yData ?? []);
    if (!selectedYear) {
      setSelectedYear(yData?.find(y => y.is_current)?.id ?? yData?.[0]?.id ?? '');
    }
    setClub(cData);
    setLoading(false);
  }


  async function loadMembers() {
    if (!selectedYear) return;
    const [{ data: mData }, { data: tData }] = await Promise.all([
      supabase.from('club_members').select('*').eq('club_id', clubId).eq('academic_year_id', selectedYear).order('role').order('joined_at'),
      supabase.from('club_teachers').select('*').eq('club_id', clubId),
    ]);

    if (mData) {
      const enriched = await Promise.all(mData.map(async (m) => {
        const { data: s } = await supabase.from('students').select('first_name, last_name').eq('id', m.student_id).maybeSingle();
        if (s) return { ...m, student_name: `${s.first_name} ${s.last_name}`, avatar_url: null };
        const { data: p } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', m.student_id).maybeSingle();
        return { ...m, student_name: p ? `${p.first_name} ${p.last_name}` : 'Unknown Student', avatar_url: p?.avatar_url ?? null };
      }));
      setMembers(enriched);
    }

    if (tData) {
      const enriched = await Promise.all(tData.map(async (t) => {
        const { data: p } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', t.profile_id).maybeSingle();
        return { ...t, teacher_name: p ? `${p.first_name} ${p.last_name}` : 'Unknown', avatar_url: p?.avatar_url };
      }));
      setTeachers(enriched);
    }
    tabLoaded.current['members'] = true;
    tabLoaded.current['teachers'] = true;
  }

  async function searchStudents(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_number.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(15);
    const existing = new Set(members.map(m => m.student_id));
    setSearchResults((data ?? []).filter(s => !existing.has(s.id)).map(s => ({ ...s, avatar_url: null })));
  }

  async function searchTeachers(q: string) {
    if (!q.trim()) { setTeacherResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, staff_id')
      .in('role', ['teacher', 'head_teacher'])
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(10);
    const existing = new Set(teachers.map(t => t.profile_id));
    setTeacherResults((data ?? []).filter(t => !existing.has(t.id)));
  }

  async function addMember(student: Student) {
    await supabase.from('club_members').insert({
      club_id: clubId,
      student_id: student.id,
      academic_year_id: selectedYear,
      role: addMemberRole,
      joined_at: addMemberDate,
      is_active: true,
    });
    setShowAddMember(false);
    setStudentSearch('');
    setSearchResults([]);
    loadMembers();
  }

  async function addTeacher(teacher: Teacher) {
    await supabase.from('club_teachers').insert({
      club_id: clubId,
      profile_id: teacher.id,
      role: addTeacherRole,
    });
    setShowAddTeacher(false);
    setTeacherSearch('');
    setTeacherResults([]);
    loadMembers();
  }

  async function removeMember(id: string) {
    await supabase.from('club_members').delete().eq('id', id);
    loadMembers();
  }

  async function removeTeacher(id: string) {
    await supabase.from('club_teachers').delete().eq('id', id);
    loadMembers();
  }

  async function saveEditRole() {
    if (!editingMember) return;
    await supabase.from('club_members').update({ role: editRole }).eq('id', editingMember.id);
    setEditingMember(null);
    loadMembers();
  }

  const executives = members.filter(m => m.role !== 'member' && m.is_active);
  const regularMembers = members.filter(m => m.role === 'member' && m.is_active);
  const inactive = members.filter(m => !m.is_active);

  function Initials({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
    if (avatarUrl) return <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />;
    const parts = (name ?? '??').split(' ');
    const ini = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    return <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">{ini}</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading club...</div>;
  }

  if (!club) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">Club not found.</p>
        <button onClick={() => navigate('/clubs')} className="text-emerald-600 hover:underline">Back to Clubs</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/clubs')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{club.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${club.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {club.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {club.description && <p className="text-slate-500 text-sm mt-1">{club.description}</p>}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
            {club.meeting_day && (
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{club.meeting_day}{club.meeting_time ? ` · ${club.meeting_time}` : ''}</span>
            )}
            {club.meeting_venue && (
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{club.meeting_venue}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48 text-left">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-700">{members.filter(m => m.is_active).length}</div>
            <div className="text-xs text-slate-400">members</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-6">
          {/* Executives */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Student Executives
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{executives.length}</span>
              </h2>
              {canManage && (
                <button onClick={() => { setAddMemberRole('president'); setShowAddMember(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-medium">
                  <Plus className="w-3.5 h-3.5" /> Add Executive
                </button>
              )}
            </div>
            {executives.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-xl">No executives assigned yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {executives.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
                    <Initials name={m.student_name} avatarUrl={m.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.student_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {MEMBER_ROLES.find(r => r.value === m.role)?.label ?? m.role}
                      </span>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingMember(m); setEditRole(m.role); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeMember(m.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Regular Members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Members
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{regularMembers.length}</span>
              </h2>
              {canManage && (
                <button onClick={() => { setAddMemberRole('member'); setShowAddMember(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-medium">
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
              )}
            </div>
            {regularMembers.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-xl">No members yet.</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Joined</th>
                      {canManage && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {regularMembers.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Initials name={m.student_name} avatarUrl={m.avatar_url} />
                            <span className="font-medium text-slate-700">{m.student_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-GB') : '—'}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => { setEditingMember(m); setEditRole(m.role); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeMember(m.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {inactive.length > 0 && (
            <details className="text-sm text-slate-400">
              <summary className="cursor-pointer hover:text-slate-600 py-2">Past members ({inactive.length})</summary>
              <div className="mt-2 space-y-1 pl-4">
                {inactive.map(m => (
                  <span key={m.id} className="block">{m.student_name} — <span className="italic">{MEMBER_ROLES.find(r => r.value === m.role)?.label}</span></span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Teachers Tab */}
      {tab === 'teachers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Patrons & Advisors</h2>
            {isAdmin && (
              <button onClick={() => setShowAddTeacher(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> Assign Teacher
              </button>
            )}
          </div>
          {teachers.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center bg-slate-50 rounded-xl">No patrons assigned yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teachers.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl">
                  <Initials name={t.teacher_name} avatarUrl={t.avatar_url} />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{t.teacher_name}</p>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium capitalize">{t.role}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => removeTeacher(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Add Club Member</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={addMemberRole}
                    onChange={e => setAddMemberRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Joined Date</label>
                  <input type="date" value={addMemberDate} onChange={e => setAddMemberDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type student name..."
                    value={studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map(s => (
                      <button key={s.id} onClick={() => addMember(s)} className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-center gap-2.5 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm text-slate-700">{s.first_name} {s.last_name}</p>
                          {s.admission_number && <p className="text-xs text-slate-400">{s.admission_number}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {studentSearch && searchResults.length === 0 && (
                  <p className="text-sm text-slate-400 mt-2 text-center py-3 bg-slate-50 rounded-lg">No students found.</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => { setShowAddMember(false); setStudentSearch(''); setSearchResults([]); }} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Teacher Modal */}
      {showAddTeacher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Assign Patron / Advisor</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={addTeacherRole}
                  onChange={e => setAddTeacherRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {TEACHER_ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1).replace('-', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Search Teacher</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type teacher name..."
                    value={teacherSearch}
                    onChange={e => { setTeacherSearch(e.target.value); searchTeachers(e.target.value); }}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {teacherResults.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {teacherResults.map(t => (
                      <button key={t.id} onClick={() => addTeacher(t)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {t.first_name[0]}{t.last_name[0]}
                        </div>
                        <span className="text-sm text-slate-700">{t.first_name} {t.last_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => { setShowAddTeacher(false); setTeacherSearch(''); setTeacherResults([]); }} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Change Role</h2>
            <p className="text-sm text-slate-500 mb-4">{editingMember.student_name}</p>
            <select
              value={editRole}
              onChange={e => setEditRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
            >
              {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setEditingMember(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm">Cancel</button>
              <button onClick={saveEditRole} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
