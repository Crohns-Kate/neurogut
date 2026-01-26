/**
 * VideoTutorial - Animated Tutorial Component
 *
 * Shows phone placement on LRQ with animated anatomical illustration.
 * Includes step-by-step visual guidance with pulsing animations.
 *
 * Supports:
 * - Native animated illustration (default, no dependencies)
 * - Video playback (when videoSource provided)
 * - GIF display (when gifSource provided)
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import Svg, { Path, Circle, Line, G, Rect, Defs, RadialGradient, Stop } from "react-native-svg";
import { colors, typography, spacing, radius } from "../styles/theme";

interface VideoTutorialProps {
  /** Video source URI or require() for local asset */
  videoSource?: string | number;
  /** GIF source URI or require() for local asset */
  gifSource?: string | number;
  /** Whether to use GIF instead of video */
  useGif?: boolean;
  /** Poster image to show before video loads */
  posterSource?: string | number;
  /** Title of the tutorial */
  title?: string;
  /** Description text */
  description?: string;
  /** Callback when tutorial is completed/skipped */
  onComplete?: () => void;
  /** Whether to show skip button */
  showSkip?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_WIDTH = Math.min(SCREEN_WIDTH - spacing.lg * 2, 400);
const VIDEO_HEIGHT = VIDEO_WIDTH * 1.2;

// Anatomical positions (scaled for VIDEO_WIDTH)
const SCALE = VIDEO_WIDTH / 300;
const BELLY_BUTTON = { x: 150 * SCALE, y: 100 * SCALE };
const LRQ_CENTER = { x: 110 * SCALE, y: 180 * SCALE }; // User's right = screen left

/**
 * Animated anatomical illustration showing phone placement
 */
