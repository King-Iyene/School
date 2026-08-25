import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Award, Printer, Filter, CheckSquare, Square } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  class_name: string;
}

const CERTIFICATE_TYPES = ['Achievement', 'Completion', 'Participation'];

const CertificatePrint: React.FC = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [certificateType, setCertificateType] = useState('Achievement');
  const [loading, setLoading] = useState(false);
  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (profile?.school_id) fetchClasses();
  }, [profile?.school_id]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
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
      .select('id, first_name, last_name, student_id')
      .in('id', studentIds)
      .eq('school_id', profile?.school_id)
      .eq('is_active', true);

    if (profileData) {
      setStudents(
        profileData.map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          student_id: p.student_id || '',
          class_name: classInfo ? `${classInfo.name} ${classInfo.section || ''}`.trim() : '',
        }))
      );
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
    if (selectedStudents.size === students.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map((s) => s.id)));
  };

  const handlePrint = () => window.print();

  const printableStudents = students.filter((s) => selectedStudents.has(s.id));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { margin: 0; padding: 0; }
          .cert-page {
            page-break-after: always;
            width: 100%;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .cert-page:last-child { page-break-after: auto; }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      <div className="no-print p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Award className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Bulk Certificate Print</h1>
              <p className="text-gray-500 text-sm">Generate and print certificates for students</p>
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
            <h2 className="font-semibold text-gray-700">Certificate Options</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Certificate Type</label>
              <select
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {CERTIFICATE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Filter by Class</label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Certificate Date</label>
              <input
                type="date"
                value={printDate}
                onChange={(e) => setPrintDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
              <span className="font-semibold text-gray-700">{students.length} Students</span>
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                {selectedStudents.size === students.length ? <CheckSquare size={16} /> : <Square size={16} />}
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
                      selectedStudents.has(student.id) ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
                    }`}
                  >
                    {selectedStudents.has(student.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{student.first_name} {student.last_name}</p>
                    <p className="text-xs text-gray-500">ID: {student.student_id} &bull; {student.class_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="print-area">
        {printableStudents.map((student) => (
          <div key={student.id} className="cert-page">
            <div
              style={{
                width: '720px',
                border: '8px solid #059669',
                borderRadius: '16px',
                padding: '48px',
                textAlign: 'center',
                fontFamily: 'Georgia, serif',
                position: 'relative',
                background: 'white',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '12px',
                  border: '2px solid #6ee7b7',
                  borderRadius: '10px',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ marginBottom: '16px' }}>
                <Award
                  size={48}
                  style={{ margin: '0 auto 8px', color: '#059669' }}
                />
              </div>
              <h1 style={{ fontSize: '14px', letterSpacing: '4px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>
                Greenfield Academy
              </h1>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#059669', marginBottom: '8px' }}>
                Certificate of {certificateType}
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>This is to certify that</p>
              <p
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  borderBottom: '2px solid #059669',
                  display: 'inline-block',
                  paddingBottom: '4px',
                  marginBottom: '24px',
                }}
              >
                {student.first_name} {student.last_name}
              </p>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                Student ID: <strong>{student.student_id}</strong> &nbsp;&bull;&nbsp; Class: <strong>{student.class_name}</strong>
              </p>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '32px', lineHeight: '1.6' }}>
                has successfully demonstrated excellence and is hereby awarded this<br />
                <em>Certificate of {certificateType}</em>
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #374151', width: '140px', marginBottom: '4px' }}></div>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>Form Master</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{formatDate(printDate)}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>Date</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #374151', width: '140px', marginBottom: '4px' }}></div>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>Principal</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CertificatePrint;
