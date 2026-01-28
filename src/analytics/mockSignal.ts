/**
 * Mock Signal Generator for Audio Analytics Testing (NG-HARDEN-04)
 *
 * Generates synthetic audio signals for validation:
 * - White noise (constant air hiss) - MUST produce VRS = 0.0
 * - Mechanical noise (fan/AC) - MUST produce VRS = 0.0
 * - Breath noise - MUST produce VRS = 0.0
 * - Valid gut sounds - MUST produce VRS > 0
 *
 * This module is used to verify the psychoacoustic gating works correctly.
 * Run the verification before committing any changes to audioAnalytics.ts.
 */

import {
  analyzeAudioSamples,
  generateWhiteNoise,
  generateBreathNoise,
  generateGutSound,
  applyPsychoacousticGating,
  getConfig,
} from "./audioAnalytics";

const CONFIG = getConfig();

/**
 * Generate 30 seconds of pure white noise (constant air hiss)
 *
 * Characteristics:
 * - Flat spectrum (SFM ≈ 1.0)
 * - Stationary (no change over time)
 * - High ZCR (~0.4)
 *
 * @param sampleRate - Sample rate in Hz (default 44100)
 * @returns Float array of white noise samples
 */
export function generate30SecondWhiteNoise(sampleRate: number = 44100): number[] {
  return generateWhiteNoise(30, sampleRate, 0.3);
}

/**
 * Generate 30 seconds of mechanical noise (fan/AC simulation)
 *
 * Characteristics:
 * - Periodic pulses at known intervals (60Hz, 500ms)
 * - High autocorrelation
 *
 * @param sampleRate - Sample rate in Hz (default 44100)
 * @param periodMs - Period of pulses in milliseconds
 * @returns Float array of mechanical noise samples
 */
export function generate30SecondMechanicalNoise(
  sampleRate: number = 44100,
  periodMs: number = 16.67 // 60Hz
): number[] {
  const durationSeconds = 30;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const samples: number[] = new Array(numSamples).fill(0);

  const periodSamples = Math.floor((periodMs / 1000) * sampleRate);
  const freq = 1000 / periodMs; // Frequency in Hz

  // Generate periodic signal with some noise
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Primary tone at the periodic frequency
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.3;
    // Add harmonics
    const harmonic1 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.1;
    const harmonic2 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.05;
    // Add some background noise
    const noise = (Math.random() * 2 - 1) * 0.05;

    samples[i] = tone + harmonic1 + harmonic2 + noise;
  }

  return samples;
}

/**
 * Mock Signal Test Result
 */
export interface MockSignalTestResult {
  testName: string;
  description: string;
  durationSeconds: number;
  expectedVRS: number;
  actualMotilityIndex: number;
  actualEventsPerMinute: number;
  psychoacousticGating: {
    shouldGate: boolean;
    gatingReason: string | null;
    isStationary: boolean;
    isRhythmic: boolean;
    isMechanicalNoise: boolean;
  };
  passed: boolean;
  failureReason: string | null;
}

/**
 * Run verification test for white noise
 *
 * This is the critical test that MUST pass before committing:
 * 30 seconds of white noise MUST produce VRS = 0.0
 *
 * @returns Test result with pass/fail status
 */
export function verifyWhiteNoiseProducesZeroVRS(): MockSignalTestResult {
  const sampleRate = CONFIG.sampleRate;
  const samples = generate30SecondWhiteNoise(sampleRate);
  const durationSeconds = 30;

  // Analyze with full pipeline
  const analytics = analyzeAudioSamples(samples, durationSeconds, sampleRate);

  // Also get psychoacoustic gating details
  const gating = applyPsychoacousticGating(samples, sampleRate);

  const passed = analytics.motilityIndex === 0 && analytics.eventsPerMinute === 0;

  return {
    testName: "WHITE_NOISE_30S",
    description: "30 seconds of constant white noise (air hiss simulation)",
    durationSeconds,
    expectedVRS: 0,
    actualMotilityIndex: analytics.motilityIndex,
    actualEventsPerMinute: analytics.eventsPerMinute,
    psychoacousticGating: {
      shouldGate: gating.shouldGate,
      gatingReason: gating.gatingReason,
      isStationary: gating.temporalMasking.isStationary,
      isRhythmic: gating.rhythmicRejection.isRhythmic,
      isMechanicalNoise: gating.rhythmicRejection.isMechanicalNoise,
    },
    passed,
    failureReason: passed
      ? null
      : `Expected VRS=0, got motilityIndex=${analytics.motilityIndex}, eventsPerMinute=${analytics.eventsPerMinute}`,
  };
}

/**
 * Run verification test for mechanical noise (60Hz)
 *
 * @returns Test result with pass/fail status
 */
export function verifyMechanicalNoiseProducesZeroVRS(): MockSignalTestResult {
  const sampleRate = CONFIG.sampleRate;
  const samples = generate30SecondMechanicalNoise(sampleRate, 16.67); // 60Hz
  const durationSeconds = 30;

  const analytics = analyzeAudioSamples(samples, durationSeconds, sampleRate);
  const gating = applyPsychoacousticGating(samples, sampleRate);

  const passed = analytics.motilityIndex === 0;

  return {
    testName: "MECHANICAL_NOISE_60HZ",
    description: "30 seconds of 60Hz mechanical noise (fan/AC simulation)",
    durationSeconds,
    expectedVRS: 0,
    actualMotilityIndex: analytics.motilityIndex,
    actualEventsPerMinute: analytics.eventsPerMinute,
    psychoacousticGating: {
      shouldGate: gating.shouldGate,
      gatingReason: gating.gatingReason,
      isStationary: gating.temporalMasking.isStationary,
      isRhythmic: gating.rhythmicRejection.isRhythmic,
      isMechanicalNoise: gating.rhythmicRejection.isMechanicalNoise,
    },
    passed,
    failureReason: passed
      ? null
      : `Expected VRS=0, got motilityIndex=${analytics.motilityIndex}`,
  };
}

