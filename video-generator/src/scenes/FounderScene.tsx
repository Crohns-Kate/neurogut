import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  staticFile,
  Img,
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

export const FounderScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const contentOpacity = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const avatarScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const nameOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const bioOpacity = interpolate(frame, [60, 100], [0, 1], {
    extrapolateRight: "clamp",
  });

  const credentialOpacity1 = interpolate(frame, [100, 130], [0, 1], {
    extrapolateRight: "clamp",
  });

  const credentialOpacity2 = interpolate(frame, [130, 160], [0, 1], {
    extrapolateRight: "clamp",
  });

  const credentialOpacity3 = interpolate(frame, [160, 190], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle pulse for avatar ring
  const ringPulse = 1 + Math.sin(frame * 0.08) * 0.03;

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
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 70% 50%, ${COLORS.purple}15, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 40% at 20% 30%, ${COLORS.cyan}10, transparent 60%)`,
        }}
      />

      {/* Main content container */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 100,
          padding: "0 120px",
          opacity: contentOpacity,
        }}
      >
        {/* Left side - Avatar and name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Avatar with animated ring */}
          <div
            style={{
              position: "relative",
              transform: `scale(${avatarScale})`,
            }}
          >
            {/* Outer glow ring */}
            <div
              style={{
                position: "absolute",
                inset: -20,
                borderRadius: "50%",
                background: `conic-gradient(from 0deg, ${COLORS.cyan}, ${COLORS.neonGreen}, ${COLORS.purple}, ${COLORS.cyan})`,
                opacity: 0.6,
                transform: `scale(${ringPulse}) rotate(${frame * 0.5}deg)`,
                filter: "blur(8px)",
              }}
            />
            {/* Avatar container */}
            <div
              style={{
                width: 280,
                height: 280,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${COLORS.darkNavy2}, ${COLORS.darkNavy})`,
                border: `4px solid ${COLORS.cyan}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Profile photo */}
              <Img
                src={staticFile("dr-michael.jpg")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          </div>

          {/* Name */}
          <div
            style={{
              marginTop: 40,
              textAlign: "center",
              opacity: nameOpacity,
            }}
          >
            <h2
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: COLORS.light,
                margin: 0,
              }}
            >
              Dr. Michael Bishopp
            </h2>
            <p
              style={{
                fontSize: 26,
                color: COLORS.cyan,
                marginTop: 12,
                fontWeight: 500,
              }}
            >
              Founder & Creator
            </p>
          </div>
        </div>

        {/* Right side - Credentials and story */}
        <div
          style={{
            flex: 1,
            maxWidth: 800,
          }}
        >
          {/* Quote / Mission */}
          <div
            style={{
              opacity: bioOpacity,
              marginBottom: 50,
            }}
          >
            <p
              style={{
                fontSize: 32,
                color: COLORS.light,
                lineHeight: 1.5,
                fontStyle: "italic",
                borderLeft: `4px solid ${COLORS.cyan}`,
                paddingLeft: 30,
              }}
            >
              "After navigating my own gut challenges and bowel surgery, I dedicated
              myself to creating the tool I wished had existed for my own journey."
            </p>
          </div>

          {/* Credentials */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Credential 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: credentialOpacity1,
                padding: "20px 30px",
                background: `${COLORS.darkNavy2}80`,
                borderRadius: 16,
                border: `1px solid ${COLORS.cyan}20`,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.cyan}30, ${COLORS.cyan}10)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                🏥
              </div>
              <div>
                <h4 style={{ fontSize: 24, color: COLORS.light, margin: 0, fontWeight: 600 }}>
                  15+ Years Clinical Experience
                </h4>
                <p style={{ fontSize: 18, color: COLORS.gray, margin: 0, marginTop: 4 }}>
                  Patient-facing roles & clinic systems
                </p>
              </div>
            </div>

            {/* Credential 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: credentialOpacity2,
                padding: "20px 30px",
                background: `${COLORS.darkNavy2}80`,
                borderRadius: 16,
                border: `1px solid ${COLORS.neonGreen}20`,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.neonGreen}30, ${COLORS.neonGreen}10)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                🧠
              </div>
              <div>
                <h4 style={{ fontSize: 24, color: COLORS.light, margin: 0, fontWeight: 600 }}>
                  Gut-Brain Connection Pioneer
                </h4>
                <p style={{ fontSize: 18, color: COLORS.gray, margin: 0, marginTop: 4 }}>
                  Deep expertise in autonomic nervous system
                </p>
              </div>
            </div>

            {/* Credential 3 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: credentialOpacity3,
                padding: "20px 30px",
                background: `${COLORS.darkNavy2}80`,
                borderRadius: 16,
                border: `1px solid ${COLORS.purple}20`,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${COLORS.purple}30, ${COLORS.purple}10)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                🇦🇺
              </div>
              <div>
                <h4 style={{ fontSize: 24, color: COLORS.light, margin: 0, fontWeight: 600 }}>
                  Gold Coast, Australia
                </h4>
                <p style={{ fontSize: 18, color: COLORS.gray, margin: 0, marginTop: 4 }}>
                  Building world-class health technology
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
