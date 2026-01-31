import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

export const SymptomsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const symptom1Opacity = interpolate(frame, [0, 20], [0, 1]);
  const symptom2Opacity = interpolate(frame, [20, 40], [0, 1]);
  const symptom3Opacity = interpolate(frame, [40, 60], [0, 1]);
  const symptom4Opacity = interpolate(frame, [60, 80], [0, 1]);

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
          Daily Symptom Tracking
        </h2>

        <div 
          className="flex gap-6"
          style={{
            display: "flex",
            gap: "1.5rem",
          }}
        >
          <div
            className="bg-[#1A1A1F] rounded-2xl p-6 w-56 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "14rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: symptom1Opacity,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>⚡</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Energy</h3>
            <p style={{ color: "#14B8A6", marginTop: "0.5rem" }}>7/10</p>
          </div>

          <div
            className="bg-[#1A1A1F] rounded-2xl p-6 w-56 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "14rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: symptom2Opacity,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>😊</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Mood</h3>
            <p style={{ color: "#14B8A6", marginTop: "0.5rem" }}>Positive</p>
          </div>

          <div
            className="bg-[#1A1A1F] rounded-2xl p-6 w-56 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "14rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: symptom3Opacity,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>💨</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Bloating</h3>
            <p style={{ color: "#14B8A6", marginTop: "0.5rem" }}>Low</p>
          </div>

          <div
            className="bg-[#1A1A1F] rounded-2xl p-6 w-56 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "1.5rem",
              width: "14rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: symptom4Opacity,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>📊</div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Pain</h3>
            <p style={{ color: "#14B8A6", marginTop: "0.5rem" }}>None</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
