import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Filter, X, RotateCcw, BookMarked } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

interface BookIssue {
  id: string;
  book_id: string;
  member_id: string;
  member_type: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  books?: { title: string };
  profiles?: { full_name: string };
}

interface BookOption {
  id: string;
  title: string;
  available_quantity: number;
}

interface ProfileOption {
  id: string;
  full_name: string;
  role: string;
}

const STATUS_COLORS: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-700',
  returned: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  lost: 'bg-orange-100 text-orange-700',
};

const MEMBER_TYPES = ['student', 'teacher', 'staff'];
const STATUSES = ['issued', 'returned', 'overdue', 'lost'];

export default function BookIssues() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [form, setForm] = useState({
    book_id: '',
    member_id: '',
    member_type: 'student',
    issue_date: '',
    due_date: '',
  });

  useEffect(() => {
    fetchBooks();
    fetchProfiles();
    fetchIssues();
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [filterStatus]);

  async function fetchBooks() {
    const { data } = await supabase
      .from('books')
      .select('id, title, available_quantity')
      .order('title');
    if (data) setBooks(data as BookOption[]);
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name');
    if (data) setProfiles(data as ProfileOption[]);
  }

  async function fetchIssues() {
    setLoading(true);
    let query = supabase
      .from('book_issues')
      .select('*, books(title), profiles!member_id(first_name, last_name), students!member_id(first_name, last_name)')
      .order('issue_date', { ascending: false });
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data } = await query;
    if (data) setIssues(data as BookIssue[]);
    setLoading(false);
  }

  function openAdd() {
    setEditId(null);
    setSaveError('');
    setMemberSearch('');
    setForm({
      book_id: '',
      member_id: '',
      member_type: 'student',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: '',
    });
    setModalOpen(true);
  }

  function openEdit(issue: BookIssue) {
    setEditId(issue.id);
    setSaveError('');
    setMemberSearch(issue.profiles?.full_name || '');
    setForm({
      book_id: issue.book_id || '',
      member_id: issue.member_id || '',
      member_type: issue.member_type || 'student',
      issue_date: issue.issue_date || '',
      due_date: issue.due_date || '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      book_id: form.book_id,
      member_id: form.member_id,
      member_type: form.member_type,
      issue_date: form.issue_date,
      due_date: form.due_date,
      status: 'issued',
    };
    let res;
    if (editId) {
      const { status, ...updatePayload } = payload;
      res = await supabase.from('book_issues').update(updatePayload).eq('id', editId);
    } else {
      res = await supabase.from('book_issues').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchIssues();
    fetchBooks();
  }

  async function handleReturn(id: string) {
    await supabase
      .from('book_issues')
      .update({ return_date: new Date().toISOString().split('T')[0], status: 'returned' })
      .eq('id', id);
    fetchIssues();
    fetchBooks();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this book issue record?')) return;
    await supabase.from('book_issues').delete().eq('id', id);
    fetchIssues();
  }

  const availableBooks = books.filter(b => b.available_quantity > 0);
  const filteredProfiles = memberSearch
    ? profiles.filter(p =>
        p.full_name?.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : profiles;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-app-primary text-white p-2 rounded-xl">
            <BookMarked size={20} />
          </div>
          <h1 className="text-2xl font-bold text-app-text">Book Issues</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-app-primary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Issue Book
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-app-text-muted" />
          <span className="text-sm font-medium text-app-text-muted">Filter by Status</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {filterStatus && (
            <button
              onClick={() => setFilterStatus('')}
              className="flex items-center gap-1 text-sm text-app-text-muted hover:text-app-text"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-app-text-muted">Loading...</div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center">
            <BookMarked size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-app-text-muted">No book issues found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-app-surface-alt border-b border-app-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Book</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Member</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Issue Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Due Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Return Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-app-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {issues.map(issue => (
                  <tr key={issue.id} className="hover:bg-app-surface-alt/50">
                    <td className="px-4 py-3 font-medium text-app-text">{issue.books?.title || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {(() => {
                        if (issue.member_type === 'student') {
                          const s = Array.isArray((issue as any).students) ? (issue as any).students[0] : (issue as any).students;
                          return s ? `${s.first_name} ${s.last_name}` : (issue.profiles?.full_name || '—');
                        }
                        return issue.profiles?.full_name || '—';
                      })()}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted capitalize">{issue.member_type}</td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {issue.issue_date ? new Date(issue.issue_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {issue.return_date ? new Date(issue.return_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[issue.status] || 'bg-slate-100 text-app-text'}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {issue.status === 'issued' && (
                          <button
                            onClick={() => handleReturn(issue.id)}
                            title="Mark as Returned"
                            className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(issue)}
                          className="text-app-text-muted hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(issue.id)}
                          className="text-app-text-muted hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Book Issue' : 'Issue Book'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Book</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.book_id}
              onChange={e => setForm(p => ({ ...p, book_id: e.target.value }))}
            >
              <option value="">Select Book</option>
              {(editId ? books : availableBooks).map(b => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.available_quantity} available)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Search Member</label>
            <input
              className={INPUT_CLASS}
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Type to search member..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Member</label>
            <select
              required
              className={INPUT_CLASS}
              value={form.member_id}
              onChange={e => setForm(p => ({ ...p, member_id: e.target.value }))}
            >
              <option value="">Select Member</option>
              {filteredProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Member Type</label>
            <select
              className={INPUT_CLASS}
              value={form.member_type}
              onChange={e => setForm(p => ({ ...p, member_type: e.target.value }))}
            >
              {MEMBER_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Issue Date</label>
              <input
                required
                type="date"
                className={INPUT_CLASS}
                value={form.issue_date}
                onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Due Date</label>
              <input
                required
                type="date"
                className={INPUT_CLASS}
                value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-app-border text-app-text-muted hover:bg-app-surface-alt"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-app-primary hover:opacity-90 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Issue Book'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
