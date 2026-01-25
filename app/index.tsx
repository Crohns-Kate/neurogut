/**
 * Guided Daily Check-in Home Screen
 *
 * NG-V2-EVOLUTION: Replaces 4-tab system with a single guided check-in flow
 * User is guided through daily wellness tracking with clear CTAs
 */

import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import PrimaryButton from "../components/PrimaryButton";
import {
  GutRecordingSession,
  PROTOCOL_CONFIG,
  getMotilityCategory,
  getMotilityCategoryLabel,
  MotilityCategory,
} from "../src/models/session";
import { getSessionsSortedByDate } from "../src/storage/sessionStore";
import {
  loadAllPatients,
  getActivePatient,
  setActivePatientId,
  createAndAddPatient,
  PatientProfile,
} from "../src/storage/patientStore";
import {
  calculateVagalReadinessScore,
  VagalReadinessScore,
  getVagalReadinessCategoryLabel,
  getVagalReadinessCategoryColor,
  generateVagalReadinessInsight,
} from "../src/logic/scoringEngine";

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;
const SYMPTOM_STORAGE_KEY = "symptomEntries";

// Pre-Session State options
type PreSessionState = "reclined" | "sitting" | "standing" | null;
type PreSessionContext = "fasting" | "post-meal" | "stressed" | null;

// Motility badge colors
const motilityColors: Record<MotilityCategory, { bg: string; text: string }> = {
  quiet: { bg: "rgba(59, 130, 246, 0.15)", text: colors.info },
  normal: { bg: colors.accentDim, text: colors.accent },
  active: { bg: "rgba(34, 197, 94, 0.15)", text: colors.success },
};

