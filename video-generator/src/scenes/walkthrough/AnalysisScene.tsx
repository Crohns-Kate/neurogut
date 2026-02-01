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

export const AnalysisScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Processing animation
  const processingProgress = interpolate(frame, [0, 300], [0, 100], {
    extrapolateRight: "clamp",
  });

  // Gear rotation
  const gearRotation = frame * 2;

  // Data flow animation
  const dataFlowOffset = frame * 3;

  // Stage indicators
  const stage1Complete = frame > 80;
  const stage2Complete = frame > 180;
  const stage3Complete = frame > 280;

  const scaleIn = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 60 },
    from: 0.9,
    to: 1,
  });

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
      {/* Animated background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${COLORS.cyan}08 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.cyan}08 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          transform: `translateY(${dataFlowOffset % 50}px)`,
          opacity: 0.5,
        }}
      />

      {/* Central processing visualization */}
      <div
        style={{
          transform: `scale(${scaleIn})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 50,
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.light,
            margin: 0,
            textAlign: "center",
            opacity: labelOpacity(0),
          }}
        >
          Insight Engine{" "}
          <span style={{ color: COLORS.purple }}>Processing</span>
        </h2>

        {/* Main processing visual */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
          }}
        >
          {/* Input: Raw Audio */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 15,
              opacity: labelOpacity(20),
            }}
          >
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 24,
                backgroundColor: `${COLORS.darkNavy2}`,
                border: `2px solid ${COLORS.cyan}40`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {/* Mini waveform */}
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: 20 + Math.sin((frame + i * 10) * 0.2) * 15,
                      backgroundColor: COLORS.cyan,
                      borderRadius: 2,
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>
              <span style={{ color: COLORS.cyan, fontSize: 14, fontWeight: 500 }}>
                Raw Audio
              </span>
            </div>
          </div>

          {/* Data flow arrows */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 4,
                  backgroundColor: COLORS.cyan,
                  borderRadius: 2,
                  opacity: ((dataFlowOffset + i * 20) % 100) / 100,
                }}
              />
            ))}
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderLeft: `12px solid ${COLORS.cyan}`,
              }}
            />
          </div>

          {/* Processing core */}
          <div
            style={{
              position: "relative",
              width: 250,
              height: 250,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer rotating ring */}
            <div
              style={{
                position: "absolute",
                width: 250,
                height: 250,
                borderRadius: "50%",
                border: `3px solid ${COLORS.purple}40`,
                borderTopColor: COLORS.purple,
                transform: `rotate(${gearRotation}deg)`,
              }}
            />

            {/* Middle ring */}
            <div
              style={{
                position: "absolute",
                width: 200,
                height: 200,
                borderRadius: "50%",
                border: `2px solid ${COLORS.cyan}40`,
                borderTopColor: COLORS.cyan,
                transform: `rotate(${-gearRotation * 1.5}deg)`,
              }}
            />

            {/* Inner ring */}
            <div
              style={{
                position: "absolute",
                width: 150,
                height: 150,
                borderRadius: "50%",
                border: `2px solid ${COLORS.neonGreen}40`,
                borderTopColor: COLORS.neonGreen,
                transform: `rotate(${gearRotation * 2}deg)`,
              }}
            />

            {/* Core */}
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.cyan})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 40px ${COLORS.purple}50`,
              }}
            >
              <svg width="50" height="50" viewBox="0 0 24 24" fill={COLORS.light}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
            </div>
          </div>

          {/* Data flow arrows out */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderLeft: `12px solid ${COLORS.neonGreen}`,
              }}
            />
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 4,
                  backgroundColor: COLORS.neonGreen,
                  borderRadius: 2,
                  opacity: ((dataFlowOffset + i * 20) % 100) / 100,
                }}
              />
            ))}
          </div>

          {/* Output: Insights */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 15,
              opacity: labelOpacity(100),
            }}
          >
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 24,
                backgroundColor: `${COLORS.darkNavy2}`,
                border: `2px solid ${COLORS.neonGreen}40`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 48 }}>📊</span>
              <span style={{ color: COLORS.neonGreen, fontSize: 14, fontWeight: 500 }}>
                Insights
              </span>
            </div>
          </div>
        </div>

        {/* Processing stages */}
        <div
          style={{
            display: "flex",
            gap: 30,
            marginTop: 20,
          }}
        >
          {[
            { label: "Signal Filtering", complete: stage1Complete, delay: 50 },
            { label: "Pattern Extraction", complete: stage2Complete, delay: 130 },
            { label: "Insight Generation", complete: stage3Complete, delay: 210 },
          ].map((stage, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 24px",
                backgroundColor: `${COLORS.darkNavy2}`,
                borderRadius: 16,
                border: `1px solid ${stage.complete ? COLORS.neonGreen : COLORS.grey}30`,
                opacity: labelOpacity(stage.delay),
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: stage.complete ? COLORS.neonGreen : `${COLORS.grey}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s",
                }}
              >
                {stage.complete ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={COLORS.darkNavy}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                  </svg>
                ) : (
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: `2px solid ${COLORS.grey}`,
                      borderTopColor: COLORS.cyan,
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  color: stage.complete ? COLORS.neonGreen : COLORS.grey,
                  fontSize: 16,
                  fontWeight: 500,
                }}
              >
                {stage.label}
              </span>
            </div>
          ))}
        </div>

        {/* Processing description */}
        <p
          style={{
            fontSize: 20,
            color: COLORS.grey,
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.6,
            opacity: labelOpacity(60),
          }}
        >
          Advanced algorithms filter environmental noise, extract motility patterns,
          and identify the unique rhythmic signatures of your digestive system.
        </p>
      </div>
    </AbsoluteFill>
  );
};
