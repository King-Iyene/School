import { useEffect, useState } from 'react';
import { CreditCard, Check, AlertTriangle, Loader2, Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantSettings } from '../../context/TenantContext';
import { apiUrl } from '../../lib/apiUrl';
import { PLAN_LABELS, PLAN_PRICES_NGN, PLAN_STUDENT_LIMITS, PLAN_ORDER } from '../../lib/planFeatures';
import type { PlanTier } from '../../lib/types';

declare global {
  interface Window {
    PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
  }
}

// Keep in sync with artifacts/api-server/src/routes/billing.ts — a small,
// fully-refunded hold used only to save/replace the card on file.
const CARD_VERIFICATION_AMOUNT_NGN = 100;

const PLAN_BLURBS: Record<PlanTier, string> = {
  starter: 'Core academics, attendance, report cards and the parent/student portal.',
  premium: 'Everything in Starter, plus online payments, CBT, lesson plans, the library/store and bulk printing.',
  enterprise: 'Everything in Premium, plus HR/payroll, full accounting, transport, dormitory, security and white-labeling.',
};

interface BillingEvent {
  id: string;
  plan_tier: PlanTier;
  amount: number;
  currency: string;
  status: string;
  provider_reference: string;
  created_at: string;
}

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

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function Billing() {
  const { tenant, settings, refresh } = useTenantSettings();
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [busyPlan, setBusyPlan] = useState<PlanTier | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant?.id) return;
      const { data } = await supabase
        .from('tenant_billing_events')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(25);
      if (!cancelled) {
        setEvents((data as BillingEvent[]) ?? []);
        setLoadingEvents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant?.id]);

  async function authedFetch(path: string, body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired — please sign in again.');
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
  }

  async function changePlan(newPlanTier: PlanTier) {
    if (!tenant || newPlanTier === tenant.plan_tier) return;
    setBusyPlan(newPlanTier);
    setMessage(null);
    try {
      const data = await authedFetch('/api/billing/change-plan', { newPlanTier });
      setMessage({ type: 'success', text: data.message });
      await refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusyPlan(null);
    }
  }

  async function updateCard() {
    const platformKey = import.meta.env.VITE_PLATFORM_PAYSTACK_PUBLIC_KEY as string | undefined;
    if (!platformKey) {
      setMessage({ type: 'error', text: 'Payments are not configured for this deployment yet. Contact support.' });
      return;
    }
    setCardBusy(true);
    setMessage(null);
    try {
      await loadPaystackScript();
      const handler = window.PaystackPop!.setup({
        key: platformKey,
        email: settings.email || 'billing@schoolos.app',
        amount: CARD_VERIFICATION_AMOUNT_NGN * 100,
        currency: 'NGN',
        channels: ['card'],
        callback: (response: { reference: string }) => {
          authedFetch('/api/billing/update-card', { paystackReference: response.reference })
            .then((data) => {
              setMessage({ type: 'success', text: data.message });
              refresh();
            })
            .catch((err) => setMessage({ type: 'error', text: err.message }))
            .finally(() => setCardBusy(false));
        },
        onClose: () => setCardBusy(false),
      });
      handler.openIframe();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
      setCardBusy(false);
    }
  }

  if (!tenant) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-app-text-muted" /></div>;
  }

  const trialDaysLeft = tenant.status === 'trial' ? daysUntil(tenant.trial_ends_at) : null;
  const hasCard = !!tenant.paystack_authorization_code;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text">Billing &amp; Subscription</h1>
        <p className="text-app-text-muted text-sm mt-1">Manage your plan, payment method and billing history.</p>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {tenant.status === 'past_due' && (
        <div className="rounded-xl px-4 py-3 text-sm bg-amber-50 text-amber-800 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Your last payment didn't go through.</p>
            <p className="mt-0.5">{tenant.last_payment_error || 'Please update your card to keep your subscription active.'} We'll retry automatically, but updating your card now avoids any interruption.</p>
          </div>
        </div>
      )}
      {tenant.status === 'suspended' && (
        <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Your account is currently suspended.</p>
            <p className="mt-0.5">{tenant.last_payment_error ? `Reason: ${tenant.last_payment_error}. ` : ''}Update your card below to reactivate immediately.</p>
          </div>
        </div>
      )}
      {tenant.status === 'trial' && trialDaysLeft !== null && (
        <div className="rounded-xl px-4 py-3 text-sm bg-brand-mint/10 text-brand-indigo border border-brand-mint/30">
          {trialDaysLeft > 0
            ? `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}. ${hasCard ? "Your saved card will be charged automatically." : 'Add a card below so your subscription can continue.'}`
            : 'Your free trial has ended.'}
        </div>
      )}

      {/* Payment method */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4" /> Payment Method</h2>
        <p className="text-sm text-app-text-muted mb-4">{hasCard ? 'A card is saved on file for automatic billing.' : 'No card on file yet.'}</p>
        <button
          onClick={updateCard}
          disabled={cardBusy}
          className="px-5 py-2.5 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {cardBusy ? 'Opening secure payment…' : hasCard ? 'Update Card' : 'Add Card'}
        </button>
      </div>

      {/* Plans */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-app-text mb-4">Plan</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {PLAN_ORDER.map((tier) => {
            const isCurrent = tier === tenant.plan_tier;
            const isPending = tier === tenant.pending_plan_tier;
            return (
              <div
                key={tier}
                className={`rounded-xl border p-4 flex flex-col ${isCurrent ? 'border-brand-indigo ring-2 ring-brand-indigo/20' : 'border-app-border'}`}
              >
                <p className="font-bold text-app-text">{PLAN_LABELS[tier]}</p>
                <p className="text-2xl font-bold text-app-text mt-1">{formatNaira(PLAN_PRICES_NGN[tier])}<span className="text-sm font-normal text-app-text-muted">/mo</span></p>
                <p className="text-xs text-app-text-muted mt-2 flex-1">{PLAN_BLURBS[tier]}</p>
                <p className="text-xs text-app-text-muted mt-2">
                  Up to {PLAN_STUDENT_LIMITS[tier] === null ? 'unlimited' : PLAN_STUDENT_LIMITS[tier]} students
                </p>
                {isCurrent ? (
                  <div className="mt-4 flex items-center gap-1.5 text-emerald-600 text-sm font-semibold">
                    <Check className="w-4 h-4" /> Current plan
                  </div>
                ) : isPending ? (
                  <p className="mt-4 text-xs text-amber-600 font-medium">Starts next billing cycle</p>
                ) : (
                  <button
                    onClick={() => changePlan(tier)}
                    disabled={busyPlan !== null}
                    className="bg-app-surface text-app-text mt-4 px-4 py-2 border border-app-border hover:border-brand-indigo hover:text-brand-indigo disabled:opacity-50 text-app-text text-sm font-semibold rounded-lg transition-colors"
                  >
                    {busyPlan === tier ? 'Updating…' : PLAN_ORDER.indexOf(tier) > PLAN_ORDER.indexOf(tenant.plan_tier) ? 'Upgrade' : 'Downgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-app-text flex items-center gap-2 mb-4"><Receipt className="w-4 h-4" /> Billing History</h2>
        {loadingEvents ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-app-text-muted" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-app-text-muted">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-app-text-muted border-b border-app-border">
                  <th className="font-medium py-2 pr-4">Date</th>
                  <th className="font-medium py-2 pr-4">Plan</th>
                  <th className="font-medium py-2 pr-4">Amount</th>
                  <th className="font-medium py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 text-app-text-muted">{new Date(ev.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-app-text-muted">{PLAN_LABELS[ev.plan_tier]}</td>
                    <td className="py-2 pr-4 text-app-text-muted">{ev.currency === 'NGN' ? formatNaira(ev.amount) : `${ev.currency} ${ev.amount}`}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ev.status === 'success' ? 'bg-emerald-50 text-emerald-600' : ev.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-app-text-muted'}`}>
                        {ev.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
