import { useEffect, useState } from 'react';
import { ClipboardList, Calendar, Link as LinkIcon, FileText, Upload, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function StudentAssignments() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissionForm, setSubmissionForm] = useState({ text: '', file_url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.id) loadAssignments();
  }, [profile]);

  async function loadAssignments() {
    setLoading(true);
    try {
      // 1. Get student's class
      const { data: enrollData } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .eq('student_id', profile!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!enrollData?.class_id) {
        setAssignments([]);
        return;
      }

      // 2. Get assignments for that class
      const { data: assignData } = await supabase
        .from('assignments')
        .select('*, subjects(name), classes(name, level, section)')
        .eq('class_id', enrollData.class_id)
        .eq('status', 'active')
        .order('due_date', { ascending: true });

      // 3. Get student's submissions
      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('student_id', profile!.id);

      const subMap = new Map(subData?.map(s => [s.assignment_id, s]));
      
      const merged = (assignData ?? []).map(a => ({
        ...a,
        submission: subMap.get(a.id) || null
      }));

      setAssignments(merged);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id || !selectedAssignment) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedAssignment.id}-${profile.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `submissions/${selectedAssignment.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      setSubmissionForm(prev => ({ ...prev, file_url: publicUrl }));
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!submissionForm.text && !submissionForm.file_url) {
      setError('Please provide a response or upload a file.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { error: subErr } = await supabase
        .from('assignment_submissions')
        .upsert({
          assignment_id: selectedAssignment.id,
          student_id: profile!.id,
          submission_text: submissionForm.text,
          file_url: submissionForm.file_url,
          submitted_at: new Date().toISOString(),
          status: 'submitted'
        }, { 
          onConflict: 'assignment_id,student_id' 
        });

      if (subErr) throw subErr;

      setShowModal(false);
      setSelectedAssignment(null);
      setSubmissionForm({ text: '', file_url: '' });
      loadAssignments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusBadge(a: any) {
    if (a.submission?.status === 'graded') return <Badge label="Graded" variant="success" icon={CheckCircle2} />;
    if (a.submission?.status === 'submitted') return <Badge label="Submitted" variant="info" icon={Clock} />;
    
    const isOverdue = new Date(a.due_date) < new Date();
    if (isOverdue) return <Badge label="Overdue" variant="error" icon={AlertCircle} />;
    return <Badge label="Pending" variant="warning" icon={Clock} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Assignments</h2>
          <p className="text-slate-500 text-sm">View and submit your class assignments</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No assignments found for your class</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {assignments.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{a.title}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{(a.subjects as any)?.name}</p>
                </div>
                {getStatusBadge(a)}
              </div>
              
              {a.description && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{a.description}</p>}

              {(a.source_url || a.file_url) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {a.source_url && (
                    <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-medium hover:bg-blue-100">
                      <LinkIcon className="w-3 h-3" /> Resource Link
                    </a>
                  )}
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-medium hover:bg-amber-100">
                      <FileText className="w-3 h-3" /> Attachment
                    </a>
                  )}
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" /> Due: {new Date(a.due_date).toLocaleDateString()}
                  </span>
                  {a.submission?.score !== undefined && a.submission?.score !== null && (
                    <span className="text-xs font-bold text-emerald-600">Score: {a.submission.score}/{a.max_score}</span>
                  )}
                </div>

                <button 
                  onClick={() => {
                    setSelectedAssignment(a);
                    setSubmissionForm({
                      text: a.submission?.submission_text || '',
                      file_url: a.submission?.file_url || ''
                    });
                    setShowModal(true);
                  }}
                  disabled={a.submission?.status === 'graded'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    a.submission?.status === 'graded' 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : a.submission 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20'
                  }`}
                >
                  {a.submission?.status === 'graded' ? 'Assignment Graded' : a.submission ? 'Update Submission' : 'Submit Work'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={selectedAssignment?.title || "Submit Assignment"}
        size="md"
      >
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Submission Text</label>
            <textarea 
              value={submissionForm.text}
              onChange={e => setSubmissionForm({...submissionForm, text: e.target.value})}
              rows={4}
              placeholder="Enter your answers or comments here..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Upload File</label>
            <label className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${submissionForm.file_url ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
              <Upload className={`w-8 h-8 ${submissionForm.file_url ? 'text-emerald-500' : 'text-slate-300'}`} />
              <span className="text-sm font-medium">{uploading ? 'Uploading...' : submissionForm.file_url ? 'File Uploaded' : 'Drop your file or click to browse'}</span>
              <span className="text-[10px] text-slate-400">PDF, JPG, PNG, DOCX (Max 10MB)</span>
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            {submissionForm.file_url && (
              <div className="mt-2 flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-xs truncate">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 truncate">Submission Attachment</span>
                </div>
                <button onClick={() => setSubmissionForm({...submissionForm, file_url: ''})} className="text-red-500 hover:text-red-600 text-xs font-medium">Remove</button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button 
              onClick={handleSubmit} 
              disabled={submitting || uploading}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting...' : (
                <>
                  <Send className="w-4 h-4" />
                  {selectedAssignment?.submission ? 'Update Submission' : 'Send Submission'}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
