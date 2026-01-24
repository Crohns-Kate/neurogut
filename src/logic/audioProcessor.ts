/**
 * NeuroGut Audio Processor – Mic Calibration & Thresholds
 *
 * Central config for motility detection and contact/quality checks.
 * Used by audioAnalytics and the recording UI (contact warning).
 *
 * Calibration goal: Filter background room hum; a 30s silent session (e.g. phone on table)
 * should yield Motility Index near 0 when real audio is analyzed via analyzeAudioSamples.
 */

/** RMS threshold multiplier for event detection. Higher = less sensitive to ambient noise. */
export const MOTILITY_THRESHOLD_MULTIPLIER = 2.2;

/** Max coefficient-of-variation of energy (std/mean) below which we consider noise "flat" (no skin contact). */
export const FLAT_NOISE_CV_THRESHOLD = 0.08;
