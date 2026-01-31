/**
 * OverallScore - Circular score display with emoji and state label
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, typography, spacing, radius } from "../../styles/theme";

interface OverallScoreProps {
  score: number;
  state: string;
  emoji: string;
}

export default function OverallScore({ score, state, emoji }: OverallScoreProps) {
  // SVG circle parameters
  const size = 140;
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = score / 100;
  const strokeDashoffset = circumference * (1 - progress);

  // Color based on score
  const getScoreColor = () => {
    if (score >= 75) return colors.success;
    if (score >= 55) return colors.accent;
    if (score >= 35) return colors.warning;
    return colors.error;
  };

  const scoreColor = getScoreColor();

  return (
    <View style={styles.container}>
      <View style={styles.circleContainer}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.backgroundCard}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.scoreContent}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={[styles.score, { color: scoreColor }]}>{score}</Text>
        </View>
      </View>
      <Text style={styles.state}>{state}</Text>
      <Text style={styles.label}>Overall Balance</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  circleContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreContent: {
    position: "absolute",
    alignItems: "center",
  },
  emoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  score: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    fontVariant: ["tabular-nums"],
  },
  state: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
