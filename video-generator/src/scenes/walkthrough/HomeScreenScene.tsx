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
};

export const HomeScreenScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 60 },
    from: 100,
    to: 0,
  });

  const elementOpacity = (delay: number) =>
    interpolate(frame, [delay, delay + 20], [0, 1], {
      extrapolateRight: "clamp",
    });

  const highlightPulse = Math.sin(frame * 0.15) * 0.3 + 0.7;

  // Pointer animation
  const pointerY = interpolate(frame, [60, 90, 150, 180], [200, 100, 100, 300], {
    extrapolateRight: "clamp",
  });
  const pointerOpacity = interpolate(frame, [50, 70], [0, 1], {
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
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 60% at 50% 30%, ${COLORS.purple}10, transparent 60%)`,
        }}
      />

      {/* Large phone mockup */}
      <div
        style={{
          transform: `translateX(${slideIn}px)`,
          display: "flex",
          alignItems: "center",
          gap: 60,
        }}
      >
        {/* Phone */}
        <div
          style={{
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
            {/* Status bar */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <span style={{ color: COLORS.light, fontSize: 16, fontWeight: 600 }}>9:41</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={COLORS.light}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            </div>

            {/* Greeting */}
            <div style={{ opacity: elementOpacity(10) }}>
              <div style={{ color: COLORS.grey, fontSize: 16 }}>Good morning</div>
              <div style={{ color: COLORS.light, fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                Welcome back
              </div>
            </div>

            {/* Vagal Score Card - Highlighted */}
            <div
              style={{
                backgroundColor: `${COLORS.darkNavy2}`,
                borderRadius: 24,
                padding: 24,
                marginTop: 24,
                border: `2px solid ${COLORS.cyan}`,
                boxShadow: `0 0 ${20 * highlightPulse}px ${COLORS.cyan}40`,
                opacity: elementOpacity(30),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: COLORS.grey, fontSize: 14 }}>Vagal Readiness Score</div>
                <div
                  style={{
                    backgroundColor: `${COLORS.success}20`,
                    color: COLORS.success,
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  ↑ +5 from yesterday
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                <span style={{ color: COLORS.neonGreen, fontSize: 56, fontWeight: 700 }}>72</span>
                <span style={{ color: COLORS.grey, fontSize: 20 }}>/ 100</span>
              </div>
              <div
                style={{
                  height: 8,
                  backgroundColor: `${COLORS.grey}30`,
                  borderRadius: 4,
                  marginTop: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: "72%",
                    background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ color: COLORS.neonGreen, fontSize: 16, marginTop: 12, fontWeight: 500 }}>
                Good Autonomic Balance
              </div>
            </div>

            {/* Recent Sessions */}
            <div style={{ marginTop: 24, opacity: elementOpacity(60) }}>
              <div style={{ color: COLORS.grey, fontSize: 14, marginBottom: 12 }}>Recent Sessions</div>
              {[
                { time: "Today, 7:30 AM", score: "Normal", color: COLORS.neonGreen },
                { time: "Yesterday, 8:15 AM", score: "Active", color: COLORS.success },
                { time: "2 days ago", score: "Quiet", color: COLORS.cyan },
              ].map((session, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: `${COLORS.darkNavy2}`,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: `1px solid ${COLORS.grey}20`,
                  }}
                >
                  <span style={{ color: COLORS.light, fontSize: 14 }}>{session.time}</span>
                  <span
                    style={{
                      color: session.color,
                      fontSize: 14,
                      fontWeight: 600,
                      backgroundColor: `${session.color}20`,
                      padding: "4px 12px",
                      borderRadius: 12,
                    }}
                  >
                    {session.score}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div
              style={{
                marginTop: "auto",
                background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
                borderRadius: 20,
                padding: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                opacity: elementOpacity(90),
                boxShadow: `0 0 ${15 * highlightPulse}px ${COLORS.cyan}50`,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: COLORS.darkNavy,
                }}
              />
              <span style={{ color: COLORS.darkNavy, fontSize: 18, fontWeight: 700 }}>
                Start Daily Check-in
              </span>
            </div>
          </div>
        </div>

        {/* Labels pointing to features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 400 }}>
          <div style={{ opacity: elementOpacity(40) }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  color: COLORS.darkNavy,
                }}
              >
                1
              </div>
              <h3 style={{ color: COLORS.light, fontSize: 24, fontWeight: 600, margin: 0 }}>
                Your Score at a Glance
              </h3>
            </div>
            <p style={{ color: COLORS.grey, fontSize: 18, margin: 0, lineHeight: 1.5, paddingLeft: 66 }}>
              See your Vagal Readiness Score instantly. Track improvements over time.
            </p>
          </div>

          <div style={{ opacity: elementOpacity(70) }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.cyan})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  color: COLORS.light,
                }}
              >
                2
              </div>
              <h3 style={{ color: COLORS.light, fontSize: 24, fontWeight: 600, margin: 0 }}>
                Session History
              </h3>
            </div>
            <p style={{ color: COLORS.grey, fontSize: 18, margin: 0, lineHeight: 1.5, paddingLeft: 66 }}>
              Review past recordings and see patterns emerge.
            </p>
          </div>

          <div style={{ opacity: elementOpacity(100) }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.neonGreen}, ${COLORS.success})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  color: COLORS.darkNavy,
                }}
              >
                3
              </div>
              <h3 style={{ color: COLORS.light, fontSize: 24, fontWeight: 600, margin: 0 }}>
                One-Tap Check-in
              </h3>
            </div>
            <p style={{ color: COLORS.grey, fontSize: 18, margin: 0, lineHeight: 1.5, paddingLeft: 66 }}>
              Start your daily recording with a single tap.
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
