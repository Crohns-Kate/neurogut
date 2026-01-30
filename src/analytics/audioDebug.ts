/**
 * NeuroGut Audio Debug & Validation Module
 *
 * Provides detailed diagnostic output for real-world validation testing.
 * Shows exactly why each event was accepted or rejected.
 *
 * Usage:
 *   import { analyzeWithDebug } from './audioDebug';
 *   const result = analyzeWithDebug(samples, duration, sampleRate);
 *   console.log(result.debugLog);
 */

import {
  MOTILITY_THRESHOLD_MULTIPLIER,
  MIN_SKIN_CONTACT_RMS,
  ACOUSTIC_ISOLATION_CONFIG,
  calibrateAmbientNoiseFloor,
  applySpectralSubtraction,
  detectTransient,
  validateBurstEvent,
  type ANFCalibrationResult,
  type SignalQuality,
} from "../logic/audioProcessor";
import {
  getClinicalButterworthFilter,
  applyZeroPhaseFilter,
} from "../filters/butterworthFilter";

// ══════════════════════════════════════════════════════════════════════════════════
// DEBUG TYPES
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Detailed rejection reason for an event
 */
export interface EventRejectionReason {
  filter: string;
  reason: string;
  values: Record<string, number | string | boolean>;
  threshold?: string;
}

/**
 * Debug info for a single detected event
 */
export interface EventDebugInfo {
  eventId: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  peakEnergy: number;

  // Analysis results
  accepted: boolean;
  rejectionReasons: EventRejectionReason[];

  // Individual filter results
  spectralAnalysis: {
    sfm: number;
    bowelPeakRatio: number;
    zcr: number;
    spectralContrast: number;
    isWhiteNoise: boolean;
    isLikelyGutSound: boolean;
  } | null;

  harmonicAnalysis: {
    isHarmonic: boolean;
    fundamentalHz: number | null;
    harmonicCount: number;
    hnrDb: number;
    speechConfidence: number;
    shouldReject: boolean;
  } | null;

  breathAnalysis: {
    isBreathArtifact: boolean;
    onsetRatio: number;
    lowFreqEmphasis: number;
    breathConfidence: number;
  } | null;

  burstValidation: {
    isValidBurst: boolean;
    isConstantNoise: boolean;
    isBreathingArtifact: boolean;
    reason: string;
  } | null;

  transientAnalysis: {
    isTransient: boolean;
    onsetSlope: number;
    energyRatio: number;
    transientDurationMs: number;
  } | null;
}

/**
 * Contact quality debug info
 */
export interface ContactDebugInfo {
  isOnBody: boolean;
  lowFreqRatio: number;
  highFreqRatio: number;
  spectralRolloff: number;
  contactConfidence: number;
  shouldRejectAsInAir: boolean;
  spectralCriteria: {
    isLowFreqDominant: boolean;
    isHighFreqSuppressed: boolean;
    isLowRolloff: boolean;
    spectralCriteriaMet: number;
  };
  temporalCriteria: {
    coefficientOfVariation: number;
    hasTemporalVariability: boolean;
    burstPeakCount: number;
    hasBurstPeaks: boolean;
    energyVarianceRatio: number;
    hasEnergyVariance: boolean;
    temporalCriteriaMet: number;
  };
}

/**
 * Full debug result from analysis
 */
export interface DebugAnalysisResult {
  // Standard analytics
  eventsPerMinute: number;
  totalActiveSeconds: number;
  totalQuietSeconds: number;
  motilityIndex: number;

  // Debug info
  debugLog: string[];
  eventDetails: EventDebugInfo[];

  // Pre-analysis checks
  anfCalibration: {
    anfMean: number;
    anfStdDev: number;
    estimatedSNR: number;
    signalQuality: SignalQuality;
    detectedHumFrequencies: number[];
  };

  contactQuality: ContactDebugInfo;

  psychoacousticGating: {
    shouldGate: boolean;
    gatingReason: string | null;
    isStationary: boolean;
    entropyVariance: number;
    isRhythmic: boolean;
    detectedPeriodMs: number | null;
  };

