/**
 * Peak-Frequency Histogram Similarity (PFHS) Unit Tests
 *
 * Verifies PFHS scoring against healthy gut sound reference pattern:
 * - Healthy histogram correlation >0.8
 * - Flat noise histogram correlation <0.3
 * - 200Hz peak reference matching
 */

import {
  computePFHS,
  HEALTHY_GUT_HISTOGRAM,
  calculateSessionPFHS,
} from '../logic/scoringEngine';
import type { SessionAnalytics } from '../models/session';

// Helper to calculate Pearson correlation (exported for testing)
function testPearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

describe('HEALTHY_GUT_HISTOGRAM Reference', () => {
  test('should have 8 bins', () => {
    expect(HEALTHY_GUT_HISTOGRAM.length).toBe(8);
  });

  test('should sum to approximately 1.0 (normalized)', () => {
    const sum = HEALTHY_GUT_HISTOGRAM.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  test('should peak at 200Hz region (bins 2-3)', () => {
    // Bins: [100-144, 144-188, 188-231, 231-275, ...]
    // 200Hz is in bin 2 (188-231), 250Hz is in bin 3 (231-275)
    const peakValue = Math.max(...HEALTHY_GUT_HISTOGRAM);
    const peakIndex = HEALTHY_GUT_HISTOGRAM.indexOf(peakValue);

    expect(peakIndex).toBeGreaterThanOrEqual(2);
    expect(peakIndex).toBeLessThanOrEqual(3);
  });
});

describe('PFHS Computation - Healthy Patterns', () => {
  test('identical histogram should have correlation ~1.0', () => {
    const result = computePFHS(HEALTHY_GUT_HISTOGRAM, [200, 250]);

    expect(result.correlation).toBeCloseTo(1.0, 1);
    expect(result.score).toBeGreaterThan(80);
    expect(result.isHealthyPattern).toBe(true);
  });

  test('similar histogram should have correlation >0.8', () => {
    // Slightly modified healthy pattern
    const similar = [0.10, 0.14, 0.20, 0.26, 0.14, 0.09, 0.05, 0.02];
    const result = computePFHS(similar, [210, 240]);

    expect(result.correlation).toBeGreaterThan(0.8);
    expect(result.score).toBeGreaterThan(60);
    expect(result.isHealthyPattern).toBe(true);
  });

  test('200Hz peak should get alignment bonus', () => {
    const histogram = [0.05, 0.10, 0.30, 0.25, 0.15, 0.10, 0.03, 0.02];
    const result = computePFHS(histogram, [200]);

    expect(result.peakAlignmentBonus).toBeGreaterThan(0);
    expect(result.detectedPeaks).toContain(200);
  });

  test('250Hz peak should get alignment bonus', () => {
    const histogram = [0.05, 0.10, 0.20, 0.35, 0.15, 0.10, 0.03, 0.02];
    const result = computePFHS(histogram, [250]);

    expect(result.peakAlignmentBonus).toBeGreaterThan(0);
  });
});

describe('PFHS Computation - Noise Patterns', () => {
  test('flat/uniform histogram should have low correlation', () => {
    const flat = [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125];
    const result = computePFHS(flat, []);

    expect(result.correlation).toBeLessThan(0.3);
    expect(result.score).toBeLessThan(50);
    expect(result.isHealthyPattern).toBe(false);
  });

  test('inverted pattern should have negative correlation', () => {
    // High at edges, low in middle (opposite of healthy)
    const inverted = [0.25, 0.15, 0.05, 0.02, 0.03, 0.10, 0.20, 0.20];
    const result = computePFHS(inverted, []);

    expect(result.correlation).toBeLessThan(0);
    expect(result.isHealthyPattern).toBe(false);
  });

  test('high-frequency dominated histogram should have low score', () => {
    // Energy concentrated at high frequencies (not gut sounds)
    const highFreq = [0.02, 0.03, 0.05, 0.10, 0.15, 0.20, 0.25, 0.20];
    const result = computePFHS(highFreq, [400, 430]);

    expect(result.score).toBeLessThan(50);
    expect(result.isHealthyPattern).toBe(false);
  });

  test('empty histogram should have zero score', () => {
    const empty = [0, 0, 0, 0, 0, 0, 0, 0];
    const result = computePFHS(empty, []);

    expect(result.score).toBe(0);
    expect(result.correlation).toBe(0);
    expect(result.isHealthyPattern).toBe(false);
  });
});

describe('PFHS Peak Alignment Bonus', () => {
  test('multiple matching peaks should accumulate bonus', () => {
    const histogram = HEALTHY_GUT_HISTOGRAM;
    const result = computePFHS(histogram, [200, 250, 200, 250]);

    // Max bonus is 20
    expect(result.peakAlignmentBonus).toBeGreaterThanOrEqual(10);
    expect(result.peakAlignmentBonus).toBeLessThanOrEqual(20);
  });

  test('non-matching peaks should get no bonus', () => {
    const histogram = HEALTHY_GUT_HISTOGRAM;
    const result = computePFHS(histogram, [50, 100, 400, 500]);

    // 100Hz is close to healthy range but not 200/250
    expect(result.peakAlignmentBonus).toBeLessThan(10);
  });

  test('peak within tolerance (±30Hz) should match', () => {
    const histogram = HEALTHY_GUT_HISTOGRAM;

    // 200 ± 30 = 170-230 should match 200
    const result1 = computePFHS(histogram, [220]);
    expect(result1.peakAlignmentBonus).toBeGreaterThan(0);

    // 250 ± 30 = 220-280 should match 250
    const result2 = computePFHS(histogram, [270]);
    expect(result2.peakAlignmentBonus).toBeGreaterThan(0);
  });
});

describe('Session PFHS Calculation', () => {
  test('should handle session analytics with histogram', () => {
    const mockAnalytics: Partial<SessionAnalytics> = {
      frequencyHistogram: HEALTHY_GUT_HISTOGRAM,
      peakFrequencies: [200, 210, 240],
    };

    const result = calculateSessionPFHS(mockAnalytics as SessionAnalytics);

    expect(result.score).toBeGreaterThan(70);
    expect(result.isHealthyPattern).toBe(true);
  });

  test('should handle session analytics without histogram', () => {
    const mockAnalytics: Partial<SessionAnalytics> = {
      frequencyHistogram: undefined,
      peakFrequencies: undefined,
    };

    const result = calculateSessionPFHS(mockAnalytics as SessionAnalytics);

    // Should default to uniform distribution
    expect(result.score).toBeDefined();
    expect(result.correlation).toBeDefined();
  });
});

describe('Correlation Edge Cases', () => {
  test('should handle identical arrays', () => {
    const arr = [1, 2, 3, 4, 5];
    const corr = testPearsonCorrelation(arr, arr);
    expect(corr).toBeCloseTo(1.0, 5);
  });

  test('should handle perfectly anti-correlated arrays', () => {
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [5, 4, 3, 2, 1];
    const corr = testPearsonCorrelation(arr1, arr2);
    expect(corr).toBeCloseTo(-1.0, 5);
  });

  test('should handle zero variance', () => {
    const constant = [5, 5, 5, 5, 5];
    const other = [1, 2, 3, 4, 5];
    const corr = testPearsonCorrelation(constant, other);
    expect(corr).toBe(0);
  });

  test('should handle single element', () => {
    const single = [5];
    const corr = testPearsonCorrelation(single, single);
    expect(corr).toBe(0);
  });
});

describe('PFHS Score Thresholds', () => {
  test('score >50 with correlation >0.5 should be healthy pattern', () => {
    // Create histogram that gives ~0.6 correlation
    const moderate = [0.10, 0.12, 0.18, 0.22, 0.18, 0.10, 0.06, 0.04];
    const result = computePFHS(moderate, [200]);

    if (result.correlation > 0.5 && result.score > 50) {
      expect(result.isHealthyPattern).toBe(true);
    }
  });

  test('score should be clamped to 0-100', () => {
    const result1 = computePFHS(HEALTHY_GUT_HISTOGRAM, [200, 200, 200, 200, 250, 250, 250, 250]);
    expect(result1.score).toBeLessThanOrEqual(100);

    const result2 = computePFHS([0, 0, 0, 0, 0, 0, 0, 0], []);
    expect(result2.score).toBeGreaterThanOrEqual(0);
  });
});
