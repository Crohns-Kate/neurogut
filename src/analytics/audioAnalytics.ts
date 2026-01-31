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
import {
  MOTILITY_THRESHOLD_MULTIPLIER,
  MIN_SKIN_CONTACT_RMS,
  ACOUSTIC_ISOLATION_CONFIG,
  calibrateAmbientNoiseFloor,
  applySpectralSubtraction,
  detectTransient,
  assessSignalQuality,
  validateBurstEvent,
  type ANFCalibrationResult,
  type SignalQuality,
} from "../logic/audioProcessor";
import {
  getClinicalButterworthFilter,
  applyZeroPhaseFilter,
} from "../filters/butterworthFilter";
import { analyzeHeartRate, type HeartAnalytics } from "./heartAnalytics";

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

  // ══════════════════════════════════════════════════════════════════════════════
  // BUTTERWORTH BANDPASS FILTER (Clinical-Grade Pipeline)
  // Hard-coded 100-450Hz with third-order Butterworth for gut sound isolation
  // ══════════════════════════════════════════════════════════════════════════════
  // Gut sounds (borborygmi, peristalsis, gurgling) cluster at 100-450Hz
  // Tighter bandpass eliminates breathing artifacts and environmental noise
  // Third-order Butterworth provides 60 dB/octave rolloff
  bandpassLowHz: 100,
  bandpassHighHz: 450,
  rejectAboveHz: 500,
  // Filter rolloff steepness (dB/octave) - third-order Butterworth
  rolloffDbPerOctave: 60,
  // Filter order for Butterworth (3rd order = 60 dB/octave)
  filterOrder: 3,
  // Use IIR Butterworth filter instead of FFT-based filtering
  useIIRFilter: true,

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
  // TIGHTENED: Reduced from 0.65 to 0.55 for stricter noise rejection
  sfmWhiteNoiseThreshold: 0.55,
  // SFM above this = definitely white noise (air hiss) - auto-reject
  // TIGHTENED: Reduced from 0.85 to 0.75 for stricter noise rejection
  sfmAutoRejectThreshold: 0.75,

  // BOWEL PEAK ISOLATION (100-450 Hz) — Aligned with NG-HARDEN-05 bandpass
  // Primary gut sounds: borborygmi, peristalsis, gurgling
  // Energy should be concentrated in this band for valid gut sounds
  bowelPeakLowHz: 100,
  bowelPeakHighHz: 450,
  // Minimum ratio of bowel band energy to total energy
  // Gut sounds: > 0.4 (40%+ energy in bowel band)
  // Air hiss: < 0.3 (energy spread across all frequencies)
  // TIGHTENED: Increased from 0.35 to 0.40 for stricter validation
  bowelPeakMinRatio: 0.40,

  // ZERO-CROSSING RATE (ZCR)
  // ZCR = number of times signal crosses zero per sample
  // Gut sounds: irregular ZCR (0.05-0.20) due to complex waveform
  // Breath/air: smooth ZCR (0.30-0.50) due to noise-like waveform
  // High ZCR indicates noise-like signal
  // TIGHTENED: Reduced from 0.25 to 0.22 for stricter noise rejection
  zcrMaxForGutSound: 0.22,
  // Very high ZCR is definitely noise
  // TIGHTENED: Reduced from 0.40 to 0.35 for stricter noise rejection
  zcrAutoRejectThreshold: 0.35,

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

  // ══════════════════════════════════════════════════════════════════════════════
  // PSYCHOACOUSTIC GATING (NG-HARDEN-04)
  // Temporal masking and rhythmic rejection for advanced noise filtering
  // ══════════════════════════════════════════════════════════════════════════════

  // TEMPORAL MASKING (Spectral Entropy Stationarity)
  // Bowel sounds are NON-STATIONARY (spectrum changes rapidly)
  // Air noise is STATIONARY (spectrum remains constant over time)
  // If spectral entropy stays constant for > 400ms, signal is masked (VRS weight = 0)
  temporalMaskingWindowMs: 400,
  // Maximum variance in spectral entropy allowed for non-stationary signal
  // Higher variance = more non-stationary = more likely gut sound
  spectralEntropyVarianceThreshold: 0.05,
  // Number of consecutive windows needed to confirm stationarity
  stationarityConsecutiveWindows: 4,

  // RHYTHMIC REJECTION (Autocorrelation)
  // Fans and AC have rhythmic pulses at precise intervals (60Hz, 500ms, etc.)
  // Gut sounds are APERIODIC (no regular repetition)
  // If autocorrelation detects strong periodicity, classify as "Mechanical Noise"
  autocorrelationWindowSize: 4096,
  // Minimum autocorrelation peak for periodicity detection (0-1)
  // High peak = strong periodicity = likely mechanical noise
  autocorrelationPeriodicityThreshold: 0.6,
  // Common mechanical noise frequencies to check (Hz)
  mechanicalNoiseFrequencies: [50, 60, 100, 120], // AC mains frequencies
  // Common mechanical noise periods to check (ms)
  mechanicalNoisePeriods: [500, 1000, 2000], // Fan cycles, compressors
  // Tolerance for period matching (±5%)
  periodMatchTolerance: 0.05,

  // SPECTRAL ENTROPY
  // Measures "randomness" of spectrum - high entropy = noise-like
  // Used for temporal masking: constant entropy over time = stationary noise
  spectralEntropyWhiteNoiseThreshold: 0.9,

  // ══════════════════════════════════════════════════════════════════════════════
  // DURATION GATING (NG-HARDEN-05 + Ralph Loop)
  // Acoustic Fingerprinting: Accept short bursts (10ms-1500ms), reject constant noise >2s
  // ══════════════════════════════════════════════════════════════════════════════

  // Minimum event duration to be considered a valid gut sound (ms)
  // Ralph Loop: Accept very short peristaltic clicks (as brief as 10ms)
  minValidEventDurationMs: 10,

  // Maximum event duration to be considered a valid gut sound (ms)
  // Ralph Loop: Gut bursts rarely exceed 1.5 seconds
  maxValidEventDurationMs: 1500,

  // Duration below which events are rejected as transients (ms)
  // Ralph Loop: Accept very short bursts, lower threshold to 10ms
  transientRejectDurationMs: 10,

  // Duration above which events are considered sustained noise (ms)
  // Ralph Loop: Reject constant environmental noise >2s
  sustainedNoiseRejectDurationMs: 2000,

  // ══════════════════════════════════════════════════════════════════════════════════
  // HARMONIC STRUCTURE DETECTION (NG-HARDEN-06)
  // Detect and reject speech/music based on harmonic series patterns
  // Speech has clear fundamental + harmonics (f0, 2f0, 3f0, 4f0...)
  // Gut sounds are non-harmonic (irregular frequency content)
  // ══════════════════════════════════════════════════════════════════════════════════

  // Minimum number of harmonics to detect for speech classification
  // Speech typically has 3-5+ clear harmonics
  minHarmonicsForSpeech: 3,

  // Tolerance for harmonic alignment (ratio of expected vs actual)
  // 0.05 = 5% tolerance for f0 multiples
  harmonicTolerance: 0.05,

  // Minimum harmonic-to-noise ratio (HNR) for speech detection (dB)
  // Speech: 10-25 dB, Gut sounds: <5 dB
  hnrSpeechThreshold: 8.0,

  // Fundamental frequency range for human speech (Hz)
  // Male: 85-180Hz, Female: 165-255Hz, Children: 250-400Hz
  speechF0MinHz: 80,
  speechF0MaxHz: 400,

  // ══════════════════════════════════════════════════════════════════════════════════
  // ENHANCED CONTACT DETECTION (NG-HARDEN-07) - CRITICAL FIX
  // Stronger validation of on-body vs in-air/on-table placement
  //
  // KEY INSIGHT: Quiet room ambient noise (HVAC, room hum) has SIMILAR spectral
  // shape to on-body recordings (both are low-frequency dominant). So spectral
  // shape alone CANNOT distinguish body contact from table/ambient noise.
  //
  // SOLUTION: Add TEMPORAL VARIABILITY check - body sounds have BURSTS with
  // varying amplitude; ambient noise (HVAC) is CONSTANT/FLAT.
  // ══════════════════════════════════════════════════════════════════════════════════

  // Minimum low-frequency energy ratio for skin contact validation
  // On-body: skin acts as low-pass filter, boosting <200Hz relative energy
  // In-air: more uniform frequency distribution
  skinContactLowFreqRatio: 0.45,

  // High-frequency suppression expected when on skin
  // Ratio of energy above 400Hz to total energy (should be LOW for on-body)
  maxHighFreqRatioOnBody: 0.15,

  // Spectral rolloff frequency threshold (Hz)
  // On-body recordings have lower rolloff due to skin's low-pass effect
  maxSpectralRolloffOnBody: 350,

  // CRITICAL FIX: Temporal variability requirements
  // Body sounds have BURSTS (high CV), ambient noise is CONSTANT (low CV)
  // Coefficient of variation (CV = stdDev/mean) threshold for valid body contact
  // TIGHTENED: Gut sounds have CV > 0.25 (sharp bursts)
  // Ambient noise: CV < 0.15 (even "noisy" rooms are relatively constant)
  minCVForBodyContact: 0.25,  // was 0.12 - SIGNIFICANTLY TIGHTENED

  // Minimum number of amplitude peaks (>Nx baseline) expected in body recordings
  // Gut sounds: multiple distinct burst events per recording
  // Ambient noise: flat with no distinct peaks
  minBurstPeaksForBodyContact: 2,

  // Peak detection threshold multiplier (peak must exceed baseline * this value)
  // TIGHTENED: Gut sounds are SHARP spikes, not gradual variations
  burstPeakThresholdMultiplier: 3.0,  // was 2.0 - TIGHTENED

  // Minimum energy variance ratio (max/min energy in windows)
  // Body sounds: high ratio (bursts vs silence)
  // Ambient noise: low ratio (constant level)
  // TIGHTENED: Require more dynamic range
  minEnergyVarianceRatio: 5.0,  // was 3.0 - TIGHTENED

  // MINIMUM RMS THRESHOLD FOR BODY CONTACT
  // Gut sounds via body contact have higher amplitude than ambient table pickup
  // If RMS is below this, phone is likely not in contact with body
  minRMSForBodyContact: 0.015,

  // SILENCE GAP REQUIREMENT
  // Real gut sounds have SILENCE between bursts
  // Ambient noise is continuous with no true silence
  // Minimum ratio of near-silent frames (RMS < 0.005) to total frames
  minSilenceRatio: 0.20,  // at least 20% near-silence
  silenceThresholdRMS: 0.005,  // RMS below this = "silent"

  // ══════════════════════════════════════════════════════════════════════════════════
  // EXPANDED BREATH ARTIFACT DETECTION (NG-HARDEN-08)
  // Wider detection range and better envelope matching for breathing
  // ══════════════════════════════════════════════════════════════════════════════════

  // Extended breath duration range (research shows 400ms-3000ms for full breath cycles)
  breathVetoMinMsExtended: 400,
  breathVetoMaxMsExtended: 3000,

  // Breath envelope characteristics
  // Breathing has slow attack (gradual onset) and slow decay
  // Ratio of onset slope to peak - low ratio = gradual onset = breath-like
  breathOnsetRatioThreshold: 0.3,

  // Breath sounds have characteristic low-frequency emphasis
  breathLowFreqEmphasisHz: 200,
  breathLowFreqRatio: 0.6,
};

// ══════════════════════════════════════════════════════════════════════════════════
// ANF CALIBRATION CACHE (Ralph Loop)
// Prevents duplicate calibration calls within the same analysis session
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Cached ANF calibration result
 */
interface CachedANFCalibration {
  result: ANFCalibrationResult;
  samplesHash: number;
  timestamp: number;
}

/** Module-level ANF cache */
let cachedANF: CachedANFCalibration | null = null;

/** Cache expiry time in milliseconds (60 seconds) */
const ANF_CACHE_EXPIRY_MS = 60000;

/**
 * Compute a simple hash of samples for cache validation
 * Uses first 1000 samples + length + sum for uniqueness
 */
function computeSamplesHash(samples: number[]): number {
  if (samples.length === 0) return 0;

  const sampleSubset = samples.slice(0, Math.min(1000, samples.length));
  const sum = sampleSubset.reduce((acc, s) => acc + s, 0);

  // Combine length, sum, and first/last samples for a reasonable hash
  return samples.length * 31 +
         Math.round(sum * 10000) +
         Math.round((samples[0] || 0) * 1000) +
         Math.round((samples[samples.length - 1] || 0) * 1000);
}

/**
 * Get cached ANF calibration or perform fresh calibration
 *
 * Returns cached result if:
 * 1. Cache exists
 * 2. Samples hash matches (same audio data)
 * 3. Cache is fresh (< 60 seconds old)
 *
 * Otherwise performs fresh calibration and updates cache.
 *
 * @param samples - Audio samples for calibration
 * @param sampleRate - Sample rate in Hz
 * @returns ANFCalibrationResult (cached or fresh)
 */
function getCachedANFCalibration(
  samples: number[],
  sampleRate: number
): ANFCalibrationResult {
  const now = Date.now();
  const samplesHash = computeSamplesHash(samples);

  // Check if cache is valid
  if (cachedANF !== null) {
    const isSameData = cachedANF.samplesHash === samplesHash;
    const isFresh = (now - cachedANF.timestamp) < ANF_CACHE_EXPIRY_MS;

    if (isSameData && isFresh) {
      // Cache hit
      return cachedANF.result;
    }
  }

  // Cache miss - perform fresh calibration
  const result = calibrateAmbientNoiseFloor(samples, sampleRate);

  // Update cache
  cachedANF = {
    result,
    samplesHash,
    timestamp: now,
  };

  return result;
}

