/**
 * NeuroGut Insight Engine
 *
 * Provides automated insights by comparing current filtered data
 * against global averages to identify significant patterns.
 *
 * IMPORTANT: These are suggestions for self-tracking only, not medical advice.
 */

import { DailyAverages, getSessionsWithAnalytics } from "../storage/sessionStore";
import { SymptomTag, StateOfMind, GutRecordingSession, VagalIntervention } from "../models/session";

export interface Insight {
  type: "success" | "info" | "warning";
  message: string;
  percentageChange: number;
}

/**
 * Calculate average motility index from daily averages
 *
 * @param dailyAverages Array of daily averages
 * @returns Average motility index, or null if no data
 */
function calculateAverageMotility(
  dailyAverages: DailyAverages[]
): number | null {
  if (dailyAverages.length === 0) {
    return null;
  }

  const totalSessions = dailyAverages.reduce(
    (sum, day) => sum + day.sessionCount,
    0
  );

  if (totalSessions === 0) {
    return null;
  }

  // Weighted average: sum of (motility * sessionCount) / total sessions
  const weightedSum = dailyAverages.reduce(
    (sum, day) => sum + day.avgMotilityIndex * day.sessionCount,
    0
  );

  return weightedSum / totalSessions;
}

/**
 * Generate insight comparing current selection against global average
 *
 * @param currentData Daily averages for current selection (filtered)
 * @param globalData Daily averages for all time (unfiltered)
 * @param selectedTags Currently selected symptom tags (for context in message)
 * @returns Insight object with type, message, and percentage change, or null if insufficient data
 */
export function generateInsight(
  currentData: DailyAverages[],
  globalData: DailyAverages[],
  selectedTags: SymptomTag[] = []
): Insight | null {
  // Handle edge cases: no data
  if (currentData.length === 0 || globalData.length === 0) {
    return null;
  }

  const currentAvg = calculateAverageMotility(currentData);
  const globalAvg = calculateAverageMotility(globalData);

  // Handle divide by zero: if global average is 0 or null, can't calculate percentage
  if (currentAvg === null || globalAvg === null || globalAvg === 0) {
    return null;
  }

  // Calculate percentage change
  const percentageChange = ((currentAvg - globalAvg) / globalAvg) * 100;

  // Threshold: 15% change is considered significant
  const SIGNIFICANCE_THRESHOLD = 15;

  // If change is less than threshold, no insight
  if (Math.abs(percentageChange) < SIGNIFICANCE_THRESHOLD) {
    return null;
  }

  // Determine insight type and message
  const isHigher = percentageChange > 0;
  const absPercentage = Math.abs(percentageChange);
  const roundedPercentage = Math.round(absPercentage);

  // Build context string for message
  let contextString = "";
  if (selectedTags.length > 0) {
    if (selectedTags.length === 1) {
      contextString = `'${selectedTags[0]}' sessions`;
    } else if (selectedTags.length === 2) {
      contextString = `'${selectedTags[0]}' and '${selectedTags[1]}' sessions`;
    } else {
      contextString = `${selectedTags.length} selected symptom sessions`;
    }
  } else {
    contextString = "this period";
  }

  if (isHigher) {
    // Higher motility = success (green)
    return {
      type: "success",
      message: `During ${contextString}, your motility index is ${roundedPercentage}% higher than your average. This suggests increased gut activity.`,
      percentageChange: roundedPercentage,
    };
  } else {
    // Lower motility = warning/info (teal/blue)
    // Use info (blue) for lower motility as it's informational, not necessarily bad
    return {
      type: "info",
      message: `During ${contextString}, your motility index is ${roundedPercentage}% lower than your average. Consider breathing protocols before recording.`,
      percentageChange: -roundedPercentage,
    };
  }
}

/**
 * Compare motility averages across different States of Mind
 *
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @returns Insight message comparing states, or null if insufficient data
 * @throws Error if patientId is not provided
 */
