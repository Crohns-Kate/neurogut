import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

export const ProtocolsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: 1,
  });

  // Protocol cards appear sequentially
  const card1Opacity = interpolate(frame, [0, 20], [0, 1]);
  const card2Opacity = interpolate(frame, [30, 50], [0, 1]);
  const card3Opacity = interpolate(frame, [60, 80], [0, 1]);

  const card1Y = spring({
    frame: frame - 0,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 50,
    to: 0,
  });

  const card2Y = spring({
    frame: frame - 30,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 50,
    to: 0,
  });

  const card3Y = spring({
    frame: frame - 60,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 50,
    to: 0,
  });

  return (
    <AbsoluteFill 
      className="bg-[#0D0D10] text-white"
      style={{
        backgroundColor: "#0D0D10",
        color: "white",
      }}
    >
      <div 
        className="absolute inset-0 bg-gradient-to-br from-[#0D0D10] via-[#16161A] to-[#0D0D10]"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to bottom right, #0D0D10, #16161A, #0D0D10)",
        }}
      />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-16"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "4rem",
          paddingRight: "4rem",
          opacity: fadeIn,
        }}
      >
        <h2
          className="text-5xl font-bold mb-12"
          style={{
            fontSize: "3rem",
            fontWeight: "bold",
            marginBottom: "3rem",
            fontFamily: "Space Grotesk, sans-serif",
            opacity: interpolate(frame, [0, 30], [0, 1]),
          }}
        >
          Three Simple Protocols
        </h2>

        <div 
          className="flex gap-8"
          style={{
            display: "flex",
            gap: "2rem",
          }}
        >
          {/* Quick Check */}
          <div
            className="bg-[#1A1A1F] rounded-2xl p-8 w-80 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "2rem",
              width: "20rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: card1Opacity,
              transform: `translateY(${card1Y}px)`,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>⚡</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.5rem" }}>Quick Check</h3>
            <p style={{ color: "#14B8A6", fontSize: "1.125rem" }}>3 minutes</p>
            <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginTop: "0.5rem" }}>Fast scan</p>
          </div>

          {/* Post-Meal */}
          <div
            className="bg-[#1A1A1F] rounded-2xl p-8 w-80 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "2rem",
              width: "20rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: card2Opacity,
              transform: `translateY(${card2Y}px)`,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>🍽️</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.5rem" }}>Post-Meal</h3>
            <p style={{ color: "#14B8A6", fontSize: "1.125rem" }}>5 minutes</p>
            <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginTop: "0.5rem" }}>Track digestion</p>
          </div>

          {/* Mind-Body */}
          <div
            className="bg-[#1A1A1F] rounded-2xl p-8 w-80 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "2rem",
              width: "20rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: card3Opacity,
              transform: `translateY(${card3Y}px)`,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>🧘</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.5rem" }}>Mind-Body</h3>
            <p style={{ color: "#14B8A6", fontSize: "1.125rem" }}>3 minutes</p>
            <p style={{ color: "#9CA3AF", fontSize: "0.875rem", marginTop: "0.5rem" }}>Relaxation sessions</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
