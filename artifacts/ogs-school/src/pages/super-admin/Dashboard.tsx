import { useEffect, useState } from "react";
import {
  Users,
  GraduationCap,
  School,
  UserCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Bell,
  BarChart2,
  Megaphone,
  Radio,
  CalendarDays,
  ArrowRight,
  Check,
  X,
  ClipboardCheck,
} from "lucide-react";
import Modal from "../../components/common/Modal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useTenantSettings } from "../../context/TenantContext";
import { navigate } from "../../components/hooks/useLocation";

interface StatsData {
  students: number;
  teachers: number;
  parents: number;
  staffs: number;
}

interface DailyFinance {
  day: number;
  income: number;
  expense: number;
}

interface MonthlyFinance {
  month: string;
  income: number;
  expense: number;
}

interface Announcement {
  id: string;
  title: string;
  created_at: string;
  content: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "event" | "holiday";
}

interface PendingLeave {
  id: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  leave_types: { name: string } | null;
  profiles: { id: string; first_name: string; last_name: string; role: string } | null;
}

import TodoWidget from "../../components/dashboard/TodoWidget";
import RequisitionStatusWidget from "../../components/dashboard/RequisitionStatusWidget";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];



function formatCurrency(amount: number): string {
  return (
    "\u20a6" +
    amount.toLocaleString("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const { settings } = useTenantSettings();

  const [stats, setStats] = useState<StatsData>({
    students: 0,
    teachers: 0,
    parents: 0,
    staffs: 0,
  });
  const [dailyFinance, setDailyFinance] = useState<DailyFinance[]>([]);
  const [monthlyFinance, setMonthlyFinance] = useState<MonthlyFinance[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingFinance, setLoadingFinance] = useState(true);

  const [todayAttendance, setTodayAttendance] = useState({present: 0, absent: 0, late: 0, on_leave: 0, holiday: 0});
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [actingOnLeave, setActingOnLeave] = useState<string | null>(null);

  const schoolId = profile?.school_id;
  const userId = profile?.id;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth();

  useEffect(() => {
    if (!schoolId) return;
    fetchStats();
    fetchFinance();
    fetchAnnouncements();
  }, [schoolId, selectedDate]);

  useEffect(() => {
    if (!schoolId) return;
    fetchCalendarEvents();
  }, [schoolId, calendarDate]);

  useEffect(() => {
    if (!schoolId) return;

    const fetchTodayAttendance = async () => {
      setLoadingAttendance(true);
      const todayStr = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("staff_attendance_records")
        .select("status")
        .eq("school_id", schoolId)
        .eq("date", todayStr);

      const counts = {present: 0, absent: 0, late: 0, on_leave: 0, holiday: 0};
      if (data) {
        data.forEach(r => {
          if (r.status === 'present') counts.present++;
          else if (r.status === 'absent') counts.absent++;
          else if (r.status === 'late' || r.status === 'half_day') counts.late++;
          else if (r.status === 'on_leave') counts.on_leave++;
          else if (r.status === 'holiday') counts.holiday++;
        });
      }
      setTodayAttendance(counts);
      setLoadingAttendance(false);
    };

    fetchTodayAttendance();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    fetchPendingLeaves();
  }, [schoolId]);

  async function fetchPendingLeaves() {
    setLoadingLeaves(true);
    const { data } = await supabase
      .from("leave_applications")
      .select("id, from_date, to_date, days, reason, leave_types(name), profiles!staff_id(id, first_name, last_name, role)")
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .order("from_date", { ascending: true })
      .limit(5);
    setPendingLeaves((data as unknown as PendingLeave[]) ?? []);
    setLoadingLeaves(false);
  }

  async function actOnLeave(id: string, status: "approved" | "rejected") {
    setActingOnLeave(id);
    const { error } = await supabase
      .from("leave_applications")
      .update({ status, approved_by: userId })
      .eq("id", id);
    setActingOnLeave(null);
    if (!error) setPendingLeaves((prev) => prev.filter((l) => l.id !== id));
  }


  async function fetchStats() {
    setLoadingStats(true);
    try {
      const [
        { count: studentCount },
        { count: teacherCount },
        { count: parentCount },
        { count: staffCount },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "student")
          .eq("school_id", schoolId),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "teacher")
          .eq("school_id", schoolId),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "parent")
          .eq("school_id", schoolId),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .not("role", "in", '("student","parent","teacher","super_admin")'),
      ]);
      setStats({
        students: studentCount ?? 0,
        teachers: teacherCount ?? 0,
        parents: parentCount ?? 0,
        staffs: staffCount ?? 0,
      });
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchFinance() {
    setLoadingFinance(true);
    const startOfMonth = new Date(currentYear, currentMonth, 1)
      .toISOString()
      .split("T")[0];
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0)
      .toISOString()
      .split("T")[0];

    const [
      { data: incomeData },
      { data: expenseData },
      { data: feesData },
      { data: legacyFeesData },
      { data: storeData },
    ] = await Promise.all([
      supabase
        .from("income_records")
        .select("amount,income_date")
        .eq("school_id", schoolId)
        .gte("income_date", startOfMonth)
        .lte("income_date", endOfMonth),
      supabase
        .from("expense_records")
        .select("amount,expense_date")
        .eq("school_id", schoolId)
        .gte("expense_date", startOfMonth)
        .lte("expense_date", endOfMonth),
      supabase
        .from("fees_collections")
        .select("amount_paid,payment_date")
        .eq("school_id", schoolId)
        .gte("payment_date", startOfMonth)
        .lte("payment_date", endOfMonth),
      supabase
        .from("fee_payments")
        .select("amount_paid,payment_date")
        .eq("school_id", schoolId)
        .gte("payment_date", startOfMonth)
        .lte("payment_date", endOfMonth),
      supabase
        .from("store_orders")
        .select("total_amount,paid_at")
        .eq("school_id", schoolId)
        .gte("paid_at", startOfMonth)
        .lte("paid_at", endOfMonth + "T23:59:59.999Z"),
    ]);

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dailyMap: Record<number, DailyFinance> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap[d] = { day: d, income: 0, expense: 0 };
    }

    let totalInc = 0;
    let totalExp = 0;

    (incomeData ?? []).forEach(
      (entry: { amount: number; income_date: string }) => {
        const day = parseInt(entry.income_date.split("-")[2]);
        if (dailyMap[day]) {
          dailyMap[day].income += Number(entry.amount);
          totalInc += Number(entry.amount);
        }
      },
    );

    (feesData ?? []).forEach(
      (entry: { amount_paid: number; payment_date: string }) => {
        const day = parseInt(entry.payment_date.split("-")[2]);
        if (dailyMap[day]) {
          dailyMap[day].income += Number(entry.amount_paid);
          totalInc += Number(entry.amount_paid);
        }
      },
    );

    (legacyFeesData ?? []).forEach(
      (entry: { amount_paid: number; payment_date: string }) => {
        const day = parseInt(entry.payment_date.split("-")[2]);
        if (dailyMap[day]) {
          dailyMap[day].income += Number(entry.amount_paid);
          totalInc += Number(entry.amount_paid);
        }
      },
    );

    (storeData ?? []).forEach(
      (entry: { total_amount: number; paid_at: string }) => {
        if (!entry.paid_at) return;
        const day = parseInt(entry.paid_at.split("T")[0].split("-")[2]);
        if (dailyMap[day]) {
          dailyMap[day].income += Number(entry.total_amount);
          totalInc += Number(entry.total_amount);
        }
      },
    );

    (expenseData ?? []).forEach(
      (entry: { amount: number; expense_date: string }) => {
        const day = parseInt(entry.expense_date.split("-")[2]);
        if (dailyMap[day]) {
          dailyMap[day].expense += Number(entry.amount);
          totalExp += Number(entry.amount);
        }
      },
    );

    setDailyFinance(Object.values(dailyMap));
    setTotalIncome(totalInc);
    setTotalExpense(totalExp);

    const monthly: MonthlyFinance[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];
      const [
        { data: mInc },
        { data: mExp },
        { data: mFees },
        { data: mLegacyFees },
        { data: mStore },
      ] = await Promise.all([
        supabase
          .from("income_records")
          .select("amount")
          .eq("school_id", schoolId)
          .gte("income_date", mStart)
          .lte("income_date", mEnd),
        supabase
          .from("expense_records")
          .select("amount")
          .eq("school_id", schoolId)
          .gte("expense_date", mStart)
          .lte("expense_date", mEnd),
        supabase
          .from("fees_collections")
          .select("amount_paid")
          .eq("school_id", schoolId)
          .gte("payment_date", mStart)
          .lte("payment_date", mEnd),
        supabase
          .from("fee_payments")
          .select("amount_paid")
          .eq("school_id", schoolId)
          .gte("payment_date", mStart)
          .lte("payment_date", mEnd),
        supabase
          .from("store_orders")
          .select("total_amount")
          .eq("school_id", schoolId)
          .eq("payment_status", "paid")
          .gte("paid_at", mStart)
          .lte("paid_at", mEnd + "T23:59:59.999Z"),
      ]);
      const mIncTotal =
        (mInc ?? []).reduce(
          (s: number, r: { amount: number }) => s + Number(r.amount),
          0,
        ) +
        (mFees ?? []).reduce(
          (s: number, r: { amount_paid: number }) => s + Number(r.amount_paid),
          0,
        ) +
        (mLegacyFees ?? []).reduce(
          (s: number, r: { amount_paid: number }) => s + Number(r.amount_paid),
          0,
        ) +
        (mStore ?? []).reduce(
          (s: number, r: { total_amount: number }) =>
            s + Number(r.total_amount),
          0,
        );
      const mExpTotal = (mExp ?? []).reduce(
        (s: number, r: { amount: number }) => s + Number(r.amount),
        0,
      );
      monthly.push({
        month: SHORT_MONTH_NAMES[d.getMonth()],
        income: mIncTotal,
        expense: mExpTotal,
      });
    }
    setMonthlyFinance(monthly);
    setLoadingFinance(false);
  }

  async function fetchAnnouncements() {
    setLoadingAnnouncements(true);
    const { data } = await supabase
      .from("announcements")
      .select("id,title,created_at,content")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);
    setAnnouncements(data ?? []);
    setLoadingAnnouncements(false);
  }

  async function fetchCalendarEvents() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const mStart = new Date(year, month, 1).toISOString().split("T")[0];
    const mEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const [{ data: events }, { data: holidays }] = await Promise.all([
      supabase
        .from("events")
        .select("id,title,event_date")
        .eq("school_id", schoolId)
        .gte("event_date", mStart)
        .lte("event_date", mEnd),
      supabase
        .from("holiday_calendar")
        .select("id,name,holiday_date")
        .eq("school_id", schoolId)
        .gte("holiday_date", mStart)
        .lte("holiday_date", mEnd),
    ]);

    const all: CalendarEvent[] = [
      ...(events ?? []).map(
        (e: { id: string; title: string; event_date: string }) => ({
          id: e.id,
          title: e.title,
          date: e.event_date,
          type: "event" as const,
        }),
      ),
      ...(holidays ?? []).map(
        (h: { id: string; name: string; holiday_date: string }) => ({
          id: h.id,
          title: h.name,
          date: h.holiday_date,
          type: "holiday" as const,
        }),
      ),
    ];
    setCalendarEvents(all);
  }

  const maxDaily = Math.max(
    ...dailyFinance.map((d) => Math.max(d.income, d.expense)),
    1000,
  );
  const chartYLabels = [
    maxDaily,
    maxDaily * 0.75,
    maxDaily * 0.5,
    maxDaily * 0.25,
    0,
  ];

  const maxMonthly = Math.max(
    ...monthlyFinance.map((m) => Math.max(m.income, m.expense)),
    1,
  );

  const totalHeadcount = stats.students + stats.teachers + stats.parents + stats.staffs;
  const totalStaffMarked =
    todayAttendance.present + todayAttendance.absent + todayAttendance.late + todayAttendance.on_leave + todayAttendance.holiday;
  const attendancePct = totalStaffMarked > 0 ? Math.round((todayAttendance.present / totalStaffMarked) * 100) : null;
  const profitPositive = totalIncome - totalExpense >= 0;

  const statTiles: { label: string; value: number; icon: typeof GraduationCap; color: string }[] = [
    { label: "Students", value: stats.students, icon: GraduationCap, color: "#2A0A5C" },
    { label: "Teachers", value: stats.teachers, icon: Users, color: "#B679F5" },
    { label: "Parents", value: stats.parents, icon: UserCheck, color: "#0d9488" },
    { label: "Staff", value: stats.staffs, icon: School, color: "#d97706" },
  ];

  const attendanceRows: { label: string; value: number; color: string }[] = [
    { label: "Present", value: todayAttendance.present, color: "#059669" },
    { label: "Absent", value: todayAttendance.absent, color: "#dc2626" },
    { label: "Late / Half-day", value: todayAttendance.late, color: "#d97706" },
    { label: "On Leave", value: todayAttendance.on_leave, color: "#7c3aed" },
    { label: "Holiday", value: todayAttendance.holiday, color: "#0284c7" },
  ];

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingEvents = calendarEvents
    .filter((ev) => ev.date.split("T")[0] >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  function daysUntil(dateStr: string) {
    const diff = Math.round((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff > 1) return `In ${diff}d`;
    return formatDate(dateStr);
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-app-border p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 6%, var(--app-surface)), color-mix(in srgb, var(--app-secondary) 10%, var(--app-surface)))' }}>
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-app-primary mb-3">
              <Radio className="w-3 h-3" /> Leadership Command Console \u00b7 {settings.school_name || "School Portal"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-app-text">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            <p className="text-app-text-muted mt-1.5 text-sm max-w-lg">
              {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()} \u2014 {totalHeadcount.toLocaleString()} people across your school portal today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {attendancePct !== null && (
              <div className="flex items-center gap-3 bg-app-surface rounded-2xl px-4 py-3 border border-app-border">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `conic-gradient(var(--app-primary) ${attendancePct}%, var(--app-surface-alt) 0)` }}
                >
                  <span className="w-9 h-9 rounded-full bg-app-surface flex items-center justify-center text-xs text-app-text">{attendancePct}%</span>
                </div>
                <div>
                  <p className="text-app-text text-sm font-semibold leading-tight">Staff Present</p>
                  <p className="text-app-text-muted text-xs">Today's attendance</p>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => navigate("/notice-board")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-app-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-colors"
              >
                <Megaphone className="w-4 h-4" /> Notice Board
              </button>
              <button
                onClick={() => navigate("/reports")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-app-surface text-app-text text-sm font-semibold rounded-xl hover:bg-app-surface-alt transition-colors border border-app-border"
              >
                <BarChart2 className="w-4 h-4" /> Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          const pct = totalHeadcount > 0 ? Math.round((tile.value / totalHeadcount) * 100) : 0;
          return (
            <div key={tile.label} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-app-text-muted uppercase tracking-wide">{tile.label}</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tile.color}1a` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: tile.color }} />
                </div>
              </div>
              <div className="text-3xl font-bold text-app-text mt-3">
                {loadingStats ? "\u2014" : tile.value.toLocaleString()}
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-app-surface-alt overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: tile.color }} />
              </div>
              <p className="text-xs text-app-text-muted mt-1.5">{pct}% of total headcount</p>
            </div>
          );
        })}
      </div>

      {/* Attendance progress + Staff Authorizations */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-app-text">Today's Staff Attendance</h2>
          <p className="text-sm text-app-text-muted mt-0.5 mb-5">Live check-ins vs. total staff on record today.</p>
          {loadingAttendance ? (
            <div className="text-sm text-app-text-muted">Loading attendance data...</div>
          ) : totalStaffMarked === 0 ? (
            <div className="text-sm text-app-text-muted">No attendance recorded for today yet.</div>
          ) : (
            <div className="space-y-5">
              {attendanceRows.map((row) => {
                const pct = Math.round((row.value / totalStaffMarked) * 100);
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2 font-medium text-app-text">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                        {row.label}
                      </span>
                      <span className="text-app-text-muted">{row.value} of {totalStaffMarked} \u00b7 {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-app-surface-alt overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
              <div>
                <h2 className="font-semibold text-app-text flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-app-primary" /> Staff Authorizations
                </h2>
                <p className="text-xs text-app-text-muted mt-0.5">Pending leave requests awaiting your sign-off.</p>
              </div>
              {pendingLeaves.length > 0 && (
                <span className="bg-app-primary text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                  {pendingLeaves.length} New
                </span>
              )}
            </div>
            {loadingLeaves ? (
              <div className="px-5 py-6 text-center text-app-text-muted text-sm">Loading\u2026</div>
            ) : pendingLeaves.length === 0 ? (
              <div className="px-5 py-6 text-center text-app-text-muted text-sm">No pending approvals right now.</div>
            ) : (
              <div className="divide-y divide-app-border">
                {pendingLeaves.map((leave) => {
                  const initials = `${leave.profiles?.first_name?.[0] ?? ''}${leave.profiles?.last_name?.[0] ?? ''}`.toUpperCase();
                  return (
                    <div key={leave.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-app-primary/10 text-app-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {initials || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-app-text truncate">
                              {leave.profiles ? `${leave.profiles.first_name} ${leave.profiles.last_name}` : 'Staff member'}
                            </p>
                            <p className="text-xs text-app-text-muted truncate capitalize">
                              {leave.profiles?.role?.replace('_', ' ')} {leave.leave_types?.name ? `\u00b7 ${leave.leave_types.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-app-text-muted bg-app-surface-alt px-2 py-0.5 rounded-full flex-shrink-0">
                          {leave.days}d
                        </span>
                      </div>
                      <p className="text-xs text-app-text-muted mt-2 ml-12 line-clamp-2">
                        {formatDate(leave.from_date)} \u2013 {formatDate(leave.to_date)}{leave.reason ? ` \u00b7 ${leave.reason}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-3 ml-12">
                        <button
                          onClick={() => navigate('/hr/approve-leave')}
                          className="px-3 py-1.5 text-xs font-medium text-app-text border border-app-border rounded-lg hover:bg-app-surface-alt transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => actOnLeave(leave.id, 'approved')}
                          disabled={actingOnLeave === leave.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-app-primary rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => actOnLeave(leave.id, 'rejected')}
                          disabled={actingOnLeave === leave.id}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-app-text-muted hover:text-red-600 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {userId && schoolId && (
            <RequisitionStatusWidget userId={userId} schoolId={schoolId} isApprover={true} />
          )}
          <TodoWidget
            userId={userId}
            schoolId={schoolId ?? undefined}
            isSuperAdmin={profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "principal"}
          />
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-app-text">
            Income and Expenses
          </h2>
          <div className="flex items-center bg-app-surface-alt rounded-xl border border-app-border p-1">
            <button
              onClick={() =>
                setSelectedDate(new Date(currentYear, currentMonth - 1, 1))
              }
              className="p-1.5 hover:bg-app-surface hover:shadow-sm rounded-lg transition-all text-app-text-muted"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 flex flex-col items-center min-w-[100px]">
              <span className="text-xs font-bold text-app-text">
                {MONTH_NAMES[currentMonth]}
              </span>
              <span className="text-[9px] uppercase tracking-tighter text-app-text-muted font-black">
                {currentYear}
              </span>
            </div>
            <button
              onClick={() =>
                setSelectedDate(new Date(currentYear, currentMonth + 1, 1))
              }
              className="p-1.5 hover:bg-app-surface hover:shadow-sm rounded-lg transition-all text-app-text-muted"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Income
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {loadingFinance ? "\u2014" : formatCurrency(totalIncome)}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Expenses
              </span>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {loadingFinance ? "\u2014" : formatCurrency(totalExpense)}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <DollarSign size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Profit
              </span>
            </div>
            <div
              className={`text-2xl font-bold ${
                totalIncome - totalExpense >= 0
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {loadingFinance
                ? "\u2014"
                : formatCurrency(totalIncome - totalExpense)}
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <DollarSign size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Revenue
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {loadingFinance ? "\u2014" : formatCurrency(totalIncome)}
            </div>
          </div>
        </div>

        <div className="mb-2">
          <h3 className="text-sm font-semibold text-app-text mb-3">
            Daily Income vs Expenses
          </h3>
          {loadingFinance ? (
            <div className="h-48 flex items-center justify-center text-app-text-muted text-sm">
              Loading chart...
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative h-48 pr-2" style={{ minWidth: 44 }}>
                {chartYLabels.map((v, i) => (
                  <span
                    key={i}
                    className="absolute right-0 text-xs text-app-text-muted text-right"
                    style={{ top: `${(i / (chartYLabels.length - 1)) * 100}%`, transform: 'translateY(-50%)' }}
                  >
                    {v === 0 ? "0" : v >= 1000 ? `${(v / 1000).toFixed(v < 10000 ? 1 : 0)}k` : Math.round(v)}
                  </span>
                ))}
              </div>
              <div className="flex-1 overflow-x-auto">
                {/* Replace the daily chart div with this */}
                <svg width="100%" height="192" viewBox={`0 0 ${dailyFinance.length * 18} 192`} preserveAspectRatio="none">
                  {/* Y-axis gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                    <line
                      key={pct}
                      x1={0} y1={192 - pct * 192}
                      x2={dailyFinance.length * 18} y2={192 - pct * 192}
                      stroke="#e5e7eb" strokeWidth="1"
                    />
                  ))}
                  {/* Bars */}
                  {dailyFinance.map((d, i) => {
                    const incH = (d.income / maxDaily) * 180;
                    const expH = (d.expense / maxDaily) * 180;
                    return (
                      <g key={d.day}>
                        <rect x={i * 18} y={192 - incH} width={8} height={incH} fill="#34d399" rx={2} />
                        <rect x={i * 18 + 9} y={192 - expH} width={8} height={expH} fill="#f87171" rx={2} />
                      </g>
                    );
                  })}
                </svg>
                <div
                  className="flex gap-0.5 mt-1"
                  style={{ minWidth: dailyFinance.length * 18 }}
                >
                  {dailyFinance.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 text-center text-xs text-app-text-muted"
                      style={{ minWidth: 16 }}
                    >
                      {d.day % 5 === 1 || d.day === 1 ? d.day : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
              <span className="w-3 h-3 rounded bg-emerald-400 inline-block" />{" "}
              Income
            </div>
            <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" />{" "}
              Expenses
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-app-text mb-3">
            Monthly Trend (Last 6 Months)
          </h3>
          {loadingFinance ? (
            <div className="h-40 flex items-center justify-center text-app-text-muted text-sm">
              Loading chart...
            </div>
          ) : (
            <div className="flex items-end gap-3 h-40 border-l border-b border-app-border px-2 pb-1">
              {monthlyFinance.map((m) => {
                const incH = Math.round((m.income / maxMonthly) * 100);
                const expH = Math.round((m.expense / maxMonthly) * 100);
                return (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div className="w-full flex items-end justify-center gap-1 h-32">
                      <div
                        className="w-4 bg-emerald-400 rounded-t-sm"
                        style={{
                          height: `${incH}%`,
                          minHeight: m.income > 0 ? 3 : 0,
                        }}
                        title={`${m.month} Income: ${formatCurrency(m.income)}`}
                      />
                      <div
                        className="w-4 bg-red-400 rounded-t-sm"
                        style={{
                          height: `${expH}%`,
                          minHeight: m.expense > 0 ? 3 : 0,
                        }}
                        title={`${m.month} Expense: ${formatCurrency(
                          m.expense,
                        )}`}
                      />
                    </div>
                    <span className="text-xs text-app-text-muted">{m.month}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
              <span className="w-3 h-3 rounded bg-emerald-400 inline-block" />{" "}
              Income
            </div>
            <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" />{" "}
              Expenses
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
            <div>
              <h2 className="font-semibold text-app-text flex items-center gap-2">
                <Bell className="w-4 h-4 text-app-primary" /> Campus Operations &amp; Incident Stream
              </h2>
              <p className="text-xs text-app-text-muted mt-0.5">Latest notices and updates posted across the school.</p>
            </div>
            <button
              onClick={() => navigate("/notice-board")}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-app-primary hover:opacity-80 transition-colors flex-shrink-0"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {loadingAnnouncements ? (
            <div className="text-sm text-app-text-muted py-10 text-center">Loading announcements…</div>
          ) : announcements.length === 0 ? (
            <div className="text-sm text-app-text-muted py-10 text-center">No announcements posted yet.</div>
          ) : (
            <div className="divide-y divide-app-border">
              {announcements.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAnnouncement(a)}
                  className="w-full flex items-start gap-3 px-6 py-4 text-left hover:bg-app-surface-alt transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-app-primary/10 text-app-primary flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-app-text truncate">{a.title}</p>
                      <span className="text-xs text-app-text-muted whitespace-nowrap flex-shrink-0">{formatDate(a.created_at)}</span>
                    </div>
                    <p className="text-xs text-app-text-muted mt-0.5 line-clamp-1">{a.content}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
            <h2 className="font-semibold text-app-text flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-app-primary" /> Institutional Calendar
            </h2>
            <button
              onClick={() => navigate("/events")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-app-primary hover:opacity-80 transition-colors flex-shrink-0"
            >
              Full Schedule <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="text-sm text-app-text-muted py-10 text-center">No upcoming events scheduled.</div>
          ) : (
            <div className="divide-y divide-app-border">
              {upcomingEvents.map((ev) => {
                const d = new Date(ev.date);
                return (
                  <div key={ev.id} className="flex items-center gap-3 px-6 py-4">
                    <div className="w-11 h-11 rounded-xl bg-app-surface-alt border border-app-border flex flex-col items-center justify-center flex-shrink-0 leading-none">
                      <span className="text-[9px] font-bold uppercase text-app-text-muted">{SHORT_MONTH_NAMES[d.getMonth()]}</span>
                      <span className="text-sm font-bold text-app-text">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-app-text truncate">{ev.title}</p>
                      <p className={`text-xs mt-0.5 ${ev.type === "holiday" ? "text-amber-600" : "text-app-text-muted"}`}>
                        {ev.type === "holiday" ? "Holiday" : "Event"} · {daysUntil(ev.date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-app-primary/10 text-app-primary flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-app-text">Administrative Quick Dispatch</h2>
            <p className="text-xs text-app-text-muted mt-0.5">Jump straight into the actions that need your attention.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/notice-board")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-app-surface-alt hover:bg-app-border text-app-text text-sm font-medium rounded-xl transition-colors border border-app-border"
          >
            <Megaphone className="w-4 h-4" /> Post Announcement
          </button>
          <button
            onClick={() => navigate("/hr/approve-leave")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-app-surface-alt hover:bg-app-border text-app-text text-sm font-medium rounded-xl transition-colors border border-app-border"
          >
            <ClipboardCheck className="w-4 h-4" /> Approve Leave Requests
          </button>
          <button
            onClick={() => navigate("/events")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-app-primary text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors"
          >
            <CalendarDays className="w-4 h-4" /> Manage Calendar
          </button>
        </div>
      </div>

      {selectedAnnouncement && (
        <Modal
          isOpen={!!selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
          title={selectedAnnouncement.title}
        >
          <div className="space-y-3">
            <div className="text-xs text-app-text-muted">
              {formatDate(selectedAnnouncement.created_at)}
            </div>
            <div className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">
              {selectedAnnouncement.content}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-2 text-sm font-medium text-app-text border border-app-border rounded-lg hover:bg-app-surface-alt transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
