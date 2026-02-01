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
  success: "#22C55E",
  warning: "#F59E0B",
};

export const ResultsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideUp = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 60 },
    from: 50,
    to: 0,
  });

  const cardOpacity = (delay: number) =>
    interpolate(frame, [delay, delay + 20], [0, 1], {
      extrapolateRight: "clamp",
    });

  const countUp = (target: number, startFrame: number) => {
    const progress = interpolate(frame, [startFrame, startFrame + 60], [0, 1], {
      extrapolateRight: "clamp",
    });
    return Math.round(target * progress);
  };

  // Timeline events
  const events = [
    { time: "0:15", type: "Borborygmi", intensity: 0.7 },
    { time: "0:45", type: "Peristalsis", intensity: 0.5 },
    { time: "1:20", type: "Borborygmi", intensity: 0.9 },
    { time: "1:55", type: "Peristalsis", intensity: 0.6 },
    { time: "2:30", type: "Borborygmi", intensity: 0.4 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        padding: 60,
        gap: 50,
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 30%, ${COLORS.neonGreen}08, transparent 60%)`,
        }}
      />

      {/* Phone showing results */}
      <div
        style={{
          transform: `translateY(${slideUp}px)`,
          width: 380,
          height: 780,
          backgroundColor: "#1a1a2e",
          borderRadius: 50,
          border: `3px solid ${COLORS.grey}30`,
          padding: 14,
          boxShadow: `0 40px 100px rgba(0,0,0,0.5)`,
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
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ color: COLORS.grey, fontSize: 14 }}>Session Complete</div>
              <div style={{ color: COLORS.light, fontSize: 20, fontWeight: 600 }}>Today, 9:45 AM</div>
            </div>
            <div
              style={{
                backgroundColor: `${COLORS.success}20`,
                color: COLORS.success,
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              ✓ Analyzed
            </div>
          </div>

          {/* Main result card */}
          <div
            style={{
              backgroundColor: `${COLORS.darkNavy2}`,
              borderRadius: 24,
              padding: 20,
              border: `1px solid ${COLORS.neonGreen}30`,
              marginBottom: 16,
              opacity: cardOpacity(20),
            }}
          >
            <div style={{ color: COLORS.grey, fontSize: 14, marginBottom: 8 }}>Gut Activity Level</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span
                style={{
                  color: COLORS.neonGreen,
                  fontSize: 48,
                  fontWeight: 700,
                }}
              >
                Normal
              </span>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
              <div>
                <div style={{ color: COLORS.grey, fontSize: 12 }}>Events</div>
                <div style={{ color: COLORS.cyan, fontSize: 24, fontWeight: 600 }}>{countUp(12, 40)}</div>
              </div>
              <div>
                <div style={{ color: COLORS.grey, fontSize: 12 }}>Duration</div>
                <div style={{ color: COLORS.light, fontSize: 24, fontWeight: 600 }}>3:00</div>
              </div>
              <div>
                <div style={{ color: COLORS.grey, fontSize: 12 }}>Quality</div>
                <div style={{ color: COLORS.neonGreen, fontSize: 24, fontWeight: 600 }}>{countUp(94, 60)}%</div>
              </div>
            </div>
          </div>

          {/* Event timeline */}
          <div
            style={{
              backgroundColor: `${COLORS.darkNavy2}`,
              borderRadius: 20,
              padding: 16,
              border: `1px solid ${COLORS.grey}20`,
              marginBottom: 16,
              opacity: cardOpacity(60),
            }}
          >
            <div style={{ color: COLORS.grey, fontSize: 14, marginBottom: 12 }}>Sound Event Timeline</div>

            {/* Timeline bar */}
            <div
              style={{
                height: 40,
                backgroundColor: `${COLORS.grey}20`,
                borderRadius: 8,
                position: "relative",
                marginBottom: 10,
              }}
            >
              {events.map((event, i) => {
                const position = (parseInt(event.time.split(":")[0]) * 60 + parseInt(event.time.split(":")[1])) / 180 * 100;
                const showEvent = frame > 80 + i * 15;
                return showEvent ? (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${position}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 12 + event.intensity * 10,
                      height: 12 + event.intensity * 10,
                      borderRadius: "50%",
                      backgroundColor: event.type === "Borborygmi" ? COLORS.cyan : COLORS.neonGreen,
                      opacity: 0.8,
                    }}
                  />
                ) : null;
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.grey, fontSize: 12 }}>
              <span>0:00</span>
              <span>1:30</span>
              <span>3:00</span>
            </div>
          </div>

          {/* Insights */}
          <div
            style={{
              flex: 1,
              backgroundColor: `${COLORS.darkNavy2}`,
              borderRadius: 20,
              padding: 16,
              border: `1px solid ${COLORS.grey}20`,
              opacity: cardOpacity(100),
            }}
          >
            <div style={{ color: COLORS.grey, fontSize: 14, marginBottom: 12 }}>Personalized Insight</div>
            <p
              style={{
                color: COLORS.light,
                fontSize: 15,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Your gut activity is within <span style={{ color: COLORS.neonGreen }}>normal range</span>.
              The pattern shows healthy peristaltic movement with regular borborygmi events.
              This session contributes to building your personal baseline.
            </p>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: `${COLORS.cyan}10`,
                borderRadius: 12,
                border: `1px solid ${COLORS.cyan}30`,
              }}
            >
              <div style={{ color: COLORS.cyan, fontSize: 13 }}>
                💡 Tip: Recording at the same time each day helps establish reliable patterns.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side explanation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 30, maxWidth: 480 }}>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
            opacity: cardOpacity(0),
          }}
        >
          Instant{" "}
          <span style={{ color: COLORS.neonGreen }}>Results</span>
        </h2>

        <p
          style={{
            fontSize: 20,
            color: COLORS.grey,
            margin: 0,
            lineHeight: 1.6,
            opacity: cardOpacity(20),
          }}
        >
          Your recording is analyzed in seconds, not hours. Every session builds your personal baseline.
        </p>

        {[
          {
            icon: "📈",
            title: "Activity Classification",
            desc: "Quiet, Normal, or Active gut motility",
          },
          {
            icon: "🎯",
            title: "Event Detection",
            desc: "Borborygmi, peristalsis waves, and patterns",
          },
          {
            icon: "💡",
            title: "Personal Insights",
            desc: "AI-generated recommendations based on your data",
          },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 20,
              opacity: cardOpacity(50 + i * 30),
              backgroundColor: `${COLORS.darkNavy2}`,
              padding: 20,
              borderRadius: 16,
              border: `1px solid ${COLORS.grey}20`,
            }}
          >
            <div style={{ fontSize: 32 }}>{item.icon}</div>
            <div>
              <div style={{ color: COLORS.light, fontSize: 18, fontWeight: 600 }}>
                {item.title}
              </div>
              <div style={{ color: COLORS.grey, fontSize: 15, marginTop: 4 }}>
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
