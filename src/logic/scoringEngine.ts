/**
 * Vagal Readiness Scoring Engine
 *
 * Calculates a Vagal Readiness Score (0-100) based on:
 * 1. Current Motility vs 7-day Baseline (40% weight)
 * 2. Rhythmicity Index - consistency of gut activity patterns (30% weight)
 * 3. Delta increase after 4-7-8 intervention (30% weight)
 *
 * CLINICAL CONTEXT:
 * - Higher scores indicate better vagal tone and parasympathetic activity
 * - Tracks the gut-brain axis responsiveness over time
 * - Used to measure intervention effectiveness
 */

import { GutRecordingSession, SessionAnalytics } from "../models/session";
import { getSessionsSortedByDate, getSessionsWithAnalytics } from "../storage/sessionStore";

// Scoring weights
const BASELINE_WEIGHT = 0.40;
const RHYTHMICITY_WEIGHT = 0.30;
const INTERVENTION_WEIGHT = 0.30;

// Scoring thresholds
const EXCELLENT_THRESHOLD = 80;
const GOOD_THRESHOLD = 60;
const MODERATE_THRESHOLD = 40;

export type VagalReadinessCategory = "excellent" | "good" | "moderate" | "developing";

export interface VagalReadinessScore {
  /** Overall score 0-100 */
  score: number;
  /** Category based on score */
  category: VagalReadinessCategory;
  /** Component scores */
  components: {
    /** Current vs 7-day baseline component (0-100) */
    baselineComponent: number;
    /** Rhythmicity index component (0-100) */
    rhythmicityComponent: number;
    /** Intervention delta component (0-100) */
    interventionComponent: number;
  };
  /** 7-day baseline motility average */
  baselineMotility: number;
  /** Current session motility */
  currentMotility: number;
  /** Percentage change from baseline */
  changeFromBaseline: number;
  /** Number of sessions in baseline calculation */
  baselineSessionCount: number;
  /** Timestamp of calculation */
  calculatedAt: string;
}

export interface RhythmicityAnalysis {
  /** Rhythmicity index 0-100 (higher = more consistent patterns) */
  index: number;
  /** Coefficient of variation of activity timeline */
  activityCV: number;
  /** Event frequency consistency */
  frequencyConsistency: number;
  /** Active/quiet ratio stability */
  ratioStability: number;
}

/**
 * Calculate the Rhythmicity Index from session analytics
 * Measures consistency and regularity of gut activity patterns
 *
 * @param analytics - Session analytics data
 * @returns RhythmicityAnalysis with index 0-100
 */
export function calculateRhythmicityIndex(analytics: SessionAnalytics): RhythmicityAnalysis {
  const timeline = analytics.activityTimeline;

  if (!timeline || timeline.length === 0) {
    return {
      index: 50, // Default neutral value
      activityCV: 0,
      frequencyConsistency: 50,
      ratioStability: 50,
    };
  }

  // 1. Calculate Coefficient of Variation of activity timeline
  const mean = timeline.reduce((a, b) => a + b, 0) / timeline.length;
  const variance = timeline.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / timeline.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

  // Lower CV = more rhythmic (consistent activity)
  // CV of 0-30 = excellent, 30-60 = good, 60-100 = moderate, >100 = irregular
  const activityCV = cv;
  const cvScore = Math.max(0, Math.min(100, 100 - cv));

  // 2. Frequency consistency (events per minute stability)
  // Ideal EPM range is 5-15 for healthy gut activity
  const epm = analytics.eventsPerMinute;
  let frequencyScore: number;
  if (epm >= 5 && epm <= 15) {
    frequencyScore = 100; // Optimal range
  } else if (epm >= 3 && epm <= 20) {
    frequencyScore = 75; // Good range
  } else if (epm >= 1 && epm <= 25) {
    frequencyScore = 50; // Moderate range
  } else {
    frequencyScore = 25; // Outside normal range
  }

  // 3. Active/Quiet ratio stability
  // Ideal ratio is 30-60% active time for healthy digestion
  const activePercent = (analytics.totalActiveSeconds / (analytics.totalActiveSeconds + analytics.totalQuietSeconds)) * 100;
  let ratioScore: number;
  if (activePercent >= 30 && activePercent <= 60) {
    ratioScore = 100; // Optimal ratio
  } else if (activePercent >= 20 && activePercent <= 70) {
    ratioScore = 75; // Good ratio
  } else if (activePercent >= 10 && activePercent <= 80) {
    ratioScore = 50; // Moderate ratio
  } else {
    ratioScore = 25; // Extreme ratio
  }

  // Combined rhythmicity index (weighted average)
  const index = Math.round(
    (cvScore * 0.5) + // CV has highest weight
    (frequencyScore * 0.25) +
    (ratioScore * 0.25)
  );

  return {
    index: Math.max(0, Math.min(100, index)),
    activityCV,
    frequencyConsistency: frequencyScore,
    ratioStability: ratioScore,
  };
}

