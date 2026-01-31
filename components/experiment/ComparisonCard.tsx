/**
 * ComparisonCard - Before/After metric comparison display
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";
import MetricDelta from "./MetricDelta";

interface ComparisonCardProps {
  label: string;
  beforeValue: number;
  afterValue: number;
  unit?: string;
  format?: "number" | "percent" | "bpm";
  /** Whether higher is better (green) or worse (red) */
  higherIsBetter?: boolean;
  /** Optional icon emoji */
  icon?: string;
}

export default function ComparisonCard({
  label,
  beforeValue,
  afterValue,
  unit = "",
  format = "number",
  higherIsBetter = true,
  icon,
}: ComparisonCardProps) {
  const delta = afterValue - beforeValue;

  // Format values for display
  const formatValue = (value: number): string => {
    if (format === "bpm") {
      return `${Math.round(value)}`;
    }
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <Text style={styles.label}>{label}</Text>
      </View>

      {/* Values row */}
      <View style={styles.valuesRow}>
        {/* Before */}
        <View style={styles.valueColumn}>
          <Text style={styles.valueLabel}>Before</Text>
          <Text style={styles.value}>
            {formatValue(beforeValue)}
            {unit && <Text style={styles.unit}> {unit}</Text>}
          </Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>\u2192</Text>
        </View>

        {/* After */}
        <View style={styles.valueColumn}>
          <Text style={styles.valueLabel}>After</Text>
          <Text style={styles.value}>
            {formatValue(afterValue)}
            {unit && <Text style={styles.unit}> {unit}</Text>}
          </Text>
        </View>

        {/* Delta */}
        <View style={styles.deltaContainer}>
          <MetricDelta
            value={delta}
            format={format}
            higherIsBetter={higherIsBetter}
            size="lg"
          />
        </View>
      </View>
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
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  valuesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  valueColumn: {
    flex: 1,
  },
  valueLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.normal,
    color: colors.textSecondary,
  },
  arrowContainer: {
    paddingHorizontal: spacing.md,
  },
  arrow: {
    fontSize: typography.sizes.xl,
    color: colors.textMuted,
  },
  deltaContainer: {
    marginLeft: spacing.md,
  },
});
