/**
 * Butterworth Filter Implementation
 *
 * Third-order Butterworth bandpass filter (100Hz-450Hz @ 44100Hz)
 * Based on Mansour et al. PLOS One Jan 2026 clinical findings.
 *
 * Features:
 * - Cascaded biquad sections for numerical stability
 * - Zero-phase filtering (forward-backward) for no phase distortion
 * - 60 dB/octave rolloff (third-order)
 *
 * Clinical context:
 * - 100Hz lower cutoff: Captures borborygmi and peristaltic sounds
 * - 450Hz upper cutoff: Clinical-grade gut sound isolation (tightened from 1500Hz)
 * - Breathing artifacts typically >1500ms are rejected by burst validation
 */

/**
 * Biquad filter coefficients (second-order section)
 * Transfer function: H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
 */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * Complete Butterworth filter specification
 */
export interface ButterworthFilter {
  /** Cascaded biquad sections */
  sections: BiquadCoefficients[];
  /** Sample rate used for design */
  sampleRate: number;
  /** Lower cutoff frequency (Hz) */
  lowHz: number;
  /** Upper cutoff frequency (Hz) */
  highHz: number;
  /** Filter order */
  order: number;
}

/**
 * Design a second-order Butterworth bandpass biquad section
 *
 * @param fc - Center frequency (Hz)
 * @param bw - Bandwidth (Hz)
 * @param sampleRate - Sample rate (Hz)
 * @returns BiquadCoefficients for one section
 */
