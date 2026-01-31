/**
 * BreathingMetricCard - Specialized card for breathing metrics
 * Shows rate, inhale/exhale timing, ratio, coherence, and pattern
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";

interface BreathingMetricCardProps {
  breathsPerMin: number;
  avgInhaleMs: number;
  avgExhaleMs: number;
  inhaleExhaleRatio: number;
  coherence: number;
  pattern: string;
  interpretation: string;
}

export default function BreathingMetricCard({
  breathsPerMin,
  avgInhaleMs,
  avgExhaleMs,
  inhaleExhaleRatio,
  coherence,
  pattern,
  interpretation,
}: BreathingMetricCardProps) {
  const inhaleSec = (avgInhaleMs / 1000).toFixed(1);
  const exhaleSec = (avgExhaleMs / 1000).toFixed(1);

  // Format ratio display
  const ratioDisplay =
    inhaleExhaleRatio <= 1
      ? `1:${(1 / inhaleExhaleRatio).toFixed(1)}`
      : `${inhaleExhaleRatio.toFixed(1)}:1`;

  // Color based on pattern quality
  const getPatternColor = () => {
    if (inhaleExhaleRatio <= 1.0 && coherence >= 60) return colors.success;
    if (coherence >= 50) return colors.accent;
    if (inhaleExhaleRatio > 1.2) return colors.warning;
    return colors.accent;
  };

  const accentColor = getPatternColor();

  // Coherence bar segments
  const renderCoherenceBar = () => {
    const segments = 10;
    const filledSegments = Math.round((coherence / 100) * segments);

    return (
      <View style={styles.coherenceBar}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.coherenceSegment,
              i < filledSegments && {
                backgroundColor:
                  i >= 7 ? colors.success : i >= 4 ? colors.accent : colors.info,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>{"\uD83E\uDEC1"}</Text>
        <Text style={styles.label}>Breathing</Text>
      </View>

      {/* Main value */}
      <Text style={[styles.mainValue, { color: accentColor }]}>
        {breathsPerMin.toFixed(1)} breaths/min
      </Text>

      {/* Inhale/Exhale timing */}
      <View style={styles.timingRow}>
        <View style={styles.timingItem}>
          <Text style={styles.timingLabel}>Inhale</Text>
          <Text style={styles.timingValue}>{inhaleSec}s</Text>
        </View>
        <Text style={styles.arrow}>{"\u2192"}</Text>
        <View style={styles.timingItem}>
          <Text style={styles.timingLabel}>Exhale</Text>
          <Text style={styles.timingValue}>{exhaleSec}s</Text>
        </View>
        <View style={styles.ratioContainer}>
          <Text style={[styles.ratioValue, { color: accentColor }]}>
            {ratioDisplay}
          </Text>
        </View>
      </View>

      {/* Coherence */}
      <View style={styles.coherenceSection}>
        <View style={styles.coherenceHeader}>
          <Text style={styles.coherenceLabel}>Coherence</Text>
          <Text style={styles.coherenceValue}>{coherence}%</Text>
        </View>
        {renderCoherenceBar()}
      </View>

      {/* Pattern badge */}
      <View style={styles.patternRow}>
        <Text style={styles.patternLabel}>Pattern:</Text>
        <View
          style={[
            styles.patternBadge,
            {
              backgroundColor:
                pattern === "regular"
                  ? `${colors.success}20`
                  : pattern === "deep"
                    ? `${colors.accent}20`
                    : `${colors.warning}20`,
            },
          ]}
        >
          <Text
            style={[
              styles.patternText,
              {
                color:
                  pattern === "regular"
                    ? colors.success
                    : pattern === "deep"
                      ? colors.accent
                      : colors.warning,
              },
            ]}
          >
            {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
          </Text>
        </View>
      </View>

      {/* Interpretation */}
      <Text style={styles.interpretation}>{interpretation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mainValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  timingItem: {
    alignItems: "center",
    flex: 1,
  },
  timingLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  timingValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  arrow: {
    fontSize: typography.sizes.lg,
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
  ratioContainer: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  ratioValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  coherenceSection: {
    marginBottom: spacing.md,
  },
  coherenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  coherenceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  coherenceValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  coherenceBar: {
    flexDirection: "row",
    gap: 3,
  },
  coherenceSegment: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 2,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  patternLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  patternBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  patternText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  interpretation: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: typography.sizes.sm * 1.4,
  },
});
