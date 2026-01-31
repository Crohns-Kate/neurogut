import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

// Brand colors from neurogut.vercel.app
const COLORS = {
  cyan: "#00E5FF",
  neonGreen: "#7CFFB2",
  purple: "#9D4EDD",
  darkNavy: "#020617",
  darkNavy2: "#0B1120",
  light: "#F1F5F9",
};

export const HeroIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const titleOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleY = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 60 },
    from: 60,
    to: 0,
  });

  const taglineOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Animated gradient glow
  const glowIntensity = interpolate(frame, [0, 150], [0.3, 0.8], {
    extrapolateRight: "clamp",
  });

  // Pulse animation for the logo
  const pulseScale = 1 + Math.sin(frame * 0.1) * 0.02;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Space Grotesk, Inter, sans-serif",
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${COLORS.cyan}${Math.round(glowIntensity * 25).toString(16).padStart(2, '0')}, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 40% at 30% 70%, ${COLORS.purple}${Math.round(glowIntensity * 20).toString(16).padStart(2, '0')}, transparent 60%)`,
        }}
      />

      {/* Decorative lines */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: interpolate(frame, [0, 100], [0, 200]),
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.cyan}40, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "10%",
          width: interpolate(frame, [30, 130], [0, 180]),
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.neonGreen}40, transparent)`,
        }}
      />

      {/* Main Logo - Sound wave icon */}
      <div
        style={{
          transform: `scale(${logoScale * pulseScale})`,
          marginBottom: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 60px ${COLORS.cyan}60, 0 0 120px ${COLORS.cyan}30`,
          }}
        >
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"
              stroke={COLORS.darkNavy}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Brand Name */}
      <h1
        style={{
          fontSize: 110,
          fontWeight: 700,
          color: COLORS.light,
          letterSpacing: "-0.03em",
          margin: 0,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textShadow: `0 0 40px ${COLORS.cyan}40`,
        }}
      >
        NeuroGut
      </h1>

      {/* Acoustics TM */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 500,
          color: COLORS.cyan,
          letterSpacing: "0.3em",
          marginTop: 8,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        ACOUSTICS™
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: 38,
          color: COLORS.light,
          marginTop: 50,
          opacity: taglineOpacity,
          fontWeight: 400,
          maxWidth: 1200,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        The World's First{" "}
        <span style={{ color: COLORS.cyan, fontWeight: 600 }}>Clinical Mirror</span>{" "}
        for the Autonomic Nervous System
      </p>

      {/* Location badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 60,
          opacity: subtitleOpacity,
          padding: "16px 32px",
          borderRadius: 50,
          background: `${COLORS.darkNavy2}80`,
          border: `1px solid ${COLORS.cyan}30`,
        }}
      >
        <span style={{ fontSize: 28 }}>🇦🇺</span>
        <span style={{ fontSize: 24, color: COLORS.light, fontWeight: 500 }}>
          Built on the Gold Coast, Australia
        </span>
      </div>
    </AbsoluteFill>
  );
};