function designBandpassBiquad(fc: number, bw: number, sampleRate: number): BiquadCoefficients {
  const omega = (2 * Math.PI * fc) / sampleRate;
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const alpha = sinOmega * Math.sinh((Math.LN2 / 2) * (bw / fc) * (omega / sinOmega));

  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosOmega;
  const a2 = 1 - alpha;

  // Normalize by a0
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * Design a second-order Butterworth highpass biquad section
 *
 * @param fc - Cutoff frequency (Hz)
 * @param q - Quality factor
 * @param sampleRate - Sample rate (Hz)
 * @returns BiquadCoefficients
 */
function designHighpassBiquad(fc: number, q: number, sampleRate: number): BiquadCoefficients {
  const omega = (2 * Math.PI * fc) / sampleRate;
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const alpha = sinOmega / (2 * q);

  const b0 = (1 + cosOmega) / 2;
  const b1 = -(1 + cosOmega);
  const b2 = (1 + cosOmega) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosOmega;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * Design a second-order Butterworth lowpass biquad section
 *
 * @param fc - Cutoff frequency (Hz)
 * @param q - Quality factor
 * @param sampleRate - Sample rate (Hz)
 * @returns BiquadCoefficients
 */
function designLowpassBiquad(fc: number, q: number, sampleRate: number): BiquadCoefficients {
  const omega = (2 * Math.PI * fc) / sampleRate;
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const alpha = sinOmega / (2 * q);

  const b0 = (1 - cosOmega) / 2;
  const b1 = 1 - cosOmega;
  const b2 = (1 - cosOmega) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosOmega;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

/**
 * Design a Butterworth bandpass filter
 *
 * Creates cascaded lowpass + highpass sections for numerical stability.
 * Each section is second-order (biquad).
 *
 * @param lowHz - Lower cutoff frequency (Hz)
 * @param highHz - Upper cutoff frequency (Hz)
 * @param order - Filter order (1, 2, or 3 recommended)
 * @param sampleRate - Sample rate (Hz)
 * @returns ButterworthFilter with biquad sections
 */
export function designButterworthBandpass(
  lowHz: number,
  highHz: number,
  order: number,
  sampleRate: number
): ButterworthFilter {
  const nyquist = sampleRate / 2;

  // Validate frequencies
  if (lowHz <= 0 || lowHz >= nyquist || highHz <= 0 || highHz >= nyquist) {
    throw new Error(`Invalid frequencies: ${lowHz}-${highHz}Hz for ${sampleRate}Hz sample rate`);
  }
  if (lowHz >= highHz) {
    throw new Error(`Low frequency must be less than high frequency`);
  }

  const sections: BiquadCoefficients[] = [];

  // For a bandpass, cascade highpass and lowpass filters
  // Each "order" adds one HP and one LP biquad section

  // Q values for Butterworth cascaded sections
  const qValues: number[][] = [
    [0.7071], // Order 1: single section with Q = 1/sqrt(2)
    [0.7071, 0.7071], // Order 2: two sections
    [0.5, 1.0, 0.5], // Order 3: three sections with specific Q values
  ];

  const qs = order <= 3 ? qValues[order - 1] : new Array(order).fill(0.7071);

  // Add highpass sections for low cutoff
  for (let i = 0; i < order; i++) {
    const q = qs[i] || 0.7071;
    sections.push(designHighpassBiquad(lowHz, q, sampleRate));
  }

  // Add lowpass sections for high cutoff
  for (let i = 0; i < order; i++) {
    const q = qs[i] || 0.7071;
    sections.push(designLowpassBiquad(highHz, q, sampleRate));
  }

  return {
    sections,
    sampleRate,
    lowHz,
    highHz,
    order,
  };
}

/**
 * Generate a sinusoid for testing
 */
function generateSinusoid(frequency: number, sampleRate: number, numSamples: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    samples.push(Math.sin((2 * Math.PI * frequency * i) / sampleRate));
  }
  return samples;
}

/**
 * Apply a single biquad section to samples
 *
 * Uses Direct Form II transposed for numerical stability.
 *
 * @param samples - Input samples
 * @param coeffs - Biquad coefficients
 * @returns Filtered samples
 */
export function applyBiquadSection(
  samples: number[],
  coeffs: BiquadCoefficients
): number[] {
  if (samples.length === 0) return [];

  const { b0, b1, b2, a1, a2 } = coeffs;
  const output: number[] = new Array(samples.length);

  // Direct Form II Transposed state
  let w1 = 0;
  let w2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + w1;
    w1 = b1 * x - a1 * y + w2;
    w2 = b2 * x - a2 * y;
    output[i] = y;
  }

  return output;
}

/**
 * Apply the complete Butterworth bandpass filter
 *
 * Cascades all biquad sections in sequence.
 *
 * @param samples - Input samples
 * @param filter - Butterworth filter specification
 * @returns Filtered samples
 */
export function applyButterworthBandpass(
  samples: number[],
  filter: ButterworthFilter
): number[] {
  if (samples.length === 0) return [];

  let result = samples;
  for (const section of filter.sections) {
    result = applyBiquadSection(result, section);
  }

  return result;
}

/**
 * Apply zero-phase (forward-backward) filtering
 *
 * Filters the signal forward, then reverses and filters again.
 * This eliminates phase distortion but doubles the filter order.
 *
 * Clinical benefit: Preserves exact timing of gut sound events
 * for accurate burst duration measurement.
 *
 * @param samples - Input samples
 * @param filter - Butterworth filter specification
 * @returns Zero-phase filtered samples
 */
export function applyZeroPhaseFilter(
  samples: number[],
  filter: ButterworthFilter
): number[] {
  if (samples.length === 0) return [];

  // Forward pass
  let result = applyButterworthBandpass(samples, filter);

  // Reverse
  result = result.reverse();

  // Backward pass
  result = applyButterworthBandpass(result, filter);

  // Reverse back to original order
  result = result.reverse();

  return result;
}

/**
 * Pre-computed filter for 100-1500Hz @ 44100Hz
 * Third-order Butterworth for 60 dB/octave rolloff
 */
let cachedFilter: ButterworthFilter | null = null;

/**
 * Get the default clinical-grade Butterworth filter
 *
 * Returns a cached filter instance for efficiency.
 * Parameters per Mansour et al. PLOS One Jan 2026:
 * - 100Hz lower cutoff
 * - 450Hz upper cutoff (tightened for clinical-grade gut sound isolation)
 * - 3rd order (60 dB/octave)
 * - 44100Hz sample rate
 *
 * @param sampleRate - Sample rate (default 44100)
 * @returns Cached ButterworthFilter instance
 */
export function getClinicalButterworthFilter(
  sampleRate: number = 44100
): ButterworthFilter {
  if (cachedFilter && cachedFilter.sampleRate === sampleRate) {
    return cachedFilter;
  }

  cachedFilter = designButterworthBandpass(100, 450, 3, sampleRate);
  return cachedFilter;
}

/**
 * Measure filter attenuation at a specific frequency
 *
 * Useful for verifying filter response meets clinical requirements:
 * - Passband (100-450Hz): <3dB loss
 * - Stopband (<100Hz, >450Hz): significant attenuation
 *
 * @param filter - Butterworth filter
 * @param frequencyHz - Test frequency
 * @returns Attenuation in dB (negative = attenuation, 0 = unity gain)
 */
export function measureFilterAttenuation(
  filter: ButterworthFilter,
  frequencyHz: number
): number {
  const testDuration = 0.1; // 100ms test signal
  const numSamples = Math.floor(testDuration * filter.sampleRate);

  // Generate test sinusoid
  const testSignal = generateSinusoid(frequencyHz, filter.sampleRate, numSamples);

  // Apply filter
  const filtered = applyButterworthBandpass(testSignal, filter);

  // Skip transient (first 50% of samples)
  const skipSamples = Math.floor(numSamples * 0.5);
  const inputSlice = testSignal.slice(skipSamples);
  const outputSlice = filtered.slice(skipSamples);

  // Calculate RMS
  const inputRms = Math.sqrt(inputSlice.reduce((sum, s) => sum + s * s, 0) / inputSlice.length);
  const outputRms = Math.sqrt(outputSlice.reduce((sum, s) => sum + s * s, 0) / outputSlice.length);

  // Convert to dB
  if (inputRms === 0 || outputRms === 0) return -Infinity;
  return 20 * Math.log10(outputRms / inputRms);
}

/**
 * Generate simulated breathing noise for testing
 *
 * Breathing characteristics (per Mansour et al.):
 * - Low frequency emphasis (50-200Hz)
 * - Duration: 600-3000ms (longer than gut sounds)
 * - Gradual onset/offset (envelope)
 *
 * @param sampleRate - Sample rate
 * @param durationMs - Duration in milliseconds
 * @returns Simulated breathing noise samples
 */
export function generateBreathNoise(
  sampleRate: number,
  durationMs: number
): number[] {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples: number[] = new Array(numSamples);

  // Breathing is low-frequency noise with envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;

    // Envelope: gradual onset and offset
    const envelope = Math.sin(Math.PI * progress);

    // Low-frequency components (50-200Hz)
    let sample = 0;
    sample += 0.4 * Math.sin(2 * Math.PI * 80 * t + Math.random() * 0.1);
    sample += 0.3 * Math.sin(2 * Math.PI * 120 * t + Math.random() * 0.1);
    sample += 0.2 * Math.sin(2 * Math.PI * 160 * t + Math.random() * 0.1);

    // Add some noise
    sample += 0.1 * (Math.random() * 2 - 1);

    samples[i] = sample * envelope * 0.5;
  }

  return samples;
}

