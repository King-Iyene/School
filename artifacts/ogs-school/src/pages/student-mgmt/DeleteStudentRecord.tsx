import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Search, Trash2, AlertTriangle, UserX, RefreshCw, CheckCircle } from 'lucide-react';

interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  phone: string;
  gender: string;
  is_active: boolean;
}

const DeleteStudentRecord: React.FC = () => {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentProfile[]>([]);
  const [recentlyDisabled, setRecentlyDisabled] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (profile?.school_id) fetchRecentlyDisabled();
  }, [profile?.school_id]);

  const fetchRecentlyDisabled = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, email, phone, gender, status')
      .eq('school_id', profile?.school_id)
      .eq('status', 'disabled')
      .order('last_name')
      .limit(20);
    if (data) setRecentlyDisabled(data.map((s: any) => ({ ...s, student_id: s.admission_number, is_active: s.status === 'active' })));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);

    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, email, phone, gender, status')
      .eq('school_id', profile?.school_id)
      .eq('status', 'active')
      .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`)
      .limit(10);

    setSearchResults((data || []).map((s: any) => ({ ...s, student_id: s.admission_number, is_active: s.status === 'active' })));
    setSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelectStudent = (student: StudentProfile) => {
    setSelectedStudent(student);
    setShowConfirm(true);
  };

  const handleSoftDelete = async () => {
    if (!selectedStudent) return;
    setLoading(true);

    const { error } = await supabase
      .from('students')
      .update({ status: 'disabled' })
      .eq('id', selectedStudent.id)
      .eq('school_id', profile?.school_id);

    setLoading(false);
    setShowConfirm(false);

    if (!error) {
      setSuccessMsg(`${selectedStudent.first_name} ${selectedStudent.last_name} has been deactivated.`);
      setSelectedStudent(null);
      setSearchResults((prev) => prev.filter((s) => s.id !== selectedStudent.id));
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchRecentlyDisabled();
    }
  };

  const handleReactivate = async (studentId: string) => {
    await supabase
      .from('students')
      .update({ status: 'active' })
      .eq('id', studentId)
      .eq('school_id', profile?.school_id);
    fetchRecentlyDisabled();
  };

  return (
    <div className="min-h-screen bg-app-surface-alt p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-red-100 p-2 rounded-lg">
            <UserX className="text-red-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-app-text">Delete Student Record</h1>
            <p className="text-app-text-muted text-sm">Deactivate student accounts (soft delete - data is preserved)</p>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-5">
            <CheckCircle size={18} className="text-emerald-500" />
            <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
          </div>
        )}

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5 mb-6">
          <h2 className="font-semibold text-app-text mb-4">Search Student</h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-2.5 text-app-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name or student ID..."
                className="bg-app-surface text-app-text w-full pl-9 pr-4 py-2 border border-app-border rounded-lg text-sm focus:ring-2 focus:ring-app-primary focus:border-emerald-500 outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-2 bg-app-primary text-white px-5 py-2 rounded-lg hover:opacity-90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {searching ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 divide-y divide-gray-50 border border-app-border rounded-lg overflow-hidden">
              {searchResults.map((student) => (
                <div key={student.id} className="flex items-center gap-4 px-4 py-3 hover:bg-app-surface-alt">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-app-text">{student.first_name} {student.last_name}</p>
                    <p className="text-xs text-app-text-muted">
                      ID: {student.student_id || 'N/A'} &bull; {student.email || 'No email'} &bull; {student.gender || 'N/A'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectStudent(student)}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <Trash2 size={13} />
                    Deactivate
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searching && searchQuery && searchResults.length === 0 && (
            <p className="text-sm text-app-text-muted mt-4 text-center">No active students found matching your search.</p>
          )}
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
            <h2 className="font-semibold text-app-text">Recently Deactivated Students</h2>
            <button
              onClick={fetchRecentlyDisabled}
              className="text-sm text-emerald-600 hover:text-emerald-800 flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
          {recentlyDisabled.length === 0 ? (
            <div className="py-10 text-center text-app-text-muted">
              <UserX size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No deactivated students found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentlyDisabled.map((student) => (
                <div key={student.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-app-text-muted font-bold text-sm flex-shrink-0">
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-app-text">{student.first_name} {student.last_name}</p>
                    <p className="text-xs text-app-text-muted">ID: {student.student_id || 'N/A'} &bull; {student.email || 'No email'}</p>
                  </div>
                  <span className="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-full font-medium">Deactivated</span>
                  <button
                    onClick={() => handleReactivate(student.id)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Reactivate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showConfirm && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-app-surface rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-semibold text-app-text text-lg">Confirm Deactivation</h3>
            </div>
            <div className="bg-app-surface-alt rounded-lg p-4 mb-4">
              <p className="font-semibold text-app-text mb-1">{selectedStudent.first_name} {selectedStudent.last_name}</p>
              <p className="text-sm text-app-text-muted">Student ID: {selectedStudent.student_id || 'N/A'}</p>
              <p className="text-sm text-app-text-muted">Email: {selectedStudent.email || 'N/A'}</p>
            </div>
            <p className="text-sm text-app-text-muted mb-2">
              This will set the student's account to <strong>inactive</strong>. Their data will be preserved and can be restored.
            </p>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                This is a soft delete. Student records, enrollments, and exam data are not deleted.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm border border-app-border rounded-lg text-app-text-muted hover:bg-app-surface-alt transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSoftDelete}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Deactivate Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteStudentRecord;
