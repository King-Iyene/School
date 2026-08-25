import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, BookOpen, GraduationCap, Award, User, Printer, Clock, CreditCard as Edit2, Save, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import StaffIDCardPrint from '../../components/print/StaffIDCardPrint';
import PhotoUpload from '../../components/common/PhotoUpload';
import Modal from '../../components/common/Modal';
import HRTab from './tabs/HRTab';
import QualificationsTab from './tabs/QualificationsTab';
import CommitteesTab from './tabs/CommitteesTab';
import { getSearchParams, navigate } from '../../components/hooks/useLocation';

function getIdFromUrl() {
  return getSearchParams().get('id') ?? '';
}

const TABS = [
  { key: 'overview',        label: 'Overview',           icon: User },
  { key: 'hr',              label: 'HR & Payroll',        icon: Award },
  { key: 'qualifications',  label: 'Qualifications',      icon: GraduationCap },
  { key: 'committees',      label: 'Committees',          icon: Shield },
  { key: 'classes',         label: 'Classes & Schedule',  icon: BookOpen },
  { key: 'attendance',      label: 'Attendance',          icon: Calendar },
  { key: 'leaves',          label: 'Leave Records',       icon: Clock },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administration',
  admin: 'Admin',
  principal: 'Principal',
  teacher: 'Teacher',
  accountant: 'Accountant',
  staff: 'Staff',
};

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export default function TeacherProfileView() {
  const teacherId = getIdFromUrl();
  const { profile: viewer } = useAuth();
  const isAdmin = viewer?.role === 'super_admin' || viewer?.role === 'admin' || viewer?.role === 'principal';

  const [teacher, setTeacher] = useState<any>(null);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [formMasterClasses, setFormMasterClasses] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showIDCard, setShowIDCard] = useState(false);
  const [academicYearName, setAcademicYearName] = useState('');
  const [editBasic, setEditBasic] = useState(false);
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicForm, setBasicForm] = useState({ first_name: '', last_name: '', email: '', phone: '', address: '', gender: '', date_of_birth: '', staff_id: '' });

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveDeleteModalOpen, setLeaveDeleteModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<any>(null);
  const [deletingLeave, setDeletingLeave] = useState<any>(null);
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: '', from_date: '', to_date: '', reason: '' });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tabLoaded = useRef<Record<string, boolean>>({});

  useEffect(() => { if (teacherId) loadCore(); }, [teacherId]);

  async function loadCore() {
    setLoading(true);
    const { data: t } = await supabase.from('profiles').select('*').eq('id', teacherId).maybeSingle();
    setTeacher(t);
    if (t) {
      setBasicForm({
        first_name: t.first_name ?? '', last_name: t.last_name ?? '',
        email: t.email ?? '', phone: t.phone ?? '', address: t.address ?? '',
        gender: t.gender ?? '', date_of_birth: t.date_of_birth ?? '',
        staff_id: t.staff_id ?? '',
      });

      // Also load current academic year to get classes/subjects for the header
      const { data: yearData } = await supabase.from('academic_years')
        .select('id, name')
        .eq('school_id', t.school_id ?? '')
        .eq('is_current', true)
        .maybeSingle();
      const yearId = yearData?.id;
      setAcademicYearName(yearData?.name ?? '');

      if (yearId) {
        const [csRes, ctRes, clsRes] = await Promise.all([
          supabase.from('subject_teacher_assignments')
            .select('*, classes(id,name), subjects(id,name,code)')
            .eq('teacher_id', teacherId)
            .eq('academic_year_id', yearId),
          supabase.from('class_teachers')
            .select('*, classes(id,name)')
            .eq('teacher_id', teacherId)
            .eq('academic_year_id', yearId),
          supabase.from('classes')
            .select('id, name')
            .eq('class_teacher_id', teacherId)
        ]);
        setClassSubjects(csRes.data ?? []);
        
        const fmFromTable = (ctRes.data ?? []).map((d: any) => d.classes);
        const fmFromClasses = clsRes.data ?? [];
        const combined = [...fmFromTable, ...fmFromClasses].filter(Boolean);
        const uniqueFm = [...new Map(combined.map((c: any) => [c.id, c])).values()];
        setFormMasterClasses(uniqueFm);
      }
    }
    setLoading(false);
  }

  async function loadTab(t: string) {
    if (tabLoaded.current[t]) return;
    tabLoaded.current[t] = true;

    if (t === 'classes') {
      // Fetch academic year for routines
      const { data: yearData } = await supabase.from('academic_years')
        .select('id')
        .eq('school_id', teacher?.school_id ?? viewer?.school_id ?? '')
        .eq('is_current', true)
        .maybeSingle();
      
      const query = supabase.from('class_routines')
        .select('*, classes(name), subjects(name), school_week_days(name, sort_order)')
        .eq('teacher_id', teacherId);
      
      if (yearData?.id) {
        query.eq('academic_year_id', yearData.id);
      }

      const { data } = await query;
      
      const sortedData = (data ?? []).sort((a: any, b: any) => {
        const dayA = a.school_week_days?.sort_order || 0;
        const dayB = b.school_week_days?.sort_order || 0;
        if (dayA !== dayB) return dayA - dayB;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      setTimetable(sortedData);
    }
    if (t === 'attendance') {
      const { data } = await supabase.from('staff_attendance_records').select('*').eq('staff_id', teacherId).order('date', { ascending: false }).limit(90);
      setAttendance(data ?? []);
    }
    if (t === 'leaves') {
      const [leavesRes, typesRes] = await Promise.all([
        supabase.from('leave_applications').select('*, leave_types(name)').eq('staff_id', teacherId).order('created_at', { ascending: false }),
        supabase.from('leave_types').select('id, name').order('name'),
      ]);
      setLeaves(leavesRes.data ?? []);
      setLeaveTypes(typesRes.data ?? []);
    }
  }

  async function saveBasic() {
    setSavingBasic(true);
    const { data, error } = await supabase.rpc('update_profile', {
      p_id: teacherId,
      p_payload: { ...basicForm, updated_at: new Date().toISOString() }
    }).select().maybeSingle();
    setSavingBasic(false);
    if (!error && data) { setTeacher(data); setEditBasic(false); }
  }

  async function handlePhotoUpload(url: string) {
    await supabase.rpc('update_profile', {
      p_id: teacherId,
      p_payload: { avatar_url: url, updated_at: new Date().toISOString() }
    });
    setTeacher((prev: any) => ({ ...prev, avatar_url: url }));
  }

  async function handleDeleteStaff() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { data: profileExists } = await supabase.from('profiles').select('id').eq('id', teacherId).maybeSingle();
        if (profileExists) {
          await supabase.functions.invoke('create-user', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: { action: 'delete', userId: teacherId },
          });
        }
      }
      navigate('/hr/staff-list');
    } catch (err: any) {
      alert('Error deleting staff member: ' + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  function handleTabChange(newTab: string) {
    setTab(newTab);
    loadTab(newTab);
  }

  const openEditLeave = (l: any) => {
    setEditingLeave(l);
    setLeaveForm({
      leave_type_id: l.leave_type_id,
      from_date: l.from_date,
      to_date: l.to_date,
      reason: l.reason || '',
    });
    setLeaveError('');
    setLeaveModalOpen(true);
  };

  const openDeleteLeave = (l: any) => {
    setDeletingLeave(l);
    setLeaveDeleteModalOpen(true);
  };

  const leaveDays = calcDays(leaveForm.from_date, leaveForm.to_date);

  async function saveLeave() {
    if (!leaveForm.from_date || !leaveForm.to_date || leaveDays <= 0) {
      setLeaveError('Please provide valid dates.');
      return;
    }
    setSavingLeave(true);
    setLeaveError('');
    const { error } = await supabase.from('leave_applications').update({
      leave_type_id: leaveForm.leave_type_id,
      from_date: leaveForm.from_date,
      to_date: leaveForm.to_date,
      days: leaveDays,
      reason: leaveForm.reason,
      status: 'pending', // Reset to pending if edited? Usually yes.
    }).eq('id', editingLeave.id);
    setSavingLeave(false);
    if (!error) {
      setLeaveModalOpen(false);
      tabLoaded.current['leaves'] = false;
      loadTab('leaves');
    } else {
      setLeaveError(error.message);
    }
  }

  async function confirmDeleteLeave() {
    const { error } = await supabase.from('leave_applications').delete().eq('id', deletingLeave.id);
    if (error) {
      alert(`Error deleting leave: ${error.message}`);
    } else {
      setLeaveDeleteModalOpen(false);
      tabLoaded.current['leaves'] = false;
      loadTab('leaves');
    }
  }

  function calcDays(from: string, to: string): number {
    if (!from || !to) return 0;
    const d1 = new Date(from);
    const d2 = new Date(to);
    if (d2 < d1) return 0;
    return Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!teacher) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="font-medium">Staff member not found</p>
        <button onClick={() => window.history.back()} className="mt-3 text-sm text-emerald-600 hover:underline">Go back</button>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[teacher.role] ?? teacher.role;
  const attPresent = attendance.filter(a => a.status === 'present').length;
  const attPct = attendance.length > 0 ? Math.round((attPresent / attendance.length) * 100) : 0;
  const uniqueClasses = Array.from(new Map([...classSubjects.map(cs => [(cs.classes as any)?.id, cs.classes]), ...formMasterClasses.map(c => [c.id, c])].filter(([id]) => Boolean(id)) as any).values());
  const uniqueSubjects = Array.from(new Map(classSubjects.map(cs => [(cs.subjects as any)?.id, cs.subjects])).values()).filter(Boolean);
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  return (
    <div className="space-y-5">
      {showIDCard && (
        <StaffIDCardPrint
          staff={[{ id: teacher.id, first_name: teacher.first_name, last_name: teacher.last_name, email: teacher.email, role: teacher.role, phone: teacher.phone, avatar_url: teacher.avatar_url }]}
          academicYear={academicYearName || "Current Year"}
          onClose={() => setShowIDCard(false)}
        />
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Staff Profile</h2>
          <p className="text-slate-500 text-sm">{roleLabel}</p>
        </div>
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900" />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-12 mb-4 flex-wrap gap-3">
            <div className="flex items-end gap-4">
              <PhotoUpload
                currentUrl={teacher.avatar_url}
                name={`${teacher.first_name} ${teacher.last_name}`}
                folder={`staff/${teacher.id}`}
                onUploaded={handlePhotoUpload}
                size="lg"
              />
              <div className="pb-1">
                <h3 className="text-xl font-bold text-slate-800">{teacher.first_name} {teacher.last_name}</h3>
                <p className="text-sm text-slate-500">{teacher.email}</p>
                {teacher.staff_id && <p className="text-xs text-slate-400 font-mono">{teacher.staff_id}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              {formMasterClasses.map(c => (
                <span key={c.id} className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> Form Master — {c.name}
                </span>
              ))}
              <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full capitalize">{roleLabel}</span>
              {teacher.department && <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">{teacher.department}</span>}
              {isAdmin && (
                <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors">
                  <Trash2 className="w-3 h-3" /> Delete Staff
                </button>
              )}
              <button onClick={() => setShowIDCard(true)} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors">
                <Printer className="w-3 h-3" /> Print ID Card
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Classes', value: uniqueClasses.length, icon: GraduationCap, color: 'bg-blue-50 text-blue-600' },
              { label: 'Subjects', value: uniqueSubjects.length, icon: BookOpen, color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Attendance', value: `${attPct}%`, icon: Calendar, color: 'bg-amber-50 text-amber-600' },
              { label: 'Leave Days', value: leaves.filter(l => l.status === 'approved').reduce((s, l) => s + (l.total_days ?? 1), 0), icon: Clock, color: 'bg-rose-50 text-rose-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}><stat.icon className="w-4 h-4" /></div>
                <div><p className="text-xs text-slate-500">{stat.label}</p><p className="text-lg font-bold text-slate-800">{stat.value}</p></div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm"><User className="w-4 h-4 text-slate-500" />Personal Information</h4>
              {isAdmin && !editBasic && <button onClick={() => setEditBasic(true)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"><Edit2 className="w-3 h-3" />Edit</button>}
            </div>
            {editBasic ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1">First Name</label><input value={basicForm.first_name} onChange={e => setBasicForm({ ...basicForm, first_name: e.target.value })} className={inputCls} /></div>
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1">Last Name</label><input value={basicForm.last_name} onChange={e => setBasicForm({ ...basicForm, last_name: e.target.value })} className={inputCls} /></div>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Email</label><input type="email" value={basicForm.email} onChange={e => setBasicForm({ ...basicForm, email: e.target.value })} className={inputCls} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label><input value={basicForm.phone} onChange={e => setBasicForm({ ...basicForm, phone: e.target.value })} className={inputCls} /></div>
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1">Staff ID</label><input value={basicForm.staff_id} onChange={e => setBasicForm({ ...basicForm, staff_id: e.target.value })} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1">Gender</label>
                    <select value={basicForm.gender} onChange={e => setBasicForm({ ...basicForm, gender: e.target.value })} className={`${inputCls} bg-white`}>
                      <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-semibold text-slate-500 mb-1">Date of Birth</label><input type="date" value={basicForm.date_of_birth} onChange={e => setBasicForm({ ...basicForm, date_of_birth: e.target.value })} className={inputCls} /></div>
                </div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Address</label><input value={basicForm.address} onChange={e => setBasicForm({ ...basicForm, address: e.target.value })} className={inputCls} /></div>
                <div className="flex gap-2">
                  <button onClick={() => setEditBasic(false)} className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2 text-sm hover:bg-slate-50">Cancel</button>
                  <button onClick={saveBasic} disabled={savingBasic} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" />{savingBasic ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-2.5">
                {[
                  { label: 'Full Name', value: `${teacher.first_name} ${teacher.last_name}` },
                  { label: 'Staff ID', value: teacher.staff_id || '—' },
                  { label: 'Gender', value: teacher.gender || '—' },
                  { label: 'Date of Birth', value: teacher.date_of_birth ? new Date(teacher.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                  { label: 'Role', value: roleLabel },
                  { label: 'Department', value: teacher.department || '—' },
                  { label: 'Join Date', value: teacher.join_date ? new Date(teacher.join_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                ].map(item => (
                  <div key={item.label} className="flex gap-3">
                    <dt className="text-xs text-slate-500 w-28 flex-shrink-0">{item.label}</dt>
                    <dd className="text-sm font-semibold text-slate-800 capitalize">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-slate-500" />Contact Details</h4>
            <dl className="space-y-3">
              {[
                { label: 'Email', value: teacher.email, icon: Mail },
                { label: 'Phone', value: teacher.phone || '—', icon: Phone },
                { label: 'Address', value: teacher.address || '—', icon: MapPin },
              ].map(item => (
                <div key={item.label} className="flex gap-3 items-start">
                  <item.icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs text-slate-400">{item.label}</p><p className="text-sm font-medium text-slate-800">{item.value}</p></div>
                </div>
              ))}
            </dl>
            {teacher.bio && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Bio</p>
                <p className="text-sm text-slate-600 leading-relaxed">{teacher.bio}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'hr' && teacher.school_id && (
        <HRTab profileId={teacherId} schoolId={teacher.school_id} profile={teacher} onProfileUpdate={p => setTeacher(p)} />
      )}

      {tab === 'qualifications' && teacher.school_id && (
        <QualificationsTab profileId={teacherId} schoolId={teacher.school_id} />
      )}

      {tab === 'committees' && teacher.school_id && (
        <CommitteesTab profileId={teacherId} schoolId={teacher.school_id} />
      )}

      {tab === 'classes' && (
        <div className="space-y-4">
          {formMasterClasses.length > 0 && (
            <div className="space-y-2">
              {formMasterClasses.map((cls: any) => (
                <div key={cls.id} className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-800">Form Master</p>
                    <p className="text-sm text-blue-700">{cls.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm"><BookOpen className="w-4 h-4 text-emerald-600" />Assigned Classes & Subjects</h4></div>
            {classSubjects.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No subjects assigned</div> : (
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-100">{['Class','Subject','Code'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {classSubjects.map(cs => (
                    <tr key={cs.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{(cs.classes as any)?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{(cs.subjects as any)?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{(cs.subjects as any)?.code ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {timetable.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-emerald-600" />Class Schedule / Timetable</h4></div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">{['Day','Time','Class','Subject'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {timetable.map(tt => (
                      <tr key={tt.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-700">
                          {Array.isArray(tt.school_week_days) ? tt.school_week_days[0]?.name : tt.school_week_days?.name || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{tt.start_time?.slice(0,5)} – {tt.end_time?.slice(0,5)}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{(tt.classes as any)?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{(tt.subjects as any)?.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-sm">Attendance Record</h4>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${attPct >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{attPct}% overall</span>
          </div>
          {attendance.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No attendance records found</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-100">{['Date','Status','Note'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {attendance.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-600">{new Date(a.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${a.status === 'present' ? 'bg-emerald-100 text-emerald-700' : a.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500">{a.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
          <div className="p-4 border-b border-slate-100"><h4 className="font-bold text-slate-800 text-sm">Leave History</h4></div>
          {leaves.length === 0 ? <div className="text-center py-8 text-slate-400">No leave records found</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-100">{['Type','From','To','Days','Status','Reason','Actions'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">{(l.leave_types as any)?.name ?? l.leave_type ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{l.from_date || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{l.to_date || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-center">{l.days ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{l.status ?? 'pending'}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{l.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                        {(l.status === 'pending' && (teacherId === viewer?.id || isAdmin)) && (
                          <button onClick={() => openEditLeave(l)} className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(teacherId === viewer?.id || isAdmin) && (
                          <button onClick={() => openDeleteLeave(l)} className="text-red-500 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="Edit Leave Application">
        <div className="space-y-4">
          {leaveError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">{leaveError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Leave Type</label>
            <select
              className={inputCls}
              value={leaveForm.leave_type_id}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type_id: e.target.value })}
            >
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">From Date</label>
              <input type="date" className={inputCls} value={leaveForm.from_date} onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">To Date</label>
              <input type="date" className={inputCls} value={leaveForm.to_date} onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })} />
            </div>
          </div>
          {leaveForm.from_date && leaveForm.to_date && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm text-emerald-700">
              Total days: <span className="font-semibold">{leaveDays}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
            <textarea className={inputCls} rows={3} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setLeaveModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
            <button onClick={saveLeave} disabled={savingLeave} className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl disabled:opacity-60">{savingLeave ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={leaveDeleteModalOpen} onClose={() => setLeaveDeleteModalOpen(false)} title="Delete Application">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Are you sure you want to delete this leave application? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setLeaveDeleteModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
            <button onClick={confirmDeleteLeave} className="px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">Delete</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Staff Member">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">This action is permanent</p>
              <p className="text-sm text-red-600 mt-0.5">
                Deleting <span className="font-semibold">{teacher?.first_name} {teacher?.last_name}</span> will remove their account, profile, and all associated login access. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleDeleteStaff} disabled={deleting} className="px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-60">
              {deleting ? 'Deleting...' : 'Delete Staff Member'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
