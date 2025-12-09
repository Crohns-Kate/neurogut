import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;
const SYMPTOM_STORAGE_KEY = "symptomEntries";

// Minimum data needed for AI analysis
const MIN_RECORDINGS = 5;
const MIN_SYMPTOM_ENTRIES = 7;

type DataStats = {
  recordingCount: number;
  symptomCount: number;
  daysTracked: number;
};

function ProgressBar({ current, target }: { current: number; target: number }) {
  const progress = Math.min(current / target, 1);
  return (
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

function DataRequirementCard({
  icon,
  title,
  current,
  target,
  unit,
}: {
  icon: string;
  title: string;
  current: number;
  target: number;
  unit: string;
}) {
  const isComplete = current >= target;
  return (
    <View style={styles.requirementCard}>
      <Text style={styles.requirementIcon}>{icon}</Text>
      <View style={styles.requirementContent}>
        <Text style={styles.requirementTitle}>{title}</Text>
        <Text style={styles.requirementCount}>
          {current} / {target} {unit}
        </Text>
        <ProgressBar current={current} target={target} />
      </View>
      <Text style={styles.requirementCheck}>{isComplete ? "✓" : ""}</Text>
    </View>
  );
}

function InsightPreviewCard({
  icon,
  title,
  description,
  locked,
}: {
  icon: string;
  title: string;
  description: string;
  locked: boolean;
}) {
  return (
    <View style={[styles.insightCard, locked && styles.insightCardLocked]}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightIcon}>{icon}</Text>
        <Text style={styles.insightTitle}>{title}</Text>
        {locked && <Text style={styles.lockedBadge}>Soon</Text>}
      </View>
      <Text style={styles.insightDescription}>{description}</Text>
    </View>
  );
}

export default function AIGutInsightsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DataStats>({
    recordingCount: 0,
    symptomCount: 0,
    daysTracked: 0,
  });

  const loadStats = useCallback(async () => {
    let recordingCount = 0;
    let symptomCount = 0;
    let daysTracked = 0;

    // Count recordings
    try {
      const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (info.exists) {
        const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
        recordingCount = files.filter((f) => f.endsWith(".m4a")).length;
      }
    } catch {
      recordingCount = 0;
    }

    // Count symptom entries and unique days
    try {
      const data = await AsyncStorage.getItem(SYMPTOM_STORAGE_KEY);
      if (data) {
        const entries = JSON.parse(data) as Array<{
          dateISO?: string;
          createdAt?: string;
        }>;
        symptomCount = entries.length;

        // Count unique days
        const uniqueDays = new Set<string>();
        entries.forEach((entry) => {
          const dateStr = entry.dateISO || entry.createdAt;
          if (dateStr) {
            const day = new Date(dateStr).toDateString();
            uniqueDays.add(day);
          }
        });
        daysTracked = uniqueDays.size;
      }
    } catch {
      symptomCount = 0;
    }

    setStats({ recordingCount, symptomCount, daysTracked });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const hasEnoughData =
    stats.recordingCount >= MIN_RECORDINGS &&
    stats.symptomCount >= MIN_SYMPTOM_ENTRIES;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>AI Gut Insights</Text>
      <Text style={styles.subtitle}>
        Discover patterns between your gut sounds, symptoms, and well-being.
      </Text>

      {/* Gut-Brain Sync Score Card */}
      <View style={styles.syncScoreCard}>
        <View style={styles.syncScoreHeader}>
          <Text style={styles.syncScoreLabel}>Gut-Brain Sync Score</Text>
          <Text style={styles.comingSoonBadge}>Coming Soon</Text>
        </View>
        <View style={styles.syncScorePlaceholder}>
          <Text style={styles.syncScoreIcon}>🧠</Text>
          <Text style={styles.syncScoreDash}>--</Text>
          <Text style={styles.syncScoreMax}>/ 100</Text>
        </View>
        <Text style={styles.syncScoreHint}>
          Track for {Math.max(0, 7 - stats.daysTracked)} more days to unlock
        </Text>
      </View>

      {/* Data Collection Status */}
      <Text style={styles.sectionTitle}>Data Collection</Text>
      <Text style={styles.sectionSubtitle}>
        AI insights require sufficient data to detect patterns
      </Text>

      <DataRequirementCard
        icon="🎙"
        title="Gut Sound Recordings"
        current={stats.recordingCount}
        target={MIN_RECORDINGS}
        unit="recordings"
      />

      <DataRequirementCard
        icon="📊"
        title="Symptom Entries"
        current={stats.symptomCount}
        target={MIN_SYMPTOM_ENTRIES}
        unit="entries"
      />

      {/* Status Message */}
      <View style={styles.statusCard}>
        {hasEnoughData ? (
          <>
            <Text style={styles.statusIcon}>✓</Text>
            <Text style={styles.statusText}>
              You have enough data! AI analysis will be available soon.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.statusIcon}>📈</Text>
            <Text style={styles.statusText}>
              Keep tracking daily to unlock personalized insights
            </Text>
          </>
        )}
      </View>

      {/* Insight Previews */}
      <Text style={styles.sectionTitle}>Upcoming Insights</Text>

      <InsightPreviewCard
        icon="🔄"
        title="Pattern Detection"
        description="Identify correlations between your gut sounds and symptom patterns over time."
        locked
      />

      <InsightPreviewCard
        icon="📅"
        title="Weekly Summary"
        description="Get a digestible weekly report of your gut health trends and improvements."
        locked
      />

      <InsightPreviewCard
        icon="⚡"
        title="Trigger Identification"
        description="Discover what factors may be contributing to your symptoms."
        locked
      />

      <InsightPreviewCard
        icon="💡"
        title="Personalized Tips"
        description="Receive AI-generated recommendations based on your unique patterns."
        locked
      />

      {/* Feature Roadmap */}
      <View style={styles.roadmapCard}>
        <Text style={styles.roadmapTitle}>What's Next</Text>
        <View style={styles.roadmapItem}>
          <Text style={styles.roadmapDot}>●</Text>
          <Text style={styles.roadmapText}>Gut sound frequency analysis</Text>
        </View>
        <View style={styles.roadmapItem}>
          <Text style={styles.roadmapDot}>●</Text>
          <Text style={styles.roadmapText}>Symptom trend visualization</Text>
        </View>
        <View style={styles.roadmapItem}>
          <Text style={styles.roadmapDot}>●</Text>
          <Text style={styles.roadmapText}>AI-powered health insights</Text>
        </View>
        <View style={styles.roadmapItem}>
          <Text style={styles.roadmapDot}>●</Text>
          <Text style={styles.roadmapText}>Export reports for your doctor</Text>
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
  // Sync Score Card
  syncScoreCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  syncScoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  syncScoreLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  comingSoonBadge: {
    backgroundColor: colors.backgroundElevated,
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  syncScorePlaceholder: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  syncScoreIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  syncScoreDash: {
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
  },
  syncScoreMax: {
    fontSize: typography.sizes.lg,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  syncScoreHint: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },
  // Section
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.base,
  },
  // Requirement Cards
  requirementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  requirementIcon: {
    fontSize: typography.sizes.xl,
    marginRight: spacing.base,
  },
  requirementContent: {
    flex: 1,
  },
  requirementTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  requirementCount: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  requirementCheck: {
    color: colors.success,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.md,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  // Status Card
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundElevated,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  statusIcon: {
    fontSize: typography.sizes.lg,
  },
  statusText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  // Insight Cards
  insightCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  insightCardLocked: {
    opacity: 0.7,
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
  // Roadmap Card
  roadmapCard: {
    backgroundColor: colors.backgroundElevated,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.base,
  },
  roadmapTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.base,
  },
  roadmapItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  roadmapDot: {
    color: colors.accent,
    fontSize: 8,
  },
  roadmapText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  bottomSpacer: {
    height: spacing["3xl"],
  },
});
