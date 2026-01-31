/**
 * Heart Rate Analytics Module
 *
 * Extracts heart rate and HRV from abdominal audio recordings.
 * The same recording that captures gut sounds also contains heart sounds
 * in a lower frequency band.
 *
 * Frequency bands (from same recording):
 * - Gut sounds: 100-500 Hz (existing)
 * - Heart sounds: 20-80 Hz (this module)
 *
 * Validated by Japanese study: 104 hours of abdominal audio vs ECG.
 *
 * Output:
 * - BPM: Heart rate (40-120 normal range)
 * - RMSSD: Root Mean Square of Successive Differences (HRV metric)
 * - Vagal Tone Score: Simplified 0-100 score based on RMSSD
 */

import {
  designButterworthBandpass,
  applyZeroPhaseFilter,
  type ButterworthFilter,
} from '../filters/butterworthFilter';

// ════════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════════

export const HEART_CONFIG = {
  // Frequency band for heart sounds
  lowHz: 20,
  highHz: 80,
  filterOrder: 3,

  // Heart rate constraints
  minBPM: 40,   // Minimum physiological heart rate
  maxBPM: 150,  // Maximum physiological heart rate

  // Peak detection
  minPeakDistanceMs: 400,   // Max 150 BPM (60000/150)
  maxPeakDistanceMs: 1500,  // Min 40 BPM (60000/40)

  // Validation
  minBeatsForValidBPM: 10,      // Need at least 10 beats for reliable BPM
  minBeatsForValidHRV: 20,      // Need more beats for HRV calculation
  minConfidenceThreshold: 0.5,  // Minimum confidence to report results

  // RMSSD normalization (typical healthy adult range)
  rmssdMinMs: 20,   // Low end of normal
  rmssdMaxMs: 80,   // High end of normal
};

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface HeartAnalytics {
  /** Heart rate in BPM (40-150 normal) */
  bpm: number;

  /** Raw HRV metric: Root Mean Square of Successive Differences (ms) */
  rmssd: number;

  /** Simplified vagal tone score (0-100) */
  vagalToneScore: number;

  /** Confidence in the measurement (0-1) */
  confidence: number;

  /** Number of heartbeats detected */
  beatCount: number;

  /** Average inter-beat interval in ms */
  avgIntervalMs: number;

  /** Standard deviation of inter-beat intervals in ms */
  intervalStdDev: number;

  /** Did we have enough beats for valid HRV? */
  hrvValid: boolean;

  /** Peak timestamps in ms (for debugging) */
  peakTimestamps: number[];
}

interface Peak {
  index: number;
  amplitude: number;
  timestampMs: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// CACHED FILTER
// ════════════════════════════════════════════════════════════════════════════════

let cachedHeartFilter: ButterworthFilter | null = null;

/**
 * Get the heart sound bandpass filter (20-80 Hz)
 */
export function getHeartBandFilter(sampleRate: number = 44100): ButterworthFilter {
  if (cachedHeartFilter && cachedHeartFilter.sampleRate === sampleRate) {
    return cachedHeartFilter;
  }

  cachedHeartFilter = designButterworthBandpass(
    HEART_CONFIG.lowHz,
    HEART_CONFIG.highHz,
    HEART_CONFIG.filterOrder,
    sampleRate
  );

  return cachedHeartFilter;
}

// ════════════════════════════════════════════════════════════════════════════════
// PEAK DETECTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Compute signal envelope using Hilbert-like approach (simplified)
 * Takes absolute value and applies smoothing
 */
function computeEnvelope(samples: number[], windowSize: number): number[] {
  const envelope: number[] = new Array(samples.length).fill(0);

  // Take absolute value
  const absSamples = samples.map(Math.abs);

  // Moving average smoothing
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(samples.length - 1, i + halfWindow); j++) {
      sum += absSamples[j];
      count++;
    }
    envelope[i] = sum / count;
  }

  return envelope;
}

/**
 * Detect peaks in the envelope signal
 *
 * Uses adaptive thresholding and minimum distance constraint
 * to find heartbeat peaks.
 */
function detectHeartbeatPeaks(
  envelope: number[],
  sampleRate: number
): Peak[] {
  if (envelope.length === 0) return [];

  const peaks: Peak[] = [];
  const minDistanceSamples = Math.floor((HEART_CONFIG.minPeakDistanceMs / 1000) * sampleRate);

  // Calculate adaptive threshold (mean + std dev)
  const mean = envelope.reduce((sum, v) => sum + v, 0) / envelope.length;
  const variance = envelope.reduce((sum, v) => sum + (v - mean) ** 2, 0) / envelope.length;
  const stdDev = Math.sqrt(variance);
  const threshold = mean + 0.5 * stdDev;

  // Find local maxima above threshold
  let lastPeakIndex = -minDistanceSamples;

  for (let i = 1; i < envelope.length - 1; i++) {
    const current = envelope[i];
    const prev = envelope[i - 1];
    const next = envelope[i + 1];

    // Is this a local maximum?
    if (current > prev && current > next && current > threshold) {
      // Check minimum distance from last peak
      if (i - lastPeakIndex >= minDistanceSamples) {
        peaks.push({
          index: i,
          amplitude: current,
          timestampMs: (i / sampleRate) * 1000,
        });
        lastPeakIndex = i;
      } else if (current > peaks[peaks.length - 1]?.amplitude) {
        // Replace last peak if this one is higher (within min distance)
        peaks[peaks.length - 1] = {
          index: i,
          amplitude: current,
          timestampMs: (i / sampleRate) * 1000,
        };
        lastPeakIndex = i;
      }
    }
  }

  return peaks;
}