export default function GuidedCheckInScreen() {
  const router = useRouter();
  const [lastRecordingDate, setLastRecordingDate] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<GutRecordingSession[]>([]);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [activePatientId, setActivePatientIdState] = useState<string | null>(null);
  const [vagalScore, setVagalScore] = useState<VagalReadinessScore | null>(null);

  // Pre-Session Tagging Modal state
  const [showPreSessionModal, setShowPreSessionModal] = useState(false);
  const [preSessionState, setPreSessionState] = useState<PreSessionState>(null);
  const [preSessionContext, setPreSessionContext] = useState<PreSessionContext>(null);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const loadStats = useCallback(async () => {
    // Load recent sessions and count (filtered by active patient)
    try {
      const activePatient = await getActivePatient();
      const patientId = activePatient?.id;

      // SECURITY: Only load sessions if patient is selected
      if (!patientId) {
        setRecentSessions([]);
        setSessionCount(0);
        setLastRecordingDate(null);
        setVagalScore(null);
        return;
      }

      const sessions = await getSessionsSortedByDate(patientId, 3);
      setRecentSessions(sessions);

      // Get total session count
      const allSessions = await getSessionsSortedByDate(patientId);
      setSessionCount(allSessions.length);

      // Get most recent recording date
      if (allSessions.length > 0) {
        const mostRecent = allSessions[0];
        setLastRecordingDate(formatRelativeDate(mostRecent.createdAt));

        // Calculate Vagal Readiness Score from most recent session
        if (mostRecent.analytics) {
          const score = await calculateVagalReadinessScore(mostRecent, patientId);
          setVagalScore(score);
        }
      } else {
        setLastRecordingDate(null);
        setVagalScore(null);
      }
    } catch {
      setRecentSessions([]);
      setSessionCount(0);
      setLastRecordingDate(null);
      setVagalScore(null);
    }

    // Load patients
    try {
      const allPatients = await loadAllPatients();
      setPatients(allPatients);
      const activePatient = await getActivePatient();
      setActivePatientIdState(activePatient?.id || null);
    } catch (error) {
      console.error("Error loading patients:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const formatRelativeDate = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const diffDays = Math.floor(
      (today.getTime() - entryDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Yesterday at ${timeStr}`;
    if (diffDays < 7) {
      return `${date.toLocaleDateString([], { weekday: "long" })}`;
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Handle starting a recording session after pre-session tagging
  const handleStartSession = () => {
    if (!activePatientId) {
      Alert.alert(
        "Select Patient",
        "Please select a patient profile before starting a session.",
        [{ text: "OK" }]
      );
      return;
    }
    setShowPreSessionModal(true);
  };

  const handleConfirmPreSession = () => {
    if (!preSessionState || !preSessionContext) {
      Alert.alert(
        "Complete Selection",
        "Please select both your current state and context before continuing.",
        [{ text: "OK" }]
      );
      return;
    }

    // Store pre-session selections for the recording screen
    AsyncStorage.setItem(
      "preSessionTags",
      JSON.stringify({
        state: preSessionState,
        context: preSessionContext,
        timestamp: new Date().toISOString(),
      })
    );

    setShowPreSessionModal(false);
    setPreSessionState(null);
    setPreSessionContext(null);
    router.push("/record");
  };

  const handleCancelPreSession = () => {
    setShowPreSessionModal(false);
    setPreSessionState(null);
    setPreSessionContext(null);
  };

  // Get active patient name
  const activePatientName = patients.find((p) => p.id === activePatientId)?.code || "Select Patient";

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandIcon}>🌿</Text>
          <Text style={styles.brandName}>Neurogut</Text>
        </View>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.tagline}>Ready for your daily check-in?</Text>
      </View>

      {/* Vagal Readiness Score Card */}
      {vagalScore && (
        <View style={styles.vagalScoreCard}>
          <View style={styles.vagalScoreHeader}>
            <Text style={styles.vagalScoreLabel}>Vagal Readiness Score</Text>
            <View style={[styles.vagalScoreBadge, { backgroundColor: getVagalReadinessCategoryColor(vagalScore.category) + "20" }]}>
              <Text style={[styles.vagalScoreBadgeText, { color: getVagalReadinessCategoryColor(vagalScore.category) }]}>
                {getVagalReadinessCategoryLabel(vagalScore.category)}
              </Text>
            </View>
          </View>
          <Text style={[styles.vagalScoreValue, { color: getVagalReadinessCategoryColor(vagalScore.category) }]}>
            {vagalScore.score}
          </Text>
          <Text style={styles.vagalScoreInsight}>{generateVagalReadinessInsight(vagalScore)}</Text>
          <View style={styles.vagalScoreComponents}>
            <View style={styles.vagalScoreComponent}>
              <Text style={styles.componentValue}>{vagalScore.components.baselineComponent}</Text>
              <Text style={styles.componentLabel}>Baseline</Text>
            </View>
            <View style={styles.vagalScoreComponent}>
              <Text style={styles.componentValue}>{vagalScore.components.rhythmicityComponent}</Text>
              <Text style={styles.componentLabel}>Rhythm</Text>
            </View>
            <View style={styles.vagalScoreComponent}>
              <Text style={styles.componentValue}>{vagalScore.components.interventionComponent}</Text>
              <Text style={styles.componentLabel}>4-7-8 Delta</Text>
            </View>
          </View>
        </View>
      )}

      {/* Main CTA: Start Daily Check-in */}
      <View style={styles.mainCTASection}>
        <TouchableOpacity
          style={styles.mainCTACard}
          onPress={handleStartSession}
          activeOpacity={0.9}
        >
          <View style={styles.mainCTAContent}>
            <Text style={styles.mainCTAIcon}>🎙</Text>
            <View style={styles.mainCTAText}>
              <Text style={styles.mainCTATitle}>Start Daily Check-in</Text>
              <Text style={styles.mainCTASubtitle}>
                Record your gut sounds with guided intervention
              </Text>
            </View>
          </View>
          <View style={styles.mainCTAButton}>
            <Text style={styles.mainCTAButtonText}>Begin</Text>
          </View>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push("/symptoms")}
          >
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={styles.quickActionLabel}>Log Symptoms</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push("/trends")}
          >
            <Text style={styles.quickActionIcon}>📈</Text>
            <Text style={styles.quickActionLabel}>View Trends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push("/protocol")}
          >
            <Text style={styles.quickActionIcon}>📖</Text>
            <Text style={styles.quickActionLabel}>Protocol</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Patient Selector */}
      <TouchableOpacity
        style={styles.patientSelector}
        onPress={() => router.push("/record")}
      >
        <View style={styles.patientSelectorContent}>
          <Text style={styles.patientSelectorLabel}>Active Patient</Text>
          <Text style={styles.patientSelectorValue}>{activePatientName}</Text>
        </View>
        <Text style={styles.patientSelectorArrow}>›</Text>
      </TouchableOpacity>

      {/* Session Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Your Progress</Text>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{sessionCount}</Text>
            <Text style={styles.summaryStatLabel}>Sessions</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>
              {vagalScore?.baselineSessionCount || 0}
            </Text>
            <Text style={styles.summaryStatLabel}>This Week</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>
              {lastRecordingDate ? "Active" : "—"}
            </Text>
            <Text style={styles.summaryStatLabel}>Status</Text>
          </View>
        </View>
        {lastRecordingDate && (
          <Text style={styles.summaryLastSession}>
            Last session: {lastRecordingDate}
          </Text>
        )}
      </View>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <View style={styles.sessionsSection}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {recentSessions.map((session) => {
            const protocol = PROTOCOL_CONFIG[session.protocolType];
            const category = session.analytics
              ? getMotilityCategory(session.analytics.motilityIndex)
              : "normal";
            const categoryColors = motilityColors[category];

            return (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => router.push(`/session/${session.id}`)}
              >
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionProtocol}>{protocol.label}</Text>
                  <Text style={styles.sessionTime}>
                    {formatRelativeDate(session.createdAt)}
                  </Text>
                </View>

                {session.analytics && (
                  <View style={styles.sessionMetrics}>
                    <Text style={styles.motilityValue}>
                      {session.analytics.motilityIndex}
                    </Text>
                    <View
                      style={[
                        styles.motilityBadge,
                        { backgroundColor: categoryColors.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.motilityBadgeText,
                          { color: categoryColors.text },
                        ]}
                      >
                        {getMotilityCategoryLabel(category)}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.sessionArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Empty State for New Users */}
      {sessionCount === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🌱</Text>
          <Text style={styles.emptyStateTitle}>Welcome to Neurogut</Text>
          <Text style={styles.emptyStateText}>
            Start your first daily check-in to begin tracking your gut-brain wellness journey.
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>Track daily for better insights</Text>
      </View>

      {/* Pre-Session Tagging Modal */}
      <Modal
        visible={showPreSessionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelPreSession}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Before We Begin</Text>
            <Text style={styles.modalSubtitle}>
              Select your current state and context for accurate analysis
            </Text>

            {/* State Selection */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Current State *</Text>
              <View style={styles.modalOptions}>
                {[
                  { value: "reclined" as const, label: "Reclined", icon: "🛋️" },
                  { value: "sitting" as const, label: "Sitting", icon: "🪑" },
                  { value: "standing" as const, label: "Standing", icon: "🧍" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalOption,
                      preSessionState === option.value && styles.modalOptionSelected,
                    ]}
                    onPress={() => setPreSessionState(option.value)}
                  >
                    <Text style={styles.modalOptionIcon}>{option.icon}</Text>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        preSessionState === option.value && styles.modalOptionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {preSessionState === option.value && (
                      <Text style={styles.modalOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Context Selection */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Current Context *</Text>
              <View style={styles.modalOptions}>
                {[
                  { value: "fasting" as const, label: "Fasting", icon: "🍃", desc: "4+ hours since eating" },
                  { value: "post-meal" as const, label: "Post-Meal", icon: "🍽️", desc: "Recently ate" },
                  { value: "stressed" as const, label: "Stressed", icon: "⚡", desc: "Feeling tense" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalOption,
                      preSessionContext === option.value && styles.modalOptionSelected,
                    ]}
                    onPress={() => setPreSessionContext(option.value)}
                  >
                    <Text style={styles.modalOptionIcon}>{option.icon}</Text>
                    <View style={styles.modalOptionTextContainer}>
                      <Text
                        style={[
                          styles.modalOptionLabel,
                          preSessionContext === option.value && styles.modalOptionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.modalOptionDesc}>{option.desc}</Text>
                    </View>
                    {preSessionContext === option.value && (
                      <Text style={styles.modalOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCancelPreSession}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  (!preSessionState || !preSessionContext) && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleConfirmPreSession}
                disabled={!preSessionState || !preSessionContext}
              >
                <Text style={styles.modalConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: safeArea.horizontal,
    paddingBottom: spacing["2xl"],
  },

  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
    paddingBottom: spacing.xl,
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  brandIcon: {
    fontSize: typography.sizes["2xl"],
    marginRight: spacing.sm,
  },
  brandName: {
    fontSize: typography.sizes["3xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: typography.letterSpacing.tight,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  tagline: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Vagal Readiness Score Card
  vagalScoreCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vagalScoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  vagalScoreLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  vagalScoreBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  vagalScoreBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  vagalScoreValue: {
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  vagalScoreInsight: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
    marginBottom: spacing.lg,
  },
  vagalScoreComponents: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  vagalScoreComponent: {
    alignItems: "center",
  },
  componentValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  componentLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Main CTA Section
  mainCTASection: {
    marginBottom: spacing.lg,
  },
  mainCTACard: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  mainCTAContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  mainCTAIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  mainCTAText: {
    flex: 1,
  },
  mainCTATitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.background,
    marginBottom: spacing.xs,
  },
  mainCTASubtitle: {
    fontSize: typography.sizes.sm,
    color: "rgba(13, 13, 16, 0.7)",
  },
  mainCTAButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  mainCTAButtonText: {
    color: colors.accent,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },

  // Patient Selector
  patientSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patientSelectorContent: {
    flex: 1,
  },
  patientSelectorLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  patientSelectorValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  patientSelectorArrow: {
    fontSize: typography.sizes.xl,
    color: colors.textMuted,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  summaryStat: {
    alignItems: "center",
    flex: 1,
  },
  summaryStatValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  summaryStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  summaryLastSession: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Sessions Section
  sessionsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionProtocol: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sessionTime: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  sessionMetrics: {
    alignItems: "flex-end",
    marginRight: spacing.sm,
  },
  motilityValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  motilityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  motilityBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  sessionArrow: {
    fontSize: typography.sizes.xl,
    color: colors.textMuted,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },

  // Footer
  footer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  footerDivider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.base,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  modalSection: {
    marginBottom: spacing.xl,
  },
  modalSectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalOptions: {
    gap: spacing.sm,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  modalOptionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  modalOptionTextContainer: {
    flex: 1,
  },
  modalOptionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  modalOptionLabelSelected: {
    color: colors.accent,
  },
  modalOptionDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalOptionCheck: {
    fontSize: typography.sizes.lg,
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundCard,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 2,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  modalConfirmButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  modalConfirmText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
