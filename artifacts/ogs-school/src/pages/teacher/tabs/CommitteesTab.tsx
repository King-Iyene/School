import { useEffect, useState } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/common/Modal';

interface Props { profileId: string; schoolId: string; }

const OGS_COMMITTEES = [
  "Principal's Executive Committee (PEC)",
  "School Management Committee",
  "Disciplinary Committee",
  "Exams & Records Committee",
  "Interhouse Sports Committee",
  "Academic Board",
  "Staff Welfare Committee",
  "Parent-Teacher Association (PTA) Liaison",
  "Health & Safety Committee",
  "ICT Committee",
  "Cultural & Social Committee",
  "Environmental Committee",
];

const inputCls = 'w-full border border-app-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelCls = 'block text-xs font-semibold text-app-text-muted uppercase tracking-wide mb-1';

export default function CommitteesTab({ profileId, schoolId }: Props) {
  const { profile: viewer } = useAuth();
  const isAdmin = viewer?.role === 'super_admin' || viewer?.role === 'admin' || viewer?.role === 'principal';

  const [committees, setCommittees] = useState<any[]>([]);
  const [disciplinary, setDisciplinary] = useState<any[]>([]);
  const [showComModal, setShowComModal] = useState(false);
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [editCom, setEditCom] = useState<any>(null);
  const [editDisc, setEditDisc] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [comForm, setComForm] = useState({ committee_name: '', position: 'member', start_date: '', end_date: '', is_active: true, notes: '' });
  const [discForm, setDiscForm] = useState({ incident_date: new Date().toISOString().split('T')[0], incident_type: '', description: '', action_taken: '', sanction: '', status: 'pending', notes: '' });

  useEffect(() => { load(); }, [profileId]);

  async function load() {
    const [cRes, dRes] = await Promise.all([
      supabase.from('staff_committees').select('*').eq('profile_id', profileId).order('is_active', { ascending: false }).order('start_date', { ascending: false }),
      supabase.from('staff_disciplinary').select('*').eq('profile_id', profileId).order('incident_date', { ascending: false }),
    ]);
    setCommittees(cRes.data ?? []);
    setDisciplinary(dRes.data ?? []);
  }

  function openAddCom() {
    setEditCom(null);
    setComForm({ committee_name: '', position: 'member', start_date: '', end_date: '', is_active: true, notes: '' });
    setShowComModal(true);
  }

  function openEditCom(c: any) {
    setEditCom(c);
    setComForm({ committee_name: c.committee_name, position: c.position, start_date: c.start_date ?? '', end_date: c.end_date ?? '', is_active: c.is_active, notes: c.notes ?? '' });
    setShowComModal(true);
  }

  async function saveCom() {
    setSaving(true);
    const payload = { ...comForm, profile_id: profileId, school_id: schoolId };
    if (editCom) {
      await supabase.from('staff_committees').update({ ...comForm, updated_at: new Date().toISOString() }).eq('id', editCom.id);
    } else {
      await supabase.from('staff_committees').insert(payload);
    }
    setSaving(false);
    setShowComModal(false);
    load();
  }

  async function deleteCom(id: string) {
    if (!confirm('Remove from committee?')) return;
    await supabase.from('staff_committees').delete().eq('id', id);
    load();
  }

  function openAddDisc() {
    setEditDisc(null);
    setDiscForm({ incident_date: new Date().toISOString().split('T')[0], incident_type: '', description: '', action_taken: '', sanction: '', status: 'pending', notes: '' });
    setShowDiscModal(true);
  }

  function openEditDisc(d: any) {
    setEditDisc(d);
    setDiscForm({ incident_date: d.incident_date, incident_type: d.incident_type, description: d.description ?? '', action_taken: d.action_taken ?? '', sanction: d.sanction ?? '', status: d.status, notes: d.notes ?? '' });
    setShowDiscModal(true);
  }

  async function saveDisc() {
    setSaving(true);
    const payload = { ...discForm, profile_id: profileId, school_id: schoolId };
    if (editDisc) {
      await supabase.from('staff_disciplinary').update({ ...discForm, updated_at: new Date().toISOString() }).eq('id', editDisc.id);
    } else {
      await supabase.from('staff_disciplinary').insert(payload);
    }
    setSaving(false);
    setShowDiscModal(false);
    load();
  }

  async function deleteDisc(id: string) {
    if (!confirm('Delete this disciplinary record?')) return;
    await supabase.from('staff_disciplinary').delete().eq('id', id);
    load();
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    dismissed: 'bg-slate-100 text-app-text-muted',
    escalated: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-5">
      {/* Committees */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center justify-between">
          <h4 className="font-bold text-app-text flex items-center gap-2 text-sm"><Shield className="w-4 h-4 text-blue-600" />Committee Memberships</h4>
          {isAdmin && <button onClick={openAddCom} className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium"><Plus className="w-3 h-3" />Add</button>}
        </div>
        {committees.length === 0 ? (
          <div className="text-center py-8 text-app-text-muted text-sm">No committee memberships recorded</div>
        ) : (
          <div className="divide-y divide-app-border">
            {committees.map(c => (
              <div key={c.id} className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-app-surface-alt">
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${c.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div>
                    <p className="text-sm font-bold text-app-text">{c.committee_name}</p>
                    <p className="text-xs text-app-text-muted capitalize">{c.position}{c.start_date ? ` · from ${new Date(c.start_date).getFullYear()}` : ''}{c.end_date ? ` to ${new Date(c.end_date).getFullYear()}` : ''}{c.is_active ? ' · Active' : ' · Inactive'}</p>
                    {c.notes && <p className="text-xs text-app-text-muted mt-0.5">{c.notes}</p>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEditCom(c)} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteCom(c.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disciplinary Records — super_admin only */}
      {isAdmin && (
        <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-app-border flex items-center justify-between">
            <h4 className="font-bold text-app-text flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4 text-red-500" />Disciplinary Records <span className="text-xs font-normal text-app-text-muted">(Confidential)</span></h4>
            <button onClick={openAddDisc} className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium"><Plus className="w-3 h-3" />Add</button>
          </div>
          {disciplinary.length === 0 ? (
            <div className="text-center py-8 text-app-text-muted text-sm flex flex-col items-center gap-2"><CheckCircle className="w-8 h-8 text-emerald-200" />No disciplinary records</div>
          ) : (
            <div className="divide-y divide-app-border">
              {disciplinary.map(d => (
                <div key={d.id} className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-app-surface-alt">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-app-text">{d.incident_type}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[d.status] ?? 'bg-slate-100 text-app-text-muted'}`}>{d.status}</span>
                    </div>
                    <p className="text-xs text-app-text-muted">{new Date(d.incident_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {d.description && <p className="text-xs text-app-text-muted mt-1">{d.description}</p>}
                    {d.action_taken && <p className="text-xs text-app-text-muted mt-0.5">Action: {d.action_taken}</p>}
                    {d.sanction && <p className="text-xs text-red-600 mt-0.5 font-medium">Sanction: {d.sanction}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditDisc(d)} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-slate-100 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteDisc(d.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Committee Modal */}
      <Modal isOpen={showComModal} onClose={() => setShowComModal(false)} title={editCom ? 'Edit Committee' : 'Add Committee Membership'} size="md">
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Committee *</label>
            <select value={comForm.committee_name} onChange={e => setComForm({ ...comForm, committee_name: e.target.value })} className={`${inputCls} bg-app-surface`}>
              <option value="">Select committee...</option>
              {OGS_COMMITTEES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">Custom (type below)</option>
            </select>
            {comForm.committee_name === '__custom__' && (
              <input className={`${inputCls} mt-2`} placeholder="Committee name" onChange={e => setComForm({ ...comForm, committee_name: e.target.value })} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Position</label>
              <select value={comForm.position} onChange={e => setComForm({ ...comForm, position: e.target.value })} className={`${inputCls} bg-app-surface`}>
                <option value="member">Member</option><option value="chairman">Chairman</option><option value="secretary">Secretary</option><option value="vice_chairman">Vice Chairman</option><option value="coordinator">Coordinator</option>
              </select>
            </div>
            <div><label className={labelCls}>Status</label>
              <select value={comForm.is_active ? 'active' : 'inactive'} onChange={e => setComForm({ ...comForm, is_active: e.target.value === 'active' })} className={`${inputCls} bg-app-surface`}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Start Date</label><input type="date" value={comForm.start_date} onChange={e => setComForm({ ...comForm, start_date: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>End Date</label><input type="date" value={comForm.end_date} onChange={e => setComForm({ ...comForm, end_date: e.target.value })} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea value={comForm.notes} onChange={e => setComForm({ ...comForm, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowComModal(false)} className="flex-1 border border-app-border text-app-text rounded-xl py-2 text-sm hover:bg-app-surface-alt">Cancel</button>
            <button onClick={saveCom} disabled={saving || !comForm.committee_name || comForm.committee_name === '__custom__'} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editCom ? 'Update' : 'Add'}</button>
          </div>
        </div>
      </Modal>

      {/* Disciplinary Modal */}
      <Modal isOpen={showDiscModal} onClose={() => setShowDiscModal(false)} title={editDisc ? 'Edit Disciplinary Record' : 'Add Disciplinary Record'} size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Incident Date *</label><input type="date" value={discForm.incident_date} onChange={e => setDiscForm({ ...discForm, incident_date: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Incident Type *</label><input value={discForm.incident_type} onChange={e => setDiscForm({ ...discForm, incident_type: e.target.value })} className={inputCls} placeholder="e.g. Misconduct, Lateness..." /></div>
          </div>
          <div><label className={labelCls}>Description</label><textarea value={discForm.description} onChange={e => setDiscForm({ ...discForm, description: e.target.value })} rows={2} className={`${inputCls} resize-none`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Action Taken</label><input value={discForm.action_taken} onChange={e => setDiscForm({ ...discForm, action_taken: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Sanction</label><input value={discForm.sanction} onChange={e => setDiscForm({ ...discForm, sanction: e.target.value })} className={inputCls} placeholder="e.g. Warning, Suspension..." /></div>
          </div>
          <div><label className={labelCls}>Status</label>
            <select value={discForm.status} onChange={e => setDiscForm({ ...discForm, status: e.target.value })} className={`${inputCls} bg-app-surface`}>
              <option value="pending">Pending</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="escalated">Escalated</option>
            </select>
          </div>
          <div><label className={labelCls}>Notes</label><textarea value={discForm.notes} onChange={e => setDiscForm({ ...discForm, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} /></div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowDiscModal(false)} className="flex-1 border border-app-border text-app-text rounded-xl py-2 text-sm hover:bg-app-surface-alt">Cancel</button>
            <button onClick={saveDisc} disabled={saving || !discForm.incident_type} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editDisc ? 'Update' : 'Add Record'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