/**
 * Generate simulated gut sound for testing
 *
 * Gut sound characteristics (per Mansour et al.):
 * - Peak frequency around 200Hz
 * - Duration: 20-1500ms
 * - Sharp onset, gradual decay
 *
 * @param sampleRate - Sample rate
 * @param durationMs - Duration in milliseconds
 * @param peakFrequency - Peak frequency (default 200Hz)
 * @returns Simulated gut sound samples
 */
export function generateGutSound(
  sampleRate: number,
  durationMs: number,
  peakFrequency: number = 200
): number[] {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples: number[] = new Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;

    // Envelope: sharp onset, gradual decay (exponential)
    const envelope = Math.exp(-3 * progress) * (1 - Math.exp(-50 * progress));

    // Frequency-modulated tone around peak frequency
    const freqMod = 1 + 0.2 * Math.sin(2 * Math.PI * 5 * t);
    let sample = 0;
    sample += 0.6 * Math.sin(2 * Math.PI * peakFrequency * freqMod * t);
    sample += 0.3 * Math.sin(2 * Math.PI * (peakFrequency * 1.5) * t);
    sample += 0.1 * Math.sin(2 * Math.PI * (peakFrequency * 0.5) * t);

    // Add harmonic content
    sample += 0.15 * Math.sin(2 * Math.PI * (peakFrequency * 2) * t);

    samples[i] = sample * envelope * 0.7;
  }

  return samples;
}
