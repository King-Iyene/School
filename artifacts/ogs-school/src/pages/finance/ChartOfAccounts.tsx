import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  account_type: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
  description: string;
}

const INPUT_CLASS =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

const TYPE_BADGE: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-orange-100 text-orange-700',
  equity: 'bg-purple-100 text-purple-700',
};

const EMPTY_FORM: Omit<Account, 'id'> = {
  account_name: '',
  account_code: '',
  account_type: 'asset',
  description: '',
};

export default function ChartOfAccounts() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<Account, 'id'>>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchAccounts() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("school_id", profile.school_id)
      .order("account_code", { ascending: true });
    if (!error && data) setAccounts(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchAccounts();
  }, [profile?.school_id]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(acc: Account) {
    setForm({
      account_name: acc.account_name,
      account_code: acc.account_code,
      account_type: acc.account_type,
      description: acc.description,
    });
    setEditId(acc.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(acc: Account) {
    setDeleteTarget(acc);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.account_name.trim() || !form.account_code.trim()) {
      setError('Account name and code are required.');
      return;
    }
    setSaving(true);
    setError('');
    if (editId) {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update(form)
        .eq("id", editId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("chart_of_accounts")
        .insert([{ ...form, school_id: profile?.school_id }]);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setModalOpen(false);
    fetchAccounts();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('chart_of_accounts').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchAccounts();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Chart of Accounts</h1>
        <button
          onClick={openCreate}
          className="bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Account
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <span className="text-4xl mb-3">📒</span>
            <p className="text-sm">No accounts found. Add your first account.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Account Name</th>
                <th className="px-4 py-3 text-left font-medium">Account Code</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{acc.account_name}</td>
                  <td className="px-4 py-3 text-app-text-muted">{acc.account_code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_BADGE[acc.account_type]}`}>
                      {acc.account_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{acc.description}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(acc)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(acc)}
                      className="text-red-500 hover:text-red-600 font-medium text-xs px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Account' : 'Add Account'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Account Name</label>
            <input
              className={INPUT_CLASS}
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              placeholder="e.g. Cash"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Account Code</label>
            <input
              className={INPUT_CLASS}
              value={form.account_code}
              onChange={(e) => setForm({ ...form, account_code: e.target.value })}
              placeholder="e.g. 1001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Account Type</label>
            <select
              className={INPUT_CLASS}
              value={form.account_type}
              onChange={(e) => setForm({ ...form, account_type: e.target.value as Account['account_type'] })}
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="equity">Equity</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Description</label>
            <textarea
              className={INPUT_CLASS}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-app-primary hover:opacity-90 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Account">
        <div className="space-y-4">
          <p className="text-sm text-app-text-muted">
            Are you sure you want to delete <span className="font-semibold text-app-text">{deleteTarget?.account_name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2.5 text-sm text-app-text-muted hover:text-app-text font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
