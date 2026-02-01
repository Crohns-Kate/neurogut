import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig, staticFile } from "remotion";
import { FadingAudio } from "./components/FadingAudio";

// Import new walkthrough scenes
import { WalkthroughIntro } from "./scenes/walkthrough/WalkthroughIntro";
import { HomeScreenScene } from "./scenes/walkthrough/HomeScreenScene";
import { PlacementScene } from "./scenes/walkthrough/PlacementScene";
import { RecordingScene } from "./scenes/walkthrough/RecordingScene";
import { AnalysisScene } from "./scenes/walkthrough/AnalysisScene";
import { ResultsScene } from "./scenes/walkthrough/ResultsScene";
import { VagalScoreExplained } from "./scenes/walkthrough/VagalScoreExplained";
import { WalkthroughOutro } from "./scenes/walkthrough/WalkthroughOutro";

/**
 * App Walkthrough Demo Video
 * A compelling explainer showing how the NeuroGut app works
 * Total Duration: ~110 seconds (with 1.5s gaps between scenes)
 * Voice: Charlotte (Australian) - ID: aRlmTYIQo6Tlg5SlulGC
 */

// Gap between scenes (in seconds)
const SCENE_GAP = 1.5;

export const WALKTHROUGH_SCRIPT = {
  intro: {
    text: "Let's take a journey through NeuroGut Acoustics. In less than five minutes a day, you'll gain unprecedented insight into your gut-brain connection.",
    startTime: 0,
    duration: 10,
  },
  home: {
    text: "When you open the app, you're greeted with your personal dashboard. Here you'll see your Vagal Readiness Score, recent sessions, and a clear call to action for your daily check-in.",
    startTime: 10 + SCENE_GAP,        // 11.5
    duration: 12,
  },
  placement: {
    text: "Before recording, our guided placement system helps you position your device correctly. We target the lower right quadrant of your abdomen, directly over the ileocecal valve, the gateway between your small and large intestine.",
    startTime: 23.5 + SCENE_GAP,      // 25
    duration: 14,
  },
  recording: {
    text: "During the recording, you'll see real-time feedback. The anatomical mirror visualizes your gut sounds as they happen, while our signal quality indicator ensures you're capturing clean acoustic data.",
    startTime: 39 + SCENE_GAP,        // 40.5
    duration: 13,
  },
  analysis: {
    text: "Once complete, our proprietary Insight Engine processes your recording. Advanced signal analysis extracts motility patterns, identifies borborygmi events, and measures the rhythmic signatures of your digestive system.",
    startTime: 53.5 + SCENE_GAP,      // 55
    duration: 14,
  },
  results: {
    text: "Your results arrive in seconds. See your gut activity level, sound event timeline, and personalized insights. Every session builds your baseline, helping the app understand what's normal for you.",
    startTime: 69 + SCENE_GAP,        // 70.5
    duration: 12,
  },
  vagal: {
    text: "The Vagal Readiness Score is your headline metric. It combines acoustic patterns, breathing response, and contextual factors to quantify your autonomic balance. This isn't just data. It's your personal window into gut-brain wellness.",
    startTime: 82.5 + SCENE_GAP,      // 84
    duration: 15,
  },
  outro: {
    text: "Start your journey today. Download NeuroGut Acoustics and listen to what your gut is telling you.",
    startTime: 99 + SCENE_GAP,        // 100.5
    duration: 8,
  },
};

export const WALKTHROUGH_DURATION_SECONDS = 110;

export const AppWalkthrough: React.FC = () => {
  const { fps } = useVideoConfig();

  const toFrames = (seconds: number): number => {
    if (!fps || fps <= 0 || !isFinite(fps)) return 0;
    if (!isFinite(seconds) || seconds < 0) return 0;
    return Math.max(0, Math.min(Math.round(seconds * fps), 2147483647));
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#020617",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Voiceover Audio - Charlotte Australian voice */}
      <FadingAudio
        src={staticFile("audio/walkthrough/intro.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.intro.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.intro.duration)}
        fadeInDuration={0.1}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/home.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.home.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.home.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/placement.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.placement.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.placement.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/recording.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.recording.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.recording.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/analysis.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.analysis.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.analysis.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/results.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.results.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.results.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/vagal.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.vagal.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.vagal.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0.3}
      />
      <FadingAudio
        src={staticFile("audio/walkthrough/outro.mp3")}
        startFrame={toFrames(WALKTHROUGH_SCRIPT.outro.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.outro.duration)}
        fadeInDuration={0.3}
        fadeOutDuration={0}
      />

      {/* Scene 1: Introduction */}
      <Sequence from={0} durationInFrames={toFrames(WALKTHROUGH_SCRIPT.intro.duration)}>
        <WalkthroughIntro />
      </Sequence>

      {/* Scene 2: Home Screen */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.home.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.home.duration)}
      >
        <HomeScreenScene />
      </Sequence>

      {/* Scene 3: Device Placement */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.placement.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.placement.duration)}
      >
        <PlacementScene />
      </Sequence>

      {/* Scene 4: Recording in Progress */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.recording.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.recording.duration)}
      >
        <RecordingScene />
      </Sequence>

      {/* Scene 5: Analysis Processing */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.analysis.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.analysis.duration)}
      >
        <AnalysisScene />
      </Sequence>

      {/* Scene 6: Results Display */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.results.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.results.duration)}
      >
        <ResultsScene />
      </Sequence>

      {/* Scene 7: Vagal Score Explained */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.vagal.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.vagal.duration)}
      >
        <VagalScoreExplained />
      </Sequence>

      {/* Scene 8: Outro */}
      <Sequence
        from={toFrames(WALKTHROUGH_SCRIPT.outro.startTime)}
        durationInFrames={toFrames(WALKTHROUGH_SCRIPT.outro.duration)}
      >
        <WalkthroughOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
