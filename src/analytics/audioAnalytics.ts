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

// Configuration for event detection
const CONFIG = {
  // Window size in milliseconds for RMS calculation
  windowSizeMs: 100,
  // Minimum gap between events to consider them separate (in windows)
  minGapWindows: 3,
  // RMS threshold multiplier (events are windows above mean + threshold * stdDev)
  thresholdMultiplier: 1.5,
  // Minimum event duration in windows to count
  minEventWindows: 2,
  // Number of segments for the activity timeline
  timelineSegments: 10,
  // Sample rate assumption (most recordings are 44100 Hz)
  sampleRate: 44100,
};

/**
 * Represents a detected gut sound event
 */
interface DetectedEvent {
  startWindow: number;
  endWindow: number;
  peakEnergy: number;
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
 */
function detectEvents(energyValues: number[]): DetectedEvent[] {
  if (energyValues.length === 0) return [];

  // Calculate adaptive threshold based on signal statistics
  const avgEnergy = mean(energyValues);
  const energyStdDev = stdDev(energyValues);
  const threshold = avgEnergy + CONFIG.thresholdMultiplier * energyStdDev;

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
 * This is a simple heuristic designed for self-tracking, not medical assessment.
 */
function calculateMotilityIndex(
  eventsPerMinute: number,
  activeFraction: number
): number {
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
  const motilityIndex = Math.round(normalizedEPM * 0.7 + activenessScore * 0.3);

  return Math.min(100, Math.max(0, motilityIndex));
}

/**
 * Analyze audio samples and compute session analytics
 *
 * @param samples - Raw audio samples (normalized to -1 to 1 range)
 * @param durationSeconds - Total recording duration in seconds
 * @param sampleRate - Audio sample rate (default 44100)
 * @returns SessionAnalytics object with computed metrics
 */
export function analyzeAudioSamples(
  samples: number[],
  durationSeconds: number,
  sampleRate: number = CONFIG.sampleRate
): SessionAnalytics {
  // Convert window size from ms to samples
  const windowSizeSamples = Math.floor(
    (CONFIG.windowSizeMs / 1000) * sampleRate
  );

  // Compute windowed energy
  const energyValues = computeWindowedEnergy(samples, windowSizeSamples);

  // Detect events
  const events = detectEvents(energyValues);

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

  // Calculate Motility Index
  const motilityIndex = calculateMotilityIndex(eventsPerMinute, activeFraction);

  // Create activity timeline
  const activityTimeline = createActivityTimeline(
    energyValues,
    CONFIG.timelineSegments
  );

  return {
    eventsPerMinute: Math.round(eventsPerMinute * 10) / 10,
    totalActiveSeconds: Math.round(totalActiveSeconds),
    totalQuietSeconds: Math.round(totalQuietSeconds),
    motilityIndex,
    activityTimeline,
    timelineSegments: CONFIG.timelineSegments,
  };
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
