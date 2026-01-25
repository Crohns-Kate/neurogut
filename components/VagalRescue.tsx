/**
 * VagalRescue - Vagal Rescue Protocol Modal
 *
 * Triggered when Motility Index = 0 or VRS < 20.
 * Provides actionable interventions to restore vagal tone.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { colors, typography, spacing, radius } from "../styles/theme";

interface VagalRescueProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current Vagal Readiness Score (0-100) */
  vrsScore: number;
  /** Current Motility Index */
  motilityIndex: number;
  /** Callback when user selects warm water option */
  onSelectWarmWater: () => void;
  /** Callback when user selects humming session */
  onSelectHumming: () => void;
  /** Callback when user dismisses without action */
  onDismiss: () => void;
  /** Callback when user wants to re-test */
  onRetest: () => void;
}

// Rescue protocol thresholds
export const VRS_RESCUE_THRESHOLD = 20;
export const MOTILITY_RESCUE_THRESHOLD = 0;

/**
 * Check if rescue protocol should be triggered
 */
export function shouldTriggerRescue(vrsScore: number | null, motilityIndex: number | null): boolean {
  if (motilityIndex !== null && motilityIndex === MOTILITY_RESCUE_THRESHOLD) {
    return true;
  }
  if (vrsScore !== null && vrsScore < VRS_RESCUE_THRESHOLD) {
    return true;
  }
  return false;
}

/**
 * Rescue option card component
 */
function RescueOption({
  icon,
  title,
  description,
  duration,
  onPress,
  recommended,
}: {
  icon: string;
  title: string;
  description: string;
  duration: string;
  onPress: () => void;
  recommended?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, recommended && styles.optionCardRecommended]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
      )}
      <View style={styles.optionHeader}>
        <Text style={styles.optionIcon}>{icon}</Text>
        <View style={styles.optionTitleContainer}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionDuration}>{duration}</Text>
        </View>
      </View>
      <Text style={styles.optionDescription}>{description}</Text>
    </TouchableOpacity>
  );
}

/**
 * Main VagalRescue modal component
 */
export default function VagalRescue({
  visible,
  vrsScore,
  motilityIndex,
  onSelectWarmWater,
  onSelectHumming,
  onDismiss,
  onRetest,
}: VagalRescueProps) {
  const [selectedOption, setSelectedOption] = useState<"warmwater" | "humming" | null>(null);

  const handleWarmWater = () => {
    setSelectedOption("warmwater");
    onSelectWarmWater();
  };

  const handleHumming = () => {
    setSelectedOption("humming");
    onSelectHumming();
  };

  const getRescueReason = () => {
    if (motilityIndex === 0) {
      return "No gut activity detected. This may indicate your vagus nerve needs stimulation.";
    }
    if (vrsScore < VRS_RESCUE_THRESHOLD) {
      return `Your Vagal Readiness Score (${vrsScore}) is below optimal. Let's help activate your parasympathetic nervous system.`;
    }
    return "Your vagal tone appears low. Try one of these interventions.";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerIcon}>⚡</Text>
              <Text style={styles.headerTitle}>Vagal Rescue Mode</Text>
            </View>

            {/* Reason */}
            <View style={styles.reasonContainer}>
              <Text style={styles.reasonText}>{getRescueReason()}</Text>
            </View>

            {/* Score display */}
            <View style={styles.scoreContainer}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>VRS Score</Text>
                <Text style={[styles.scoreValue, vrsScore < VRS_RESCUE_THRESHOLD && styles.scoreValueLow]}>
                  {vrsScore}
                </Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Motility</Text>
                <Text style={[styles.scoreValue, motilityIndex === 0 && styles.scoreValueLow]}>
                  {motilityIndex}
                </Text>
              </View>
            </View>

            {/* Options */}
            <Text style={styles.sectionTitle}>Choose an Intervention</Text>

            <RescueOption
              icon="🥤"
              title="Warm Water + Walk"
              description="Drink a glass of warm water and walk gently for 2 minutes. This stimulates the vagus through the esophagus and gentle movement."
              duration="2-3 min"
              onPress={handleWarmWater}
            />

            <RescueOption
              icon="🎵"
              title="Humming Session"
              description="Start an immediate 5-minute humming/vibrational session. The vibrations directly stimulate the laryngeal branch of the vagus nerve."
              duration="5 min"
              onPress={handleHumming}
              recommended
            />

            {/* Re-test button */}
            <TouchableOpacity style={styles.retestButton} onPress={onRetest}>
              <Text style={styles.retestButtonText}>Re-test Now</Text>
            </TouchableOpacity>

            {/* Dismiss */}
            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
              <Text style={styles.dismissButtonText}>Skip for Now</Text>
            </TouchableOpacity>

            {/* Educational note */}
            <View style={styles.educationNote}>
              <Text style={styles.educationTitle}>Why this matters</Text>
              <Text style={styles.educationText}>
                Low vagal readiness can affect digestion, stress response, and overall gut-brain
                communication. These interventions help "wake up" your parasympathetic nervous
                system for better recordings and gut health.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing["3xl"],
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  headerIcon: {
    fontSize: 32,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.warning,
  },
  reasonContainer: {
    backgroundColor: `${colors.warning}15`,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  reasonText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    lineHeight: typography.sizes.base * 1.5,
  },
  scoreContainer: {
    flexDirection: "row",
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
  },
  scoreDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  scoreLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  scoreValue: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scoreValueLow: {
    color: colors.warning,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionCardRecommended: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  recommendedText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  optionTitleContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  optionDuration: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  optionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.5,
  },
  retestButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: "center",
    marginTop: spacing.md,
  },
  retestButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
  dismissButton: {
    paddingVertical: spacing.base,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  dismissButtonText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
  },
  educationNote: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.base,
    marginTop: spacing.lg,
  },
  educationTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  educationText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: typography.sizes.sm * 1.5,
  },
});
