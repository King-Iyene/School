import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { Printer, Filter, CheckSquare, Square, Users } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  level: string;
  section: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  avatar_url: string | null;
  class_name: string;
}

const IDCardPrint: React.FC = () => {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState('2024/2025');

  useEffect(() => {
    if (profile?.school_id) {
      fetchClasses();
    }
  }, [profile?.school_id]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, section')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setClasses(data);
  };

  const fetchStudents = async (classId: string) => {
    setLoading(true);
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('status', 'active');

    if (!enrollments || enrollments.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const studentIds = enrollments.map((e) => e.student_id);
    const classInfo = classes.find((c) => c.id === classId);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, student_id, avatar_url')
      .in('id', studentIds)
      .eq('school_id', profile?.school_id)
      .eq('is_active', true);

    if (profileData) {
      const mapped = profileData.map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        student_id: p.student_id || '',
        avatar_url: p.avatar_url,
        class_name: classInfo ? `${classInfo.name} ${classInfo.section || ''}`.trim() : '',
      }));
      setStudents(mapped);
    }
    setLoading(false);
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setSelectedStudents(new Set());
    if (classId) fetchStudents(classId);
    else setStudents([]);
  };

  const toggleStudent = (id: string) => {
    const updated = new Set(selectedStudents);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedStudents(updated);
  };

  const toggleAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getInitials = (first: string, last: string) =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  const printableStudents = students.filter((s) => selectedStudents.has(s.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { margin: 0; padding: 0; }
          .id-card-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            padding: 16px;
          }
          .id-card {
            border: 2px solid #1a3a5c;
            border-radius: 8px;
            overflow: hidden;
            page-break-inside: avoid;
            background: white;
          }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      <div className="no-print p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Printer className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Bulk ID Card Print</h1>
              <p className="text-gray-500 text-sm">Print student ID cards in bulk</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={selectedStudents.size === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Printer size={18} />
            Print Selected ({selectedStudents.size})
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-700">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Session</label>
              <input
                type="text"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="e.g. 2024/2025"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        )}

        {!loading && students.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <span className="font-semibold text-gray-700">{students.length} Students Found</span>
              </div>
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                {selectedStudents.size === students.length ? (
                  <CheckSquare size={16} />
                ) : (
                  <Square size={16} />
                )}
                {selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleStudent(student.id)}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedStudents.has(student.id)
                        ? 'bg-emerald-600 border-emerald-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedStudents.has(student.id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {getInitials(student.first_name, student.last_name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      ID: {student.student_id} &bull; {student.class_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && selectedClass && students.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p>No students found for this class.</p>
          </div>
        )}
      </div>

      <div className="print-area">
        <div className="id-card-grid">
          {printableStudents.map((student) => (
            <div key={student.id} className="id-card" style={{ fontFamily: "'Arial', sans-serif" }}>
              <div style={{ background: settings.primary_color || '#1a3a5c', color: 'white', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={settings.logo_url || '/default-logo.png'} alt={settings.school_name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <div>
                  <p style={{ fontWeight: '900', fontSize: '10px', letterSpacing: '0.5px', lineHeight: 1.1 }}>{settings.school_name.toUpperCase()}</p>
                  {settings.motto && <p style={{ fontSize: '7px', opacity: 0.85, fontStyle: 'italic' }}>{settings.motto}</p>}
                </div>
              </div>
              <div style={{ background: settings.secondary_color || '#1a6b3a', height: '2px' }} />
              <div style={{ padding: '8px 10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '48px', height: '56px', borderRadius: '4px', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: '#1a3a5c', border: '1px solid #1a3a5c', flexShrink: 0 }}>
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    getInitials(student.first_name, student.last_name)
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 'bold', fontSize: '11px', color: '#1a1a1a', marginBottom: '3px' }}>{student.first_name} {student.last_name}</p>
                  <p style={{ fontSize: '9px', color: '#555', marginBottom: '1px' }}>ID: <span style={{ fontWeight: '600', color: '#1a3a5c' }}>{student.student_id}</span></p>
                  <p style={{ fontSize: '9px', color: '#555', marginBottom: '1px' }}>Class: <span style={{ fontWeight: '600' }}>{student.class_name}</span></p>
                  <p style={{ fontSize: '9px', color: '#555' }}>Session: <span style={{ fontWeight: '600' }}>{session}</span></p>
                </div>
              </div>
              <div style={{ background: '#f0f4f8', borderTop: '1px solid #ddd', padding: '4px 10px', textAlign: 'center', fontSize: '7.5px', color: '#555' }}>
                {[settings.phone && `Tel: ${settings.phone}`, settings.email].filter(Boolean).join(' | ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IDCardPrint;
