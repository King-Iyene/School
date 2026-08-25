import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { Plus, Pencil, Trash2, Users, UserPlus, UserMinus, Search } from 'lucide-react';

interface StudentGroup {
  id: string;
  name: string;
  description: string | null;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

interface GroupMember {
  id: string;
  student_id: string;
  student: {
    first_name: string;
    last_name: string;
    admission_number: string;
  };
}

interface FormState {
  name: string;
  description: string;
}

const defaultForm: FormState = { name: '', description: '' };

export default function StudentGroup() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentGroup | null>(null);
  const [activeGroup, setActiveGroup] = useState<StudentGroup | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  async function fetchGroups() {
    setLoading(true);
    const { data, error } = await supabase
      .from('student_groups')
      .select('id, name, description')
      .order('name');
    if (!error) setGroups(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchGroups(); }, []);

  async function fetchMembers(group: StudentGroup) {
    setMembersLoading(true);
    const { data: memberData } = await supabase
      .from('student_group_members')
      .select('id, student_id, student:students(first_name, last_name, admission_number)')
      .eq('group_id', group.id);

    const { data: studentData } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .order('first_name');

    setMembers(
      (memberData || []).map((m: any) => ({
        id: m.id,
        student_id: m.student_id,
        student: Array.isArray(m.student) ? m.student[0] : m.student,
      }))
    );
    setAllStudents(studentData || []);
    setMembersLoading(false);
  }

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(group: StudentGroup) {
    setEditTarget(group);
    setForm({ name: group.name, description: group.description || '' });
    setError(null);
    setModalOpen(true);
  }

  function openDelete(group: StudentGroup) {
    setDeleteTarget(group);
    setDeleteModalOpen(true);
  }

  function openMembers(group: StudentGroup) {
    setActiveGroup(group);
    setSearchQuery('');
    setMembersModalOpen(true);
    fetchMembers(group);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);

    if (editTarget) {
      const { error } = await supabase
        .from('student_groups')
        .update({ name: form.name.trim(), description: form.description.trim() || null })
        .eq('id', editTarget.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from('student_groups')
        .insert({ name: form.name.trim(), description: form.description.trim() || null });
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setModalOpen(false);
    fetchGroups();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('student_groups').delete().eq('id', deleteTarget.id);
    if (!error) { setDeleteModalOpen(false); fetchGroups(); }
  }

  async function addMember(student: StudentOption) {
    if (!activeGroup) return;
    const alreadyMember = members.some((m) => m.student_id === student.id);
    if (alreadyMember) return;
    setAddingMember(true);
    await supabase.from('student_group_members').insert({
      group_id: activeGroup.id,
      student_id: student.id,
    });
    setAddingMember(false);
    fetchMembers(activeGroup);
  }

  async function removeMember(member: GroupMember) {
    if (!activeGroup) return;
    await supabase.from('student_group_members').delete().eq('id', member.id);
    fetchMembers(activeGroup);
  }

  const memberIds = new Set(members.map((m) => m.student_id));
  const filteredStudents = allStudents.filter((s) =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.admission_number && s.admission_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg">
            <Users className="text-emerald-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Student Group</h1>
            <p className="text-sm text-slate-500">Manage student groups and members</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add Group
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No groups found. Add one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Description</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{group.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{group.description || <span className="italic text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openMembers(group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors"
                      >
                        <Users size={13} />
                        Members
                      </button>
                      <button
                        onClick={() => openEdit(group)}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => openDelete(group)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Group' : 'Add Group'}>
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              placeholder="e.g. Science Club, Arts Group"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full resize-none"
              rows={3}
              placeholder="Optional description..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Group">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteTarget?.name}</span>? All group members will also be removed.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-5 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={`Members — ${activeGroup?.name || ''}`}
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Current Members</h3>
            {membersLoading ? (
              <div className="text-sm text-slate-400 py-4 text-center">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No members yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {member.student ? `${member.student.first_name} ${member.student.last_name}` : 'Unknown'}
                      </p>
                      {member.student?.admission_number && (
                        <p className="text-xs text-slate-400">{member.student.admission_number}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeMember(member)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Add Students</h3>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or student ID..."
                className="border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              />
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="text-sm text-slate-400 py-4 text-center">No students found.</div>
              ) : (
                filteredStudents.map((student) => {
                  const isMember = memberIds.has(student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{student.first_name} {student.last_name}</p>
                        {student.admission_number && (
                          <p className="text-xs text-slate-400">{student.admission_number}</p>
                        )}
                      </div>
                      {isMember ? (
                        <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Added</span>
                      ) : (
                        <button
                          onClick={() => addMember(student)}
                          disabled={addingMember}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                          title="Add"
                        >
                          <UserPlus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setMembersModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
