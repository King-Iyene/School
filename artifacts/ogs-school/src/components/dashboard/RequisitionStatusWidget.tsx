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
  pending:   { label: 'Pending',   bg: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',        icon: Clock },
  approved:  { label: 'Approved',  bg: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
  rejected:  { label: 'Rejected',  bg: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400',                icon: XCircle },
  disbursed: { label: 'Disbursed', bg: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',            icon: Banknote },
  retired:   { label: 'Retired',   bg: 'bg-app-surface-alt text-app-text-muted',                                     icon: CheckCircle },
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
    <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-app-text-muted" />
          <h3 className="font-semibold text-app-text">My Requisitions</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/hr/requisitions')}
            className="flex items-center gap-1 text-xs font-medium text-app-text-muted bg-app-surface-alt hover:bg-app-border px-2.5 py-1 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            onClick={() => navigate('/hr/requisitions')}
            className="text-sm text-app-primary hover:opacity-80 font-medium flex items-center gap-1"
          >
            All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isApprover && pendingCount > 0 && (
        <button
          onClick={() => navigate('/hr/requisitions')}
          className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors border-b border-amber-100 dark:border-amber-500/20 text-left"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {pendingCount} requisition{pendingCount > 1 ? 's' : ''} awaiting your approval
            </span>
          </div>
          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
            {pendingCount}
          </span>
        </button>
      )}

      {loading ? (
        <div className="px-5 py-6 text-center text-app-text-muted text-sm">Loading…</div>
      ) : myReqs.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-app-text-muted/40" />
          <p className="text-sm text-app-text-muted">No requisitions submitted yet</p>
          <button
            onClick={() => navigate('/hr/requisitions')}
            className="mt-2 text-xs text-app-primary hover:opacity-80 font-medium"
          >
            Submit your first request →
          </button>
        </div>
      ) : (
        <div className="divide-y divide-app-border">
          {myReqs.map(req => {
            const cfg = STATUS[req.status] ?? STATUS.pending;
            const Icon = cfg.icon;
            return (
              <button
                key={req.id}
                onClick={() => navigate('/hr/requisitions')}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-app-surface-alt transition-colors text-left"
              >
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${cfg.bg}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-app-text truncate">{req.title}</p>
                  <p className="text-xs text-app-text-muted">
                    ₦{Number(req.amount).toLocaleString()} · {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-app-text-muted flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
