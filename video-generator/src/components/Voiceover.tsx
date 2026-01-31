import React from "react";
import { Audio } from "remotion";

interface VoiceoverProps {
  src: string;
  startFrom?: number;
  volume?: number;
}

/**
 * Voiceover component that plays audio synchronized with video
 */
export const Voiceover: React.FC<VoiceoverProps> = ({
  src,
  startFrom = 0,
  volume = 1,
}) => {
  return <Audio src={src} startFrom={startFrom} volume={volume} />;
};
