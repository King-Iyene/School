import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Users, CreditCard, AlertCircle } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import DashboardCalendar from '../../components/dashboard/DashboardCalendar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenantSettings } from '../../context/TenantContext';
import { navigate } from '../../components/hooks/useLocation';
import TodoWidget from '../../components/dashboard/TodoWidget';
import RequisitionStatusWidget from '../../components/dashboard/RequisitionStatusWidget';


export default function AccountantDashboard() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();
  const [stats, setStats] = useState({ totalCollected: 0, pendingCount: 0, students: 0, todayCollections: 0 });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.school_id) return;
      const today = new Date().toISOString().split('T')[0];
      const [paidRes, pendingRes, studentRes, todayRes, recentRes, unifiedPaidRes, unifiedTodayRes, unifiedRecentRes] = await Promise.all([
        supabase.from('fee_payments').select('amount_paid').eq('school_id', profile.school_id).eq('status', 'paid'),
        supabase.from('fee_payments').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).in('status', ['pending', 'overdue']),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('role', 'student'),
        supabase.from('fee_payments').select('amount_paid').eq('school_id', profile.school_id).gte('payment_date', today).eq('status', 'paid'),
        supabase.from('fee_payments').select('*, students!student_id(first_name, last_name), fee_structures(name)').eq('school_id', profile.school_id).order('payment_date', { ascending: false }).limit(5),
        supabase.from('fees_collections').select('amount_paid').eq('school_id', profile.school_id),
        supabase.from('fees_collections').select('amount_paid').eq('school_id', profile.school_id).gte('payment_date', today),
        supabase.from('fees_collections').select('*, students!student_id(first_name, last_name), fees_master(fees_types(name))').eq('school_id', profile.school_id).order('payment_date', { ascending: false }).limit(5),
      ]);
      const total = (paidRes.data ?? []).reduce((sum, p) => sum + Number((p as any).amount_paid), 0) + 
                    (unifiedPaidRes.data ?? []).reduce((sum, p) => sum + Number((p as any).amount_paid), 0);
      const todayTotal = (todayRes.data ?? []).reduce((sum, p) => sum + Number((p as any).amount_paid), 0) +
                         (unifiedTodayRes.data ?? []).reduce((sum, p) => sum + Number((p as any).amount_paid), 0);
      setStats({ totalCollected: total, pendingCount: pendingRes.count ?? 0, students: studentRes.count ?? 0, todayCollections: todayTotal });
      
      const mergedRecent = [
        ...(recentRes.data ?? []).map(p => ({ ...p, fee_name: (p as any).fee_structures?.name || 'Fee' })),
        ...(unifiedRecentRes.data ?? []).map(p => ({ 
          ...p, 
          fee_name: p.fees_master?.fees_types?.name || 'Fee',
          amount_paid: p.amount_paid || p.amount,
          students: (p as any).students // Ensure students join is used correctly
        }))
      ].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).slice(0, 5);
      
      setRecentPayments(mergedRecent);
      setLoading(false);
    }
    load();
  }, [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Financial Overview</h2>
        <p className="text-slate-500 mt-1">Track collections and fee management for {settings.school_name || 'School Portal'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Collected" value={`₦${stats.totalCollected.toLocaleString()}`} icon={TrendingUp} color="emerald" />
        <StatCard title="Today's Collections" value={`₦${stats.todayCollections.toLocaleString()}`} icon={DollarSign} color="blue" />
        <StatCard title="Pending Payments" value={stats.pendingCount} icon={AlertCircle} color="amber" />
        <StatCard title="Total Students" value={stats.students} icon={Users} color="slate" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Record Payment', path: '/fee-payments', icon: CreditCard, color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
            { label: 'Fee Structures', path: '/fee-structures', icon: DollarSign, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
            { label: 'View Reports', path: '/reports', icon: TrendingUp, color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
            { label: 'All Students', path: '/students', icon: Users, color: 'bg-slate-50 text-slate-600 hover:bg-slate-100' },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)} className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${action.color}`}>
              <action.icon className="w-5 h-5" />
              <span className="text-sm font-medium text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DashboardCalendar />

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Recent Payments</h3>
              <button onClick={() => navigate('/fee-payments')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-5 text-center text-slate-400 text-sm">Loading...</div>
              ) : recentPayments.length === 0 ? (
                <div className="p-5 text-center text-slate-400 text-sm">No payments recorded yet</div>
              ) : recentPayments.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {p.students?.first_name} {p.students?.last_name}
                      </p>
                      <p className="text-xs text-slate-500">{p.fee_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">₦{Number(p.amount_paid).toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{new Date(p.payment_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {profile?.id && profile?.school_id && (
            <RequisitionStatusWidget
              userId={profile.id}
              schoolId={profile.school_id}
              isApprover={true}
            />
          )}
          <TodoWidget userId={profile?.id} schoolId={profile?.school_id ?? undefined} isSuperAdmin={false} />
        </div>
      </div>
    </div>
  );
}