  // Summary stats
  summary: {
    totalEventsDetected: number;
    eventsAccepted: number;
    eventsRejected: number;
    rejectionsByFilter: Record<string, number>;
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (copied from audioAnalytics to avoid circular deps)
// ══════════════════════════════════════════════════════════════════════════════════

function computeRMS(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sumSquares = samples.reduce((sum, s) => sum + s * s, 0);
  return Math.sqrt(sumSquares / samples.length);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

// Simple FFT for spectral analysis
function computeFFT(samples: number[]): Array<{ real: number; imag: number }> {
  const N = samples.length;
  if (N <= 1) return samples.map((s) => ({ real: s, imag: 0 }));
  if ((N & (N - 1)) !== 0) {
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = [...samples, ...new Array(nextPow2 - N).fill(0)];
    return computeFFT(padded);
  }

  const even: number[] = [];
  const odd: number[] = [];
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) even.push(samples[i]);
    else odd.push(samples[i]);
  }

  const evenFFT = computeFFT(even);
  const oddFFT = computeFFT(odd);
  const result: Array<{ real: number; imag: number }> = new Array(N);

  for (let k = 0; k < N / 2; k++) {
    const angle = (-2 * Math.PI * k) / N;
    const tReal = Math.cos(angle) * oddFFT[k].real - Math.sin(angle) * oddFFT[k].imag;
    const tImag = Math.cos(angle) * oddFFT[k].imag + Math.sin(angle) * oddFFT[k].real;
    result[k] = { real: evenFFT[k].real + tReal, imag: evenFFT[k].imag + tImag };
    result[k + N / 2] = { real: evenFFT[k].real - tReal, imag: evenFFT[k].imag - tImag };
  }
  return result;
}

function computeMagnitudeSpectrum(fftResult: Array<{ real: number; imag: number }>): number[] {
  return fftResult.slice(0, fftResult.length / 2).map(
    (c) => Math.sqrt(c.real * c.real + c.imag * c.imag)
  );
}

// ══════════════════════════════════════════════════════════════════════════════════
// DEBUG CONFIG (matches audioAnalytics CONFIG)
// ══════════════════════════════════════════════════════════════════════════════════

const DEBUG_CONFIG = {
  windowSizeMs: 100,
  sampleRate: 44100,
  fftWindowSize: 2048,

  // Spectral thresholds (tightened)
  sfmWhiteNoiseThreshold: 0.55,
  sfmAutoRejectThreshold: 0.75,
  bowelPeakMinRatio: 0.40,
  bowelPeakLowHz: 100,
  bowelPeakHighHz: 450,
  zcrMaxForGutSound: 0.22,
  zcrAutoRejectThreshold: 0.35,
  spectralContrastMinForGutSound: 0.3,

  // Harmonic detection
  minHarmonicsForSpeech: 3,
  harmonicTolerance: 0.05,
  hnrSpeechThreshold: 8.0,
  speechF0MinHz: 80,
  speechF0MaxHz: 400,

  // Contact detection
  skinContactLowFreqRatio: 0.45,
  maxHighFreqRatioOnBody: 0.15,
  maxSpectralRolloffOnBody: 350,

  // Breath detection
  breathVetoMinMsExtended: 400,
  breathVetoMaxMsExtended: 3000,
  breathOnsetRatioThreshold: 0.3,
  breathLowFreqEmphasisHz: 200,
  breathLowFreqRatio: 0.6,

  // Duration gating
  minValidEventDurationMs: 10,
  maxValidEventDurationMs: 1500,
  transientRejectDurationMs: 10,
  sustainedNoiseRejectDurationMs: 2000,
};

// ══════════════════════════════════════════════════════════════════════════════════
// SPECTRAL ANALYSIS WITH DEBUG
// ══════════════════════════════════════════════════════════════════════════════════

function analyzeSpectralDebug(
  samples: number[],
  sampleRate: number
): EventDebugInfo["spectralAnalysis"] {
  const fftSize = DEBUG_CONFIG.fftWindowSize;
  if (samples.length < fftSize / 4) return null;

  let paddedSamples: number[];
  if (samples.length >= fftSize) {
    paddedSamples = samples.slice(0, fftSize);
  } else {
    paddedSamples = [...samples, ...new Array(fftSize - samples.length).fill(0)];
  }

  const windowed = paddedSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  );

  const fftResult = computeFFT(windowed);
  const magnitudes = computeMagnitudeSpectrum(fftResult);
  const freqPerBin = sampleRate / fftSize;

  // SFM
  const nonZero = magnitudes.filter((m) => m > 1e-10);
  const logSum = nonZero.reduce((sum, m) => sum + Math.log(m), 0);
  const geometricMean = nonZero.length > 0 ? Math.exp(logSum / nonZero.length) : 0;
  const arithmeticMean = nonZero.length > 0 ? nonZero.reduce((s, m) => s + m, 0) / nonZero.length : 0;
  const sfm = arithmeticMean > 0 ? Math.max(0, Math.min(1, geometricMean / arithmeticMean)) : 0;

  // Bowel peak ratio
  const lowBin = Math.floor(DEBUG_CONFIG.bowelPeakLowHz / freqPerBin);
  const highBin = Math.ceil(DEBUG_CONFIG.bowelPeakHighHz / freqPerBin);
  let bowelEnergy = 0, totalEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const energy = magnitudes[i] * magnitudes[i];
    totalEnergy += energy;
    if (i >= lowBin && i <= highBin) bowelEnergy += energy;
  }
  const bowelPeakRatio = totalEnergy > 0 ? bowelEnergy / totalEnergy : 0;

  // ZCR
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  const zcr = samples.length > 1 ? crossings / (samples.length - 1) : 0;

  // Spectral contrast
  const sorted = [...magnitudes].sort((a, b) => b - a);
  const peakCount = Math.max(1, Math.floor(magnitudes.length * 0.1));
  const valleyCount = Math.floor(magnitudes.length * 0.5);
  const peakEnergy = sorted.slice(0, peakCount).reduce((s, m) => s + m, 0) / peakCount;
  const valleyEnergy = sorted.slice(-valleyCount).reduce((s, m) => s + m, 0) / valleyCount;
  const spectralContrast = peakEnergy > 0 ? Math.max(0, Math.min(1, (peakEnergy - valleyEnergy) / peakEnergy)) : 0;

  // Classification
  const isWhiteNoise =
    sfm >= DEBUG_CONFIG.sfmAutoRejectThreshold ||
    (sfm >= DEBUG_CONFIG.sfmWhiteNoiseThreshold &&
      bowelPeakRatio < DEBUG_CONFIG.bowelPeakMinRatio &&
      zcr > DEBUG_CONFIG.zcrMaxForGutSound) ||
    zcr >= DEBUG_CONFIG.zcrAutoRejectThreshold;

  const isLikelyGutSound =
    !isWhiteNoise &&
    sfm < DEBUG_CONFIG.sfmWhiteNoiseThreshold &&
    bowelPeakRatio >= DEBUG_CONFIG.bowelPeakMinRatio &&
    zcr <= DEBUG_CONFIG.zcrMaxForGutSound &&
    spectralContrast >= DEBUG_CONFIG.spectralContrastMinForGutSound;

  return { sfm, bowelPeakRatio, zcr, spectralContrast, isWhiteNoise, isLikelyGutSound };
}

// ══════════════════════════════════════════════════════════════════════════════════
// HARMONIC ANALYSIS WITH DEBUG
// ══════════════════════════════════════════════════════════════════════════════════

