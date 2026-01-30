/**
 * Breath Rejection Unit Tests
 *
 * Verifies >90% rejection of simulated breathing sounds per Mansour et al. PLOS One Jan 2026:
 * - Breathing artifacts: >1500ms duration
 * - Burst validation correctly identifies breathing vs gut sounds
 * - High acceptance rate for valid gut sounds (20-1500ms)
 */

import {
  validateBurstEvent,
  ACOUSTIC_ISOLATION_CONFIG,
} from '../logic/audioProcessor';
import {
  generateBreathNoise,
  generateGutSound,
} from '../filters/butterworthFilter';

describe('Breath Rejection - Duration Gating', () => {
  const SAMPLE_RATE = 44100;

  test('should reject breathing artifact at 2000ms', () => {
    const samples = generateBreathNoise(SAMPLE_RATE, 2000);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(false);
    expect(result.isBreathingArtifact).toBe(true);
    expect(result.durationMs).toBeCloseTo(2000, -1);
  });

  test('should reject breathing artifact at 1600ms', () => {
    const samples = generateBreathNoise(SAMPLE_RATE, 1600);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(false);
    expect(result.isBreathingArtifact).toBe(true);
  });

  test('should reject breathing artifact at 3000ms', () => {
    const samples = generateBreathNoise(SAMPLE_RATE, 3000);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(false);
    expect(result.isBreathingArtifact).toBe(true);
  });

  test('should accept gut sound at 500ms', () => {
    const samples = generateGutSound(SAMPLE_RATE, 500);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(true);
    expect(result.isBreathingArtifact).toBe(false);
  });

  test('should accept gut sound at 100ms', () => {
    const samples = generateGutSound(SAMPLE_RATE, 100);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(true);
    expect(result.isBreathingArtifact).toBe(false);
  });

  test('should accept gut sound at 1400ms (just under threshold)', () => {
    const samples = generateGutSound(SAMPLE_RATE, 1400);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(true);
    expect(result.isBreathingArtifact).toBe(false);
  });

  test('should reject very short events (<20ms)', () => {
    const samples = generateGutSound(SAMPLE_RATE, 15);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(false);
    expect(result.isBreathingArtifact).toBe(false);
    expect(result.reason).toContain('Too short');
  });

  test('should accept minimum valid duration (20ms)', () => {
    const samples = generateGutSound(SAMPLE_RATE, 20);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(true);
  });

  test('should accept maximum valid duration (1500ms)', () => {
    const samples = generateGutSound(SAMPLE_RATE, 1500);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(true);
    expect(result.isBreathingArtifact).toBe(false);
  });
});

describe('Breath Rejection - 90% Target', () => {
  const SAMPLE_RATE = 44100;
  const NUM_TRIALS = 100;

  test('should reject >90% of simulated breathing sounds', () => {
    let rejectedCount = 0;

    // Generate breathing sounds with varying durations (1600-4000ms)
    for (let i = 0; i < NUM_TRIALS; i++) {
      const durationMs = 1600 + Math.random() * 2400; // 1600-4000ms
      const samples = generateBreathNoise(SAMPLE_RATE, durationMs);
      const result = validateBurstEvent(samples, SAMPLE_RATE);

      if (!result.isValidBurst && result.isBreathingArtifact) {
        rejectedCount++;
      }
    }

    const rejectionRate = rejectedCount / NUM_TRIALS;
    console.log(`Breathing rejection rate: ${(rejectionRate * 100).toFixed(1)}%`);

    expect(rejectionRate).toBeGreaterThanOrEqual(0.9);
  });

  test('should accept >80% of simulated gut sounds', () => {
    let acceptedCount = 0;

    // Generate gut sounds with varying durations (50-1400ms)
    for (let i = 0; i < NUM_TRIALS; i++) {
      const durationMs = 50 + Math.random() * 1350; // 50-1400ms
      const samples = generateGutSound(SAMPLE_RATE, durationMs);
      const result = validateBurstEvent(samples, SAMPLE_RATE);

      if (result.isValidBurst) {
        acceptedCount++;
      }
    }

    const acceptanceRate = acceptedCount / NUM_TRIALS;
    console.log(`Gut sound acceptance rate: ${(acceptanceRate * 100).toFixed(1)}%`);

    expect(acceptanceRate).toBeGreaterThanOrEqual(0.8);
  });
});

describe('Configuration Verification', () => {
  test('burst duration config matches Mansour et al. spec', () => {
    expect(ACOUSTIC_ISOLATION_CONFIG.burstMinDurationMs).toBe(20);
    expect(ACOUSTIC_ISOLATION_CONFIG.burstMaxDurationMs).toBe(1500);
    expect(ACOUSTIC_ISOLATION_CONFIG.constantNoiseRejectMs).toBe(1500);
  });

  test('filter config matches clinical-grade spec (100-450Hz)', () => {
    expect(ACOUSTIC_ISOLATION_CONFIG.gutBandLowHz).toBe(100);
    // Tightened from 1500Hz to 450Hz for clinical-grade gut sound isolation
    expect(ACOUSTIC_ISOLATION_CONFIG.gutBandHighHz).toBe(450);
    expect(ACOUSTIC_ISOLATION_CONFIG.rolloffDbPerOctave).toBe(60);
  });
});

describe('Edge Cases', () => {
  const SAMPLE_RATE = 44100;

  test('should handle exactly 1500ms (boundary)', () => {
    const samples = generateGutSound(SAMPLE_RATE, 1500);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    // 1500ms is the max valid duration, should be accepted
    expect(result.isValidBurst).toBe(true);
  });

  test('should handle 1501ms (just over boundary)', () => {
    // Generate slightly over 1500ms
    const numSamples = Math.ceil((1501 / 1000) * SAMPLE_RATE);
    const samples = new Array(numSamples).fill(0.1);
    const result = validateBurstEvent(samples, SAMPLE_RATE);

    expect(result.isValidBurst).toBe(false);
    expect(result.isBreathingArtifact).toBe(true);
  });

  test('should handle empty array', () => {
    const result = validateBurstEvent([], SAMPLE_RATE);

    expect(result.isValidBurst).toBe(false);
    expect(result.durationMs).toBe(0);
  });

  test('should correctly categorize reason for rejection', () => {
    // Too short
    const shortSamples = generateGutSound(SAMPLE_RATE, 10);
    const shortResult = validateBurstEvent(shortSamples, SAMPLE_RATE);
    expect(shortResult.reason).toContain('Too short');

    // Breathing artifact
    const longSamples = generateBreathNoise(SAMPLE_RATE, 2000);
    const longResult = validateBurstEvent(longSamples, SAMPLE_RATE);
    expect(longResult.reason).toContain('Breathing artifact');
  });
});
