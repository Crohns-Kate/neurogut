/**
 * SessionContext - Recording Session State Management
 *
 * Tracks the current phase of a recording session to prevent state loops.
 * Phases: Instruction -> Primer -> Calibration -> Recording
 *
 * Once a user selects a mode (Standard, Humming, Cold, Gargle), the app
 * stays on that track without resetting to the original screen.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { VagalIntervention } from "../models/session";

/**
 * Session phases in order of progression
 */
export type SessionPhase =
  | "idle"           // No session active
  | "instruction"    // PlacementGuide steps 1-2
  | "primer"         // Pre-Recording Vagal Primer (humming audio, etc.)
  | "calibration"    // Silence/Signal check (PlacementGuide step 3)
  | "recording"      // Active recording
  | "processing"     // Post-recording analytics
  | "complete";      // Session finished

/**
 * Selected recording mode/track
 */
export type RecordingMode =
  | "standard"       // No intervention
  | "humming"        // Humming vagal intervention
  | "deep_breathing" // 4-7-8 breathing
  | "cold_exposure"  // Cold exposure
  | "gargling";      // Gargling

/**
 * Session context state
 */
interface SessionContextState {
  /** Current phase of the session */
  currentPhase: SessionPhase;
  /** Selected recording mode/intervention track */
  selectedMode: RecordingMode;
  /** Whether the session is locked to a track (prevents mode changes) */
  isTrackLocked: boolean;
  /** Session start timestamp */
  sessionStartTime: number | null;
  /** Primer completion status */
  primerCompleted: boolean;
  /** Calibration completion status */
  calibrationCompleted: boolean;
  /** Selected intervention from session context */
  intervention: VagalIntervention | null;
}

/**
 * Session context actions
 */
interface SessionContextActions {
  /** Start a new session with a specific mode */
  startSession: (mode: RecordingMode, intervention?: VagalIntervention) => void;
  /** Advance to the next phase */
  advancePhase: () => void;
  /** Set the current phase directly (for navigation recovery) */
  setPhase: (phase: SessionPhase) => void;
  /** Mark primer as completed */
  completePrimer: () => void;
  /** Mark calibration as completed */
  completeCalibration: () => void;
  /** Reset the session to idle */
  resetSession: () => void;
  /** Check if we can advance from current phase */
  canAdvance: () => boolean;
  /** Get the next phase based on current state */
  getNextPhase: () => SessionPhase;
}

type SessionContextValue = SessionContextState & SessionContextActions;

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Map VagalIntervention to RecordingMode
 */
function interventionToMode(intervention: VagalIntervention | null): RecordingMode {
  if (!intervention || intervention === "None") return "standard";
  switch (intervention) {
    case "Humming": return "humming";
    case "Deep Breathing": return "deep_breathing";
    case "Cold Exposure": return "cold_exposure";
    case "Gargling": return "gargling";
    default: return "standard";
  }
}

/**
 * Determine the next phase in the session flow
 */
function getNextPhaseFromCurrent(
  currentPhase: SessionPhase,
  selectedMode: RecordingMode,
  primerCompleted: boolean,
  calibrationCompleted: boolean
): SessionPhase {
  switch (currentPhase) {
    case "idle":
      return "instruction";

    case "instruction":
      // After instructions, go to primer if intervention selected, else calibration
      if (selectedMode !== "standard") {
        return "primer";
      }
      return "calibration";

    case "primer":
      return "calibration";

    case "calibration":
      return "recording";

    case "recording":
      return "processing";

    case "processing":
      return "complete";

    case "complete":
      return "idle";

    default:
      return "idle";
  }
}

/**
 * SessionProvider - Context provider for session state management
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [currentPhase, setCurrentPhase] = useState<SessionPhase>("idle");
  const [selectedMode, setSelectedMode] = useState<RecordingMode>("standard");
  const [isTrackLocked, setIsTrackLocked] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [primerCompleted, setPrimerCompleted] = useState(false);
  const [calibrationCompleted, setCalibrationCompleted] = useState(false);
  const [intervention, setIntervention] = useState<VagalIntervention | null>(null);

  const startSession = useCallback((mode: RecordingMode, interventionType?: VagalIntervention) => {
    setSelectedMode(mode);
    setIsTrackLocked(true); // Lock the track once session starts
    setSessionStartTime(Date.now());
    setCurrentPhase("instruction");
    setPrimerCompleted(false);
    setCalibrationCompleted(false);
    setIntervention(interventionType || null);
  }, []);

  const getNextPhase = useCallback((): SessionPhase => {
    return getNextPhaseFromCurrent(
      currentPhase,
      selectedMode,
      primerCompleted,
      calibrationCompleted
    );
  }, [currentPhase, selectedMode, primerCompleted, calibrationCompleted]);

  const canAdvance = useCallback((): boolean => {
    switch (currentPhase) {
      case "idle":
        return true; // Can always start
      case "instruction":
        return true; // PlacementGuide steps completed
      case "primer":
        return primerCompleted;
      case "calibration":
        return calibrationCompleted;
      case "recording":
        return true; // Recording can be stopped anytime
      case "processing":
        return true; // Processing completes automatically
      case "complete":
        return true; // Can reset
      default:
        return false;
    }
  }, [currentPhase, primerCompleted, calibrationCompleted]);

  const advancePhase = useCallback(() => {
    if (!canAdvance()) return;
    const nextPhase = getNextPhase();
    setCurrentPhase(nextPhase);

    // Unlock track when session completes
    if (nextPhase === "idle") {
      setIsTrackLocked(false);
    }
  }, [canAdvance, getNextPhase]);

  const setPhase = useCallback((phase: SessionPhase) => {
    setCurrentPhase(phase);
  }, []);

  const completePrimer = useCallback(() => {
    setPrimerCompleted(true);
  }, []);

  const completeCalibration = useCallback(() => {
    setCalibrationCompleted(true);
  }, []);

  const resetSession = useCallback(() => {
    setCurrentPhase("idle");
    setSelectedMode("standard");
    setIsTrackLocked(false);
    setSessionStartTime(null);
    setPrimerCompleted(false);
    setCalibrationCompleted(false);
    setIntervention(null);
  }, []);

  const value: SessionContextValue = {
    // State
    currentPhase,
    selectedMode,
    isTrackLocked,
    sessionStartTime,
    primerCompleted,
    calibrationCompleted,
    intervention,
    // Actions
    startSession,
    advancePhase,
    setPhase,
    completePrimer,
    completeCalibration,
    resetSession,
    canAdvance,
    getNextPhase,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * useSession - Hook to access session context
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

/**
 * useSessionPhase - Convenience hook for just the current phase
 */
export function useSessionPhase(): {
  phase: SessionPhase;
  isActive: boolean;
  isRecording: boolean;
} {
  const { currentPhase } = useSession();
  return {
    phase: currentPhase,
    isActive: currentPhase !== "idle" && currentPhase !== "complete",
    isRecording: currentPhase === "recording",
  };
}

/**
 * Helper to check if a phase requires the primer
 */
export function requiresPrimer(mode: RecordingMode): boolean {
  return mode !== "standard";
}

/**
 * Helper to map mode to display label
 */
export function getModeLabel(mode: RecordingMode): string {
  switch (mode) {
    case "standard": return "Standard Recording";
    case "humming": return "Humming Protocol";
    case "deep_breathing": return "4-7-8 Breathing";
    case "cold_exposure": return "Cold Exposure";
    case "gargling": return "Gargling Protocol";
    default: return "Recording";
  }
}

export default SessionContext;
