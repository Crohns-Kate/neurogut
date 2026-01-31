/**
 * InterventionCard - Selectable intervention option for experiment flow
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../styles/theme";
import { InterventionOption } from "../../src/models/experiment";

interface InterventionCardProps {
  option: InterventionOption;
  selected: boolean;
  onSelect: () => void;
}

// Icon mapping (using emoji for simplicity)
const ICON_MAP: Record<string, string> = {
  lung: "\uD83E\uDEC1", // lungs emoji
  music: "\uD83C\uDFB5", // music note
  snowflake: "\u2744\uFE0F", // snowflake
  hand: "\uD83E\uDD32", // palms up together
  sparkles: "\u2728", // sparkles
};

export default function InterventionCard({
  option,
  selected,
  onSelect,
}: InterventionCardProps) {
  const icon = ICON_MAP[option.icon] || "\u2728";

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {option.label}
        </Text>
        <Text style={styles.description}>{option.description}</Text>
      </View>
      {selected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>\u2713</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  labelSelected: {
    color: colors.accent,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  checkmarkText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
});
