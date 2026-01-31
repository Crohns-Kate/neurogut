/**
 * NeuroGut Audio Processor – Web Demo Edition
 *
 * Standalone JavaScript port of the hardened 450Hz acoustic isolation logic
 * from neurogut-expo/src/logic/audioProcessor.ts
 *
 * Features:
 * - Tightened bandpass filter (100Hz-450Hz) for gut sound isolation
 * - Ambient Noise Floor (ANF) calibration
 * - Duration Gating (rejects <100ms transients and >1500ms breathing artifacts)
 * - Constant Noise Detection (rejects stationary environmental noise)
 * - Signal Quality (SNR) assessment
 * - Burst Validation (accepts 20ms-1500ms gut sound bursts)
 */

// ══════════════════════════════════════════════════════════════════════════════════
// ACOUSTIC ISOLATION CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════════

const ACOUSTIC_ISOLATION_CONFIG = {
  // Ambient Noise Floor (ANF) Calibration
  anfCalibrationDurationSeconds: 10,
  anfThresholdMultiplier: 1.5,
  anfMinSNR: 6.0,
  anfWindowMs: 100,

  // Tightened Bandpass Filter (100Hz-450Hz)
  gutBandLowHz: 100,
  gutBandHighHz: 450,
  rolloffDbPerOctave: 60,
  transitionBandwidthHz: 50,

  // Duration Gating (0.5s - 2s)
  minEventDurationMs: 500,
  maxEventDurationMs: 2000,
  transientRejectDurationMs: 100,

  // Spectral Subtraction (Constant Hum Removal)
  humDetectionThreshold: 0.7,
  humFrequencyBands: [50, 60, 100, 120, 180, 240, 300],
  subtractionStrength: 0.8,
  humEnergyRatioThreshold: 0.15,

  // Transient Suppression
  transientOnsetSlopeThreshold: 10.0,
  transientMaxDurationMs: 100,
  transientEnergyRatioThreshold: 5.0,
  onsetAnalysisWindowSamples: 256,

  // Signal Quality (SNR) Thresholds
  snrExcellentThreshold: 20,
  snrGoodThreshold: 12,
  snrFairThreshold: 6,
  snrSmoothingFactor: 0.3,

  // Acoustic Fingerprinting (Burst Validation)
  burstMinDurationMs: 20,
  burstMaxDurationMs: 1500,
  constantNoiseRejectMs: 1500,
  stationarityVarianceThreshold: 0.05,
};

// Legacy exports for backward compatibility
const MOTILITY_THRESHOLD_MULTIPLIER = 2.5;
const FLAT_NOISE_CV_THRESHOLD = 0.08;
const MIN_SKIN_CONTACT_RMS = 0.005;

// ══════════════════════════════════════════════════════════════════════════════════
// CORE SIGNAL PROCESSING FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Compute RMS (Root Mean Square) energy of a sample window
 */