/**
 * Run verification test for breath noise
 *
 * @returns Test result with pass/fail status
 */
export function verifyBreathNoiseProducesZeroVRS(): MockSignalTestResult {
  const sampleRate = CONFIG.sampleRate;
  const samples = generateBreathNoise(30, sampleRate, 8); // 8 breath events in 30s
  const durationSeconds = 30;

  const analytics = analyzeAudioSamples(samples, durationSeconds, sampleRate);
  const gating = applyPsychoacousticGating(samples, sampleRate);

  const passed = analytics.motilityIndex === 0;

  return {
    testName: "BREATH_NOISE_30S",
    description: "30 seconds with 8 breath events (800ms each)",
    durationSeconds,
    expectedVRS: 0,
    actualMotilityIndex: analytics.motilityIndex,
    actualEventsPerMinute: analytics.eventsPerMinute,
    psychoacousticGating: {
      shouldGate: gating.shouldGate,
      gatingReason: gating.gatingReason,
      isStationary: gating.temporalMasking.isStationary,
      isRhythmic: gating.rhythmicRejection.isRhythmic,
      isMechanicalNoise: gating.rhythmicRejection.isMechanicalNoise,
    },
    passed,
    failureReason: passed
      ? null
      : `Expected VRS=0, got motilityIndex=${analytics.motilityIndex}`,
  };
}

/**
 * Run verification test for valid gut sounds
 *
 * @returns Test result with pass/fail status
 */
export function verifyGutSoundsProducePositiveVRS(): MockSignalTestResult {
  const sampleRate = CONFIG.sampleRate;
  const samples = generateGutSound(30, sampleRate, 15); // 15 gut events in 30s
  const durationSeconds = 30;

  const analytics = analyzeAudioSamples(samples, durationSeconds, sampleRate);
  const gating = applyPsychoacousticGating(samples, sampleRate);

  // For gut sounds, we expect some detection (> 0)
  const passed = analytics.eventsPerMinute > 0 || analytics.motilityIndex > 0;

  return {
    testName: "GUT_SOUNDS_30S",
    description: "30 seconds with 15 synthetic gut sound events",
    durationSeconds,
    expectedVRS: -1, // Any positive value
    actualMotilityIndex: analytics.motilityIndex,
    actualEventsPerMinute: analytics.eventsPerMinute,
    psychoacousticGating: {
      shouldGate: gating.shouldGate,
      gatingReason: gating.gatingReason,
      isStationary: gating.temporalMasking.isStationary,
      isRhythmic: gating.rhythmicRejection.isRhythmic,
      isMechanicalNoise: gating.rhythmicRejection.isMechanicalNoise,
    },
    passed,
    failureReason: passed
      ? null
      : `Expected VRS>0, got motilityIndex=${analytics.motilityIndex}, eventsPerMinute=${analytics.eventsPerMinute}`,
  };
}

/**
 * Run all mock signal verification tests
 *
 * This is the full validation suite that MUST pass before committing.
 *
 * @returns Array of all test results
 */
export function runAllMockSignalTests(): MockSignalTestResult[] {
  return [
    verifyWhiteNoiseProducesZeroVRS(),
    verifyMechanicalNoiseProducesZeroVRS(),
    verifyBreathNoiseProducesZeroVRS(),
    verifyGutSoundsProducePositiveVRS(),
  ];
}

/**
 * Print test results to console
 */
export function printTestResults(results: MockSignalTestResult[]): void {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("NG-HARDEN-04: Mock Signal Verification Results");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  let allPassed = true;

  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    allPassed = allPassed && result.passed;

    console.log(`${status}: ${result.testName}`);
    console.log(`  Description: ${result.description}`);
    console.log(`  Expected VRS: ${result.expectedVRS === -1 ? ">0" : result.expectedVRS}`);
    console.log(`  Actual Motility: ${result.actualMotilityIndex}`);
    console.log(`  Actual Events/Min: ${result.actualEventsPerMinute}`);
    console.log(`  Psychoacoustic Gating:`);
    console.log(`    Should Gate: ${result.psychoacousticGating.shouldGate}`);
    console.log(`    Is Stationary: ${result.psychoacousticGating.isStationary}`);
    console.log(`    Is Rhythmic: ${result.psychoacousticGating.isRhythmic}`);
    console.log(`    Is Mechanical: ${result.psychoacousticGating.isMechanicalNoise}`);
    if (result.psychoacousticGating.gatingReason) {
      console.log(`    Reason: ${result.psychoacousticGating.gatingReason}`);
    }
    if (result.failureReason) {
      console.log(`  FAILURE: ${result.failureReason}`);
    }
    console.log("");
  }

  console.log("═══════════════════════════════════════════════════════════════════");
  if (allPassed) {
    console.log("✓ ALL TESTS PASSED - Safe to commit");
  } else {
    console.log("✗ SOME TESTS FAILED - DO NOT COMMIT");
  }
  console.log("═══════════════════════════════════════════════════════════════════");
}
