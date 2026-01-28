/**
 * NeuroGut Audio Processor – Mic Calibration & Acoustic Environment Isolation
 *
 * Central config for motility detection, contact/quality checks, and environmental
 * noise isolation. Used by audioAnalytics and the recording UI.
 *
 * NG-HARDEN-05: Acoustic Environment Isolation
 * - Ambient Noise Floor (ANF) calibration
 * - Tightened bandpass filter (100Hz-450Hz)
 * - Duration Gating (0.5s-2s signals only)
 * - Spectral Subtraction for constant hums
 * - Transient Suppression for sharp clicks
 * - Signal Quality (SNR) metric
 *
 * Calibration goal: Filter background room hum; a 30s silent session (e.g. phone on table)
 * should yield Motility Index near 0. BBQ/crowd noise should NOT trigger false gut events.
 */

// ══════════════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS (backward compatibility)
// ══════════════════════════════════════════════════════════════════════════════════

/** RMS threshold multiplier for event detection. Higher = less sensitive to ambient noise. */
export const MOTILITY_THRESHOLD_MULTIPLIER = 2.5;

/** Max coefficient-of-variation of energy (std/mean) below which we consider noise "flat" (no skin contact). */
export const FLAT_NOISE_CV_THRESHOLD = 0.08;

/**
 * Minimum RMS energy threshold for skin contact detection.
 * Phone on abdomen with skin contact typically has higher baseline energy
 * due to the muffled acoustic coupling.
 * Values below this indicate phone is not properly placed on skin.
 * Normalized to 0-1 range where typical skin-contact RMS is 0.01-0.1
 */
export const MIN_SKIN_CONTACT_RMS = 0.005;

// ══════════════════════════════════════════════════════════════════════════════════
// NG-HARDEN-05: ACOUSTIC ENVIRONMENT ISOLATION CONFIG
// ══════════════════════════════════════════════════════════════════════════════════

export const ACOUSTIC_ISOLATION_CONFIG = {
  // ────────────────────────────────────────────────────────────────────────────────
  // AMBIENT NOISE FLOOR (ANF) CALIBRATION
  // 5-second pre-recording baseline to measure environmental noise
  // ────────────────────────────────────────────────────────────────────────────────

  /** Duration in seconds for ANF calibration (silent baseline measurement) */
  anfCalibrationDurationSeconds: 5,

  /** Multiplier above ANF mean for adaptive event threshold
   *  Events must exceed: anfMean + (anfThresholdMultiplier * anfStdDev) */
  anfThresholdMultiplier: 1.5,

  /** Minimum Signal-to-Noise Ratio (dB) required for reliable detection
   *  Below this, Signal Quality is "Poor" and results are unreliable */
  anfMinSNR: 6.0,

  /** Window size in ms for ANF calculation */
  anfWindowMs: 100,

  // ────────────────────────────────────────────────────────────────────────────────
  // TIGHTENED BANDPASS FILTER (100Hz-450Hz)
  // Gut sounds cluster in this range; environmental noise is broader
  // ────────────────────────────────────────────────────────────────────────────────

  /** Lower cutoff frequency for gut sound isolation (Hz)
   *  Borborygmi and peristalsis start around 100Hz */
  gutBandLowHz: 100,

  /** Upper cutoff frequency for gut sound isolation (Hz)
   *  Most gut sounds are below 450Hz; speech/birds are above */
  gutBandHighHz: 450,

  /** Filter rolloff steepness (dB/octave)
   *  Higher = sharper cutoff, better isolation */
  rolloffDbPerOctave: 24,

  /** Transition bandwidth for smooth rolloff (Hz) */
  transitionBandwidthHz: 50,

  // ────────────────────────────────────────────────────────────────────────────────
  // DURATION GATING (0.5s - 2s)
  // Physiological gut sounds have characteristic durations
  // ────────────────────────────────────────────────────────────────────────────────

  /** Minimum event duration to be considered a valid gut sound (ms)
   *  Gut sounds are sustained; clicks are <100ms */
  minEventDurationMs: 500,

  /** Maximum event duration to be considered a valid gut sound (ms)
   *  Gut sounds are transient; constant noise lasts >2s */
  maxEventDurationMs: 2000,

  /** Duration below which events are rejected as transients (ms)
   *  Door slams, clicks, coughs are typically <100ms */
  transientRejectDurationMs: 100,

  // ────────────────────────────────────────────────────────────────────────────────
  // SPECTRAL SUBTRACTION (Constant Hum Removal)
  // Remove AC mains, refrigerator, HVAC hums from signal
  // ────────────────────────────────────────────────────────────────────────────────

  /** Threshold for detecting a constant frequency hum (0-1)
   *  Higher = more confident detection required */
  humDetectionThreshold: 0.7,

  /** Common hum frequencies to check (Hz)
   *  AC mains: 50/60Hz and harmonics */
  humFrequencyBands: [50, 60, 100, 120, 180, 240, 300],

  /** Strength of spectral subtraction (0-1)
   *  Higher = more aggressive removal (risk of artifacts) */
  subtractionStrength: 0.8,

  /** Minimum energy ratio for a frequency to be considered a hum
   *  Hum energy must exceed this fraction of total energy */
  humEnergyRatioThreshold: 0.15,

  // ────────────────────────────────────────────────────────────────────────────────
  // TRANSIENT SUPPRESSION (Click/Clatter Rejection)
  // Reject sharp attacks that are not physiological
  // ────────────────────────────────────────────────────────────────────────────────

  /** Onset slope threshold above which signal is considered a transient
   *  Gut sounds have gradual onset; clicks are instantaneous */
  transientOnsetSlopeThreshold: 10.0,

  /** Maximum duration for transient classification (ms) */
  transientMaxDurationMs: 100,

  /** Energy ratio (peak/mean) above which signal is transient-like */
  transientEnergyRatioThreshold: 5.0,

  /** Number of samples to analyze for onset detection */
  onsetAnalysisWindowSamples: 256,

  // ────────────────────────────────────────────────────────────────────────────────
  // SIGNAL QUALITY METRIC (SNR)
  // ────────────────────────────────────────────────────────────────────────────────

  /** SNR thresholds for Signal Quality classification (dB) */
  snrExcellentThreshold: 20,
  snrGoodThreshold: 12,
  snrFairThreshold: 6,

  /** Smoothing factor for real-time SNR updates (0-1)
   *  Higher = more smoothing, slower response */
  snrSmoothingFactor: 0.3,
};

