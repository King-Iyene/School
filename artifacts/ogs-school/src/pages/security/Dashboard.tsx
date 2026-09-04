import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  BookUser, 
  AlertCircle, 
  Users, 
  UserCheck, 
  Truck, 
  Building, 
  BarChart2, 
  Flag, 
  Shield, 
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { navigate } from '../../components/hooks/useLocation';
import { cache } from '../../utils/cache';

interface SecurityStat {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  path: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SecurityDashboard() {
  const { profile } = useAuth();
  const [visitorsToday, setVisitorsToday] = useState<number>(0);
  const [complaintsOpen, setComplaintsOpen] = useState<number>(0);
  const [incidentsThisMonth, setIncidentsThisMonth] = useState<number>(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [staffPresent, setStaffPresent] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const displayDate = `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`;

  const loadStats = async (forceRefresh = false) => {
    if (!profile?.school_id) return;
    setLoading(true);

    const cacheKey = `security_stats_v4_${profile.school_id}`;
    if (!forceRefresh) {
      const cached = cache.get<any>(cacheKey);
      if (cached) {
        setVisitorsToday(cached.visitorsToday);
        setComplaintsOpen(cached.complaintsOpen);
        setIncidentsThisMonth(cached.incidentsThisMonth);
        setTotalStudents(cached.totalStudents);
        setStaffPresent(cached.staffPresent);
        setLoading(false);
        return;
      }
    }

    try {
      const [visitRes, complRes, incidentRes, stuRes, staffRes] = await Promise.all([
        supabase.from('visitors')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', profile.school_id)
          .gte('date', today),

        supabase.from('complaints')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', profile.school_id)
          .in('status', ['open', 'pending', 'new']),

        supabase.from('student_behaviour_records')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', profile.school_id)
          .gte('incident_date', monthStart),

        supabase.from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', profile.school_id)
          .eq('status', 'active'),

        supabase.from('staff_attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', profile.school_id)
          .eq('date', today)
          .eq('status', 'present'),
      ]);

      const statsData = {
        visitorsToday: visitRes.count ?? 0,
        complaintsOpen: complRes.count ?? 0,
        incidentsThisMonth: incidentRes.count ?? 0,
        totalStudents: stuRes.count ?? 0,
        staffPresent: staffRes.count ?? 0,
      };

      setVisitorsToday(statsData.visitorsToday);
      setComplaintsOpen(statsData.complaintsOpen);
      setIncidentsThisMonth(statsData.incidentsThisMonth);
      setTotalStudents(statsData.totalStudents);
      setStaffPresent(statsData.staffPresent);
      cache.set(cacheKey, statsData, 5 * 60 * 1000);
    } catch (err) {
      console.error('Error loading security stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [profile?.school_id]);

  const stats: SecurityStat[] = [
    { label: 'Visitors Today', value: visitorsToday, icon: BookUser, color: 'text-blue-600', path: '/visitor-book' },
    { label: 'Open Complaints', value: complaintsOpen, icon: AlertCircle, color: 'text-red-500', path: '/complaint' },
    { label: 'Incidents: Month', value: incidentsThisMonth, icon: Flag, color: 'text-amber-500', path: '/behaviour/reports' },
    { label: 'Active Students', value: totalStudents, icon: Users, color: 'text-emerald-600', path: '/students' },
    { label: 'Staff Present', value: staffPresent, icon: UserCheck, color: 'text-purple-600', path: '/hr/staff-attendance' },
  ];

  const quickLinks = [
    { label: 'Visitor Book', icon: BookUser, path: '/visitor-book', color: 'bg-blue-50 text-blue-600' },
    { label: 'Complaint Log', icon: AlertCircle, path: '/complaint', color: 'bg-red-50 text-red-600' },
    { label: 'Assign Incident', icon: Flag, path: '/behaviour/assign', color: 'bg-amber-50 text-amber-600' },
    { label: 'Behaviour Report', icon: BarChart2, path: '/behaviour/reports', color: 'bg-orange-50 text-orange-600' },
    { label: 'Staff Attendance', icon: UserCheck, path: '/hr/staff-attendance', color: 'bg-purple-50 text-purple-600' },
    { label: 'Dormitory Report', icon: Building, path: '/dormitory/report', color: 'bg-slate-100 text-app-text-muted' },
    { label: 'Transport', icon: Truck, path: '/transport/assignments', color: 'bg-cyan-50 text-cyan-600' },
    { label: 'School Prefects', icon: Shield, path: '/student-mgmt/prefects', color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="md:p-6 space-y-8 bg-app-surface-alt min-h-screen -m-6 p-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text">
            Welcome back, {profile?.first_name || 'Officer'}
          </h1>
          <p className="text-sm text-app-text-muted mt-1">
            {displayDate} • Security Command Centre
          </p>
        </div>
        <button 
          onClick={() => loadStats(true)}
          disabled={loading}
          className="p-2.5 bg-app-surface rounded-xl shadow-sm border border-app-border hover:bg-app-surface-alt transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 text-app-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.label}
              className="bg-app-surface rounded-xl shadow-sm p-6 flex items-center gap-4 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all border border-transparent hover:border-app-border"
              onClick={() => navigate(stat.path)}
            >
              <div className="absolute right-4 top-4 opacity-10 group-hover:scale-110 transition-transform">
                <Icon size={56} className={stat.color} />
              </div>
              <div className="relative z-10">
                <div className={`text-4xl font-bold ${stat.color}`}>
                  {loading ? "\u2014" : stat.value.toLocaleString()}
                </div>
                <div className="text-sm text-app-text-muted mt-1">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        <div className="bg-app-surface rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-app-text mb-6 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" /> Security Operations
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickLinks.map(link => {
              const Icon = link.icon;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-transparent ${link.color} hover:shadow-lg transition-all active:scale-95 text-center`}
                >
                  <Icon className="w-7 h-7" />
                  <span className="text-xs font-bold leading-tight line-clamp-1">{link.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Security Advisory Widget */}
        <div className="bg-app-surface rounded-xl shadow-sm p-6 border-l-4 border-amber-500">
          <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Security Advisory
          </h2>
          <p className="text-app-text-muted text-sm leading-relaxed italic">
            "Ensure all entrance logs are verified against student admission records. 
            Report any suspicious activity directly to the Super Admin via the Complaint log. 
            Regular patrols of dormitories and transport bays are mandatory."
          </p>
        </div>
      </div>
    </div>
  );
}
