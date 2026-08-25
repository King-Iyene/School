import { useEffect, useState } from 'react';
import { ArrowLeft, User, BookOpen, UserCheck, DollarSign, AlertTriangle, Building2, History, ShoppingBag, GraduationCap, Phone, Mail, MapPin, Calendar, Users, Award, Printer, CreditCard as Edit2, Save, Trash2, FileText, ChevronRight, CheckCircle2, XCircle, Home, Moon } from 'lucide-react';

function StudentTypeBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  const isBoarding = type === 'boarding';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isBoarding ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
      {isBoarding ? <Moon className="w-3 h-3" /> : <Home className="w-3 h-3" />}
      {isBoarding ? 'Boarding' : 'Day'}
    </span>
  );
}
import { supabase } from '../../lib/supabase';
import { actionLabel, logActivity } from '../../lib/activityLog';
import { getOverallRemark as overallRemark } from '../../lib/grading';
import { useAuth } from '../../context/AuthContext';
import { navigate, getSearchParams } from '../../components/hooks/useLocation';
import StudentReportPrint from '../../components/print/StudentReportPrint';
import PhotoUpload from '../../components/common/PhotoUpload';
import Modal from '../../components/common/Modal';

interface TermResult {
  term_id: string;
  term_name: string;
  academic_year_id: string;
  academic_year_name: string;
  class_id: string | null;
  class_name: string;
  subject_count: number;
  total: number;
  average: number;
  position: number | null;
  class_size: number | null;
  remark: string;
  published: boolean;
}