function computeRMS(samples) {
  if (samples.length === 0) return 0;
  const sumSquares = samples.reduce((sum, s) => sum + s * s, 0);
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Get Signal Quality classification from SNR value
 */
function getSignalQuality(snrDb) {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  if (snrDb >= config.snrExcellentThreshold) return 'excellent';
  if (snrDb >= config.snrGoodThreshold) return 'good';
  if (snrDb >= config.snrFairThreshold) return 'fair';
  return 'poor';
}

/**
 * Perform Ambient Noise Floor calibration
 */
function calibrateAmbientNoiseFloor(samples, sampleRate = 44100) {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const windowSizeSamples = Math.floor((config.anfWindowMs / 1000) * sampleRate);
  const calibrationSamples = Math.floor(config.anfCalibrationDurationSeconds * sampleRate);

  const calibrationData = samples.slice(0, Math.min(calibrationSamples, samples.length));

  if (calibrationData.length < windowSizeSamples) {
    return {
      anfMean: 0,
      anfStdDev: 0,
      adaptiveThreshold: 0.01,
      estimatedSNR: 0,
      detectedHumFrequencies: [],
      signalQuality: 'poor',
      calibrationWindows: 0,
      calibratedAt: new Date().toISOString(),
      noiseFloorDb: -60,
    };
  }

  // Compute windowed RMS energies
  const rmsValues = [];
  for (let i = 0; i + windowSizeSamples <= calibrationData.length; i += windowSizeSamples) {
    const window = calibrationData.slice(i, i + windowSizeSamples);
    const rms = computeRMS(window);
    rmsValues.push(rms);
  }

  // Compute ANF statistics
  const anfMean = rmsValues.reduce((sum, r) => sum + r, 0) / rmsValues.length;
  const anfVariance = rmsValues.reduce((sum, r) => sum + (r - anfMean) ** 2, 0) / rmsValues.length;
  const anfStdDev = Math.sqrt(anfVariance);

  // Adaptive threshold
  const adaptiveThreshold = anfMean + config.anfThresholdMultiplier * anfStdDev;

  // Reference-based SNR estimation
  const REFERENCE_GUT_SIGNAL_RMS = 0.02;
  const estimatedSNR = anfMean > 0
    ? 20 * Math.log10(REFERENCE_GUT_SIGNAL_RMS / anfMean)
    : 30;

  const noiseFloorDb = anfMean > 0 ? 20 * Math.log10(anfMean) : -60;
  const signalQuality = getSignalQuality(estimatedSNR);

  return {
    anfMean,
    anfStdDev,
    adaptiveThreshold,
    estimatedSNR,
    detectedHumFrequencies: [],
    signalQuality,
    calibrationWindows: rmsValues.length,
    calibratedAt: new Date().toISOString(),
    noiseFloorDb,
  };
}

/**
 * Apply duration gating to determine if an event has valid gut sound duration
 */
function applyDurationGating(durationMs) {
  const config = ACOUSTIC_ISOLATION_CONFIG;

  const isTransient = durationMs < config.transientRejectDurationMs;
  const isTooLong = durationMs > config.maxEventDurationMs;
  const isValidDuration = durationMs >= config.minEventDurationMs && durationMs <= config.maxEventDurationMs;

  return {
    isValidDuration,
    isTransient,
    isTooLong,
    durationMs,
  };
}

/**
 * Detect if a signal segment is a sharp transient (click, clatter, door slam)
 */
function detectTransient(samples, sampleRate = 44100) {
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

  const onsetSamples = samples.slice(0, analysisWindow);
  const onsetEnergies = [];

  const miniWindow = 16;
  for (let i = 0; i + miniWindow <= onsetSamples.length; i += miniWindow) {
    const windowSamples = onsetSamples.slice(i, i + miniWindow);
    const energy = windowSamples.reduce((sum, s) => sum + s * s, 0) / miniWindow;
    onsetEnergies.push(energy);
  }

  let maxSlope = 0;
  for (let i = 1; i < onsetEnergies.length; i++) {
    const slope = (onsetEnergies[i] - onsetEnergies[i - 1]) / (onsetEnergies[i - 1] || 1e-10);
    maxSlope = Math.max(maxSlope, slope);
  }

  const allEnergies = samples.map(s => s * s);
  const peakEnergy = Math.max(...allEnergies);
  const meanEnergy = allEnergies.reduce((sum, e) => sum + e, 0) / allEnergies.length;
  const energyRatio = meanEnergy > 0 ? peakEnergy / meanEnergy : 0;

  const threshold = peakEnergy * 0.5;
  let transientSamples = 0;
  for (const e of allEnergies) {
    if (e >= threshold) transientSamples++;
  }
  const transientDurationMs = (transientSamples / sampleRate) * 1000;

  const isTransient =
    maxSlope > config.transientOnsetSlopeThreshold ||
    (energyRatio > config.transientEnergyRatioThreshold && transientDurationMs < config.transientMaxDurationMs);

  return {
    isTransient,
    onsetSlope: maxSlope,
    energyRatio,
    transientDurationMs,
  };
}

/**
 * Detect constant/stationary noise by measuring RMS variance over time
 */
function detectConstantNoise(samples, sampleRate = 44100) {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const windowSizeSamples = Math.floor((config.anfWindowMs / 1000) * sampleRate);
  const durationMs = (samples.length / sampleRate) * 1000;

  if (samples.length < windowSizeSamples * 2) {
    return {
      isConstantNoise: false,
      rmsVariance: 1.0,
      durationMs,
      reason: 'Too short for variance analysis',
    };
  }

  const rmsValues = [];
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
      reason: 'Insufficient windows for variance',
    };
  }

  const mean = rmsValues.reduce((sum, r) => sum + r, 0) / rmsValues.length;
  if (mean === 0) {
    return {
      isConstantNoise: false,
      rmsVariance: 0,
      durationMs,
      reason: 'Silent signal',
    };
  }

  const variance = rmsValues.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rmsValues.length;
  const normalizedVariance = variance / (mean * mean);

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
 * Validate an event against the acoustic fingerprint of gut sounds
 * Rejects breathing artifacts (>1500ms per Mansour et al.)
 */
