import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Check, Loader2, ArrowLeft } from 'lucide-react';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';
import GlowBlobs from '../../components/shared/GlowBlobs';
import { PLAN_LABELS, PLAN_STUDENT_LIMITS, PLAN_PRICES_NGN } from '../../lib/planFeatures';
import type { PlanTier } from '../../lib/types';

declare global {
  interface Window {
    PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
  }
}

const PLATFORM_PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PLATFORM_PAYSTACK_PUBLIC_KEY as string | undefined;

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

type Step = 'details' | 'plan' | 'payment' | 'success';
const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'School' },
  { key: 'plan', label: 'Plan' },
  { key: 'payment', label: 'Payment' },
  { key: 'success', label: 'Done' },
];

function Stepper({ step }: { step: Step }) {
  const activeIndex = STEPS.findIndex(s => s.key === step);
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                i < activeIndex
                  ? 'bg-brand-mint text-brand-ink'
                  : i === activeIndex
                  ? 'bg-gradient-to-br from-brand-violet to-brand-indigo text-white shadow-lg shadow-brand-violet/30 scale-110'
                  : 'bg-white/5 text-slate-500 border border-white/10'
              }`}
            >
              {i < activeIndex ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[11px] font-medium ${i <= activeIndex ? 'text-slate-200' : 'text-slate-500'}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1.5 rounded-full transition-colors duration-500 ${i < activeIndex ? 'bg-brand-mint' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const params = useMemo(() => getSearchParams(), []);
  const [step, setStep] = useState<Step>('details');
  const [schoolName, setSchoolName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [plan, setPlan] = useState<PlanTier>((params.get('plan') as PlanTier) || 'starter');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Start Your Free Trial — SchoolOS';
    return () => { document.title = prevTitle; };
  }, []);

  useEffect(() => {
    setSubdomain(schoolName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  }, [schoolName]);

  function validateDetails() {
    if (!schoolName.trim()) return 'School name is required.';
    if (!subdomain.trim()) return 'Subdomain is required.';
    if (!adminFirstName.trim() || !adminLastName.trim()) return 'Admin name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adminEmail.trim())) return 'A valid admin email is required.';
    return '';
  }

  async function registerTenant(paystackReference: string | null) {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          subdomain: subdomain.trim(),
          adminFirstName: adminFirstName.trim(),
          adminLastName: adminLastName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          plan,
          paystackReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Registration failed. Please try again.');
      setLoginUrl(data.loginUrl || '/login');
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    setError('');
    if (!PLATFORM_PAYSTACK_PUBLIC_KEY) {
      // No live payment gateway configured for this deployment — proceed as a
      // trial signup so the flow stays usable; a platform owner activates
      // billing later from /saas-admin once Paystack keys are configured.
      await registerTenant(null);
      return;
    }
    setSubmitting(true);
    try {
      await loadPaystackScript();
      const handler = window.PaystackPop!.setup({
        key: PLATFORM_PAYSTACK_PUBLIC_KEY,
        email: adminEmail.trim(),
        amount: PLAN_PRICES_NGN[plan] * 100, // kobo
        currency: 'NGN',
        metadata: { schoolName, subdomain, plan },
        callback: (response: { reference: string }) => {
          registerTenant(response.reference);
        },
        onClose: () => setSubmitting(false),
      });
      handler.openIframe();
    } catch (err: any) {
      setError(err.message || 'Payment could not be started.');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-brand-ink flex items-center justify-center p-4 overflow-hidden">
      <GlowBlobs />
      <div className="relative w-full max-w-lg">
        <button
          onClick={() => navigate('/landing')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center shadow-lg shadow-brand-violet/25">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Create your school's portal</h1>
              <p className="text-slate-400 text-sm">Step {STEPS.findIndex(s => s.key === step) + 1} of {STEPS.length}</p>
            </div>
          </div>

          <Stepper step={step} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4 animate-brand-fade-up">
              {error}
            </div>
          )}

          <div className="animate-brand-fade-up" key={step}>
          {step === 'details' && (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                const err = validateDetails();
                if (err) { setError(err); return; }
                setError('');
                setStep('plan');
              }}
            >
              <Field label="School Name">
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)} required placeholder="e.g. Greenfield International School" className={inputClass} />
              </Field>
              <Field label="Subdomain">
                <div className="flex items-center">
                  <input value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required placeholder="greenfield" className={`${inputClass} rounded-r-none`} />
                  <span className="bg-white/5 border border-l-0 border-white/10 text-slate-400 text-sm px-3 py-3 rounded-r-xl">.schoolos.app</span>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Admin First Name">
                  <input value={adminFirstName} onChange={e => setAdminFirstName(e.target.value)} required className={inputClass} />
                </Field>
                <Field label="Admin Last Name">
                  <input value={adminLastName} onChange={e => setAdminLastName(e.target.value)} required className={inputClass} />
                </Field>
              </div>
              <Field label="Admin Email">
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required className={inputClass} />
              </Field>
              <button type="submit" className={primaryBtnClass}>Continue</button>
            </form>
          )}

          {step === 'plan' && (
            <div className="space-y-4">
              {(['starter', 'premium', 'enterprise'] as PlanTier[]).map(tier => (
                <button
                  key={tier}
                  onClick={() => setPlan(tier)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                    plan === tier ? 'border-brand-violet bg-brand-violet/10 ring-1 ring-brand-violet/40' : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{PLAN_LABELS[tier]}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {PLAN_STUDENT_LIMITS[tier] ? `Up to ${PLAN_STUDENT_LIMITS[tier]!.toLocaleString()} students` : 'Unlimited students & staff'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">₦{PLAN_PRICES_NGN[tier].toLocaleString('en-NG')}</p>
                      <p className="text-slate-500 text-xs">/month</p>
                    </div>
                  </div>
                  {plan === tier && <Check className="w-4 h-4 text-brand-mint mt-2" />}
                </button>
              ))}
              <div className="flex gap-3">
                <button onClick={() => setStep('details')} className={secondaryBtnClass}>Back</button>
                <button onClick={() => setStep('payment')} className={primaryBtnClass}>Continue</button>
              </div>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Order Summary</p>
                <div className="flex justify-between text-sm text-slate-300 mb-1">
                  <span>{schoolName}</span>
                  <span>{PLAN_LABELS[plan]} Plan</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg mt-3 pt-3 border-t border-white/10">
                  <span>Total due today</span>
                  <span>₦{PLAN_PRICES_NGN[plan].toLocaleString('en-NG')}</span>
                </div>
                {!PLATFORM_PAYSTACK_PUBLIC_KEY && (
                  <p className="text-brand-mint/80 text-xs mt-3">
                    Payment gateway not configured on this deployment — your school will be created on a trial
                    subscription; billing can be activated later from the Super Admin panel.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('plan')} className={secondaryBtnClass} disabled={submitting}>Back</button>
                <button onClick={handlePayment} disabled={submitting} className={primaryBtnClass}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : PLATFORM_PAYSTACK_PUBLIC_KEY ? 'Pay & Subscribe' : 'Start Trial'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-mint/20 to-brand-violet/20 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-brand-mint/30">
                <Check className="w-8 h-8 text-brand-mint" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Your portal is ready!</h2>
              <p className="text-slate-400 text-sm mb-6">
                We've emailed <strong className="text-slate-200">{adminEmail}</strong> with a temporary password.
                Sign in to finish setting up {schoolName}.
              </p>
              <button onClick={() => navigate(loginUrl || '/login')} className={primaryBtnClass}>Go to Sign In</button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-violet/50 focus:border-brand-violet/50 transition-all';
const primaryBtnClass = 'w-full bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-brand-violet/25';
const secondaryBtnClass = 'w-full bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-colors border border-white/10';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      {children}
    </div>
  );
}
