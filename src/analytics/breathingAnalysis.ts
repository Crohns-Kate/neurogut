/**
 * Breathing Phase Analysis
 *
 * Detects individual breath phases (inhale, exhale, pause) from accelerometer data.
 * Phone on abdomen captures breathing as a quasi-sinusoidal wave:
 * - Rising edge = inhale (abdomen expanding)
 * - Peak = end of inhale / start of pause
 * - Falling edge = exhale (abdomen contracting)
 * - Trough = end of exhale / start of pause
 *
 * Health insights:
 * - Inhale:Exhale ratio - Longer exhale = more parasympathetic activation
 * - Coherence - How rhythmic is breathing (meditation = high coherence)
 * - Pauses - Natural pause after exhale is normal; long pause after inhale = stress
 */

import { AccelerometerSample } from "../sensors/accelerometerContact";

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface BreathCycle {
  /** Start time in ms from recording start */
  startTime: number;
  /** Inhale start time in ms */
  inhaleStart: number;
  /** Inhale end time in ms */
  inhaleEnd: number;
  /** Inhale duration in ms */
  inhaleDuration: number;
  /** Exhale start time in ms */
  exhaleStart: number;
  /** Exhale end time in ms */
  exhaleEnd: number;
  /** Exhale duration in ms */
  exhaleDuration: number;
  /** Pause duration after inhale in ms (0 if none) */
  pauseAfterInhale: number;
  /** Pause duration after exhale in ms (0 if none) */
  pauseAfterExhale: number;
  /** Total cycle duration in ms */
  totalDuration: number;
}

export interface BreathingAnalysis {
  /** Breaths per minute */
  breathsPerMinute: number;
  /** Detected breath cycles */
  cycles: BreathCycle[];
  /** Average inhale duration in ms */
  averageInhaleDuration: number;
  /** Average exhale duration in ms */
  averageExhaleDuration: number;
  /** Average pause after inhale in ms */
  averagePauseAfterInhale: number;
  /** Average pause after exhale in ms */
  averagePauseAfterExhale: number;
  /** Inhale:Exhale ratio (e.g., 0.75 means exhale is 33% longer) */
  inhaleExhaleRatio: number;
  /** Breathing coherence 0-100 (how regular is the pattern) */
  coherence: number;
  /** Breathing pattern classification */
  pattern: "regular" | "irregular" | "shallow" | "deep";
  /** Total recording duration analyzed in seconds */
  durationSeconds: number;
  /** Which axis was used for analysis */
  primaryAxis: "x" | "y" | "z";
}

// ════════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════════

const BREATHING_CONFIG = {
  // Breathing frequency range (Hz)
  // 0.08 Hz = 4.8 breaths/min (very slow/relaxed), 0.6 Hz = 36 breaths/min (rapid)
  minFrequencyHz: 0.08,
  maxFrequencyHz: 0.6,

  // Minimum peak prominence (fraction of signal range)
  // Lowered from 0.15 to 0.05 to catch subtle breathing
  minPeakProminence: 0.05,

  // Minimum time between peaks (ms) - prevents double detection
  minPeakDistanceMs: 1500, // At most 40 breaths/min

  // Pause detection threshold (derivative magnitude)
  pauseDerivativeThreshold: 0.005,

  // Maximum pause duration to detect (ms)
  maxPauseDurationMs: 3000,

  // Minimum cycles needed for valid analysis
  minCyclesForAnalysis: 3,
};

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
}

function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Simple moving average filter
 */
function movingAverage(signal: number[], windowSize: number): number[] {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(signal.length - 1, i + halfWindow); j++) {
      sum += signal[j];
      count++;
    }
    result.push(sum / count);
  }

  return result;
}

/**
 * Simple bandpass filter using cascaded moving averages
 * Low-pass removes high frequency noise, then high-pass removes DC offset
 */
