import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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

interface Subject {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
}

interface Assignment {
  id: string;
  subject_id: string;
  teacher_id: string;
  class_id: string;
  academic_year_id: string;
  subjects: { name: string };
  profiles: { first_name: string; last_name: string };
  classes: { name: string; level: string; section: string };
}

interface FormData {
  subject_id: string;
  teacher_id: string;
  academic_year_id: string;
}

const initialForm: FormData = { subject_id: '', teacher_id: '', academic_year_id: '' };

export default function AssignSubject() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile?.school_id) loadReferenceData();
  }, [profile?.school_id]);

  async function loadReferenceData() {
    const [yearsRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
      supabase.from('academic_years').select('id, name, is_current').eq('school_id', profile!.school_id),
      supabase.from('classes').select('id, name, level, section').eq('school_id', profile!.school_id).order('name'),
      supabase.from('subjects').select('id, name').eq('school_id', profile!.school_id).order('name'),
      supabase.from('profiles').select('id, first_name, last_name').eq('school_id', profile!.school_id).in('role', ['teacher', 'head_teacher']).order('first_name'),
    ]);
    const years = yearsRes.data || [];
    setReferenceData(years, classesRes.data || [], subjectsRes.data || [], teachersRes.data || []);
  }

  function setReferenceData(years: any[], classes: any[], subjects: any[], teachers: any[]) {
    setClasses(classes);
    setSubjects(subjects);
    setTeachers(teachers);
    const current = years.find(y => y.is_current) || years[0];
    if (current) setActiveYear(current);
  }

  useEffect(() => {
    if (selectedClass && activeYear) fetchAssignments();
  }, [selectedClass, activeYear]);

  async function fetchAssignments() {
    if (!selectedClass || !activeYear) return;
    setLoading(true);
    const { data } = await supabase
      .from('subject_teacher_assignments')
      .select(`
        id,
        subject_id,
        teacher_id,
        class_id,
        academic_year_id,
        subjects ( name ),
        profiles ( first_name, last_name )
      `)
      .eq('class_id', selectedClass)
      .eq('academic_year_id', activeYear.id);
    setAssignments((data as unknown as Assignment[]) || []);
    setLoading(false);
  }

  function openAssign(subjectId?: string) {
    setEditingAssignment(null);
    setForm({
      subject_id: subjectId || '',
      teacher_id: '',
      academic_year_id: activeYear?.id || '',
    });
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(assignment: Assignment) {
    setEditingAssignment(assignment);
    setForm({
      subject_id: assignment.subject_id,
      teacher_id: assignment.teacher_id,
      academic_year_id: assignment.academic_year_id,
    });
    setSaveError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.subject_id || !form.teacher_id || !form.academic_year_id || !selectedClass) return;
    setSaving(true);
    const payload = {
      subject_id: form.subject_id,
      teacher_id: form.teacher_id,
      academic_year_id: form.academic_year_id,
      class_id: selectedClass,
      school_id: profile!.school_id,
    };

    let res;
    if (editingAssignment) {
      res = await supabase.from('subject_teacher_assignments')
        .update(payload)
        .eq('id', editingAssignment.id);
    } else {
      res = await supabase.from('subject_teacher_assignments').insert(payload);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchAssignments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this subject assignment?')) return;
    await supabase.from('subject_teacher_assignments').delete().eq('id', id);
    fetchAssignments();
  }

  function getClassName(cls: Class) {
    return cls.name || [cls.level, cls.section].filter(Boolean).join(' ');
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Assign Subjects</h1>
          <p className="text-sm text-app-text-muted mt-1">Assign subjects and teachers to classes</p>
        </div>
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border p-4 mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-app-text mb-1">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{getClassName(cls)}</option>
              ))}
            </select>
          </div>
          {activeYear && (
            <div className="px-4 py-2 bg-app-surface-alt border border-app-border rounded-xl">
              <span className="text-xs text-app-text-muted block">Active Year</span>
              <span className="text-sm font-medium text-app-text">{activeYear.name}</span>
            </div>
          )}
        </div>
      </div>

      {(selectedClass && activeYear) && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-app-text uppercase tracking-wider">Subject Assignments</h2>
          <button
            onClick={() => openAssign()}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Assign Subject
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 font-medium text-app-text-muted">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-app-text-muted" style={{ width: '40%' }}>Teacher</th>
                <th className="text-center px-4 py-3 font-medium text-app-text-muted">Status</th>
                <th className="text-right px-4 py-3 font-medium text-app-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!selectedClass ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-app-text-muted">
                    Select a class to view and manage subject assignments
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-app-text-muted">
                    No subjects defined for this school
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => {
                  const assignment = assignments.find(a => a.subject_id === subject.id);
                  return (
                    <tr key={subject.id} className="border-b border-app-border hover:bg-app-surface-alt">
                      <td className="px-4 py-3 font-medium text-app-text">{subject.name}</td>
                      <td className="px-4 py-3 text-app-text-muted">
                        {assignment?.profiles 
                          ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}` 
                          : <span className="text-app-text-muted italic font-normal">Not assigned</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {assignment ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Assigned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-app-surface-alt text-app-text-muted border border-app-border">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {assignment ? (
                            <>
                              <button
                                onClick={() => openEdit(assignment)}
                                className="p-1.5 text-app-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                title="Edit Assignment"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                              </button>
                              <button
                                onClick={() => handleDelete(assignment.id)}
                                className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                title="Remove Assignment"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openAssign(subject.id)}
                              className="text-[11px] font-bold uppercase text-emerald-600 hover:text-white px-2.5 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500 transition-all"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Subject"
      >
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Subject</label>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className="w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
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
