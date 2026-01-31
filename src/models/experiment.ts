/**
 * NeuroGut Experiment Data Models
 *
 * Types for Before/After comparison experiments:
 * - Baseline measurement
 * - Intervention (breathing, humming, etc.)
 * - Post-intervention measurement
 * - Delta comparison
 */

import { SessionAnalytics } from "./session";

// Intervention types for comparison experiments
export type ComparisonIntervention =
  | "Deep Breathing"
  | "Humming"
  | "Cold Exposure"
  | "Abdominal Massage"
  | "Custom";

// Experiment workflow status
export type ExperimentStatus =
  | "baseline_pending"
  | "baseline_complete"
  | "intervention_complete"
  | "post_pending"
  | "complete";

// Main experiment interface
export interface Experiment {
  id: string;
  createdAt: string;
  status: ExperimentStatus;
  interventionType: ComparisonIntervention;
  interventionDurationSeconds: number; // 120, 180, or 300
  beforeSessionId: string | null;
  afterSessionId: string | null;
  beforeAnalytics?: SessionAnalytics;
  afterAnalytics?: SessionAnalytics;
  deltas?: {
    motilityIndex: number;
    eventsPerMinute: number;
    heartBpm?: number;
    vagalToneScore?: number;
  };
  patientId: string;
}

// Intervention option with UI metadata
export interface InterventionOption {
  type: ComparisonIntervention;
  label: string;
  icon: string;
  description: string;
}

// Available intervention options
export const INTERVENTION_OPTIONS: InterventionOption[] = [
  {
    type: "Deep Breathing",
    label: "Deep Breathing",
    icon: "lung",
    description: "Inhale 4s, hold 4s, exhale 6s",
  },
  {
    type: "Humming",
    label: "Humming / Vagal Toning",
    icon: "music",
    description: "Hum a low steady tone",
  },
  {
    type: "Cold Exposure",
    label: "Cold Water on Face",
    icon: "snowflake",
    description: "Triggers dive reflex",
  },
  {
    type: "Abdominal Massage",
    label: "Gentle Massage",
    icon: "hand",
    description: "Clockwise abdominal massage",
  },
  {
    type: "Custom",
    label: "Custom",
    icon: "sparkles",
    description: "Your own practice",
  },
];

// Duration options in seconds
export interface DurationOption {
  label: string;
  value: number;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: "2 min", value: 120 },
  { label: "3 min", value: 180 },
  { label: "5 min", value: 300 },
];

/**
 * Create a new experiment
 */
export function createExperiment(
  interventionType: ComparisonIntervention,
  interventionDurationSeconds: number,
  patientId: string
): Experiment {
  return {
    id: `experiment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: "baseline_pending",
    interventionType,
    interventionDurationSeconds,
    beforeSessionId: null,
    afterSessionId: null,
    patientId,
  };
}

/**
 * Calculate deltas between before and after analytics
 */
export function calculateDeltas(
  before: SessionAnalytics,
  after: SessionAnalytics
): Experiment["deltas"] {
  const deltas: Experiment["deltas"] = {
    motilityIndex: after.motilityIndex - before.motilityIndex,
    eventsPerMinute: after.eventsPerMinute - before.eventsPerMinute,
  };

  // Add heart metrics if available in both
  if (before.heartBpm !== undefined && after.heartBpm !== undefined) {
    deltas.heartBpm = after.heartBpm - before.heartBpm;
  }

  if (before.vagalToneScore !== undefined && after.vagalToneScore !== undefined) {
    deltas.vagalToneScore = after.vagalToneScore - before.vagalToneScore;
  }

  return deltas;
}

/**
 * Get human-readable status label
 */
export function getExperimentStatusLabel(status: ExperimentStatus): string {
  switch (status) {
    case "baseline_pending":
      return "Baseline Recording";
    case "baseline_complete":
      return "Ready for Intervention";
    case "intervention_complete":
      return "Post Recording";
    case "post_pending":
      return "Post Recording";
    case "complete":
      return "Complete";
  }
}
