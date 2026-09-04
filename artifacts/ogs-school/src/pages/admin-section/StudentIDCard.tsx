import { useEffect, useState } from 'react';
import { Plus, Trash2, CreditCard as Edit2, CreditCard, Users, ChevronLeft, Printer, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import Modal from '../../components/common/Modal';
import StudentIDCardPrint from '../../components/print/StudentIDCardPrint';

type View = 'templates' | 'generate' | 'print';

function getDefaultCard(schoolName: string) {
  return {
    title: `${schoolName} Student Identity Card 2025/2026`,
    logo_url: '/default-logo.png',
    designation: 'Principal',
    signature_url: '',
    background_color: '#ffffff',
    accent_color: '#1a3a5c',
    header_text: schoolName,
    footer_text: '',
  };
}

export default function StudentIDCard() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const defaultCard = getDefaultCard(settings.school_name || 'Your School Name');
  const [view, setView] = useState<View>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: '', logo_url: '', designation: '', signature_url: '', background_color: '#ffffff', accent_color: '#1a3a5c', header_text: '', footer_text: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [genTemplate, setGenTemplate] = useState('');
  const [genClass, setGenClass] = useState('');
  const [genYear, setGenYear] = useState('2025/2026');
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const [printData, setPrintData] = useState<any[] | null>(null);

  useEffect(() => { loadTemplates(); loadClasses(); loadCurrentYear(); }, [profile]);

  async function loadCurrentYear() {
    const { data } = await supabase.from('academic_years').select('name').eq('school_id', profile?.school_id ?? '').eq('is_current', true).maybeSingle();
    if (data?.name) setGenYear(data.name);
  }

  async function loadTemplates() {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data } = await supabase.from('student_id_cards').select('*').eq('school_id', profile.school_id).order('title');
    if ((data ?? []).length === 0) {
      await seedDefault();
    } else {
      setTemplates(data ?? []);
    }
    setLoading(false);
  }

  async function seedDefault() {
    if (!profile?.school_id) return;
    const { data } = await supabase.from('student_id_cards').insert({
      ...defaultCard,
      school_id: profile.school_id,
    }).select('*');
    setTemplates(data ?? []);
  }

  async function loadClasses() {
    if (!profile?.school_id) return;
    const { data } = await supabase.from('classes').select('*').eq('school_id', profile.school_id).order('level').order('section');
    setClasses(data ?? []);
  }

  async function loadStudentsForClass(classId: string) {
    setGenLoading(true);
    const cls = classes.find(c => c.id === classId);
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, gender, date_of_birth, address, guardian_phone')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('first_name');
    setStudents((data ?? []).map(s => ({
      ...s,
      student_id: s.admission_number,
      class_name: cls ? (cls.name || `${cls.level}${cls.section}`) : '',
    })));
    setSelectedStudents(new Set());
    setGenLoading(false);
  }

  useEffect(() => { if (genClass) loadStudentsForClass(genClass); else setStudents([]); }, [genClass, classes]);

  function openAdd() {
    setEditItem(null);
    setForm({ title: '', logo_url: '/default-logo.png', designation: 'Principal', signature_url: '', background_color: '#ffffff', accent_color: '#1a3a5c', header_text: '', footer_text: '' });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(item: any) {
    setEditItem(item);
    setForm({ title: item.title, logo_url: item.logo_url ?? '', designation: item.designation ?? '', signature_url: item.signature_url ?? '', background_color: item.background_color ?? '#ffffff', accent_color: item.accent_color ?? '#1a3a5c', header_text: item.header_text ?? '', footer_text: item.footer_text ?? '' });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!profile?.school_id) return;
    setSaving(true);
    const payload = { ...form };
    if (editItem) {
      const res = await supabase.from('student_id_cards').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id);
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    } else {
      const res = await supabase.from('student_id_cards').insert({ ...payload, school_id: profile.school_id });
      if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    }
    setShowModal(false);
    const { data } = await supabase.from('student_id_cards').select('*').eq('school_id', profile.school_id).order('title');
    setTemplates(data ?? []);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ID card template?')) return;
    await supabase.from('student_id_cards').delete().eq('id', id);
    const { data } = await supabase.from('student_id_cards').select('*').eq('school_id', profile!.school_id).order('title');
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
    const selected = students.filter(s => selectedStudents.has(s.id));
    setPrintData(selected);
    setView('print');
  }

  const selectedTemplate = templates.find(t => t.id === genTemplate);
  const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

  if (view === 'print' && printData) {
    return (
      <StudentIDCardPrint
        students={printData}
        academicYear={genYear}
        onClose={() => { setPrintData(null); setView('generate'); }}
      />
    );
  }

  if (view === 'generate') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('templates')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft className="w-5 h-5 text-app-text-muted" /></button>
          <div>
            <h2 className="text-xl font-bold text-app-text">Generate ID Cards</h2>
            <p className="text-app-text-muted text-sm">Select a template and class to generate ID cards</p>
          </div>
        </div>

        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm p-5 flex flex-wrap gap-3">
          <select value={genTemplate} onChange={e => setGenTemplate(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-app-surface min-w-[220px]">
            <option value="">Select ID Card Template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select value={genClass} onChange={e => setGenClass(e.target.value)} className="border border-app-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-app-surface min-w-[160px]">
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name || `${c.level}${c.section}`}</option>)}
          </select>
        </div>

        {selectedTemplate && genClass && (
          <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-app-border">
              <p className="font-semibold text-app-text text-sm">Students — {selectedTemplate.title}</p>
              {students.length > 0 && (
                <div className="flex items-center gap-3">
                  <button onClick={toggleAll} className="text-sm text-emerald-600 hover:underline">{selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}</button>
                  {selectedStudents.size > 0 && (
                    <button onClick={handleGenerate} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                      <Printer className="w-4 h-4" /> Print {selectedStudents.size} Card{selectedStudents.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>
            {genLoading ? (
              <p className="text-center py-8 text-app-text-muted">Loading students...</p>
            ) : students.length === 0 ? (
              <p className="text-center py-8 text-app-text-muted">No students found in this class</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-app-border bg-app-surface-alt">
                    <th className="w-12 px-5 py-3"><input type="checkbox" checked={selectedStudents.size === students.length && students.length > 0} onChange={toggleAll} className="rounded" /></th>
                    <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Student</th>
                    <th className="text-left text-xs font-semibold text-app-text-muted uppercase px-5 py-3">Admission No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-app-surface-alt cursor-pointer" onClick={() => toggleStudent(s.id)}>
                      <td className="px-5 py-3"><input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudent(s.id)} className="rounded" onClick={e => e.stopPropagation()} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-app-text-muted">{s.first_name?.[0]}{s.last_name?.[0]}</div>
                          <p className="text-sm font-medium text-app-text">{s.first_name} {s.last_name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-app-text-muted font-mono">{s.admission_number || '—'}</td>
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
          <h2 className="text-xl font-bold text-app-text">Student ID Cards</h2>
          <p className="text-app-text-muted text-sm">Manage ID card templates and generate cards for students</p>
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
        <div className="text-center py-12 text-app-text-muted">Loading templates...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden group">
              <div className="h-28 flex items-center justify-center relative p-4" style={{ backgroundColor: t.background_color || '#f8fafc', borderBottom: `3px solid ${t.accent_color || '#1a3a5c'}` }}>
                {t.logo_url ? (
                  <img src={t.logo_url} alt="" className="h-14 w-auto object-contain" />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: t.accent_color || '#1a3a5c' }}>
                    <CreditCard className="w-7 h-7 text-white" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="p-1.5 bg-app-surface/90 rounded-lg shadow-sm text-app-text-muted hover:text-app-text"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 bg-app-surface/90 rounded-lg shadow-sm text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {t.title === defaultCard.title && (
                  <div className="absolute top-2 left-2">
                    <span className="flex items-center gap-1 text-xs bg-app-surface/90 text-emerald-600 font-semibold px-2 py-0.5 rounded-full shadow-sm">
                      <Sparkles className="w-3 h-3" /> Default Template
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-app-text text-sm">{t.title}</p>
                {t.designation && <p className="text-xs text-app-text-muted mt-0.5">{t.designation}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 rounded-full border border-app-border" style={{ backgroundColor: t.background_color }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.accent_color }} />
                  {t.signature_url && <span className="text-xs text-app-text-muted">With signature</span>}
                </div>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit ID Card Template' : 'Add ID Card Template'} size="md">
        <div className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Card Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="e.g. Student Identity Card 2025/2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Logo URL</label>
              <input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} className={inputCls} placeholder="/default-logo.png" />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Designation</label>
              <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className={inputCls} placeholder="Principal" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text mb-1">Signature URL</label>
            <input value={form.signature_url} onChange={e => setForm({ ...form, signature_url: e.target.value })} className={inputCls} placeholder="/signature.png" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Background Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.background_color} onChange={e => setForm({ ...form, background_color: e.target.value })} className="w-10 h-10 rounded-lg border border-app-border cursor-pointer p-0.5" />
                <input value={form.background_color} onChange={e => setForm({ ...form, background_color: e.target.value })} className="flex-1 border border-app-border rounded-xl px-3 py-2 text-xs focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text mb-1">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} className="w-10 h-10 rounded-lg border border-app-border cursor-pointer p-0.5" />
                <input value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} className="flex-1 border border-app-border rounded-xl px-3 py-2 text-xs focus:outline-none" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-app-border text-app-text rounded-xl text-sm font-medium hover:bg-app-surface-alt">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editItem ? 'Update' : 'Add Template'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
