import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { UserX, Plus, Trash2, RefreshCw, Search, AlertCircle } from 'lucide-react';

interface ClassRoom {
  id: string;
  name: string;
}

interface DisabledStudent {
  id: string;
  student_id: string;
  reason: string | null;
  disabled_at: string | null;
  is_disabled: boolean;
  reactivated_at: string | null;
  student?: {
    first_name: string;
    last_name: string;
    admission_number: string;
  } | null;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

export default function DisabledStudents() {
  const { user } = useAuth();

  const [records, setRecords] = useState<DisabledStudent[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisabledStudent | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function fetchRecords() {
    setLoading(true);
    let query = supabase
      .from('disabled_students')
      .select('id, student_id, reason, disabled_at, is_disabled, reactivated_at, student:students(first_name, last_name, admission_number)')
      .order('disabled_at', { ascending: false });

    if (filterClass) {
      const { data: enrolled } = await supabase
        .from('student_enrollments')
        .select('student_id')
        .eq('class_id', filterClass);
      const ids = (enrolled || []).map((e: { student_id: string }) => e.student_id);
      if (ids.length > 0) {
        query = query.in('student_id', ids);
      } else {
        setRecords([]);
        setLoading(false);
        return;
      }
    }

    const { data, error } = await query;
    if (!error) {
      setRecords(
        (data || []).map((row: any) => ({
          ...row,
          student: Array.isArray(row.student) ? row.student[0] : row.student,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    async function loadClasses() {
      const { data } = await supabase.from('classes').select('id, name').order('name');
      setClasses(data || []);
    }
    loadClasses();
  }, []);

  useEffect(() => { fetchRecords(); }, [filterClass]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number')
      .or(`first_name.ilike.%${q.trim()}%,last_name.ilike.%${q.trim()}%,admission_number.ilike.%${q.trim()}%`)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  }

  function selectStudent(student: StudentOption) {
    setSelectedStudent(student);
    setSearchQuery(`${student.first_name} ${student.last_name}`);
    setSearchResults([]);
  }

  function openAdd() {
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    setReason('');
    setError(null);
    setAddModalOpen(true);
  }

  async function handleAdd() {
    if (!selectedStudent) { setError('Please select a student.'); return; }
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('disabled_students').insert({
      student_id: selectedStudent.id,
      reason: reason.trim() || null,
      disabled_at: new Date().toISOString(),
      is_disabled: true,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setSaving(false);
    setAddModalOpen(false);
    fetchRecords();
  }

  async function handleReactivate(record: DisabledStudent) {
    await supabase
      .from('disabled_students')
      .update({ is_disabled: false, reactivated_at: new Date().toISOString() })
      .eq('id', record.id);
    fetchRecords();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('disabled_students').delete().eq('id', deleteTarget.id);
    setDeleteModalOpen(false);
    fetchRecords();
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-2 rounded-lg">
            <UserX className="text-red-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Disabled Students</h1>
            <p className="text-sm text-slate-500">Manage disabled student records</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add Record
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Filter by Class</label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchRecords}
          className="mt-5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <UserX size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No disabled student records found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Student Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Student ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Reason</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Disabled At</th>
                <th className="text-center px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800">
                    {record.student ? `${record.student.first_name} ${record.student.last_name}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {record.student?.admission_number || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 max-w-xs">
                    {record.reason ? (
                      <span className="truncate block max-w-[200px]" title={record.reason}>{record.reason}</span>
                    ) : (
                      <span className="italic text-slate-300">No reason</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(record.disabled_at)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {record.is_disabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {record.is_disabled && (
                        <button
                          onClick={() => handleReactivate(record)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors"
                          title="Reactivate"
                        >
                          <RefreshCw size={12} />
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteTarget(record); setDeleteModalOpen(true); }}
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

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Disabled Student Record">
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Student <span className="text-red-500">*</span></label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search student by name..."
                className="border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 text-sm border-b border-slate-100 last:border-0"
                    >
                      <span className="font-medium text-slate-800">{s.first_name} {s.last_name}</span>
                      {s.admission_number && <span className="ml-2 text-xs text-slate-400">{s.admission_number}</span>}
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
                  Searching...
                </div>
              )}
            </div>
            {selectedStudent && (
              <div className="mt-2 flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-lg">
                <span className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</span>
                {selectedStudent.admission_number && <span className="text-emerald-500">({selectedStudent.admission_number})</span>}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 w-full resize-none"
              rows={3}
              placeholder="Reason for disabling this student..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add Record'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Record">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete the disabled record for{' '}
            <span className="font-semibold text-slate-800">{deleteTarget?.student ? `${deleteTarget.student.first_name} ${deleteTarget.student.last_name}` : 'Unknown'}</span>? This action cannot be undone.
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
    </div>
  );
}