/**
 * Calculate intervention delta from biofeedback data
 * Measures the motility increase after 4-7-8 breathing or other vagal interventions
 *
 * @param session - Session with intervention data
 * @returns Delta score 0-100 (higher = better response to intervention)
 */
export function calculateInterventionDelta(session: GutRecordingSession): number {
  const analytics = session.analytics;
  const hasIntervention = session.context.intervention && session.context.intervention !== "None";
  const hasBreathingData = session.vagalBreathing?.enabled && session.vagalBreathing?.startTimeSeconds;

  if (!analytics || (!hasIntervention && !hasBreathingData)) {
    return 50; // Neutral score if no intervention
  }

  // Calculate before/after split from activity timeline
  const timeline = analytics.activityTimeline;
  if (!timeline || timeline.length < 4) {
    return 50;
  }

  // Intervention typically starts at 30 seconds (first 30% of recording is baseline)
  const interventionStartFraction = session.vagalBreathing?.startTimeSeconds
    ? (session.vagalBreathing.startTimeSeconds / session.durationSeconds)
    : 0.3; // Default 30% baseline

  const splitIndex = Math.floor(timeline.length * interventionStartFraction);

  if (splitIndex < 1 || splitIndex >= timeline.length - 1) {
    return 50;
  }

  // Calculate average activity before and after intervention
  const beforeSlice = timeline.slice(0, splitIndex);
  const afterSlice = timeline.slice(splitIndex);

  const beforeAvg = beforeSlice.reduce((a, b) => a + b, 0) / beforeSlice.length;
  const afterAvg = afterSlice.reduce((a, b) => a + b, 0) / afterSlice.length;

  if (beforeAvg === 0) {
    return afterAvg > 20 ? 75 : 50; // Some activity after intervention
  }

  // Calculate percentage change
  const percentChange = ((afterAvg - beforeAvg) / beforeAvg) * 100;

  // Convert to score (0-100)
  // +20% or more = 100, 0% = 50, -20% or less = 0
  let deltaScore: number;
  if (percentChange >= 20) {
    deltaScore = 100;
  } else if (percentChange >= 10) {
    deltaScore = 80 + ((percentChange - 10) / 10) * 20;
  } else if (percentChange >= 0) {
    deltaScore = 50 + (percentChange / 10) * 30;
  } else if (percentChange >= -10) {
    deltaScore = 30 + ((percentChange + 10) / 10) * 20;
  } else {
    deltaScore = Math.max(0, 30 + percentChange); // Clamp at 0
  }

  return Math.round(Math.max(0, Math.min(100, deltaScore)));
}

/**
 * Calculate 7-day baseline motility average
 *
 * @param patientId - Patient ID for filtering
 * @returns Average motility index over past 7 days
 */
export async function calculate7DayBaseline(patientId: string): Promise<{
  average: number;
  sessionCount: number;
  sessions: GutRecordingSession[];
}> {
  const sessions = await getSessionsWithAnalytics(patientId);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter to last 7 days
  const recentSessions = sessions.filter((s) => {
    const sessionDate = new Date(s.createdAt);
    return sessionDate >= sevenDaysAgo && s.analytics !== null;
  });

  if (recentSessions.length === 0) {
    return { average: 50, sessionCount: 0, sessions: [] }; // Neutral baseline
  }

  // Calculate average motility index
  const totalMotility = recentSessions.reduce(
    (sum, s) => sum + (s.analytics?.motilityIndex || 0),
    0
  );

  return {
    average: Math.round(totalMotility / recentSessions.length),
    sessionCount: recentSessions.length,
    sessions: recentSessions,
  };
}

