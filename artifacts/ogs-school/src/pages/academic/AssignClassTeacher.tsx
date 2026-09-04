import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface AcademicYear {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
  level: string;
  section: string;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
}

interface ClassTeacher {
  id: string;
  class_id: string;
  teacher_id: string;
  academic_year_id: string;
  classes: { name: string; level: string; section: string };
  profiles: { first_name: string; last_name: string };
  academic_years: { name: string } | null;
}

interface FormData {
  class_id: string;
  teacher_id: string;
  academic_year_id: string;
}

const initialForm: FormData = { class_id: '', teacher_id: '', academic_year_id: '' };

export default function AssignClassTeacher() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassTeacher | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile?.school_id) {
      loadReferenceData();
      fetchClassTeachers();
    }
  }, [profile?.school_id]);

  async function loadReferenceData() {
    const [yearsRes, classesRes, teachersRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_current').eq('school_id', profile!.school_id),
      supabase.from('classes').select('id, name, level, section').eq('school_id', profile!.school_id).order('name'),
      supabase.from('profiles').select('id, first_name, last_name').eq('school_id', profile!.school_id).in('role', ['teacher', 'head_teacher']).order('first_name'),
    ]);
    const years = yearsRes.data || [];
    setClasses(classesRes.data || []);
    setTeachers(teachersRes.data || []);
    const current = years.find(y => y.is_current) || years[0];
    if (current) setActiveYear(current);
  }

  async function fetchClassTeachers() {
    setLoading(true);
    const { data } = await supabase
      .from('class_teachers')
      .select(`
        id,
        class_id,
        teacher_id,
        academic_year_id,
        classes ( name, level, section ),
        profiles ( first_name, last_name ),
        academic_years ( name )
      `)
      .eq('school_id', profile!.school_id)
      .order('created_at', { ascending: false });
    setClassTeachers((data as unknown as ClassTeacher[]) || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...initialForm, academic_year_id: activeYear?.id || '' });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(ct: ClassTeacher) {
    setEditing(ct);
    setForm({
      class_id: ct.class_id,
      teacher_id: ct.teacher_id,
      academic_year_id: ct.academic_year_id,
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.class_id || !form.teacher_id || !form.academic_year_id) return;
    setSaving(true);
    const payload = {
      class_id: form.class_id,
      teacher_id: form.teacher_id,
      academic_year_id: form.academic_year_id,
    };
    if (editing) {
      const res = await supabase.from('class_teachers').update(payload).eq('id', editing.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('class_teachers').insert({ ...payload, school_id: profile!.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchClassTeachers();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this class teacher assignment?')) return;
    await supabase.from('class_teachers').delete().eq('id', id);
    fetchClassTeachers();
  }

  function getClassName(cls: { name: string; level: string; section: string }) {
    return cls.name || [cls.level, cls.section].filter(Boolean).join(' ');
  }

  function getClassDisplayName(classId: string) {
    const cls = classes.find((c) => c.id === classId);
    return cls ? getClassName(cls) : classId;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Assign Form Master / Mistress</h1>
          <p className="text-sm text-app-text-muted mt-1">Assign form masters and mistresses to classes for {activeYear?.name}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Assignment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Class</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Teacher</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-app-text-muted">No class teacher assignments found</td>
                </tr>
              ) : (
                classTeachers.map((ct) => (
                  <tr key={ct.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 font-medium text-app-text">
                      {ct.classes ? getClassName(ct.classes) : getClassDisplayName(ct.class_id)}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {ct.profiles ? `${ct.profiles.first_name} ${ct.profiles.last_name}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(ct)}
                          className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(ct.id)}
                          className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Form Master / Mistress' : 'Assign Form Master / Mistress'}
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Class</label>
            <select
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{getClassName(cls)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Teacher</label>
            <select
              value={form.teacher_id}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.first_name} {teacher.last_name}</option>
              ))}
            </select>
          </div>
          <div className="hidden">
            <label className="block text-sm font-medium text-app-text mb-1">Academic Year</label>
            <input type="hidden" value={form.academic_year_id} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text-muted hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
