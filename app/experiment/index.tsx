/**
 * Experiment Flow - Step 1: Baseline
 *
 * Introduces the Before/After comparison flow and starts baseline recording.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, spacing, radius, safeArea } from "../../styles/theme";
import { getActivePatient } from "../../src/storage/patientStore";
import {
  getActiveExperiment,
  createAndSaveExperiment,
} from "../../src/storage/experimentStore";
import {
  INTERVENTION_OPTIONS,
  DURATION_OPTIONS,
  ComparisonIntervention,
} from "../../src/models/experiment";
import InterventionCard from "../../components/experiment/InterventionCard";

export default function ExperimentBaselineScreen() {
  const router = useRouter();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] =
    useState<ComparisonIntervention>("Deep Breathing");
  const [selectedDuration, setSelectedDuration] = useState(180); // 3 min default
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveExperiment, setHasActiveExperiment] = useState(false);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const patient = await getActivePatient();
      if (!patient) {
        Alert.alert(
          "No Patient Selected",
          "Please select a patient profile before starting an experiment.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }
      setPatientId(patient.id);

      // Check for active (incomplete) experiment to resume
      const activeExperiment = await getActiveExperiment(patient.id);
      if (activeExperiment) {
        setHasActiveExperiment(true);
        setActiveExperimentId(activeExperiment.id);
        setSelectedIntervention(activeExperiment.interventionType);
        setSelectedDuration(activeExperiment.interventionDurationSeconds);
      }
    } catch (error) {
      console.error("Error loading experiment state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBaseline = async () => {
    if (!patientId) {
      Alert.alert("Error", "No patient selected");
      return;
    }

    try {
      // Create new experiment
      const experiment = await createAndSaveExperiment(
        selectedIntervention,
        selectedDuration,
        patientId
      );

      // Navigate to recording with experiment context
      router.push({
        pathname: "/record",
        params: {
          experimentId: experiment.id,
          phase: "before",
        },
      });
    } catch (error) {
      console.error("Error creating experiment:", error);
      Alert.alert("Error", "Failed to create experiment");
    }
  };

  const handleResumeExperiment = () => {
    if (!activeExperimentId) return;

    // Navigate to the appropriate step based on experiment status
    router.push({
      pathname: "/experiment/intervention",
      params: { experimentId: activeExperimentId },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>\u2190</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Before/After Comparison</Text>
        </View>

        {/* Introduction */}
        <View style={styles.introCard}>
          <Text style={styles.introIcon}>\uD83D\uDD2C</Text>
          <Text style={styles.introTitle}>How It Works</Text>
          <Text style={styles.introText}>
            1. Record your baseline gut sounds{"\n"}
            2. Perform a vagal intervention{"\n"}
            3. Record again to see the difference{"\n"}
            4. Compare your before & after metrics
          </Text>
        </View>

        {/* Resume card if active experiment exists */}
        {hasActiveExperiment && (
          <TouchableOpacity
            style={styles.resumeCard}
            onPress={handleResumeExperiment}
          >
            <View style={styles.resumeContent}>
              <Text style={styles.resumeIcon}>\u25B6\uFE0F</Text>
              <View style={styles.resumeTextContainer}>
                <Text style={styles.resumeTitle}>Resume Experiment</Text>
                <Text style={styles.resumeSubtitle}>
                  You have an incomplete experiment
                </Text>
              </View>
            </View>
            <Text style={styles.resumeArrow}>\u203A</Text>
          </TouchableOpacity>
        )}

        {/* Intervention Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Intervention</Text>
          <Text style={styles.sectionSubtitle}>
            Select what you'll do between recordings
          </Text>
          {INTERVENTION_OPTIONS.map((option) => (
            <InterventionCard
              key={option.type}
              option={option}
              selected={selectedIntervention === option.type}
              onSelect={() => setSelectedIntervention(option.type)}
            />
          ))}
        </View>

        {/* Duration Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intervention Duration</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.durationChip,
                  selectedDuration === option.value && styles.durationChipSelected,
                ]}
                onPress={() => setSelectedDuration(option.value)}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    selectedDuration === option.value &&
                      styles.durationChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Start Button */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartBaseline}
          >
            <Text style={styles.startButtonText}>Start Baseline Recording</Text>
          </TouchableOpacity>
          <Text style={styles.ctaHint}>
            Find a quiet spot and position your phone on your abdomen
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: safeArea.horizontal,
    paddingBottom: spacing["3xl"],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.xl,
    color: colors.textPrimary,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },

  // Introduction card
  introCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  introIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  introTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  introText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.6,
  },

  // Resume card
  resumeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accentDim,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  resumeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  resumeIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  resumeTextContainer: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
  },
  resumeSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  resumeArrow: {
    fontSize: typography.sizes.xl,
    color: colors.accent,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  // Duration chips
  durationRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  durationChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  durationChipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  durationChipText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  durationChipTextSelected: {
    color: colors.accent,
  },

  // CTA section
  ctaSection: {
    marginTop: spacing.lg,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    alignItems: "center",
  },
  startButtonText: {
    color: colors.background,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  ctaHint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
