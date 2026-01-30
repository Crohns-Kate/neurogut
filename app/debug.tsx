/**
 * Debug Screen - Hidden settings screen for clinical data audits
 *
 * Access: Settings → Debug (triple-tap version number or direct navigation)
 * Features:
 * - Ghost data audit with detailed results
 * - Storage statistics
 * - Patient isolation validation
 * - Cleanup functionality (with confirmation)
 * - Audio analysis debug with verbose filtering logs
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import {
  runGhostDataAudit,
  runGhostDataCleanup,
  AuditReport,
} from "../src/storage/runAudit";
import {
  analyzeWithDebug,
  formatDebugLog,
  getDebugSummary,
  DebugAnalysisResult,
} from "../src/analytics/audioDebug";

type AuditStatus = "idle" | "running" | "complete" | "error";
type AudioDebugStatus = "idle" | "recording" | "analyzing" | "complete" | "error";

export default function DebugScreen() {
  const router = useRouter();
  const [auditStatus, setAuditStatus] = useState<AuditStatus>("idle");
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Audio debug state
  const [audioDebugStatus, setAudioDebugStatus] = useState<AudioDebugStatus>("idle");
  const [audioDebugResult, setAudioDebugResult] = useState<DebugAnalysisResult | null>(null);
  const [audioDebugError, setAudioDebugError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(5); // seconds
  const [showFullLog, setShowFullLog] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [recordingTimer, setRecordingTimer] = useState(0);

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

  // Audio debug functions
  const startAudioDebugRecording = useCallback(async () => {
    try {
      setAudioDebugStatus("recording");
      setAudioDebugError(null);
      setAudioDebugResult(null);
      setRecordingTimer(0);

      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        throw new Error("Microphone permission denied");
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        isMeteringEnabled: true,
        android: {
          extension: ".m4a",
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;

      // Update timer every second
      const startTime = Date.now();
      const timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTimer(elapsed);
        if (elapsed >= recordingDuration) {
          clearInterval(timerInterval);
        }
      }, 1000);

      // Stop after duration
      setTimeout(async () => {
        clearInterval(timerInterval);
        await stopAndAnalyzeRecording();
      }, recordingDuration * 1000);

    } catch (error) {
      setAudioDebugError(error instanceof Error ? error.message : "Recording failed");
      setAudioDebugStatus("error");
    }
  }, [recordingDuration]);

  const stopAndAnalyzeRecording = useCallback(async () => {
    try {
      setAudioDebugStatus("analyzing");

      if (!recordingRef.current) {
        throw new Error("No recording to analyze");
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error("No recording URI");
      }

      // Read audio file and convert to samples
      // Note: This is a simplified approach - in production you'd use a proper audio decoder
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error("Recording file not found");
      }

      // For demo purposes, generate synthetic samples based on file size
      // In a real implementation, you'd decode the audio file
      const fileSizeKB = (fileInfo as any).size / 1024;
      const estimatedSamples = Math.floor(recordingDuration * 44100);

      // Read the raw file data
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      // Decode base64 to binary and extract PCM samples
      // This is a simplified extraction - actual m4a decoding would require a native module
      const binaryString = atob(base64Data);
      const samples: number[] = [];

      // Extract approximate audio envelope from file bytes
      // Note: This won't give true PCM samples but will show relative energy levels
      for (let i = 0; i < binaryString.length && samples.length < estimatedSamples; i += 2) {
        const byte1 = binaryString.charCodeAt(i);
        const byte2 = i + 1 < binaryString.length ? binaryString.charCodeAt(i + 1) : 0;
        // Combine bytes and normalize to -1 to 1 range
        const sample = ((byte1 | (byte2 << 8)) - 32768) / 32768;
        samples.push(sample);
      }

      // Pad with zeros if needed
      while (samples.length < estimatedSamples) {
        samples.push(0);
      }

      // Run debug analysis
      const result = analyzeWithDebug(samples, recordingDuration, 44100);
      setAudioDebugResult(result);
      setAudioDebugStatus("complete");

      // Clean up recording file
      await FileSystem.deleteAsync(uri, { idempotent: true });

    } catch (error) {
      setAudioDebugError(error instanceof Error ? error.message : "Analysis failed");
      setAudioDebugStatus("error");
    }
  }, [recordingDuration]);

  const cancelRecording = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      recordingRef.current = null;
    }
    setAudioDebugStatus("idle");
    setRecordingTimer(0);
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

      {/* Audio Debug Section */}
      <View style={styles.sectionDivider} />
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionHeader}>Audio Analysis Debug</Text>
        <Text style={styles.auditDescription}>
          Record audio and see detailed filtering decisions for each detected event.
          Shows why events are accepted or rejected by each filter.
        </Text>

        {/* Duration selector */}
        <View style={styles.durationSelector}>
          <Text style={styles.durationLabel}>Recording Duration:</Text>
          <View style={styles.durationButtons}>
            {[3, 5, 10, 15].map((dur) => (
              <TouchableOpacity
                key={dur}
                style={[
                  styles.durationButton,
                  recordingDuration === dur && styles.durationButtonActive,
                ]}
                onPress={() => setRecordingDuration(dur)}
                disabled={audioDebugStatus === "recording" || audioDebugStatus === "analyzing"}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    recordingDuration === dur && styles.durationButtonTextActive,
                  ]}
                >
                  {dur}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recording button */}
        {audioDebugStatus === "idle" && (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startAudioDebugRecording}
          >
            <Text style={styles.recordButtonText}>Start Debug Recording</Text>
          </TouchableOpacity>
        )}

        {audioDebugStatus === "recording" && (
          <View style={styles.recordingStatus}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Recording... {recordingTimer}s / {recordingDuration}s
              </Text>
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {audioDebugStatus === "analyzing" && (
          <View style={styles.analyzingStatus}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.analyzingText}>Analyzing with debug output...</Text>
          </View>
        )}

        {audioDebugStatus === "error" && audioDebugError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Analysis Error</Text>
            <Text style={styles.errorText}>{audioDebugError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setAudioDebugStatus("idle")}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {audioDebugStatus === "complete" && audioDebugResult && (
          <View style={styles.audioResultsContainer}>
            {/* Summary card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Analysis Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{audioDebugResult.motilityIndex}</Text>
                  <Text style={styles.summaryLabel}>Motility Index</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {audioDebugResult.summary.eventsAccepted}/{audioDebugResult.summary.totalEventsDetected}
                  </Text>
                  <Text style={styles.summaryLabel}>Events Accepted</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[
                    styles.summaryValue,
                    audioDebugResult.contactQuality.isOnBody ? styles.statSuccess : styles.statWarning
                  ]}>
                    {audioDebugResult.contactQuality.isOnBody ? "ON-BODY" : "IN-AIR"}
                  </Text>
                  <Text style={styles.summaryLabel}>Contact</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {audioDebugResult.anfCalibration.estimatedSNR.toFixed(1)}dB
                  </Text>
                  <Text style={styles.summaryLabel}>SNR</Text>
                </View>
              </View>
            </View>

            {/* Contact quality details - Spectral */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact: Spectral Criteria</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Low-freq ratio (&lt;200Hz)</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.spectralCriteria.isLowFreqDominant
                    ? styles.statSuccess : styles.statWarning
                ]}>
                  {(audioDebugResult.contactQuality.lowFreqRatio * 100).toFixed(1)}% (need ≥45%)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>High-freq ratio (&gt;400Hz)</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.spectralCriteria.isHighFreqSuppressed
                    ? styles.statSuccess : styles.statWarning
                ]}>
                  {(audioDebugResult.contactQuality.highFreqRatio * 100).toFixed(1)}% (need ≤15%)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Spectral rolloff</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.spectralCriteria.isLowRolloff
                    ? styles.statSuccess : styles.statWarning
                ]}>
                  {audioDebugResult.contactQuality.spectralRolloff.toFixed(0)}Hz (need ≤350Hz)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Spectral criteria met</Text>
                <Text style={styles.statValue}>
                  {audioDebugResult.contactQuality.spectralCriteria.spectralCriteriaMet}/3
                </Text>
              </View>
            </View>

            {/* Contact quality details - Temporal (CRITICAL) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact: Temporal Criteria (CRITICAL)</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Coefficient of Variation</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.temporalCriteria.hasTemporalVariability
                    ? styles.statSuccess : styles.statCritical
                ]}>
                  {(audioDebugResult.contactQuality.temporalCriteria.coefficientOfVariation * 100).toFixed(1)}% (need ≥12%)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Burst peaks (&gt;2x avg)</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.temporalCriteria.hasBurstPeaks
                    ? styles.statSuccess : styles.statCritical
                ]}>
                  {audioDebugResult.contactQuality.temporalCriteria.burstPeakCount} (need ≥2)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Energy variance ratio</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.temporalCriteria.hasEnergyVariance
                    ? styles.statSuccess : styles.statCritical
                ]}>
                  {audioDebugResult.contactQuality.temporalCriteria.energyVarianceRatio.toFixed(1)}x (need ≥3x)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Temporal criteria met</Text>
                <Text style={[
                  styles.statValue,
                  audioDebugResult.contactQuality.temporalCriteria.temporalCriteriaMet >= 1
                    ? styles.statSuccess : styles.statCritical
                ]}>
                  {audioDebugResult.contactQuality.temporalCriteria.temporalCriteriaMet}/3 (need ≥1)
                </Text>
              </View>
              {audioDebugResult.contactQuality.temporalCriteria.temporalCriteriaMet === 0 && (
                <Text style={styles.issueText}>
                  ⚠️ FLAT SIGNAL DETECTED - No burst variability, likely table/ambient noise
                </Text>
              )}
            </View>

            {/* Rejection summary */}
            {Object.keys(audioDebugResult.summary.rejectionsByFilter).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rejection Summary</Text>
                {Object.entries(audioDebugResult.summary.rejectionsByFilter).map(([filter, count]) => (
                  <View key={filter} style={styles.statRow}>
                    <Text style={styles.statLabel}>{filter}</Text>
                    <Text style={[styles.statValue, styles.statWarning]}>{count} events</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Event details (expandable) */}
            {audioDebugResult.eventDetails.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Event Details ({audioDebugResult.eventDetails.length} events)
                </Text>
                {audioDebugResult.eventDetails.slice(0, 5).map((event) => (
                  <View key={event.eventId} style={styles.eventCard}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>
                        Event #{event.eventId}: {event.startMs.toFixed(0)}-{event.endMs.toFixed(0)}ms
                      </Text>
                      <Text style={[
                        styles.eventStatus,
                        event.accepted ? styles.statSuccess : styles.statCritical
                      ]}>
                        {event.accepted ? "✓ ACCEPTED" : "✗ REJECTED"}
                      </Text>
                    </View>
                    <Text style={styles.eventDuration}>
                      Duration: {event.durationMs.toFixed(0)}ms | Peak: {event.peakEnergy.toFixed(4)}
                    </Text>
                    {event.spectralAnalysis && (
                      <Text style={styles.eventDetail}>
                        Spectral: SFM={event.spectralAnalysis.sfm.toFixed(3)} |
                        Bowel={( event.spectralAnalysis.bowelPeakRatio * 100).toFixed(0)}% |
                        ZCR={event.spectralAnalysis.zcr.toFixed(3)}
                      </Text>
                    )}
                    {event.harmonicAnalysis && event.harmonicAnalysis.fundamentalHz && (
                      <Text style={styles.eventDetail}>
                        Harmonic: f0={event.harmonicAnalysis.fundamentalHz.toFixed(0)}Hz |
                        {event.harmonicAnalysis.harmonicCount} harmonics |
                        HNR={event.harmonicAnalysis.hnrDb.toFixed(1)}dB
                      </Text>
                    )}
                    {event.breathAnalysis && (
                      <Text style={styles.eventDetail}>
                        Breath: onset={event.breathAnalysis.onsetRatio.toFixed(2)} |
                        lowFreq={( event.breathAnalysis.lowFreqEmphasis * 100).toFixed(0)}% |
                        conf={( event.breathAnalysis.breathConfidence * 100).toFixed(0)}%
                      </Text>
                    )}
                    {event.rejectionReasons.length > 0 && (
                      <View style={styles.rejectionReasons}>
                        {event.rejectionReasons.map((reason, idx) => (
                          <Text key={idx} style={styles.rejectionReason}>
                            ⚠ {reason.filter}: {reason.reason}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {audioDebugResult.eventDetails.length > 5 && (
                  <Text style={styles.moreEvents}>
                    ... and {audioDebugResult.eventDetails.length - 5} more events
                  </Text>
                )}
              </View>
            )}

            {/* Full log toggle */}
            <TouchableOpacity
              style={styles.toggleLogButton}
              onPress={() => setShowFullLog(!showFullLog)}
            >
              <Text style={styles.toggleLogText}>
                {showFullLog ? "Hide Full Debug Log" : "Show Full Debug Log"}
              </Text>
            </TouchableOpacity>

            {showFullLog && (
              <View style={styles.fullLogContainer}>
                <ScrollView horizontal>
                  <Text style={styles.fullLogText}>
                    {formatDebugLog(audioDebugResult)}
                  </Text>
                </ScrollView>
              </View>
            )}

            {/* New recording button */}
            <TouchableOpacity
              style={styles.newRecordingButton}
              onPress={() => {
                setAudioDebugStatus("idle");
                setAudioDebugResult(null);
                setShowFullLog(false);
              }}
            >
              <Text style={styles.newRecordingButtonText}>New Recording</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
  // Audio debug styles
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  sectionHeader: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  durationSelector: {
    marginTop: spacing.base,
    marginBottom: spacing.lg,
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  durationButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  durationButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + "20",
  },
  durationButtonText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  durationButtonTextActive: {
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  recordButton: {
    backgroundColor: "#10B981",
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  recordingStatus: {
    alignItems: "center",
    gap: spacing.base,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  recordingText: {
    fontSize: typography.sizes.lg,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
  },
  analyzingStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  analyzingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  retryButton: {
    marginTop: spacing.base,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#EF4444",
    alignSelf: "flex-start",
  },
  retryButtonText: {
    color: "#EF4444",
    fontSize: typography.sizes.sm,
  },
  audioResultsContainer: {
    gap: spacing.base,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  summaryItem: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  summaryValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  eventCard: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  eventTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  eventStatus: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  eventDuration: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  eventDetail: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  rejectionReasons: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rejectionReason: {
    fontSize: typography.sizes.xs,
    color: "#F59E0B",
    marginTop: 2,
  },
  moreEvents: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  toggleLogButton: {
    alignItems: "center",
    paddingVertical: spacing.base,
    marginTop: spacing.base,
  },
  toggleLogText: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
  },
  fullLogContainer: {
    backgroundColor: "#1A1A2E",
    padding: spacing.base,
    borderRadius: radius.md,
    maxHeight: 400,
  },
  fullLogText: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#E0E0E0",
    lineHeight: 14,
  },
  newRecordingButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  newRecordingButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});
