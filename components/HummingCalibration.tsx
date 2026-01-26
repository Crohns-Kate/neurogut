/**
 * HummingCalibration - Vagus Nerve Reset Mode
 *
 * Guided humming session for vagus nerve stimulation.
 * Based on research showing low-frequency humming activates the vagus nerve.
 *
 * Features:
 * - Visual frequency meter showing humming detection
 * - Guided timing with progress indicator
 * - Audio cues for optimal humming frequency
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
} from "react-native";
import { Audio } from "expo-av";
import Svg, { Circle, Path, G, Line } from "react-native-svg";
import { colors, typography, spacing, radius } from "../styles/theme";

interface HummingCalibrationProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when session completes */
  onComplete: (sessionData: HummingSessionData) => void;
  /** Callback when dismissed */
  onDismiss: () => void;
  /** Duration in seconds (default 60) */
  duration?: number;
}

export interface HummingSessionData {
  durationSeconds: number;
  averageFrequency: number;
  peakFrequency: number;
  consistency: number; // 0-100%
  completedAt: string;
}

// Optimal humming frequency range for vagus nerve activation (Hz)
const OPTIMAL_FREQUENCY_MIN = 100;
const OPTIMAL_FREQUENCY_MAX = 200;
const TARGET_FREQUENCY = 130; // ~Om frequency

/**
 * Animated wave visualization
 */
function WaveVisualization({ isActive, intensity }: { isActive: boolean; intensity: number }) {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const createWave = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createWave(wave1, 0);
      const anim2 = createWave(wave2, 500);
      const anim3 = createWave(wave3, 1000);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    } else {
      wave1.setValue(0);
      wave2.setValue(0);
      wave3.setValue(0);
    }
  }, [isActive, wave1, wave2, wave3]);

  const baseRadius = 60;
  const maxExpand = 40 * intensity;

  return (
    <View style={styles.waveContainer}>
      {/* Wave 1 */}
      <Animated.View
        style={[
          styles.wave,
          {
            opacity: wave1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 0],
            }),
            transform: [
              {
                scale: wave1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1 + maxExpand / baseRadius],
                }),
              },
            ],
          },
        ]}
      />
      {/* Wave 2 */}
      <Animated.View
        style={[
          styles.wave,
          {
            opacity: wave2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 0],
            }),
            transform: [
              {
                scale: wave2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1 + maxExpand / baseRadius],
                }),
              },
            ],
          },
        ]}
      />
      {/* Wave 3 */}
      <Animated.View
        style={[
          styles.wave,
          {
            opacity: wave3.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0],
            }),
            transform: [
              {
                scale: wave3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1 + maxExpand / baseRadius],
                }),
              },
            ],
          },
        ]}
      />
      {/* Center circle */}
      <View style={[styles.centerCircle, isActive && styles.centerCircleActive]} />
    </View>
  );
}

/**
 * Frequency meter visualization
 */
function FrequencyMeter({ frequency, isOptimal }: { frequency: number; isOptimal: boolean }) {
  const normalizedFreq = Math.min(Math.max(frequency / 300, 0), 1);
  const optimalStart = OPTIMAL_FREQUENCY_MIN / 300;
  const optimalEnd = OPTIMAL_FREQUENCY_MAX / 300;

  return (
    <View style={styles.frequencyMeter}>
      <View style={styles.frequencyBarBackground}>
        {/* Optimal zone indicator */}
        <View
          style={[
            styles.optimalZone,
            {
              left: `${optimalStart * 100}%`,
              width: `${(optimalEnd - optimalStart) * 100}%`,
            },
          ]}
        />
        {/* Current frequency indicator */}
        <View
          style={[
            styles.frequencyIndicator,
            {
              left: `${normalizedFreq * 100}%`,
              backgroundColor: isOptimal ? colors.success : colors.warning,
            },
          ]}
        />
      </View>
      <View style={styles.frequencyLabels}>
        <Text style={styles.frequencyLabel}>Low</Text>
        <Text style={[styles.frequencyLabel, styles.frequencyLabelCenter]}>
          Optimal
        </Text>
        <Text style={styles.frequencyLabel}>High</Text>
      </View>
      <Text style={styles.frequencyValue}>
        {frequency > 0 ? `${Math.round(frequency)} Hz` : "—"}
      </Text>
    </View>
  );
}

