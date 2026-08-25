import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface Account {
  id: string;
  account_name: string;
  account_type: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface IncomeRecord {
  id: string;
  source_name: string;
  account_id: string;
  payment_method_id: string;
  income_date: string;
  amount: number;
  reference_no: string;
  description: string;
  chart_of_accounts?: { account_name: string };
  payment_methods_list?: { name: string };
}

const INPUT_CLASS =
  'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

const EMPTY_FORM = {
  source_name: '',
  account_id: '',
  payment_method_id: '',
  income_date: '',
  amount: 0,
  reference_no: '',
  description: '',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

export default function Income() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchSource, setSearchSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function fetchLookups() {
    const [{ data: accts }, { data: pms }] = await Promise.all([
      supabase.from('chart_of_accounts').select('id, account_name, account_type').eq('school_id', profile?.school_id).order('account_name'),
      supabase.from('payment_methods_list').select('id, name').eq('school_id', profile?.school_id).eq('is_active', true).order('name'),
    ]);
    if (accts) setAccounts(accts);
    if (pms) setPaymentMethods(pms);
  }

  async function fetchRecords() {
    if (!profile?.school_id) return;
    setLoading(true);
    let query = supabase
      .from("income_records")
      .select("*, chart_of_accounts(account_name), payment_methods_list(name)")
      .eq("school_id", profile.school_id)
      .order("income_date", { ascending: false });
    if (searchSource) query = query.ilike("source_name", `%${searchSource}%`);
    if (dateFrom) query = query.gte("income_date", dateFrom);
    if (dateTo) query = query.lte("income_date", dateTo);
    const { data, error } = await query;
    if (!error && data) setRecords(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [searchSource, dateFrom, dateTo, profile?.school_id]);

  function generateRefNo() {
    const year = new Date().getFullYear();
    const rand = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
    return `INC-${year}-${rand}`;
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, reference_no: generateRefNo() });
    setEditId(null);
    setError('');
    setModalOpen(true);
  }

  function openEdit(rec: IncomeRecord) {
    setForm({
      source_name: rec.source_name,
      account_id: rec.account_id,
      payment_method_id: rec.payment_method_id,
      income_date: rec.income_date,
      amount: rec.amount,
      reference_no: rec.reference_no,
      description: rec.description,
    });
    setEditId(rec.id);
    setError('');
    setModalOpen(true);
  }

  function openDelete(rec: IncomeRecord) {
    setDeleteTarget(rec);
    setDeleteModalOpen(true);
  }

  async function handleSave() {
    if (!form.source_name.trim() || !form.income_date || !form.amount) {
      setError('Source name, date, and amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      amount: Number(form.amount),
      school_id: profile?.school_id,
    };
    if (editId) {
      const { error } = await supabase
        .from("income_records")
        .update(payload)
        .eq("id", editId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("income_records").insert([payload]);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setModalOpen(false);
    fetchRecords();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await supabase.from('income_records').delete().eq('id', deleteTarget.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleteTarget(null);
    fetchRecords();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Income</h1>
        <button
          onClick={openCreate}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          + Add Income
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search by Source</label>
            <input
              className={INPUT_CLASS}
              value={searchSource}
              onChange={(e) => setSearchSource(e.target.value)}
              placeholder="Search source name..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date From</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date To</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">💰</span>
            <p className="text-sm">No income records found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Account</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Payment Method</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{rec.source_name}</td>
                  <td className="px-4 py-3 text-slate-600">{rec.chart_of_accounts?.account_name}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{formatCurrency(rec.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{rec.payment_methods_list?.name}</td>
                  <td className="px-4 py-3 text-slate-500">{rec.income_date}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{rec.reference_no}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(rec)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDelete(rec)}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Income' : 'Add Income'}>
        <div className="space-y-4">
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Source Name</label>
            <input
              className={INPUT_CLASS}
              value={form.source_name}
              onChange={(e) => setForm({ ...form, source_name: e.target.value })}
              placeholder="e.g. School Fees"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Account (Income)</label>
              <select
                className={INPUT_CLASS}
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
              <select
                className={INPUT_CLASS}
                value={form.payment_method_id}
                onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
              >
                <option value="">Select method</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Income Date</label>
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.income_date}
                onChange={(e) => setForm({ ...form, income_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₦)</label>
              <input
                type="number"
                min="0"
                className={INPUT_CLASS}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reference No</label>
            <input
              className={INPUT_CLASS}
              value={form.reference_no}
              onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
              placeholder="e.g. TXN-001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
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
              className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Income Record">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteTarget?.source_name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-100 transition-colors"
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
