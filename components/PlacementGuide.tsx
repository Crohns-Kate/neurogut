/**
 * PlacementGuide - Anatomical Guide for Phone Placement
 *
 * Multi-step UI showing Lower Right Quadrant (LRQ) placement.
 * Non-mirrored view with clear anatomical landmarks.
 * Includes 5-second signal check before recording starts.
 */

import React, { useState, useEffect, useRef, memo } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import Svg, { Path, Circle, Rect, Line, G, Ellipse } from "react-native-svg";
import { colors, typography, spacing, radius } from "../styles/theme";

interface PlacementGuideProps {
  /** Current step in the placement guide (1-3) */
  step: number;
  /** Callback when placement is confirmed */
  onPlacementConfirmed: () => void;
  /** Whether signal check is in progress */
  isCheckingSignal: boolean;
  /** Signal check progress (0-100) */
  signalProgress: number;
  /** Whether signal check passed */
  signalPassed: boolean | null;
  /** Current decibel level detected */
  decibelLevel: number;
  /** Callback to start signal check */
  onStartSignalCheck: () => void;
  /** Callback to retry signal check */
  onRetrySignalCheck: () => void;
}

// Anatomical landmarks for LRQ placement
const LRQ_CENTER = { x: 180, y: 220 }; // Lower Right Quadrant center
const BELLY_BUTTON = { x: 150, y: 160 }; // Umbilicus

// Minimum decibel threshold for valid skin contact
const MIN_DECIBEL_THRESHOLD = -50; // dB (relative to max)
const SIGNAL_CHECK_DURATION = 5000; // 5 seconds

/**
 * Static torso outline SVG
 */
const TorsoOutline = memo(function TorsoOutline() {
  return (
    <G>
      {/* Torso outline - non-mirrored anatomical view */}
      <Path
        d="M 100 50 Q 80 80 70 120 L 60 200 Q 55 250 60 300 L 80 350 L 220 350 L 240 300 Q 245 250 240 200 L 230 120 Q 220 80 200 50 Z"
        fill="rgba(255, 255, 255, 0.05)"
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={2}
      />

      {/* Ribcage hint lines */}
      <Path
        d="M 85 100 Q 150 90 215 100"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={1}
      />
      <Path
        d="M 80 120 Q 150 110 220 120"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={1}
      />

      {/* Pelvis hint */}
      <Path
        d="M 70 280 Q 150 320 230 280"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={1}
      />
    </G>
  );
});

/**
 * Quadrant overlay showing LRQ highlight
 */
const QuadrantOverlay = memo(function QuadrantOverlay({ highlightLRQ }: { highlightLRQ: boolean }) {
  return (
    <G>
      {/* Vertical center line (Linea Alba) */}
      <Line
        x1={150}
        y1={80}
        x2={150}
        y2={300}
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth={1}
        strokeDasharray="5,5"
      />

      {/* Horizontal line at umbilicus */}
      <Line
        x1={70}
        y1={160}
        x2={230}
        y2={160}
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth={1}
        strokeDasharray="5,5"
      />

      {/* Belly button marker */}
      <Circle
        cx={BELLY_BUTTON.x}
        cy={BELLY_BUTTON.y}
        r={8}
        fill="rgba(255, 255, 255, 0.1)"
        stroke="rgba(255, 255, 255, 0.3)"
        strokeWidth={1}
      />

      {/* LRQ highlight zone */}
      {highlightLRQ && (
        <Rect
          x={155}
          y={165}
          width={70}
          height={90}
          rx={10}
          fill={`${colors.accent}20`}
          stroke={colors.accent}
          strokeWidth={2}
        />
      )}

      {/* LRQ target point */}
      <Circle
        cx={LRQ_CENTER.x}
        cy={LRQ_CENTER.y}
        r={highlightLRQ ? 15 : 8}
        fill={highlightLRQ ? `${colors.accent}40` : "rgba(255, 255, 255, 0.1)"}
        stroke={highlightLRQ ? colors.accent : "rgba(255, 255, 255, 0.3)"}
        strokeWidth={highlightLRQ ? 3 : 1}
      />

      {/* Quadrant labels */}
      <G>
        {/* Right Upper Quadrant */}
        <Circle cx={190} cy={120} r={3} fill="rgba(255, 255, 255, 0.2)" />
        {/* Left Upper Quadrant */}
        <Circle cx={110} cy={120} r={3} fill="rgba(255, 255, 255, 0.2)" />
        {/* Right Lower Quadrant - TARGET */}
        <Circle cx={190} cy={220} r={6} fill={highlightLRQ ? colors.accent : "rgba(255, 255, 255, 0.2)"} />
        {/* Left Lower Quadrant */}
        <Circle cx={110} cy={220} r={3} fill="rgba(255, 255, 255, 0.2)" />
      </G>
    </G>
  );
});

/**
 * Arrow showing placement direction
 */
