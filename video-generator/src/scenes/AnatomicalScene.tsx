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

export const AnatomicalScene: React.FC = () => {
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

  const bodyOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const targetOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  const labelOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pulsing target animation
  const targetPulse = 1 + Math.sin(frame * 0.15) * 0.08;
  const ringExpand = interpolate(frame, [60, 180], [0.8, 1.2], {
    extrapolateRight: "clamp",
  });

  // Scanning line animation
  const scanLineY = interpolate(frame % 90, [0, 90], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Space Grotesk, Inter, sans-serif",
      }}
    >
      {/* Background gradient - adjusted to highlight left side (person's right, Lower Right Quadrant) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 30% 70%, ${COLORS.cyan}12, transparent 60%)`,
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 100,
          padding: "0 100px",
          width: "100%",
          maxWidth: 1800,
        }}
      >
        {/* Left - Body diagram */}
        <div
          style={{
            position: "relative",
            width: 600,
            height: 800,
            opacity: bodyOpacity,
          }}
        >
          {/* Torso outline */}
          <svg
            viewBox="0 0 300 400"
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            {/* Body silhouette */}
            <path
              d="M150 20
                 C180 20 200 40 200 60
                 C200 80 190 100 180 120
                 L200 140
                 C230 150 250 180 250 220
                 L250 340
                 C250 360 240 380 220 380
                 L80 380
                 C60 380 50 360 50 340
                 L50 220
                 C50 180 70 150 100 140
                 L120 120
                 C110 100 100 80 100 60
                 C100 40 120 20 150 20Z"
              fill={`${COLORS.darkNavy2}`}
              stroke={COLORS.cyan}
              strokeWidth="2"
              opacity="0.8"
            />

            {/* Digestive system outline - flows to Lower Right Quadrant (person's right, viewer's left) */}
            <path
              d="M130 160 C120 180 110 200 110 220
                 C110 240 120 260 100 270
                 C80 280 70 270 90 250
                 C100 230 90 210 100 200
                 C110 190 120 200 115 210
                 C110 220 105 235 100 250
                 L95 320"
              fill="none"
              stroke={COLORS.neonGreen}
              strokeWidth="3"
              opacity="0.6"
              strokeDasharray="8 4"
            />

            {/* Lower Right Quadrant highlight - positioned on person's RIGHT side (viewer's LEFT) */}
            <ellipse
              cx="100"
              cy="280"
              rx={40 * targetPulse}
              ry={35 * targetPulse}
              fill="none"
              stroke={COLORS.cyan}
              strokeWidth="3"
              opacity={targetOpacity}
            />

            {/* Outer pulsing ring */}
            <ellipse
              cx="100"
              cy="280"
              rx={55 * ringExpand}
              ry={48 * ringExpand}
              fill="none"
              stroke={COLORS.cyan}
              strokeWidth="1"
              opacity={targetOpacity * 0.4}
            />

            {/* Target crosshair */}
            <g opacity={targetOpacity}>
              <line x1="100" y1="250" x2="100" y2="265" stroke={COLORS.cyan} strokeWidth="2" />
              <line x1="100" y1="295" x2="100" y2="310" stroke={COLORS.cyan} strokeWidth="2" />
              <line x1="65" y1="280" x2="80" y2="280" stroke={COLORS.cyan} strokeWidth="2" />
              <line x1="120" y1="280" x2="135" y2="280" stroke={COLORS.cyan} strokeWidth="2" />
            </g>

            {/* Ileocecal valve point */}
            <circle
              cx="100"
              cy="280"
              r={8 * targetPulse}
              fill={COLORS.cyan}
              opacity={targetOpacity}
            >
              <animate
                attributeName="opacity"
                values="0.6;1;0.6"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          {/* Scanning line effect */}
          <div
            style={{
              position: "absolute",
              top: `${scanLineY}%`,
              left: "10%",
              width: "80%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.cyan}60, transparent)`,
              opacity: bodyOpacity * 0.6,
            }}
          />
        </div>

        {/* Right - Content */}
        <div
          style={{
            flex: 1,
            maxWidth: 900,
          }}
        >
          {/* Title */}
          <div style={{ opacity: titleOpacity }}>
            <div
              style={{
                fontSize: 22,
                color: COLORS.cyan,
                fontWeight: 600,
                letterSpacing: "0.15em",
                marginBottom: 16,
              }}
            >
              PRECISION PLACEMENT
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
              The Anatomical Standard
            </h2>
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 32,
              color: COLORS.gray,
              lineHeight: 1.6,
              marginTop: 40,
              opacity: bodyOpacity,
            }}
          >
            Our guided protocol ensures every recording targets the{" "}
            <span style={{ color: COLORS.light, fontWeight: 600 }}>
              Lower Right Quadrant
            </span>
            —the anatomical home of the ileocecal valve.
          </p>

          {/* Key points */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              marginTop: 50,
              opacity: labelOpacity,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "24px 32px",
                background: `linear-gradient(135deg, ${COLORS.cyan}15, ${COLORS.cyan}05)`,
                borderRadius: 16,
                border: `1px solid ${COLORS.cyan}30`,
              }}
            >
              <div style={{ fontSize: 40 }}>📍</div>
              <div>
                <h4 style={{ fontSize: 26, color: COLORS.light, margin: 0, fontWeight: 600 }}>
                  Standardized Clinical Capture
                </h4>
                <p style={{ fontSize: 20, color: COLORS.gray, margin: 0, marginTop: 6 }}>
                  Consistent, reproducible recordings every time
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "24px 32px",
                background: `linear-gradient(135deg, ${COLORS.neonGreen}15, ${COLORS.neonGreen}05)`,
                borderRadius: 16,
                border: `1px solid ${COLORS.neonGreen}30`,
              }}
            >
              <div style={{ fontSize: 40 }}>🎯</div>
              <div>
                <h4 style={{ fontSize: 26, color: COLORS.light, margin: 0, fontWeight: 600 }}>
                  Ileocecal Valve Focus
                </h4>
                <p style={{ fontSize: 20, color: COLORS.gray, margin: 0, marginTop: 6 }}>
                  The gateway between small and large intestine
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
