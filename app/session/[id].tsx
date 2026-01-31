import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, typography, spacing, radius, safeArea, textStyles } from "../../styles/theme";
import {
  GutRecordingSession,
  PROTOCOL_CONFIG,
  MEAL_TIMING_OPTIONS,
  POSTURE_OPTIONS,
  getMotilityCategory,
  getMotilityCategoryLabel,
  MotilityCategory,
  SymptomTag,
  SYMPTOM_TAG_OPTIONS,
} from "../../src/models/session";
import {
  getSession,
  updateSessionNotes,
  updateSessionTags,
} from "../../src/storage/sessionStore";
import SymptomTagChip from "../../components/SymptomTagChip";
import PrimaryButton from "../../components/PrimaryButton";
import { exportSessionPDF } from "../../src/logic/exportHelper";
import { analyzeBiofeedback, BiofeedbackResult } from "../../src/logic/insightEngine";
import {
  calculateVagalReadinessScore,
  VagalReadinessScore,
  getVagalReadinessCategoryLabel,
  getVagalReadinessCategoryColor,
  generateVagalReadinessInsight,
} from "../../src/logic/scoringEngine";
import { getActivePatientId } from "../../src/storage/patientStore";
import { Alert } from "react-native";
import ResultsDashboard from "../../components/results/ResultsDashboard";

// Motility badge component
function MotilityBadge({
  index,
  category,
}: {
  index: number;
  category: MotilityCategory;
}) {
  const badgeColors = {
    quiet: { bg: "rgba(59, 130, 246, 0.15)", text: colors.info },
    normal: { bg: colors.accentDim, text: colors.accent },
    active: { bg: "rgba(34, 197, 94, 0.15)", text: colors.success },
  };

  const color = badgeColors[category];

  return (
    <View style={styles.motilityBadgeContainer}>
      <Text style={styles.motilityIndex}>{index}</Text>
      <View style={[styles.motilityBadge, { backgroundColor: color.bg }]}>
        <Text style={[styles.motilityBadgeText, { color: color.text }]}>
          {getMotilityCategoryLabel(category)}
        </Text>
      </View>
    </View>
  );
}

