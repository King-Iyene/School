import { useEffect, useState } from 'react';
import { Plus, ClipboardList, Calendar, Users, Link as LinkIcon, FileText, Upload, Trash2, Eye, Check, ExternalLink, Send, Clock, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function TeacherAssignments() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'principal' || profile?.role === 'head_teacher';
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', class_id: '', subject_id: '', due_date: '', max_score: '100', status: 'active', source_url: '', file_url: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentYearId, setCurrentYearId] = useState('');
  const [currentTermId, setCurrentTermId] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<any>(null);

  // Submission management state
  const [selectedForSubmissions, setSelectedForSubmissions] = useState<any>(null);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradingForm, setGradingForm] = useState({ score: '', feedback: '' });
  const [grading, setGrading] = useState(false);

  useEffect(() => { loadData(); }, [profile]);

  async function loadData() {
    if (!profile?.id) return;
    setLoading(true);
    
    // Fetch current academic year & term
    const yearData = await supabase.from('academic_years').select('id').eq('school_id', profile.school_id ?? '').eq('is_current', true).maybeSingle();
    const yearId = yearData.data?.id;
    if (yearId) setCurrentYearId(yearId);
    if (yearId) {
      const ayt = await supabase
        .from('academic_year_terms')
        .select('term_id')
        .eq('academic_year_id', yearId)
        .eq('is_current', true)
        .maybeSingle();
      if (ayt.data?.term_id) setCurrentTermId(ayt.data.term_id);
    }

    // Fetch assignments and class options from all sources
    const assignBase = supabase.from('assignments').select('*, subjects(name), classes(name, level, section)').order('created_at', { ascending: false });
    const subBase = supabase.from('subject_teacher_assignments')
      .select('class_id, classes(id, name, level, section)')
      .eq('academic_year_id', yearId ?? '');
    const fmTableBase = supabase.from('class_teachers')
      .select('class_id, classes(id, name, level, section)')
      .eq('academic_year_id', yearId ?? '');

    const [assignRes, subRes, fmTableRes, fmClassesRes] = await Promise.all([
      isAdmin ? assignBase : assignBase.eq('teacher_id', profile.id),
      isAdmin ? subBase : subBase.eq('teacher_id', profile.id),
      isAdmin ? fmTableBase : fmTableBase.eq('teacher_id', profile.id),
      isAdmin
        ? supabase.from('classes').select('id, name, level, section').eq('school_id', profile.school_id ?? '')
        : supabase.from('classes').select('id, name, level, section').eq('class_teacher_id', profile.id)
    ]);
    
    setAssignments(assignRes.data ?? []);
    
    const combined = [
      ...(subRes.data ?? []).map(d => d.classes),
      ...(fmTableRes.data ?? []).map(d => d.classes),
      ...(fmClassesRes.data ?? [])
    ].filter(Boolean);
    
    // Unique classes
    const uniqueClasses = [...new Map(combined.map((c: any) => [c.id, c])).values()];
    setClasses(uniqueClasses);
    setLoading(false);
  }

  async function loadSubjectsForClass(classId: string) {
    // Fetch current academic year
    const { data: yearData } = await supabase.from('academic_years')
      .select('id')
      .eq('school_id', profile?.school_id ?? '')
      .eq('is_current', true)
      .maybeSingle();
    const yearId = yearData?.id;

    // Fetch all subjects for the specific class from subject_teacher_assignments
    const subjectsQuery = supabase.from('subject_teacher_assignments')
      .select('*, subjects(id, name)')
      .eq('class_id', classId)
      .eq('academic_year_id', yearId ?? '');
    const { data } = await (isAdmin ? subjectsQuery : subjectsQuery.eq('teacher_id', profile?.id ?? ''));
    setSubjects((data ?? []).map(d => d.subjects).filter(Boolean));
  }

  async function loadSubmissions(assignment: any) {
    setSelectedForSubmissions(assignment);
    setShowSubmissionsModal(true);
    setLoadingSubmissions(true);
    try {
      // 1. Get all students in this class
      const { data: enrollRes, error: enrollErr } = await supabase
        .from('student_enrollments')
        .select('students(id, first_name, last_name, admission_number)')
        .eq('class_id', assignment.class_id);

      if (enrollErr) throw enrollErr;

      // 2. Get all submissions for this assignment
      const { data: subRes, error: subErr } = await supabase
        .from('assignment_submissions')
        .select('*, students(id, first_name, last_name, admission_number)')
        .eq('assignment_id', assignment.id);

      if (subErr) throw subErr;

      // 3. Merge data
      const subMap = new Map((subRes ?? []).map(s => [s.student_id, s]));
      const studentsMap = new Map();

      // Start with enrolled students
      (enrollRes ?? []).forEach(e => {
        const student = e.students as any;
        if (student) {
          studentsMap.set(student.id, {
            ...student,
            submission: subMap.get(student.id) || null
          });
        }
      });

      // Add any students who submitted but are NOT currently in the enrollment list
      (subRes ?? []).forEach(s => {
        if (!studentsMap.has(s.student_id)) {
          const student = s.students as any;
          if (student) {
            studentsMap.set(s.student_id, {
              ...student,
              submission: s
            });
          }
        }
      });

      setSubmissions(Array.from(studentsMap.values()));
    } catch (err: any) {
      console.error('Error loading submissions:', err);
      alert('Error loading submissions: ' + err.message);
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function handleGrade() {
    if (!selectedSubmission || !selectedForSubmissions) return;
    setGrading(true);
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: parseFloat(gradingForm.score),
          feedback: gradingForm.feedback,
          status: 'graded'
        })
        .eq('id', selectedSubmission.submission.id);

      if (error) throw error;
      
      setShowGradingModal(false);
      loadSubmissions(selectedForSubmissions);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGrading(false);
    }
  }

  async function handleEdit(a: any) {
    setEditingAssignment(a);
    await loadSubjectsForClass(a.class_id);
    setForm({
      title: a.title,
      description: a.description || '',
      class_id: a.class_id,
      subject_id: a.subject_id,
      due_date: new Date(a.due_date).toISOString().slice(0, 16),
      max_score: a.max_score.toString(),
      status: a.status,
      source_url: a.source_url || '',
      file_url: a.file_url || ''
    });
    setSaveError('');
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this assignment? All submissions will also be deleted.')) return;
    try {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSave() {
    if (!form.title || !form.class_id || !form.subject_id || !form.due_date) {
      setSaveError('Title, Class, Subject, and Due Date are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    
    const payload = {
      ...form,
      max_score: parseFloat(form.max_score),
      teacher_id: profile?.id,
      term_id: currentTermId || null,
    };

    let res;
    if (editingAssignment) {
      res = await supabase.from('assignments').update(payload).eq('id', editingAssignment.id);
    } else {
      res = await supabase.from('assignments').insert(payload);
    }

    if (res.error) { 
      setSaveError(res.error.message); 
      setSaving(false); 
      return; 
    }
    setShowModal(false);
    setEditingAssignment(null);
    setForm({ title: '', description: '', class_id: '', subject_id: '', due_date: '', max_score: '100', status: 'active', source_url: '', file_url: '' });
    loadData();
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `assignments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      setForm(prev => ({ ...prev, file_url: publicUrl }));
    } catch (err: any) {
      setSaveError(err.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  }

  const statusColors: Record<string, any> = { active: 'success', closed: 'default', draft: 'warning' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">Assignments</h2>
          <p className="text-slate-500 text-xs sm:text-sm hidden sm:block">Create and manage student assignments</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setSaveError(''); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-emerald-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Assignment</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No assignments created yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {assignments.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{a.title}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{(a.classes as any)?.name || `${(a.classes as any)?.level}${(a.classes as any)?.section}`} · {(a.subjects as any)?.name}</p>
                </div>
                <Badge label={a.status} variant={statusColors[a.status]} />
              </div>
              {a.description && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{a.description}</p>}
              
              {(a.source_url || a.file_url) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {a.source_url && (
                    <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-medium hover:bg-blue-100 transition-colors">
                      <LinkIcon className="w-3 h-3" /> Source URL
                    </a>
                  )}
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-medium hover:bg-amber-100 transition-colors">
                      <FileText className="w-3 h-3" /> Attachment
                    </a>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Due: {new Date(a.due_date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Max: {a.max_score} pts</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(a)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Assignment">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Assignment">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => loadSubmissions(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg font-medium transition-colors border border-slate-100"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Submissions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingAssignment(null); }} title={editingAssignment ? 'Edit Assignment' : 'New Assignment'} size="md">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select value={form.class_id} onChange={e => { setForm({...form, class_id: e.target.value, subject_id: ''}); loadSubjectsForClass(e.target.value); }} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                <option value="">Select class</option>
                {classes.map(c => <option key={(c as any)?.id} value={(c as any)?.id}>{(c as any)?.name || `${(c as any)?.level}${(c as any)?.section}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <select value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                <option value="">Select subject</option>
                {subjects.map(s => <option key={(s as any)?.id} value={(s as any)?.id}>{(s as any)?.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
              <input type="number" value={form.max_score} onChange={e => setForm({...form, max_score: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Additional Resources</label>
            <div className="space-y-3">
              <div>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="url" 
                    value={form.source_url} 
                    onChange={e => setForm({...form, source_url: e.target.value})} 
                    placeholder="Source URL (Optional)"
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-xl transition-all cursor-pointer ${form.file_url ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                    <Upload className="w-4 h-4" />
                    <span className="text-xs font-medium">{uploading ? 'Uploading...' : form.file_url ? 'Attachment Uploaded' : 'Upload File Attachment (Optional)'}</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  {form.file_url && (
                    <button onClick={() => setForm({...form, file_url: ''})} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {form.file_url && <p className="text-[10px] text-emerald-600 mt-1 truncate px-1">File ready to be attached.</p>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditingAssignment(null); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-all">
              {saving ? 'Saving...' : editingAssignment ? 'Update Assignment' : 'Create Assignment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Submissions List Modal */}
      <Modal isOpen={showSubmissionsModal} onClose={() => setShowSubmissionsModal(false)} title={`Submissions: ${selectedForSubmissions?.title}`} size="lg">
        <div className="space-y-4">
          {loadingSubmissions ? (
            <div className="text-center py-12 text-slate-400">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <p className="text-center py-8 text-slate-500 text-sm">No students found in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Admission No</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {submissions.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">{s.first_name} {s.last_name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.admission_number || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {s.submission?.status === 'graded' ? (
                          <span className="text-sm font-bold text-emerald-600">{s.submission.score}/{selectedForSubmissions.max_score}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          {s.submission?.status === 'graded' ? (
                            <Badge label="Graded" variant="success" icon={Check} />
                          ) : s.submission?.status === 'submitted' ? (
                            <Badge label="Submitted" variant="info" icon={Clock} />
                          ) : (
                            <Badge label="Pending" variant="default" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.submission ? (
                          <button 
                            onClick={() => {
                              setSelectedSubmission(s);
                              setGradingForm({ 
                                score: s.submission.score?.toString() || '', 
                                feedback: s.submission.feedback || '' 
                              });
                              setShowGradingModal(true);
                            }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title={s.submission.status === 'graded' ? 'Edit Grade' : 'Grade Now'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Grading Modal */}
      <Modal isOpen={showGradingModal} onClose={() => setShowGradingModal(false)} title={`Grade Submission: ${selectedSubmission?.first_name}`} size="md">
        <div className="space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student Submission</h4>
            {selectedSubmission?.submission?.submission_text && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{selectedSubmission.submission.submission_text}</p>
            )}
            {selectedSubmission?.submission?.file_url ? (
              <a 
                href={selectedSubmission.submission.file_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 w-fit px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              >
                <FileText className="w-4 h-4 text-emerald-500" />
                View/Download Attachment
                <ExternalLink className="w-3.5 h-3.5 ml-1 text-slate-400" />
              </a>
            ) : (
              <p className="text-xs text-slate-400 italic">No file attachment provided.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Award Score</label>
                <span className="text-xs text-slate-400 font-medium">Out of {selectedForSubmissions?.max_score} points</span>
              </div>
              <input 
                type="number" 
                value={gradingForm.score}
                onChange={e => setGradingForm({...gradingForm, score: e.target.value})}
                max={selectedForSubmissions?.max_score}
                placeholder="Enter score"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Feedback / Comments</label>
              <textarea 
                value={gradingForm.feedback}
                onChange={e => setGradingForm({...gradingForm, feedback: e.target.value})}
                rows={4}
                placeholder="Provide feedback to the student..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowGradingModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button 
              onClick={handleGrade} 
              disabled={grading || !gradingForm.score}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20"
            >
              {grading ? 'Saving...' : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Grade
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

