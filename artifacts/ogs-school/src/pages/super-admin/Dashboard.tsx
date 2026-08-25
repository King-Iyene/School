import { useEffect, useState } from "react";
import DashboardCalendar from "../../components/dashboard/DashboardCalendar";
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
  Eye,
} from "lucide-react";
import Modal from "../../components/common/Modal";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

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


  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInCalendarMonth = new Date(
    calendarYear,
    calendarMonth + 1,
    0,
  ).getDate();
  const prevMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();

  const calendarCells: Array<{
    day: number;
    currentMonth: boolean;
    dateStr: string;
  }> = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = calendarMonth === 0 ? 11 : calendarMonth - 1;
    const y = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(
      d,
    ).padStart(2, "0")}`;
    calendarCells.push({ day: d, currentMonth: false, dateStr });
  }
  for (let d = 1; d <= daysInCalendarMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(
      2,
      "0",
    )}-${String(d).padStart(2, "0")}`;
    calendarCells.push({ day: d, currentMonth: true, dateStr });
  }
  const remaining = 42 - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = calendarMonth === 11 ? 0 : calendarMonth + 1;
    const y = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(
      d,
    ).padStart(2, "0")}`;
    calendarCells.push({ day: d, currentMonth: false, dateStr });
  }

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  calendarEvents.forEach((ev) => {
    const key = ev.date.split("T")[0];
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(ev);
  });

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




  return (
    <div className="md:p-6 space-y-8 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <GraduationCap size={56} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-4xl font-bold text-emerald-600">
              {loadingStats ? "\u2014" : stats.students.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">Students</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <Users size={56} className="text-blue-600" />
          </div>
          <div>
            <div className="text-4xl font-bold text-blue-600">
              {loadingStats ? "\u2014" : stats.teachers.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">Teachers</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <UserCheck size={56} className="text-amber-500" />
          </div>
          <div>
            <div className="text-4xl font-bold text-amber-500">
              {loadingStats ? "\u2014" : stats.parents.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">Parents</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <School size={56} className="text-slate-500" />
          </div>
          <div>
            <div className="text-4xl font-bold text-slate-600">
              {loadingStats ? "\u2014" : stats.staffs.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">Staff</div>
          </div>
        </div>
      </div>

      {/* Staff Attendance Today Widget */}
      <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-emerald-500">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-600" /> Today's Staff Attendance
        </h2>
        {loadingAttendance ? (
          <div className="text-sm text-gray-400">Loading attendance data...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700">{todayAttendance.present}</div>
              <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mt-1">Present</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <div className="text-2xl font-bold text-red-700">{todayAttendance.absent}</div>
              <div className="text-xs font-medium text-red-600 uppercase tracking-wide mt-1">Absent</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{todayAttendance.late}</div>
              <div className="text-xs font-medium text-amber-600 uppercase tracking-wide mt-1">Late/Half-day</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="text-2xl font-bold text-purple-700">{todayAttendance.on_leave}</div>
              <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mt-1">On Leave</div>
            </div>
            <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
              <div className="text-2xl font-bold text-sky-700">{todayAttendance.holiday}</div>
              <div className="text-xs font-medium text-sky-600 uppercase tracking-wide mt-1">Holiday</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Income and Expenses
          </h2>
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-100 p-1">
            <button
              onClick={() =>
                setSelectedDate(new Date(currentYear, currentMonth - 1, 1))
              }
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 flex flex-col items-center min-w-[100px]">
              <span className="text-xs font-bold text-gray-700">
                {MONTH_NAMES[currentMonth]}
              </span>
              <span className="text-[9px] uppercase tracking-tighter text-gray-400 font-black">
                {currentYear}
              </span>
            </div>
            <button
              onClick={() =>
                setSelectedDate(new Date(currentYear, currentMonth + 1, 1))
              }
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-emerald-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Income
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {loadingFinance ? "\u2014" : formatCurrency(totalIncome)}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <TrendingDown size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Expenses
              </span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {loadingFinance ? "\u2014" : formatCurrency(totalExpense)}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <DollarSign size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Profit
              </span>
            </div>
            <div
              className={`text-2xl font-bold ${
                totalIncome - totalExpense >= 0
                  ? "text-blue-700"
                  : "text-red-600"
              }`}
            >
              {loadingFinance
                ? "\u2014"
                : formatCurrency(totalIncome - totalExpense)}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <DollarSign size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Total Revenue
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {loadingFinance ? "\u2014" : formatCurrency(totalIncome)}
            </div>
          </div>
        </div>

        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Daily Income vs Expenses
          </h3>
          {loadingFinance ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Loading chart...
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative h-48 pr-2" style={{ minWidth: 44 }}>
                {chartYLabels.map((v, i) => (
                  <span
                    key={i}
                    className="absolute right-0 text-xs text-gray-400 text-right"
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
                      className="flex-1 text-center text-xs text-gray-400"
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
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-emerald-400 inline-block" />{" "}
              Income
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" />{" "}
              Expenses
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Monthly Trend (Last 6 Months)
          </h3>
          {loadingFinance ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Loading chart...
            </div>
          ) : (
            <div className="flex items-end gap-3 h-40 border-l border-b border-gray-200 px-2 pb-1">
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
                    <span className="text-xs text-gray-500">{m.month}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-emerald-400 inline-block" />{" "}
              Income
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" />{" "}
              Expenses
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-800">Notice Board</h2>
        </div>
        {loadingAnnouncements ? (
          <div className="text-sm text-gray-400 py-6 text-center">
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">
            No announcements found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    Date
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    Title
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                      {formatDate(a.created_at)}
                    </td>
                    <td className="py-2 px-3 text-gray-800 font-medium">
                      {a.title}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => setSelectedAnnouncement(a)}
                        className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-xs font-medium border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-50 transition-colors"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <DashboardCalendar />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {userId && schoolId && (
            <RequisitionStatusWidget
              userId={userId}
              schoolId={schoolId}
              isApprover={true}
            />
          )}
          <TodoWidget
            userId={userId}
            schoolId={schoolId ?? undefined}
            isSuperAdmin={profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "principal"}
          />
        </div>
      </div>

      {selectedAnnouncement && (
        <Modal
          isOpen={!!selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
          title={selectedAnnouncement.title}
        >
          <div className="space-y-3">
            <div className="text-xs text-gray-400">
              {formatDate(selectedAnnouncement.created_at)}
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {selectedAnnouncement.content}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
