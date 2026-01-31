import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

export const ContextScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: 1,
  });

  // Tags appear sequentially
  const tag1Opacity = interpolate(frame, [0, 20], [0, 1]);
  const tag2Opacity = interpolate(frame, [30, 50], [0, 1]);
  const tag3Opacity = interpolate(frame, [60, 80], [0, 1]);

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
          Tag Your Context
        </h2>

        <div 
          className="flex gap-6"
          style={{
            display: "flex",
            gap: "1.5rem",
          }}
        >
          <div
            className="bg-[#14B8A6]/10 border-2 border-[#14B8A6] rounded-2xl p-6 w-64"
            style={{
              backgroundColor: "rgba(20, 184, 166, 0.1)",
              border: "2px solid #14B8A6",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "16rem",
              opacity: tag1Opacity,
            }}
          >
            <div style={{ fontSize: "1.875rem", marginBottom: "0.75rem" }}>🍽️</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>Meal Timing</h3>
            <p style={{ color: "#14B8A6" }}>1-2 hours ago</p>
          </div>

          <div
            className="bg-[#14B8A6]/10 border-2 border-[#14B8A6] rounded-2xl p-6 w-64"
            style={{
              backgroundColor: "rgba(20, 184, 166, 0.1)",
              border: "2px solid #14B8A6",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "16rem",
              opacity: tag2Opacity,
            }}
          >
            <div style={{ fontSize: "1.875rem", marginBottom: "0.75rem" }}>📊</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>Stress Level</h3>
            <p style={{ color: "#14B8A6" }}>3 out of 10</p>
          </div>

          <div
            className="bg-[#14B8A6]/10 border-2 border-[#14B8A6] rounded-2xl p-6 w-64"
            style={{
              backgroundColor: "rgba(20, 184, 166, 0.1)",
              border: "2px solid #14B8A6",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "16rem",
              opacity: tag3Opacity,
            }}
          >
            <div style={{ fontSize: "1.875rem", marginBottom: "0.75rem" }}>🪑</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>Posture</h3>
            <p style={{ color: "#14B8A6" }}>Sitting</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
