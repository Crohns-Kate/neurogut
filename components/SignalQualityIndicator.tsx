/**
 * Signal Quality Indicator Component (NG-HARDEN-05)
 *
 * Displays a traffic-light style indicator showing the quality of the
 * recording environment based on Signal-to-Noise Ratio (SNR).
 *
 * - Green (Excellent): SNR >= 20 dB - Ideal for recording
 * - Lime (Good): SNR >= 12 dB - Suitable for recording
 * - Yellow (Fair): SNR >= 6 dB - Consider quieter environment
 * - Red (Poor): SNR < 6 dB - Too much background noise
 */

import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, typography, spacing, radius } from "../styles/theme";
import {
  SignalQualityLevel,
  getSignalQualityLabel,
  getSignalQualityColor,
} from "../src/models/session";

interface SignalQualityIndicatorProps {
  /** Signal quality level */
  quality: SignalQualityLevel;
  /** Signal-to-Noise Ratio in dB */
  snrDb: number;
  /** Whether the recording environment is suitable */
  isReliable: boolean;
  /** Optional: Show compact version (icon only) */
  compact?: boolean;
  /** Optional: Pulsing animation for attention */
  pulse?: boolean;
}

/**
 * Traffic-light style Signal Quality indicator
 */
export default function SignalQualityIndicator({
  quality,
  snrDb,
  isReliable,
  compact = false,
  pulse = false,
}: SignalQualityIndicatorProps) {
  const indicatorColor = getSignalQualityColor(quality);
  const label = getSignalQualityLabel(quality);

  // Pulse animation for "poor" quality
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (pulse && quality === "poor") {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse, quality, pulseAnim]);

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactContainer,
          { backgroundColor: indicatorColor, transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={styles.compactDot} />
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.indicatorDot,
            { backgroundColor: indicatorColor, transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={styles.label}>Signal Quality</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.qualityText, { color: indicatorColor }]}>
          {label}
        </Text>
        <Text style={styles.snrText}>{snrDb.toFixed(1)} dB SNR</Text>
      </View>

      {!isReliable && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            Environment too noisy for reliable detection
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Minimal inline signal quality indicator (for use in headers/toolbars)
 */
export function SignalQualityBadge({
  quality,
}: {
  quality: SignalQualityLevel;
}) {
  const indicatorColor = getSignalQualityColor(quality);
  const label = getSignalQualityLabel(quality);

  return (
    <View style={[styles.badge, { backgroundColor: indicatorColor + "20" }]}>
      <View style={[styles.badgeDot, { backgroundColor: indicatorColor }]} />
      <Text style={[styles.badgeText, { color: indicatorColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  indicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  content: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  qualityText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  snrText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  warningContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  warningText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    textAlign: "center",
  },
  // Compact styles
  compactContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
  },
  // Badge styles
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
