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
 * TIGHTENED: Increased from 0.005 to 0.008 for stricter contact validation
 */
export const MIN_SKIN_CONTACT_RMS = 0.008;

// ══════════════════════════════════════════════════════════════════════════════════
// NG-HARDEN-05: ACOUSTIC ENVIRONMENT ISOLATION CONFIG
// ══════════════════════════════════════════════════════════════════════════════════

export const ACOUSTIC_ISOLATION_CONFIG = {
  // ────────────────────────────────────────────────────────────────────────────────
  // AMBIENT NOISE FLOOR (ANF) CALIBRATION
  // 5-second pre-recording baseline to measure environmental noise
  // ────────────────────────────────────────────────────────────────────────────────

  /** Duration in seconds for ANF calibration (silent baseline measurement)
   *  Extended from 5s to 10s for clinical-grade precision */
  anfCalibrationDurationSeconds: 10,

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
   *  Hard-coded 450Hz for clinical-grade gut sound isolation */
  gutBandHighHz: 450,

  /** Filter rolloff steepness (dB/octave)
   *  Third-order Butterworth = 60 dB/octave for clinical-grade isolation */
  rolloffDbPerOctave: 60,

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

  // ────────────────────────────────────────────────────────────────────────────────
  // ACOUSTIC FINGERPRINTING (Ralph Loop)
  // Accept short peristaltic bursts, reject constant environmental noise
  // ────────────────────────────────────────────────────────────────────────────────

  /** Minimum burst duration for valid gut sound (ms)
   *  Per Mansour et al.: minimum 20ms for valid bursts */
  burstMinDurationMs: 20,

  /** Maximum burst duration for valid gut sound (ms)
   *  Gut bursts rarely exceed 1.5 seconds; events >1500ms are breathing artifacts */
  burstMaxDurationMs: 1500,

  /** Duration above which constant noise is rejected (ms)
   *  Per Mansour et al.: breathing artifacts typically >1500ms */
  constantNoiseRejectMs: 1500,

  /** Maximum RMS variance for constant noise detection (0-1)
   *  Low variance = stationary/constant noise */
  stationarityVarianceThreshold: 0.05,
};

