/**
 * Heart Rate Analytics Unit Tests
 *
 * Tests heart rate extraction from simulated abdominal audio:
 * - Peak detection in 20-80Hz band
 * - BPM calculation from inter-beat intervals
 * - RMSSD and vagal tone score calculation
 */

import {
  analyzeHeartRate,
  checkHeartSignalPresence,
  getHeartBandFilter,
  HEART_CONFIG,
} from '../analytics/heartAnalytics';
import { applyZeroPhaseFilter } from '../filters/butterworthFilter';

const SAMPLE_RATE = 44100;

/**
 * Generate simulated heart sounds at a specific BPM
 */
function generateHeartbeatSignal(
  sampleRate: number,
  durationSeconds: number,
  bpm: number,
  addNoise: boolean = true
): number[] {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  const intervalMs = 60000 / bpm;
  const intervalSamples = Math.floor((intervalMs / 1000) * sampleRate);

  // Heart sound frequency ~40Hz with harmonics
  const heartFreq = 40;

  // Generate heartbeat pulses
  let nextBeatSample = Math.floor(sampleRate * 0.5); // Start 0.5s in

  while (nextBeatSample < numSamples - sampleRate * 0.1) {
    // Each heartbeat is ~100ms pulse
    const pulseDuration = Math.floor(0.1 * sampleRate);

    for (let i = 0; i < pulseDuration && nextBeatSample + i < numSamples; i++) {
      const t = i / sampleRate;
      // Envelope: sharp attack, quick decay
      const envelope = Math.exp(-30 * t) * (1 - Math.exp(-100 * t));
      // Heart sound ~40Hz with some harmonics
      let sample = 0.5 * Math.sin(2 * Math.PI * heartFreq * t);
      sample += 0.3 * Math.sin(2 * Math.PI * heartFreq * 2 * t);
      sample += 0.1 * Math.sin(2 * Math.PI * 60 * t);
      samples[nextBeatSample + i] = sample * envelope;
    }

    // Add slight HRV variation (±5%)
    const variation = 1 + (Math.random() - 0.5) * 0.1;
    nextBeatSample += Math.floor(intervalSamples * variation);
  }

  // Add noise if requested
  if (addNoise) {
    for (let i = 0; i < numSamples; i++) {
      samples[i] += (Math.random() - 0.5) * 0.02;
    }
  }

  return samples;
}

describe('Heart Band Filter', () => {
  test('should create filter for 20-80Hz', () => {
    const filter = getHeartBandFilter(SAMPLE_RATE);

    expect(filter.lowHz).toBe(20);
    expect(filter.highHz).toBe(80);
    expect(filter.order).toBe(3);
    expect(filter.sampleRate).toBe(SAMPLE_RATE);
  });

  test('should pass 40Hz signal (heart sound frequency)', () => {
    const filter = getHeartBandFilter(SAMPLE_RATE);

    // Generate 40Hz test signal
    const duration = 0.5;
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const testSignal: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      testSignal.push(Math.sin(2 * Math.PI * 40 * i / SAMPLE_RATE));
    }

    const filtered = applyZeroPhaseFilter(testSignal, filter);

    // Calculate RMS of filtered signal (skip transient)
    const skipSamples = Math.floor(numSamples * 0.3);
    const slice = filtered.slice(skipSamples);
    const rms = Math.sqrt(slice.reduce((sum, s) => sum + s * s, 0) / slice.length);

    // Should retain most energy at 40Hz (within passband)
    expect(rms).toBeGreaterThan(0.3);
  });

  test('should attenuate 200Hz signal (gut sound frequency)', () => {
    const filter = getHeartBandFilter(SAMPLE_RATE);

    // Generate 200Hz test signal
    const duration = 0.5;
    const numSamples = Math.floor(duration * SAMPLE_RATE);
    const testSignal: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      testSignal.push(Math.sin(2 * Math.PI * 200 * i / SAMPLE_RATE));
    }

    const filtered = applyZeroPhaseFilter(testSignal, filter);

    // Calculate RMS of filtered signal
    const skipSamples = Math.floor(numSamples * 0.3);
    const slice = filtered.slice(skipSamples);
    const rms = Math.sqrt(slice.reduce((sum, s) => sum + s * s, 0) / slice.length);

    // Should heavily attenuate 200Hz (well above passband)
    expect(rms).toBeLessThan(0.1);
  });
});

