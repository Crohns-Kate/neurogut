import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import { PROTOCOL_CONFIG, RecordingProtocolType } from "../src/models/session";
import {
  getStatsByProtocol,
  getStressCorrelationStats,
  getSessionCount,
  getUniqueDaysTracked,
  getAverageMotilityIndex,
  ProtocolStats,
  StressCorrelationStats,
} from "../src/storage/sessionStore";

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;
const SYMPTOM_STORAGE_KEY = "symptomEntries";

// Minimum data needed for meaningful insights
const MIN_SESSIONS_FOR_INSIGHTS = 3;
const MIN_SESSIONS_FOR_STRESS = 4; // Need at least 2 high + 2 low

type DataStats = {
  recordingCount: number;
  symptomCount: number;
  daysTracked: number;
  sessionCount: number;
  averageMotility: number | null;
};

function ProgressBar({ current, target }: { current: number; target: number }) {
  const progress = Math.min(current / target, 1);
  return (
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

// Protocol comparison bar chart
function ProtocolComparisonChart({ stats }: { stats: ProtocolStats[] }) {
  const hasData = stats.some((s) => s.sessionCount > 0);
  if (!hasData) return null;

  const maxMotility = Math.max(...stats.map((s) => s.averageMotilityIndex), 1);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Motility by Protocol</Text>
      <Text style={styles.chartSubtitle}>
        Average Motility Index for each recording type
      </Text>

      <View style={styles.protocolBars}>
        {stats.map((stat) => {
          const protocol = PROTOCOL_CONFIG[stat.protocolType];
          const barHeight = stat.sessionCount > 0
            ? (stat.averageMotilityIndex / maxMotility) * 100
            : 0;
          const barColor = stat.protocolType === "quick_check"
            ? colors.info
            : stat.protocolType === "post_meal"
              ? colors.accent
              : colors.success;

          return (
            <View key={stat.protocolType} style={styles.protocolBarColumn}>
              <Text style={styles.protocolBarValue}>
                {stat.sessionCount > 0 ? stat.averageMotilityIndex : "-"}
              </Text>
              <View style={styles.protocolBarContainer}>
                <View
                  style={[
                    styles.protocolBar,
                    { height: `${barHeight}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
              <Text style={styles.protocolBarLabel}>{protocol.label}</Text>
              <Text style={styles.protocolBarCount}>
                {stat.sessionCount} session{stat.sessionCount !== 1 ? "s" : ""}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Stress correlation insight
function StressInsightCard({ stats }: { stats: StressCorrelationStats }) {
  const hasEnoughData =
    stats.lowStressSessions >= 2 && stats.highStressSessions >= 2;

  if (!hasEnoughData) {
    return (
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightIcon}>😌</Text>
          <Text style={styles.insightTitle}>Stress & Motility</Text>
          <Text style={styles.lockedBadge}>Need more data</Text>
        </View>
        <Text style={styles.insightDescription}>
          Track more sessions with varying stress levels to see how stress may relate
          to your gut activity patterns.
        </Text>
      </View>
    );
  }

  const difference = stats.lowStressAvgMotility - stats.highStressAvgMotility;
  const trend = difference > 5 ? "higher" : difference < -5 ? "lower" : "similar";

  let insightText = "";
  if (trend === "higher") {
    insightText = `In your recordings, lower stress sessions (0-3) tend to show higher gut activity (avg ${stats.lowStressAvgMotility}) compared to high stress sessions (7-10, avg ${stats.highStressAvgMotility}).`;
  } else if (trend === "lower") {
    insightText = `In your recordings, higher stress sessions (7-10) tend to show more gut activity (avg ${stats.highStressAvgMotility}) compared to low stress sessions (0-3, avg ${stats.lowStressAvgMotility}).`;
  } else {
    insightText = `Your gut activity appears similar across stress levels. Low stress sessions average ${stats.lowStressAvgMotility} and high stress sessions average ${stats.highStressAvgMotility}.`;
  }

  return (
    <View style={[styles.insightCard, styles.insightCardUnlocked]}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightIcon}>😌</Text>
        <Text style={styles.insightTitle}>Stress & Motility</Text>
      </View>
      <Text style={styles.insightDescription}>{insightText}</Text>
      <View style={styles.insightStats}>
        <View style={styles.insightStat}>
          <Text style={styles.insightStatLabel}>Low Stress (0-3)</Text>
          <Text style={styles.insightStatValue}>{stats.lowStressAvgMotility}</Text>
          <Text style={styles.insightStatCount}>
            {stats.lowStressSessions} sessions
          </Text>
        </View>
        <View style={styles.insightStat}>
          <Text style={styles.insightStatLabel}>High Stress (7-10)</Text>
          <Text style={styles.insightStatValue}>{stats.highStressAvgMotility}</Text>
          <Text style={styles.insightStatCount}>
            {stats.highStressSessions} sessions
          </Text>
        </View>
      </View>
    </View>
  );
}

// Overall average card
function AverageMotilityCard({ average }: { average: number | null }) {
  if (average === null) return null;

  const category =
    average < 33 ? "Quiet" : average < 67 ? "Normal" : "Active";
  const categoryColor =
    average < 33 ? colors.info : average < 67 ? colors.accent : colors.success;

  return (
    <View style={styles.averageCard}>
      <Text style={styles.averageLabel}>Your Average Motility</Text>
      <View style={styles.averageValueRow}>
        <Text style={styles.averageValue}>{Math.round(average)}</Text>
        <View style={[styles.averageBadge, { backgroundColor: `${categoryColor}20` }]}>
          <Text style={[styles.averageBadgeText, { color: categoryColor }]}>
            {category}
          </Text>
        </View>
      </View>
      <Text style={styles.averageHint}>
        This is your personal baseline across all recordings
      </Text>
    </View>
  );
}

export default function AIGutInsightsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DataStats>({
    recordingCount: 0,
    symptomCount: 0,
    daysTracked: 0,
    sessionCount: 0,
    averageMotility: null,
  });
  const [protocolStats, setProtocolStats] = useState<ProtocolStats[]>([]);
  const [stressStats, setStressStats] = useState<StressCorrelationStats>({
    lowStressSessions: 0,
    lowStressAvgMotility: 0,
    highStressSessions: 0,
    highStressAvgMotility: 0,
  });

  const loadStats = useCallback(async () => {
    let recordingCount = 0;
    let symptomCount = 0;

    // Count recordings from filesystem
    try {
      const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (info.exists) {
        const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
        recordingCount = files.filter((f) => f.endsWith(".m4a")).length;
      }
    } catch {
      recordingCount = 0;
    }

    // Count symptom entries
    try {
      const data = await AsyncStorage.getItem(SYMPTOM_STORAGE_KEY);
      if (data) {
        const entries = JSON.parse(data) as Array<unknown>;
        symptomCount = entries.length;
      }
    } catch {
      symptomCount = 0;
    }

    // Get session store stats
    const sessionCount = await getSessionCount();
    const daysTracked = await getUniqueDaysTracked();
    const averageMotility = await getAverageMotilityIndex();
    const protocolData = await getStatsByProtocol();
    const stressData = await getStressCorrelationStats();

    setStats({
      recordingCount,
      symptomCount,
      daysTracked,
      sessionCount,
      averageMotility,
    });
    setProtocolStats(protocolData);
    setStressStats(stressData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const hasEnoughSessions = stats.sessionCount >= MIN_SESSIONS_FOR_INSIGHTS;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Gut Insights</Text>
      <Text style={styles.subtitle}>
        Discover patterns in your gut sounds and symptoms. Track consistently for
        better insights.
      </Text>

      {/* Average Motility Card */}
      <AverageMotilityCard average={stats.averageMotility} />

      {/* Protocol Comparison */}
      {hasEnoughSessions ? (
        <ProtocolComparisonChart stats={protocolStats} />
      ) : (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Motility by Protocol</Text>
          <Text style={styles.chartSubtitle}>
            Record at least {MIN_SESSIONS_FOR_INSIGHTS} sessions to see protocol
            comparisons
          </Text>
          <View style={styles.placeholderBars}>
            {["Quick Check", "Post-Meal", "Mind-Body"].map((label) => (
              <View key={label} style={styles.placeholderBarColumn}>
                <View style={styles.placeholderBar} />
                <Text style={styles.protocolBarLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <ProgressBar current={stats.sessionCount} target={MIN_SESSIONS_FOR_INSIGHTS} />
          <Text style={styles.progressText}>
            {stats.sessionCount} / {MIN_SESSIONS_FOR_INSIGHTS} sessions recorded
          </Text>
        </View>
      )}

      {/* Stress Insight */}
      <Text style={styles.sectionTitle}>Your Patterns</Text>
      <StressInsightCard stats={stressStats} />

      {/* Coaching reminder */}
      <View style={styles.coachingCard}>
        <Text style={styles.coachingIcon}>💡</Text>
        <View style={styles.coachingContent}>
          <Text style={styles.coachingTitle}>Remember</Text>
          <Text style={styles.coachingText}>
            These insights are for personal pattern discovery, not medical diagnosis.
            Your patterns are unique to you.
          </Text>
        </View>
      </View>

      {/* Stats Summary */}
      <Text style={styles.sectionTitle}>Your Tracking</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.sessionCount}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.symptomCount}</Text>
          <Text style={styles.statLabel}>Symptom Logs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.daysTracked}</Text>
          <Text style={styles.statLabel}>Days Tracked</Text>
        </View>
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
  backButton: {
    marginBottom: spacing.base,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  title: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  // Average Card
  averageCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  averageLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  averageValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  averageValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
  },
  averageBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  averageBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  averageHint: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    textAlign: "center",
  },
  // Section
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  // Chart Card
  chartCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  chartSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.base,
  },
  protocolBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  protocolBarColumn: {
    flex: 1,
    alignItems: "center",
  },
  protocolBarValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  protocolBarContainer: {
    width: "100%",
    height: 80,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  protocolBar: {
    width: "100%",
    borderRadius: radius.sm,
  },
  protocolBarLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  protocolBarCount: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    textAlign: "center",
  },
  placeholderBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  placeholderBarColumn: {
    flex: 1,
    alignItems: "center",
  },
  placeholderBar: {
    width: "100%",
    height: 60,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  // Insight Cards
  insightCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  insightCardUnlocked: {
    opacity: 1,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  insightIcon: {
    fontSize: typography.sizes.lg,
  },
  insightTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  lockedBadge: {
    backgroundColor: colors.backgroundElevated,
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  insightDescription: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  insightStats: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: spacing.md,
  },
  insightStat: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  insightStatLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
  },
  insightStatValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  insightStatCount: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  // Coaching Card
  coachingCard: {
    flexDirection: "row",
    backgroundColor: colors.backgroundElevated,
    padding: spacing.base,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  coachingIcon: {
    fontSize: typography.sizes.lg,
  },
  coachingContent: {
    flex: 1,
  },
  coachingTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  coachingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statValue: {
    color: colors.accent,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  bottomSpacer: {
    height: spacing["3xl"],
  },
});
