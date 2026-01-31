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
// AUTOCORRELATION - Find dominant heart rhythm
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Compute autocorrelation to find the dominant period in the signal
 *
 * This finds the lag at which the signal best correlates with itself,
 * which corresponds to the heart rate period.
 *
 * @returns Dominant period in samples, or 0 if not found
 */
function findDominantPeriod(
  envelope: number[],
  sampleRate: number
): { periodSamples: number; periodMs: number; confidence: number } {
  const { minPeakDistanceMs, maxPeakDistanceMs } = HEART_CONFIG;

  // Convert to sample range for autocorrelation lags
  const minLag = Math.floor((minPeakDistanceMs / 1000) * sampleRate);
  const maxLag = Math.floor((maxPeakDistanceMs / 1000) * sampleRate);

  // Compute mean for normalization
  const mean = envelope.reduce((s, v) => s + v, 0) / envelope.length;
  const centered = envelope.map(v => v - mean);

  // Compute variance for normalization
  const variance = centered.reduce((s, v) => s + v * v, 0) / centered.length;
  if (variance < 1e-10) {
    return { periodSamples: 0, periodMs: 0, confidence: 0 };
  }

  // Compute autocorrelation for lags in physiological range
  let maxCorr = -1;
  let bestLag = 0;

  // Use a stride to speed up computation (check every 10 samples)
  const stride = 10;

  for (let lag = minLag; lag <= maxLag; lag += stride) {
    let sum = 0;
    const n = envelope.length - lag;

    for (let i = 0; i < n; i++) {
      sum += centered[i] * centered[i + lag];
    }

    const corr = sum / (n * variance);

    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  // Refine around best lag (check exact samples)
  const refineStart = Math.max(minLag, bestLag - stride);
  const refineEnd = Math.min(maxLag, bestLag + stride);

  for (let lag = refineStart; lag <= refineEnd; lag++) {
    let sum = 0;
    const n = envelope.length - lag;

    for (let i = 0; i < n; i++) {
      sum += centered[i] * centered[i + lag];
    }

    const corr = sum / (n * variance);

    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  const periodMs = (bestLag / sampleRate) * 1000;
  const bpm = 60000 / periodMs;

  console.log(`    [Autocorr] Best lag: ${bestLag} samples (${periodMs.toFixed(0)}ms, ${bpm.toFixed(0)} BPM)`);
  console.log(`    [Autocorr] Correlation: ${maxCorr.toFixed(3)}`);

  return {
    periodSamples: bestLag,
    periodMs,
    confidence: maxCorr,
  };
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
 * Uses adaptive thresholding, prominence checking, and minimum distance
 * constraint to find heartbeat peaks. Stricter than before to avoid
 * detecting noise peaks between real heartbeats.
 */
function detectHeartbeatPeaks(
  envelope: number[],
  sampleRate: number
): Peak[] {
  if (envelope.length === 0) return [];

  const peaks: Peak[] = [];
  const minDistanceSamples = Math.floor((HEART_CONFIG.minPeakDistanceMs / 1000) * sampleRate);

  // Calculate signal statistics using median (more robust than mean)
  const sorted = [...envelope].sort((a, b) => a - b);
  const medianEnvelope = sorted[Math.floor(sorted.length / 2)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];

  // Threshold: Use 75th percentile or 1.3x median (whichever is higher)
  // This is stricter than old mean + 0.5*stdDev
  const threshold = Math.max(p75, medianEnvelope * 1.3);

  // Prominence window: check local area around peak (100ms each side)
  const prominenceWindowSamples = Math.floor(0.1 * sampleRate);
  const PROMINENCE_MULTIPLIER = 1.5; // Peak must be 1.5x local average

  console.log(`    [PeakDetect] Median envelope: ${medianEnvelope.toFixed(6)}`);
  console.log(`    [PeakDetect] Threshold: ${threshold.toFixed(6)} (p75=${p75.toFixed(6)}, 1.3*median=${(medianEnvelope * 1.3).toFixed(6)})`);
  console.log(`    [PeakDetect] Min peak distance: ${HEART_CONFIG.minPeakDistanceMs}ms (${minDistanceSamples} samples)`);

  // Find local maxima above threshold with prominence check
  let lastPeakIndex = -minDistanceSamples;
  let rejectedByDistance = 0;
  let rejectedByProminence = 0;

  for (let i = 1; i < envelope.length - 1; i++) {
    const current = envelope[i];
    const prev = envelope[i - 1];
    const next = envelope[i + 1];

    // Is this a local maximum above threshold?
    if (current > prev && current > next && current > threshold) {
      // Prominence check: peak must be significantly above local average
      const windowStart = Math.max(0, i - prominenceWindowSamples);
      const windowEnd = Math.min(envelope.length, i + prominenceWindowSamples);
      let localSum = 0;
      for (let j = windowStart; j < windowEnd; j++) {
        localSum += envelope[j];
      }
      const localAvg = localSum / (windowEnd - windowStart);

      // Reject if not prominent enough
      if (current < localAvg * PROMINENCE_MULTIPLIER) {
        rejectedByProminence++;
        continue;
      }

      // Check minimum distance from last peak
      if (i - lastPeakIndex >= minDistanceSamples) {
        peaks.push({
          index: i,
          amplitude: current,
          timestampMs: (i / sampleRate) * 1000,
        });
        lastPeakIndex = i;
      } else if (current > peaks[peaks.length - 1]?.amplitude * 1.2) {
        // Only replace if significantly higher (20% higher, not just higher)
        peaks[peaks.length - 1] = {
          index: i,
          amplitude: current,
          timestampMs: (i / sampleRate) * 1000,
        };
        lastPeakIndex = i;
      } else {
        rejectedByDistance++;
      }
    }
  }

  console.log(`    [PeakDetect] Peaks found: ${peaks.length}`);
  console.log(`    [PeakDetect] Rejected by distance: ${rejectedByDistance}`);
  console.log(`    [PeakDetect] Rejected by prominence: ${rejectedByProminence}`);

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

/**
 * Select peaks that align with the dominant period from autocorrelation
 *
 * This is the key fix for RMSSD: instead of accepting any prominent peak,
 * we only accept peaks that are close to expected beat times based on
 * the autocorrelation-derived rhythm.
 *
 * @param peaks - Candidate peaks from basic peak detection
 * @param dominantPeriodMs - Expected period between beats from autocorrelation
 * @returns Peaks that align with the dominant rhythm
 */
function selectAlignedPeaks(peaks: Peak[], dominantPeriodMs: number): Peak[] {
  if (peaks.length < 2 || dominantPeriodMs <= 0) return peaks;

  // Tolerance: ±15% of the dominant period
  const tolerance = dominantPeriodMs * 0.15;

  // Find the strongest peak as anchor
  let anchorIdx = 0;
  let maxAmp = 0;
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i].amplitude > maxAmp) {
      maxAmp = peaks[i].amplitude;
      anchorIdx = i;
    }
  }

  const alignedPeaks: Peak[] = [peaks[anchorIdx]];
  const usedIndices = new Set<number>([anchorIdx]);

  // Search forward from anchor
  let expectedTime = peaks[anchorIdx].timestampMs + dominantPeriodMs;
  while (expectedTime < peaks[peaks.length - 1].timestampMs + tolerance) {
    // Find best peak near expected time
    let bestPeak: Peak | null = null;
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < peaks.length; i++) {
      if (usedIndices.has(i)) continue;

      const dist = Math.abs(peaks[i].timestampMs - expectedTime);
      if (dist < tolerance && dist < bestDist) {
        bestDist = dist;
        bestPeak = peaks[i];
        bestIdx = i;
      }
    }

    if (bestPeak) {
      alignedPeaks.push(bestPeak);
      usedIndices.add(bestIdx);
      expectedTime = bestPeak.timestampMs + dominantPeriodMs;
    } else {
      // No peak found near expected time - skip to next expected beat
      expectedTime += dominantPeriodMs;
    }
  }

  // Search backward from anchor
  expectedTime = peaks[anchorIdx].timestampMs - dominantPeriodMs;
  while (expectedTime > peaks[0].timestampMs - tolerance) {
    let bestPeak: Peak | null = null;
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < peaks.length; i++) {
      if (usedIndices.has(i)) continue;

      const dist = Math.abs(peaks[i].timestampMs - expectedTime);
      if (dist < tolerance && dist < bestDist) {
        bestDist = dist;
        bestPeak = peaks[i];
        bestIdx = i;
      }
    }

    if (bestPeak) {
      alignedPeaks.unshift(bestPeak);
      usedIndices.add(bestIdx);
      expectedTime = bestPeak.timestampMs - dominantPeriodMs;
    } else {
      expectedTime -= dominantPeriodMs;
    }
  }

  console.log(`    [AlignedPeaks] Selected ${alignedPeaks.length} peaks aligned with ${dominantPeriodMs.toFixed(0)}ms period`);
  console.log(`    [AlignedPeaks] Rejected ${peaks.length - alignedPeaks.length} non-aligned peaks`);

  return alignedPeaks.sort((a, b) => a.timestampMs - b.timestampMs);
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
 * Filter intervals to physiological range and remove outliers
 *
 * Uses:
 * 1. Hard limits: 400-1500ms (40-150 BPM)
 * 2. Median filter: Remove intervals that differ from median by >30%
 *
 * Stricter than before (was 50%) to ensure clean RMSSD calculation.
 */
