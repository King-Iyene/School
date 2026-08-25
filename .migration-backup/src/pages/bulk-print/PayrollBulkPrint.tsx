import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Printer, DollarSign, Filter, CheckSquare, Square, Users } from 'lucide-react';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  staff_id: string;
  role: string;
  basic_salary: number;
}

interface PayslipData extends StaffMember {
  allowances: number;
  deductions: number;
  net_pay: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PayrollBulkPrint: React.FC = () => {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<PayslipData[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    if (profile?.school_id) fetchStaff();
  }, [profile?.school_id]);

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, staff_id, role, basic_salary')
      .eq('school_id', profile?.school_id)
      .in('role', ['teacher', 'staff', 'admin'])
      .eq('is_active', true)
      .order('first_name');

    if (data) {
      const mapped: PayslipData[] = data.map((s) => {
        const basic = Number(s.basic_salary) || 0;
        const allowances = Math.round(basic * 0.1);
        const deductions = Math.round(basic * 0.05);
        return {
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          staff_id: s.staff_id || '',
          role: s.role,
          basic_salary: basic,
          allowances,
          deductions,
          net_pay: basic + allowances - deductions,
        };
      });
      setStaff(mapped);
    }
    setLoading(false);
  };

  const toggleStaff = (id: string) => {
    const updated = new Set(selectedStaff);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedStaff(updated);
  };

  const toggleAll = () => {
    if (selectedStaff.size === staff.length) setSelectedStaff(new Set());
    else setSelectedStaff(new Set(staff.map((s) => s.id)));
  };

  const handlePrint = () => window.print();

  const printableStaff = staff.filter((s) => selectedStaff.has(s.id));

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { margin: 0; padding: 0; }
          .payslip-page {
            page-break-after: always;
            padding: 32px;
          }
          .payslip-page:last-child { page-break-after: auto; }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      <div className="no-print p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <DollarSign className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Payroll Bulk Print</h1>
              <p className="text-gray-500 text-sm">Print payroll slips for staff</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={selectedStaff.size === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Printer size={18} />
            Print Selected ({selectedStaff.size})
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-700">Pay Period</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
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

        {!loading && staff.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <span className="font-semibold text-gray-700">{staff.length} Staff Members</span>
              </div>
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                {selectedStaff.size === staff.length ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedStaff.size === staff.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10"></th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff ID</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Basic</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Allowance</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Deduction</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {staff.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleStaff(s.id)}
                    >
                      <td className="px-5 py-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedStaff.has(s.id) ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
                          }`}
                        >
                          {selectedStaff.has(s.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{s.first_name} {s.last_name}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{s.staff_id || '-'}</td>
                      <td className="px-5 py-3">
                        <span className="capitalize text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                          {s.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-gray-700">${fmt(s.basic_salary)}</td>
                      <td className="px-5 py-3 text-sm text-right text-green-600">+${fmt(s.allowances)}</td>
                      <td className="px-5 py-3 text-sm text-right text-red-500">-${fmt(s.deductions)}</td>
                      <td className="px-5 py-3 text-sm text-right font-semibold text-emerald-700">${fmt(s.net_pay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="print-area">
        {printableStaff.map((s) => (
          <div key={s.id} className="payslip-page">
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ background: '#059669', color: 'white', padding: '20px 24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '2px' }}>Greenfield Academy</h2>
                <p style={{ fontSize: '13px', opacity: 0.85 }}>Payslip for {selectedMonth} {selectedYear}</p>
              </div>
              <div style={{ padding: '24px', background: 'white' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Employee Name</p>
                    <p style={{ fontWeight: 'bold', fontSize: '15px' }}>{s.first_name} {s.last_name}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Staff ID</p>
                    <p style={{ fontWeight: 'bold', fontSize: '15px' }}>{s.staff_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Role</p>
                    <p style={{ fontWeight: '600', fontSize: '13px', textTransform: 'capitalize' }}>{s.role}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Pay Period</p>
                    <p style={{ fontWeight: '600', fontSize: '13px' }}>{selectedMonth} {selectedYear}</p>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontSize: '13px' }}>Basic Salary</td>
                      <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right' }}>${fmt(s.basic_salary)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontSize: '13px', color: '#16a34a' }}>Allowances (10%)</td>
                      <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right', color: '#16a34a' }}>+${fmt(s.allowances)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontSize: '13px', color: '#dc2626' }}>Deductions (5%)</td>
                      <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right', color: '#dc2626' }}>-${fmt(s.deductions)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f0fdf4' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '14px', color: '#059669' }}>Net Pay</td>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '14px', textAlign: 'right', color: '#059669' }}>${fmt(s.net_pay)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', borderTop: '1px dashed #e5e7eb', paddingTop: '12px' }}>
                  This is a computer-generated payslip and does not require a signature.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PayrollBulkPrint;
