import { useEffect, useState } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Award, Users, ChevronLeft, Printer, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import CertificateTemplate from '../../components/print/CertificateTemplate';

type CertType = 'graduation' | 'excellence' | 'participation' | 'merit' | 'custom';
type View = 'templates' | 'generate' | 'print';

const DEFAULT_CERTIFICATES = [
  { name: 'Certificate of Graduation', cert_type: 'graduation', description: 'Awarded to graduating students who have successfully completed the prescribed course of study.' },
  { name: 'Certificate of Excellence', cert_type: 'excellence', description: 'Awarded for outstanding academic performance and exceptional scholarly achievement.' },
  { name: 'Certificate of Participation', cert_type: 'participation', description: 'Awarded to students for active participation in school activities and programmes.' },
  { name: 'Certificate of Merit', cert_type: 'merit', description: 'Awarded in recognition of outstanding conduct, diligence, and commitment to excellence.' },
  { name: 'Certificate of Achievement', cert_type: 'custom', description: 'Awarded for distinguished achievement and exemplary commitment to learning.' },
];

export default function StudentCertificate() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [view, setView] = useState<View>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', cert_type: 'custom', description: '', header_text: '', footer_text: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [genTemplate, setGenTemplate] = useState('');
  const [genClass, setGenClass] = useState('');
  const [genYear, setGenYear] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const [printQueue, setPrintQueue] = useState<any[]>([]);
  const [printIdx, setPrintIdx] = useState(0);

  useEffect(() => { loadTemplates(); loadClasses(); loadYears(); }, [profile]);

  async function loadYears() {
    const { data } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
    setAcademicYears(data ?? []);
    const current = (data ?? []).find((y: any) => y.is_current);
    setGenYear(current?.id ?? data?.[0]?.id ?? '');
  }

  async function loadTemplates() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase.from('student_certificates').select('*').eq('school_id', profile.school_id).order('name');
    if ((data ?? []).length === 0) {
      await seedDefaults();
    } else {
      setTemplates(data ?? []);
    }
    setLoading(false);
  }

  async function seedDefaults() {
    if (!profile?.school_id) return;
    const inserts = DEFAULT_CERTIFICATES.map(d => ({
      school_id: profile.school_id,
      name: d.name,
      cert_type: d.cert_type,
      description: d.description,
      background_image_url: '/ogs_logo_bg.png',
      header_text: settings.school_name || 'Your School Name',
      footer_text: settings.motto ? `"${settings.motto}"` : '',
    }));
    const { data } = await supabase.from('student_certificates').insert(inserts).select('*');
    setTemplates(data ?? []);
  }

  async function loadClasses() {
    if (!profile?.school_id) return;
    const { data } = await supabase.from('classes').select('*').eq('school_id', profile.school_id).order('level').order('section');
    setClasses(data ?? []);
  }

  async function loadStudentsForClass(classId: string) {
    setGenLoading(true);
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('first_name');
    setStudents(data ?? []);
    setSelectedStudents(new Set());
    setGenLoading(false);
  }

  useEffect(() => { if (genClass) loadStudentsForClass(genClass); else setStudents([]); }, [genClass]);

  function openAdd() {
    setEditItem(null);
    setForm({ name: '', cert_type: 'custom', description: '', header_text: '', footer_text: '' });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({
      name: item.name,
      cert_type: item.cert_type ?? 'custom',
      description: item.description ?? '',
      header_text: item.header_text ?? '',
      footer_text: item.footer_text ?? '',
    });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      cert_type: form.cert_type,
      description: form.description,
      header_text: form.header_text,
      footer_text: form.footer_text,
      background_image_url: '/ogs_logo_bg.png',
    };
    if (editItem) {
      const res = await supabase.from('student_certificates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('student_certificates').insert({ ...payload, school_id: profile.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setShowModal(false);
    const { data } = await supabase.from('student_certificates').select('*').eq('school_id', profile.school_id).order('name');
    setTemplates(data ?? []);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this certificate template?')) return;
    await supabase.from('student_certificates').delete().eq('id', id);
    const { data } = await supabase.from('student_certificates').select('*').eq('school_id', profile!.school_id).order('name');
    setTemplates(data ?? []);
  }

  function toggleStudent(id: string) {
    setSelectedStudents(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAll() {
    if (selectedStudents.size === students.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map((s: any) => s.id)));
  }

  function handleGenerate() {
    const tmpl = templates.find(t => t.id === genTemplate);
    if (!tmpl) return;
    const cls = classes.find(c => c.id === genClass);
    const yr = academicYears.find(y => y.id === genYear);
    const selected = students.filter(s => selectedStudents.has(s.id));
    const queue = selected.map(s => ({
      studentName: `${s.first_name} ${s.last_name}`,
      className: cls?.name ?? `${cls?.level}${cls?.section}`,
      academicYear: yr?.name,
      type: (tmpl.cert_type ?? 'custom') as CertType,
    }));
    setPrintQueue(queue);
    setPrintIdx(0);
    setView('print');
  }

  const selectedTemplate = templates.find(t => t.id === genTemplate);
  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

  const CERT_TYPE_LABELS: Record<string, string> = {
    graduation: 'Graduation', excellence: 'Excellence', participation: 'Participation', merit: 'Merit', custom: 'Achievement',
  };

  const CERT_COLORS: Record<string, string> = {
    graduation: 'from-blue-50 to-blue-100',
    excellence: 'from-amber-50 to-amber-100',
    participation: 'from-green-50 to-green-100',
    merit: 'from-rose-50 to-rose-100',
    custom: 'from-slate-50 to-slate-100',
  };

  const CERT_ICON_COLORS: Record<string, string> = {
    graduation: 'text-blue-400', excellence: 'text-amber-400', participation: 'text-green-400', merit: 'text-rose-400', custom: 'text-slate-400',
  };

  if (view === 'print' && printQueue.length > 0) {
    const current = printQueue[printIdx];
    return (
      <CertificateTemplate
        type={current.type}
        studentName={current.studentName}
        className={current.className}
        academicYear={current.academicYear}
        onClose={() => {
          if (printIdx < printQueue.length - 1) {
            setPrintIdx(printIdx + 1);
          } else {
            setView('generate');
            setPrintQueue([]);
            setPrintIdx(0);
          }
        }}
      />
    );
  }

  if (view === 'generate') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('templates')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Generate Certificates</h2>
            <p className="text-slate-500 text-sm">Select a template and class to issue certificates</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap gap-3">
          <select value={genTemplate} onChange={e => setGenTemplate(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white min-w-[220px]">
            <option value="">Select Certificate Template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={genClass} onChange={e => setGenClass(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white min-w-[160px]">
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
          </select>
          <select value={genYear} onChange={e => setGenYear(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white min-w-[160px]">
            <option value="">Select Academic Year</option>
            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </div>

        {selectedTemplate && genClass && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800 text-sm">Students — {selectedTemplate.name}</p>
              {students.length > 0 && (
                <div className="flex items-center gap-3">
                  <button onClick={toggleAll} className="text-sm text-emerald-600 hover:underline">{selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}</button>
                  {selectedStudents.size > 0 && (
                    <button onClick={handleGenerate} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                      <Printer className="w-4 h-4" /> Print {selectedStudents.size} Certificate{selectedStudents.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>
            {genLoading ? (
              <p className="text-center py-8 text-slate-400">Loading students...</p>
            ) : students.length === 0 ? (
              <p className="text-center py-8 text-slate-400">No students found in this class</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-12 px-5 py-3"><input type="checkbox" checked={selectedStudents.size === students.length && students.length > 0} onChange={toggleAll} className="rounded" /></th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Student</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Admission No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleStudent(s.id)}>
                      <td className="px-5 py-3"><input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudent(s.id)} className="rounded" onClick={e => e.stopPropagation()} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">{s.first_name?.[0]}{s.last_name?.[0]}</div>
                          <p className="text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500 font-mono">{s.admission_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Student Certificates</h2>
          <p className="text-slate-500 text-sm">Manage certificate templates and generate for students</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('generate')} className="flex items-center gap-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Users className="w-4 h-4" /> Generate
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
              <div className={`h-28 bg-gradient-to-br ${CERT_COLORS[t.cert_type] ?? 'from-slate-50 to-slate-100'} flex items-center justify-center relative`}>
                <div className="text-center">
                  <Award className={`w-10 h-10 mx-auto mb-1 ${CERT_ICON_COLORS[t.cert_type] ?? 'text-slate-400'}`} />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{CERT_TYPE_LABELS[t.cert_type] ?? 'Certificate'}</div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="p-1.5 bg-white/90 rounded-lg shadow-sm text-slate-600 hover:text-slate-800"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 bg-white/90 rounded-lg shadow-sm text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {DEFAULT_CERTIFICATES.some(d => d.name === t.name) && (
                  <div className="absolute top-2 left-2">
                    <span className="flex items-center gap-1 text-xs bg-white/90 text-emerald-600 font-semibold px-2 py-0.5 rounded-full shadow-sm">
                      <Sparkles className="w-3 h-3" /> Default Template
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                {t.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
                <button
                  onClick={() => { setGenTemplate(t.id); setView('generate'); }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 hover:bg-emerald-50 py-1.5 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Use This Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Certificate Template' : 'Add Certificate Template'} size="md">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Certificate Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Certificate of Excellence" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Certificate Type *</label>
            <select value={form.cert_type} onChange={e => setForm({ ...form, cert_type: e.target.value })} className={inputCls}>
              <option value="graduation">Graduation</option>
              <option value="excellence">Excellence</option>
              <option value="participation">Participation</option>
              <option value="merit">Merit</option>
              <option value="custom">Achievement (Custom)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Header Text</label>
            <input value={form.header_text} onChange={e => setForm({ ...form, header_text: e.target.value })} className={inputCls} placeholder="Your School Name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Footer Text</label>
            <input value={form.footer_text} onChange={e => setForm({ ...form, footer_text: e.target.value })} className={inputCls} placeholder='"Perseverantia Vincit"' />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editItem ? 'Update' : 'Add Template'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