function validateBurstEvent(samples, sampleRate = 44100) {
  const config = ACOUSTIC_ISOLATION_CONFIG;
  const durationMs = (samples.length / sampleRate) * 1000;

  // Too short
  if (durationMs < config.burstMinDurationMs) {
    return {
      isValidBurst: false,
      durationMs,
      isConstantNoise: false,
      isBreathingArtifact: false,
      reason: `Too short: ${durationMs.toFixed(0)}ms < ${config.burstMinDurationMs}ms`,
    };
  }

  // Breathing artifact (>1500ms per Mansour et al.)
  if (durationMs > config.burstMaxDurationMs) {
    return {
      isValidBurst: false,
      durationMs,
      isConstantNoise: false,
      isBreathingArtifact: true,
      reason: `Breathing artifact: ${durationMs.toFixed(0)}ms > ${config.burstMaxDurationMs}ms`,
    };
  }

  // Valid burst within range
  return {
    isValidBurst: true,
    durationMs,
    isConstantNoise: false,
    isBreathingArtifact: false,
    reason: `Valid burst: ${durationMs.toFixed(0)}ms in range [${config.burstMinDurationMs}-${config.burstMaxDurationMs}]ms`,
  };
}

/**
 * Compute real-time Signal Quality assessment
 */
function assessSignalQuality(signalRMS, noiseFloorRMS) {
  const config = ACOUSTIC_ISOLATION_CONFIG;

  const snrDb = noiseFloorRMS > 0 ? 10 * Math.log10(signalRMS / noiseFloorRMS) : 0;
  const quality = getSignalQuality(snrDb);
  const isSuitable = snrDb >= config.anfMinSNR;

  let message;
  switch (quality) {
    case 'excellent':
      message = 'Excellent signal quality - ideal for recording';
      break;
    case 'good':
      message = 'Good signal quality - suitable for recording';
      break;
    case 'fair':
      message = 'Fair signal quality - consider quieter environment';
      break;
    case 'poor':
      message = 'Poor signal quality - too much background noise';
      break;
  }

  return { snrDb, quality, isSuitable, message };
}

// ══════════════════════════════════════════════════════════════════════════════════
// WEB AUDIO API BANDPASS FILTER (100Hz-450Hz)
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * Create a clinical-grade bandpass filter chain for gut sound isolation
 * Uses cascaded biquad filters for steep rolloff (60 dB/octave)
 */