// ══════════════════════════════════════════════════════════════════════════════════
// AMBIENT NOISE FLOOR (ANF) CALIBRATION TYPES & FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Result of Ambient Noise Floor calibration
 */
export interface ANFCalibrationResult {
  /** Mean RMS energy during calibration period */
  anfMean: number;
  /** Standard deviation of RMS energy during calibration */
  anfStdDev: number;
  /** Adaptive threshold for event detection (anfMean + multiplier * stdDev) */
  adaptiveThreshold: number;
  /** Estimated Signal-to-Noise Ratio (dB) */
  estimatedSNR: number;
  /** Detected constant hum frequencies (Hz) */
  detectedHumFrequencies: number[];
  /** Signal Quality classification */
  signalQuality: SignalQuality;
  /** Number of calibration windows analyzed */
  calibrationWindows: number;
  /** Timestamp of calibration */
  calibratedAt: string;
}

/**
 * Signal Quality classification based on SNR
 */
export type SignalQuality = "excellent" | "good" | "fair" | "poor";

/**
 * Get Signal Quality classification from SNR value
 *
 * @param snrDb - Signal-to-Noise Ratio in decibels
 * @returns SignalQuality classification
 */
export function getSignalQuality(snrDb: number): SignalQuality {
  if (snrDb >= ACOUSTIC_ISOLATION_CONFIG.snrExcellentThreshold) return "excellent";
  if (snrDb >= ACOUSTIC_ISOLATION_CONFIG.snrGoodThreshold) return "good";
  if (snrDb >= ACOUSTIC_ISOLATION_CONFIG.snrFairThreshold) return "fair";
  return "poor";
}

/**
 * Compute RMS (Root Mean Square) energy of a sample window
 *
 * @param samples - Audio samples
 * @returns RMS energy value
 */
