import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  Announcement,
  Attendance,
  Grade,
  ClassSubject,
  StudentEnrollment,
  Event,
} from "@/lib/types";

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  const colors = useColors();
  return (
    <View style={[cardStyles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[cardStyles.iconBg, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[cardStyles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      <Text style={[cardStyles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 8,
    minWidth: 100,
  },
  iconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },
});

function AnnouncementCard({ item }: { item: Announcement }) {
  const colors = useColors();
  const date = new Date(item.created_at).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
  return (
    <View style={[annStyles.card, { backgroundColor: colors.card, borderColor: item.is_pinned ? colors.primary + "50" : colors.border }]}>
      {item.is_pinned && (
        <View style={[annStyles.pinnedBadge, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="pin" size={10} color={colors.primary} />
          <Text style={[annStyles.pinnedText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>Pinned</Text>
        </View>
      )}
      <Text style={[annStyles.title, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[annStyles.content, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
        {item.content}
      </Text>
      <Text style={[annStyles.date, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{date}</Text>
    </View>
  );
}

const annStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10, gap: 4 },
  pinnedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start", marginBottom: 4 },
  pinnedText: { fontSize: 11 },
  title: { fontSize: 15 },
  content: { fontSize: 13, lineHeight: 18 },
  date: { fontSize: 12, marginTop: 4 },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const role = profile?.role ?? "student";
  const isStudent = role === "student";
  const isTeacher = ["teacher", "head_teacher"].includes(role);
  const isParent = role === "parent";
  const isAdmin = ["admin", "super_admin", "principal"].includes(role);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: announcements, isLoading: annLoading, refetch: refetchAnn } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile,
  });

  const { data: attendanceSummary, isLoading: attLoading } = useQuery<{
    present: number;
    absent: number;
    late: number;
    total: number;
  }>({
    queryKey: ["attendance-summary", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", profile!.id)
        .order("date", { ascending: false })
        .limit(30);
      const records = data ?? [];
      return {
        total: records.length,
        present: records.filter((r: Attendance) => r.status === "present").length,
        absent: records.filter((r: Attendance) => r.status === "absent").length,
        late: records.filter((r: Attendance) => r.status === "late").length,
      };
    },
    enabled: !!profile && isStudent,
  });

  const { data: recentGrades, isLoading: gradesLoading } = useQuery<Grade[]>({
    queryKey: ["recent-grades", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select("*, subjects(id, name, code), classes(id, name)")
        .eq("student_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && isStudent,
  });

  const { data: teacherClasses, isLoading: tClassLoading } = useQuery<ClassSubject[]>({
    queryKey: ["teacher-classes", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_subjects")
        .select("*, classes(id, name, level), subjects(id, name, code)")
        .eq("teacher_id", profile!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && isTeacher,
  });

  const { data: enrollment } = useQuery<StudentEnrollment | null>({
    queryKey: ["enrollment", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_enrollments")
        .select("*, classes(id, name, level)")
        .eq("student_id", profile!.id)
        .eq("status", "active")
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!profile && isStudent,
  });

  const { data: adminStats, isLoading: adminLoading } = useQuery<{
    students: number;
    staff: number;
    classes: number;
  }>({
    queryKey: ["admin-stats", profile?.school_id],
    queryFn: async () => {
      const [studentsRes, staffRes, classesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", profile!.school_id!).eq("role", "student").eq("is_active", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", profile!.school_id!).in("role", ["teacher", "head_teacher", "admin", "principal"]).eq("is_active", true),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", profile!.school_id!),
      ]);
      return {
        students: studentsRes.count ?? 0,
        staff: staffRes.count ?? 0,
        classes: classesRes.count ?? 0,
      };
    },
    enabled: !!profile && isAdmin && !!profile.school_id,
  });

  const { data: upcomingEvents } = useQuery<Event[]>({
    queryKey: ["events", profile?.school_id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("school_id", profile!.school_id!)
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && !!profile.school_id,
  });

  const isLoading = annLoading || attLoading || tClassLoading || gradesLoading || adminLoading;

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const getRoleBadgeColor = () => {
    if (isStudent) return colors.primary;
    if (isTeacher) return "#6366f1";
    if (isParent) return "#f59e0b";
    if (isAdmin) return "#ef4444";
    return colors.mutedForeground;
  };

  const attendancePercent =
    attendanceSummary && attendanceSummary.total > 0
      ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
      : null;

  const getGradeColor = (score: number) => {
    if (score >= 70) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.destructive;
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetchAnn}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {greetingTime()},
          </Text>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {profile?.first_name ?? "User"} {profile?.last_name ?? ""}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor() + "20", borderColor: getRoleBadgeColor() + "40" }]}>
          <Text style={[styles.roleText, { color: getRoleBadgeColor(), fontFamily: "Inter_500Medium" }]}>
            {role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
        </View>
      </View>

      {/* Student: Attendance + Class */}
      {isStudent && enrollment && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Your Class
          </Text>
          <View style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.classIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="school-outline" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.className, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {enrollment.classes?.name ?? "—"}
              </Text>
              <Text style={[styles.classLevel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {enrollment.classes?.level ?? "—"}
              </Text>
            </View>
            {profile?.admission_number && (
              <View style={styles.admNo}>
                <Text style={[styles.admNoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {profile.admission_number}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {isStudent && attendanceSummary && attendanceSummary.total > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Attendance (Last 30 Days)
          </Text>
          <View style={styles.statsRow}>
            <StatCard
              icon={<Ionicons name="checkmark-circle" size={18} color={colors.success} />}
              label="Present"
              value={String(attendanceSummary.present)}
              color={colors.success}
              bg={colors.success + "20"}
            />
            <StatCard
              icon={<Ionicons name="close-circle" size={18} color={colors.destructive} />}
              label="Absent"
              value={String(attendanceSummary.absent)}
              color={colors.destructive}
              bg={colors.destructive + "20"}
            />
            <StatCard
              icon={<Ionicons name="time" size={18} color={colors.warning} />}
              label="Late"
              value={String(attendanceSummary.late)}
              color={colors.warning}
              bg={colors.warning + "20"}
            />
          </View>
          {attendancePercent !== null && (
            <View style={[styles.attendancePct, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.attendancePctLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Attendance Rate
              </Text>
              <Text style={[styles.attendancePctValue, { color: attendancePercent >= 75 ? colors.success : colors.destructive, fontFamily: "Inter_700Bold" }]}>
                {attendancePercent}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Student: Recent Grades */}
      {isStudent && recentGrades && recentGrades.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Recent Grades
          </Text>
          {recentGrades.map((g) => (
            <View key={g.id} style={[styles.gradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.gradeSubject}>
                <Text style={[styles.gradeSubjectName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {g.subjects?.name ?? "—"}
                </Text>
                <Text style={[styles.gradeSubjectCode, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {g.subjects?.code ?? ""}
                </Text>
              </View>
              <View style={styles.gradeScore}>
                <Text style={[styles.gradeTotal, { color: getGradeColor(g.total_score), fontFamily: "Inter_700Bold" }]}>
                  {g.total_score}
                </Text>
                <Text style={[styles.gradeLetter, { color: getGradeColor(g.total_score), fontFamily: "Inter_600SemiBold" }]}>
                  {g.grade}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Teacher: Classes */}
      {isTeacher && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Your Classes
          </Text>
          {tClassLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : teacherClasses && teacherClasses.length > 0 ? (
            <>
              <View style={styles.statsRow}>
                <StatCard
                  icon={<Ionicons name="people-outline" size={18} color={colors.primary} />}
                  label="Classes"
                  value={String(new Set(teacherClasses.map((c) => c.class_id)).size)}
                  color={colors.primary}
                  bg={colors.primary + "20"}
                />
                <StatCard
                  icon={<Ionicons name="book-outline" size={18} color="#6366f1" />}
                  label="Subjects"
                  value={String(teacherClasses.length)}
                  color="#6366f1"
                  bg="#6366f120"
                />
              </View>
              <View style={styles.classList}>
                {teacherClasses.slice(0, 5).map((c) => (
                  <View key={c.id} style={[styles.classListItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.classItemIcon, { backgroundColor: colors.primary + "15" }]}>
                      <Ionicons name="school-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.classItemName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {c.classes?.name ?? "—"}
                    </Text>
                    <Text style={[styles.classItemSubject, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {c.subjects?.name ?? "—"}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No classes assigned yet
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Admin Stats */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            School Overview
          </Text>
          {adminLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : adminStats ? (
            <View style={styles.statsRow}>
              <StatCard
                icon={<Ionicons name="people" size={18} color={colors.primary} />}
                label="Students"
                value={String(adminStats.students)}
                color={colors.primary}
                bg={colors.primary + "20"}
              />
              <StatCard
                icon={<MaterialCommunityIcons name="account-tie" size={18} color="#6366f1" />}
                label="Staff"
                value={String(adminStats.staff)}
                color="#6366f1"
                bg="#6366f120"
              />
              <StatCard
                icon={<Ionicons name="library" size={18} color="#f59e0b" />}
                label="Classes"
                value={String(adminStats.classes)}
                color="#f59e0b"
                bg="#f59e0b20"
              />
            </View>
          ) : null}
        </View>
      )}

      {/* Upcoming Events */}
      {upcomingEvents && upcomingEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Upcoming Events
          </Text>
          {upcomingEvents.map((ev) => {
            const evDate = new Date(ev.event_date).toLocaleDateString("en-NG", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            return (
              <View key={ev.id} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.eventDateBox, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.eventDateText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                    {evDate}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  {!!ev.location && (
                    <Text style={[styles.eventLocation, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                      <Ionicons name="location-outline" size={11} color={colors.mutedForeground} /> {ev.location}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Announcements */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Announcements
        </Text>
        {annLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : announcements && announcements.length > 0 ? (
          announcements.map((a) => <AnnouncementCard key={a.id} item={a} />)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No announcements
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: Platform.OS === "web" ? 34 : insets.bottom + 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 },
  greeting: { fontSize: 14 },
  name: { fontSize: 24 },
  roleBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  statsRow: { flexDirection: "row", gap: 10 },
  classCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  classIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  className: { fontSize: 16 },
  classLevel: { fontSize: 13 },
  admNo: { marginLeft: "auto" },
  admNoText: { fontSize: 12 },
  attendancePct: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  attendancePctLabel: { fontSize: 14 },
  attendancePctValue: { fontSize: 22 },
  gradeRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  gradeSubject: { flex: 1 },
  gradeSubjectName: { fontSize: 14 },
  gradeSubjectCode: { fontSize: 12 },
  gradeScore: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  gradeTotal: { fontSize: 20 },
  gradeLetter: { fontSize: 14 },
  classList: { gap: 8, marginTop: 10 },
  classListItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  classItemIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  classItemName: { flex: 1, fontSize: 14 },
  classItemSubject: { fontSize: 12 },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  eventDateBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  eventDateText: { fontSize: 12 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14 },
  eventLocation: { fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 14 },
});
