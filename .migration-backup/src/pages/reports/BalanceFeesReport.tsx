import { useState, useEffect } from 'react';
import { AlertCircle, Users, TrendingDown, Award, Download, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface BalanceRecord {
  student_id: string;
  student_name: string;
  class_name: string;
  section_name: string;
  total_fees: number;
  paid_amount: number;
  balance: number;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
}

export default function BalanceFeesReport() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<BalanceRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [filters, setFilters] = useState({
    academic_year_id: '',
    class_id: '',
    min_balance: '',
  });

  useEffect(() => {
    fetchFilterData();
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [filters]);

  async function fetchFilterData() {
    const [yearsRes, classesRes] = await Promise.all([
      supabase.from('academic_years').select('id, name').eq('school_id', profile?.school_id).order('name'),
      supabase.from('classes').select('id, name').eq('school_id', profile?.school_id).order('name'),
    ]);
    if (yearsRes.data) setAcademicYears(yearsRes.data);
    if (classesRes.data) setClasses(classesRes.data);
  }

  async function fetchBalances() {
    setLoading(true);
    try {
      let studentsQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, classes(name)')
        .eq('school_id', profile?.school_id);

      if (filters.class_id) {
        studentsQuery = studentsQuery.eq('class_id', filters.class_id);
      }

      const { data: students } = await studentsQuery;
      if (!students || students.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const studentIds = students.map(s => s.id);

      const [feesStructRes, paymentsRes] = await Promise.all([
        supabase.from('fee_structures').select('student_id, amount').in('student_id', studentIds),
        supabase.from('fee_payments').select('student_id, amount').in('student_id', studentIds),
      ]);

      const feeMap = new Map<string, number>();
      (feesStructRes.data || []).forEach((f: any) => {
        feeMap.set(f.student_id, (feeMap.get(f.student_id) || 0) + Number(f.amount));
      });

      const paidMap = new Map<string, number>();
      (paymentsRes.data || []).forEach((p: any) => {
        paidMap.set(p.student_id, (paidMap.get(p.student_id) || 0) + Number(p.amount));
      });

      const minBal = filters.min_balance ? Number(filters.min_balance) : 0;

      const result: BalanceRecord[] = students
        .map((s: any) => {
          const total = feeMap.get(s.id) || 0;
          const paid = paidMap.get(s.id) || 0;
          const balance = Math.max(0, total - paid);
          return {
            student_id: s.id,
            student_name: `${s.first_name} ${s.last_name}`,
            class_name: s.classes?.name || '-',
            section_name: '-', // Will add section logic if needed
            total_fees: total,
            paid_amount: paid,
            balance,
          };
        })
        .filter(r => r.balance > 0 && r.balance >= minBal)
        .sort((a, b) => b.balance - a.balance);

      setRecords(result);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }

  function handleExport() {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const totalOutstanding = records.reduce((s, r) => s + r.balance, 0);
  const highestBalance = records[0];

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="h-5 w-5" />
          <span>Report exported successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Balance Fees Report</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.academic_year_id}
            onChange={e => setFilters(f => ({ ...f, academic_year_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Academic Years</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>

          <select
            value={filters.class_id}
            onChange={e => setFilters(f => ({ ...f, class_id: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Minimum Balance (₦)"
            value={filters.min_balance}
            onChange={e => setFilters(f => ({ ...f, min_balance: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₦{totalOutstanding.toLocaleString()}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Students with Balance</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{records.length}</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Highest Balance</p>
              <p className="text-base font-bold text-slate-800 mt-1 truncate">{highestBalance?.student_name || '-'}</p>
              {highestBalance && (
                <p className="text-sm text-red-600 font-medium">₦{highestBalance.balance.toLocaleString()}</p>
              )}
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Award className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-slate-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Student Name</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Class</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Section</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Total Fees</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Paid Amount</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-slate-300" />
                      <p>No outstanding balances found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <tr key={record.student_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{record.student_name}</td>
                    <td className="px-4 py-3 text-slate-600">{record.class_name}</td>
                    <td className="px-4 py-3 text-slate-600">{record.section_name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">₦{record.total_fees.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">₦{record.paid_amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-red-600">₦{record.balance.toLocaleString()}</span>
                    </td>
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