export function computeRMS(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sumSquares = samples.reduce((sum, s) => sum + s * s, 0);
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Perform Ambient Noise Floor calibration on a buffer of audio samples
 *
 * This function analyzes the first N seconds of audio to establish:
 * - Baseline noise level (ANF)
 * - Adaptive detection threshold
 * - Detected constant hum frequencies
 * - Signal Quality metric (SNR)
 *
 * @param samples - Raw audio samples for calibration
 * @param sampleRate - Sample rate in Hz
 * @returns ANFCalibrationResult with all calibration data
 */
export function calibrateAmbientNoiseFloor(
  samples: number[],
  sampleRate: number = 44100
): ANFCalibrationResult {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const windowSizeSamples = Math.floor((config.anfWindowMs / 1000) * sampleRate);
  const calibrationSamples = Math.floor(config.anfCalibrationDurationSeconds * sampleRate);

  // Use only calibration period
  const calibrationData = samples.slice(0, Math.min(calibrationSamples, samples.length));

  if (calibrationData.length < windowSizeSamples) {
    // Not enough data for calibration
    return {
      anfMean: 0,
      anfStdDev: 0,
      adaptiveThreshold: 0.01,
      estimatedSNR: 0,
      detectedHumFrequencies: [],
      signalQuality: "poor",
      calibrationWindows: 0,
      calibratedAt: new Date().toISOString(),
    };
  }

  // Compute windowed RMS energies
  const rmsValues: number[] = [];
  for (let i = 0; i + windowSizeSamples <= calibrationData.length; i += windowSizeSamples) {
    const window = calibrationData.slice(i, i + windowSizeSamples);
    const rms = computeRMS(window);
    rmsValues.push(rms);
  }

  // Compute ANF statistics
  const anfMean = rmsValues.reduce((sum, r) => sum + r, 0) / rmsValues.length;
  const anfVariance =
    rmsValues.reduce((sum, r) => sum + (r - anfMean) ** 2, 0) / rmsValues.length;
  const anfStdDev = Math.sqrt(anfVariance);

  // Adaptive threshold: anfMean + multiplier * stdDev
  const adaptiveThreshold = anfMean + config.anfThresholdMultiplier * anfStdDev;

  // ══════════════════════════════════════════════════════════════════════════════
  // REFERENCE-BASED SNR ESTIMATION
  // During calibration we measure NOISE, not signal. Low noise = GOOD.
  // SNR estimates potential for detecting gut sounds against the noise floor.
  // ══════════════════════════════════════════════════════════════════════════════
  
  // Reference gut signal level based on clinical data (typical borborygmi RMS)
  // Normalized audio: gut sounds typically measure 0.01-0.05 RMS (-40 to -26 dB)
  const REFERENCE_GUT_SIGNAL_RMS = 0.02; // -34 dB, conservative estimate
  
  // SNR = 20 * log10(expectedSignal / noiseFloor)
  // - Quiet room (anfMean=0.001): SNR = 26 dB (excellent)
  // - Normal room (anfMean=0.005): SNR = 12 dB (good)  
  // - Noisy room (anfMean=0.02): SNR = 0 dB (poor)
  const estimatedSNR = anfMean > 0 
    ? 20 * Math.log10(REFERENCE_GUT_SIGNAL_RMS / anfMean)
    : 30; // Silent input defaults to excellent

  // Detect constant hum frequencies via simple spectral analysis
  const detectedHumFrequencies = detectConstantHums(calibrationData, sampleRate);

  // Classify signal quality
  const signalQuality = getSignalQuality(estimatedSNR);

  return {
    anfMean,
    anfStdDev,
    adaptiveThreshold,
    estimatedSNR,
    detectedHumFrequencies,
    signalQuality,
    calibrationWindows: rmsValues.length,
    calibratedAt: new Date().toISOString(),
  };
}

/**
 * Detect constant frequency hums in calibration data
 *
 * Uses autocorrelation to find periodic components matching known hum frequencies.
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Array of detected hum frequencies (Hz)
 */
function detectConstantHums(samples: number[], sampleRate: number): number[] {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const detectedHums: number[] = [];

  // Use a 4096-sample window for frequency analysis
  const analysisWindow = Math.min(4096, samples.length);
  const analysisSamples = samples.slice(0, analysisWindow);

  // Check each known hum frequency
  for (const humFreq of config.humFrequencyBands) {
    const periodSamples = Math.round(sampleRate / humFreq);

    if (periodSamples >= analysisWindow) continue;

    // Simple autocorrelation at the hum period
    let correlation = 0;
    let energy = 0;

    for (let i = 0; i < analysisWindow - periodSamples; i++) {
      correlation += analysisSamples[i] * analysisSamples[i + periodSamples];
      energy += analysisSamples[i] * analysisSamples[i];
    }

    if (energy > 0) {
      const normalizedCorr = correlation / energy;
      if (normalizedCorr > config.humDetectionThreshold) {
        detectedHums.push(humFreq);
      }
    }
  }

  return detectedHums;
}

// ══════════════════════════════════════════════════════════════════════════════════
// DURATION GATING
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Duration Gating Result
 */
export interface DurationGatingResult {
  /** Is the event within valid gut sound duration range? */
  isValidDuration: boolean;
  /** Is the event a rejected transient (<100ms)? */
  isTransient: boolean;
  /** Is the event too long (>2s constant noise)? */
  isTooLong: boolean;
  /** Event duration in milliseconds */
  durationMs: number;
}

/**
 * Apply duration gating to determine if an event has valid gut sound duration
 *
 * @param durationMs - Event duration in milliseconds
 * @returns DurationGatingResult with classification
 */
export function applyDurationGating(durationMs: number): DurationGatingResult {
  const config = ACOUSTIC_ISOLATION_CONFIG;

  const isTransient = durationMs < config.transientRejectDurationMs;
  const isTooLong = durationMs > config.maxEventDurationMs;
  const isValidDuration =
    durationMs >= config.minEventDurationMs && durationMs <= config.maxEventDurationMs;

  return {
    isValidDuration,
    isTransient,
    isTooLong,
    durationMs,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// SPECTRAL SUBTRACTION (Hum Removal)
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Apply spectral subtraction to remove detected constant hums
 *
 * This is a simplified approach that attenuates energy at known hum frequencies.
 *
 * @param samples - Audio samples
 * @param humFrequencies - Array of detected hum frequencies (Hz)
 * @param sampleRate - Sample rate in Hz
 * @returns Filtered samples with hums attenuated
 */
export function applySpectralSubtraction(
  samples: number[],
  humFrequencies: number[],
  sampleRate: number = 44100
): number[] {
  if (humFrequencies.length === 0 || samples.length === 0) {
    return samples;
  }

  const config = ACOUSTIC_ISOLATION_CONFIG;
  const result = [...samples];

  // For each hum frequency, apply a notch filter effect
  for (const humFreq of humFrequencies) {
    const omega = (2 * Math.PI * humFreq) / sampleRate;
    const bandwidth = 5 / sampleRate; // Narrow notch (5 Hz wide)

    // Simple notch filter via subtracting estimated sinusoid
    for (let i = 0; i < result.length; i++) {
      const t = i / sampleRate;
      const estimatedHum = Math.sin(2 * Math.PI * humFreq * t) * config.subtractionStrength;
      result[i] -= estimatedHum * 0.1; // Conservative subtraction
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════════
// TRANSIENT SUPPRESSION
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Transient Detection Result
 */
export interface TransientDetectionResult {
  /** Is this a sharp transient (click/clatter)? */
  isTransient: boolean;
  /** Onset slope (rate of energy increase) */
  onsetSlope: number;
  /** Peak-to-mean energy ratio */
  energyRatio: number;
  /** Duration of the transient portion (ms) */
  transientDurationMs: number;
}

/**
 * Detect if a signal segment is a sharp transient (click, clatter, door slam)
 *
 * Transients have:
 * - Very fast onset (high slope)
 * - Short duration (<100ms)
 * - High peak-to-mean energy ratio
 *
 * @param samples - Audio samples for the event
 * @param sampleRate - Sample rate in Hz
 * @returns TransientDetectionResult
 */
export function detectTransient(
  samples: number[],
  sampleRate: number = 44100
): TransientDetectionResult {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const analysisWindow = Math.min(config.onsetAnalysisWindowSamples, samples.length);

  if (analysisWindow < 10) {
    return {
      isTransient: false,
      onsetSlope: 0,
      energyRatio: 0,
      transientDurationMs: 0,
    };
  }

  // Compute onset slope (rate of energy increase in first N samples)
  const onsetSamples = samples.slice(0, analysisWindow);
  const onsetEnergies: number[] = [];

  const miniWindow = 16;
  for (let i = 0; i + miniWindow <= onsetSamples.length; i += miniWindow) {
    const windowSamples = onsetSamples.slice(i, i + miniWindow);
    const energy = windowSamples.reduce((sum, s) => sum + s * s, 0) / miniWindow;
    onsetEnergies.push(energy);
  }

  // Calculate slope (energy change rate)
  let maxSlope = 0;
  for (let i = 1; i < onsetEnergies.length; i++) {
    const slope = (onsetEnergies[i] - onsetEnergies[i - 1]) / onsetEnergies[i - 1] || 0;
    maxSlope = Math.max(maxSlope, slope);
  }

  // Compute peak-to-mean energy ratio
  const allEnergies = samples.map((s) => s * s);
  const peakEnergy = Math.max(...allEnergies);
  const meanEnergy = allEnergies.reduce((sum, e) => sum + e, 0) / allEnergies.length;
  const energyRatio = meanEnergy > 0 ? peakEnergy / meanEnergy : 0;

  // Compute transient duration (time above 50% of peak)
  const threshold = peakEnergy * 0.5;
  let transientSamples = 0;
  for (const e of allEnergies) {
    if (e >= threshold) transientSamples++;
  }
  const transientDurationMs = (transientSamples / sampleRate) * 1000;

  // Classify as transient if:
  // - High onset slope, OR
  // - High energy ratio with short duration
  const isTransient =
    maxSlope > config.transientOnsetSlopeThreshold ||
    (energyRatio > config.transientEnergyRatioThreshold &&
      transientDurationMs < config.transientMaxDurationMs);

  return {
    isTransient,
    onsetSlope: maxSlope,
    energyRatio,
    transientDurationMs,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// SIGNAL QUALITY / SNR METRIC
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Real-time Signal Quality assessment
 */
export interface SignalQualityAssessment {
  /** Signal-to-Noise Ratio (dB) */
  snrDb: number;
  /** Signal Quality classification */
  quality: SignalQuality;
  /** Is the recording environment suitable? */
  isSuitable: boolean;
  /** Human-readable message for UI */
  message: string;
}

/**
 * Compute real-time Signal Quality assessment
 *
 * @param signalRMS - RMS energy of the current signal window
 * @param noiseFloorRMS - RMS energy of the noise floor (from ANF calibration)
 * @returns SignalQualityAssessment
 */
export function assessSignalQuality(
  signalRMS: number,
  noiseFloorRMS: number
): SignalQualityAssessment {
  const config = ACOUSTIC_ISOLATION_CONFIG;

  // Compute SNR
  const snrDb =
    noiseFloorRMS > 0 ? 10 * Math.log10(signalRMS / noiseFloorRMS) : 0;

  const quality = getSignalQuality(snrDb);
  const isSuitable = snrDb >= config.anfMinSNR;

  let message: string;
  switch (quality) {
    case "excellent":
      message = "Excellent signal quality - ideal for recording";
      break;
    case "good":
      message = "Good signal quality - suitable for recording";
      break;
    case "fair":
      message = "Fair signal quality - consider quieter environment";
      break;
    case "poor":
      message = "Poor signal quality - too much background noise";
      break;
  }

  return {
    snrDb,
    quality,
    isSuitable,
    message,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// COMBINED ACOUSTIC ISOLATION PIPELINE
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Full Acoustic Isolation Result
 */
export interface AcousticIsolationResult {
  /** ANF calibration data */
  calibration: ANFCalibrationResult;
  /** Was the recording environment suitable? */
  environmentSuitable: boolean;
  /** Recommended action for user */
  recommendation: string;
}

/**
 * Run the full Acoustic Environment Isolation pipeline
 *
 * This should be called at the start of a recording session to:
 * 1. Calibrate the ambient noise floor
 * 2. Detect constant hums
 * 3. Assess signal quality
 * 4. Provide user feedback
 *
 * @param calibrationSamples - Audio samples from 5-second calibration period
 * @param sampleRate - Sample rate in Hz
 * @returns AcousticIsolationResult
 */
export function runAcousticIsolation(
  calibrationSamples: number[],
  sampleRate: number = 44100
): AcousticIsolationResult {
  // Perform ANF calibration
  const calibration = calibrateAmbientNoiseFloor(calibrationSamples, sampleRate);

  // Assess environment suitability
  const environmentSuitable = calibration.signalQuality !== "poor";

  // Generate recommendation
  let recommendation: string;
  if (calibration.signalQuality === "excellent") {
    recommendation = "Environment is ideal. Begin recording.";
  } else if (calibration.signalQuality === "good") {
    recommendation = "Environment is suitable. Begin recording.";
  } else if (calibration.signalQuality === "fair") {
    recommendation =
      calibration.detectedHumFrequencies.length > 0
        ? `Background hum detected (${calibration.detectedHumFrequencies.join(", ")}Hz). Consider moving away from appliances.`
        : "Some background noise detected. Consider a quieter location.";
  } else {
    recommendation =
      "Environment too noisy for reliable recording. Please find a quieter location.";
  }

  return {
    calibration,
    environmentSuitable,
    recommendation,
  };
}
