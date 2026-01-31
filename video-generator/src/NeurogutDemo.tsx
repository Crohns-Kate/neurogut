import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig, staticFile } from "remotion";
import { HeroIntro } from "./scenes/HeroIntro";
import { FounderScene } from "./scenes/FounderScene";
import { AnatomicalScene } from "./scenes/AnatomicalScene";
import { InsightEngineScene } from "./scenes/InsightEngineScene";
import { VagalScoreScene } from "./scenes/VagalScoreScene";
import { Outro } from "./scenes/Outro";
import { NARRATION_SCRIPT } from "./utils/elevenlabs";
import { FadingAudio } from "./components/FadingAudio";

export const NeurogutDemo: React.FC = () => {
  const { fps } = useVideoConfig();

  // Convert seconds to frames with validation
  const toFrames = (seconds: number): number => {
    if (!fps || fps <= 0 || !isFinite(fps)) {
      console.error("Invalid fps:", fps);
      return 0;
    }
    if (!isFinite(seconds) || seconds < 0) {
      console.error("Invalid seconds:", seconds);
      return 0;
    }
    const frames = Math.round(seconds * fps);
    // Clamp to safe 32-bit signed integer range
    return Math.max(0, Math.min(frames, 2147483647));
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#020617",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Voiceover Audio - Charlotte Australian voice (ID: aRlmTYIQo6Tlg5SlulGC) */}
      <FadingAudio
        src={staticFile("audio/intro.mp3")}
        startFrame={toFrames(NARRATION_SCRIPT.intro.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.intro.duration)}
        fadeInDuration={0.1}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/founder.mp3")}
        startFrame={toFrames(NARRATION_SCRIPT.founder.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.founder.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/anatomical.mp3")}
        startFrame={toFrames(NARRATION_SCRIPT.anatomical.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.anatomical.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/engine.mp3")}
        startFrame={toFrames(NARRATION_SCRIPT.engine.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.engine.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/vrs.mp3")}
        startFrame={toFrames(NARRATION_SCRIPT.vrs.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.vrs.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/outro.mp3")}
        startFrame={toFrames(NARRATION_SCRIPT.outro.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.outro.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0}
      />

      {/* Scene 1: Hero Introduction (0-10s) */}
      <Sequence
        from={0}
        durationInFrames={toFrames(NARRATION_SCRIPT.intro.duration)}
      >
        <HeroIntro />
      </Sequence>

      {/* Scene 2: Founder - Dr Michael Bishopp (10-24s) */}
      <Sequence
        from={toFrames(NARRATION_SCRIPT.founder.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.founder.duration)}
      >
        <FounderScene />
      </Sequence>

      {/* Scene 3: Anatomical Standard (24-36s) */}
      <Sequence
        from={toFrames(NARRATION_SCRIPT.anatomical.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.anatomical.duration)}
      >
        <AnatomicalScene />
      </Sequence>

      {/* Scene 4: Insight Engine (36-47s) */}
      <Sequence
        from={toFrames(NARRATION_SCRIPT.engine.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.engine.duration)}
      >
        <InsightEngineScene />
      </Sequence>

      {/* Scene 5: Vagal Readiness Score (47-60s) */}
      <Sequence
        from={toFrames(NARRATION_SCRIPT.vrs.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.vrs.duration)}
      >
        <VagalScoreScene />
      </Sequence>

      {/* Scene 6: Outro (60-65s) */}
      <Sequence
        from={toFrames(NARRATION_SCRIPT.outro.startTime)}
        durationInFrames={toFrames(NARRATION_SCRIPT.outro.duration)}
      >
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
