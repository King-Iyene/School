import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Printer, FileText, Filter, CheckSquare, Square } from 'lucide-react';

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface TermOption {
  id: string;
  name?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  class_name: string;
}

interface FeeItem {
  name: string;
  amount: number;
}

interface InvoiceSettings {
  schoolName: string;
  address: string;
  sessionName: string;
  feeItems: FeeItem[];
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  schoolName: 'Greenfield Academy',
  address: '123 School Lane, Education City',
  sessionName: '2024/2025',
  feeItems: [
    { name: 'School Fees', amount: 500 },
    { name: 'Development Levy', amount: 100 },
    { name: 'Library Fee', amount: 50 },
  ],
};

const FeesInvoicePrint: React.FC = () => {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (profile?.school_id) {
      fetchClasses();
      fetchTerms();
    }
    const saved = localStorage.getItem('feesInvoiceSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {}
    }
  }, [profile?.school_id]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('school_id', profile?.school_id)
      .order('name');
    if (data) setClasses(data);
  };

  const fetchTerms = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name')
      .eq('school_id', profile?.school_id)
      .order('start_date', { ascending: false });
    if (data) setTerms(data.map((d) => ({ id: d.id, name: d.name })));
  };

  const fetchStudents = async (classId: string, termId: string) => {
    if (!classId) return;
    setLoading(true);

    const query = supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('status', 'active');

    if (termId) query.eq('academic_year_id', termId);

    const { data: enrollments } = await query;

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

  const handleFilter = (classId: string, termId: string) => {
    fetchStudents(classId, termId);
    setSelectedStudents(new Set());
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
  const total = settings.feeItems.reduce((sum, item) => sum + item.amount, 0);
  const termLabel = terms.find((t) => t.id === selectedTerm)?.name || 'Current Term';

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { margin: 0; padding: 0; }
          .invoice-page {
            page-break-after: always;
            padding: 24px;
          }
          .invoice-page:last-child { page-break-after: auto; }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      <div className="no-print p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <FileText className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Fees Invoice Bulk Print</h1>
              <p className="text-gray-500 text-sm">Print fee invoices for students</p>
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
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  handleFilter(e.target.value, selectedTerm);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Academic Year / Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => {
                  setSelectedTerm(e.target.value);
                  handleFilter(selectedClass, e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="">All Terms</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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
          <div key={student.id} className="invoice-page">
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', maxWidth: '650px', margin: '0 auto' }}>
              <div style={{ background: '#059669', color: 'white', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '2px' }}>{settings.schoolName}</h2>
                  <p style={{ fontSize: '12px', opacity: 0.85 }}>{settings.address}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '18px', fontWeight: 'bold' }}>INVOICE</p>
                  <p style={{ fontSize: '12px', opacity: 0.85 }}>Session: {settings.sessionName}</p>
                </div>
              </div>
              <div style={{ padding: '20px 28px', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                  <strong>Student:</strong> {student.first_name} {student.last_name}
                </p>
                <p style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                  <strong>Student ID:</strong> {student.student_id}
                </p>
                <p style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                  <strong>Class:</strong> {student.class_name}
                </p>
                <p style={{ fontSize: '13px', color: '#374151' }}>
                  <strong>Term:</strong> {termLabel}
                </p>
              </div>
              <div style={{ padding: '20px 28px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.feeItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', fontSize: '13px' }}>{item.name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right' }}>${fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f0fdf4' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '14px', color: '#059669' }}>Total Due</td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '14px', textAlign: 'right', color: '#059669' }}>${fmt(total)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', borderTop: '1px dashed #e5e7eb', paddingTop: '12px' }}>
                  Please make payment to the school bursary. This invoice is valid for 30 days.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeesInvoicePrint;
