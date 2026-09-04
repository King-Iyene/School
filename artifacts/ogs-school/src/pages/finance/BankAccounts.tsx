import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch: string;
  opening_balance: number;
}

const INPUT_CLASS =
  'bg-app-surface text-app-text border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full';

const EMPTY_FORM: Omit<BankAccount, 'id'> = {
  account_name: '',
  account_number: '',
  bank_name: '',
  branch: '',
  opening_balance: 0,
};

function maskAccountNumber(num: string): string {
  if (!num) return '';
  if (num.length <= 4) return num;
  return '****' + num.slice(-4);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

export default function BankAccounts() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<BankAccount, 'id'>>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchAccounts() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('account_name', { ascending: true });
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

  function openEdit(acc: BankAccount) {
    setForm({
      account_name: acc.account_name,
      account_number: acc.account_number,
      bank_name: acc.bank_name,
      branch: acc.branch,
      opening_balance: acc.opening_balance,
    });
    setEditId(acc.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(acc: BankAccount) {
    setDeleteTarget(acc);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.account_name.trim() || !form.account_number.trim() || !form.bank_name.trim()) {
      setError('Account name, account number, and bank name are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = { ...form, opening_balance: Number(form.opening_balance), school_id: profile?.school_id };
    if (editId) {
      const { error } = await supabase.from('bank_accounts').update(payload).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('bank_accounts').insert([payload]);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalOpen(false);
    fetchAccounts();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('bank_accounts').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchAccounts();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Bank Accounts</h1>
        <button
          onClick={openCreate}
          className="bg-app-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Bank Account
        </button>
      </div>

      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-app-text-muted text-sm">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-app-text-muted">
            <span className="text-4xl mb-3">🏦</span>
            <p className="text-sm">No bank accounts found. Add your first account.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt text-app-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Account Name</th>
                <th className="px-4 py-3 text-left font-medium">Bank Name</th>
                <th className="px-4 py-3 text-left font-medium">Account Number</th>
                <th className="px-4 py-3 text-left font-medium">Branch</th>
                <th className="px-4 py-3 text-left font-medium">Opening Balance</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{acc.account_name}</td>
                  <td className="px-4 py-3 text-app-text-muted">{acc.bank_name}</td>
                  <td className="px-4 py-3 font-mono text-app-text-muted">{maskAccountNumber(acc.account_number)}</td>
                  <td className="px-4 py-3 text-app-text-muted">{acc.branch}</td>
                  <td className="px-4 py-3 text-app-text font-medium">{formatCurrency(acc.opening_balance)}</td>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Bank Account' : 'Add Bank Account'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Account Name</label>
            <input
              className={INPUT_CLASS}
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              placeholder="e.g. School Main Account"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Bank Name</label>
              <input
                className={INPUT_CLASS}
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                placeholder="e.g. First Bank"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Account Number</label>
              <input
                className={INPUT_CLASS}
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                placeholder="e.g. 0123456789"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Branch</label>
              <input
                className={INPUT_CLASS}
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="e.g. Lagos Island"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-app-text-muted mb-1">Opening Balance (₦)</label>
              <input
                type="number"
                min="0"
                className={INPUT_CLASS}
                value={form.opening_balance}
                onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
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

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Bank Account">
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