export async function generateMindBodyInsight(
  patientId: string
): Promise<Insight | null> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required for insight generation. This prevents cross-patient data leaks.");
  }

  const sessions = await getSessionsWithAnalytics(patientId);
  
  if (sessions.length === 0) {
    return null;
  }

  // Group sessions by state of mind
  const sessionsByState = new Map<StateOfMind, GutRecordingSession[]>();
  
  sessions.forEach((session) => {
    // Handle backward compatibility: sessions without stateOfMind default to "Calm"
    const state = session.context.stateOfMind || "Calm";
    if (!sessionsByState.has(state)) {
      sessionsByState.set(state, []);
    }
    sessionsByState.get(state)!.push(session);
  });

  // Need at least 2 different states with data
  if (sessionsByState.size < 2) {
    return null;
  }

  // Calculate average motility for each state
  const stateAverages = new Map<StateOfMind, number>();
  
  sessionsByState.forEach((stateSessions, state) => {
    const sessionsWithAnalytics = stateSessions.filter((s) => s.analytics !== null);
    if (sessionsWithAnalytics.length === 0) {
      return;
    }
    
    const avgMotility = sessionsWithAnalytics.reduce(
      (sum, s) => sum + (s.analytics?.motilityIndex || 0),
      0
    ) / sessionsWithAnalytics.length;
    
    stateAverages.set(state, avgMotility);
  });

  if (stateAverages.size < 2) {
    return null;
  }

  // Find highest and lowest states
  let highestState: StateOfMind | null = null;
  let highestAvg = 0;
  let lowestState: StateOfMind | null = null;
  let lowestAvg = Infinity;

  stateAverages.forEach((avg, state) => {
    if (avg > highestAvg) {
      highestAvg = avg;
      highestState = state;
    }
    if (avg < lowestAvg) {
      lowestAvg = avg;
      lowestState = state;
    }
  });

  if (!highestState || !lowestState || highestState === lowestState) {
    return null;
  }

  // Calculate percentage difference
  if (lowestAvg === 0) {
    return null; // Avoid divide by zero
  }

  const percentageDiff = ((highestAvg - lowestAvg) / lowestAvg) * 100;
  const roundedPercentage = Math.round(percentageDiff);

  // Only show if difference is significant (15% threshold)
  if (roundedPercentage < 15) {
    return null;
  }

  // Determine if higher is better (Calm typically associated with better gut health)
  const isCalmHigher = highestState === "Calm";
  const isAnxiousLower = lowestState === "Anxious";

  if (isCalmHigher && isAnxiousLower) {
    return {
      type: "success",
      message: `Your gut is ${roundedPercentage}% more active when you are 'Calm' vs 'Anxious'. This suggests a positive mind-body connection.`,
      percentageChange: roundedPercentage,
    };
  } else {
    return {
      type: "info",
      message: `Your gut is ${roundedPercentage}% more active when you are '${highestState}' vs '${lowestState}'. Track patterns to understand your gut-brain connection.`,
      percentageChange: roundedPercentage,
    };
  }
}

/**
 * Biofeedback result from before/after comparison within a single session
 */
export interface BiofeedbackResult {
  success: boolean;
  percentageChange: number;
  beforeMotility: number;
  afterMotility: number;
  message: string;
}

/**
 * Analyze before/after motility shift in a single session with intervention
 *
 * @param session - Session with analytics and intervention data
 * @returns BiofeedbackResult with success status and percentage change, or null if insufficient data
 */
export function analyzeBiofeedback(
  session: GutRecordingSession
): BiofeedbackResult | null {
  // Need analytics and intervention data (either vagalBreathing or intervention in context)
  const hasIntervention = session.vagalBreathing?.enabled || 
    (session.context.intervention && session.context.intervention !== "None");
  
  if (!session.analytics || !hasIntervention) {
    return null;
  }

  // Get intervention start time (from vagalBreathing or default to 30 seconds)
  const interventionStartTime = session.vagalBreathing?.startTimeSeconds || 30;
  if (interventionStartTime <= 0) {
    return null;
  }
  
  const interventionType = session.context.intervention || "Deep Breathing";

  // For now, we use a simplified approach:
  // Compare the overall motility index before and after breathing
  // In a real implementation, we would analyze the activity timeline
  // and split it into before/after segments

  // Since we don't have granular timeline data in the current analytics,
  // we'll use a heuristic: if breathing started after 30% of the session,
  // we can estimate before/after based on the activity timeline

  const totalDuration = session.durationSeconds;
  const interventionStartPercent = interventionStartTime / totalDuration;

  // Need at least 30% of session before intervention starts
  if (interventionStartPercent < 0.3 || interventionStartPercent > 0.7) {
    return null; // Not enough data for comparison
  }

  // Estimate before/after motility from activity timeline
  const timeline = session.analytics.activityTimeline;
  if (!timeline || timeline.length === 0) {
    return null;
  }

  const beforeSegmentEnd = Math.floor(timeline.length * interventionStartPercent);
  const beforeSegment = timeline.slice(0, beforeSegmentEnd);
  const afterSegment = timeline.slice(beforeSegmentEnd);

  if (beforeSegment.length === 0 || afterSegment.length === 0) {
    return null;
  }

  // Calculate average activity for before and after
  const beforeAvg =
    beforeSegment.reduce((sum, val) => sum + val, 0) / beforeSegment.length;
  const afterAvg =
    afterSegment.reduce((sum, val) => sum + val, 0) / afterSegment.length;

  // Convert activity levels to estimated motility index
  // Activity timeline is 0-100, motility index is also 0-100
  // We'll use a simple mapping: activity level ≈ motility contribution
  const beforeMotility = Math.round(beforeAvg);
  const afterMotility = Math.round(afterAvg);

  if (beforeMotility === 0) {
    return null; // Avoid divide by zero
  }

  // Calculate percentage change
  const percentageChange = ((afterMotility - beforeMotility) / beforeMotility) * 100;
  const roundedChange = Math.round(percentageChange);

  // Success threshold: at least 10% increase
  const success = roundedChange >= 10;

  let message: string;
  if (success) {
    message = `Your breathing protocol increased your motility index by ${roundedChange}% in this session!`;
  } else if (roundedChange > 0) {
    message = `Your breathing protocol increased motility by ${roundedChange}%. Keep practicing for better results.`;
  } else {
    message = `Motility changed by ${roundedChange}% during breathing. Try different breathing patterns.`;
  }

  return {
    success,
    percentageChange: roundedChange,
    beforeMotility,
    afterMotility,
    message,
  };
}

