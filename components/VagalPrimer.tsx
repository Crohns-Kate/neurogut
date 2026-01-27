/**
 * VagalPrimer - Pre-Recording Vagus Nerve Stimulation Screen
 *
 * Different primers for different interventions:
 * - Humming: 5 minutes with audio guide, calmness meter
 * - Deep Breathing: 2 minutes with 4-7-8 breathing triangle
 * - Gargling: 30 seconds countdown
 * - Cold Exposure: 30 seconds countdown
 */

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio, AVPlaybackStatus } from "expo-av";
import Svg, { Polygon, Circle, G, Text as SvgText, Path } from "react-native-svg";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";

interface VagalPrimerProps {
  /** Called when the primer is completed or skipped */
  onComplete: () => void;
  /** Called when user wants to skip the primer */
  onSkip?: () => void;
  /** Whether to show the skip button */
  showSkip?: boolean;
  /** The intervention type being used */
  intervention: "Humming" | "Deep Breathing" | "Gargling" | "Cold Exposure";
}

// Durations per intervention type (milliseconds)
const PRIMER_DURATIONS: Record<string, number> = {
  "Humming": (6 * 60 + 17) * 1000, // 6 minutes 17 seconds (matches audio length)
  "Deep Breathing": 2 * 60 * 1000,  // 2 minutes
  "Gargling": 30 * 1000,            // 30 seconds
  "Cold Exposure": 30 * 1000,       // 30 seconds
};

// 4-7-8 Breathing constants (in milliseconds)
const INHALE_MS = 4000;
const HOLD_MS = 7000;
const EXHALE_MS = 8000;
const CYCLE_MS = INHALE_MS + HOLD_MS + EXHALE_MS; // 19 seconds

/**
 * Breathing Triangle - Visual guide for 4-7-8 breathing
 * Shows animated indicator moving around triangle
 */
