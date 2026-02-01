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
  orange: "#F97316",
};

export const PlacementScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoomIn = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 50 },
    from: 0.8,
    to: 1,
  });

  const targetPulse = Math.sin(frame * 0.12) * 0.15 + 1;
  const ringExpand = (frame * 2) % 100;

  const labelOpacity = (delay: number) =>
    interpolate(frame, [delay, delay + 25], [0, 1], {
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
        padding: 60,
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 70% at 40% 50%, ${COLORS.orange}08, transparent 60%)`,
        }}
      />

      {/* Left side - Anatomy diagram */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${zoomIn})`,
        }}
      >
        <div style={{ position: "relative", width: 500, height: 600 }}>
          {/* Torso outline */}
          <svg
            width="500"
            height="600"
            viewBox="0 0 500 600"
            fill="none"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {/* Body outline */}
            <ellipse
              cx="250"
              cy="300"
              rx="180"
              ry="250"
              stroke={COLORS.grey}
              strokeWidth="2"
              strokeDasharray="8 4"
              fill="none"
              opacity={0.3}
            />

            {/* Ribcage suggestion */}
            <path
              d="M120 180 Q250 160 380 180"
              stroke={COLORS.grey}
              strokeWidth="1"
              fill="none"
              opacity={0.2}
            />
            <path
              d="M130 220 Q250 200 370 220"
              stroke={COLORS.grey}
              strokeWidth="1"
              fill="none"
              opacity={0.2}
            />

            {/* Intestine path simplified */}
            <path
              d="M180 280 Q200 300 220 280 Q240 260 260 280 Q280 300 300 280 Q320 260 340 280 Q360 300 340 320 Q320 340 340 360 Q360 380 340 400 Q320 420 280 420 Q240 420 220 400 Q200 380 180 400 Q160 420 180 380 Q200 340 180 320 Q160 300 180 280"
              stroke={COLORS.cyan}
              strokeWidth="2"
              fill="none"
              opacity={0.4}
            />

            {/* Navel marker */}
            <circle
              cx="250"
              cy="340"
              r="8"
              fill={COLORS.grey}
              opacity={0.5}
            />
            <text
              x="270"
              y="345"
              fill={COLORS.grey}
              fontSize="14"
              opacity={0.6}
            >
              Navel
            </text>
          </svg>

          {/* Target zone - Lower Right Quadrant */}
          <div
            style={{
              position: "absolute",
              left: 280,
              top: 380,
              width: 100,
              height: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Expanding rings */}
            <div
              style={{
                position: "absolute",
                width: ringExpand + 40,
                height: ringExpand + 40,
                borderRadius: "50%",
                border: `2px solid ${COLORS.neonGreen}`,
                opacity: 1 - ringExpand / 100,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: ((ringExpand + 50) % 100) + 40,
                height: ((ringExpand + 50) % 100) + 40,
                borderRadius: "50%",
                border: `2px solid ${COLORS.neonGreen}`,
                opacity: 1 - ((ringExpand + 50) % 100) / 100,
              }}
            />

            {/* Target center */}
            <div
              style={{
                width: 60 * targetPulse,
                height: 60 * targetPulse,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${COLORS.neonGreen}80, ${COLORS.neonGreen}20)`,
                boxShadow: `0 0 30px ${COLORS.neonGreen}60`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill={COLORS.darkNavy}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
          </div>

          {/* LRQ Label */}
          <div
            style={{
              position: "absolute",
              left: 320,
              top: 340,
              opacity: labelOpacity(30),
            }}
          >
            <div
              style={{
                backgroundColor: `${COLORS.neonGreen}20`,
                border: `1px solid ${COLORS.neonGreen}`,
                borderRadius: 8,
                padding: "8px 16px",
                color: COLORS.neonGreen,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Lower Right Quadrant
            </div>
          </div>

          {/* Ileocecal valve annotation */}
          <div
            style={{
              position: "absolute",
              left: 340,
              top: 450,
              opacity: labelOpacity(60),
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 2,
                backgroundColor: COLORS.cyan,
              }}
            />
            <div style={{ color: COLORS.cyan, fontSize: 16, fontWeight: 500 }}>
              Ileocecal Valve
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Instructions */}
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
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
            lineHeight: 1.2,
            opacity: labelOpacity(0),
          }}
        >
          Precision{" "}
          <span style={{ color: COLORS.neonGreen }}>Placement</span>
        </h2>

        <p
          style={{
            fontSize: 22,
            color: COLORS.grey,
            margin: 0,
            lineHeight: 1.6,
            opacity: labelOpacity(20),
          }}
        >
          Our guided system ensures accurate positioning for optimal acoustic capture.
        </p>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
          {[
            {
              icon: "📍",
              title: "Target the LRQ",
              desc: "Lower right quadrant, 2 inches from navel",
            },
            {
              icon: "🎯",
              title: "Ileocecal Valve",
              desc: "Gateway between small & large intestine",
            },
            {
              icon: "📱",
              title: "Firm Contact",
              desc: "Place device microphone against skin",
            },
          ].map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 20,
                opacity: labelOpacity(40 + i * 30),
                backgroundColor: `${COLORS.darkNavy2}`,
                padding: 20,
                borderRadius: 16,
                border: `1px solid ${COLORS.grey}20`,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  width: 50,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {step.icon}
              </div>
              <div>
                <div style={{ color: COLORS.light, fontSize: 20, fontWeight: 600 }}>
                  {step.title}
                </div>
                <div style={{ color: COLORS.grey, fontSize: 16, marginTop: 4 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
