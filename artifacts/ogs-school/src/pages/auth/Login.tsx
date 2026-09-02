import { useState } from 'react';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { supabase } from '../../lib/supabase';

// NOTE: student accounts are provisioned with a deterministic
// `<admission-number>@student.okrika.edu.ng` identity. This is left as a
// fixed suffix (rather than derived per-tenant) because changing it would
// break sign-in for every already-provisioned student account on the live
// Okrika tenant. Before onboarding a second school, give each tenant its own
// student email domain (e.g. stored on tenant_settings) and provision new
// student accounts with it — this suffix should not simply be templated
// from the tenant slug without a data migration for existing users.
const LEGACY_STUDENT_EMAIL_DOMAIN = 'student.okrika.edu.ng';

const inputClass = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet/50 transition-all';
const primaryBtnClass = 'w-full px-6 py-3 bg-slate-900 hover:bg-brand-indigo disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-sm';

const ROLE_BADGES: { label: string; className: string }[] = [
  { label: 'Super Admin', className: 'bg-red-50 text-red-600 border-red-200' },
  { label: 'Principal', className: 'bg-orange-50 text-orange-600 border-orange-200' },
  { label: 'Teacher', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  { label: 'Student', className: 'bg-brand-mint/10 text-brand-indigo border-brand-mint/30' },
  { label: 'Parent', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  { label: 'Accountant', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  { label: 'Security Officer', className: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
];

export default function Login() {
  const { signIn } = useAuth();
  const { settings } = useTenantSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const logoUrl = settings.logo_url || null;
  const schoolName = settings.school_name || 'School Portal';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Transparently proxy raw student admission numbers into deterministic Supabase identities
    let loginIdentifier = email.trim().toLowerCase();
    if (!loginIdentifier.includes('@')) {
      loginIdentifier = `${loginIdentifier}@${LEGACY_STUDENT_EMAIL_DOMAIN}`;
    }

    const { error } = await signIn(loginIdentifier, password);
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const target = email.trim().toLowerCase();
    if (!target.includes('@')) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    setResetLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: window.location.origin,
    });
    setResetLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-sm overflow-hidden ${!logoUrl ? 'bg-gradient-to-br from-brand-violet to-brand-indigo' : 'bg-white border border-slate-200'}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <GraduationCap className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{schoolName}</h1>
          <p className="text-slate-500 mt-1">School Management System</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-lg shadow-slate-900/5">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            {forgotMode ? (resetSent ? 'Check your email' : 'Reset your password') : 'Sign in to your account'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {forgotMode ? (
            resetSent ? (
              <div className="text-center py-4">
                <p className="text-slate-500 text-sm">
                  If an account exists for that address, a password reset link has been sent.
                </p>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setResetSent(false); setError(''); }}
                  className="mt-4 text-sm text-brand-indigo hover:underline font-medium"
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your account email"
                    required
                    className={inputClass}
                  />
                </div>
                <button type="submit" disabled={resetLoading} className={primaryBtnClass}>
                  {resetLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(''); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Back to sign in
                </button>
              </form>
            )
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email or Admission Number</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Admission number or email address"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={primaryBtnClass}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="text-right">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(''); }}
                className="text-sm text-slate-500 hover:text-brand-indigo transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Contact your administrator if you have trouble accessing your account
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-center text-slate-400 text-xs mb-3">Portal access based on assigned role</p>
          <div className="flex flex-wrap justify-center gap-2">
            {ROLE_BADGES.map(role => (
              <div key={role.label} className={`text-xs py-1.5 px-3 rounded-full border font-medium whitespace-nowrap ${role.className}`}>
                {role.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
