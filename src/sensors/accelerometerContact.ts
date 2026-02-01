/**
 * Accelerometer Contact Detection
 *
 * PRIMARY gate for gut sound detection using VARIANCE-ONLY detection.
 * Body contact has ONE reliable signature: breathing micro-motion.
 *
 * Key insight: Tilt (Z value) fails for tilted phone on table/pillow.
 * Variance is the only reliable discriminator.
 *
 * Empirical data:
 * - Table: variance ~0.000004 (dead still - no breathing)
 * - Abdomen: variance ~0.00008 (breathing = 20x higher)
 * - Walking: variance ~0.01+ (too unstable for recording)
 *
 * Detection:
 * - varianceInBodyRange = MIN_VARIANCE <= variance <= MAX_VARIANCE
 * - noContact = !varianceInBodyRange
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

  // SETTLING PERIOD: Only use last N samples for analysis
  // This ignores initial placement movement and checks if phone is settled
  // At 20Hz, 400 samples = 20 seconds of "settled" data
  settledSampleCount: 400,

  // Minimum settled samples needed (at least 5 seconds of settled data)
  minSettledSamples: 100,

  // ════════════════════════════════════════════════════════════════════════════════
  // VARIANCE-ONLY BODY CONTACT DETECTION
  // Breathing micro-motion is the only reliable signature of body contact.
  // Tilt (Z value) is NOT used - fails for tilted phone on table/pillow.
  // ════════════════════════════════════════════════════════════════════════════════

  // MINIMUM variance for body contact
  // Below this = no breathing detected = phone on table/pillow
  // Empirical: table ~0.000004, abdomen ~0.00008
  minVarianceForBody: 0.00003,

  // MAXIMUM variance for valid recording
  // Above this = too much motion = walking/unstable
  // Empirical: walking ~0.01+, deep breathing ~0.01-0.02
  // Increased from 0.005 to allow stronger breathing motion
  maxVarianceForBody: 0.02,

  // Threshold for "high motion warning" (deep breathing detected)
  // Between normal max (0.005) and absolute max (0.02)
  highMotionWarningThreshold: 0.005,
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

  /** Is variance in the body contact range? (has breathing micro-motion) */
  varianceInBodyRange: boolean;

  /** Rejection reason if noContact is true */
  rejectionReason: 'too_still' | 'too_much_motion' | 'insufficient_samples' | null;

  /** High motion detected but likely deep breathing (not rejected, just flagged) */
  highMotionWarning: boolean;

  /** Total variance across all axes (the key metric) */
  totalVariance: number;

  /** Average Z-axis acceleration (for diagnostics only) */
  avgZ: number;

  /** Average X-axis acceleration (for diagnostics only) */
  avgX: number;

  /** Average Y-axis acceleration (for diagnostics only) */
  avgY: number;

  /** Number of samples analyzed */
  sampleCount: number;

  /** Confidence in the detection (0-1) */
  confidence: number;

  // Legacy fields for backwards compatibility
  /** @deprecated Use varianceInBodyRange instead */
  isFlat: boolean;
  /** @deprecated Use !varianceInBodyRange instead */
  isStill: boolean;
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
   * Uses VARIANCE-ONLY detection - breathing micro-motion is the key signal.
   */
  analyze(): ContactDetectionResult {
    const allSamples = this.samples;
    const totalSamples = allSamples.length;

    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║       ACCELEROMETER VARIANCE GATE (Breathing Detection)         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`Total samples collected: ${totalSamples}`);

    if (totalSamples < ACCELEROMETER_CONFIG.minSamplesForDetection) {
      console.log(`[Accelerometer] Insufficient samples: ${totalSamples} < ${ACCELEROMETER_CONFIG.minSamplesForDetection}`);
      return {
        noContact: false, // Don't reject if we can't detect
        varianceInBodyRange: false,
        rejectionReason: 'insufficient_samples',
        highMotionWarning: false,
        totalVariance: 0,
        avgZ: 0,
        avgX: 0,
        avgY: 0,
        sampleCount: totalSamples,
        confidence: 0,
        isFlat: false,
        isStill: false,
      };
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // SETTLING PERIOD: Only use LAST portion of samples
    // This ignores initial placement movement and only checks settled state
    // ════════════════════════════════════════════════════════════════════════════════
    const settledCount = Math.min(ACCELEROMETER_CONFIG.settledSampleCount, totalSamples);
    const samples = allSamples.slice(-settledCount);
    const n = samples.length;

    console.log(`Using last ${n} samples for analysis (ignoring first ${totalSamples - n} placement samples)`);

    if (n < ACCELEROMETER_CONFIG.minSettledSamples) {
      console.log(`[Accelerometer] Insufficient settled samples: ${n} < ${ACCELEROMETER_CONFIG.minSettledSamples}`);
      return {
        noContact: false,
        varianceInBodyRange: false,
        rejectionReason: 'insufficient_samples',
        highMotionWarning: false,
        totalVariance: 0,
        avgZ: 0,
        avgX: 0,
        avgY: 0,
        sampleCount: n,
        confidence: 0,
        isFlat: false,
        isStill: false,
      };
    }

    // Calculate averages from SETTLED samples only
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

    // ════════════════════════════════════════════════════════════════════════════════
    // VARIANCE-ONLY GATE
    // Body contact = variance in "breathing range" (not too still, not too active)
    // ════════════════════════════════════════════════════════════════════════════════
    const { minVarianceForBody, maxVarianceForBody, highMotionWarningThreshold } = ACCELEROMETER_CONFIG;

    const varianceInBodyRange = totalVariance >= minVarianceForBody &&
                                 totalVariance <= maxVarianceForBody;

    // High motion warning: variance above normal but below rejection threshold
    // This indicates deep breathing or slight movement but still valid recording
    const highMotionWarning = totalVariance > highMotionWarningThreshold &&
                               totalVariance <= maxVarianceForBody;

    // Determine rejection reason
    let rejectionReason: ContactDetectionResult['rejectionReason'] = null;
    if (totalVariance < minVarianceForBody) {
      rejectionReason = 'too_still';
    } else if (totalVariance > maxVarianceForBody) {
      rejectionReason = 'too_much_motion';
    }

    // NO CONTACT = variance NOT in body range
    const noContact = !varianceInBodyRange;

    // Confidence based on how clearly within/outside the range
    const sampleConfidence = Math.min(1, n / (ACCELEROMETER_CONFIG.minSamplesForDetection * 2));
    let rangeConfidence: number;
    if (varianceInBodyRange) {
      // How centered within the range? (1.0 = perfectly centered)
      const rangeCenter = (minVarianceForBody + maxVarianceForBody) / 2;
      const rangeHalf = (maxVarianceForBody - minVarianceForBody) / 2;
      rangeConfidence = 1 - Math.abs(totalVariance - rangeCenter) / rangeHalf;
    } else {
      // How far outside the range?
      if (totalVariance < minVarianceForBody) {
        rangeConfidence = Math.min(1, minVarianceForBody / Math.max(totalVariance, 0.0000001));
      } else {
        rangeConfidence = Math.min(1, maxVarianceForBody / totalVariance);
      }
    }
    const confidence = sampleConfidence * rangeConfidence;

    // Legacy fields for backwards compatibility
    const isStill = totalVariance < minVarianceForBody;
    const isFlat = false; // No longer used

    // ════════════════════════════════════════════════════════════════════════════════
    // DIAGNOSTIC LOGGING
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('--- VARIANCE GATE ---');
    console.log(`Samples analyzed: ${n}`);
    console.log(`Variance X: ${varX.toFixed(8)}, Y: ${varY.toFixed(8)}, Z: ${varZ.toFixed(8)}`);
    console.log(`Total variance: ${totalVariance.toFixed(8)}`);
    console.log(`Min for body: ${minVarianceForBody} (below = no breathing)`);
    console.log(`Max for body: ${maxVarianceForBody} (above = too unstable)`);
    console.log(`In body range?: ${varianceInBodyRange}`);
    console.log('');

    if (totalVariance < minVarianceForBody) {
      console.log('>>> REJECTED: Too still (no breathing detected)');
      console.log(`    Variance ${totalVariance.toFixed(8)} < min ${minVarianceForBody}`);
      console.log('    Likely: phone on table, pillow, or other static surface');
    } else if (totalVariance > maxVarianceForBody) {
      console.log('>>> REJECTED: Too much motion (unstable recording)');
      console.log(`    Variance ${totalVariance.toFixed(8)} > max ${maxVarianceForBody}`);
      console.log('    Likely: walking, exercising, or phone being handled');
    } else if (highMotionWarning) {
      console.log('>>> PASSED WITH WARNING: High motion (likely deep breathing)');
      console.log(`    Variance ${totalVariance.toFixed(8)} > warning threshold ${highMotionWarningThreshold}`);
      console.log('    Proceeding - higher variance likely from deep/intentional breathing');
    } else {
      console.log('>>> PASSED: Variance in body contact range');
      console.log(`    Variance ${totalVariance.toFixed(8)} is within [${minVarianceForBody}, ${maxVarianceForBody}]`);
      console.log('    Detected breathing micro-motion - phone appears to be on body');
    }

    console.log('');
    console.log(`Avg position (diagnostics): X=${avgX.toFixed(3)}, Y=${avgY.toFixed(3)}, Z=${avgZ.toFixed(3)}`);
    console.log(`Confidence: ${(confidence * 100).toFixed(0)}%`);
    console.log('════════════════════════════════════════════════════════════════════');

    return {
      noContact,
      varianceInBodyRange,
      rejectionReason,
      highMotionWarning,
      totalVariance,
      avgZ,
      avgX,
      avgY,
      sampleCount: n,
      confidence,
      isFlat,
      isStill,
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

/**
 * Get raw accelerometer samples for breathing analysis
 * Returns all collected samples with timestamps
 */
export function getAccelerometerSamples(): AccelerometerSample[] {
  const detector = getAccelerometerDetector();
  return detector.getSamples();
}
