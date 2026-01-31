/**
 * MetricCard - Individual biomarker display with progress bar
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";
import { MetricColor } from "../../src/utils/interpretations";

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
  interpretation: string;
  progress?: number;
  color: MetricColor;
}

const COLOR_MAP: Record<MetricColor, string> = {
  green: colors.success,
  yellow: colors.warning,
  red: colors.error,
  blue: colors.info,
};

export default function MetricCard({
  icon,
  label,
  value,
  subValue,
  interpretation,
  progress,
  color,
}: MetricCardProps) {
  const accentColor = COLOR_MAP[color];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        {subValue && <Text style={styles.subValue}>{subValue}</Text>}
      </View>

      {progress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, progress)}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
        </View>
      )}

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
  valueRow: {
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  subValue: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  progressContainer: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  interpretation: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: typography.sizes.sm * 1.4,
  },
});
