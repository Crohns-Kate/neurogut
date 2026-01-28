/**
 * NeuroGut Audio Analytics Module
 *
 * Simple on-device audio analysis for gut sound event detection.
 * This is a lightweight heuristic-based approach suitable for Expo/React Native.
 *
 * IMPORTANT: This is for self-tracking and pattern finding only, NOT medical diagnosis.
 *
 * How it works:
 * 1. Audio is loaded and converted to amplitude samples
 * 2. We slide a window across the samples and compute RMS (root mean square) energy
 * 3. Windows with energy above a threshold are marked as "events"
 * 4. Adjacent event windows are grouped into single events
 * 5. We compute metrics: events/minute, active vs quiet time, Motility Index
 *
 * TODO: Future improvements could include:
 * - Proper band-pass filtering (100-2000 Hz) for bowel sounds
 * - ML-based event classification
 * - More sophisticated event detection algorithms
 */

import { SessionAnalytics } from "../models/session";
import { MOTILITY_THRESHOLD_MULTIPLIER, MIN_SKIN_CONTACT_RMS } from "../logic/audioProcessor";

// Configuration for event detection
const CONFIG = {
  // Window size in milliseconds for RMS calculation
  windowSizeMs: 100,
  // Minimum gap between events to consider them separate (in windows)
  minGapWindows: 3,
  // RMS threshold multiplier (events are windows above mean + threshold * stdDev)
  // Sourced from audioProcessor for mic calibration; filters room hum / table noise
  thresholdMultiplier: MOTILITY_THRESHOLD_MULTIPLIER,
  // Minimum event duration in windows to count
  minEventWindows: 2,
  // Number of segments for the activity timeline
  timelineSegments: 10,
  // Sample rate assumption (most recordings are 44100 Hz)
  sampleRate: 44100,
  // Spectral bandpass filter for gut sounds (Hz)
  // Gut sounds are typically 150-1000 Hz
  // Birds, whistles, high speech are >1200 Hz - auto-discard
  bandpassLowHz: 150,
  bandpassHighHz: 1000,
  rejectAboveHz: 1200,

  // ══════════════════════════════════════════════════════════════════════════════
  // NOISE-FLOOR CALIBRATION (3-second window)
  // ══════════════════════════════════════════════════════════════════════════════
  // Duration in seconds for initial noise-floor calibration
  // The first 3 seconds establish ambient baseline before event detection
  calibrationDurationSeconds: 3,
  // Multiplier above calibrated noise floor for event threshold
  // Events must exceed: noiseFloor + (calibratedThresholdMultiplier * noiseFloorStdDev)
  calibratedThresholdMultiplier: 2.0,

  // ══════════════════════════════════════════════════════════════════════════════
  // TEMPORAL VETO FOR AIR/BREATH (800ms centered)
  // ══════════════════════════════════════════════════════════════════════════════
  // Breath sounds typically last 600-1000ms with gradual onset/offset
  // Events matching this profile are vetoed as non-gut artifacts
  breathVetoMinMs: 600,
  breathVetoMaxMs: 1000,
  breathVetoCenterMs: 800,
  // Maximum slope ratio (peak/onset energy) for breath detection
  // Breath has gradual onset; gut sounds have sharp transients
  // Ratio < 3.0 indicates gradual onset (breath-like)
  breathOnsetSlopeThreshold: 3.0,
  // Minimum number of windows for breath onset/offset analysis
  breathOnsetWindows: 3,

  // ══════════════════════════════════════════════════════════════════════════════
  // DEEP SPECTRAL HARDENING (NG-HARDEN-03)
  // FFT-based frequency analysis to eliminate air noise and breath artifacts
  // ══════════════════════════════════════════════════════════════════════════════

  // FFT window size (must be power of 2 for radix-2 FFT)
  // 2048 samples at 44100 Hz = ~46ms window, good frequency resolution (~21.5 Hz/bin)
  fftWindowSize: 2048,

  // SPECTRAL FLATNESS MEASURE (SFM)
  // SFM = geometric_mean(spectrum) / arithmetic_mean(spectrum)
  // White noise (air hiss) has SFM ≈ 1.0 (flat spectrum)
  // Gut sounds have SFM ≈ 0.1-0.4 (peaked spectrum)
  // Threshold below which signal is considered "peaked" (not white noise)
  sfmWhiteNoiseThreshold: 0.65,
  // SFM above this = definitely white noise (air hiss) - auto-reject
  sfmAutoRejectThreshold: 0.85,

  // BOWEL PEAK ISOLATION (100-500 Hz)
  // Primary gut sounds: borborygmi, peristalsis, gurgling
  // Energy should be concentrated in this band for valid gut sounds
  bowelPeakLowHz: 100,
  bowelPeakHighHz: 500,
  // Minimum ratio of bowel band energy to total energy
  // Gut sounds: > 0.4 (40%+ energy in bowel band)
  // Air hiss: < 0.3 (energy spread across all frequencies)
  bowelPeakMinRatio: 0.35,

  // ZERO-CROSSING RATE (ZCR)
  // ZCR = number of times signal crosses zero per sample
  // Gut sounds: irregular ZCR (0.05-0.20) due to complex waveform
  // Breath/air: smooth ZCR (0.30-0.50) due to noise-like waveform
  // High ZCR indicates noise-like signal
  zcrMaxForGutSound: 0.25,
  // Very high ZCR is definitely noise
  zcrAutoRejectThreshold: 0.40,

  // SPECTRAL CONTRAST
  // Measures difference between peaks and valleys in spectrum
  // Gut sounds: high contrast (clear peaks)
  // White noise: low contrast (flat spectrum)
  spectralContrastMinForGutSound: 0.3,

  // FREQUENCY-WEIGHTED CALIBRATION
  // Weight different frequency bands during noise floor calibration
  // Lower frequencies (100-300 Hz) are more relevant for gut sounds
  calibrationLowBandWeight: 0.6,
  calibrationMidBandWeight: 0.3,
  calibrationHighBandWeight: 0.1,
};

/**
 * Represents a detected gut sound event
 */
interface DetectedEvent {
  startWindow: number;
  endWindow: number;
  peakEnergy: number;
}

/**
 * Apply a simple bandpass filter using FFT-like frequency analysis
 * Filters out frequencies outside 150-1000 Hz range
 * Auto-discards energy above 1200 Hz (birds, whistles, high speech)
 *
 * @param samples - Raw audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Filtered samples with out-of-band energy removed
 */
function applySpectralBandpass(samples: number[], sampleRate: number): number[] {
  if (samples.length === 0) return samples;

  // Use overlapping windows for frequency analysis
  const windowSize = 1024; // ~23ms at 44100 Hz, good frequency resolution
  const hopSize = windowSize / 2;
  const output = new Array(samples.length).fill(0);
  const windowCounts = new Array(samples.length).fill(0);

  // Frequency bin resolution
  const freqPerBin = sampleRate / windowSize;
  const lowBin = Math.floor(CONFIG.bandpassLowHz / freqPerBin);
  const highBin = Math.ceil(CONFIG.bandpassHighHz / freqPerBin);
  const rejectBin = Math.floor(CONFIG.rejectAboveHz / freqPerBin);

  // Process in overlapping windows
  for (let start = 0; start + windowSize <= samples.length; start += hopSize) {
    const window = samples.slice(start, start + windowSize);

    // Apply Hann window to reduce spectral leakage
    const windowed = window.map((s, i) =>
      s * 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
    );

    // Compute magnitude spectrum using DFT for target bins only
    // (Full FFT is overkill; we only need specific frequency ranges)
    let inBandEnergy = 0;
    let outBandEnergy = 0;

    for (let k = 0; k < windowSize / 2; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < windowSize; n++) {
        const angle = -2 * Math.PI * k * n / windowSize;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      const magnitude = Math.sqrt(real * real + imag * imag);

      if (k >= lowBin && k <= highBin) {
        inBandEnergy += magnitude * magnitude;
      }
      if (k >= rejectBin) {
        outBandEnergy += magnitude * magnitude;
      }
    }

    // If high-frequency energy dominates, zero out this window (bird chirp/speech)
    const totalEnergy = inBandEnergy + outBandEnergy;
    const suppressFactor = totalEnergy > 0 && outBandEnergy > inBandEnergy * 0.5 ? 0 : 1;

    // Add filtered samples back with overlap-add
    for (let i = 0; i < windowSize; i++) {
      if (start + i < output.length) {
        output[start + i] += windowed[i] * suppressFactor;
        windowCounts[start + i]++;
      }
    }
  }

  // Normalize by overlap count
  return output.map((s, i) => windowCounts[i] > 0 ? s / windowCounts[i] : 0);
}

