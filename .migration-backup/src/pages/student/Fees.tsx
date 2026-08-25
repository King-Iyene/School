import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/common/Badge';

const statusColors: Record<string, any> = { paid: 'success', partial: 'warning', pending: 'default', overdue: 'error' };

export default function StudentFees() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFees(); }, [profile]);

  async function loadFees() {
    if (!profile?.id || !profile?.school_id) return;
    setLoading(true);
    const [payRes, legacyPayRes, feeRes] = await Promise.all([
      supabase.from('fee_payments').select('*, fee_structures(name, amount)').eq('student_id', profile.id).order('payment_date', { ascending: false }),
      supabase.from('fees_collections').select('*, fees_master(amount, fees_types(name))').eq('student_id', profile.id).order('payment_date', { ascending: false }),
      supabase.from('fee_structures').select('*').eq('school_id', profile.school_id),
    ]);

    const mergedPayments = [
      ...(payRes.data ?? []).map(p => ({
        ...p,
        fee_name: p.fee_structures?.name || 'Fee',
      })),
      ...(legacyPayRes.data ?? []).map(p => ({
        ...p,
        fee_name: p.fees_master?.fees_types?.name || 'Fee',
        amount_paid: p.amount, // Map legacy amount to amount_paid
        status: 'paid'
      }))
    ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    setPayments(mergedPayments);
    setFeeStructures(feeRes.data ?? []);
    setLoading(false);
  }

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalDue = feeStructures.reduce((sum, f) => sum + Number(f.amount), 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">My Fee Status</h2>
        <p className="text-slate-500 text-sm">View your payment history and outstanding fees</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-xl"><CheckCircle className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Paid</p>
              <p className="text-xl font-bold text-slate-800">₦{totalPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 p-2.5 rounded-xl"><AlertCircle className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="text-xl font-bold text-slate-800">₦{Math.max(0, outstanding).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2.5 rounded-xl"><CreditCard className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Transactions</p>
              <p className="text-xl font-bold text-slate-800">{payments.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Payment History</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Fee Item</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Amount</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Method</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No payment records found</td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{p.fee_name}</td>
                <td className="px-5 py-3 text-sm font-semibold text-emerald-600">₦{Number(p.amount_paid).toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-slate-500 capitalize">{p.payment_method?.replace('_', ' ')}</td>
                <td className="px-5 py-3"><Badge label={p.status} variant={statusColors[p.status]} /></td>
                <td className="px-5 py-3 text-sm text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
