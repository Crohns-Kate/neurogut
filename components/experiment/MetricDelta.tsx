/**
 * MetricDelta - Delta badge showing change (+5, -10%, etc.)
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";

interface MetricDeltaProps {
  value: number;
  format?: "number" | "percent" | "bpm";
  /** Whether higher is better (green) or worse (red) */
  higherIsBetter?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function MetricDelta({
  value,
  format = "number",
  higherIsBetter = true,
  size = "md",
}: MetricDeltaProps) {
  // Determine if change is positive/negative
  const isPositive = value > 0;
  const isNeutral = value === 0;

  // Determine color based on value and whether higher is better
  let badgeColor: string;
  if (isNeutral) {
    badgeColor = colors.textMuted;
  } else if (higherIsBetter) {
    badgeColor = isPositive ? colors.success : colors.warning;
  } else {
    badgeColor = isPositive ? colors.warning : colors.success;
  }

  // Format the value
  let displayValue: string;
  const sign = isPositive ? "+" : "";

  switch (format) {
    case "percent":
      displayValue = `${sign}${value.toFixed(0)}%`;
      break;
    case "bpm":
      displayValue = `${sign}${value.toFixed(0)} bpm`;
      break;
    default:
      displayValue = Number.isInteger(value)
        ? `${sign}${value}`
        : `${sign}${value.toFixed(1)}`;
  }

  // Get size styles
  const sizeStyles = {
    sm: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: typography.sizes.xs,
    },
    md: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.sm,
    },
    lg: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.base,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${badgeColor}20`,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: badgeColor,
            fontSize: currentSize.fontSize,
          },
        ]}
      >
        {displayValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: typography.weights.semibold,
    fontVariant: ["tabular-nums"],
  },
});
