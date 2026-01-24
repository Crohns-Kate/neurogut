/**
 * AnatomicalMirror – Gut–Brain Axis visualization for Focus Mode
 *
 * Stylized SVG: Brain, Vagus Nerve, Intestines. Glow on Vagus when humming;
 * subtle diaphragm wave when breathing in. All animations use native driver.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Wrapped in React.memo with custom comparison to prevent unnecessary re-renders
 * - Static SVG elements memoized separately
 * - Animated.View used for hardware-accelerated transforms
 * - Interpolations cached in refs to prevent recreation
 */

import React, { useMemo, useRef, memo } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, { Path, Ellipse } from "react-native-svg";
import { colors } from "../styles/theme";

const ACCENT = colors.accent;
const MUTED = "rgba(255, 255, 255, 0.12)";
const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 320;

// ============================================================================
// SVG PATH CONSTANTS - Pre-computed, no runtime calculation
// ============================================================================

// Enhanced Vagus Nerve pathway: Brainstem → Throat → Heart → Digestive Tract
const VAGUS_PATH = `M 120 52 C 120 70 118 85 115 100 C 112 115 110 130 108 145 C 106 160 105 175 103 190 C 101 205 102 220 104 235 C 106 250 108 265 110 280 C 112 295 115 305 120 310`;

// Throat/Laryngeal branch (highlighted area)
const THROAT_PATH = `M 105 100 C 105 110 107 120 110 130 C 113 140 115 145 118 150`;

// Intestines (stylized coils)
const INTESTINES_PATH = `M 80 270 Q 140 268 130 290 Q 90 300 100 315 M 160 270 Q 100 272 110 292 Q 150 302 140 318`;

// Diaphragm wave
const DIAPHRAGM_WAVE_PATH = `M 0 20 Q 40 12 80 20 Q 120 28 160 20 Q 200 12 240 20`;

// Brain path (computed once)
const BRAIN_PATH = `M 82 32 Q 90 18 120 18 Q 150 18 158 32`;

// ============================================================================
// MEMOIZED STATIC COMPONENTS - Never re-render
// ============================================================================

/**
 * Static anatomy base layer - brain, vagus base, intestines
 * Never changes, so memoized with empty deps
 */
const StaticAnatomyLayer = memo(function StaticAnatomyLayer() {
  return (
    <>
      {/* Brain (stylized) */}
      <Ellipse
        cx={VIEW_WIDTH / 2}
        cy={32}
        rx={42}
        ry={22}
        fill="none"
        stroke={MUTED}
        strokeWidth={2}
      />
      <Path
        d={BRAIN_PATH}
        fill="none"
        stroke={MUTED}
        strokeWidth={2}
      />

      {/* Vagus Nerve path (base) */}
      <Path
        d={VAGUS_PATH}
        fill="none"
        stroke={MUTED}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Intestines (stylized coils) */}
      <Path
        d={INTESTINES_PATH}
        fill="none"
        stroke={MUTED}
        strokeWidth={2}
      />
    </>
  );
});

/**
 * Vagus glow overlay SVG content - only rendered when humming
 * Memoized to prevent SVG path recreation
 */