function bandpassFilter(
  signal: number[],
  lowCutHz: number,
  highCutHz: number,
  sampleRateHz: number
): number[] {
  // Low-pass: remove frequencies above highCutHz
  // Window size = samples per cycle at cutoff frequency
  const lowPassWindow = Math.round(sampleRateHz / highCutHz);
  const lowPassed = movingAverage(signal, Math.max(3, lowPassWindow));

  // High-pass: remove frequencies below lowCutHz (remove DC and very slow drift)
  // Subtract a heavily smoothed version of the signal
  const highPassWindow = Math.round(sampleRateHz / lowCutHz);
  const dcComponent = movingAverage(lowPassed, Math.max(3, highPassWindow));

  const filtered = lowPassed.map((v, i) => v - dcComponent[i]);

  return filtered;
}

/**
 * Zero-crossing fallback for breathing rate estimation
 * Used when peak detection fails (e.g., weak signal)
 */
function estimateBreathingRateZeroCrossing(
  signal: number[],
  sampleRateHz: number
): number {
  // Remove DC offset
  const avg = mean(signal);
  const centered = signal.map((v) => v - avg);

  // HEAVY smoothing - 2 second window to remove noise, keep only breathing rhythm
  // At 20Hz, this is 40 samples - filters out jitter while preserving 6-30 breath/min range
  const windowSize = Math.floor(sampleRateHz * 2);
  const smoothed = movingAverage(centered, Math.max(3, windowSize));

  // Count zero crossings
  let crossings = 0;
  for (let i = 1; i < smoothed.length; i++) {
    if (
      (smoothed[i - 1] < 0 && smoothed[i] >= 0) ||
      (smoothed[i - 1] >= 0 && smoothed[i] < 0)
    ) {
      crossings++;
    }
  }

  // Each breath = 2 crossings (up and down)
  const durationMinutes = signal.length / sampleRateHz / 60;
  let breathsPerMinute = crossings / 2 / durationMinutes;

  console.log(
    `[Breathing] Zero-crossing fallback: ${crossings} crossings → ${breathsPerMinute.toFixed(1)} breaths/min`
  );

  // Sanity check - clamp to physiologically plausible range
  if (breathsPerMinute < 4) {
    console.log("[Breathing] WARNING: Rate too low (<4), may be signal drift");
    breathsPerMinute = 0; // Don't report implausible values
  } else if (breathsPerMinute > 40) {
    console.log("[Breathing] WARNING: Rate too high (>40), may be noise");
    breathsPerMinute = 0;
  } else if (breathsPerMinute < 8 || breathsPerMinute > 25) {
    console.log("[Breathing] Note: Rate outside typical range (8-25)");
  }

  return breathsPerMinute;
}

/**
 * Find local maxima (peaks) in the signal
 */
function findPeaks(
  signal: number[],
  sampleRateHz: number,
  minProminence: number = BREATHING_CONFIG.minPeakProminence
): number[] {
  const peaks: number[] = [];
  const minDistance = Math.round((BREATHING_CONFIG.minPeakDistanceMs / 1000) * sampleRateHz);

  // Calculate signal range for prominence threshold
  const signalMin = Math.min(...signal);
  const signalMax = Math.max(...signal);
  const signalRange = signalMax - signalMin;
  const prominenceThreshold = signalRange * minProminence;

  for (let i = 2; i < signal.length - 2; i++) {
    // Check if local maximum
    if (
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i - 2] &&
      signal[i] > signal[i + 1] &&
      signal[i] > signal[i + 2]
    ) {
      // Check prominence (height above surrounding valleys)
      let leftMin = signal[i];
      let rightMin = signal[i];

      for (let j = i - 1; j >= Math.max(0, i - minDistance); j--) {
        if (signal[j] < leftMin) leftMin = signal[j];
      }
      for (let j = i + 1; j <= Math.min(signal.length - 1, i + minDistance); j++) {
        if (signal[j] < rightMin) rightMin = signal[j];
      }

      const prominence = signal[i] - Math.max(leftMin, rightMin);

      if (prominence >= prominenceThreshold) {
        // Check minimum distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i);
        } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
          // Replace last peak if this one is higher
          peaks[peaks.length - 1] = i;
        }
      }
    }
  }

  return peaks;
}