const BreathingTriangle = memo(function BreathingTriangle({
  phase,
  progress,
}: {
  phase: "inhale" | "hold" | "exhale";
  progress: number; // 0-1 within the phase
}) {
  // Triangle vertices (equilateral, pointing up)
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

  // Triangle points
  const top = { x: cx, y: cy - r };
  const bottomRight = { x: cx + r * Math.cos(Math.PI / 6), y: cy + r * Math.sin(Math.PI / 6) };
  const bottomLeft = { x: cx - r * Math.cos(Math.PI / 6), y: cy + r * Math.sin(Math.PI / 6) };

  // Calculate indicator position based on phase and progress
  let indicatorX = cx;
  let indicatorY = cy;

  if (phase === "inhale") {
    // Bottom left to top (4 seconds)
    indicatorX = bottomLeft.x + (top.x - bottomLeft.x) * progress;
    indicatorY = bottomLeft.y + (top.y - bottomLeft.y) * progress;
  } else if (phase === "hold") {
    // Top to bottom right (7 seconds)
    indicatorX = top.x + (bottomRight.x - top.x) * progress;
    indicatorY = top.y + (bottomRight.y - top.y) * progress;
  } else {
    // Bottom right to bottom left (8 seconds)
    indicatorX = bottomRight.x + (bottomLeft.x - bottomRight.x) * progress;
    indicatorY = bottomRight.y + (bottomLeft.y - bottomRight.y) * progress;
  }

  // Colors
  const activeColor = colors.accent;
  const dimColor = colors.textMuted;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Triangle outline */}
      <Polygon
        points={`${top.x},${top.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
        fill="none"
        stroke={colors.backgroundCard}
        strokeWidth={3}
      />

      {/* Active edge highlight */}
      {phase === "inhale" && (
        <Path
          d={`M ${bottomLeft.x} ${bottomLeft.y} L ${top.x} ${top.y}`}
          stroke={activeColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}
      {phase === "hold" && (
        <Path
          d={`M ${top.x} ${top.y} L ${bottomRight.x} ${bottomRight.y}`}
          stroke={activeColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}
      {phase === "exhale" && (
        <Path
          d={`M ${bottomRight.x} ${bottomRight.y} L ${bottomLeft.x} ${bottomLeft.y}`}
          stroke={activeColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}

      {/* Phase labels */}
      <SvgText x={cx} y={top.y - 15} fill={phase === "inhale" ? activeColor : dimColor} fontSize={12} fontWeight="600" textAnchor="middle">
        HOLD (7s)
      </SvgText>
      <SvgText x={bottomLeft.x - 25} y={bottomLeft.y + 5} fill={phase === "inhale" ? activeColor : dimColor} fontSize={12} fontWeight="600" textAnchor="middle">
        IN (4s)
      </SvgText>
      <SvgText x={bottomRight.x + 25} y={bottomRight.y + 5} fill={phase === "exhale" ? activeColor : dimColor} fontSize={12} fontWeight="600" textAnchor="middle">
        OUT (8s)
      </SvgText>

      {/* Moving indicator */}
      <Circle cx={indicatorX} cy={indicatorY} r={12} fill={activeColor} />
      <Circle cx={indicatorX} cy={indicatorY} r={8} fill={colors.background} />
    </Svg>
  );
});

/**
 * Simple countdown timer display
 */
function CountdownTimer({
  remainingMs,
  totalMs,
}: {
  remainingMs: number;
  totalMs: number;
}) {
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const progress = 1 - remainingMs / totalMs;

  return (
    <View style={styles.timerContainer}>
      <Text style={styles.timerText}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </Text>
      <View style={styles.timerProgressBar}>
        <View
          style={[styles.timerProgressFill, { width: `${progress * 100}%` }]}
        />
      </View>
    </View>
  );
}

/**
 * Calmness Meter - Simple visual feedback for humming
 */
function CalmnessMeter({ intensity }: { intensity: number }) {
  const barCount = 10;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const threshold = (i + 1) / barCount;
    const isActive = intensity >= threshold;
    return (
      <View
        key={i}
        style={[
          styles.meterBar,
          isActive && styles.meterBarActive,
          i >= 7 && isActive && styles.meterBarOptimal,
        ]}
      />
    );
  });

  return (
    <View style={styles.calmnessMeterContainer}>
      <Text style={styles.calmnessMeterTitle}>Calmness Meter</Text>
      <View style={styles.meterBarsContainer}>{bars}</View>
      <Text style={styles.calmnessMeterHint}>
        {intensity > 0.7 ? "Perfect! Keep humming steadily" : intensity > 0.3 ? "Good - hum a bit louder" : "Start humming..."}
      </Text>
    </View>
  );
}

/**
 * VagalPrimer - Main component
 */
export default function VagalPrimer({
  onComplete,
  onSkip,
  showSkip = true,
  intervention,
}: VagalPrimerProps) {
  const totalDuration = PRIMER_DURATIONS[intervention] || 60000;

  // Audio state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Timer state
  const [remainingMs, setRemainingMs] = useState(totalDuration);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Breathing state (for Deep Breathing)
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathProgress, setBreathProgress] = useState(0);

  // Simulated intensity for humming meter
  const [intensity, setIntensity] = useState(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sound]);

  // Load audio on mount (for breathing guide and humming)
  useEffect(() => {
    if (intervention === "Deep Breathing" || intervention === "Humming") {
      loadAudio();
    } else {
      setAudioLoaded(true);
    }
  }, [intervention]);

  // Breathing phase tracking when active
  useEffect(() => {
    if (isActive && intervention === "Deep Breathing") {
      const breathInterval = setInterval(() => {
        if (!startTimeRef.current) return;

        const elapsed = Date.now() - startTimeRef.current;
        const cyclePosition = elapsed % CYCLE_MS;

        if (cyclePosition < INHALE_MS) {
          setBreathPhase("inhale");
          setBreathProgress(cyclePosition / INHALE_MS);
        } else if (cyclePosition < INHALE_MS + HOLD_MS) {
          setBreathPhase("hold");
          setBreathProgress((cyclePosition - INHALE_MS) / HOLD_MS);
        } else {
          setBreathPhase("exhale");
          setBreathProgress((cyclePosition - INHALE_MS - HOLD_MS) / EXHALE_MS);
        }
      }, 50);

      return () => clearInterval(breathInterval);
    }
  }, [isActive, intervention]);

  // Simulate intensity for humming (would be from mic in production)
  useEffect(() => {
    if (isActive && intervention === "Humming") {
      const simInterval = setInterval(() => {
        setIntensity(0.5 + Math.random() * 0.4);
      }, 300);
      return () => clearInterval(simInterval);
    } else {
      setIntensity(0);
    }
  }, [isActive, intervention]);

  const loadAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Load the appropriate audio file based on intervention
      const audioSource = intervention === "Humming"
        ? require("../assets/audio/humming_guide.mp3")
        : require("../assets/audio/breathing_478_guide.mp3");

      const { sound: loadedSound } = await Audio.Sound.createAsync(
        audioSource,
        { shouldPlay: false, isLooping: false, volume: 0.6 }, // No looping - play once
        onPlaybackStatusUpdate
      );

      setSound(loadedSound);
      setAudioLoaded(true);
    } catch (error) {
      console.error("Error loading audio:", error);
      setAudioLoaded(true); // Allow proceeding even without audio
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
  };

  const startPrimer = async () => {
    setIsActive(true);
    startTimeRef.current = Date.now();
    setRemainingMs(totalDuration);

    // Start audio for breathing or humming
    if (sound && (intervention === "Deep Breathing" || intervention === "Humming")) {
      try {
        await sound.playAsync();
      } catch (error) {
        console.error("Error playing audio:", error);
      }
    }

    // Start countdown timer
    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, totalDuration - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        handleComplete();
      }
    }, 100);
  };

  const handleComplete = async () => {
    setIsActive(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (sound) {
      try {
        await sound.stopAsync();
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    }

    onComplete();
  };

  const handleSkip = async () => {
    setIsActive(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (sound) {
      try {
        await sound.stopAsync();
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    }

    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  // Get instruction based on intervention
  const getInstructions = () => {
    switch (intervention) {
      case "Humming":
        return {
          icon: "🎵",
          title: "Humming Primer",
          instruction: "Hum along to stimulate your Vagus nerve. This prepares your gut for an accurate reading.",
          hint: "Hum at a comfortable low pitch - feel the vibration in your chest.",
        };
      case "Deep Breathing":
        return {
          icon: "🫁",
          title: "4-7-8 Breathing",
          instruction: "Follow the triangle: Inhale 4 seconds, Hold 7 seconds, Exhale 8 seconds.",
          hint: "Breathe through your nose, exhale through your mouth.",
        };
      case "Gargling":
        return {
          icon: "💧",
          title: "Gargling Prep",
          instruction: "Get a glass of water ready. When you start, gargle vigorously for 30 seconds.",
          hint: "The gargling action stimulates vagal tone through throat muscles.",
        };
      case "Cold Exposure":
        return {
          icon: "❄️",
          title: "Cold Exposure Prep",
          instruction: "Get cold water or ice ready. Apply to your face/neck during the countdown.",
          hint: "The cold triggers the dive reflex, activating your vagus nerve.",
        };
    }
  };

  const info = getInstructions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>{info.icon}</Text>
          <Text style={styles.headerTitle}>{info.title}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>{info.instruction}</Text>
          <Text style={styles.instructionHint}>{info.hint}</Text>
        </View>

        {/* Visual Guide (intervention-specific) */}
        <View style={styles.visualGuideContainer}>
          {intervention === "Deep Breathing" && isActive && (
            <BreathingTriangle phase={breathPhase} progress={breathProgress} />
          )}

          {intervention === "Deep Breathing" && !isActive && (
            <View style={styles.breathingPreview}>
              <Text style={styles.breathingPreviewText}>4-7-8</Text>
              <Text style={styles.breathingPreviewLabel}>Breathing Triangle</Text>
            </View>
          )}

          {intervention === "Humming" && (
            <CalmnessMeter intensity={isActive ? intensity : 0} />
          )}

          {(intervention === "Gargling" || intervention === "Cold Exposure") && (
            <View style={styles.simpleIconContainer}>
              <Text style={styles.simpleIcon}>{info.icon}</Text>
              <Text style={styles.simpleIconLabel}>
                {isActive ? "Go!" : "Ready?"}
              </Text>
            </View>
          )}
        </View>

        {/* Timer */}
        <CountdownTimer remainingMs={remainingMs} totalMs={totalDuration} />

        {/* Breathing phase indicator (when active) */}
        {intervention === "Deep Breathing" && isActive && (
          <View style={styles.phaseIndicator}>
            <Text style={styles.phaseText}>
              {breathPhase === "inhale" ? "INHALE..." : breathPhase === "hold" ? "HOLD..." : "EXHALE..."}
            </Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {!isActive ? (
            <TouchableOpacity
              style={styles.startButton}
              onPress={startPrimer}
              disabled={!audioLoaded && (intervention === "Deep Breathing" || intervention === "Humming")}
            >
              <Text style={styles.startButtonText}>
                {audioLoaded || (intervention !== "Deep Breathing" && intervention !== "Humming") ? "Begin" : "Loading..."}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleComplete}
            >
              <Text style={styles.completeButtonText}>Done - Continue</Text>
            </TouchableOpacity>
          )}

          {/* Skip button - always visible */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>
              {isActive ? "Skip Primer" : "Skip - Go Straight to Recording"}
            </Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  instructionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  instructionText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    lineHeight: typography.sizes.base * 1.5,
    marginBottom: spacing.sm,
  },
  instructionHint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  visualGuideContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    marginBottom: spacing.lg,
  },
  breathingPreview: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.backgroundCard,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  breathingPreviewText: {
    fontSize: typography.sizes["3xl"],
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  breathingPreviewLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  simpleIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.backgroundCard,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  simpleIcon: {
    fontSize: 64,
  },
  simpleIconLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },

  // Timer
  timerContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  timerText: {
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
    marginBottom: spacing.sm,
  },
  timerProgressBar: {
    width: "80%",
    height: 8,
    backgroundColor: colors.backgroundCard,
    borderRadius: 4,
    overflow: "hidden",
  },
  timerProgressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 4,
  },

  // Phase indicator
  phaseIndicator: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  phaseText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: 2,
  },

  // Calmness meter
  calmnessMeterContainer: {
    alignItems: "center",
    width: "100%",
  },
  calmnessMeterTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  meterBarsContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm,
  },
  meterBar: {
    width: 24,
    height: 80,
    backgroundColor: colors.backgroundCard,
    borderRadius: 4,
  },
  meterBarActive: {
    backgroundColor: colors.accent,
  },
  meterBarOptimal: {
    backgroundColor: colors.success,
  },
  calmnessMeterHint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Controls
  controlsContainer: {
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.full,
    width: "100%",
    alignItems: "center",
  },
  startButtonText: {
    color: colors.background,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  completeButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.full,
    width: "100%",
    alignItems: "center",
  },
  completeButtonText: {
    color: colors.background,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  skipButton: {
    paddingVertical: spacing.md,
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
    textDecorationLine: "underline",
  },
});
