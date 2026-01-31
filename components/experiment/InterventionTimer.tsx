/**
 * InterventionTimer - Countdown timer with circular progress for intervention phase
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, typography, spacing, radius } from "../../styles/theme";
import { playChime } from "../../src/utils/audioChime";

interface InterventionTimerProps {
  durationSeconds: number;
  onComplete: () => void;
  interventionType: string;
}

export default function InterventionTimer({
  durationSeconds,
  onComplete,
  interventionType,
}: InterventionTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    setIsActive(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;

      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsComplete(true);
        setIsActive(false);
        // Play chime to notify user
        playChime();
      }
    }, 100);
  }, [durationSeconds]);

  const handleComplete = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onComplete();
  };

  // Format time as M:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress (0 to 1)
  const progress = 1 - remainingSeconds / durationSeconds;

  // SVG circle parameters
  const size = 200;
  const strokeWidth = 12;
  const radius_val = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius_val;
  const strokeDashoffset = circumference * (1 - progress);

  // Get instruction based on intervention type
  const getInstruction = () => {
    switch (interventionType) {
      case "Deep Breathing":
        return "Inhale 4s, hold 4s, exhale 6s\nFocus on deep belly breaths";
      case "Humming":
        return "Hum a low, steady tone\nFeel the vibration in your chest";
      case "Cold Exposure":
        return "Apply cold water to your face\nTriggers the dive reflex";
      case "Abdominal Massage":
        return "Massage clockwise around navel\nGentle, circular motions";
      case "Custom":
        return "Perform your chosen practice\nStay relaxed and present";
      default:
        return "Follow your practice";
    }
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>{interventionType}</Text>
      <Text style={styles.instruction}>{getInstruction()}</Text>

      {/* Circular Timer */}
      <View style={styles.timerContainer}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius_val}
            stroke={colors.backgroundCard}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius_val}
            stroke={isComplete ? colors.success : colors.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.timerTextContainer}>
          <Text style={styles.timerText}>{formatTime(remainingSeconds)}</Text>
          <Text style={styles.timerLabel}>
            {isComplete ? "Complete!" : isActive ? "remaining" : "tap to start"}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isActive && !isComplete && (
          <TouchableOpacity style={styles.startButton} onPress={startTimer}>
            <Text style={styles.startButtonText}>Start Timer</Text>
          </TouchableOpacity>
        )}

        {isComplete && (
          <TouchableOpacity style={styles.doneButton} onPress={handleComplete}>
            <Text style={styles.doneButtonText}>Done - Continue</Text>
          </TouchableOpacity>
        )}

        {isActive && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleComplete}
          >
            <Text style={styles.skipButtonText}>Skip & Continue</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instruction: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.base * 1.5,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  timerContainer: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  timerTextContainer: {
    position: "absolute",
    alignItems: "center",
  },
  timerText: {
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  timerLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  controls: {
    width: "100%",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
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
  doneButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    alignItems: "center",
  },
  doneButtonText: {
    color: colors.background,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
    textDecorationLine: "underline",
  },
});