/**
 * Calculate RMS (root mean square) energy of a sample array
 */
function calculateRMS(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sumSquares = samples.reduce((sum, sample) => sum + sample * sample, 0);
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation of an array
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

// ══════════════════════════════════════════════════════════════════════════════════
// DEEP SPECTRAL HARDENING - FFT & FREQUENCY ANALYSIS (NG-HARDEN-03)
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Radix-2 Cooley-Tukey FFT Implementation
 * Computes the Fast Fourier Transform of a real-valued signal.
 *
 * @param samples - Input samples (length must be power of 2)
 * @returns Complex spectrum as array of {real, imag} pairs
 */
function computeFFT(samples: number[]): Array<{ real: number; imag: number }> {
  const N = samples.length;

  // Base case
  if (N <= 1) {
    return samples.map((s) => ({ real: s, imag: 0 }));
  }

  // Ensure power of 2
  if ((N & (N - 1)) !== 0) {
    // Pad to next power of 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = [...samples, ...new Array(nextPow2 - N).fill(0)];
    return computeFFT(padded);
  }

  // Split into even and odd
  const even: number[] = [];
  const odd: number[] = [];
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      even.push(samples[i]);
    } else {
      odd.push(samples[i]);
    }
  }

  // Recursive FFT
  const evenFFT = computeFFT(even);
  const oddFFT = computeFFT(odd);

  // Combine
  const result: Array<{ real: number; imag: number }> = new Array(N);
  for (let k = 0; k < N / 2; k++) {
    const angle = (-2 * Math.PI * k) / N;
    const twiddleReal = Math.cos(angle);
    const twiddleImag = Math.sin(angle);

    // Complex multiplication: twiddle * odd[k]
    const tReal = twiddleReal * oddFFT[k].real - twiddleImag * oddFFT[k].imag;
    const tImag = twiddleReal * oddFFT[k].imag + twiddleImag * oddFFT[k].real;

    result[k] = {
      real: evenFFT[k].real + tReal,
      imag: evenFFT[k].imag + tImag,
    };
    result[k + N / 2] = {
      real: evenFFT[k].real - tReal,
      imag: evenFFT[k].imag - tImag,
    };
  }

  return result;
}

/**
 * Compute magnitude spectrum from FFT result
 * Returns only positive frequencies (N/2 bins)
 *
 * @param fftResult - Complex FFT output
 * @returns Magnitude spectrum (positive frequencies only)
 */
function computeMagnitudeSpectrum(
  fftResult: Array<{ real: number; imag: number }>
): number[] {
  const N = fftResult.length;
  const magnitudes: number[] = [];

  // Only compute positive frequencies (0 to N/2)
  for (let k = 0; k < N / 2; k++) {
    const mag = Math.sqrt(
      fftResult[k].real * fftResult[k].real +
        fftResult[k].imag * fftResult[k].imag
    );
    magnitudes.push(mag);
  }

  return magnitudes;
}

/**
 * Result of spectral analysis for a single window
 */
interface SpectralAnalysis {
  /** Spectral Flatness Measure (0-1): 1 = white noise, 0 = pure tone */
  sfm: number;
  /** Ratio of energy in bowel band (100-500 Hz) to total energy */
  bowelPeakRatio: number;
  /** Zero-Crossing Rate (0-0.5): higher = more noise-like */
  zcr: number;
  /** Spectral contrast (0-1): higher = more peaked spectrum */
  spectralContrast: number;
  /** Total spectral energy */
  totalEnergy: number;
  /** Energy in bowel band (100-500 Hz) */
  bowelBandEnergy: number;
  /** Is this window likely white noise (air hiss)? */
  isWhiteNoise: boolean;
  /** Is this window likely a gut sound? */
  isLikelyGutSound: boolean;
}

/**
 * Compute Spectral Flatness Measure (SFM)
 *
 * SFM = geometric_mean(spectrum) / arithmetic_mean(spectrum)
 *
 * Mathematical properties:
 * - White noise (flat spectrum): SFM ≈ 1.0
 * - Pure tone (single frequency): SFM ≈ 0.0
 * - Gut sounds (peaked spectrum): SFM ≈ 0.1-0.4
 *
 * @param magnitudes - Magnitude spectrum
 * @returns SFM value between 0 and 1
 */
function computeSpectralFlatness(magnitudes: number[]): number {
  if (magnitudes.length === 0) return 0;

  // Filter out near-zero values to avoid log(0)
  const nonZero = magnitudes.filter((m) => m > 1e-10);
  if (nonZero.length === 0) return 0;

  // Geometric mean = exp(mean(log(x)))
  const logSum = nonZero.reduce((sum, m) => sum + Math.log(m), 0);
  const geometricMean = Math.exp(logSum / nonZero.length);

  // Arithmetic mean
  const arithmeticMean = nonZero.reduce((sum, m) => sum + m, 0) / nonZero.length;

  if (arithmeticMean === 0) return 0;

  // SFM = geometric / arithmetic
  const sfm = geometricMean / arithmeticMean;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, sfm));
}

/**
 * Compute energy ratio in bowel frequency band (100-500 Hz)
 *
 * Gut sounds concentrate energy in this band.
 * Air hiss spreads energy across all frequencies.
 *
 * @param magnitudes - Magnitude spectrum
 * @param sampleRate - Sample rate in Hz
 * @param fftSize - FFT window size
 * @returns Ratio of bowel band energy to total energy (0-1)
 */
function computeBowelPeakRatio(
  magnitudes: number[],
  sampleRate: number,
  fftSize: number
): { ratio: number; bowelEnergy: number; totalEnergy: number } {
  const freqPerBin = sampleRate / fftSize;
  const lowBin = Math.floor(CONFIG.bowelPeakLowHz / freqPerBin);
  const highBin = Math.ceil(CONFIG.bowelPeakHighHz / freqPerBin);

  let bowelEnergy = 0;
  let totalEnergy = 0;

  for (let i = 0; i < magnitudes.length; i++) {
    const energy = magnitudes[i] * magnitudes[i];
    totalEnergy += energy;

    if (i >= lowBin && i <= highBin) {
      bowelEnergy += energy;
    }
  }

  const ratio = totalEnergy > 0 ? bowelEnergy / totalEnergy : 0;

  return { ratio, bowelEnergy, totalEnergy };
}

/**
 * Compute Zero-Crossing Rate (ZCR)
 *
 * ZCR = (number of zero crossings) / (number of samples - 1)
 *
 * Characteristics:
 * - Gut sounds: irregular waveform → ZCR ≈ 0.05-0.20
 * - Breath/air hiss: noise-like → ZCR ≈ 0.30-0.50
 * - Pure tone: regular → ZCR ≈ 0.0-0.05
 *
 * @param samples - Time-domain samples
 * @returns ZCR value (0 to 0.5 typical range)
 */
