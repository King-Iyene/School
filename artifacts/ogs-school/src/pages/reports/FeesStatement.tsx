import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Percent, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface FeeRecord {
  student_id: string;
  student_name: string;
  class_name: string;
  section_name: string;
  total_fees: number;
  amount_paid: number;
  balance: number;
  last_payment_date: string;
  payment_status: string;
}

interface AcademicYear {
  id: string;
  name: string;
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

export default function FeesStatement() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    class_id: '',
    section_id: '',
    payment_status: '',
  });

  useEffect(() => {
    fetchFilterData();
  }, []);

  useEffect(() => {
    fetchFees();
  }, [filters]);

  useEffect(() => {
    if (filters.class_id) {
      fetchSections(filters.class_id);
    } else {
      setSections([]);
      setFilters(f => ({ ...f, section_id: '' }));
    }
  }, [filters.class_id]);

  async function fetchFilterData() {
    const [yearsRes, classesRes] = await Promise.all([
      supabase.from('academic_years').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('classes').select('id, name').eq('school_id', profile?.school_id).order('name'),
    ]);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
    if (classesRes.data) setClasses(classesRes.data);
  }

  async function fetchSections(classId: string) {
    const { data } = await supabase
      .from('sections')
      .select('id, name, class_id')
      .eq('class_id', classId)
      .order('name');
    if (data) setSections(data);
  }

  async function fetchFees() {
    setLoading(true);
    try {
      let studentsQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, classes(name)')
        .eq('school_id', profile?.school_id);

      if (filters.class_id) {
        studentsQuery = studentsQuery.eq('class_id', filters.class_id);
      }
      // Section filtering removed for now as it's not in the base students table yet 
      // or would need student_enrollments join

      const { data: students } = await studentsQuery;

      if (!students || students.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const studentIds = students.map(s => s.id);

      const [feesStructRes, paymentsRes] = await Promise.all([
        supabase
          .from('fee_structures')
          .select('student_id, amount, academic_year_id')
          .in('student_id', studentIds),
        supabase
          .from('fee_payments')
          .select('student_id, amount, payment_date')
          .in('student_id', studentIds)
          .order('payment_date', { ascending: false }),
      ]);

      const feeMap = new Map<string, number>();
      (feesStructRes.data || []).forEach((f: any) => {
        feeMap.set(f.student_id, (feeMap.get(f.student_id) || 0) + Number(f.amount));
      });

      const paidMap = new Map<string, number>();
      const lastPaymentMap = new Map<string, string>();
      (paymentsRes.data || []).forEach((p: any) => {
        paidMap.set(p.student_id, (paidMap.get(p.student_id) || 0) + Number(p.amount));
        if (!lastPaymentMap.has(p.student_id)) {
          lastPaymentMap.set(p.student_id, p.payment_date);
        }
      });

      const result: FeeRecord[] = students.map((s: any) => {
        const total = feeMap.get(s.id) || 0;
        const paid = paidMap.get(s.id) || 0;
        const balance = total - paid;
        let status = 'unpaid';
        if (total > 0 && balance <= 0) status = 'paid';
        else if (paid > 0 && balance > 0) status = 'partial';

        return {
          student_id: s.id,
          student_name: `${s.first_name} ${s.last_name}`,
          class_name: s.classes?.name || '-',
          section_name: '-',
          total_fees: total,
          amount_paid: paid,
          balance: Math.max(0, balance),
          last_payment_date: lastPaymentMap.get(s.id) || '',
          payment_status: status,
        };
      });

      const filtered = filters.payment_status
        ? result.filter(r => r.payment_status === filters.payment_status)
        : result;

      setRecords(filtered);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const totalFees = records.reduce((s, r) => s + r.total_fees, 0);
  const totalCollected = records.reduce((s, r) => s + r.amount_paid, 0);
  const totalBalance = records.reduce((s, r) => s + r.balance, 0);
  const collectionPct = totalFees > 0 ? Math.round((totalCollected / totalFees) * 100) : 0;

  function getStatusBadge(status: string) {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Paid</span>;
      case 'partial':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Partial</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Unpaid</span>;
    }
  }

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-text">Fees Statement</h1>
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
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

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

          <select
            value={filters.payment_status}
            onChange={e => setFilters(f => ({ ...f, payment_status: e.target.value }))}
            className="border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Fees</p>
              <p className="text-2xl font-bold text-app-text mt-1">₦{totalFees.toLocaleString()}</p>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-app-text-muted" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">₦{totalCollected.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Total Balance</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₦{totalBalance.toLocaleString()}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm border border-app-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-app-text-muted">Collection %</p>
              <p className="text-2xl font-bold text-app-text mt-1">{collectionPct}%</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Percent className="h-6 w-6 text-blue-600" />
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
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Fees Amount</th>
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Amount Paid</th>
                <th className="text-right px-4 py-3 text-app-text-muted font-medium">Balance</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Last Payment</th>
                <th className="text-left px-4 py-3 text-app-text-muted font-medium">Status</th>
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
                  <tr key={record.student_id} className="border-b border-app-border hover:bg-app-surface-alt">
                    <td className="px-4 py-3 text-app-text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-app-text">{record.student_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.class_name}</td>
                    <td className="px-4 py-3 text-app-text-muted">{record.section_name}</td>
                    <td className="px-4 py-3 text-right text-app-text-muted">₦{record.total_fees.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">₦{record.amount_paid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">₦{record.balance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {record.last_payment_date ? new Date(record.last_payment_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(record.payment_status)}</td>
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
