import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle, XCircle, Banknote, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../hooks/useLocation';

interface Req {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
}

const STATUS: Record<string, { label: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   bg: 'bg-amber-100 text-amber-700',    icon: Clock },
  approved:  { label: 'Approved',  bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected:  { label: 'Rejected',  bg: 'bg-red-100 text-red-700',        icon: XCircle },
  disbursed: { label: 'Disbursed', bg: 'bg-blue-100 text-blue-700',      icon: Banknote },
  retired:   { label: 'Retired',   bg: 'bg-slate-100 text-slate-600',    icon: CheckCircle },
};

interface Props {
  userId: string;
  schoolId: string;
  isApprover?: boolean;
}

export default function RequisitionStatusWidget({ userId, schoolId, isApprover }: Props) {
  const [myReqs, setMyReqs] = useState<Req[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [myRes, pendingRes] = await Promise.all([
        supabase
          .from('requisitions')
          .select('id, title, amount, status, created_at')
          .eq('requester_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
        isApprover
          ? supabase
              .from('requisitions')
              .select('id', { count: 'exact', head: true })
              .eq('school_id', schoolId)
              .eq('status', 'pending')
          : Promise.resolve({ count: 0, data: null, error: null }),
      ]);
      setMyReqs(
        (myRes.data ?? []).filter(
          (r): r is Req =>
            r.id !== null && r.title !== null && r.amount !== null && r.status !== null
        )
      );
      setPendingCount((pendingRes as { count: number | null }).count ?? 0);
      setLoading(false);
    }
    if (userId && schoolId) load();
  }, [userId, schoolId, isApprover]);

  if (!loading && myReqs.length === 0 && pendingCount === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800">My Requisitions</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/hr/requisitions')}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            onClick={() => navigate('/hr/requisitions')}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isApprover && pendingCount > 0 && (
        <button
          onClick={() => navigate('/hr/requisitions')}
          className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 hover:bg-amber-100 transition-colors border-b border-amber-100 text-left"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800">
              {pendingCount} requisition{pendingCount > 1 ? 's' : ''} awaiting your approval
            </span>
          </div>
          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
            {pendingCount}
          </span>
        </button>
      )}

      {loading ? (
        <div className="px-5 py-6 text-center text-slate-400 text-sm">Loading…</div>
      ) : myReqs.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-400">No requisitions submitted yet</p>
          <button
            onClick={() => navigate('/hr/requisitions')}
            className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Submit your first request →
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {myReqs.map(req => {
            const cfg = STATUS[req.status] ?? STATUS.pending;
            const Icon = cfg.icon;
            return (
              <button
                key={req.id}
                onClick={() => navigate('/hr/requisitions')}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${cfg.bg}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                  <p className="text-xs text-slate-400">
                    ₦{Number(req.amount).toLocaleString()} · {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
