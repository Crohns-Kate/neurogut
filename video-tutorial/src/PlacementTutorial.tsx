/**
 * PlacementTutorial - Remotion Video Composition
 *
 * Animated tutorial showing phone placement on LRQ (Lower Right Quadrant).
 * Features anatomical torso silhouette with step-by-step animations.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence, Audio } from "remotion";

// Theme colors (matching Neurogut theme)
const colors = {
  background: "#0D0D10",
  backgroundCard: "#1A1A1F",
  accent: "#00C9A7",
  accentDim: "rgba(0, 201, 167, 0.15)",
  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0A5",
  textMuted: "#6B6B70",
  success: "#22C55E",
  border: "#2A2A2F",
};

// Anatomical positions
const BELLY_BUTTON = { x: 400, y: 300 };
const LRQ_CENTER = { x: 320, y: 420 }; // User's right = screen left (mirrored view)

interface TorsoSilhouetteProps {
  highlightLRQ: boolean;
  showArrow: boolean;
  arrowProgress: number;
  phoneVisible: boolean;
  phoneProgress: number;
}

/**
 * Animated torso silhouette with LRQ highlight
 */
function TorsoSilhouette({ highlightLRQ, showArrow, arrowProgress, phoneVisible, phoneProgress }: TorsoSilhouetteProps) {
  const frame = useCurrentFrame();
  const pulseScale = 1 + 0.1 * Math.sin(frame * 0.1);

  return (
    <svg width="800" height="700" viewBox="0 0 800 700">
      {/* Background gradient */}
      <defs>
        <linearGradient id="torsoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a1a1f" />
          <stop offset="100%" stopColor="#0d0d10" />
        </linearGradient>
        <radialGradient id="lrqGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Torso outline */}
      <path
        d="M 300 80
           Q 250 120 230 180
           L 210 300
           Q 200 400 210 500
           L 230 600
           L 280 650
           L 520 650
           L 570 600
           L 590 500
           Q 600 400 590 300
           L 570 180
           Q 550 120 500 80
           Z"
        fill="url(#torsoGradient)"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="3"
      />

      {/* Ribcage lines */}
      <path d="M 260 180 Q 400 170 540 180" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <path d="M 250 220 Q 400 210 550 220" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <path d="M 240 260 Q 400 250 560 260" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />

      {/* Center line (Linea Alba) */}
      <line
        x1="400"
        y1="100"
        x2="400"
        y2="600"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        strokeDasharray="5,10"
      />

      {/* Pelvic curve */}
      <path d="M 250 550 Q 400 620 550 550" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />

      {/* Belly button */}
      <circle cx={BELLY_BUTTON.x} cy={BELLY_BUTTON.y} r="12" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <text x={BELLY_BUTTON.x} y={BELLY_BUTTON.y - 25} fill={colors.textSecondary} fontSize="16" textAnchor="middle" fontFamily="sans-serif">
        Belly Button
      </text>

      {/* LRQ Target Zone */}
      {highlightLRQ && (
        <>
          {/* Glow effect */}
          <circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r="80" fill="url(#lrqGlow)" />

          {/* Pulsing outer ring */}
          <circle
            cx={LRQ_CENTER.x}
            cy={LRQ_CENTER.y}
            r={50 * pulseScale}
            fill="none"
            stroke={colors.accent}
            strokeWidth="3"
            strokeDasharray="8,4"
            opacity={0.7}
          />

          {/* Inner ring */}
          <circle
            cx={LRQ_CENTER.x}
            cy={LRQ_CENTER.y}
            r="35"
            fill="none"
            stroke={colors.accent}
            strokeWidth="2.5"
            opacity={0.9}
          />

          {/* Center dot */}
          <circle cx={LRQ_CENTER.x} cy={LRQ_CENTER.y} r="10" fill={colors.accent} opacity="0.9" />

          {/* Crosshairs */}
          <line x1={LRQ_CENTER.x - 25} y1={LRQ_CENTER.y} x2={LRQ_CENTER.x - 12} y2={LRQ_CENTER.y} stroke={colors.accent} strokeWidth="2" opacity="0.6" />
          <line x1={LRQ_CENTER.x + 12} y1={LRQ_CENTER.y} x2={LRQ_CENTER.x + 25} y2={LRQ_CENTER.y} stroke={colors.accent} strokeWidth="2" opacity="0.6" />
          <line x1={LRQ_CENTER.x} y1={LRQ_CENTER.y - 25} x2={LRQ_CENTER.x} y2={LRQ_CENTER.y - 12} stroke={colors.accent} strokeWidth="2" opacity="0.6" />
          <line x1={LRQ_CENTER.x} y1={LRQ_CENTER.y + 12} x2={LRQ_CENTER.x} y2={LRQ_CENTER.y + 25} stroke={colors.accent} strokeWidth="2" opacity="0.6" />

          {/* LRQ Label */}
          <text x={LRQ_CENTER.x} y={LRQ_CENTER.y + 75} fill={colors.accent} fontSize="18" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">
            Lower Right Quadrant (LRQ)
          </text>
        </>
      )}

      {/* Animated arrow from belly button to LRQ */}
      {showArrow && (
        <>
          <path
            d={`M ${BELLY_BUTTON.x} ${BELLY_BUTTON.y + 20} Q ${370} ${360} ${LRQ_CENTER.x + 30} ${LRQ_CENTER.y - 20}`}
            fill="none"
            stroke={colors.accent}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="200"
            strokeDashoffset={200 - 200 * arrowProgress}
          />
          {/* Arrowhead */}
          {arrowProgress > 0.9 && (
            <path
              d={`M ${LRQ_CENTER.x + 20} ${LRQ_CENTER.y - 35} L ${LRQ_CENTER.x + 30} ${LRQ_CENTER.y - 20} L ${LRQ_CENTER.x + 15} ${LRQ_CENTER.y - 10}`}
              fill="none"
              stroke={colors.accent}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      )}

      {/* Phone illustration */}
      {phoneVisible && (
        <g transform={`translate(${LRQ_CENTER.x - 40}, ${LRQ_CENTER.y - 80}) scale(${phoneProgress})`} opacity={phoneProgress}>
          {/* Phone body */}
          <rect x="0" y="0" width="80" height="140" rx="10" fill="#2a2a2f" stroke="#444" strokeWidth="2" />
          {/* Screen */}
          <rect x="5" y="15" width="70" height="110" rx="5" fill="#1a1a1f" />
          {/* Camera/mic indicator */}
          <circle cx="40" cy="8" r="3" fill="#555" />
          {/* Mic waves */}
          <circle cx="40" cy="70" r="15" fill="none" stroke={colors.accent} strokeWidth="2" opacity="0.3" />
          <circle cx="40" cy="70" r="25" fill="none" stroke={colors.accent} strokeWidth="1.5" opacity="0.2" />
          <circle cx="40" cy="70" r="35" fill="none" stroke={colors.accent} strokeWidth="1" opacity="0.1" />
        </g>
      )}
    </svg>
  );
}

/**
 * Step indicator component
 */
function StepIndicator({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 30 }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === step ? 32 : 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: i + 1 === step ? colors.accent : i + 1 < step ? colors.success : colors.border,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Text overlay component
 */
function TextOverlay({ title, description, visible }: { title: string; description: string; visible: boolean }) {
  const opacity = visible ? 1 : 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        padding: "0 60px",
        opacity,
        transition: "opacity 0.5s ease",
      }}
    >
      <h2
        style={{
          fontSize: 36,
          fontWeight: "bold",
          color: colors.textPrimary,
          textAlign: "center",
          marginBottom: 16,
          fontFamily: "sans-serif",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 22,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 1.5,
          fontFamily: "sans-serif",
        }}
      >
        {description}
      </p>
    </div>
  );
}