function filterIntervalsForHRV(intervals: number[]): number[] {
  if (intervals.length < 3) return intervals;

  const { minPeakDistanceMs, maxPeakDistanceMs } = HEART_CONFIG;

  // Step 1: Filter to physiological range
  let filtered = intervals.filter(i =>
    i >= minPeakDistanceMs && i <= maxPeakDistanceMs
  );

  const rejectedByRange = intervals.length - filtered.length;
  console.log(`[HRV] Step 1 - Physiological range [${minPeakDistanceMs}-${maxPeakDistanceMs}ms]:`);
  console.log(`[HRV]   Kept: ${filtered.length}, Rejected: ${rejectedByRange}`);

  if (filtered.length < 3) {
    console.log(`[HRV] Too few intervals after physiological filter: ${filtered.length}`);
    return filtered;
  }

  // Step 2: Calculate median
  const sorted = [...filtered].sort((a, b) => a - b);
  const medianIndex = Math.floor(sorted.length / 2);
  const medianInterval = sorted.length % 2 === 0
    ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
    : sorted[medianIndex];

  // Step 3: Remove outliers (>30% from median) - stricter than before (was 50%)
  const outlierThreshold = 0.3;
  const finalFiltered = filtered.filter(i =>
    Math.abs(i - medianInterval) / medianInterval <= outlierThreshold
  );

  const rejectedAsOutliers = filtered.length - finalFiltered.length;
  console.log(`[HRV] Step 2 - Outlier removal (±${outlierThreshold * 100}% from median):`);
  console.log(`[HRV]   Median interval: ${medianInterval.toFixed(0)}ms (${(60000 / medianInterval).toFixed(0)} BPM)`);
  console.log(`[HRV]   Valid range: ${(medianInterval * (1 - outlierThreshold)).toFixed(0)}-${(medianInterval * (1 + outlierThreshold)).toFixed(0)}ms`);
  console.log(`[HRV]   Kept: ${finalFiltered.length}, Rejected as outliers: ${rejectedAsOutliers}`);

  // Step 4: Log final interval statistics
  if (finalFiltered.length > 0) {
    const finalMean = finalFiltered.reduce((s, v) => s + v, 0) / finalFiltered.length;
    const finalMin = Math.min(...finalFiltered);
    const finalMax = Math.max(...finalFiltered);
    console.log(`[HRV] Final intervals: mean=${finalMean.toFixed(0)}ms, range=[${finalMin.toFixed(0)}-${finalMax.toFixed(0)}ms]`);
  }

  return finalFiltered;
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

  // Step 2.5: Find dominant period using autocorrelation
  console.log('\n[2.5] Finding dominant heart rhythm via autocorrelation...');
  const dominantPeriod = findDominantPeriod(envelope, sampleRate);

  // Step 3: Detect peaks
  console.log('\n[3] Detecting heartbeat peaks...');
  let peaks = detectHeartbeatPeaks(envelope, sampleRate);
  console.log(`    Raw peaks detected: ${peaks.length}`);

  // Step 3.5: Select peaks aligned with dominant rhythm (if we found a strong rhythm)
  if (dominantPeriod.confidence >= 0.3 && dominantPeriod.periodMs > 0) {
    console.log('\n[3.5] Selecting peaks aligned with dominant rhythm...');
    peaks = selectAlignedPeaks(peaks, dominantPeriod.periodMs);
  } else {
    console.log('\n[3.5] Skipping rhythm alignment (autocorr confidence too low)');
    // Fall back to physiological filtering
    peaks = filterPhysiologicalPeaks(peaks);
  }
  console.log(`    Final peaks: ${peaks.length}`);

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
  const rawIntervals = calculateIntervals(peaks);
  console.log(`    Raw intervals: ${rawIntervals.length}`);

  // Step 5b: Filter intervals for physiological validity and outlier removal
  const filteredIntervals = filterIntervalsForHRV(rawIntervals);

  if (filteredIntervals.length < 3) {
    console.log(`>>> Insufficient valid intervals (${filteredIntervals.length} < 3)`);
    return {
      ...defaultResult,
      beatCount: peaks.length,
      peakTimestamps: peaks.map(p => p.timestampMs),
      confidence: 0.2,
    };
  }

  const avgIntervalMs = filteredIntervals.reduce((sum, v) => sum + v, 0) / filteredIntervals.length;
  const intervalStdDev_ = stdDev(filteredIntervals);

  // Step 6: Calculate BPM from filtered intervals
  const bpm = 60000 / avgIntervalMs;
  console.log(`    Average interval: ${avgIntervalMs.toFixed(1)}ms`);
  console.log(`    Interval std dev: ${intervalStdDev_.toFixed(1)}ms`);
  console.log(`    Heart rate: ${bpm.toFixed(1)} BPM`);

  // Validate BPM is in physiological range
  const bpmValid = bpm >= HEART_CONFIG.minBPM && bpm <= HEART_CONFIG.maxBPM;
  if (!bpmValid) {
    console.log(`>>> BPM ${bpm.toFixed(1)} outside physiological range [${HEART_CONFIG.minBPM}-${HEART_CONFIG.maxBPM}]`);
  }

  // Step 7: Calculate HRV (RMSSD) from FILTERED intervals
  console.log('\n[5] Calculating HRV metrics...');
  const hrvValid = filteredIntervals.length >= HEART_CONFIG.minBeatsForValidHRV;
  const rmssd = hrvValid ? calculateRMSSD(filteredIntervals) : 0;
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
