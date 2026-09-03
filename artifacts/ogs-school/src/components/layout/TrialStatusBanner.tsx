import { AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { navigate } from '../hooks/useLocation';

const BILLING_ROLES = new Set(['super_admin', 'admin']);
const TRIAL_BANNER_DAYS = 3;

/** Shown above the page content for admin roles when action is needed on billing — never blocks anything, just nudges toward /billing before the account actually gets suspended. */
export default function TrialStatusBanner() {
  const { profile } = useAuth();
  const { tenant } = useTenantSettings();

  if (!profile || !BILLING_ROLES.has(profile.role) || !tenant) return null;

  if (tenant.status === 'trial' && tenant.trial_ends_at) {
    const daysLeft = Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000);
    if (daysLeft > TRIAL_BANNER_DAYS) return null;
    return (
      <button
        onClick={() => navigate('/billing')}
        className="w-full flex items-center justify-center gap-2 bg-brand-indigo text-white text-sm font-medium py-2 px-4 hover:bg-brand-indigo/90 transition-colors"
      >
        <Clock className="w-4 h-4" />
        {daysLeft > 0
          ? `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — manage billing`
          : 'Your free trial has ended — manage billing'}
      </button>
    );
  }

  if (tenant.status === 'past_due') {
    return (
      <button
        onClick={() => navigate('/billing')}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 hover:bg-amber-600 transition-colors"
      >
        <AlertTriangle className="w-4 h-4" />
        Your last payment failed — update your card to avoid interruption
      </button>
    );
  }

  return null;
}