/**
 * Find local minima (troughs) in the signal
 */
function findTroughs(signal: number[], sampleRateHz: number): number[] {
  // Invert signal and find peaks
  const inverted = signal.map((v) => -v);
  return findPeaks(inverted, sampleRateHz);
}

/**
 * Detect pause (flat section) starting from a given index
 * Returns pause duration in ms
 */
function detectPause(
  signal: number[],
  startIdx: number,
  sampleRateHz: number
): number {
  const threshold = BREATHING_CONFIG.pauseDerivativeThreshold;
  const maxSamples = Math.round((BREATHING_CONFIG.maxPauseDurationMs / 1000) * sampleRateHz);
  let pauseLength = 0;

  for (let i = startIdx; i < Math.min(startIdx + maxSamples, signal.length - 1); i++) {
    const derivative = Math.abs(signal[i + 1] - signal[i]);
    if (derivative < threshold) {
      pauseLength++;
    } else {
      break;
    }
  }

  // Only count as pause if longer than ~200ms
  const minPauseSamples = Math.round(0.2 * sampleRateHz);
  if (pauseLength < minPauseSamples) {
    return 0;
  }

  return (pauseLength / sampleRateHz) * 1000;
}

/**
 * Categorize breathing pattern based on metrics
 */
function categorizePattern(
  breathsPerMinute: number,
  coherence: number,
  avgCycleDurationMs: number
): BreathingAnalysis["pattern"] {
  // Deep breathing: slow rate, long cycles
  if (breathsPerMinute < 8 && avgCycleDurationMs > 6000) {
    return "deep";
  }

  // Shallow breathing: fast rate, short cycles
  if (breathsPerMinute > 20 || avgCycleDurationMs < 2500) {
    return "shallow";
  }

  // Regular vs irregular based on coherence
  if (coherence >= 60) {
    return "regular";
  }

  return "irregular";
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Analyze breathing phases from accelerometer data
 *
 * @param samples - Accelerometer samples with x, y, z, timestamp
 * @param sampleRateHz - Sample rate (default 20Hz)
 * @returns Breathing analysis with cycles and metrics
 */
export function analyzeBreathPhases(
  samples: AccelerometerSample[],
  sampleRateHz: number = 20
): BreathingAnalysis {
  console.log("\n[Breathing] ===== BREATH PHASE ANALYSIS =====");
  console.log(`[Breathing] Samples: ${samples.length}, Rate: ${sampleRateHz}Hz`);

  // Default result for insufficient data
  const defaultResult: BreathingAnalysis = {
    breathsPerMinute: 0,
    cycles: [],
    averageInhaleDuration: 0,
    averageExhaleDuration: 0,
    averagePauseAfterInhale: 0,
    averagePauseAfterExhale: 0,
    inhaleExhaleRatio: 1,
    coherence: 0,
    pattern: "irregular",
    durationSeconds: samples.length / sampleRateHz,
    primaryAxis: "z",
  };

  if (samples.length < sampleRateHz * 10) {
    console.log("[Breathing] Insufficient samples (need at least 10 seconds)");
    return defaultResult;
  }

  // 1. Extract breathing signal - use axis with most variance (most breathing motion)
  const varX = variance(samples.map((s) => s.x));
  const varY = variance(samples.map((s) => s.y));
  const varZ = variance(samples.map((s) => s.z));

  let signal: number[];
  let primaryAxis: "x" | "y" | "z";

  if (varZ >= varX && varZ >= varY) {
    signal = samples.map((s) => s.z);
    primaryAxis = "z";
  } else if (varY >= varX) {
    signal = samples.map((s) => s.y);
    primaryAxis = "y";
  } else {
    signal = samples.map((s) => s.x);
    primaryAxis = "x";
  }

  console.log(`[Breathing] Variance - X: ${varX.toFixed(6)}, Y: ${varY.toFixed(6)}, Z: ${varZ.toFixed(6)}`);
  console.log(`[Breathing] Using ${primaryAxis.toUpperCase()}-axis (highest variance)`);

  // Log pre-filter signal range
  const preFilterRange = Math.max(...signal) - Math.min(...signal);
  console.log(`[Breathing] Pre-filter range: ${preFilterRange.toFixed(6)}`);

  // 2. Bandpass filter for breathing frequencies
  const filtered = bandpassFilter(
    signal,
    BREATHING_CONFIG.minFrequencyHz,
    BREATHING_CONFIG.maxFrequencyHz,
    sampleRateHz
  );

  // Log post-filter signal range
  const postFilterRange = Math.max(...filtered) - Math.min(...filtered);
  console.log(`[Breathing] Post-filter range: ${postFilterRange.toFixed(6)}`);

  // Check if filter killed the signal
  if (postFilterRange < 0.0001) {
    console.log("[Breathing] WARNING: Bandpass filter removed signal, using zero-crossing fallback");
    const simpleRate = estimateBreathingRateZeroCrossing(signal, sampleRateHz);
    return {
      ...defaultResult,
      primaryAxis,
      breathsPerMinute: Math.round(simpleRate * 10) / 10,
      pattern: simpleRate > 6 && simpleRate < 20 ? "regular" : "irregular",
    };
  }

  // 3. Find peaks (end of inhale) and troughs (end of exhale)
  const peaks = findPeaks(filtered, sampleRateHz);
  const troughs = findTroughs(filtered, sampleRateHz);

  console.log(`[Breathing] Peaks detected: ${peaks.length}, Troughs: ${troughs.length}`);

  if (peaks.length < BREATHING_CONFIG.minCyclesForAnalysis || troughs.length < BREATHING_CONFIG.minCyclesForAnalysis) {
    console.log("[Breathing] Insufficient peaks/troughs, using zero-crossing fallback");
    const simpleRate = estimateBreathingRateZeroCrossing(signal, sampleRateHz);
    return {
      ...defaultResult,
      primaryAxis,
      breathsPerMinute: Math.round(simpleRate * 10) / 10,
      pattern: simpleRate > 6 && simpleRate < 20 ? "regular" : "irregular",
    };
  }

  // 4. Build breath cycles from peaks and troughs
  const cycles: BreathCycle[] = [];
  const baseTimestamp = samples[0]?.timestamp || 0;

  // Find cycles: trough → peak → trough (one full breath)
  for (let i = 0; i < troughs.length - 1; i++) {
    const troughBefore = troughs[i];

    // Find peak between this trough and the next
    const peak = peaks.find((p) => p > troughBefore && (i + 1 >= troughs.length || p < troughs[i + 1]));

    if (!peak) continue;

    const troughAfter = troughs[i + 1];

    // Calculate times relative to recording start
    const inhaleStartMs = (troughBefore / sampleRateHz) * 1000;
    const inhaleEndMs = (peak / sampleRateHz) * 1000;
    const exhaleStartMs = inhaleEndMs;
    const exhaleEndMs = (troughAfter / sampleRateHz) * 1000;

    // Detect pauses
    const pauseAfterInhale = detectPause(filtered, peak, sampleRateHz);
    const pauseAfterExhale = detectPause(filtered, troughAfter, sampleRateHz);

    const inhaleDuration = inhaleEndMs - inhaleStartMs;
    const exhaleDuration = exhaleEndMs - exhaleStartMs;
    const totalDuration = exhaleEndMs - inhaleStartMs;

    // Sanity check: skip unrealistic cycles
    if (totalDuration < 1500 || totalDuration > 15000) {
      continue;
    }
    if (inhaleDuration < 500 || exhaleDuration < 500) {
      continue;
    }

    cycles.push({
      startTime: inhaleStartMs,
      inhaleStart: inhaleStartMs,
      inhaleEnd: inhaleEndMs,
      inhaleDuration,
      exhaleStart: exhaleStartMs,
      exhaleEnd: exhaleEndMs,
      exhaleDuration,
      pauseAfterInhale,
      pauseAfterExhale,
      totalDuration,
    });
  }

  console.log(`[Breathing] Valid cycles: ${cycles.length}`);

  if (cycles.length < BREATHING_CONFIG.minCyclesForAnalysis) {
    console.log("[Breathing] Insufficient valid cycles, using zero-crossing fallback");
    const simpleRate = estimateBreathingRateZeroCrossing(signal, sampleRateHz);
    return {
      ...defaultResult,
      primaryAxis,
      cycles,
      breathsPerMinute: Math.round(simpleRate * 10) / 10,
      pattern: simpleRate > 6 && simpleRate < 20 ? "regular" : "irregular",
    };
  }

  // 5. Calculate aggregates
  const avgInhale = mean(cycles.map((c) => c.inhaleDuration));
  const avgExhale = mean(cycles.map((c) => c.exhaleDuration));
  const avgPauseIn = mean(cycles.map((c) => c.pauseAfterInhale));
  const avgPauseEx = mean(cycles.map((c) => c.pauseAfterExhale));
  const avgCycleDuration = mean(cycles.map((c) => c.totalDuration));

  const durationSeconds = samples.length / sampleRateHz;
  const breathsPerMinute = (cycles.length / durationSeconds) * 60;
  const inhaleExhaleRatio = avgExhale > 0 ? avgInhale / avgExhale : 1;

  // 6. Coherence = how consistent are the cycle durations
  const durationStdDev = stdDev(cycles.map((c) => c.totalDuration));
  const durationMean = mean(cycles.map((c) => c.totalDuration));
  const coefficientOfVariation = durationMean > 0 ? durationStdDev / durationMean : 1;
  const coherence = Math.max(0, Math.min(100, Math.round(100 * (1 - coefficientOfVariation))));

  // 7. Categorize pattern
  const pattern = categorizePattern(breathsPerMinute, coherence, avgCycleDuration);

  // Logging
  console.log(`[Breathing] Rate: ${breathsPerMinute.toFixed(1)} breaths/min`);
  console.log(`[Breathing] Inhale: ${(avgInhale / 1000).toFixed(1)}s avg`);
  console.log(`[Breathing] Exhale: ${(avgExhale / 1000).toFixed(1)}s avg`);
  console.log(`[Breathing] Pause after inhale: ${(avgPauseIn / 1000).toFixed(1)}s avg`);
  console.log(`[Breathing] Pause after exhale: ${(avgPauseEx / 1000).toFixed(1)}s avg`);
  console.log(`[Breathing] Ratio: 1:${(1 / inhaleExhaleRatio).toFixed(2)} (exhale ${inhaleExhaleRatio < 1 ? Math.round((1 / inhaleExhaleRatio - 1) * 100) : -Math.round((1 - inhaleExhaleRatio) * 100)}% ${inhaleExhaleRatio < 1 ? "longer" : "shorter"})`);
  console.log(`[Breathing] Coherence: ${coherence}/100`);
  console.log(`[Breathing] Pattern: ${pattern}`);
  console.log(`[Breathing] Cycles detected: ${cycles.length}`);
  console.log("[Breathing] ===================================\n");

  return {
    breathsPerMinute: Math.round(breathsPerMinute * 10) / 10,
    cycles,
    averageInhaleDuration: Math.round(avgInhale),
    averageExhaleDuration: Math.round(avgExhale),
    averagePauseAfterInhale: Math.round(avgPauseIn),
    averagePauseAfterExhale: Math.round(avgPauseEx),
    inhaleExhaleRatio: Math.round(inhaleExhaleRatio * 100) / 100,
    coherence,
    pattern,
    durationSeconds,
    primaryAxis,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// INSIGHT GENERATION
// ════════════════════════════════════════════════════════════════════════════════

export interface BreathingInsight {
  category: "ratio" | "coherence" | "rate" | "pauses";
  title: string;
  description: string;
  quality: "good" | "neutral" | "concern";
}

/**
 * Generate health insights from breathing analysis
 */
export function generateBreathingInsights(analysis: BreathingAnalysis): BreathingInsight[] {
  const insights: BreathingInsight[] = [];

  // Inhale:Exhale ratio insight
  if (analysis.inhaleExhaleRatio <= 0.67) {
    // Exhale 50%+ longer
    insights.push({
      category: "ratio",
      title: "Relaxed Breathing",
      description: "Your exhale is significantly longer than your inhale, indicating good vagal tone and parasympathetic activation.",
      quality: "good",
    });
  } else if (analysis.inhaleExhaleRatio <= 0.85) {
    // Exhale 15-50% longer
    insights.push({
      category: "ratio",
      title: "Balanced Breathing",
      description: "Your exhale is longer than your inhale, suggesting a calm state.",
      quality: "good",
    });
  } else if (analysis.inhaleExhaleRatio >= 1.2) {
    // Inhale longer than exhale
    insights.push({
      category: "ratio",
      title: "Shallow Breathing Pattern",
      description: "Your inhale is longer than your exhale, which may indicate stress or tension. Try extending your exhale.",
      quality: "concern",
    });
  } else {
    insights.push({
      category: "ratio",
      title: "Neutral Ratio",
      description: "Your inhale and exhale are roughly equal. For relaxation, try making your exhale 50% longer.",
      quality: "neutral",
    });
  }

  // Coherence insight
  if (analysis.coherence >= 80) {
    insights.push({
      category: "coherence",
      title: "Highly Coherent",
      description: "Your breathing is very rhythmic and regular, often seen during meditation or focused relaxation.",
      quality: "good",
    });
  } else if (analysis.coherence >= 60) {
    insights.push({
      category: "coherence",
      title: "Regular Pattern",
      description: "Your breathing shows good consistency with normal variation.",
      quality: "good",
    });
  } else if (analysis.coherence >= 40) {
    insights.push({
      category: "coherence",
      title: "Variable Pattern",
      description: "Your breathing rhythm varies. This is normal during activity but might indicate distraction at rest.",
      quality: "neutral",
    });
  } else {
    insights.push({
      category: "coherence",
      title: "Irregular Pattern",
      description: "Your breathing is quite irregular. This could indicate anxiety, distraction, or physical activity.",
      quality: "concern",
    });
  }

  // Rate insight
  if (analysis.breathsPerMinute >= 6 && analysis.breathsPerMinute <= 10) {
    insights.push({
      category: "rate",
      title: "Optimal Rate",
      description: `${analysis.breathsPerMinute.toFixed(1)} breaths/min is in the optimal range for heart rate variability and vagal tone.`,
      quality: "good",
    });
  } else if (analysis.breathsPerMinute > 10 && analysis.breathsPerMinute <= 16) {
    insights.push({
      category: "rate",
      title: "Normal Rate",
      description: `${analysis.breathsPerMinute.toFixed(1)} breaths/min is within the normal resting range.`,
      quality: "neutral",
    });
  } else if (analysis.breathsPerMinute > 16) {
    insights.push({
      category: "rate",
      title: "Elevated Rate",
      description: `${analysis.breathsPerMinute.toFixed(1)} breaths/min is above normal resting rate. Consider slowing your breath.`,
      quality: "concern",
    });
  } else if (analysis.breathsPerMinute < 6) {
    insights.push({
      category: "rate",
      title: "Very Slow Rate",
      description: `${analysis.breathsPerMinute.toFixed(1)} breaths/min is quite slow, typical of deep meditation or trained practitioners.`,
      quality: "good",
    });
  }

  // Pause insight
  if (analysis.averagePauseAfterInhale > 500) {
    insights.push({
      category: "pauses",
      title: "Breath Holding",
      description: "You're pausing significantly after inhaling. This pattern can indicate stress or controlled breathing practice.",
      quality: analysis.averagePauseAfterInhale > 2000 ? "concern" : "neutral",
    });
  }

  if (analysis.averagePauseAfterExhale > 1000) {
    insights.push({
      category: "pauses",
      title: "Natural Pause",
      description: "A pause after exhale is normal and healthy, indicating relaxed breathing.",
      quality: "good",
    });
  }

  return insights;
}
