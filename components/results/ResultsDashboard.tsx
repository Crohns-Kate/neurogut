/**
 * ResultsDashboard - Full biomarker dashboard with all four metrics
 * Displays gut, heart, vagal tone, and breathing in one cohesive view
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";
import { SessionAnalytics } from "../../src/models/session";
import {
  calculateOverallScore,
  interpretGut,
  interpretHeartRate,
  interpretVagalTone,
  interpretBreathing,
  generateInsight,
} from "../../src/utils/interpretations";
import OverallScore from "./OverallScore";
import MetricCard from "./MetricCard";
import BreathingMetricCard from "./BreathingMetricCard";
import InsightCard from "./InsightCard";

interface ResultsDashboardProps {
  analytics: SessionAnalytics;
  date?: string;
}

export default function ResultsDashboard({
  analytics,
  date,
}: ResultsDashboardProps) {
  // Calculate overall score
  const overallScore = calculateOverallScore(
    analytics.eventsPerMinute,
    analytics.heartBpm,
    analytics.vagalToneScore,
    analytics.breathingCoherence,
    analytics.inhaleExhaleRatio
  );

  // Get interpretations
  const gutInterpretation = interpretGut(
    analytics.eventsPerMinute,
    analytics.motilityIndex
  );

  const heartInterpretation = analytics.heartBpm
    ? interpretHeartRate(analytics.heartBpm)
    : null;

  const vagalInterpretation =
    analytics.vagalToneScore !== undefined
      ? interpretVagalTone(analytics.vagalToneScore)
      : null;

  const breathingInterpretation =
    analytics.breathsPerMinute !== undefined &&
    analytics.avgInhaleDurationMs !== undefined &&
    analytics.avgExhaleDurationMs !== undefined
      ? interpretBreathing(
          analytics.breathsPerMinute,
          analytics.avgInhaleDurationMs,
          analytics.avgExhaleDurationMs,
          analytics.inhaleExhaleRatio ?? 1,
          analytics.breathingCoherence ?? 50,
          analytics.breathingPattern ?? "regular"
        )
      : null;

  // Generate insight
  const insight = generateInsight(
    analytics.eventsPerMinute,
    analytics.heartBpm,
    analytics.vagalToneScore,
    analytics.breathsPerMinute,
    analytics.inhaleExhaleRatio,
    analytics.breathingCoherence
  );

  // Format date
  const displayDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Gut-Brain Snapshot</Text>
        <Text style={styles.date}>{displayDate}</Text>
      </View>

      {/* Overall Score */}
      <View style={styles.scoreSection}>
        <OverallScore
          score={overallScore.score}
          state={overallScore.state}
          emoji={overallScore.emoji}
        />
      </View>

      {/* Metrics */}
      <View style={styles.metricsSection}>
        {/* Gut Activity */}
        <MetricCard
          icon={"\uD83E\uDDE0"}
          label={gutInterpretation.label}
          value={gutInterpretation.value}
          interpretation={gutInterpretation.interpretation}
          progress={gutInterpretation.progress}
          color={gutInterpretation.color}
        />

        {/* Heart Rate */}
        {heartInterpretation && (
          <MetricCard
            icon={"\u2764\uFE0F"}
            label={heartInterpretation.label}
            value={heartInterpretation.value}
            interpretation={heartInterpretation.interpretation}
            progress={heartInterpretation.progress}
            color={heartInterpretation.color}
          />
        )}

        {/* Vagal Tone */}
        {vagalInterpretation && (
          <MetricCard
            icon={"\uD83C\uDFAF"}
            label={vagalInterpretation.label}
            value={vagalInterpretation.value}
            interpretation={vagalInterpretation.interpretation}
            progress={vagalInterpretation.progress}
            color={vagalInterpretation.color}
          />
        )}

        {/* Breathing - Special Card or Placeholder */}
        {breathingInterpretation &&
        analytics.breathsPerMinute !== undefined &&
        analytics.avgInhaleDurationMs !== undefined &&
        analytics.avgExhaleDurationMs !== undefined ? (
          <BreathingMetricCard
            breathsPerMin={analytics.breathsPerMinute}
            avgInhaleMs={analytics.avgInhaleDurationMs}
            avgExhaleMs={analytics.avgExhaleDurationMs}
            inhaleExhaleRatio={analytics.inhaleExhaleRatio ?? 1}
            coherence={analytics.breathingCoherence ?? 50}
            pattern={analytics.breathingPattern ?? "regular"}
            interpretation={breathingInterpretation.interpretation}
          />
        ) : (
          <MetricCard
            icon={"\uD83E\uDEC1"}
            label="Breathing"
            value="--"
            interpretation="Insufficient data - try a longer recording with phone on abdomen"
            color="blue"
          />
        )}
      </View>

      {/* Insight */}
      <InsightCard insight={insight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  metricsSection: {
    marginBottom: spacing.md,
  },
});
