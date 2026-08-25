import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../components/hooks/useLocation';
import { Search, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const WHATSAPP_NUMBER = '2348012345678'; // ← update to school's WhatsApp number

function WhatsAppFAB() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello, I have a question about admission to Okrika Grammar School.')}`}
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

type Status = 'pending' | 'exam_invited' | 'exam_scheduled' | 'exam_done' | 'interview_scheduled' | 'interview_done' | 'admitted' | 'rejected';

interface ApplicationRecord {
  id: string;
  application_ref: string;
  first_name: string;
  last_name: string;
  class_applying_for: string;
  student_type: string;
  guardian_name: string;
  guardian_email: string;
  status: Status;
  created_at: string;
  payment_status?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string; border: string; desc: string; step: number }> = {
  pending: {
    label: 'Application Received',
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    desc: 'Your application has been received and is being reviewed by our admissions team. You will be contacted with further instructions.',
    step: 1,
  },
  exam_invited: {
    label: 'Invited to Entrance Exam',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    desc: 'You have been invited to sit the OGS entrance examination. Please check your guardian\'s email for the exam scheduling link.',
    step: 2,
  },
  exam_scheduled: {
    label: 'Exam Scheduled',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    desc: 'Your entrance examination has been scheduled. Please check your guardian\'s email for the exam date, time, and instructions.',
    step: 2,
  },
  exam_done: {
    label: 'Exam Completed — Awaiting Interview',
    icon: Clock,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    desc: 'Your entrance examination result has been recorded. You will be contacted to schedule a brief interview with the Principal.',
    step: 3,
  },
  interview_scheduled: {
    label: 'Interview Scheduled',
    icon: Clock,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    desc: 'Your interview with the Principal has been scheduled. Please check your guardian\'s email for the date and time.',
    step: 3,
  },
  interview_done: {
    label: 'Interview Completed — Decision Pending',
    icon: Clock,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    desc: 'Your interview with the Principal has been completed. A final admission decision will be communicated to you shortly.',
    step: 3,
  },
  admitted: {
    label: 'Admitted! 🎉',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    desc: 'Congratulations! Your application has been successful. Please visit the school with your application reference and required documents to complete enrolment.',
    step: 4,
  },
  rejected: {
    label: 'Not Successful',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    desc: 'We regret to inform you that your application was not successful at this time. Please contact the admissions office for further information.',
    step: 0,
  },
};

export default function ApplicationStatus() {
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ApplicationRecord | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ref.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter your application reference number.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setSearched(false);

    const { data, error: dbErr } = await supabase
      .from('prospective_students')
      .select('id, application_ref, first_name, last_name, class_applying_for, student_type, guardian_name, guardian_email, status, created_at, payment_status')
      .ilike('application_ref', trimmed)
      .maybeSingle();

    setLoading(false);
    setSearched(true);

    if (dbErr) {
      setError('An error occurred while searching. Please try again.');
      return;
    }

    if (!data) {
      setError('No application found with that reference number. Please check and try again.');
      return;
    }

    setResult(data as ApplicationRecord);
  }

  const statusCfg = result ? STATUS_CONFIG[result.status as Status] ?? STATUS_CONFIG.pending : null;

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center py-10 px-4"
      style={{
        backgroundImage: `url('/ogs_school_bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/ogs_logo_bg.png"
              alt="OGS Logo"
              className="w-20 h-20 object-contain rounded-2xl bg-white/90 p-2 shadow-xl"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-white drop-shadow">Application Status Check</h1>
          <p className="text-slate-300 mt-1 text-sm">
            Enter your application reference number to track your application
          </p>
        </div>

        {/* Search card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-white" />
              <h2 className="text-lg font-bold text-white">Track Your Application</h2>
            </div>
            <p className="text-emerald-100 text-sm mt-0.5">
              Your reference number was sent to your guardian's email after submission
            </p>
          </div>

          <form onSubmit={handleSearch} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Application Reference Number
              </label>
              <div className="flex gap-2">
                <input
                  value={ref}
                  onChange={e => { setRef(e.target.value.toUpperCase()); setError(''); setResult(null); setSearched(false); }}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 uppercase placeholder:normal-case placeholder:font-sans"
                  placeholder="e.g. OGS-2025-001"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 whitespace-nowrap"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </form>

          {/* Result */}
          {result && statusCfg && (
            <div className={`mx-6 mb-6 rounded-xl border ${statusCfg.border} ${statusCfg.bg} overflow-hidden`}>
              {/* Status header */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b ${statusCfg.border}`}>
                <statusCfg.icon className={`w-5 h-5 ${statusCfg.color}`} />
                <div>
                  <p className={`font-bold ${statusCfg.color}`}>{statusCfg.label}</p>
                  <p className="text-xs text-slate-500 font-mono">{result.application_ref}</p>
                </div>
                <div className="ml-auto">
                  {result.payment_status === 'paid'
                    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Fee Paid</span>
                    : result.status !== 'rejected'
                    ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Fee Pending</span>
                    : null
                  }
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-600">{statusCfg.desc}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white/70 rounded-lg p-2.5">
                    <p className="text-xs text-slate-400 mb-0.5">Applicant Name</p>
                    <p className="font-semibold text-slate-800">{result.first_name} {result.last_name}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2.5">
                    <p className="text-xs text-slate-400 mb-0.5">Class Applied For</p>
                    <p className="font-semibold text-slate-800">{result.class_applying_for || '—'}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2.5">
                    <p className="text-xs text-slate-400 mb-0.5">Student Type</p>
                    <p className="font-semibold text-slate-800 capitalize">{result.student_type || '—'}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2.5">
                    <p className="text-xs text-slate-400 mb-0.5">Date Applied</p>
                    <p className="font-semibold text-slate-800">
                      {new Date(result.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Stage-specific next-steps guidance */}
                {result.status === 'pending' && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    <strong>What's next?</strong> Our admissions team will review your application and contact you on{' '}
                    <span className="font-mono font-semibold">{result.guardian_email}</span> with an invitation to sit the entrance examination.
                    Ensure your application fee of ₦5,000 has been paid.
                  </div>
                )}

                {(result.status === 'exam_invited') && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    <strong>Action required:</strong> Please check <span className="font-mono font-semibold">{result.guardian_email}</span>{' '}
                    for a link to schedule your entrance examination date and time.
                  </div>
                )}

                {result.status === 'exam_scheduled' && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    <strong>Action required:</strong> Please check <span className="font-mono font-semibold">{result.guardian_email}</span>{' '}
                    for your exam date, time, and instructions. Arrive at least 15 minutes before the scheduled time.
                  </div>
                )}

                {result.status === 'exam_done' && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    <strong>What's next?</strong> Your exam result has been received. The admissions team will contact{' '}
                    <span className="font-mono font-semibold">{result.guardian_email}</span> shortly to schedule a brief interview with the Principal.
                  </div>
                )}

                {(result.status === 'interview_scheduled' || result.status === 'interview_done') && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    <strong>What's next?</strong> Your interview with the Principal has been noted. A final admission decision will be communicated
                    to <span className="font-mono font-semibold">{result.guardian_email}</span> shortly.
                  </div>
                )}

                {result.status === 'admitted' && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    <strong>Next steps:</strong> Please visit the school with your application reference number and
                    required documents (birth certificate, passport photos, previous school results) to complete enrolment.
                  </div>
                )}

                {result.status === 'rejected' && (
                  <div className="bg-white/60 rounded-lg px-3 py-2.5 text-xs text-slate-600">
                    Please contact our admissions office at <span className="font-semibold">admissions@okrikagrammars.edu.ng</span>{' '}
                    for further information or to enquire about future intake opportunities.
                  </div>
                )}
              </div>
            </div>
          )}

          {searched && !result && !error && (
            <div className="mx-6 mb-6 text-center py-6 text-slate-400 text-sm">
              No application found with that reference number.
            </div>
          )}
        </div>

        <WhatsAppFAB />

        {/* Footer links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 text-sm text-slate-300">
          <button
            onClick={() => navigate('/apply')}
            className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Start a new application
          </button>
          <span className="hidden sm:block text-white/20">·</span>
          <button
            onClick={() => navigate('/login')}
            className="hover:text-emerald-300 transition-colors"
          >
            Already admitted? Sign in to the portal
          </button>
        </div>
      </div>
    </div>
  );
}
