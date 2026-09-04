import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, FileText, GraduationCap, Upload, ExternalLink, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/common/Modal';

interface Props { profileId: string; schoolId: string; }

const DOC_TYPES = [
  { value: 'cv', label: 'CV / Resume' },
  { value: 'degree', label: 'Degree Certificate' },
  { value: 'nysc', label: 'NYSC Certificate' },
  { value: 'olevel', label: "O'Level / WAEC / NECO" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'phd', label: 'PhD Certificate' },
  { value: 'pgde', label: 'PGDE Certificate' },
  { value: 'nce', label: 'NCE Certificate' },
  { value: 'professional', label: 'Professional Certificate' },
  { value: 'id', label: 'National ID / NIN' },
  { value: 'other', label: 'Other Document' },
];

const QUAL_TYPES = [
  { value: 'phd', label: 'PhD' },
  { value: 'masters', label: "Master's Degree" },
  { value: 'degree', label: "Bachelor's Degree" },
  { value: 'pgde', label: 'PGDE' },
  { value: 'nce', label: 'NCE' },
  { value: 'ond', label: 'OND' },
  { value: 'hnd', label: 'HND' },
  { value: 'waec', label: 'WAEC / SSCE' },
  { value: 'professional', label: 'Professional Cert' },
  { value: 'other', label: 'Other' },
];

