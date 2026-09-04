import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Class, Profile, AcademicYear } from '../../lib/types';
import Modal from '../../components/common/Modal';

const LEVELS = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

const levelColors: Record<string, string> = {
  JSS1: 'bg-blue-100 text-blue-700',
  JSS2: 'bg-sky-100 text-sky-700',
  JSS3: 'bg-cyan-100 text-cyan-700',
  SS1: 'bg-emerald-100 text-emerald-700',
  SS2: 'bg-teal-100 text-teal-700',
  SS3: 'bg-green-100 text-green-700',
};

export default function Classes() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClass, setEditClass] = useState<Class | null>(null);
  const [form, setForm] = useState({ name: '', level: 'JSS1', section: 'A', class_teacher_id: '', capacity: '40', academic_year_id: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});
  const [filterLevel, setFilterLevel] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, [profile]);

  async function loadData() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      const [classRes, teacherRes, yearRes] = await Promise.all([
        supabase.from('classes').select('*, profiles!classes_class_teacher_id_fkey(first_name, last_name)').eq('school_id', profile.school_id).order('level').order('section'),
        supabase.from('profiles').select('id, first_name, last_name').eq('role', 'teacher').eq('school_id', profile.school_id),
        supabase.from('academic_years').select('*').eq('school_id', profile.school_id).order('start_date', { ascending: false }),
      ]);
      const cls = classRes.data ?? [];
      setClasses(cls);
      setTeachers(teacherRes.data ?? []);
      setYears(yearRes.data ?? []);

      const counts: Record<string, number> = {};
      await Promise.all(
        cls.map(async (c) => {
          const { count } = await supabase.from('student_enrollments').select('id', { count: 'exact', head: true }).eq('class_id', c.id).eq('status', 'active');
          counts[c.id] = count ?? 0;
        })
      );
      setEnrollmentCounts(counts);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditClass(null);
    setForm({ name: '', level: 'JSS1', section: 'A', class_teacher_id: '', capacity: '40', academic_year_id: years.find(y => y.is_current)?.id ?? '' });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(c: Class) {
    setEditClass(c);
    setForm({ name: c.name, level: c.level, section: c.section, class_teacher_id: c.class_teacher_id ?? '', capacity: String(c.capacity), academic_year_id: c.academic_year_id ?? '' });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);
    setSaveError('');
    const payload = {
      name: form.name || `${form.level}${form.section}`,
      level: form.level,
      section: form.section,
      class_teacher_id: form.class_teacher_id || null,
      capacity: parseInt(form.capacity) || 40,
      academic_year_id: form.academic_year_id || null,
      school_id: profile.school_id,
    };
    let res;
    if (editClass) {
      res = await supabase.from('classes').update(payload).eq('id', editClass.id);
    } else {
      res = await supabase.from('classes').insert(payload);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setShowModal(false);
    await loadData();
    setSaving(false);
  }

  async function deleteClass(id: string) {
    if (!confirm('Delete this class? This cannot be undone.')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) { alert('Error deleting class: ' + error.message); return; }
    await loadData();
  }

  const filtered = classes.filter(c => {
    const matchLevel = !filterLevel || c.level === filterLevel;
    const matchSearch = !search || `${c.name} ${c.level} ${c.section}`.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 bg-app-surface';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Class Management</h2>
          <p className="text-app-text-muted text-sm">Manage school classes and assign class teachers</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search classes..."
          className="bg-app-surface text-app-text flex-1 min-w-[160px] border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
        />
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-app-surface">
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-app-border bg-app-surface-alt">
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">SL</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Class Name</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Level</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Section</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Form Master</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Students</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Capacity</th>
              <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-app-text-muted">Loading classes...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-app-text-muted">{classes.length === 0 ? 'No classes created yet' : 'No classes match the filter'}</td></tr>
            ) : filtered.map((c, idx) => {
              const enrollment = enrollmentCounts[c.id] ?? 0;
              const fillPct = Math.min(100, (enrollment / (c.capacity || 1)) * 100);
              const teacher = c.profiles as any;
              return (
                <tr key={c.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-5 py-3.5 text-sm text-app-text-muted">{idx + 1}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-app-text">{c.name || `${c.level}${c.section}`}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[c.level] ?? 'bg-slate-100 text-app-text-muted'}`}>
                      {c.level}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-app-text-muted">{c.section || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-app-text-muted">
                    {teacher ? `${teacher.first_name} ${teacher.last_name}` : <span className="text-app-text-muted italic">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-app-text">
                        <Users className="w-3.5 h-3.5 text-app-text-muted" />
                        {enrollment}
                      </div>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fillPct >= 90 ? 'bg-red-400' : fillPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-app-text-muted">{c.capacity}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 text-app-text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteClass(c.id)} title="Delete" className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-app-border text-sm text-app-text-muted">
          {filtered.length} of {classes.length} {classes.length === 1 ? 'class' : 'classes'}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editClass ? 'Edit Class' : 'Add New Class'}>
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Level</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className={inputCls}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Section</label>
              <select value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className={inputCls}>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Class Name <span className="text-app-text-muted font-normal">(optional — defaults to level + section)</span></label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={`${form.level}${form.section}`} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Form Master</label>
            <select value={form.class_teacher_id} onChange={e => setForm({ ...form, class_teacher_id: e.target.value })} className={inputCls}>
              <option value="">Select teacher</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Capacity</label>
              <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className={inputCls} min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Academic Year</label>
              <select value={form.academic_year_id} onChange={e => setForm({ ...form, academic_year_id: e.target.value })} className={inputCls}>
                <option value="">Select year</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' (Current)' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : editClass ? 'Update Class' : 'Create Class'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
