import { useEffect, useState } from 'react';
import {
  GraduationCap, Check, Menu, X, Users, BarChart2, CreditCard,
  BookOpen, Building2, ShieldCheck, Sparkles, ChevronDown,
} from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';
import { PLAN_LABELS, PLAN_STUDENT_LIMITS, PLAN_PRICES_NGN } from '../../lib/planFeatures';
import type { PlanTier as PlanTierType } from '../../lib/types';

const FEATURE_ROWS: { label: string; starter: boolean; premium: boolean; enterprise: boolean }[] = [
  { label: 'Core academics, attendance & report cards', starter: true, premium: true, enterprise: true },
  { label: 'Student & parent portal access', starter: true, premium: true, enterprise: true },
  { label: 'Up to 250 / 1,000 / unlimited students', starter: true, premium: true, enterprise: true },
  { label: 'Online payment gateway collections', starter: false, premium: true, enterprise: true },
  { label: 'CBT exam engine & auto-grading', starter: false, premium: true, enterprise: true },
  { label: 'Lesson plan workflow', starter: false, premium: true, enterprise: true },
  { label: 'Library & inventory store', starter: false, premium: true, enterprise: true },
  { label: 'Bulk printing (ID cards, certificates, payroll)', starter: false, premium: true, enterprise: true },
  { label: 'SMS / email broadcasts', starter: false, premium: true, enterprise: true },
  { label: 'HR, payroll & full financial accounting', starter: false, premium: false, enterprise: true },
  { label: 'Hostel / dormitory management', starter: false, premium: false, enterprise: true },
  { label: 'Transport route management', starter: false, premium: false, enterprise: true },
  { label: 'Campus security & gate pass', starter: false, premium: false, enterprise: true },
  { label: 'Multi-branch super-admin oversight', starter: false, premium: false, enterprise: true },
  { label: 'Custom white-labeling & custom domain', starter: false, premium: false, enterprise: true },
];

