/**
 * Biomarker Interpretation Utilities
 *
 * Functions to interpret gut, heart, vagal, and breathing metrics
 * and generate user-friendly insights.
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type MetricColor = "green" | "yellow" | "red" | "blue";

export interface MetricDisplay {
  label: string;
  value: string;
  subValue?: string;
  interpretation: string;
  progress?: number; // 0-100 for progress bar
  color: MetricColor;
}

export interface OverallScoreResult {
  score: number;
  state: string;
  emoji: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// OVERALL SCORE CALCULATION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall gut-brain balance score from all biomarkers
 */
export function calculateOverallScore(
  gutEventsPerMin: number | undefined,
  heartBpm: number | undefined,
  vagalTone: number | undefined,
  breathingCoherence: number | undefined,
  inhaleExhaleRatio: number | undefined
): OverallScoreResult {
  let totalWeight = 0;
  let weightedSum = 0;

  // Gut: 3-25/min is healthy range
  if (gutEventsPerMin !== undefined) {
    const gutScore =
      gutEventsPerMin >= 3 && gutEventsPerMin <= 25
        ? 80
        : gutEventsPerMin >= 1 && gutEventsPerMin <= 30
          ? 60
          : 40;
    weightedSum += gutScore * 0.2;
    totalWeight += 0.2;
  }

  // Heart: 55-85 BPM at rest is optimal
  if (heartBpm !== undefined) {
    const heartScore =
      heartBpm >= 55 && heartBpm <= 85
        ? 80
        : heartBpm >= 50 && heartBpm <= 95
          ? 60
          : 40;
    weightedSum += heartScore * 0.2;
    totalWeight += 0.2;
  }

  // Vagal tone is already 0-100
  if (vagalTone !== undefined) {
    weightedSum += vagalTone * 0.35;
    totalWeight += 0.35;
  }

  // Breathing: coherence + good ratio (exhale >= inhale is calming)
  if (breathingCoherence !== undefined || inhaleExhaleRatio !== undefined) {
    const coherenceScore = breathingCoherence ?? 50;
    const ratioScore =
      inhaleExhaleRatio !== undefined
        ? inhaleExhaleRatio <= 1.0
          ? 80
          : inhaleExhaleRatio <= 1.2
            ? 70
            : 60
        : 70;
    const breathScore = (coherenceScore + ratioScore) / 2;
    weightedSum += breathScore * 0.25;
    totalWeight += 0.25;
  }

  // Calculate overall (normalize if not all metrics available)
  const overall =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  let state: string;
  let emoji: string;

  if (overall >= 75) {
    state = "Relaxed State";
    emoji = "\uD83D\uDE0C"; // 😌
  } else if (overall >= 55) {
    state = "Balanced State";
    emoji = "\uD83D\uDE42"; // 🙂
  } else if (overall >= 35) {
    state = "Mild Stress";
    emoji = "\uD83D\uDE10"; // 😐
  } else {
    state = "Elevated Stress";
    emoji = "\uD83D\uDE1F"; // 😟
  }

  return { score: overall, state, emoji };
}

// ════════════════════════════════════════════════════════════════════════════════
// GUT INTERPRETATION
// ════════════════════════════════════════════════════════════════════════════════