const PlacementArrow = memo(function PlacementArrow({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <G>
      {/* Arrow from belly button to LRQ */}
      <Path
        d={`M ${BELLY_BUTTON.x} ${BELLY_BUTTON.y + 10} Q ${165} ${190} ${LRQ_CENTER.x - 15} ${LRQ_CENTER.y - 10}`}
        fill="none"
        stroke={colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Arrowhead */}
      <Path
        d={`M ${LRQ_CENTER.x - 20} ${LRQ_CENTER.y - 20} L ${LRQ_CENTER.x - 15} ${LRQ_CENTER.y - 10} L ${LRQ_CENTER.x - 25} ${LRQ_CENTER.y - 5}`}
        fill="none"
        stroke={colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
});

/**
 * Signal strength indicator
 */
function SignalIndicator({
  progress,
  decibels,
  passed
}: {
  progress: number;
  decibels: number;
  passed: boolean | null;
}) {
  const getStatusColor = () => {
    if (passed === null) return colors.textMuted;
    return passed ? colors.success : colors.warning;
  };

  const getStatusText = () => {
    if (passed === null) return "Checking...";
    return passed ? "Good Contact!" : "Weak Signal";
  };

  return (
    <View style={styles.signalIndicator}>
      <View style={styles.signalBarContainer}>
        <View
          style={[
            styles.signalBarFill,
            {
              width: `${progress}%`,
              backgroundColor: getStatusColor(),
            }
          ]}
        />
      </View>
      <View style={styles.signalInfo}>
        <Text style={[styles.signalStatus, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        <Text style={styles.signalDecibels}>
          {decibels.toFixed(0)} dB
        </Text>
      </View>
    </View>
  );
}

/**
 * Step indicator dots
 */
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <View style={styles.stepIndicator}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i + 1 === currentStep && styles.stepDotActive,
            i + 1 < currentStep && styles.stepDotCompleted,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * Main PlacementGuide component
 */
export default function PlacementGuide({
  step,
  onPlacementConfirmed,
  isCheckingSignal,
  signalProgress,
  signalPassed,
  decibelLevel,
  onStartSignalCheck,
  onRetrySignalCheck,
}: PlacementGuideProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for target
  useEffect(() => {
    if (step === 2) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [step, pulseAnim]);

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Find Your Belly Button";
      case 2:
        return "Move to Lower Right";
      case 3:
        return "Signal Check";
      default:
        return "";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return "Locate your belly button (umbilicus). This is your reference point.";
      case 2:
        return "Move the phone 2-3 inches down and to YOUR right. This is the Lower Right Quadrant (LRQ) where gut sounds are clearest.";
      case 3:
        return "Press the phone firmly against your skin. We'll check for a good signal.";
      default:
        return "";
    }
  };

  return (
    <View style={styles.container}>
      <StepIndicator currentStep={step} totalSteps={3} />

      <Text style={styles.title}>{getStepTitle()}</Text>
      <Text style={styles.description}>{getStepDescription()}</Text>

      {/* Anatomical SVG */}
      <View style={styles.svgContainer}>
        <Svg width={300} height={400} viewBox="0 0 300 400">
          <TorsoOutline />
          <QuadrantOverlay highlightLRQ={step >= 2} />
          <PlacementArrow visible={step === 2} />
        </Svg>

        {/* Animated target overlay for step 2 */}
        {step === 2 && (
          <Animated.View
            style={[
              styles.targetPulse,
              {
                transform: [{ scale: pulseAnim }],
                left: LRQ_CENTER.x - 25 + 25, // Adjust for SVG offset
                top: LRQ_CENTER.y - 25,
              },
            ]}
          />
        )}
      </View>

      {/* Signal Check UI for Step 3 */}
      {step === 3 && (
        <View style={styles.signalCheckContainer}>
          {isCheckingSignal ? (
            <SignalIndicator
              progress={signalProgress}
              decibels={decibelLevel}
              passed={signalPassed}
            />
          ) : signalPassed === false ? (
            <View style={styles.retryContainer}>
              <Text style={styles.retryText}>
                Weak signal detected. Ensure firm skin contact and try again.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetrySignalCheck}
              >
                <Text style={styles.retryButtonText}>Retry Check</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.checkButton}
              onPress={onStartSignalCheck}
            >
              <Text style={styles.checkButtonText}>Start Signal Check</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Navigation buttons */}
      {step < 3 && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onPlacementConfirmed}
        >
          <Text style={styles.nextButtonText}>
            {step === 1 ? "I Found It" : "Phone is Placed"}
          </Text>
        </TouchableOpacity>
      )}

      {step === 3 && signalPassed && (
        <TouchableOpacity
          style={[styles.nextButton, styles.startButton]}
          onPress={onPlacementConfirmed}
        >
          <Text style={styles.nextButtonText}>Start Recording</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  stepIndicator: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: colors.success,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.base * 1.5,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  svgContainer: {
    position: "relative",
    marginBottom: spacing.xl,
  },
  targetPulse: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: colors.accent,
    opacity: 0.5,
  },
  signalCheckContainer: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  signalIndicator: {
    width: "100%",
  },
  signalBarContainer: {
    height: 12,
    backgroundColor: colors.backgroundCard,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  signalBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  signalInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signalStatus: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  signalDecibels: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  checkButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: "center",
  },
  checkButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  retryContainer: {
    alignItems: "center",
  },
  retryText: {
    fontSize: typography.sizes.sm,
    color: colors.warning,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  nextButton: {
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: "center",
    width: "100%",
  },
  startButton: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  nextButtonText: {
    color: colors.accent,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});

export { MIN_DECIBEL_THRESHOLD, SIGNAL_CHECK_DURATION };
