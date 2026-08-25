import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, Building2, Users, Save, AlertCircle, CheckCircle, Briefcase, GraduationCap } from 'lucide-react';
import PhotoUpload from '../../components/common/PhotoUpload';

const SQL_SETUP = `-- Run once in your Supabase SQL Editor:
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender                  text,
  ADD COLUMN IF NOT EXISTS middle_name             text,
  ADD COLUMN IF NOT EXISTS title                   text,
  ADD COLUMN IF NOT EXISTS alt_phone               text,
  ADD COLUMN IF NOT EXISTS marital_status          text,
  ADD COLUMN IF NOT EXISTS religion                text,
  ADD COLUMN IF NOT EXISTS state_of_origin         text,
  ADD COLUMN IF NOT EXISTS lga                     text,
  ADD COLUMN IF NOT EXISTS blood_group             text,
  ADD COLUMN IF NOT EXISTS employment_type         text,
  ADD COLUMN IF NOT EXISTS bank_name               text,
  ADD COLUMN IF NOT EXISTS account_number          text,
  ADD COLUMN IF NOT EXISTS account_name            text,
  ADD COLUMN IF NOT EXISTS next_of_kin_name        text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone       text,
  ADD COLUMN IF NOT EXISTS next_of_kin_address     text,
  ADD COLUMN IF NOT EXISTS qualification           text,
  ADD COLUMN IF NOT EXISTS other_qualifications    text,
  ADD COLUMN IF NOT EXISTS institution             text,
  ADD COLUMN IF NOT EXISTS year_of_graduation      text,
  ADD COLUMN IF NOT EXISTS staff_id_no             text,
  ADD COLUMN IF NOT EXISTS years_of_experience     text,
  ADD COLUMN IF NOT EXISTS join_date               date,
  ADD COLUMN IF NOT EXISTS bio                     text,
  ADD COLUMN IF NOT EXISTS avatar_url              text;

-- Enable RLS and set safe, non-recursive policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all profiles (needed for staff lists, etc.)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
CREATE POLICY "Authenticated users can read profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update only their own profile row
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Anyone can insert their own row (needed for self-signup)
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);`;

const ic = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

