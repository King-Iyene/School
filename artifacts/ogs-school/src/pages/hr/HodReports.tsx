import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { Plus, FileText, AlertCircle, Copy, CheckCircle, Eye, X, Upload, Paperclip, Download } from 'lucide-react';
import { createPortal } from 'react-dom';

const SQL_SETUP = `-- 1. Run in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS hod_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  department text NOT NULL,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'academic',
  period text NOT NULL,
  content text NOT NULL,
  attachment_url text,
  attachment_name text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_access" ON hod_reports
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- 2. In Supabase Dashboard → Storage → Create bucket:
--    Bucket name: hod-reports
--    Public: YES (toggle on)`;

const ic = 'border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-app-primary/30 w-full bg-app-surface';

const REPORT_TYPES = ['Academic', 'Activity', 'Disciplinary', 'Financial', 'Infrastructure', 'Other'];
const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-amber-100 text-amber-700',
  acknowledged: 'bg-emerald-100 text-emerald-700',
};

interface HodReport {
  id: string;
  submitted_by: string;
  department: string;
  title: string;
  report_type: string;
  period: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  status: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string; role: string } | null;
}

export default function HodReports() {
  const { profile, user } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'principal', 'head_teacher'].includes(profile?.role || '');
  const canSubmit = ['head_teacher', 'teacher', 'principal', 'super_admin', 'admin', 'nur_prim_teacher'].includes(profile?.role || '');

  const [reports, setReports] = useState<HodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewReport, setViewReport] = useState<HodReport | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    department: '',
    title: '',
    report_type: 'Academic',
    period: '',
    content: '',
  });

  useEffect(() => { fetchReports(); }, []);

  async function fetchReports() {
    setLoading(true);
    let q = supabase
      .from('hod_reports')
      .select('*, profiles(first_name, last_name, role)')
      .eq('school_id', profile?.school_id)
      .order('created_at', { ascending: false });
    if (!isAdmin) q = q.eq('submitted_by', user?.id);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      if (error.message?.toLowerCase().includes('relation') || error.code === '42P01') setShowSql(true);
    } else {
      setReports(data || []);
    }
  }

  function resetForm() {
    setForm({ department: '', title: '', report_type: 'Academic', period: '', content: '' });
    setSelectedFile(null);
    setSaveError('');
    setUploadProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadFile(file: File): Promise<{ url: string; name: string } | null> {
    const ext = file.name.split('.').pop();
    const path = `${profile?.school_id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    setUploadProgress('Uploading attachment…');
    const { data, error } = await supabase.storage.from('hod-reports').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      setUploadProgress('');
      if (error.message?.toLowerCase().includes('bucket') || error.message?.toLowerCase().includes('not found')) {
        setShowSql(true);
      }
      setSaveError(`Upload failed: ${error.message}`);
      return null;
    }
    const { data: urlData } = supabase.storage.from('hod-reports').getPublicUrl(data.path);
    setUploadProgress('');
    return { url: urlData.publicUrl, name: file.name };
  }

  async function save() {
    if (!form.department.trim()) { setSaveError('Department is required.'); return; }
    if (!form.title.trim()) { setSaveError('Report title is required.'); return; }
    if (!form.period.trim()) { setSaveError('Period is required.'); return; }
    if (!form.content.trim()) { setSaveError('Report content is required.'); return; }

    setSaving(true); setSaveError('');

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (selectedFile) {
      const result = await uploadFile(selectedFile);
      if (!result) { setSaving(false); return; }
      attachmentUrl = result.url;
      attachmentName = result.name;
    }

    const { error } = await supabase.from('hod_reports').insert({
      school_id: profile?.school_id,
      submitted_by: user?.id,
      department: form.department.trim(),
      title: form.title.trim(),
      report_type: form.report_type,
      period: form.period.trim(),
      content: form.content.trim(),
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      status: 'submitted',
    });
    setSaving(false);
    if (error) {
      if (error.message?.toLowerCase().includes('relation') || error.code === '42P01') setShowSql(true);
      setSaveError(error.message);
    } else {
      setModalOpen(false);
      resetForm();
      fetchReports();
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    await supabase.from('hod_reports').update({ status }).eq('id', id);
    setUpdatingId(null);
    fetchReports();
    if (viewReport?.id === id) setViewReport(r => r ? { ...r, status } : r);
  }

  function copySQL() {
    navigator.clipboard.writeText(SQL_SETUP).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-text">HOD Reports</h1>
          <p className="text-sm text-app-text-muted mt-0.5">
            {isAdmin ? 'View and acknowledge departmental reports from all HODs' : 'Submit your departmental reports via the portal'}
          </p>
        </div>
        {canSubmit && (
          <button onClick={() => { resetForm(); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors shadow-sm">
            <Plus size={16} /> Submit Report
          </button>
        )}
      </div>

      {showSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle size={16} /> Setup required — run the SQL below and create the storage bucket:
          </p>
          <pre className="bg-amber-100 rounded-xl p-3 text-xs overflow-x-auto text-amber-900 whitespace-pre-wrap">{SQL_SETUP}</pre>
          <div className="flex gap-3 mt-3">
            <button onClick={copySQL} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
              <Copy size={12} />{copied ? 'Copied!' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowSql(false)} className="text-amber-700 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-app-text-muted py-8">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> Loading…
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-app-surface rounded-2xl border border-app-border p-12 text-center text-app-text-muted">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No reports found.</p>
          {canSubmit && <p className="text-xs mt-1">Click "Submit Report" to submit your first departmental report.</p>}
        </div>
      ) : (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-surface-alt border-b border-app-border">
              <tr>
                {['Title', 'Department', 'Period', 'Type', isAdmin ? 'Submitted By' : '', 'Date', 'Attach', 'Status', 'Action'].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-app-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-app-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setViewReport(r)} className="text-emerald-700 hover:underline font-medium text-left">
                      {r.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-app-text-muted">{r.department}</td>
                  <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">{r.period}</td>
                  <td className="px-4 py-3 text-app-text-muted capitalize">{r.report_type}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-app-text-muted">
                      {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-app-text-muted text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {r.attachment_url ? (
                      <a href={r.attachment_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700" title={r.attachment_name || 'Attachment'}>
                        <Paperclip size={14} />
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status] || 'bg-slate-100 text-app-text-muted'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewReport(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-app-text-muted hover:text-app-text">
                        <Eye size={14} />
                      </button>
                      {isAdmin && r.status === 'submitted' && (
                        <button onClick={() => updateStatus(r.id, 'reviewed')} disabled={updatingId === r.id}
                          className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 disabled:opacity-50">
                          {updatingId === r.id ? '…' : 'Review'}
                        </button>
                      )}
                      {isAdmin && r.status === 'reviewed' && (
                        <button onClick={() => updateStatus(r.id, 'acknowledged')} disabled={updatingId === r.id}
                          className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 disabled:opacity-50">
                          {updatingId === r.id ? '…' : 'Acknowledge'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Submit Report Modal ──────────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Submit Departmental Report">
        <div className="space-y-4 p-1 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-app-text-muted mb-1 block">Department *</label>
              <input className={ic} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Mathematics, English" />
            </div>
            <div>
              <label className="text-xs text-app-text-muted mb-1 block">Report Type *</label>
              <select className={ic} value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
                {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Report Title *</label>
            <input className={ic} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. End of Term Academic Report — Mathematics Dept" />
          </div>
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Period (Term / Month / Year) *</label>
            <input className={ic} value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="e.g. First Term 2025/2026" />
          </div>
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Report Content *</label>
            <textarea className={ic} rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write your full report here..." />
          </div>

          {/* File Upload */}
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">
              Attach Document <span className="text-app-text-muted">(PDF, DOC, DOCX — optional)</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-app-border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors group"
            >
              <Upload size={20} className="text-app-text-muted group-hover:text-emerald-500" />
              {selectedFile ? (
                <div className="flex items-center gap-2">
                  <Paperclip size={14} className="text-emerald-600" />
                  <span className="text-sm text-emerald-700 font-medium">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-red-400 hover:text-red-600"
                  ><X size={14} /></button>
                </div>
              ) : (
                <span className="text-xs text-app-text-muted">Click to select a file</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>

          {uploadProgress && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              {uploadProgress}
            </div>
          )}
          {saveError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={13} />{saveError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-60">
              {saving ? 'Submitting…' : 'Submit Report'}
            </button>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-app-text rounded-xl text-sm font-medium">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── View Report Modal ────────────────────────────────────────────── */}
      {viewReport && createPortal(
<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewReport(null)}>
          <div className="bg-app-surface rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-app-border">
              <div>
                <h2 className="font-bold text-app-text">{viewReport.title}</h2>
                <p className="text-xs text-app-text-muted mt-0.5">{viewReport.department} · {viewReport.period} · {viewReport.report_type}</p>
              </div>
              <button onClick={() => setViewReport(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[viewReport.status] || ''}`}>{viewReport.status}</span>
                {viewReport.profiles && (
                  <span className="text-app-text-muted">Submitted by {viewReport.profiles.first_name} {viewReport.profiles.last_name}</span>
                )}
                <span className="text-app-text-muted text-xs">{new Date(viewReport.created_at).toLocaleString()}</span>
              </div>
              <div className="bg-app-surface-alt rounded-xl p-4 text-sm text-app-text whitespace-pre-wrap leading-relaxed">
                {viewReport.content}
              </div>
              {viewReport.attachment_url && (
                <a href={viewReport.attachment_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-app-text rounded-xl text-sm font-medium transition-colors">
                  <Download size={15} />
                  {viewReport.attachment_name || 'Download Attachment'}
                </a>
              )}
              {isAdmin && (
                <div className="flex gap-2 pt-2 border-t border-app-border">
                  {viewReport.status === 'submitted' && (
                    <button onClick={() => updateStatus(viewReport.id, 'reviewed')}
                      className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-200">
                      Mark as Reviewed
                    </button>
                  )}
                  {viewReport.status === 'reviewed' && (
                    <button onClick={() => updateStatus(viewReport.id, 'acknowledged')}
                      className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-200">
                      Acknowledge Report
                    </button>
                  )}
                  {viewReport.status === 'acknowledged' && (
                    <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                      <CheckCircle size={15} /> Report Acknowledged
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
      document.body
      )}
    </div>
  );
}