/**
 * Calculate the complete Vagal Readiness Score
 *
 * Formula:
 * Score = (Baseline Component × 0.40) + (Rhythmicity × 0.30) + (Intervention Delta × 0.30)
 *
 * @param session - Current session to score
 * @param patientId - Patient ID for baseline calculation
 * @returns VagalReadinessScore with all components
 */
export async function calculateVagalReadinessScore(
  session: GutRecordingSession,
  patientId: string
): Promise<VagalReadinessScore | null> {
  if (!session.analytics) {
    return null;
  }

  // 1. Calculate 7-day baseline
  const baseline = await calculate7DayBaseline(patientId);
  const currentMotility = session.analytics.motilityIndex;
  const baselineMotility = baseline.average;

  // Calculate baseline component (current vs 7-day average)
  // +20% above baseline = 100, equal = 50, -20% below = 0
  let changeFromBaseline = 0;
  if (baselineMotility > 0) {
    changeFromBaseline = ((currentMotility - baselineMotility) / baselineMotility) * 100;
  }

  let baselineComponent: number;
  if (changeFromBaseline >= 20) {
    baselineComponent = 100;
  } else if (changeFromBaseline >= 0) {
    baselineComponent = 50 + (changeFromBaseline / 20) * 50;
  } else if (changeFromBaseline >= -20) {
    baselineComponent = 50 + (changeFromBaseline / 20) * 50;
  } else {
    baselineComponent = Math.max(0, 50 + (changeFromBaseline / 20) * 50);
  }

  baselineComponent = Math.round(Math.max(0, Math.min(100, baselineComponent)));

  // 2. Calculate Rhythmicity Index
  const rhythmicity = calculateRhythmicityIndex(session.analytics);
  const rhythmicityComponent = rhythmicity.index;

  // 3. Calculate Intervention Delta
  const interventionComponent = calculateInterventionDelta(session);

  // 4. Calculate weighted score
  const score = Math.round(
    (baselineComponent * BASELINE_WEIGHT) +
    (rhythmicityComponent * RHYTHMICITY_WEIGHT) +
    (interventionComponent * INTERVENTION_WEIGHT)
  );

  // 5. Determine category
  let category: VagalReadinessCategory;
  if (score >= EXCELLENT_THRESHOLD) {
    category = "excellent";
  } else if (score >= GOOD_THRESHOLD) {
    category = "good";
  } else if (score >= MODERATE_THRESHOLD) {
    category = "moderate";
  } else {
    category = "developing";
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    category,
    components: {
      baselineComponent,
      rhythmicityComponent,
      interventionComponent,
    },
    baselineMotility,
    currentMotility,
    changeFromBaseline: Math.round(changeFromBaseline),
    baselineSessionCount: baseline.sessionCount,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Get category label for UI display
 */
export function getVagalReadinessCategoryLabel(category: VagalReadinessCategory): string {
  switch (category) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "moderate":
      return "Moderate";
    case "developing":
      return "Developing";
  }
}

/**
 * Get category color for UI display
 */
export function getVagalReadinessCategoryColor(category: VagalReadinessCategory): string {
  switch (category) {
    case "excellent":
      return "#22C55E"; // success green
    case "good":
      return "#19E6C7"; // accent teal
    case "moderate":
      return "#F59E0B"; // warning amber
    case "developing":
      return "#3B82F6"; // info blue
  }
}

// ============================================================================
// HEALTH CORRELATION (Apple Health / Google Fit integration)
// ============================================================================

export interface HealthCorrelationData {
  sleepHours: number;
  stepCount: number;
  timestamp: string;
}

export interface DailyInsightWithHealth {
  vrsInsight: string;
  healthInsight: string | null;
  combinedInsight: string;
  sleepImpact: "positive" | "neutral" | "negative" | "unknown";
  activityImpact: "positive" | "neutral" | "negative" | "unknown";
}

// Sleep quality thresholds
const GOOD_SLEEP_HOURS = 7;
const POOR_SLEEP_HOURS = 5;

// Activity thresholds
const ACTIVE_STEPS = 8000;
const SEDENTARY_STEPS = 3000;

/**
 * Calculate sleep impact on vagal readiness
 */
export function calculateSleepImpact(sleepHours: number): "positive" | "neutral" | "negative" | "unknown" {
  if (sleepHours === 0) return "unknown";
  if (sleepHours >= GOOD_SLEEP_HOURS) return "positive";
  if (sleepHours >= POOR_SLEEP_HOURS) return "neutral";
  return "negative";
}

/**
 * Calculate activity impact on vagal readiness
 */
export function calculateActivityImpact(stepCount: number): "positive" | "neutral" | "negative" | "unknown" {
  if (stepCount === 0) return "unknown";
  if (stepCount >= ACTIVE_STEPS) return "positive";
  if (stepCount >= SEDENTARY_STEPS) return "neutral";
  return "negative";
}

/**
 * Generate daily insight with health correlation
 * Correlates sleep and activity data with VRS for comprehensive insights
 */
export function generateDailyInsightWithHealth(
  score: VagalReadinessScore,
  healthData: HealthCorrelationData | null
): DailyInsightWithHealth {
  const vrsInsight = generateVagalReadinessInsight(score);

  if (!healthData) {
    return {
      vrsInsight,
      healthInsight: null,
      combinedInsight: vrsInsight,
      sleepImpact: "unknown",
      activityImpact: "unknown",
    };
  }

  const sleepImpact = calculateSleepImpact(healthData.sleepHours);
  const activityImpact = calculateActivityImpact(healthData.stepCount);

  let healthInsight: string | null = null;

  // Generate health-specific insight
  if (sleepImpact === "negative" && score.category === "developing") {
    healthInsight = `Poor sleep (${healthData.sleepHours.toFixed(1)}h) may be contributing to low vagal readiness. Aim for 7+ hours tonight.`;
  } else if (sleepImpact === "negative" && score.category === "moderate") {
    healthInsight = `Your ${healthData.sleepHours.toFixed(1)}h of sleep could be affecting your score. Better rest often improves vagal tone.`;
  } else if (sleepImpact === "positive" && score.category === "excellent") {
    healthInsight = `Great sleep (${healthData.sleepHours.toFixed(1)}h) is supporting your excellent vagal readiness!`;
  } else if (activityImpact === "negative" && score.score < 50) {
    healthInsight = `Low activity (${healthData.stepCount.toLocaleString()} steps) may impact your gut-brain connection. A short walk before recording can help.`;
  } else if (activityImpact === "positive" && sleepImpact === "positive") {
    healthInsight = `Your healthy habits (${healthData.sleepHours.toFixed(1)}h sleep, ${healthData.stepCount.toLocaleString()} steps) are reflected in your vagal readiness.`;
  }

  // Generate combined insight
  let combinedInsight = vrsInsight;
  if (healthInsight) {
    combinedInsight = `${vrsInsight} ${healthInsight}`;
  }

  return {
    vrsInsight,
    healthInsight,
    combinedInsight,
    sleepImpact,
    activityImpact,
  };
}

/**
 * Generate insight message based on Vagal Readiness Score
 */
export function generateVagalReadinessInsight(score: VagalReadinessScore): string {
  const { category, changeFromBaseline, components } = score;

  if (category === "excellent") {
    if (components.interventionComponent >= 80) {
      return "Excellent vagal tone! Your body responds very well to breathing interventions. Keep up the consistent practice.";
    }
    return "Excellent vagal readiness. Your gut-brain axis is showing strong parasympathetic activity.";
  }

  if (category === "good") {
    if (changeFromBaseline > 10) {
      return "Good progress! Your motility is above your 7-day baseline. The interventions are helping.";
    }
    if (components.rhythmicityComponent >= 70) {
      return "Good rhythmicity patterns detected. Your gut activity is consistent and well-regulated.";
    }
    return "Good vagal readiness. Continue with regular practice to strengthen the gut-brain connection.";
  }

  if (category === "moderate") {
    if (components.interventionComponent < 50) {
      return "Try the 4-7-8 breathing technique for better vagal stimulation during your next session.";
    }
    if (components.rhythmicityComponent < 50) {
      return "Consider recording at consistent times to establish better gut rhythm patterns.";
    }
    return "Moderate vagal activity. Consistent daily practice can help improve your readiness score.";
  }

  // Developing
  if (score.baselineSessionCount < 3) {
    return "Building your baseline. Record a few more sessions this week to establish your patterns.";
  }
  return "Your vagal readiness is developing. Focus on relaxation before recording and try guided interventions.";
}