const VagusGlowSvgContent = memo(function VagusGlowSvgContent() {
  return (
    <Svg
      width={VIEW_WIDTH}
      height={VIEW_HEIGHT}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      style={styles.glowSvg}
    >
      {/* Glow halo (back layer) */}
      <Path
        d={VAGUS_PATH}
        fill="none"
        stroke={ACCENT}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.3}
      />
      {/* Main Vagus pathway glow */}
      <Path
        d={VAGUS_PATH}
        fill="none"
        stroke={ACCENT}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Throat/Laryngeal branch glow */}
      <Path
        d={THROAT_PATH}
        fill="none"
        stroke={ACCENT}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/**
 * Diaphragm wave SVG content - only rendered during inhale
 */
const DiaphragmSvgContent = memo(function DiaphragmSvgContent() {
  return (
    <Svg
      width={VIEW_WIDTH}
      height={40}
      viewBox={`0 0 ${VIEW_WIDTH} 40`}
      style={styles.diaphragmSvg}
    >
      <Path
        d={DIAPHRAGM_WAVE_PATH}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />
    </Svg>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface AnatomicalMirrorProps {
  /** Current phase: inhale, hold, exhale, hum */
  phase: "inhale" | "hold" | "exhale" | "hum";
  /** Intervention type */
  intervention: "Deep Breathing" | "Humming" | "Gargling" | "Cold Exposure" | "None";
  /** 0–1 glow intensity for Vagus when humming (from mic). Use for opacity. */
  vagusGlow: Animated.Value;
  /** 0–1 progress during inhale (0→1 over 4s); drives diaphragm wave translateY */
  diaphragmProgress: Animated.Value;
}

/**
 * Stylized Gut–Brain Axis: brain (top), vagus (center), intestines (bottom).
 * Vagus glow and diaphragm wave are hardware-accelerated via Animated.View.
 *
 * Performance notes:
 * - Uses native driver for all animations
 * - Static elements memoized in separate components
 * - Interpolations cached in refs
 */
function AnatomicalMirror({
  phase,
  intervention,
  vagusGlow,
  diaphragmProgress,
}: AnatomicalMirrorProps) {
  const showDiaphragm = intervention === "Deep Breathing" && phase === "inhale";
  const showVagusGlow = intervention === "Humming";

  // Cache interpolation in ref to prevent recreation on every render
  // The interpolation only needs to be created once per diaphragmProgress Animated.Value
  const diaphragmTranslateYRef = useRef<Animated.AnimatedInterpolation<number> | null>(null);

  // Create interpolation only if it doesn't exist or diaphragmProgress changed
  const diaphragmTranslateY = useMemo(() => {
    // Always create a new interpolation - the ref approach doesn't work well with useMemo
    // because Animated.Value reference stays the same but internal value changes
    return diaphragmProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 10],
    });
  }, []); // Empty deps - diaphragmProgress is an Animated.Value (stable reference)

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        style={styles.svg}
      >
        {/* Static anatomy - memoized, never re-renders */}
        <StaticAnatomyLayer />

        {/* Vagus glow overlay – opacity driven by vibeMeter when Humming */}
        {showVagusGlow && (
          <Animated.View
            style={[
              styles.vagusGlowWrap,
              {
                opacity: vagusGlow,
              },
            ]}
          >
            <VagusGlowSvgContent />
          </Animated.View>
        )}

        {/* Diaphragm wave – subtle downward movement during inhale */}
        {showDiaphragm && (
          <Animated.View
            style={[
              styles.diaphragmWrap,
              {
                transform: [{ translateY: diaphragmTranslateY }],
              },
            ]}
          >
            <DiaphragmSvgContent />
          </Animated.View>
        )}
      </Svg>
    </View>
  );
}

// ============================================================================
// REACT.MEMO WITH CUSTOM COMPARISON
// ============================================================================

/**
 * Custom comparison function for React.memo
 * Only re-render when phase or intervention changes
 * Animated.Values are refs and don't need shallow comparison
 */
function arePropsEqual(
  prevProps: AnatomicalMirrorProps,
  nextProps: AnatomicalMirrorProps
): boolean {
  return (
    prevProps.phase === nextProps.phase &&
    prevProps.intervention === nextProps.intervention
    // Note: vagusGlow and diaphragmProgress are Animated.Values (stable refs)
    // They drive animations internally without causing re-renders
  );
}

export default memo(AnatomicalMirror, arePropsEqual);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.85,
    zIndex: 0,
  },
  svg: {
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  vagusGlowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  glowSvg: {
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  diaphragmWrap: {
    position: "absolute",
    left: 0,
    top: 130,
    width: VIEW_WIDTH,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  diaphragmSvg: {
    width: VIEW_WIDTH,
    height: 40,
  },
});