function analyzeHarmonicDebug(
  samples: number[],
  sampleRate: number
): EventDebugInfo["harmonicAnalysis"] {
  const fftSize = DEBUG_CONFIG.fftWindowSize;
  if (samples.length < fftSize) return null;

  const minLag = Math.floor(sampleRate / DEBUG_CONFIG.speechF0MaxHz);
  const maxLag = Math.floor(sampleRate / DEBUG_CONFIG.speechF0MinHz);

  const windowSamples = samples.slice(0, Math.min(fftSize, samples.length));
  const windowed = windowSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSamples.length - 1)))
  );

  const windowMean = windowed.reduce((s, x) => s + x, 0) / windowed.length;
  const centered = windowed.map((x) => x - windowMean);
  const energy = centered.reduce((s, x) => s + x * x, 0);

  if (energy < 1e-10) {
    return {
      isHarmonic: false, fundamentalHz: null, harmonicCount: 0,
      hnrDb: 0, speechConfidence: 0, shouldReject: false,
    };
  }

  // Find f0 via autocorrelation
  let bestLag = 0, bestCorr = 0;
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

  if (bestCorr < 0.3 || bestLag === 0) {
    return {
      isHarmonic: false, fundamentalHz: null, harmonicCount: 0,
      hnrDb: 0, speechConfidence: 0, shouldReject: false,
    };
  }

  const fundamentalHz = sampleRate / bestLag;

  // Check harmonics via FFT
  const fftResult = computeFFT(windowed);
  const magnitudes = computeMagnitudeSpectrum(fftResult);
  const freqPerBin = sampleRate / fftSize;
  const tolerance = Math.max(1, Math.round(fundamentalHz * DEBUG_CONFIG.harmonicTolerance / freqPerBin));

  let harmonicEnergy = 0, noiseEnergy = 0, harmonicCount = 0;
  const maxHarmonic = Math.min(8, Math.floor((sampleRate / 2) / fundamentalHz));

  for (let h = 1; h <= maxHarmonic; h++) {
    const expectedBin = Math.round(h * fundamentalHz / freqPerBin);
    const minBin = Math.max(0, expectedBin - tolerance);
    const maxBin = Math.min(magnitudes.length - 1, expectedBin + tolerance);

    let peakMag = 0;
    for (let bin = minBin; bin <= maxBin; bin++) {
      peakMag = Math.max(peakMag, magnitudes[bin]);
    }

    let localNoise = 0, noiseCount = 0;
    for (let bin = Math.max(0, minBin - 5); bin < minBin; bin++) {
      localNoise += magnitudes[bin]; noiseCount++;
    }
    for (let bin = maxBin + 1; bin <= Math.min(magnitudes.length - 1, maxBin + 5); bin++) {
      localNoise += magnitudes[bin]; noiseCount++;
    }
    localNoise = noiseCount > 0 ? localNoise / noiseCount : 0;

    if (peakMag > localNoise * 2) {
      harmonicCount++;
      harmonicEnergy += peakMag * peakMag;
    }
  }

  // Non-harmonic energy
  for (let bin = 0; bin < magnitudes.length; bin++) {
    const freq = bin * freqPerBin;
    let isHarmonicBin = false;
    for (let h = 1; h <= maxHarmonic; h++) {
      if (Math.abs(freq - h * fundamentalHz) < fundamentalHz * DEBUG_CONFIG.harmonicTolerance) {
        isHarmonicBin = true; break;
      }
    }
    if (!isHarmonicBin) noiseEnergy += magnitudes[bin] * magnitudes[bin];
  }

  const hnrDb = noiseEnergy > 0 ? 10 * Math.log10(harmonicEnergy / noiseEnergy) : 0;
  const isHarmonic = harmonicCount >= DEBUG_CONFIG.minHarmonicsForSpeech;
  const shouldReject = isHarmonic && hnrDb >= DEBUG_CONFIG.hnrSpeechThreshold;

  let speechConfidence = 0;
  if (isHarmonic) {
    speechConfidence = Math.min(1, (harmonicCount - 2) / 4);
    speechConfidence += Math.min(0.5, hnrDb / 20);
  }

  return { isHarmonic, fundamentalHz, harmonicCount, hnrDb, speechConfidence, shouldReject };
}

// ══════════════════════════════════════════════════════════════════════════════════
// BREATH ANALYSIS WITH DEBUG
// ══════════════════════════════════════════════════════════════════════════════════

interface BreathAnalysisResult {
  isBreathArtifact: boolean;
  onsetRatio: number;
  lowFreqEmphasis: number;
  breathConfidence: number;
}

