import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';

const statusColors: Record<string, any> = { paid: 'success', partial: 'warning', pending: 'default', overdue: 'error' };

export default function ParentFees() {
  const { profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChildren(); }, [profile]);
  useEffect(() => { if (selectedChild) loadPayments(); }, [selectedChild]);

  async function loadChildren() {
    if (!profile?.id) return;
    const { data } = await supabase.from('parent_student_links').select('*, students!student_id(id, first_name, last_name)').eq('parent_id', profile.id);
    const kids = (data ?? []).map(l => (l as any).students).filter(Boolean);
    setChildren(kids);
    if (kids.length > 0) setSelectedChild((kids[0] as any).id);
    setLoading(false);
  }

  async function loadPayments() {
    setLoading(true);
    const [payRes, legacyPayRes] = await Promise.all([
      supabase.from('fee_payments').select('*, fee_structures(name, amount, due_date)').eq('student_id', selectedChild).order('payment_date', { ascending: false }),
      supabase.from('fees_collections').select('*, fees_master(amount, due_date, fees_types(name))').eq('student_id', selectedChild).order('payment_date', { ascending: false }),
    ]);

    const merged = [
      ...(payRes.data ?? []).map(p => ({
        ...p,
        fee_name: p.fee_structures?.name || 'Fee',
      })),
      ...(legacyPayRes.data ?? []).map(p => ({
        ...p,
        fee_name: p.fees_master?.fees_types?.name || 'Fee',
        amount_paid: p.amount, // Map legacy amount to amount_paid
        status: 'paid',
        receipt_number: p.receipt_no
      }))
    ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    setPayments(merged);
    setLoading(false);
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const pendingCount = payments.filter(p => ['pending', 'overdue'].includes(p.status)).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Fee Status</h2>
        <p className="text-slate-500 text-sm">View payment history and outstanding balances</p>
      </div>

      <div className="flex gap-3">
        <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
          {children.map(c => <option key={(c as any).id} value={(c as any).id}>{(c as any).first_name} {(c as any).last_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-xl"><CheckCircle className="w-4 h-4 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Paid</p>
              <p className="text-xl font-bold text-slate-800">₦{totalPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2.5 rounded-xl"><AlertCircle className="w-4 h-4 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-xl font-bold text-slate-800">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2.5 rounded-xl"><CreditCard className="w-4 h-4 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Transactions</p>
              <p className="text-xl font-bold text-slate-800">{payments.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Fee Item</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Amount Paid</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Method</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Date</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">No payment records found</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.fee_name}</td>
                <td className="px-5 py-3 text-sm font-semibold text-emerald-600">₦{Number(p.amount_paid).toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-slate-500 capitalize">{p.payment_method?.replace('_', ' ')}</td>
                <td className="px-5 py-3"><Badge label={p.status} variant={statusColors[p.status]} /></td>
                <td className="px-5 py-3 text-sm text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-sm text-slate-500 font-mono">{p.receipt_number || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
