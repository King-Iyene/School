import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Smartphone, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

const inputClass = 'bg-app-surface text-app-text w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30';

export default function AccountSecurity() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const verifiedFactor = factors.find(f => f.status === 'verified') ?? null;

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as TotpFactor[]);
    setLoading(false);
  }

  async function startEnroll() {
    setError('');
    setMessage('');
    setBusy(true);

    // Clear out any abandoned, never-verified enrollment attempts before starting a new one.
    const unverified = factors.filter(f => f.status !== 'verified');
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setBusy(false);
    if (err || !data) { setError(err?.message ?? 'Could not start two-factor setup.'); return; }
    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enrollData) return;
    if (code.trim().length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setError('');
    setBusy(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (challengeErr) { setBusy(false); setError(challengeErr.message); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyErr) { setError(verifyErr.message); return; }
    setEnrollData(null);
    setCode('');
    setMessage('Two-factor authentication is now enabled on your account.');
    loadFactors();
  }

  function cancelEnroll() {
    if (enrollData) supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    setEnrollData(null);
    setCode('');
    setError('');
  }

  async function disable() {
    if (!verifiedFactor) return;
    if (!confirm('Turn off two-factor authentication? Your account will only be protected by your password.')) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setMessage('Two-factor authentication has been turned off.');
    loadFactors();
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-app-text-muted">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        Loading security settings…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 pb-16">
      <div>
        <h1 className="text-xl font-bold text-app-text">Account Security</h1>
        <p className="text-sm text-app-text-muted mt-1">Manage two-factor authentication for your account.</p>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${verifiedFactor ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-app-text-muted'}`}>
            {verifiedFactor ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-app-text">Two-Factor Authentication</p>
            <p className="text-xs text-app-text-muted mt-0.5">
              {verifiedFactor
                ? 'Enabled — a code from your authenticator app is required at sign-in.'
                : 'Not enabled — add an extra layer of security to your account.'}
            </p>
          </div>
        </div>

        {!enrollData && (
          verifiedFactor ? (
            <button
              onClick={disable}
              disabled={busy}
              className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              Turn Off Two-Factor Authentication
            </button>
          ) : (
            <button
              onClick={startEnroll}
              disabled={busy}
              className="px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {busy ? 'Starting...' : 'Enable Two-Factor Authentication'}
            </button>
          )
        )}

        {enrollData && (
          <div className="border-t border-app-border pt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-app-text mb-2 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" /> 1. Scan this QR code with your authenticator app
              </p>
              <p className="text-xs text-app-text-muted mb-3">
                Use Google Authenticator, Microsoft Authenticator, Authy, or any TOTP-compatible app.
              </p>
              <div className="bg-white rounded-xl border border-app-border p-4 inline-block">
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollData.qrCode)}`}
                  alt="Two-factor authentication QR code"
                  className="w-40 h-40"
                />
              </div>
              <p className="text-xs text-app-text-muted mt-2">
                Can't scan? Enter this code manually: <code className="bg-app-surface-alt px-1.5 py-0.5 rounded text-app-text">{enrollData.secret}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-1 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" /> 2. Enter the 6-digit code from the app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className={`${inputClass} max-w-[160px] text-center tracking-widest`}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelEnroll}
                className="flex-1 px-4 py-2.5 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEnroll}
                disabled={busy || code.length !== 6}
                className="flex-1 px-4 py-2.5 bg-app-primary hover:opacity-90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {busy ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
