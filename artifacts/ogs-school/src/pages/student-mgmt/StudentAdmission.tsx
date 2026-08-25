import { useState, useEffect } from 'react';
import { UserPlus, Eye, EyeOff, Search, User, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLog';
import { useAuth } from '../../context/AuthContext';

interface Class {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

interface FormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  religion: string;
  nationality: string;
  phone: string;
  password: string;
  address: string;
  city: string;
  class_id: string;
  section_id: string;
  roll_number: string;
  admission_date: string;
  admission_number: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  guardian_email: string;
  parent_mode: 'new' | 'existing' | 'none';
  parent_id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  state_of_origin: string;
  lga: string;
}

const defaultForm: FormData = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  blood_group: '',
  religion: '',
  nationality: '',
  phone: '',
  password: '',
  address: '',
  city: '',
  class_id: '',
  section_id: '',
  roll_number: '',
  admission_date: new Date().toISOString().split('T')[0],
  admission_number: '',
  guardian_name: '',
  guardian_relation: '',
  guardian_phone: '',
  guardian_email: '',
  parent_mode: 'none',
  parent_id: '',
  parent_first_name: '',
  parent_last_name: '',
  parent_email: '',
  parent_phone: '',
  state_of_origin: '',
  lga: '',
};

async function getNextAdmissionNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const [{ data: sData }, { data: pData }, { data: prData }] = await Promise.all([
      supabase.from('students').select('admission_number')
        .eq('school_id', schoolId)
        .ilike('admission_number', `OGS-${year}-%`),
      supabase.from('profiles').select('admission_number')
        .eq('school_id', schoolId)
        .ilike('admission_number', `OGS-${year}-%`),
      supabase.from('prospective_students').select('admission_number')
        .eq('school_id', schoolId)
        .ilike('admission_number', `OGS-${year}-%`)
    ]);

    const allNums = [
      ...(sData || []).map(s => s.admission_number),
      ...(pData || []).map(p => p.admission_number),
      ...(prData || []).map(pr => pr.admission_number)
    ].filter(Boolean);

    if (allNums.length === 0) return `OGS-${year}-001`;

    let maxSeq = 0;
    allNums.forEach(num => {
      const parts = num.split('-');
      const seq = parseInt(parts[parts.length - 1]);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });

    const nextSeq = maxSeq + 1;
    const padding = nextSeq >= 1000 ? 0 : 3;
    return `OGS-${year}-${String(nextSeq).padStart(padding, '0')}`;
  } catch (e) {
    console.error('Error getting next admission number:', e);
    return `OGS-${year}-001`;
  }
}



