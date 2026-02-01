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
  gold: "#F59E0B",
};

export const VagalScoreExplained: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Score counter animation
  const scoreValue = interpolate(frame, [30, 120], [0, 72], {
    extrapolateRight: "clamp",
  });

  // Gauge animation
  const gaugeAngle = interpolate(frame, [30, 120], [-135, -135 + (72 / 100) * 270], {
    extrapolateRight: "clamp",
  });

  const elementOpacity = (delay: number) =>
    interpolate(frame, [delay, delay + 25], [0, 1], {
      extrapolateRight: "clamp",
    });

  // Pulse for score
  const scorePulse = frame > 120 ? Math.sin((frame - 120) * 0.1) * 0.05 + 1 : 1;

  // Component bars animation
  const componentProgress = (delay: number, value: number) => {
    const progress = interpolate(frame, [delay, delay + 40], [0, value], {
      extrapolateRight: "clamp",
    });
    return progress;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        padding: 60,
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 30% 40%, ${COLORS.purple}10, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 50% at 70% 60%, ${COLORS.cyan}08, transparent 50%)`,
        }}
      />

      {/* Left side - Score visualization */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* Main gauge */}
        <div
          style={{
            position: "relative",
            width: 350,
            height: 350,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${scorePulse})`,
          }}
        >
          {/* Gauge background */}
          <svg width="350" height="350" viewBox="0 0 350 350">
            {/* Background arc */}
            <circle
              cx="175"
              cy="175"
              r="140"
              fill="none"
              stroke={`${COLORS.grey}20`}
              strokeWidth="20"
              strokeDasharray="659.73"
              strokeDashoffset="164.93"
              transform="rotate(135 175 175)"
              strokeLinecap="round"
            />

            {/* Colored gradient arc */}
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={COLORS.purple} />
                <stop offset="50%" stopColor={COLORS.cyan} />
                <stop offset="100%" stopColor={COLORS.neonGreen} />
              </linearGradient>
            </defs>

            <circle
              cx="175"
              cy="175"
              r="140"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="20"
              strokeDasharray={`${(scoreValue / 100) * 494.8} 659.73`}
              strokeDashoffset="164.93"
              transform="rotate(135 175 175)"
              strokeLinecap="round"
            />
          </svg>

          {/* Center score display */}
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
                fontSize: 100,
                fontWeight: 700,
                color: COLORS.neonGreen,
                lineHeight: 1,
              }}
            >
              {Math.round(scoreValue)}
            </div>
            <div style={{ fontSize: 24, color: COLORS.grey, marginTop: 8 }}>/ 100</div>
            <div
              style={{
                marginTop: 16,
                padding: "8px 20px",
                backgroundColor: `${COLORS.neonGreen}20`,
                borderRadius: 20,
                color: COLORS.neonGreen,
                fontSize: 18,
                fontWeight: 600,
                opacity: elementOpacity(130),
              }}
            >
              Good Balance
            </div>
          </div>
        </div>

        {/* Score components breakdown */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: "100%",
            maxWidth: 400,
          }}
        >
          {[
            { label: "Baseline Motility", value: 78, color: COLORS.cyan, delay: 140 },
            { label: "Rhythmicity", value: 65, color: COLORS.purple, delay: 160 },
            { label: "Breathing Response", value: 72, color: COLORS.neonGreen, delay: 180 },
          ].map((component, i) => (
            <div
              key={i}
              style={{
                opacity: elementOpacity(component.delay),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: COLORS.grey, fontSize: 14 }}>{component.label}</span>
                <span style={{ color: component.color, fontSize: 14, fontWeight: 600 }}>
                  {Math.round(componentProgress(component.delay, component.value))}%
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  backgroundColor: `${COLORS.grey}20`,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${componentProgress(component.delay, component.value)}%`,
                    backgroundColor: component.color,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side - Explanation */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 30,
          maxWidth: 550,
        }}
      >
        <h2
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
            lineHeight: 1.2,
            opacity: elementOpacity(0),
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
            Vagal Readiness
          </span>{" "}
          Score
        </h2>

        <p
          style={{
            fontSize: 20,
            color: COLORS.grey,
            margin: 0,
            lineHeight: 1.6,
            opacity: elementOpacity(30),
          }}
        >
          The headline metric that quantifies your autonomic balance and gut-brain connection.
        </p>

        {/* What it measures */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            marginTop: 10,
          }}
        >
          {[
            {
              icon: "🌊",
              title: "Baseline Motility",
              desc: "Your gut's natural movement patterns at rest",
              delay: 60,
            },
            {
              icon: "🎵",
              title: "Rhythmicity",
              desc: "Regularity and consistency of digestive rhythms",
              delay: 90,
            },
            {
              icon: "🫁",
              title: "Breathing Response",
              desc: "How your gut responds to breathing exercises",
              delay: 120,
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                opacity: elementOpacity(item.delay),
                padding: 20,
                backgroundColor: `${COLORS.darkNavy2}`,
                borderRadius: 16,
                border: `1px solid ${COLORS.grey}20`,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  width: 50,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${COLORS.purple}15`,
                  borderRadius: 12,
                }}
              >
                {item.icon}
              </div>
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

        {/* Bottom statement */}
        <div
          style={{
            marginTop: 10,
            padding: 20,
            background: `linear-gradient(135deg, ${COLORS.purple}20, ${COLORS.cyan}20)`,
            borderRadius: 16,
            border: `1px solid ${COLORS.cyan}30`,
            opacity: elementOpacity(200),
          }}
        >
          <p
            style={{
              color: COLORS.light,
              fontSize: 18,
              margin: 0,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            "This isn't just a number — it's your personal window into your body's capacity to heal, restore, and thrive."
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
