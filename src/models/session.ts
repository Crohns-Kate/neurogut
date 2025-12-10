/**
 * NeuroGut Session Data Models
 *
 * Core types for gut sound recording sessions, including:
 * - Protocol types (Quick Check, Post-Meal, Mind-Body)
 * - Pre-recording context tags (meal timing, stress, posture)
 * - Session analytics (events, motility index)
 *
 * IMPORTANT: This app is for self-tracking and coaching only, not medical diagnosis.
 */

// Recording protocol types with their durations
export type RecordingProtocolType = "quick_check" | "post_meal" | "mind_body";

export const PROTOCOL_CONFIG: Record<
  RecordingProtocolType,
  { label: string; durationSeconds: number; description: string }
> = {
  quick_check: {
    label: "Quick Check",
    durationSeconds: 180, // 3 minutes
    description: "A brief snapshot of your gut activity",
  },
  post_meal: {
    label: "Post-Meal",
    durationSeconds: 300, // 5 minutes
    description: "Track digestion after eating",
  },
  mind_body: {
    label: "Mind-Body Session",
    durationSeconds: 180, // 3 minutes
    description: "Before/after comparison for practices",
  },
} as const;

// Time since last meal options
export type MealTiming = "now" | "1-2h" | "3-4h" | ">4h";

export const MEAL_TIMING_OPTIONS: { value: MealTiming; label: string }[] = [
  { value: "now", label: "Just ate" },
  { value: "1-2h", label: "1-2 hours" },
  { value: "3-4h", label: "3-4 hours" },
  { value: ">4h", label: "4+ hours" },
];

// Posture during recording
export type PostureType = "supine" | "sitting" | "standing";

export const POSTURE_OPTIONS: { value: PostureType; label: string }[] = [
  { value: "supine", label: "Lying down" },
  { value: "sitting", label: "Sitting" },
  { value: "standing", label: "Standing" },
];

// Motility category based on index
export type MotilityCategory = "quiet" | "normal" | "active";

export function getMotilityCategory(motilityIndex: number): MotilityCategory {
  if (motilityIndex < 33) return "quiet";
  if (motilityIndex < 67) return "normal";
  return "active";
}

export function getMotilityCategoryLabel(category: MotilityCategory): string {
  switch (category) {
    case "quiet":
      return "Quiet";
    case "normal":
      return "Normal";
    case "active":
      return "Active";
  }
}

// Session analytics computed from audio analysis
export interface SessionAnalytics {
  // Number of detected gut sound events per minute
  eventsPerMinute: number;
  // Total seconds with detected activity
  totalActiveSeconds: number;
  // Total seconds of quiet
  totalQuietSeconds: number;
  // Normalized 0-100 score combining events/min and active time fraction
  motilityIndex: number;
  // Activity levels for each time segment (for charts)
  activityTimeline: number[];
  // Number of segments in the timeline
  timelineSegments: number;
}

// Pre-recording context tags
export interface SessionContext {
  // Time since last meal
  mealTiming: MealTiming;
  // Stress level 0-10
  stressLevel: number;
  // Body posture during recording
  posture: PostureType;
}

// Mind-body experiment pairing (for before/after comparisons)
export interface ExperimentPairing {
  // Name of the practice (e.g., "Box breathing", "Yoga nidra")
  practiceName: string;
  // ID of the "before" session
  beforeSessionId: string;
  // ID of the "after" session
  afterSessionId: string;
  // When the pairing was created
  createdAt: string;
}

// Main session interface
export interface GutRecordingSession {
  // Unique identifier
  id: string;
  // ISO timestamp when recording started
  createdAt: string;
  // Recording protocol used
  protocolType: RecordingProtocolType;
  // Actual duration in seconds
  durationSeconds: number;
  // File URI on device
  audioFileUri: string;
  // Pre-recording context
  context: SessionContext;
  // Computed analytics (null if not yet processed)
  analytics: SessionAnalytics | null;
  // User notes (editable after recording)
  notes: string;
  // For mind-body sessions: is this a "before" or "after" recording?
  mindBodyPhase?: "before" | "after";
  // Reference to experiment pairing if part of one
  experimentPairingId?: string;
}

// Default context for new sessions
export const DEFAULT_SESSION_CONTEXT: SessionContext = {
  mealTiming: "3-4h",
  stressLevel: 5,
  posture: "supine",
};

// Helper to create a new session
export function createSession(
  protocolType: RecordingProtocolType,
  audioFileUri: string,
  durationSeconds: number,
  context: SessionContext,
  notes: string = ""
): GutRecordingSession {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    protocolType,
    durationSeconds,
    audioFileUri,
    context,
    analytics: null,
    notes,
  };
}