const SECTION = ({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
    <div>
      <h2 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
        <Icon size={16} className="text-emerald-600" /> {title}
      </h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5 ml-6">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="text-xs text-slate-500 mb-1 block">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['Divorced', 'Married', 'Separated', 'Single', 'Widowed'];
const EMPLOYMENT_TYPES = ['Contract', 'NYSC', 'Part-Time', 'Permanent', 'Temporary', 'Volunteer'];
const TITLES = ['Alhaja', 'Alhaji', 'Dr', 'Miss', 'Mr', 'Mrs', 'Ms', 'Pastor', 'Prof', 'Rev'];

export default function MyProfile() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [setupMissing, setSetupMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    title: '',
    first_name: '', middle_name: '', last_name: '',
    gender: '', marital_status: '',
    date_of_birth: '', blood_group: '',
    religion: '', state_of_origin: '', lga: '',
    phone: '', alt_phone: '',
    address: '',
    staff_id_no: '', join_date: '',
    employment_type: '', years_of_experience: '',
    qualification: '', institution: '',
    year_of_graduation: '', other_qualifications: '',
    bank_name: '', account_number: '', account_name: '',
    next_of_kin_name: '', next_of_kin_relationship: '',
    next_of_kin_phone: '', next_of_kin_address: '',
    bio: '', avatar_url: '',
  });

  useEffect(() => { if (user?.id) load(); }, [user?.id]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
    setLoading(false);
    if (error || !data) return;
    // Detect if extended columns haven't been added yet (they'll be undefined, not null)
    if (data.middle_name === undefined) {
      setSetupMissing(true);
      if (isAdmin) setShowSql(true);
    } else {
      setSetupMissing(false);
    }
    setForm({
      title: data.title || '',
      first_name: data.first_name || '',
      middle_name: data.middle_name || '',
      last_name: data.last_name || '',
      gender: data.gender || '',
      marital_status: data.marital_status || '',
      date_of_birth: data.date_of_birth || '',
      blood_group: data.blood_group || '',
      religion: data.religion || '',
      state_of_origin: data.state_of_origin || '',
      lga: data.lga || '',
      phone: data.phone || '',
      alt_phone: data.alt_phone || '',
      address: data.address || '',
      staff_id_no: data.staff_id_no || '',
      join_date: data.join_date || '',
      employment_type: data.employment_type || '',
      years_of_experience: data.years_of_experience || '',
      qualification: data.qualification || '',
      institution: data.institution || '',
      year_of_graduation: data.year_of_graduation || '',
      other_qualifications: data.other_qualifications || '',
      bank_name: data.bank_name || '',
      account_number: data.account_number || '',
      account_name: data.account_name || '',
      next_of_kin_name: data.next_of_kin_name || '',
      next_of_kin_relationship: data.next_of_kin_relationship || '',
      next_of_kin_phone: data.next_of_kin_phone || '',
      next_of_kin_address: data.next_of_kin_address || '',
      bio: data.bio || '',
      avatar_url: data.avatar_url || '',
    });
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!user?.id) return;
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setSaveError('First name and last name are required.'); return;
    }
    setSaving(true); setSaveError(''); setSaveOk(false);

    const fullPayload = {
      title: form.title,
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim(),
      last_name: form.last_name.trim(),
      gender: form.gender,
      marital_status: form.marital_status,
      date_of_birth: form.date_of_birth || null,
      blood_group: form.blood_group,
      religion: form.religion.trim(),
      state_of_origin: form.state_of_origin.trim(),
      lga: form.lga.trim(),
      phone: form.phone.trim(),
      alt_phone: form.alt_phone.trim(),
      address: form.address.trim(),
      staff_id_no: form.staff_id_no.trim(),
      join_date: form.join_date || null,
      employment_type: form.employment_type,
      years_of_experience: form.years_of_experience.trim(),
      qualification: form.qualification.trim(),
      institution: form.institution.trim(),
      year_of_graduation: form.year_of_graduation.trim(),
      other_qualifications: form.other_qualifications.trim(),
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim(),
      account_name: form.account_name.trim(),
      next_of_kin_name: form.next_of_kin_name.trim(),
      next_of_kin_relationship: form.next_of_kin_relationship.trim(),
      next_of_kin_phone: form.next_of_kin_phone.trim(),
      next_of_kin_address: form.next_of_kin_address.trim(),
      bio: form.bio.trim(),
      avatar_url: form.avatar_url || null,
    };

    // Columns guaranteed to exist in the base profiles table
    const corePayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      date_of_birth: form.date_of_birth || null,
      address: form.address.trim(),
      avatar_url: form.avatar_url || null,
    };

    const { error } = await supabase.from('profiles').update(fullPayload).eq('id', user.id);

    if (!error) {
      setSaving(false);
      setSaveOk(true);
      load();
      setTimeout(() => setSaveOk(false), 5000);
      return;
    }

    const isColErr = error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist');
    const isRlsErr = error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('permission denied');

    if (isColErr) {
      // Some extended columns don't exist yet — try saving base fields only
      const { error: coreError } = await supabase.from('profiles').update(corePayload).eq('id', user.id);
      setSaving(false);
      if (!coreError) {
        setSaveOk(true);
        setSaveNote(
          isAdmin
            ? 'Basic details saved. Run the SQL setup below to enable all fields.'
            : 'Basic details saved (name, phone, address). Your administrator still needs to run the database setup to enable all fields.'
        );
        if (isAdmin) setShowSql(true);
        setTimeout(() => { setSaveOk(false); setSaveNote(''); }, 8000);
      } else {
        setSaveError(
          isAdmin
            ? `Save failed: ${coreError.message} — run the SQL setup below.`
            : 'Unable to save profile. Please contact your administrator.'
        );
        if (isAdmin) setShowSql(true);
      }
      return;
    }

    if (isRlsErr) {
      setSaving(false);
      setSaveError(
        isAdmin
          ? 'Blocked by database permissions. Run the SQL setup below to fix the RLS policies.'
          : 'You do not have permission to edit your profile yet. Please contact your administrator.'
      );
      if (isAdmin) setShowSql(true);
      return;
    }

    // Any other error
    setSaving(false);
    setSaveError(isAdmin ? error.message : 'Profile could not be saved. Please contact your administrator.');
    if (isAdmin) setShowSql(true);
  }

  function copySQL() {
    navigator.clipboard.writeText(SQL_SETUP).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-slate-500">
      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Loading profile…
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 pb-16">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete all sections below. <span className="text-amber-600 font-medium">Bank details are required for salary payments. Deadline: end of this week.</span>
        </p>
      </div>

      {showSql && isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle size={16} /> Database setup required — run this SQL once in your Supabase SQL Editor:
          </p>
          <pre className="bg-amber-100 rounded-xl p-3 text-xs overflow-x-auto text-amber-900 whitespace-pre-wrap">{SQL_SETUP}</pre>
          <div className="flex gap-3 mt-3">
            <button onClick={copySQL} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
              {copied ? '✓ Copied' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowSql(false)} className="text-amber-700 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {setupMissing && !isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-blue-500" />
          <span>
            Some profile fields are not yet available. Your basic details (name, phone, address) will still save.
            Please ask your administrator to complete the database setup to unlock all fields.
          </span>
        </div>
      )}

      {/* ── Photo hero ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-6 flex items-center gap-5">
        <PhotoUpload
          currentUrl={form.avatar_url}
          name={`${form.first_name} ${form.last_name}`.trim() || 'Staff'}
          folder={`staff/${user?.id}`}
          onUploaded={url => set('avatar_url', url)}
          size="lg"
        />
        <div>
          <p className="text-white font-semibold text-lg leading-tight">
            {[form.title, form.first_name, form.last_name].filter(Boolean).join(' ') || 'Your Name'}
          </p>
          <p className="text-emerald-200 text-sm mt-0.5">{profile?.role?.replace(/_/g, ' ') ?? 'Staff'}</p>
          <p className="text-emerald-300 text-xs mt-2">Click your photo to upload or change it</p>
        </div>
      </div>

      {/* ── Personal Information ─────────────────────────────────────── */}
      <SECTION icon={User} title="Personal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Title">
            <select className={ic} value={form.title} onChange={e => set('title', e.target.value)}>
              <option value="">Select title</option>
              {TITLES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="First Name" required>
            <input className={ic} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
          </Field>
          <Field label="Middle Name">
            <input className={ic} value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Middle name" />
          </Field>
          <Field label="Last Name / Surname" required>
            <input className={ic} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Surname" />
          </Field>
          <Field label="Gender">
            <select className={ic} value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
            </select>
          </Field>
          <Field label="Marital Status">
            <select className={ic} value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
              <option value="">Select status</option>
              {MARITAL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" className={ic} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
          </Field>
          <Field label="Blood Group">
            <select className={ic} value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Religion">
            <input className={ic} value={form.religion} onChange={e => set('religion', e.target.value)} placeholder="e.g. Christianity, Islam" />
          </Field>
          <Field label="State of Origin">
            <input className={ic} value={form.state_of_origin} onChange={e => set('state_of_origin', e.target.value)} placeholder="e.g. Rivers State" />
          </Field>
          <Field label="Local Government Area (LGA)">
            <input className={ic} value={form.lga} onChange={e => set('lga', e.target.value)} placeholder="e.g. Okrika LGA" />
          </Field>
          <Field label="Phone Number">
            <input className={ic} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g. 08012345678" />
          </Field>
          <Field label="Alternative Phone">
            <input className={ic} value={form.alt_phone} onChange={e => set('alt_phone', e.target.value)} placeholder="Second phone number (optional)" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Residential Address">
              <textarea className={ic} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Your full home address" />
            </Field>
          </div>
        </div>
      </SECTION>

      {/* ── Employment Details ──────────────────────────────────────── */}
      <SECTION icon={Briefcase} title="Employment Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Staff ID Number">
            <input className={ic} value={form.staff_id_no} onChange={e => set('staff_id_no', e.target.value)} placeholder="Your staff ID" />
          </Field>
          <Field label="Employment Type">
            <select className={ic} value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
              <option value="">Select type</option>
              {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Date of First Appointment">
            <input type="date" className={ic} value={form.join_date} onChange={e => set('join_date', e.target.value)} />
          </Field>
          <Field label="Years of Experience">
            <input className={ic} value={form.years_of_experience} onChange={e => set('years_of_experience', e.target.value)} placeholder="e.g. 8 years" />
          </Field>
        </div>
      </SECTION>

      {/* ── Qualifications ──────────────────────────────────────────── */}
      <SECTION icon={GraduationCap} title="Academic Qualifications"
        subtitle="Enter your highest qualification first, then list others below">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Highest Qualification" required>
            <input className={ic} value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. B.Ed Mathematics, NCE English, M.Sc" />
          </Field>
          <Field label="Institution Attended">
            <input className={ic} value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="e.g. University of Port Harcourt" />
          </Field>
          <Field label="Year of Graduation">
            <input className={ic} value={form.year_of_graduation} onChange={e => set('year_of_graduation', e.target.value)} placeholder="e.g. 2012" maxLength={4} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Other Qualifications / Certificates">
              <textarea className={ic} rows={3} value={form.other_qualifications} onChange={e => set('other_qualifications', e.target.value)}
                placeholder="List any other degrees, diplomas, or professional certificates here (e.g. NCE 2005 – RSCOAE; PGD Education 2015 – UPH; Microsoft Office Certificate 2018)" />
            </Field>
          </div>
        </div>
      </SECTION>

      {/* ── Professional Bio ─────────────────────────────────────────── */}
      <SECTION icon={User} title="Professional Bio / Summary"
        subtitle="A brief description of your role, teaching philosophy, or professional background">
        <Field label="Bio">
          <textarea className={ic} rows={4} value={form.bio}
            onChange={e => set('bio', e.target.value)}
            placeholder="Write a short professional summary — e.g. teaching subjects, years at school, areas of expertise, notable achievements…" />
        </Field>
      </SECTION>

      {/* ── Bank Details ─────────────────────────────────────────────── */}
      <SECTION icon={Building2} title="Bank Details for Salary Payment">
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
          ⚠️ Salary payments will be processed using these details. Make sure they match your bank records exactly and submit before the deadline.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Bank Name" required>
            <input className={ic} value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. First Bank, GTBank, Access Bank" />
          </Field>
          <Field label="Account Number" required>
            <input className={ic} value={form.account_number} onChange={e => set('account_number', e.target.value)} placeholder="10-digit account number" maxLength={10} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Account Name (exactly as it appears on your bank account)" required>
              <input className={ic} value={form.account_name} onChange={e => set('account_name', e.target.value)} placeholder="Full name on account" />
            </Field>
          </div>
        </div>
      </SECTION>

      {/* ── Next of Kin ──────────────────────────────────────────────── */}
      <SECTION icon={Users} title="Next of Kin">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <input className={ic} value={form.next_of_kin_name} onChange={e => set('next_of_kin_name', e.target.value)} placeholder="Next of kin full name" />
          </Field>
          <Field label="Relationship" required>
            <input className={ic} value={form.next_of_kin_relationship} onChange={e => set('next_of_kin_relationship', e.target.value)} placeholder="e.g. Spouse, Parent, Sibling, Child" />
          </Field>
          <Field label="Phone Number" required>
            <input className={ic} value={form.next_of_kin_phone} onChange={e => set('next_of_kin_phone', e.target.value)} placeholder="Phone number" />
          </Field>
          <Field label="Address">
            <input className={ic} value={form.next_of_kin_address} onChange={e => set('next_of_kin_address', e.target.value)} placeholder="Next of kin address" />
          </Field>
        </div>
      </SECTION>

      {/* ── Save ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
        {saveOk && !saveNote && (
          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <CheckCircle size={16} /> Profile saved successfully
          </span>
        )}
        {saveNote && (
          <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
            <AlertCircle size={14} /> {saveNote}
          </span>
        )}
        {saveError && (
          <span className="flex items-center gap-1.5 text-red-500 text-sm">
            <AlertCircle size={14} /> {saveError}
          </span>
        )}
      </div>
    </div>
  );
}
