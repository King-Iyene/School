/*
 * ── One-time Supabase setup — paste into SQL Editor ─────────────────────────
 *
 * create table if not exists public.staff_assessments (
 *   id uuid primary key default gen_random_uuid(),
 *   school_id uuid,
 *   academic_year_id uuid,
 *   staff_id uuid references public.profiles(id) on delete cascade,
 *   staff_type text not null check (staff_type in ('teaching','non_teaching')),
 *   status text not null default 'draft'
 *     check (status in ('draft','self_submitted','reviewed','completed')),
 *   self_data jsonb,
 *   reviewer_data jsonb,
 *   reviewer_id uuid,
 *   reviewed_at timestamptz,
 *   principal_data jsonb,
 *   principal_id uuid,
 *   completed_at timestamptz,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 * alter table public.staff_assessments enable row level security;
 * create policy "assessment_access" on public.staff_assessments for all using (
 *   auth.uid() = staff_id or
 *   exists (select 1 from public.profiles p where p.id = auth.uid()
 *     and p.school_id = staff_assessments.school_id
 *     and p.role in ('super_admin','admin','principal','head_teacher'))
 * ) with check (
 *   auth.uid() = staff_id or
 *   exists (select 1 from public.profiles p where p.id = auth.uid()
 *     and p.school_id = staff_assessments.school_id
 *     and p.role in ('super_admin','admin','principal','head_teacher'))
 * );
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Users, CheckCircle, Clock, Star, ChevronDown, ChevronUp,
  Plus, Eye, Pencil, RefreshCw, Award, Info, X, Send, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type StaffType = 'teaching' | 'non_teaching';
type AssessmentStatus = 'draft' | 'self_submitted' | 'reviewed' | 'completed';
type Determination = 'COMMEND' | 'DEVELOP' | 'SUPPORT' | 'REVIEW';

interface SelfData {
  section1: Record<string, string>;
  ratings: Record<string, number[]>;
  questions: Record<string, string>;
}
interface ReviewerData {
  ratings: Record<string, number>;
  strengths: string;
  development_areas: string;
  concerns: string;
  reviewed_date: string;
}
interface PrincipalData {
  overall_assessment: string;
  determination: Determination | '';
  priority_actions: string;
  target_review_date: string;
}
interface Assessment {
  id: string;
  school_id: string;
  staff_id: string;
  staff_type: StaffType;
  status: AssessmentStatus;
  self_data: SelfData | null;
  reviewer_data: ReviewerData | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  principal_data: PrincipalData | null;
  completed_at: string | null;
  created_at: string;
  academic_year_id: string | null;
  term: number | null;
}
interface StaffProfile { id: string; first_name: string; last_name: string; role: string; }

const TEACHING_SECTIONS = [
  { id: 'A', title: 'Subject Knowledge and Mastery', items: [
    'I have strong, current command of the subject content I teach.',
    'I can explain difficult concepts in more than one way when students struggle.',
    'I keep my subject knowledge up to date with the current WAEC, NECO and JAMB syllabus.',
    'I set work that stretches able students while supporting weaker ones.',
  ]},
  { id: 'B', title: 'Teaching Methodology and Classroom Management', items: [
    'My lessons have clear objectives that students understand.',
    'I use varied teaching methods rather than only dictation or copying.',
    'I maintain an orderly, respectful classroom where learning can happen.',
    'I check for understanding during the lesson and adjust my pace accordingly.',
    'I set and mark assignments regularly and give students useful feedback.',
  ]},
  { id: 'C', title: 'Digital Literacy and Technology Integration', items: [
    'I am comfortable using a computer for my basic work (typing, files, email).',
    'I can prepare teaching materials using productivity software.',
    'I am willing and able to integrate digital tools into my teaching.',
    'I would benefit from further training in classroom technology.',
  ]},
  { id: 'D', title: 'Punctuality and Professional Conduct', items: [
    'I arrive at school and at my lessons on time, consistently.',
    'I conduct myself professionally with students, colleagues and parents.',
    'I follow school policies and support the standards set by the administration.',
    'I model the English-language and appearance standards expected of students.',
  ]},
  { id: 'E', title: 'Student Outcomes and Care', items: [
    "My students' results reflect the effort and quality I put into my teaching.",
    'I identify struggling students early and act to support them.',
    'I take an interest in the wider welfare and development of my students.',
    'I contribute to the life of the school beyond my own classroom.',
  ]},
];

const NON_TEACHING_SECTIONS = [
  { id: 'A', title: 'Role Knowledge and Competence', items: [
    'I understand my duties clearly and carry them out to a good standard.',
    'I have the skills and knowledge my role requires.',
    'I would benefit from further training in specific areas of my work.',
    'I take initiative to solve problems within my area of responsibility.',
  ]},
  { id: 'B', title: 'Reliability and Quality of Work', items: [
    'I complete my work accurately and on time.',
    'I keep proper records and documentation where my role requires it.',
    'I follow correct procedures and safety standards in my work.',
    'The quality of my work supports the smooth running of the school.',
  ]},
  { id: 'C', title: 'Digital and Administrative Skills', items: [
    'I am comfortable using a computer or phone for the parts of my work that need it.',
    'I can keep simple digital records where required.',
    'I am willing to learn new digital systems the school introduces.',
    'I would benefit from basic digital-skills training.',
  ]},
  { id: 'D', title: 'Punctuality and Professional Conduct', items: [
    'I arrive at work on time, consistently.',
    'I conduct myself professionally with students, colleagues, parents and visitors.',
    'I follow school policies and support the standards set by the administration.',
    'I treat students and visitors with courtesy and represent the school well.',
  ]},
  { id: 'E', title: 'Teamwork and Contribution', items: [
    'I work well with colleagues across departments.',
    'I respond helpfully when asked to support tasks outside my routine duties.',
    'I contribute ideas for improving how the school operates.',
    'I take pride in the cleanliness, order and good name of the school.',
  ]},
];

const OPEN_QUESTIONS = [
  'What are you best at in your role? Where do you make the most difference?',
  'What is the single biggest obstacle stopping you from doing your job at your best right now?',
  'What specific training or support would help you most this year?',
  'What is one improvement you would like to see at your school, and how could you help deliver it?',
];

const RATING_LABELS = ['', 'Needs support', 'Developing', 'Competent', 'Strong', 'Exemplary'];

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft:          { label: 'Draft',       color: 'bg-slate-100 text-app-text-muted',   icon: Clock },
  self_submitted: { label: 'Submitted',   color: 'bg-blue-100 text-blue-700',     icon: Send },
  reviewed:       { label: 'Reviewed',    color: 'bg-amber-100 text-amber-700',   icon: Eye },
  completed:      { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

const DETERMINATION_OPTIONS: { value: Determination; label: string; desc: string; color: string }[] = [
  { value: 'COMMEND', label: 'COMMEND', desc: 'Performing strongly. Recognise and retain.',              color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { value: 'DEVELOP', label: 'DEVELOP', desc: 'Solid, with clear growth areas. Standard PDP.',           color: 'border-blue-400 bg-blue-50 text-blue-800' },
  { value: 'SUPPORT', label: 'SUPPORT', desc: 'Below expectation. Intensive PDP and close monitoring.',  color: 'border-amber-400 bg-amber-50 text-amber-800' },
  { value: 'REVIEW',  label: 'REVIEW',  desc: 'Serious concern. Formal review with VP and Board.',       color: 'border-red-400 bg-red-50 text-red-800' },
];

const TERM_LABELS: Record<number, string> = { 1: 'First Term', 2: 'Second Term', 3: 'Third Term' };
const TERM_SHORT: Record<number, string>  = { 1: '1st Term', 2: '2nd Term', 3: '3rd Term' };

const INPUT  = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';
const TEXTAREA = INPUT + ' resize-y min-h-[90px]';

const SETUP_SQL = `create table if not exists public.staff_assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  academic_year_id uuid,
  term integer check (term in (1, 2, 3)),
  staff_id uuid references public.profiles(id) on delete cascade,
  staff_type text not null check (staff_type in ('teaching','non_teaching')),
  status text not null default 'draft'
    check (status in ('draft','self_submitted','reviewed','completed')),
  self_data jsonb,
  reviewer_data jsonb,
  reviewer_id uuid,
  reviewed_at timestamptz,
  principal_data jsonb,
  principal_id uuid,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- If table already exists, add term column:
alter table public.staff_assessments add column if not exists term integer check (term in (1, 2, 3));
alter table public.staff_assessments enable row level security;
create policy "assessment_access" on public.staff_assessments for all using (
  auth.uid() = staff_id or
  exists (select 1 from public.profiles p where p.id = auth.uid()
    and p.school_id = staff_assessments.school_id
    and p.role in ('super_admin','admin','principal','head_teacher'))
) with check (
  auth.uid() = staff_id or
  exists (select 1 from public.profiles p where p.id = auth.uid()
    and p.school_id = staff_assessments.school_id
    and p.role in ('super_admin','admin','principal','head_teacher'))
);`;

function getSections(t: StaffType) { return t === 'teaching' ? TEACHING_SECTIONS : NON_TEACHING_SECTIONS; }

function staffTypeFor(role: string): StaffType {
  return (role === 'teacher' || role === 'head_teacher' || role === 'nur_prim_teacher') ? 'teaching' : 'non_teaching';
}

function fullName(p: StaffProfile) { return `${p.first_name} ${p.last_name}`; }

function sectionAvg(ratings: number[]): number | null {
  if (!ratings?.length) return null;
  const filled = ratings.filter(r => r > 0);
  if (!filled.length) return null;
  return +(filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(1);
}

function overallSelfAvg(selfData: SelfData | null): number | null {
  if (!selfData?.ratings) return null;
  const all = Object.values(selfData.ratings).flat().filter(r => r > 0);
  if (!all.length) return null;
  return +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(1);
}

function overallReviewerAvg(reviewerData: ReviewerData | null): number | null {
  if (!reviewerData?.ratings) return null;
  const vals = Object.values(reviewerData.ratings).filter(r => r > 0);
  if (!vals.length) return null;
  return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300">—</span>;
  const color = score >= 4 ? 'text-emerald-600' : score >= 3 ? 'text-blue-600' : score >= 2 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-bold text-base ${color}`}>{score}</span>;
}

function RatingPicker({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const colors = ['', 'bg-red-100 text-red-700 border-red-300', 'bg-orange-100 text-orange-700 border-orange-300', 'bg-amber-100 text-amber-700 border-amber-300', 'bg-blue-100 text-blue-700 border-blue-300', 'bg-emerald-100 text-emerald-700 border-emerald-300'];
  return (
    <div className="flex gap-1 shrink-0">
      {[1,2,3,4,5].map(v => (
        <button
          key={v} type="button" disabled={disabled}
          onClick={() => onChange(v)}
          title={RATING_LABELS[v]}
          className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 ${
            value === v ? colors[v] + ' border-current shadow-sm' : 'border-app-border text-app-text-muted hover:border-slate-400'
          }`}
        >{v}</button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: AssessmentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function SectionCard({ section, ratings, onChange, readOnly }: {
  section: typeof TEACHING_SECTIONS[0];
  ratings: number[];
  onChange: (idx: number, v: number) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const avg = sectionAvg(ratings);
  return (
    <div className="border border-app-border rounded-2xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 bg-app-surface-alt hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(p => !p)}
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center justify-center shrink-0">{section.id}</span>
          <span className="font-semibold text-app-text text-sm">{section.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {avg !== null && (
            <span className="text-xs font-medium text-app-text-muted">Avg <ScoreBadge score={avg} /></span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-app-text-muted" /> : <ChevronDown className="w-4 h-4 text-app-text-muted" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-app-border">
          <div className="px-5 py-2 grid grid-cols-[1fr_auto] gap-4 items-center">
            <span className="text-xs font-medium text-app-text-muted uppercase tracking-wide">Competency Statement</span>
            <div className="flex gap-1 text-xs text-app-text-muted font-medium">
              {[1,2,3,4,5].map(v => (
                <span key={v} className="w-8 text-center" title={RATING_LABELS[v]}>{v}</span>
              ))}
            </div>
          </div>
          {section.items.map((item, idx) => (
            <div key={idx} className="px-5 py-3.5 grid grid-cols-[1fr_auto] gap-4 items-center hover:bg-app-surface-alt/50">
              <p className="text-sm text-app-text leading-relaxed">{item}</p>
              <RatingPicker value={ratings[idx] ?? 0} onChange={v => onChange(idx, v)} disabled={readOnly} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StaffAssessment() {
  const { profile } = useAuth();
  const isAdmin = ['super_admin','admin','principal','head_teacher'].includes(profile?.role ?? '');
  const isPrincipal = ['super_admin','principal'].includes(profile?.role ?? '');

  const [tab, setTab] = useState<'list' | 'mine'>(isAdmin ? 'list' : 'mine');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, StaffProfile>>({});
  const [allStaff, setAllStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);

  const [myAssessment, setMyAssessment] = useState<Assessment | null>(null);
  const [selfData, setSelfData] = useState<SelfData>({ section1: {}, ratings: {}, questions: {} });
  const [selfSaving, setSelfSaving] = useState(false);
  const [selfMsg, setSelfMsg] = useState('');
  const [currentYearId, setCurrentYearId] = useState<string | null>(null);

  const [reviewTarget, setReviewTarget] = useState<Assessment | null>(null);
  const [reviewData, setReviewData] = useState<ReviewerData>({ ratings: {}, strengths: '', development_areas: '', concerns: '', reviewed_date: new Date().toISOString().split('T')[0] });
  const [principalData, setPrincipalData] = useState<PrincipalData>({ overall_assessment: '', determination: '', priority_actions: '', target_review_date: '' });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [search, setSearch] = useState('');
  const [currentYearName, setCurrentYearName] = useState('');
  const [initiating, setInitiating] = useState(false);
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [initiateForm, setInitiateForm] = useState({ term: '' });
  const [dataEntryMode, setDataEntryMode] = useState(false);
  const [dataEntrySelfData, setDataEntrySelfData] = useState<SelfData>({ section1: { date: new Date().toISOString().split('T')[0] }, ratings: {}, questions: {} });
  const [dataEntrySaving, setDataEntrySaving] = useState(false);
  const [dataEntryMsg, setDataEntryMsg] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    if (!profile?.school_id) return;
    setLoading(true);

    const yearRes = await supabase.from('academic_years').select('id, name').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle();
    const yearId = yearRes.data?.id ?? null;
    setCurrentYearId(yearId);
    setCurrentYearName(yearRes.data?.name ?? '');

    let query = supabase.from('staff_assessments').select('*').eq('school_id', profile.school_id);
    if (yearId) query = query.eq('academic_year_id', yearId);
    const { data, error } = await query;
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('staff_assessments') || error.code === '42P01' || error.code === 'PGRST204') {
        setSetupRequired(true);
      }
      setLoading(false);
      return;
    }
    const assessList = (data ?? []) as Assessment[];
    setAssessments(assessList);

    const mine = assessList.find(a => a.staff_id === profile.id) ?? null;
    setMyAssessment(mine);
    if (mine?.self_data) setSelfData(mine.self_data);
    if (mine?.reviewer_data) setReviewData(mine.reviewer_data);
    if (mine?.principal_data) setPrincipalData(mine.principal_data);

    const staffRes = await supabase.from('profiles').select('id, first_name, last_name, role').eq('school_id', profile.school_id).eq('is_active', true).not('role', 'in', '("student","parent")');
    const staffList = (staffRes.data ?? []) as StaffProfile[];
    setAllStaff(staffList);
    const sMap: Record<string, StaffProfile> = {};
    staffList.forEach(s => { sMap[s.id] = s; });
    setStaffMap(sMap);

    setLoading(false);
  }

  const staffType: StaffType = staffTypeFor(profile?.role ?? '');

  function initSelfData(): SelfData {
    const sections = getSections(staffType);
    const ratings: Record<string, number[]> = {};
    sections.forEach(s => { ratings[s.id] = new Array(s.items.length).fill(0); });
    return { section1: { date: new Date().toISOString().split('T')[0] }, ratings, questions: {} };
  }

  async function createMyAssessment() {
    if (!profile?.school_id) return;
    const initial = initSelfData();
    const { data, error } = await supabase.from('staff_assessments').insert({
      school_id: profile.school_id,
      academic_year_id: currentYearId,
      staff_id: profile.id,
      staff_type: staffType,
      status: 'draft',
      self_data: initial,
    }).select().maybeSingle();
    if (!error && data) {
      setMyAssessment(data as Assessment);
      setSelfData(initial);
      setTab('mine');
    }
  }

  async function saveSelf(submit = false) {
    if (!myAssessment) return;
    setSelfSaving(true);
    setSelfMsg('');
    const update: any = { self_data: selfData, updated_at: new Date().toISOString() };
    if (submit) update.status = 'self_submitted';
    const { error } = await supabase.from('staff_assessments').update(update).eq('id', myAssessment.id);
    setSelfSaving(false);
    if (error) { setSelfMsg('Error: ' + error.message); return; }
    setSelfMsg(submit ? '✓ Assessment submitted successfully.' : '✓ Draft saved.');
    setMyAssessment(prev => prev ? { ...prev, ...update } : prev);
    if (submit) loadAll();
  }

  function ratingChange(section: string, idx: number, val: number) {
    setSelfData(prev => {
      const r = { ...prev.ratings };
      r[section] = [...(r[section] ?? [])];
      r[section][idx] = val;
      return { ...prev, ratings: r };
    });
  }

  async function openReview(a: Assessment) {
    setDataEntryMode(false);
    setDataEntryMsg('');
    setReviewTarget(a);
    setReviewData(a.reviewer_data ?? { ratings: {}, strengths: '', development_areas: '', concerns: '', reviewed_date: new Date().toISOString().split('T')[0] });
    setPrincipalData(a.principal_data ?? { overall_assessment: '', determination: '', priority_actions: '', target_review_date: '' });
    setReviewMsg('');
  }

  function openDataEntry(a: Assessment) {
    const sections = getSections(a.staff_type);
    const ratings: Record<string, number[]> = {};
    sections.forEach(s => { ratings[s.id] = new Array(s.items.length).fill(0); });
    const blank: SelfData = { section1: { date: new Date().toISOString().split('T')[0] }, ratings, questions: {} };
    setDataEntrySelfData(a.self_data && Object.keys(a.self_data.ratings ?? {}).length > 0 ? a.self_data : blank);
    setDataEntryMode(true);
    setDataEntryMsg('');
    setReviewMsg('');
    setReviewTarget(a);
  }

  function deRatingChange(section: string, idx: number, val: number) {
    setDataEntrySelfData(prev => {
      const r = { ...prev.ratings };
      r[section] = [...(r[section] ?? [])];
      r[section][idx] = val;
      return { ...prev, ratings: r };
    });
  }

  async function saveDataEntry(submit: boolean) {
    if (!reviewTarget) return;
    setDataEntrySaving(true);
    setDataEntryMsg('');
    const update: Partial<Assessment> & { updated_at: string; status?: string } = {
      self_data: dataEntrySelfData,
      updated_at: new Date().toISOString(),
      ...(submit ? { status: 'self_submitted' } : {}),
    };
    const { error } = await supabase.from('staff_assessments').update(update).eq('id', reviewTarget.id);
    setDataEntrySaving(false);
    if (error) { setDataEntryMsg('Error: ' + error.message); return; }
    if (submit) {
      setDataEntryMsg('✓ Submitted on behalf of staff member.');
      setTimeout(() => { setReviewTarget(null); setDataEntryMode(false); loadAll(); }, 800);
    } else {
      setDataEntryMsg('✓ Draft saved.');
      loadAll();
    }
  }

  async function saveReview(finalize = false) {
    if (!reviewTarget) return;
    setReviewSaving(true);
    setReviewMsg('');
    const update: any = {
      reviewer_data: reviewData,
      reviewer_id: profile?.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (finalize && !isPrincipal) update.status = 'reviewed';

    if (isPrincipal) {
      update.principal_data = principalData;
      update.principal_id = profile?.id;
      update.completed_at = new Date().toISOString();
      if (finalize) update.status = 'completed';
    }

    const { error } = await supabase.from('staff_assessments').update(update).eq('id', reviewTarget.id);
    setReviewSaving(false);
    if (error) { setReviewMsg('Error: ' + error.message); return; }
    setReviewMsg(finalize ? '✓ Saved and submitted.' : '✓ Draft saved.');
    if (finalize) { setReviewTarget(null); loadAll(); }
  }

  async function handleInitiateRound() {
    if (!profile?.school_id) return;
    if (setupRequired) {
      alert('The staff_assessments table has not been created yet.\n\nPlease copy the SQL from the setup banner on this page and run it in your Supabase SQL Editor first.');
      return;
    }
    if (!initiateForm.term) {
      alert('Please select a term before initiating the round.');
      return;
    }
    const termNum = Number(initiateForm.term);
    setInitiating(true);

    // Re-fetch year
    const yearRes = await supabase.from('academic_years').select('id, name').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle();
    const yearId = yearRes.data?.id ?? null;
    if (yearId !== currentYearId) setCurrentYearId(yearId);

    // Re-fetch staff fresh
    const staffRes = await supabase.from('profiles').select('id, first_name, last_name, role')
      .eq('school_id', profile.school_id)
      .eq('is_active', true)
      .not('role', 'in', '("student","parent","super_admin")');
    const freshStaff = (staffRes.data ?? []) as StaffProfile[];

    // Check existing for this year + term combination
    let existingQ = supabase.from('staff_assessments').select('staff_id').eq('school_id', profile.school_id).eq('term', termNum);
    if (yearId) existingQ = existingQ.eq('academic_year_id', yearId);
    const { data: existingRows } = await existingQ;
    const existingIds = new Set((existingRows ?? []).map((r: any) => r.staff_id));

    const toCreate = freshStaff.filter(s => !existingIds.has(s.id));
    if (freshStaff.length === 0) {
      alert('No active staff found. Make sure staff profiles are marked as active in the Staff List.');
      setInitiating(false);
      return;
    }
    if (toCreate.length === 0) {
      const termLabel = TERM_LABELS[termNum] ?? `Term ${termNum}`;
      alert(`All ${freshStaff.length} active staff already have an assessment for ${termLabel}.\n\nChoose a different term or check existing records.`);
      setInitiating(false);
      return;
    }

    const inserts = toCreate.map(s => {
      const type = staffTypeFor(s.role);
      const sections = getSections(type);
      const ratings: Record<string, number[]> = {};
      sections.forEach(sec => { ratings[sec.id] = new Array(sec.items.length).fill(0); });
      return {
        school_id: profile.school_id,
        academic_year_id: yearId,
        term: termNum,
        staff_id: s.id,
        staff_type: type,
        status: 'draft',
        self_data: { section1: {}, ratings, questions: {} },
      };
    });
    const { error } = await supabase.from('staff_assessments').insert(inserts);
    setInitiating(false);
    if (error) {
      if (error.message?.includes('term')) {
        alert('Error: The "term" column is missing from the database.\n\nOpen the SQL setup panel and run the ALTER TABLE line to add it.');
      } else {
        alert('Error: ' + error.message);
      }
    } else {
      setInitiateModalOpen(false);
      setFilterTerm(String(termNum));
      alert(`${inserts.length} assessment(s) created for ${TERM_LABELS[termNum]}.`);
      loadAll();
    }
  }

  async function addMissingStaff() {
    if (!profile?.school_id || missingFromRound.length === 0) return;
    setInitiating(true);
    const termNum = filterTerm ? Number(filterTerm) : null;
    const inserts = missingFromRound.map(s => {
      const type = staffTypeFor(s.role);
      const sections = getSections(type);
      const ratings: Record<string, number[]> = {};
      sections.forEach(sec => { ratings[sec.id] = new Array(sec.items.length).fill(0); });
      return {
        school_id: profile.school_id,
        academic_year_id: currentYearId,
        term: termNum,
        staff_id: s.id,
        staff_type: type,
        status: 'draft',
        self_data: { section1: {}, ratings, questions: {} },
      };
    });
    const { error } = await supabase.from('staff_assessments').insert(inserts);
    setInitiating(false);
    if (error) alert('Error adding staff: ' + error.message);
    else loadAll();
  }

  const filtered = useMemo(() => assessments.filter(a => {
    const s = staffMap[a.staff_id];
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterType && a.staff_type !== filterType) return false;
    if (filterTerm && a.term !== Number(filterTerm)) return false;
    if (search && s && !fullName(s).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [assessments, staffMap, filterStatus, filterType, filterTerm, search]);

  const stats = useMemo(() => ({
    total: assessments.length,
    draft: assessments.filter(a => a.status === 'draft').length,
    submitted: assessments.filter(a => a.status === 'self_submitted').length,
    reviewed: assessments.filter(a => a.status === 'reviewed').length,
    completed: assessments.filter(a => a.status === 'completed').length,
  }), [assessments]);

  const NON_STAFF_ROLES = ['super_admin', 'student', 'parent', 'diocesan_official'];

  const missingFromRound = useMemo(() => {
    if (!filterTerm) return [];
    const termNum = Number(filterTerm);
    const assessedIds = new Set(assessments.filter(a => a.term === termNum).map(a => a.staff_id));
    return allStaff.filter(s => !assessedIds.has(s.id) && !NON_STAFF_ROLES.includes(s.role));
  }, [assessments, allStaff, filterTerm]);

  if (setupRequired) return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-app-text">Staff Assessment</h1>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
        <p className="font-semibold text-amber-800">Database table not set up yet</p>
        <p className="text-sm text-amber-700">The <code className="bg-amber-100 px-1 rounded">staff_assessments</code> table doesn't exist in your Supabase database. Copy the SQL below and run it in your Supabase SQL Editor.</p>
        <button onClick={() => setSqlOpen(p => !p)} className="text-sm text-amber-700 font-medium underline underline-offset-2">
          {sqlOpen ? 'Hide SQL' : 'Show SQL to copy'}
        </button>
        {sqlOpen && (
          <pre className="bg-slate-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap select-all">{SETUP_SQL}</pre>
        )}
        <button onClick={loadAll} className="flex items-center gap-2 text-sm text-amber-700 font-medium border border-amber-300 px-4 py-2 rounded-xl hover:bg-amber-100 transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry after running SQL
        </button>
      </div>
    </div>
  );

  const myCanEdit = myAssessment?.status === 'draft';
  const currentSections = getSections(myAssessment?.staff_type ?? staffType);

  const canReviewSection5 = (a: Assessment) => isAdmin && (a.status === 'self_submitted' || a.status === 'reviewed');
  const canReviewSection6 = (a: Assessment) => isPrincipal && (a.status === 'self_submitted' || a.status === 'reviewed' || a.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-app-text">Staff Assessment</h1>
            <p className="text-sm text-app-text-muted">
              {filterTerm && currentYearName
                ? `${TERM_LABELS[Number(filterTerm)]} · ${currentYearName}`
                : filterTerm
                  ? TERM_LABELS[Number(filterTerm)]
                  : currentYearName || 'Professional Development Assessment'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setInitiateForm({ term: filterTerm || '' }); setInitiateModalOpen(true); }}
            disabled={initiating}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            Initiate Assessment Round
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',     val: stats.total,     color: 'text-app-text', bg: 'bg-app-surface-alt' },
            { label: 'Draft',     val: stats.draft,     color: 'text-app-text-muted', bg: 'bg-app-surface-alt' },
            { label: 'Submitted', val: stats.submitted, color: 'text-blue-700',  bg: 'bg-blue-50' },
            { label: 'Reviewed',  val: stats.reviewed,  color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Completed', val: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-4 text-center border border-app-border`}>
              <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
              <p className="text-xs text-app-text-muted mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {isAdmin && !loading && filterTerm && missingFromRound.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                {missingFromRound.length} staff member{missingFromRound.length > 1 ? 's' : ''} not yet in the {TERM_LABELS[Number(filterTerm)]} round
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {missingFromRound.map(s => `${s.first_name} ${s.last_name}`).join(' · ')}
              </p>
            </div>
          </div>
          <button
            onClick={addMissingStaff}
            disabled={initiating}
            className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            {initiating ? 'Adding…' : `Add ${missingFromRound.length > 1 ? 'all' : ''} to round`}
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(['list', 'mine'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-app-surface shadow-sm text-app-text' : 'text-app-text-muted hover:text-app-text'}`}
            >
              {t === 'list' ? 'All Assessments' : 'My Assessment'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-app-surface rounded-2xl border border-app-border py-16 text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-app-text-muted text-sm">Loading assessments…</p>
        </div>
      ) : tab === 'list' && isAdmin ? (

        <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
          <div className="p-4 border-b border-app-border flex flex-wrap gap-3">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-44"
            />
            <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="">All Terms</option>
              <option value="1">First Term</option>
              <option value="2">Second Term</option>
              <option value="3">Third Term</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="">All Staff Types</option>
              <option value="teaching">Teaching</option>
              <option value="non_teaching">Non-Teaching</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-app-text-muted text-sm">No assessments found</p>
              <p className="text-slate-300 text-xs mt-1">Click "Initiate Assessment Round" to create assessments for all active staff.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-app-surface-alt border-b border-app-border">
                  <tr>
                    {['Staff Member','Term · Session','Type','Status','Self Score','Reviewer Score','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(a => {
                    const sp = staffMap[a.staff_id];
                    const selfAvg = overallSelfAvg(a.self_data);
                    const revAvg = overallReviewerAvg(a.reviewer_data);
                    return (
                      <tr key={a.id} className="hover:bg-app-surface-alt/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-app-text">{sp ? fullName(sp) : a.staff_id.slice(0,8)}</div>
                          <div className="text-xs text-app-text-muted capitalize">{sp?.role?.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="px-4 py-3">
                          {a.term ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">{TERM_SHORT[a.term]}</span>
                              {currentYearName && <div className="text-[11px] text-app-text-muted mt-0.5">{currentYearName}</div>}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${a.staff_type === 'teaching' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-app-text-muted'}`}>
                            {a.staff_type === 'teaching' ? 'Teaching' : 'Non-Teaching'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-3"><ScoreBadge score={selfAvg} /></td>
                        <td className="px-4 py-3"><ScoreBadge score={revAvg} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {a.status === 'draft' && isAdmin && (
                              <button onClick={() => openDataEntry(a)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                                <Pencil className="w-3.5 h-3.5" /> Enter Data
                              </button>
                            )}
                            {(canReviewSection5(a) || canReviewSection6(a)) && (
                              <button onClick={() => openReview(a)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                <Pencil className="w-3.5 h-3.5" /> Review
                              </button>
                            )}
                            {a.status !== 'draft' && !canReviewSection5(a) && !canReviewSection6(a) && (
                              <button onClick={() => openReview(a)} className="flex items-center gap-1.5 text-xs font-medium text-app-text-muted hover:text-app-text px-3 py-1.5 rounded-lg bg-app-surface-alt hover:bg-slate-100 transition-colors">
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      ) : (

        myAssessment === null ? (
          <div className="bg-app-surface rounded-2xl border border-app-border py-20 text-center px-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-app-text mb-2">No Assessment Started</h3>
            <p className="text-app-text-muted text-sm max-w-sm mx-auto mb-5">Your Professional Development Assessment for 2026 hasn't been created yet. Click below to begin.</p>
            <button onClick={createMyAssessment} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Start My Assessment
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={myAssessment.status} />
                <span className="text-sm text-app-text-muted capitalize">{myAssessment.staff_type === 'teaching' ? 'Teaching Staff Assessment' : 'Non-Teaching Staff Assessment'}</span>
              </div>
              {!myCanEdit && myAssessment.status !== 'completed' && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <Info className="w-4 h-4 shrink-0" />
                  Submitted for review — editing is locked until this cycle is complete.
                </div>
              )}
            </div>

            <div className="bg-app-surface rounded-2xl border border-app-border p-5">
              <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-100 rounded-md text-xs font-bold text-app-text-muted flex items-center justify-center">1</span>
                Your Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myAssessment.staff_type === 'teaching' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-app-text-muted mb-1">Subject(s) Taught</label>
                      <input className={INPUT} disabled={!myCanEdit} value={selfData.section1.subjects ?? ''} onChange={e => setSelfData(p => ({ ...p, section1: { ...p.section1, subjects: e.target.value } }))} placeholder="e.g. Mathematics, Physics" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-app-text-muted mb-1">Class(es) / Level</label>
                      <input className={INPUT} disabled={!myCanEdit} value={selfData.section1.classes ?? ''} onChange={e => setSelfData(p => ({ ...p, section1: { ...p.section1, classes: e.target.value } }))} placeholder="e.g. SS1A, SS2B" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-app-text-muted mb-1">Role / Department</label>
                      <input className={INPUT} disabled={!myCanEdit} value={selfData.section1.role ?? ''} onChange={e => setSelfData(p => ({ ...p, section1: { ...p.section1, role: e.target.value } }))} placeholder="e.g. School Secretary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-app-text-muted mb-1">Reports To</label>
                      <input className={INPUT} disabled={!myCanEdit} value={selfData.section1.reports_to ?? ''} onChange={e => setSelfData(p => ({ ...p, section1: { ...p.section1, reports_to: e.target.value } }))} placeholder="e.g. Vice Principal (Admin)" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Years of Service</label>
                  <input className={INPUT} disabled={!myCanEdit} value={selfData.section1.years_at_ogs ?? ''} onChange={e => setSelfData(p => ({ ...p, section1: { ...p.section1, years_at_ogs: e.target.value } }))} placeholder="e.g. 7" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Date</label>
                  <input type="date" className={INPUT} disabled={!myCanEdit} value={selfData.section1.date ?? ''} onChange={e => setSelfData(p => ({ ...p, section1: { ...p.section1, date: e.target.value } }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-app-text flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-100 rounded-md text-xs font-bold text-app-text-muted flex items-center justify-center">2</span>
                Self-Rating
                <span className="text-xs text-app-text-muted font-normal">1 = Needs support · 5 = Exemplary</span>
              </h3>
              {currentSections.map(section => (
                <SectionCard
                  key={section.id}
                  section={section}
                  ratings={selfData.ratings[section.id] ?? new Array(section.items.length).fill(0)}
                  onChange={(idx, v) => ratingChange(section.id, idx, v)}
                  readOnly={!myCanEdit}
                />
              ))}
            </div>

            <div className="bg-app-surface rounded-2xl border border-app-border p-5 space-y-4">
              <h3 className="font-semibold text-app-text flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-100 rounded-md text-xs font-bold text-app-text-muted flex items-center justify-center">3</span>
                In Your Own Words
              </h3>
              {OPEN_QUESTIONS.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-app-text mb-1.5">{i+1}. {q}</label>
                  <textarea
                    className={TEXTAREA}
                    disabled={!myCanEdit}
                    value={selfData.questions[`q${i+1}`] ?? ''}
                    onChange={e => setSelfData(p => ({ ...p, questions: { ...p.questions, [`q${i+1}`]: e.target.value } }))}
                    placeholder="Write your honest answer here…"
                  />
                </div>
              ))}
            </div>

            {selfMsg && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${selfMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {selfMsg}
              </div>
            )}

            {myCanEdit && (
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => saveSelf(false)} disabled={selfSaving} className="px-5 py-2.5 rounded-xl border border-app-border text-sm font-medium text-app-text-muted hover:bg-app-surface-alt transition-colors disabled:opacity-50">
                  {selfSaving ? 'Saving…' : 'Save Draft'}
                </button>
                <button onClick={() => saveSelf(true)} disabled={selfSaving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <Send className="w-4 h-4" />
                  {selfSaving ? 'Submitting…' : 'Submit Assessment'}
                </button>
              </div>
            )}

            {(myAssessment.reviewer_data || myAssessment.principal_data) && (
              <div className="space-y-3">
                {myAssessment.reviewer_data && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                    <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                      <Star className="w-4 h-4" /> Section 5 — Reviewer's Assessment
                    </h3>
                    <div className="grid grid-cols-5 gap-2">
                      {['A','B','C','D','E'].map(k => (
                        <div key={k} className="text-center bg-app-surface rounded-xl p-3 border border-amber-100">
                          <p className="text-xs font-semibold text-amber-700 mb-1">Section {k}</p>
                          <ScoreBadge score={myAssessment.reviewer_data!.ratings[k] ?? null} />
                        </div>
                      ))}
                    </div>
                    {myAssessment.reviewer_data.strengths && <p className="text-sm text-amber-800"><span className="font-semibold">Strengths:</span> {myAssessment.reviewer_data.strengths}</p>}
                    {myAssessment.reviewer_data.development_areas && <p className="text-sm text-amber-800"><span className="font-semibold">Development areas:</span> {myAssessment.reviewer_data.development_areas}</p>}
                  </div>
                )}
                {myAssessment.principal_data?.determination && (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-2">
                    <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Section 6 — Principal's Determination
                    </h3>
                    <p className="text-sm text-purple-800 font-semibold">{myAssessment.principal_data.determination}</p>
                    {myAssessment.principal_data.overall_assessment && <p className="text-sm text-purple-700">{myAssessment.principal_data.overall_assessment}</p>}
                    {myAssessment.principal_data.priority_actions && <p className="text-sm text-purple-700"><span className="font-semibold">Priority actions:</span> {myAssessment.principal_data.priority_actions}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}

      {initiateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-app-text text-lg">Initiate Assessment Round</h2>
                <p className="text-xs text-app-text-muted mt-0.5">Creates a draft assessment for every active staff member</p>
              </div>
              <button onClick={() => setInitiateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-app-text-muted" />
              </button>
            </div>

            <div className="bg-app-surface-alt rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-app-text-muted">Academic Session</p>
              <p className="font-semibold text-app-text">{currentYearName || 'Current Academic Year'}</p>
              <p className="text-xs text-app-text-muted">To change the year, update the current year in System Settings → Academic Years.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-app-text mb-2">Select Term</label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInitiateForm(f => ({ ...f, term: String(t) }))}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      initiateForm.term === String(t)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-app-border text-app-text-muted hover:border-app-border'
                    }`}
                  >
                    {TERM_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {initiateForm.term && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-700">
                This will create <strong>{TERM_LABELS[Number(initiateForm.term)]}</strong> assessments for all active staff who don't already have one this term.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setInitiateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-app-border text-sm font-medium text-app-text-muted hover:bg-app-surface-alt transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateRound}
                disabled={!initiateForm.term || initiating}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                {initiating ? 'Creating…' : 'Initiate Round'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex justify-end">
          <div className="bg-app-surface w-full max-w-2xl min-h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
              <div>
                <h2 className="font-bold text-app-text">{staffMap[reviewTarget.staff_id] ? fullName(staffMap[reviewTarget.staff_id]) : 'Assessment'}</h2>
                <p className="text-xs text-app-text-muted capitalize">{reviewTarget.staff_type === 'teaching' ? 'Teaching Staff' : 'Non-Teaching Staff'} · <StatusBadge status={reviewTarget.status} /></p>
              </div>
              <button onClick={() => { setReviewTarget(null); setDataEntryMode(false); setDataEntryMsg(''); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-app-text-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ── DATA ENTRY MODE ────────────────────────────────────────── */}
              {dataEntryMode ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <Pencil className="w-4 h-4 text-blue-500 shrink-0" />
                    <p className="text-sm text-blue-700 font-medium">Entering scores from paper form on behalf of this staff member</p>
                  </div>

                  {/* Section 1 */}
                  <div className="bg-app-surface rounded-2xl border border-app-border p-5">
                    <h3 className="font-semibold text-app-text mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-100 rounded-md text-xs font-bold text-app-text-muted flex items-center justify-center">1</span>
                      Staff Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {reviewTarget.staff_type === 'teaching' ? (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-app-text-muted mb-1">Subject(s) Taught</label>
                            <input className={INPUT} value={dataEntrySelfData.section1.subjects ?? ''} onChange={e => setDataEntrySelfData(p => ({ ...p, section1: { ...p.section1, subjects: e.target.value } }))} placeholder="e.g. Mathematics, Physics" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-app-text-muted mb-1">Class(es) / Level</label>
                            <input className={INPUT} value={dataEntrySelfData.section1.classes ?? ''} onChange={e => setDataEntrySelfData(p => ({ ...p, section1: { ...p.section1, classes: e.target.value } }))} placeholder="e.g. SS1A, SS2B" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-app-text-muted mb-1">Role / Department</label>
                            <input className={INPUT} value={dataEntrySelfData.section1.role ?? ''} onChange={e => setDataEntrySelfData(p => ({ ...p, section1: { ...p.section1, role: e.target.value } }))} placeholder="e.g. School Secretary" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-app-text-muted mb-1">Reports To</label>
                            <input className={INPUT} value={dataEntrySelfData.section1.reports_to ?? ''} onChange={e => setDataEntrySelfData(p => ({ ...p, section1: { ...p.section1, reports_to: e.target.value } }))} placeholder="e.g. Vice Principal (Admin)" />
                          </div>
                        </>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-app-text-muted mb-1">Years of Service</label>
                        <input className={INPUT} value={dataEntrySelfData.section1.years_at_ogs ?? ''} onChange={e => setDataEntrySelfData(p => ({ ...p, section1: { ...p.section1, years_at_ogs: e.target.value } }))} placeholder="e.g. 7" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-app-text-muted mb-1">Date</label>
                        <input type="date" className={INPUT} value={dataEntrySelfData.section1.date ?? ''} onChange={e => setDataEntrySelfData(p => ({ ...p, section1: { ...p.section1, date: e.target.value } }))} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2 */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-app-text flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-100 rounded-md text-xs font-bold text-app-text-muted flex items-center justify-center">2</span>
                      Self-Rating
                      <span className="text-xs text-app-text-muted font-normal">1 = Needs support · 5 = Exemplary</span>
                    </h3>
                    {getSections(reviewTarget.staff_type).map(section => (
                      <SectionCard
                        key={section.id}
                        section={section}
                        ratings={dataEntrySelfData.ratings[section.id] ?? new Array(section.items.length).fill(0)}
                        onChange={(idx, v) => deRatingChange(section.id, idx, v)}
                        readOnly={false}
                      />
                    ))}
                  </div>

                  {/* Section 3 */}
                  <div className="bg-app-surface rounded-2xl border border-app-border p-5 space-y-4">
                    <h3 className="font-semibold text-app-text flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-100 rounded-md text-xs font-bold text-app-text-muted flex items-center justify-center">3</span>
                      In Their Own Words
                    </h3>
                    {OPEN_QUESTIONS.map((q, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-app-text mb-1.5">{i+1}. {q}</label>
                        <textarea
                          className={TEXTAREA}
                          value={dataEntrySelfData.questions[`q${i+1}`] ?? ''}
                          onChange={e => setDataEntrySelfData(p => ({ ...p, questions: { ...p.questions, [`q${i+1}`]: e.target.value } }))}
                          placeholder="Transcribe from paper form…"
                        />
                      </div>
                    ))}
                  </div>

                  {dataEntryMsg && (
                    <div className={`rounded-xl px-4 py-3 text-sm font-medium ${dataEntryMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {dataEntryMsg}
                    </div>
                  )}
                </div>
              ) : (

              /* ── NORMAL REVIEW MODE ─────────────────────────────────────── */
              reviewTarget.self_data && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-app-text text-sm uppercase tracking-wide">Staff Self-Assessment</h3>
                  {reviewTarget.self_data.section1 && Object.keys(reviewTarget.self_data.section1).length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(reviewTarget.self_data.section1).map(([k, v]) => v ? (
                        <div key={k} className="bg-app-surface-alt rounded-xl p-3">
                          <p className="text-xs text-app-text-muted capitalize">{k.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-medium text-app-text">{v}</p>
                        </div>
                      ) : null)}
                    </div>
                  )}
                  <div className="grid grid-cols-5 gap-2">
                    {getSections(reviewTarget.staff_type).map(s => {
                      const ratings = reviewTarget.self_data?.ratings[s.id] ?? [];
                      const avg = sectionAvg(ratings);
                      return (
                        <div key={s.id} className="text-center bg-app-surface-alt rounded-xl p-3 border border-app-border">
                          <p className="text-xs font-semibold text-app-text-muted mb-1">{s.id}</p>
                          <ScoreBadge score={avg} />
                          <p className="text-[10px] text-app-text-muted mt-0.5 leading-tight">{s.title.split(' ').slice(0,2).join(' ')}</p>
                        </div>
                      );
                    })}
                  </div>
                  {reviewTarget.self_data.questions && Object.keys(reviewTarget.self_data.questions).length > 0 && (
                    <div className="space-y-3">
                      {OPEN_QUESTIONS.map((q, i) => {
                        const ans = reviewTarget.self_data?.questions[`q${i+1}`];
                        if (!ans) return null;
                        return (
                          <div key={i} className="bg-app-surface-alt rounded-xl p-4">
                            <p className="text-xs font-medium text-app-text-muted mb-1.5">{q}</p>
                            <p className="text-sm text-app-text whitespace-pre-wrap">{ans}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
              )}

              {canReviewSection5(reviewTarget) && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-app-text flex items-center gap-2">
                    <span className="text-amber-600">Section 5</span> — {reviewTarget.staff_type === 'teaching' ? 'HOD' : 'Supervisor'} Review
                  </h3>
                  <p className="text-xs text-app-text-muted">1 = Needs support · 2 = Developing · 3 = Competent · 4 = Strong · 5 = Exemplary</p>
                  {getSections(reviewTarget.staff_type).map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-4 p-4 bg-app-surface-alt rounded-xl border border-app-border">
                      <div>
                        <p className="text-sm font-medium text-app-text">{s.id}. {s.title}</p>
                        {reviewTarget.self_data?.ratings[s.id] && (
                          <p className="text-xs text-app-text-muted">Self avg: {sectionAvg(reviewTarget.self_data.ratings[s.id]) ?? '—'}</p>
                        )}
                      </div>
                      <RatingPicker value={reviewData.ratings[s.id] ?? 0} onChange={v => setReviewData(p => ({ ...p, ratings: { ...p.ratings, [s.id]: v } }))} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Key strengths observed</label>
                    <textarea className={TEXTAREA} value={reviewData.strengths} onChange={e => setReviewData(p => ({ ...p, strengths: e.target.value }))} placeholder="Note the staff member's strongest areas…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Areas for development and recommended support / training</label>
                    <textarea className={TEXTAREA} value={reviewData.development_areas} onChange={e => setReviewData(p => ({ ...p, development_areas: e.target.value }))} placeholder="Note where improvement or training is needed…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Any concerns requiring the Principal's attention</label>
                    <textarea className={TEXTAREA} value={reviewData.concerns} onChange={e => setReviewData(p => ({ ...p, concerns: e.target.value }))} placeholder="Leave blank if none…" />
                  </div>
                </div>
              )}

              {!canReviewSection5(reviewTarget) && reviewTarget.reviewer_data && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-amber-800">Section 5 — Reviewer's Assessment</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {['A','B','C','D','E'].map(k => (
                      <div key={k} className="text-center bg-app-surface rounded-xl p-2 border border-amber-100">
                        <p className="text-xs font-semibold text-amber-700">{k}</p>
                        <ScoreBadge score={reviewTarget.reviewer_data!.ratings[k] ?? null} />
                      </div>
                    ))}
                  </div>
                  {reviewTarget.reviewer_data.strengths && <p className="text-sm text-amber-800"><span className="font-semibold">Strengths:</span> {reviewTarget.reviewer_data.strengths}</p>}
                  {reviewTarget.reviewer_data.development_areas && <p className="text-sm text-amber-800"><span className="font-semibold">Development:</span> {reviewTarget.reviewer_data.development_areas}</p>}
                  {reviewTarget.reviewer_data.concerns && <p className="text-sm text-amber-800"><span className="font-semibold">Concerns:</span> {reviewTarget.reviewer_data.concerns}</p>}
                </div>
              )}

              {canReviewSection6(reviewTarget) && (
                <div className="space-y-4 border-t border-app-border pt-5">
                  <h3 className="font-semibold text-app-text flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-500" />
                    <span className="text-purple-700">Section 6</span> — Principal's Determination
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Overall assessment</label>
                    <textarea className={TEXTAREA} value={principalData.overall_assessment} onChange={e => setPrincipalData(p => ({ ...p, overall_assessment: e.target.value }))} placeholder="Summarise your overall assessment of this staff member…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-2">Development determination</label>
                    <div className="grid grid-cols-2 gap-2">
                      {DETERMINATION_OPTIONS.map(opt => (
                        <button
                          key={opt.value} type="button"
                          onClick={() => setPrincipalData(p => ({ ...p, determination: opt.value }))}
                          className={`text-left border-2 rounded-xl p-3 transition-all ${principalData.determination === opt.value ? opt.color + ' border-current' : 'border-app-border hover:border-app-primary/40'}`}
                        >
                          <p className="font-bold text-sm">{opt.label}</p>
                          <p className="text-xs mt-0.5 opacity-80">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Priority development actions (for PDP)</label>
                    <textarea className={TEXTAREA} value={principalData.priority_actions} onChange={e => setPrincipalData(p => ({ ...p, priority_actions: e.target.value }))} placeholder="List the key development actions for this staff member…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Target review date</label>
                    <input type="date" className={INPUT} value={principalData.target_review_date} onChange={e => setPrincipalData(p => ({ ...p, target_review_date: e.target.value }))} />
                  </div>
                </div>
              )}

              {reviewMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${reviewMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {reviewMsg}
                </div>
              )}
            </div>

            {dataEntryMode ? (
              <div className="px-6 py-4 border-t border-app-border flex items-center justify-end gap-3 sticky bottom-0 bg-app-surface">
                <button onClick={() => saveDataEntry(false)} disabled={dataEntrySaving} className="px-5 py-2.5 rounded-xl border border-app-border text-sm font-medium text-app-text-muted hover:bg-app-surface-alt transition-colors disabled:opacity-50">
                  {dataEntrySaving ? 'Saving…' : 'Save Draft'}
                </button>
                <button onClick={() => saveDataEntry(true)} disabled={dataEntrySaving} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" />
                  {dataEntrySaving ? 'Submitting…' : 'Submit on Behalf of Staff'}
                </button>
              </div>
            ) : (canReviewSection5(reviewTarget) || canReviewSection6(reviewTarget)) && (
              <div className="px-6 py-4 border-t border-app-border flex items-center justify-end gap-3 sticky bottom-0 bg-app-surface">
                <button onClick={() => saveReview(false)} disabled={reviewSaving} className="px-5 py-2.5 rounded-xl border border-app-border text-sm font-medium text-app-text-muted hover:bg-app-surface-alt transition-colors disabled:opacity-50">
                  {reviewSaving ? 'Saving…' : 'Save Draft'}
                </button>
                <button onClick={() => saveReview(true)} disabled={reviewSaving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" />
                  {reviewSaving ? 'Submitting…' : isPrincipal ? 'Complete Assessment' : 'Submit Review'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