/**
 * Clear the ANF calibration cache
 *
 * Call this when starting a new recording session to ensure
 * fresh calibration data is computed.
 */
export function clearANFCache(): void {
  cachedANF = null;
}

/**
 * Represents a detected gut sound event
 */
interface DetectedEvent {
  startWindow: number;
  endWindow: number;
  peakEnergy: number;
}

/**
 * Apply Butterworth bandpass filter for clinical-grade gut sound isolation
 *
 * Mansour et al. PLOS One Jan 2026:
 * - Third-order Butterworth bandpass (100Hz-450Hz)
 * - 60 dB/octave rolloff for sharp isolation
 * - Zero-phase filtering for no phase distortion
 *
 * Falls back to FFT-based filtering if IIR is disabled.
 *
 * @param samples - Raw audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns Filtered samples with out-of-band energy removed
 */
function applySpectralBandpass(samples: number[], sampleRate: number): number[] {
  if (samples.length === 0) return samples;

  // Use Butterworth IIR filter if enabled (clinical-grade precision)
  if (CONFIG.useIIRFilter) {
    try {
      const filter = getClinicalButterworthFilter(sampleRate);
      return applyZeroPhaseFilter(samples, filter);
    } catch {
      // Fall back to FFT-based filtering on error
      console.warn("Butterworth filter failed, falling back to FFT-based filtering");
    }
  }

  // Fallback: Use overlapping windows for frequency analysis
  const windowSize = 1024;
  const hopSize = windowSize / 2;
  const output = new Array(samples.length).fill(0);
  const windowCounts = new Array(samples.length).fill(0);

  const freqPerBin = sampleRate / windowSize;
  const lowBin = Math.floor(CONFIG.bandpassLowHz / freqPerBin);
  const highBin = Math.ceil(CONFIG.bandpassHighHz / freqPerBin);
  const rejectBin = Math.floor(CONFIG.rejectAboveHz / freqPerBin);

  for (let start = 0; start + windowSize <= samples.length; start += hopSize) {
    const window = samples.slice(start, start + windowSize);

    const windowed = window.map((s, i) =>
      s * 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
    );

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

    const totalEnergy = inBandEnergy + outBandEnergy;
    const suppressFactor = totalEnergy > 0 && outBandEnergy > inBandEnergy * 0.5 ? 0 : 1;

    for (let i = 0; i < windowSize; i++) {
      if (start + i < output.length) {
        output[start + i] += windowed[i] * suppressFactor;
        windowCounts[start + i]++;
      }
    }
  }

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

// ══════════════════════════════════════════════════════════════════════════════════
// LOG-MEL SPECTROGRAM PIPELINE (Clinical-Grade Precision)
// Based on Wav2Vec 2.0/HuBERT architecture (arXiv:2502.15607)
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Log-Mel Spectrogram Configuration
 */
export const LOG_MEL_CONFIG = {
  /** Number of mel filterbank channels */
  numMelBins: 64,
  /** FFT window size (samples) */
  fftSize: 2048,
  /** Hop size between consecutive frames (samples) */
  hopSize: 512,
  /** Lower frequency bound for mel filterbank (Hz) - aligned with gut sound range */
  fMin: 100,
  /** Upper frequency bound for mel filterbank (Hz) - aligned with 100-450Hz clinical bandpass */
  fMax: 450,
  /** Sample rate (Hz) */
  sampleRate: 44100,
  /** Snippet duration for CNN processing (ms) - Hyfe architecture */
  snippetDurationMs: 500,
  /** Snippet overlap (ms) - 50% overlap for robustness */
  snippetOverlapMs: 250,
  /** Floor value for log compression (prevents log(0)) */
  logFloor: 1e-10,
};

/**
 * Convert frequency in Hz to Mel scale
 * Formula: mel = 2595 * log10(1 + f/700)
 */
function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

/**
 * Convert Mel scale to frequency in Hz
 * Formula: hz = 700 * (10^(mel/2595) - 1)
 */
function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Mel Filterbank for Log-Mel Spectrogram
 * Triangular filters spaced uniformly on the mel scale
 */
export interface MelFilterbank {
  /** Filter weights matrix [numMelBins x numFftBins] */
  filters: number[][];
  /** Center frequencies of each mel bin (Hz) */
  centerFrequencies: number[];
  /** Number of mel bins */
  numBins: number;
  /** Number of FFT bins used */
  numFftBins: number;
}

/**
 * Create a Mel-scale filterbank for spectrogram computation
 *
 * @param numMelBins - Number of mel filter channels
 * @param numFftBins - Number of FFT frequency bins (fftSize/2)
 * @param sampleRate - Audio sample rate (Hz)
 * @param fMin - Minimum frequency (Hz)
 * @param fMax - Maximum frequency (Hz)
 * @returns MelFilterbank with triangular filters
 */
export function createMelFilterbank(
  numMelBins: number = LOG_MEL_CONFIG.numMelBins,
  numFftBins: number = LOG_MEL_CONFIG.fftSize / 2,
  sampleRate: number = LOG_MEL_CONFIG.sampleRate,
  fMin: number = LOG_MEL_CONFIG.fMin,
  fMax: number = LOG_MEL_CONFIG.fMax
): MelFilterbank {
  // Convert frequency bounds to mel scale
  const melMin = hzToMel(fMin);
  const melMax = hzToMel(fMax);

  // Create equally spaced mel points (numMelBins + 2 for triangle edges)
  const melPoints: number[] = [];
  for (let i = 0; i < numMelBins + 2; i++) {
    melPoints.push(melMin + (i * (melMax - melMin)) / (numMelBins + 1));
  }

  // Convert mel points back to Hz
  const hzPoints = melPoints.map(melToHz);

  // Convert Hz to FFT bin indices
  const binPoints = hzPoints.map((hz) =>
    Math.floor((hz * numFftBins * 2) / sampleRate)
  );

  // Create triangular filters
  const filters: number[][] = [];
  const centerFrequencies: number[] = [];

  for (let m = 0; m < numMelBins; m++) {
    const filter: number[] = new Array(numFftBins).fill(0);
    const leftBin = binPoints[m];
    const centerBin = binPoints[m + 1];
    const rightBin = binPoints[m + 2];

    centerFrequencies.push(hzPoints[m + 1]);

    // Rising slope (left to center)
    for (let k = leftBin; k < centerBin; k++) {
      if (k >= 0 && k < numFftBins) {
        filter[k] = (k - leftBin) / (centerBin - leftBin + 1e-10);
      }
    }

    // Falling slope (center to right)
    for (let k = centerBin; k <= rightBin; k++) {
      if (k >= 0 && k < numFftBins) {
        filter[k] = (rightBin - k) / (rightBin - centerBin + 1e-10);
      }
    }

    filters.push(filter);
  }

  return {
    filters,
    centerFrequencies,
    numBins: numMelBins,
    numFftBins,
  };
}

/**
 * Log-Mel Spectrogram Result
 */
export interface LogMelSpectrogram {
  /** 2D array of log-mel energies [numFrames x numMelBins] */
  features: number[][];
  /** Number of time frames */
  numFrames: number;
  /** Number of mel bins */
  numMelBins: number;
  /** Time duration of each frame (ms) */
  frameDurationMs: number;
  /** Sample rate used */
  sampleRate: number;
  /** Mean energy per mel bin (for normalization) */
  meanMelEnergy: number[];
  /** Peak frequencies detected across all frames (Hz) */
  peakFrequencies: number[];
}

/**
 * Compute Log-Mel Spectrogram from audio samples
 *
 * This produces CNN-ready features aligned with modern acoustic models
 * like Wav2Vec 2.0 and HuBERT (AUC 0.89 for bowel sound classification).
 *
 * @param samples - Audio samples (normalized -1 to 1)
 * @param sampleRate - Audio sample rate (Hz)
 * @param filterbank - Optional pre-computed mel filterbank
 * @returns LogMelSpectrogram with 2D feature matrix
 */
export function computeLogMelSpectrogram(
  samples: number[],
  sampleRate: number = LOG_MEL_CONFIG.sampleRate,
  filterbank?: MelFilterbank
): LogMelSpectrogram {
  const fftSize = LOG_MEL_CONFIG.fftSize;
  const hopSize = LOG_MEL_CONFIG.hopSize;
  const numFftBins = fftSize / 2;

  // Create or use provided filterbank
  const melFilterbank =
    filterbank || createMelFilterbank(LOG_MEL_CONFIG.numMelBins, numFftBins, sampleRate);

  // Calculate number of frames
  const numFrames = Math.max(1, Math.floor((samples.length - fftSize) / hopSize) + 1);
  const features: number[][] = [];
  const frameDurationMs = (hopSize / sampleRate) * 1000;

  // Track peak frequencies for PFHS
  const peakFrequencyBins: number[] = [];

  // Process each frame
  for (let frame = 0; frame < numFrames; frame++) {
    const startSample = frame * hopSize;
    const endSample = Math.min(startSample + fftSize, samples.length);

    // Extract and zero-pad frame
    let frameSamples = samples.slice(startSample, endSample);
    if (frameSamples.length < fftSize) {
      frameSamples = [...frameSamples, ...new Array(fftSize - frameSamples.length).fill(0)];
    }

    // Apply Hann window
    const windowed = frameSamples.map(
      (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
    );

    // Compute FFT and magnitude spectrum
    const fftResult = computeFFT(windowed);
    const magnitudes = computeMagnitudeSpectrum(fftResult);

    // Find peak frequency for this frame
    let maxMag = 0;
    let peakBin = 0;
    for (let k = 0; k < magnitudes.length; k++) {
      if (magnitudes[k] > maxMag) {
        maxMag = magnitudes[k];
        peakBin = k;
      }
    }
    peakFrequencyBins.push(peakBin);

    // Apply mel filterbank
    const melEnergies: number[] = [];
    for (let m = 0; m < melFilterbank.numBins; m++) {
      let energy = 0;
      for (let k = 0; k < numFftBins && k < magnitudes.length; k++) {
        energy += magnitudes[k] * magnitudes[k] * melFilterbank.filters[m][k];
      }
      melEnergies.push(energy);
    }

    // Apply log compression
    const logMelEnergies = melEnergies.map((e) =>
      Math.log(Math.max(e, LOG_MEL_CONFIG.logFloor))
    );

    features.push(logMelEnergies);
  }

  // Compute mean energy per mel bin (for normalization)
  const meanMelEnergy = new Array(melFilterbank.numBins).fill(0);
  for (const frame of features) {
    for (let m = 0; m < frame.length; m++) {
      meanMelEnergy[m] += frame[m];
    }
  }
  for (let m = 0; m < meanMelEnergy.length; m++) {
    meanMelEnergy[m] /= numFrames;
  }

  // Convert peak bins to Hz
  const freqPerBin = sampleRate / fftSize;
  const peakFrequencies = peakFrequencyBins.map((bin) => bin * freqPerBin);

  return {
    features,
    numFrames,
    numMelBins: melFilterbank.numBins,
    frameDurationMs,
    sampleRate,
    meanMelEnergy,
    peakFrequencies,
  };
}

/**
 * Classified Audio Snippet for CNN processing
 */
export interface ClassifiedSnippet {
  /** Start time of snippet (ms) */
  startMs: number;
  /** End time of snippet (ms) */
  endMs: number;
  /** Log-mel features for this snippet [numFrames x numMelBins] */
  features: number[][];
  /** Average energy in gut sound band (100-450 Hz) */
  gutBandEnergy: number;
  /** Peak frequency detected (Hz) */
  peakFrequency: number;
  /** Spectral centroid (Hz) */
  spectralCentroid: number;
  /** Is this snippet likely a gut sound event? */
  isLikelyGutSound: boolean;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Segment audio into overlapping snippets and classify for CNN processing
 *
 * Uses Hyfe-inspired architecture: 500ms snippets with 250ms overlap
 * for 90%+ sensitivity in acoustic event detection.
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate (Hz)
 * @returns Array of classified snippets ready for CNN processing
 */
export function segmentAndClassifySnippets(
  samples: number[],
  sampleRate: number = LOG_MEL_CONFIG.sampleRate
): ClassifiedSnippet[] {
  const snippetSamples = Math.floor(
    (LOG_MEL_CONFIG.snippetDurationMs / 1000) * sampleRate
  );
  const overlapSamples = Math.floor(
    (LOG_MEL_CONFIG.snippetOverlapMs / 1000) * sampleRate
  );
  const hopSamples = snippetSamples - overlapSamples;

  const snippets: ClassifiedSnippet[] = [];
  const numSnippets = Math.max(
    1,
    Math.floor((samples.length - snippetSamples) / hopSamples) + 1
  );

  // Create shared filterbank for efficiency
  const filterbank = createMelFilterbank();

  for (let i = 0; i < numSnippets; i++) {
    const startSample = i * hopSamples;
    const endSample = Math.min(startSample + snippetSamples, samples.length);
    const snippetData = samples.slice(startSample, endSample);

    // Skip snippets that are too short
    if (snippetData.length < snippetSamples / 2) continue;

    // Compute log-mel spectrogram for this snippet
    const melSpec = computeLogMelSpectrogram(snippetData, sampleRate, filterbank);

    // Calculate gut band energy (bins corresponding to 100-450 Hz)
    // Mel bins are distributed non-linearly, so we use the mean energy directly
    const gutBandEnergy =
      melSpec.meanMelEnergy.reduce((sum, e) => sum + e, 0) / melSpec.numMelBins;

    // Calculate spectral centroid
    let weightedSum = 0;
    let totalEnergy = 0;
    for (let m = 0; m < melSpec.numMelBins; m++) {
      const freq = filterbank.centerFrequencies[m];
      const energy = Math.exp(melSpec.meanMelEnergy[m]); // Convert from log
      weightedSum += freq * energy;
      totalEnergy += energy;
    }
    const spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;

    // Find dominant peak frequency
    const peakFrequency =
      melSpec.peakFrequencies.length > 0
        ? melSpec.peakFrequencies.reduce((a, b) => a + b, 0) /
          melSpec.peakFrequencies.length
        : 0;

    // Classification heuristics based on clinical research:
    // - Gut sounds: 100-450 Hz, spectral centroid 150-350 Hz
    // - Non-gut noise: broader spectrum or outside this range
    const isInGutRange = peakFrequency >= 100 && peakFrequency <= 450;
    const hasCentroidInRange = spectralCentroid >= 150 && spectralCentroid <= 350;
    const hasSignificantEnergy = gutBandEnergy > -10; // Above noise floor

    const isLikelyGutSound = isInGutRange && hasCentroidInRange && hasSignificantEnergy;

    // Confidence based on how well it matches gut sound profile
    let confidence = 0;
    if (isInGutRange) confidence += 0.3;
    if (hasCentroidInRange) confidence += 0.3;
    if (hasSignificantEnergy) confidence += 0.2;
    if (peakFrequency >= 150 && peakFrequency <= 350) confidence += 0.2; // Optimal range

    const startMs = (startSample / sampleRate) * 1000;
    const endMs = (endSample / sampleRate) * 1000;

    snippets.push({
      startMs,
      endMs,
      features: melSpec.features,
      gutBandEnergy,
      peakFrequency,
      spectralCentroid,
      isLikelyGutSound,
      confidence,
    });
  }

  return snippets;
}

/**
 * Extract frequency histogram from snippets for PFHS comparison
 *
 * @param snippets - Classified snippets from segmentAndClassifySnippets
 * @returns Normalized histogram of peak frequencies (8 bins: 100-150, 150-200, ..., 400-450)
 */
export function extractFrequencyHistogram(snippets: ClassifiedSnippet[]): number[] {
  // 8 bins spanning 100-450 Hz (each bin is ~44 Hz wide)
  const binEdges = [100, 144, 188, 231, 275, 319, 363, 406, 450];
  const histogram = new Array(8).fill(0);

  // Only count snippets classified as likely gut sounds
  const gutSoundSnippets = snippets.filter((s) => s.isLikelyGutSound);

  for (const snippet of gutSoundSnippets) {
    const freq = snippet.peakFrequency;
    for (let i = 0; i < 8; i++) {
      if (freq >= binEdges[i] && freq < binEdges[i + 1]) {
        histogram[i]++;
        break;
      }
    }
  }

  // Normalize to sum to 1
  const total = histogram.reduce((sum, h) => sum + h, 0);
  if (total > 0) {
    for (let i = 0; i < 8; i++) {
      histogram[i] /= total;
    }
  }

  return histogram;
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

// ══════════════════════════════════════════════════════════════════════════════════
// PSYCHOACOUSTIC GATING FUNCTIONS (NG-HARDEN-04)
// Temporal masking and rhythmic rejection for advanced noise filtering
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Compute Spectral Entropy
 *
 * Measures the "randomness" or "flatness" of a spectrum using Shannon entropy.
 * High entropy (near 1.0) = noise-like (energy spread evenly)
 * Low entropy (near 0.0) = tonal (energy concentrated in few bins)
 *
 * Formula: H = -sum(p * log2(p)) / log2(N)
 * where p = normalized power in each bin
 *
 * @param magnitudes - Magnitude spectrum
 * @returns Spectral entropy (0-1)
 */
function computeSpectralEntropy(magnitudes: number[]): number {
  if (magnitudes.length < 2) return 0;

  // Convert to power spectrum
  const power = magnitudes.map((m) => m * m);
  const totalPower = power.reduce((sum, p) => sum + p, 0);

  if (totalPower === 0) return 0;

  // Normalize to probability distribution
  const probabilities = power.map((p) => p / totalPower);

  // Compute Shannon entropy: H = -sum(p * log2(p))
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 1e-10) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize by max entropy (log2(N)) to get 0-1 range
  const maxEntropy = Math.log2(magnitudes.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Temporal Masking Result
 */
interface TemporalMaskingResult {
  /** Is the signal stationary (constant spectrum over time)? */
  isStationary: boolean;
  /** Variance of spectral entropy over the analysis window */
  entropyVariance: number;
  /** Number of consecutive windows with similar entropy */
  consecutiveStationaryWindows: number;
  /** Should this signal be masked (VRS weight = 0)? */
  shouldMask: boolean;
}

/**
 * Detect stationary (constant) signals using spectral entropy over time
 *
 * PSYCHOACOUSTIC PRINCIPLE:
 * - Bowel sounds are NON-STATIONARY: spectrum changes rapidly
 * - Air noise is STATIONARY: spectrum remains constant
 *
 * If spectral entropy remains constant for > 400ms, the signal is masked.
 *
 * @param samples - Time-domain audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns TemporalMaskingResult with stationarity analysis
 */
function detectTemporalStationarity(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): TemporalMaskingResult {
  const windowSamples = Math.floor((CONFIG.temporalMaskingWindowMs / 1000) * sampleRate);
  const fftSize = CONFIG.fftWindowSize;
  const hopSize = fftSize / 2;

  // Need at least enough samples for multiple windows
  const minSamples = fftSize + (CONFIG.stationarityConsecutiveWindows - 1) * hopSize;
  if (samples.length < minSamples) {
    return {
      isStationary: false,
      entropyVariance: 1.0,
      consecutiveStationaryWindows: 0,
      shouldMask: false,
    };
  }

  // Compute spectral entropy for each window
  const entropyValues: number[] = [];

  for (let start = 0; start + fftSize <= samples.length; start += hopSize) {
    const windowSamples = samples.slice(start, start + fftSize);

    // Apply Hann window
    const windowed = windowSamples.map(
      (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
    );

    // Compute FFT and magnitude spectrum
    const fftResult = computeFFT(windowed);
    const magnitudes = computeMagnitudeSpectrum(fftResult);

    // Compute spectral entropy
    const entropy = computeSpectralEntropy(magnitudes);
    entropyValues.push(entropy);
  }

  if (entropyValues.length < 2) {
    return {
      isStationary: false,
      entropyVariance: 1.0,
      consecutiveStationaryWindows: 0,
      shouldMask: false,
    };
  }

  // Compute variance of entropy values
  const entropyMean = entropyValues.reduce((s, e) => s + e, 0) / entropyValues.length;
  const entropyVariance =
    entropyValues.reduce((s, e) => s + (e - entropyMean) ** 2, 0) / entropyValues.length;

  // Count consecutive windows with similar entropy
  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < entropyValues.length; i++) {
    const diff = Math.abs(entropyValues[i] - entropyValues[i - 1]);
    if (diff < CONFIG.spectralEntropyVarianceThreshold) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  // Determine if signal is stationary
  const isStationary =
    entropyVariance < CONFIG.spectralEntropyVarianceThreshold &&
    maxConsecutive >= CONFIG.stationarityConsecutiveWindows;

  // Also check if entropy is very high (white noise-like)
  const isHighEntropy = entropyMean > CONFIG.spectralEntropyWhiteNoiseThreshold;

  // Should mask if stationary AND high entropy (constant white noise)
  const shouldMask = isStationary && isHighEntropy;

  return {
    isStationary,
    entropyVariance,
    consecutiveStationaryWindows: maxConsecutive,
    shouldMask,
  };
}

/**
 * Rhythmic Rejection Result
 */
interface RhythmicRejectionResult {
  /** Is rhythmic/periodic noise detected? */
  isRhythmic: boolean;
  /** Detected period in milliseconds (if rhythmic) */
  detectedPeriodMs: number | null;
  /** Peak autocorrelation value */
  peakAutocorrelation: number;
  /** Is this mechanical noise (fan, AC)? */
  isMechanicalNoise: boolean;
  /** Should this signal be vetoed? */
  shouldVeto: boolean;
}

/**
 * Compute autocorrelation for periodicity detection
 *
 * Autocorrelation measures how similar a signal is to a delayed version of itself.
 * Periodic signals (fans, AC) have high autocorrelation at their period.
 *
 * @param samples - Time-domain audio samples
 * @param maxLag - Maximum lag to compute (in samples)
 * @returns Autocorrelation values from lag 0 to maxLag
 */
function computeAutocorrelation(samples: number[], maxLag: number): number[] {
  const N = samples.length;
  const result: number[] = [];

  // Compute mean and energy for normalization
  const mean = samples.reduce((s, x) => s + x, 0) / N;
  const centered = samples.map((x) => x - mean);
  const energy = centered.reduce((s, x) => s + x * x, 0);

  if (energy === 0) {
    return new Array(maxLag + 1).fill(0);
  }

  // Compute autocorrelation for each lag
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += centered[i] * centered[i + lag];
    }
    // Normalize by energy (so r[0] = 1.0)
    result.push(sum / energy);
  }

  return result;
}

/**
 * Detect rhythmic/periodic noise using autocorrelation
 *
 * PSYCHOACOUSTIC PRINCIPLE:
 * - Gut sounds are APERIODIC: no regular repetition pattern
 * - Mechanical noise (fans, AC) is PERIODIC: repeats at precise intervals
 *
 * If strong autocorrelation peak is found at known mechanical frequencies,
 * the signal is classified as "Mechanical Noise" and vetoed.
 *
 * @param samples - Time-domain audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns RhythmicRejectionResult with periodicity analysis
 */
function detectRhythmicNoise(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): RhythmicRejectionResult {
  const windowSize = Math.min(CONFIG.autocorrelationWindowSize, samples.length);

  if (windowSize < 1024) {
    return {
      isRhythmic: false,
      detectedPeriodMs: null,
      peakAutocorrelation: 0,
      isMechanicalNoise: false,
      shouldVeto: false,
    };
  }

  // Use center portion of samples for analysis
  const startIdx = Math.floor((samples.length - windowSize) / 2);
  const windowSamples = samples.slice(startIdx, startIdx + windowSize);

  // Maximum lag to check (up to 2 seconds)
  const maxLagSamples = Math.floor(2 * sampleRate);
  const maxLag = Math.min(maxLagSamples, windowSize - 1);

  // Compute autocorrelation
  const autocorr = computeAutocorrelation(windowSamples, maxLag);

  // Find peaks (excluding lag 0 which is always 1.0)
  // Start from lag corresponding to ~20ms (avoid very short-term correlations)
  const minLag = Math.floor(0.02 * sampleRate);

  let peakLag = 0;
  let peakValue = 0;

  for (let lag = minLag; lag < autocorr.length; lag++) {
    if (autocorr[lag] > peakValue) {
      peakValue = autocorr[lag];
      peakLag = lag;
    }
  }

  const detectedPeriodMs = peakLag > 0 ? (peakLag / sampleRate) * 1000 : null;

  // Check if peak matches known mechanical noise frequencies/periods
  let isMechanicalNoise = false;

  if (peakValue >= CONFIG.autocorrelationPeriodicityThreshold && detectedPeriodMs) {
    // Check against known mechanical noise frequencies
    for (const freq of CONFIG.mechanicalNoiseFrequencies) {
      const expectedPeriodMs = 1000 / freq;
      const tolerance = expectedPeriodMs * CONFIG.periodMatchTolerance;

      if (Math.abs(detectedPeriodMs - expectedPeriodMs) < tolerance) {
        isMechanicalNoise = true;
        break;
      }
    }

    // Check against known mechanical noise periods
    if (!isMechanicalNoise) {
      for (const periodMs of CONFIG.mechanicalNoisePeriods) {
        const tolerance = periodMs * CONFIG.periodMatchTolerance;

        if (Math.abs(detectedPeriodMs - periodMs) < tolerance) {
          isMechanicalNoise = true;
          break;
        }
      }
    }
  }

  const isRhythmic = peakValue >= CONFIG.autocorrelationPeriodicityThreshold;

  return {
    isRhythmic,
    detectedPeriodMs,
    peakAutocorrelation: peakValue,
    isMechanicalNoise,
    shouldVeto: isMechanicalNoise,
  };
}

/**
 * Combined Psychoacoustic Gating Result (NG-HARDEN-04)
 */
export interface PsychoacousticGatingResult {
  /** Temporal masking analysis */
  temporalMasking: TemporalMaskingResult;
  /** Rhythmic rejection analysis */
  rhythmicRejection: RhythmicRejectionResult;
  /** Final decision: should this audio be gated (VRS = 0)? */
  shouldGate: boolean;
  /** Reason for gating (if gated) */
  gatingReason: string | null;
}

/**
 * Apply psychoacoustic gating to detect and reject non-gut noise
 *
 * Combines temporal masking and rhythmic rejection for comprehensive
 * rejection of air noise, breath, and mechanical noise.
 *
 * @param samples - Time-domain audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns PsychoacousticGatingResult with gating decision
 */
export function applyPsychoacousticGating(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): PsychoacousticGatingResult {
  // Apply temporal masking check
  const temporalMasking = detectTemporalStationarity(samples, sampleRate);

  // Apply rhythmic rejection check
  const rhythmicRejection = detectRhythmicNoise(samples, sampleRate);

  // Determine final gating decision
  let shouldGate = false;
  let gatingReason: string | null = null;

  if (temporalMasking.shouldMask) {
    shouldGate = true;
    gatingReason = `Stationary air noise detected (entropy variance: ${temporalMasking.entropyVariance.toFixed(4)}, consecutive windows: ${temporalMasking.consecutiveStationaryWindows})`;
  } else if (rhythmicRejection.shouldVeto) {
    shouldGate = true;
    gatingReason = `Mechanical noise detected (period: ${rhythmicRejection.detectedPeriodMs?.toFixed(1)}ms, autocorr: ${rhythmicRejection.peakAutocorrelation.toFixed(3)})`;
  }

  return {
    temporalMasking,
    rhythmicRejection,
    shouldGate,
    gatingReason,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// HARMONIC STRUCTURE DETECTION (NG-HARDEN-06)
// Detect and reject speech/music based on harmonic series patterns
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Result of harmonic structure analysis
 */
interface HarmonicAnalysisResult {
  /** Is harmonic structure detected (likely speech/music)? */
  isHarmonic: boolean;
  /** Detected fundamental frequency (Hz), or null if not found */
  fundamentalHz: number | null;
  /** Number of harmonics detected */
  harmonicCount: number;
  /** Harmonic-to-Noise Ratio (dB) */
  hnrDb: number;
  /** Confidence of speech detection (0-1) */
  speechConfidence: number;
  /** Should this signal be rejected as speech/music? */
  shouldReject: boolean;
}

/**
 * Detect harmonic structure in audio to identify speech/music
 *
 * Speech and music have clear harmonic series: f0, 2*f0, 3*f0, 4*f0...
 * Gut sounds are non-harmonic with irregular frequency content.
 *
 * Uses autocorrelation to find fundamental frequency, then checks
 * for energy peaks at harmonic multiples.
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns HarmonicAnalysisResult with detection data
 */
function detectHarmonicStructure(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): HarmonicAnalysisResult {
  const fftSize = CONFIG.fftWindowSize;

  if (samples.length < fftSize) {
    return {
      isHarmonic: false,
      fundamentalHz: null,
      harmonicCount: 0,
      hnrDb: 0,
      speechConfidence: 0,
      shouldReject: false,
    };
  }

  // Step 1: Find fundamental frequency using autocorrelation
  // Search in speech f0 range (80-400 Hz)
  const minLag = Math.floor(sampleRate / CONFIG.speechF0MaxHz); // 400Hz -> ~110 samples
  const maxLag = Math.floor(sampleRate / CONFIG.speechF0MinHz); // 80Hz -> ~551 samples

  // Compute windowed samples
  const windowSamples = samples.slice(0, Math.min(fftSize, samples.length));
  const windowed = windowSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSamples.length - 1)))
  );

  // Autocorrelation for f0 detection
  const mean = windowed.reduce((s, x) => s + x, 0) / windowed.length;
  const centered = windowed.map((x) => x - mean);
  const energy = centered.reduce((s, x) => s + x * x, 0);

  if (energy < 1e-10) {
    return {
      isHarmonic: false,
      fundamentalHz: null,
      harmonicCount: 0,
      hnrDb: 0,
      speechConfidence: 0,
      shouldReject: false,
    };
  }

  // Find autocorrelation peak in f0 range
  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = minLag; lag <= Math.min(maxLag, centered.length - 1); lag++) {
    let sum = 0;
    for (let i = 0; i < centered.length - lag; i++) {
      sum += centered[i] * centered[i + lag];
    }
    const corr = sum / energy;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // No clear fundamental found
  if (bestCorr < 0.3 || bestLag === 0) {
    return {
      isHarmonic: false,
      fundamentalHz: null,
      harmonicCount: 0,
      hnrDb: 0,
      speechConfidence: 0,
      shouldReject: false,
    };
  }

  const fundamentalHz = sampleRate / bestLag;

  // Step 2: Compute FFT and check for harmonic peaks
  const fftResult = computeFFT(windowed);
  const magnitudes = computeMagnitudeSpectrum(fftResult);
  const freqPerBin = sampleRate / fftSize;

  // Find energy at fundamental and its harmonics
  const f0Bin = Math.round(fundamentalHz / freqPerBin);
  const tolerance = Math.max(1, Math.round(fundamentalHz * CONFIG.harmonicTolerance / freqPerBin));

  let harmonicEnergy = 0;
  let noiseEnergy = 0;
  let harmonicCount = 0;

  // Check for harmonics (up to 8th harmonic or Nyquist)
  const maxHarmonic = Math.min(8, Math.floor((sampleRate / 2) / fundamentalHz));

  for (let h = 1; h <= maxHarmonic; h++) {
    const expectedBin = Math.round(h * fundamentalHz / freqPerBin);
    const minBin = Math.max(0, expectedBin - tolerance);
    const maxBin = Math.min(magnitudes.length - 1, expectedBin + tolerance);

    // Find peak near expected harmonic
    let peakMag = 0;
    for (let bin = minBin; bin <= maxBin; bin++) {
      peakMag = Math.max(peakMag, magnitudes[bin]);
    }

    // Check if peak is significant (above local noise)
    let localNoise = 0;
    let noiseCount = 0;
    for (let bin = Math.max(0, minBin - 5); bin < minBin; bin++) {
      localNoise += magnitudes[bin];
      noiseCount++;
    }
    for (let bin = maxBin + 1; bin <= Math.min(magnitudes.length - 1, maxBin + 5); bin++) {
      localNoise += magnitudes[bin];
      noiseCount++;
    }
    localNoise = noiseCount > 0 ? localNoise / noiseCount : 0;

    // Harmonic is significant if it's 2x above local noise
    if (peakMag > localNoise * 2) {
      harmonicCount++;
      harmonicEnergy += peakMag * peakMag;
    }
  }

  // Compute total noise energy (non-harmonic bins)
  for (let bin = 0; bin < magnitudes.length; bin++) {
    const freq = bin * freqPerBin;
    // Check if bin is near any harmonic
    let isHarmonicBin = false;
    for (let h = 1; h <= maxHarmonic; h++) {
      const harmonicFreq = h * fundamentalHz;
      if (Math.abs(freq - harmonicFreq) < fundamentalHz * CONFIG.harmonicTolerance) {
        isHarmonicBin = true;
        break;
      }
    }
    if (!isHarmonicBin) {
      noiseEnergy += magnitudes[bin] * magnitudes[bin];
    }
  }

  // Compute HNR (Harmonic-to-Noise Ratio) in dB
  const hnrDb = noiseEnergy > 0 ? 10 * Math.log10(harmonicEnergy / noiseEnergy) : 0;

  // Classification
  const isHarmonic = harmonicCount >= CONFIG.minHarmonicsForSpeech;
  const isSpeechLike = isHarmonic && hnrDb >= CONFIG.hnrSpeechThreshold;

  // Speech confidence based on harmonic count and HNR
  let speechConfidence = 0;
  if (isHarmonic) {
    speechConfidence = Math.min(1, (harmonicCount - 2) / 4); // 3+ harmonics -> 0.25+
    speechConfidence += Math.min(0.5, hnrDb / 20); // 10dB HNR -> 0.5
  }

  return {
    isHarmonic,
    fundamentalHz,
    harmonicCount,
    hnrDb,
    speechConfidence,
    shouldReject: isSpeechLike,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// ENHANCED CONTACT DETECTION (NG-HARDEN-07)
// Stronger validation of on-body vs in-air placement
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Result of contact quality analysis
 */
interface ContactQualityResult {
  /** Is the device likely on skin (good contact)? */
  isOnBody: boolean;
  /** Ratio of low-frequency energy (<200Hz) to total */
  lowFreqRatio: number;
  /** Ratio of high-frequency energy (>400Hz) to total */
  highFreqRatio: number;
  /** Spectral rolloff frequency (Hz) - 85th percentile energy point */
  spectralRolloff: number;
  /** Confidence of on-body detection (0-1) */
  contactConfidence: number;
  /** Should recording be rejected as in-air? */
  shouldRejectAsInAir: boolean;
}

/**
 * Analyze spectral characteristics to determine if device is on skin
 *
 * When phone is pressed against skin:
 * - Skin acts as a low-pass filter
 * - Low frequencies (<200Hz) are emphasized
 * - High frequencies (>400Hz) are attenuated
 * - Spectral rolloff is lower
 *
 * When phone is in air:
 * - More uniform frequency distribution
 * - Higher spectral rolloff
 * - Environmental sounds dominate
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate in Hz
 * @returns ContactQualityResult with detection data
 */
function analyzeContactQuality(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): ContactQualityResult {
  const fftSize = CONFIG.fftWindowSize;

  if (samples.length < fftSize / 2) {
    return {
      isOnBody: false,
      lowFreqRatio: 0,
      highFreqRatio: 1,
      spectralRolloff: sampleRate / 2,
      contactConfidence: 0,
      shouldRejectAsInAir: true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PART 1: SPECTRAL ANALYSIS (original criteria)
  // ═══════════════════════════════════════════════════════════════════════════════

  // Use first portion of samples for spectral analysis
  const analysisSamples = samples.slice(0, Math.min(fftSize, samples.length));

  // Apply Hann window
  const windowed = analysisSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (analysisSamples.length - 1)))
  );

  // Pad if needed
  let paddedSamples: number[];
  if (windowed.length < fftSize) {
    paddedSamples = [...windowed, ...new Array(fftSize - windowed.length).fill(0)];
  } else {
    paddedSamples = windowed;
  }

  // Compute FFT
  const fftResult = computeFFT(paddedSamples);
  const magnitudes = computeMagnitudeSpectrum(fftResult);
  const freqPerBin = sampleRate / fftSize;

  // Calculate energy in frequency bands
  const lowFreqBin = Math.floor(200 / freqPerBin);
  const highFreqBin = Math.floor(400 / freqPerBin);

  let lowFreqEnergy = 0;
  let midFreqEnergy = 0;
  let highFreqEnergy = 0;
  let totalEnergy = 0;

  for (let bin = 0; bin < magnitudes.length; bin++) {
    const energy = magnitudes[bin] * magnitudes[bin];
    totalEnergy += energy;

    if (bin < lowFreqBin) {
      lowFreqEnergy += energy;
    } else if (bin < highFreqBin) {
      midFreqEnergy += energy;
    } else {
      highFreqEnergy += energy;
    }
  }

  const lowFreqRatio = totalEnergy > 0 ? lowFreqEnergy / totalEnergy : 0;
  const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 1;

  // Calculate spectral rolloff (frequency below which 85% of energy is contained)
  const targetEnergy = totalEnergy * 0.85;
  let cumulativeEnergy = 0;
  let rolloffBin = magnitudes.length - 1;

  for (let bin = 0; bin < magnitudes.length; bin++) {
    cumulativeEnergy += magnitudes[bin] * magnitudes[bin];
    if (cumulativeEnergy >= targetEnergy) {
      rolloffBin = bin;
      break;
    }
  }

  const spectralRolloff = rolloffBin * freqPerBin;

  // Spectral criteria
  const isLowFreqDominant = lowFreqRatio >= CONFIG.skinContactLowFreqRatio;
  const isHighFreqSuppressed = highFreqRatio <= CONFIG.maxHighFreqRatioOnBody;
  const isLowRolloff = spectralRolloff <= CONFIG.maxSpectralRolloffOnBody;

  // ═══════════════════════════════════════════════════════════════════════════════
  // PART 2: TEMPORAL VARIABILITY ANALYSIS (CRITICAL FIX)
  // Body sounds have BURSTS with varying amplitude
  // Ambient noise (HVAC, table) is CONSTANT/FLAT
  // ═══════════════════════════════════════════════════════════════════════════════

  // Calculate RMS energy in windows across the recording
  const windowSizeSamples = Math.floor((CONFIG.windowSizeMs / 1000) * sampleRate);
  const energyWindows: number[] = [];

  for (let i = 0; i + windowSizeSamples <= samples.length; i += windowSizeSamples) {
    const windowData = samples.slice(i, i + windowSizeSamples);
    const rms = Math.sqrt(windowData.reduce((sum, s) => sum + s * s, 0) / windowData.length);
    energyWindows.push(rms);
  }

  // Calculate temporal variability metrics
  let hasTemporalVariability = false;
  let hasBurstPeaks = false;
  let hasEnergyVariance = false;
  let hasSilenceGaps = false;
  let passesMinRMS = false;

  // Diagnostic values for logging
  let cv = 0;
  let peakCount = 0;
  let varianceRatio = 0;
  let avgEnergy = 0;
  let silenceRatio = 0;
  let silentFrameCount = 0;

  if (energyWindows.length >= 5) {
    avgEnergy = energyWindows.reduce((s, e) => s + e, 0) / energyWindows.length;
    const energyStdDev = Math.sqrt(
      energyWindows.reduce((s, e) => s + (e - avgEnergy) ** 2, 0) / energyWindows.length
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHECK 0: MINIMUM RMS THRESHOLD (HARD GATE)
    // Gut sounds via body contact have higher amplitude than ambient table pickup
    // If RMS is below threshold, phone is NOT in contact with body
    // ═══════════════════════════════════════════════════════════════════════════════
    passesMinRMS = avgEnergy >= CONFIG.minRMSForBodyContact;

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHECK 1: Coefficient of variation (CV) - TIGHTENED
    // Body sounds: CV > 0.25 (sharp bursts cause HIGH variability)
    // Ambient noise: CV < 0.20 (even "noisy" rooms are relatively constant)
    // ═══════════════════════════════════════════════════════════════════════════════
    cv = avgEnergy > 0 ? energyStdDev / avgEnergy : 0;
    hasTemporalVariability = cv >= CONFIG.minCVForBodyContact;

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHECK 2: Burst peaks - TIGHTENED (energy > 3x baseline, not 2x)
    // Gut sounds are SHARP spikes, not gradual ambient variations
    // ═══════════════════════════════════════════════════════════════════════════════
    const peakThreshold = avgEnergy * CONFIG.burstPeakThresholdMultiplier;
    for (const energy of energyWindows) {
      if (energy > peakThreshold) {
        peakCount++;
      }
    }
    hasBurstPeaks = peakCount >= CONFIG.minBurstPeaksForBodyContact;

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHECK 3: Energy variance ratio (max/min) - TIGHTENED
    // ═══════════════════════════════════════════════════════════════════════════════
    const minEnergy = Math.max(0.0001, Math.min(...energyWindows));
    const maxEnergy = Math.max(...energyWindows);
    varianceRatio = maxEnergy / minEnergy;
    hasEnergyVariance = varianceRatio >= CONFIG.minEnergyVarianceRatio;

    // ═══════════════════════════════════════════════════════════════════════════════
    // CHECK 4: SILENCE GAP REQUIREMENT (NEW)
    // Real gut sounds have SILENCE between bursts
    // Ambient noise is continuous with no true silence
    // Must have at least 20% of frames near-silent
    // ═══════════════════════════════════════════════════════════════════════════════
    silentFrameCount = energyWindows.filter(e => e < CONFIG.silenceThresholdRMS).length;
    silenceRatio = silentFrameCount / energyWindows.length;
    hasSilenceGaps = silenceRatio >= CONFIG.minSilenceRatio;

    // ═══════════════════════════════════════════════════════════════════════════════
    // DIAGNOSTIC LOGGING - TEMPORAL CHECK
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('=== TEMPORAL CHECK (analyzeContactQuality) ===');
    console.log(`Energy windows: ${energyWindows.length}`);
    console.log(`Avg RMS: ${avgEnergy.toFixed(6)} (need ≥${CONFIG.minRMSForBodyContact} for body): ${passesMinRMS ? '✓' : '✗ HARD REJECT'}`);
    console.log(`CV (coefficient of variation): ${cv.toFixed(4)} (need ≥${CONFIG.minCVForBodyContact} for body): ${hasTemporalVariability ? '✓' : '✗'}`);
    console.log(`Burst peaks (>${CONFIG.burstPeakThresholdMultiplier}x avg): ${peakCount} (need ≥${CONFIG.minBurstPeaksForBodyContact} for body): ${hasBurstPeaks ? '✓' : '✗'}`);
    console.log(`Energy variance ratio (max/min): ${varianceRatio.toFixed(2)} (need ≥${CONFIG.minEnergyVarianceRatio} for body): ${hasEnergyVariance ? '✓' : '✗'}`);
    console.log(`Silence gaps: ${silentFrameCount}/${energyWindows.length} = ${(silenceRatio * 100).toFixed(1)}% (need ≥${CONFIG.minSilenceRatio * 100}%): ${hasSilenceGaps ? '✓' : '✗'}`);
  } else {
    console.log('=== TEMPORAL CHECK (analyzeContactQuality) ===');
    console.log(`SKIPPED: Only ${energyWindows.length} energy windows (need ≥5)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PART 3: COMBINED CLASSIFICATION (CRITICAL FIX)
  //
  // OLD LOGIC (BROKEN):
  //   shouldRejectAsInAir = spectralCriteria === 0
  //   (Only rejected if ALL spectral criteria failed - too permissive!)
  //
  // NEW LOGIC:
  //   1. Spectral criteria alone are NOT sufficient (ambient noise passes them!)
  //   2. MUST have temporal variability to be considered on-body
  //   3. Reject if signal is FLAT (no bursts) regardless of spectral shape
  // ═══════════════════════════════════════════════════════════════════════════════

  // Count spectral criteria met
  let spectralCriteriaMet = 0;
  if (isLowFreqDominant) spectralCriteriaMet++;
  if (isHighFreqSuppressed) spectralCriteriaMet++;
  if (isLowRolloff) spectralCriteriaMet++;

  // Count temporal criteria met (now includes silence gaps)
  let temporalCriteriaMet = 0;
  if (hasTemporalVariability) temporalCriteriaMet++;
  if (hasBurstPeaks) temporalCriteriaMet++;
  if (hasEnergyVariance) temporalCriteriaMet++;
  if (hasSilenceGaps) temporalCriteriaMet++;

  // ═══════════════════════════════════════════════════════════════════════════════
  // STRICT TEMPORAL GATING (CRITICAL FIX)
  //
  // OLD LOGIC (TOO PERMISSIVE):
  //   passesTemporalCheck = temporalCriteriaMet >= 1 (only needed 1/3)
  //
  // NEW LOGIC (STRICT):
  //   1. MUST pass minimum RMS check (hard gate - no body contact if too quiet)
  //   2. MUST pass at least 2/4 temporal criteria
  //   3. Spectral check alone is NOT sufficient
  // ═══════════════════════════════════════════════════════════════════════════════
  const passesSpectralCheck = spectralCriteriaMet >= 2;
  const passesTemporalCheck = passesMinRMS && temporalCriteriaMet >= 2;  // TIGHTENED: 2/4 not 1/3

  const isOnBody = passesSpectralCheck && passesTemporalCheck;

  // Confidence is average of both checks
  const spectralConfidence = spectralCriteriaMet / 3;
  const temporalConfidence = temporalCriteriaMet / 4;  // Now 4 criteria
  const contactConfidence = (spectralConfidence + temporalConfidence) / 2;

  // ═══════════════════════════════════════════════════════════════════════════════
  // AMBIENT NOISE SIGNATURE DETECTION
  // Ambient noise (table/room) has specific signature - even with tightened
  // thresholds, explicitly detect and reject this pattern
  // ═══════════════════════════════════════════════════════════════════════════════
  const isAmbientNoiseSignature = (
    cv < 0.20 &&              // Low CV (constant signal)
    peakCount <= 1 &&         // Almost no burst peaks
    silenceRatio < 0.10 &&    // No silence gaps (continuous noise)
    isLowFreqDominant         // Low-freq dominated (HVAC, hum)
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINAL REJECTION DECISION
  // Reject if ANY of:
  //   1. Min RMS not met (too quiet for body contact)
  //   2. Temporal check fails (< 2/4 criteria)
  //   3. No spectral criteria met
  //   4. Ambient noise signature detected
  // ═══════════════════════════════════════════════════════════════════════════════
  const shouldRejectAsInAir = !passesMinRMS || !passesTemporalCheck || spectralCriteriaMet === 0 || isAmbientNoiseSignature;

  // ═══════════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC LOGGING - FINAL DECISION
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('--- SPECTRAL CHECK ---');
  console.log(`Low-freq ratio: ${lowFreqRatio.toFixed(3)} (need ≥${CONFIG.skinContactLowFreqRatio}): ${isLowFreqDominant ? '✓' : '✗'}`);
  console.log(`High-freq ratio: ${highFreqRatio.toFixed(3)} (need ≤${CONFIG.maxHighFreqRatioOnBody}): ${isHighFreqSuppressed ? '✓' : '✗'}`);
  console.log(`Spectral rolloff: ${spectralRolloff.toFixed(0)}Hz (need ≤${CONFIG.maxSpectralRolloffOnBody}): ${isLowRolloff ? '✓' : '✗'}`);
  console.log(`Spectral criteria: ${spectralCriteriaMet}/3`);
  console.log('--- AMBIENT NOISE SIGNATURE CHECK ---');
  console.log(`CV < 0.20: ${cv < 0.20 ? '✓ (constant)' : '✗ (variable)'}`);
  console.log(`Peaks ≤ 1: ${peakCount <= 1 ? '✓ (no bursts)' : '✗ (has bursts)'}`);
  console.log(`Silence < 10%: ${silenceRatio < 0.10 ? '✓ (continuous)' : '✗ (has gaps)'}`);
  console.log(`Low-freq dominant: ${isLowFreqDominant ? '✓' : '✗'}`);
  console.log(`isAmbientNoiseSignature: ${isAmbientNoiseSignature}`);
  console.log('--- FINAL DECISION ---');
  console.log(`Passes minRMS (≥${CONFIG.minRMSForBodyContact}): ${passesMinRMS ? '✓' : '✗ HARD REJECT'}`);
  console.log(`Passes spectral (≥2/3): ${passesSpectralCheck ? '✓' : '✗'}`);
  console.log(`Passes temporal (≥2/4): ${passesTemporalCheck ? '✓' : '✗'} (score: ${temporalCriteriaMet}/4)`);
  console.log(`isOnBody: ${isOnBody}`);
  console.log(`shouldRejectAsInAir: ${shouldRejectAsInAir}`);
  if (shouldRejectAsInAir) {
    const reasons = [];
    if (!passesMinRMS) reasons.push('RMS too low');
    if (temporalCriteriaMet < 2) reasons.push(`temporal ${temporalCriteriaMet}/4 < 2`);
    if (spectralCriteriaMet === 0) reasons.push('no spectral criteria');
    if (isAmbientNoiseSignature) reasons.push('ambient noise signature');
    console.log(`REJECTION REASON(S): ${reasons.join(', ')}`);
  }
  console.log('=====================================');

  return {
    isOnBody,
    lowFreqRatio,
    highFreqRatio,
    spectralRolloff,
    contactConfidence,
    shouldRejectAsInAir,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// EXPANDED BREATH ARTIFACT DETECTION (NG-HARDEN-08)
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Result of breath artifact analysis
 */
interface BreathArtifactResult {
  /** Is this likely a breath artifact? */
  isBreathArtifact: boolean;
  /** Duration of the event (ms) */
  durationMs: number;
  /** Onset ratio (attack energy / peak energy) - low = gradual = breath-like */
  onsetRatio: number;
  /** Low frequency emphasis ratio */
  lowFreqEmphasis: number;
  /** Confidence of breath detection (0-1) */
  breathConfidence: number;
}

/**
 * Detect breath artifacts using expanded criteria
 *
 * Breath characteristics:
 * - Duration: 400-3000ms (expanded from 600-1000ms)
 * - Gradual onset and decay (low onset slope)
 * - Low-frequency emphasis (<200Hz)
 * - Relatively smooth envelope
 *
 * @param samples - Audio samples for the event
 * @param sampleRate - Sample rate in Hz
 * @returns BreathArtifactResult with detection data
 */
function detectBreathArtifact(
  samples: number[],
  sampleRate: number = CONFIG.sampleRate
): BreathArtifactResult {
  const durationMs = (samples.length / sampleRate) * 1000;

  // Quick reject if outside breath duration range
  if (durationMs < CONFIG.breathVetoMinMsExtended || durationMs > CONFIG.breathVetoMaxMsExtended) {
    return {
      isBreathArtifact: false,
      durationMs,
      onsetRatio: 1,
      lowFreqEmphasis: 0,
      breathConfidence: 0,
    };
  }

  // Calculate RMS envelope
  const windowSize = Math.floor((50 / 1000) * sampleRate); // 50ms windows
  const envelopeValues: number[] = [];

  for (let i = 0; i + windowSize <= samples.length; i += windowSize / 2) {
    const window = samples.slice(i, i + windowSize);
    const rms = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    envelopeValues.push(rms);
  }

  if (envelopeValues.length < 4) {
    return {
      isBreathArtifact: false,
      durationMs,
      onsetRatio: 1,
      lowFreqEmphasis: 0,
      breathConfidence: 0,
    };
  }

  // Find peak and calculate onset ratio
  const peakEnergy = Math.max(...envelopeValues);
  const peakIndex = envelopeValues.indexOf(peakEnergy);

  // Onset energy (first 20% of envelope up to peak)
  const onsetEnd = Math.max(1, Math.floor(peakIndex * 0.2));
  const onsetEnergy = envelopeValues.slice(0, onsetEnd).reduce((s, e) => s + e, 0) / onsetEnd;

  const onsetRatio = peakEnergy > 0 ? onsetEnergy / peakEnergy : 1;

  // Calculate low-frequency emphasis
  const fftSize = Math.min(CONFIG.fftWindowSize, samples.length);
  let lowFreqEmphasis = 0;

  if (samples.length >= fftSize / 2) {
    const analysisSamples = samples.slice(0, fftSize);
    const windowed = analysisSamples.map(
      (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (analysisSamples.length - 1)))
    );

    const paddedSamples = windowed.length < fftSize
      ? [...windowed, ...new Array(fftSize - windowed.length).fill(0)]
      : windowed;

    const fftResult = computeFFT(paddedSamples);
    const magnitudes = computeMagnitudeSpectrum(fftResult);
    const freqPerBin = sampleRate / fftSize;

    const lowFreqBin = Math.floor(CONFIG.breathLowFreqEmphasisHz / freqPerBin);

    let lowEnergy = 0;
    let totalEnergy = 0;

    for (let bin = 0; bin < magnitudes.length; bin++) {
      const energy = magnitudes[bin] * magnitudes[bin];
      totalEnergy += energy;
      if (bin < lowFreqBin) {
        lowEnergy += energy;
      }
    }

    lowFreqEmphasis = totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
  }

  // Classification
  const hasGradualOnset = onsetRatio < CONFIG.breathOnsetRatioThreshold;
  const hasLowFreqEmphasis = lowFreqEmphasis >= CONFIG.breathLowFreqRatio;
  const isInBreathDurationRange =
    durationMs >= CONFIG.breathVetoMinMsExtended &&
    durationMs <= CONFIG.breathVetoMaxMsExtended;

  // Breath confidence
  let breathConfidence = 0;
  if (isInBreathDurationRange) breathConfidence += 0.3;
  if (hasGradualOnset) breathConfidence += 0.4;
  if (hasLowFreqEmphasis) breathConfidence += 0.3;

  const isBreathArtifact = breathConfidence >= 0.6;

  return {
    isBreathArtifact,
    durationMs,
    onsetRatio,
    lowFreqEmphasis,
    breathConfidence,
  };
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

  // Calculate threshold using stdDev method
  const baseNoiseFloor = Math.max(noiseFloorMean, frequencyWeightedNoiseFloor);
  let eventThreshold = baseNoiseFloor + thresholdMultiplier * noiseFloorStdDev;

  // CAP: Threshold should never exceed 5x the noise floor mean
  // This prevents absurdly high thresholds when stdDev >> mean
  // (which happens when gut sounds are incorrectly included in calibration window)
  const maxThreshold = baseNoiseFloor * 5;
  if (eventThreshold > maxThreshold) {
    console.log(`[NoiseFloor] Capping threshold from ${eventThreshold.toFixed(4)} to ${maxThreshold.toFixed(4)} (5x noise floor)`);
    eventThreshold = maxThreshold;
  }

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
 * NG-HARDEN-05: Signal quality affects the result:
 * - "poor" quality → VRS = 0 (unreliable data)
 * - "fair" quality → VRS weighted by 0.5 (caution)
 * - "good"/"excellent" → VRS unweighted (reliable)
 *
 * This is a simple heuristic designed for self-tracking, not medical assessment.
 */
function calculateMotilityIndex(
  eventsPerMinute: number,
  activeFraction: number,
  signalQuality: SignalQuality = "good"
): number {
  // NG-HARDEN-05: If signal quality is poor, return 0 (unreliable)
  if (signalQuality === "poor") {
    return 0;
  }

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
  let motilityIndex = Math.round(normalizedEPM * 0.7 + activenessScore * 0.3);

  // NG-HARDEN-05: Weight by signal quality
  if (signalQuality === "fair") {
    motilityIndex = Math.round(motilityIndex * 0.5);
  }

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
  console.log('=== DETECT NO SKIN CONTACT ===');

  if (energyValues.length < 10) {
    console.log(`SKIPPED: Only ${energyValues.length} energy values (need ≥10)`);
    return false;
  }

  const avgEnergy = mean(energyValues);
  const energyStdDev = stdDev(energyValues);

  console.log(`Energy values: ${energyValues.length}`);
  console.log(`Avg energy: ${avgEnergy.toFixed(6)}, StdDev: ${energyStdDev.toFixed(6)}`);

  // CHECK 1: Minimum energy threshold
  // Phone on skin should have baseline RMS above MIN_SKIN_CONTACT_RMS
  // If average energy is below this, phone is likely in air or on table
  if (avgEnergy < MIN_SKIN_CONTACT_RMS) {
    console.log(`CHECK 1: Avg energy ${avgEnergy.toFixed(6)} < ${MIN_SKIN_CONTACT_RMS} threshold`);
    console.log('RESULT: No contact - energy too low');
    return true; // No contact - energy too low
  }
  console.log(`CHECK 1: Avg energy ${avgEnergy.toFixed(6)} ≥ ${MIN_SKIN_CONTACT_RMS} threshold ✓`);

  // CHECK 2: Coefficient of variation (CV) = stdDev / mean
  // SIGNIFICANTLY TIGHTENED: CV threshold to 0.25
  // Flat noise has low CV (< 0.25) - consistent background hum
  // Gut sounds have HIGH variance (CV > 0.25) from sharp bursts
  const cv = avgEnergy > 0 ? energyStdDev / avgEnergy : 0;
  console.log(`CHECK 2: CV = ${cv.toFixed(4)} (flat if < 0.25)`);

  // CHECK 3: Count distinct peaks (energy > 3x average) - TIGHTENED from 2x
  // Body sounds are SHARP spikes; ambient noise has gradual variations
  const peakThreshold = avgEnergy * 3.0;  // was 2.0
  let peakCount = 0;
  for (const energy of energyValues) {
    if (energy > peakThreshold) {
      peakCount++;
    }
  }
  const hasNoPeaks = peakCount < 2;
  console.log(`CHECK 3: Burst peaks (>3x avg): ${peakCount} (need ≥2, hasNoPeaks=${hasNoPeaks})`);

  // CHECK 4: Energy range ratio (max/min) - TIGHTENED from 3.0 to 5.0
  // Body sounds have HIGH dynamic range; ambient noise is compressed
  const minEnergy = Math.max(0.0001, Math.min(...energyValues));
  const maxEnergy = Math.max(...energyValues);
  const dynamicRange = maxEnergy / minEnergy;
  const hasLowDynamicRange = dynamicRange < 5.0;  // was 3.0
  console.log(`CHECK 4: Dynamic range (max/min): ${dynamicRange.toFixed(2)} (low if < 5.0, hasLowDynamicRange=${hasLowDynamicRange})`);

  // CHECK 5: Silence gaps - body recordings have quiet periods between bursts
  const silentFrames = energyValues.filter(e => e < CONFIG.silenceThresholdRMS).length;
  const silenceRatio = silentFrames / energyValues.length;
  const hasNoSilence = silenceRatio < CONFIG.minSilenceRatio;
  console.log(`CHECK 5: Silence ratio: ${(silenceRatio * 100).toFixed(1)}% (need ≥${CONFIG.minSilenceRatio * 100}%, hasNoSilence=${hasNoSilence})`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // REJECTION LOGIC - SIGNIFICANTLY TIGHTENED
  // Reject if ANY of:
  // - CV is too low (< 0.25 = flat signal)
  // - No burst peaks (< 2 peaks > 3x average)
  // - Low dynamic range (< 5x)
  // - No silence gaps (< 20% quiet frames)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isFlatSignal = cv < 0.25;  // TIGHTENED from 0.15
  const isConstantNoise = hasNoPeaks && hasLowDynamicRange;
  const isContinuousNoise = hasNoSilence && hasNoPeaks;  // No silence + no peaks = ambient

  // Count rejection criteria
  let rejectionScore = 0;
  if (isFlatSignal) rejectionScore++;
  if (hasNoPeaks) rejectionScore++;
  if (hasLowDynamicRange) rejectionScore++;
  if (hasNoSilence) rejectionScore++;

  // Reject if 2+ criteria indicate ambient noise
  const shouldReject = rejectionScore >= 2;

  console.log(`isFlatSignal (CV < 0.25): ${isFlatSignal}`);
  console.log(`hasNoPeaks (< 2 peaks > 3x): ${hasNoPeaks}`);
  console.log(`hasLowDynamicRange (< 5x): ${hasLowDynamicRange}`);
  console.log(`hasNoSilence (< 20% quiet): ${hasNoSilence}`);
  console.log(`Rejection score: ${rejectionScore}/4 (reject if ≥ 2)`);
  console.log(`RESULT: ${shouldReject ? 'REJECTED (no skin contact)' : 'ACCEPTED (appears to be on body)'}`);
  console.log('=====================================');

  return shouldReject;
}

/**
 * Analysis options for controlling filter behavior
 */
/**
 * Accelerometer contact detection result (from accelerometerContact.ts)
 */
export interface AccelerometerContactResult {
  /** Is the phone likely NOT in contact with body? */
  noContact: boolean;
  /** Is variance in the body contact range? (has breathing micro-motion) */
  varianceInBodyRange: boolean;
  /** Rejection reason if noContact is true */
  rejectionReason: 'too_still' | 'too_much_motion' | 'insufficient_samples' | null;
  /** Total variance across all axes */
  totalVariance: number;
  /** Confidence in detection (0-1) */
  confidence: number;
}

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

  /**
   * Accelerometer contact detection result
   * If provided and noContact is true, immediately returns 0 events
   * PRIMARY GATE: Takes precedence over all audio analysis
   */
  accelerometerResult?: AccelerometerContactResult;
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
  const { applyBirdFilter = true, isHummingPhase = false, accelerometerResult } = options;

  // ════════════════════════════════════════════════════════════════════════════════
  // ACCELEROMETER BYPASS FLAG - DEFINED FIRST, USED THROUGHOUT
  // If accelerometer confirmed body contact, skip ALL audio-based contact checks
  // ════════════════════════════════════════════════════════════════════════════════
  const accelerometerConfirmedContact = accelerometerResult?.varianceInBodyRange === true;

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              ANALYZE AUDIO SAMPLES - START                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Duration: ${durationSeconds}s, Sample rate: ${sampleRate}Hz, Samples: ${samples.length}`);
  console.log(`Accelerometer result provided: ${!!accelerometerResult}`);
  console.log(`Accelerometer confirmed contact: ${accelerometerConfirmedContact}`);
  if (accelerometerResult) {
    console.log(`  - noContact: ${accelerometerResult.noContact}`);
    console.log(`  - varianceInBodyRange: ${accelerometerResult.varianceInBodyRange}`);
    console.log(`  - totalVariance: ${accelerometerResult.totalVariance?.toFixed(8) ?? 'N/A'}`);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // ACCELEROMETER CONTACT GATE (PRIMARY - takes precedence over all audio analysis)
  // If phone is flat + still (table), return 0 events immediately
  // This prevents false positives from ambient noise on table recordings
  // ════════════════════════════════════════════════════════════════════════════════
  if (accelerometerResult?.noContact) {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║     ACCELEROMETER VARIANCE GATE: NO BODY CONTACT DETECTED       ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`Variance: ${accelerometerResult.totalVariance?.toFixed(8) ?? 'N/A'}`);
    console.log(`In body range: ${accelerometerResult.varianceInBodyRange}`);
    console.log(`Rejection reason: ${accelerometerResult.rejectionReason ?? 'unknown'}`);
    console.log(`Confidence: ${(accelerometerResult.confidence * 100).toFixed(1)}%`);
    console.log('>>> Returning 0 events - phone not in contact with body');
    console.log('=====================================\n');
    return {
      eventsPerMinute: 0,
      totalActiveSeconds: 0,
      totalQuietSeconds: Math.round(durationSeconds),
      motilityIndex: 0,
      activityTimeline: new Array(CONFIG.timelineSegments).fill(0),
      timelineSegments: CONFIG.timelineSegments,
    };
  }

  // NG-HARDEN-05 + Ralph Loop: Use cached ANF calibration to avoid duplicate calls
  const anfCalibrationResult = getCachedANFCalibration(samples, sampleRate);

  // BIRD FILTER GUARDRAILS:
  // - Only apply spectral bandpass during motility recording phase
  // - During humming phase, skip the bird filter entirely
  let filteredSamples: number[];

  if (isHummingPhase) {
    // HUMMING PHASE: No bird filter, raw samples used for humming detection
    filteredSamples = samples;
  } else if (applyBirdFilter) {
    // ══════════════════════════════════════════════════════════════════════════════
    // NG-HARDEN-05: ACOUSTIC ENVIRONMENT ISOLATION PIPELINE
    // 1. Detect and subtract constant hums (AC, refrigerator, HVAC)
    // 2. Apply tightened bandpass filter (100-450 Hz)
    // ══════════════════════════════════════════════════════════════════════════════

    // Use ANF calibration result from initialization above
    let processedSamples = samples;

    if (anfCalibrationResult.detectedHumFrequencies.length > 0) {
      // Apply spectral subtraction to remove detected hums
      processedSamples = applySpectralSubtraction(
        samples,
        anfCalibrationResult.detectedHumFrequencies,
        sampleRate
      );
    }

    // Step 2: Apply tightened bandpass filter (100-450 Hz)
    filteredSamples = applySpectralBandpass(processedSamples, sampleRate);
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
  // SKIP if accelerometer confirmed body contact
  // ══════════════════════════════════════════════════════════════════════════════
  if (!accelerometerConfirmedContact) {
    const isDominatedByAirNoise = isRecordingDominatedByAirNoise(filteredSamples, sampleRate);
    if (isDominatedByAirNoise) {
      console.log('>>> EARLY EXIT: isDominatedByAirNoise=true, returning 0 events');
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
  } else {
    console.log('>>> SKIPPING isDominatedByAirNoise check (accelerometer confirmed contact)');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PSYCHOACOUSTIC GATING (NG-HARDEN-04)
  // Temporal masking and rhythmic rejection for advanced noise filtering
  // SKIP if accelerometer confirmed body contact
  // ══════════════════════════════════════════════════════════════════════════════
  if (!accelerometerConfirmedContact) {
    const psychoacousticGating = applyPsychoacousticGating(filteredSamples, sampleRate);
    if (psychoacousticGating.shouldGate) {
      console.log('>>> EARLY EXIT: psychoacousticGating.shouldGate=true, returning 0 events');
      // Return zero motility - stationary air or mechanical noise detected
      return {
        eventsPerMinute: 0,
        totalActiveSeconds: 0,
        totalQuietSeconds: Math.round(durationSeconds),
        motilityIndex: 0,
        activityTimeline: new Array(CONFIG.timelineSegments).fill(0),
        timelineSegments: CONFIG.timelineSegments,
      };
    }
  } else {
    console.log('>>> SKIPPING psychoacousticGating check (accelerometer confirmed contact)');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // AUDIO-BASED CONTACT CHECKS (only if no accelerometer confirmation)
  // ══════════════════════════════════════════════════════════════════════════════
  if (accelerometerConfirmedContact) {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║   ACCELEROMETER CONFIRMED BODY CONTACT - SKIPPING AUDIO CHECKS  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`Variance: ${accelerometerResult?.totalVariance?.toFixed(8) ?? 'N/A'}`);
    console.log('>>> Trusting accelerometer - proceeding directly to event detection');
  } else {
    // No accelerometer data or not confirmed - fall back to audio-based checks
    // ══════════════════════════════════════════════════════════════════════════════
    // ENHANCED CONTACT QUALITY DETECTION (NG-HARDEN-07)
    // Spectral analysis to determine if device is on skin vs in air
    // ══════════════════════════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║         CONTACT QUALITY CHECK (analyzeContactQuality)           ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('(No accelerometer confirmation - using audio-based checks)');
    const contactQuality = analyzeContactQuality(filteredSamples, sampleRate);
    if (contactQuality.shouldRejectAsInAir) {
      console.log('>>> EARLY EXIT: shouldRejectAsInAir=true, returning 0 events');
      // Return zero motility - spectral profile indicates phone is in air
      return {
        eventsPerMinute: 0,
        totalActiveSeconds: 0,
        totalQuietSeconds: Math.round(durationSeconds),
        motilityIndex: 0,
        activityTimeline: new Array(CONFIG.timelineSegments).fill(0),
        timelineSegments: CONFIG.timelineSegments,
      };
    }
    console.log('>>> PASSED: analyzeContactQuality - proceeding to next check');

    // SKIN CONTACT SENSOR: Check for flat noise (no skin contact)
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║            SKIN CONTACT SENSOR (detectNoSkinContact)            ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    const noSkinContact = detectNoSkinContact(energyValues);
    if (noSkinContact) {
      console.log('>>> EARLY EXIT: noSkinContact=true, returning 0 events');
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
    console.log('>>> PASSED: detectNoSkinContact - proceeding to event detection');
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FREQUENCY-WEIGHTED NOISE-FLOOR CALIBRATION (3-second window)
  // Enhanced with spectral analysis to detect air noise baseline (NG-HARDEN-03)
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                NOISE FLOOR CALIBRATION                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  const noiseFloor = computeNoiseFloor(energyValues, filteredSamples, sampleRate);
  console.log(`Noise floor mean: ${noiseFloor.noiseFloorMean.toFixed(6)}, Event threshold: ${noiseFloor.eventThreshold.toFixed(6)}`);
  console.log(`isAirNoiseBaseline: ${noiseFloor.isAirNoiseBaseline}`);

  // If baseline is dominated by air noise, reject UNLESS accelerometer confirmed body contact
  if (noiseFloor.isAirNoiseBaseline && !accelerometerConfirmedContact) {
    console.log('>>> EARLY EXIT: isAirNoiseBaseline=true, returning 0 events');
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
  if (noiseFloor.isAirNoiseBaseline && accelerometerConfirmedContact) {
    console.log('>>> OVERRIDE: isAirNoiseBaseline=true BUT accelerometer confirmed contact - proceeding');
  }
  console.log('>>> PASSED: Noise floor check - proceeding to event detection');

  // Detect events using calibrated threshold
  let events = detectEvents(energyValues, noiseFloor.eventThreshold);
  console.log(`\n[PIPELINE] Initial events detected: ${events.length}`);

  // ══════════════════════════════════════════════════════════════════════════════
  // TEMPORAL VETO FOR AIR/BREATH (800ms centered)
  // Filter out events matching breath artifact profile (600-1000ms, gradual onset)
  // ══════════════════════════════════════════════════════════════════════════════
  const beforeBreathVeto = events.length;
  events = events.filter((event) => !isBreathLikeEvent(event, energyValues));
  console.log(`[PIPELINE] After breath veto: ${events.length} (removed ${beforeBreathVeto - events.length})`);

  // ══════════════════════════════════════════════════════════════════════════════
  // DEEP SPECTRAL VETO (NG-HARDEN-03)
  // Analyze each event's spectrum to reject noise masquerading as gut sounds
  // ══════════════════════════════════════════════════════════════════════════════
  const beforeSpectralVeto = events.length;
  events = events.filter((event) => !isSpectrallyNoise(
    filteredSamples,
    event,
    windowSizeSamples,
    sampleRate
  ));
  console.log(`[PIPELINE] After spectral veto: ${events.length} (removed ${beforeSpectralVeto - events.length})`);

  // ══════════════════════════════════════════════════════════════════════════════
  // ACOUSTIC FINGERPRINTING + DURATION GATING (Ralph Loop + NG-HARDEN-05)
  // Uses validateBurstEvent() for constant noise rejection and burst validation
  // Accept short bursts (10ms-1500ms), reject constant noise >2s
  // ══════════════════════════════════════════════════════════════════════════════
  const beforeBurstValidation = events.length;
  events = events.filter((event) => {
    // Extract samples for this event
    const startSample = event.startWindow * windowSizeSamples;
    const endSample = Math.min(
      (event.endWindow + 1) * windowSizeSamples,
      filteredSamples.length
    );
    const eventSamples = filteredSamples.slice(startSample, endSample);

    // Ralph Loop: Validate event against acoustic fingerprint
    const burstValidation = validateBurstEvent(eventSamples, sampleRate);
    if (!burstValidation.isValidBurst) {
      return false; // Reject constant noise or invalid duration
    }

    // Keep original duration checks as fallback
    const eventDurationWindows = event.endWindow - event.startWindow + 1;
    const eventDurationMs = eventDurationWindows * CONFIG.windowSizeMs;

    // Reject transients (clicks, clatter) - too short
    if (eventDurationMs < CONFIG.transientRejectDurationMs) {
      return false;
    }

    // Reject sustained noise (AC hum, continuous) - too long
    if (eventDurationMs > CONFIG.sustainedNoiseRejectDurationMs) {
      return false;
    }

    // Accept events within valid gut sound duration range
    return (
      eventDurationMs >= CONFIG.minValidEventDurationMs &&
      eventDurationMs <= CONFIG.maxValidEventDurationMs
    );
  });
  console.log(`[PIPELINE] After burst validation: ${events.length} (removed ${beforeBurstValidation - events.length})`);

  // ══════════════════════════════════════════════════════════════════════════════
  // TRANSIENT SUPPRESSION (NG-HARDEN-05)
  // Reject sharp transients (clicks, clatter, door slams) based on onset slope
  // ══════════════════════════════════════════════════════════════════════════════
  const beforeTransientSuppress = events.length;
  events = events.filter((event) => {
    // Extract samples for this event
    const startSample = event.startWindow * windowSizeSamples;
    const endSample = Math.min(
      (event.endWindow + 1) * windowSizeSamples,
      filteredSamples.length
    );
    const eventSamples = filteredSamples.slice(startSample, endSample);

    // Detect if this is a sharp transient
    const transientResult = detectTransient(eventSamples, sampleRate);

    // Reject transients (sharp attacks, high energy ratio)
    return !transientResult.isTransient;
  });
  console.log(`[PIPELINE] After transient suppression: ${events.length} (removed ${beforeTransientSuppress - events.length})`);

  // ══════════════════════════════════════════════════════════════════════════════
  // HARMONIC STRUCTURE DETECTION (NG-HARDEN-06)
  // Reject speech and music based on harmonic series patterns
  // Speech has f0, 2f0, 3f0... ; gut sounds are non-harmonic
  // ══════════════════════════════════════════════════════════════════════════════
  const beforeHarmonicVeto = events.length;
  events = events.filter((event) => {
    const startSample = event.startWindow * windowSizeSamples;
    const endSample = Math.min(
      (event.endWindow + 1) * windowSizeSamples,
      filteredSamples.length
    );
    const eventSamples = filteredSamples.slice(startSample, endSample);

    // Skip harmonic analysis for very short events (< 100ms)
    if (eventSamples.length < sampleRate * 0.1) {
      return true; // Keep short events, they can't be speech
    }

    const harmonicResult = detectHarmonicStructure(eventSamples, sampleRate);
    return !harmonicResult.shouldReject;
  });
  console.log(`[PIPELINE] After harmonic veto: ${events.length} (removed ${beforeHarmonicVeto - events.length})`);

  // ══════════════════════════════════════════════════════════════════════════════
  // EXPANDED BREATH ARTIFACT DETECTION (NG-HARDEN-08)
  // Reject breath sounds with expanded duration range (400-3000ms)
  // ══════════════════════════════════════════════════════════════════════════════
  const beforeBreathArtifact = events.length;
  events = events.filter((event) => {
    const startSample = event.startWindow * windowSizeSamples;
    const endSample = Math.min(
      (event.endWindow + 1) * windowSizeSamples,
      filteredSamples.length
    );
    const eventSamples = filteredSamples.slice(startSample, endSample);

    const breathResult = detectBreathArtifact(eventSamples, sampleRate);
    return !breathResult.isBreathArtifact;
  });
  console.log(`[PIPELINE] After breath artifact: ${events.length} (removed ${beforeBreathArtifact - events.length})`);
  console.log(`\n[PIPELINE] FINAL: ${events.length} events in ${durationSeconds.toFixed(1)}s = ${(events.length / (durationSeconds / 60)).toFixed(1)} events/min`);

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

  // NG-HARDEN-05: Get signal quality from ANF calibration
  const signalQuality: SignalQuality = anfCalibrationResult.signalQuality;
  const snrDb = anfCalibrationResult.estimatedSNR;
  const isReliable = signalQuality !== "poor";

  // Calculate Motility Index (weighted by signal quality)
  const motilityIndex = calculateMotilityIndex(eventsPerMinute, activeFraction, signalQuality);

  // Create activity timeline
  const activityTimeline = createActivityTimeline(
    energyValues,
    CONFIG.timelineSegments
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // CLINICAL-GRADE PRECISION: Log-Mel Spectrogram & PFHS Data
  // Segment audio and extract frequency histogram for PFHS scoring
  // ══════════════════════════════════════════════════════════════════════════════
  const snippets = segmentAndClassifySnippets(filteredSamples, sampleRate);
  const frequencyHistogram = extractFrequencyHistogram(snippets);

  // Collect peak frequencies from gut sound snippets
  const gutSoundSnippets = snippets.filter(s => s.isLikelyGutSound);
  const peakFrequencies = gutSoundSnippets.map(s => s.peakFrequency);

  // Calculate mean spectral centroid
  const meanSpectralCentroid = gutSoundSnippets.length > 0
    ? gutSoundSnippets.reduce((sum, s) => sum + s.spectralCentroid, 0) / gutSoundSnippets.length
    : 0;

  // Import computePFHS to calculate score (inline to avoid circular dependency)
  // PFHS calculation is done in scoringEngine, but we store the histogram here
  const pfhsScore = computePFHSInline(frequencyHistogram, peakFrequencies);

  // ══════════════════════════════════════════════════════════════════════════════
  // HEART RATE ANALYSIS (20-80Hz Band)
  // Extract heart rate and HRV from the same abdominal recording
  // Runs in parallel with gut sound analysis (different frequency band)
  // ══════════════════════════════════════════════════════════════════════════════
  const heartAnalytics = analyzeHeartRate(samples, durationSeconds, sampleRate);

  return {
    eventsPerMinute: Math.round(eventsPerMinute * 10) / 10,
    totalActiveSeconds: Math.round(totalActiveSeconds),
    totalQuietSeconds: Math.round(totalQuietSeconds),
    motilityIndex,
    activityTimeline,
    timelineSegments: CONFIG.timelineSegments,
    // NG-HARDEN-05: Signal quality metrics
    signalQuality,
    snrDb: Math.round(snrDb * 10) / 10,
    isReliable,
    // Clinical-grade precision: PFHS data
    frequencyHistogram,
    peakFrequencies,
    pfhsScore,
    meanSpectralCentroid: Math.round(meanSpectralCentroid * 10) / 10,
    // Heart rate analytics (20-80Hz band)
    heartBpm: heartAnalytics.confidence >= 0.5 ? heartAnalytics.bpm : undefined,
    heartRmssd: heartAnalytics.hrvValid ? heartAnalytics.rmssd : undefined,
    vagalToneScore: heartAnalytics.hrvValid ? heartAnalytics.vagalToneScore : undefined,
    heartBeatCount: heartAnalytics.beatCount,
    heartConfidence: heartAnalytics.confidence,
  };
}

/**
 * Inline PFHS calculation to avoid circular dependency with scoringEngine
 * Uses same algorithm as computePFHS in scoringEngine.ts
 */
function computePFHSInline(
  frequencyHistogram: number[],
  peakFrequencies: number[]
): number {
  // Reference healthy gut histogram (same as scoringEngine.ts)
  const HEALTHY_GUT_HISTOGRAM = [0.08, 0.15, 0.22, 0.25, 0.15, 0.08, 0.05, 0.02];
  const HEALTHY_PEAK_FREQUENCIES = [200, 250];

  // Check if histogram is empty
  const histogramSum = frequencyHistogram.reduce((sum, h) => sum + h, 0);
  if (histogramSum < 0.01) return 0;

  // Normalize
  const normalizedInput = histogramSum > 0
    ? frequencyHistogram.map(h => h / histogramSum)
    : frequencyHistogram;

  // Pearson correlation
  const n = Math.min(normalizedInput.length, HEALTHY_GUT_HISTOGRAM.length);
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += normalizedInput[i];
    sumY += HEALTHY_GUT_HISTOGRAM[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = normalizedInput[i] - meanX;
    const dy = HEALTHY_GUT_HISTOGRAM[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denominator = Math.sqrt(denomX * denomY);
  const correlation = denominator > 0 ? numerator / denominator : 0;

  // Base score from correlation
  let baseScore = Math.max(0, Math.min(80, (correlation + 1) * 40));

  // Peak alignment bonus
  let bonus = 0;
  for (const freq of peakFrequencies) {
    for (const refPeak of HEALTHY_PEAK_FREQUENCIES) {
      if (Math.abs(freq - refPeak) <= 30) {
        bonus += 5;
        break;
      }
    }
  }
  bonus = Math.min(20, bonus);

  return Math.round(Math.min(100, baseScore + bonus));
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
  // Psychoacoustic gating summary (NG-HARDEN-04)
  psychoacousticGating?: {
    shouldGate: boolean;
    gatingReason: string | null;
    isStationary: boolean;
    isRhythmic: boolean;
    isMechanicalNoise: boolean;
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

  // Apply same filtering logic as analyzeAudioSamples (NG-HARDEN-05)
  let filteredSamples: number[];

  if (isHummingPhase) {
    filteredSamples = samples;
  } else if (applyBirdFilter) {
    // NG-HARDEN-05 + Ralph Loop: Use cached ANF calibration to avoid duplicate calls
    const anfCalibration = getCachedANFCalibration(samples, sampleRate);
    let processedSamples = samples;

    if (anfCalibration.detectedHumFrequencies.length > 0) {
      processedSamples = applySpectralSubtraction(
        samples,
        anfCalibration.detectedHumFrequencies,
        sampleRate
      );
    }

    filteredSamples = applySpectralBandpass(processedSamples, sampleRate);
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
  // PSYCHOACOUSTIC GATING (NG-HARDEN-04)
  // ══════════════════════════════════════════════════════════════════════════════
  const psychoacousticGating = applyPsychoacousticGating(filteredSamples, sampleRate);

  // ══════════════════════════════════════════════════════════════════════════════
  // FREQUENCY-WEIGHTED NOISE-FLOOR CALIBRATION (3-second window)
  // ══════════════════════════════════════════════════════════════════════════════
  const noiseFloor = computeNoiseFloor(energyValues, filteredSamples, sampleRate);

  // Detect events using calibrated threshold
  let events = detectEvents(energyValues, noiseFloor.eventThreshold);

  // Apply all filters unless recording is air noise dominated or psychoacoustically gated
  if (!isDominatedByAirNoise && !noiseFloor.isAirNoiseBaseline && !psychoacousticGating.shouldGate) {
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

    // ══════════════════════════════════════════════════════════════════════════════
    // ACOUSTIC FINGERPRINTING + DURATION GATING (Ralph Loop + NG-HARDEN-05)
    // Uses validateBurstEvent() for constant noise rejection and burst validation
    // ══════════════════════════════════════════════════════════════════════════════
    events = events.filter((event) => {
      const startSample = event.startWindow * windowSizeSamples;
      const endSample = Math.min(
        (event.endWindow + 1) * windowSizeSamples,
        filteredSamples.length
      );
      const eventSamples = filteredSamples.slice(startSample, endSample);

      // Ralph Loop: Validate event against acoustic fingerprint
      const burstValidation = validateBurstEvent(eventSamples, sampleRate);
      if (!burstValidation.isValidBurst) {
        return false; // Reject constant noise or invalid duration
      }

      // Keep original duration checks as fallback
      const eventDurationWindows = event.endWindow - event.startWindow + 1;
      const eventDurationMs = eventDurationWindows * CONFIG.windowSizeMs;

      if (eventDurationMs < CONFIG.transientRejectDurationMs) return false;
      if (eventDurationMs > CONFIG.sustainedNoiseRejectDurationMs) return false;
      return (
        eventDurationMs >= CONFIG.minValidEventDurationMs &&
        eventDurationMs <= CONFIG.maxValidEventDurationMs
      );
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // TRANSIENT SUPPRESSION (NG-HARDEN-05)
    // ══════════════════════════════════════════════════════════════════════════════
    events = events.filter((event) => {
      const startSample = event.startWindow * windowSizeSamples;
      const endSample = Math.min(
        (event.endWindow + 1) * windowSizeSamples,
        filteredSamples.length
      );
      const eventSamples = filteredSamples.slice(startSample, endSample);
      const transientResult = detectTransient(eventSamples, sampleRate);
      return !transientResult.isTransient;
    });
  } else {
    // Air noise dominated or psychoacoustically gated - no valid events
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
    // Psychoacoustic gating summary (NG-HARDEN-04)
    psychoacousticGating: {
      shouldGate: psychoacousticGating.shouldGate,
      gatingReason: psychoacousticGating.gatingReason,
      isStationary: psychoacousticGating.temporalMasking.isStationary,
      isRhythmic: psychoacousticGating.rhythmicRejection.isRhythmic,
      isMechanicalNoise: psychoacousticGating.rhythmicRejection.isMechanicalNoise,
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

// ══════════════════════════════════════════════════════════════════════════════════
// NG-HARDEN-05: STRESS TEST SCENARIOS
// BBQ/Crowd noise simulation for acoustic environment isolation testing
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Generate BBQ party noise simulation
 *
 * Characteristics:
 * - Broadband crowd noise
 * - Random transients (dishes, voices)
 * - Variable amplitude
 * - Some energy in gut frequency band (100-450Hz) from crowd rumble
 *
 * @param durationSeconds - Duration of noise
 * @param sampleRate - Sample rate
 * @returns Array of BBQ noise samples
 */
export function generateBBQNoise(
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  // Base broadband noise (crowd rumble)
  for (let i = 0; i < numSamples; i++) {
    samples[i] = (Math.random() * 2 - 1) * 0.15;
  }

  // Add random transients (dishes, laughter)
  const transientCount = Math.floor(durationSeconds * 3); // 3 transients per second
  for (let t = 0; t < transientCount; t++) {
    const startSample = Math.floor(Math.random() * (numSamples - 500));
    const transientDuration = Math.floor(Math.random() * 50) + 20; // 20-70ms transients

    for (let i = 0; i < transientDuration; i++) {
      if (startSample + i < numSamples) {
        const spike = (Math.random() * 2 - 1) * 0.5 * Math.exp(-i / 30);
        samples[startSample + i] += spike;
      }
    }
  }

  // Add occasional longer speech-like bursts
  const speechCount = Math.floor(durationSeconds / 3); // Speech every 3 seconds
  for (let s = 0; s < speechCount; s++) {
    const startSample = Math.floor(Math.random() * (numSamples - sampleRate));
    const speechDuration = Math.floor(Math.random() * sampleRate * 0.5) + sampleRate * 0.3;

    for (let i = 0; i < speechDuration; i++) {
      if (startSample + i < numSamples) {
        // Speech-like modulated noise
        const t = i / sampleRate;
        const envelope = Math.sin(Math.PI * i / speechDuration);
        const speech = (Math.random() * 2 - 1) * 0.2 * envelope;
        samples[startSample + i] += speech;
      }
    }
  }

  return samples;
}

/**
 * Generate kitchen cooking noise simulation
 *
 * Characteristics:
 * - Metallic transients (pots, utensils)
 * - Running water (broadband noise)
 * - Exhaust fan drone (constant 120Hz hum)
 *
 * @param durationSeconds - Duration of noise
 * @param sampleRate - Sample rate
 * @returns Array of kitchen noise samples
 */
export function generateKitchenNoise(
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  // Constant exhaust fan hum (120Hz + harmonics)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * 120 * t) * 0.1;
    samples[i] += Math.sin(2 * Math.PI * 240 * t) * 0.05;
    samples[i] += Math.sin(2 * Math.PI * 360 * t) * 0.02;
  }

  // Running water broadband noise (periodic bursts)
  const waterBurstCount = Math.floor(durationSeconds / 5); // Water every 5 seconds
  for (let w = 0; w < waterBurstCount; w++) {
    const startSample = Math.floor(w * 5 * sampleRate + Math.random() * sampleRate);
    const waterDuration = Math.floor(Math.random() * sampleRate * 2) + sampleRate;

    for (let i = 0; i < waterDuration; i++) {
      if (startSample + i < numSamples) {
        samples[startSample + i] += (Math.random() * 2 - 1) * 0.2;
      }
    }
  }

  // Metallic transients (pots, utensils)
  const clatterCount = Math.floor(durationSeconds * 1.5); // 1.5 per second
  for (let c = 0; c < clatterCount; c++) {
    const startSample = Math.floor(Math.random() * (numSamples - 200));

    // Short metallic ring (damped sinusoid)
    const ringFreq = 800 + Math.random() * 1500; // 800-2300 Hz
    const ringDuration = Math.floor(Math.random() * 100) + 50; // 50-150ms

    for (let i = 0; i < ringDuration; i++) {
      if (startSample + i < numSamples) {
        const t = i / sampleRate;
        const damping = Math.exp(-i / 30);
        samples[startSample + i] += Math.sin(2 * Math.PI * ringFreq * t) * 0.4 * damping;
      }
    }
  }

  return samples;
}

/**
 * Generate office/clinic noise simulation
 *
 * Characteristics:
 * - HVAC constant hum (60Hz + harmonics)
 * - Keyboard typing (rapid transients)
 * - Distant voices (muffled speech)
 *
 * @param durationSeconds - Duration of noise
 * @param sampleRate - Sample rate
 * @returns Array of office noise samples
 */
export function generateOfficeNoise(
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  // HVAC constant hum (60Hz + harmonics)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * 60 * t) * 0.08;
    samples[i] += Math.sin(2 * Math.PI * 120 * t) * 0.04;
    samples[i] += Math.sin(2 * Math.PI * 180 * t) * 0.02;
    // Low background noise
    samples[i] += (Math.random() * 2 - 1) * 0.03;
  }

  // Keyboard typing (very short transients)
  const typingBurstCount = Math.floor(durationSeconds * 0.5); // Typing bursts
  for (let tb = 0; tb < typingBurstCount; tb++) {
    const burstStart = Math.floor(Math.random() * (numSamples - sampleRate * 3));
    const keysInBurst = Math.floor(Math.random() * 20) + 10; // 10-30 keystrokes

    for (let k = 0; k < keysInBurst; k++) {
      const keyStart = burstStart + Math.floor(k * sampleRate * 0.1); // ~100ms between keys
      const keyDuration = Math.floor(Math.random() * 30) + 10; // 10-40ms

      for (let i = 0; i < keyDuration; i++) {
        if (keyStart + i < numSamples) {
          samples[keyStart + i] += (Math.random() * 2 - 1) * 0.15 * Math.exp(-i / 10);
        }
      }
    }
  }

  return samples;
}

/**
 * Extended stress test simulation result
 */
export interface StressTestResult {
  scenario: string;
  description: string;
  expectedVRS: number | string;
  actualMotilityIndex: number;
  actualEventsPerMinute: number;
  signalQuality: SignalQuality;
  snrDb: number;
  passed: boolean;
  failureReason?: string;
}

/**
 * Run all NG-HARDEN-05 stress test scenarios
 *
 * Tests the acoustic environment isolation against:
 * - BBQ party noise
 * - Kitchen cooking noise
 * - Office/clinic noise
 * - Valid gut sounds (control)
 *
 * @returns Array of stress test results
 */
export function runAcousticIsolationStressTests(): StressTestResult[] {
  const results: StressTestResult[] = [];
  const durationSeconds = 30;
  const sampleRate = CONFIG.sampleRate;

  // ══════════════════════════════════════════════════════════════════════════════
  // STRESS TEST 1: BBQ Party
  // Expected: VRS = 0 (all events rejected as environmental noise)
  // ══════════════════════════════════════════════════════════════════════════════
  const bbqSamples = generateBBQNoise(durationSeconds, sampleRate);
  const bbqAnalysis = analyzeAudioSamples(bbqSamples, durationSeconds, sampleRate);

  results.push({
    scenario: "BBQ_PARTY",
    description: "Outdoor BBQ with voices, crowd noise, and transients",
    expectedVRS: 0,
    actualMotilityIndex: bbqAnalysis.motilityIndex,
    actualEventsPerMinute: bbqAnalysis.eventsPerMinute,
    signalQuality: bbqAnalysis.signalQuality ?? "poor",
    snrDb: bbqAnalysis.snrDb ?? 0,
    passed: bbqAnalysis.motilityIndex === 0,
    failureReason: bbqAnalysis.motilityIndex !== 0
      ? `Expected VRS=0, got ${bbqAnalysis.motilityIndex}`
      : undefined,
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // STRESS TEST 2: Kitchen Cooking
  // Expected: VRS = 0 (metallic transients and hum rejected)
  // ══════════════════════════════════════════════════════════════════════════════
  const kitchenSamples = generateKitchenNoise(durationSeconds, sampleRate);
  const kitchenAnalysis = analyzeAudioSamples(kitchenSamples, durationSeconds, sampleRate);

  results.push({
    scenario: "KITCHEN_COOKING",
    description: "Kitchen with pots, running water, and exhaust fan",
    expectedVRS: 0,
    actualMotilityIndex: kitchenAnalysis.motilityIndex,
    actualEventsPerMinute: kitchenAnalysis.eventsPerMinute,
    signalQuality: kitchenAnalysis.signalQuality ?? "poor",
    snrDb: kitchenAnalysis.snrDb ?? 0,
    passed: kitchenAnalysis.motilityIndex === 0,
    failureReason: kitchenAnalysis.motilityIndex !== 0
      ? `Expected VRS=0, got ${kitchenAnalysis.motilityIndex}`
      : undefined,
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // STRESS TEST 3: Office/Clinic
  // Expected: VRS = 0 (HVAC hum and keyboard transients rejected)
  // ══════════════════════════════════════════════════════════════════════════════
  const officeSamples = generateOfficeNoise(durationSeconds, sampleRate);
  const officeAnalysis = analyzeAudioSamples(officeSamples, durationSeconds, sampleRate);

  results.push({
    scenario: "OFFICE_CLINIC",
    description: "Office/clinic with HVAC hum and keyboard typing",
    expectedVRS: 0,
    actualMotilityIndex: officeAnalysis.motilityIndex,
    actualEventsPerMinute: officeAnalysis.eventsPerMinute,
    signalQuality: officeAnalysis.signalQuality ?? "poor",
    snrDb: officeAnalysis.snrDb ?? 0,
    passed: officeAnalysis.motilityIndex === 0,
    failureReason: officeAnalysis.motilityIndex !== 0
      ? `Expected VRS=0, got ${officeAnalysis.motilityIndex}`
      : undefined,
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // CONTROL: Valid Gut Sounds in Quiet Environment
  // Expected: VRS > 0 (gut sounds detected)
  // ══════════════════════════════════════════════════════════════════════════════
  const gutSamples = generateGutSound(durationSeconds, sampleRate, 10);
  const gutAnalysis = analyzeAudioSamples(gutSamples, durationSeconds, sampleRate);

  results.push({
    scenario: "VALID_GUT_SOUNDS_QUIET",
    description: "Valid gut sounds in quiet environment (control)",
    expectedVRS: ">0",
    actualMotilityIndex: gutAnalysis.motilityIndex,
    actualEventsPerMinute: gutAnalysis.eventsPerMinute,
    signalQuality: gutAnalysis.signalQuality ?? "good",
    snrDb: gutAnalysis.snrDb ?? 0,
    passed: gutAnalysis.motilityIndex > 0 || gutAnalysis.eventsPerMinute > 0,
    failureReason: (gutAnalysis.motilityIndex === 0 && gutAnalysis.eventsPerMinute === 0)
      ? "Expected VRS>0, got 0"
      : undefined,
  });

  return results;
}

/**
 * Export analyzeWindowSpectrum for external testing (NG-HARDEN-03)
 */
export { analyzeWindowSpectrum };