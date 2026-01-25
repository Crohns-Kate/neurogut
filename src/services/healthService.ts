/**
 * Health Service - Apple Health / Google Fit Integration
 *
 * Pulls Sleep Hours and Step Count for correlation with Vagal Readiness.
 * Uses react-native-health on iOS and Google Fit on Android.
 *
 * NOTE: This requires native module setup:
 * - iOS: Add HealthKit entitlement and privacy descriptions
 * - Android: Add Google Fit permissions
 *
 * For now, this provides a facade with mock data for development.
 * Production implementation should install and configure:
 * - react-native-health (iOS)
 * - react-native-google-fit (Android)
 */

import { Platform } from "react-native";

// Health data types
export interface SleepData {
  /** Total sleep hours in the last 24 hours */
  totalHours: number;
  /** Sleep quality score (0-100) */
  qualityScore: number;
  /** Time went to bed */
  bedTime: string | null;
  /** Time woke up */
  wakeTime: string | null;
  /** Whether data is available */
  available: boolean;
}

export interface StepData {
  /** Total steps today */
  todaySteps: number;
  /** Average steps over last 7 days */
  weeklyAverage: number;
  /** Whether data is available */
  available: boolean;
}

export interface HealthCorrelation {
  /** Sleep quality category */
  sleepCategory: "good" | "moderate" | "poor" | "unknown";
  /** Activity level category */
  activityCategory: "active" | "moderate" | "sedentary" | "unknown";
  /** Predicted impact on vagal readiness */
  vagalImpact: "positive" | "neutral" | "negative" | "unknown";
  /** Insight message */
  insightMessage: string;
}

// Sleep thresholds
const GOOD_SLEEP_HOURS = 7;
const POOR_SLEEP_HOURS = 5;

// Step thresholds
const ACTIVE_STEPS = 8000;
const SEDENTARY_STEPS = 3000;

// Health permissions status
let healthPermissionsGranted = false;
let healthKitAvailable = false;

/**
 * Initialize health service and request permissions
 */
export async function initializeHealthService(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") {
      // iOS: HealthKit
      // In production, use react-native-health:
      // import AppleHealthKit from 'react-native-health';
      // const permissions = {
      //   permissions: {
      //     read: [
      //       AppleHealthKit.Constants.Permissions.SleepAnalysis,
      //       AppleHealthKit.Constants.Permissions.StepCount,
      //     ],
      //   },
      // };
      // return new Promise((resolve) => {
      //   AppleHealthKit.initHealthKit(permissions, (error) => {
      //     if (error) {
      //       console.error('HealthKit init error:', error);
      //       resolve(false);
      //     }
      //     healthPermissionsGranted = true;
      //     healthKitAvailable = true;
      //     resolve(true);
      //   });
      // });

      // Mock for development
      console.log("[HealthService] iOS HealthKit - Mock enabled");
      healthKitAvailable = true;
      healthPermissionsGranted = true;
      return true;
    } else if (Platform.OS === "android") {
      // Android: Google Fit
      // In production, use react-native-google-fit:
      // import GoogleFit from 'react-native-google-fit';
      // const options = {
      //   scopes: [
      //     Scopes.FITNESS_ACTIVITY_READ,
      //     Scopes.FITNESS_SLEEP_READ,
      //   ],
      // };
      // const authResult = await GoogleFit.authorize(options);
      // healthPermissionsGranted = authResult.success;
      // return authResult.success;

      // Mock for development
      console.log("[HealthService] Android Google Fit - Mock enabled");
      healthPermissionsGranted = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error("[HealthService] Init error:", error);
    return false;
  }
}

/**
 * Check if health permissions are granted
 */
export function hasHealthPermissions(): boolean {
  return healthPermissionsGranted;
}

/**
 * Get sleep data for the last 24 hours
 */
export async function getSleepData(): Promise<SleepData> {
  if (!healthPermissionsGranted) {
    return {
      totalHours: 0,
      qualityScore: 0,
      bedTime: null,
      wakeTime: null,
      available: false,
    };
  }

  try {
    // In production, use actual health API:
    // iOS (HealthKit):
    // const options = {
    //   startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    //   endDate: new Date().toISOString(),
    // };
    // const sleepSamples = await AppleHealthKit.getSleepSamples(options);
    // Calculate total hours from samples...

    // Mock data for development
    const mockHours = 5 + Math.random() * 4; // 5-9 hours
    const mockQuality = 40 + Math.random() * 50; // 40-90 score

    return {
      totalHours: Math.round(mockHours * 10) / 10,
      qualityScore: Math.round(mockQuality),
      bedTime: "23:30",
      wakeTime: "07:15",
      available: true,
    };
  } catch (error) {
    console.error("[HealthService] Get sleep data error:", error);
    return {
      totalHours: 0,
      qualityScore: 0,
      bedTime: null,
      wakeTime: null,
      available: false,
    };
  }
}

