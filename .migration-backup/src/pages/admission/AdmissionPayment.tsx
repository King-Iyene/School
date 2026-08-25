import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';
import { CreditCard, CheckCircle, AlertCircle, Loader } from 'lucide-react';

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

function getParams() {
  const p = getSearchParams();
  return {
    id: p.get('id') ?? '',
    ref: p.get('ref') ?? '',
    email: p.get('email') ?? '',
    name: p.get('name') ?? '',
  };
}

const PAYSTACK_SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.PaystackPop) { resolve(); return; }
    // Script tag already added — wait for it
    const existing = document.querySelector(`script[src="${PAYSTACK_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Paystack script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack. Check your internet connection.'));
    document.head.appendChild(script);
  });
}

export default function AdmissionPayment() {
  const { id, ref, email, name } = getParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [applicationRef, setApplicationRef] = useState(ref);
  const [paystackReady, setPaystackReady] = useState(false);

  useEffect(() => {
    if (!id || !email) {
      setStatus('error');
      setErrorMsg('Invalid application link. Please resubmit your application.');
      return;
    }
    loadPaystackScript()
      .then(() => setPaystackReady(true))
      .catch((err) => setErrorMsg(err.message));
  }, []);

  async function initiatePayment() {
    if (!window.PaystackPop) {
      setErrorMsg('Payment system not ready. Please wait a moment and try again.');
      return;
    }
    const paystackRef = `ADM-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    await supabase.from('admission_payments').insert({
      prospective_student_id: id,
      paystack_reference: paystackRef,
      amount: 1000000,
      status: 'pending',
    });

    setStatus('loading');

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ?? '',
      email: email,
      amount: 1000000,
      currency: 'NGN',
      ref: paystackRef,
      metadata: {
        custom_fields: [
          { display_name: 'Applicant Name', variable_name: 'applicant_name', value: name },
          { display_name: 'Application Ref', variable_name: 'application_ref', value: applicationRef },
        ],
      },
      onClose: () => {
        setStatus('idle');
        setErrorMsg('Payment was cancelled. Please try again to complete your application.');
      },
      // Must be a plain function — Paystack v1 uses [object Function] check which rejects async functions
      callback: function(response: { reference: string }) {
        setStatus('verifying');
        Promise.resolve(
          supabase.rpc('final_update_admission_payment', {
            reference_param: response.reference,
            status_param: 'success',
            verified_at_param: new Date().toISOString()
          })
        )
          .then(() => supabase.rpc('final_update_prospective_student', {
            uuid_param: id,
            status_param: 'paid'
          }))
          .then(() => setStatus('success'))
          .catch(() => setStatus('success'));
      },
    });

    handler.openIframe();
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Payment Successful!</h2>
          <p className="text-slate-500 text-sm mb-1">Application Ref: <span className="font-mono font-bold text-slate-700">{applicationRef}</span></p>
          <p className="text-slate-500 text-sm mb-6">Your application fee of <strong>₦10,000</strong> has been received. The next step is to schedule your admission examination.</p>
          <button onClick={() => navigate(`/schedule-exam?id=${id}&ref=${applicationRef}`)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-semibold transition-colors shadow-sm">
            Schedule Admission Exam
          </button>
          <p className="text-xs text-slate-400 mt-4">A confirmation has been noted. Please keep your Application Ref safe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <img src="/ogs_logo_bg.png" alt="OGS Logo" className="w-10 h-10 object-contain rounded-lg bg-white/20 p-1" />
            <div>
              <p className="text-white font-bold">Okrika Grammar School</p>
              <p className="text-emerald-100 text-sm">Admission Application Fee</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">Applicant</span>
              <span className="text-sm font-semibold text-slate-800">{decodeURIComponent(name)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">Application Ref</span>
              <span className="font-mono text-sm font-bold text-slate-700">{applicationRef}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
              <span className="text-sm font-semibold text-slate-700">Application Fee</span>
              <span className="text-xl font-bold text-emerald-600">₦10,000</span>
            </div>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold text-xs">1</span>
              </div>
              Pay ₦10,000 application fee via Paystack
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-slate-500 font-bold text-xs">2</span>
              </div>
              Schedule your admission examination
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-slate-500 font-bold text-xs">3</span>
              </div>
              Receive exam details via email on exam day
            </div>
          </div>

          <button
            onClick={initiatePayment}
            disabled={status === 'loading' || status === 'verifying' || !id || !paystackReady}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3.5 font-semibold transition-colors shadow-sm disabled:opacity-60"
          >
            {status === 'loading' || status === 'verifying' ? (
              <><Loader className="w-5 h-5 animate-spin" /> {status === 'verifying' ? 'Verifying...' : 'Opening payment...'}</>
            ) : !paystackReady ? (
              <><Loader className="w-5 h-5 animate-spin" /> Loading payment system...</>
            ) : (
              <><CreditCard className="w-5 h-5" /> Pay ₦10,000 Now</>
            )}
          </button>
          <p className="text-center text-xs text-slate-400 mt-3">
            Secured by <span className="font-semibold">Paystack</span> · SSL Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