// Simple bar chart for activity timeline
function ActivityTimeline({ data }: { data: number[] }) {
  const maxValue = Math.max(...data, 1);

  return (
    <View style={styles.timelineContainer}>
      <Text style={styles.timelineTitle}>Activity Over Time</Text>
      <View style={styles.timelineChart}>
        {data.map((value, index) => (
          <View key={index} style={styles.timelineBarContainer}>
            <View
              style={[
                styles.timelineBar,
                {
                  height: `${(value / maxValue) * 100}%`,
                  backgroundColor:
                    value > 60
                      ? colors.success
                      : value > 30
                        ? colors.accent
                        : colors.info,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.timelineLabels}>
        <Text style={styles.timelineLabel}>Start</Text>
        <Text style={styles.timelineLabel}>End</Text>
      </View>
    </View>
  );
}

// Metric card component
function MetricCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit && <Text style={styles.metricUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

// Context tag component
function ContextTag({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contextTag}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue}>{value}</Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<GutRecordingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [selectedTags, setSelectedTags] = useState<SymptomTag[]>([]);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [vagalScore, setVagalScore] = useState<VagalReadinessScore | null>(null);

  useEffect(() => {
    loadSession();
  }, [id]);

  useEffect(() => {
    loadVagalScore();
  }, [session]);

  const loadSession = async () => {
    if (!id) return;

    try {
      const sessionData = await getSession(id);
      if (sessionData) {
        setSession(sessionData);
        setNotes(sessionData.notes || "");
      }
    } catch (err) {
      console.error("Error loading session:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadVagalScore = async () => {
    if (!session || !session.analytics) return;

    try {
      const patientId = await getActivePatientId();
      if (patientId) {
        const score = await calculateVagalReadinessScore(session, patientId);
        setVagalScore(score);
      }
    } catch (err) {
      console.error("Error loading vagal score:", err);
    }
  };

  const handleSaveNotes = async () => {
    if (!session) return;

    try {
      await updateSessionNotes(session.id, notes);
      setSession({ ...session, notes });
      setIsEditingNotes(false);
    } catch (err) {
      console.error("Error saving notes:", err);
    }
  };

  const handleTagToggle = (tag: SymptomTag) => {
    if (isEditingTags) {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    }
  };

  const handleSaveTags = async () => {
    if (!session) return;

    try {
      await updateSessionTags(session.id, selectedTags);
      setSession({ ...session, tags: selectedTags.length > 0 ? selectedTags : undefined });
      setIsEditingTags(false);
    } catch (err) {
      console.error("Error saving tags:", err);
    }
  };

  const handleExportPDF = async () => {
    if (!session) return;

    try {
      await exportSessionPDF(session, true);
    } catch (error) {
      Alert.alert(
        "Export Failed",
        "Unable to generate PDF report. Please try again.",
        [{ text: "OK" }]
      );
      console.error("Error exporting PDF:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Session not found</Text>
        </View>
      </View>
    );
  }

  const protocol = PROTOCOL_CONFIG[session.protocolType];
  const mealTiming = MEAL_TIMING_OPTIONS.find(
    (m) => m.value === session.context.mealTiming
  );
  const posture = POSTURE_OPTIONS.find(
    (p) => p.value === session.context.posture
  );
  const analytics = session.analytics;
  const motilityCategory = analytics
    ? getMotilityCategory(analytics.motilityIndex)
    : "normal";
  
  // Calculate biofeedback result if vagal breathing was used
  const biofeedbackResult = session.vagalBreathing?.enabled
    ? analyzeBiofeedback(session)
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <PrimaryButton
          title="Export PDF"
          onPress={handleExportPDF}
          variant="primary"
          size="sm"
          fullWidth={false}
          style={styles.exportButton}
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.protocolBadge}>
          <Text style={styles.protocolText}>{protocol.label}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(session.createdAt)}</Text>
        <Text style={styles.timeText}>{formatTime(session.createdAt)}</Text>
      </View>

      {/* Gut-Brain Snapshot Dashboard */}
      {analytics && (
        <View style={styles.dashboardSection}>
          <ResultsDashboard
            analytics={analytics}
            date={session.createdAt}
          />
        </View>
      )}

      {/* Vagal Readiness Score - PRIMARY DISPLAY */}
      {vagalScore && (
        <View style={[styles.vagalScoreCard, { borderColor: getVagalReadinessCategoryColor(vagalScore.category) }]}>
          <Text style={styles.vagalScoreLabel}>Vagal Readiness Score</Text>
          <View style={styles.vagalScoreRow}>
            <Text style={[styles.vagalScoreValue, { color: getVagalReadinessCategoryColor(vagalScore.category) }]}>
              {vagalScore.score}
            </Text>
            <View style={[styles.vagalCategoryBadge, { backgroundColor: getVagalReadinessCategoryColor(vagalScore.category) + '20' }]}>
              <Text style={[styles.vagalCategoryText, { color: getVagalReadinessCategoryColor(vagalScore.category) }]}>
                {getVagalReadinessCategoryLabel(vagalScore.category, vagalScore.isIncomplete)}
              </Text>
            </View>
          </View>
          <View style={styles.vagalComponentsRow}>
            <View style={styles.vagalComponent}>
              <Text style={styles.vagalComponentLabel}>Baseline</Text>
              <Text style={styles.vagalComponentValue}>{vagalScore.components.baselineComponent}</Text>
            </View>
            <View style={styles.vagalComponent}>
              <Text style={styles.vagalComponentLabel}>Rhythm</Text>
              <Text style={styles.vagalComponentValue}>{vagalScore.components.rhythmicityComponent}</Text>
            </View>
            <View style={styles.vagalComponent}>
              <Text style={styles.vagalComponentLabel}>4-7-8 Delta</Text>
              <Text style={styles.vagalComponentValue}>{vagalScore.components.interventionComponent}</Text>
            </View>
          </View>
          <Text style={styles.vagalInsight}>{generateVagalReadinessInsight(vagalScore)}</Text>
        </View>
      )}

      {/* Motility Score */}
      {analytics && (
        <View style={styles.motilityCard}>
          <Text style={styles.motilityTitle}>Motility Index</Text>
          <MotilityBadge
            index={analytics.motilityIndex}
            category={motilityCategory}
          />
          <Text style={styles.motilityDescription}>
            Based on {analytics.eventsPerMinute} events/min detected during your{" "}
            {formatDuration(session.durationSeconds)} recording.
          </Text>
        </View>
      )}

      {/* Metrics Grid */}
      {analytics && (
        <View style={styles.metricsGrid}>
          <MetricCard
            icon="🎯"
            label="Events/min"
            value={analytics.eventsPerMinute}
          />
          <MetricCard
            icon="⏱"
            label="Duration"
            value={formatDuration(session.durationSeconds)}
          />
          <MetricCard
            icon="🔊"
            label="Active Time"
            value={analytics.totalActiveSeconds}
            unit="sec"
          />
          <MetricCard
            icon="🔇"
            label="Quiet Time"
            value={analytics.totalQuietSeconds}
            unit="sec"
          />
        </View>
      )}

      {/* Activity Timeline */}
      {analytics && analytics.activityTimeline.length > 0 && (
        <ActivityTimeline data={analytics.activityTimeline} />
      )}

      {/* Biofeedback Success Card */}
      {biofeedbackResult && (
        <View
          style={[
            styles.biofeedbackCard,
            biofeedbackResult.success
              ? styles.biofeedbackCardSuccess
              : styles.biofeedbackCardInfo,
          ]}
        >
          <View style={styles.biofeedbackHeader}>
            <Text
              style={[
                styles.biofeedbackIcon,
                biofeedbackResult.success
                  ? styles.biofeedbackIconSuccess
                  : styles.biofeedbackIconInfo,
              ]}
            >
              {biofeedbackResult.success ? "✓" : "ℹ"}
            </Text>
            <Text
              style={[
                styles.biofeedbackTitle,
                biofeedbackResult.success
                  ? styles.biofeedbackTitleSuccess
                  : styles.biofeedbackTitleInfo,
              ]}
            >
              {biofeedbackResult.success
                ? "Biofeedback Success"
                : "Biofeedback Results"}
            </Text>
          </View>
          <Text
            style={[
              styles.biofeedbackMessage,
              biofeedbackResult.success
                ? styles.biofeedbackMessageSuccess
                : styles.biofeedbackMessageInfo,
            ]}
          >
            {biofeedbackResult.message}
          </Text>
        </View>
      )}

      {/* Recording Context */}
      <Text style={styles.sectionTitle}>Recording Context</Text>
      <View style={styles.contextContainer}>
        <ContextTag label="Since last meal" value={mealTiming?.label || "Unknown"} />
        <ContextTag label="Stress level" value={`${session.context.stressLevel}/10`} />
        <ContextTag label="Posture" value={posture?.label || "Unknown"} />
        <ContextTag
          label="State of Mind"
          value={session.context.stateOfMind || "Calm"}
        />
        {session.context.intervention && session.context.intervention !== "None" && (
          <ContextTag label="Intervention" value={session.context.intervention} />
        )}
      </View>

      {/* Symptom Tags Section */}
      <Text style={styles.sectionTitle}>Symptom Tags</Text>
      {isEditingTags ? (
        <View style={styles.tagsEditContainer}>
          <View style={styles.tagsChipContainer}>
            {SYMPTOM_TAG_OPTIONS.map((option) => (
              <SymptomTagChip
                key={option.value}
                tag={option.value}
                selected={selectedTags.includes(option.value)}
                onPress={handleTagToggle}
              />
            ))}
          </View>
          <View style={styles.tagsButtonRow}>
            <TouchableOpacity
              style={styles.tagsCancelButton}
              onPress={() => {
                setSelectedTags(session.tags || []);
                setIsEditingTags(false);
              }}
            >
              <Text style={styles.tagsCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tagsSaveButton}
              onPress={handleSaveTags}
            >
              <Text style={styles.tagsSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.tagsDisplayContainer}
          onPress={() => setIsEditingTags(true)}
        >
          {session.tags && session.tags.length > 0 ? (
            <View style={styles.tagsChipContainer}>
              {session.tags.map((tag) => (
                <View key={tag} style={styles.tagDisplayChip}>
                  <Text style={styles.tagDisplayText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.tagsPlaceholder}>
              Tap to add symptom tags...
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Notes Section */}
      <Text style={styles.sectionTitle}>Notes</Text>
      {isEditingNotes ? (
        <View style={styles.notesEditContainer}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about symptoms, food, or how you felt..."
            placeholderTextColor="#666666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.notesButtonRow}>
            <TouchableOpacity
              style={styles.notesCancelButton}
              onPress={() => {
                setNotes(session.notes || "");
                setIsEditingNotes(false);
              }}
            >
              <Text style={styles.notesCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notesSaveButton}
              onPress={handleSaveNotes}
            >
              <Text style={styles.notesSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.notesDisplayContainer}
          onPress={() => setIsEditingNotes(true)}
        >
          {session.notes ? (
            <Text style={styles.notesText}>{session.notes}</Text>
          ) : (
            <Text style={styles.notesPlaceholder}>
              Tap to add notes about this session...
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Coaching Note */}
      <View style={styles.coachingCard}>
        <Text style={styles.coachingIcon}>💡</Text>
        <Text style={styles.coachingText}>
          Track consistently to discover your personal patterns. This is for
          self-exploration, not medical diagnosis.
        </Text>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: safeArea.horizontal,
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  backButton: {
    flex: 1,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  exportButton: {
    marginLeft: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  // Header
  header: {
    marginBottom: spacing.xl,
  },
  // Dashboard
  dashboardSection: {
    marginBottom: spacing.xl,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginHorizontal: -spacing.sm,
  },
  protocolBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  protocolText: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  dateText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  timeText: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  // Motility Card
  motilityCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  motilityTitle: {
    ...textStyles.caption,
    marginBottom: spacing.sm,
  },
  motilityBadgeContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  motilityIndex: {
    color: colors.textPrimary,
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
  },
  motilityBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  motilityBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  motilityDescription: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  metricIcon: {
    fontSize: typography.sizes.lg,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...textStyles.caption,
    marginBottom: spacing.xs,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  metricUnit: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginLeft: spacing.xs,
  },
  // Timeline
  timelineContainer: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  timelineTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  timelineChart: {
    flexDirection: "row",
    height: 80,
    gap: spacing.xs,
    alignItems: "flex-end",
  },
  timelineBarContainer: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  timelineBar: {
    width: "100%",
    borderRadius: 2,
    minHeight: 4,
  },
  timelineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  timelineLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  // Section
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  // Context Tags
  contextContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  contextTag: {
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextLabel: {
    ...textStyles.caption,
    marginBottom: spacing.xs,
  },
  contextValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  // Notes
  notesEditContainer: {
    marginBottom: spacing.xl,
  },
  notesInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: "#000000",
    fontSize: typography.sizes.base,
    minHeight: 100,
  },
  notesButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  notesCancelButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  notesCancelText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  notesSaveButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  notesSaveText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  notesDisplayContainer: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    minHeight: 60,
  },
  notesText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  notesPlaceholder: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
    fontStyle: "italic",
  },
  // Biofeedback Card
  biofeedbackCard: {
    flexDirection: "column",
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  biofeedbackCardSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: colors.success,
  },
  biofeedbackCardInfo: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: colors.info,
  },
  biofeedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  biofeedbackIcon: {
    fontSize: typography.sizes.lg,
  },
  biofeedbackIconSuccess: {
    color: colors.success,
  },
  biofeedbackIconInfo: {
    color: colors.info,
  },
  biofeedbackTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
    flex: 1,
  },
  biofeedbackTitleSuccess: {
    color: colors.success,
  },
  biofeedbackTitleInfo: {
    color: colors.info,
  },
  biofeedbackMessage: {
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
    flex: 1,
  },
  biofeedbackMessageSuccess: {
    color: colors.textPrimary,
  },
  biofeedbackMessageInfo: {
    color: colors.textPrimary,
  },
  // Coaching Card
  coachingCard: {
    flexDirection: "row",
    backgroundColor: colors.backgroundElevated,
    padding: spacing.base,
    borderRadius: radius.md,
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  coachingIcon: {
    fontSize: typography.sizes.base,
  },
  coachingText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  bottomSpacer: {
    height: spacing["3xl"],
  },
  // Symptom Tags
  tagsEditContainer: {
    marginBottom: spacing.xl,
  },
  tagsChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.md,
  },
  tagsButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  tagsCancelButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  tagsCancelText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  tagsSaveButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  tagsSaveText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  tagsDisplayContainer: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    minHeight: 60,
  },
  tagDisplayChip: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tagDisplayText: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  tagsPlaceholder: {
    ...textStyles.caption,
    fontStyle: "italic",
  },
  // Vagal Readiness Score styles
  vagalScoreCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  vagalScoreLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  vagalScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  vagalScoreValue: {
    fontSize: 56,
    fontWeight: typography.weights.bold,
  },
  vagalCategoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  vagalCategoryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  vagalComponentsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  vagalComponent: {
    alignItems: "center",
  },
  vagalComponentLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
  },
  vagalComponentValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  vagalInsight: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: "center",
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
    fontStyle: "italic",
  },
});
