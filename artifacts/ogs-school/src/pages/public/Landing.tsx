import { useEffect, useState } from 'react';
import {
  GraduationCap, Check, Menu, X, Users, BarChart2, CreditCard,
  BookOpen, Building2, ShieldCheck, Sparkles, ChevronDown, ArrowRight,
} from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';
import Reveal from '../../components/shared/Reveal';
import GlowBlobs from '../../components/shared/GlowBlobs';
import { PLAN_LABELS, PLAN_STUDENT_LIMITS, PLAN_PRICES_NGN } from '../../lib/planFeatures';
import type { PlanTier } from '../../lib/types';

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

function FaqItem({ item, isOpen, onToggle }: { item: (typeof FAQ)[number]; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`bg-white rounded-2xl border transition-colors ${isOpen ? 'border-brand-violet/40 shadow-sm' : 'border-slate-200'}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 text-left">
        <span className="font-medium text-slate-800 text-sm">{item.q}</span>
        <ChevronDown className={`w-4 h-4 text-brand-violet transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">{item.a}</div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'School Management SaaS — All-in-One Platform for Schools';
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.title = prevTitle;
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const goToCheckout = (plan: PlanTier) => navigate(`/onboarding?plan=${plan}`);

  return (
    <div className="min-h-screen bg-white text-slate-800 selection:bg-brand-violet/30">
      {/* Nav */}
      <header className={`fixed top-0 inset-x-0 z-40 transition-colors duration-300 ${scrolled ? 'bg-brand-ink/90 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center shadow-lg shadow-brand-violet/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white">SchoolOS</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-brand-mint transition-colors">Features</a>
            <a href="#pricing" className="hover:text-brand-mint transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-brand-mint transition-colors">FAQ</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Sign In
            </button>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-4 py-2 bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-violet/20"
            >
              Start Free Trial
            </button>
          </div>
          <button className="md:hidden text-white" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-brand-ink border-t border-white/10 px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm font-medium text-slate-300">Features</a>
            <a href="#pricing" className="block text-sm font-medium text-slate-300">Pricing</a>
            <a href="#faq" className="block text-sm font-medium text-slate-300">FAQ</a>
            <button onClick={() => navigate('/login')} className="block text-sm font-medium text-slate-300">Sign In</button>
            <button onClick={() => navigate('/onboarding')} className="w-full px-4 py-2 bg-gradient-to-r from-brand-violet to-brand-indigo text-white text-sm font-semibold rounded-xl">
              Start Free Trial
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-ink">
        <GlowBlobs />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-24 sm:pt-40 sm:pb-32 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-brand-mint text-xs font-semibold mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" /> Now onboarding schools across Nigeria
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
              <span className="text-white">The all-in-one platform</span>
              <br className="hidden sm:block" />
              <span
                className="bg-clip-text text-transparent bg-[length:200%_auto] bg-gradient-to-r from-brand-mint via-brand-violet to-brand-mint animate-brand-gradient-x"
              >
                to run your school
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
              Admissions, attendance, exams, fees, HR, transport, and parent communication —
              one portal, fully hosted, with a plan that fits your school's size.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/onboarding')}
                className="group px-8 py-3.5 bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 text-white font-semibold rounded-xl shadow-lg shadow-brand-violet/25 transition-all animate-brand-glow-pulse inline-flex items-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <a href="#pricing" className="px-8 py-3.5 border border-white/15 hover:border-white/30 hover:bg-white/5 text-white font-semibold rounded-xl transition-colors">
                See Pricing
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900">Everything your school needs</h2>
          <p className="text-slate-500 mt-2">One platform, from admissions to graduation.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Users, title: 'Student & Staff Records', desc: 'Admissions, enrollment, attendance, and full academic history in one place.' },
            { icon: BarChart2, title: 'Exams & Report Cards', desc: 'Grading, marks registers, CBT auto-grading, and printable report cards.' },
            { icon: CreditCard, title: 'Fees & Payments', desc: 'Fee structures, online collections, invoices, and financial reporting.' },
            { icon: BookOpen, title: 'Library & Lesson Plans', desc: 'Book issuing, syllabus tracking, and structured lesson planning for teachers.' },
            { icon: Building2, title: 'HR, Transport & Hostel', desc: 'Payroll, leave management, transport routes, and dormitory allocation.' },
            { icon: ShieldCheck, title: 'Secure Multi-Tenant', desc: 'Every school’s data is isolated with bank-grade row-level security.' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="group h-full p-6 rounded-2xl border border-slate-100 hover:border-brand-violet/30 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-violet/10 transition-all duration-300 bg-white">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-violet/15 to-brand-mint/15 flex items-center justify-center mb-4 group-hover:from-brand-violet/25 group-hover:to-brand-mint/25 transition-colors">
                  <f.icon className="w-5 h-5 text-brand-indigo" />
                </div>
                <h3 className="font-semibold text-slate-800">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative bg-brand-ink py-20 overflow-hidden">
        <GlowBlobs />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white">Simple, transparent pricing</h2>
            <p className="text-slate-400 mt-2">Pick the plan that matches your school's size today — upgrade any time.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {(['starter', 'premium', 'enterprise'] as PlanTier[]).map((tier, i) => {
              const featured = tier === 'premium';
              return (
                <Reveal key={tier} delay={i * 100} className="h-full">
                  <div
                    className={`relative rounded-2xl p-8 flex flex-col h-full transition-transform duration-300 hover:-translate-y-1 ${
                      featured
                        ? 'bg-brand-ink-light text-white shadow-2xl shadow-brand-violet/20 md:scale-[1.04] border border-brand-violet/40 ring-1 ring-brand-violet/30'
                        : 'bg-white/5 backdrop-blur-sm border border-white/10 text-white'
                    }`}
                  >
                    {featured && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-violet to-brand-indigo text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                        MOST POPULAR
                      </span>
                    )}
                    <h3 className="font-bold text-lg text-white">{PLAN_LABELS[tier]}</h3>
                    <p className="text-sm mt-1 text-slate-400">
                      {PLAN_STUDENT_LIMITS[tier] ? `Up to ${PLAN_STUDENT_LIMITS[tier]!.toLocaleString()} students` : 'Unlimited students & staff'}
                    </p>
                    <div className="mt-5 mb-6">
                      <span className="text-4xl font-extrabold text-white">
                        {formatNaira(PLAN_PRICES_NGN[tier])}
                      </span>
                      <span className="text-sm text-slate-400"> /month</span>
                    </div>
                    <ul className="space-y-3 flex-1 mb-8">
                      {FEATURE_ROWS.filter(row => row[tier]).map(row => (
                        <li key={row.label} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${featured ? 'text-brand-mint' : 'text-brand-violet'}`} />
                          {row.label}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => goToCheckout(tier)}
                      className={`w-full py-3 rounded-xl font-semibold transition-all ${
                        featured
                          ? 'bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 text-white shadow-lg shadow-brand-violet/25'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                      }`}
                    >
                      Subscribe Now
                    </button>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Full comparison grid */}
          <Reveal delay={150} className="mt-16 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left font-semibold text-slate-700 p-4">Feature</th>
                  {(['starter', 'premium', 'enterprise'] as PlanTier[]).map(t => (
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
                        {row[t] ? <Check className="w-4 h-4 text-brand-indigo mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900">Trusted by school administrators</h2>
        </Reveal>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { name: 'School Administrator', role: 'Premium Plan', quote: 'Onboarding took a single afternoon — fees, exams and attendance were live by the following week.' },
            { name: 'School Administrator', role: 'Enterprise Plan', quote: 'Managing payroll, transport and three campuses from one dashboard has been transformative.' },
            { name: 'School Administrator', role: 'Starter Plan', quote: 'Exactly what a small school needed — simple, affordable, and it just works.' },
          ].map((t, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="h-full p-6 rounded-2xl border border-slate-100 bg-gradient-to-br from-brand-mint/5 to-brand-violet/5 hover:shadow-lg hover:shadow-brand-violet/10 transition-shadow duration-300">
                <p className="text-slate-600 text-sm leading-relaxed">"{t.quote}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center text-white font-bold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Frequently asked questions</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 60}>
                <FaqItem item={item} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative bg-brand-ink py-20 overflow-hidden">
        <GlowBlobs />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold text-white">Ready to modernize your school?</h2>
            <p className="text-slate-400 mt-2 mb-8">Get started in minutes — no credit card required for the trial.</p>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-8 py-3.5 bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 text-white font-semibold rounded-xl shadow-lg shadow-brand-violet/25 transition-all"
            >
              Start Free Trial
            </button>
          </Reveal>
        </div>
      </section>

      <footer className="bg-brand-ink border-t border-white/10 py-8 text-center text-sm text-slate-500">
        <button onClick={() => navigate('/login')} className="hover:text-slate-300 transition-colors">Sign In</button>
        <span className="mx-2">·</span>
        <span>&copy; {new Date().getFullYear()} SchoolOS. All rights reserved.</span>
      </footer>
    </div>
  );
}
