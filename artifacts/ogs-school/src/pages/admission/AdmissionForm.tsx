import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../components/hooks/useLocation';
import { useTenantSettings } from '../../context/TenantContext';
import { schoolCodeFromName } from '../../lib/schoolCode';
import { apiUrl } from '../../lib/apiUrl';
import {
  User, Users, GraduationCap, Phone, Mail, AlertCircle,
  ChevronRight, ChevronLeft, Building2, BookOpen, Search,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { fbq?: (...args: any[]) => void; } }
const track = (event: string, data?: Record<string, unknown>) => window.fbq?.('track', event, data);

const CLASSES = ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'];
const STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
];
const RELATIONSHIPS = ['Aunt','Father','Guardian','Mother','Other','Sibling','Uncle'];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-colors bg-white';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
const reqStar = <span className="text-red-500 ml-0.5">*</span>;

const emptyForm = {
  first_name: '', last_name: '', date_of_birth: '', gender: '',
  state_of_origin: '', lga: '', address: '', religion: '',
  blood_group: '', nationality: 'Nigerian', phone: '',
  student_type: '' as 'boarding' | 'day' | '',
  class_applying_for: '', current_school: '', medical_conditions: '',
  guardian_name: '', guardian_phone: '', guardian_email: '',
  guardian_occupation: '', guardian_relationship: '', emergency_contact: '',
};

const STEPS = [
  { num: 1, label: 'Personal Details',    icon: User },
  { num: 2, label: 'Academic Info',       icon: GraduationCap },
  { num: 3, label: 'Guardian Info',       icon: Users },
];