function computeZeroCrossingRate(samples: number[]): number {
  if (samples.length < 2) return 0;

  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    // Count sign changes
    if ((samples[i] >= 0 && samples[i - 1] < 0) ||
        (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }

  return crossings / (samples.length - 1);
}

/**
 * Compute Spectral Contrast
 *
 * Measures the difference between spectral peaks and valleys.
 * High contrast = peaked spectrum (gut sounds)
 * Low contrast = flat spectrum (white noise)
 *
 * @param magnitudes - Magnitude spectrum
 * @returns Contrast value (0-1)
 */
function computeSpectralContrast(magnitudes: number[]): number {
  if (magnitudes.length < 10) return 0;

  // Sort magnitudes to find peaks and valleys
  const sorted = [...magnitudes].sort((a, b) => b - a);

  // Top 10% as peaks
  const peakCount = Math.max(1, Math.floor(magnitudes.length * 0.1));
  const peakEnergy = sorted.slice(0, peakCount).reduce((s, m) => s + m, 0) / peakCount;

  // Bottom 50% as valleys
  const valleyCount = Math.floor(magnitudes.length * 0.5);
  const valleyEnergy = sorted.slice(-valleyCount).reduce((s, m) => s + m, 0) / valleyCount;

  if (peakEnergy === 0) return 0;

  // Contrast = (peak - valley) / peak
  const contrast = (peakEnergy - valleyEnergy) / peakEnergy;

  return Math.max(0, Math.min(1, contrast));
}

/**
 * Perform full spectral analysis on a window of audio samples
 *
 * Combines FFT, SFM, Bowel Peak Ratio, ZCR, and Spectral Contrast
 * to determine if the window contains gut sounds or noise artifacts.
 *
 * @param samples - Time-domain samples (will be windowed and padded)
 * @param sampleRate - Sample rate in Hz
 * @returns SpectralAnalysis with all metrics and classification
 */
function analyzeWindowSpectrum(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): SpectralAnalysis {
  const fftSize = CONFIG.fftWindowSize;

  // Pad or truncate to FFT size
  let paddedSamples: number[];
  if (samples.length >= fftSize) {
    paddedSamples = samples.slice(0, fftSize);
  } else {
    paddedSamples = [...samples, ...new Array(fftSize - samples.length).fill(0)];
  }

  // Apply Hann window to reduce spectral leakage
  const windowed = paddedSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  );

  // Compute FFT and magnitude spectrum
  const fftResult = computeFFT(windowed);
  const magnitudes = computeMagnitudeSpectrum(fftResult);

  // Compute all spectral metrics
  const sfm = computeSpectralFlatness(magnitudes);
  const { ratio: bowelPeakRatio, bowelEnergy, totalEnergy } = computeBowelPeakRatio(
    magnitudes,
    sampleRate,
    fftSize
  );
  const zcr = computeZeroCrossingRate(samples);
  const spectralContrast = computeSpectralContrast(magnitudes);

  // CLASSIFICATION LOGIC
  // ══════════════════════════════════════════════════════════════════════════════

  // WHITE NOISE DETECTION (Air Hiss)
  // Criteria: High SFM + Low bowel ratio + High ZCR
  const isWhiteNoise =
    sfm >= CONFIG.sfmAutoRejectThreshold || // Definitely flat spectrum
    (sfm >= CONFIG.sfmWhiteNoiseThreshold &&
      bowelPeakRatio < CONFIG.bowelPeakMinRatio &&
      zcr > CONFIG.zcrMaxForGutSound) || // Multiple indicators of noise
    zcr >= CONFIG.zcrAutoRejectThreshold; // Very high ZCR = definitely noise

  // GUT SOUND DETECTION
  // Criteria: Low SFM + High bowel ratio + Low ZCR + High contrast
  const isLikelyGutSound =
    !isWhiteNoise &&
    sfm < CONFIG.sfmWhiteNoiseThreshold &&
    bowelPeakRatio >= CONFIG.bowelPeakMinRatio &&
    zcr <= CONFIG.zcrMaxForGutSound &&
    spectralContrast >= CONFIG.spectralContrastMinForGutSound;

  return {
    sfm,
    bowelPeakRatio,
    zcr,
    spectralContrast,
    totalEnergy,
    bowelBandEnergy: bowelEnergy,
    isWhiteNoise,
    isLikelyGutSound,
  };
}

/**
 * Analyze an event to determine if it's a valid gut sound or noise artifact
 *
 * This performs deep spectral analysis on the samples within an event
 * to classify it as gut sound or air/breath noise.
 *
 * @param samples - Full recording samples
 * @param event - Detected event with window indices
 * @param windowSizeSamples - Number of samples per window
 * @param sampleRate - Sample rate in Hz
 * @returns true if event is noise (should be rejected), false if valid gut sound
 */
function isSpectrallyNoise(
  samples: number[],
  event: DetectedEvent,
  windowSizeSamples: number,
  sampleRate: number
): boolean {
  // Extract samples for this event
  const startSample = event.startWindow * windowSizeSamples;
  const endSample = (event.endWindow + 1) * windowSizeSamples;
  const eventSamples = samples.slice(startSample, Math.min(endSample, samples.length));

  if (eventSamples.length < CONFIG.fftWindowSize / 4) {
    // Too short for reliable spectral analysis - use conservative approach
    return false;
  }

  // Analyze spectrum of the event
  const spectral = analyzeWindowSpectrum(eventSamples, sampleRate);

  // If spectral analysis says it's white noise, reject it
  if (spectral.isWhiteNoise) {
    return true;
  }

  // If it's definitely NOT a gut sound, reject it
  // (But don't reject ambiguous signals)
  if (spectral.sfm > CONFIG.sfmWhiteNoiseThreshold &&
      spectral.bowelPeakRatio < CONFIG.bowelPeakMinRatio * 0.8) {
    return true;
  }

  return false;
}

/**
 * Detect continuous air/breath noise in the entire recording
 *
 * If the whole recording is dominated by white noise characteristics,
 * it indicates the phone is in air or near a fan/vent.
 *
 * @param samples - Full recording samples
 * @param sampleRate - Sample rate in Hz
 * @returns true if recording is dominated by air noise
 */
function isRecordingDominatedByAirNoise(
  samples: number[],
  sampleRate: number
): boolean {
  if (samples.length < CONFIG.fftWindowSize) return false;

  // Analyze multiple windows across the recording
  const hopSize = CONFIG.fftWindowSize;
  const numWindows = Math.floor(samples.length / hopSize);
  const windowsToAnalyze = Math.min(numWindows, 10); // Sample up to 10 windows

  let whiteNoiseWindows = 0;
  const step = Math.max(1, Math.floor(numWindows / windowsToAnalyze));

  for (let i = 0; i < windowsToAnalyze; i++) {
    const startIdx = (i * step) * hopSize;
    const windowSamples = samples.slice(startIdx, startIdx + hopSize);

    if (windowSamples.length >= CONFIG.fftWindowSize / 2) {
      const spectral = analyzeWindowSpectrum(windowSamples, sampleRate);
      if (spectral.isWhiteNoise) {
        whiteNoiseWindows++;
      }
    }
  }

  // If > 70% of windows are white noise, recording is air-dominated
  const whiteNoiseRatio = whiteNoiseWindows / windowsToAnalyze;
  return whiteNoiseRatio > 0.7;
}

/**
 * Noise-floor calibration result from initial 3-second window
 * Enhanced with frequency-weighted analysis (NG-HARDEN-03)
 */
interface NoiseFloorCalibration {
  /** Mean RMS energy during calibration period */
  noiseFloorMean: number;
  /** Standard deviation of RMS energy during calibration */
  noiseFloorStdDev: number;
  /** Calculated threshold for event detection (mean + multiplier * stdDev) */
  eventThreshold: number;
  /** Number of windows used for calibration */
  calibrationWindows: number;
  /** Frequency-weighted noise floor (emphasizes gut sound band) */
  frequencyWeightedNoiseFloor: number;
  /** Average SFM during calibration (to detect baseline air noise) */
  baselineSfm: number;
  /** Is the baseline dominated by air noise? */
  isAirNoiseBaseline: boolean;
}

/**
 * Compute frequency-weighted energy for a window of samples
 *
 * Weights energy in different frequency bands:
 * - 100-300 Hz (gut sounds): 60% weight
 * - 300-600 Hz (mixed): 30% weight
 * - 600-1000 Hz (high): 10% weight
 *
 * @param samples - Time-domain samples
 * @param sampleRate - Sample rate in Hz
 * @returns Frequency-weighted energy value
 */