function AnimatedTutorial({ onComplete }: { onComplete?: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Auto-advance through steps
  useEffect(() => {
    const stepDurations = [3000, 4000, 4000, 3000];
    let timeout: ReturnType<typeof setTimeout>;

    if (currentStep < 3) {
      timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setCurrentStep(prev => prev + 1);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      }, stepDurations[currentStep]);
    }

    return () => clearTimeout(timeout);
  }, [currentStep, fadeAnim]);

  // Pulse animation for target
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const steps = [
    { title: "Find Belly Button", description: "Start at your belly button as a reference point" },
    { title: "Move to LRQ", description: "Move 2-3 inches down and to YOUR right" },
    { title: "Apply Pressure", description: "Press phone firmly against your skin" },
    { title: "Ready!", description: "Hold still for accurate gut sound recording" },
  ];

  const currentStepData = steps[currentStep];

  // Calculate SVG dimensions
  const svgWidth = VIDEO_WIDTH;
  const svgHeight = VIDEO_HEIGHT;
  const s = SCALE;

  return (
    <View style={styles.animatedContainer}>
      <View style={styles.svgWrapper}>
        <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <Defs>
            <RadialGradient id="lrqGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Background */}
          <Rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#0A0A0D" rx={12 * s} />

          {/* Torso outline */}
          <Path
            d={`M ${80*s} ${30*s} Q ${60*s} ${50*s} ${50*s} ${80*s} L ${45*s} ${150*s} Q ${40*s} ${200*s} ${45*s} ${250*s} L ${55*s} ${300*s} L ${245*s} ${300*s} L ${255*s} ${250*s} Q ${260*s} ${200*s} ${255*s} ${150*s} L ${250*s} ${80*s} Q ${240*s} ${50*s} ${220*s} ${30*s} Z`}
            fill="rgba(20, 20, 25, 0.8)"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={2}
          />

          {/* Ribcage lines */}
          <Path d={`M ${65*s} ${70*s} Q ${150*s} ${65*s} ${235*s} ${70*s}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
          <Path d={`M ${60*s} ${90*s} Q ${150*s} ${85*s} ${240*s} ${90*s}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />

          {/* Center line */}
          <Line x1={150*s} y1={40*s} x2={150*s} y2={280*s} stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="4,8" />

          {/* Pelvic curve */}
          <Path d={`M ${60*s} ${260*s} Q ${150*s} ${290*s} ${240*s} ${260*s}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={2} />

          {/* Belly button */}
          <Circle cx={BELLY_BUTTON.x} cy={BELLY_BUTTON.y} r={10*s} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth={2} />

          {/* LRQ Target */}
          <G>
            <Circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r={50*s} fill="url(#lrqGlow)" />
            <Circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r={35*s} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeDasharray="6,4" opacity={0.7} />
            <Circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r={25*s} fill="none" stroke={colors.accent} strokeWidth={2} opacity={0.9} />
            <Circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r={8*s} fill={colors.accent} opacity={0.9} />
            <Line x1={LRQ_CENTER.x - 18*s} y1={LRQ_CENTER.y} x2={LRQ_CENTER.x - 10*s} y2={LRQ_CENTER.y} stroke={colors.accent} strokeWidth={2} opacity={0.6} />
            <Line x1={LRQ_CENTER.x + 10*s} y1={LRQ_CENTER.y} x2={LRQ_CENTER.x + 18*s} y2={LRQ_CENTER.y} stroke={colors.accent} strokeWidth={2} opacity={0.6} />
            <Line x1={LRQ_CENTER.x} y1={LRQ_CENTER.y - 18*s} x2={LRQ_CENTER.x} y2={LRQ_CENTER.y - 10*s} stroke={colors.accent} strokeWidth={2} opacity={0.6} />
            <Line x1={LRQ_CENTER.x} y1={LRQ_CENTER.y + 10*s} x2={LRQ_CENTER.x} y2={LRQ_CENTER.y + 18*s} stroke={colors.accent} strokeWidth={2} opacity={0.6} />
          </G>

          {/* Arrow from belly button to LRQ */}
          {currentStep >= 1 && (
            <Path
              d={`M ${BELLY_BUTTON.x} ${BELLY_BUTTON.y + 12*s} Q ${130*s} ${140*s} ${LRQ_CENTER.x + 20*s} ${LRQ_CENTER.y - 15*s}`}
              fill="none"
              stroke={colors.accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}

          {/* Phone icon */}
          {currentStep >= 2 && (
            <G>
              <Rect x={LRQ_CENTER.x - 20*s} y={LRQ_CENTER.y - 35*s} width={40*s} height={70*s} rx={6*s} fill="#2a2a2f" stroke="#555" strokeWidth={1.5} />
              <Rect x={LRQ_CENTER.x - 17*s} y={LRQ_CENTER.y - 28*s} width={34*s} height={56*s} rx={4*s} fill="#1a1a1f" />
              <Circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r={10*s} fill="none" stroke={colors.accent} strokeWidth={1.5} opacity={0.5} />
              <Circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r={18*s} fill="none" stroke={colors.accent} strokeWidth={1} opacity={0.3} />
            </G>
          )}
        </Svg>

        {/* Pulsing overlay ring */}
        {currentStep < 2 && (
          <Animated.View
            style={[
              styles.pulsingRing,
              {
                left: LRQ_CENTER.x - 40*s,
                top: LRQ_CENTER.y - 40*s,
                width: 80*s,
                height: 80*s,
                borderRadius: 40*s,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.stepDot,
              index === currentStep && styles.stepDotActive,
              index < currentStep && styles.stepDotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Step text */}
      <Animated.View style={[styles.stepTextContainer, { opacity: fadeAnim }]}>
        <Text style={styles.stepTitle}>{currentStepData.title}</Text>
        <Text style={styles.stepDescription}>{currentStepData.description}</Text>
      </Animated.View>

      {/* Labels */}
      <View style={[styles.label, { top: BELLY_BUTTON.y - 30*s, left: BELLY_BUTTON.x - 40*s }]}>
        <Text style={styles.labelText}>Belly Button</Text>
      </View>
      <View style={[styles.label, { top: LRQ_CENTER.y + 50*s, left: LRQ_CENTER.x - 20*s }]}>
        <Text style={[styles.labelText, { color: colors.accent }]}>LRQ</Text>
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>Loading tutorial...</Text>
    </View>
  );
}

export default function VideoTutorial({
  videoSource,
  gifSource,
  useGif = false,
  posterSource,
  title = "How to Position Your Phone",
  description = "Learn the correct Lower Right Quadrant (LRQ) placement for optimal gut sound recording.",
  onComplete,
  showSkip = true,
}: VideoTutorialProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const videoRef = useRef<Video>(null);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      if (status.didJustFinish) {
        setHasFinished(true);
        setIsPlaying(false);
      }
    }
  };

  const handlePlay = async () => {
    setIsPlaying(true);
    setIsLoading(true);
    if (videoRef.current) {
      await videoRef.current.playAsync();
    }
  };

  const handleReplay = async () => {
    setHasFinished(false);
    if (videoRef.current) {
      await videoRef.current.replayAsync();
    }
    setIsPlaying(true);
  };

  const renderContent = () => {
    if (useGif && gifSource) {
      return (
        <View style={styles.mediaContainer}>
          <Image
            source={typeof gifSource === "string" ? { uri: gifSource } : gifSource}
            style={styles.gifImage}
            resizeMode="contain"
          />
        </View>
      );
    }

    if (videoSource) {
      return (
        <View style={styles.mediaContainer}>
          {isLoading && <LoadingState />}
          <Video
            ref={videoRef}
            source={typeof videoSource === "string" ? { uri: videoSource } : videoSource}
            style={[styles.video, isLoading && styles.hidden]}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            posterSource={posterSource ? (typeof posterSource === "string" ? { uri: posterSource } : posterSource) : undefined}
            posterStyle={styles.poster}
          />
          {!isPlaying && !hasFinished && (
            <TouchableOpacity style={styles.videoOverlay} onPress={handlePlay}>
              <View style={styles.playCircle}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </TouchableOpacity>
          )}
          {hasFinished && (
            <View style={styles.finishedOverlay}>
              <TouchableOpacity style={styles.replayButton} onPress={handleReplay}>
                <Text style={styles.replayIcon}>↻</Text>
                <Text style={styles.replayText}>Replay</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return <AnimatedTutorial onComplete={onComplete} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {renderContent()}

      <View style={styles.keyPoints}>
        <View style={styles.keyPoint}>
          <Text style={styles.keyPointNumber}>1</Text>
          <Text style={styles.keyPointText}>Start at your belly button</Text>
        </View>
        <View style={styles.keyPoint}>
          <Text style={styles.keyPointNumber}>2</Text>
          <Text style={styles.keyPointText}>Move 2-3 inches down and to YOUR right</Text>
        </View>
        <View style={styles.keyPoint}>
          <Text style={styles.keyPointNumber}>3</Text>
          <Text style={styles.keyPointText}>Press phone firmly against skin</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {showSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.continueButton, !showSkip && styles.continueButtonFull]}
          onPress={onComplete}
        >
          <Text style={styles.continueButtonText}>I Understand</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.sm * 1.5,
  },
  animatedContainer: {
    width: VIDEO_WIDTH,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  svgWrapper: {
    position: "relative",
  },
  pulsingRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.accent,
    opacity: 0.5,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    width: 20,
    backgroundColor: colors.accent,
  },
  stepDotCompleted: {
    backgroundColor: colors.success,
  },
  stepTextContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  stepTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  label: {
    position: "absolute",
  },
  labelText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  mediaContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_WIDTH * 0.75,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    position: "relative",
    alignSelf: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  hidden: {
    opacity: 0,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  gifImage: {
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    fontSize: 24,
    color: colors.background,
    marginLeft: 4,
  },
  finishedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  replayIcon: {
    fontSize: 18,
    color: colors.accent,
    marginRight: spacing.sm,
  },
  replayText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  keyPoints: {
    marginBottom: spacing.lg,
  },
  keyPoint: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  keyPointNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentDim,
    color: colors.accent,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textAlign: "center",
    lineHeight: 22,
    marginRight: spacing.sm,
  },
  keyPointText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.base,
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  continueButton: {
    flex: 2,
    paddingVertical: spacing.base,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  continueButtonFull: {
    flex: 1,
  },
  continueButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
