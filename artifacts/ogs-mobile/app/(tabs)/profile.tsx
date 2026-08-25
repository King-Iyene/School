import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const colors = useColors();
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <View style={[iStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[iStyles.iconWrap, { backgroundColor: colors.muted }]}>{icon}</View>
      <View style={iStyles.info}>
        <Text style={[iStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {label}
        </Text>
        <Text style={[iStyles.value, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const iStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  label: { fontSize: 12 },
  value: { fontSize: 15, marginTop: 1 },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const getRoleBadgeColor = (role: string) => {
    if (role === "student") return colors.primary;
    if (["teacher", "head_teacher"].includes(role)) return "#6366f1";
    if (role === "parent") return "#f59e0b";
    if (["admin", "super_admin", "principal"].includes(role)) return "#ef4444";
    return colors.mutedForeground;
  };

  const getRoleLabel = (role: string) =>
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      signOut();
      return;
    }
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            signOut();
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!profile) return null;

  const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
  const roleBadgeColor = getRoleBadgeColor(profile.role);
  const dob = profile.date_of_birth
    ? new Date(profile.date_of_birth).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + Name */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatarRing, { borderColor: roleBadgeColor + "60" }]}>
          <View style={[styles.avatar, { backgroundColor: roleBadgeColor + "25" }]}>
            <Text style={[styles.initials, { color: roleBadgeColor, fontFamily: "Inter_700Bold" }]}>
              {initials}
            </Text>
          </View>
        </View>
        <Text style={[styles.fullName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {profile.first_name} {profile.last_name}
        </Text>
        <View style={[styles.rolePill, { backgroundColor: roleBadgeColor + "20", borderColor: roleBadgeColor + "40" }]}>
          <Text style={[styles.roleLabel, { color: roleBadgeColor, fontFamily: "Inter_600SemiBold" }]}>
            {getRoleLabel(profile.role)}
          </Text>
        </View>
      </View>

      {/* Info Section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          PERSONAL INFORMATION
        </Text>
        <InfoRow
          icon={<Ionicons name="mail-outline" size={16} color={colors.mutedForeground} />}
          label="Email"
          value={profile.email}
        />
        <InfoRow
          icon={<Ionicons name="call-outline" size={16} color={colors.mutedForeground} />}
          label="Phone"
          value={profile.phone}
        />
        {!!dob && (
          <InfoRow
            icon={<Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />}
            label="Date of Birth"
            value={dob}
          />
        )}
        <InfoRow
          icon={<Ionicons name="person-outline" size={16} color={colors.mutedForeground} />}
          label="Gender"
          value={profile.gender?.charAt(0).toUpperCase() + (profile.gender?.slice(1) ?? "")}
        />
        {!!profile.address && (
          <InfoRow
            icon={<Ionicons name="home-outline" size={16} color={colors.mutedForeground} />}
            label="Address"
            value={profile.address}
          />
        )}
      </View>

      {/* IDs Section */}
      {(!!profile.student_id || !!profile.staff_id || !!profile.admission_number) && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            IDENTIFICATION
          </Text>
          {!!profile.admission_number && (
            <InfoRow
              icon={<MaterialCommunityIcons name="card-account-details-outline" size={16} color={colors.mutedForeground} />}
              label="Admission Number"
              value={profile.admission_number}
            />
          )}
          {!!profile.student_id && (
            <InfoRow
              icon={<MaterialCommunityIcons name="badge-account-outline" size={16} color={colors.mutedForeground} />}
              label="Student ID"
              value={profile.student_id}
            />
          )}
          {!!profile.staff_id && (
            <InfoRow
              icon={<MaterialCommunityIcons name="badge-account-outline" size={16} color={colors.mutedForeground} />}
              label="Staff ID"
              value={profile.staff_id}
            />
          )}
        </View>
      )}

      {/* Account Section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          ACCOUNT
        </Text>
        <View style={[iStyles.row, { borderBottomColor: colors.border }]}>
          <View style={[iStyles.iconWrap, { backgroundColor: colors.success + "20" }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          </View>
          <View style={iStyles.info}>
            <Text style={[iStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Status
            </Text>
            <Text style={[iStyles.value, { color: colors.success, fontFamily: "Inter_500Medium" }]}>
              Active
            </Text>
          </View>
        </View>
        <View style={[iStyles.row, { borderBottomWidth: 0 }]}>
          <View style={[iStyles.iconWrap, { backgroundColor: colors.muted }]}>
            <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
          </View>
          <View style={iStyles.info}>
            <Text style={[iStyles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Member Since
            </Text>
            <Text style={[iStyles.value, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              {new Date(profile.created_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        testID="sign-out-btn"
        onPress={handleSignOut}
        style={[styles.signOutBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "30" }]}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
          Sign Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 2.5, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  initials: { fontSize: 32 },
  fullName: { fontSize: 24, marginBottom: 8 },
  rolePill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  roleLabel: { fontSize: 13 },
  section: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, paddingVertical: 12, letterSpacing: 0.8 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, borderWidth: 1, height: 54 },
  signOutText: { fontSize: 16 },
});