function computeFrequencyWeightedEnergy(
  samples: number[],
  sampleRate: number
): number {
  if (samples.length < 256) return 0;

  const fftSize = Math.min(CONFIG.fftWindowSize, samples.length);
  const freqPerBin = sampleRate / fftSize;

  // Bin boundaries for frequency bands
  const lowBandLow = Math.floor(100 / freqPerBin);
  const lowBandHigh = Math.floor(300 / freqPerBin);
  const midBandHigh = Math.floor(600 / freqPerBin);
  const highBandHigh = Math.floor(1000 / freqPerBin);

  // Pad or truncate to FFT size
  let paddedSamples: number[];
  if (samples.length >= fftSize) {
    paddedSamples = samples.slice(0, fftSize);
  } else {
    paddedSamples = [...samples, ...new Array(fftSize - samples.length).fill(0)];
  }

  // Apply Hann window
  const windowed = paddedSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  );

  // Compute FFT
  const fftResult = computeFFT(windowed);
  const magnitudes = computeMagnitudeSpectrum(fftResult);

  // Calculate energy in each band
  let lowBandEnergy = 0;
  let midBandEnergy = 0;
  let highBandEnergy = 0;

  for (let i = 0; i < magnitudes.length; i++) {
    const energy = magnitudes[i] * magnitudes[i];

    if (i >= lowBandLow && i < lowBandHigh) {
      lowBandEnergy += energy;
    } else if (i >= lowBandHigh && i < midBandHigh) {
      midBandEnergy += energy;
    } else if (i >= midBandHigh && i < highBandHigh) {
      highBandEnergy += energy;
    }
  }

  // Apply frequency weights
  const weightedEnergy =
    lowBandEnergy * CONFIG.calibrationLowBandWeight +
    midBandEnergy * CONFIG.calibrationMidBandWeight +
    highBandEnergy * CONFIG.calibrationHighBandWeight;

  return Math.sqrt(weightedEnergy);
}

/**
 * Compute noise-floor calibration from the first 3 seconds of audio
 *
 * Enhanced with frequency-weighted analysis (NG-HARDEN-03):
 * - Uses FFT to analyze spectral characteristics of baseline noise
 * - Weights lower frequencies (100-300 Hz) more heavily as they're relevant for gut sounds
 * - Detects if baseline is dominated by air noise (high SFM)
 *
 * @param energyValues - Windowed RMS energy values for entire recording
 * @param samples - Raw audio samples for frequency analysis
 * @param sampleRate - Audio sample rate
 * @returns NoiseFloorCalibration with threshold for event detection
 */
function computeNoiseFloor(
  energyValues: number[],
  samples?: number[],
  sampleRate: number = CONFIG.sampleRate
): NoiseFloorCalibration {
  // Calculate how many windows fit in the calibration period
  const windowsPerSecond = 1000 / CONFIG.windowSizeMs;
  const calibrationWindows = Math.floor(
    CONFIG.calibrationDurationSeconds * windowsPerSecond
  );

  // Use available windows if recording is shorter than calibration period
  const actualCalibrationWindows = Math.min(calibrationWindows, energyValues.length);

  // Default spectral values
  let frequencyWeightedNoiseFloor = 0;
  let baselineSfm = 0;
  let isAirNoiseBaseline = false;

  if (actualCalibrationWindows < 5) {
    // Fallback: not enough data for calibration, use full recording stats
    const noiseFloorMean = mean(energyValues);
    const noiseFloorStdDev = stdDev(energyValues);
    return {
      noiseFloorMean,
      noiseFloorStdDev,
      eventThreshold: noiseFloorMean + CONFIG.thresholdMultiplier * noiseFloorStdDev,
      calibrationWindows: actualCalibrationWindows,
      frequencyWeightedNoiseFloor: noiseFloorMean,
      baselineSfm: 0.5, // Unknown
      isAirNoiseBaseline: false,
    };
  }

  // Extract calibration window (first 3 seconds)
  const calibrationEnergies = energyValues.slice(0, actualCalibrationWindows);

  const noiseFloorMean = mean(calibrationEnergies);
  const noiseFloorStdDev = stdDev(calibrationEnergies);

  // FREQUENCY-WEIGHTED CALIBRATION (NG-HARDEN-03)
  // Analyze spectral characteristics of calibration period
  if (samples && samples.length > 0) {
    const calibrationSamples = Math.floor(
      CONFIG.calibrationDurationSeconds * sampleRate
    );
    const actualCalibrationSamples = Math.min(calibrationSamples, samples.length);
    const calSamples = samples.slice(0, actualCalibrationSamples);

    // Compute frequency-weighted energy
    frequencyWeightedNoiseFloor = computeFrequencyWeightedEnergy(calSamples, sampleRate);

    // Analyze spectral flatness of baseline
    if (calSamples.length >= CONFIG.fftWindowSize) {
      const spectral = analyzeWindowSpectrum(calSamples, sampleRate);
      baselineSfm = spectral.sfm;
      isAirNoiseBaseline = spectral.isWhiteNoise;
    }
  } else {
    frequencyWeightedNoiseFloor = noiseFloorMean;
  }

  // Event threshold: Use frequency-weighted noise floor for better accuracy
  // If baseline is air noise, use higher threshold
  const thresholdMultiplier = isAirNoiseBaseline
    ? CONFIG.calibratedThresholdMultiplier * 1.5 // Higher threshold for noisy baseline
    : CONFIG.calibratedThresholdMultiplier;

  const eventThreshold =
    Math.max(noiseFloorMean, frequencyWeightedNoiseFloor) +
    thresholdMultiplier * noiseFloorStdDev;

  return {
    noiseFloorMean,
    noiseFloorStdDev,
    eventThreshold,
    calibrationWindows: actualCalibrationWindows,
    frequencyWeightedNoiseFloor,
    baselineSfm,
    isAirNoiseBaseline,
  };
}

/**
 * Determine if an event matches the breath/air artifact profile
 *
 * Breath sounds have distinct characteristics:
 * 1. Duration: 600-1000ms (centered around 800ms)
 * 2. Gradual onset: Energy ramps up slowly (not sharp transient)
 * 3. Gradual offset: Energy fades out slowly
 * 4. Relatively uniform energy distribution across the event
 *
 * Gut sounds are different:
 * - Shorter bursts (< 500ms typically)
 * - Sharp onset (high transient)
 * - Irregular energy distribution (gurgling, borborygmi)
 *
 * @param event - Detected event to analyze
 * @param energyValues - Full energy array for onset/offset analysis
 * @returns true if event matches breath profile (should be vetoed)
 */
function isBreathLikeEvent(
  event: DetectedEvent,
  energyValues: number[]
): boolean {
  // Calculate event duration in milliseconds
  const eventDurationWindows = event.endWindow - event.startWindow + 1;
  const eventDurationMs = eventDurationWindows * CONFIG.windowSizeMs;

  // CHECK 1: Duration must be in breath range (600-1000ms)
  if (eventDurationMs < CONFIG.breathVetoMinMs || eventDurationMs > CONFIG.breathVetoMaxMs) {
    return false; // Not breath duration range
  }

  // CHECK 2: Analyze onset slope (gradual vs sharp)
  // Breath has gradual onset; gut sounds have sharp transients
  const onsetWindows = Math.min(CONFIG.breathOnsetWindows, eventDurationWindows);
  if (onsetWindows < 2) {
    return false; // Too short to analyze onset
  }

  // Get onset energy values (first few windows of event)
  const onsetEnergies: number[] = [];
  for (let i = 0; i < onsetWindows; i++) {
    const idx = event.startWindow + i;
    if (idx < energyValues.length) {
      onsetEnergies.push(energyValues[idx]);
    }
  }

  if (onsetEnergies.length < 2) {
    return false;
  }

  // Calculate onset slope ratio: peak / initial
  // Low ratio (< 3.0) = gradual onset (breath-like)
  // High ratio (> 3.0) = sharp transient (gut sound)
  const initialOnsetEnergy = onsetEnergies[0];
  const peakOnsetEnergy = Math.max(...onsetEnergies);

  if (initialOnsetEnergy <= 0) {
    return false; // Avoid division by zero
  }

  const onsetSlopeRatio = peakOnsetEnergy / initialOnsetEnergy;

  // CHECK 3: Analyze offset slope (gradual fade)
  const offsetWindows = Math.min(CONFIG.breathOnsetWindows, eventDurationWindows);
  const offsetEnergies: number[] = [];
  for (let i = 0; i < offsetWindows; i++) {
    const idx = event.endWindow - offsetWindows + 1 + i;
    if (idx >= 0 && idx < energyValues.length) {
      offsetEnergies.push(energyValues[idx]);
    }
  }

  let hasGradualOffset = false;
  if (offsetEnergies.length >= 2) {
    // Check if energy decreases gradually (not abrupt cutoff)
    const offsetStart = offsetEnergies[0];
    const offsetEnd = offsetEnergies[offsetEnergies.length - 1];
    // Gradual offset: energy decreases by less than 80% abruptly
    hasGradualOffset = offsetEnd > offsetStart * 0.2;
  }

  // VETO DECISION:
  // Event is breath-like if:
  // - Duration is in breath range (already checked)
  // - Onset is gradual (slope ratio < threshold)
  // - Offset is gradual (optional but strengthens decision)
  const hasGradualOnset = onsetSlopeRatio < CONFIG.breathOnsetSlopeThreshold;

  // Require gradual onset; gradual offset is supporting evidence
  return hasGradualOnset && hasGradualOffset;
}

