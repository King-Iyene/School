import { useEffect, useRef, useState } from 'react';
import { Users, Search, KeyRound, Link2, Pencil, Save, UserX, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

interface LinkedChild {
  linkId: string;
  studentId: string;
  name: string;
  className: string;
  relationship: string;
  isPrimary: boolean;
}

interface ParentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  children: LinkedChild[];
}

interface StudentResult {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  class_id: string | null;
}

// Explicit allowlist of roles that manage parent accounts — mirrors the roles
// whose nav exposes the "Student Information" management group.
const ALLOWED_ROLES = new Set(['super_admin', 'admin', 'principal', 'head_teacher', 'admin_support']);
const RELATIONSHIPS = ['parent', 'guardian', 'father', 'mother'];

export default function Parents() {
  const { profile } = useAuth();
  const authorized = !!profile && ALLOWED_ROLES.has(profile.role);

  const [rows, setRows] = useState<ParentRow[]>([]);
  const rowsRef = useRef<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  // Page-local toast/status
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Manage children modal
  const [manageParent, setManageParent] = useState<ParentRow | null>(null);
  const [childSearch, setChildSearch] = useState('');
  const [childResults, setChildResults] = useState<StudentResult[]>([]);
  const [searchingChildren, setSearchingChildren] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [classMap, setClassMap] = useState<Record<string, string>>({});

  // Edit contact modal
  const [editParent, setEditParent] = useState<ParentRow | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(t);
  }, [status]);

  async function load() {
    if (!authorized) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);

    // A silently-expired session makes every query return 0 rows — detect it.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoadError('Your session has expired. Please log out and log in again to see parents.');
      setLoading(false);
      return;
    }

    const schoolId = profile?.school_id;
    if (!schoolId) {
      setLoadError('Your account has no school linked, so parents cannot be loaded. Please log out and log in again — if this persists, contact the administrator.');
      setLoading(false);
      return;
    }

    // 1. Parent profiles (scoped to this school as defense in depth)
    const { data: parents, error: pErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, created_at')
      .eq('role', 'parent')
      .eq('school_id', schoolId)
      .order('first_name');
    if (pErr) {
      setLoadError(`Could not load parents: ${pErr.message}`);
      setLoading(false);
      return;
    }
    const parentList = parents ?? [];

    // 2. Links for those parents
    const parentIds = parentList.map(p => p.id);
    let links: any[] = [];
    if (parentIds.length > 0) {
      const { data: linkData, error: lErr } = await supabase
        .from('parent_student_links')
        .select('id, parent_id, student_id, relationship, is_primary')
        .in('parent_id', parentIds);
      if (lErr) {
        setLoadError(`Could not load parent-student links: ${lErr.message}`);
        setLoading(false);
        return;
      }
      links = linkData ?? [];
    }

    // 3. Students referenced by those links (scoped to this school). A failed
    // or RLS-blocked query here would otherwise silently render every parent
    // as "No linked child", so treat any error as fatal.
    const studentIds = Array.from(new Set(links.map(l => l.student_id)));
    let students: any[] = [];
    if (studentIds.length > 0) {
      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', schoolId)
        .in('id', studentIds);
      if (sErr) {
        setLoadError(`Could not load linked students: ${sErr.message}`);
        setLoading(false);
        return;
      }
      students = sData ?? [];
    }

    // 4. Classes for names
    const classIds = Array.from(new Set(students.map(s => s.class_id).filter(Boolean)));
    const cMap: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: cData, error: cErr } = await supabase
        .from('classes')
        .select('id, name, level, section')
        .in('id', classIds);
      if (cErr) {
        setLoadError(`Could not load class names: ${cErr.message}`);
        setLoading(false);
        return;
      }
      (cData ?? []).forEach((c: any) => {
        cMap[c.id] = c.name || `${c.level ?? ''}${c.section ?? ''}`.trim();
      });
    }
    setClassMap(cMap);

    const studentMap: Record<string, any> = {};
    students.forEach(s => { studentMap[s.id] = s; });

    const linksByParent: Record<string, LinkedChild[]> = {};
    links.forEach(l => {
      const s = studentMap[l.student_id];
      if (!s) return;
      (linksByParent[l.parent_id] ||= []).push({
        linkId: l.id,
        studentId: l.student_id,
        name: `${s.first_name} ${s.last_name}`,
        className: s.class_id ? (cMap[s.class_id] ?? '') : '',
        relationship: l.relationship ?? '',
        isPrimary: !!l.is_primary,
      });
    });

    const nextRows = parentList.map(p => ({ ...p, children: linksByParent[p.id] ?? [] }));
    rowsRef.current = nextRows;
    setRows(nextRows);
    setLoading(false);
  }

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (onlyUnlinked && r.children.length > 0) return false;
    if (!q) return true;
    const hay = `${r.first_name ?? ''} ${r.last_name ?? ''} ${r.email ?? ''} ${r.phone ?? ''}`.toLowerCase();
    return hay.includes(q);
  });

  const unlinkedCount = rows.filter(r => r.children.length === 0).length;

  async function handleResetPassword(parent: ParentRow) {
    if (!parent.email) {
      setStatus({ type: 'error', message: 'This parent has no email on file, so a reset link cannot be sent.' });
      return;
    }
    if (!confirm(`Send a password reset email to ${parent.email}?`)) return;
    setResettingId(parent.id);
    const { error } = await supabase.auth.resetPasswordForEmail(parent.email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setStatus({ type: 'error', message: `Could not send reset email: ${error.message}` });
      setResettingId(null);
      return;
    }
    setStatus({ type: 'success', message: `Password reset email sent to ${parent.email}.` });
    // Keep the button disabled briefly after a successful send.
    setTimeout(() => setResettingId(null), 4000);
  }

  // ── Manage children ──────────────────────────────────────────────────────
  function openManage(parent: ParentRow) {
    setManageParent(parent);
    setChildSearch('');
    setChildResults([]);
    setModalError(null);
  }

  async function searchChildren() {
    if (!childSearch.trim()) { setChildResults([]); return; }
    setSearchingChildren(true);
    setModalError(null);
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, class_id')
      .or(`first_name.ilike.%${childSearch}%,last_name.ilike.%${childSearch}%,admission_number.ilike.%${childSearch}%`)
      .limit(15);
    if (error) {
      setModalError(`Search failed: ${error.message}`);
      setChildResults([]);
    } else {
      setChildResults((data ?? []) as StudentResult[]);
    }
    setSearchingChildren(false);
  }

  async function linkChild(student: StudentResult, relationship: string) {
    if (!manageParent) return;
    if (manageParent.children.some(c => c.studentId === student.id)) {
      setModalError('This student is already linked to this parent.');
      return;
    }
    setLinkBusy(true);
    setModalError(null);
    // RLS can silently filter the insert (error:null, no row returned), so
    // require the created row back before treating this as a success.
    const { data, error } = await supabase.from('parent_student_links').insert({
      parent_id: manageParent.id,
      student_id: student.id,
      relationship,
    }).select('id').single();
    setLinkBusy(false);
    if (error) {
      setModalError(`Could not link student: ${error.message}`);
      return;
    }
    if (!data) {
      setModalError("You don't have permission to link this student.");
      return;
    }
    await refreshManaged();
  }

  async function unlinkChild(linkId: string) {
    if (!confirm('Remove this linked child from the parent account?')) return;
    setLinkBusy(true);
    setModalError(null);
    // A deleted row is returned via .select(); an RLS-filtered delete returns
    // error:null with an empty array, which must not look like success.
    const { data, error } = await supabase
      .from('parent_student_links')
      .delete()
      .eq('id', linkId)
      .select('id');
    setLinkBusy(false);
    if (error) {
      setModalError(`Could not unlink student: ${error.message}`);
      return;
    }
    if (!data || data.length < 1) {
      setModalError("You don't have permission to change this.");
      return;
    }
    await refreshManaged();
  }

  async function refreshManaged() {
    await load();
    // Re-sync the open modal's parent from the freshly loaded rows.
    setManageParent(prev => {
      if (!prev) return prev;
      const updated = rowsRef.current.find(r => r.id === prev.id);
      return updated ?? prev;
    });
  }

  // ── Edit contact ─────────────────────────────────────────────────────────
  function openEdit(parent: ParentRow) {
    setEditParent(parent);
    setEditForm({
      first_name: parent.first_name ?? '',
      last_name: parent.last_name ?? '',
      phone: parent.phone ?? '',
    });
    setEditError(null);
  }

  async function saveEdit() {
    if (!editParent) return;
    setSavingEdit(true);
    setEditError(null);
    // .select() returns the updated rows; an RLS-filtered update reports
    // error:null with no rows, so require at least one row back.
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim() || null,
      })
      .eq('id', editParent.id)
      .select('id');
    setSavingEdit(false);
    if (!error && (!data || data.length < 1)) {
      setEditError("You don't have permission to change this.");
      return;
    }
    if (error) {
      setEditError(`Could not save changes: ${error.message}`);
      return;
    }
    setStatus({ type: 'success', message: 'Parent contact details updated.' });
    setEditParent(null);
    await load();
  }

  if (!authorized) {
    return <div className="p-6 text-sm text-slate-500">You do not have permission to view this page.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-emerald-50 p-2 rounded-lg">
          <Users size={22} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Parents</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Parent logins and the children linked to each account.
      </p>

      {status && (
        <div className={`text-sm rounded-xl px-4 py-3 mb-4 border ${
          status.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {status.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or phone…"
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <button
          onClick={() => setOnlyUnlinked(v => !v)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            onlyUnlinked
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          No linked child ({unlinkedCount})
        </button>
        <span className="text-sm text-slate-500 ml-auto">{filtered.length} of {rows.length} parents</span>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            {onlyUnlinked ? 'No parents without linked children.' : (q ? 'No parents match your search.' : 'No parent accounts yet.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <th className="px-5 py-3 font-semibold">Parent</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Linked children</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 align-top">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(p.first_name?.[0] ?? '').toUpperCase()}{(p.last_name?.[0] ?? '').toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">{p.first_name} {p.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.email || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{p.phone || '—'}</td>
                    <td className="px-5 py-3">
                      {p.children.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                          <UserX className="w-3.5 h-3.5" /> No linked child
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {p.children.map(c => (
                            <span key={c.linkId} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                              {c.name}
                              {c.className && <span className="text-slate-400">· {c.className}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => openManage(p)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <Link2 className="w-3.5 h-3.5" /> Children
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleResetPassword(p)}
                          disabled={resettingId === p.id}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> {resettingId === p.id ? 'Sent' : 'Reset password'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Parent logins cannot be deleted here. To remove a login entirely, ask the school's database administrator.
      </p>

      {/* Manage children modal */}
      <Modal
        isOpen={!!manageParent}
        onClose={() => setManageParent(null)}
        title={manageParent ? `Manage children — ${manageParent.first_name} ${manageParent.last_name}` : 'Manage children'}
        size="lg"
      >
        {manageParent && (
          <div className="space-y-6">
            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {modalError}
              </div>
            )}

            <div>
              <h5 className="text-sm font-semibold text-slate-800 mb-3">Linked children</h5>
              {manageParent.children.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No students linked to this account.</p>
              ) : (
                <div className="space-y-2">
                  {manageParent.children.map(c => (
                    <div key={c.linkId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {c.name} {c.className && <span className="font-normal text-slate-500">· {c.className}</span>}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">{c.relationship || 'linked'}</p>
                      </div>
                      <button
                        onClick={() => unlinkChild(c.linkId)}
                        disabled={linkBusy}
                        className="text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h5 className="text-sm font-semibold text-slate-800 mb-3">Link a student</h5>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search by name or admission number…"
                  value={childSearch}
                  onChange={e => setChildSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchChildren(); }}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <button
                  onClick={searchChildren}
                  disabled={searchingChildren}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {searchingChildren ? '…' : 'Search'}
                </button>
              </div>

              {childResults.length > 0 && (
                <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                  {childResults.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-slate-500">
                          {s.admission_number || '—'}
                          {s.class_id && classMap[s.class_id] ? ` · ${classMap[s.class_id]}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          id={`rel-${s.id}`}
                          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white capitalize"
                          defaultValue="parent"
                        >
                          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                          onClick={() => {
                            const rel = (document.getElementById(`rel-${s.id}`) as HTMLSelectElement).value;
                            linkChild(s, rel);
                          }}
                          disabled={linkBusy}
                          className="text-xs bg-emerald-500 text-white px-3 py-1 rounded font-medium hover:bg-emerald-600 disabled:opacity-50"
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setManageParent(null)}
                className="px-6 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit contact modal */}
      <Modal
        isOpen={!!editParent}
        onClose={() => setEditParent(null)}
        title="Edit Parent Contact"
        size="md"
      >
        {editParent && (
          <div className="space-y-4">
            {editError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">First Name</label>
                <input
                  value={editForm.first_name}
                  onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Last Name</label>
                <input
                  value={editForm.last_name}
                  onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email (login — read only)</label>
              <div className="flex items-center gap-2 w-full border border-slate-100 bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-500">
                <X className="w-3.5 h-3.5 text-slate-300" />
                {editParent.email || 'No email on file'}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditParent(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingEdit ? 'Saving…' : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
