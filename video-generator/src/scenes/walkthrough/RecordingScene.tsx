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
  red: "#EF4444",
};

export const RecordingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 60 },
    from: -50,
    to: 0,
  });

  // Recording indicator pulse
  const recordPulse = Math.sin(frame * 0.2) * 0.3 + 0.7;

  // Timer animation (0:00 to 3:00)
  const timerSeconds = Math.min(Math.floor(frame / 10), 180);
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const timerDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Waveform animation
  const generateWaveform = () => {
    return Array.from({ length: 50 }).map((_, i) => {
      const baseHeight = 20 + Math.sin((frame + i * 8) * 0.15) * 30;
      const noise = Math.sin((frame + i * 13) * 0.3) * 15;
      const spike = i % 7 === Math.floor(frame / 15) % 7 ? 25 : 0;
      return Math.max(5, Math.min(80, baseHeight + noise + spike));
    });
  };

  const waveform = generateWaveform();

  // Signal quality animation
  const signalQuality = 85 + Math.sin(frame * 0.08) * 10;

  const labelOpacity = (delay: number) =>
    interpolate(frame, [delay, delay + 20], [0, 1], {
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        gap: 60,
      }}
    >
      {/* Background pulse effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, ${COLORS.red}${Math.round(recordPulse * 8).toString(16).padStart(2, '0')}, transparent 50%)`,
        }}
      />

      {/* Phone mockup showing recording */}
      <div
        style={{
          transform: `translateY(${slideIn}px)`,
          width: 380,
          height: 780,
          backgroundColor: "#1a1a2e",
          borderRadius: 50,
          border: `3px solid ${COLORS.grey}30`,
          padding: 14,
          boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 ${40 * recordPulse}px ${COLORS.red}20`,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: COLORS.darkNavy,
            borderRadius: 40,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Recording header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: COLORS.red,
                  boxShadow: `0 0 ${10 * recordPulse}px ${COLORS.red}`,
                }}
              />
              <span style={{ color: COLORS.red, fontSize: 16, fontWeight: 600 }}>
                RECORDING
              </span>
            </div>
            <span style={{ color: COLORS.light, fontSize: 24, fontWeight: 700, fontFamily: "monospace" }}>
              {timerDisplay}
            </span>
          </div>

          {/* Main waveform display */}
          <div
            style={{
              flex: 1,
              backgroundColor: `${COLORS.darkNavy2}`,
              borderRadius: 24,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              border: `1px solid ${COLORS.grey}20`,
            }}
          >
            <div style={{ color: COLORS.grey, fontSize: 14, marginBottom: 15 }}>
              Gut Sound Waveform
            </div>

            {/* Waveform visualization */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              {waveform.map((height, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: height,
                    backgroundColor: i % 5 === 0 ? COLORS.cyan : COLORS.neonGreen,
                    borderRadius: 2,
                    opacity: 0.7 + (height / 100) * 0.3,
                  }}
                />
              ))}
            </div>

            {/* Detected events */}
            <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {frame > 50 && (
                <div
                  style={{
                    backgroundColor: `${COLORS.cyan}20`,
                    border: `1px solid ${COLORS.cyan}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    color: COLORS.cyan,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  🔊 Borborygmi detected
                </div>
              )}
              {frame > 120 && (
                <div
                  style={{
                    backgroundColor: `${COLORS.neonGreen}20`,
                    border: `1px solid ${COLORS.neonGreen}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    color: COLORS.neonGreen,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  🌊 Peristalsis wave
                </div>
              )}
            </div>
          </div>

          {/* Signal quality indicator */}
          <div
            style={{
              marginTop: 20,
              backgroundColor: `${COLORS.darkNavy2}`,
              borderRadius: 16,
              padding: 16,
              border: `1px solid ${COLORS.grey}20`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: COLORS.grey, fontSize: 14 }}>Signal Quality</span>
              <span style={{ color: COLORS.neonGreen, fontSize: 16, fontWeight: 600 }}>
                {Math.round(signalQuality)}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                backgroundColor: `${COLORS.grey}30`,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${signalQuality}%`,
                  background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
                  borderRadius: 4,
                }}
              />
            </div>
          </div>

          {/* Anatomical mirror preview */}
          <div
            style={{
              marginTop: 20,
              backgroundColor: `${COLORS.darkNavy2}`,
              borderRadius: 16,
              padding: 16,
              border: `1px solid ${COLORS.grey}20`,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Mini abdomen visual */}
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 12,
                backgroundColor: `${COLORS.cyan}10`,
                border: `1px solid ${COLORS.cyan}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Activity dot */}
              <div
                style={{
                  position: "absolute",
                  right: 15,
                  bottom: 20,
                  width: 12 * recordPulse,
                  height: 12 * recordPulse,
                  borderRadius: "50%",
                  backgroundColor: COLORS.neonGreen,
                  boxShadow: `0 0 10px ${COLORS.neonGreen}`,
                }}
              />
              <svg width="40" height="40" viewBox="0 0 50 60" fill="none">
                <ellipse cx="25" cy="30" rx="20" ry="25" stroke={COLORS.grey} strokeWidth="1" opacity={0.5} />
              </svg>
            </div>
            <div>
              <div style={{ color: COLORS.light, fontSize: 14, fontWeight: 600 }}>Anatomical Mirror</div>
              <div style={{ color: COLORS.grey, fontSize: 12, marginTop: 4 }}>
                Real-time gut visualization
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side labels */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 450 }}>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
            opacity: labelOpacity(0),
          }}
        >
          Real-Time{" "}
          <span style={{ color: COLORS.cyan }}>Feedback</span>
        </h2>

        {[
          {
            icon: "📊",
            title: "Live Waveform",
            desc: "Watch your gut sounds transform into visual data",
            color: COLORS.cyan,
          },
          {
            icon: "✅",
            title: "Signal Quality",
            desc: "Ensures you're capturing clean acoustic data",
            color: COLORS.neonGreen,
          },
          {
            icon: "🫁",
            title: "Event Detection",
            desc: "AI identifies borborygmi and peristalsis in real-time",
            color: COLORS.purple,
          },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 20,
              opacity: labelOpacity(30 + i * 30),
            }}
          >
            <div
              style={{
                fontSize: 36,
                width: 60,
                height: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${item.color}15`,
                borderRadius: 16,
              }}
            >
              {item.icon}
            </div>
            <div>
              <div style={{ color: COLORS.light, fontSize: 22, fontWeight: 600 }}>
                {item.title}
              </div>
              <div style={{ color: COLORS.grey, fontSize: 16, marginTop: 6, lineHeight: 1.5 }}>
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
