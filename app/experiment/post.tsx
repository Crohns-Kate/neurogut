/**
 * Experiment Flow - Step 3: Post-Intervention Recording
 *
 * Shows baseline summary and prompts user to record post-intervention.
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

export default function ExperimentPostScreen() {
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

  const handleStartPostRecording = () => {
    if (!experiment) return;

    router.push({
      pathname: "/record",
      params: {
        experimentId: experiment.id,
        phase: "after",
      },
    });
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>\u2190</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.stepIndicator}>Step 3 of 4</Text>
            <Text style={styles.title}>Post-Intervention</Text>
          </View>
        </View>

        {/* Success Message */}
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>\u2705</Text>
          <Text style={styles.successTitle}>Intervention Complete!</Text>
          <Text style={styles.successText}>
            You completed {experiment.interventionType} for{" "}
            {Math.floor(experiment.interventionDurationSeconds / 60)} minutes.
          </Text>
        </View>

        {/* Baseline Reminder */}
        {experiment.beforeAnalytics && (
          <View style={styles.baselineCard}>
            <Text style={styles.baselineTitle}>Your Baseline Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>
                  {experiment.beforeAnalytics.motilityIndex}
                </Text>
                <Text style={styles.metricLabel}>Motility Index</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>
                  {experiment.beforeAnalytics.eventsPerMinute.toFixed(1)}
                </Text>
                <Text style={styles.metricLabel}>Events/min</Text>
              </View>
              {experiment.beforeAnalytics.heartBpm !== undefined && (
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {Math.round(experiment.beforeAnalytics.heartBpm)}
                  </Text>
                  <Text style={styles.metricLabel}>Heart Rate</Text>
                </View>
              )}
              {experiment.beforeAnalytics.vagalToneScore !== undefined && (
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {experiment.beforeAnalytics.vagalToneScore}
                  </Text>
                  <Text style={styles.metricLabel}>Vagal Tone</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* What's Next */}
        <View style={styles.nextCard}>
          <Text style={styles.nextIcon}>\uD83C\uDFAF</Text>
          <Text style={styles.nextTitle}>Now Let's Compare</Text>
          <Text style={styles.nextText}>
            Record your gut sounds again using the same position as before.
            We'll compare the results to show the effect of your{" "}
            {experiment.interventionType.toLowerCase()}.
          </Text>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>For Best Results</Text>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>\u2022</Text>
            <Text style={styles.tipText}>
              Use the same position as your baseline recording
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>\u2022</Text>
            <Text style={styles.tipText}>
              Record in the same quiet environment
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>\u2022</Text>
            <Text style={styles.tipText}>
              Start recording within a few minutes
            </Text>
          </View>
        </View>

        {/* Start Button */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartPostRecording}
          >
            <Text style={styles.startButtonText}>Start Post Recording</Text>
          </TouchableOpacity>
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.xl,
    color: colors.textPrimary,
  },
  headerContent: {
    flex: 1,
  },
  stepIndicator: {
    fontSize: typography.sizes.sm,
    color: colors.accent,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },

  // Success Card
  successCard: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Baseline Card
  baselineCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  baselineTitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  metricValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },

  // What's Next Card
  nextCard: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  nextIcon: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  nextTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  nextText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.base * 1.5,
  },

  // Tips Card
  tipsCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  tipsTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  tipBullet: {
    fontSize: typography.sizes.base,
    color: colors.accent,
    marginRight: spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.4,
  },

  // CTA Section
  ctaSection: {
    marginTop: spacing.lg,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    alignItems: "center",
  },
  startButtonText: {
    color: colors.background,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
});
