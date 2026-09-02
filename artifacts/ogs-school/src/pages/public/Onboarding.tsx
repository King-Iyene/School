import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Check, Loader2, ArrowLeft, Mail, MessageCircle, Star } from 'lucide-react';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';
import { PLAN_LABELS, PLAN_STUDENT_LIMITS, PLAN_PRICES_NGN } from '../../lib/planFeatures';
import type { PlanTier } from '../../lib/types';
import { apiUrl } from '../../lib/apiUrl';

declare global {
  interface Window {
    PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
  }
}

const PLATFORM_PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PLATFORM_PAYSTACK_PUBLIC_KEY as string | undefined;

// Keep in sync with artifacts/api-server/src/routes/onboarding.ts — a small,
// fully-refunded hold used only to save the card for the day-14 trial
// conversion charge. The real plan price is never charged today.
const TRIAL_VERIFICATION_AMOUNT_NGN = 100;
const TRIAL_DAYS = 14;

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
const STEPS: Step[] = ['details', 'plan', 'payment', 'success'];

function ProgressDots({ step }: { step: Step }) {
  const activeIndex = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i === activeIndex ? 'w-8 bg-brand-indigo' : i < activeIndex ? 'w-1.5 bg-brand-violet/60' : 'w-1.5 bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[360px] flex-shrink-0 bg-slate-50 border-r border-slate-100 p-8">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-900 leading-tight">SchoolOS</p>
          <p className="text-xs text-slate-400">School Management Platform</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="pb-6 border-b border-slate-200">
          <h4 className="font-semibold text-slate-800 text-sm">Questions about plans?</h4>
          <p className="text-sm text-slate-500 mt-1">Talk to our team before you subscribe.</p>
          <a href="mailto:sales@schoolos.app" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-indigo mt-2 hover:underline">
            <Mail className="w-3.5 h-3.5" /> sales@schoolos.app
          </a>
        </div>

        <div className="pb-6 border-b border-slate-200">
          <h4 className="font-semibold text-slate-800 text-sm">Need a hand onboarding?</h4>
          <p className="text-sm text-slate-500 mt-1">Our team can help you get set up.</p>
          <a href="mailto:support@schoolos.app" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-indigo mt-2 hover:underline">
            <MessageCircle className="w-3.5 h-3.5" /> support@schoolos.app
          </a>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <div className="flex -space-x-2 mb-3">
          {['A', 'B', 'C', 'D'].map((l, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-violet to-brand-indigo border-2 border-slate-50 flex items-center justify-center text-white text-xs font-bold">
              {l}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-amber-400 mb-1">
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
        </div>
        <p className="text-xs text-slate-500">Built with school administrators, for school administrators.</p>
      </div>
    </aside>
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
  const preselectedPlan = params.get('plan') as PlanTier | null;
  const [plan, setPlan] = useState<PlanTier>(preselectedPlan || 'starter');
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
      const res = await fetch(apiUrl('/api/onboarding/register'), {
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
        amount: TRIAL_VERIFICATION_AMOUNT_NGN * 100, // kobo — card verification hold only, refunded; see backend
        currency: 'NGN',
        channels: ['card'],
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

  const stepTitles: Record<Step, { title: string; subtitle: string }> = {
    details: { title: 'Tell us about your school', subtitle: "We'll use this to set up your portal and subdomain." },
    plan: { title: 'Choose your plan', subtitle: 'Pick what fits your school today — you can change this any time.' },
    payment: { title: 'Start your free trial', subtitle: `Save your card to activate ${TRIAL_DAYS} days free — cancel any time before it ends.` },
    success: { title: "You're all set!", subtitle: `Your ${TRIAL_DAYS}-day free trial has started.` },
  };

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <div className="p-4 sm:p-6 lg:hidden">
          <button onClick={() => navigate('/landing')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-10">
          <div className="w-full max-w-md">
            <button
              onClick={() => navigate('/landing')}
              className="hidden lg:inline-flex mb-8 items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to home
            </button>

            <ProgressDots step={step} />

            <h1 className="text-2xl font-bold text-slate-900">{stepTitles[step].title}</h1>
            <p className="text-slate-500 text-sm mt-1 mb-8">{stepTitles[step].subtitle}</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 animate-brand-fade-up">
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
                    setStep(preselectedPlan ? 'payment' : 'plan');
                  }}
                >
                  <Field label="School Name">
                    <input value={schoolName} onChange={e => setSchoolName(e.target.value)} required placeholder="e.g. Greenfield International School" className={inputClass} />
                  </Field>
                  <Field label="Subdomain">
                    <div className="flex items-center">
                      <input value={subdomain} onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required placeholder="greenfield" className={`${inputClass} rounded-r-none`} />
                      <span className="bg-slate-50 border border-l-0 border-slate-200 text-slate-400 text-sm px-3 py-3 rounded-r-xl">.schoolos.app</span>
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
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => navigate('/landing')} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
                      Skip for now
                    </button>
                    <button type="submit" className={primaryBtnClass}>Continue</button>
                  </div>
                </form>
              )}

              {step === 'plan' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {(['starter', 'premium', 'enterprise'] as PlanTier[]).map(tier => (
                      <button
                        key={tier}
                        onClick={() => setPlan(tier)}
                        className={`text-center p-4 rounded-xl border-2 transition-all duration-200 ${
                          plan === tier ? 'border-brand-indigo bg-brand-violet/5' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                          plan === tier ? 'bg-gradient-to-br from-brand-violet to-brand-indigo' : 'bg-slate-100'
                        }`}>
                          <GraduationCap className={`w-4.5 h-4.5 ${plan === tier ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">{PLAN_LABELS[tier]}</p>
                        <p className="text-xs text-slate-400 mt-0.5">₦{PLAN_PRICES_NGN[tier].toLocaleString('en-NG')}/mo</p>
                      </button>
                    ))}
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-800 mb-1">{PLAN_LABELS[plan]} plan</p>
                    <p>{PLAN_STUDENT_LIMITS[plan] ? `Up to ${PLAN_STUDENT_LIMITS[plan]!.toLocaleString()} students` : 'Unlimited students & staff'}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep('details')} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Back</button>
                    <button onClick={() => setStep('payment')} className={primaryBtnClass}>Continue</button>
                  </div>
                </div>
              )}

              {step === 'payment' && (
                <div className="space-y-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-slate-400 text-xs uppercase tracking-wide">Your Plan</p>
                      <button onClick={() => setStep('plan')} className="text-xs font-semibold text-brand-indigo hover:underline">Change</button>
                    </div>
                    <div className="flex justify-between text-sm text-slate-700 font-medium mb-1">
                      <span>{schoolName}</span>
                      <span>{PLAN_LABELS[plan]} Plan</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      {PLAN_STUDENT_LIMITS[plan] ? `Up to ${PLAN_STUDENT_LIMITS[plan]!.toLocaleString()} students` : 'Unlimited students & staff'}
                    </p>

                    <div className="flex justify-between text-slate-900 font-bold text-lg pt-3 border-t border-slate-200">
                      <span>Due today</span>
                      <span>{PLATFORM_PAYSTACK_PUBLIC_KEY ? `₦${TRIAL_VERIFICATION_AMOUNT_NGN.toLocaleString('en-NG')}` : '₦0'}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>Then, after your {TRIAL_DAYS}-day free trial</span>
                      <span>₦{PLAN_PRICES_NGN[plan].toLocaleString('en-NG')}/mo</span>
                    </div>

                    {PLATFORM_PAYSTACK_PUBLIC_KEY ? (
                      <p className="text-slate-500 text-xs mt-3 leading-relaxed">
                        We place a small, fully-refundable ₦{TRIAL_VERIFICATION_AMOUNT_NGN} hold on your card today just to
                        save it for billing — you are not charged the plan price until your {TRIAL_DAYS}-day trial ends,
                        and you can cancel any time before then at no cost.
                      </p>
                    ) : (
                      <p className="text-brand-indigo text-xs mt-3">
                        Payment gateway not configured on this deployment — your school will be created on a trial
                        subscription with no card on file; billing can be activated later from the Super Admin panel.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep('plan')} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50" disabled={submitting}>Back</button>
                    <button onClick={handlePayment} disabled={submitting} className={primaryBtnClass}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Start ${TRIAL_DAYS}-Day Free Trial`}
                    </button>
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="text-left">
                  <div className="w-14 h-14 bg-brand-mint/15 rounded-full flex items-center justify-center mb-5">
                    <Check className="w-7 h-7 text-brand-indigo" />
                  </div>
                  <p className="text-slate-500 text-sm mb-6">
                    We've emailed <strong className="text-slate-800">{adminEmail}</strong> with a temporary password.
                    Your {TRIAL_DAYS}-day free trial for {schoolName} runs with no charge — cancel any time from your
                    account settings before it ends and you won't be billed.
                  </p>
                  <button onClick={() => navigate(loginUrl || '/login')} className={primaryBtnClass}>Go to Sign In</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet/50 transition-all';
const primaryBtnClass = 'px-6 py-3 bg-slate-900 hover:bg-brand-indigo disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-sm inline-flex items-center justify-center min-w-[140px]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      {children}
    </div>
  );
}
