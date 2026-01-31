/**
 * Experiment Flow - Step 4: Compare Results
 *
 * Shows before/after comparison with deltas and insights.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, spacing, radius, safeArea } from "../../styles/theme";
import { getExperiment } from "../../src/storage/experimentStore";
import { Experiment } from "../../src/models/experiment";
import ComparisonCard from "../../components/experiment/ComparisonCard";
import MetricDelta from "../../components/experiment/MetricDelta";

export default function ExperimentCompareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ experimentId: string }>();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExperiment();
  }, []);

  const loadExperiment = async () => {
    try {
      if (!params.experimentId) {
        Alert.alert("Error", "No experiment ID provided", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      const exp = await getExperiment(params.experimentId);
      if (!exp) {
        Alert.alert("Error", "Experiment not found", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      setExperiment(exp);
    } catch (error) {
      console.error("Error loading experiment:", error);
      Alert.alert("Error", "Failed to load experiment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDone = () => {
    // Navigate back to home
    router.replace("/");
  };

  const generateInsight = (): { title: string; text: string; color: string } => {
    if (!experiment?.deltas || !experiment.beforeAnalytics || !experiment.afterAnalytics) {
      return {
        title: "Results",
        text: "Unable to generate insight without complete data.",
        color: colors.textMuted,
      };
    }

    const { motilityIndex, vagalToneScore, heartBpm } = experiment.deltas;

    // Determine overall improvement
    let positiveChanges = 0;
    let negativeChanges = 0;

    if (motilityIndex > 5) positiveChanges++;
    else if (motilityIndex < -5) negativeChanges++;

    if (vagalToneScore !== undefined) {
      if (vagalToneScore > 3) positiveChanges++;
      else if (vagalToneScore < -3) negativeChanges++;
    }

    if (heartBpm !== undefined) {
      // Lower heart rate after relaxation is typically good
      if (heartBpm < -3) positiveChanges++;
      else if (heartBpm > 3) negativeChanges++;
    }

    if (positiveChanges > negativeChanges) {
      const interventionName = experiment.interventionType.toLowerCase();
      return {
        title: "Positive Response",
        text: `Your ${interventionName} practice showed measurable improvements in your gut-brain metrics. This suggests your vagus nerve responded well to the intervention. Consider incorporating this practice into your routine.`,
        color: colors.success,
      };
    } else if (negativeChanges > positiveChanges) {
      return {
        title: "Mixed Results",
        text: "Your metrics showed some decline after the intervention. This could be due to timing, environment, or individual response. Try again at a different time or experiment with other interventions.",
        color: colors.warning,
      };
    } else {
      return {
        title: "Neutral Response",
        text: "Your metrics remained relatively stable. This could indicate a mild effect or that a longer intervention duration might be beneficial. Consider extending the practice time in future experiments.",
        color: colors.info,
      };
    }
  };

  if (isLoading || !experiment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { beforeAnalytics, afterAnalytics, deltas } = experiment;

  if (!beforeAnalytics || !afterAnalytics || !deltas) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Missing experiment data</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const insight = generateInsight();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.stepIndicator}>Complete</Text>
            <Text style={styles.title}>Your Results</Text>
          </View>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>
            {experiment.interventionType === "Deep Breathing"
              ? "\uD83E\uDEC1"
              : experiment.interventionType === "Humming"
                ? "\uD83C\uDFB5"
                : experiment.interventionType === "Cold Exposure"
                  ? "\u2744\uFE0F"
                  : experiment.interventionType === "Abdominal Massage"
                    ? "\uD83E\uDD32"
                    : "\u2728"}
          </Text>
          <Text style={styles.summaryTitle}>{experiment.interventionType}</Text>
          <Text style={styles.summarySubtitle}>
            {Math.floor(experiment.interventionDurationSeconds / 60)} minute intervention
          </Text>
        </View>

        {/* Comparison Cards */}
        <View style={styles.comparisonsSection}>
          <Text style={styles.sectionTitle}>Before vs After</Text>

          <ComparisonCard
            label="Motility Index"
            beforeValue={beforeAnalytics.motilityIndex}
            afterValue={afterAnalytics.motilityIndex}
            icon="\uD83D\uDCC8"
            higherIsBetter={true}
          />

          <ComparisonCard
            label="Events per Minute"
            beforeValue={beforeAnalytics.eventsPerMinute}
            afterValue={afterAnalytics.eventsPerMinute}
            icon="\uD83D\uDD14"
            higherIsBetter={true}
          />

          {beforeAnalytics.heartBpm !== undefined &&
            afterAnalytics.heartBpm !== undefined && (
              <ComparisonCard
                label="Heart Rate"
                beforeValue={beforeAnalytics.heartBpm}
                afterValue={afterAnalytics.heartBpm}
                unit="bpm"
                format="bpm"
                icon="\u2764\uFE0F"
                higherIsBetter={false}
              />
            )}

          {beforeAnalytics.vagalToneScore !== undefined &&
            afterAnalytics.vagalToneScore !== undefined && (
              <ComparisonCard
                label="Vagal Tone Score"
                beforeValue={beforeAnalytics.vagalToneScore}
                afterValue={afterAnalytics.vagalToneScore}
                icon="\uD83C\uDFAF"
                higherIsBetter={true}
              />
            )}
        </View>

        {/* Insight Card */}
        <View style={[styles.insightCard, { borderLeftColor: insight.color }]}>
          <Text style={[styles.insightTitle, { color: insight.color }]}>
            {insight.title}
          </Text>
          <Text style={styles.insightText}>{insight.text}</Text>
        </View>

        {/* Delta Summary */}
        <View style={styles.deltaSummaryCard}>
          <Text style={styles.deltaSummaryTitle}>Key Changes</Text>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>Motility</Text>
            <MetricDelta value={deltas.motilityIndex} size="md" />
          </View>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLabel}>Events/min</Text>
            <MetricDelta
              value={deltas.eventsPerMinute}
              size="md"
            />
          </View>
          {deltas.heartBpm !== undefined && (
            <View style={styles.deltaRow}>
              <Text style={styles.deltaLabel}>Heart Rate</Text>
              <MetricDelta
                value={deltas.heartBpm}
                format="bpm"
                size="md"
                higherIsBetter={false}
              />
            </View>
          )}
          {deltas.vagalToneScore !== undefined && (
            <View style={styles.deltaRow}>
              <Text style={styles.deltaLabel}>Vagal Tone</Text>
              <MetricDelta value={deltas.vagalToneScore} size="md" />
            </View>
          )}
        </View>

        {/* Done Button */}
        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.ctaHint}>
            Your experiment has been saved to your history
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: safeArea.horizontal,
    paddingBottom: spacing["3xl"],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
  },
  backLink: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  backLinkText: {
    fontSize: typography.sizes.base,
    color: colors.accent,
    textDecorationLine: "underline",
  },

  // Header
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerContent: {
    alignItems: "center",
  },
  stepIndicator: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  summaryIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  summarySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },

  // Comparisons Section
  comparisonsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Insight Card
  insightCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
  },
  insightTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  insightText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.5,
  },

  // Delta Summary Card
  deltaSummaryCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  deltaSummaryTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deltaLabel: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },

  // CTA Section
  ctaSection: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  doneButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.full,
    width: "100%",
    alignItems: "center",
  },
  doneButtonText: {
    color: colors.background,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  ctaHint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