/**
 * Filter out peaks with physiologically implausible intervals
 */
function filterPhysiologicalPeaks(peaks: Peak[]): Peak[] {
  if (peaks.length < 2) return peaks;

  const validPeaks: Peak[] = [peaks[0]];
  const { minPeakDistanceMs, maxPeakDistanceMs } = HEART_CONFIG;

  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i].timestampMs - validPeaks[validPeaks.length - 1].timestampMs;

    // Accept if within physiological range
    if (interval >= minPeakDistanceMs && interval <= maxPeakDistanceMs) {
      validPeaks.push(peaks[i]);
    }
    // Skip peaks that are too close (likely noise)
    // Accept peaks that are too far apart (might have missed beats, but still valid)
    else if (interval > maxPeakDistanceMs) {
      validPeaks.push(peaks[i]);
    }
  }

  return validPeaks;
}

// ════════════════════════════════════════════════════════════════════════════════
// HRV CALCULATIONS
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Calculate inter-beat intervals from peak timestamps
 */
function calculateIntervals(peaks: Peak[]): number[] {
  const intervals: number[] = [];

  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i].timestampMs - peaks[i - 1].timestampMs;
    intervals.push(interval);
  }

  return intervals;
}

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 *
 * RMSSD is a time-domain HRV metric that reflects parasympathetic
 * (vagal) activity. Higher values indicate better vagal tone.
 */
function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;

  const successiveDiffs: number[] = [];

  for (let i = 1; i < intervals.length; i++) {
    successiveDiffs.push(intervals[i] - intervals[i - 1]);
  }

  const squaredDiffs = successiveDiffs.map(d => d * d);
  const meanSquared = squaredDiffs.reduce((sum, v) => sum + v, 0) / squaredDiffs.length;

  return Math.sqrt(meanSquared);
}

/**
 * Convert RMSSD to a simplified Vagal Tone Score (0-100)
 *
 * Based on typical healthy adult RMSSD range of 20-80ms.
 * Score interpretation:
 * - 0-30: Low vagal tone
 * - 30-60: Moderate vagal tone
 * - 60-100: High vagal tone (good!)
 */
