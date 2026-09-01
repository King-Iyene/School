import { useEffect, useState } from 'react';
import {
  GraduationCap, Check, Menu, X, Users, BarChart2, CreditCard,
  BookOpen, Building2, ShieldCheck, ChevronDown, ArrowRight, Calendar,
  MessageCircle, Bell, CheckCircle2,
} from 'lucide-react';
import { navigate } from '../../components/hooks/useLocation';
import Reveal from '../../components/shared/Reveal';
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

// Angle (degrees) + ring radius (px, at 1024px reference width) for each orbiting icon.
// Kept off the horizontal/vertical axes (where the headline and CTA row are
// widest/tallest) so the badges sit clear of the text at typical widths.
const ORBIT_ICONS: { icon: typeof GraduationCap; angle: number; radius: number }[] = [
  { icon: Users, angle: -22, radius: 410 },
  { icon: CreditCard, angle: 22, radius: 410 },
  { icon: BarChart2, angle: 65, radius: 400 },
  { icon: BookOpen, angle: 115, radius: 400 },
  { icon: ShieldCheck, angle: 158, radius: 410 },
  { icon: Calendar, angle: -158, radius: 410 },
  { icon: Building2, angle: -115, radius: 400 },
  { icon: MessageCircle, angle: -65, radius: 400 },
];