/**
 * Progress circle
 */
function ProgressCircle({ progress }: { progress: number }) {
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size} style={styles.progressCircle}>
      {/* Background circle */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.border}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress arc */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.accent}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/**
 * Main HummingCalibration component
 */
export default function HummingCalibration({
  visible,
  onComplete,
  onDismiss,
  duration = 60,
}: HummingCalibrationProps) {
  const [isActive, setIsActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentFrequency, setCurrentFrequency] = useState(0);
  const [frequencyReadings, setFrequencyReadings] = useState<number[]>([]);
  const [phase, setPhase] = useState<"intro" | "humming" | "complete">("intro");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate progress
  const progress = elapsedTime / duration;

  // Check if current frequency is optimal
  const isOptimal =
    currentFrequency >= OPTIMAL_FREQUENCY_MIN &&
    currentFrequency <= OPTIMAL_FREQUENCY_MAX;

  // Simulate frequency detection (in production, use real FFT analysis)
  const simulateFrequencyDetection = useCallback(() => {
    // Simulated frequency with some variance around target
    const baseFreq = TARGET_FREQUENCY;
    const variance = 30;
    const simulated = baseFreq + (Math.random() - 0.5) * variance * 2;
    return Math.max(50, Math.min(300, simulated));
  }, []);

  // Start humming session
  const startSession = useCallback(async () => {
    try {
      // Request microphone permission
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.warn("Microphone permission not granted");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording for frequency analysis
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      setIsActive(true);
      setPhase("humming");
      setElapsedTime(0);
      setFrequencyReadings([]);

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          const next = prev + 1;
          if (next >= duration) {
            stopSession();
            return duration;
          }
          return next;
        });

        // Simulate frequency reading (replace with real FFT in production)
        const freq = simulateFrequencyDetection();
        setCurrentFrequency(freq);
        setFrequencyReadings((prev) => [...prev, freq]);
      }, 1000);
    } catch (error) {
      console.error("Failed to start humming session:", error);
    }
  }, [duration, simulateFrequencyDetection]);

  // Stop humming session
  const stopSession = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore errors
      }
      recordingRef.current = null;
    }

    setIsActive(false);
    setPhase("complete");

    // Calculate session data
    const readings = frequencyReadings.length > 0 ? frequencyReadings : [0];
    const avgFreq = readings.reduce((a, b) => a + b, 0) / readings.length;
    const peakFreq = Math.max(...readings);
    const optimalReadings = readings.filter(
      (f) => f >= OPTIMAL_FREQUENCY_MIN && f <= OPTIMAL_FREQUENCY_MAX
    );
    const consistency = (optimalReadings.length / readings.length) * 100;

    const sessionData: HummingSessionData = {
      durationSeconds: elapsedTime,
      averageFrequency: Math.round(avgFreq),
      peakFrequency: Math.round(peakFreq),
      consistency: Math.round(consistency),
      completedAt: new Date().toISOString(),
    };

    onComplete(sessionData);
  }, [elapsedTime, frequencyReadings, onComplete]);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // Reset on visibility change
  useEffect(() => {
    if (!visible) {
      setPhase("intro");
      setElapsedTime(0);
      setCurrentFrequency(0);
      setFrequencyReadings([]);
      setIsActive(false);
    }
  }, [visible]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Vagus Nerve Reset</Text>
          <Text style={styles.subtitle}>Humming Calibration</Text>
        </View>

        {/* Intro phase */}
        {phase === "intro" && (
          <View style={styles.content}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How Humming Helps</Text>
              <Text style={styles.infoText}>
                Low-frequency humming creates vibrations that stimulate the vagus
                nerve, promoting relaxation and improving gut-brain communication.
              </Text>
            </View>

            <View style={styles.instructionCard}>
              <Text style={styles.instructionTitle}>Instructions</Text>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>1</Text>
                <Text style={styles.instructionText}>
                  Take a deep breath and relax your jaw
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>2</Text>
                <Text style={styles.instructionText}>
                  Hum a low, steady "Om" or "Mmm" sound
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>3</Text>
                <Text style={styles.instructionText}>
                  Feel the vibration in your chest and throat
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>4</Text>
                <Text style={styles.instructionText}>
                  Continue for {duration} seconds at a steady pace
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.startButton} onPress={startSession}>
              <Text style={styles.startButtonText}>Begin Humming</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Humming phase */}
        {phase === "humming" && (
          <View style={styles.content}>
            <View style={styles.visualizationContainer}>
              <ProgressCircle progress={progress} />
              <View style={styles.waveOverlay}>
                <WaveVisualization isActive={isActive} intensity={isOptimal ? 1 : 0.5} />
              </View>
              <View style={styles.timerOverlay}>
                <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
                <Text style={styles.timerLabel}>/ {formatTime(duration)}</Text>
              </View>
            </View>

            <FrequencyMeter frequency={currentFrequency} isOptimal={isOptimal} />

            <Text style={styles.feedbackText}>
              {isOptimal
                ? "Great! Your humming is in the optimal range."
                : currentFrequency > 0
                  ? "Try humming a bit lower for optimal stimulation."
                  : "Start humming to see your frequency..."}
            </Text>

            <TouchableOpacity style={styles.stopButton} onPress={stopSession}>
              <Text style={styles.stopButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Complete phase */}
        {phase === "complete" && (
          <View style={styles.content}>
            <View style={styles.completeIcon}>
              <Text style={styles.completeIconText}>✓</Text>
            </View>
            <Text style={styles.completeTitle}>Session Complete!</Text>
            <Text style={styles.completeSubtitle}>
              Great work stimulating your vagus nerve.
            </Text>

            <View style={styles.resultsCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Duration</Text>
                <Text style={styles.resultValue}>{formatTime(elapsedTime)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Avg Frequency</Text>
                <Text style={styles.resultValue}>
                  {frequencyReadings.length > 0
                    ? `${Math.round(frequencyReadings.reduce((a, b) => a + b, 0) / frequencyReadings.length)} Hz`
                    : "—"}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Optimal Time</Text>
                <Text style={styles.resultValue}>
                  {frequencyReadings.length > 0
                    ? `${Math.round((frequencyReadings.filter((f) => f >= OPTIMAL_FREQUENCY_MIN && f <= OPTIMAL_FREQUENCY_MAX).length / frequencyReadings.length) * 100)}%`
                    : "—"}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={onDismiss}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: "center",
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    position: "absolute",
    top: spacing["3xl"],
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundCard,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  infoCard: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.accent + "30",
  },
  infoTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.5,
  },
  instructionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    textAlign: "center",
    lineHeight: 24,
    marginRight: spacing.md,
  },
  instructionText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * 1.5,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
  },
  startButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
  visualizationContainer: {
    width: 200,
    height: 200,
    marginVertical: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  progressCircle: {
    position: "absolute",
  },
  waveOverlay: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  timerOverlay: {
    position: "absolute",
    alignItems: "center",
  },
  timerText: {
    fontSize: typography.sizes["3xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  timerLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  waveContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  wave: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  centerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    borderWidth: 2,
    borderColor: colors.border,
  },
  centerCircleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  frequencyMeter: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  frequencyBarBackground: {
    height: 16,
    backgroundColor: colors.backgroundCard,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  optimalZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: colors.success + "30",
  },
  frequencyIndicator: {
    position: "absolute",
    width: 8,
    height: 24,
    borderRadius: 4,
    marginLeft: -4,
    top: -4,
  },
  frequencyLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  frequencyLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  frequencyLabelCenter: {
    color: colors.success,
  },
  frequencyValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  feedbackText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  stopButton: {
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  completeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  completeIconText: {
    fontSize: 40,
    color: colors.background,
    fontWeight: typography.weights.bold,
  },
  completeTitle: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  completeSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  resultsCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: "100%",
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  resultValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
  },
  doneButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
  },
  doneButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
