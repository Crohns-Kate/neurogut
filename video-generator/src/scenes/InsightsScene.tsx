import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

export const InsightsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const insight1Opacity = interpolate(frame, [0, 30], [0, 1]);
  const insight2Opacity = interpolate(frame, [40, 70], [0, 1]);
  const insight3Opacity = interpolate(frame, [80, 110], [0, 1]);

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
            fontFamily: "Space Grotesk, sans-serif",
            opacity: interpolate(frame, [0, 30], [0, 1]),
          }}
        >
          AI-Powered Insights
        </h2>

        <div className="grid grid-cols-2 gap-6 w-full max-w-6xl">
          {/* Protocol Comparison */}
          <div
            className="bg-[#1A1A1F] rounded-2xl p-8 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "2rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: insight1Opacity,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>⚖️</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.75rem" }}>Compare Protocols</h3>
            <p style={{ color: "#9CA3AF" }}>
              Post-Meal shows 40% higher motility than Quick Check
            </p>
          </div>

          {/* Stress Patterns */}
          <div
            className="bg-[#1A1A1F] rounded-2xl p-8 border border-[#14B8A6]/20"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "2rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              opacity: insight2Opacity,
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "1rem" }}>📈</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.75rem" }}>Discover Patterns</h3>
            <p style={{ color: "#9CA3AF" }}>
              Higher stress (6+) correlates with 25% lower gut activity
            </p>
          </div>

          {/* Gut-Brain Connection */}
          <div
            className="bg-[#1A1A1F] rounded-2xl p-8 border border-[#14B8A6]/20 col-span-2"
            style={{
              backgroundColor: "#1A1A1F",
              borderRadius: "1rem",
              padding: "2rem",
              border: "1px solid rgba(20, 184, 166, 0.2)",
              gridColumn: "span 2",
              opacity: insight3Opacity,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem" }}>
              <div style={{ fontSize: "2.25rem" }}>🧠</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "0.75rem" }}>
                  Understand Your Gut-Brain Connection
                </h3>
                <p style={{ color: "#9CA3AF", fontSize: "1.125rem" }}>
                  Track how your mind and body communicate through consistent
                  monitoring
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
