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
  grey: "#94A3B8",
};

export const WalkthroughIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 0.3,
    to: 1,
  });

  const phoneRotate = interpolate(frame, [0, 60], [15, 0], {
    extrapolateRight: "clamp",
  });

  const titleOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Floating particles
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    x: 10 + (i * 47) % 80,
    y: ((i * 31 + frame * 0.3) % 100),
    size: 3 + (i % 4),
    opacity: 0.1 + (i % 5) * 0.1,
  }));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        padding: 80,
        gap: 100,
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 30% 50%, ${COLORS.cyan}15, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 70% 60%, ${COLORS.purple}10, transparent 60%)`,
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: i % 2 === 0 ? COLORS.cyan : COLORS.neonGreen,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Phone mockup */}
      <div
        style={{
          transform: `scale(${phoneScale}) rotate(${phoneRotate}deg)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 320,
            height: 650,
            backgroundColor: "#1a1a2e",
            borderRadius: 45,
            border: `3px solid ${COLORS.grey}40`,
            padding: 12,
            boxShadow: `0 30px 80px ${COLORS.cyan}30, 0 0 120px ${COLORS.purple}20`,
            overflow: "hidden",
          }}
        >
          {/* Phone screen content - App preview */}
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: COLORS.darkNavy,
              borderRadius: 35,
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Status bar */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ color: COLORS.light, fontSize: 14, fontWeight: 600 }}>9:41</span>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: 18, height: 10, backgroundColor: COLORS.light, borderRadius: 3 }} />
              </div>
            </div>

            {/* App logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 25 }}>
              <div
                style={{
                  width: 45,
                  height: 45,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"
                    stroke={COLORS.darkNavy}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <div style={{ color: COLORS.light, fontSize: 20, fontWeight: 700 }}>NeuroGut</div>
                <div style={{ color: COLORS.cyan, fontSize: 12, letterSpacing: 2 }}>ACOUSTICS</div>
              </div>
            </div>

            {/* Score preview */}
            <div
              style={{
                backgroundColor: `${COLORS.darkNavy2}`,
                borderRadius: 20,
                padding: 20,
                border: `1px solid ${COLORS.cyan}30`,
                marginBottom: 20,
              }}
            >
              <div style={{ color: COLORS.grey, fontSize: 12, marginBottom: 8 }}>Vagal Readiness Score</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ color: COLORS.neonGreen, fontSize: 48, fontWeight: 700 }}>72</span>
                <span style={{ color: COLORS.grey, fontSize: 16 }}>/ 100</span>
              </div>
              <div style={{ color: COLORS.neonGreen, fontSize: 14, marginTop: 8 }}>Good Balance</div>
            </div>

            {/* Action button preview */}
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
                borderRadius: 15,
                padding: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: COLORS.darkNavy,
                }}
              />
              <span style={{ color: COLORS.darkNavy, fontSize: 16, fontWeight: 600 }}>
                Start Daily Check-in
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Text content */}
      <div style={{ flex: 1, maxWidth: 700 }}>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
            marginBottom: 24,
            opacity: titleOpacity,
            lineHeight: 1.1,
          }}
        >
          Your{" "}
          <span
            style={{
              background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Gut-Brain
          </span>{" "}
          Journey Starts Here
        </h1>

        <p
          style={{
            fontSize: 28,
            color: COLORS.grey,
            margin: 0,
            lineHeight: 1.5,
            opacity: subtitleOpacity,
          }}
        >
          In less than <span style={{ color: COLORS.cyan }}>5 minutes a day</span>, gain unprecedented insight into your autonomic nervous system.
        </p>
      </div>
    </AbsoluteFill>
  );
};
