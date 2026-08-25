import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { Plus, Users, AlertCircle, Copy, X, ChevronDown, ChevronUp, UserPlus, Trash2 } from 'lucide-react';

const SQL_SETUP = `-- Run once in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS committees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_access" ON committees
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS committee_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  committee_id uuid REFERENCES committees(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(committee_id, staff_id)
);
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_access" ON committee_members
  USING ((SELECT school_id FROM profiles WHERE id = auth.uid()) =
         (SELECT school_id FROM profiles WHERE id = committee_members.staff_id));`;

const ic = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';
const MEMBER_ROLES = ['Chair', 'Member', 'Secretary'];
const ROLE_BADGE: Record<string, string> = {
  Chair: 'bg-purple-100 text-purple-700',
  Secretary: 'bg-blue-100 text-blue-700',
  Member: 'bg-slate-100 text-slate-600',
};

interface Committee { id: string; name: string; description: string | null; status: string; created_at: string; }
interface CommitteeMember { id: string; committee_id: string; staff_id: string; role: string; joined_date: string; profiles?: { first_name: string; last_name: string; role: string } | null; }
interface StaffProfile { id: string; first_name: string; last_name: string; role: string; }

export default function Committees() {
  const { profile } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'principal', 'head_teacher'].includes(profile?.role || '');

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<Record<string, CommitteeMember[]>>({});
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [createModal, setCreateModal] = useState(false);
  const [addMemberModal, setAddMemberModal] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [memberForm, setMemberForm] = useState({ staff_id: '', role: 'Member' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from('committees').select('*').eq('school_id', profile?.school_id).order('name'),
      supabase.from('profiles').select('id,first_name,last_name,role')
        .eq('school_id', profile?.school_id)
        .in('role', ['super_admin','admin','principal','head_teacher','teacher','nur_prim_teacher','non_teaching_staff','matron','porter','cleaner','admin_support','accountant','security_officer'])
        .order('first_name'),
    ]);
    setLoading(false);
    if (cRes.error) {
      if (cRes.error.code === '42P01' || cRes.error.message?.includes('relation')) setShowSql(true);
      return;
    }
    setCommittees(cRes.data || []);
    setStaff(sRes.data || []);
    if (cRes.data?.length) {
      await fetchMembers(cRes.data.map(c => c.id));
    }
  }

  async function fetchMembers(ids: string[]) {
    const { data } = await supabase.from('committee_members')
      .select('*, profiles(first_name,last_name,role)')
      .in('committee_id', ids)
      .order('role');
    if (!data) return;
    const grouped: Record<string, CommitteeMember[]> = {};
    for (const m of data) {
      if (!grouped[m.committee_id]) grouped[m.committee_id] = [];
      grouped[m.committee_id].push(m);
    }
    setMembers(grouped);
  }

  async function createCommittee() {
    if (!form.name.trim()) { setSaveError('Committee name is required.'); return; }
    setSaving(true); setSaveError('');
    const { error } = await supabase.from('committees').insert({
      school_id: profile?.school_id, name: form.name.trim(), description: form.description.trim() || null,
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setCreateModal(false); setForm({ name: '', description: '' });
    fetchAll();
  }

  async function addMember() {
    if (!memberForm.staff_id) { setSaveError('Select a staff member.'); return; }
    setSaving(true); setSaveError('');
    const { error } = await supabase.from('committee_members').insert({
      committee_id: addMemberModal, staff_id: memberForm.staff_id, role: memberForm.role,
    });
    setSaving(false);
    if (error) {
      if (error.code === '23505') { setSaveError('This staff member is already in this committee.'); return; }
      setSaveError(error.message); return;
    }
    setAddMemberModal(null); setMemberForm({ staff_id: '', role: 'Member' }); setStaffSearch('');
    fetchAll();
  }

  async function removeMember(memberId: string) {
    await supabase.from('committee_members').delete().eq('id', memberId);
    fetchAll();
  }

  async function deleteCommittee(id: string) {
    if (!confirm('Delete this committee and all its members?')) return;
    await supabase.from('committee_members').delete().eq('committee_id', id);
    await supabase.from('committees').delete().eq('id', id);
    fetchAll();
  }

  function copySQL() {
    navigator.clipboard.writeText(SQL_SETUP).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const existingMemberIds = addMemberModal ? (members[addMemberModal] || []).map(m => m.staff_id) : [];
  const filteredStaff = staff.filter(s => {
    if (existingMemberIds.includes(s.id)) return false;
    const q = staffSearch.toLowerCase();
    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });

  const myCommittees = committees.filter(c => members[c.id]?.some(m => m.staff_id === profile?.id));

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Committees</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? 'Manage school committees and assign staff members' : 'View your committee assignments'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm({ name: '', description: '' }); setSaveError(''); setCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm">
            <Plus size={16} /> New Committee
          </button>
        )}
      </div>

      {showSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
          <p className="font-semibold text-amber-800 mb-2 flex items-center gap-2"><AlertCircle size={16} />Table not found — run this SQL first:</p>
          <pre className="bg-amber-100 rounded-xl p-3 text-xs overflow-x-auto text-amber-900 whitespace-pre-wrap">{SQL_SETUP}</pre>
          <div className="flex gap-3 mt-3">
            <button onClick={copySQL} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
              <Copy size={12} />{copied ? 'Copied!' : 'Copy SQL'}
            </button>
            <button onClick={() => setShowSql(false)} className="text-amber-700 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {!isAdmin && myCommittees.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-2">My Committee Assignments</p>
          <div className="flex flex-wrap gap-2">
            {myCommittees.map(c => {
              const myRole = members[c.id]?.find(m => m.staff_id === profile?.id)?.role;
              return (
                <span key={c.id} className="px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
                  {c.name}
                  {myRole && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${ROLE_BADGE[myRole] || 'bg-slate-100 text-slate-600'}`}>{myRole}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> Loading…
        </div>
      ) : committees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No committees yet.</p>
          {isAdmin && <p className="text-xs mt-1">Create your first committee using the button above.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {committees.map(c => {
            const cMembers = members[c.id] || [];
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{cMembers.length} member{cMembers.length !== 1 ? 's' : ''}</span>
                    </div>
                    {c.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{c.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isAdmin && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setMemberForm({ staff_id: '', role: 'Member' }); setSaveError(''); setStaffSearch(''); setAddMemberModal(c.id); }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">
                          <UserPlus size={12} /> Add Member
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteCommittee(c.id); }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {cMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">No members yet. {isAdmin && 'Click "Add Member" to assign staff.'}</p>
                    ) : (
                      <div className="space-y-2">
                        {cMembers.map(m => (
                          <div key={m.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700 flex-shrink-0">
                              {m.profiles ? `${m.profiles.first_name[0]}${m.profiles.last_name[0]}` : '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-slate-700 font-medium">
                                {m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : m.staff_id}
                              </span>
                              {m.profiles && <span className="text-xs text-slate-400 ml-2 capitalize">{m.profiles.role.replace('_', ' ')}</span>}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role] || 'bg-slate-100 text-slate-600'}`}>{m.role}</span>
                            {isAdmin && (
                              <button onClick={() => removeMember(m.id)} className="p-1 text-red-400 hover:text-red-600 rounded">
                                <X size={13} />
                              </button>
                            )}
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
      )}

      {/* ── Create Committee Modal ────────────────────────── */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create New Committee">
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Committee Name *</label>
            <input className={ic} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PTA Liaison Committee, Disciplinary Committee" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Description / Purpose</label>
            <textarea className={ic} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of what this committee does" />
          </div>
          {saveError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={13} />{saveError}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={createCommittee} disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Creating…' : 'Create Committee'}
            </button>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── Add Member Modal ──────────────────────────────── */}
      <Modal isOpen={!!addMemberModal} onClose={() => setAddMemberModal(null)} title="Add Committee Member">
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Search Staff</label>
            <input className={ic} value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Type name to filter…" />
            <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
              {filteredStaff.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">No staff found.</p>
              ) : filteredStaff.map(s => (
                <button key={s.id} onClick={() => setMemberForm(f => ({ ...f, staff_id: s.id }))}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${memberForm.staff_id === s.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'}`}>
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {s.first_name[0]}{s.last_name[0]}
                  </div>
                  <span className="flex-1">{s.first_name} {s.last_name}</span>
                  <span className="text-xs text-slate-400 capitalize">{s.role.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Role in Committee</label>
            <select className={ic} value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))}>
              {MEMBER_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          {saveError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={13} />{saveError}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={addMember} disabled={saving || !memberForm.staff_id}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Adding…' : 'Add Member'}
            </button>
            <button onClick={() => setAddMemberModal(null)} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