const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export default function QualificationsTab({ profileId, schoolId }: Props) {
  const { profile: viewer } = useAuth();
  const isAdmin = viewer?.role === 'super_admin' || viewer?.role === 'admin' || viewer?.role === 'principal';
  const fileRef = useRef<HTMLInputElement>(null);

  const [quals, setQuals] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [showQualModal, setShowQualModal] = useState(false);
  const [editQual, setEditQual] = useState<any>(null);
  const [qualForm, setQualForm] = useState({ qualification_type: 'degree', title: '', institution: '', field_of_study: '', grade_class: '', year_obtained: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('cv');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => { load(); }, [profileId]);

  async function load() {
    const [qRes, dRes] = await Promise.all([
      supabase.from('staff_qualifications').select('*').eq('profile_id', profileId).order('year_obtained', { ascending: false }),
      supabase.from('staff_documents').select('*').eq('profile_id', profileId).order('uploaded_at', { ascending: false }),
    ]);
    setQuals(qRes.data ?? []);
    setDocs(dRes.data ?? []);
  }

  function openAddQual() {
    setEditQual(null);
    setQualForm({ qualification_type: 'degree', title: '', institution: '', field_of_study: '', grade_class: '', year_obtained: '' });
    setShowQualModal(true);
  }

  function openEditQual(q: any) {
    setEditQual(q);
    setQualForm({ qualification_type: q.qualification_type, title: q.title, institution: q.institution ?? '', field_of_study: q.field_of_study ?? '', grade_class: q.grade_class ?? '', year_obtained: q.year_obtained?.toString() ?? '' });
    setShowQualModal(true);
  }

  async function saveQual() {
    setSaving(true);
    const payload = { ...qualForm, year_obtained: qualForm.year_obtained ? parseInt(qualForm.year_obtained) : null, profile_id: profileId, school_id: schoolId };
    if (editQual) {
      await supabase.from('staff_qualifications').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editQual.id);
    } else {
      await supabase.from('staff_qualifications').insert(payload);
    }
    setSaving(false);
    setShowQualModal(false);
    load();
  }

  async function deleteQual(id: string) {
    if (!confirm('Remove this qualification?')) return;
    await supabase.from('staff_qualifications').delete().eq('id', id);
    load();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setUploadError('File must be under 20MB'); return; }
    setUploadError('');
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `staff/${profileId}/${uploadDocType}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('staff-documents').upload(path, file, { upsert: true });
    if (upErr) { setUploadError(upErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from('staff-documents').getPublicUrl(path);
    await supabase.from('staff_documents').insert({
      profile_id: profileId, school_id: schoolId,
      document_type: uploadDocType, file_name: file.name,
      file_url: data.publicUrl, file_size: file.size, description: uploadDesc,
    });
    setUploading(false);
    setUploadDesc('');
    load();
  }

  async function deleteDoc(id: string, fileUrl: string) {
    if (!confirm('Delete this document?')) return;
    const path = fileUrl.split('/storage/v1/object/public/staff-documents/')[1];
    if (path) await supabase.storage.from('staff-documents').remove([path]);
    await supabase.from('staff_documents').delete().eq('id', id);
    load();
  }

  const docTypeLabel = (t: string) => DOC_TYPES.find(d => d.value === t)?.label ?? t;

  return (
    <div className="space-y-5">
      {/* Qualifications */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center justify-between">
          <h4 className="font-bold text-app-text flex items-center gap-2 text-sm"><GraduationCap className="w-4 h-4 text-emerald-600" />Academic & Professional Qualifications</h4>
          {isAdmin && <button onClick={openAddQual} className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium"><Plus className="w-3 h-3" />Add</button>}
        </div>
        {quals.length === 0 ? (
          <div className="text-center py-8 text-app-text-muted text-sm">No qualifications recorded yet</div>
        ) : (
          <div className="divide-y divide-app-border">
            {quals.map(q => (
              <div key={q.id} className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-app-surface-alt">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-app-text">{q.title}</p>
                    <p className="text-xs text-app-text-muted">{QUAL_TYPES.find(t => t.value === q.qualification_type)?.label} {q.field_of_study ? `— ${q.field_of_study}` : ''}</p>
                    {q.institution && <p className="text-xs text-app-text-muted mt-0.5">{q.institution}{q.grade_class ? ` · ${q.grade_class}` : ''}{q.year_obtained ? ` · ${q.year_obtained}` : ''}</p>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditQual(q)} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg"><FileText className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteQual(q.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border">
          <h4 className="font-bold text-app-text flex items-center gap-2 text-sm mb-3"><FileText className="w-4 h-4 text-emerald-600" />Documents & Certificates</h4>
          {isAdmin && (
            <div className="bg-app-surface-alt rounded-xl p-3 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-32">
                <label className="block text-xs font-semibold text-app-text-muted mb-1">Document Type</label>
                <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} className={`${inputCls} bg-app-surface`}>
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-32">
                <label className="block text-xs font-semibold text-app-text-muted mb-1">Description (optional)</label>
                <input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} className={inputCls} placeholder="e.g. 2018 - University of Port Harcourt" />
              </div>
              <div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                  <Upload className="w-4 h-4" />{uploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
              {uploadError && <p className="w-full text-xs text-red-600 flex items-center gap-1"><X className="w-3 h-3" />{uploadError}</p>}
            </div>
          )}
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-8 text-app-text-muted text-sm">No documents uploaded yet</div>
        ) : (
          <div className="divide-y divide-app-border">
            {docs.map(d => (
              <div key={d.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-app-surface-alt">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-app-text">{d.file_name}</p>
                    <p className="text-xs text-app-text-muted">{docTypeLabel(d.document_type)}{d.description ? ` · ${d.description}` : ''} · {new Date(d.uploaded_at).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a>
                  {isAdmin && <button onClick={() => deleteDoc(d.id, d.file_url)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showQualModal} onClose={() => setShowQualModal(false)} title={editQual ? 'Edit Qualification' : 'Add Qualification'} size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Type</label>
              <select value={qualForm.qualification_type} onChange={e => setQualForm({ ...qualForm, qualification_type: e.target.value })} className={`${inputCls} bg-app-surface`}>
                {QUAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Year Obtained</label>
              <input type="number" min={1950} max={new Date().getFullYear()} value={qualForm.year_obtained} onChange={e => setQualForm({ ...qualForm, year_obtained: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Title / Award *</label>
            <input value={qualForm.title} onChange={e => setQualForm({ ...qualForm, title: e.target.value })} className={inputCls} placeholder="e.g. B.Sc. Computer Science" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Institution</label>
            <input value={qualForm.institution} onChange={e => setQualForm({ ...qualForm, institution: e.target.value })} className={inputCls} placeholder="University / School name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Field of Study</label>
              <input value={qualForm.field_of_study} onChange={e => setQualForm({ ...qualForm, field_of_study: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-muted uppercase mb-1">Class / Grade</label>
              <input value={qualForm.grade_class} onChange={e => setQualForm({ ...qualForm, grade_class: e.target.value })} className={inputCls} placeholder="First Class, Distinction..." />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowQualModal(false)} className="flex-1 border border-app-border text-app-text rounded-xl py-2 text-sm hover:bg-app-surface-alt">Cancel</button>
            <button onClick={saveQual} disabled={saving || !qualForm.title} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : editQual ? 'Update' : 'Add Qualification'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
