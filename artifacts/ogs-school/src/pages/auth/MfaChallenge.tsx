import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';

const inputClass = 'w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet/50 transition-all';
const primaryBtnClass = 'w-full px-6 py-3 bg-slate-900 hover:bg-brand-indigo disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-sm';

export default function MfaChallenge() {
  const { verifyMfa, cancelMfaChallenge } = useAuth();
  const { settings } = useTenantSettings();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const schoolName = settings.school_name || 'School Portal';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    const { error: err } = await verifyMfa(code.trim());
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-sm bg-gradient-to-br from-brand-violet to-brand-indigo">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Two-Factor Verification</h1>
          <p className="text-slate-500 mt-1">{schoolName}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-lg shadow-slate-900/5">
          <p className="text-sm text-slate-600 mb-5">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className={inputClass}
            />
            <button type="submit" disabled={loading} className={primaryBtnClass}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={() => cancelMfaChallenge()}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back to sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
