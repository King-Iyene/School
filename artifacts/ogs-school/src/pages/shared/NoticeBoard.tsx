import { useEffect, useState } from 'react';
import { Plus, Megaphone, Pencil, Trash2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

const TARGET_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Students', value: 'students' },
  { label: 'Parents', value: 'parents' },
];

const roleColors: Record<string, string> = {
  all: 'bg-emerald-100 text-emerald-700',
  teachers: 'bg-blue-100 text-blue-700',
  students: 'bg-amber-100 text-amber-700',
  parents: 'bg-slate-100 text-slate-600',
};

interface NoticeItem {
  id: string;
  title: string;
  description: string;
  notice_date: string;
  target_roles: string[];
  is_published: boolean;
  created_at: string;
}

const emptyForm = {
  title: '',
  message: '',
  target_role: 'all',
};

export default function NoticeBoard() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile?.role === 'super_admin' || profile?.role === 'principal';

  useEffect(() => { load(); }, [profile?.school_id]);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    let query = supabase
      .from('notice_board_items')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('notice_date', { ascending: false });

    if (!canManage) {
      const roleMap: Record<string, string> = {
        student: 'students',
        teacher: 'teachers',
        parent: 'parents'
      };
      const target = roleMap[profile?.role ?? ''] || profile?.role;
      query = query.contains('target_roles', [target]);
    }

    const { data } = await query;
    setNotices((data ?? []) as NoticeItem[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setError('');
    setForm({ ...emptyForm, target_role: 'all' });
    setShowModal(true);
  }

  function openEdit(n: NoticeItem) {
    setEditId(n.id);
    setError('');
    const role = Array.isArray(n.target_roles) && n.target_roles.length === 1 ? n.target_roles[0] : 'all';
    setForm({ title: n.title ?? '', message: n.description ?? '', target_role: role });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.message.trim()) { setError('Title and message are required.'); return; }
    setSaving(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      description: form.message.trim(),
      notice_date: new Date().toISOString().split('T')[0],
      target_roles: form.target_role === 'all' ? ['all', 'teachers', 'students', 'parents'] : [form.target_role],
      is_published: true,
      school_id: profile?.school_id,
    };

    const { error: err } = editId
      ? await supabase.from('notice_board_items').update(payload).eq('id', editId)
      : await supabase.from('notice_board_items').insert(payload);

    if (err) { setError(err.message); setSaving(false); return; }
    setShowModal(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice?')) return;
    await supabase.from('notice_board_items').delete().eq('id', id);
    load();
  }

  const getRole = (roles: string[]) => {
    if (!roles || roles.length === 0 || roles.length >= 4) return 'all';
    return roles[0] ?? 'all';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Notice Board</h2>
            <p className="text-slate-500 text-sm">Post and manage school notices</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Notice
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No notices yet</p>
          <p className="text-slate-400 text-sm mt-1">Click "Add Notice" to post one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notices.map(n => {
            const role = getRole(n.target_roles ?? []);
            return (
              <div key={n.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {canManage && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${roleColors[role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {role === 'all' ? 'Everyone' : role}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      {n.notice_date ? new Date(n.notice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-0.5 -mt-1.5 -mr-1.5">
                      <button onClick={() => openEdit(n)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(n.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 leading-tight">{n.title}</h3>
                  {n.description && (
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {n.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Notice' : 'Add Notice'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className={INPUT}
              placeholder="Notice title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message <span className="text-red-500">*</span></label>
            <textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              className={`${INPUT} resize-none`}
              rows={5}
              placeholder="Write the notice content here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target Role</label>
            <select
              value={form.target_role}
              onChange={e => setForm({ ...form, target_role: e.target.value })}
              className={`${INPUT} bg-white`}
            >
              {TARGET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.message.trim()}
              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Post Notice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
