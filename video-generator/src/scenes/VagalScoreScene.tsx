import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

const COLORS = {
  cyan: "#00E5FF",
  neonGreen: "#7CFFB2",
  purple: "#9D4EDD",
  darkNavy: "#020617",
  darkNavy2: "#0B1120",
  light: "#F1F5F9",
  gray: "#94A3B8",
};

export const VagalScoreScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scoreOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const metricsOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [180, 210], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Animated score counter
  const scoreValue = interpolate(frame, [60, 150], [0, 78], {
    extrapolateRight: "clamp",
  });

  // Progress ring animation
  const ringProgress = interpolate(frame, [60, 180], [0, 0.78], {
    extrapolateRight: "clamp",
  });

  // Metrics animation
  const motilityValue = interpolate(frame, [100, 160], [0, 72], {
    extrapolateRight: "clamp",
  });
  const rhythmValue = interpolate(frame, [120, 180], [0, 85], {
    extrapolateRight: "clamp",
  });
  const interventionValue = interpolate(frame, [140, 200], [0, 68], {
    extrapolateRight: "clamp",
  });

  // Ring glow pulse
  const glowPulse = 1 + Math.sin(frame * 0.1) * 0.15;

  // Calculate SVG arc
  const radius = 180;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ringProgress);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Space Grotesk, Inter, sans-serif",
        padding: "60px 100px",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 30% 50%, ${COLORS.neonGreen}10, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 40% at 70% 60%, ${COLORS.cyan}08, transparent 50%)`,
        }}
      />

      {/* Main layout */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 120,
          width: "100%",
          maxWidth: 1700,
        }}
      >
        {/* Left - VRS Score circle */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: scoreOpacity,
          }}
        >
          {/* Outer glow */}
          <div
            style={{
              position: "absolute",
              width: 440 * glowPulse,
              height: 440 * glowPulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.neonGreen}20, transparent 70%)`,
              filter: "blur(30px)",
            }}
          />

          {/* Progress ring SVG */}
          <svg width="420" height="420" style={{ transform: "rotate(-90deg)" }}>
            {/* Background ring */}
            <circle
              cx="210"
              cy="210"
              r={radius}
              fill="none"
              stroke={COLORS.darkNavy2}
              strokeWidth="20"
            />
            {/* Progress ring */}
            <circle
              cx="210"
              cy="210"
              r={radius}
              fill="none"
              stroke="url(#vrsGradient)"
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                filter: `drop-shadow(0 0 15px ${COLORS.neonGreen}80)`,
              }}
            />
            <defs>
              <linearGradient id="vrsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.cyan} />
                <stop offset="50%" stopColor={COLORS.neonGreen} />
                <stop offset="100%" stopColor={COLORS.cyan} />
              </linearGradient>
            </defs>
          </svg>

          {/* Score display */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 120,
                fontWeight: 700,
                color: COLORS.light,
                lineHeight: 1,
                textShadow: `0 0 40px ${COLORS.neonGreen}40`,
              }}
            >
              {Math.round(scoreValue)}
            </div>
            <div
              style={{
                fontSize: 24,
                color: COLORS.gray,
                marginTop: 8,
              }}
            >
              out of 100
            </div>
            <div
              style={{
                fontSize: 20,
                color: COLORS.neonGreen,
                fontWeight: 600,
                marginTop: 16,
                padding: "8px 20px",
                background: `${COLORS.neonGreen}15`,
                borderRadius: 30,
                border: `1px solid ${COLORS.neonGreen}30`,
              }}
            >
              OPTIMAL RANGE
            </div>
          </div>
        </div>

        {/* Right - Content */}
        <div style={{ flex: 1 }}>
          {/* Title */}
          <div style={{ opacity: titleOpacity, marginBottom: 50 }}>
            <div
              style={{
                fontSize: 22,
                color: COLORS.neonGreen,
                fontWeight: 600,
                letterSpacing: "0.15em",
                marginBottom: 16,
              }}
            >
              THE KEY METRIC
            </div>
            <h2
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: COLORS.light,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Vagal Readiness Score
            </h2>
          </div>

          {/* Component metrics */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              opacity: metricsOpacity,
            }}
          >
            {/* Baseline Motility */}
            <div
              style={{
                background: `${COLORS.darkNavy2}80`,
                borderRadius: 16,
                padding: "24px 32px",
                border: `1px solid ${COLORS.cyan}20`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 22, color: COLORS.light, fontWeight: 500 }}>
                  Baseline Motility
                </span>
                <span style={{ fontSize: 26, color: COLORS.cyan, fontWeight: 700 }}>
                  {Math.round(motilityValue)}%
                </span>
              </div>
              <div style={{ height: 10, background: COLORS.darkNavy, borderRadius: 5, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${motilityValue}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.cyan}80)`,
                    borderRadius: 5,
                  }}
                />
              </div>
            </div>

            {/* Rhythmicity */}
            <div
              style={{
                background: `${COLORS.darkNavy2}80`,
                borderRadius: 16,
                padding: "24px 32px",
                border: `1px solid ${COLORS.neonGreen}20`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 22, color: COLORS.light, fontWeight: 500 }}>
                  Rhythmicity
                </span>
                <span style={{ fontSize: 26, color: COLORS.neonGreen, fontWeight: 700 }}>
                  {Math.round(rhythmValue)}%
                </span>
              </div>
              <div style={{ height: 10, background: COLORS.darkNavy, borderRadius: 5, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${rhythmValue}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${COLORS.neonGreen}, ${COLORS.neonGreen}80)`,
                    borderRadius: 5,
                  }}
                />
              </div>
            </div>

            {/* Intervention Response */}
            <div
              style={{
                background: `${COLORS.darkNavy2}80`,
                borderRadius: 16,
                padding: "24px 32px",
                border: `1px solid ${COLORS.purple}20`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 22, color: COLORS.light, fontWeight: 500 }}>
                  4-7-8 Breathing Response
                </span>
                <span style={{ fontSize: 26, color: COLORS.purple, fontWeight: 700 }}>
                  {Math.round(interventionValue)}%
                </span>
              </div>
              <div style={{ height: 10, background: COLORS.darkNavy, borderRadius: 5, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${interventionValue}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.purple}80)`,
                    borderRadius: 5,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              marginTop: 50,
              opacity: taglineOpacity,
              padding: "24px 32px",
              background: `linear-gradient(135deg, ${COLORS.neonGreen}10, transparent)`,
              borderRadius: 16,
              borderLeft: `4px solid ${COLORS.neonGreen}`,
            }}
          >
            <p
              style={{
                fontSize: 26,
                color: COLORS.light,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              We're not just showing you a number—we're showing you your{" "}
              <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>
                body's readiness to heal and adapt
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
