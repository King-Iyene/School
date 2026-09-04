import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, CreditCard as Edit2, Users, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import { navigate } from '../../components/hooks/useLocation';
import { cache } from '../../utils/cache';
import { schoolCodeFromName } from '../../lib/schoolCode';

interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  section: string;
  date_of_birth: string | null;
  gender: string;
  address: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  status: string;
  classes?: { name: string; level: string };
}

interface ClassOption { id: string; name: string; level: string; section: string; }

const GENDERS = ['male', 'female', 'other'];
const STATUSES = ['active', 'inactive', 'graduated', 'transferred'];
const DEFAULT_SECTIONS = ['A', 'B', 'C', 'D', 'E'];

const emptyForm = {
  admission_number: '', first_name: '', last_name: '', class_id: '',
  section: '', date_of_birth: '', gender: 'male', address: '',
  guardian_name: '', guardian_phone: '', guardian_email: '', status: 'active',
};

const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-amber-100 text-amber-700',
  graduated: 'bg-blue-100 text-blue-700',
  transferred: 'bg-slate-100 text-app-text-muted',
};

export default function StudentsPage() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => { loadInitialData(); }, [profile]);
  useEffect(() => { loadStudents(); }, [profile, currentPage, search, filterStatus, filterClass]);

  async function loadInitialData() {
    if (!profile?.school_id) return;
    const cData = await cache.fetch(`classes_meta_${profile.school_id}`, async () => {
      const { data } = await supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id).order('level').order('section');
      return data || [];
    }, 86400000);
    setClasses(cData);
  }

  async function loadStudents() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      const cacheKey = `students_admin_p${currentPage}_s${pageSize}_f${filterClass}_st${filterStatus}_q${search}_${profile.school_id}`;
      const result = await cache.fetch(cacheKey, async () => {
        let query = supabase
          .from('students')
          .select('*, classes(name, level)', { count: 'exact' })
          .eq('school_id', profile.school_id)
          .order('created_at', { ascending: false });

        if (filterClass) query = query.eq('class_id', filterClass);
        if (filterStatus) query = query.eq('status', filterStatus);
        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,admission_number.ilike.%${search}%,guardian_name.ilike.%${search}%`);
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error: sError } = await query.range(from, to);
        if (sError) throw sError;
        return { data: data || [], count: count || 0 };
      }, 3600000);

      setStudents(result.data);
      setTotalCount(result.count);
    } catch (err: any) {
      setError(`Fetch Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function ensureClassesLoaded() {
    if (classes.length > 0 || !profile?.school_id) return;
    const { data } = await supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id).order('level').order('section');
    setClasses(data ?? []);
  }

  async function generateAdmissionNumber(): Promise<string> {
    if (!profile?.school_id) return '';
    const year = new Date().getFullYear();
    const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id);
    const next = String((count ?? 0) + 1).padStart(3, '0');
    return `${schoolCodeFromName(settings.school_name)}-${year}-${next}`;
  }

  function openAdd() {
    setEditItem(null);
    setError('');
    setFormLevel('');
    setForm(emptyForm);
    setShowModal(true);
    ensureClassesLoaded();
    generateAdmissionNumber().then(admNum => setForm(f => ({ ...f, admission_number: admNum })));
  }

  function openEdit(s: Student) {
    setEditItem(s);
    setError('');
    const existingClass = classes.find(c => c.id === s.class_id);
    setFormLevel(existingClass?.level ?? '');
    setForm({
      admission_number: s.admission_number,
      first_name: s.first_name,
      last_name: s.last_name,
      class_id: s.class_id ?? '',
      section: s.section ?? '',
      date_of_birth: s.date_of_birth ?? '',
      gender: s.gender ?? 'male',
      address: s.address ?? '',
      guardian_name: s.guardian_name ?? '',
      guardian_phone: s.guardian_phone ?? '',
      guardian_email: s.guardian_email ?? '',
      status: s.status ?? 'active',
    });
    setShowModal(true);
    ensureClassesLoaded();
  }

  async function handleSave() {
    if (!profile?.school_id || !form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    setError('');
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      admission_number: form.admission_number.trim(),
      class_id: form.class_id || null,
      section: form.section,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender,
      address: form.address,
      guardian_name: form.guardian_name,
      guardian_phone: form.guardian_phone,
      guardian_email: form.guardian_email,
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    try {
      let studentId = editItem?.id;
      if (editItem) {
        const { error: upError } = await supabase.rpc('update_student', { 
          p_id: editItem.id, 
          p_payload: payload 
        });
        if (upError) throw upError;
      } else {
        const { data: insData, error: insError } = await supabase.from('students').insert({ ...payload, school_id: profile.school_id }).select('id').single();
        if (insError) throw insError;
        studentId = insData.id;
      }

      if (studentId && form.class_id) {
        const { data: yearData } = await supabase.from('academic_years').select('id').eq('school_id', profile?.school_id ?? '').eq('is_current', true).maybeSingle();
        if (yearData) {
          const { data: termData } = await supabase.from('academic_year_terms').select('term_id').eq('academic_year_id', yearData.id).eq('is_current', true).maybeSingle();
          const termId = (termData as any)?.term_id ?? null;
          const { data: existingEnroll } = await supabase
            .from('student_enrollments')
            .select('id')
            .eq('student_id', studentId)
            .eq('academic_year_id', yearData.id)
            .eq('status', 'active')
            .maybeSingle();
          if (existingEnroll) {
            await supabase.from('student_enrollments')
              .update({ class_id: form.class_id, term_id: termId })
              .eq('id', existingEnroll.id);
          } else {
            await supabase.from('student_enrollments').insert({
              student_id: studentId,
              class_id: form.class_id,
              academic_year_id: yearData.id,
              term_id: termId,
              status: 'active',
              enrollment_date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      setShowModal(false);
      cache.invalidate('students_');
      await loadStudents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this student? This cannot be undone.')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profileExists } = await supabase.from('profiles').select('id').eq('id', id).maybeSingle();
      if (profileExists && session?.access_token) {
        await supabase.functions.invoke('create-user', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: { action: 'delete', userId: id },
        });
      } else {
        await supabase.from('students').delete().eq('id', id);
      }
      cache.invalidate('students_');
      await loadStudents();
    } catch (err: any) {
      alert('Error deleting student: ' + err.message);
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Students</h2>
          <p className="text-app-text-muted text-sm">Manage student records and enrollment</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search by name, admission number..." className="w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        </div>
        <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setCurrentPage(1); }} className="border border-app-border rounded-xl px-3 py-2 text-sm bg-app-surface focus:outline-none">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="border border-app-border rounded-xl px-3 py-2 text-sm bg-app-surface focus:outline-none">
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-app-border bg-app-surface-alt">
                {['SL', 'Admission No.', 'Full Name', 'Class', 'Section', 'Gender', 'Guardian Name', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-app-text-muted">Loading...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-app-text-muted text-sm">{totalCount === 0 ? 'No students yet. Click Add Student to begin.' : 'No students match the filter.'}</p>
                </td></tr>
              ) : students.map((s, idx) => (
                <tr key={s.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 text-sm text-app-text-muted">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono text-app-text">{s.admission_number}</td>
                  <td className="px-4 py-3 text-sm font-medium text-app-text">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-3 text-sm text-app-text-muted">{s.classes ? `${s.classes.level}` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-app-text-muted">{s.section || '—'}</td>
                  <td className="px-4 py-3 text-sm text-app-text-muted capitalize">{s.gender || '—'}</td>
                  <td className="px-4 py-3 text-sm text-app-text-muted">{s.guardian_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-app-text-muted">{s.guardian_phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] ?? 'bg-slate-100 text-app-text-muted'}`}>
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => navigate(`/student-profile?id=${s.id}`)} className="p-1.5 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View Profile"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(s)} className="p-1.5 text-app-text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-app-border flex items-center justify-between">
          <div className="text-sm text-app-text-muted">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} students
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-app-border rounded-xl text-sm font-medium text-app-text-muted hover:bg-app-surface-alt disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <div className="text-sm font-medium text-app-text-muted px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-app-border rounded-xl text-sm font-medium text-app-text-muted hover:bg-app-surface-alt disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Student' : 'Add Student'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">First Name <span className="text-red-500">*</span></label>
              <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={inputCls} placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Last Name <span className="text-red-500">*</span></label>
              <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={inputCls} placeholder="Last name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Admission Number</label>
              <input value={form.admission_number} onChange={e => setForm({ ...form, admission_number: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Class</label>
              <select
                value={formLevel}
                onChange={e => {
                  const level = e.target.value;
                  setFormLevel(level);
                  setForm(f => ({ ...f, class_id: '', section: '' }));
                }}
                className={`${inputCls} bg-app-surface`}
              >
                <option value="">Select class</option>
                {[...new Set(classes.map(c => c.level))].map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Section</label>
              <select
                value={form.section}
                onChange={e => {
                  const section = e.target.value;
                  const matched = classes.find(c => c.level === formLevel && c.section === section);
                  setForm(f => ({ ...f, section, class_id: matched?.id ?? '' }));
                }}
                className={`${inputCls} bg-app-surface`}
                disabled={!formLevel}
              >
                <option value="">Select section</option>
                {(classes.filter(c => c.level === formLevel).map(c => c.section).length > 0
                  ? classes.filter(c => c.level === formLevel).map(c => c.section)
                  : DEFAULT_SECTIONS
                ).map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Gender</label>
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className={`${inputCls} bg-app-surface`}>
                {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${inputCls} bg-app-surface`}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Home address" />
          </div>
          <div className="pt-1 border-t border-app-border">
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wide mb-3">Guardian Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Guardian Name</label>
                <input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} className={inputCls} placeholder="Parent / guardian full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-1">Guardian Phone</label>
                <input value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} className={inputCls} placeholder="Phone number" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-app-text mb-1">Guardian Email</label>
              <input type="email" value={form.guardian_email} onChange={e => setForm({ ...form, guardian_email: e.target.value })} className={inputCls} placeholder="guardian@email.com" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.first_name.trim() || !form.last_name.trim()} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editItem ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
