import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Timetable, StudentEnrollment } from "@/lib/types";

const DAYS_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SUBJECT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
];

function getSubjectColor(subjectId: string) {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const todayNum = new Date().getDay() || 7;
  const [selectedDay, setSelectedDay] = useState(todayNum <= 5 ? todayNum : 1);

  const role = profile?.role ?? "student";
  const isStudent = role === "student";
  const isTeacher = ["teacher", "head_teacher"].includes(role);

  const { data: enrollment } = useQuery<StudentEnrollment | null>({
    queryKey: ["enrollment-schedule", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_enrollments")
        .select("class_id, classes(id, name, level)")
        .eq("student_id", profile!.id)
        .eq("status", "active")
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!profile && isStudent,
  });

  const { data: studentTimetable, isLoading: stLoading } = useQuery<Timetable[]>({
    queryKey: ["timetable-student", enrollment?.class_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetables")
        .select("*, subjects(id, name, code), profiles(id, first_name, last_name)")
        .eq("class_id", enrollment!.class_id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!enrollment?.class_id && isStudent,
  });

  const { data: teacherTimetable, isLoading: ttLoading } = useQuery<Timetable[]>({
    queryKey: ["timetable-teacher", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetables")
        .select("*, subjects(id, name, code), classes(id, name, level)")
        .eq("teacher_id", profile!.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile && isTeacher,
  });

  const timetable = isStudent ? studentTimetable : teacherTimetable;
  const isLoading = stLoading || ttLoading;

  const daySlots = (timetable ?? []).filter((t) => t.day_of_week === selectedDay);

  const weekDays = [1, 2, 3, 4, 5];
  const dayHasClasses = (day: number) =>
    (timetable ?? []).some((t) => t.day_of_week === day);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Timetable
        </Text>
        {enrollment?.classes && isStudent && (
          <Text style={[styles.classLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {enrollment.classes.name}
          </Text>
        )}

        {/* Day selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
          {weekDays.map((d) => {
            const isSelected = selectedDay === d;
            const hasClasses = dayHasClasses(d);
            const isToday = d === todayNum;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setSelectedDay(d)}
                style={[
                  styles.dayBtn,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.dayShort, { color: isSelected ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {DAYS_SHORT[d]}
                </Text>
                {hasClasses && !isSelected && (
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                )}
                {isToday && (
                  <View style={[styles.todayDot, { backgroundColor: isSelected ? colors.primaryForeground : colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.dayFull, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {DAYS_FULL[selectedDay]}
          {selectedDay === todayNum && (
            <Text style={[styles.todayTag, { color: colors.primary }]}> · Today</Text>
          )}
        </Text>

        {isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : daySlots.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No classes scheduled
            </Text>
          </View>
        ) : (
          <View style={styles.slotsContainer}>
            {daySlots.map((slot, idx) => {
              const color = getSubjectColor(slot.subject_id);
              return (
                <View key={slot.id} style={styles.slotRow}>
                  {/* Time column */}
                  <View style={styles.timeCol}>
                    <Text style={[styles.timeStart, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {formatTime(slot.start_time)}
                    </Text>
                    <View style={[styles.timeLine, { backgroundColor: color }]} />
                    <Text style={[styles.timeEnd, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {formatTime(slot.end_time)}
                    </Text>
                  </View>

                  {/* Card */}
                  <View style={[styles.slotCard, { backgroundColor: colors.card, borderColor: color + "40", borderLeftColor: color, borderLeftWidth: 3 }]}>
                    <Text style={[styles.slotSubject, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {slot.subjects?.name ?? "—"}
                    </Text>
                    {isStudent && slot.profiles && (
                      <Text style={[styles.slotTeacher, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        <Ionicons name="person-outline" size={11} color={colors.mutedForeground} />
                        {" "}{slot.profiles.first_name} {slot.profiles.last_name}
                      </Text>
                    )}
                    {isTeacher && slot.classes && (
                      <Text style={[styles.slotTeacher, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        <Ionicons name="school-outline" size={11} color={colors.mutedForeground} />
                        {" "}{slot.classes.name}
                      </Text>
                    )}
                    {!!slot.room && (
                      <Text style={[styles.slotRoom, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        <Ionicons name="location-outline" size={11} color={colors.mutedForeground} />
                        {" Room "}{slot.room}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, marginBottom: 2 },
  classLabel: { fontSize: 14, marginBottom: 12 },
  dayScroll: { marginTop: 12 },
  dayBtn: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 8, position: "relative" },
  dayShort: { fontSize: 14 },
  dot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 8 },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, position: "absolute", bottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  dayFull: { fontSize: 20, marginBottom: 20 },
  todayTag: { fontSize: 16 },
  center: { paddingTop: 60, alignItems: "center" },
  emptyDay: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  slotsContainer: { gap: 0 },
  slotRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  timeCol: { width: 64, alignItems: "center", paddingTop: 4 },
  timeStart: { fontSize: 13, textAlign: "center" },
  timeLine: { width: 1, flex: 1, minHeight: 20, marginVertical: 4 },
  timeEnd: { fontSize: 11, textAlign: "center" },
  slotCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  slotSubject: { fontSize: 15 },
  slotTeacher: { fontSize: 13 },
  slotRoom: { fontSize: 13 },
});
