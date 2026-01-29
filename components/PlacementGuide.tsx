/**
 * PlacementGuide - Anatomical Guide for Phone Placement
 *
 * Multi-step UI showing Lower Right Quadrant (LRQ) placement.
 * Non-mirrored view with clear anatomical landmarks.
 * Includes 5-second signal check before recording starts.
 */

import React, { useState, useEffect, useRef, memo } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Platform } from "react-native";
import Svg, { Path, Circle, Rect, Line, G, Ellipse } from "react-native-svg";
import { colors, typography, spacing, radius } from "../styles/theme";
import VideoTutorial from "./VideoTutorial";

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
  /** Callback to close/dismiss the guide */
  onClose?: () => void;
  /** Ralph Loop: Whether calibration is completed (from session context) */
  isCalibrated?: boolean;
}

// Anatomical landmarks for LRQ placement
// CORRECT ORIENTATION: User's right side is on the LEFT of the screen
const LRQ_CENTER = { x: 120, y: 240 }; // Ileocecal valve - Lower Right Quadrant (user's right = screen left)
const BELLY_BUTTON = { x: 150, y: 160 }; // Umbilicus (center)
const HIP_BONE_RIGHT = { x: 100, y: 260 }; // Right hip bone landmark

// Minimum decibel threshold for valid skin contact
const MIN_DECIBEL_THRESHOLD = -50; // dB (relative to max)
const SIGNAL_CHECK_DURATION = 5000; // 5 seconds

/**
 * Professional dark-mode anatomical mirror - realistic torso silhouette
 * NON-MIRRORED VIEW: User's right side appears on LEFT of screen
 */
const AnatomicalMirror = memo(function AnatomicalMirror() {
  return (
    <G>
      {/* Dark background for professional look */}
      <Rect
        x={0}
        y={0}
        width={300}
        height={400}
        fill="#0A0A0D"
        rx={8}
      />

      {/* Realistic torso silhouette - professional anatomical view */}
      {/* Main torso outline with subtle gradients */}
      <Path
        d="M 90 40 
           Q 70 60 60 90 
           L 55 140 
           Q 50 180 55 220 
           L 60 280 
           Q 65 320 75 360 
           L 100 380 
           L 200 380 
           L 225 360 
           Q 235 320 240 280 
           L 245 220 
           Q 250 180 245 140 
           L 240 90 
           Q 230 60 210 40 
           Z"
        fill="rgba(20, 20, 25, 0.8)"
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth={2.5}
      />

      {/* Subtle anatomical shading for depth */}
      <Path
        d="M 90 40 
           Q 70 60 60 90 
           L 55 140 
           Q 50 180 55 220 
           L 60 280 
           Q 65 320 75 360 
           L 100 380 
           L 150 380 
           L 150 360 
           Q 145 320 140 280 
           L 135 220 
           Q 130 180 135 140 
           L 140 90 
           Q 150 60 170 40 
           Z"
        fill="rgba(15, 15, 20, 0.6)"
        opacity={0.5}
      />

      {/* Ribcage anatomical lines */}
      <Path
        d="M 75 100 Q 150 95 225 100"
        fill="none"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M 70 120 Q 150 115 230 120"
        fill="none"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M 65 140 Q 150 135 235 140"
        fill="none"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Pelvic bone structure hint */}
      <Path
        d="M 70 300 Q 150 340 230 300"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Center line (Linea Alba) - subtle */}
      <Line
        x1={150}
        y1={50}
        x2={150}
        y2={350}
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth={1}
        strokeDasharray="3,6"
      />

      {/* Right hip bone landmark (user's right = screen left) */}
      <Circle
        cx={HIP_BONE_RIGHT.x}
        cy={HIP_BONE_RIGHT.y}
        r={12}
        fill="none"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth={1.5}
        strokeDasharray="2,4"
      />
      <Circle
        cx={HIP_BONE_RIGHT.x}
        cy={HIP_BONE_RIGHT.y}
        r={4}
        fill="rgba(255, 255, 255, 0.2)"
      />
    </G>
  );
});

