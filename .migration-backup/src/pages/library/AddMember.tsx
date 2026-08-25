import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

const INPUT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full';
const SELECT_CLASS = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full bg-white';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface LibraryMember {
  id: string;
  profile_id: string;
  member_type: string;
  membership_number: string;
  join_date: string;
  expiry_date: string;
  status: string;
  school_id: string;
  profiles?: Profile;
}

export default function AddMember() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [form, setForm] = useState({
    profile_id: '',
    profile_name: '',
    member_type: 'student',
    membership_number: '',
    join_date: '',
    expiry_date: '',
    status: 'active',
  });

  useEffect(() => {
    if (profile?.school_id) {
      fetchMembers();
      fetchProfiles();
    }
  }, [profile?.school_id]);

  useEffect(() => {
    fetchMembers();
  }, [search, filterType, filterStatus]);

  async function fetchMembers() {
    setLoading(true);
    let query = supabase
      .from('library_members')
      .select('*, profiles(id, full_name, role), students!profile_id(first_name, last_name, admission_number)')
      .eq('school_id', profile?.school_id || '')
      .order('membership_number');

    if (filterType) query = query.eq('member_type', filterType);
    if (filterStatus) query = query.eq('status', filterStatus);

    const { data } = await query;
    if (data) {
      let filtered = data as LibraryMember[];
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.membership_number?.toLowerCase().includes(s) ||
            m.profiles?.full_name?.toLowerCase().includes(s)
        );
      }
      setMembers(filtered);
    }
    setLoading(false);
  }

  async function fetchProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('school_id', profile?.school_id || '')
      .order('full_name');
    if (data) setProfiles(data as Profile[]);
  }

  async function suggestMembershipNumber() {
    const { count } = await supabase
      .from('library_members')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', profile?.school_id || '');
    const next = (count ?? 0) + 1;
    return `LIB-${String(next).padStart(3, '0')}`;
  }

  async function openAdd() {
    setEditId(null);
    setSaveError('');
    const suggested = await suggestMembershipNumber();
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setForm({
      profile_id: '',
      profile_name: '',
      member_type: 'student',
      membership_number: suggested,
      join_date: today,
      expiry_date: nextYear,
      status: 'active',
    });
    setProfileSearch('');
    setFilteredProfiles([]);
    setModalOpen(true);
  }

  function openEdit(member: LibraryMember) {
    setEditId(member.id);
    setSaveError('');
    setForm({
      profile_id: member.profile_id || '',
      profile_name: member.profiles?.full_name || '',
      member_type: member.member_type || 'student',
      membership_number: member.membership_number || '',
      join_date: member.join_date || '',
      expiry_date: member.expiry_date || '',
      status: member.status || 'active',
    });
    setProfileSearch(member.profiles?.full_name || '');
    setFilteredProfiles([]);
    setModalOpen(true);
  }

  function handleProfileSearch(value: string) {
    setProfileSearch(value);
    if (value.length > 0) {
      const results = profiles.filter((p) =>
        p.full_name?.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProfiles(results.slice(0, 8));
      setShowProfileDropdown(true);
    } else {
      setFilteredProfiles([]);
      setShowProfileDropdown(false);
    }
  }

  function selectProfile(p: Profile) {
    setForm((prev) => ({ ...prev, profile_id: p.id, profile_name: p.full_name }));
    setProfileSearch(p.full_name);
    setShowProfileDropdown(false);
    setFilteredProfiles([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      profile_id: form.profile_id,
      member_type: form.member_type,
      membership_number: form.membership_number,
      join_date: form.join_date,
      expiry_date: form.expiry_date,
      status: form.status,
      school_id: profile?.school_id || '',
    };
    let res;
    if (editId) {
      res = await supabase.from('library_members').update(payload).eq('id', editId);
    } else {
      res = await supabase.from('library_members').insert([payload]);
    }
    if (res.error) { setSaveError(res.error.message); setSaving(false); return; }
    setSaving(false);
    setModalOpen(false);
    fetchMembers();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this member?')) return;
    await supabase.from('library_members').delete().eq('id', id);
    fetchMembers();
  }

  function statusBadge(status: string) {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'suspended') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
  }

  function typeBadge(type: string) {
    if (type === 'student') return 'bg-blue-100 text-blue-700';
    return 'bg-violet-100 text-violet-700';
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl">
            <Users size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Library Members</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Member
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or membership number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
          >
            <option value="">All Types</option>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Membership #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Join Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Expiry Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{member.membership_number}</td>
                    <td className="px-5 py-2 font-medium text-slate-800">
                      {(() => {
                        if (member.member_type === 'student') {
                          const s = Array.isArray((member as any).students) ? (member as any).students[0] : (member as any).students;
                          return s ? `${s.first_name} ${s.last_name}` : (member.profiles?.full_name || '-');
                        }
                        return member.profiles?.full_name || '-';
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${typeBadge(member.member_type)}`}>
                        {member.member_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.join_date || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{member.expiry_date || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${statusBadge(member.status)}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(member)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Member' : 'Add Member'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-2">{saveError}</div>}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Member (Profile)</label>
            <input
              required={!form.profile_id}
              className={INPUT_CLASS}
              value={profileSearch}
              onChange={(e) => handleProfileSearch(e.target.value)}
              onFocus={() => {
                if (profileSearch.length > 0 && filteredProfiles.length > 0) setShowProfileDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowProfileDropdown(false), 150)}
              placeholder="Search by name..."
            />
            {showProfileDropdown && filteredProfiles.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProfile(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800">{p.full_name}</span>
                    <span className="text-xs text-slate-500 capitalize">{p.role}</span>
                  </button>
                ))}
              </div>
            )}
            {form.profile_id && (
              <p className="text-xs text-emerald-600 mt-1">Selected: {form.profile_name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Member Type</label>
              <select
                className={SELECT_CLASS}
                value={form.member_type}
                onChange={(e) => setForm((p) => ({ ...p, member_type: e.target.value }))}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Membership Number</label>
              <input
                required
                className={INPUT_CLASS}
                value={form.membership_number}
                onChange={(e) => setForm((p) => ({ ...p, membership_number: e.target.value }))}
                placeholder="LIB-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Join Date</label>
              <input
                type="date"
                required
                className={INPUT_CLASS}
                value={form.join_date}
                onChange={(e) => setForm((p) => ({ ...p, join_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
              <input
                type="date"
                required
                className={INPUT_CLASS}
                value={form.expiry_date}
                onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              className={SELECT_CLASS}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.profile_id}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