function OrbitField() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="relative w-[860px] h-[860px] max-w-[95vw] max-h-[95vw]">
        <div className="absolute inset-[130px] rounded-full border border-slate-200" />
        <div className="absolute inset-[40px] rounded-full border border-slate-200" />
        <div className="absolute inset-0 rounded-full border border-slate-100" />
        {ORBIT_ICONS.map(({ icon: Icon, angle, radius }, i) => {
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          return (
            <div
              key={i}
              className="absolute w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center"
              style={{ top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: 'translate(-50%, -50%)' }}
            >
              <Icon className="w-4 h-4 text-brand-indigo" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloatingActivityCard() {
  const rows = [
    { icon: CheckCircle2, color: 'text-brand-mint bg-brand-mint/15', title: 'New admission approved', sub: 'JSS1 · 8 min ago' },
    { icon: CreditCard, color: 'text-brand-violet bg-brand-violet/15', title: 'Fee payment received', sub: '₦45,000 · Term 2' },
    { icon: Bell, color: 'text-brand-indigo bg-brand-indigo/10', title: 'Report card published', sub: 'SS2 Science' },
  ];
  return (
    <div className="relative z-10 w-[300px] sm:w-[340px] bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 p-4 space-y-3">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-center gap-3 ${i > 0 ? 'pt-3 border-t border-slate-100' : ''}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.color}`}>
            <r.icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
            <p className="text-xs text-slate-400">{r.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

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

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'School Management SaaS — All-in-One Platform for Schools';
    return () => { document.title = prevTitle; };
  }, []);

  const goToCheckout = (plan: PlanTier) => navigate(`/onboarding?plan=${plan}`);

  return (
    <div className="min-h-screen bg-white text-slate-800 selection:bg-brand-violet/30">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-violet to-brand-indigo flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">SchoolOS</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-brand-indigo transition-colors">Features</a>
            <a href="#pricing" className="hover:text-brand-indigo transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-brand-indigo transition-colors">FAQ</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </button>
            <button
              onClick={() => navigate('/onboarding')}
              className="px-4 py-2 bg-slate-900 hover:bg-brand-indigo text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Get Started Free
            </button>
          </div>
          <button className="md:hidden text-slate-700" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm font-medium text-slate-600">Features</a>
            <a href="#pricing" className="block text-sm font-medium text-slate-600">Pricing</a>
            <a href="#faq" className="block text-sm font-medium text-slate-600">FAQ</a>
            <button onClick={() => navigate('/login')} className="block text-sm font-medium text-slate-600">Sign in</button>
            <button onClick={() => navigate('/onboarding')} className="w-full px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl">
              Get Started Free
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <OrbitField />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-4 sm:pt-28 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-violet/10 border border-brand-violet/20 text-brand-indigo text-xs font-semibold mb-6">
              <GraduationCap className="w-3.5 h-3.5" /> Built for school administrators
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-slate-900">
              The all-in-one platform{' '}
              <br className="hidden sm:block" />
              to run your <span className="text-brand-indigo">school</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg text-slate-500 max-w-xl mx-auto">
              Admissions, attendance, exams, fees, HR, transport, and parent communication —
              one portal, fully hosted, with a plan that fits your school's size.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/onboarding')}
                className="group px-8 py-3.5 bg-slate-900 hover:bg-brand-indigo text-white font-semibold rounded-xl shadow-lg shadow-slate-900/10 transition-colors inline-flex items-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <a href="#pricing" className="px-8 py-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors">
                See Pricing
              </a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={320} className="relative flex justify-center pb-16 sm:pb-24 pt-6">
          <FloatingActivityCard />
        </Reveal>
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
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Simple, transparent pricing</h2>
            <p className="text-slate-500 mt-2">Pick the plan that matches your school's size today — upgrade any time.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {(['starter', 'premium', 'enterprise'] as PlanTier[]).map((tier, i) => {
              const featured = tier === 'premium';
              return (
                <Reveal key={tier} delay={i * 100} className="h-full">
                  <div
                    className={`relative rounded-2xl p-8 pt-9 flex flex-col h-full bg-white transition-all duration-300 hover:-translate-y-1 overflow-hidden ${
                      featured
                        ? 'border-2 border-brand-violet shadow-xl shadow-brand-violet/10 md:scale-[1.03]'
                        : 'border border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {featured && <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-violet to-brand-indigo" />}
                    <h3 className="font-bold text-lg text-slate-800">{PLAN_LABELS[tier]}</h3>
                    <div className="mt-4 mb-1">
                      <span className="text-4xl font-extrabold text-slate-900">
                        {formatNaira(PLAN_PRICES_NGN[tier])}
                      </span>
                      <span className="text-sm text-slate-500"> /month</span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-6">
                      {PLAN_STUDENT_LIMITS[tier] ? `For schools up to ${PLAN_STUDENT_LIMITS[tier]!.toLocaleString()} students` : 'For large & multi-branch schools'}
                    </p>
                    <ul className="space-y-3 flex-1 mb-8">
                      {FEATURE_ROWS.filter(row => row[tier]).map(row => (
                        <li key={row.label} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <span className="w-4 h-4 mt-0.5 rounded bg-brand-violet/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-brand-indigo" />
                          </span>
                          {row.label}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => goToCheckout(tier)}
                      className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                        featured
                          ? 'bg-gradient-to-r from-brand-violet to-brand-indigo hover:brightness-110 text-white shadow-sm'
                          : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      Start 14-Day Free Trial
                    </button>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={80} className="text-center mt-6 text-sm text-slate-400">
            14-day free trial on every plan — your plan price is only charged after the trial, cancel any time before then.
          </Reveal>

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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-violet to-brand-indigo px-8 py-16 text-center">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10" />
            <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-white/10" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white">Ready to modernize your school?</h2>
              <p className="text-white/80 mt-2 mb-8">Get started in minutes — your plan price is only charged after your 14-day trial.</p>
              <button
                onClick={() => navigate('/onboarding')}
                className="px-8 py-3.5 bg-white hover:bg-slate-50 text-brand-indigo font-semibold rounded-xl shadow-lg transition-colors"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        <button onClick={() => navigate('/login')} className="hover:text-slate-600 transition-colors">Sign In</button>
        <span className="mx-2">·</span>
        <span>&copy; {new Date().getFullYear()} SchoolOS. All rights reserved.</span>
      </footer>
    </div>
  );
}