describe('Heart Rate Detection', () => {
  test('should detect 60 BPM heart rate', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 30, 60);
    const result = analyzeHeartRate(signal, 30, SAMPLE_RATE);

    console.log('60 BPM test:', result);

    // Should detect approximately 60 BPM (±10%)
    expect(result.bpm).toBeGreaterThanOrEqual(54);
    expect(result.bpm).toBeLessThanOrEqual(66);
    expect(result.beatCount).toBeGreaterThanOrEqual(25);
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  test('should detect 75 BPM heart rate', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 30, 75);
    const result = analyzeHeartRate(signal, 30, SAMPLE_RATE);

    console.log('75 BPM test:', result);

    // Should detect approximately 75 BPM (±10%)
    expect(result.bpm).toBeGreaterThanOrEqual(67);
    expect(result.bpm).toBeLessThanOrEqual(83);
    expect(result.beatCount).toBeGreaterThanOrEqual(30);
  });

  test('should detect 100 BPM heart rate', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 30, 100);
    const result = analyzeHeartRate(signal, 30, SAMPLE_RATE);

    console.log('100 BPM test:', result);

    // Should detect approximately 100 BPM (±10%)
    expect(result.bpm).toBeGreaterThanOrEqual(90);
    expect(result.bpm).toBeLessThanOrEqual(110);
    expect(result.beatCount).toBeGreaterThanOrEqual(45);
  });

  test('should reject empty audio', () => {
    const result = analyzeHeartRate([], 0, SAMPLE_RATE);

    expect(result.bpm).toBe(0);
    expect(result.beatCount).toBe(0);
    expect(result.confidence).toBe(0);
  });

  test('should reject very short audio', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 2, 75);
    const result = analyzeHeartRate(signal, 2, SAMPLE_RATE);

    // 2 seconds is too short for reliable heart rate
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe('HRV Calculation', () => {
  test('should calculate RMSSD for 30-second recording', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 30, 75);
    const result = analyzeHeartRate(signal, 30, SAMPLE_RATE);

    console.log('HRV test:', result);

    // Should have enough beats for HRV
    expect(result.hrvValid).toBe(true);
    expect(result.rmssd).toBeGreaterThan(0);
    expect(result.vagalToneScore).toBeGreaterThanOrEqual(0);
    expect(result.vagalToneScore).toBeLessThanOrEqual(100);
  });

  test('should not calculate HRV for short recording', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 10, 75);
    const result = analyzeHeartRate(signal, 10, SAMPLE_RATE);

    // 10 seconds at 75 BPM = ~12 beats, not enough for valid HRV
    // But our threshold is 20 beats
    if (result.beatCount < HEART_CONFIG.minBeatsForValidHRV) {
      expect(result.hrvValid).toBe(false);
    }
  });
});

describe('Signal Presence Check', () => {
  test('should detect heart signal presence in valid recording', () => {
    const signal = generateHeartbeatSignal(SAMPLE_RATE, 10, 75);
    const result = checkHeartSignalPresence(signal, SAMPLE_RATE);

    expect(result.hasSignal).toBe(true);
    expect(result.signalStrength).toBeGreaterThan(0);
  });

  test('should detect no heart signal in silence', () => {
    const silence = new Array(SAMPLE_RATE * 5).fill(0);
    const result = checkHeartSignalPresence(silence, SAMPLE_RATE);

    expect(result.signalStrength).toBe(0);
  });

  test('should detect no heart signal in high-frequency noise', () => {
    // Generate 500Hz noise (well above heart band)
    const numSamples = SAMPLE_RATE * 5;
    const highFreqNoise: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      highFreqNoise.push(Math.sin(2 * Math.PI * 500 * i / SAMPLE_RATE) * 0.5);
    }

    const result = checkHeartSignalPresence(highFreqNoise, SAMPLE_RATE);

    // Very little energy should be in heart band
    expect(result.signalStrength).toBeLessThan(0.1);
  });
});

describe('Configuration Validation', () => {
  test('heart config should have valid frequency range', () => {
    expect(HEART_CONFIG.lowHz).toBe(20);
    expect(HEART_CONFIG.highHz).toBe(80);
    expect(HEART_CONFIG.lowHz).toBeLessThan(HEART_CONFIG.highHz);
  });

  test('heart config should have valid BPM range', () => {
    expect(HEART_CONFIG.minBPM).toBe(40);
    expect(HEART_CONFIG.maxBPM).toBe(150);
    expect(HEART_CONFIG.minBPM).toBeLessThan(HEART_CONFIG.maxBPM);
  });

  test('peak distance should match BPM range', () => {
    // Min distance (400ms) should give max BPM of 150
    const maxBpmFromMinDistance = 60000 / HEART_CONFIG.minPeakDistanceMs;
    expect(maxBpmFromMinDistance).toBe(150);

    // Max distance (1500ms) should give min BPM of 40
    const minBpmFromMaxDistance = 60000 / HEART_CONFIG.maxPeakDistanceMs;
    expect(minBpmFromMaxDistance).toBe(40);
  });
});