/**
 * Intervention effectiveness result
 */
export interface InterventionEffectiveness {
  intervention: VagalIntervention;
  averageIncrease: number;
  sessionCount: number;
  successRate: number; // Percentage of sessions with ≥10% increase
}

/**
 * Get intervention rankings by their effectiveness for the user
 *
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @returns Array of interventions sorted by effectiveness, or empty array if insufficient data
 * @throws Error if patientId is not provided
 */
export async function getInterventionRankings(
  patientId: string
): Promise<InterventionEffectiveness[]> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required for intervention rankings. This prevents cross-patient data leaks.");
  }

  const sessions = await getSessionsWithAnalytics(patientId);
  
  // Filter sessions with interventions
  const interventionSessions = sessions.filter(
    (s) => s.context.intervention && s.context.intervention !== "None"
  );
  
  if (interventionSessions.length === 0) {
    return [];
  }
  
  // Group sessions by intervention type
  const sessionsByIntervention = new Map<VagalIntervention, GutRecordingSession[]>();
  
  interventionSessions.forEach((session) => {
    const intervention = session.context.intervention!;
    if (!sessionsByIntervention.has(intervention)) {
      sessionsByIntervention.set(intervention, []);
    }
    sessionsByIntervention.get(intervention)!.push(session);
  });
  
  // Calculate effectiveness for each intervention
  const effectiveness: InterventionEffectiveness[] = [];
  
  sessionsByIntervention.forEach((sessions, intervention) => {
    const sessionsWithResults = sessions
      .filter((s) => s.analytics && (s.vagalBreathing?.enabled || (s.context.intervention && s.context.intervention !== "None")))
      .map((s) => analyzeBiofeedback(s))
      .filter((result): result is BiofeedbackResult => result !== null);
    
    if (sessionsWithResults.length === 0) {
      return; // Skip interventions without valid biofeedback data
    }
    
    const totalIncrease = sessionsWithResults.reduce(
      (sum, result) => sum + result.percentageChange,
      0
    );
    const averageIncrease = totalIncrease / sessionsWithResults.length;
    
    const successfulSessions = sessionsWithResults.filter((r) => r.success).length;
    const successRate = (successfulSessions / sessionsWithResults.length) * 100;
    
    effectiveness.push({
      intervention,
      averageIncrease: Math.round(averageIncrease * 10) / 10,
      sessionCount: sessionsWithResults.length,
      successRate: Math.round(successRate),
    });
  });
  
  // Sort by average increase (descending)
  effectiveness.sort((a, b) => b.averageIncrease - a.averageIncrease);
  
  return effectiveness;
}

/**
 * Generate insight message comparing intervention effectiveness
 *
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @returns Insight message ranking interventions, or null if insufficient data
 * @throws Error if patientId is not provided
 */
export async function generateInterventionInsight(
  patientId: string
): Promise<Insight | null> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required for insight generation. This prevents cross-patient data leaks.");
  }

  const rankings = await getInterventionRankings(patientId);
  
  if (rankings.length < 2) {
    return null; // Need at least 2 interventions to compare
  }
  
  const topIntervention = rankings[0];
  const secondIntervention = rankings[1];
  
  if (topIntervention.averageIncrease < 10) {
    return null; // No intervention shows significant improvement
  }
  
  const message = `For you, '${topIntervention.intervention}' increases motility by ${topIntervention.averageIncrease}%, while '${secondIntervention.intervention}' increases it by ${secondIntervention.averageIncrease}%.`;
  
  return {
    type: "success",
    message,
    percentageChange: Math.round(topIntervention.averageIncrease),
  };
}