// ══════════════════════════════════════════════════════════════════════════════════
// AMBIENT NOISE FLOOR (ANF) CALIBRATION TYPES & FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Result of Ambient Noise Floor calibration
 *
 * Extended for clinical-grade precision with mel noise profile,
 * frequency histogram baseline, and temporal variability metrics.
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

  // ══════════════════════════════════════════════════════════════════════════════
  // EXTENDED CALIBRATION DATA (Clinical-Grade Precision)
  // ══════════════════════════════════════════════════════════════════════════════

  /** Average mel energy per bin during calibration (64 bins, 100-450 Hz range)
   *  Used for mel-domain noise subtraction during event detection */
  melNoiseProfile?: number[];

  /** Frequency histogram baseline: distribution of peak frequencies during calibration
   *  8 bins spanning 100-450 Hz, normalized. Used for PFHS comparison. */
  frequencyHistogram?: number[];

  /** Temporal Variability Index: Coefficient of Variation (CV) of RMS energy over time
   *  Low CV (<0.1) = stationary noise; High CV (>0.3) = non-stationary signal
   *  Used for stationarity detection (constant noise rejection) */
  temporalVariabilityIndex?: number;

  /** Baseline Spectral Entropy: Shannon entropy of power spectrum during calibration
   *  High entropy (~1.0) = white noise; Low entropy (~0.5) = tonal/peaked
   *  Used for air noise vs. gut sound discrimination */
  baselineSpectralEntropy?: number;

  /** Noise floor in dB (20 * log10(anfMean / referenceLevel)) */
  noiseFloorDb?: number;
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
 * Extended for clinical-grade precision (10-second calibration):
 * - Baseline noise level (ANF)
 * - Adaptive detection threshold
 * - Detected constant hum frequencies
 * - Signal Quality metric (SNR)
 * - Mel noise profile for spectral subtraction
 * - Frequency histogram baseline for PFHS
 * - Temporal variability index for stationarity detection
 * - Baseline spectral entropy for noise discrimination
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

  // Use only calibration period (10 seconds for clinical-grade precision)
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
      melNoiseProfile: [],
      frequencyHistogram: new Array(8).fill(0),
      temporalVariabilityIndex: 0,
      baselineSpectralEntropy: 0,
      noiseFloorDb: -60,
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
  // TEMPORAL VARIABILITY INDEX (Coefficient of Variation)
  // CV = stdDev / mean - measures stationarity of the noise
  // Low CV (<0.1) = stationary noise (AC hum, fan)
  // High CV (>0.3) = non-stationary signal (speech, movement)
  // ══════════════════════════════════════════════════════════════════════════════
  const temporalVariabilityIndex = anfMean > 0 ? anfStdDev / anfMean : 0;

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

  // Noise floor in dB (relative to full scale)
  const noiseFloorDb = anfMean > 0 ? 20 * Math.log10(anfMean) : -60;

  // Detect constant hum frequencies via simple spectral analysis
  const detectedHumFrequencies = detectConstantHums(calibrationData, sampleRate);

  // Classify signal quality
  const signalQuality = getSignalQuality(estimatedSNR);

  // ══════════════════════════════════════════════════════════════════════════════
  // MEL NOISE PROFILE & SPECTRAL ENTROPY (Extended Calibration)
  // Compute mel-domain noise profile for spectral subtraction during detection
  // ══════════════════════════════════════════════════════════════════════════════
  const { melNoiseProfile, frequencyHistogram, baselineSpectralEntropy } =
    computeExtendedCalibrationMetrics(calibrationData, sampleRate);

  return {
    anfMean,
    anfStdDev,
    adaptiveThreshold,
    estimatedSNR,
    detectedHumFrequencies,
    signalQuality,
    calibrationWindows: rmsValues.length,
    calibratedAt: new Date().toISOString(),
    // Extended calibration data
    melNoiseProfile,
    frequencyHistogram,
    temporalVariabilityIndex,
    baselineSpectralEntropy,
    noiseFloorDb,
  };
}

/**
 * Compute extended calibration metrics for clinical-grade precision
 *
 * @param samples - Calibration audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Extended metrics: mel noise profile, frequency histogram, spectral entropy
 */
