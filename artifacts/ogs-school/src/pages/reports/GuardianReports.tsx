import { useState, useEffect } from 'react';
import { Users, UserCheck, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface GuardianRecord {
  id: string;
  full_name: string;
  class_name: string;
  section_name: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  guardian_email: string;
  address: string;
}

interface Class {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

export default function GuardianReports() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<GuardianRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    class_id: '',
    section_id: '',
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [filters]);

  useEffect(() => {
    if (filters.class_id) {
      fetchSections(filters.class_id);
    } else {
      setSections([]);
      setFilters(f => ({ ...f, section_id: '' }));
    }
  }, [filters.class_id]);

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setClasses(data);
  }

  async function fetchSections(classId: string) {
    const { data } = await supabase
      .from('sections')
      .select('id, name, class_id')
      .eq('class_id', classId)
      .order('name');
    if (data) setSections(data);
  }

  async function fetchRecords() {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, class_name, section_name, guardian_name, guardian_relation, guardian_phone, guardian_email, address')
      .eq('role', 'student')
      .eq('school_id', profile?.school_id)
      .order('full_name');

    if (filters.class_id) {
      const cls = classes.find(c => c.id === filters.class_id);
      if (cls) query = query.eq('class_name', cls.name);
    }
    if (filters.section_id) {
      const sec = sections.find(s => s.id === filters.section_id);
      if (sec) query = query.eq('section_name', sec.name);
    }

    const { data } = await query;
    setRecords(data || []);
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const withGuardianInfo = records.filter(r => r.guardian_name && r.guardian_name.trim() !== '').length;
  const uniqueFamilies = new Set(records.map(r => r.guardian_phone).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">Guardian Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <select
            value={filters.class_id}
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value, section_id: '' }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.section_id}
            onChange={e => setFilters(f => ({ ...f, section_id: e.target.value }))}
            disabled={!filters.class_id}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">All Sections</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Families</p>
              <p className="text-2xl font-bold text-app-text mt-1">{uniqueFamilies}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Students with Guardian Info</p>
              <p className="text-2xl font-bold text-app-text mt-1">{withGuardianInfo}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <UserCheck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-app-surface-alt border-b border-app-border">
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">#</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Class</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Section</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Guardian Name</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Relation</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Email</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Address</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-app-text-muted">Loading...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-app-text-muted">No records found</td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <tr key={record.id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{record.full_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.class_name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.section_name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.guardian_name || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted capitalize">{record.guardian_relation || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.guardian_phone || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.guardian_email || '-'}</td>
                    <td className="px-4 py-3 text-app-text-muted max-w-xs truncate">{record.address || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
