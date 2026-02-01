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

export const WalkthroughOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 60 },
    from: 0.5,
    to: 1,
  });

  const textOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const ctaOpacity = interpolate(frame, [80, 110], [0, 1], {
    extrapolateRight: "clamp",
  });

  const ctaScale = spring({
    frame: frame - 80,
    fps,
    config: { damping: 10, stiffness: 80 },
    from: 0.8,
    to: 1,
  });

  // Pulse animation
  const pulse = Math.sin(frame * 0.1) * 0.05 + 1;

  // Floating particles
  const particles = Array.from({ length: 30 }).map((_, i) => ({
    x: (i * 37 + frame * 0.2) % 100,
    y: (i * 23 + frame * 0.15) % 100,
    size: 2 + (i % 4),
    opacity: 0.1 + (i % 6) * 0.08,
    color: i % 3 === 0 ? COLORS.cyan : i % 3 === 1 ? COLORS.neonGreen : COLORS.purple,
  }));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkNavy,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${COLORS.cyan}15, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 30% 70%, ${COLORS.purple}12, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 40% at 70% 30%, ${COLORS.neonGreen}08, transparent 50%)`,
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
            backgroundColor: p.color,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale * pulse})`,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 80px ${COLORS.cyan}50, 0 0 150px ${COLORS.cyan}25`,
          }}
        >
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4"
              stroke={COLORS.darkNavy}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Brand name */}
      <h1
        style={{
          fontSize: 90,
          fontWeight: 700,
          color: COLORS.light,
          margin: 0,
          opacity: textOpacity,
          textShadow: `0 0 60px ${COLORS.cyan}30`,
        }}
      >
        NeuroGut
      </h1>

      <div
        style={{
          fontSize: 32,
          fontWeight: 500,
          color: COLORS.cyan,
          letterSpacing: "0.3em",
          marginTop: 8,
          opacity: textOpacity,
        }}
      >
        ACOUSTICS™
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: 32,
          color: COLORS.grey,
          marginTop: 40,
          marginBottom: 50,
          opacity: textOpacity,
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        Listen to what your gut is telling you.
      </p>

      {/* CTA Button */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.neonGreen})`,
            padding: "24px 60px",
            borderRadius: 60,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: `0 0 40px ${COLORS.cyan}40`,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill={COLORS.darkNavy}>
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          <span
            style={{
              color: COLORS.darkNavy,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            Download Now
          </span>
        </div>
      </div>

      {/* Website URL */}
      <div
        style={{
          marginTop: 40,
          opacity: ctaOpacity,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: COLORS.grey, fontSize: 20 }}>Visit</span>
        <span
          style={{
            color: COLORS.cyan,
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          neurogutai.com
        </span>
      </div>

      {/* Bottom badges */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          display: "flex",
          gap: 40,
          opacity: ctaOpacity,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 24px",
            backgroundColor: `${COLORS.darkNavy2}`,
            borderRadius: 30,
            border: `1px solid ${COLORS.grey}20`,
          }}
        >
          <span style={{ fontSize: 20 }}>🇦🇺</span>
          <span style={{ color: COLORS.light, fontSize: 14 }}>Made in Australia</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 24px",
            backgroundColor: `${COLORS.darkNavy2}`,
            borderRadius: 30,
            border: `1px solid ${COLORS.grey}20`,
          }}
        >
          <span style={{ fontSize: 20 }}>🔒</span>
          <span style={{ color: COLORS.light, fontSize: 14 }}>Privacy First</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 24px",
            backgroundColor: `${COLORS.darkNavy2}`,
            borderRadius: 30,
            border: `1px solid ${COLORS.grey}20`,
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ color: COLORS.light, fontSize: 14 }}>5 Min Daily</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
