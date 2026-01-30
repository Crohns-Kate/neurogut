/**
 * Accelerometer Contact Detection
 *
 * PRIMARY gate for gut sound detection - if phone is flat and still (table),
 * reject ALL audio events regardless of audio analysis.
 *
 * Physics:
 * - Phone flat on table: Z ≈ ±9.8 m/s², X ≈ 0, Y ≈ 0
 * - Phone on body: Z varies (angled), micro-movements present
 * - Gravity = 9.8 m/s², so |Z| > 9.5 means nearly perpendicular to ground
 *
 * Detection:
 * - isFlat: abs(avgZ) > 9.5 (phone horizontal)
 * - isStill: variance < 0.002 (no micro-motion)
 * - noContact = isFlat AND isStill
 */

import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';

// ════════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════════

export const ACCELEROMETER_CONFIG = {
  // Sample rate in Hz (updates per second)
  sampleRateHz: 20,

  // Minimum samples needed for reliable detection
  minSamplesForDetection: 40, // 2 seconds at 20Hz

  // FLAT DETECTION
  // Phone flat on table: Z magnitude close to gravity (9.8 m/s²)
  // Threshold: if |avgZ| > 9.5, phone is nearly horizontal
  flatZThreshold: 9.5,

  // STILLNESS DETECTION
  // Phone on table has very low variance (no micro-movements)
  // Body has constant micro-tremors from breathing, heartbeat, muscle tone
  // Threshold: if totalVariance < 0.002, phone is unnaturally still
  stillnessVarianceThreshold: 0.002,

  // Additional: X and Y should be near zero if truly flat
  // (tilted phones have significant X/Y components)
  flatXYThreshold: 1.5, // m/s² - allow some tilt tolerance
};

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export interface AccelerometerSample {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface ContactDetectionResult {
  /** Is the phone likely NOT in contact with body? */
  noContact: boolean;

  /** Is the phone lying flat (horizontal)? */
  isFlat: boolean;

  /** Is the phone still (no micro-motion)? */
  isStill: boolean;

  /** Average Z-axis acceleration (gravity component) */
  avgZ: number;

  /** Average X-axis acceleration */
  avgX: number;

  /** Average Y-axis acceleration */
  avgY: number;

  /** Total variance across all axes */
  totalVariance: number;

  /** Number of samples analyzed */
  sampleCount: number;

  /** Confidence in the detection (0-1) */
  confidence: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// ACCELEROMETER CONTACT DETECTOR CLASS
// ════════════════════════════════════════════════════════════════════════════════

export class AccelerometerContactDetector {
  private samples: AccelerometerSample[] = [];
  private subscription: Subscription | null = null;
  private isRunning: boolean = false;

  /**
   * Start collecting accelerometer samples
   */
  async start(): Promise<void> {
    console.log('[Accelerometer] ===== START CALLED =====');

    if (this.isRunning) {
      console.log('[Accelerometer] Already running, skipping start');
      return;
    }

    // Check availability
    const isAvailable = await Accelerometer.isAvailableAsync();
    console.log('[Accelerometer] isAvailable:', isAvailable);

    if (!isAvailable) {
      console.warn('[Accelerometer] NOT AVAILABLE on this device - gate will not work!');
      return;
    }

    // Clear previous samples
    this.samples = [];
    this.isRunning = true;

    // Set update interval (in ms)
    const intervalMs = Math.round(1000 / ACCELEROMETER_CONFIG.sampleRateHz);
    console.log('[Accelerometer] Setting update interval:', intervalMs, 'ms');
    Accelerometer.setUpdateInterval(intervalMs);

    // Subscribe to updates
    let sampleCount = 0;
    this.subscription = Accelerometer.addListener((data: AccelerometerMeasurement) => {
      this.samples.push({
        x: data.x,
        y: data.y,
        z: data.z,
        timestamp: Date.now(),
      });
      sampleCount++;
      // Log every 20 samples (about 1 second)
      if (sampleCount % 20 === 0) {
        console.log(`[Accelerometer] Samples collected: ${sampleCount}, latest Z: ${data.z.toFixed(3)}`);
      }
    });

    console.log(`[Accelerometer] ===== STARTED at ${ACCELEROMETER_CONFIG.sampleRateHz}Hz =====`);
  }

  /**
   * Stop collecting samples
   */
  stop(): void {
    console.log('[Accelerometer] ===== STOP CALLED =====');
    console.log('[Accelerometer] isRunning:', this.isRunning);
    console.log('[Accelerometer] hasSubscription:', !!this.subscription);

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isRunning = false;

    console.log(`[Accelerometer] ===== STOPPED =====`);
    console.log(`[Accelerometer] Total samples collected: ${this.samples.length}`);
    console.log(`[Accelerometer] Minimum needed: ${ACCELEROMETER_CONFIG.minSamplesForDetection}`);

    if (this.samples.length > 0) {
      const lastSample = this.samples[this.samples.length - 1];
      console.log(`[Accelerometer] Last sample: X=${lastSample.x.toFixed(3)}, Y=${lastSample.y.toFixed(3)}, Z=${lastSample.z.toFixed(3)}`);
    }
  }

  /**
   * Get current samples without stopping
   */
  getSamples(): AccelerometerSample[] {
    return [...this.samples];
  }

  /**
   * Clear samples (useful for continuous monitoring)
   */
  clearSamples(): void {
    this.samples = [];
  }

  /**
   * Analyze collected samples and determine contact status
   */
  analyze(): ContactDetectionResult {
    const samples = this.samples;
    const n = samples.length;

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║            ACCELEROMETER CONTACT DETECTION                       ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    if (n < ACCELEROMETER_CONFIG.minSamplesForDetection) {
      console.log(`[Accelerometer] Insufficient samples: ${n} < ${ACCELEROMETER_CONFIG.minSamplesForDetection}`);
      return {
        noContact: false, // Don't reject if we can't detect
        isFlat: false,
        isStill: false,
        avgZ: 0,
        avgX: 0,
        avgY: 0,
        totalVariance: 0,
        sampleCount: n,
        confidence: 0,
      };
    }

    // Calculate averages
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const s of samples) {
      sumX += s.x;
      sumY += s.y;
      sumZ += s.z;
    }
    const avgX = sumX / n;
    const avgY = sumY / n;
    const avgZ = sumZ / n;

    // Calculate variances
    let varX = 0, varY = 0, varZ = 0;
    for (const s of samples) {
      varX += (s.x - avgX) ** 2;
      varY += (s.y - avgY) ** 2;
      varZ += (s.z - avgZ) ** 2;
    }
    varX /= n;
    varY /= n;
    varZ /= n;
    const totalVariance = varX + varY + varZ;

    // FLAT DETECTION
    // Phone is flat if Z is close to gravity and X/Y are near zero
    const absZ = Math.abs(avgZ);
    const absX = Math.abs(avgX);
    const absY = Math.abs(avgY);
    const isFlat = absZ > ACCELEROMETER_CONFIG.flatZThreshold &&
                   absX < ACCELEROMETER_CONFIG.flatXYThreshold &&
                   absY < ACCELEROMETER_CONFIG.flatXYThreshold;

    // STILLNESS DETECTION
    // Phone is still if total variance is very low
    const isStill = totalVariance < ACCELEROMETER_CONFIG.stillnessVarianceThreshold;

    // NO CONTACT = flat AND still
    const noContact = isFlat && isStill;

    // Confidence based on sample count and how clearly the criteria are met
    const sampleConfidence = Math.min(1, n / (ACCELEROMETER_CONFIG.minSamplesForDetection * 2));
    const flatMargin = isFlat ? (absZ - ACCELEROMETER_CONFIG.flatZThreshold) / 0.3 : 0;
    const stillMargin = isStill ? (ACCELEROMETER_CONFIG.stillnessVarianceThreshold - totalVariance) / ACCELEROMETER_CONFIG.stillnessVarianceThreshold : 0;
    const confidence = sampleConfidence * (noContact ? Math.min(1, (flatMargin + stillMargin) / 2 + 0.5) : 0.5);

    // DIAGNOSTIC LOGGING
    console.log(`Samples: ${n}`);
    console.log(`Avg X: ${avgX.toFixed(4)}, Avg Y: ${avgY.toFixed(4)}, Avg Z: ${avgZ.toFixed(4)}`);
    console.log(`Variance X: ${varX.toFixed(6)}, Y: ${varY.toFixed(6)}, Z: ${varZ.toFixed(6)}`);
    console.log(`Total variance: ${totalVariance.toFixed(6)} (still if < ${ACCELEROMETER_CONFIG.stillnessVarianceThreshold})`);
    console.log('--- FLAT CHECK ---');
    console.log(`|Z| = ${absZ.toFixed(3)} (flat if > ${ACCELEROMETER_CONFIG.flatZThreshold}): ${absZ > ACCELEROMETER_CONFIG.flatZThreshold ? '✓ FLAT' : '✗ angled'}`);
    console.log(`|X| = ${absX.toFixed(3)} (need < ${ACCELEROMETER_CONFIG.flatXYThreshold}): ${absX < ACCELEROMETER_CONFIG.flatXYThreshold ? '✓' : '✗'}`);
    console.log(`|Y| = ${absY.toFixed(3)} (need < ${ACCELEROMETER_CONFIG.flatXYThreshold}): ${absY < ACCELEROMETER_CONFIG.flatXYThreshold ? '✓' : '✗'}`);
    console.log(`isFlat: ${isFlat}`);
    console.log('--- STILLNESS CHECK ---');
    console.log(`totalVariance: ${totalVariance.toFixed(6)} (still if < ${ACCELEROMETER_CONFIG.stillnessVarianceThreshold}): ${isStill ? '✓ STILL' : '✗ moving'}`);
    console.log(`isStill: ${isStill}`);
    console.log('--- FINAL DECISION ---');
    console.log(`noContact (flat AND still): ${noContact}`);
    if (noContact) {
      console.log('>>> ACCELEROMETER GATE: REJECT ALL AUDIO - phone is on table');
    } else {
      console.log('>>> ACCELEROMETER GATE: PASS - proceed with audio analysis');
    }
    console.log('=====================================');

    return {
      noContact,
      isFlat,
      isStill,
      avgZ,
      avgX,
      avgY,
      totalVariance,
      sampleCount: n,
      confidence,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ════════════════════════════════════════════════════════════════════════════════

let detectorInstance: AccelerometerContactDetector | null = null;

/**
 * Get the singleton accelerometer contact detector
 */
export function getAccelerometerDetector(): AccelerometerContactDetector {
  if (!detectorInstance) {
    detectorInstance = new AccelerometerContactDetector();
  }
  return detectorInstance;
}

/**
 * Quick check if phone appears to be on a table
 * Call this after recording to gate audio analysis
 */
export async function checkAccelerometerContact(
  samples?: AccelerometerSample[]
): Promise<ContactDetectionResult> {
  const detector = getAccelerometerDetector();

  // If samples provided, use them directly
  if (samples && samples.length > 0) {
    // Create temporary detector with provided samples
    const tempDetector = new AccelerometerContactDetector();
    (tempDetector as any).samples = samples;
    return tempDetector.analyze();
  }

  // Otherwise use the singleton's collected samples
  return detector.analyze();
}

/**
 * Start accelerometer monitoring (call when recording starts)
 */
export async function startAccelerometerMonitoring(): Promise<void> {
  const detector = getAccelerometerDetector();
  await detector.start();
}

/**
 * Stop accelerometer monitoring (call when recording stops)
 */
export function stopAccelerometerMonitoring(): void {
  const detector = getAccelerometerDetector();
  detector.stop();
}

/**
 * Analyze and get contact result (call after recording)
 */
export function analyzeAccelerometerContact(): ContactDetectionResult {
  const detector = getAccelerometerDetector();
  return detector.analyze();
}