/**
 * Get step count data
 */
export async function getStepData(): Promise<StepData> {
  if (!healthPermissionsGranted) {
    return {
      todaySteps: 0,
      weeklyAverage: 0,
      available: false,
    };
  }

  try {
    // In production, use actual health API:
    // iOS (HealthKit):
    // const options = {
    //   startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    //   endDate: new Date().toISOString(),
    // };
    // const steps = await AppleHealthKit.getStepCount(options);

    // Mock data for development
    const mockTodaySteps = Math.floor(2000 + Math.random() * 10000); // 2k-12k steps
    const mockWeeklyAvg = Math.floor(4000 + Math.random() * 6000); // 4k-10k average

    return {
      todaySteps: mockTodaySteps,
      weeklyAverage: mockWeeklyAvg,
      available: true,
    };
  } catch (error) {
    console.error("[HealthService] Get step data error:", error);
    return {
      todaySteps: 0,
      weeklyAverage: 0,
      available: false,
    };
  }
}

/**
 * Categorize sleep quality
 */
export function categorizeSleep(hours: number): "good" | "moderate" | "poor" | "unknown" {
  if (hours === 0) return "unknown";
  if (hours >= GOOD_SLEEP_HOURS) return "good";
  if (hours >= POOR_SLEEP_HOURS) return "moderate";
  return "poor";
}

/**
 * Categorize activity level
 */
export function categorizeActivity(steps: number): "active" | "moderate" | "sedentary" | "unknown" {
  if (steps === 0) return "unknown";
  if (steps >= ACTIVE_STEPS) return "active";
  if (steps >= SEDENTARY_STEPS) return "moderate";
  return "sedentary";
}

/**
 * Generate health correlation with vagal readiness
 */
export async function getHealthCorrelation(): Promise<HealthCorrelation> {
  const sleepData = await getSleepData();
  const stepData = await getStepData();

  const sleepCategory = categorizeSleep(sleepData.totalHours);
  const activityCategory = categorizeActivity(stepData.todaySteps);

  // Determine vagal impact based on sleep and activity
  let vagalImpact: "positive" | "neutral" | "negative" | "unknown" = "unknown";
  let insightMessage = "";

  if (!sleepData.available && !stepData.available) {
    vagalImpact = "unknown";
    insightMessage = "Connect to Apple Health to see how sleep and activity affect your vagal readiness.";
  } else if (sleepCategory === "poor") {
    vagalImpact = "negative";
    insightMessage = `You got ${sleepData.totalHours.toFixed(1)} hours of sleep. Poor sleep reduces vagal tone. Consider a relaxation session before recording.`;
  } else if (sleepCategory === "good" && activityCategory === "active") {
    vagalImpact = "positive";
    insightMessage = `Great! ${sleepData.totalHours.toFixed(1)} hours of sleep and ${stepData.todaySteps.toLocaleString()} steps. Your body is primed for good vagal readiness.`;
  } else if (activityCategory === "sedentary") {
    vagalImpact = "neutral";
    insightMessage = `Only ${stepData.todaySteps.toLocaleString()} steps today. Light movement before recording can improve vagal tone.`;
  } else {
    vagalImpact = "neutral";
    insightMessage = `${sleepData.totalHours.toFixed(1)} hours of sleep, ${stepData.todaySteps.toLocaleString()} steps. Moderate conditions for vagal activity.`;
  }

  return {
    sleepCategory,
    activityCategory,
    vagalImpact,
    insightMessage,
  };
}

/**
 * Generate insight message for daily summary
 */
export function generateHealthInsight(
  sleepHours: number,
  steps: number,
  vrsScore: number
): string {
  const sleepCategory = categorizeSleep(sleepHours);

  if (sleepCategory === "poor" && vrsScore < 50) {
    return `Your low sleep (${sleepHours.toFixed(1)}h) correlates with your lower Vagal Readiness Score. Prioritizing sleep may improve your gut-brain connection.`;
  }

  if (sleepCategory === "good" && vrsScore >= 70) {
    return `Good sleep (${sleepHours.toFixed(1)}h) is supporting your strong Vagal Readiness. Keep up the healthy sleep habits!`;
  }

  if (steps < SEDENTARY_STEPS && vrsScore < 50) {
    return `Low activity today (${steps.toLocaleString()} steps) may be affecting your vagal tone. Even a short walk can help activate the parasympathetic system.`;
  }

  return `Your health metrics: ${sleepHours.toFixed(1)}h sleep, ${steps.toLocaleString()} steps. Track consistently to discover your personal patterns.`;
}
