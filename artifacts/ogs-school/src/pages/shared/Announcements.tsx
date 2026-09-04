import { useEffect, useState } from 'react';
import { Plus, Pin, Bell, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

const AUDIENCE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Students', value: 'student' },
  { label: 'Parents', value: 'parent' },
];

const audienceColors: Record<string, string> = {
  all: 'bg-emerald-100 text-emerald-700',
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-amber-100 text-amber-700',
  parent: 'bg-slate-100 text-app-text-muted',
};

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_roles: string[];
  is_pinned: boolean;
  publish_date: string | null;
  created_at: string;
  author_id: string;
  profiles?: { first_name: string; last_name: string } | null;
}

const emptyForm = {
  title: '',
  content: '',
  audience: 'all',
  publish_date: new Date().toISOString().split('T')[0],
  is_pinned: false,
};

const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];

export default function Announcements() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit modal
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = ADMIN_ROLES.includes(profile?.role ?? '');

  const canModify = (item: Announcement) =>
    ADMIN_ROLES.includes(profile?.role ?? '') || item.author_id === profile?.id;

  useEffect(() => { load(); }, [profile?.school_id]);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    let query = supabase
      .from('announcements')
      .select('*, profiles(first_name, last_name)')
      .eq('school_id', profile.school_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
      query = query.contains('target_roles', [profile?.role]);
    }

    const { data } = await query;
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  function openAdd() {
    setError('');
    setForm(emptyForm);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) { setError('Title and message are required.'); return; }
    setSaving(true);
    setError('');

    const targetRoles = form.audience === 'all'
      ? ['student', 'teacher', 'principal', 'parent', 'accountant']
      : [form.audience];

    const { error: err } = await supabase.from('announcements').insert({
      title: form.title.trim(),
      content: form.content.trim(),
      target_roles: targetRoles,
      is_pinned: form.is_pinned,
      publish_date: form.publish_date || null,
      school_id: profile?.school_id,
      author_id: profile?.id,
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setShowModal(false);
    setSaving(false);
    load();
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function openEdit(a: Announcement) {
    setEditError('');
    setEditForm({
      title: a.title,
      content: a.content,
      audience: getRoleLabel(a.target_roles ?? []),
      publish_date: a.publish_date ?? new Date().toISOString().split('T')[0],
      is_pinned: a.is_pinned,
    });
    setEditingItem(a);
  }

  async function handleUpdate() {
    if (!editForm.title.trim() || !editForm.content.trim()) { setEditError('Title and message are required.'); return; }
    if (!editingItem) return;
    setEditSaving(true);
    setEditError('');

    const targetRoles = editForm.audience === 'all'
      ? ['student', 'teacher', 'principal', 'parent', 'accountant']
      : [editForm.audience];

    const { error: err } = await supabase.from('announcements').update({
      title: editForm.title.trim(),
      content: editForm.content.trim(),
      target_roles: targetRoles,
      is_pinned: editForm.is_pinned,
      publish_date: editForm.publish_date || null,
    }).eq('id', editingItem.id);

    if (err) { setEditError(err.message); setEditSaving(false); return; }
    setEditingItem(null);
    setEditSaving(false);
    load();
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deletingItem) return;
    setDeleting(true);
    await supabase.from('announcements').delete().eq('id', deletingItem.id);
    setDeletingItem(null);
    setDeleting(false);
    load();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const getRoleLabel = (roles: string[]) => {
    if (!roles || roles.length === 0) return 'all';
    if (roles.length >= 4) return 'all';
    if (roles.includes('teacher') && roles.length === 1) return 'teacher';
    if (roles.includes('student') && roles.length === 1) return 'student';
    if (roles.includes('parent') && roles.length === 1) return 'parent';
    return 'all';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app-text">Announcements</h2>
          <p className="text-app-text-muted text-sm">School-wide news and updates</p>
        </div>
        {canCreate && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-app-text-muted">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-app-text-muted font-medium">No announcements yet</p>
          {canCreate && <p className="text-app-text-muted text-sm mt-1">Click "New Announcement" to create one</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const role = getRoleLabel(a.target_roles ?? []);
            const canEdit = canModify(a);
            return (
              <div
                key={a.id}
                className={`bg-app-surface rounded-2xl border shadow-sm p-5 transition-shadow hover:shadow-md ${a.is_pinned ? 'border-amber-200 bg-amber-50/30' : 'border-app-border'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {a.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      <h3 className="font-semibold text-app-text">{a.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${audienceColors[role] ?? 'bg-slate-100 text-app-text-muted'}`}>
                        {role === 'all' ? 'Everyone' : role}
                      </span>
                    </div>
                    <p className="text-app-text-muted text-sm leading-relaxed whitespace-pre-wrap">{a.content}</p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        title="Edit announcement"
                        className="p-1.5 text-app-text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingItem(a)}
                        title="Delete announcement"
                        className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-app-border text-xs text-app-text-muted">
                  <span>By {(a.profiles as any)?.first_name} {(a.profiles as any)?.last_name}</span>
                  {a.publish_date && <span>· Published {new Date(a.publish_date).toLocaleDateString()}</span>}
                  <span>· {new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Announcement" size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title <span className="text-red-500">*</span></label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className={INPUT}
              placeholder="Announcement title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Message <span className="text-red-500">*</span></label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              className={`${INPUT} resize-none`}
              rows={4}
              placeholder="Write your announcement message..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Target Audience</label>
              <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className={`${INPUT} bg-app-surface`}>
                {AUDIENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Publish Date</label>
              <input type="date" value={form.publish_date} onChange={e => setForm({ ...form, publish_date: e.target.value })} className={INPUT} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_pinned: !form.is_pinned })}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.is_pinned ? 'bg-amber-400' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-app-surface rounded-full shadow transition-transform ${form.is_pinned ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-app-text-muted">Pin to top</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.content.trim()}
              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Announcement" size="lg">
        <div className="space-y-4">
          {editError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{editError}</div>}

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Title <span className="text-red-500">*</span></label>
            <input
              value={editForm.title}
              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              className={INPUT}
              placeholder="Announcement title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Message <span className="text-red-500">*</span></label>
            <textarea
              value={editForm.content}
              onChange={e => setEditForm({ ...editForm, content: e.target.value })}
              className={`${INPUT} resize-none`}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Target Audience</label>
              <select value={editForm.audience} onChange={e => setEditForm({ ...editForm, audience: e.target.value })} className={`${INPUT} bg-app-surface`}>
                {AUDIENCE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Publish Date</label>
              <input type="date" value={editForm.publish_date} onChange={e => setEditForm({ ...editForm, publish_date: e.target.value })} className={INPUT} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, is_pinned: !editForm.is_pinned })}
              className={`relative w-10 h-5 rounded-full transition-colors ${editForm.is_pinned ? 'bg-amber-400' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-app-surface rounded-full shadow transition-transform ${editForm.is_pinned ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-app-text-muted">Pin to top</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditingItem(null)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={editSaving || !editForm.title.trim() || !editForm.content.trim()}
              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ──────────────────────────────────────────── */}
      <Modal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} title="Delete Announcement" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-app-text">Are you sure you want to delete this announcement?</p>
              {deletingItem && (
                <p className="text-sm text-app-text-muted mt-1 italic">"{deletingItem.title}"</p>
              )}
              <p className="text-sm text-app-text-muted mt-2">This action cannot be undone.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setDeletingItem(null)}
              className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
