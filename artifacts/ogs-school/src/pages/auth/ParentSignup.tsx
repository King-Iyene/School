import { useState, useEffect } from 'react';
import { Eye, EyeOff, GraduationCap, CheckCircle, ArrowLeft, User, Mail, Phone, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../components/hooks/useLocation';

export default function ParentSignup() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('Okrika Grammar School');
  const [schoolId, setSchoolId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('schools').select('id, name, logo_url').limit(1).maybeSingle().then(({ data }) => {
      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.name) setSchoolName(data.name);
      if (data?.id) setSchoolId(data.id);
    });
  }, []);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Please enter your full name.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);

    // Ensure we have the school ID — fetch fresh if not yet loaded
    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId) {
      const { data: schoolData } = await supabase.from('schools').select('id').limit(1).maybeSingle();
      resolvedSchoolId = schoolData?.id ?? null;
      if (resolvedSchoolId) setSchoolId(resolvedSchoolId);
    }

    let authData: any = null;
    let signUpError: any = null;

    try {
      const result = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            role: 'parent',
            phone: form.phone.trim(),
            school_id: resolvedSchoolId,
          },
        },
      });
      authData = result.data;
      signUpError = result.error;
    } catch (networkErr: any) {
      setLoading(false);
      setError('Network error: Could not reach the server. Please check your connection and try again. (' + (networkErr?.message ?? 'Failed to fetch') + ')');
      return;
    }

    if (signUpError) {
      setLoading(false);
      const msg: string = signUpError.message ?? '';
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (msg.includes('Signups not allowed') || msg.includes('signup') || msg.includes('disabled')) {
        setError('New registrations are currently disabled. Please contact the school administrator.');
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
      return;
    }

    // If a session was returned immediately (email confirmation disabled),
    // upsert the profile with all details including phone.
    // If no session (email confirmation required), the DB trigger handles profile creation.
    const userId = authData.user?.id;
    const hasSession = !!authData.session;
    if (userId && hasSession) {
      await supabase.from('profiles').upsert({
        id: userId,
        school_id: resolvedSchoolId,
        role: 'parent',
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        is_active: true,
      }, { onConflict: 'id' });
    }

    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">You're registered!</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-2">
              Your parent account has been created for <strong className="text-slate-200">{schoolName}</strong>.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              An administrator will link your account to your ward. Once that's done, you'll be able to sign in and view your child's attendance, results, and more.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 shadow-lg overflow-hidden ${!logoUrl ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-white/10 backdrop-blur-md border border-white/10'}`}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <GraduationCap className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white">{schoolName}</h1>
          <p className="text-slate-400 text-sm mt-1">Parent Portal Registration</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Create a parent account</h2>
          <p className="text-slate-400 text-sm mb-5">Fill in your details to register. An admin will link you to your ward after sign-up.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => set('firstName', e.target.value)}
                    placeholder="John"
                    required
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => set('lastName', e.target.value)}
                  placeholder="Doe"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number <span className="text-slate-600">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={e => set('confirm', e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/25 mt-2"
            >
              {loading ? 'Creating account...' : 'Create Parent Account'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-white/10 text-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Already have an account? Sign in
            </button>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          After registering, an administrator will link your account to your child's profile.
        </p>
      </div>
    </div>
  );
}