/**
 * Main composition
 */
export const PlacementTutorial: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timing (in frames at 30fps)
  const INTRO_START = 0;
  const INTRO_END = 4 * fps; // 4 seconds

  const STEP1_START = INTRO_END;
  const STEP1_END = STEP1_START + 4 * fps; // 4 seconds

  const STEP2_START = STEP1_END;
  const STEP2_END = STEP2_START + 7 * fps; // 7 seconds

  const STEP3_START = STEP2_END;
  const STEP3_END = STEP3_START + 7 * fps; // 7 seconds

  const OUTRO_START = STEP3_END;

  // Calculate current step
  const currentStep =
    frame < STEP1_START ? 0 :
    frame < STEP2_START ? 1 :
    frame < STEP3_START ? 2 :
    frame < OUTRO_START ? 3 : 4;

  // Animation progress values
  const arrowProgress = interpolate(
    frame,
    [STEP2_START, STEP2_START + 2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const phoneProgress = interpolate(
    frame,
    [STEP3_START, STEP3_START + 1.5 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Step content
  const steps = [
    { title: "Phone Placement Guide", description: "Learn the correct position for accurate gut sound recording." },
    { title: "Step 1: Find Your Reference Point", description: "Locate your belly button. This is your starting point." },
    { title: "Step 2: Move to LRQ", description: "Move 2-3 inches down and to YOUR right. This is the Lower Right Quadrant where gut sounds are clearest." },
    { title: "Step 3: Apply Pressure", description: "Press the phone firmly against your skin with steady, gentle pressure. Keep it still during recording." },
    { title: "Perfect!", description: "Hold this position during your recording session. Stay still and relaxed for the best results." },
  ];

  const currentContent = steps[currentStep] || steps[0];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Step indicator */}
      <div style={{ position: "absolute", top: 40, left: 0, right: 0 }}>
        <StepIndicator step={Math.max(1, currentStep)} totalSteps={4} />
      </div>

      {/* Torso visualization */}
      <div style={{ marginTop: -40 }}>
        <TorsoSilhouette
          highlightLRQ={currentStep >= 1}
          showArrow={currentStep >= 2}
          arrowProgress={arrowProgress}
          phoneVisible={currentStep >= 3}
          phoneProgress={phoneProgress}
        />
      </div>

      {/* Text overlay */}
      <TextOverlay
        title={currentContent.title}
        description={currentContent.description}
        visible={true}
      />

      {/* Audio tracks (if available) */}
      {/*
      <Sequence from={INTRO_START} durationInFrames={INTRO_END - INTRO_START}>
        <Audio src={require("./audio/intro.mp3")} />
      </Sequence>
      <Sequence from={STEP1_START} durationInFrames={STEP1_END - STEP1_START}>
        <Audio src={require("./audio/step1.mp3")} />
      </Sequence>
      <Sequence from={STEP2_START} durationInFrames={STEP2_END - STEP2_START}>
        <Audio src={require("./audio/step2.mp3")} />
      </Sequence>
      <Sequence from={STEP3_START} durationInFrames={STEP3_END - STEP3_START}>
        <Audio src={require("./audio/step3.mp3")} />
      </Sequence>
      <Sequence from={OUTRO_START}>
        <Audio src={require("./audio/outro.mp3")} />
      </Sequence>
      */}
    </AbsoluteFill>
  );
};