export function interpretGut(
  eventsPerMin: number,
  motilityIndex: number
): MetricDisplay {
  let interpretation: string;
  let color: MetricColor;

  if (eventsPerMin >= 8 && eventsPerMin <= 20) {
    interpretation = "Active, healthy digestion";
    color = "green";
  } else if (eventsPerMin >= 3 && eventsPerMin < 8) {
    interpretation = "Normal digestive activity";
    color = "green";
  } else if (eventsPerMin > 20 && eventsPerMin <= 30) {
    interpretation = "Very active gut sounds";
    color = "yellow";
  } else if (eventsPerMin < 3) {
    interpretation = "Quiet gut - may be between meals";
    color = "blue";
  } else {
    interpretation = "Unusually high activity";
    color = "yellow";
  }

  return {
    label: "Gut Activity",
    value: `${eventsPerMin.toFixed(1)} sounds/min`,
    interpretation,
    progress: Math.min(100, motilityIndex),
    color,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// HEART RATE INTERPRETATION
// ════════════════════════════════════════════════════════════════════════════════

export function interpretHeartRate(heartBpm: number): MetricDisplay {
  let interpretation: string;
  let color: MetricColor;

  if (heartBpm >= 55 && heartBpm <= 70) {
    interpretation = "Calm resting rate";
    color = "green";
  } else if (heartBpm > 70 && heartBpm <= 85) {
    interpretation = "Normal resting rate";
    color = "green";
  } else if (heartBpm > 85 && heartBpm <= 100) {
    interpretation = "Slightly elevated";
    color = "yellow";
  } else if (heartBpm > 100) {
    interpretation = "Elevated - may indicate stress";
    color = "red";
  } else if (heartBpm < 55 && heartBpm >= 45) {
    interpretation = "Athletic resting rate";
    color = "green";
  } else {
    interpretation = "Unusually low";
    color = "yellow";
  }

  // Progress: 50-100 BPM mapped to 0-100%
  const progress = Math.max(0, Math.min(100, ((heartBpm - 50) / 50) * 100));

  return {
    label: "Heart Rate",
    value: `${Math.round(heartBpm)} BPM`,
    interpretation,
    progress,
    color,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// VAGAL TONE INTERPRETATION
// ════════════════════════════════════════════════════════════════════════════════

export function interpretVagalTone(vagalScore: number): MetricDisplay {
  let interpretation: string;
  let color: MetricColor;

  if (vagalScore >= 70) {
    interpretation = "Strong parasympathetic activation";
    color = "green";
  } else if (vagalScore >= 50) {
    interpretation = "Good vagal tone";
    color = "green";
  } else if (vagalScore >= 30) {
    interpretation = "Moderate vagal activity";
    color = "yellow";
  } else {
    interpretation = "Low vagal tone - try breathing exercises";
    color = "red";
  }

  return {
    label: "Vagal Tone",
    value: `${vagalScore}/100`,
    interpretation,
    progress: vagalScore,
    color,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// BREATHING INTERPRETATION
// ════════════════════════════════════════════════════════════════════════════════

export function interpretBreathing(
  breathsPerMin: number,
  inhaleMs: number,
  exhaleMs: number,
  ratio: number,
  coherence: number,
  pattern: string
): MetricDisplay {
  let interpretation: string;
  let color: MetricColor;

  // Check rate
  if (breathsPerMin > 20) {
    interpretation = "Rapid breathing - try slowing down";
    color = "yellow";
  } else if (breathsPerMin < 8) {
    interpretation = "Very slow, deep relaxation";
    color = "green";
  } else if (breathsPerMin >= 8 && breathsPerMin <= 14) {
    interpretation = "Optimal relaxed breathing";
    color = "green";
  } else {
    interpretation = "Normal breathing rate";
    color = "green";
  }

  // Check ratio
  if (ratio <= 0.8) {
    interpretation += " \u2022 Extended exhale boosting vagal tone";
  } else if (ratio > 1.2) {
    interpretation += " \u2022 Short exhale may indicate tension";
    if (color === "green") color = "yellow";
  }

  const inhaleSec = (inhaleMs / 1000).toFixed(1);
  const exhaleSec = (exhaleMs / 1000).toFixed(1);
  const ratioDisplay = ratio <= 1 ? `1:${(1 / ratio).toFixed(1)}` : `${ratio.toFixed(1)}:1`;

  return {
    label: "Breathing",
    value: `${breathsPerMin.toFixed(1)} breaths/min`,
    subValue: `In ${inhaleSec}s \u2192 Out ${exhaleSec}s (${ratioDisplay})`,
    interpretation,
    progress: coherence,
    color,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// INSIGHT GENERATOR
// ════════════════════════════════════════════════════════════════════════════════

export function generateInsight(
  gutEvents: number | undefined,
  heartBpm: number | undefined,
  vagalTone: number | undefined,
  breathsPerMin: number | undefined,
  inhaleExhaleRatio: number | undefined,
  breathingCoherence: number | undefined
): string {
  // Extended exhale + good vagal = optimal gut-brain
  if (
    inhaleExhaleRatio !== undefined &&
    inhaleExhaleRatio <= 1.0 &&
    vagalTone !== undefined &&
    vagalTone >= 60
  ) {
    return (
      "Your extended exhale is activating the vagus nerve, " +
      "supporting healthy gut-brain communication. Keep it up!"
    );
  }

  // Good breathing but low vagal tone
  if (
    inhaleExhaleRatio !== undefined &&
    inhaleExhaleRatio <= 1.0 &&
    vagalTone !== undefined &&
    vagalTone < 50
  ) {
    return (
      "Your breathing pattern is good. With continued practice, " +
      "your vagal tone should improve over time."
    );
  }

  // Rapid breathing + low vagal + high heart
  if (
    breathsPerMin !== undefined &&
    breathsPerMin > 18 &&
    vagalTone !== undefined &&
    vagalTone < 50 &&
    heartBpm !== undefined &&
    heartBpm > 85
  ) {
    return (
      "Your body shows stress signals: rapid breathing, lower vagal tone, " +
      "and elevated heart rate. Try 4-7-8 breathing to activate calm."
    );
  }

  // High coherence breathing
  if (breathingCoherence !== undefined && breathingCoherence >= 70) {
    return (
      "Your breathing is very rhythmic and coherent. " +
      "This regularity helps optimize heart-brain synchronization."
    );
  }

  // Short exhale pattern
  if (inhaleExhaleRatio !== undefined && inhaleExhaleRatio > 1.2) {
    return (
      "Extending your exhale longer than your inhale can boost " +
      "vagal tone. Try breathing out for twice as long as you breathe in."
    );
  }

  // Good overall state
  if (
    vagalTone !== undefined &&
    vagalTone >= 60 &&
    gutEvents !== undefined &&
    gutEvents >= 3 &&
    gutEvents <= 20
  ) {
    return (
      "Your gut-brain connection appears well-balanced. " +
      "Regular monitoring helps you understand your patterns."
    );
  }

  // Low gut activity
  if (gutEvents !== undefined && gutEvents < 3) {
    return (
      "Gut activity is quiet, which is normal between meals or " +
      "during deep relaxation. Try recording after eating for comparison."
    );
  }

  // Default
  return "Recording complete. Compare multiple sessions to see your trends.";
}