const FAQ = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes — upgrade or downgrade at any time from the Super Admin billing panel. Changes apply on your next billing cycle, and locked modules unlock immediately after an upgrade.',
  },
  {
    q: 'What happens if I exceed my student limit?',
    a: 'You will be prompted to upgrade before new students can be admitted past your plan’s limit. Existing student records are never locked or deleted.',
  },
  {
    q: 'Do you support a custom domain?',
    a: 'Custom domains (e.g. portal.yourschool.com) and full white-labeling are available on the Enterprise plan.',
  },
  {
    q: 'Is my school’s data isolated from other schools?',
    a: 'Yes — every school is a fully isolated tenant at the database level with row-level security. No school can ever see another school’s records.',
  },
];

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`;
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'School Management SaaS — All-in-One Platform for Schools';
    return () => { document.title = prevTitle; };
  }, []);

  const goToCheckout = (plan: PlanTierType) => navigate(`/onboarding?plan=${plan}`);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">SchoolOS</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-emerald-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-emerald-600 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-emerald-600 transition-colors">FAQ</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </button>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Start Free Trial
            </button>
          </div>
          <button className="md:hidden text-slate-600" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm font-medium text-slate-600">Features</a>
            <a href="#pricing" className="block text-sm font-medium text-slate-600">Pricing</a>
            <a href="#faq" className="block text-sm font-medium text-slate-600">FAQ</a>
            <button onClick={() => navigate('/login')} className="block text-sm font-medium text-slate-600">Sign In</button>
            <button onClick={() => navigate('/onboarding')} className="w-full px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl">
              Start Free Trial
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Now onboarding schools across Nigeria
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            The all-in-one platform<br className="hidden sm:block" /> to run your school
          </h1>
          <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto">
            Admissions, attendance, exams, fees, HR, transport, and parent communication —
            one portal, fully hosted, with a plan that fits your school's size.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/onboarding')}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-colors"
            >
              Start Free Trial
            </button>
            <a href="#pricing" className="px-8 py-3.5 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold rounded-xl transition-colors">
              See Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900">Everything your school needs</h2>
          <p className="text-slate-500 mt-2">One platform, from admissions to graduation.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Users, title: 'Student & Staff Records', desc: 'Admissions, enrollment, attendance, and full academic history in one place.' },
            { icon: BarChart2, title: 'Exams & Report Cards', desc: 'Grading, marks registers, CBT auto-grading, and printable report cards.' },
            { icon: CreditCard, title: 'Fees & Payments', desc: 'Fee structures, online collections, invoices, and financial reporting.' },
            { icon: BookOpen, title: 'Library & Lesson Plans', desc: 'Book issuing, syllabus tracking, and structured lesson planning for teachers.' },
            { icon: Building2, title: 'HR, Transport & Hostel', desc: 'Payroll, leave management, transport routes, and dormitory allocation.' },
            { icon: ShieldCheck, title: 'Secure Multi-Tenant', desc: 'Every school’s data is isolated with bank-grade row-level security.' },
          ].map(f => (
            <div key={f.title} className="p-6 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all bg-white">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800">{f.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Simple, transparent pricing</h2>
            <p className="text-slate-500 mt-2">Pick the plan that matches your school's size today — upgrade any time.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(['starter', 'premium', 'enterprise'] as PlanTierType[]).map(tier => {
              const featured = tier === 'premium';
              return (
                <div
                  key={tier}
                  className={`relative rounded-2xl p-8 flex flex-col ${
                    featured
                      ? 'bg-slate-900 text-white shadow-2xl scale-[1.03] border border-slate-800'
                      : 'bg-white border border-slate-200 shadow-sm'
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  )}
                  <h3 className={`font-bold text-lg ${featured ? 'text-white' : 'text-slate-800'}`}>{PLAN_LABELS[tier]}</h3>
                  <p className={`text-sm mt-1 ${featured ? 'text-slate-400' : 'text-slate-500'}`}>
                    {PLAN_STUDENT_LIMITS[tier] ? `Up to ${PLAN_STUDENT_LIMITS[tier]!.toLocaleString()} students` : 'Unlimited students & staff'}
                  </p>
                  <div className="mt-5 mb-6">
                    <span className={`text-4xl font-extrabold ${featured ? 'text-white' : 'text-slate-900'}`}>
                      {formatNaira(PLAN_PRICES_NGN[tier])}
                    </span>
                    <span className={`text-sm ${featured ? 'text-slate-400' : 'text-slate-500'}`}> /month</span>
                  </div>
                  <ul className="space-y-3 flex-1 mb-8">
                    {FEATURE_ROWS.filter(row => row[tier]).map(row => (
                      <li key={row.label} className={`flex items-start gap-2 text-sm ${featured ? 'text-slate-200' : 'text-slate-600'}`}>
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${featured ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        {row.label}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => goToCheckout(tier)}
                    className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                      featured
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    Subscribe Now
                  </button>
                </div>
              );
            })}
          </div>

          {/* Full comparison grid */}
          <div className="mt-16 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-semibold text-slate-700 p-4">Feature</th>
                  {(['starter', 'premium', 'enterprise'] as PlanTierType[]).map(t => (
                    <th key={t} className="text-center font-semibold text-slate-700 p-4">{PLAN_LABELS[t]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? 'bg-slate-50/50' : ''}>
                    <td className="p-4 text-slate-600">{row.label}</td>
                    {(['starter', 'premium', 'enterprise'] as const).map(t => (
                      <td key={t} className="text-center p-4">
                        {row[t] ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900">Trusted by school administrators</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { name: 'School Administrator', role: 'Premium Plan', quote: 'Onboarding took a single afternoon — fees, exams and attendance were live by the following week.' },
            { name: 'School Administrator', role: 'Enterprise Plan', quote: 'Managing payroll, transport and three campuses from one dashboard has been transformative.' },
            { name: 'School Administrator', role: 'Starter Plan', quote: 'Exactly what a small school needed — simple, affordable, and it just works.' },
          ].map((t, i) => (
            <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-slate-50">
              <p className="text-slate-600 text-sm leading-relaxed">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={item.q} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium text-slate-800 text-sm">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Ready to modernize your school?</h2>
        <p className="text-slate-500 mt-2 mb-8">Get started in minutes — no credit card required for the trial.</p>
        <button
          onClick={() => navigate('/onboarding')}
          className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-colors"
        >
          Start Free Trial
        </button>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        <button onClick={() => navigate('/login')} className="hover:text-slate-600 transition-colors">Sign In</button>
        <span className="mx-2">·</span>
        <span>&copy; {new Date().getFullYear()} SchoolOS. All rights reserved.</span>
      </footer>
    </div>
  );
}
