import { useState } from 'react';
import { Lock, Mail, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '../../lib/apiUrl';
import { PLAN_LABELS, PLAN_PRICES_NGN } from '../../lib/planFeatures';
import Billing from '../../pages/billing/Billing';

declare global {
  interface Window {
    PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
  }
}

const BILLING_ROLES = new Set(['super_admin', 'admin']);
const SALES_EMAIL = 'sales@schoolos.app';
const CARD_VERIFICATION_AMOUNT_NGN = 100;

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load payment gateway. Check your connection and try again.'));
    document.body.appendChild(script);
  });
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function TrialExpiredAdmin() {
  const { tenant, settings, refresh } = useTenantSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const planTier = tenant?.plan_tier ?? 'starter';
  const planLabel = PLAN_LABELS[planTier];
  const price = PLAN_PRICES_NGN[planTier];

  async function handlePayment() {
    const platformKey = import.meta.env.VITE_PLATFORM_PAYSTACK_PUBLIC_KEY as string | undefined;
    if (!platformKey) {
      setError('Payments are not configured for this deployment yet. Contact support.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loadPaystackScript();
      const handler = window.PaystackPop!.setup({
        key: platformKey,
        email: settings.email || 'billing@schoolos.app',
        amount: CARD_VERIFICATION_AMOUNT_NGN * 100,
        currency: 'NGN',
        channels: ['card'],
        callback: (response: { reference: string }) => {
          supabase.auth.getSession()
            .then(({ data: { session } }) => {
              if (!session?.access_token) throw new Error('Session expired — please sign in again.');
              return fetch(apiUrl('/api/billing/activate-trial'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ paystackReference: response.reference }),
              });
            })
            .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
              if (!ok) throw new Error(data?.error || 'Payment verification failed.');
              setSuccess(true);
              return refresh();
            })
            .catch((err: any) => setError(err.message))
            .finally(() => setBusy(false));
        },
        onClose: () => setBusy(false),
      });
      handler.openIframe();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="bg-app-surface border border-app-border rounded-xl p-5 text-center space-y-3">
        <p className="text-sm text-app-text-muted">
          Subscribe to continue using the portal.
        </p>
        <div className="text-2xl font-bold text-app-text">
          {formatNaira(price)}<span className="text-sm font-normal text-app-text-muted">/month</span>
        </div>
        <p className="text-xs text-app-text-muted">{planLabel} plan</p>
        <button
          onClick={handlePayment}
          disabled={busy || success}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {busy ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : success ? (
            'Redirecting…'
          ) : (
            <><CreditCard className="w-4 h-4" /> Make Payment</>
          )}
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default function AccountLockout() {
  const { profile, signOut } = useAuth();
  const { settings, tenant } = useTenantSettings();
  const isAdmin = profile && BILLING_ROLES.has(profile.role);
  const isCanceled = tenant?.status === 'canceled';
  const isTrialExpired = tenant?.status === 'trial'
    && !!tenant.trial_ends_at
    && new Date(tenant.trial_ends_at).getTime() <= Date.now();

  const title = isCanceled
    ? `${settings.school_name || 'Your school'}'s account has been canceled`
    : isTrialExpired
      ? 'Your free trial has ended'
      : `${settings.school_name || 'Your school'}'s account is suspended`;

  const subtitle = isCanceled
    ? 'Get in touch to reactivate your subscription.'
    : isTrialExpired
      ? isAdmin
        ? 'Your trial period is over. Make a payment below to continue using the portal.'
        : 'Your school\'s trial period is over. Please contact your school administrator to activate the subscription.'
      : isAdmin
        ? "A subscription payment didn't go through. Update your card below to restore access for everyone at your school."
        : 'Access is on hold. Please contact your school administrator.';

  return (
    <div className="min-h-screen bg-app-surface-alt flex flex-col items-center p-4 py-10">
      <div className="w-full max-w-md text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-app-text mb-2">{title}</h1>
        <p className="text-app-text-muted text-sm">{subtitle}</p>
      </div>

      {isCanceled ? (
        <a
          href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Reactivate my Loop subscription')}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-app-primary hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Mail className="w-4 h-4" /> Contact Us to Reactivate
        </a>
      ) : isTrialExpired ? (
        isAdmin ? (
          <TrialExpiredAdmin />
        ) : (
          <button onClick={signOut} className="px-4 py-2 bg-slate-100 text-app-text rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
            Sign Out
          </button>
        )
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
