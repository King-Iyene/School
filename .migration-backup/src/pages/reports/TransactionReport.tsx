import { useState, useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Scale, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Transaction {
  id: string;
  date: string;
  reference: string;
  description: string;
  type: 'fees' | 'income' | 'expense';
  amount: number;
  payment_method: string;
  created_by: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

export default function TransactionReport() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    type: '',
    payment_method_id: '',
  });

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  async function fetchPaymentMethods() {
    const { data } = await supabase
      .from('payment_methods_list')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setPaymentMethods(data);
  }

  async function fetchTransactions() {
    setLoading(true);
    try {
      const results: Transaction[] = [];

      if (!filters.type || filters.type === 'fees') {
        let q = supabase
          .from('fees_collections')
          .select('id, payment_date, receipt_no, amount_paid, payment_method, profiles:collected_by(first_name, last_name)')
          .eq('school_id', profile?.school_id)
          .order('payment_date', { ascending: false });
        if (filters.date_from) q = q.gte('payment_date', filters.date_from);
        if (filters.date_to) q = q.lte('payment_date', filters.date_to);
        const { data } = await q;
        (data || []).forEach((d: any) => {
          results.push({
            id: d.id,
            date: d.payment_date,
            reference: d.receipt_no || '-',
            description: 'Fee Payment',
            type: 'fees',
            amount: Number(d.amount_paid),
            payment_method: d.payment_method || '-',
            created_by: d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : '-',
          });
        });
      }

      if (!filters.type || filters.type === 'income') {
        let q = supabase
          .from('income_records')
          .select('id, date:income_date, reference_number:reference_no, title:source_name, amount, payment_method_id, created_by')
          .eq('school_id', profile?.school_id)
          .order('income_date', { ascending: false });
        if (filters.date_from) q = q.gte('income_date', filters.date_from);
        if (filters.date_to) q = q.lte('income_date', filters.date_to);
        const { data } = await q;
        (data || []).forEach((d: any) => {
          results.push({
            id: d.id,
            date: d.date,
            reference: d.reference_number || '-',
            description: d.title || 'Income',
            type: 'income',
            amount: Number(d.amount),
            payment_method: '-', // Could fetch name if doing a join
            created_by: '-',
          });
        });

        let qStore = supabase
          .from('store_orders')
          .select('id, paid_at, payment_reference, profiles:ordered_by(first_name, last_name), total_amount, payment_method')
          .eq('school_id', profile?.school_id)
          .eq('payment_status', 'paid')
          .order('paid_at', { ascending: false });
        if (filters.date_from) qStore = qStore.gte('paid_at', filters.date_from);
        if (filters.date_to) qStore = qStore.lte('paid_at', filters.date_to + 'T23:59:59.999Z');
        const { data: storeData } = await qStore;
        (storeData || []).forEach((d: any) => {
          results.push({
            id: d.id,
            date: d.paid_at,
            reference: d.payment_reference || '-',
            description: 'Store Purchase',
            type: 'income',
            amount: Number(d.total_amount),
            payment_method: d.payment_method || '-',
            created_by: d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : '-',
          });
        });
      }

      if (!filters.type || filters.type === 'expense') {
        let q = supabase
          .from('expense_records')
          .select('id, date:expense_date, reference_number:reference_no, title:source_name, amount, payment_method_id, created_by')
          .eq('school_id', profile?.school_id)
          .order('expense_date', { ascending: false });
        if (filters.date_from) q = q.gte('expense_date', filters.date_from);
        if (filters.date_to) q = q.lte('expense_date', filters.date_to);
        const { data } = await q;
        (data || []).forEach((d: any) => {
          results.push({
            id: d.id,
            date: d.date,
            reference: d.reference_number || '-',
            description: d.title || 'Expense',
            type: 'expense',
            amount: Number(d.amount),
            payment_method: '-', // Could fetch name if doing a join
            created_by: '-',
          });
        });
      }

      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(results);
    } catch {
      setTransactions([]);
    }
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const totalIncome = transactions
    .filter(t => t.type === 'fees' || t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  function getTypeBadge(type: string) {
    switch (type) {
      case 'fees':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Fees</span>;
      case 'income':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Income</span>;
      case 'expense':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Expense</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{type}</span>;
    }
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Transaction Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filters.type}
            onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 self-end"
          >
            <option value="">All Types</option>
            <option value="fees">Fees</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select
            value={filters.payment_method_id}
            onChange={e => setFilters(f => ({ ...f, payment_method_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 self-end"
          >
            <option value="">All Payment Methods</option>
            {paymentMethods.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Income</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">₦{totalIncome.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <ArrowUpCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Expense</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₦{totalExpense.toLocaleString()}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <ArrowDownCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Net Balance</p>
              <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ₦{netBalance.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Scale className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Reference</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Type</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Payment Method</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Created By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">No transactions found</td>
                </tr>
              ) : (
                transactions.map((txn, index) => (
                  <tr key={`${txn.type}-${txn.id}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(txn.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-600">{txn.reference}</td>
                    <td className="px-4 py-3 text-slate-800">{txn.description}</td>
                    <td className="px-4 py-3">{getTypeBadge(txn.type)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${txn.type === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                      ₦{txn.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{txn.payment_method}</td>
                    <td className="px-4 py-3 text-slate-600">{txn.created_by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