function analyzeBreathDebug(
  samples: number[],
  sampleRate: number
): BreathAnalysisResult {
  const durationMs = (samples.length / sampleRate) * 1000;

  if (durationMs < DEBUG_CONFIG.breathVetoMinMsExtended ||
      durationMs > DEBUG_CONFIG.breathVetoMaxMsExtended) {
    return { isBreathArtifact: false, onsetRatio: 1, lowFreqEmphasis: 0, breathConfidence: 0 };
  }

  // Envelope analysis
  const windowSize = Math.floor((50 / 1000) * sampleRate);
  const envelopeValues: number[] = [];
  for (let i = 0; i + windowSize <= samples.length; i += windowSize / 2) {
    const window = samples.slice(i, i + windowSize);
    envelopeValues.push(computeRMS(window));
  }

  if (envelopeValues.length < 4) {
    return { isBreathArtifact: false, onsetRatio: 1, lowFreqEmphasis: 0, breathConfidence: 0 };
  }

  const peakEnergy = Math.max(...envelopeValues);
  const peakIndex = envelopeValues.indexOf(peakEnergy);
  const onsetEnd = Math.max(1, Math.floor(peakIndex * 0.2));
  const onsetEnergy = envelopeValues.slice(0, onsetEnd).reduce((s, e) => s + e, 0) / onsetEnd;
  const onsetRatio = peakEnergy > 0 ? onsetEnergy / peakEnergy : 1;

  // Low-frequency emphasis
  let lowFreqEmphasis = 0;
  const fftSize = Math.min(DEBUG_CONFIG.fftWindowSize, samples.length);
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
    const lowFreqBin = Math.floor(DEBUG_CONFIG.breathLowFreqEmphasisHz / freqPerBin);

    let lowEnergy = 0, totalEnergy = 0;
    for (let bin = 0; bin < magnitudes.length; bin++) {
      const energy = magnitudes[bin] * magnitudes[bin];
      totalEnergy += energy;
      if (bin < lowFreqBin) lowEnergy += energy;
    }
    lowFreqEmphasis = totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
  }

  const hasGradualOnset = onsetRatio < DEBUG_CONFIG.breathOnsetRatioThreshold;
  const hasLowFreqEmphasis = lowFreqEmphasis >= DEBUG_CONFIG.breathLowFreqRatio;

  let breathConfidence = 0;
  breathConfidence += 0.3; // In duration range
  if (hasGradualOnset) breathConfidence += 0.4;
  if (hasLowFreqEmphasis) breathConfidence += 0.3;

  return {
    isBreathArtifact: breathConfidence >= 0.6,
    onsetRatio,
    lowFreqEmphasis,
    breathConfidence,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// CONTACT QUALITY ANALYSIS WITH DEBUG (CRITICAL FIX)
// Now includes TEMPORAL variability checks to distinguish body from table/ambient
// ══════════════════════════════════════════════════════════════════════════════════

function analyzeContactDebug(
  samples: number[],
  sampleRate: number
): ContactDebugInfo {
  const fftSize = DEBUG_CONFIG.fftWindowSize;
  const windowSizeMs = 100;
  const windowSizeSamples = Math.floor((windowSizeMs / 1000) * sampleRate);

  const defaultTemporalCriteria = {
    coefficientOfVariation: 0,
    hasTemporalVariability: false,
    burstPeakCount: 0,
    hasBurstPeaks: false,
    energyVarianceRatio: 1,
    hasEnergyVariance: false,
    temporalCriteriaMet: 0,
  };

  if (samples.length < fftSize / 2) {
    return {
      isOnBody: false, lowFreqRatio: 0, highFreqRatio: 1,
      spectralRolloff: sampleRate / 2, contactConfidence: 0, shouldRejectAsInAir: true,
      spectralCriteria: { isLowFreqDominant: false, isHighFreqSuppressed: false, isLowRolloff: false, spectralCriteriaMet: 0 },
      temporalCriteria: defaultTemporalCriteria,
    };
  }

  // PART 1: SPECTRAL ANALYSIS
  const analysisSamples = samples.slice(0, Math.min(fftSize, samples.length));
  const windowed = analysisSamples.map(
    (s, i) => s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (analysisSamples.length - 1)))
  );

  let paddedSamples: number[];
  if (windowed.length < fftSize) {
    paddedSamples = [...windowed, ...new Array(fftSize - windowed.length).fill(0)];
  } else {
    paddedSamples = windowed;
  }

  const fftResult = computeFFT(paddedSamples);
  const magnitudes = computeMagnitudeSpectrum(fftResult);
  const freqPerBin = sampleRate / fftSize;

  const lowFreqBin = Math.floor(200 / freqPerBin);
  const highFreqBin = Math.floor(400 / freqPerBin);

  let lowFreqEnergy = 0, midFreqEnergy = 0, highFreqEnergy = 0, totalEnergy = 0;
  for (let bin = 0; bin < magnitudes.length; bin++) {
    const energy = magnitudes[bin] * magnitudes[bin];
    totalEnergy += energy;
    if (bin < lowFreqBin) lowFreqEnergy += energy;
    else if (bin < highFreqBin) midFreqEnergy += energy;
    else highFreqEnergy += energy;
  }

  const lowFreqRatio = totalEnergy > 0 ? lowFreqEnergy / totalEnergy : 0;
  const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 1;

  // Spectral rolloff (85th percentile)
  const targetEnergy = totalEnergy * 0.85;
  let cumulativeEnergy = 0, rolloffBin = magnitudes.length - 1;
  for (let bin = 0; bin < magnitudes.length; bin++) {
    cumulativeEnergy += magnitudes[bin] * magnitudes[bin];
    if (cumulativeEnergy >= targetEnergy) { rolloffBin = bin; break; }
  }
  const spectralRolloff = rolloffBin * freqPerBin;

  const isLowFreqDominant = lowFreqRatio >= DEBUG_CONFIG.skinContactLowFreqRatio;
  const isHighFreqSuppressed = highFreqRatio <= DEBUG_CONFIG.maxHighFreqRatioOnBody;
  const isLowRolloff = spectralRolloff <= DEBUG_CONFIG.maxSpectralRolloffOnBody;

  let spectralCriteriaMet = 0;
  if (isLowFreqDominant) spectralCriteriaMet++;
  if (isHighFreqSuppressed) spectralCriteriaMet++;
  if (isLowRolloff) spectralCriteriaMet++;

  // PART 2: TEMPORAL VARIABILITY ANALYSIS (CRITICAL!)
  const energyWindows: number[] = [];
  for (let i = 0; i + windowSizeSamples <= samples.length; i += windowSizeSamples) {
    const windowData = samples.slice(i, i + windowSizeSamples);
    const rms = Math.sqrt(windowData.reduce((sum, s) => sum + s * s, 0) / windowData.length);
    energyWindows.push(rms);
  }

  let coefficientOfVariation = 0;
  let hasTemporalVariability = false;
  let burstPeakCount = 0;
  let hasBurstPeaks = false;
  let energyVarianceRatio = 1;
  let hasEnergyVariance = false;
  let temporalCriteriaMet = 0;

  if (energyWindows.length >= 5) {
    const avgEnergy = energyWindows.reduce((s, e) => s + e, 0) / energyWindows.length;
    const energyStdDev = Math.sqrt(
      energyWindows.reduce((s, e) => s + (e - avgEnergy) ** 2, 0) / energyWindows.length
    );

    // CV check
    coefficientOfVariation = avgEnergy > 0 ? energyStdDev / avgEnergy : 0;
    hasTemporalVariability = coefficientOfVariation >= 0.12; // CONFIG.minCVForBodyContact

    // Burst peaks check
    const peakThreshold = avgEnergy * 2.0;
    for (const energy of energyWindows) {
      if (energy > peakThreshold) burstPeakCount++;
    }
    hasBurstPeaks = burstPeakCount >= 2;

    // Energy variance ratio check
    const minEnergy = Math.max(0.0001, Math.min(...energyWindows));
    const maxEnergy = Math.max(...energyWindows);
    energyVarianceRatio = maxEnergy / minEnergy;
    hasEnergyVariance = energyVarianceRatio >= 3.0;

    if (hasTemporalVariability) temporalCriteriaMet++;
    if (hasBurstPeaks) temporalCriteriaMet++;
    if (hasEnergyVariance) temporalCriteriaMet++;
  }

  // COMBINED CLASSIFICATION
  const passesSpectralCheck = spectralCriteriaMet >= 2;
  const passesTemporalCheck = temporalCriteriaMet >= 1;

  const isOnBody = passesSpectralCheck && passesTemporalCheck;
  const spectralConfidence = spectralCriteriaMet / 3;
  const temporalConfidence = temporalCriteriaMet / 3;
  const contactConfidence = (spectralConfidence + temporalConfidence) / 2;

  // CRITICAL: Reject if temporal check fails (signal is FLAT = table/ambient)
  const shouldRejectAsInAir = !passesTemporalCheck || spectralCriteriaMet === 0;

  return {
    isOnBody,
    lowFreqRatio,
    highFreqRatio,
    spectralRolloff,
    contactConfidence,
    shouldRejectAsInAir,
    spectralCriteria: { isLowFreqDominant, isHighFreqSuppressed, isLowRolloff, spectralCriteriaMet },
    temporalCriteria: {
      coefficientOfVariation,
      hasTemporalVariability,
      burstPeakCount,
      hasBurstPeaks,
      energyVarianceRatio,
      hasEnergyVariance,
      temporalCriteriaMet,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// MAIN DEBUG ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Analyze audio samples with comprehensive debug output
 *
 * This function provides detailed information about why each event
 * was accepted or rejected, useful for real-world validation testing.
 *
 * @param samples - Audio samples (normalized -1 to 1)
 * @param durationSeconds - Recording duration in seconds
 * @param sampleRate - Sample rate in Hz
 * @returns DebugAnalysisResult with detailed diagnostic info
 */
export function analyzeWithDebug(
  samples: number[],
  durationSeconds: number,
  sampleRate: number = DEBUG_CONFIG.sampleRate
): DebugAnalysisResult {
  const debugLog: string[] = [];
  const eventDetails: EventDebugInfo[] = [];
  const rejectionsByFilter: Record<string, number> = {};

  debugLog.push("═══════════════════════════════════════════════════════════════");
  debugLog.push("NEUROGUT DEBUG ANALYSIS - Real-World Validation");
  debugLog.push(`Duration: ${durationSeconds.toFixed(1)}s | Samples: ${samples.length} | Rate: ${sampleRate}Hz`);
  debugLog.push("═══════════════════════════════════════════════════════════════");

  // Step 1: ANF Calibration
  debugLog.push("\n[1] AMBIENT NOISE FLOOR CALIBRATION");
  const anfResult = calibrateAmbientNoiseFloor(samples, sampleRate);
  debugLog.push(`   ANF Mean: ${anfResult.anfMean.toFixed(6)}`);
  debugLog.push(`   ANF StdDev: ${anfResult.anfStdDev.toFixed(6)}`);
  debugLog.push(`   Estimated SNR: ${anfResult.estimatedSNR.toFixed(1)} dB`);
  debugLog.push(`   Signal Quality: ${anfResult.signalQuality.toUpperCase()}`);
  if (anfResult.detectedHumFrequencies.length > 0) {
    debugLog.push(`   Detected Hums: ${anfResult.detectedHumFrequencies.join(", ")}Hz`);
  }

  // Step 2: Apply filters
  debugLog.push("\n[2] APPLYING BUTTERWORTH BANDPASS (100-450Hz)");
  let filteredSamples = samples;
  if (anfResult.detectedHumFrequencies.length > 0) {
    filteredSamples = applySpectralSubtraction(samples, anfResult.detectedHumFrequencies, sampleRate);
    debugLog.push(`   Applied spectral subtraction for ${anfResult.detectedHumFrequencies.length} hum(s)`);
  }
  const filter = getClinicalButterworthFilter(sampleRate);
  filteredSamples = applyZeroPhaseFilter(filteredSamples, filter);
  debugLog.push(`   Filter applied: ${filter.lowHz}-${filter.highHz}Hz, order ${filter.order}`);

  // Step 3: Contact quality
  debugLog.push("\n[3] CONTACT QUALITY ANALYSIS (NG-HARDEN-07 CRITICAL FIX)");
  const contactQuality = analyzeContactDebug(filteredSamples, sampleRate);

  debugLog.push("   --- SPECTRAL CRITERIA ---");
  debugLog.push(`   Low-freq ratio (<200Hz): ${(contactQuality.lowFreqRatio * 100).toFixed(1)}% (need ≥${DEBUG_CONFIG.skinContactLowFreqRatio * 100}%) ${contactQuality.spectralCriteria.isLowFreqDominant ? "✓" : "✗"}`);
  debugLog.push(`   High-freq ratio (>400Hz): ${(contactQuality.highFreqRatio * 100).toFixed(1)}% (need ≤${DEBUG_CONFIG.maxHighFreqRatioOnBody * 100}%) ${contactQuality.spectralCriteria.isHighFreqSuppressed ? "✓" : "✗"}`);
  debugLog.push(`   Spectral rolloff: ${contactQuality.spectralRolloff.toFixed(0)}Hz (need ≤${DEBUG_CONFIG.maxSpectralRolloffOnBody}Hz) ${contactQuality.spectralCriteria.isLowRolloff ? "✓" : "✗"}`);
  debugLog.push(`   Spectral criteria met: ${contactQuality.spectralCriteria.spectralCriteriaMet}/3 (need ≥2)`);

  debugLog.push("   --- TEMPORAL CRITERIA (CRITICAL!) ---");
  debugLog.push(`   Coefficient of Variation: ${(contactQuality.temporalCriteria.coefficientOfVariation * 100).toFixed(1)}% (need ≥12%) ${contactQuality.temporalCriteria.hasTemporalVariability ? "✓" : "✗"}`);
  debugLog.push(`   Burst peaks (>2x avg): ${contactQuality.temporalCriteria.burstPeakCount} (need ≥2) ${contactQuality.temporalCriteria.hasBurstPeaks ? "✓" : "✗"}`);
  debugLog.push(`   Energy variance ratio: ${contactQuality.temporalCriteria.energyVarianceRatio.toFixed(1)}x (need ≥3x) ${contactQuality.temporalCriteria.hasEnergyVariance ? "✓" : "✗"}`);
  debugLog.push(`   Temporal criteria met: ${contactQuality.temporalCriteria.temporalCriteriaMet}/3 (need ≥1)`);

  debugLog.push("   --- VERDICT ---");
  debugLog.push(`   Contact confidence: ${(contactQuality.contactConfidence * 100).toFixed(0)}%`);
  debugLog.push(`   → ${contactQuality.isOnBody ? "ON-BODY ✓" : contactQuality.shouldRejectAsInAir ? "IN-AIR/TABLE ✗ (REJECTED)" : "UNCERTAIN"}`);
  if (contactQuality.temporalCriteria.temporalCriteriaMet === 0) {
    debugLog.push(`   ⚠️  FLAT SIGNAL: No burst variability detected - likely table or constant ambient noise`);
  }

  if (contactQuality.shouldRejectAsInAir) {
    debugLog.push("\n⚠️  RECORDING REJECTED: Device appears to be in air, not on skin");
    return {
      eventsPerMinute: 0, totalActiveSeconds: 0, totalQuietSeconds: Math.round(durationSeconds),
      motilityIndex: 0, debugLog, eventDetails,
      anfCalibration: {
        anfMean: anfResult.anfMean, anfStdDev: anfResult.anfStdDev,
        estimatedSNR: anfResult.estimatedSNR, signalQuality: anfResult.signalQuality,
        detectedHumFrequencies: anfResult.detectedHumFrequencies,
      },
      contactQuality,
      psychoacousticGating: {
        shouldGate: true, gatingReason: "Contact quality failed", isStationary: false,
        entropyVariance: 0, isRhythmic: false, detectedPeriodMs: null,
      },
      summary: { totalEventsDetected: 0, eventsAccepted: 0, eventsRejected: 0, rejectionsByFilter },
    };
  }

  // Step 4: Energy windowing and event detection
  debugLog.push("\n[4] EVENT DETECTION");
  const windowSizeSamples = Math.floor((DEBUG_CONFIG.windowSizeMs / 1000) * sampleRate);
  const energyValues: number[] = [];
  for (let i = 0; i + windowSizeSamples <= filteredSamples.length; i += windowSizeSamples) {
    const window = filteredSamples.slice(i, i + windowSizeSamples);
    energyValues.push(computeRMS(window));
  }

  const avgEnergy = mean(energyValues);
  const energyStdDev = stdDev(energyValues);
  const threshold = avgEnergy + MOTILITY_THRESHOLD_MULTIPLIER * energyStdDev;
  debugLog.push(`   Windows: ${energyValues.length} | Avg energy: ${avgEnergy.toFixed(6)} | Threshold: ${threshold.toFixed(6)}`);

  // Detect raw events
  interface RawEvent { startWindow: number; endWindow: number; peakEnergy: number; }
  const rawEvents: RawEvent[] = [];
  let inEvent = false;
  let eventStart = 0;
  let peakEnergy = 0;

  for (let i = 0; i < energyValues.length; i++) {
    if (energyValues[i] > threshold) {
      if (!inEvent) { inEvent = true; eventStart = i; peakEnergy = energyValues[i]; }
      else { peakEnergy = Math.max(peakEnergy, energyValues[i]); }
    } else if (inEvent) {
      rawEvents.push({ startWindow: eventStart, endWindow: i - 1, peakEnergy });
      inEvent = false;
    }
  }
  if (inEvent) {
    rawEvents.push({ startWindow: eventStart, endWindow: energyValues.length - 1, peakEnergy });
  }

  debugLog.push(`   Raw events detected: ${rawEvents.length}`);

  // Step 5: Filter events with detailed logging
  debugLog.push("\n[5] EVENT FILTERING (with detailed rejection reasons)");
  let acceptedCount = 0;

  for (let i = 0; i < rawEvents.length; i++) {
    const event = rawEvents[i];
    const startMs = event.startWindow * DEBUG_CONFIG.windowSizeMs;
    const endMs = (event.endWindow + 1) * DEBUG_CONFIG.windowSizeMs;
    const durationMs = endMs - startMs;

    const startSample = event.startWindow * windowSizeSamples;
    const endSample = Math.min((event.endWindow + 1) * windowSizeSamples, filteredSamples.length);
    const eventSamples = filteredSamples.slice(startSample, endSample);

    const eventDebug: EventDebugInfo = {
      eventId: i + 1,
      startMs, endMs, durationMs,
      peakEnergy: event.peakEnergy,
      accepted: true,
      rejectionReasons: [],
      spectralAnalysis: null,
      harmonicAnalysis: null,
      breathAnalysis: null,
      burstValidation: null,
      transientAnalysis: null,
    };

    debugLog.push(`\n   ─── Event #${i + 1}: ${startMs.toFixed(0)}-${endMs.toFixed(0)}ms (${durationMs.toFixed(0)}ms) ───`);

    // Filter 1: Duration gating
    if (durationMs < DEBUG_CONFIG.minValidEventDurationMs) {
      eventDebug.accepted = false;
      eventDebug.rejectionReasons.push({
        filter: "DURATION_MIN",
        reason: `Too short: ${durationMs.toFixed(0)}ms < ${DEBUG_CONFIG.minValidEventDurationMs}ms`,
        values: { durationMs },
      });
      rejectionsByFilter["DURATION_MIN"] = (rejectionsByFilter["DURATION_MIN"] || 0) + 1;
    }
    if (durationMs > DEBUG_CONFIG.sustainedNoiseRejectDurationMs) {
      eventDebug.accepted = false;
      eventDebug.rejectionReasons.push({
        filter: "DURATION_MAX",
        reason: `Too long (sustained noise): ${durationMs.toFixed(0)}ms > ${DEBUG_CONFIG.sustainedNoiseRejectDurationMs}ms`,
        values: { durationMs },
      });
      rejectionsByFilter["DURATION_MAX"] = (rejectionsByFilter["DURATION_MAX"] || 0) + 1;
    }

    // Filter 2: Spectral analysis
    const spectral = analyzeSpectralDebug(eventSamples, sampleRate);
    eventDebug.spectralAnalysis = spectral;
    if (spectral) {
      if (spectral.isWhiteNoise) {
        eventDebug.accepted = false;
        eventDebug.rejectionReasons.push({
          filter: "SPECTRAL_WHITE_NOISE",
          reason: `White noise detected: SFM=${spectral.sfm.toFixed(3)}, ZCR=${spectral.zcr.toFixed(3)}`,
          values: { sfm: spectral.sfm, zcr: spectral.zcr, bowelPeakRatio: spectral.bowelPeakRatio },
          threshold: `SFM<${DEBUG_CONFIG.sfmWhiteNoiseThreshold}, ZCR<${DEBUG_CONFIG.zcrMaxForGutSound}`,
        });
        rejectionsByFilter["SPECTRAL_WHITE_NOISE"] = (rejectionsByFilter["SPECTRAL_WHITE_NOISE"] || 0) + 1;
      }
      debugLog.push(`      Spectral: SFM=${spectral.sfm.toFixed(3)} | BowelRatio=${(spectral.bowelPeakRatio * 100).toFixed(1)}% | ZCR=${spectral.zcr.toFixed(3)} | Contrast=${spectral.spectralContrast.toFixed(3)}`);
    }

    // Filter 3: Harmonic detection (speech/music)
    if (eventSamples.length >= sampleRate * 0.1) {
      const harmonic = analyzeHarmonicDebug(eventSamples, sampleRate);
      eventDebug.harmonicAnalysis = harmonic;
      if (harmonic) {
        if (harmonic.shouldReject) {
          eventDebug.accepted = false;
          eventDebug.rejectionReasons.push({
            filter: "HARMONIC_SPEECH",
            reason: `Speech/music detected: f0=${harmonic.fundamentalHz?.toFixed(0)}Hz, ${harmonic.harmonicCount} harmonics, HNR=${harmonic.hnrDb.toFixed(1)}dB`,
            values: {
              fundamentalHz: harmonic.fundamentalHz || 0,
              harmonicCount: harmonic.harmonicCount,
              hnrDb: harmonic.hnrDb,
            },
            threshold: `harmonics≥${DEBUG_CONFIG.minHarmonicsForSpeech}, HNR≥${DEBUG_CONFIG.hnrSpeechThreshold}dB`,
          });
          rejectionsByFilter["HARMONIC_SPEECH"] = (rejectionsByFilter["HARMONIC_SPEECH"] || 0) + 1;
        }
        debugLog.push(`      Harmonic: f0=${harmonic.fundamentalHz?.toFixed(0) || "N/A"}Hz | Harmonics=${harmonic.harmonicCount} | HNR=${harmonic.hnrDb.toFixed(1)}dB | Confidence=${(harmonic.speechConfidence * 100).toFixed(0)}%`);
      }
    }

    // Filter 4: Breath artifact detection
    const breath = analyzeBreathDebug(eventSamples, sampleRate);
    eventDebug.breathAnalysis = breath;
    if (breath.isBreathArtifact) {
      eventDebug.accepted = false;
      eventDebug.rejectionReasons.push({
        filter: "BREATH_ARTIFACT",
        reason: `Breath pattern: onset=${breath.onsetRatio.toFixed(2)}, lowFreq=${(breath.lowFreqEmphasis * 100).toFixed(0)}%`,
        values: {
          onsetRatio: breath.onsetRatio,
          lowFreqEmphasis: breath.lowFreqEmphasis,
          breathConfidence: breath.breathConfidence,
        },
        threshold: `onset<${DEBUG_CONFIG.breathOnsetRatioThreshold}, lowFreq≥${DEBUG_CONFIG.breathLowFreqRatio * 100}%`,
      });
      rejectionsByFilter["BREATH_ARTIFACT"] = (rejectionsByFilter["BREATH_ARTIFACT"] || 0) + 1;
    }
    debugLog.push(`      Breath: onset=${breath.onsetRatio.toFixed(2)} | lowFreq=${(breath.lowFreqEmphasis * 100).toFixed(0)}% | confidence=${(breath.breathConfidence * 100).toFixed(0)}%`);

    // Filter 5: Burst validation
    const burst = validateBurstEvent(eventSamples, sampleRate);
    eventDebug.burstValidation = {
      isValidBurst: burst.isValidBurst,
      isConstantNoise: burst.isConstantNoise,
      isBreathingArtifact: burst.isBreathingArtifact,
      reason: burst.reason,
    };
    if (!burst.isValidBurst) {
      eventDebug.accepted = false;
      eventDebug.rejectionReasons.push({
        filter: "BURST_VALIDATION",
        reason: burst.reason,
        values: { isConstantNoise: burst.isConstantNoise, isBreathingArtifact: burst.isBreathingArtifact },
      });
      rejectionsByFilter["BURST_VALIDATION"] = (rejectionsByFilter["BURST_VALIDATION"] || 0) + 1;
    }
    debugLog.push(`      Burst: ${burst.isValidBurst ? "VALID ✓" : "INVALID ✗"} - ${burst.reason}`);

    // Filter 6: Transient detection
    const transient = detectTransient(eventSamples, sampleRate);
    eventDebug.transientAnalysis = {
      isTransient: transient.isTransient,
      onsetSlope: transient.onsetSlope,
      energyRatio: transient.energyRatio,
      transientDurationMs: transient.transientDurationMs,
    };
    if (transient.isTransient) {
      eventDebug.accepted = false;
      eventDebug.rejectionReasons.push({
        filter: "TRANSIENT",
        reason: `Sharp transient: slope=${transient.onsetSlope.toFixed(2)}, energyRatio=${transient.energyRatio.toFixed(2)}`,
        values: {
          onsetSlope: transient.onsetSlope,
          energyRatio: transient.energyRatio,
          transientDurationMs: transient.transientDurationMs,
        },
      });
      rejectionsByFilter["TRANSIENT"] = (rejectionsByFilter["TRANSIENT"] || 0) + 1;
    }
    debugLog.push(`      Transient: slope=${transient.onsetSlope.toFixed(2)} | energyRatio=${transient.energyRatio.toFixed(2)} | ${transient.isTransient ? "REJECTED" : "OK"}`);

    // Final verdict
    if (eventDebug.accepted) {
      acceptedCount++;
      debugLog.push(`      → ACCEPTED ✓`);
    } else {
      debugLog.push(`      → REJECTED ✗ (${eventDebug.rejectionReasons.map(r => r.filter).join(", ")})`);
    }

    eventDetails.push(eventDebug);
  }

  // Step 6: Calculate final metrics
  debugLog.push("\n[6] FINAL METRICS");
  const durationMinutes = durationSeconds / 60;
  const eventsPerMinute = durationMinutes > 0 ? acceptedCount / durationMinutes : 0;

  let activeWindows = 0;
  for (const event of eventDetails) {
    if (event.accepted) {
      activeWindows += Math.ceil(event.durationMs / DEBUG_CONFIG.windowSizeMs);
    }
  }
  const totalActiveSeconds = activeWindows * (DEBUG_CONFIG.windowSizeMs / 1000);
  const totalQuietSeconds = Math.max(0, durationSeconds - totalActiveSeconds);
  const activeFraction = energyValues.length > 0 ? activeWindows / energyValues.length : 0;

  // Motility index
  const normalizedEPM = Math.min(100, Math.max(0, (eventsPerMinute / 20) * 100));
  const activenessScore = activeFraction * 100;
  let motilityIndex = Math.round(normalizedEPM * 0.7 + activenessScore * 0.3);
  if (anfResult.signalQuality === "fair") motilityIndex = Math.round(motilityIndex * 0.5);

  debugLog.push(`   Events accepted: ${acceptedCount} of ${rawEvents.length}`);
  debugLog.push(`   Events per minute: ${eventsPerMinute.toFixed(1)}`);
  debugLog.push(`   Active time: ${totalActiveSeconds.toFixed(1)}s`);
  debugLog.push(`   Motility Index: ${motilityIndex}`);

  debugLog.push("\n[7] REJECTION SUMMARY");
  for (const [filter, count] of Object.entries(rejectionsByFilter)) {
    debugLog.push(`   ${filter}: ${count} events`);
  }

  debugLog.push("\n═══════════════════════════════════════════════════════════════");
  debugLog.push("END DEBUG ANALYSIS");
  debugLog.push("═══════════════════════════════════════════════════════════════");

  return {
    eventsPerMinute: Math.round(eventsPerMinute * 10) / 10,
    totalActiveSeconds: Math.round(totalActiveSeconds),
    totalQuietSeconds: Math.round(totalQuietSeconds),
    motilityIndex,
    debugLog,
    eventDetails,
    anfCalibration: {
      anfMean: anfResult.anfMean,
      anfStdDev: anfResult.anfStdDev,
      estimatedSNR: anfResult.estimatedSNR,
      signalQuality: anfResult.signalQuality,
      detectedHumFrequencies: anfResult.detectedHumFrequencies,
    },
    contactQuality,
    psychoacousticGating: {
      shouldGate: false,
      gatingReason: null,
      isStationary: false,
      entropyVariance: 0,
      isRhythmic: false,
      detectedPeriodMs: null,
    },
    summary: {
      totalEventsDetected: rawEvents.length,
      eventsAccepted: acceptedCount,
      eventsRejected: rawEvents.length - acceptedCount,
      rejectionsByFilter,
    },
  };
}

/**
 * Format debug log for console output
 */
export function formatDebugLog(result: DebugAnalysisResult): string {
  return result.debugLog.join("\n");
}

/**
 * Get a concise summary of the analysis
 */
export function getDebugSummary(result: DebugAnalysisResult): string {
  const lines: string[] = [];
  lines.push(`Motility Index: ${result.motilityIndex}`);
  lines.push(`Events: ${result.summary.eventsAccepted}/${result.summary.totalEventsDetected} accepted`);
  lines.push(`Contact: ${result.contactQuality.isOnBody ? "ON-BODY" : "IN-AIR"} (${(result.contactQuality.contactConfidence * 100).toFixed(0)}%)`);
  lines.push(`SNR: ${result.anfCalibration.estimatedSNR.toFixed(1)}dB (${result.anfCalibration.signalQuality})`);

  if (Object.keys(result.summary.rejectionsByFilter).length > 0) {
    lines.push("Rejections:");
    for (const [filter, count] of Object.entries(result.summary.rejectionsByFilter)) {
      lines.push(`  ${filter}: ${count}`);
    }
  }

  return lines.join("\n");
}
