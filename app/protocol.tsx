import React from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";

export default function ProtocolScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Vagal Toolkit Protocol</Text>
        <Text style={styles.subtitle}>
          Clinical guide for vagal nerve stimulation techniques
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.bodyText}>
          The Vagus Nerve (Cranial Nerve X) is the primary pathway connecting the brain to the gut, heart, and other organs. Stimulating the vagus nerve can improve gut motility, reduce inflammation, and enhance overall well-being.
        </Text>
        <Text style={styles.bodyText}>
          This protocol outlines four evidence-based techniques for vagal stimulation that can be practiced during gut sound recording sessions.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.techniqueTitle}>1. Deep Breathing (4-7-8 Rhythm)</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>How to perform:</Text>
        </Text>
        <Text style={styles.bodyText}>
          • Inhale deeply through your nose for 4 seconds
        </Text>
        <Text style={styles.bodyText}>
          • Hold your breath for 7 seconds
        </Text>
        <Text style={styles.bodyText}>
          • Exhale slowly through your mouth for 8 seconds
        </Text>
        <Text style={styles.bodyText}>
          • Repeat this cycle for 5 minutes
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Clinical rationale:</Text> Deep breathing activates the diaphragm, which massages the vagus nerve and stimulates the parasympathetic nervous system. The 4-7-8 rhythm has been shown to reduce stress and improve digestive function.
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Best for:</Text> Patients with stress-related gut issues, anxiety, or irregular motility patterns.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.techniqueTitle}>2. Humming / Singing</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>How to perform:</Text>
        </Text>
        <Text style={styles.bodyText}>
          • Sit or lie in a comfortable position
        </Text>
        <Text style={styles.bodyText}>
          • Take a deep breath and hum at a low, steady pitch (around 60Hz)
        </Text>
        <Text style={styles.bodyText}>
          • Feel the vibration in your throat and chest
        </Text>
        <Text style={styles.bodyText}>
          • Continue humming for 5 minutes, maintaining consistent vibration
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Clinical rationale:</Text> Humming directly vibrates the laryngeal branch of the vagus nerve, which runs through the throat. This mechanical stimulation activates the nerve and can increase gut motility within minutes.
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Best for:</Text> Patients with low motility, post-surgical recovery, or those who need immediate vagal activation.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.techniqueTitle}>3. Gargling</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>How to perform:</Text>
        </Text>
        <Text style={styles.bodyText}>
          • Fill your mouth with warm water (or saline solution)
        </Text>
        <Text style={styles.bodyText}>
          • Tilt your head back and gargle forcefully for 30 seconds
        </Text>
        <Text style={styles.bodyText}>
          • Spit out the water and rest for 10 seconds
        </Text>
        <Text style={styles.bodyText}>
          • Repeat 3-5 times during the recording session
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Clinical rationale:</Text> Gargling activates the pharyngeal and laryngeal branches of the vagus nerve through mechanical stimulation. This technique is particularly effective for immediate vagal tone improvement.
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Best for:</Text> Patients needing quick vagal activation, those with difficulty with breathing exercises, or during acute gut discomfort.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.techniqueTitle}>4. Cold Exposure</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>How to perform:</Text>
        </Text>
        <Text style={styles.bodyText}>
          • Apply a cold compress or ice pack to the face (especially around the eyes and neck)
        </Text>
        <Text style={styles.bodyText}>
          • Alternatively, splash cold water on your face or take a cold shower
        </Text>
        <Text style={styles.bodyText}>
          • Hold for 30-60 seconds, then remove
        </Text>
        <Text style={styles.bodyText}>
          • Repeat 2-3 times during the session
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Clinical rationale:</Text> Cold exposure triggers the "diving reflex," which activates the vagus nerve through the trigeminal nerve pathway. This can rapidly increase vagal tone and improve gut function.
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Best for:</Text> Patients with high stress levels, those needing rapid vagal activation, or individuals who prefer physical interventions over breathing.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clinical Notes</Text>
        <Text style={styles.bodyText}>
          • Always ensure the patient is comfortable and can stop the intervention at any time
        </Text>
        <Text style={styles.bodyText}>
          • Monitor the patient's response during the recording session
        </Text>
        <Text style={styles.bodyText}>
          • Compare baseline motility (first 30 seconds) with intervention period motility
        </Text>
        <Text style={styles.bodyText}>
          • Document which technique produces the best results for each patient
        </Text>
        <Text style={styles.bodyText}>
          • Some patients may respond better to one technique over others—this is normal and expected
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          For questions or additional guidance, consult with your clinical team.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: safeArea.horizontal,
    paddingBottom: spacing["2xl"],
  },
  header: {
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes["3xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.base,
  },
  techniqueTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
    marginBottom: spacing.base,
  },
  bodyText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    marginBottom: spacing.sm,
  },
  bold: {
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  footer: {
    marginTop: spacing["2xl"],
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },
});