function calculateVagalToneScore(rmssd: number): number {
  const { rmssdMinMs, rmssdMaxMs } = HEART_CONFIG;

  // Normalize to 0-100 range
  const normalized = (rmssd - rmssdMinMs) / (rmssdMaxMs - rmssdMinMs);

  // Clamp to 0-100
  return Math.min(100, Math.max(0, normalized * 100));
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Analyze audio samples for heart rate and HRV
 *
 * @param samples - Raw audio samples (normalized -1 to 1)
 * @param durationSeconds - Recording duration in seconds
 * @param sampleRate - Sample rate (default 44100)
 * @returns HeartAnalytics with BPM, RMSSD, and vagal tone score
 */
export function analyzeHeartRate(
  samples: number[],
  durationSeconds: number,
  sampleRate: number = 44100
): HeartAnalytics {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              HEART RATE ANALYSIS (20-80Hz Band)                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Duration: ${durationSeconds.toFixed(1)}s | Samples: ${samples.length}`);

  // Default result for insufficient data
  const defaultResult: HeartAnalytics = {
    bpm: 0,
    rmssd: 0,
    vagalToneScore: 0,
    confidence: 0,
    beatCount: 0,
    avgIntervalMs: 0,
    intervalStdDev: 0,
    hrvValid: false,
    peakTimestamps: [],
  };

  if (samples.length === 0 || durationSeconds < 5) {
    console.log('>>> Insufficient data for heart rate analysis');
    return defaultResult;
  }

  // Step 1: Bandpass filter for heart sounds (20-80 Hz)
  console.log('\n[1] Applying 20-80Hz bandpass filter...');
  const heartFilter = getHeartBandFilter(sampleRate);
  const filteredSamples = applyZeroPhaseFilter(samples, heartFilter);
  console.log(`    Filter: ${heartFilter.lowHz}-${heartFilter.highHz}Hz, order ${heartFilter.order}`);

  // Step 2: Compute envelope
  console.log('\n[2] Computing signal envelope...');
  const envelopeWindowMs = 50; // 50ms smoothing window
  const envelopeWindowSamples = Math.floor((envelopeWindowMs / 1000) * sampleRate);
  const envelope = computeEnvelope(filteredSamples, envelopeWindowSamples);

  // Step 3: Detect peaks
  console.log('\n[3] Detecting heartbeat peaks...');
  let peaks = detectHeartbeatPeaks(envelope, sampleRate);
  console.log(`    Raw peaks detected: ${peaks.length}`);

  // Step 4: Filter physiological peaks
  peaks = filterPhysiologicalPeaks(peaks);
  console.log(`    Physiological peaks: ${peaks.length}`);

  if (peaks.length < HEART_CONFIG.minBeatsForValidBPM) {
    console.log(`>>> Insufficient beats detected (${peaks.length} < ${HEART_CONFIG.minBeatsForValidBPM})`);
    return {
      ...defaultResult,
      beatCount: peaks.length,
      peakTimestamps: peaks.map(p => p.timestampMs),
      confidence: peaks.length / HEART_CONFIG.minBeatsForValidBPM,
    };
  }

  // Step 5: Calculate intervals
  console.log('\n[4] Calculating inter-beat intervals...');
  const intervals = calculateIntervals(peaks);
  const avgIntervalMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
  const intervalStdDev_ = stdDev(intervals);

  // Step 6: Calculate BPM
  const bpm = 60000 / avgIntervalMs;
  console.log(`    Average interval: ${avgIntervalMs.toFixed(1)}ms`);
  console.log(`    Interval std dev: ${intervalStdDev_.toFixed(1)}ms`);
  console.log(`    Heart rate: ${bpm.toFixed(1)} BPM`);

  // Validate BPM is in physiological range
  const bpmValid = bpm >= HEART_CONFIG.minBPM && bpm <= HEART_CONFIG.maxBPM;
  if (!bpmValid) {
    console.log(`>>> BPM ${bpm.toFixed(1)} outside physiological range [${HEART_CONFIG.minBPM}-${HEART_CONFIG.maxBPM}]`);
  }

  // Step 7: Calculate HRV (RMSSD)
  console.log('\n[5] Calculating HRV metrics...');
  const hrvValid = intervals.length >= HEART_CONFIG.minBeatsForValidHRV;
  const rmssd = hrvValid ? calculateRMSSD(intervals) : 0;
  const vagalToneScore = hrvValid ? calculateVagalToneScore(rmssd) : 0;

  console.log(`    RMSSD: ${rmssd.toFixed(1)}ms`);
  console.log(`    Vagal Tone Score: ${vagalToneScore.toFixed(0)}/100`);
  console.log(`    HRV valid: ${hrvValid} (need ${HEART_CONFIG.minBeatsForValidHRV}+ intervals)`);

  // Step 8: Calculate confidence
  // Based on: number of beats, BPM validity, interval consistency
  let confidence = 0;

  // Beats detected (up to 50% of confidence)
  const expectedBeats = (durationSeconds / 60) * 75; // Assume ~75 BPM
  const beatRatio = Math.min(1, peaks.length / expectedBeats);
  confidence += beatRatio * 0.5;

  // BPM validity (25% of confidence)
  if (bpmValid) confidence += 0.25;

  // Interval consistency (25% of confidence) - lower CV is better
  const intervalCV = intervalStdDev_ / avgIntervalMs;
  const consistencyScore = Math.max(0, 1 - intervalCV);
  confidence += consistencyScore * 0.25;

  console.log(`\n[6] Confidence: ${(confidence * 100).toFixed(0)}%`);

  // Final logging
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('=== HEART RATE ANALYSIS RESULTS ===');
  console.log(`BPM: ${bpm.toFixed(1)}`);
  console.log(`RMSSD: ${rmssd.toFixed(1)} ms`);
  console.log(`Vagal Tone Score: ${vagalToneScore.toFixed(0)}/100`);
  console.log(`Beats detected: ${peaks.length}`);
  console.log(`Confidence: ${(confidence * 100).toFixed(0)}%`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  return {
    bpm: bpmValid ? Math.round(bpm) : 0,
    rmssd: Math.round(rmssd * 10) / 10,
    vagalToneScore: Math.round(vagalToneScore),
    confidence: Math.round(confidence * 100) / 100,
    beatCount: peaks.length,
    avgIntervalMs: Math.round(avgIntervalMs),
    intervalStdDev: Math.round(intervalStdDev_ * 10) / 10,
    hrvValid,
    peakTimestamps: peaks.map(p => Math.round(p.timestampMs)),
  };
}

/**
 * Quick check if heart rate analysis is likely to succeed
 *
 * Call this before full analysis to check if there's enough
 * signal in the heart band.
 */
export function checkHeartSignalPresence(
  samples: number[],
  sampleRate: number = 44100
): { hasSignal: boolean; signalStrength: number } {
  if (samples.length < sampleRate * 3) {
    return { hasSignal: false, signalStrength: 0 };
  }

  // Filter to heart band
  const heartFilter = getHeartBandFilter(sampleRate);
  const filtered = applyZeroPhaseFilter(samples, heartFilter);

  // Calculate RMS of filtered signal
  const rms = Math.sqrt(filtered.reduce((sum, s) => sum + s * s, 0) / filtered.length);

  // Compare to original RMS
  const originalRms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);

  const signalStrength = originalRms > 0 ? rms / originalRms : 0;
  const hasSignal = signalStrength > 0.01; // At least 1% of energy in heart band

  return { hasSignal, signalStrength };
}
