import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Grade, Attendance, ClassSubject } from "@/lib/types";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RecordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const role = profile?.role ?? "student";
  const isStudent = role === "student";
  const isTeacher = ["teacher", "head_teacher"].includes(role);
  const isAdmin = ["admin", "super_admin", "principal"].includes(role);

  const [studentTab, setStudentTab] = useState<"grades" | "attendance">("grades");

  const { data: grades, isLoading: gradesLoading } = useQuery<Grade[]>({
    queryKey: ["all-grades", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select("*, subjects(id, name, code), classes(id, name)")
        .eq("student_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && isStudent,
  });

  const { data: attendance, isLoading: attLoading } = useQuery<Attendance[]>({
    queryKey: ["all-attendance", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", profile!.id)
        .order("date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && isStudent,
  });

  const { data: teacherClasses, isLoading: tClassLoading } = useQuery<ClassSubject[]>({
    queryKey: ["teacher-classes-detail", profile?.id],
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

  const { data: allStaff, isLoading: staffLoading } = useQuery<
    { id: string; first_name: string; last_name: string; role: string; staff_id: string; is_active: boolean }[]
  >({
    queryKey: ["all-staff", profile?.school_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role, staff_id, is_active")
        .eq("school_id", profile!.school_id!)
        .in("role", ["teacher", "head_teacher", "admin", "principal", "accountant", "security_officer"])
        .eq("is_active", true)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && isAdmin && !!profile.school_id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return colors.success;
      case "absent": return colors.destructive;
      case "late": return colors.warning;
      case "excused": return colors.primary;
      default: return colors.mutedForeground;
    }
  };

  const getGradeColor = (score: number) => {
    if (score >= 70) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.destructive;
  };

  const renderGradeItem = ({ item: g }: { item: Grade }) => (
    <View style={[styles.gradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.gradeLeft}>
        <Text style={[styles.gradeSubject, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {g.subjects?.name ?? "—"}
        </Text>
        <Text style={[styles.gradeClass, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {g.classes?.name ?? "—"} · {g.subjects?.code ?? ""}
        </Text>
        <View style={styles.gradeBreakdown}>
          <Text style={[styles.breakdownText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            CA: {(g.ca1_score + g.ca2_score + g.ca3_score).toFixed(0)} · Exam: {g.exam_score}
          </Text>
        </View>
      </View>
      <View style={styles.gradeRight}>
        <Text style={[styles.gradeScore, { color: getGradeColor(g.total_score), fontFamily: "Inter_700Bold" }]}>
          {g.total_score}
        </Text>
        <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(g.total_score) + "20" }]}>
          <Text style={[styles.gradeLetter, { color: getGradeColor(g.total_score), fontFamily: "Inter_700Bold" }]}>
            {g.grade}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderAttItem = ({ item: a }: { item: Attendance }) => {
    const date = new Date(a.date).toLocaleDateString("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return (
      <View style={[styles.attRow, { borderColor: colors.border }]}>
        <Text style={[styles.attDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {date}
        </Text>
        <View style={[styles.attBadge, { backgroundColor: getStatusColor(a.status) + "20" }]}>
          <Text style={[styles.attStatus, { color: getStatusColor(a.status), fontFamily: "Inter_500Medium" }]}>
            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
          </Text>
        </View>
      </View>
    );
  };

  const getRoleLabel = (r: string) =>
    r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {isStudent ? "My Records" : isTeacher ? "My Classes" : "Staff Directory"}
        </Text>
        {isStudent && (
          <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(["grades", "attendance"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setStudentTab(t)}
                style={[styles.tabBtn, studentTab === t && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.tabBtnText, { color: studentTab === t ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Student: Grades */}
      {isStudent && studentTab === "grades" && (
        <>
          {gradesLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : grades && grades.length > 0 ? (
            <FlatList
              data={grades}
              keyExtractor={(g) => g.id}
              renderItem={renderGradeItem}
              contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No grades recorded yet
              </Text>
            </View>
          )}
        </>
      )}

      {/* Student: Attendance */}
      {isStudent && studentTab === "attendance" && (
        <>
          {attLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : attendance && attendance.length > 0 ? (
            <FlatList
              data={attendance}
              keyExtractor={(a) => a.id}
              renderItem={renderAttItem}
              contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No attendance records
              </Text>
            </View>
          )}
        </>
      )}

      {/* Teacher: Classes */}
      {isTeacher && (
        <>
          {tClassLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : teacherClasses && teacherClasses.length > 0 ? (
            <ScrollView
              contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
            >
              {teacherClasses.map((c) => (
                <View key={c.id} style={[styles.teacherClassCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.tcIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Ionicons name="school-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.tcInfo}>
                    <Text style={[styles.tcClass, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {c.classes?.name ?? "—"}
                    </Text>
                    <Text style={[styles.tcSubject, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {c.subjects?.name ?? "—"} ({c.subjects?.code ?? ""})
                    </Text>
                  </View>
                  <Text style={[styles.tcLevel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {c.classes?.level ?? ""}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.center}>
              <Ionicons name="school-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No classes assigned
              </Text>
            </View>
          )}
        </>
      )}

      {/* Admin: Staff */}
      {isAdmin && (
        <>
          {staffLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : allStaff && allStaff.length > 0 ? (
            <FlatList
              data={allStaff}
              keyExtractor={(s) => s.id}
              renderItem={({ item: s }) => (
                <View style={[styles.staffRow, { borderColor: colors.border }]}>
                  <View style={[styles.staffAvatar, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.staffInitials, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                      {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.staffInfo}>
                    <Text style={[styles.staffName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {s.first_name} {s.last_name}
                    </Text>
                    <Text style={[styles.staffRole, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {getRoleLabel(s.role)}
                    </Text>
                  </View>
                  {!!s.staff_id && (
                    <Text style={[styles.staffId, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {s.staff_id}
                    </Text>
                  )}
                </View>
              )}
              contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.center}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No staff found
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, marginBottom: 12 },
  tabRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabBtnText: { fontSize: 14 },
  listContent: { paddingHorizontal: 20, paddingTop: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15 },
  gradeCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  gradeLeft: { flex: 1 },
  gradeSubject: { fontSize: 15 },
  gradeClass: { fontSize: 12, marginTop: 2 },
  gradeBreakdown: { marginTop: 4 },
  breakdownText: { fontSize: 12 },
  gradeRight: { alignItems: "center", gap: 4 },
  gradeScore: { fontSize: 24 },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  gradeLetter: { fontSize: 14 },
  attRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  attDate: { fontSize: 14 },
  attBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  attStatus: { fontSize: 13 },
  teacherClassCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  tcIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tcInfo: { flex: 1 },
  tcClass: { fontSize: 15 },
  tcSubject: { fontSize: 13, marginTop: 2 },
  tcLevel: { fontSize: 12 },
  staffRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  staffAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  staffInitials: { fontSize: 16 },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15 },
  staffRole: { fontSize: 12, marginTop: 2 },
  staffId: { fontSize: 12 },
});