export default function AdmissionForm() {
  const { settings } = useTenantSettings();
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);

  // Fire PageView whenever this route is mounted (SPA navigation won't trigger index.html again)
  useEffect(() => { track('PageView'); }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function f(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!form.first_name.trim())     errs.first_name     = 'First name is required';
      if (!form.last_name.trim())      errs.last_name      = 'Last name is required';
      if (!form.guardian_phone.trim()) errs.guardian_phone = 'Parent / guardian phone is required';
      if (!form.guardian_email.trim()) errs.guardian_email = 'Parent / guardian email is required';
      if (form.guardian_email && !/\S+@\S+\.\S+/.test(form.guardian_email))
        errs.guardian_email = 'Invalid email address';
      if (!form.date_of_birth)         errs.date_of_birth  = 'Date of birth is required';
      if (!form.gender)                errs.gender         = 'Gender is required';
      if (!form.state_of_origin)       errs.state_of_origin = 'State of origin is required';
      if (!form.address.trim())        errs.address        = 'Home address is required';
    }
    if (s === 2) {
      if (!form.student_type)       errs.student_type       = 'Please select Day or Boarding student';
      if (!form.class_applying_for) errs.class_applying_for = 'Class is required';
      if (!form.current_school.trim()) errs.current_school  = 'Current/previous school is required';
    }
    if (s === 3) {
      if (!form.guardian_name.trim())  errs.guardian_name         = 'Guardian name is required';
      if (!form.guardian_phone.trim()) errs.guardian_phone        = 'Guardian phone is required';
      if (!form.guardian_email.trim()) errs.guardian_email        = 'Guardian email is required';
      if (form.guardian_email && !/\S+@\S+\.\S+/.test(form.guardian_email))
        errs.guardian_email = 'Invalid email address';
      if (!form.guardian_occupation.trim()) errs.guardian_occupation = 'Guardian occupation is required';
      if (!form.guardian_relationship)      errs.guardian_relationship = 'Relationship is required';
      if (!form.emergency_contact.trim())   errs.emergency_contact   = 'Emergency contact is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    // Fire Lead when guardian contact is captured (step 1 → 2)
    if (step === 1) {
      track('Lead', { content_name: 'Admission Application Started' });
    }
    setStep(s => s + 1);
  }

  async function generateApplicationRef(schoolId: string | null, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    try {
      const { data } = await supabase
        .from('prospective_students')
        .select('application_ref')
        .eq('school_id', schoolId ?? '')
        .ilike('application_ref', `${prefix}/APP/${year}/%`);
      const nums = (data ?? [])
        .map((r: any) => parseInt((r.application_ref ?? '').split('/').pop() ?? '0'))
        .filter(Boolean);
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      return `${prefix}/APP/${year}/${String(next).padStart(4, '0')}`;
    } catch {
      return `${prefix}/APP/${year}/0001`;
    }
  }

  async function handleSubmit() {
    if (!validateStep(3)) return;
    setSubmitting(true);
    setSubmitError('');

    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();

    // Generate a human-readable application reference client-side so it is
    // always present and readable even if the DB trigger is not active.
    const applicationRef = await generateApplicationRef(school?.id ?? null, schoolCodeFromName(settings.school_name));

    const payload = {
      ...form,
      school_id: school?.id ?? null,
      medical_conditions: form.medical_conditions || 'None',
      application_ref: applicationRef,
    };

    const { data, error } = await supabase
      .from('prospective_students')
      .insert(payload)
      .select('id, application_ref')
      .single();

    if (error || !data) {
      setSubmitError(error?.message ?? 'Submission failed. Please try again.');
      setSubmitting(false);
      return;
    }

    // Fire CompleteRegistration pixel event
    track('CompleteRegistration', {
      content_name: 'Admission Application Submitted',
      status: true,
    });

    // Send welcome email (fire-and-forget — don't block navigation on failure)
    fetch(apiUrl('/api/email/admission-welcome'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.first_name,
        lastName: form.last_name,
        guardianName: form.guardian_name,
        guardianEmail: form.guardian_email,
        applicationRef: data.application_ref,
        classApplyingFor: form.class_applying_for,
      }),
    }).catch(() => { /* non-critical */ });

    navigate(
      `/admission-payment?id=${data.id}&ref=${data.application_ref}` +
      `&email=${encodeURIComponent(form.guardian_email)}` +
      `&name=${encodeURIComponent(form.first_name + ' ' + form.last_name)}`
    );
  }

  return (
    <div
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: `url('/ogs_school_bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col flex-1">

          {/* Header */}
          <div className="text-center mb-7">
            <div className="flex justify-center mb-4">
              <img
                src={settings.logo_url || '/ogs_logo_bg.png'}
                alt={`${settings.school_name} Logo`}
                className="w-20 h-20 object-contain rounded-2xl bg-white/90 p-2 shadow-xl"
              />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow">
              {settings.school_name}
            </h1>
            <p className="text-slate-300 mt-1 text-base font-medium">
              Student Admission Application Form
            </p>
            <div className="inline-flex items-center gap-2 mt-3 bg-amber-500/25 text-amber-200 text-sm px-4 py-2 rounded-full border border-amber-400/40 backdrop-blur">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Application fee: ₦5,000 (payable after submission)
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-0 mb-6 justify-center">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="flex items-center">
                {idx > 0 && (
                  <div className={`h-0.5 w-10 sm:w-16 ${step > idx ? 'bg-emerald-400' : 'bg-white/25'}`} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      step > s.num
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : step === s.num
                        ? 'bg-emerald-500 border-emerald-400 text-white ring-4 ring-emerald-500/30'
                        : 'bg-white/10 border-white/30 text-white/60'
                    }`}
                  >
                    {step > s.num ? '✓' : s.num}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:block ${
                      step === s.num ? 'text-emerald-300' : step > s.num ? 'text-slate-200' : 'text-white/40'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex-1 flex flex-col">
            {/* Card header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
              <div className="flex items-center gap-3">
                {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="w-5 h-5 text-white" />; })()}
                <h2 className="text-lg font-bold text-white">{STEPS[step - 1].label}</h2>
              </div>
              <p className="text-emerald-100 text-sm mt-0.5">
                Step {step} of {STEPS.length} — Fields marked <span className="text-red-300 font-semibold">*</span> are required
              </p>
            </div>

            {/* Form body */}
            <div className="p-6 space-y-5 flex-1">
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}

              {/* ── Step 1: Personal Details ── */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>First Name {reqStar}</label>
                      <input
                        value={form.first_name}
                        onChange={e => f('first_name', e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Chukwuemeka"
                      />
                      {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Last Name {reqStar}</label>
                      <input
                        value={form.last_name}
                        onChange={e => f('last_name', e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Okafor"
                      />
                      {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                    </div>
                  </div>

                  {/* Parent contact — collected early for follow-up */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Parent / Guardian Phone {reqStar}</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={form.guardian_phone}
                          onChange={e => f('guardian_phone', e.target.value)}
                          className={`${inputCls} pl-9`}
                          placeholder="080XXXXXXXX"
                        />
                      </div>
                      {errors.guardian_phone && <p className="text-red-500 text-xs mt-1">{errors.guardian_phone}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Parent / Guardian Email {reqStar}</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={form.guardian_email}
                          onChange={e => f('guardian_email', e.target.value)}
                          className={`${inputCls} pl-9`}
                          placeholder="parent@email.com"
                        />
                      </div>
                      {errors.guardian_email && <p className="text-red-500 text-xs mt-1">{errors.guardian_email}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Date of Birth {reqStar}</label>
                      <input
                        type="date"
                        value={form.date_of_birth}
                        onChange={e => f('date_of_birth', e.target.value)}
                        className={inputCls}
                        max={new Date().toISOString().split('T')[0]}
                      />
                      {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Gender {reqStar}</label>
                      <select
                        value={form.gender}
                        onChange={e => f('gender', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select an option</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                      {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>State of Origin {reqStar}</label>
                      <select
                        value={form.state_of_origin}
                        onChange={e => f('state_of_origin', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select an option</option>
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {errors.state_of_origin && <p className="text-red-500 text-xs mt-1">{errors.state_of_origin}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>LGA (Local Government Area)</label>
                      <input
                        value={form.lga}
                        onChange={e => f('lga', e.target.value)}
                        className={inputCls}
                        placeholder="e.g. City"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Blood Group</label>
                      <select
                        value={form.blood_group}
                        onChange={e => f('blood_group', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select an option</option>
                        {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Religion</label>
                      <select
                        value={form.religion}
                        onChange={e => f('religion', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select an option</option>
                        <option value="Christianity">Christianity</option>
                        <option value="Islam">Islam</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Home Address {reqStar}</label>
                    <textarea
                      value={form.address}
                      onChange={e => f('address', e.target.value)}
                      className={`${inputCls} resize-none`}
                      rows={3}
                      placeholder="Enter your full residential address"
                    />
                    {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Student Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={form.phone}
                        onChange={e => f('phone', e.target.value)}
                        className={`${inputCls} pl-9`}
                        placeholder="080XXXXXXXX (optional)"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 2: Academic Preference ── */}
              {step === 2 && (
                <>
                  <div>
                    <label className={labelCls}>Student Type {reqStar}</label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {(['day', 'boarding'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => f('student_type', type)}
                          className={`flex flex-col items-center gap-3 p-5 border-2 rounded-xl transition-all ${
                            form.student_type === type
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          {type === 'day' ? <BookOpen className="w-7 h-7" /> : <Building2 className="w-7 h-7" />}
                          <div className="text-center">
                            <p className="font-bold capitalize">{type} Student</p>
                            <p className="text-xs mt-0.5 opacity-70">
                              {type === 'day' ? 'Returns home daily' : 'Lives in school dormitory'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {errors.student_type && <p className="text-red-500 text-xs mt-1">{errors.student_type}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Class Applying For {reqStar}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CLASSES.map(cls => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => f('class_applying_for', cls)}
                          className={`py-2.5 px-3 border-2 rounded-xl text-sm font-semibold transition-all ${
                            form.class_applying_for === cls
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                    {errors.class_applying_for && <p className="text-red-500 text-xs mt-1">{errors.class_applying_for}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Current / Previous School {reqStar}</label>
                    <input
                      value={form.current_school}
                      onChange={e => f('current_school', e.target.value)}
                      className={inputCls}
                      placeholder="Name of your current or most recent school"
                    />
                    {errors.current_school && <p className="text-red-500 text-xs mt-1">{errors.current_school}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Medical Conditions / Allergies (if any)</label>
                    <textarea
                      value={form.medical_conditions}
                      onChange={e => f('medical_conditions', e.target.value)}
                      className={`${inputCls} resize-none`}
                      rows={3}
                      placeholder="List any medical conditions, allergies, or special needs. Leave blank if none."
                    />
                  </div>
                </>
              )}

              {/* ── Step 3: Guardian Information ── */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Guardian Full Name {reqStar}</label>
                      <input
                        value={form.guardian_name}
                        onChange={e => f('guardian_name', e.target.value)}
                        className={inputCls}
                        placeholder="Full legal name"
                      />
                      {errors.guardian_name && <p className="text-red-500 text-xs mt-1">{errors.guardian_name}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Relationship to Student {reqStar}</label>
                      <select
                        value={form.guardian_relationship}
                        onChange={e => f('guardian_relationship', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select relationship</option>
                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {errors.guardian_relationship && <p className="text-red-500 text-xs mt-1">{errors.guardian_relationship}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Guardian Phone Number {reqStar}</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          value={form.guardian_phone}
                          onChange={e => f('guardian_phone', e.target.value)}
                          className={`${inputCls} pl-9`}
                          placeholder="080XXXXXXXX"
                        />
                      </div>
                      {errors.guardian_phone && <p className="text-red-500 text-xs mt-1">{errors.guardian_phone}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Guardian Email Address {reqStar}</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={form.guardian_email}
                          onChange={e => f('guardian_email', e.target.value)}
                          className={`${inputCls} pl-9`}
                          placeholder="guardian@email.com"
                        />
                      </div>
                      {errors.guardian_email && <p className="text-red-500 text-xs mt-1">{errors.guardian_email}</p>}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Guardian Occupation {reqStar}</label>
                    <input
                      value={form.guardian_occupation}
                      onChange={e => f('guardian_occupation', e.target.value)}
                      className={inputCls}
                      placeholder="e.g. Civil Servant, Business Owner, Doctor"
                    />
                    {errors.guardian_occupation && <p className="text-red-500 text-xs mt-1">{errors.guardian_occupation}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Emergency Contact Number {reqStar}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={form.emergency_contact}
                        onChange={e => f('emergency_contact', e.target.value)}
                        className={`${inputCls} pl-9`}
                        placeholder="Alternative phone number"
                      />
                    </div>
                    {errors.emergency_contact && <p className="text-red-500 text-xs mt-1">{errors.emergency_contact}</p>}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <p className="font-semibold mb-1">Before you submit:</p>
                    <p>
                      A non-refundable application fee of <strong>₦5,000</strong> is required. You will be
                      redirected to our secure payment page after submission. Ensure the guardian email is
                      correct — your application reference will be sent there.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Navigation footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50/60">
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <div className="flex-1" />
              {step < STEPS.length ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  NEXT <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Submit & Pay Application Fee'}
                  {!submitting && <ChevronRight className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Footer links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5 text-sm text-slate-300">
            <button
              onClick={() => navigate('/application-status')}
              className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Check application status
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

      {/* WhatsApp FAB */}
      <WhatsAppFAB schoolName={settings.school_name} />
    </div>
  );
}

const WHATSAPP_NUMBER = '2348012345678'; // ← update to school's WhatsApp number

function WhatsAppFAB({ schoolName }: { schoolName: string }) {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello, I have a question about admission to ${schoolName}.`)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
      style={{ padding: '12px 18px 12px 14px' }}
    >
      <WhatsAppIcon className="w-6 h-6 flex-shrink-0" />
      <span className="text-sm font-semibold whitespace-nowrap max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out">
        Chat with us
      </span>
    </a>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
