import { useEffect, useState } from 'react';
import {
  Search, Plus, Trash2, CreditCard as Edit2, UserPlus, Archive,
  CheckCircle, Clock, Eye, EyeOff, Link2, Copy, Check, Globe,
  ClipboardList, GraduationCap, Users, ChevronRight, Calendar,
  FileText, Star, AlertCircle, X, Printer,
} from 'lucide-react';
import { printAdmissionLetter } from '../../components/print/AdmissionLetterPrint';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { schoolCodeFromName } from '../../lib/schoolCode';
import { apiUrl } from '../../lib/apiUrl';

/* ─── Constants ─────────────────────────────────────────────────────────── */
const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const RELATIONSHIPS = ['Aunt','Father','Guardian','Mother','Other','Sibling','Uncle'];

/* Guardian email is required by the DB insert policy; staff may not have it
   at data-entry time, so we store a placeholder and hide it in the UI. */
const PLACEHOLDER_EMAIL = 'no-email@pending.local';
const displayEmail = (e?: string|null) => (!e || e === PLACEHOLDER_EMAIL) ? '' : e;

const inputCls  = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-app-surface';
const labelCls  = 'block text-sm font-medium text-app-text mb-1';

/* ─── Stage config ───────────────────────────────────────────────────────── */
const STAGES = [
  { key: 'applications', label: 'Applications',  icon: ClipboardList, color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    statuses: ['pending'] },
  { key: 'exam',         label: 'Exam',           icon: GraduationCap, color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',   statuses: ['exam_invited','exam_scheduled','exam_done'] },
  { key: 'interview',    label: 'Interview',      icon: Users,         color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-200',  statuses: ['interview_scheduled','interview_done'] },
  { key: 'admitted',     label: 'Admitted',       icon: CheckCircle,   color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200', statuses: ['admitted'] },
  { key: 'rejected',     label: 'Archived',       icon: Archive,       color: 'text-app-text-muted',  bg: 'bg-app-surface-alt',   border: 'border-app-border',   statuses: ['rejected'] },
] as const;

type StageKey = typeof STAGES[number]['key'];

// Human-readable status label
function statusLabel(status: string) {
  const MAP: Record<string,string> = {
    pending:              'Application Received',
    exam_invited:         'Invited to Exam',
    exam_scheduled:       'Exam Booked',
    exam_done:            'Exam Completed',
    interview_scheduled:  'Interview Scheduled',
    interview_done:       'Interview Done',
    admitted:             'Admitted',
    rejected:             'Rejected',
  };
  return MAP[status] ?? status;
}

function stageOfStatus(status: string): StageKey {
  for (const s of STAGES) {
    if ((s.statuses as readonly string[]).includes(status)) return s.key;
  }
  return 'applications';
}

/**
 * Derives the effective pipeline status from data columns.
 * This means stage progression works even when the DB status column cannot be
 * updated due to a check constraint that hasn't been migrated yet.
 */
function effectiveStatus(p: any): string {
  if (p.status === 'admitted' || p.status === 'rejected') return p.status;
  if (p.interview_outcome)  return 'interview_done';
  if (p.interview_date)     return 'interview_scheduled';
  if (p.exam_score != null) return 'exam_done';
  return p.status ?? 'pending';
}

/* ─── Admission number helper ────────────────────────────────────────────── */
async function getNextAdmissionNumber(schoolId: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const [{ data: sData }, { data: pData }, { data: prData }] = await Promise.all([
      supabase.from('students').select('admission_number').eq('school_id', schoolId).ilike('admission_number', `${prefix}-${year}-%`),
      supabase.from('profiles').select('admission_number').eq('school_id', schoolId).ilike('admission_number', `${prefix}-${year}-%`),
      supabase.from('prospective_students').select('admission_number').eq('school_id', schoolId).ilike('admission_number', `${prefix}-${year}-%`),
    ]);
    const allNums = [...(sData||[]),...(pData||[]),...(prData||[])].map((x:any)=>x.admission_number).filter(Boolean);
    if (!allNums.length) return `${prefix}-${year}-001`;
    let max = 0;
    allNums.forEach((n:string) => { const s=parseInt(n.split('-').pop()??'0'); if(s>max) max=s; });
    const next = max + 1;
    return `${prefix}-${year}-${String(next).padStart(next>=1000?0:3,'0')}`;
  } catch { return `${prefix}-${year}-001`; }
}

/* ─── Empty forms ────────────────────────────────────────────────────────── */
const emptyProspect = {
  first_name:'', last_name:'', date_of_birth:'', gender:'',
  blood_group:'', religion:'', nationality:'Nigerian',
  phone:'', address:'', city:'', state_of_origin:'', lga:'',
  student_type:'day' as 'day'|'boarding',
  class_applying_for:'', current_school:'', medical_conditions:'',
  guardian_name:'', guardian_phone:'', guardian_email:'',
  guardian_occupation:'', guardian_relationship:'', emergency_contact:'',
};

const emptyAdmitForm = {
  password:'', admission_number:'', class_id:'', section_id:'',
  admission_date: new Date().toISOString().split('T')[0],
};

/* ─── Shared field display ───────────────────────────────────────────────── */
function Field({ label, value }: { label: string; value?: string|null }) {
  return (
    <div className="bg-app-surface-alt rounded-xl p-3">
      <p className="text-xs text-app-text-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-app-text capitalize">{value||'—'}</p>
    </div>
  );
}

/* ─── Pipeline progress bar ──────────────────────────────────────────────── */
function PipelineBar({ status }: { status: string }) {
  const stageKeys = STAGES.map(s=>s.key);
  const currentStage = stageOfStatus(status);
  const currentIdx   = stageKeys.indexOf(currentStage);

  return (
    <div className="flex items-center gap-0 w-full">
      {STAGES.map((s, idx) => {
        const done    = idx < currentIdx;
        const current = idx === currentIdx;
        const Icon    = s.icon;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
              done    ? 'text-emerald-600 bg-emerald-50'  :
              current ? `${s.color} ${s.bg}`               :
                        'text-app-text-muted bg-app-surface-alt'
            }`}>
              {done ? <CheckCircle className="w-3 h-3"/> : <Icon className="w-3 h-3"/>}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {idx < STAGES.length-1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════════ */
export default function ProspectiveStudents() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [tab, setTab]           = useState<StageKey>('applications');
  const [prospects, setProspects] = useState<any[]>([]);
  const [classes, setClasses]   = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // ── Add/Edit modal
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string|null>(null);
  const [form, setForm]             = useState(emptyProspect);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');

  // ── Admit modal
  const [admitting, setAdmitting]       = useState<any>(null);
  const [admitForm, setAdmitForm]       = useState(emptyAdmitForm);
  const [admitSaving, setAdmitSaving]   = useState(false);
  const [admitError, setAdmitError]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [filteredSections, setFilteredSections] = useState<any[]>([]);

  // ── Exam result modal
  const [examModal, setExamModal]   = useState<any>(null);
  const [examForm, setExamForm]     = useState({ exam_date: '', exam_score: '', exam_max_score: '100', exam_notes: '' });
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError]   = useState('');

  // ── Interview modal
  const [interviewModal, setInterviewModal]   = useState<any>(null);
  const [interviewForm, setInterviewForm]     = useState({ interview_date: '', interview_notes: '', interview_outcome: '' });
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewError, setInterviewError]   = useState('');

  // ── Detail view modal
  const [viewing, setViewing] = useState<any>(null);

  // ── Success toast
  const [successMsg, setSuccessMsg] = useState('');
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout>|null>(null);
  function showToast(msg: string) {
    if (toastTimer) clearTimeout(toastTimer);
    setSuccessMsg(msg);
    setToastTimer(setTimeout(() => setSuccessMsg(''), 3500));
  }

  // ── Copy link state
  const [copied, setCopied]   = useState(false);

  // ── Print admission letter
  async function handlePrintLetter(p: any) {
    let admissionNumber = p.admission_number || '[ADMISSION NUMBER]';
    if (!p.admission_number) {
      const { data } = await supabase
        .from('students')
        .select('admission_number')
        .eq('school_id', profile?.school_id ?? '')
        .eq('first_name', p.first_name)
        .eq('last_name', p.last_name)
        .maybeSingle();
      if (data?.admission_number) admissionNumber = data.admission_number;
    }
    printAdmissionLetter(p, admissionNumber, settings);
  }

  const applyUrl  = `${window.location.origin}/admission`;
  const statusUrl = `${window.location.origin}/application-status`;

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  /* ── Data loading ─────────────────────────────────────────────────────── */
  useEffect(() => { loadData(); }, [profile]);

  useEffect(() => {
    if (admitForm.class_id) {
      setFilteredSections(sections.filter(s=>s.class_id===admitForm.class_id));
      setAdmitForm(f=>({...f, section_id:''}));
    } else {
      setFilteredSections([]);
    }
  }, [admitForm.class_id, sections]);

  async function loadData() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [pRes, cRes, sRes] = await Promise.all([
      supabase.from('prospective_students').select('*').eq('school_id', profile.school_id).order('created_at',{ascending:false}),
      supabase.from('classes').select('id,name').eq('school_id',profile.school_id).order('name'),
      supabase.from('sections').select('id,name,class_id').order('name'),
    ]);
    setProspects(pRes.data ?? []);
    setClasses(cRes.data ?? []);
    setSections(sRes.data ?? []);
    setLoading(false);
  }

  /* ── CRUD helpers ─────────────────────────────────────────────────────── */
  function openAdd() { setEditingId(null); setForm(emptyProspect); setSaveError(''); setShowForm(true); }

  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      first_name: p.first_name??'', last_name: p.last_name??'',
      date_of_birth: p.date_of_birth??'', gender: p.gender??'',
      blood_group: p.blood_group??'', religion: p.religion??'',
      nationality: p.nationality??'Nigerian', phone: p.phone??'',
      address: p.address??'', city: p.city??'',
      state_of_origin: p.state_of_origin??'', lga: p.lga??'',
      student_type: p.student_type??'day',
      class_applying_for: p.class_applying_for??'',
      current_school: p.current_school??'',
      medical_conditions: p.medical_conditions??'',
      guardian_name: p.guardian_name??'', guardian_phone: p.guardian_phone??'',
      guardian_email: displayEmail(p.guardian_email), guardian_occupation: p.guardian_occupation??'',
      guardian_relationship: p.guardian_relationship??'', emergency_contact: p.emergency_contact??'',
    });
    setSaveError(''); setShowForm(true);
  }

  async function saveProspect() {
    if (!form.first_name.trim()||!form.last_name.trim()) { setSaveError('First name and last name are required.'); return; }
    setSaving(true); setSaveError('');
    const payload = {
      ...form,
      school_id: profile?.school_id,
      medical_conditions: form.medical_conditions || 'None',
      // Postgres rejects "" for date columns — send null when empty
      date_of_birth: form.date_of_birth || null,
      // DB security policy requires a non-empty guardian email on insert.
      // Staff may not have it at data-entry time, so use a placeholder that
      // the UI hides (see displayEmail helper).
      guardian_email: form.guardian_email?.trim() || PLACEHOLDER_EMAIL,
    };
    if (editingId) {
      const { error } = await supabase.from('prospective_students').update(payload).eq('id', editingId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('prospective_students').insert({ ...payload, status:'pending' });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    const name = `${form.first_name} ${form.last_name}`;
    setSaving(false); setShowForm(false); await loadData();
    showToast(editingId ? `${name}'s record updated.` : `${name} added as a new applicant.`);
  }

  async function deleteProspect(id: string) {
    if (!confirm('Permanently delete this applicant record?')) return;
    // Try a real delete first
    const { count, error: delError } = await supabase
      .from('prospective_students')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (delError) {
      // A real failure (network/DB) — surface it, don't silently archive
      alert(`Could not delete record: ${delError.message}`);
      return;
    }
    if (count && count > 0) {
      await loadData();
      showToast('Applicant record deleted.');
      return;
    }
    // Delete silently removed 0 rows = blocked by DB security policy —
    // archive instead so it disappears from the pipeline.
    const { error } = await supabase
      .from('prospective_students')
      .update({ status: 'rejected' })
      .eq('id', id);
    await loadData();
    if (error) alert(`Could not remove record: ${error.message}`);
    else showToast('Applicant record removed (archived).');
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from('prospective_students')
      .update({ status })
      .eq('id', id);
    if (error) { alert('Failed to update status: ' + error.message); return; }
    await loadData();
    if (viewing?.id === id) setViewing(v => v ? { ...v, status } : null);
  }

  async function rejectProspect(id: string) {
    if (!confirm('Archive this applicant as rejected?')) return;
    await setStatus(id, 'rejected');
    if (viewing?.id === id) setViewing(null);
  }

  /* ── Invite to exam ───────────────────────────────────────────────────── */
  async function inviteToExam(p: any) {
    // Use exam_scheduled (within DB constraint); exam_invited kept in Exam stage
    // for any records that already carry that value.
    await setStatus(p.id, 'exam_scheduled');
  }

  /* ── Exam result modal ────────────────────────────────────────────────── */
  function openExamModal(p: any) {
    setExamModal(p);
    setExamForm({
      exam_date: p.exam_date ?? new Date().toISOString().split('T')[0],
      exam_score: p.exam_score != null ? String(p.exam_score) : '',
      exam_max_score: p.exam_max_score != null ? String(p.exam_max_score) : '100',
      exam_notes: p.exam_notes ?? '',
    });
    setExamError('');
  }

  async function saveExamResult() {
    if (!examForm.exam_score) { setExamError('Score is required.'); return; }
    if (!examForm.exam_date)  { setExamError('Exam date is required.'); return; }
    setExamSaving(true); setExamError('');

    // Save exam data first (no status — avoids check constraint issues)
    const { error: dataErr } = await supabase.from('prospective_students').update({
      exam_date:      examForm.exam_date,
      exam_score:     parseFloat(examForm.exam_score),
      exam_max_score: parseFloat(examForm.exam_max_score) || 100,
      exam_notes:     examForm.exam_notes || null,
    }).eq('id', examModal.id);
    if (dataErr) { setExamError(dataErr.message); setExamSaving(false); return; }

    // Update status separately — if the DB constraint hasn't been updated yet
    // this fails silently; data is already saved above.
    await supabase.from('prospective_students').update({ status: 'exam_done' }).eq('id', examModal.id);

    setExamModal(null); setExamSaving(false); await loadData();
    showToast('Exam result saved.');
  }

  /* ── Interview modal ─────────────────────────────────────────────────── */
  function openInterviewModal(p: any) {
    setInterviewModal(p);
    setInterviewForm({
      interview_date:    p.interview_date ?? '',
      interview_notes:   p.interview_notes ?? '',
      interview_outcome: p.interview_outcome ?? '',
    });
    setInterviewError('');
  }

  async function saveInterview() {
    if (!interviewForm.interview_date)    { setInterviewError('Interview date is required.'); return; }
    if (!interviewForm.interview_outcome) { setInterviewError('Outcome is required.'); return; }
    setInterviewSaving(true); setInterviewError('');

    // Save interview data first (no status — avoids check constraint issues)
    const { error: dataErr } = await supabase.from('prospective_students').update({
      interview_date:    interviewForm.interview_date,
      interview_notes:   interviewForm.interview_notes || null,
      interview_outcome: interviewForm.interview_outcome,
    }).eq('id', interviewModal.id);

    if (dataErr) { setInterviewError(dataErr.message); setInterviewSaving(false); return; }

    // Update status separately — fails silently if constraint hasn't been updated yet
    await supabase.from('prospective_students').update({ status: 'interview_done' }).eq('id', interviewModal.id);

    setInterviewModal(null); setInterviewSaving(false); await loadData();
    showToast('Interview details saved.');
  }

  /* ── Admit modal ─────────────────────────────────────────────────────── */
  async function openAdmit(p: any) {
    setAdmitting(p);
    const nextNum = await getNextAdmissionNumber(profile?.school_id ?? '', schoolCodeFromName(settings.school_name));

    // Normalise a class name for comparison: lowercase, strip spaces and punctuation
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/[\s\-_.]/g, '');
    const applyingFor = norm(p.class_applying_for ?? '');

    // 1. Exact normalised match  e.g. "JSS 1" === "JSS1"
    let matched = classes.find((c: any) => norm(c.name) === applyingFor);

    // 2. Partial match — class name contains the applied value or vice versa
    if (!matched && applyingFor) {
      matched = classes.find((c: any) =>
        norm(c.name).includes(applyingFor) || applyingFor.includes(norm(c.name))
      );
    }

    // 3. Fall back to the first class so admission is never blocked
    const classId = matched?.id ?? classes[0]?.id ?? '';
    setAdmitForm({ ...emptyAdmitForm, admission_number: nextNum, class_id: classId });
    setAdmitError(''); setShowPassword(false);
  }

  async function confirmAdmit() {
    if (!admitForm.password || admitForm.password.length<6) { setAdmitError('Password must be at least 6 characters.'); return; }
    if (!admitForm.admission_number.trim()) { setAdmitError('Admission number is required.'); return; }
    // Auto-assign first class if somehow still empty (safety net).
    // Use a local variable — setAdmitForm is async and wouldn't apply in time.
    const classId = admitForm.class_id || classes[0]?.id || null;
    if (classId !== admitForm.class_id) setAdmitForm(f => ({ ...f, class_id: classId ?? '' }));
    setAdmitSaving(true); setAdmitError('');
    try {
      const { data:{ session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired.');
      const authHeaders = { Authorization:`Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY };

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-user', {
        body: {
          admission_number: admitForm.admission_number, password: admitForm.password,
          first_name: admitting.first_name, last_name: admitting.last_name,
          role:'student', phone: admitting.phone||'', gender: admitting.gender||'',
          school_id: profile?.school_id,
          date_of_birth: admitting.date_of_birth||null, blood_group: admitting.blood_group||null,
          religion: admitting.religion||null, nationality: admitting.nationality||null,
          address: admitting.address||null, city: admitting.city||null,
          class_id: classId, section_id: admitForm.section_id||null,
          admission_date: admitForm.admission_date||null,
          guardian_name: admitting.guardian_name||null, guardian_relation: admitting.guardian_relationship||null,
          guardian_phone: admitting.guardian_phone||null, guardian_email: displayEmail(admitting.guardian_email)||null,
          state_of_origin: admitting.state_of_origin||'', lga: admitting.lga||'',
        },
        headers: authHeaders,
      });
      if (edgeError) throw new Error(edgeData?.error||edgeError.message);
      if (!edgeData?.user) throw new Error(edgeData?.error||'Failed to create student account');
      const userId = edgeData.user.id;

      const { error: stuError } = await supabase.from('students').insert({
        id: userId, school_id: profile?.school_id, admission_number: admitForm.admission_number,
        first_name: admitting.first_name, last_name: admitting.last_name,
        class_id: classId,
        section: sections.find(s=>s.id===admitForm.section_id)?.name||null,
        date_of_birth: admitting.date_of_birth||null, gender: admitting.gender||null,
        blood_group: admitting.blood_group||null, religion: admitting.religion||null,
        nationality: admitting.nationality||null, phone: admitting.phone||'',
        address: admitting.address||null, city: admitting.city||null,
        guardian_name: admitting.guardian_name||null, guardian_phone: admitting.guardian_phone||null,
        guardian_email: displayEmail(admitting.guardian_email)||null,
        state_of_origin: admitting.state_of_origin||'', lga: admitting.lga||'',
        admission_date: admitForm.admission_date||null, status:'active',
        student_type: admitting.student_type||'day',
      });
      if (stuError) throw stuError;

      const { data: yearData } = await supabase.from('academic_years').select('id').eq('school_id',profile?.school_id??'').eq('is_current',true).maybeSingle();
      if (yearData) {
        const { data: termData } = await supabase.from('academic_year_terms').select('term_id').eq('academic_year_id',yearData.id).eq('is_current',true).maybeSingle();
        await supabase.from('student_enrollments').insert({
          student_id: userId, class_id: classId,
          academic_year_id: yearData.id, term_id: (termData as any)?.term_id||null,
          enrollment_date: admitForm.admission_date, status:'active',
        });
      }

      await supabase.from('prospective_students').update({ status:'admitted' }).eq('id', admitting.id);

      // Fire-and-forget: send admission confirmation email with login credentials
      const emailToSend = displayEmail(admitting.guardian_email);
      if (emailToSend) {
        const className = classes.find((c: any) => c.id === classId)?.name || admitting.class_applying_for || '';
        fetch(apiUrl('/api/email/admission-confirm'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName:        admitting.first_name,
            lastName:         admitting.last_name,
            guardianName:     admitting.guardian_name || 'Parent/Guardian',
            guardianEmail:    emailToSend,
            admissionNumber:  admitForm.admission_number,
            studentType:      admitting.student_type || 'day',
            classAdmittedFor: className,
            password:         admitForm.password,
            resumptionDate:   '7th September, 2025',
            school: {
              schoolName: settings.school_name,
              logoUrl: settings.logo_url,
              primaryColor: settings.primary_color,
              secondaryColor: settings.secondary_color,
              contactEmail: settings.email,
            },
          }),
        }).catch(() => { /* non-critical */ });
      }

      const admittedName = `${admitting.first_name} ${admitting.last_name}`;
      setAdmitting(null); await loadData();
      showToast(`${admittedName} has been admitted and enrolled successfully.`);
    } catch(err: any) { setAdmitError(err.message); }
    setAdmitSaving(false);
  }

  /* ── Filtered lists ───────────────────────────────────────────────────── */
  const stageStatuses = STAGES.find(s=>s.key===tab)?.statuses ?? [];
  const filtered = prospects.filter(p => {
    const str = `${p.first_name} ${p.last_name} ${p.application_ref??''} ${p.guardian_email??''} ${p.guardian_phone??''}`.toLowerCase();
    return str.includes(search.toLowerCase()) && (stageStatuses as readonly string[]).includes(effectiveStatus(p));
  });

  const stageCounts = Object.fromEntries(
    STAGES.map(s => [s.key, prospects.filter(p => (s.statuses as readonly string[]).includes(effectiveStatus(p))).length])
  );

  /* ── Status badge ─────────────────────────────────────────────────────── */
  function StatusBadge({ status }: { status: string }) {
    const stage = STAGES.find(s => (s.statuses as readonly string[]).includes(status));
    if (!stage) return null;
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.bg} ${stage.color} border ${stage.border}`}>
        {statusLabel(status)}
      </span>
    );
  }

  /* ── Action buttons per row ───────────────────────────────────────────── */
  function RowActions({ p }: { p: any }) {
    const es = effectiveStatus(p);
    return (
      <div className="flex items-center gap-1">
        <button onClick={()=>setViewing(p)} title="View" className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg transition-colors"><Eye className="w-4 h-4"/></button>

        {/* Application stage */}
        {['pending','exam_invited'].includes(es) && <>
          <button onClick={()=>openEdit(p)} title="Edit" className="p-1.5 text-app-text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
          {es === 'pending' && (
            <button onClick={()=>inviteToExam(p)} title="Invite to Exam" className="p-1.5 text-app-text-muted hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><GraduationCap className="w-4 h-4"/></button>
          )}
        </>}

        {/* Exam stage — record result */}
        {['exam_invited','exam_scheduled','exam_done'].includes(es) && (
          <button onClick={()=>openExamModal(p)} title={es==='exam_done' ? 'Update Exam Result' : 'Record Exam Result'} className="p-1.5 text-app-text-muted hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><FileText className="w-4 h-4"/></button>
        )}
        {['exam_invited','exam_scheduled','exam_done'].includes(es) && (
          <button onClick={()=>openInterviewModal(p)} title="Record Interview" className="p-1.5 text-app-text-muted hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><Users className="w-4 h-4"/></button>
        )}

        {/* Interview stage — record outcome / admit */}
        {['interview_scheduled','interview_done'].includes(es) && (
          <button onClick={()=>openInterviewModal(p)} title="Record Interview Outcome" className="p-1.5 text-app-text-muted hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><Star className="w-4 h-4"/></button>
        )}
        {es === 'interview_done' && (
          <button onClick={()=>openAdmit(p)} title="Admit Student" className="p-1.5 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><UserPlus className="w-4 h-4"/></button>
        )}

        {/* Print admission letter — admitted only */}
        {es === 'admitted' && (
          <button onClick={()=>handlePrintLetter(p)} title="Print Admission Letter" className="p-1.5 text-app-text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Printer className="w-4 h-4"/></button>
        )}

        {/* Reject / archive — all active stages */}
        {!['admitted','rejected'].includes(es) && (
          <button onClick={()=>rejectProspect(p.id)} title="Reject / Archive" className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
        )}

        <button onClick={()=>deleteProspect(p.id)} title="Delete permanently" className="p-1.5 text-app-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
      </div>
    );
  }

  /* ── Exam score display ───────────────────────────────────────────────── */
  function ExamScore({ p }: { p: any }) {
    if (p.exam_score == null) return <span className="text-app-text-muted text-xs">—</span>;
    const pct = Math.round((p.exam_score / (p.exam_max_score||100)) * 100);
    const color = pct>=70 ? 'text-emerald-600' : pct>=50 ? 'text-amber-600' : 'text-red-600';
    return <span className={`text-sm font-bold ${color}`}>{p.exam_score}/{p.exam_max_score||100} <span className="text-xs font-normal">({pct}%)</span></span>;
  }

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5">

      {/* ── Success toast ────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium animate-in slide-in-from-top-2 duration-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0"/>
          {successMsg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-app-text">Prospective Students</h2>
          <p className="text-app-text-muted text-sm">Manage the full admission pipeline: Application → Exam → Interview → Decision</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4"/> Add Applicant
        </button>
      </div>

      {/* ── Application link banner ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-emerald-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 mb-1">Public Admission Form</p>
            <p className="text-xs text-emerald-700 mb-3">Share this link with prospective students and parents. Submissions appear here automatically as pending applications.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2 bg-app-surface border border-emerald-200 rounded-xl px-3 py-2 flex-1 min-w-0">
                <Link2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0"/>
                <span className="text-xs font-mono text-app-text-muted truncate">{applyUrl}</span>
                <button onClick={()=>copyUrl(applyUrl)} className="ml-auto flex-shrink-0 text-app-text-muted hover:text-emerald-600 transition-colors" title="Copy link">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500"/> : <Copy className="w-3.5 h-3.5"/>}
                </button>
              </div>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-xl transition-colors whitespace-nowrap">
                <Eye className="w-3.5 h-3.5"/> Preview Form
              </a>
              <a href={statusUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-2 bg-app-surface border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-medium rounded-xl transition-colors whitespace-nowrap">
                <Search className="w-3.5 h-3.5"/> Status Check Page
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline stage tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {STAGES.map(s => {
          const Icon = s.icon;
          const count = stageCounts[s.key] ?? 0;
          return (
            <button key={s.key} onClick={()=>setTab(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===s.key ? 'bg-app-surface shadow-sm text-app-text' : 'text-app-text-muted hover:text-app-text'}`}>
              <Icon className={`w-4 h-4 ${tab===s.key ? s.color : ''}`}/>
              {s.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab===s.key ? `${s.bg} ${s.color}` : 'bg-slate-200 text-app-text-muted'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Stage instructions ───────────────────────────────────────────── */}
      {tab === 'applications' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
          <span>Review applications and click <strong>Invite to Exam</strong> <GraduationCap className="w-3.5 h-3.5 inline"/> to move an applicant to the exam stage. Applicants can also self-book via the public <strong>Schedule Exam</strong> link sent after payment.</span>
        </div>
      )}
      {tab === 'exam' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
          <span>After the exam is written, click <strong>Record Exam Result</strong> <FileText className="w-3.5 h-3.5 inline"/> to enter the score. Applicants with recorded scores are then moved to the Interview stage.</span>
        </div>
      )}
      {tab === 'interview' && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>
          <span>Record the principal interview date and outcome. Applicants with a <strong>Pass</strong> outcome can then be formally admitted.</span>
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, ref, email, phone…"
          className="w-full pl-9 pr-4 py-2 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"/>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-app-surface-alt border-b border-app-border">
              {['Applicant','Ref','Class','Type','Stage','Score','Applied','Actions'].map(h=>(
                <th key={h} className="text-left text-xs font-semibold text-app-text-muted uppercase px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-app-text-muted">Loading…</td></tr>
            ) : filtered.length===0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-app-text-muted">No applicants in this stage</td></tr>
            ) : filtered.map(p=>(
              <tr key={p.id} className="hover:bg-app-surface-alt transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-app-text">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-app-text-muted">{displayEmail(p.guardian_email)}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-app-text-muted">{p.application_ref??'—'}</td>
                <td className="px-4 py-3 text-sm text-app-text-muted">{p.class_applying_for||'—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${p.student_type==='boarding'?'bg-blue-100 text-blue-700':'bg-slate-100 text-app-text-muted'}`}>{p.student_type}</span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={effectiveStatus(p)}/></td>
                <td className="px-4 py-3"><ExamScore p={p}/></td>
                <td className="px-4 py-3 text-xs text-app-text-muted">{new Date(p.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
                <td className="px-4 py-3"><RowActions p={p}/></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-app-border text-sm text-app-text-muted">
          {filtered.length} applicant{filtered.length!==1?'s':''} in this stage
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}

      {/* ── Detail view ──────────────────────────────────────────────────── */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-app-surface border-b border-app-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-app-text text-lg">{viewing.first_name} {viewing.last_name}</h3>
                  <p className="text-xs text-app-text-muted font-mono">{viewing.application_ref}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(()=>{ const ve=effectiveStatus(viewing); return (<>
                  {ve === 'pending' && <button onClick={()=>{setViewing(null);inviteToExam(viewing);}} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"><GraduationCap className="w-3.5 h-3.5"/>Invite to Exam</button>}
                  {['exam_invited','exam_scheduled','exam_done'].includes(ve) && <button onClick={()=>{setViewing(null);openExamModal(viewing);}} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5"/>Exam Result</button>}
                  {['exam_invited','exam_scheduled','exam_done'].includes(ve) && <button onClick={()=>{setViewing(null);openInterviewModal(viewing);}} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"><Users className="w-3.5 h-3.5"/>Interview</button>}
                  {['interview_scheduled','interview_done'].includes(ve) && <button onClick={()=>{setViewing(null);openInterviewModal(viewing);}} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"><Star className="w-3.5 h-3.5"/>Record Outcome</button>}
                  {ve === 'interview_done' && <button onClick={()=>{setViewing(null);openAdmit(viewing);}} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"><UserPlus className="w-3.5 h-3.5"/>Admit</button>}
                  {ve === 'admitted' && <button onClick={()=>handlePrintLetter(viewing)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"><Printer className="w-3.5 h-3.5"/>Print Admission Letter</button>}
                  </>); })()}
                  {!['admitted','rejected'].includes(viewing.status) && <button onClick={()=>rejectProspect(viewing.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X className="w-3.5 h-3.5"/>Reject</button>}
                  <button onClick={()=>setViewing(null)} className="p-2 hover:bg-slate-100 rounded-xl text-app-text-muted"><X className="w-4 h-4"/></button>
                </div>
              </div>
              {/* Pipeline bar */}
              <div className="mt-3"><PipelineBar status={viewing.status}/></div>
            </div>

            <div className="p-5 space-y-5">
              {/* Personal */}
              <div>
                <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Personal Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Date of Birth" value={viewing.date_of_birth?new Date(viewing.date_of_birth+'T00:00:00').toLocaleDateString('en-GB'):undefined}/>
                  <Field label="Gender" value={viewing.gender}/>
                  <Field label="Blood Group" value={viewing.blood_group}/>
                  <Field label="Religion" value={viewing.religion}/>
                  <Field label="Nationality" value={viewing.nationality}/>
                  <Field label="Phone" value={viewing.phone}/>
                  <Field label="State of Origin" value={viewing.state_of_origin}/>
                  <Field label="LGA" value={viewing.lga}/>
                  <Field label="City" value={viewing.city}/>
                </div>
                {viewing.address && <div className="mt-3 bg-app-surface-alt rounded-xl p-3"><p className="text-xs text-app-text-muted mb-0.5">Address</p><p className="text-sm font-semibold text-app-text">{viewing.address}</p></div>}
              </div>

              {/* Academic */}
              <div>
                <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Academic Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Class Applying For" value={viewing.class_applying_for}/>
                  <Field label="Student Type" value={viewing.student_type}/>
                  <Field label="Current / Previous School" value={viewing.current_school}/>
                </div>
              </div>

              {/* Exam results */}
              {(viewing.exam_score != null || viewing.exam_date) && (
                <div>
                  <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Entrance Exam Result</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="Exam Date" value={viewing.exam_date?new Date(viewing.exam_date+'T00:00:00').toLocaleDateString('en-GB'):undefined}/>
                    <Field label="Score" value={viewing.exam_score!=null?`${viewing.exam_score} / ${viewing.exam_max_score||100} (${Math.round((viewing.exam_score/(viewing.exam_max_score||100))*100)}%)`:undefined}/>
                    {viewing.exam_notes && <div className="sm:col-span-2 bg-app-surface-alt rounded-xl p-3"><p className="text-xs text-app-text-muted mb-0.5">Exam Notes</p><p className="text-sm text-app-text">{viewing.exam_notes}</p></div>}
                  </div>
                </div>
              )}

              {/* Interview */}
              {(viewing.interview_date || viewing.interview_notes) && (
                <div>
                  <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Principal's Interview</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="Interview Date" value={viewing.interview_date?new Date(viewing.interview_date+'T00:00:00').toLocaleDateString('en-GB'):undefined}/>
                    <Field label="Outcome" value={viewing.interview_outcome}/>
                    {viewing.interview_notes && <div className="sm:col-span-2 bg-app-surface-alt rounded-xl p-3"><p className="text-xs text-app-text-muted mb-0.5">Interview Notes</p><p className="text-sm text-app-text">{viewing.interview_notes}</p></div>}
                  </div>
                </div>
              )}

              {viewing.medical_conditions && viewing.medical_conditions!=='None' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Medical Conditions</p>
                  <p className="text-sm text-amber-800">{viewing.medical_conditions}</p>
                </div>
              )}

              {/* Guardian */}
              <div>
                <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Guardian / Parent Information</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Name" value={viewing.guardian_name}/>
                  <Field label="Relationship" value={viewing.guardian_relationship}/>
                  <Field label="Phone" value={viewing.guardian_phone}/>
                  <Field label="Email" value={displayEmail(viewing.guardian_email)}/>
                  <Field label="Occupation" value={viewing.guardian_occupation}/>
                  <Field label="Emergency Contact" value={viewing.emergency_contact}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Exam Result Modal ─────────────────────────────────────────────── */}
      {examModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-app-border">
              <div>
                <h3 className="font-bold text-app-text flex items-center gap-2"><GraduationCap className="w-5 h-5 text-amber-500"/>Record Exam Result</h3>
                <p className="text-sm text-app-text-muted">{examModal.first_name} {examModal.last_name}</p>
              </div>
              <button onClick={()=>setExamModal(null)} className="p-2 hover:bg-slate-100 rounded-xl text-app-text-muted"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-4">
              {examError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{examError}</div>}
              <div>
                <label className={labelCls}>Date of Exam <span className="text-red-500">*</span></label>
                <input type="date" className={inputCls} value={examForm.exam_date} onChange={e=>setExamForm(f=>({...f,exam_date:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Score <span className="text-red-500">*</span></label>
                  <input type="number" min="0" className={inputCls} value={examForm.exam_score} onChange={e=>setExamForm(f=>({...f,exam_score:e.target.value}))} placeholder="e.g. 75"/>
                </div>
                <div>
                  <label className={labelCls}>Out of</label>
                  <input type="number" min="1" className={inputCls} value={examForm.exam_max_score} onChange={e=>setExamForm(f=>({...f,exam_max_score:e.target.value}))} placeholder="100"/>
                </div>
              </div>
              {examForm.exam_score && examForm.exam_max_score && (
                <div className="bg-app-surface-alt rounded-xl px-4 py-3 text-sm text-center">
                  <span className="text-app-text-muted">Percentage: </span>
                  <span className={`font-bold text-lg ${Math.round((parseFloat(examForm.exam_score)/parseFloat(examForm.exam_max_score))*100)>=70?'text-emerald-600':Math.round((parseFloat(examForm.exam_score)/parseFloat(examForm.exam_max_score))*100)>=50?'text-amber-600':'text-red-600'}`}>
                    {Math.round((parseFloat(examForm.exam_score)/parseFloat(examForm.exam_max_score))*100)}%
                  </span>
                </div>
              )}
              <div>
                <label className={labelCls}>Notes (optional)</label>
                <textarea className={`${inputCls} resize-none`} rows={3} value={examForm.exam_notes} onChange={e=>setExamForm(f=>({...f,exam_notes:e.target.value}))} placeholder="Any remarks about the exam performance…"/>
              </div>
              <div className="flex gap-3 pt-2 border-t border-app-border">
                <button onClick={()=>setExamModal(null)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text-muted rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
                <button onClick={saveExamResult} disabled={examSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {examSaving?'Saving…':'Save Exam Result & Move to Interview Stage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Interview Modal ───────────────────────────────────────────────── */}
      {interviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-app-border">
              <div>
                <h3 className="font-bold text-app-text flex items-center gap-2"><Users className="w-5 h-5 text-purple-500"/>Principal's Interview</h3>
                <p className="text-sm text-app-text-muted">{interviewModal.first_name} {interviewModal.last_name}</p>
              </div>
              <button onClick={()=>setInterviewModal(null)} className="p-2 hover:bg-slate-100 rounded-xl text-app-text-muted"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-4">
              {interviewError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{interviewError}</div>}

              {interviewModal.exam_score != null && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm">
                  <span className="text-app-text-muted">Exam score: </span>
                  <span className="font-bold text-amber-700">{interviewModal.exam_score}/{interviewModal.exam_max_score||100} ({Math.round((interviewModal.exam_score/(interviewModal.exam_max_score||100))*100)}%)</span>
                </div>
              )}

              <div>
                <label className={labelCls}>Interview Date <span className="text-red-500">*</span></label>
                <input type="date" className={inputCls} value={interviewForm.interview_date} onChange={e=>setInterviewForm(f=>({...f,interview_date:e.target.value}))}/>
              </div>
              <div>
                <label className={labelCls}>Outcome <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {[{v:'pass',label:'Pass',color:'bg-emerald-50 border-emerald-400 text-emerald-700'},{v:'deferred',label:'Deferred',color:'bg-amber-50 border-amber-400 text-amber-700'},{v:'fail',label:'Fail',color:'bg-red-50 border-red-400 text-red-700'}].map(o=>(
                    <button key={o.v} type="button" onClick={()=>setInterviewForm(f=>({...f,interview_outcome:o.v}))}
                      className={`py-2.5 border-2 rounded-xl text-sm font-semibold transition-all ${interviewForm.interview_outcome===o.v?o.color:'border-app-border text-app-text-muted hover:border-app-border'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Principal's Notes (optional)</label>
                <textarea className={`${inputCls} resize-none`} rows={4} value={interviewForm.interview_notes} onChange={e=>setInterviewForm(f=>({...f,interview_notes:e.target.value}))} placeholder="Observations from the interview with the principal…"/>
              </div>
              {interviewForm.interview_outcome === 'pass' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                  <strong>Ready to admit.</strong> After saving, use the <strong>Admit</strong> button to create the student's portal account.
                </div>
              )}
              {interviewForm.interview_outcome === 'fail' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
                  After saving, use <strong>Reject</strong> to archive this application.
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t border-app-border">
                <button onClick={()=>setInterviewModal(null)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text-muted rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
                <button onClick={saveInterview} disabled={interviewSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {interviewSaving?'Saving…':'Save Interview Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Prospect Modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-app-border sticky top-0 bg-app-surface">
              <h3 className="font-bold text-app-text">{editingId?'Edit Applicant':'Add New Applicant'}</h3>
              <button onClick={()=>setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-xl text-app-text-muted"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-6">
              {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>}

              {/* Personal */}
              <div>
                <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Personal Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelCls}>First Name <span className="text-red-500">*</span></label><input className={inputCls} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} placeholder="First name"/></div>
                  <div><label className={labelCls}>Last Name <span className="text-red-500">*</span></label><input className={inputCls} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} placeholder="Last name"/></div>
                  <div><label className={labelCls}>Date of Birth</label><input type="date" className={inputCls} value={form.date_of_birth} onChange={e=>setForm(f=>({...f,date_of_birth:e.target.value}))}/></div>
                  <div><label className={labelCls}>Gender</label><select className={inputCls} value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                  <div><label className={labelCls}>Blood Group</label><select className={inputCls} value={form.blood_group} onChange={e=>setForm(f=>({...f,blood_group:e.target.value}))}><option value="">Select blood group</option>{BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}</select></div>
                  <div><label className={labelCls}>Religion</label><input className={inputCls} value={form.religion} onChange={e=>setForm(f=>({...f,religion:e.target.value}))} placeholder="e.g. Christianity"/></div>
                  <div><label className={labelCls}>Nationality</label><input className={inputCls} value={form.nationality} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))} placeholder="e.g. Nigerian"/></div>
                  <div><label className={labelCls}>Phone (Student)</label><input className={inputCls} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Student phone"/></div>
                  <div><label className={labelCls}>State of Origin</label><select className={inputCls} value={form.state_of_origin} onChange={e=>setForm(f=>({...f,state_of_origin:e.target.value}))}><option value="">Select state</option>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className={labelCls}>LGA</label><input className={inputCls} value={form.lga} onChange={e=>setForm(f=>({...f,lga:e.target.value}))} placeholder="Local Government Area"/></div>
                  <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} placeholder="City"/></div>
                  <div className="sm:col-span-2"><label className={labelCls}>Address</label><input className={inputCls} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Street address"/></div>
                </div>
              </div>

              {/* Academic */}
              <div>
                <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Academic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Class Applying For</label><input className={inputCls} value={form.class_applying_for} onChange={e=>setForm(f=>({...f,class_applying_for:e.target.value}))} placeholder="e.g. JSS 1"/></div>
                  <div><label className={labelCls}>Student Type</label><select className={inputCls} value={form.student_type} onChange={e=>setForm(f=>({...f,student_type:e.target.value as 'day'|'boarding'}))}><option value="day">Day Student</option><option value="boarding">Boarding Student</option></select></div>
                  <div className="sm:col-span-2"><label className={labelCls}>Current / Previous School</label><input className={inputCls} value={form.current_school} onChange={e=>setForm(f=>({...f,current_school:e.target.value}))} placeholder="Name of current or previous school"/></div>
                  <div className="sm:col-span-2"><label className={labelCls}>Medical Conditions / Allergies</label><textarea className={`${inputCls} resize-none`} rows={2} value={form.medical_conditions} onChange={e=>setForm(f=>({...f,medical_conditions:e.target.value}))} placeholder="List any known medical conditions or leave blank"/></div>
                </div>
              </div>

              {/* Guardian */}
              <div>
                <p className="text-xs font-semibold text-app-text-muted uppercase mb-3">Guardian / Parent Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Guardian Name</label><input className={inputCls} value={form.guardian_name} onChange={e=>setForm(f=>({...f,guardian_name:e.target.value}))} placeholder="Full name"/></div>
                  <div><label className={labelCls}>Relationship</label><select className={inputCls} value={form.guardian_relationship} onChange={e=>setForm(f=>({...f,guardian_relationship:e.target.value}))}><option value="">Select relationship</option>{RELATIONSHIPS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                  <div><label className={labelCls}>Guardian Phone</label><input className={inputCls} value={form.guardian_phone} onChange={e=>setForm(f=>({...f,guardian_phone:e.target.value}))} placeholder="Phone number"/></div>
                  <div><label className={labelCls}>Guardian Email</label><input type="email" className={inputCls} value={form.guardian_email} onChange={e=>setForm(f=>({...f,guardian_email:e.target.value}))} placeholder="Email address"/></div>
                  <div><label className={labelCls}>Guardian Occupation</label><input className={inputCls} value={form.guardian_occupation} onChange={e=>setForm(f=>({...f,guardian_occupation:e.target.value}))} placeholder="Occupation"/></div>
                  <div><label className={labelCls}>Emergency Contact Number</label><input className={inputCls} value={form.emergency_contact} onChange={e=>setForm(f=>({...f,emergency_contact:e.target.value}))} placeholder="Emergency phone number"/></div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-app-border">
                <button onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text-muted rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
                <button onClick={saveProspect} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {saving?'Saving…':editingId?'Save Changes':'Add Applicant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admit Student Modal ───────────────────────────────────────────── */}
      {admitting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-app-border sticky top-0 bg-app-surface">
              <div><h3 className="font-bold text-app-text">Admit Student</h3><p className="text-sm text-app-text-muted">{admitting.first_name} {admitting.last_name}</p></div>
              <button onClick={()=>setAdmitting(null)} className="p-2 hover:bg-slate-100 rounded-xl text-app-text-muted"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 space-y-4">
              {admitError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{admitError}</div>}

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0"/>
                <p className="text-sm text-emerald-800">This will create a student portal account for <strong>{admitting.first_name} {admitting.last_name}</strong> and add them to the Student List.</p>
              </div>

              {admitting.exam_score != null && (
                <div className="bg-app-surface-alt rounded-xl px-4 py-3 text-sm flex items-center justify-between">
                  <span className="text-app-text-muted">Exam score</span>
                  <span className="font-bold text-app-text">{admitting.exam_score}/{admitting.exam_max_score||100} ({Math.round((admitting.exam_score/(admitting.exam_max_score||100))*100)}%)</span>
                </div>
              )}
              {admitting.interview_outcome && (
                <div className="bg-app-surface-alt rounded-xl px-4 py-3 text-sm flex items-center justify-between">
                  <span className="text-app-text-muted">Interview outcome</span>
                  <span className={`font-bold capitalize ${admitting.interview_outcome==='pass'?'text-emerald-600':admitting.interview_outcome==='fail'?'text-red-600':'text-amber-600'}`}>{admitting.interview_outcome}</span>
                </div>
              )}

              <div>
                <label className={labelCls}>Admission Number <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input className={inputCls} value={admitForm.admission_number} onChange={e=>setAdmitForm(f=>({...f,admission_number:e.target.value}))} placeholder={`${schoolCodeFromName(settings.school_name)}-${new Date().getFullYear()}-001`}/>
                  <button type="button" onClick={async()=>{const n=await getNextAdmissionNumber(profile?.school_id||'', schoolCodeFromName(settings.school_name));setAdmitForm(f=>({...f,admission_number:n}));}} className="px-3 py-2 text-xs rounded-xl border border-app-border text-app-text-muted hover:bg-app-surface-alt whitespace-nowrap transition-colors">Generate</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Login Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showPassword?'text':'password'} className={inputCls} value={admitForm.password} onChange={e=>setAdmitForm(f=>({...f,password:e.target.value}))} placeholder="Min. 6 characters"/>
                  <button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text">
                    {showPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Assign Class <span className="text-red-500">*</span></label>
                <select className={inputCls} value={admitForm.class_id} onChange={e=>setAdmitForm(f=>({...f,class_id:e.target.value}))}>
                  <option value="">Select class</option>
                  {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {filteredSections.length>0 && (
                <div>
                  <label className={labelCls}>Section</label>
                  <select className={inputCls} value={admitForm.section_id} onChange={e=>setAdmitForm(f=>({...f,section_id:e.target.value}))}>
                    <option value="">Select section</option>
                    {filteredSections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Admission Date</label>
                <input type="date" className={inputCls} value={admitForm.admission_date} onChange={e=>setAdmitForm(f=>({...f,admission_date:e.target.value}))}/>
              </div>
              <div className="flex gap-3 pt-2 border-t border-app-border">
                <button onClick={()=>setAdmitting(null)} className="flex-1 px-4 py-2.5 border border-app-border text-app-text-muted rounded-xl text-sm font-medium hover:bg-app-surface-alt transition-colors">Cancel</button>
                <button onClick={confirmAdmit} disabled={admitSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <UserPlus className="w-4 h-4"/>
                  {admitSaving?'Admitting…':'Confirm Admission'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