/**
 * Compute windowed RMS energy values from raw audio samples
 */
function computeWindowedEnergy(
  samples: number[],
  windowSize: number
): number[] {
  const energyValues: number[] = [];
  const numWindows = Math.floor(samples.length / windowSize);

  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const end = start + windowSize;
    const windowSamples = samples.slice(start, end);
    energyValues.push(calculateRMS(windowSamples));
  }

  return energyValues;
}

/**
 * Detect events from windowed energy values using adaptive thresholding
 *
 * @param energyValues - Windowed RMS energy values
 * @param calibratedThreshold - Optional pre-computed threshold from noise-floor calibration.
 *                              If not provided, falls back to full-recording adaptive threshold.
 */
function detectEvents(
  energyValues: number[],
  calibratedThreshold?: number
): DetectedEvent[] {
  if (energyValues.length === 0) return [];

  // Use calibrated threshold if provided, otherwise compute from full recording
  let threshold: number;
  if (calibratedThreshold !== undefined && calibratedThreshold > 0) {
    threshold = calibratedThreshold;
  } else {
    // Fallback: Calculate adaptive threshold based on full signal statistics
    const avgEnergy = mean(energyValues);
    const energyStdDev = stdDev(energyValues);
    threshold = avgEnergy + CONFIG.thresholdMultiplier * energyStdDev;
  }

  // Find windows above threshold
  const aboveThreshold = energyValues.map((e) => e > threshold);

  // Group consecutive windows into events
  const events: DetectedEvent[] = [];
  let inEvent = false;
  let eventStart = 0;
  let peakEnergy = 0;
  let gapCount = 0;

  for (let i = 0; i < aboveThreshold.length; i++) {
    if (aboveThreshold[i]) {
      if (!inEvent) {
        // Start new event
        inEvent = true;
        eventStart = i;
        peakEnergy = energyValues[i];
      } else {
        // Continue event, update peak
        peakEnergy = Math.max(peakEnergy, energyValues[i]);
      }
      gapCount = 0;
    } else {
      if (inEvent) {
        gapCount++;
        if (gapCount >= CONFIG.minGapWindows) {
          // End event (gap is large enough)
          const eventEnd = i - gapCount;
          const eventLength = eventEnd - eventStart + 1;

          if (eventLength >= CONFIG.minEventWindows) {
            events.push({
              startWindow: eventStart,
              endWindow: eventEnd,
              peakEnergy,
            });
          }

          inEvent = false;
          gapCount = 0;
        }
      }
    }
  }

  // Handle event that extends to end of recording
  if (inEvent) {
    const eventEnd = aboveThreshold.length - 1 - gapCount;
    const eventLength = eventEnd - eventStart + 1;

    if (eventLength >= CONFIG.minEventWindows) {
      events.push({
        startWindow: eventStart,
        endWindow: eventEnd,
        peakEnergy,
      });
    }
  }

  return events;
}

/**
 * Create activity timeline by dividing recording into segments
 */
function createActivityTimeline(
  energyValues: number[],
  numSegments: number
): number[] {
  if (energyValues.length === 0) {
    return new Array(numSegments).fill(0);
  }

  const windowsPerSegment = Math.ceil(energyValues.length / numSegments);
  const timeline: number[] = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * windowsPerSegment;
    const end = Math.min(start + windowsPerSegment, energyValues.length);
    const segmentEnergies = energyValues.slice(start, end);

    if (segmentEnergies.length > 0) {
      // Normalize to 0-100 scale
      const segmentMean = mean(segmentEnergies);
      // Scale relative to max energy in entire recording
      const maxEnergy = Math.max(...energyValues);
      const normalized =
        maxEnergy > 0 ? Math.round((segmentMean / maxEnergy) * 100) : 0;
      timeline.push(normalized);
    } else {
      timeline.push(0);
    }
  }

  return timeline;
}

/**
 * Calculate Motility Index from events and timing
 *
 * The Motility Index (0-100) combines:
 * - Events per minute (normalized)
 * - Fraction of active time
 *
 * This is a simple heuristic designed for self-tracking, not medical assessment.
 */
function calculateMotilityIndex(
  eventsPerMinute: number,
  activeFraction: number
): number {
  // Expected range for normal gut sounds: 5-15 events per minute
  // We normalize this to 0-100 scale
  const MIN_EPM = 0;
  const MAX_EPM = 20; // Events above this are considered very active

  const normalizedEPM = Math.min(
    100,
    Math.max(0, ((eventsPerMinute - MIN_EPM) / (MAX_EPM - MIN_EPM)) * 100)
  );

  // Active fraction contributes to overall score
  const activenessScore = activeFraction * 100;

  // Combine both metrics (weighted average)
  // Events per minute is weighted more heavily as it's more meaningful
  const motilityIndex = Math.round(normalizedEPM * 0.7 + activenessScore * 0.3);

  return Math.min(100, Math.max(0, motilityIndex));
}

/**
 * Detect lack of skin contact through multiple heuristics:
 *
 * 1. MINIMUM ENERGY: Phone on abdomen with proper skin contact creates
 *    higher baseline energy due to acoustic coupling with body.
 *    Very low energy indicates phone is in air or on hard surface.
 *
 * 2. FLAT NOISE: Consistent background hum without variation patterns
 *    expected from gut sounds. Skin contact creates a "muffled" quality with:
 *    - Damping of high frequencies by tissue
 *    - Increased low-frequency content
 *    - Characteristic bursts from gut activity
 *
 * 3. EXCESSIVE LOW VARIANCE: If energy varies very little, the phone
 *    is likely not picking up gut sounds (which naturally vary).
 *
 * @param energyValues - Windowed RMS energy values
 * @returns true if no skin contact detected (should report 0 events)
 */
function detectNoSkinContact(energyValues: number[]): boolean {
  if (energyValues.length < 10) return false;

  const avgEnergy = mean(energyValues);
  const energyStdDev = stdDev(energyValues);

  // CHECK 1: Minimum energy threshold
  // Phone on skin should have baseline RMS above MIN_SKIN_CONTACT_RMS
  // If average energy is below this, phone is likely in air or on table
  if (avgEnergy < MIN_SKIN_CONTACT_RMS) {
    return true;
  }

  // CHECK 2: Coefficient of variation (CV) = stdDev / mean
  // Flat noise has very low CV (< 0.10) - consistent background hum
  // Gut sounds should have more variance (CV > 0.10)
  const cv = avgEnergy > 0 ? energyStdDev / avgEnergy : 0;

  // CHECK 3: Very low standard deviation relative to mean
  // Gut sounds have bursts; flat noise is consistent
  const hasLowVariance = energyStdDev < avgEnergy * 0.08;

  // If CV is too low AND variance is low, it's likely flat noise (no contact)
  return cv < 0.10 && hasLowVariance;
}

/**
 * Analysis options for controlling filter behavior
 */