function getStudentIdFromUrl(): string {
  return getSearchParams().get('id') ?? '';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


function remarkBadge(r: string): string {
  switch (r) {
    case 'Excellent': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Very Good': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Good': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Pass': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Poor': return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-red-100 text-red-700 border-red-200';
  }
}

function gradeColor(grade: string) {
  if (!grade) return 'text-slate-400';
  if (grade.startsWith('A')) return 'text-emerald-600 font-bold';
  if (grade.startsWith('B')) return 'text-blue-600 font-bold';
  if (grade.startsWith('C')) return 'text-amber-600 font-semibold';
  return 'text-red-500 font-semibold';
}

function attColor(status: string) {
  if (status === 'present') return 'bg-emerald-100 text-emerald-700';
  if (status === 'absent') return 'bg-red-100 text-red-700';
  if (status === 'late') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

const TABS = [
  { key: 'bio', label: 'Bio Data', icon: User },
  { key: 'results', label: 'Results', icon: Award },
  { key: 'attendance', label: 'Attendance', icon: UserCheck },
  { key: 'subjects', label: 'Subjects', icon: BookOpen },
  { key: 'fees', label: 'Fees', icon: DollarSign },
  { key: 'behaviour', label: 'Behaviour', icon: AlertTriangle },
  { key: 'dormitory', label: 'Dormitory', icon: Building2 },
  { key: 'purchases', label: 'Purchases', icon: ShoppingBag },
  { key: 'history', label: 'History', icon: History },
];

export default function StudentProfile() {
  const { profile: viewer } = useAuth();
  const studentId = getStudentIdFromUrl();
  const role = viewer?.role ?? 'teacher';
  const isAdmin = role === 'super_admin' || role === 'admin' || role === 'principal';
  const isSecurity = role === 'security_officer' || role === 'Security Officer';

  const [tab, setTab] = useState('bio');
  const [student, setStudent] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [mySubjectIds, setMySubjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [grades, setGrades] = useState<any[]>([]);
  const [termResults, setTermResults] = useState<TermResult[]>([]);
  const [viewingTermReport, setViewingTermReport] = useState<{ termId: string; yearId: string } | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [feePayments, setFeePayments] = useState<any[]>([]);
  const [behaviours, setBehaviours] = useState<any[]>([]);
  const [dormitory, setDormitory] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [enrollHistory, setEnrollHistory] = useState<any[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [showPrint, setShowPrint] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showManageParents, setShowManageParents] = useState(false);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<any[]>([]);
  const [searchingParents, setSearchingParents] = useState(false);
  const [linkingParent, setLinkingParent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [classList, setClassList] = useState<any[]>([]);
  const [tabLoaded, setTabLoaded] = useState<Record<string, boolean>>({});
  const [subjectExclusions, setSubjectExclusions] = useState<Record<string, string>>({}); // subject_id -> exclusion row id
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectSaveMsg, setSubjectSaveMsg] = useState('');

  async function handleStudentPhotoUpload(url: string) {
    if (student?._from_students_table) {
      await supabase.rpc('update_student', {
        p_id: studentId,
        p_payload: { avatar_url: url }
      });
    } else {
      await supabase.rpc('update_profile', {
        p_id: studentId,
        p_payload: { avatar_url: url }
      });
    }
    setStudent((prev: any) => ({ ...prev, avatar_url: url }));
  }

  const canView = {
    parentInfo: isAdmin || role === 'parent' || role === 'accountant' || isClassTeacher,
    results: role !== 'accountant' && !isSecurity,
    subjects: !isSecurity,
    allSubjectResults: isAdmin || isClassTeacher || role === 'parent' || role === 'student',
    attendance: role !== 'accountant',
    fees: isAdmin || role === 'accountant' || role === 'parent' || isClassTeacher,
    behaviour: isAdmin || isClassTeacher || role === 'parent',
    dormitory: isAdmin || isClassTeacher || role === 'parent' || role === 'student',
    purchases: isAdmin || role === 'accountant' || role === 'parent',
    history: isAdmin || isClassTeacher,
  };

  const visibleTabs = TABS.filter(t => {
    if (t.key === 'results') return canView.results;
    if (t.key === 'subjects') return canView.subjects;
    if (t.key === 'attendance') return canView.attendance;
    if (t.key === 'fees') return canView.fees;
    if (t.key === 'behaviour') return canView.behaviour;
    if (t.key === 'dormitory') return canView.dormitory;
    if (t.key === 'purchases') return canView.purchases;
    if (t.key === 'history') return canView.history;
    return true;
  });

  useEffect(() => {
    if (!studentId || !viewer?.id) return;
    loadCore();
  }, [studentId, viewer?.id]);

  useEffect(() => {
    if (!student) return;
    loadTab(tab);
  }, [tab, enrollment?.class_id, student]);

  async function loadCore() {
    setLoading(true);
    const [studentRes, enrollRes] = await Promise.all([
      supabase.from('students').select('*, classes(id, name, level, section)').eq('id', studentId).maybeSingle(),
      supabase.from('student_enrollments').select('*, classes(id, name, level, section), academic_years(name), terms(name)').eq('student_id', studentId).eq('status', 'active').maybeSingle(),
    ]);

    let resolvedStudent = studentRes.data;
    let resolvedEnrollment = enrollRes.data;

    // Graduated (and other former) students have no active enrollment and a null class_id.
    // Fall back to their most recent enrollment that had a class, so the profile shows their final class.
    if (!resolvedEnrollment && resolvedStudent && !resolvedStudent.class_id) {
      const { data: lastEnroll } = await supabase
        .from('student_enrollments')
        .select('*, classes(id, name, level, section), academic_years(name), terms(name)')
        .eq('student_id', studentId)
        .not('class_id', 'is', null)
        .order('enrollment_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastEnroll) resolvedEnrollment = lastEnroll;
    }

    if (resolvedStudent) {
      resolvedStudent = {
        ...resolvedStudent,
        email: resolvedStudent.guardian_email,
        phone: resolvedStudent.guardian_phone,
        state_of_origin: resolvedStudent.state_of_origin,
        lga: resolvedStudent.lga,
        is_active: resolvedStudent.status === 'active',
        role: 'student',
        _from_students_table: true,
      };
      if (!resolvedEnrollment && resolvedStudent.classes) {
        resolvedEnrollment = { classes: resolvedStudent.classes, class_id: resolvedStudent.class_id, academic_years: null, terms: null };
      }
    } else {
      const { data: pData } = await supabase.from('profiles').select('*').eq('id', studentId).maybeSingle();
      resolvedStudent = pData;
    }

    setStudent(resolvedStudent);
    setEnrollment(resolvedEnrollment);

    const classId = (resolvedEnrollment?.classes as any)?.id ?? resolvedEnrollment?.class_id;
    if (classId && viewer?.id) {
      const [ctRes, cRes] = await Promise.all([
        supabase.from('class_teachers').select('id').eq('class_id', classId).eq('teacher_id', viewer.id).maybeSingle(),
        supabase.from('classes').select('id').eq('id', classId).eq('class_teacher_id', viewer.id).maybeSingle()
      ]);
      setIsClassTeacher(!!ctRes.data || !!cRes.data);
      if (role === 'teacher') {
        const { data: csData } = await supabase.from('class_subjects').select('subject_id').eq('class_id', classId).eq('teacher_id', viewer.id);
        setMySubjectIds((csData ?? []).map(d => d.subject_id));
      }
    }
    setLoading(false);
    const resolvedClassId = (resolvedEnrollment?.classes as any)?.id ?? resolvedEnrollment?.class_id;
    loadTab('bio', resolvedClassId);

    if (isAdmin) {
      const { data: clsData } = await supabase.from('classes').select('id, name, level, section').order('level');
      setClassList(clsData ?? []);
    }
  }

  async function handleDeleteStudent() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { data: profileExists } = await supabase.from('profiles').select('id').eq('id', studentId).maybeSingle();
        if (profileExists) {
          await supabase.functions.invoke('create-user', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: { action: 'delete', userId: studentId },
          });
        }
      }
      await supabase.from('students').delete().eq('id', studentId);
      logActivity(viewer, {
        action: 'student.deleted',
        entityType: 'student',
        details: { name: `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(), admission_number: student?.admission_number ?? '' },
      });
      navigate('/students');
    } catch (err: any) {
      alert('Error deleting student: ' + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  function openEdit() {
    setEditForm({
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      phone: student.phone,
      address: student.address,
      gender: student.gender,
      date_of_birth: student.date_of_birth,
      blood_group: student.blood_group,
      state_of_origin: student.state_of_origin || '',
      lga: student.lga || '',
      class_id: enrollment?.class_id,
    });
    setShowEdit(true);
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const updateData: any = {
        phone: editForm.phone,
        address: editForm.address,
        date_of_birth: editForm.date_of_birth,
        updated_at: new Date().toISOString(),
      };

      if (isAdmin) {
        updateData.first_name = editForm.first_name;
        updateData.last_name = editForm.last_name;
        updateData.email = editForm.email;
        updateData.gender = editForm.gender;
        updateData.blood_group = editForm.blood_group;
        updateData.state_of_origin = editForm.state_of_origin;
        updateData.lga = editForm.lga;
        updateData.class_id = editForm.class_id || null;
        
        // If class changed, update enrollment record
        if (editForm.class_id !== enrollment?.class_id) {
          const { data: yearData } = await supabase.from('academic_years').select('id').eq('school_id', viewer?.school_id ?? '').eq('is_current', true).maybeSingle();
          if (yearData) {
            const { data: termData } = await supabase.from('academic_year_terms').select('term_id').eq('academic_year_id', yearData.id).eq('is_current', true).maybeSingle();
            const termId = (termData as any)?.term_id ?? null;
            // Find the student's existing primary (active) enrollment for this year
            const { data: existingEnroll } = await supabase
              .from('student_enrollments')
              .select('id')
              .eq('student_id', studentId)
              .eq('academic_year_id', yearData.id)
              .eq('status', 'active')
              .maybeSingle();
            if (existingEnroll) {
              // Update class in place — preserves enrollment history
              await supabase.from('student_enrollments')
                .update({ class_id: editForm.class_id, term_id: termId })
                .eq('id', existingEnroll.id);
            } else {
              // No enrollment yet — create one
              await supabase.from('student_enrollments').insert({
                student_id: studentId,
                class_id: editForm.class_id,
                academic_year_id: yearData.id,
                term_id: termId,
                status: 'active',
                enrollment_date: new Date().toISOString().split('T')[0],
              });
            }
          }
        }
      }

      if (student._from_students_table) {
        const { error } = await supabase.rpc('update_student', {
          p_id: studentId,
          p_payload: updateData
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('update_profile', {
          p_id: studentId,
          p_payload: updateData
        });
        if (error) throw error;
      }
      
      // Dual-sync if student has a profile record too (for logins)
      if (student._from_students_table) {
        const { data: hasProfile } = await supabase.from('profiles').select('id').eq('id', studentId).maybeSingle();
        if (hasProfile) {
          await supabase.rpc('update_profile', {
            p_id: studentId,
            p_payload: {
              first_name: updateData.first_name,
              last_name: updateData.last_name,
              email: updateData.email,
              phone: updateData.phone,
              address: updateData.address,
              gender: updateData.gender,
              blood_group: updateData.blood_group,
              state_of_origin: updateData.state_of_origin,
              lga: updateData.lga
            }
          });
        }
      }
      
      setStudent({ ...student, ...updateData });
      setShowEdit(false);
      loadCore(); // Refresh everything
    } catch (err: any) {
      alert('Error updating profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function searchParents() {
    if (!parentSearchQuery.trim()) return;
    setSearchingParents(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'parent')
        .or(`first_name.ilike.%${parentSearchQuery}%,last_name.ilike.%${parentSearchQuery}%,email.ilike.%${parentSearchQuery}%,phone.ilike.%${parentSearchQuery}%`)
        .limit(5);
      setParentSearchResults(data ?? []);
    } finally {
      setSearchingParents(false);
    }
  }

  async function handleLinkParent(parentId: string, relationship: string) {
    setLinkingParent(true);
    try {
      const { error } = await supabase.from('parent_student_links').insert({
        parent_id: parentId,
        student_id: studentId,
        relationship: relationship === 'Father' || relationship === 'Mother' ? 'parent' : 'guardian',
      });
      if (error) throw error;
      setTabLoaded(prev => ({ ...prev, bio: false }));
      loadTab('bio');
    } catch (err: any) {
      alert('Error linking parent: ' + err.message);
    } finally {
      setLinkingParent(false);
    }
  }

  async function handleUnlinkParent(linkId: string) {
    if (!confirm('Are you sure you want to unlink this parent?')) return;
    try {
      const { error } = await supabase.from('parent_student_links').delete().eq('id', linkId);
      if (error) throw error;
      setTabLoaded(prev => ({ ...prev, bio: false }));
      loadTab('bio');
    } catch (err: any) {
      alert('Error unlinking parent: ' + err.message);
    }
  }

  async function loadTab(t: string, overrideClassId?: string) {
    if (tabLoaded[t]) return;

    if (t === 'bio') {
      const { data: parentData } = await supabase.from('parent_student_links').select('*, profiles!parent_student_links_parent_id_fkey(first_name, last_name, email, phone, address)').eq('student_id', studentId);
      setParents(parentData ?? []);
      setTabLoaded(prev => ({ ...prev, bio: true }));
      return;
    }

    const classId = overrideClassId ?? enrollment?.class_id ?? (await supabase.from('student_enrollments').select('class_id').eq('student_id', studentId).eq('status', 'active').maybeSingle()).data?.class_id;
    // Only the subjects tab strictly needs a current class; everything else
    // (results, fees, history, etc.) is keyed by student id and must remain
    // retrievable for graduated/alumni students.
    if (!classId && t === 'subjects') { setTabLoaded(prev => ({ ...prev, [t]: true })); return; }
    if (t === 'results' && canView.results) {
      const { data: myGrades } = await supabase
        .from('grades')
        .select('term_id, academic_year_id, class_id, subject_id, total_score, ca1_score, ca3_score, exam_score, terms(name), academic_years(name), classes(name, level, section)')
        .eq('student_id', studentId);

      // Exclusions for this student (term-aware). If the fetch errors/returns nothing, scores count as today.
      const { data: myExclusions } = await supabase
        .from('student_subject_exclusions')
        .select('subject_id, academic_year_id, term_id')
        .eq('student_id', studentId);
      const isResultExcluded = (subjectId: string, yearId: string, termId: string) =>
        (myExclusions ?? []).some((e: any) =>
          e.subject_id === subjectId && e.academic_year_id === yearId && (e.term_id == null || e.term_id === termId));

      const termsMap = new Map<string, {
        term_id: string; term_name: string;
        academic_year_id: string; academic_year_name: string;
        class_id: string | null; class_name: string;
        myTotals: number[];
      }>();

      for (const g of myGrades ?? []) {
        const total = (g as any).total_score ?? (((g as any).ca1_score || 0) + ((g as any).ca3_score || 0) + ((g as any).exam_score || 0));
        if (total == null) continue; // zero counts (missed exam); only skip rows with no total
        if (isResultExcluded(g.subject_id, g.academic_year_id, g.term_id)) continue;
        const key = `${g.term_id}::${g.academic_year_id}`;
        const cls = (g as any).classes;
        const className = cls?.name || `${cls?.level ?? ''}${cls?.section ? '-' + cls.section : ''}` || '—';
        if (!termsMap.has(key)) {
          termsMap.set(key, {
            term_id: g.term_id,
            term_name: ((g as any).terms?.name) ?? '—',
            academic_year_id: g.academic_year_id,
            academic_year_name: ((g as any).academic_years?.name) ?? '—',
            class_id: g.class_id,
            class_name: className,
            myTotals: [],
          });
        }
        termsMap.get(key)!.myTotals.push(total);
      }

      const termsList = Array.from(termsMap.values());
      const publishedSet = new Set<string>();
      if (termsList.length > 0) {
        const { data: comps } = await supabase
          .from('result_compilations')
          .select('class_id, term_id, academic_year_id, status')
          .in('term_id', termsList.map(c => c.term_id));
        for (const c of comps ?? []) {
          if (c.status === 'published') {
            publishedSet.add(`${c.class_id}::${c.term_id}::${c.academic_year_id}`);
          }
        }
      }

      const results: TermResult[] = [];
      for (const tr of termsList) {
        const total = tr.myTotals.reduce((s, n) => s + n, 0);
        const avg = tr.myTotals.length > 0 ? total / tr.myTotals.length : 0;

        let position: number | null = null;
        let classSize: number | null = null;
        if (tr.class_id) {
          const [{ data: classGrades }, { data: classExclusions }] = await Promise.all([
            supabase
              .from('grades')
              .select('student_id, subject_id, total_score, ca1_score, ca3_score, exam_score')
              .eq('class_id', tr.class_id)
              .eq('term_id', tr.term_id)
              .eq('academic_year_id', tr.academic_year_id),
            supabase
              .from('student_subject_exclusions')
              .select('student_id, subject_id, term_id')
              .eq('class_id', tr.class_id)
              .eq('academic_year_id', tr.academic_year_id),
          ]);
          // Term-aware: term_id null = whole year, else must match this term.
          const classExclSet = new Set<string>(
            (classExclusions ?? [])
              .filter((e: any) => e.term_id == null || e.term_id === tr.term_id)
              .map((e: any) => `${e.student_id}:${e.subject_id}`)
          );

          const sums: Record<string, { sum: number; count: number }> = {};
          for (const cg of classGrades ?? []) {
            const ct = (cg as any).total_score ?? (((cg as any).ca1_score || 0) + ((cg as any).ca3_score || 0) + ((cg as any).exam_score || 0));
            if (ct == null) continue; // zero counts; only skip rows with no total
            if (classExclSet.has(`${cg.student_id}:${(cg as any).subject_id}`)) continue;
            if (!sums[cg.student_id]) sums[cg.student_id] = { sum: 0, count: 0 };
            sums[cg.student_id].sum += ct;
            sums[cg.student_id].count += 1;
          }
          const avgs = Object.entries(sums).map(([sid, v]) => ({ sid, avg: v.count > 0 ? v.sum / v.count : 0 }));
          if (avgs.length > 0) {
            const me = avgs.find(x => x.sid === studentId);
            if (me) {
              const higher = new Set(avgs.filter(x => x.avg > me.avg).map(x => x.avg.toFixed(4))).size;
              position = higher + 1;
            }
            classSize = avgs.length;
          }
        }

        const published = tr.class_id ? publishedSet.has(`${tr.class_id}::${tr.term_id}::${tr.academic_year_id}`) : false;

        results.push({
          term_id: tr.term_id,
          term_name: tr.term_name,
          academic_year_id: tr.academic_year_id,
          academic_year_name: tr.academic_year_name,
          class_id: tr.class_id,
          class_name: tr.class_name,
          subject_count: tr.myTotals.length,
          total,
          average: avg,
          position,
          class_size: classSize,
          remark: overallRemark(avg),
          published,
        });
      }

      results.sort((a, b) => {
        if (a.academic_year_name !== b.academic_year_name) return b.academic_year_name.localeCompare(a.academic_year_name);
        return b.term_name.localeCompare(a.term_name);
      });

      setTermResults(results);
      setGrades([]);
    }
    if (t === 'attendance' && canView.attendance) {
      const { data } = await supabase.from('student_attendance').select('*').eq('student_id', studentId).order('date', { ascending: false }).limit(60);
      setAttendance(data ?? []);
    }
    if (t === 'subjects') {
      const [csRes, exRes] = await Promise.all([
        supabase.from('class_subjects').select('*, subjects(id, name, code, category), profiles(first_name, last_name)').eq('class_id', classId),
        supabase.from('student_subject_exclusions').select('id, subject_id').eq('student_id', studentId).eq('class_id', classId),
      ]);
      setSubjects(csRes.data ?? []);
      const exMap: Record<string, string> = {};
      (exRes.data ?? []).forEach((e: any) => { exMap[e.subject_id] = e.id; });
      setSubjectExclusions(exMap);
      setSubjectSaveMsg('');
    }
    if (t === 'fees' && canView.fees) {
      const [fsRes, fpRes, fcRes] = await Promise.all([
        supabase.from('fee_structures').select('*').eq('school_id', viewer?.school_id ?? '').order('created_at', { ascending: false }),
        supabase.from('fee_payments').select('*, fee_structures(name)').eq('student_id', studentId).order('payment_date', { ascending: false }),
        supabase.from('fees_collections').select('*, fees_master(fees_types(name))').eq('student_id', studentId).order('payment_date', { ascending: false }),
      ]);
      setFees(fsRes.data ?? []);
      const merged = [
        ...(fpRes.data ?? []).map(p => ({ ...p, fee_name: p.fee_structures?.name || 'Fee' })),
        ...(fcRes.data ?? []).map(p => ({ ...p, fee_name: p.fees_master?.fees_types?.name || 'Fee', status: 'paid', receipt_number: p.receipt_no }))
      ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
      setFeePayments(merged);
    }
    if (t === 'behaviour' && canView.behaviour) {
      const { data } = await supabase.from('student_behaviour_records').select('*, behaviour_incidents(name, severity), profiles!student_behaviour_records_assigned_by_fkey(first_name, last_name)').eq('student_id', studentId).order('created_at', { ascending: false });
      setBehaviours(data ?? []);
    }
    if (t === 'dormitory' && canView.dormitory) {
      const { data } = await supabase.from('dormitory_assignments').select('*, rooms(id, room_number, room_types(name), dormitory_buildings(name))').eq('student_id', studentId).eq('status', 'active').maybeSingle();
      setDormitory(data);
    }
    if (t === 'purchases' && canView.purchases) {
      const { data } = await supabase.from('orders').select('*, order_items(*, store_products(name, price))').eq('student_id', studentId).order('created_at', { ascending: false }).limit(30);
      setOrders(data ?? []);
    }
    if (t === 'history' && canView.history) {
      const [enrollRes, logRes, promoRes] = await Promise.all([
        supabase.from('student_enrollments').select('*, classes(name, level, section), academic_years(name), terms(name)').eq('student_id', studentId).order('enrollment_date', { ascending: false }),
        supabase.from('activity_logs').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(50),
        supabase.from('student_promotions').select('*, from_class:classes!student_promotions_from_class_id_fkey(name), to_class:classes!student_promotions_to_class_id_fkey(name), profiles:promoted_by(first_name, last_name)').eq('student_id', studentId).order('created_at', { ascending: false }),
      ]);
      setEnrollHistory(enrollRes.data ?? []);
      const items = [
        ...(logRes.data ?? []).map((l: any) => ({
          id: `log-${l.id}`,
          at: l.created_at,
          title: actionLabel(l.action),
          by: l.user_name,
          detail: typeof l.details === 'object' && l.details ? Object.entries(l.details).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') : '',
        })),
        ...(promoRes.data ?? []).map((p: any) => ({
          id: `promo-${p.id}`,
          at: p.created_at,
          title: p.to_class_id ? `Promoted to ${p.to_class?.name ?? 'new class'}` : 'Graduated',
          by: p.profiles ? `${p.profiles.first_name ?? ''} ${p.profiles.last_name ?? ''}`.trim() : '',
          detail: p.from_class?.name ? `From ${p.from_class.name} (${p.result})` : p.result,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setActivityItems(items);
    }
    setTabLoaded(prev => ({ ...prev, [t]: true }));
  }

  // Senior class = SS1, SS2, SS3 (or any level starting with "SS")
  function isSeniorClass(): boolean {
    const level = (enrollment?.classes as any)?.level ?? '';
    return /^SS/i.test(level);
  }

  async function toggleSubject(subjectId: string) {
    if (!isAdmin || subjectSaving) return;
    setSubjectSaveMsg('');
    const classId = (enrollment?.classes as any)?.id ?? enrollment?.class_id;
    const isExcluded = !!subjectExclusions[subjectId];
    const chosenCount = subjects.length - Object.keys(subjectExclusions).length;
    const senior = isSeniorClass();

    if (isExcluded) {
      // Restoring a subject — would increase chosen count
      if (senior && chosenCount >= 9) {
        setSubjectSaveMsg('Senior class students can offer at most 9 subjects.');
        return;
      }
      const exId = subjectExclusions[subjectId];
      setSubjectSaving(true);
      const { error } = await supabase.from('student_subject_exclusions').delete().eq('id', exId);
      if (error) { setSubjectSaveMsg('Failed to update: ' + error.message); setSubjectSaving(false); return; }
      setSubjectExclusions(prev => { const n = { ...prev }; delete n[subjectId]; return n; });
    } else {
      // Removing a subject — would decrease chosen count
      if (senior && chosenCount <= 8) {
        setSubjectSaveMsg('Senior class students must offer at least 8 subjects.');
        return;
      }
      setSubjectSaving(true);
      const { data, error } = await supabase.from('student_subject_exclusions').insert({
        school_id: viewer?.school_id,
        student_id: studentId,
        subject_id: subjectId,
        class_id: classId,
        academic_year_id: enrollment?.academic_year_id ?? null,
        term_id: null,
        reason: 'Admin: student does not offer this subject',
        created_by: viewer?.id,
      }).select('id').maybeSingle();
      if (error) { setSubjectSaveMsg('Failed to update: ' + error.message); setSubjectSaving(false); return; }
      if (data?.id) setSubjectExclusions(prev => ({ ...prev, [subjectId]: data.id }));
    }
    setSubjectSaving(false);
    setSubjectSaveMsg('Saved.');
    setTimeout(() => setSubjectSaveMsg(''), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="font-medium">Student not found</p>
        <button onClick={() => window.history.back()} className="mt-3 text-sm text-emerald-600 hover:underline">Go back</button>
      </div>
    );
  }

  const cls = enrollment?.classes as any;
  const classLabel = cls ? (cls.name || `${cls.level}${cls.section}`) : '—';
  const initials = `${student.first_name?.[0] ?? ''}${student.last_name?.[0] ?? ''}`;

  const attStats = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    total: attendance.length,
  };
  const attPct = attStats.total > 0 ? Math.round((attStats.present / attStats.total) * 100) : 0;

  const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const totalPaid = feePayments.reduce((s, p) => s + (p.amount_paid || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Student Profile</h2>
          <p className="text-slate-500 text-sm">{classLabel} — {enrollment?.academic_years?.name ?? ''}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">
            <div className="flex items-end gap-4">
              {isSecurity ? (
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm flex-shrink-0">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt={student.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-slate-400">{initials}</span>
                  )}
                </div>
              ) : (
                <PhotoUpload
                  currentUrl={student.avatar_url}
                  name={`${student.first_name} ${student.last_name}`}
                  folder={`students/${studentId}`}
                  onUploaded={handleStudentPhotoUpload}
                  size="lg"
                />
              )}
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-slate-800">{student.first_name} {student.last_name}</h3>
                  <StudentTypeBadge type={student.student_type} />
                </div>
                <p className="text-sm text-slate-500">{student.admission_number || student.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">{classLabel}</span>
              {isClassTeacher && <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Form Master</span>}
              {!isAdmin && !isClassTeacher && role === 'teacher' && <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full">Subject Teacher View</span>}
              {(isAdmin || viewer?.id === studentId) && (
                <button onClick={openEdit} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit Profile
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
              {(isAdmin || isClassTeacher) && (
                <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors">
                  <Printer className="w-3 h-3" /> Print Report
                </button>
              )}
            </div>
          </div>

          <div className="border-b border-slate-100 -mx-5">
            <div className="flex gap-0.5 px-5 overflow-x-auto scrollbar-hide">
              {visibleTabs.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); loadTab(t.key); }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showPrint && <StudentReportPrint studentId={studentId} onClose={() => setShowPrint(false)} />}

      <div className="pb-6">
        {tab === 'bio' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-emerald-500" /> Personal Information</h4>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Admission No.', value: student.admission_number || '—' },
                  { label: 'Date of Birth', value: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—' },
                  { label: 'Gender', value: student.gender || '—', cap: true },
                  { label: 'Blood Group', value: student.blood_group || '—', restrictSecurity: true },
                  { label: 'State of Origin', value: student.state_of_origin || '—', restrictSecurity: true },
                  { label: 'L.G.A', value: student.lga || '—', restrictSecurity: true },
                  { label: 'Class', value: classLabel },
                  { label: 'Student Type', value: student.student_type ? (student.student_type === 'boarding' ? 'Boarding' : 'Day') : '—', cap: true },
                  { label: 'Status', value: student.is_active ? 'Active' : 'Inactive' },
                ].filter(item => !isSecurity || !item.restrictSecurity).map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <dt className="text-xs text-slate-500 mb-0.5">{item.label}</dt>
                    <dd className={`text-sm font-semibold text-slate-800 ${item.cap ? 'capitalize' : ''}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 space-y-2">
                {student.email && <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="w-4 h-4 text-slate-400" />{student.email}</div>}
                {student.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-4 h-4 text-slate-400" />{student.phone}</div>}
                {student.address && <div className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />{student.address}</div>}
              </div>
            </div>

            <div className="space-y-5">
              {canView.parentInfo && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /> Parent / Guardian</h4>
                    {isAdmin && (
                      <button 
                        onClick={() => setShowManageParents(true)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                      >
                        Manage Links
                      </button>
                    )}
                  </div>
                  {parents.length === 0 ? (
                    <div>
                      <dl className="space-y-2">
                        {student.guardian_name && <div className="bg-slate-50 rounded-xl p-3"><dt className="text-xs text-slate-500 mb-0.5">Guardian Name</dt><dd className="text-sm font-semibold text-slate-800">{student.guardian_name}</dd></div>}
                        {student.guardian_phone && <div className="bg-slate-50 rounded-xl p-3"><dt className="text-xs text-slate-500 mb-0.5">Phone</dt><dd className="text-sm font-semibold text-slate-800">{student.guardian_phone}</dd></div>}
                        {student.guardian_email && <div className="bg-slate-50 rounded-xl p-3"><dt className="text-xs text-slate-500 mb-0.5">Email</dt><dd className="text-sm font-semibold text-slate-800">{student.guardian_email}</dd></div>}
                      </dl>
                      {!student.guardian_name && <p className="text-sm text-slate-400">No guardian info on record</p>}
                    </div>
                  ) : parents.map((p, i) => {
                    const pr = p.profiles as any;
                    return (
                      <div key={p.id} className="border border-slate-100 rounded-xl p-3 space-y-2 mb-3 last:mb-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-800 text-sm">{pr?.first_name} {pr?.last_name}</p>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{p.relationship}</span>
                        </div>
                        {pr?.phone && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Phone className="w-3 h-3" />{pr.phone}</p>}
                        {pr?.email && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Mail className="w-3 h-3" />{pr.email}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-500" /> Enrollment</h4>
                <dl className="space-y-2">
                  {[
                    { label: 'Class', value: classLabel },
                    { label: 'Academic Year', value: enrollment?.academic_years?.name ?? '—' },
                    { label: 'Term', value: enrollment?.terms?.name ?? '—' },
                    { label: 'Enrollment Date', value: enrollment?.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : '—' },
                    { label: 'Status', value: enrollment?.status ?? '—', cap: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-500">{item.label}</span>
                      <span className={`text-sm font-semibold text-slate-800 ${item.cap ? 'capitalize' : ''}`}>{item.value}</span>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        )}

        {tab === 'results' && canView.results && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">Academic Results</h4>
                <p className="text-xs text-slate-500 mt-0.5">Term-by-term performance history</p>
              </div>
            </div>

            {termResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
                <Award className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No results recorded yet</p>
                <p className="text-slate-400 text-sm mt-1">Term results will appear here once recorded</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {termResults.map(r => {
                  const locked = !r.published && role === 'student';
                  return (
                    <div
                      key={`${r.term_id}-${r.academic_year_id}`}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-blue-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-emerald-600" />
                              {r.term_name} — {r.academic_year_name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5" />
                              Class: {r.class_name}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${
                              r.published ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {r.published ? 'Published' : 'Pending'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 divide-x divide-slate-100">
                        <div className="p-4 text-center">
                          <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Average</p>
                          <p className="text-2xl font-black text-emerald-600 mt-1">{r.average.toFixed(2)}%</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{r.subject_count} subjects</p>
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Position</p>
                          <p className="text-2xl font-black text-blue-600 mt-1">
                            {r.position ? ordinal(r.position) : '—'}
                          </p>
                          {r.class_size && <p className="text-[10px] text-slate-400 mt-0.5">of {r.class_size}</p>}
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Remark</p>
                          <span className={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-lg border ${remarkBadge(r.remark)}`}>
                            {r.remark}
                          </span>
                        </div>
                      </div>

                      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                        {locked ? (
                          <p className="text-xs text-slate-500 text-center italic">
                            Results not yet published. Full report will be available once your class teacher publishes.
                          </p>
                        ) : (
                          <button
                            onClick={() => setViewingTermReport({ termId: r.term_id, yearId: r.academic_year_id })}
                            className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            View Full Report
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewingTermReport && (
              <StudentReportPrint
                studentId={studentId}
                termId={viewingTermReport.termId}
                academicYearId={viewingTermReport.yearId}
                onClose={() => setViewingTermReport(null)}
              />
            )}
          </div>
        )}

        {tab === 'attendance' && canView.attendance && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Present', value: attStats.present, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: 'Absent', value: attStats.absent, color: 'bg-red-50 text-red-700 border-red-200' },
                { label: 'Late', value: attStats.late, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { label: 'Attendance %', value: `${attPct}%`, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="font-semibold text-slate-800">Attendance Records</h4>
                <p className="text-xs text-slate-400">Last {attendance.length} records</p>
              </div>
              {attendance.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">No attendance records found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Date</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Status</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendance.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 text-slate-700">{new Date(a.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${attColor(a.status)}`}>{a.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{a.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'subjects' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h4 className="font-semibold text-slate-800">Enrolled Subjects — {classLabel}</h4>
                {isAdmin && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSeniorClass()
                      ? `Senior class — must offer 8–9 subjects. Currently offering ${subjects.length - Object.keys(subjectExclusions).length} of ${subjects.length}.`
                      : `Tick subjects this student offers. Currently ${subjects.length - Object.keys(subjectExclusions).length} of ${subjects.length} selected.`}
                  </p>
                )}
              </div>
              {subjectSaveMsg && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${subjectSaveMsg === 'Saved.' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {subjectSaveMsg === 'Saved.' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {subjectSaveMsg}
                </span>
              )}
            </div>
            {subjects.length === 0 ? (
              <p className="text-sm text-slate-400">No subjects assigned to this class</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map(s => {
                  const sub = s.subjects as any;
                  const teacher = s.profiles as any;
                  const isExcluded = !!subjectExclusions[sub?.id];
                  const isOffered = !isExcluded;
                  return (
                    <div
                      key={s.id}
                      onClick={() => isAdmin && toggleSubject(sub?.id)}
                      className={`border rounded-xl p-4 transition-all ${isAdmin ? 'cursor-pointer select-none' : ''} ${isExcluded ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'} ${isAdmin && !subjectSaving ? 'hover:border-emerald-300' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isAdmin && (
                            <div className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${isOffered ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                              {isOffered && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          )}
                          <p className={`font-semibold text-sm ${isExcluded ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{sub?.name}</p>
                        </div>
                        {sub?.code && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0">{sub.code}</span>}
                      </div>
                      <p className="text-xs text-slate-500 capitalize">{sub?.category}</p>
                      {teacher && <p className="text-xs text-emerald-600 mt-1.5 font-medium">{teacher.first_name} {teacher.last_name}</p>}
                      {isExcluded && isAdmin && <p className="text-xs text-slate-400 mt-1 italic">Not offered</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'fees' && canView.fees && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Fees', value: `₦${totalFees.toLocaleString()}`, color: 'bg-slate-50 border-slate-200 text-slate-800' },
                { label: 'Total Paid', value: `₦${totalPaid.toLocaleString()}`, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { label: 'Balance', value: `₦${(totalFees - totalPaid).toLocaleString()}`, color: totalFees - totalPaid > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100"><h4 className="font-semibold text-slate-800">Payment History</h4></div>
              {feePayments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">No payments recorded</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Fee', 'Amount Paid', 'Date', 'Method', 'Receipt'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feePayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-slate-700">{p.fee_name || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-700">₦{(p.amount_paid || 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-slate-500 capitalize">{p.payment_method || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.receipt_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'behaviour' && canView.behaviour && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h4 className="font-semibold text-slate-800">Behaviour Records</h4></div>
            {behaviours.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No behaviour incidents recorded</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Date', 'Incident', 'Severity', 'Assigned By', 'Notes'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {behaviours.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-500">{new Date(b.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{(b.behaviour_incidents as any)?.name ?? b.incident_name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {(b.behaviour_incidents as any)?.severity && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(b.behaviour_incidents as any).severity === 'high' ? 'bg-red-100 text-red-700' : (b.behaviour_incidents as any).severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {(b.behaviour_incidents as any).severity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{b.profiles ? `${(b.profiles as any).first_name} ${(b.profiles as any).last_name}` : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">{b.description || b.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'dormitory' && canView.dormitory && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-500" /> Dormitory Assignment</h4>
            {!dormitory ? (
              <div className="py-8 text-center text-slate-400 text-sm">Student is not assigned to any dormitory</div>
            ) : (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Building', value: (dormitory.rooms as any)?.dormitory_buildings?.name ?? '—' },
                  { label: 'Room', value: (dormitory.rooms as any)?.room_number ?? '—' },
                  { label: 'Room Type', value: (dormitory.rooms as any)?.room_types?.name ?? '—' },
                  { label: 'Bed No.', value: dormitory.bed_number ?? '—' },
                  { label: 'From', value: dormitory.start_date ? new Date(dormitory.start_date).toLocaleDateString() : '—' },
                  { label: 'Status', value: dormitory.status ?? '—', cap: true },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <dt className="text-xs text-slate-500 mb-0.5">{item.label}</dt>
                    <dd className={`text-sm font-semibold text-slate-800 ${item.cap ? 'capitalize' : ''}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {tab === 'purchases' && canView.purchases && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h4 className="font-semibold text-slate-800">Purchase History</h4>
              <p className="text-xs text-slate-400 mt-0.5">School store orders</p>
            </div>
            {orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No purchases found</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {orders.map(o => (
                  <div key={o.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-800">Order #{o.id.slice(-6).toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : o.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{o.status}</span>
                        <span className="text-sm font-bold text-slate-700">₦{(o.total_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(o.order_items ?? []).slice(0, 4).map((item: any, i: number) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.store_products?.name ?? 'Item'} ×{item.quantity}</span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && canView.history && (
          <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-slate-100"><h4 className="font-semibold text-slate-800">Activity History</h4></div>
            {activityItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No recorded activity yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activityItems.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      {item.detail && <p className="text-xs text-slate-500 mt-0.5 capitalize">{item.detail}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">{new Date(item.at).toLocaleDateString()} {new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      {item.by && <p className="text-xs text-slate-500 mt-0.5">by {item.by}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h4 className="font-semibold text-slate-800">Enrollment History</h4></div>
            {enrollHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No enrollment history found</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {enrollHistory.map(h => {
                  const c = h.classes as any;
                  return (
                    <div key={h.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c ? (c.name || `${c.level}${c.section}`) : '—'}</p>
                        <p className="text-xs text-slate-500">{(h.academic_years as any)?.name} · {(h.terms as any)?.name ?? 'All Terms'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${h.status === 'active' ? 'bg-emerald-100 text-emerald-700' : h.status === 'graduated' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{h.status}</span>
                        <p className="text-xs text-slate-400 mt-1">{new Date(h.enrollment_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>
        )}
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Student Profile" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isAdmin && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">First Name</label>
                  <input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label>
                  <input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone Number</label>
              <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Gender</label>
                <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date of Birth</label>
              <input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            {isAdmin && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">State of Origin</label>
                  <input type="text" value={editForm.state_of_origin || ''} onChange={e => setEditForm({...editForm, state_of_origin: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Local Government Area (LGA)</label>
                  <input type="text" value={editForm.lga || ''} onChange={e => setEditForm({...editForm, lga: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Blood Group</label>
                  <select value={editForm.blood_group} onChange={e => setEditForm({...editForm, blood_group: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
              <textarea value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            {isAdmin && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Class (Admin Only)</label>
                <select value={editForm.class_id} onChange={e => setEditForm({...editForm, class_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                  {classList.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveProfile} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Student">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">This action cannot be undone</p>
              <p className="text-sm text-red-600 mt-1">
                Deleting <strong>{student?.first_name} {student?.last_name}</strong> will permanently remove their student record, enrollment history, grades, attendance, and login account.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleDeleteStudent} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete Student'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showManageParents}
        onClose={() => setShowManageParents(false)} 
        title="Manage Parent Associations"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <h5 className="text-sm font-semibold text-slate-800 mb-3">Linked Parents</h5>
            {parents.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No accounts linked to this student.</p>
            ) : (
              <div className="space-y-2">
                {parents.map(link => {
                  const p = link.profiles as any;
                  return (
                    <div key={link.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p?.first_name} {p?.last_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{link.relationship}</p>
                      </div>
                      <button 
                        onClick={() => handleUnlinkParent(link.id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Unlink
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h5 className="text-sm font-semibold text-slate-800 mb-3">Link Existing Parent</h5>
            <div className="flex gap-2 mb-4">
              <input 
                type="text"
                placeholder="Search by name, email or phone..."
                value={parentSearchQuery}
                onChange={e => setParentSearchQuery(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button 
                onClick={searchParents}
                disabled={searchingParents}
                className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {searchingParents ? '...' : 'Search'}
              </button>
            </div>

            {parentSearchResults.length > 0 && (
              <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                {parentSearchResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-slate-500">{p.email || p.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        id={`rel-${p.id}`}
                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                        defaultValue="Father"
                      >
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                      </select>
                      <button 
                        onClick={() => {
                          const rel = (document.getElementById(`rel-${p.id}`) as HTMLSelectElement).value;
                          handleLinkParent(p.id, rel);
                        }}
                        disabled={linkingParent}
                        className="text-xs bg-emerald-500 text-white px-3 py-1 rounded font-medium hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-2">
            <button 
              onClick={() => setShowManageParents(false)}
              className="px-6 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
