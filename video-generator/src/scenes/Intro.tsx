import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animations
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const taglineOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineY = spring({
    frame: frame - 30,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 20,
    to: 0,
  });

  return (
    <AbsoluteFill 
      className="flex items-center justify-center text-white"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        backgroundColor: '#0D0D10',
      }}
    >
      {/* Background gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-[#0D0D10] via-[#16161A] to-[#0D0D10]"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom right, #0D0D10, #16161A, #0D0D10)',
        }}
      />

      {/* App Icon/Logo */}
      <div
        className="text-8xl mb-8"
        style={{
          fontSize: '6rem',
          marginBottom: '2rem',
          transform: `scale(${titleScale})`,
          opacity: titleScale,
        }}
      >
        🌿
      </div>

      {/* App Name */}
      <h1
        className="text-7xl font-bold text-white mb-4"
        style={{
          fontSize: '4.5rem',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '1rem',
          transform: `scale(${titleScale})`,
          opacity: titleScale,
          fontFamily: "Space Grotesk, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        Neurogut
      </h1>

      {/* Tagline */}
      <p
        className="text-3xl text-[#14B8A6] font-medium"
        style={{
          fontSize: '1.875rem',
          color: '#14B8A6',
          fontWeight: '500',
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: "Space Grotesk, sans-serif",
        }}
      >
        Your gut-brain wellness companion
      </p>

      {/* Decorative accent line */}
      <div
        className="absolute bottom-32 w-32 h-1 bg-[#14B8A6] rounded-full"
        style={{
          opacity: interpolate(frame, [90, 120], [0, 1]),
          transform: `scaleX(${interpolate(frame, [90, 120], [0, 1])})`,
        }}
      />
    </AbsoluteFill>
  );
};
