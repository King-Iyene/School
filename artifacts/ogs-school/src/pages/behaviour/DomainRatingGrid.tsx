import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Save, CheckCircle, AlertCircle, Settings, Plus, Trash2, Users, User } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  sort_order: number;
}

interface StudentRow {
  id: string;
  full_name: string;
  admission_number?: string;
}

interface Class {
  id: string;
  name: string;
}

interface Term {
  id: string;
  name: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Fair',
  2: 'Normal',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

function StarRatingLegend() {
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} className="flex flex-col items-center gap-1 px-4 py-2 bg-gray-100 rounded-lg min-w-[80px]">
          <div className="flex">
            {Array.from({ length: n }).map((_, i) => (
              <svg key={i} className="w-4 h-4 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            {Array.from({ length: 5 - n }).map((_, i) => (
              <svg key={i} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-xs font-semibold text-app-text uppercase tracking-wide">{RATING_LABELS[n]}: {n}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  domain: 'affective' | 'psychomotor';
  title: string;
}

export default function DomainRatingGrid({ domain, title }: Props) {
  const { profile } = useAuth();
  if (!profile) return null;

  const [classes, setClasses] = useState<Class[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [savedRatings, setSavedRatings] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'class' | 'student'>('class');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);

  const [filters, setFilters] = useState({ class_id: '', term_id: '', year_id: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [showSkillModal, setShowSkillModal] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [addingSkill, setAddingSkill] = useState(false);

  const schoolId = profile?.school_id;

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadBaseData();
  }, [schoolId]);

  useEffect(() => {
    if (filters.class_id && filters.year_id) loadStudentsAndRatings();
  }, [filters]);

  async function loadBaseData() {
    if (!schoolId) return;
    const [classRes, termRes, yearRes, skillRes] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('terms').select('id, name').order('name'),
      supabase.from('academic_years').select('id, name').eq('school_id', schoolId).order('name'),
      supabase.from('domain_skill_definitions')
        .select('id, name, sort_order')
        .eq('school_id', schoolId)
        .eq('domain', domain)
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (termRes.data) setTerms(termRes.data);
    if (yearRes.data) {
      setYears(yearRes.data);
      const current = yearRes.data.find((_: AcademicYear, i: number) => i === yearRes.data!.length - 1);
      if (current) setFilters(f => ({ ...f, year_id: current.id }));
    }
    if (skillRes.data) setSkills(skillRes.data);
  }

  async function loadStudentsAndRatings() {
    if (!filters.class_id || !filters.year_id) return;
    setLoading(true);

    const studentsRes = await supabase
      .from('profiles')
      .select('id, full_name, admission_number')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('class_id', filters.class_id)
      .order('full_name');

    const studentList: StudentRow[] = (studentsRes.data || []).map((s: any) => ({
      id: s.id,
      full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      admission_number: s.admission_number,
    }));
    setStudents(studentList);
    setAllStudents(studentList);

    if (studentList.length > 0) {
      let rQuery = supabase
        .from('student_domain_ratings')
        .select('student_id, skill_id, rating')
        .eq('school_id', schoolId)
        .eq('class_id', filters.class_id)
        .eq('academic_year_id', filters.year_id);

      if (filters.term_id) rQuery = rQuery.eq('term_id', filters.term_id);
      else rQuery = rQuery.is('term_id', null);

      const { data: rData } = await rQuery;
      const map: Record<string, number> = {};
      (rData || []).forEach((r: any) => {
        map[`${r.student_id}_${r.skill_id}`] = r.rating;
      });
      setRatings(map);
      setSavedRatings(map);
    }
    setLoading(false);
  }

  const ratingKey = useCallback((studentId: string, skillId: string) => `${studentId}_${skillId}`, []);

  function handleRatingChange(studentId: string, skillId: string, val: string) {
    const n = parseInt(val);
    const key = ratingKey(studentId, skillId);
    if (!val) {
      const next = { ...ratings };
      delete next[key];
      setRatings(next);
    } else if (!isNaN(n) && n >= 1 && n <= 5) {
      setRatings(prev => ({ ...prev, [key]: n }));
    }
  }

  async function handleSave() {
    if (!filters.class_id || !filters.year_id) {
      showToast('error', 'Select a class and academic year first');
      return;
    }
    setSaving(true);

    const upsertRows: any[] = [];
    const displayedStudents = viewMode === 'student' && selectedStudent
      ? students.filter(s => s.id === selectedStudent)
      : students;

    displayedStudents.forEach(student => {
      skills.forEach(skill => {
        const key = ratingKey(student.id, skill.id);
        const rating = ratings[key];
        if (rating) {
          upsertRows.push({
            school_id: schoolId,
            student_id: student.id,
            class_id: filters.class_id,
            skill_id: skill.id,
            academic_year_id: filters.year_id,
            term_id: filters.term_id || null,
            rating,
            rated_by: profile?.id,
          });
        }
      });
    });

    if (upsertRows.length === 0) {
      showToast('error', 'No ratings to save');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('student_domain_ratings')
      .upsert(upsertRows, { onConflict: 'student_id,skill_id,academic_year_id,term_id' });

    if (error) {
      showToast('error', 'Failed to save ratings');
    } else {
      setSavedRatings({ ...ratings });
      showToast('success', `Ratings saved successfully (${upsertRows.length} entries)`);
    }
    setSaving(false);
  }

  async function addSkill() {
    if (!newSkillName.trim()) return;
    setAddingSkill(true);
    const { data, error } = await supabase
      .from('domain_skill_definitions')
      .insert({
        school_id: schoolId,
        domain,
        name: newSkillName.trim(),
        sort_order: skills.length + 1,
      })
      .select('id, name, sort_order')
      .single();

    if (!error && data) {
      setSkills(prev => [...prev, data]);
      setNewSkillName('');
      showToast('success', 'Skill added');
    }
    setAddingSkill(false);
  }

  async function deleteSkill(skillId: string) {
    if (!confirm('Delete this skill? All ratings for this skill will also be removed.')) return;
    await supabase.from('domain_skill_definitions').delete().eq('id', skillId);
    setSkills(prev => prev.filter(s => s.id !== skillId));
    const next = { ...ratings };
    Object.keys(next).forEach(k => { if (k.endsWith(`_${skillId}`)) delete next[k]; });
    setRatings(next);
    showToast('success', 'Skill removed');
  }

  const displayedStudents = viewMode === 'student' && selectedStudent
    ? students.filter(s => s.id === selectedStudent)
    : students;

  const hasUnsaved = JSON.stringify(ratings) !== JSON.stringify(savedRatings);

  return (
    <div className="space-y-5">


      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Rate {title}</h1>
          <p className="text-sm text-app-text-muted mt-0.5">Add Rating from 1 – 5</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSkillModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text-muted hover:bg-app-surface-alt transition-colors"
          >
            <Settings className="h-4 w-4" /> Manage Skills
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsaved}
            className="flex items-center gap-2 px-4 py-2 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Ratings'}
          </button>
        </div>
      </div>

      <StarRatingLegend />

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Academic Year</label>
            <select
              value={filters.year_id}
              onChange={e => setFilters(f => ({ ...f, year_id: e.target.value }))}
              className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            >
              <option value="">Select Year</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Class</label>
            <select
              value={filters.class_id}
              onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
              className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            >
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-app-text-muted mb-1">Term (optional)</label>
            <select
              value={filters.term_id}
              onChange={e => setFilters(f => ({ ...f, term_id: e.target.value }))}
              className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
            >
              <option value="">All Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setViewMode('class'); setSelectedStudent(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'class' ? 'bg-app-surface shadow text-app-text' : 'text-app-text-muted hover:text-app-text'}`}
            >
              <Users className="h-4 w-4" /> Class-wise
            </button>
            <button
              onClick={() => setViewMode('student')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'student' ? 'bg-app-surface shadow text-app-text' : 'text-app-text-muted hover:text-app-text'}`}
            >
              <User className="h-4 w-4" /> Student-wise
            </button>
          </div>
        </div>

        {viewMode === 'student' && students.length > 0 && (
          <div className="mt-3">
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              className="bg-app-surface text-app-text border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary w-full max-w-xs"
            >
              <option value="">Select Student</option>
              {allStudents.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
        )}
      </div>

      {!filters.class_id || !filters.year_id ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border py-16 text-center text-app-text-muted text-sm">
          Select a class and academic year to begin rating
        </div>
      ) : loading ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : displayedStudents.length === 0 ? (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border py-16 text-center text-app-text-muted text-sm">
          No students found in this class
        </div>
      ) : (
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
          {hasUnsaved && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> You have unsaved changes
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border">
                  <th className="text-left px-4 py-3 text-app-text-muted font-medium min-w-[180px] sticky left-0 bg-app-surface z-10 border-r border-app-border">
                    Student Name
                  </th>
                  {skills.map(skill => (
                    <th key={skill.id} className="px-2 py-3 text-center min-w-[90px]">
                      <div className="flex items-end justify-center h-24">
                        <span className="block text-app-text-muted font-medium text-xs" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                          {skill.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((student, idx) => (
                  <tr key={student.id} className={`border-b border-app-border ${idx % 2 === 0 ? 'bg-app-surface' : 'bg-app-surface-alt/50'}`}>
                    <td className="px-4 py-2 font-medium text-app-text sticky left-0 bg-inherit z-10 border-r border-app-border">
                      <div>{student.full_name}</div>
                      {student.admission_number && (
                        <div className="text-xs text-app-text-muted">{student.admission_number}</div>
                      )}
                    </td>
                    {skills.map(skill => {
                      const key = ratingKey(student.id, skill.id);
                      const val = ratings[key] ?? '';
                      return (
                        <td key={skill.id} className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={val}
                            onChange={e => handleRatingChange(student.id, skill.id, e.target.value)}
                            title={val ? RATING_LABELS[val as number] : 'Enter 1-5'}
                            className={`w-14 text-center border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${
                              val === 5 ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold' :
                              val === 4 ? 'border-blue-300 bg-blue-50 text-blue-700 font-semibold' :
                              val === 3 ? 'border-sky-300 bg-sky-50 text-sky-700' :
                              val === 2 ? 'border-amber-300 bg-amber-50 text-amber-700' :
                              val === 1 ? 'border-red-300 bg-red-50 text-red-600' :
                              'border-app-border'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-app-surface-alt border-t border-app-border flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsaved}
              className="flex items-center gap-2 px-5 py-2 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save All Ratings'}
            </button>
          </div>
        </div>
      )}

      {showSkillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-app-text">Manage {title} Skills</h2>
              <button onClick={() => setShowSkillModal(false)} className="text-app-text-muted hover:text-app-text text-xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {skills.map(skill => (
                <div key={skill.id} className="flex items-center justify-between py-2 px-3 bg-app-surface-alt rounded-lg border border-app-border">
                  <span className="text-sm text-app-text font-medium">{skill.name}</span>
                  <button
                    onClick={() => deleteSkill(skill.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {skills.length === 0 && (
                <p className="text-sm text-app-text-muted text-center py-4">No skills defined yet</p>
              )}
            </div>
            <div className="px-5 pb-5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New skill name..."
                  value={newSkillName}
                  onChange={e => setNewSkillName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSkill()}
                  className="bg-app-surface text-app-text flex-1 border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary"
                />
                <button
                  onClick={addSkill}
                  disabled={addingSkill || !newSkillName.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-app-primary hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
