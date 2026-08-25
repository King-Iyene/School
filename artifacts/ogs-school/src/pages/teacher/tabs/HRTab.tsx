import { useEffect, useState } from 'react';
import { Save, CreditCard as Edit2, Users, Building, CreditCard, Briefcase } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface Props { profileId: string; schoolId: string; profile: any; onProfileUpdate: (p: any) => void; }

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm"><Icon className="w-4 h-4 text-emerald-600" />{title}</h4>
      {children}
    </div>
  );
}

export default function HRTab({ profileId, schoolId, profile, onProfileUpdate }: Props) {
  const { profile: viewer } = useAuth();
  const isAdmin = viewer?.role === 'super_admin' || viewer?.role === 'admin' || viewer?.role === 'principal';

  const [hr, setHr] = useState<any>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editHR, setEditHR] = useState(false);
  const [editPayroll, setEditPayroll] = useState(false);
  const [saving, setSaving] = useState('');
  const [saveHRError, setSaveHRError] = useState('');

  const [pForm, setPForm] = useState({
    department: '', employment_type: 'full_time', marital_status: '',
    nationality: 'Nigerian', state_of_origin: '', lga: '', religion: '',
    join_date: '', bio: '',
  });

  const [hrForm, setHrForm] = useState({
    nok_name: '', nok_relationship: '', nok_phone: '', nok_email: '', nok_address: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    bank_name: '', account_number: '', account_name: '', bvn: '',
    pfa_name: '', pfa_number: '', previous_employer: '', years_of_experience: 0,
    specialization: '', staff_category: 'teaching',
  });

  const [payrollForm, setPayrollForm] = useState({
    basic_salary: 0, housing_allowance: 0, transport_allowance: 0,
    other_allowances: 0, deductions: 0,
  });

  useEffect(() => {
    if (profile) {
      setPForm({
        department: profile.department ?? '',
        employment_type: profile.employment_type ?? 'full_time',
        marital_status: profile.marital_status ?? '',
        nationality: profile.nationality ?? 'Nigerian',
        state_of_origin: profile.state_of_origin ?? '',
        lga: profile.lga ?? '',
        religion: profile.religion ?? '',
        join_date: profile.join_date ?? '',
        bio: profile.bio ?? '',
      });
      setPayrollForm({
        basic_salary: profile.basic_salary ?? 0,
        housing_allowance: profile.housing_allowance ?? 0,
        transport_allowance: profile.transport_allowance ?? 0,
        other_allowances: profile.other_allowances ?? 0,
        deductions: profile.deductions ?? 0,
      });
      setHrForm(prev => ({
        ...prev,
        bank_name: prev.bank_name || profile.bank_name || '',
        account_number: prev.account_number || profile.account_number || '',
        account_name: prev.account_name || profile.account_name || '',
        nok_name: prev.nok_name || profile.next_of_kin_name || '',
        nok_relationship: prev.nok_relationship || profile.next_of_kin_relationship || '',
        nok_phone: prev.nok_phone || profile.next_of_kin_phone || '',
        nok_address: prev.nok_address || profile.next_of_kin_address || '',
        years_of_experience: prev.years_of_experience || Number(profile.years_of_experience) || 0,
      }));
    }
    loadHR();
  }, [profileId, profile]);

  async function loadHR() {
    const { data } = await supabase.from('staff_hr_details').select('*').eq('profile_id', profileId).maybeSingle();
    if (data) {
      setHr(data);
      setHrForm({
        nok_name: data.nok_name || profile?.next_of_kin_name || '',
        nok_relationship: data.nok_relationship || profile?.next_of_kin_relationship || '',
        nok_phone: data.nok_phone || profile?.next_of_kin_phone || '',
        nok_email: data.nok_email ?? '',
        nok_address: data.nok_address || profile?.next_of_kin_address || '',
        emergency_contact_name: data.emergency_contact_name ?? '',
        emergency_contact_phone: data.emergency_contact_phone ?? '',
        emergency_contact_relationship: data.emergency_contact_relationship ?? '',
        bank_name: data.bank_name || profile?.bank_name || '',
        account_number: data.account_number || profile?.account_number || '',
        account_name: data.account_name || profile?.account_name || '',
        bvn: data.bvn ?? '',
        pfa_name: data.pfa_name ?? '',
        pfa_number: data.pfa_number ?? '',
        previous_employer: data.previous_employer ?? '',
        years_of_experience: data.years_of_experience || Number(profile?.years_of_experience) || 0,
        specialization: data.specialization ?? '',
        staff_category: data.staff_category ?? 'teaching',
      });
    }
  }

  async function saveProfile() {
    setSaving('profile');
    const { data, error } = await supabase.from('profiles')
      .update({ ...pForm, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .maybeSingle();
    setSaving('');
    if (!error && data) { onProfileUpdate(data); setEditProfile(false); }
  }

  async function saveHR() {
    setSaving('hr');
    setSaveHRError('');

    const profileFields = {
      bank_name: hrForm.bank_name,
      account_number: hrForm.account_number,
      account_name: hrForm.account_name,
      next_of_kin_name: hrForm.nok_name,
      next_of_kin_relationship: hrForm.nok_relationship,
      next_of_kin_phone: hrForm.nok_phone,
      next_of_kin_address: hrForm.nok_address,
      years_of_experience: String(hrForm.years_of_experience),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile } = await supabase.from('profiles')
      .update(profileFields)
      .eq('id', profileId)
      .select()
      .maybeSingle();
    if (updatedProfile) onProfileUpdate(updatedProfile);

    const payload = { ...hrForm, profile_id: profileId, school_id: schoolId };
    if (hr) {
      await supabase.from('staff_hr_details').update({ ...hrForm, updated_at: new Date().toISOString() }).eq('id', hr.id);
    } else {
      await supabase.from('staff_hr_details').insert(payload);
    }

    setSaving('');
    setEditHR(false);
    loadHR();
  }

  async function savePayroll() {
    setSaving('payroll');
    const { data, error } = await supabase.from('profiles')
      .update({ ...payrollForm, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .maybeSingle();
    setSaving('');
    if (!error && data) { onProfileUpdate(data); setEditPayroll(false); }
  }

  const gross = Number(payrollForm.basic_salary) + Number(payrollForm.housing_allowance) + Number(payrollForm.transport_allowance) + Number(payrollForm.other_allowances);
  const net = gross - Number(payrollForm.deductions);

  const displayBankName = hr?.bank_name || profile?.bank_name || '—';
  const displayAccNum = hr?.account_number || profile?.account_number || '—';
  const displayAccName = hr?.account_name || profile?.account_name || '—';
  const displayNokName = hr?.nok_name || profile?.next_of_kin_name || '—';
  const displayNokRel = hr?.nok_relationship || profile?.next_of_kin_relationship || '—';
  const displayNokPhone = hr?.nok_phone || profile?.next_of_kin_phone || '—';
  const displayNokAddr = hr?.nok_address || profile?.next_of_kin_address || '—';

  return (
    <div className="space-y-5">
      {/* Employment Details */}
      <Section title="Employment Details" icon={Briefcase}>
        <div className="flex justify-end mb-3">
          {isAdmin && !editProfile && <button onClick={() => setEditProfile(true)} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"><Edit2 className="w-3 h-3" /> Edit</button>}
        </div>
        {editProfile ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Department</label><input value={pForm.department} onChange={e => setPForm({ ...pForm, department: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Employment Type</label>
                <select value={pForm.employment_type} onChange={e => setPForm({ ...pForm, employment_type: e.target.value })} className={`${inputCls} bg-white`}>
                  <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option><option value="intern">Intern</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Join Date</label><input type="date" value={pForm.join_date} onChange={e => setPForm({ ...pForm, join_date: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Marital Status</label>
                <select value={pForm.marital_status} onChange={e => setPForm({ ...pForm, marital_status: e.target.value })} className={`${inputCls} bg-white`}>
                  <option value="">Select...</option><option value="single">Single</option><option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Nationality</label><input value={pForm.nationality} onChange={e => setPForm({ ...pForm, nationality: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>State of Origin</label><input value={pForm.state_of_origin} onChange={e => setPForm({ ...pForm, state_of_origin: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>LGA</label><input value={pForm.lga} onChange={e => setPForm({ ...pForm, lga: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Religion</label><input value={pForm.religion} onChange={e => setPForm({ ...pForm, religion: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Bio / Profile Summary</label><textarea value={pForm.bio} onChange={e => setPForm({ ...pForm, bio: e.target.value })} rows={3} className={`${inputCls} resize-none`} /></div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditProfile(false)} className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveProfile} disabled={saving === 'profile'} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" />{saving === 'profile' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            {[
              { l: 'Department', v: profile?.department || '—' },
              { l: 'Employment Type', v: (profile?.employment_type ?? '').replace('_', ' ') || '—' },
              { l: 'Join Date', v: profile?.join_date ? new Date(profile.join_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
              { l: 'Marital Status', v: profile?.marital_status || '—' },
              { l: 'Nationality', v: profile?.nationality || '—' },
              { l: 'State of Origin', v: profile?.state_of_origin || '—' },
              { l: 'LGA', v: profile?.lga || '—' },
              { l: 'Religion', v: profile?.religion || '—' },
            ].map(({ l, v }) => (
              <div key={l}><dt className={labelCls}>{l}</dt><dd className="text-sm font-semibold text-slate-800 capitalize">{v}</dd></div>
            ))}
            {profile?.bio && <div className="col-span-full"><dt className={labelCls}>Bio</dt><dd className="text-sm text-slate-700">{profile.bio}</dd></div>}
          </dl>
        )}
      </Section>

      {/* Next of Kin & Emergency Contact */}
      <Section title="Next of Kin & Emergency Contact" icon={Users}>
        <div className="flex justify-end mb-3">
          {isAdmin && !editHR && <button onClick={() => setEditHR(true)} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"><Edit2 className="w-3 h-3" /> Edit</button>}
        </div>
        {editHR ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Next of Kin</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Full Name</label><input value={hrForm.nok_name} onChange={e => setHrForm({ ...hrForm, nok_name: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Relationship</label><input value={hrForm.nok_relationship} onChange={e => setHrForm({ ...hrForm, nok_relationship: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input value={hrForm.nok_phone} onChange={e => setHrForm({ ...hrForm, nok_phone: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input type="email" value={hrForm.nok_email} onChange={e => setHrForm({ ...hrForm, nok_email: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Address</label><input value={hrForm.nok_address} onChange={e => setHrForm({ ...hrForm, nok_address: e.target.value })} className={inputCls} /></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-2">Emergency Contact</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Name</label><input value={hrForm.emergency_contact_name} onChange={e => setHrForm({ ...hrForm, emergency_contact_name: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input value={hrForm.emergency_contact_phone} onChange={e => setHrForm({ ...hrForm, emergency_contact_phone: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Relationship</label><input value={hrForm.emergency_contact_relationship} onChange={e => setHrForm({ ...hrForm, emergency_contact_relationship: e.target.value })} className={inputCls} /></div>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-2">Professional Background</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Previous Employer</label><input value={hrForm.previous_employer} onChange={e => setHrForm({ ...hrForm, previous_employer: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Years of Experience</label><input type="number" min={0} value={hrForm.years_of_experience} onChange={e => setHrForm({ ...hrForm, years_of_experience: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
              <div><label className={labelCls}>Specialization</label><input value={hrForm.specialization} onChange={e => setHrForm({ ...hrForm, specialization: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Staff Category</label>
                <select value={hrForm.staff_category} onChange={e => setHrForm({ ...hrForm, staff_category: e.target.value })} className={`${inputCls} bg-white`}>
                  <option value="teaching">Teaching</option><option value="non_teaching">Non-Teaching</option><option value="support">Support</option>
                </select>
              </div>
            </div>
            {saveHRError && <p className="text-xs text-red-500">{saveHRError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditHR(false)} className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveHR} disabled={saving === 'hr'} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" />{saving === 'hr' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Next of Kin</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {[
                  { l: 'Name', v: displayNokName },
                  { l: 'Relationship', v: displayNokRel },
                  { l: 'Phone', v: displayNokPhone },
                  { l: 'Email', v: hr?.nok_email || '—' },
                  { l: 'Address', v: displayNokAddr },
                ].map(({ l, v }) => <div key={l}><dt className={labelCls}>{l}</dt><dd className="text-sm font-semibold text-slate-800">{v}</dd></div>)}
              </dl>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Emergency Contact</p>
              <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
                {[
                  { l: 'Name', v: hr?.emergency_contact_name || '—' },
                  { l: 'Phone', v: hr?.emergency_contact_phone || '—' },
                  { l: 'Relationship', v: hr?.emergency_contact_relationship || '—' },
                ].map(({ l, v }) => <div key={l}><dt className={labelCls}>{l}</dt><dd className="text-sm font-semibold text-slate-800">{v}</dd></div>)}
              </dl>
            </div>
          </div>
        )}
      </Section>

      {/* Bank & Payroll */}
      {isAdmin && (
        <Section title="Payroll & Bank Details" icon={CreditCard}>
          <div className="flex justify-end mb-3">
            {!editPayroll && !editHR && <button onClick={() => { setEditPayroll(true); setEditHR(true); }} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"><Edit2 className="w-3 h-3" /> Edit</button>}
          </div>
          {editPayroll ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bank Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Bank Name</label><input value={hrForm.bank_name} onChange={e => setHrForm({ ...hrForm, bank_name: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Account Number</label><input value={hrForm.account_number} onChange={e => setHrForm({ ...hrForm, account_number: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Account Name</label><input value={hrForm.account_name} onChange={e => setHrForm({ ...hrForm, account_name: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>BVN</label><input value={hrForm.bvn} onChange={e => setHrForm({ ...hrForm, bvn: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>PFA Name</label><input value={hrForm.pfa_name} onChange={e => setHrForm({ ...hrForm, pfa_name: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>PFA Number</label><input value={hrForm.pfa_number} onChange={e => setHrForm({ ...hrForm, pfa_number: e.target.value })} className={inputCls} /></div>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-2">Salary Structure (₦)</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Basic Salary</label><input type="number" min={0} value={payrollForm.basic_salary} onChange={e => setPayrollForm({ ...payrollForm, basic_salary: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Housing Allowance</label><input type="number" min={0} value={payrollForm.housing_allowance} onChange={e => setPayrollForm({ ...payrollForm, housing_allowance: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Transport Allowance</label><input type="number" min={0} value={payrollForm.transport_allowance} onChange={e => setPayrollForm({ ...payrollForm, transport_allowance: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Other Allowances</label><input type="number" min={0} value={payrollForm.other_allowances} onChange={e => setPayrollForm({ ...payrollForm, other_allowances: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Deductions</label><input type="number" min={0} value={payrollForm.deductions} onChange={e => setPayrollForm({ ...payrollForm, deductions: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-700">Net Monthly Pay</span>
                <span className="text-lg font-bold text-emerald-800">₦{net.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditPayroll(false); setEditHR(false); }} className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2 text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={async () => { await saveHR(); await savePayroll(); }} disabled={saving !== ''} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" />Save All
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Bank Details</p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                  {[
                    { l: 'Bank', v: displayBankName },
                    { l: 'Account No.', v: displayAccNum },
                    { l: 'Account Name', v: displayAccName },
                    { l: 'PFA', v: hr?.pfa_name || '—' },
                    { l: 'PFA Number', v: hr?.pfa_number || '—' },
                  ].map(({ l, v }) => <div key={l}><dt className={labelCls}>{l}</dt><dd className="text-sm font-semibold text-slate-800">{v}</dd></div>)}
                </dl>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Salary</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { l: 'Basic', v: profile?.basic_salary },
                    { l: 'Housing', v: profile?.housing_allowance },
                    { l: 'Transport', v: profile?.transport_allowance },
                    { l: 'Other', v: profile?.other_allowances },
                    { l: 'Deductions', v: profile?.deductions },
                  ].map(({ l, v }) => (
                    <div key={l} className="bg-slate-50 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-slate-500 mb-0.5">{l}</p>
                      <p className="text-sm font-bold text-slate-800">₦{Number(v ?? 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 bg-emerald-50 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-700">Net Monthly Pay</span>
                  <span className="text-lg font-bold text-emerald-800">₦{(Number(profile?.basic_salary ?? 0) + Number(profile?.housing_allowance ?? 0) + Number(profile?.transport_allowance ?? 0) + Number(profile?.other_allowances ?? 0) - Number(profile?.deductions ?? 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
