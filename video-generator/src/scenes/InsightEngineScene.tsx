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

export const InsightEngineScene: React.FC = () => {
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

  const waveformOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const filterOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateRight: "clamp",
  });

  const outputOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Generate waveform data
  const generateWaveform = (offset: number, amplitude: number, noise: number) => {
    const points: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = i * 4;
      const baseY = Math.sin((i + frame * 2 + offset) * 0.1) * amplitude;
      const noiseY = Math.sin((i + frame) * 0.3) * noise;
      const y = 60 + baseY + noiseY;
      points.push(`${i === 0 ? "M" : "L"}${x},${y}`);
    }
    return points.join(" ");
  };

  // Clean waveform (filtered)
  const cleanWaveform = generateWaveform(0, 30, 0);
  // Noisy waveform (raw input)
  const noisyWaveform = generateWaveform(0, 25, 15);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Space Grotesk, Inter, sans-serif",
        padding: "60px 100px",
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${COLORS.purple}12, transparent 60%)`,
        }}
      />

      {/* Title */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 60,
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: COLORS.purple,
            fontWeight: 600,
            letterSpacing: "0.15em",
            marginBottom: 16,
          }}
        >
          PROPRIETARY TECHNOLOGY
        </div>
        <h2
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
          }}
        >
          The Insight Engine
        </h2>
      </div>

      {/* Visualization area */}
      <div
        style={{
          width: "100%",
          maxWidth: 1600,
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        {/* Raw input waveform */}
        <div
          style={{
            background: `${COLORS.darkNavy2}90`,
            borderRadius: 24,
            padding: "30px 40px",
            border: `1px solid ${COLORS.gray}20`,
            opacity: waveformOpacity,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLORS.gray,
              }}
            />
            <span style={{ fontSize: 22, color: COLORS.gray, fontWeight: 500 }}>
              Raw Audio Input (with environmental noise)
            </span>
          </div>
          <svg width="100%" height="120" viewBox="0 0 800 120" preserveAspectRatio="none">
            <path d={noisyWaveform} fill="none" stroke={COLORS.gray} strokeWidth="2" opacity="0.6" />
          </svg>
        </div>

        {/* Processing arrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            opacity: filterOpacity,
          }}
        >
          <div
            style={{
              height: 2,
              flex: 1,
              background: `linear-gradient(90deg, transparent, ${COLORS.purple}60)`,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 32px",
              background: `linear-gradient(135deg, ${COLORS.purple}30, ${COLORS.purple}10)`,
              borderRadius: 50,
              border: `2px solid ${COLORS.purple}50`,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
                fill={COLORS.purple}
                opacity="0.8"
              />
            </svg>
            <span style={{ fontSize: 24, color: COLORS.light, fontWeight: 600 }}>
              AI Noise Filtering
            </span>
          </div>
          <div
            style={{
              height: 2,
              flex: 1,
              background: `linear-gradient(90deg, ${COLORS.purple}60, transparent)`,
            }}
          />
        </div>

        {/* Filtered output waveform */}
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.cyan}10, ${COLORS.neonGreen}05)`,
            borderRadius: 24,
            padding: "30px 40px",
            border: `1px solid ${COLORS.cyan}30`,
            opacity: outputOpacity,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLORS.neonGreen,
                boxShadow: `0 0 12px ${COLORS.neonGreen}`,
              }}
            />
            <span style={{ fontSize: 22, color: COLORS.light, fontWeight: 500 }}>
              True Motility Signal Isolated
            </span>
          </div>
          <svg width="100%" height="120" viewBox="0 0 800 120" preserveAspectRatio="none">
            <path
              d={cleanWaveform}
              fill="none"
              stroke={COLORS.neonGreen}
              strokeWidth="3"
              style={{
                filter: `drop-shadow(0 0 8px ${COLORS.neonGreen}60)`,
              }}
            />
          </svg>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            textAlign: "center",
            marginTop: 30,
            opacity: outputOpacity,
          }}
        >
          <p
            style={{
              fontSize: 28,
              color: COLORS.gray,
              maxWidth: 900,
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            A{" "}
            <span style={{ color: COLORS.cyan, fontWeight: 600 }}>real-time window</span>{" "}
            into your internal health
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
