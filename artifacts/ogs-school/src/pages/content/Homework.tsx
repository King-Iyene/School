import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Filter, X, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface HomeworkRecord {
  id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string;
  homework_date: string;
  submission_date: string;
  marks: number;
  attachment_url: string;
  classes?: { name: string };
  subjects?: { name: string };
}

interface ClassOption {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

export default function Homework() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<HomeworkRecord[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState({
    class_id: '',
    subject_id: '',
    title: '',
    description: '',
    homework_date: '',
    submission_date: '',
    marks: '',
    attachment_url: '',
  });

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
    fetchRecords();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [filterClass]);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    if (data) setClasses(data);
  }

  async function fetchSubjects(classId?: string) {
    if (classId) {
      const { data } = await supabase
        .from('class_subjects')
        .select('subjects(id, name)')
        .eq('class_id', classId);
      setSubjects(((data ?? []).map((d: any) => d.subjects).filter(Boolean)) as SubjectOption[]);
    } else {
      const { data } = await supabase.from('subjects').select('id, name').order('name');
      if (data) setSubjects(data);
    }
  }

  async function fetchRecords() {
    setLoading(true);
    let query = supabase
      .from('homework_records')
      .select('*, classes(name), subjects(name)')
      .order('homework_date', { ascending: false });
    if (filterClass) query = query.eq('class_id', filterClass);
    const { data } = await query;
    if (data) setRecords(data as HomeworkRecord[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setForm({
      class_id: '',
      subject_id: '',
      title: '',
      description: '',
      homework_date: '',
      submission_date: '',
      marks: '',
      attachment_url: '',
    });
    setModalOpen(true);
  }

  function openEdit(item: HomeworkRecord) {
    setEditId(item.id);
    setSaveError('');
    setForm({
      class_id: item.class_id || '',
      subject_id: item.subject_id || '',
      title: item.title || '',
      description: item.description || '',
      homework_date: item.homework_date || '',
      submission_date: item.submission_date || '',
      marks: item.marks != null ? String(item.marks) : '',
      attachment_url: item.attachment_url || '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      class_id: form.class_id || null,
      subject_id: form.subject_id || null,
      title: form.title,
      description: form.description,
      homework_date: form.homework_date || null,
      submission_date: form.submission_date || null,
      marks: form.marks !== '' ? Number(form.marks) : null,
      attachment_url: form.attachment_url,
      school_id: profile?.school_id,
      teacher_id: profile?.id,
    };
    let res;
    if (editId) {
      res = await supabase.from('homework_records').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('homework_records').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchRecords();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this homework record?')) return;
    await supabase.from('homework_records').delete().eq('id', id);
    fetchRecords();
  }

  const formSubjects = subjects;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-emerald-500 text-white p-1.5 sm:p-2 rounded-xl shrink-0">
            <ClipboardList size={18} />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 truncate">Homework</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Homework</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filterClass && (
            <button
              onClick={() => setFilterClass('')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No homework records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Class</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Subject</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Homework Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Submission Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Marks</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.title}</td>
                    <td className="px-4 py-3 text-slate-600">{r.classes?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.subjects?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.homework_date ? new Date(r.homework_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.submission_date ? new Date(r.submission_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.marks ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Homework' : 'Add Homework'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                className={INPUT_CLASS}
                value={form.class_id}
                onChange={e => { setForm(p => ({ ...p, class_id: e.target.value, subject_id: '' })); fetchSubjects(e.target.value || undefined); }}
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <select
                className={INPUT_CLASS}
                value={form.subject_id}
                onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))}
              >
                <option value="">Select Subject</option>
                {formSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Homework title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Homework description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Homework Date</label>
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.homework_date}
                onChange={e => setForm(p => ({ ...p, homework_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Submission Date</label>
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.submission_date}
                onChange={e => setForm(p => ({ ...p, submission_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marks</label>
              <input
                type="number"
                min="0"
                className={INPUT_CLASS}
                value={form.marks}
                onChange={e => setForm(p => ({ ...p, marks: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Attachment URL</label>
              <input
                className={INPUT_CLASS}
                value={form.attachment_url}
                onChange={e => setForm(p => ({ ...p, attachment_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