export default function StudentAdmission() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successAdmissionNumber, setSuccessAdmissionNumber] = useState('');
  const [parentEmailWarning, setParentEmailWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [parentResults, setParentResults] = useState<any[]>([]);
  const [searchingParent, setSearchingParent] = useState(false);
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');

  useEffect(() => {
    fetchReferenceData();
    if (profile?.school_id) {
      getNextAdmissionNumber(profile.school_id).then(num => updateField('admission_number', num));
    }
  }, [profile]);

  useEffect(() => {
    if (form.class_id) {
      setFilteredSections(sections.filter((s) => s.class_id === form.class_id));
      setForm((prev) => ({ ...prev, section_id: '' }));
    } else {
      setFilteredSections([]);
    }
  }, [form.class_id, sections]);

  async function fetchReferenceData() {
    const [classRes, sectionRes, yearRes] = await Promise.all([
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('sections').select('id, name, class_id').order('name'),
      supabase.from('academic_years').select('id').eq('school_id', profile?.school_id ?? '').eq('is_current', true).maybeSingle(),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (sectionRes.data) setSections(sectionRes.data);
    if (yearRes.data) {
      setAcademicYearId(yearRes.data.id);
      const { data: termRes } = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', yearRes.data.id)
        .eq('is_current', true)
        .maybeSingle();
      if (termRes) setTermId((termRes as any).term_id);
    }
  }

  async function handleParentSearch(query: string) {
    setParentSearch(query);
    if (query.length < 2) {
      setParentResults([]);
      return;
    }
    setSearchingParent(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone')
      .eq('role', 'parent')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(5);
    setParentResults(data ?? []);
    setSearchingParent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.class_id || !form.password) {
      setSaveError('First Name, Last Name, Class, and Login Password are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setParentEmailWarning('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaveError('Your session has expired. Please log in again.');
      setSaving(false);
      return;
    }
    const authHeaders = { 
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    let createdStudentId: string | null = null;
    try {
      let parentId = form.parent_id;

      if (form.parent_mode === 'new') {
        if (!form.parent_email || !form.parent_first_name || !form.parent_last_name) {
          setSaveError('Parent First Name, Last Name, and Email are required for new parent creation.');
          setSaving(false);
          return;
        }

        // Create the parent account with a random placeholder password —
        // the parent sets their own via the emailed password-setup link.
        const placeholderPassword = crypto.randomUUID() + 'Aa1!';
        const { data: pData, error: pError } = await supabase.functions.invoke('create-user', {
          body: {
            email: form.parent_email,
            password: placeholderPassword,
            first_name: form.parent_first_name,
            last_name: form.parent_last_name,
            role: 'parent',
            phone: form.parent_phone,
            school_id: profile?.school_id,
          },
          headers: authHeaders,
        });

        if (pError) throw new Error(pData?.error || pError.message);
        if (pData?.error) throw new Error(pData.error);
        parentId = pData.user.id;

        // Email the parent a link to set their own password.
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.parent_email, {
          redirectTo: window.location.origin,
        });
        if (resetError) {
          // Don't abort the admission — the account exists; the email can be resent.
          console.error('Failed to send parent password-setup email:', resetError);
          setParentEmailWarning(`Parent account created, but the password-setup email could not be sent (${resetError.message}). Ask the parent to use "Forgot password" on the login page, or try again later.`);
        }
      }

      if (!parentId && form.parent_mode === 'existing') {
        setSaveError('Please select an existing parent or choose "New Parent".');
        setSaving(false);
        return;
      }

      // ✅ Pass all profile fields to edge function — no client-side profile update needed
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-user', {
        body: {
          admission_number: form.admission_number,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          role: 'student',
          phone: form.phone || '',
          gender: form.gender || '',
          school_id: profile?.school_id,
          date_of_birth: form.date_of_birth || null,
          blood_group: form.blood_group || null,
          religion: form.religion || null,
          nationality: form.nationality || null,
          address: form.address || null,
          city: form.city || null,
          class_id: form.class_id || null,
          section_id: form.section_id || null,
          roll_number: form.roll_number || null,
          admission_date: form.admission_date || null,
          guardian_name: form.guardian_name || null,
          guardian_relation: form.guardian_relation || null,
          guardian_phone: form.guardian_phone || null,
          guardian_email: form.guardian_email || null,
          state_of_origin: form.state_of_origin || '',
          lga: form.lga || '',
        },
        headers: authHeaders,
      });

      if (edgeError) throw new Error(edgeData?.error || edgeError.message || 'Edge Function error');
      if (!edgeData?.user) throw new Error(edgeData?.error || 'Failed to create student account');

      const userId = edgeData.user.id;
      createdStudentId = userId;

      // ✅ Insert into students table
      const { error: studentError } = await supabase.from('students').insert({
        id: userId,
        school_id: profile?.school_id,
        admission_number: form.admission_number,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        class_id: form.class_id || null,
        section: sections.find(s => s.id === form.section_id)?.name || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        religion: form.religion || null,
        nationality: form.nationality || null,
        phone: form.phone || '',
        address: form.address || null,
        city: form.city || null,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        guardian_email: form.guardian_email || null,
        state_of_origin: form.state_of_origin || '',
        lga: form.lga || '',
        roll_number: form.roll_number || null,
        admission_date: form.admission_date || null,
        status: 'active'
      });

      if (studentError) {
        console.error('Error creating student record:', studentError);
        throw studentError;
      }

      if (form.class_id && academicYearId) {
        const { error: enrollError } = await supabase.from('student_enrollments').insert({
          student_id: userId,
          class_id: form.class_id,
          academic_year_id: academicYearId,
          term_id: termId || null,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active'
        });
        if (enrollError) {
          console.error('Error creating enrollment:', enrollError);
          throw enrollError;
        }
      }

      if (parentId) {
        let rel = form.guardian_relation || 'guardian';
        if (rel === 'father' || rel === 'mother') rel = 'parent';

        const { error: linkError } = await supabase.from('parent_student_links').insert({
          parent_id: parentId,
          student_id: userId,
          relationship: rel,
        });
        if (linkError) {
          console.error('Error linking parent:', linkError);
          setSaveError('Student admitted but failed to link parent: ' + linkError.message);
          setSaving(false);
          return;
        }
      }

    } catch (err: any) {
      setSaveError(err.message);
      setSaving(false);
      return;
    }

    const admNum = form.admission_number;
    logActivity(profile, {
      action: 'student.admitted',
      entityType: 'student',
      entityId: createdStudentId,
      studentId: createdStudentId,
      details: { name: `${form.first_name} ${form.last_name}`, admission_number: admNum },
    });
    setSaving(false);
    setSuccessAdmissionNumber(admNum);
    
    // Get next number for the next entry
    if (!profile?.school_id) return;
    const num = await getNextAdmissionNumber(profile.school_id);
    setForm(f => ({ ...f, admission_number: num }));
    setParentSearch('');
    setParentResults([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const inputClass =
    'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus size={24} className="text-emerald-600" />
        <h1 className="text-2xl font-bold text-slate-800">Student Admission</h1>
      </div>

      {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
      {parentEmailWarning && <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-2">{parentEmailWarning}</div>}
      {successAdmissionNumber && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <p className="text-emerald-800 font-semibold text-sm">Student admitted successfully!</p>
          <p className="text-emerald-600 text-sm mt-1">
            Admission Number: <span className="font-bold">{successAdmissionNumber}</span>
          </p>
          {form.parent_mode === 'new' && !parentEmailWarning && (
            <p className="text-emerald-600 text-sm mt-1">
              A password-setup email has been sent to the parent.
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-5 pb-3 border-b border-slate-100">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={form.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                placeholder="Last name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                className={inputClass}
                value={form.date_of_birth}
                onChange={(e) => updateField('date_of_birth', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
              <select
                className={inputClass}
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
              <select
                className={inputClass}
                value={form.blood_group}
                onChange={(e) => updateField('blood_group', e.target.value)}
              >
                <option value="">Select blood group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Religion</label>
              <input
                className={inputClass}
                value={form.religion}
                onChange={(e) => updateField('religion', e.target.value)}
                placeholder="e.g. Islam, Christianity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
              <input
                className={inputClass}
                value={form.nationality}
                onChange={(e) => updateField('nationality', e.target.value)}
                placeholder="e.g. Bangladeshi"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State of Origin</label>
              <input
                className={inputClass}
                value={form.state_of_origin}
                onChange={(e) => updateField('state_of_origin', e.target.value)}
                placeholder="e.g. Rivers"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">LGA</label>
              <input
                className={inputClass}
                value={form.lga}
                onChange={(e) => updateField('lga', e.target.value)}
                placeholder="e.g. Okrika"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-5 pb-3 border-b border-slate-100">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Login Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={inputClass}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="Set student minimum password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="City"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-5 pb-3 border-b border-slate-100">
            Academic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Class <span className="text-red-500">*</span>
              </label>
              <select
                className={inputClass}
                value={form.class_id}
                onChange={(e) => updateField('class_id', e.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
              <select
                className={inputClass}
                value={form.section_id}
                onChange={(e) => updateField('section_id', e.target.value)}
                disabled={!form.class_id}
              >
                <option value="">Select section</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number</label>
              <input
                className={inputClass}
                value={form.roll_number}
                onChange={(e) => updateField('roll_number', e.target.value)}
                placeholder="Roll number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admission Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.admission_date}
                onChange={(e) => updateField('admission_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admission Number</label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={form.admission_number}
                  onChange={(e) => updateField('admission_number', e.target.value)}
                  placeholder="OGS-2024-001"
                />
                <button type="button" onClick={async () => { const n = await getNextAdmissionNumber(profile?.school_id || ''); setForm(f => ({ ...f, admission_number: n })); }} className="px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-5 pb-3 border-b border-slate-100">
            Guardian / Parent Information
          </h2>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => updateField('parent_mode', 'none')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${form.parent_mode === 'none' ? 'bg-slate-700 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              Skip for Now
            </button>
            <button
              type="button"
              onClick={() => updateField('parent_mode', 'existing')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${form.parent_mode === 'existing' ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              Select Existing Parent
            </button>
            <button
              type="button"
              onClick={() => updateField('parent_mode', 'new')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${form.parent_mode === 'new' ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              Add New Parent
            </button>
          </div>

          {form.parent_mode === 'none' && (
            <div className="text-center py-4 text-slate-400 text-sm">
              No parent account will be created. You can link a parent from the student's profile later.
            </div>
          )}

          {form.parent_mode === 'existing' && (
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Search Parent</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className={`${inputClass} pl-9`}
                    value={parentSearch}
                    onChange={(e) => handleParentSearch(e.target.value)}
                    placeholder="Search by name, email or phone..."
                  />
                  {searchingParent && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {parentResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    {parentResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          updateField('parent_id', p.id);
                          updateField('guardian_name', `${p.first_name} ${p.last_name}`);
                          updateField('guardian_email', p.email);
                          updateField('guardian_phone', p.phone);
                          setParentResults([]);
                          setParentSearch(`${p.first_name} ${p.last_name}`);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                            <p className="text-xs text-slate-500">{p.email} · {p.phone}</p>
                          </div>
                          {form.parent_id === p.id && <Check className="w-4 h-4 text-emerald-500" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {form.parent_id && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Selected: {form.guardian_name}</p>
                    <p className="text-xs text-emerald-600">{form.guardian_email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      updateField('parent_id', '');
                      setParentSearch('');
                    }}
                    className="ml-auto text-xs text-emerald-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          )}
          {form.parent_mode === 'new' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent First Name <span className="text-red-500">*</span></label>
                <input
                  className={inputClass}
                  value={form.parent_first_name}
                  onChange={(e) => {
                    updateField('parent_first_name', e.target.value);
                    updateField('guardian_name', `${e.target.value} ${form.parent_last_name}`);
                  }}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Last Name <span className="text-red-500">*</span></label>
                <input
                  className={inputClass}
                  value={form.parent_last_name}
                  onChange={(e) => {
                    updateField('parent_last_name', e.target.value);
                    updateField('guardian_name', `${form.parent_first_name} ${e.target.value}`);
                  }}
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.parent_email}
                  onChange={(e) => {
                    updateField('parent_email', e.target.value);
                    updateField('guardian_email', e.target.value);
                  }}
                  placeholder="Email address"
                />
              </div>
              <div className="md:col-span-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                The parent will receive an email at this address with a link to create their own password. They do not share the student's login password.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Phone</label>
                <input
                  className={inputClass}
                  value={form.parent_phone}
                  onChange={(e) => {
                    updateField('parent_phone', e.target.value);
                    updateField('guardian_phone', e.target.value);
                  }}
                  placeholder="Phone number"
                />
              </div>
            </div>
          )}

          {form.parent_mode !== 'none' && <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1">Relationship to Student</label>
            <select
              className={inputClass}
              value={form.guardian_relation}
              onChange={(e) => updateField('guardian_relation', e.target.value)}
            >
              <option value="">Select relation</option>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
              <option value="sibling">Sibling</option>
              <option value="other">Other</option>
            </select>
          </div>}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !form.first_name || !form.last_name || !form.class_id || !form.password}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            <UserPlus size={16} />
            {saving ? 'Admitting Student...' : 'Admit Student'}
          </button>
        </div>
      </form>
    </div>
  );
}