/**
 * Static target ring SVG for ileocecal valve (pulsing handled by overlay)
 */
const TargetRingSVG = memo(function TargetRingSVG() {
  return (
    <G>
      {/* Outer ring (will pulse via overlay) */}
      <Circle
        cx={LRQ_CENTER.x}
        cy={LRQ_CENTER.y}
        r={30}
        fill="none"
        stroke={colors.accent}
        strokeWidth={2.5}
        strokeDasharray="4,4"
        opacity={0.7}
      />
      {/* Inner solid ring */}
      <Circle
        cx={LRQ_CENTER.x}
        cy={LRQ_CENTER.y}
        r={20}
        fill="none"
        stroke={colors.accent}
        strokeWidth={2}
        opacity={0.9}
      />
      {/* Center target point */}
      <Circle
        cx={LRQ_CENTER.x}
        cy={LRQ_CENTER.y}
        r={6}
        fill={colors.accent}
        opacity={0.9}
      />
      {/* Crosshair for precision */}
      <Line
        x1={LRQ_CENTER.x - 15}
        y1={LRQ_CENTER.y}
        x2={LRQ_CENTER.x - 8}
        y2={LRQ_CENTER.y}
        stroke={colors.accent}
        strokeWidth={1.5}
        opacity={0.6}
      />
      <Line
        x1={LRQ_CENTER.x + 8}
        y1={LRQ_CENTER.y}
        x2={LRQ_CENTER.x + 15}
        y2={LRQ_CENTER.y}
        stroke={colors.accent}
        strokeWidth={1.5}
        opacity={0.6}
      />
      <Line
        x1={LRQ_CENTER.x}
        y1={LRQ_CENTER.y - 15}
        x2={LRQ_CENTER.x}
        y2={LRQ_CENTER.y - 8}
        stroke={colors.accent}
        strokeWidth={1.5}
        opacity={0.6}
      />
      <Line
        x1={LRQ_CENTER.x}
        y1={LRQ_CENTER.y + 8}
        x2={LRQ_CENTER.x}
        y2={LRQ_CENTER.y + 15}
        stroke={colors.accent}
        strokeWidth={1.5}
        opacity={0.6}
      />
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
  onClose,
  isCalibrated,
}: PlacementGuideProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for teal target ring (Step 1: Locate LRQ)
  useEffect(() => {
    if (step === 1) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [step, pulseAnim]);

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Locate LRQ";
      case 2:
        return "Apply Pressure";
      case 3:
        return "Silence Check";
      default:
        return "";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return "Find your belly button, then move 2-3 inches down and to YOUR right. This is the Lower Right Quadrant (LRQ) where gut sounds are clearest.";
      case 2:
        return "Hold the phone firmly against your skin with steady, gentle pressure. The microphone should make full contact.";
      case 3:
        return "We'll check your environment for background noise. Stay still and quiet for 5 seconds.";
      default:
        return "";
    }
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with close button */}
      {onClose && (
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <StepIndicator currentStep={step} totalSteps={3} />

      <Text style={styles.title}>{getStepTitle()}</Text>
      <Text style={styles.description}>{getStepDescription()}</Text>

      {/* Step 1: Locate LRQ - Professional Anatomical Mirror */}
      {step === 1 && (
        <View style={styles.svgContainer}>
          {/* YOUR RIGHT SIDE label - Left edge (user's right = screen left) */}
          <View style={styles.sideLabel}>
            <View style={[styles.sideLabelBox, styles.sideLabelRight]}>
              <Text style={styles.sideLabelArrow}>→</Text>
              <Text style={styles.sideLabelText}>YOUR{'\n'}RIGHT</Text>
            </View>
          </View>

          {/* YOUR LEFT SIDE label - Right edge */}
          <View style={styles.sideLabelLeft}>
            <View style={[styles.sideLabelBox, styles.sideLabelLeftBox]}>
              <Text style={styles.sideLabelText}>YOUR{'\n'}LEFT</Text>
              <Text style={styles.sideLabelArrow}>←</Text>
            </View>
          </View>

          <Svg width={300} height={400} viewBox="0 0 300 400">
            <AnatomicalMirror />
            <TargetRingSVG />
          </Svg>

          {/* LRQ Target label */}
          <View style={styles.lrqLabel}>
            <Text style={styles.lrqLabelText}>LRQ Target</Text>
            <Text style={styles.lrqLabelSubtext}>(Your Right Side)</Text>
          </View>

          {/* Pulsing teal target ring overlay */}
          <Animated.View
            style={[
              styles.targetRingOverlay,
              {
                left: LRQ_CENTER.x - 30,
                top: LRQ_CENTER.y - 30,
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.6, 1],
                }),
              },
            ]}
          />
        </View>
      )}

      {/* Step 2: Apply Pressure - Video Tutorial */}
      {step === 2 && (
        <View style={styles.pressureContainer}>
          <VideoTutorial
            title="How to Hold Your Phone"
            description="Apply firm, steady pressure with the microphone against your skin. Avoid gaps or movement."
            onComplete={onPlacementConfirmed}
            showSkip={false}
          />
          
          <View style={styles.pressureTips}>
            <Text style={styles.tipsTitle}>Pressure Tips:</Text>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Use your palm to press the phone flat against your abdomen</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Maintain steady pressure—not too light, not too hard</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Keep the phone still during the entire recording</Text>
            </View>
          </View>
        </View>
      )}

      {/* Step 3: Silence Check - Environment Noise Calibration */}
      {step === 3 && (
        <View style={styles.silenceCheckContainer}>
          <View style={styles.silenceInfo}>
            <Text style={styles.silenceTitle}>Environment Noise Calibration</Text>
            <Text style={styles.silenceDescription}>
              We'll measure background noise to ensure accurate gut sound detection. Stay still and quiet.
            </Text>
          </View>

          {isCheckingSignal ? (
            <SignalIndicator
              progress={signalProgress}
              decibels={decibelLevel}
              passed={signalPassed}
            />
          ) : signalPassed === true ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Silence Check Passed!</Text>
              <Text style={styles.successText}>
                Your environment is quiet enough for accurate gut sound recording.
              </Text>
            </View>
          ) : signalPassed === false ? (
            <View style={styles.retryContainer}>
              <Text style={styles.retryText}>
                Too much background noise detected. Move to a quieter location and try again.
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
              <Text style={styles.checkButtonText}>Start Silence Check</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* VRS Complexity Meter - Only shows on step 3 (Silence Check) */}
      {step === 3 && (
        <View style={styles.vrsComplexityContainer}>
          <Text style={styles.vrsComplexityTitle}>Vagal Readiness Score Analysis</Text>
          <Text style={styles.vrsComplexitySubtitle}>Multi-layered complexity meter</Text>

          <View style={styles.complexityMeter}>
            {/* Baseline Component */}
            <View style={styles.complexityBar}>
              <View style={styles.complexityBarLabel}>
                <Text style={styles.complexityLabel}>Baseline Motility</Text>
                <Text style={styles.complexityValue}>40%</Text>
              </View>
              <View style={styles.complexityBarTrack}>
                <View style={[styles.complexityBarFill, { width: '40%', backgroundColor: colors.accent }]} />
              </View>
            </View>

            {/* Rhythmicity Component */}
            <View style={styles.complexityBar}>
              <View style={styles.complexityBarLabel}>
                <Text style={styles.complexityLabel}>Rhythmicity Index</Text>
                <Text style={styles.complexityValue}>30%</Text>
              </View>
              <View style={styles.complexityBarTrack}>
                <View style={[styles.complexityBarFill, { width: '30%', backgroundColor: colors.info }]} />
              </View>
            </View>

            {/* Intervention Delta Component */}
            <View style={styles.complexityBar}>
              <View style={styles.complexityBarLabel}>
                <Text style={styles.complexityLabel}>4-7-8 Intervention Delta</Text>
                <Text style={styles.complexityValue}>30%</Text>
              </View>
              <View style={styles.complexityBarTrack}>
                <View style={[styles.complexityBarFill, { width: '30%', backgroundColor: colors.success }]} />
              </View>
            </View>
          </View>

          <Text style={styles.complexityNote}>
            The VRS combines three layers of analysis to quantify your gut-brain connection and autonomic nervous system health.
          </Text>
        </View>
      )}

      {/* Navigation buttons */}
      {/* Step 1 has its own button, Step 2 uses VideoTutorial's "I Understand" button */}
      {step === 1 && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onPlacementConfirmed}
        >
          <Text style={styles.nextButtonText}>I Found LRQ</Text>
        </TouchableOpacity>
      )}

      {step === 3 && (signalPassed === true || isCalibrated) && (
        <TouchableOpacity
          style={[styles.nextButton, styles.startButton]}
          onPress={onPlacementConfirmed}
        >
          <Text style={[styles.nextButtonText, styles.startButtonText]}>
            {signalPassed ? "Start Recording" : "Continue"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
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
    fontFamily: Platform.select({ ios: "Space Grotesk", android: "sans-serif" }),
    letterSpacing: -0.5,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.md * 1.4,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    fontFamily: Platform.select({ ios: "Space Grotesk", android: "sans-serif" }),
    fontWeight: typography.weights.medium,
    letterSpacing: 0.2,
  },
  svgContainer: {
    position: "relative",
    marginBottom: spacing.xl,
  },
  sideLabel: {
    position: "absolute",
    left: -60,
    top: 180,
    zIndex: 10,
  },
  sideLabelLeft: {
    position: "absolute",
    right: -60,
    top: 180,
    zIndex: 10,
  },
  sideLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    gap: 4,
  },
  sideLabelRight: {
    backgroundColor: colors.accent + "30",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  sideLabelLeftBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  sideLabelText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 12,
  },
  sideLabelArrow: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  lrqLabel: {
    position: "absolute",
    left: LRQ_CENTER.x - 40,
    top: LRQ_CENTER.y + 45,
    alignItems: "center",
  },
  lrqLabelText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  lrqLabelSubtext: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
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
  targetRingOverlay: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: colors.accent,
    borderStyle: "dashed",
    backgroundColor: "transparent",
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
  startButtonText: {
    color: colors.background,
  },
  landmarksInfo: {
    marginTop: spacing.lg,
    width: "100%",
    gap: spacing.sm,
  },
  landmarkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  landmarkDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  landmarkText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  pressureContainer: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  pressureTips: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  tipsTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  tipBullet: {
    fontSize: typography.sizes.base,
    color: colors.accent,
    fontWeight: typography.weights.bold,
  },
  tipText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.4,
  },
  silenceCheckContainer: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  silenceInfo: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
  },
  silenceTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  silenceDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.base * 1.4,
  },
  successContainer: {
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.success + "15",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success + "40",
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  successIconText: {
    fontSize: 32,
    color: colors.background,
    fontWeight: typography.weights.bold,
  },
  successTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.sm * 1.4,
  },
  vrsComplexityContainer: {
    width: "100%",
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + "30",
  },
  vrsComplexityTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  vrsComplexitySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  complexityMeter: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  complexityBar: {
    gap: spacing.xs,
  },
  complexityBarLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complexityLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  complexityValue: {
    fontSize: typography.sizes.sm,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  complexityBarTrack: {
    height: 8,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  complexityBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  complexityNote: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: "italic",
    lineHeight: typography.sizes.sm * 1.4,
    marginTop: spacing.sm,
  },
});

export { MIN_DECIBEL_THRESHOLD, SIGNAL_CHECK_DURATION };
