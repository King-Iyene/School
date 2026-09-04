import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import Billing from '../../pages/billing/Billing';

const BILLING_ROLES = new Set(['super_admin', 'admin']);
const SALES_EMAIL = 'sales@schoolos.app';

/**
 * Full-screen block for every user of a suspended/canceled tenant — no
 * route is reachable underneath this (App.tsx renders it in place of
 * Layout+the requested page).
 *
 * 'suspended' (a failed payment) is self-service: an admin gets the actual
 * Billing page embedded right here so updating their card can reactivate
 * them immediately, no second navigation step. 'canceled' means the tenant
 * deliberately asked to stop (cancel_at_period_end) — reactivating that is
 * a real re-signup decision, not a card update, so it routes to sales
 * instead of pretending a "Billing" page can undo it.
 */
export default function AccountLockout() {
  const { profile, signOut } = useAuth();
  const { settings, tenant } = useTenantSettings();
  const isAdmin = profile && BILLING_ROLES.has(profile.role);
  const isCanceled = tenant?.status === 'canceled';

  return (
    <div className="min-h-screen bg-app-surface-alt flex flex-col items-center p-4 py-10">
      <div className="w-full max-w-md text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-app-text mb-2">
          {isCanceled ? `${settings.school_name || 'Your school'}'s account has been canceled` : `${settings.school_name || 'Your school'}'s account is suspended`}
        </h1>
        <p className="text-app-text-muted text-sm">
          {isCanceled
            ? 'Get in touch to reactivate your subscription.'
            : isAdmin
              ? "A subscription payment didn't go through. Update your card below to restore access for everyone at your school."
              : 'Access is on hold. Please contact your school administrator.'}
        </p>
      </div>

      {isCanceled ? (
        <a
          href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Reactivate my SchoolOS subscription')}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-brand-indigo text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Mail className="w-4 h-4" /> Contact Us to Reactivate
        </a>
      ) : isAdmin ? (
        <div className="w-full">
          <Billing />
        </div>
      ) : (
        <button onClick={signOut} className="px-4 py-2 bg-slate-100 text-app-text rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
          Sign Out
        </button>
      )}
    </div>
  );
}
