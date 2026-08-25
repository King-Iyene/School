import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, Users, DollarSign, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';

export default function Reports() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, totalFees: 0, attendance: 0 });
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [feesByClass, setFeesByClass] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, [profile]);

  async function loadReports() {
    if (!profile?.school_id) return;
    setLoading(true);
    const [studRes, teachRes, feeRes, attRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('school_id', profile.school_id),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('school_id', profile.school_id),
      supabase.from('fee_payments').select('amount_paid').eq('school_id', profile.school_id).eq('status', 'paid'),
      supabase.from('student_attendance').select('id', { count: 'exact', head: true }).in('class_id',
        (await supabase.from('classes').select('id').eq('school_id', profile.school_id)).data?.map(c => c.id) ?? []
      ).eq('status', 'present'),
    ]);

    const totalFees = (feeRes.data ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
    setStats({ students: studRes.count ?? 0, teachers: teachRes.count ?? 0, totalFees, attendance: attRes.count ?? 0 });

    const { data: gradeData } = await supabase.from('grades').select('student_id, total_score, students!student_id(first_name, last_name)').eq('academic_year_id',
      (await supabase.from('academic_years').select('id').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle()).data?.id ?? ''
    ).order('total_score', { ascending: false }).limit(10);

    const topMap: Record<string, { name: string, totalScore: number, count: number }> = {};
    (gradeData ?? []).forEach(g => {
      const s = Array.isArray(g.students) ? g.students[0] : g.students;
      if (!topMap[g.student_id]) topMap[g.student_id] = { name: `${s?.first_name || ''} ${s?.last_name || ''}`, totalScore: 0, count: 0 };
      topMap[g.student_id].totalScore += g.total_score || 0;
      topMap[g.student_id].count++;
    });
    const sorted = Object.values(topMap).map(v => ({ ...v, avg: v.count > 0 ? Math.round(v.totalScore / v.count) : 0 })).sort((a, b) => b.avg - a.avg).slice(0, 5);
    setTopStudents(sorted);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Reports & Analytics</h2>
        <p className="text-slate-500 text-sm">School performance overview and statistics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={stats.students} icon={Users} color="emerald" />
        <StatCard title="Teachers" value={stats.teachers} icon={UserCheck} color="blue" />
        <StatCard title="Fees Collected" value={`₦${stats.totalFees.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatCard title="Attendance Records" value={stats.attendance} icon={TrendingUp} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Top Performing Students</h3>
            <p className="text-xs text-slate-500 mt-0.5">Based on average grade scores this academic year</p>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-5 text-center text-slate-400 text-sm">Loading...</div>
            ) : topStudents.length === 0 ? (
              <div className="p-5 text-center text-slate-400 text-sm">No grade data available</div>
            ) : topStudents.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${s.avg}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-12 text-right">{s.avg}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">School Summary</h3>
          <div className="space-y-4">
            {[
              { label: 'Student-Teacher Ratio', value: stats.teachers > 0 ? `${Math.round(stats.students / stats.teachers)}:1` : 'N/A', color: 'bg-emerald-500' },
              { label: 'Total Attendance Records', value: stats.attendance.toLocaleString(), color: 'bg-blue-500' },
              { label: 'Total Revenue Collected', value: `₦${stats.totalFees.toLocaleString()}`, color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 ${item.color} rounded-full`} />
                  <p className="text-sm text-slate-600">{item.label}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
