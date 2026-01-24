/**
 * Debug Screen - Hidden settings screen for clinical data audits
 *
 * Access: Settings → Debug (triple-tap version number or direct navigation)
 * Features:
 * - Ghost data audit with detailed results
 * - Storage statistics
 * - Patient isolation validation
 * - Cleanup functionality (with confirmation)
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import {
  runGhostDataAudit,
  runGhostDataCleanup,
  AuditReport,
} from "../src/storage/runAudit";

type AuditStatus = "idle" | "running" | "complete" | "error";

export default function DebugScreen() {
  const router = useRouter();
  const [auditStatus, setAuditStatus] = useState<AuditStatus>("idle");
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const runAudit = useCallback(async () => {
    setAuditStatus("running");
    setErrorMessage(null);

    try {
      const report = await runGhostDataAudit();
      setAuditReport(report);
      setAuditStatus("complete");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      setAuditStatus("error");
    }
  }, []);

  const handleCleanup = useCallback(async () => {
    if (!auditReport || auditReport.ghostData.ghostSessionsFound === 0) {
      Alert.alert("No Cleanup Needed", "No ghost data was found to clean up.");
      return;
    }

    Alert.alert(
      "Confirm Cleanup",
      `This will permanently delete:\n\n• ${auditReport.ghostData.ghostSessionsFound} ghost sessions\n• ${auditReport.ghostData.orphanedAudioFiles} orphaned audio files\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsCleaningUp(true);
            try {
              const result = await runGhostDataCleanup();
              Alert.alert(
                "Cleanup Complete",
                `Deleted ${result.deletedSessions.length} sessions and ${result.deletedAudioFiles.length} audio files.`
              );
              // Re-run audit to show updated state
              await runAudit();
            } catch (error) {
              Alert.alert(
                "Cleanup Error",
                error instanceof Error ? error.message : "Unknown error"
              );
            } finally {
              setIsCleaningUp(false);
            }
          },
        },
      ]
    );
  }, [auditReport, runAudit]);

  const renderAuditResults = () => {
    if (!auditReport) return null;

    const { ghostData, storageStats, patientIsolation, recommendations } = auditReport;

    return (
      <View style={styles.resultsContainer}>
        {/* Summary Header */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Audit Summary</Text>
          <Text style={styles.timestamp}>
            {new Date(auditReport.timestamp).toLocaleString()}
          </Text>
        </View>

        {/* Ghost Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ghost Data Analysis</Text>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Sessions</Text>
            <Text style={styles.statValue}>{ghostData.totalSessions}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Ghost Sessions Found</Text>
            <Text
              style={[
                styles.statValue,
                ghostData.ghostSessionsFound > 0 && styles.statWarning,
              ]}
            >
              {ghostData.ghostSessionsFound}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Orphaned Audio Files</Text>
            <Text
              style={[
                styles.statValue,
                ghostData.orphanedAudioFiles > 0 && styles.statWarning,
              ]}
            >
              {ghostData.orphanedAudioFiles}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sessions Missing Audio</Text>
            <Text
              style={[
                styles.statValue,
                ghostData.sessionsWithMissingAudio > 0 && styles.statWarning,
              ]}
            >
              {ghostData.sessionsWithMissingAudio}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sessions Without Patient</Text>
            <Text
              style={[
                styles.statValue,
                ghostData.sessionsWithoutPatient > 0 && styles.statCritical,
              ]}
            >
              {ghostData.sessionsWithoutPatient}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Stale Analytics Sessions</Text>
            <Text
              style={[
                styles.statValue,
                ghostData.staleAnalyticsSessions > 0 && styles.statWarning,
              ]}
            >
              {ghostData.staleAnalyticsSessions}
            </Text>
          </View>
        </View>

        {/* Storage Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Statistics</Text>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sessions with Analytics</Text>
            <Text style={styles.statValue}>
              {storageStats.sessionsWithAnalytics}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sessions without Analytics</Text>
            <Text style={styles.statValue}>
              {storageStats.sessionsWithoutAnalytics}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Unique Patients</Text>
            <Text style={styles.statValue}>{storageStats.uniquePatientCount}</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Audio Files Size</Text>
            <Text style={styles.statValue}>
              {formatBytes(storageStats.totalAudioFilesBytes)}
            </Text>
          </View>
        </View>

        {/* Patient Isolation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Isolation</Text>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Status</Text>
            <Text
              style={[
                styles.statValue,
                patientIsolation.valid ? styles.statSuccess : styles.statCritical,
              ]}
            >
              {patientIsolation.valid ? "VALID" : "ISSUES FOUND"}
            </Text>
          </View>

          {patientIsolation.issues.length > 0 && (
            <View style={styles.issuesList}>
              {patientIsolation.issues.map((issue, index) => (
                <Text key={index} style={styles.issueText}>
                  • {issue}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {recommendations.map((rec, index) => (
              <Text key={index} style={styles.recommendationText}>
                {index + 1}. {rec}
              </Text>
            ))}
          </View>
        )}

        {/* Cleanup Button */}
        {ghostData.ghostSessionsFound > 0 && (
          <TouchableOpacity
            style={styles.cleanupButton}
            onPress={handleCleanup}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.cleanupButtonText}>
                Clean Up Ghost Data ({ghostData.ghostSessionsFound} items)
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Errors Section */}
        {ghostData.errors.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.errorTitle]}>Errors</Text>
            {ghostData.errors.map((err, index) => (
              <Text key={index} style={styles.errorText}>
                {err}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Tools</Text>
        <Text style={styles.subtitle}>Clinical Data Audit & Maintenance</Text>
      </View>

      {/* Audit Button */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[
            styles.auditButton,
            auditStatus === "running" && styles.auditButtonDisabled,
          ]}
          onPress={runAudit}
          disabled={auditStatus === "running"}
        >
          {auditStatus === "running" ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.background} />
              <Text style={styles.auditButtonText}>Running Audit...</Text>
            </View>
          ) : (
            <Text style={styles.auditButtonText}>Run Ghost Data Audit</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.auditDescription}>
          Scans for orphaned sessions, missing audio files, unassigned patient
          data, and stale analytics. No data is modified until you confirm cleanup.
        </Text>
      </View>

      {/* Error State */}
      {auditStatus === "error" && errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Audit Failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Results */}
      {auditStatus === "complete" && renderAuditResults()}

      {/* Version Info */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>NeuroGut v1.0.0</Text>
        <Text style={styles.versionText}>NG-HARDEN-01 Applied</Text>
      </View>
    </ScrollView>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: safeArea.horizontal,
  },
  header: {
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.base,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: typography.sizes.base,
  },
  title: {
    fontSize: typography.sizes["3xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  actionsContainer: {
    marginBottom: spacing.xl,
  },
  auditButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  auditButtonDisabled: {
    opacity: 0.7,
  },
  auditButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  auditDescription: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * 1.5,
  },
  resultsContainer: {
    marginBottom: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  timestamp: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.base,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.base,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statLabel: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  statSuccess: {
    color: colors.accent,
  },
  statWarning: {
    color: "#F59E0B",
  },
  statCritical: {
    color: "#EF4444",
  },
  issuesList: {
    marginTop: spacing.sm,
  },
  issueText: {
    fontSize: typography.sizes.sm,
    color: "#EF4444",
    marginBottom: spacing.xs,
  },
  recommendationText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: typography.sizes.sm * 1.5,
  },
  cleanupButton: {
    backgroundColor: "#EF4444",
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 52,
  },
  cleanupButtonText: {
    color: "#FFFFFF",
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  errorTitle: {
    color: "#EF4444",
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: "#EF4444",
    fontSize: typography.sizes.sm,
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xl,
  },
  versionText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
});
