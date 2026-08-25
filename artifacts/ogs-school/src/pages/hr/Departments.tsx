import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { Plus, Building2, AlertCircle, Copy, Users, Crown, X, Trash2, Edit2 } from 'lucide-react';

const SQL_SETUP = `-- Run once in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  hod_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, name)
);
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_access" ON departments
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

-- Add department column to staff profiles:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department text;`;

const ic = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

interface Department {
  id: string; name: string; description: string | null; hod_id: string | null;
  hod?: { first_name: string; last_name: string } | null;
}
interface StaffProfile {
  id: string; first_name: string; last_name: string; role: string; department: string | null;
}

export default function Departments() {
  const { profile } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'principal', 'head_teacher'].includes(profile?.role || '');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<Department | null>(null);
  const [assignStaffModal, setAssignStaffModal] = useState<Department | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [hodSearch, setHodSearch] = useState('');

  const [form, setForm] = useState({ name: '', description: '', hod_id: '' });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [dRes, sRes] = await Promise.all([
      supabase.from('departments')
        .select('*, hod:profiles!departments_hod_id_fkey(first_name,last_name)')
        .eq('school_id', profile?.school_id)
        .order('name'),
      supabase.from('profiles')
        .select('id,first_name,last_name,role,department')
        .eq('school_id', profile?.school_id)
        .in('role', ['super_admin','admin','principal','head_teacher','teacher','nur_prim_teacher','non_teaching_staff','matron','porter','cleaner','admin_support','accountant','security_officer'])
        .order('first_name'),
    ]);
    setLoading(false);
    if (dRes.error) {
      if (dRes.error.code === '42P01' || dRes.error.message?.includes('relation')) setShowSql(true);
      return;
    }
    setDepartments(dRes.data || []);
    setStaff(sRes.data || []);
  }

  async function saveDepartment(isEdit = false) {
    if (!form.name.trim()) { setSaveError('Department name is required.'); return; }
    setSaving(true); setSaveError('');
    const payload = {
      school_id: profile?.school_id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      hod_id: form.hod_id || null,
    };
    const { error } = isEdit && editModal
      ? await supabase.from('departments').update(payload).eq('id', editModal.id)
      : await supabase.from('departments').insert(payload);
    setSaving(false);
    if (error) {
      if (error.code === '23505') { setSaveError('A department with this name already exists.'); return; }
      setSaveError(error.message); return;
    }
    setCreateModal(false); setEditModal(null); setForm({ name: '', description: '', hod_id: '' });
    fetchAll();
  }

  async function deleteDepartment(id: string) {
    if (!confirm('Delete this department? Staff assigned to it will be unlinked.')) return;
    await supabase.from('departments').delete().eq('id', id);
    fetchAll();
  }

  async function assignStaff(staffId: string, deptName: string) {
    await supabase.from('profiles').update({ department: deptName }).eq('id', staffId);
    fetchAll();
  }

  async function removeFromDept(staffId: string) {
    await supabase.from('profiles').update({ department: null }).eq('id', staffId);
    fetchAll();
  }

  function openEdit(d: Department) {
    setForm({ name: d.name, description: d.description || '', hod_id: d.hod_id || '' });
    setSaveError('');
    setHodSearch('');
    setEditModal(d);
  }

  function copySQL() {
    navigator.clipboard.writeText(SQL_SETUP).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const getDeptMembers = (deptName: string) => staff.filter(s => s.department === deptName);

  const filteredStaff = (deptName: string) => {
    const q = staffSearch.toLowerCase();
    return staff.filter(s =>
      s.department !== deptName &&
      (`${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.role.toLowerCase().includes(q))
    );
  };

  const myDept = departments.find(d => d.name === profile?.department);
  const myDeptMembers = myDept ? getDeptMembers(myDept.name) : [];

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? 'Manage school departments, assign HODs, and organise staff' : 'View your department and team'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm({ name: '', description: '', hod_id: '' }); setSaveError(''); setHodSearch(''); setCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm">
            <Plus size={16} /> New Department
          </button>
        )}
      </div>

      {showSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2"><AlertCircle size={16} />Setup required — run this SQL first:</p>
          <pre className="bg-amber-100 rounded-xl p-3 text-xs overflow-x-auto text-amber-900 whitespace-pre-wrap">{SQL_SETUP}</pre>
          <div className="flex gap-3 mt-3">
            <button onClick={copySQL} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
              <Copy size={12} />{copied ? 'Copied!' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowSql(false)} className="text-amber-700 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {/* Staff: My Department card */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2 text-sm"><Building2 size={15} className="text-emerald-600" /> My Department</h2>
          {!myDept ? (
            <p className="text-sm text-slate-400">You have not been assigned to a department yet. Contact your administrator.</p>
          ) : (
            <>
              <div>
                <p className="text-lg font-bold text-slate-800">{myDept.name}</p>
                {myDept.description && <p className="text-sm text-slate-500">{myDept.description}</p>}
                {myDept.hod && (
                  <div className="flex items-center gap-2 mt-2">
                    <Crown size={14} className="text-amber-500" />
                    <span className="text-sm text-slate-600 font-medium">
                      HOD: {myDept.hod.first_name} {myDept.hod.last_name}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Department Members ({myDeptMembers.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {myDeptMembers.map(s => (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                        {s.first_name[0]}{s.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {s.first_name} {s.last_name}
                          {myDept.hod_id === s.id && <Crown size={11} className="inline ml-1 text-amber-500" />}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">{s.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> Loading…
        </div>
      ) : departments.length === 0 && !showSql ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No departments yet.</p>
          {isAdmin && <p className="text-xs mt-1">Create your first department above.</p>}
        </div>
      ) : isAdmin ? (
        <div className="space-y-3">
          {departments.map(d => {
            const dMembers = getDeptMembers(d.name);
            const isExpanded = expandedId === d.id;
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{d.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{dMembers.length} staff</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {d.hod ? (
                        <span className="flex items-center gap-1 text-xs text-amber-700">
                          <Crown size={11} /> HOD: {d.hod.first_name} {d.hod.last_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No HOD assigned</span>
                      )}
                      {d.description && <span className="text-xs text-slate-400 truncate max-w-xs">{d.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(d)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><Edit2 size={14} /></button>
                    <button onClick={() => { setStaffSearch(''); setAssignStaffModal(d); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">
                      <Users size={12} /> Assign Staff
                    </button>
                    <button onClick={() => deleteDepartment(d.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    <span className="text-slate-300 ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    {dMembers.length === 0 ? (
                      <p className="text-xs text-slate-400">No staff assigned. Click "Assign Staff" to add members.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {dMembers.map(s => (
                          <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 group">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                              {s.first_name[0]}{s.last_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {s.first_name} {s.last_name}
                                {d.hod_id === s.id && <Crown size={11} className="inline ml-1 text-amber-500" title="HOD" />}
                              </p>
                              <p className="text-xs text-slate-400 capitalize">{s.role.replace('_', ' ')}</p>
                            </div>
                            <button onClick={() => removeFromDept(s.id)}
                              className="p-1 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Create / Edit Department Modal ──────────────────── */}
      <Modal isOpen={createModal || !!editModal} onClose={() => { setCreateModal(false); setEditModal(null); }} title={editModal ? 'Edit Department' : 'Create Department'}>
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Department Name *</label>
            <input className={ic} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mathematics, English Language, Science" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Description</label>
            <textarea className={ic} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description (optional)" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Head of Department (HOD)</label>
            {form.hod_id ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                <Crown size={13} className="text-amber-500 flex-shrink-0" />
                <span className="flex-1 font-medium">
                  {staff.find(s => s.id === form.hod_id)?.first_name}{' '}
                  {staff.find(s => s.id === form.hod_id)?.last_name}
                </span>
                <button type="button" onClick={() => { setForm(f => ({ ...f, hod_id: '' })); setHodSearch(''); }}
                  className="text-slate-400 hover:text-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <>
                <input className={ic} value={hodSearch} onChange={e => setHodSearch(e.target.value)}
                  placeholder="Search by name or role…" />
                <div className="mt-1 max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50 bg-white">
                  {staff
                    .filter(s => !hodSearch || `${s.first_name} ${s.last_name}`.toLowerCase().includes(hodSearch.toLowerCase()) || s.role.toLowerCase().includes(hodSearch.toLowerCase()))
                    .map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setForm(f => ({ ...f, hod_id: s.id })); setHodSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                        <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {s.first_name[0]}{s.last_name[0]}
                        </span>
                        <span className="flex-1">{s.first_name} {s.last_name}</span>
                        <span className="text-xs text-slate-400 capitalize">{s.role.replace(/_/g, ' ')}</span>
                      </button>
                    ))}
                  {staff.filter(s => !hodSearch || `${s.first_name} ${s.last_name}`.toLowerCase().includes(hodSearch.toLowerCase()) || s.role.toLowerCase().includes(hodSearch.toLowerCase())).length === 0 && (
                    <p className="p-3 text-xs text-slate-400">No staff match your search.</p>
                  )}
                </div>
              </>
            )}
            <p className="text-xs text-slate-400 mt-1">The HOD will be the supervisor/manager for all staff in this department.</p>
          </div>
          {saveError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={13} />{saveError}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={() => saveDepartment(!!editModal)} disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Saving…' : editModal ? 'Save Changes' : 'Create Department'}
            </button>
            <button onClick={() => { setCreateModal(false); setEditModal(null); }} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── Assign Staff to Department Modal ────────────────── */}
      <Modal isOpen={!!assignStaffModal} onClose={() => setAssignStaffModal(null)} title={`Assign Staff to ${assignStaffModal?.name || 'Department'}`}>
        <div className="space-y-3 p-1">
          <div>
            <input className={ic} value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Search staff by name or role…" />
          </div>
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
            {assignStaffModal && filteredStaff(assignStaffModal.name).length === 0 ? (
              <p className="p-3 text-xs text-slate-400">All staff are already in this department, or no staff found.</p>
            ) : assignStaffModal && filteredStaff(assignStaffModal.name).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {s.first_name[0]}{s.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-slate-400 capitalize">
                    {s.role.replace('_', ' ')}
                    {s.department && <span className="ml-1 text-amber-600">• Currently: {s.department}</span>}
                  </p>
                </div>
                <button
                  onClick={() => assignStaffModal && assignStaff(s.id, assignStaffModal.name).then(fetchAll)}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200">
                  Assign
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setAssignStaffModal(null)} className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium mt-2">Close</button>
        </div>
      </Modal>
    </div>
  );
}
