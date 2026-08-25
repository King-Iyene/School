import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Download, FolderOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

interface OtherDownload {
  id: string;
  title: string;
  description: string;
  file_url: string;
  available_for: string;
  created_at: string;
}

const AVAILABLE_FOR_OPTIONS = ['all', 'teachers', 'students', 'parents'];

const availableForBadge: Record<string, string> = {
  all: 'bg-emerald-100 text-emerald-700',
  teachers: 'bg-blue-100 text-blue-700',
  students: 'bg-purple-100 text-purple-700',
  parents: 'bg-yellow-100 text-yellow-700',
};

export default function OtherDownloads() {
  const { profile } = useAuth();
  const [downloads, setDownloads] = useState<OtherDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    file_url: '',
    available_for: 'all',
  });

  useEffect(() => {
    fetchDownloads();
  }, []);

  async function fetchDownloads() {
    setLoading(true);
    const { data } = await supabase
      .from('other_downloads')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDownloads(data as OtherDownload[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setForm({ title: '', description: '', file_url: '', available_for: 'all' });
    setModalOpen(true);
  }

  function openEdit(item: OtherDownload) {
    setEditId(item.id);
    setSaveError('');
    setForm({
      title: item.title || '',
      description: item.description || '',
      file_url: item.file_url || '',
      available_for: item.available_for || 'all',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    let res;
    if (editId) {
      res = await supabase.from('other_downloads').update(form).eq('id', editId);
    } else {
      res = await supabase.from('other_downloads').insert([{
        ...form,
        school_id: profile?.school_id,
        uploaded_by: profile?.id,
      }]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchDownloads();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this download?')) return;
    await supabase.from('other_downloads').delete().eq('id', id);
    fetchDownloads();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-emerald-500 text-white p-1.5 sm:p-2 rounded-xl shrink-0">
            <FolderOpen size={18} />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 truncate">Other Downloads</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Download</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : downloads.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No downloads available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Available For</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">File</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Created</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {downloads.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${availableForBadge[d.available_for] || 'bg-slate-100 text-slate-700'}`}>
                        {d.available_for}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.file_url ? (
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                        >
                          <Download size={13} /> Download
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(d)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Download' : 'Add Download'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              required
              className={INPUT_CLASS}
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Download title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File URL</label>
            <input
              className={INPUT_CLASS}
              value={form.file_url}
              onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Available For</label>
            <select
              className={INPUT_CLASS}
              value={form.available_for}
              onChange={e => setForm(p => ({ ...p, available_for: e.target.value }))}
            >
              {AVAILABLE_FOR_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
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
