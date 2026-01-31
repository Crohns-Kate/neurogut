/**
 * Experiment Flow - Step 2: Intervention
 *
 * User selects and performs their intervention with a guided timer.
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
import {
  getExperiment,
  completeIntervention,
} from "../../src/storage/experimentStore";
import { Experiment } from "../../src/models/experiment";
import InterventionTimer from "../../components/experiment/InterventionTimer";

export default function ExperimentInterventionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ experimentId: string }>();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimer, setShowTimer] = useState(false);

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

  const handleTimerComplete = async () => {
    if (!experiment) return;

    try {
      await completeIntervention(experiment.id);

      // Navigate to post-recording screen
      router.push({
        pathname: "/experiment/post",
        params: { experimentId: experiment.id },
      });
    } catch (error) {
      console.error("Error completing intervention:", error);
      Alert.alert("Error", "Failed to save progress");
    }
  };

  const handleStartTimer = () => {
    setShowTimer(true);
  };

  const handleSkipIntervention = async () => {
    if (!experiment) return;

    Alert.alert(
      "Skip Intervention?",
      "You can skip the timer and proceed directly to the post-recording.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          onPress: async () => {
            await completeIntervention(experiment.id);
            router.push({
              pathname: "/experiment/post",
              params: { experimentId: experiment.id },
            });
          },
        },
      ]
    );
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

  // Show timer view when active
  if (showTimer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.timerContent}
          showsVerticalScrollIndicator={false}
        >
          <InterventionTimer
            durationSeconds={experiment.interventionDurationSeconds}
            onComplete={handleTimerComplete}
            interventionType={experiment.interventionType}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show intervention intro
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
            <Text style={styles.stepIndicator}>Step 2 of 4</Text>
            <Text style={styles.title}>Intervention Time</Text>
          </View>
        </View>

        {/* Baseline Summary */}
        {experiment.beforeAnalytics && (
          <View style={styles.baselineSummary}>
            <Text style={styles.baselineTitle}>Baseline Recorded</Text>
            <View style={styles.baselineMetrics}>
              <View style={styles.baselineMetric}>
                <Text style={styles.baselineValue}>
                  {experiment.beforeAnalytics.motilityIndex}
                </Text>
                <Text style={styles.baselineLabel}>Motility</Text>
              </View>
              <View style={styles.baselineDivider} />
              <View style={styles.baselineMetric}>
                <Text style={styles.baselineValue}>
                  {experiment.beforeAnalytics.eventsPerMinute.toFixed(1)}
                </Text>
                <Text style={styles.baselineLabel}>Events/min</Text>
              </View>
              {experiment.beforeAnalytics.heartBpm !== undefined && (
                <>
                  <View style={styles.baselineDivider} />
                  <View style={styles.baselineMetric}>
                    <Text style={styles.baselineValue}>
                      {Math.round(experiment.beforeAnalytics.heartBpm)}
                    </Text>
                    <Text style={styles.baselineLabel}>BPM</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Intervention Card */}
        <View style={styles.interventionCard}>
          <Text style={styles.interventionIcon}>
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
          <Text style={styles.interventionType}>{experiment.interventionType}</Text>
          <Text style={styles.interventionDuration}>
            {Math.floor(experiment.interventionDurationSeconds / 60)} minute
            {experiment.interventionDurationSeconds > 60 ? "s" : ""}
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>Before You Start</Text>
          <Text style={styles.instructionText}>
            {experiment.interventionType === "Deep Breathing" &&
              "Find a comfortable position. Breathe in for 4 seconds, hold for 4 seconds, exhale for 6 seconds. Focus on your diaphragm."}
            {experiment.interventionType === "Humming" &&
              "Sit comfortably. Hum a low, steady tone (like 'om'). Feel the vibration in your throat and chest."}
            {experiment.interventionType === "Cold Exposure" &&
              "Get a bowl of cold water or ice pack ready. Apply to your face (especially forehead and cheeks) to trigger the dive reflex."}
            {experiment.interventionType === "Abdominal Massage" &&
              "Lie down if possible. Massage gently in clockwise circles around your navel. Use moderate pressure."}
            {experiment.interventionType === "Custom" &&
              "Perform your chosen relaxation practice. Stay present and focused throughout."}
          </Text>
        </View>

        {/* Start Button */}
        <View style={styles.ctaSection}>
          <TouchableOpacity style={styles.startButton} onPress={handleStartTimer}>
            <Text style={styles.startButtonText}>Begin Intervention</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipIntervention}
          >
            <Text style={styles.skipButtonText}>Skip Timer</Text>
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
  timerContent: {
    paddingHorizontal: safeArea.horizontal,
    paddingTop: spacing.xl,
    paddingBottom: spacing["3xl"],
    flexGrow: 1,
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

  // Baseline Summary
  baselineSummary: {
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
  baselineMetrics: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  baselineMetric: {
    alignItems: "center",
    flex: 1,
  },
  baselineValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  baselineLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  baselineDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },

  // Intervention Card
  interventionCard: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  interventionIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  interventionType: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  interventionDuration: {
    fontSize: typography.sizes.lg,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },

  // Instruction Card
  instructionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  instructionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.5,
  },

  // CTA Section
  ctaSection: {
    gap: spacing.md,
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
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
    textDecorationLine: "underline",
  },
});
