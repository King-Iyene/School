import { useEffect, useState } from 'react';
import { Search, Plus, Trash2, CreditCard as Edit2, UserPlus, Archive, CheckCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const RELATIONSHIPS = ['Father','Mother','Guardian','Uncle','Aunt','Sibling','Other'];

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

const emptyProspect = {
  first_name: '', last_name: '', date_of_birth: '', gender: '',
  blood_group: '', religion: '', nationality: 'Nigerian',
  phone: '', address: '', city: '', state_of_origin: '', lga: '',
  student_type: 'day' as 'day' | 'boarding',
  class_applying_for: '', current_school: '', medical_conditions: '',
  guardian_name: '', guardian_phone: '', guardian_email: '',
  guardian_occupation: '', guardian_relationship: '', emergency_contact: '',
};

const emptyAdmitForm = {
  password: '', admission_number: '', class_id: '', section_id: '',
  admission_date: new Date().toISOString().split('T')[0],
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

type Tab = 'pending' | 'admitted' | 'rejected';

export default function ProspectiveStudents() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [prospects, setProspects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProspect);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Admit modal
  const [admitting, setAdmitting] = useState<any>(null);
  const [admitForm, setAdmitForm] = useState(emptyAdmitForm);
  const [admitSaving, setAdmitSaving] = useState(false);
  const [admitError, setAdmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [filteredSections, setFilteredSections] = useState<any[]>([]);

  // Detail view modal
  const [viewing, setViewing] = useState<any>(null);

  useEffect(() => { loadData(); }, [profile]);

  useEffect(() => {
    if (admitForm.class_id) {
      setFilteredSections(sections.filter(s => s.class_id === admitForm.class_id));
      setAdmitForm(f => ({ ...f, section_id: '' }));
    } else {
      setFilteredSections([]);
    }
  }, [admitForm.class_id, sections]);

  async function loadData() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [pRes, cRes, sRes] = await Promise.all([
      supabase.from('prospective_students').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false }),
      supabase.from('classes').select('id, name').eq('school_id', profile.school_id).order('name'),
      supabase.from('sections').select('id, name, class_id').order('name'),
    ]);
    setProspects(pRes.data ?? []);
    setClasses(cRes.data ?? []);
    setSections(sRes.data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyProspect);
    setSaveError('');
    setShowForm(true);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.rpc('final_update_prospective_student', {
      uuid_param: id,
      status_param: status
    });
    await loadData();
  }

  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      date_of_birth: p.date_of_birth ?? '',
      gender: p.gender ?? '',
      blood_group: p.blood_group ?? '',
      religion: p.religion ?? '',
      nationality: p.nationality ?? 'Nigerian',
      phone: p.phone ?? '',
      address: p.address ?? '',
      city: p.city ?? '',
      state_of_origin: p.state_of_origin ?? '',
      lga: p.lga ?? '',
      student_type: p.student_type ?? 'day',
      class_applying_for: p.class_applying_for ?? '',
      current_school: p.current_school ?? '',
      medical_conditions: p.medical_conditions ?? '',
      guardian_name: p.guardian_name ?? '',
      guardian_phone: p.guardian_phone ?? '',
      guardian_email: p.guardian_email ?? '',
      guardian_occupation: p.guardian_occupation ?? '',
      guardian_relationship: p.guardian_relationship ?? '',
      emergency_contact: p.emergency_contact ?? '',
    });
    setSaveError('');
    setShowForm(true);
  }

  async function saveProspect() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setSaveError('First name and last name are required.');
      return;
    }
    setSaving(true);
    setSaveError('');

    const payload = {
      ...form,
      school_id: profile?.school_id,
      medical_conditions: form.medical_conditions || 'None',
    };

    if (editingId) {
      const { error } = await supabase.from('prospective_students').update(payload).eq('id', editingId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('prospective_students').insert({ ...payload, status: 'pending' });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    await loadData();
  }

  async function deleteProspect(id: string) {
    if (!confirm('Permanently delete this prospect record?')) return;
    await supabase.from('prospective_students').delete().eq('id', id);
    await loadData();
  }

  async function rejectProspect(id: string) {
    if (!confirm('Mark this applicant as Rejected? They will be moved to the Archived view.')) return;
    await supabase.from('prospective_students').update({ status: 'rejected' }).eq('id', id);
    await loadData();
    if (viewing?.id === id) setViewing(null);
  }

  async function openAdmit(p: any) {
    if (!profile?.school_id) {
      setAdmitError('School ID missing from user profile.');
      return;
    }
    setAdmitting(p);
    const nextNum = await getNextAdmissionNumber(profile.school_id);
    setAdmitForm({ ...emptyAdmitForm, admission_number: nextNum });
    setAdmitError('');
    setShowPassword(false);
  }

  async function confirmAdmit() {
    if (!admitForm.password || admitForm.password.length < 6) {
      setAdmitError('Password must be at least 6 characters.');
      return;
    }
    if (!admitForm.admission_number.trim()) {
      setAdmitError('Admission number is required.');
      return;
    }

    setAdmitSaving(true);
    setAdmitError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      };

      // Create auth user + profile via edge function
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-user', {
        body: {
          admission_number: admitForm.admission_number,
          password: admitForm.password,
          first_name: admitting.first_name,
          last_name: admitting.last_name,
          role: 'student',
          phone: admitting.phone || '',
          gender: admitting.gender || '',
          school_id: profile?.school_id,
          date_of_birth: admitting.date_of_birth || null,
          blood_group: admitting.blood_group || null,
          religion: admitting.religion || null,
          nationality: admitting.nationality || null,
          address: admitting.address || null,
          city: admitting.city || null,
          class_id: admitForm.class_id || null,
          section_id: admitForm.section_id || null,
          admission_date: admitForm.admission_date || null,
          guardian_name: admitting.guardian_name || null,
          guardian_relation: admitting.guardian_relationship || null,
          guardian_phone: admitting.guardian_phone || null,
          guardian_email: admitting.guardian_email || null,
          state_of_origin: admitting.state_of_origin || '',
          lga: admitting.lga || '',
        },
        headers: authHeaders,
      });

      if (edgeError) throw new Error(edgeData?.error || edgeError.message || 'Edge Function error');
      if (!edgeData?.user) throw new Error(edgeData?.error || 'Failed to create student account');

      const userId = edgeData.user.id;

      // Insert student record
      const { error: stuError } = await supabase.from('students').insert({
        id: userId,
        school_id: profile?.school_id,
        admission_number: admitForm.admission_number,
        first_name: admitting.first_name,
        last_name: admitting.last_name,
        class_id: admitForm.class_id || null,
        section: sections.find(s => s.id === admitForm.section_id)?.name || null,
        date_of_birth: admitting.date_of_birth || null,
        gender: admitting.gender || null,
        blood_group: admitting.blood_group || null,
        religion: admitting.religion || null,
        nationality: admitting.nationality || null,
        phone: admitting.phone || '',
        address: admitting.address || null,
        city: admitting.city || null,
        guardian_name: admitting.guardian_name || null,
        guardian_phone: admitting.guardian_phone || null,
        guardian_email: admitting.guardian_email || null,
        state_of_origin: admitting.state_of_origin || '',
        lga: admitting.lga || '',
        admission_date: admitForm.admission_date || null,
        status: 'active',
      });
      if (stuError) throw stuError;

      // Enroll in current academic year
      const { data: yearData } = await supabase
        .from('academic_years').select('id')
        .eq('school_id', profile?.school_id ?? '').eq('is_current', true).maybeSingle();

      if (yearData) {
        const { data: termData } = await supabase
          .from('academic_year_terms').select('term_id')
          .eq('academic_year_id', yearData.id).eq('is_current', true).maybeSingle();

        await supabase.from('student_enrollments').insert({
          student_id: userId,
          class_id: admitForm.class_id || null,
          academic_year_id: yearData.id,
          term_id: (termData as any)?.term_id || null,
          enrollment_date: admitForm.admission_date,
          status: 'active',
        });
      }

      // Mark prospect as admitted
      await supabase.from('prospective_students').update({ status: 'admitted' }).eq('id', admitting.id);

      setAdmitting(null);
      await loadData();
    } catch (err: any) {
      setAdmitError(err.message);
    }
    setAdmitSaving(false);
  }

  const filtered = prospects.filter(p => {
    const str = `${p.first_name} ${p.last_name} ${p.application_ref ?? ''} ${p.guardian_email ?? ''} ${p.guardian_phone ?? ''}`.toLowerCase();
    return str.includes(search.toLowerCase()) && p.status === tab;
  });

  const tabCounts = {
    pending: prospects.filter(p => p.status === 'pending').length,
    admitted: prospects.filter(p => p.status === 'admitted').length,
    rejected: prospects.filter(p => p.status === 'rejected').length,
  };

  const TABS = [
    { key: 'pending', label: 'Active', icon: Clock, color: 'text-amber-600' },
    { key: 'admitted', label: 'Admitted', icon: CheckCircle, color: 'text-emerald-600' },
    { key: 'rejected', label: 'Archived', icon: Archive, color: 'text-slate-500' },
  ];

  function Field({ label, value }: { label: string; value?: string | null }) {
    return (
      <div className="bg-slate-50 rounded-xl p-3">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800 capitalize">{value || '—'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Prospective Students</h2>
          <p className="text-slate-500 text-sm">Manage admission applications and track applicant status</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Applicant
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className={`w-4 h-4 ${tab === key ? color : ''}`} />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === key ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-500'}`}>
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, ref, email, phone..."
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Applicant', 'Ref', 'Class Applying', 'Type', 'Guardian Phone', 'Applied', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                {tab === 'pending' ? 'No active applications' : tab === 'admitted' ? 'No admitted applicants yet' : 'No archived applicants'}
              </td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-slate-400">{p.guardian_email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.application_ref ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{p.class_applying_for || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${p.student_type === 'boarding' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {p.student_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{p.guardian_phone}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewing(p)}
                      title="View details"
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {tab === 'pending' && (
                      <>
                        <button
                          onClick={() => openEdit(p)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openAdmit(p)}
                          title="Admit student"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => rejectProspect(p.id)}
                          title="Reject / Archive"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteProspect(p.id)}
                      title="Delete permanently"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          {filtered.length} {tab === 'pending' ? 'active application' : tab === 'admitted' ? 'admitted' : 'archived'}{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Detail View Modal ── */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-slate-800">{viewing.first_name} {viewing.last_name}</h3>
                <p className="text-xs text-slate-500 font-mono">{viewing.application_ref}</p>
              </div>
              <div className="flex items-center gap-2">
                {viewing.status === 'pending' && (
                  <>
                    <button onClick={() => { setViewing(null); openEdit(viewing); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => { setViewing(null); openAdmit(viewing); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">
                      <UserPlus className="w-3.5 h-3.5" /> Admit
                    </button>
                    <button onClick={() => { rejectProspect(viewing.id); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors">
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </button>
                  </>
                )}
                <button onClick={() => setViewing(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Personal Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Date of Birth" value={viewing.date_of_birth ? new Date(viewing.date_of_birth).toLocaleDateString('en-GB') : undefined} />
                  <Field label="Gender" value={viewing.gender} />
                  <Field label="Blood Group" value={viewing.blood_group} />
                  <Field label="Religion" value={viewing.religion} />
                  <Field label="Nationality" value={viewing.nationality} />
                  <Field label="Phone" value={viewing.phone} />
                  <Field label="State of Origin" value={viewing.state_of_origin} />
                  <Field label="LGA" value={viewing.lga} />
                  <Field label="City" value={viewing.city} />
                </div>
                {viewing.address && (
                  <div className="mt-3 bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">Address</p>
                    <p className="text-sm font-semibold text-slate-800">{viewing.address}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Academic Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Class Applying For" value={viewing.class_applying_for} />
                  <Field label="Student Type" value={viewing.student_type} />
                  <Field label="Current / Previous School" value={viewing.current_school} />
                </div>
              </div>
              {viewing.medical_conditions && viewing.medical_conditions !== 'None' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Medical Conditions</p>
                  <p className="text-sm text-amber-800">{viewing.medical_conditions}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Guardian / Parent Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Name" value={viewing.guardian_name} />
                  <Field label="Relationship" value={viewing.guardian_relationship} />
                  <Field label="Phone" value={viewing.guardian_phone} />
                  <Field label="Email" value={viewing.guardian_email} />
                  <Field label="Occupation" value={viewing.guardian_occupation} />
                  <Field label="Emergency Contact" value={viewing.emergency_contact} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Prospect Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="font-bold text-slate-800">{editingId ? 'Edit Applicant' : 'Add New Applicant'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
            </div>
            <div className="p-5 space-y-6">
              {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}

              {/* Personal */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Personal Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" className={inputCls} value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select className={inputCls} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Blood Group</label>
                    <select className={inputCls} value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
                      <option value="">Select blood group</option>
                      {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Religion</label>
                    <input className={inputCls} value={form.religion} onChange={e => setForm(f => ({ ...f, religion: e.target.value }))} placeholder="e.g. Christianity" />
                  </div>
                  <div>
                    <label className={labelCls}>Nationality</label>
                    <input className={inputCls} value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="e.g. Nigerian" />
                  </div>
                  <div>
                    <label className={labelCls}>Phone (Student)</label>
                    <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Student phone number" />
                  </div>
                  <div>
                    <label className={labelCls}>State of Origin</label>
                    <select className={inputCls} value={form.state_of_origin} onChange={e => setForm(f => ({ ...f, state_of_origin: e.target.value }))}>
                      <option value="">Select state</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>LGA</label>
                    <input className={inputCls} value={form.lga} onChange={e => setForm(f => ({ ...f, lga: e.target.value }))} placeholder="Local Government Area" />
                  </div>
                  <div>
                    <label className={labelCls}>City</label>
                    <input className={inputCls} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Address</label>
                    <input className={inputCls} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
                  </div>
                </div>
              </div>

              {/* Academic */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Academic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Class Applying For</label>
                    <input className={inputCls} value={form.class_applying_for} onChange={e => setForm(f => ({ ...f, class_applying_for: e.target.value }))} placeholder="e.g. JSS 1" />
                  </div>
                  <div>
                    <label className={labelCls}>Student Type</label>
                    <select className={inputCls} value={form.student_type} onChange={e => setForm(f => ({ ...f, student_type: e.target.value as 'day' | 'boarding' }))}>
                      <option value="day">Day Student</option>
                      <option value="boarding">Boarding Student</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Current / Previous School</label>
                    <input className={inputCls} value={form.current_school} onChange={e => setForm(f => ({ ...f, current_school: e.target.value }))} placeholder="Name of current or previous school" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Medical Conditions / Allergies</label>
                    <textarea className={`${inputCls} resize-none`} rows={2} value={form.medical_conditions} onChange={e => setForm(f => ({ ...f, medical_conditions: e.target.value }))} placeholder="List any known medical conditions or allergies, or leave blank" />
                  </div>
                </div>
              </div>

              {/* Guardian */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Guardian / Parent Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Guardian Name</label>
                    <input className={inputCls} value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div>
                    <label className={labelCls}>Relationship</label>
                    <select className={inputCls} value={form.guardian_relationship} onChange={e => setForm(f => ({ ...f, guardian_relationship: e.target.value }))}>
                      <option value="">Select relationship</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Guardian Phone</label>
                    <input className={inputCls} value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} placeholder="Phone number" />
                  </div>
                  <div>
                    <label className={labelCls}>Guardian Email</label>
                    <input type="email" className={inputCls} value={form.guardian_email} onChange={e => setForm(f => ({ ...f, guardian_email: e.target.value }))} placeholder="Email address" />
                  </div>
                  <div>
                    <label className={labelCls}>Guardian Occupation</label>
                    <input className={inputCls} value={form.guardian_occupation} onChange={e => setForm(f => ({ ...f, guardian_occupation: e.target.value }))} placeholder="Occupation" />
                  </div>
                  <div>
                    <label className={labelCls}>Emergency Contact Number</label>
                    <input className={inputCls} value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="Emergency phone number" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={saveProspect} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Applicant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admit Student Modal ── */}
      {admitting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-slate-800">Admit Student</h3>
                <p className="text-sm text-slate-500">{admitting.first_name} {admitting.last_name}</p>
              </div>
              <button onClick={() => setAdmitting(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {admitError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{admitError}</div>}

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-800">
                  This will create a student account and add <strong>{admitting.first_name} {admitting.last_name}</strong> to the Student List. Fill in the details below to complete admission.
                </p>
              </div>

              <div>
                <label className={labelCls}>Admission Number <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input className={inputCls} value={admitForm.admission_number} onChange={e => setAdmitForm(f => ({ ...f, admission_number: e.target.value }))} placeholder="OGS-2026-001" />
                  <button type="button" onClick={async () => { const n = await getNextAdmissionNumber(profile?.school_id || ''); setAdmitForm(f => ({ ...f, admission_number: n })); }} className="px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Login Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className={inputCls} value={admitForm.password} onChange={e => setAdmitForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Assign Class</label>
                <select className={inputCls} value={admitForm.class_id} onChange={e => setAdmitForm(f => ({ ...f, class_id: e.target.value }))}>
                  <option value="">Select class (optional)</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {filteredSections.length > 0 && (
                <div>
                  <label className={labelCls}>Section</label>
                  <select className={inputCls} value={admitForm.section_id} onChange={e => setAdmitForm(f => ({ ...f, section_id: e.target.value }))}>
                    <option value="">Select section</option>
                    {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Admission Date</label>
                <input type="date" className={inputCls} value={admitForm.admission_date} onChange={e => setAdmitForm(f => ({ ...f, admission_date: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setAdmitting(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={confirmAdmit} disabled={admitSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <UserPlus className="w-4 h-4" />
                  {admitSaving ? 'Admitting...' : 'Confirm Admission'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