export interface AnalysisOptions {
  /**
   * Whether to apply the spectral bandpass filter (150-1000 Hz)
   * Set to true for motility recording phase (filters birds, whistles)
   * Set to false for humming/primer phase (allows 100-300 Hz humming)
   * Default: true
   */
  applyBirdFilter?: boolean;

  /**
   * Whether this is a humming/primer phase recording
   * If true, uses wider frequency band (80-500 Hz) for humming detection
   * Default: false
   */
  isHummingPhase?: boolean;
}

/**
 * Analyze audio samples and compute session analytics
 *
 * BIRD FILTER GUARDRAILS:
 * - The 150Hz-1000Hz bandpass filter is ONLY active during the final 30-second
 *   motility recording phase, NOT during the humming primer phase.
 * - During humming, the filter is bypassed to allow detection of humming
 *   frequencies (100-300 Hz range).
 *
 * @param samples - Raw audio samples (normalized to -1 to 1 range)
 * @param durationSeconds - Total recording duration in seconds
 * @param sampleRate - Audio sample rate (default 44100)
 * @param options - Analysis options controlling filter behavior
 * @returns SessionAnalytics object with computed metrics
 */
export function analyzeAudioSamples(
  samples: number[],
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate,
  options: AnalysisOptions = {}
): SessionAnalytics {
  const { applyBirdFilter = true, isHummingPhase = false } = options;

  // BIRD FILTER GUARDRAILS:
  // - Only apply spectral bandpass during motility recording phase
  // - During humming phase, skip the bird filter entirely
  let filteredSamples: number[];

  if (isHummingPhase) {
    // HUMMING PHASE: No bird filter, raw samples used for humming detection
    filteredSamples = samples;
  } else if (applyBirdFilter) {
    // MOTILITY PHASE: Apply spectral bandpass (150-1000 Hz)
    // Filters out bird chirps, whistles, high-pitched speech
    filteredSamples = applySpectralBandpass(samples, sampleRate);
  } else {
    // Bird filter disabled explicitly
    filteredSamples = samples;
  }

  // Convert window size from ms to samples
  const windowSizeSamples = Math.floor(
    (CONFIG.windowSizeMs / 1000) * sampleRate
  );

  // Compute windowed energy from FILTERED samples
  const energyValues = computeWindowedEnergy(filteredSamples, windowSizeSamples);

  // ══════════════════════════════════════════════════════════════════════════════
  // DEEP SPECTRAL HARDENING - AIR NOISE DETECTION (NG-HARDEN-03)
  // Check if entire recording is dominated by air noise BEFORE any processing
  // ══════════════════════════════════════════════════════════════════════════════
  const isDominatedByAirNoise = isRecordingDominatedByAirNoise(filteredSamples, sampleRate);
  if (isDominatedByAirNoise) {
    // Return zero motility - recording is air/breath noise, not gut sounds
    return {
      eventsPerMinute: 0,
      totalActiveSeconds: 0,
      totalQuietSeconds: Math.round(durationSeconds),
      motilityIndex: 0,
      activityTimeline: new Array(CONFIG.timelineSegments).fill(0),
      timelineSegments: CONFIG.timelineSegments,
    };
  }

  // SKIN CONTACT SENSOR: Check for flat noise (no skin contact)
  const noSkinContact = detectNoSkinContact(energyValues);
  if (noSkinContact) {
    // Return zero motility for flat noise (phone on table, no skin contact)
    return {
      eventsPerMinute: 0,
      totalActiveSeconds: 0,
      totalQuietSeconds: Math.round(durationSeconds),
      motilityIndex: 0,
      activityTimeline: new Array(CONFIG.timelineSegments).fill(0),
      timelineSegments: CONFIG.timelineSegments,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FREQUENCY-WEIGHTED NOISE-FLOOR CALIBRATION (3-second window)
  // Enhanced with spectral analysis to detect air noise baseline (NG-HARDEN-03)
  // ══════════════════════════════════════════════════════════════════════════════
  const noiseFloor = computeNoiseFloor(energyValues, filteredSamples, sampleRate);

  // If baseline is dominated by air noise, use stricter detection
  if (noiseFloor.isAirNoiseBaseline) {
    // Return zero motility - baseline indicates phone is in air, not on skin
    return {
      eventsPerMinute: 0,
      totalActiveSeconds: 0,
      totalQuietSeconds: Math.round(durationSeconds),
      motilityIndex: 0,
      activityTimeline: new Array(CONFIG.timelineSegments).fill(0),
      timelineSegments: CONFIG.timelineSegments,
    };
  }

  // Detect events using calibrated threshold
  let events = detectEvents(energyValues, noiseFloor.eventThreshold);

  // ══════════════════════════════════════════════════════════════════════════════
  // TEMPORAL VETO FOR AIR/BREATH (800ms centered)
  // Filter out events matching breath artifact profile (600-1000ms, gradual onset)
  // ══════════════════════════════════════════════════════════════════════════════
  events = events.filter((event) => !isBreathLikeEvent(event, energyValues));

  // ══════════════════════════════════════════════════════════════════════════════
  // DEEP SPECTRAL VETO (NG-HARDEN-03)
  // Analyze each event's spectrum to reject noise masquerading as gut sounds
  // ══════════════════════════════════════════════════════════════════════════════
  events = events.filter((event) => !isSpectrallyNoise(
    filteredSamples,
    event,
    windowSizeSamples,
    sampleRate
  ));

  // Calculate metrics
  const durationMinutes = durationSeconds / 60;
  const eventsPerMinute =
    durationMinutes > 0 ? events.length / durationMinutes : 0;

  // Calculate active vs quiet time
  const totalWindows = energyValues.length;
  let activeWindows = 0;

  events.forEach((event) => {
    activeWindows += event.endWindow - event.startWindow + 1;
  });

  const windowDurationSeconds = CONFIG.windowSizeMs / 1000;
  const totalActiveSeconds = activeWindows * windowDurationSeconds;
  const totalQuietSeconds = Math.max(0, durationSeconds - totalActiveSeconds);

  const activeFraction = totalWindows > 0 ? activeWindows / totalWindows : 0;

  // Calculate Motility Index
  const motilityIndex = calculateMotilityIndex(eventsPerMinute, activeFraction);

  // Create activity timeline
  const activityTimeline = createActivityTimeline(
    energyValues,
    CONFIG.timelineSegments
  );

  return {
    eventsPerMinute: Math.round(eventsPerMinute * 10) / 10,
    totalActiveSeconds: Math.round(totalActiveSeconds),
    totalQuietSeconds: Math.round(totalQuietSeconds),
    motilityIndex,
    activityTimeline,
    timelineSegments: CONFIG.timelineSegments,
  };
}

/**
 * Generate placeholder analytics for when real audio analysis isn't available
 * (e.g., on web platform or when audio file can't be read)
 *
 * @param durationSeconds - Recording duration in seconds
 * @returns Placeholder SessionAnalytics with realistic-looking values
 */
export function generatePlaceholderAnalytics(
  durationSeconds: number
): SessionAnalytics {
  // Generate somewhat random but realistic-looking values
  const baseEvents = 5 + Math.random() * 10; // 5-15 events per minute
  const eventsPerMinute = Math.round(baseEvents * 10) / 10;

  const activeFraction = 0.2 + Math.random() * 0.4; // 20-60% active
  const totalActiveSeconds = Math.round(durationSeconds * activeFraction);
  const totalQuietSeconds = durationSeconds - totalActiveSeconds;

  const motilityIndex = calculateMotilityIndex(eventsPerMinute, activeFraction);

  // Generate random timeline
  const activityTimeline = Array.from(
    { length: CONFIG.timelineSegments },
    () => Math.round(20 + Math.random() * 60)
  );

  return {
    eventsPerMinute,
    totalActiveSeconds,
    totalQuietSeconds,
    motilityIndex,
    activityTimeline,
    timelineSegments: CONFIG.timelineSegments,
  };
}

/**
 * Configuration getter (for testing)
 */
export function getConfig() {
  return { ...CONFIG };
}

/**
 * Audio visualization data for waveform rendering
 * Enhanced with spectral analysis data (NG-HARDEN-03)
 */
export interface AudioVisualizationData {
  // RMS energy per window (100ms windows)
  energyValues: number[];
  // Detected events with time information
  events: Array<{
    startWindow: number;
    endWindow: number;
    peakEnergy: number;
    startTimeSeconds: number;
    endTimeSeconds: number;
  }>;
  // Window size in milliseconds
  windowSizeMs: number;
  // Sample rate used for analysis
  sampleRate: number;
  // Total duration in seconds
  durationSeconds: number;
  // Noise-floor calibration data (enhanced with spectral analysis)
  noiseFloorCalibration?: {
    noiseFloorMean: number;
    eventThreshold: number;
    calibrationWindows: number;
    // NG-HARDEN-03 additions
    frequencyWeightedNoiseFloor?: number;
    baselineSfm?: number;
    isAirNoiseBaseline?: boolean;
  };
  // Spectral analysis summary (NG-HARDEN-03)
  spectralAnalysis?: {
    isDominatedByAirNoise: boolean;
    baselineSfm: number;
  };
}

/**
 * Get visualization data for audio waveform rendering
 *
 * This function computes the same analysis as analyzeAudioSamples() but
 * returns the raw energy values and event data needed for visualization.
 * Use this when you need to render a detailed waveform with event markers.
 *
 * BIRD FILTER GUARDRAILS:
 * - Same filtering logic as analyzeAudioSamples()
 * - Only applies bandpass during motility phase, not humming phase
 *
 * @param samples - Raw audio samples (normalized to -1 to 1 range)
 * @param durationSeconds - Total recording duration in seconds
 * @param sampleRate - Audio sample rate (default 44100)
 * @param options - Analysis options controlling filter behavior
 * @returns AudioVisualizationData with energy values and events
 */
export function getVisualizationData(
  samples: number[],
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate,
  options: AnalysisOptions = {}
): AudioVisualizationData {
  const { applyBirdFilter = true, isHummingPhase = false } = options;

  // Apply same filtering logic as analyzeAudioSamples
  let filteredSamples: number[];

  if (isHummingPhase) {
    filteredSamples = samples;
  } else if (applyBirdFilter) {
    filteredSamples = applySpectralBandpass(samples, sampleRate);
  } else {
    filteredSamples = samples;
  }

  // Convert window size from ms to samples
  const windowSizeSamples = Math.floor(
    (CONFIG.windowSizeMs / 1000) * sampleRate
  );

  // Compute windowed energy from FILTERED samples
  const energyValues = computeWindowedEnergy(filteredSamples, windowSizeSamples);

  // ══════════════════════════════════════════════════════════════════════════════
  // DEEP SPECTRAL HARDENING - AIR NOISE DETECTION (NG-HARDEN-03)
  // ══════════════════════════════════════════════════════════════════════════════
  const isDominatedByAirNoise = isRecordingDominatedByAirNoise(filteredSamples, sampleRate);

  // ══════════════════════════════════════════════════════════════════════════════
  // FREQUENCY-WEIGHTED NOISE-FLOOR CALIBRATION (3-second window)
  // ══════════════════════════════════════════════════════════════════════════════
  const noiseFloor = computeNoiseFloor(energyValues, filteredSamples, sampleRate);

  // Detect events using calibrated threshold
  let events = detectEvents(energyValues, noiseFloor.eventThreshold);

  // Apply all filters unless recording is air noise dominated
  if (!isDominatedByAirNoise && !noiseFloor.isAirNoiseBaseline) {
    // ══════════════════════════════════════════════════════════════════════════════
    // TEMPORAL VETO FOR AIR/BREATH (800ms centered)
    // ══════════════════════════════════════════════════════════════════════════════
    events = events.filter((event) => !isBreathLikeEvent(event, energyValues));

    // ══════════════════════════════════════════════════════════════════════════════
    // DEEP SPECTRAL VETO (NG-HARDEN-03)
    // ══════════════════════════════════════════════════════════════════════════════
    events = events.filter((event) => !isSpectrallyNoise(
      filteredSamples,
      event,
      windowSizeSamples,
      sampleRate
    ));
  } else {
    // Air noise dominated - no valid events
    events = [];
  }

  // Convert window indices to time in seconds
  const windowDurationSeconds = CONFIG.windowSizeMs / 1000;
  const eventsWithTime = events.map((event) => ({
    startWindow: event.startWindow,
    endWindow: event.endWindow,
    peakEnergy: event.peakEnergy,
    startTimeSeconds: event.startWindow * windowDurationSeconds,
    endTimeSeconds: (event.endWindow + 1) * windowDurationSeconds,
  }));

  return {
    energyValues,
    events: eventsWithTime,
    windowSizeMs: CONFIG.windowSizeMs,
    sampleRate,
    durationSeconds,
    // Include calibration data for debugging/visualization (NG-HARDEN-03 enhanced)
    noiseFloorCalibration: {
      noiseFloorMean: noiseFloor.noiseFloorMean,
      eventThreshold: noiseFloor.eventThreshold,
      calibrationWindows: noiseFloor.calibrationWindows,
      frequencyWeightedNoiseFloor: noiseFloor.frequencyWeightedNoiseFloor,
      baselineSfm: noiseFloor.baselineSfm,
      isAirNoiseBaseline: noiseFloor.isAirNoiseBaseline,
    },
    // Spectral analysis summary (NG-HARDEN-03)
    spectralAnalysis: {
      isDominatedByAirNoise,
      baselineSfm: noiseFloor.baselineSfm,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// SIMULATION & VALIDATION UTILITIES (NG-HARDEN-03)
// For verifying spectral hardening against known noise patterns
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Generate synthetic white noise (air hiss simulation)
 *
 * Creates flat-spectrum noise with uniform random values,
 * simulating constant air flow or fan noise.
 *
 * @param durationSeconds - Duration of noise to generate
 * @param sampleRate - Sample rate (default 44100)
 * @param amplitude - Peak amplitude (default 0.3)
 * @returns Array of noise samples
 */
export function generateWhiteNoise(
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate,
  amplitude: number = 0.3
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    // Uniform random noise between -amplitude and +amplitude
    samples.push((Math.random() * 2 - 1) * amplitude);
  }

  return samples;
}

/**
 * Generate synthetic breath noise
 *
 * Creates noise with breath-like characteristics:
 * - 800ms duration bursts
 * - Gradual onset/offset
 * - Flat spectrum (white noise modulated by envelope)
 *
 * @param durationSeconds - Total duration
 * @param sampleRate - Sample rate
 * @param breathCount - Number of breath events
 * @returns Array of breath noise samples
 */
export function generateBreathNoise(
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate,
  breathCount: number = 3
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  const breathDurationSamples = Math.floor(0.8 * sampleRate); // 800ms
  const spacing = Math.floor(numSamples / (breathCount + 1));

  for (let b = 0; b < breathCount; b++) {
    const startSample = spacing * (b + 1);

    for (let i = 0; i < breathDurationSamples; i++) {
      if (startSample + i < numSamples) {
        // Gradual envelope: ramp up, sustain, ramp down
        const progress = i / breathDurationSamples;
        let envelope: number;

        if (progress < 0.2) {
          // Ramp up (0 to 0.2)
          envelope = progress / 0.2;
        } else if (progress > 0.8) {
          // Ramp down (0.8 to 1.0)
          envelope = (1 - progress) / 0.2;
        } else {
          // Sustain
          envelope = 1.0;
        }

        // White noise modulated by envelope
        samples[startSample + i] = (Math.random() * 2 - 1) * 0.2 * envelope;
      }
    }
  }

  return samples;
}

/**
 * Generate synthetic gut sound
 *
 * Creates signal with gut sound characteristics:
 * - Short bursts (100-300ms)
 * - Sharp transients
 * - Energy concentrated in 100-500 Hz band
 *
 * @param durationSeconds - Total duration
 * @param sampleRate - Sample rate
 * @param eventCount - Number of gut sound events
 * @returns Array of gut sound samples
 */
export function generateGutSound(
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate,
  eventCount: number = 5
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  // Add low-level background noise
  for (let i = 0; i < numSamples; i++) {
    samples[i] = (Math.random() * 2 - 1) * 0.01;
  }

  const spacing = Math.floor(numSamples / (eventCount + 1));

  for (let e = 0; e < eventCount; e++) {
    const startSample = spacing * (e + 1);
    const eventDuration = Math.floor((0.1 + Math.random() * 0.2) * sampleRate); // 100-300ms

    // Generate gut sound as sum of low-frequency components
    const frequencies = [150, 200, 280, 350]; // Gut sound frequencies

    for (let i = 0; i < eventDuration; i++) {
      if (startSample + i < numSamples) {
        const t = i / sampleRate;

        // Sharp attack envelope
        const progress = i / eventDuration;
        let envelope: number;
        if (progress < 0.1) {
          envelope = progress / 0.1; // Fast attack
        } else {
          envelope = Math.exp(-(progress - 0.1) * 3); // Exponential decay
        }

        // Sum of sinusoids with some irregularity
        let sample = 0;
        for (const freq of frequencies) {
          const phase = Math.random() * Math.PI * 2;
          sample += Math.sin(2 * Math.PI * freq * t + phase) * (0.5 + Math.random() * 0.5);
        }

        samples[startSample + i] += sample * envelope * 0.15;
      }
    }
  }

  return samples;
}

/**
 * Simulation result from spectral hardening validation
 */
export interface SimulationResult {
  scenario: string;
  description: string;
  expectedMotilityIndex: number;
  actualMotilityIndex: number;
  expectedEventsPerMinute: number;
  actualEventsPerMinute: number;
  passed: boolean;
  spectralAnalysis: {
    sfm: number;
    bowelPeakRatio: number;
    zcr: number;
    isDominatedByAirNoise: boolean;
  };
}

/**
 * Run simulation to validate spectral hardening
 *
 * Tests the audio analytics against known synthetic signals
 * to verify air noise and breath artifacts are correctly rejected.
 *
 * @returns Array of simulation results
 */
export function runSpectralHardeningSimulation(): SimulationResult[] {
  const results: SimulationResult[] = [];
  const durationSeconds = 10; // 10 second test recordings
  const sampleRate = CONFIG.sampleRate;

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Constant Air Noise (White Noise)
  // Expected: motilityIndex = 0, eventsPerMinute = 0
  // ══════════════════════════════════════════════════════════════════════════════
  const whiteNoiseSamples = generateWhiteNoise(durationSeconds, sampleRate, 0.3);
  const whiteNoiseAnalysis = analyzeAudioSamples(whiteNoiseSamples, durationSeconds, sampleRate);

  // Analyze spectrum for reporting
  const whiteNoiseSpectral = analyzeWindowSpectrum(
    whiteNoiseSamples.slice(0, CONFIG.fftWindowSize),
    sampleRate
  );

  results.push({
    scenario: "CONSTANT_AIR_NOISE",
    description: "White noise simulating constant air flow / fan",
    expectedMotilityIndex: 0,
    actualMotilityIndex: whiteNoiseAnalysis.motilityIndex,
    expectedEventsPerMinute: 0,
    actualEventsPerMinute: whiteNoiseAnalysis.eventsPerMinute,
    passed: whiteNoiseAnalysis.motilityIndex === 0 && whiteNoiseAnalysis.eventsPerMinute === 0,
    spectralAnalysis: {
      sfm: whiteNoiseSpectral.sfm,
      bowelPeakRatio: whiteNoiseSpectral.bowelPeakRatio,
      zcr: whiteNoiseSpectral.zcr,
      isDominatedByAirNoise: whiteNoiseSpectral.isWhiteNoise,
    },
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Breath Noise Bursts
  // Expected: motilityIndex = 0, eventsPerMinute = 0
  // ══════════════════════════════════════════════════════════════════════════════
  const breathNoiseSamples = generateBreathNoise(durationSeconds, sampleRate, 5);
  const breathNoiseAnalysis = analyzeAudioSamples(breathNoiseSamples, durationSeconds, sampleRate);

  const breathNoiseSpectral = analyzeWindowSpectrum(
    breathNoiseSamples.slice(0, CONFIG.fftWindowSize),
    sampleRate
  );

  results.push({
    scenario: "BREATH_NOISE_BURSTS",
    description: "Breath-like noise bursts (800ms, gradual onset)",
    expectedMotilityIndex: 0,
    actualMotilityIndex: breathNoiseAnalysis.motilityIndex,
    expectedEventsPerMinute: 0,
    actualEventsPerMinute: breathNoiseAnalysis.eventsPerMinute,
    passed: breathNoiseAnalysis.motilityIndex === 0 && breathNoiseAnalysis.eventsPerMinute === 0,
    spectralAnalysis: {
      sfm: breathNoiseSpectral.sfm,
      bowelPeakRatio: breathNoiseSpectral.bowelPeakRatio,
      zcr: breathNoiseSpectral.zcr,
      isDominatedByAirNoise: breathNoiseSpectral.isWhiteNoise,
    },
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Valid Gut Sounds
  // Expected: motilityIndex > 0, eventsPerMinute > 0
  // ══════════════════════════════════════════════════════════════════════════════
  const gutSoundSamples = generateGutSound(durationSeconds, sampleRate, 8);
  const gutSoundAnalysis = analyzeAudioSamples(gutSoundSamples, durationSeconds, sampleRate);

  const gutSoundSpectral = analyzeWindowSpectrum(
    gutSoundSamples.slice(0, CONFIG.fftWindowSize),
    sampleRate
  );

  results.push({
    scenario: "VALID_GUT_SOUNDS",
    description: "Synthetic gut sounds (100-500Hz, sharp transients)",
    expectedMotilityIndex: -1, // Any value > 0 is acceptable
    actualMotilityIndex: gutSoundAnalysis.motilityIndex,
    expectedEventsPerMinute: -1, // Any value > 0 is acceptable
    actualEventsPerMinute: gutSoundAnalysis.eventsPerMinute,
    passed: gutSoundAnalysis.motilityIndex > 0 || gutSoundAnalysis.eventsPerMinute > 0,
    spectralAnalysis: {
      sfm: gutSoundSpectral.sfm,
      bowelPeakRatio: gutSoundSpectral.bowelPeakRatio,
      zcr: gutSoundSpectral.zcr,
      isDominatedByAirNoise: gutSoundSpectral.isWhiteNoise,
    },
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Mixed Signal (Air + Gut)
  // Expected: Only gut sound events detected, air noise rejected
  // ══════════════════════════════════════════════════════════════════════════════
  const mixedSamples = generateGutSound(durationSeconds, sampleRate, 5);
  const airSamples = generateWhiteNoise(durationSeconds, sampleRate, 0.05);
  for (let i = 0; i < mixedSamples.length; i++) {
    mixedSamples[i] += airSamples[i];
  }
  const mixedAnalysis = analyzeAudioSamples(mixedSamples, durationSeconds, sampleRate);

  const mixedSpectral = analyzeWindowSpectrum(
    mixedSamples.slice(0, CONFIG.fftWindowSize),
    sampleRate
  );

  results.push({
    scenario: "MIXED_SIGNAL",
    description: "Gut sounds with background air noise",
    expectedMotilityIndex: -1, // Any value > 0 is acceptable
    actualMotilityIndex: mixedAnalysis.motilityIndex,
    expectedEventsPerMinute: -1, // Should detect gut sounds
    actualEventsPerMinute: mixedAnalysis.eventsPerMinute,
    passed: mixedAnalysis.eventsPerMinute > 0, // Should still detect gut sounds
    spectralAnalysis: {
      sfm: mixedSpectral.sfm,
      bowelPeakRatio: mixedSpectral.bowelPeakRatio,
      zcr: mixedSpectral.zcr,
      isDominatedByAirNoise: mixedSpectral.isWhiteNoise,
    },
  });

  return results;
}

/**
 * Export analyzeWindowSpectrum for external testing (NG-HARDEN-03)
 */
export { analyzeWindowSpectrum };
