import { useState, useEffect } from 'react';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../components/hooks/useLocation';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('Okrika Grammar School');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);


  useEffect(() => {
    supabase
      .from('schools')
      .select('name, logo_url')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
        if (data?.name) setSchoolName(data.name);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Transparently proxy raw student admission numbers into deterministic Supabase identities
    let loginIdentifier = email.trim().toLowerCase();
    if (!loginIdentifier.includes('@')) {
      loginIdentifier = `${loginIdentifier}@student.okrika.edu.ng`;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 shadow-lg overflow-hidden ${!logoUrl ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-white/10 backdrop-blur-md border border-white/10'}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <GraduationCap className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-white">{schoolName}</h1>
          <p className="text-slate-400 mt-1">School Management System</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {forgotMode ? (
            resetSent ? (
              <div className="text-center py-4">
                <p className="text-emerald-300 font-medium text-sm">Check your email</p>
                <p className="text-slate-400 text-sm mt-2">
                  If an account exists for that address, a password reset link has been sent.
                </p>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setResetSent(false); setError(''); }}
                  className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your account email"
                    required
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/25"
                >
                  {resetLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(''); }}
                  className="w-full text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Back to sign in
                </button>
              </form>
            )
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email or Admission Number</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. OGS-YYYY-XXX or example@okrika.edu.ng"
                required
                className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/25"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="text-right">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(''); }}
                className="text-sm text-slate-400 hover:text-emerald-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </form>
          )}

          <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
            <p className="text-xs text-slate-500 text-center">
              Contact your administrator if you have trouble accessing your account
            </p>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/parent-signup')}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Parent? Create an account →
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-center text-slate-500 text-xs mb-3">Portal access based on assigned role</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Super Admin', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
              { label: 'Principal', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
              { label: 'Teacher', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
              { label: 'Student', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
              { label: 'Parent', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
              { label: 'Accountant', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
              { label: 'Security Officer', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
            ].map(role => (
              <div key={role.label} className={`text-xs py-1.5 px-3 rounded-full border font-medium whitespace-nowrap ${role.color}`}>
                {role.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
