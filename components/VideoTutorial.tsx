/**
 * VideoTutorial - Video/GIF Tutorial Component
 *
 * Placeholder for AI-generated Video Tutorial on onboarding.
 * Supports lightweight video player or high-quality GIF showing
 * 'Belly Button to LRQ' movement demonstration.
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
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
const VIDEO_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const VIDEO_HEIGHT = VIDEO_WIDTH * (9 / 16); // 16:9 aspect ratio

/**
 * Placeholder content when no video/gif is provided
 */
function PlaceholderContent({ onPlay }: { onPlay: () => void }) {
  return (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderAnimation}>
        {/* Animated illustration showing belly button to LRQ movement */}
        <View style={styles.torsoOutline}>
          {/* Belly button marker */}
          <View style={styles.bellyButton}>
            <Text style={styles.markerLabel}>1</Text>
          </View>

          {/* Arrow */}
          <View style={styles.arrowContainer}>
            <Text style={styles.arrowText}>→</Text>
          </View>

          {/* LRQ marker */}
          <View style={styles.lrqMarker}>
            <Text style={styles.markerLabel}>2</Text>
          </View>
        </View>
      </View>

      <Text style={styles.placeholderTitle}>Phone Placement Guide</Text>
      <Text style={styles.placeholderText}>
        Move from belly button down and to your right
      </Text>

      <TouchableOpacity style={styles.playButton} onPress={onPlay}>
        <Text style={styles.playIcon}>▶</Text>
        <Text style={styles.playText}>Watch Tutorial</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Loading state while video/gif loads
 */
function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>Loading tutorial...</Text>
    </View>
  );
}

/**
 * Main VideoTutorial component
 */
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
    // No source provided - show placeholder
    if (!videoSource && !gifSource) {
      return <PlaceholderContent onPlay={() => onComplete?.()} />;
    }

    // GIF mode
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

    // Video mode
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

    return <PlaceholderContent onPlay={() => onComplete?.()} />;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {/* Video/GIF content */}
      {renderContent()}

      {/* Key points */}
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

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        {showSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
            <Text style={styles.skipButtonText}>Skip Tutorial</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.continueButton, !showSkip && styles.continueButtonFull]}
          onPress={onComplete}
        >
          <Text style={styles.continueButtonText}>
            {hasFinished ? "Continue" : "I Understand"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  description: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: typography.sizes.base * 1.5,
  },
  mediaContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.lg,
    position: "relative",
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    fontSize: 32,
    color: colors.background,
    marginLeft: 4, // Visual centering for play icon
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
    fontSize: 20,
    color: colors.accent,
    marginRight: spacing.sm,
  },
  replayText: {
    fontSize: typography.sizes.base,
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
  placeholderContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT + 60,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  placeholderAnimation: {
    width: 200,
    height: 120,
    marginBottom: spacing.md,
  },
  torsoOutline: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    position: "relative",
  },
  bellyButton: {
    position: "absolute",
    left: "40%",
    top: "30%",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentDim,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowContainer: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
  arrowText: {
    fontSize: 24,
    color: colors.accent,
  },
  lrqMarker: {
    position: "absolute",
    right: "20%",
    bottom: "20%",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.success + "30",
    borderWidth: 2,
    borderColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  markerLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  placeholderTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  placeholderText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  playText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.background,
    marginLeft: spacing.sm,
  },
  keyPoints: {
    marginBottom: spacing.xl,
  },
  keyPoint: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  keyPointNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    textAlign: "center",
    lineHeight: 24,
    marginRight: spacing.md,
  },
  keyPointText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: "auto",
    paddingBottom: spacing.xl,
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
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  continueButton: {
    flex: 1,
    paddingVertical: spacing.base,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  continueButtonFull: {
    flex: 2,
  },
  continueButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