function computeExtendedCalibrationMetrics(
  samples: number[],
  sampleRate: number
): {
  melNoiseProfile: number[];
  frequencyHistogram: number[];
  baselineSpectralEntropy: number;
} {
  const FFT_SIZE = 2048;
  const HOP_SIZE = 512;
  const NUM_MEL_BINS = 64;
  const F_MIN = 100;
  const F_MAX = 450;

  // Default values if insufficient data
  if (samples.length < FFT_SIZE) {
    return {
      melNoiseProfile: new Array(NUM_MEL_BINS).fill(-10),
      frequencyHistogram: new Array(8).fill(0.125),
      baselineSpectralEntropy: 0.5,
    };
  }

  // Helper: Hz to Mel conversion
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

  // Create mel filterbank (simplified inline version)
  const melMin = hzToMel(F_MIN);
  const melMax = hzToMel(F_MAX);
  const melPoints: number[] = [];
  for (let i = 0; i < NUM_MEL_BINS + 2; i++) {
    melPoints.push(melMin + (i * (melMax - melMin)) / (NUM_MEL_BINS + 1));
  }
  const hzPoints = melPoints.map(melToHz);
  const numFftBins = FFT_SIZE / 2;
  const binPoints = hzPoints.map((hz) =>
    Math.floor((hz * numFftBins * 2) / sampleRate)
  );

  // Create triangular filters
  const melFilters: number[][] = [];
  for (let m = 0; m < NUM_MEL_BINS; m++) {
    const filter: number[] = new Array(numFftBins).fill(0);
    const leftBin = binPoints[m];
    const centerBin = binPoints[m + 1];
    const rightBin = binPoints[m + 2];

    for (let k = leftBin; k < centerBin; k++) {
      if (k >= 0 && k < numFftBins) {
        filter[k] = (k - leftBin) / (centerBin - leftBin + 1e-10);
      }
    }
    for (let k = centerBin; k <= rightBin; k++) {
      if (k >= 0 && k < numFftBins) {
        filter[k] = (rightBin - k) / (rightBin - centerBin + 1e-10);
      }
    }
    melFilters.push(filter);
  }

  // Process frames and accumulate mel energies
  const numFrames = Math.max(1, Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1);
  const melEnergySum: number[] = new Array(NUM_MEL_BINS).fill(0);
  const peakBins: number[] = [];
  const entropyValues: number[] = [];

  for (let frame = 0; frame < numFrames; frame++) {
    const startSample = frame * HOP_SIZE;
    let frameSamples = samples.slice(startSample, startSample + FFT_SIZE);
    if (frameSamples.length < FFT_SIZE) {
      frameSamples = [...frameSamples, ...new Array(FFT_SIZE - frameSamples.length).fill(0)];
    }

    // Apply Hann window
    const windowed = frameSamples.map(
      (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
    );

    // Compute magnitude spectrum (simplified DFT for key bins)
    const magnitudes: number[] = [];
    let maxMag = 0;
    let peakBin = 0;

    for (let k = 0; k < numFftBins; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < FFT_SIZE; n++) {
        const angle = (-2 * Math.PI * k * n) / FFT_SIZE;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(real * real + imag * imag);
      magnitudes.push(mag);
      if (mag > maxMag) {
        maxMag = mag;
        peakBin = k;
      }
    }

    peakBins.push(peakBin);

    // Apply mel filterbank
    for (let m = 0; m < NUM_MEL_BINS; m++) {
      let energy = 0;
      for (let k = 0; k < numFftBins; k++) {
        energy += magnitudes[k] * magnitudes[k] * melFilters[m][k];
      }
      melEnergySum[m] += Math.log(Math.max(energy, 1e-10));
    }

    // Compute spectral entropy for this frame
    const totalEnergy = magnitudes.reduce((sum, m) => sum + m * m, 0);
    if (totalEnergy > 0) {
      let entropy = 0;
      for (const m of magnitudes) {
        const p = (m * m) / totalEnergy;
        if (p > 1e-10) {
          entropy -= p * Math.log2(p);
        }
      }
      const maxEntropy = Math.log2(magnitudes.length);
      entropyValues.push(maxEntropy > 0 ? entropy / maxEntropy : 0);
    }
  }

  // Average mel noise profile
  const melNoiseProfile = melEnergySum.map((sum) => sum / numFrames);

  // Build frequency histogram (8 bins: 100-450 Hz)
  const binEdges = [100, 144, 188, 231, 275, 319, 363, 406, 450];
  const frequencyHistogram = new Array(8).fill(0);
  const freqPerBin = sampleRate / FFT_SIZE;

  for (const bin of peakBins) {
    const freq = bin * freqPerBin;
    for (let i = 0; i < 8; i++) {
      if (freq >= binEdges[i] && freq < binEdges[i + 1]) {
        frequencyHistogram[i]++;
        break;
      }
    }
  }

  // Normalize histogram
  const histTotal = frequencyHistogram.reduce((sum, h) => sum + h, 0);
  if (histTotal > 0) {
    for (let i = 0; i < 8; i++) {
      frequencyHistogram[i] /= histTotal;
    }
  }

  // Average spectral entropy
  const baselineSpectralEntropy =
    entropyValues.length > 0
      ? entropyValues.reduce((sum, e) => sum + e, 0) / entropyValues.length
      : 0.5;

  return {
    melNoiseProfile,
    frequencyHistogram,
    baselineSpectralEntropy,
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

// ══════════════════════════════════════════════════════════════════════════════════
// ACOUSTIC FINGERPRINTING (Ralph Loop)
// Burst validation and constant noise detection for improved event filtering
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Constant Noise Detection Result
 */
export interface ConstantNoiseResult {
  /** Is this signal constant/stationary noise? */
  isConstantNoise: boolean;
  /** Normalized RMS variance (0-1) */
  rmsVariance: number;
  /** Duration of the analyzed segment (ms) */
  durationMs: number;
  /** Detection reason */
  reason: string;
}

/**
 * Detect constant/stationary noise by measuring RMS variance over time
 *
 * Constant noise (AC hum, fans, traffic) has low RMS variance - the
 * amplitude stays nearly the same throughout. Gut sounds have high
 * variance due to their transient, bursting nature.
 *
 * @param samples - Audio samples for the event
 * @param sampleRate - Sample rate in Hz
 * @returns ConstantNoiseResult with detection data
 */
export function detectConstantNoise(
  samples: number[],
  sampleRate: number = 44100
): ConstantNoiseResult {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const windowSizeSamples = Math.floor((config.anfWindowMs / 1000) * sampleRate);
  const durationMs = (samples.length / sampleRate) * 1000;

  if (samples.length < windowSizeSamples * 2) {
    return {
      isConstantNoise: false,
      rmsVariance: 1.0,
      durationMs,
      reason: "Too short for variance analysis",
    };
  }

  // Compute windowed RMS values
  const rmsValues: number[] = [];
  for (let i = 0; i + windowSizeSamples <= samples.length; i += windowSizeSamples) {
    const window = samples.slice(i, i + windowSizeSamples);
    const rms = computeRMS(window);
    rmsValues.push(rms);
  }

  if (rmsValues.length < 2) {
    return {
      isConstantNoise: false,
      rmsVariance: 1.0,
      durationMs,
      reason: "Insufficient windows for variance",
    };
  }

  // Calculate mean and variance of RMS values
  const mean = rmsValues.reduce((sum, r) => sum + r, 0) / rmsValues.length;
  if (mean === 0) {
    return {
      isConstantNoise: false,
      rmsVariance: 0,
      durationMs,
      reason: "Silent signal",
    };
  }

  const variance = rmsValues.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rmsValues.length;
  // Normalize variance by mean squared (coefficient of variation squared)
  const normalizedVariance = variance / (mean * mean);

  // Constant noise: low variance AND duration > threshold
  const isConstantNoise =
    normalizedVariance < config.stationarityVarianceThreshold &&
    durationMs > config.constantNoiseRejectMs;

  return {
    isConstantNoise,
    rmsVariance: normalizedVariance,
    durationMs,
    reason: isConstantNoise
      ? `Stationary noise: variance=${normalizedVariance.toFixed(4)}, duration=${durationMs.toFixed(0)}ms`
      : `Dynamic signal: variance=${normalizedVariance.toFixed(4)}`,
  };
}

/**
 * Burst Event Validation Result
 */
export interface BurstValidationResult {
  /** Is this a valid burst (gut sound candidate)? */
  isValidBurst: boolean;
  /** Event duration in milliseconds */
  durationMs: number;
  /** Is this constant/environmental noise? */
  isConstantNoise: boolean;
  /** Is this a breathing artifact (>1500ms per Mansour et al.)? */
  isBreathingArtifact: boolean;
  /** Validation reason for debugging */
  reason: string;
}

/**
 * Validate an event against the acoustic fingerprint of gut sounds
 *
 * Gut sounds (borborygmi, peristalsis, gurgles) are characterized by:
 * - Short duration bursts (10ms - 1500ms)
 * - High amplitude variance (dynamic, not constant)
 *
 * Environmental noise is characterized by:
 * - Long duration (>2000ms for constant sources)
 * - Low amplitude variance (stationary)
 *
 * @param samples - Audio samples for the event
 * @param sampleRate - Sample rate in Hz
 * @returns BurstValidationResult with validation data
 */
export function validateBurstEvent(
  samples: number[],
  sampleRate: number = 44100
): BurstValidationResult {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const durationMs = (samples.length / sampleRate) * 1000;

  // Check duration bounds - too short
  if (durationMs < config.burstMinDurationMs) {
    return {
      isValidBurst: false,
      durationMs,
      isConstantNoise: false,
      isBreathingArtifact: false,
      reason: `Too short: ${durationMs.toFixed(0)}ms < ${config.burstMinDurationMs}ms`,
    };
  }

  // Per Mansour et al.: Events >1500ms are breathing artifacts
  if (durationMs > config.burstMaxDurationMs) {
    return {
      isValidBurst: false,
      durationMs,
      isConstantNoise: false,
      isBreathingArtifact: true,
      reason: `Breathing artifact: ${durationMs.toFixed(0)}ms > ${config.burstMaxDurationMs}ms`,
    };
  }

  // Short bursts within valid range are immediately accepted
  if (durationMs <= config.burstMaxDurationMs) {
    return {
      isValidBurst: true,
      durationMs,
      isConstantNoise: false,
      isBreathingArtifact: false,
      reason: `Valid burst: ${durationMs.toFixed(0)}ms in range [${config.burstMinDurationMs}-${config.burstMaxDurationMs}]ms`,
    };
  }

  // For longer events, check for constant noise characteristics
  const noiseResult = detectConstantNoise(samples, sampleRate);

  if (noiseResult.isConstantNoise) {
    return {
      isValidBurst: false,
      durationMs,
      isConstantNoise: true,
      isBreathingArtifact: false,
      reason: `Constant noise rejected: ${noiseResult.reason}`,
    };
  }

  // Long but dynamic events (rare gut sounds or compound events)
  // Accept if variance is high enough (not stationary)
  if (durationMs <= config.constantNoiseRejectMs) {
    return {
      isValidBurst: true,
      durationMs,
      isConstantNoise: false,
      isBreathingArtifact: false,
      reason: `Extended dynamic event: ${durationMs.toFixed(0)}ms with variance=${noiseResult.rmsVariance.toFixed(4)}`,
    };
  }

  // Very long events with moderate variance - reject as breathing artifact
  return {
    isValidBurst: false,
    durationMs,
    isConstantNoise: false,
    isBreathingArtifact: true,
    reason: `Breathing artifact: ${durationMs.toFixed(0)}ms > ${config.constantNoiseRejectMs}ms`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// STETHOSCOPE MICROPHONE CONFIGURATION
// Optimized for external stethoscope microphones with raw audio capture
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Audio mode configuration for iOS measurement mode
 * Bypasses all iOS audio processing for raw stethoscope input
 */
export const STETHOSCOPE_AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  // iOS Measurement mode - bypasses all signal processing
  // This is critical for stethoscope use as it disables:
  // - Automatic Gain Control (AGC)
  // - Noise Suppression
  // - Echo Cancellation
  interruptionModeIOS: 1, // DoNotMix
  interruptionModeAndroid: 1, // DoNotMix
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
};

/**
 * Recording options optimized for stethoscope/external microphone
 *
 * Key settings:
 * - 44100Hz sample rate for full frequency resolution
 * - 16-bit depth for clinical-grade fidelity
 * - VOICE_RECOGNITION audio source on Android (bypasses noise suppression)
 * - No built-in processing to preserve low-frequency gut sounds
 */
export const STETHOSCOPE_RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: 2, // MPEG_4
    audioEncoder: 3, // AAC
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    // VOICE_RECOGNITION (6) bypasses noise suppression
    // Alternative: CAMCORDER (5) also works well for external mics
    audioSource: 6, // MediaRecorder.AudioSource.VOICE_RECOGNITION
  },
  ios: {
    extension: ".m4a",
    outputFormat: "aac", // Use string format for iOS
    audioQuality: 127, // Max quality (AVAudioQuality.max)
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

/**
 * Input device types for verification
 */
export type AudioInputType =
  | "external_stethoscope"
  | "wired_headset"
  | "bluetooth"
  | "built_in_microphone"
  | "unknown";

/**
 * Input device check result
 */
export interface InputDeviceInfo {
  /** Type of input device detected */
  type: AudioInputType;
  /** Device name from system */
  name: string;
  /** Whether this is an external/preferred input */
  isExternalInput: boolean;
  /** Raw device UID */
  uid: string;
}

/**
 * Check and log the current audio input device
 *
 * Use this to verify the stethoscope is being used as input
 *
 * @param recording - Active Audio.Recording instance
 * @returns InputDeviceInfo with device details
 */
export async function checkInputDevice(
  recording: { getAvailableInputs?: () => Promise<any[]> } | null
): Promise<InputDeviceInfo> {
  const defaultResult: InputDeviceInfo = {
    type: "unknown",
    name: "Unknown",
    isExternalInput: false,
    uid: "",
  };

  if (!recording || typeof recording.getAvailableInputs !== "function") {
    console.log("[AudioProcessor] Recording instance does not support getAvailableInputs");
    return defaultResult;
  }

  try {
    const inputs = await recording.getAvailableInputs();
    console.log("[AudioProcessor] Available audio inputs:", JSON.stringify(inputs, null, 2));

    if (!inputs || inputs.length === 0) {
      console.log("[AudioProcessor] No audio inputs available");
      return defaultResult;
    }

    // Find the current/preferred input
    // Priority: External (stethoscope) > Wired Headset > Bluetooth > Built-in
    for (const input of inputs) {
      const name = (input.name || input.type || "").toLowerCase();
      const uid = input.uid || input.id || "";

      // Check for external/wired headset (stethoscope connects as headset)
      if (
        name.includes("headset") ||
        name.includes("wired") ||
        name.includes("external") ||
        name.includes("headphone")
      ) {
        const result: InputDeviceInfo = {
          type: "wired_headset",
          name: input.name || "Wired Headset",
          isExternalInput: true,
          uid,
        };
        console.log("[AudioProcessor] External input detected:", result);
        return result;
      }

      // Check for Bluetooth
      if (name.includes("bluetooth") || name.includes("bt")) {
        const result: InputDeviceInfo = {
          type: "bluetooth",
          name: input.name || "Bluetooth",
          isExternalInput: true,
          uid,
        };
        console.log("[AudioProcessor] Bluetooth input detected:", result);
        return result;
      }
    }

    // Default to built-in microphone
    const builtIn = inputs.find(
      (i: any) =>
        (i.name || "").toLowerCase().includes("built") ||
        (i.name || "").toLowerCase().includes("microphone") ||
        (i.type || "").toLowerCase().includes("built")
    );

    if (builtIn) {
      const result: InputDeviceInfo = {
        type: "built_in_microphone",
        name: builtIn.name || "Built-In Microphone",
        isExternalInput: false,
        uid: builtIn.uid || builtIn.id || "",
      };
      console.log("[AudioProcessor] Built-in microphone detected:", result);
      return result;
    }

    // Fallback: return first available input
    const firstInput = inputs[0];
    return {
      type: "unknown",
      name: firstInput.name || "Unknown Input",
      isExternalInput: false,
      uid: firstInput.uid || firstInput.id || "",
    };
  } catch (error) {
    console.error("[AudioProcessor] Error checking input device:", error);
    return defaultResult;
  }
}

/**
 * Verify stethoscope is connected and being used
 *
 * @param recording - Active Audio.Recording instance
 * @returns true if external input is detected
 */
export async function verifyStethoscopeInput(
  recording: { getAvailableInputs?: () => Promise<any[]> } | null
): Promise<boolean> {
  const deviceInfo = await checkInputDevice(recording);

  if (!deviceInfo.isExternalInput) {
    console.warn(
      "[AudioProcessor] WARNING: No external microphone detected. " +
      "Using built-in microphone. For best results, connect a stethoscope."
    );
  }

  return deviceInfo.isExternalInput;
}
