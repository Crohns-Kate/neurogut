import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

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
      <TouchableOpacity onPress={() => router.back()}>
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
    backgroundColor: "#05060A",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backText: {
    color: "#9CA3AF",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 28,
    lineHeight: 20,
  },
  // Sync Score Card
  syncScoreCard: {
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 28,
  },
  syncScoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  syncScoreLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  comingSoonBadge: {
    backgroundColor: "#1F2937",
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  syncScorePlaceholder: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 12,
  },
  syncScoreIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  syncScoreDash: {
    fontSize: 48,
    fontWeight: "700",
    color: "#4B5563",
  },
  syncScoreMax: {
    fontSize: 20,
    color: "#6B7280",
    marginLeft: 4,
  },
  syncScoreHint: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
  },
  // Section
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 16,
  },
  // Requirement Cards
  requirementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
  },
  requirementIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  requirementContent: {
    flex: 1,
  },
  requirementTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  requirementCount: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 8,
  },
  requirementCheck: {
    color: "#22C55E",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#1F2937",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  // Status Card
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    padding: 14,
    borderRadius: 10,
    marginBottom: 28,
    gap: 12,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusText: {
    flex: 1,
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
  },
  // Insight Cards
  insightCard: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
  },
  insightCardLocked: {
    opacity: 0.7,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  insightIcon: {
    fontSize: 20,
  },
  insightTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  lockedBadge: {
    backgroundColor: "#1F2937",
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  insightDescription: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 19,
  },
  // Roadmap Card
  roadmapCard: {
    backgroundColor: "#0F172A",
    padding: 18,
    borderRadius: 12,
    marginTop: 16,
  },
  roadmapTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 14,
  },
  roadmapItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  roadmapDot: {
    color: "#3B82F6",
    fontSize: 8,
  },
  roadmapText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  bottomSpacer: {
    height: 40,
  },
});
