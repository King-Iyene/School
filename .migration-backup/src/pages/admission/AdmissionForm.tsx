import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../components/hooks/useLocation';
import { User, Users, GraduationCap, MapPin, Phone, Mail, AlertCircle, ChevronRight, Building2, BookOpen } from 'lucide-react';

const CLASSES = ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'];
const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Uncle', 'Aunt', 'Sibling', 'Other'];

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-colors bg-white';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
const reqStar = <span className="text-red-500 ml-0.5">*</span>;

const emptyForm = {
  first_name: '', last_name: '', date_of_birth: '', gender: '',
  state_of_origin: '', address: '',
  student_type: '' as 'boarding' | 'day' | '',
  class_applying_for: '', current_school: '', medical_conditions: '',
  guardian_name: '', guardian_phone: '', guardian_email: '',
  guardian_occupation: '', guardian_relationship: '', emergency_contact: '',
};

export default function AdmissionForm() {
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
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
      if (!form.first_name.trim()) errs.first_name = 'First name is required';
      if (!form.last_name.trim()) errs.last_name = 'Last name is required';
      if (!form.date_of_birth) errs.date_of_birth = 'Date of birth is required';
      if (!form.gender) errs.gender = 'Gender is required';
      if (!form.state_of_origin) errs.state_of_origin = 'State of origin is required';
      if (!form.address.trim()) errs.address = 'Address is required';
    }
    if (s === 2) {
      if (!form.student_type) errs.student_type = 'Please select Day or Boarding student';
      if (!form.class_applying_for) errs.class_applying_for = 'Class is required';
      if (!form.current_school.trim()) errs.current_school = 'Current/previous school is required';
    }
    if (s === 3) {
      if (!form.guardian_name.trim()) errs.guardian_name = 'Guardian name is required';
      if (!form.guardian_phone.trim()) errs.guardian_phone = 'Guardian phone is required';
      if (!form.guardian_email.trim()) errs.guardian_email = 'Guardian email is required';
      if (form.guardian_email && !/\S+@\S+\.\S+/.test(form.guardian_email)) errs.guardian_email = 'Invalid email';
      if (!form.guardian_occupation.trim()) errs.guardian_occupation = 'Guardian occupation is required';
      if (!form.guardian_relationship) errs.guardian_relationship = 'Relationship is required';
      if (!form.emergency_contact.trim()) errs.emergency_contact = 'Emergency contact number is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (validateStep(step)) setStep(s => s + 1);
  }

  async function handleSubmit() {
    if (!validateStep(3)) return;
    setSubmitting(true);
    setSubmitError('');

    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();

    const payload = {
      ...form,
      school_id: school?.id ?? null,
      medical_conditions: form.medical_conditions || 'None',
    };

    const { data, error } = await supabase.from('prospective_students').insert(payload).select('id, application_ref').single();

    if (error || !data) {
      setSubmitError(error?.message ?? 'Submission failed. Please try again.');
      setSubmitting(false);
      return;
    }

    navigate(`/admission-payment?id=${data.id}&ref=${data.application_ref}&email=${encodeURIComponent(form.guardian_email)}&name=${encodeURIComponent(form.first_name + ' ' + form.last_name)}`);
  }

  const steps = [
    { num: 1, label: 'Personal Details', icon: User },
    { num: 2, label: 'Academic Preference', icon: GraduationCap },
    { num: 3, label: 'Guardian Info', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/ogs_logo_bg.png" alt="OGS Logo" className="w-20 h-20 object-contain rounded-2xl bg-white p-2 shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold text-white">Okrika Grammar School</h1>
          <p className="text-slate-400 mt-1">Student Admission Application Form</p>
          <div className="inline-flex items-center gap-2 mt-3 bg-amber-500/20 text-amber-300 text-sm px-4 py-2 rounded-full border border-amber-500/30">
            <AlertCircle className="w-4 h-4" />
            Application fee: ₦10,000 (payable after submission)
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 ${idx > 0 ? 'ml-2' : ''}`}>
                {idx > 0 && <div className={`h-px flex-1 ${step > idx ? 'bg-emerald-500' : 'bg-slate-600'}`} />}
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${step > s.num ? 'bg-emerald-500 text-white' : step === s.num ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30' : 'bg-slate-700 text-slate-400'}`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.num ? 'text-emerald-400' : step > s.num ? 'text-slate-300' : 'text-slate-500'}`}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <div className="flex items-center gap-3">
              {(() => { const Icon = steps[step - 1].icon; return <Icon className="w-5 h-5 text-white" />; })()}
              <h2 className="text-lg font-bold text-white">{steps[step - 1].label}</h2>
            </div>
            <p className="text-emerald-100 text-sm mt-0.5">Step {step} of 3 — All fields marked <span className="text-red-300">*</span> are required</p>
          </div>

          <div className="p-6 space-y-5">
            {submitError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{submitError}</div>}

            {step === 1 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>First Name {reqStar}</label>
                    <input value={form.first_name} onChange={e => f('first_name', e.target.value)} className={inputCls} placeholder="e.g. John" />
                    {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Last Name {reqStar}</label>
                    <input value={form.last_name} onChange={e => f('last_name', e.target.value)} className={inputCls} placeholder="e.g. Doe" />
                    {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date of Birth {reqStar}</label>
                    <input type="date" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} className={inputCls} max={new Date().toISOString().split('T')[0]} />
                    {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Gender {reqStar}</label>
                    <select value={form.gender} onChange={e => f('gender', e.target.value)} className={inputCls}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>State of Origin {reqStar}</label>
                  <select value={form.state_of_origin} onChange={e => f('state_of_origin', e.target.value)} className={inputCls}>
                    <option value="">Select state</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state_of_origin && <p className="text-red-500 text-xs mt-1">{errors.state_of_origin}</p>}
                </div>
                <div>
                  <label className={labelCls}>Home Address {reqStar}</label>
                  <textarea value={form.address} onChange={e => f('address', e.target.value)} className={`${inputCls} resize-none`} rows={3} placeholder="Full residential address" />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className={labelCls}>Student Type {reqStar}</label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {(['day', 'boarding'] as const).map(type => (
                      <button key={type} type="button" onClick={() => f('student_type', type)}
                        className={`flex flex-col items-center gap-3 p-5 border-2 rounded-xl transition-all ${form.student_type === type ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                        {type === 'day' ? <BookOpen className="w-7 h-7" /> : <Building2 className="w-7 h-7" />}
                        <div className="text-center">
                          <p className="font-bold capitalize">{type} Student</p>
                          <p className="text-xs mt-0.5 opacity-70">{type === 'day' ? 'Returns home daily' : 'Lives in dormitory'}</p>
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
                      <button key={cls} type="button" onClick={() => f('class_applying_for', cls)}
                        className={`py-2.5 px-3 border-2 rounded-xl text-sm font-semibold transition-all ${form.class_applying_for === cls ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                        {cls}
                      </button>
                    ))}
                  </div>
                  {errors.class_applying_for && <p className="text-red-500 text-xs mt-1">{errors.class_applying_for}</p>}
                </div>
                <div>
                  <label className={labelCls}>Current / Previous School {reqStar}</label>
                  <input value={form.current_school} onChange={e => f('current_school', e.target.value)} className={inputCls} placeholder="Name of school" />
                  {errors.current_school && <p className="text-red-500 text-xs mt-1">{errors.current_school}</p>}
                </div>
                <div>
                  <label className={labelCls}>Medical Conditions / Allergies (if any)</label>
                  <textarea value={form.medical_conditions} onChange={e => f('medical_conditions', e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="List any medical conditions, allergies, or special needs" />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Guardian Full Name {reqStar}</label>
                    <input value={form.guardian_name} onChange={e => f('guardian_name', e.target.value)} className={inputCls} placeholder="Full name" />
                    {errors.guardian_name && <p className="text-red-500 text-xs mt-1">{errors.guardian_name}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Relationship to Student {reqStar}</label>
                    <select value={form.guardian_relationship} onChange={e => f('guardian_relationship', e.target.value)} className={inputCls}>
                      <option value="">Select relationship</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {errors.guardian_relationship && <p className="text-red-500 text-xs mt-1">{errors.guardian_relationship}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Guardian Phone {reqStar}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={form.guardian_phone} onChange={e => f('guardian_phone', e.target.value)} className={`${inputCls} pl-9`} placeholder="080XXXXXXXX" />
                    </div>
                    {errors.guardian_phone && <p className="text-red-500 text-xs mt-1">{errors.guardian_phone}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Guardian Email Address {reqStar}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" value={form.guardian_email} onChange={e => f('guardian_email', e.target.value)} className={`${inputCls} pl-9`} placeholder="guardian@email.com" />
                    </div>
                    {errors.guardian_email && <p className="text-red-500 text-xs mt-1">{errors.guardian_email}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Guardian Occupation {reqStar}</label>
                  <input value={form.guardian_occupation} onChange={e => f('guardian_occupation', e.target.value)} className={inputCls} placeholder="e.g. Civil Servant, Business Owner" />
                  {errors.guardian_occupation && <p className="text-red-500 text-xs mt-1">{errors.guardian_occupation}</p>}
                </div>
                <div>
                  <label className={labelCls}>Emergency Contact Number {reqStar}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={form.emergency_contact} onChange={e => f('emergency_contact', e.target.value)} className={`${inputCls} pl-9`} placeholder="Alternative phone number" />
                  </div>
                  {errors.emergency_contact && <p className="text-red-500 text-xs mt-1">{errors.emergency_contact}</p>}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-semibold mb-1">Before you submit:</p>
                  <p>A non-refundable application fee of <strong>₦10,000</strong> is required. You will be redirected to our secure payment page after submission. Ensure the guardian email is correct — all communications will be sent there.</p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50/50">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors">
                Back
              </button>
            )}
            <div className="flex-1" />
            {step < 3 ? (
              <button onClick={nextStep} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit & Proceed to Payment'}
                {!submitting && <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Already applied? <button onClick={() => navigate('/login')} className="text-emerald-400 hover:underline">Sign in to the portal</button>
        </p>
      </div>
    </div>
  );
}