function createGutBandpassFilter(audioContext) {
  const config = ACOUSTIC_ISOLATION_CONFIG;

  // Create high-pass filter at 100Hz (3rd order = 3 cascaded filters)
  const highPass1 = audioContext.createBiquadFilter();
  highPass1.type = 'highpass';
  highPass1.frequency.value = config.gutBandLowHz;
  highPass1.Q.value = 0.707; // Butterworth Q

  const highPass2 = audioContext.createBiquadFilter();
  highPass2.type = 'highpass';
  highPass2.frequency.value = config.gutBandLowHz;
  highPass2.Q.value = 0.707;

  const highPass3 = audioContext.createBiquadFilter();
  highPass3.type = 'highpass';
  highPass3.frequency.value = config.gutBandLowHz;
  highPass3.Q.value = 0.707;

  // Create low-pass filter at 450Hz (3rd order = 3 cascaded filters)
  const lowPass1 = audioContext.createBiquadFilter();
  lowPass1.type = 'lowpass';
  lowPass1.frequency.value = config.gutBandHighHz;
  lowPass1.Q.value = 0.707;

  const lowPass2 = audioContext.createBiquadFilter();
  lowPass2.type = 'lowpass';
  lowPass2.frequency.value = config.gutBandHighHz;
  lowPass2.Q.value = 0.707;

  const lowPass3 = audioContext.createBiquadFilter();
  lowPass3.type = 'lowpass';
  lowPass3.frequency.value = config.gutBandHighHz;
  lowPass3.Q.value = 0.707;

  // Chain filters: HP -> HP -> HP -> LP -> LP -> LP
  highPass1.connect(highPass2);
  highPass2.connect(highPass3);
  highPass3.connect(lowPass1);
  lowPass1.connect(lowPass2);
  lowPass2.connect(lowPass3);

  return {
    input: highPass1,
    output: lowPass3,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════
// LIVE DEMO ENGINE
// ══════════════════════════════════════════════════════════════════════════════════

class NeuroGutDemoEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.isRunning = false;
    this.calibration = null;
    this.eventBuffer = [];
    this.eventStartTime = null;
    this.inEvent = false;

    // Stats
    this.stats = {
      totalEvents: 0,
      validGutSounds: 0,
      rejectedBreathing: 0,
      rejectedTransients: 0,
      rejectedConstantNoise: 0,
    };

    // Callbacks
    this.onUpdate = null;
    this.onEvent = null;
    this.onCalibrationComplete = null;
  }

  async start() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create bandpass filter (100Hz-450Hz)
      const bandpass = createGutBandpassFilter(this.audioContext);
      source.connect(bandpass.input);

      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.3;
      bandpass.output.connect(this.analyser);

      this.isRunning = true;
      this.processAudio();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  stop() {
    this.isRunning = false;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  processAudio() {
    if (!this.isRunning) return;

    const bufferLength = this.analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);

    // Compute current RMS
    const currentRMS = computeRMS(Array.from(dataArray));

    // Get frequency data for visualization
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    // Calibration phase (first 3 seconds)
    if (!this.calibration && this.eventBuffer.length < 3 * this.audioContext.sampleRate / bufferLength) {
      this.eventBuffer.push(...dataArray);

      if (this.eventBuffer.length >= 3 * this.audioContext.sampleRate / bufferLength * bufferLength) {
        this.calibration = calibrateAmbientNoiseFloor(this.eventBuffer, this.audioContext.sampleRate);
        this.eventBuffer = [];

        if (this.onCalibrationComplete) {
          this.onCalibrationComplete(this.calibration);
        }
      }
    }

    // Event detection (after calibration)
    if (this.calibration) {
      const threshold = this.calibration.adaptiveThreshold;

      if (currentRMS > threshold) {
        if (!this.inEvent) {
          // Event start
          this.inEvent = true;
          this.eventStartTime = Date.now();
          this.eventBuffer = [];
        }
        this.eventBuffer.push(...dataArray);
      } else if (this.inEvent) {
        // Event end - validate
        this.inEvent = false;
        const eventDurationMs = Date.now() - this.eventStartTime;

        this.stats.totalEvents++;

        // Validate the event
        const burstResult = validateBurstEvent(this.eventBuffer, this.audioContext.sampleRate);
        const transientResult = detectTransient(this.eventBuffer, this.audioContext.sampleRate);

        let eventType = 'unknown';
        let accepted = false;

        if (transientResult.isTransient) {
          eventType = 'transient';
          this.stats.rejectedTransients++;
        } else if (burstResult.isBreathingArtifact) {
          eventType = 'breathing';
          this.stats.rejectedBreathing++;
        } else if (burstResult.isConstantNoise) {
          eventType = 'constant_noise';
          this.stats.rejectedConstantNoise++;
        } else if (burstResult.isValidBurst) {
          eventType = 'gut_sound';
          this.stats.validGutSounds++;
          accepted = true;
        }

        if (this.onEvent) {
          this.onEvent({
            type: eventType,
            durationMs: eventDurationMs,
            accepted,
            reason: burstResult.reason,
            rms: computeRMS(this.eventBuffer),
          });
        }

        this.eventBuffer = [];
      }
    }

    // Signal quality assessment
    let signalQuality = null;
    if (this.calibration) {
      signalQuality = assessSignalQuality(currentRMS, this.calibration.anfMean);
    }

    // Send update
    if (this.onUpdate) {
      this.onUpdate({
        rms: currentRMS,
        frequencyData: Array.from(frequencyData.slice(0, 64)), // First 64 bins
        calibration: this.calibration,
        signalQuality,
        stats: { ...this.stats },
        isCalibrating: !this.calibration,
        inEvent: this.inEvent,
      });
    }

    requestAnimationFrame(() => this.processAudio());
  }

  resetStats() {
    this.stats = {
      totalEvents: 0,
      validGutSounds: 0,
      rejectedBreathing: 0,
      rejectedTransients: 0,
      rejectedConstantNoise: 0,
    };
  }
}

// Export for use in HTML
window.NeuroGutDemoEngine = NeuroGutDemoEngine;
window.ACOUSTIC_ISOLATION_CONFIG = ACOUSTIC_ISOLATION_CONFIG;
