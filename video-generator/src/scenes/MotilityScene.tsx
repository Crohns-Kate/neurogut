import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

export const MotilityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: 1,
  });

  // Motility Index counts up
  const motilityValue = interpolate(frame, [30, 120], [0, 72], {
    extrapolateRight: "clamp",
  });

  // Timeline bars animate - use deterministic values instead of random
  const barHeights = [0.65, 0.45, 0.72, 0.38, 0.85, 0.52, 0.68, 0.41, 0.76, 0.59];
  const bars = Array.from({ length: 10 }, (_, i) => {
    return interpolate(
      frame,
      [60 + i * 8, 90 + i * 8],
      [0, barHeights[i]],
      {
        extrapolateRight: "clamp",
      }
    );
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
        {/* Motility Index */}
        <div
          className="bg-[#1A1A1F] rounded-3xl p-10 mb-12 border border-[#14B8A6]/20 w-full max-w-3xl"
          style={{
            opacity: interpolate(frame, [0, 30], [0, 1]),
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-3xl font-semibold">Motility Index</h3>
            <div
              className="px-6 py-3 rounded-full text-base font-medium"
              style={{
                backgroundColor: "#14B8A6",
                color: "#0D0D10",
              }}
            >
              Normal
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div
              className="text-8xl font-bold"
              style={{ color: "#14B8A6" }}
            >
              {Math.round(motilityValue)}
            </div>
            <div className="text-4xl text-gray-400 mb-4">/100</div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div
          className="bg-[#1A1A1F] rounded-3xl p-8 border border-[#14B8A6]/20 w-full max-w-5xl"
          style={{
            backgroundColor: "#1A1A1F",
            borderRadius: "1.5rem",
            padding: "2rem",
            border: "1px solid rgba(20, 184, 166, 0.2)",
            width: "100%",
            maxWidth: "64rem",
            opacity: interpolate(frame, [60, 90], [0, 1]),
          }}
        >
          <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1.5rem" }}>Activity Timeline</h3>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "0.5rem", height: "12rem" }}>
            {bars.map((height, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: "32px",
                  background: "linear-gradient(to top, #14B8A6, rgba(20, 184, 166, 0.6))",
                  borderTopLeftRadius: "0.5rem",
                  borderTopRightRadius: "0.5rem",
                  height: `${Math.max(height * 100, 4)}%`,
                  opacity: height > 0 ? 1 : 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
