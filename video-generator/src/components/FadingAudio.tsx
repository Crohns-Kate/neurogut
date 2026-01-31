import React from "react";
import { Audio, Sequence, useCurrentFrame, interpolate, useVideoConfig } from "remotion";

interface FadingAudioProps {
  src: string;
  startFrame: number;
  durationInFrames: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export const FadingAudio: React.FC<FadingAudioProps> = ({
  src,
  startFrame,
  durationInFrames,
  fadeInDuration = 0.2,
  fadeOutDuration = 0.3,
}) => {
  const { fps } = useVideoConfig();

  const fadeInFrames = Math.round(fadeInDuration * fps);
  const fadeOutFrames = Math.round(fadeOutDuration * fps);

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <FadingAudioInner
        src={src}
        durationInFrames={durationInFrames}
        fadeInFrames={fadeInFrames}
        fadeOutFrames={fadeOutFrames}
      />
    </Sequence>
  );
};

interface FadingAudioInnerProps {
  src: string;
  durationInFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
}

const FadingAudioInner: React.FC<FadingAudioInnerProps> = ({
  src,
  durationInFrames,
  fadeInFrames,
  fadeOutFrames,
}) => {
  const frame = useCurrentFrame();

  // Calculate volume based on fade in/out
  let volume = 1;

  // Fade in
  if (frame < fadeInFrames) {
    volume = interpolate(frame, [0, fadeInFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Fade out
  const fadeOutStart = durationInFrames - fadeOutFrames;
  if (frame > fadeOutStart) {
    volume = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return <Audio src={src} volume={volume} />;
};
