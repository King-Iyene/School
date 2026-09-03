import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';
import { useTenantSettings } from '../../context/TenantContext';
import { CheckCircle, AlertCircle, Copy, Check, Building2, ClipboardList } from 'lucide-react';

const WHATSAPP_NUMBER = '2348012345678'; // ← update to school's WhatsApp number

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { fbq?: (...args: any[]) => void; } }
const track = (event: string, data?: Record<string, unknown>) => window.fbq?.('track', event, data);

function WhatsAppFAB({ schoolName }: { schoolName: string }) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello, I have a question about admission to ${schoolName}.`)}`}
      target="_blank" rel="noopener noreferrer" title="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
      style={{ padding: '12px 18px 12px 14px' }}
    >
      <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      <span className="text-sm font-semibold whitespace-nowrap max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out">Chat with us</span>
    </a>
  );
}

function getParams() {
  const p = getSearchParams();
  return {
    id:    p.get('id')    ?? '',
    ref:   p.get('ref')   ?? '',
    email: p.get('email') ?? '',
    name:  p.get('name')  ?? '',
  };
}

export default function AdmissionPayment() {
  const { settings } = useTenantSettings();
  const { id, ref, email, name } = getParams();
  const [applicationRef, setApplicationRef] = useState(ref);
  const [confirming, setConfirming]         = useState(false);
  const [confirmed, setConfirmed]           = useState(false);
  const [error, setError]                   = useState('');
  const [copied, setCopied]                 = useState<string | null>(null);

  useEffect(() => {
    if (!id && ref) setApplicationRef(ref);
    if (!id) setError('Invalid application link. Please resubmit your application.');
    // Fire InitiateCheckout when applicant reaches the payment page
    track('InitiateCheckout', { content_name: 'Admission Application Fee', value: 5000, currency: 'NGN' });
  }, []);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function confirmPayment() {
    if (!id) return;
    setConfirming(true);
    setError('');
    try {
      await supabase.from('prospective_students').update({ payment_status: 'pending_verification' }).eq('id', id);
    } catch (_) { /* non-critical — proceed anyway */ }
    setConfirmed(true);
    setConfirming(false);
  }

  /* ── Success screen ───────────────────────────────────────────────────── */
  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Payment Submitted!</h2>
          <p className="text-slate-500 text-sm mb-1">
            Application Ref: <span className="font-mono font-bold text-slate-700">{applicationRef}</span>
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Thank you. Our admissions team will verify your bank transfer and contact you at{' '}
            <span className="font-semibold text-slate-700">{decodeURIComponent(email)}</span> with next steps within 24 hours.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-sm mb-6 space-y-2">
            <p className="text-slate-500 text-xs font-semibold uppercase mb-1">What happens next</p>
            <div className="flex items-start gap-2 text-slate-600"><span className="text-emerald-500 font-bold mt-0.5">1.</span> Admissions verifies your ₦5,000 transfer</div>
            <div className="flex items-start gap-2 text-slate-600"><span className="text-emerald-500 font-bold mt-0.5">2.</span> You receive an invitation to the entrance exam</div>
            <div className="flex items-start gap-2 text-slate-600"><span className="text-emerald-500 font-bold mt-0.5">3.</span> Sit the exam, then a brief Principal's interview</div>
            <div className="flex items-start gap-2 text-slate-600"><span className="text-emerald-500 font-bold mt-0.5">4.</span> Admission decision communicated to you</div>
          </div>
          <button
            onClick={() => navigate(`/application-status`)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-semibold transition-colors shadow-sm"
          >
            Track Application Status
          </button>
          <p className="text-xs text-slate-400 mt-3">Keep your Application Ref <span className="font-mono font-bold">{applicationRef}</span> safe.</p>
        </div>
      </div>
    );
  }

  /* ── Payment instruction screen ───────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <img src={settings.logo_url || '/default-logo.png'} alt={`${settings.school_name} Logo`} className="w-10 h-10 object-contain rounded-lg bg-white/20 p-1" />
            <div>
              <p className="text-white font-bold">{settings.school_name}</p>
              <p className="text-emerald-100 text-sm">Admission Application Fee</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}

          {/* Application summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Applicant</span>
              <span className="font-semibold text-slate-800">{decodeURIComponent(name)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Application Ref</span>
              <span className="font-mono font-bold text-slate-700">{applicationRef}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
              <span className="text-sm font-semibold text-slate-700">Amount to Pay</span>
              <span className="text-2xl font-extrabold text-emerald-600">₦5,000</span>
            </div>
          </div>

          {/* Bank details */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Bank Transfer Details
            </p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 divide-y divide-emerald-100 overflow-hidden">

              {/* Bank name */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-slateald-400 text-slate-500">Bank</p>
                  <p className="font-bold text-slate-800">Ecobank Nigeria</p>
                </div>
              </div>

              {/* Account number */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-slate-500">Account Number</p>
                  <p className="font-mono text-xl font-extrabold text-slate-900 tracking-widest">0562040932</p>
                </div>
                <button
                  onClick={() => copyText('0562040932', 'acct')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  {copied === 'acct' ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>

              {/* Account name */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-slate-500">Account Name</p>
                  <p className="font-semibold text-slate-800 text-sm">{settings.school_name}</p>
                </div>
              </div>

            </div>
          </div>

          {/* Use ref as narration */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <ClipboardList className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Important:</span> Use your application reference{' '}
              <span
                className="font-mono font-bold cursor-pointer underline decoration-dotted"
                onClick={() => copyText(applicationRef, 'ref')}
                title="Click to copy"
              >
                {applicationRef}
              </span>
              {copied === 'ref' && <span className="text-amber-600 ml-1 text-xs">✓ Copied</span>}
              {' '}as the <span className="font-semibold">payment narration / description</span> when making the transfer so we can identify your payment.
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2 text-sm text-slate-600">
            {[
              'Transfer ₦5,000 to the account above',
              'Use your Application Ref as the narration / description',
              'Click \u201cI\u2019ve Made the Payment\u201d below',
              'We\u2019ll verify and contact you within 24 hours',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-emerald-600 font-bold text-xs">{i + 1}</span>
                </div>
                {s}
              </div>
            ))}
          </div>

          {/* Confirm button */}
          <button
            onClick={confirmPayment}
            disabled={confirming || !id}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-semibold transition-colors shadow-sm disabled:opacity-60"
          >
            {confirming ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle className="w-5 h-5" /> I've Made the Payment</>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Questions? Call or WhatsApp the admissions office.
          </p>
        </div>
      </div>
      <WhatsAppFAB schoolName={settings.school_name} />
    </div>
  );
}
