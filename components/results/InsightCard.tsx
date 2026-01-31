/**
 * InsightCard - Dynamic insight display based on biomarker analysis
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";

interface InsightCardProps {
  insight: string;
}

export default function InsightCard({ insight }: InsightCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{"\uD83D\uDCA1"}</Text>
        <Text style={styles.label}>Insight</Text>
      </View>
      <Text style={styles.insight}>{insight}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
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
    fontWeight: typography.weights.semibold,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  insight: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    lineHeight: typography.sizes.base * 1.5,
  },
});
