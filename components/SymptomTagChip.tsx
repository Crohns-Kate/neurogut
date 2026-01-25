import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../styles/theme";
import { SymptomTag } from "../src/models/session";

export interface SymptomTagChipProps {
  tag: SymptomTag;
  selected: boolean;
  onPress: (tag: SymptomTag) => void;
}

/**
 * SymptomTagChip - Individual tag chip component
 *
 * Displays a symptom tag as a selectable chip following the design system.
 */
export default function SymptomTagChip({
  tag,
  selected,
  onPress,
}: SymptomTagChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
      ]}
      onPress={() => onPress(tag)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          selected ? styles.chipTextSelected : styles.chipTextUnselected,
        ]}
      >
        {tag}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipUnselected: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  chipTextSelected: {
    color: colors.accent,
  },
  chipTextUnselected: {
    color: colors.textSecondary,
  },
});
