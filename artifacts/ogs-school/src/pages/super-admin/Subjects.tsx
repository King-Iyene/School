import { useEffect, useState } from 'react';
import { Plus, CreditCard as Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Subject } from '../../lib/types';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function Subjects() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: '', code: '', category: 'core' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { loadSubjects(); }, [profile]);

  async function loadSubjects() {
    if (!profile?.school_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('category').order('name');
      setSubjects(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditSubject(null);
    setForm({ name: '', code: '', category: 'core' });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(s: Subject) {
    setEditSubject(s);
    setForm({ name: s.name ?? '', code: s.code ?? '', category: s.category ?? 'core' });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    // Proactive duplicate check
    const isDuplicate = subjects.some(s => 
      s.id !== editSubject?.id && 
      (s.name.toLowerCase() === form.name.toLowerCase() || 
       (form.code && s.code?.toLowerCase() === form.code.toLowerCase()))
    );

    if (isDuplicate) {
      setSaveError('A subject with this name or code already exists.');
      return;
    }

    setSaving(true);
    const data = { name: form.name, code: form.code, category: form.category, school_id: profile?.school_id };
    let res;
    if (editSubject) {
      res = await supabase.from('subjects').update(data).eq('id', editSubject.id);
    } else {
      res = await supabase.from('subjects').insert(data);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setShowModal(false);
    loadSubjects();
    setSaving(false);
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject? This cannot be undone.')) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) { alert('Failed to delete subject: ' + error.message); return; }
    loadSubjects();
  }

  const catColor: Record<string, any> = { core: 'info', elective: 'warning', vocational: 'success' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Subject Management</h2>
          <p className="text-slate-500 text-sm">Manage all subjects offered in the school</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20">
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Subject Name</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Code</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Category</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : subjects.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">No subjects found</td></tr>
            ) : subjects.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{s.name}</td>
                <td className="px-5 py-3 text-sm text-slate-500 font-mono">{s.code || '—'}</td>
                <td className="px-5 py-3"><Badge label={s.category} variant={catColor[s.category]} /></td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSubject(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editSubject ? 'Edit Subject' : 'Add Subject'} size="sm">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code</label>
            <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="e.g. MATH" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
              <option value="core">Core</option>
              <option value="elective">Elective</option>
              <option value="vocational">Vocational</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : editSubject ? 'Update' : 'Add Subject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
