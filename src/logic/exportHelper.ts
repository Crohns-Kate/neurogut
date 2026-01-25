/**
 * NeuroGut PDF Export Helper
 *
 * Generates professional PDF reports from session data for sharing with healthcare providers.
 * Uses expo-print for PDF generation (Expo-compatible, no native modules required).
 *
 * NG-V2-EVOLUTION: Added Trend Lines (Stress vs Motility) and Knowledge Base section
 *
 * IMPORTANT: This is for self-tracking and pattern finding only, NOT medical diagnosis.
 */

import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  GutRecordingSession,
  PROTOCOL_CONFIG,
  MEAL_TIMING_OPTIONS,
  POSTURE_OPTIONS,
  getMotilityCategory,
  getMotilityCategoryLabel,
} from "../models/session";
import { colors } from "../../styles/theme";
import { analyzeBiofeedback, BiofeedbackResult } from "./insightEngine";
import { getPatient } from "../storage/patientStore";
import { getSessionsWithAnalytics } from "../storage/sessionStore";
import {
  calculateVagalReadinessScore,
  VagalReadinessScore,
  getVagalReadinessCategoryLabel,
  getVagalReadinessCategoryColor,
} from "./scoringEngine";

/**
 * Knowledge Base - Clinical references for Acoustic Enterography and ANS
 */
const KNOWLEDGE_BASE = {
  acousticEnterography: {
    title: "Acoustic Enterography",
    content: `Acoustic enterography is a non-invasive technique that uses sound analysis to assess gastrointestinal motility.
    Bowel sounds (borborygmi) result from the movement of gas and fluid through the intestines during peristalsis.
    Analysis of acoustic patterns can provide insights into digestive function, with normal bowel sounds typically
    occurring 5-15 times per minute in healthy individuals.`,
    references: [
      "Tomomasa T, et al. Gastrointestinal sounds and migrating motor complex in fasted humans. Am J Gastroenterol. 1999;94(2):374-381.",
      "Craine BL, et al. Computerized auscultation applied to irritable bowel syndrome. Dig Dis Sci. 1999;44(3):583-589.",
    ],
  },
  autonomicNervousSystem: {
    title: "Autonomic Nervous System & Gut-Brain Axis",
    content: `The vagus nerve serves as the primary communication pathway between the brain and gut, comprising
    approximately 80% afferent (gut-to-brain) fibers. Vagal tone, measurable through heart rate variability (HRV),
    reflects parasympathetic nervous system activity. Higher vagal tone is associated with improved digestive function,
    reduced inflammation, and better stress resilience. The 4-7-8 breathing technique stimulates the vagus nerve
    through diaphragmatic engagement and extended exhale patterns.`,
    references: [
      "Breit S, et al. Vagus Nerve as Modulator of the Brain-Gut Axis in Psychiatric and Inflammatory Disorders. Front Psychiatry. 2018;9:44.",
      "Bonaz B, et al. The Vagus Nerve at the Interface of the Microbiota-Gut-Brain Axis. Front Neurosci. 2018;12:49.",
    ],
  },
  vagalInterventions: {
    title: "Vagal Stimulation Techniques",
    content: `Non-invasive vagal stimulation techniques include deep breathing exercises, cold exposure, humming/gargling,
    and meditation. The 4-7-8 breathing pattern (4-second inhale, 7-second hold, 8-second exhale) activates the
    parasympathetic nervous system through extended exhalation, which stimulates vagal afferents. Research suggests
    regular practice can improve vagal tone and modulate the gut-brain axis.`,
    references: [
      "Gerritsen RJS, Band GPH. Breath of Life: The Respiratory Vagal Stimulation Model of Contemplative Activity. Front Hum Neurosci. 2018;12:397.",
      "Ma X, et al. The Effect of Diaphragmatic Breathing on Attention, Negative Affect and Stress in Healthy Adults. Front Psychol. 2017;8:874.",
    ],
  },
};

/**
 * Generate trend data for Stress vs Motility correlation
 */
async function generateTrendData(
  patientId: string,
  dayLimit: number = 30
): Promise<{
  dataPoints: { date: string; stress: number; motility: number }[];
  correlation: string;
  summary: string;
}> {
  const sessions = await getSessionsWithAnalytics(patientId);

  const now = new Date();
  const cutoff = new Date(now.getTime() - dayLimit * 24 * 60 * 60 * 1000);

  // Filter to date range and group by date
  const dailyData: Map<string, { stressSum: number; motilitySum: number; count: number }> = new Map();

  sessions.forEach((session) => {
    const sessionDate = new Date(session.createdAt);
    if (sessionDate >= cutoff && session.analytics) {
      const dateKey = sessionDate.toISOString().split("T")[0];
      const existing = dailyData.get(dateKey) || { stressSum: 0, motilitySum: 0, count: 0 };
      dailyData.set(dateKey, {
        stressSum: existing.stressSum + session.context.stressLevel,
        motilitySum: existing.motilitySum + session.analytics.motilityIndex,
        count: existing.count + 1,
      });
    }
  });

  // Convert to array of data points
  const dataPoints: { date: string; stress: number; motility: number }[] = [];
  dailyData.forEach((data, date) => {
    dataPoints.push({
      date,
      stress: Math.round(data.stressSum / data.count),
      motility: Math.round(data.motilitySum / data.count),
    });
  });

  // Sort by date
  dataPoints.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate simple correlation direction
  let correlation = "neutral";
  let summary = "Not enough data to determine correlation.";

  if (dataPoints.length >= 3) {
    // Simple correlation: compare high-stress vs low-stress motility averages
    const avgStress = dataPoints.reduce((sum, p) => sum + p.stress, 0) / dataPoints.length;
    const highStressDays = dataPoints.filter((p) => p.stress > avgStress);
    const lowStressDays = dataPoints.filter((p) => p.stress <= avgStress);

    const highStressMotility =
      highStressDays.length > 0
        ? highStressDays.reduce((sum, p) => sum + p.motility, 0) / highStressDays.length
        : 0;
    const lowStressMotility =
      lowStressDays.length > 0
        ? lowStressDays.reduce((sum, p) => sum + p.motility, 0) / lowStressDays.length
        : 0;

    const diff = highStressMotility - lowStressMotility;

    if (diff < -10) {
      correlation = "inverse";
      summary = `Higher stress levels correlate with lower motility (${Math.round(lowStressMotility)} vs ${Math.round(highStressMotility)}). Consider stress management techniques.`;
    } else if (diff > 10) {
      correlation = "positive";
      summary = `Higher stress levels correlate with higher motility (${Math.round(highStressMotility)} vs ${Math.round(lowStressMotility)}). This may indicate stress-related gut activity.`;
    } else {
      correlation = "neutral";
      summary = `No strong correlation between stress and motility observed. Your gut activity appears relatively independent of reported stress levels.`;
    }
  }

  return { dataPoints, correlation, summary };
}

/**
 * Generate HTML for trend line SVG chart
 */
function generateTrendLineChart(
  dataPoints: { date: string; stress: number; motility: number }[]
): string {
  if (dataPoints.length < 2) {
    return '<p style="color: #666; font-style: italic;">Not enough data for trend visualization. Record more sessions to see patterns.</p>';
  }

  const chartWidth = 500;
  const chartHeight = 150;
  const padding = 40;

  // Normalize values to chart coordinates
  const maxMotility = Math.max(...dataPoints.map((p) => p.motility), 100);
  const maxStress = 10;

  const motilityPoints = dataPoints.map((p, i) => {
    const x = padding + (i / (dataPoints.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (p.motility / maxMotility) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  });

  const stressPoints = dataPoints.map((p, i) => {
    const x = padding + (i / (dataPoints.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (p.stress / maxStress) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  });

  return `
    <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}">
      <!-- Grid lines -->
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${chartHeight - padding}" stroke="#e0e0e0" stroke-width="1"/>
      <line x1="${padding}" y1="${chartHeight - padding}" x2="${chartWidth - padding}" y2="${chartHeight - padding}" stroke="#e0e0e0" stroke-width="1"/>

      <!-- Motility line (teal) -->
      <polyline points="${motilityPoints.join(" ")}" fill="none" stroke="#19E6C7" stroke-width="2"/>

      <!-- Stress line (amber) -->
      <polyline points="${stressPoints.join(" ")}" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="5,3"/>

      <!-- Legend -->
      <line x1="${chartWidth - 150}" y1="15" x2="${chartWidth - 130}" y2="15" stroke="#19E6C7" stroke-width="2"/>
      <text x="${chartWidth - 125}" y="19" font-size="11" fill="#666">Motility</text>

      <line x1="${chartWidth - 150}" y1="30" x2="${chartWidth - 130}" y2="30" stroke="#F59E0B" stroke-width="2" stroke-dasharray="5,3"/>
      <text x="${chartWidth - 125}" y="34" font-size="11" fill="#666">Stress</text>

      <!-- Y-axis labels -->
      <text x="5" y="${padding + 5}" font-size="10" fill="#999">High</text>
      <text x="5" y="${chartHeight - padding}" font-size="10" fill="#999">Low</text>

      <!-- X-axis labels -->
      <text x="${padding}" y="${chartHeight - 10}" font-size="10" fill="#999">${dataPoints[0]?.date.slice(5) || ""}</text>
      <text x="${chartWidth - padding - 40}" y="${chartHeight - 10}" font-size="10" fill="#999">${dataPoints[dataPoints.length - 1]?.date.slice(5) || ""}</text>
    </svg>
  `;
}

/**
 * Generate HTML template for PDF report
 */
async function generateHTMLTemplate(session: GutRecordingSession): Promise<string> {
  const protocol = PROTOCOL_CONFIG[session.protocolType];
  const mealTiming = MEAL_TIMING_OPTIONS.find((m) => m.value === session.context.mealTiming);
  const posture = POSTURE_OPTIONS.find((p) => p.value === session.context.posture);
  const analytics = session.analytics;
  const category = analytics ? getMotilityCategoryLabel(getMotilityCategory(analytics.motilityIndex)) : "N/A";

  // Get biofeedback result if intervention was used
  const biofeedbackResult: BiofeedbackResult | null = analytics
    ? analyzeBiofeedback(session)
    : null;

  // Get Vagal Readiness Score
  const vagalScore = analytics && session.patientId
    ? await calculateVagalReadinessScore(session, session.patientId)
    : null;

  // Get trend data
  const trendData = session.patientId
    ? await generateTrendData(session.patientId, 30)
    : { dataPoints: [], correlation: "neutral", summary: "Patient data unavailable." };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate waveform summary
  const totalSpikes = analytics ? Math.round(analytics.eventsPerMinute * (session.durationSeconds / 60)) : 0;
  const activePercent = analytics && session.durationSeconds > 0
    ? Math.round((analytics.totalActiveSeconds / session.durationSeconds) * 100)
    : 0;
  const quietPercent = 100 - activePercent;

  // Activity timeline visualization (simple bar chart in HTML)
  // Use accent colors from theme for consistency
  const timelineBars = analytics?.activityTimeline.map((value, index) => {
    const barHeight = value;
    // Use theme accent colors: high activity = accent, medium = accentDim, low = info
    const barColor = value > 60 ? "#19E6C7" : value > 30 ? "rgba(25, 230, 199, 0.6)" : "#3B82F6";
    return `<div class="timeline-bar" style="height: ${barHeight}%; background-color: ${barColor};"></div>`;
  }).join("") || "";

  // Get patient info if available
  const patient = session.patientId ? await getPatient(session.patientId) : null;

  // Lead clinician name
  const clinicianName = "Dr. Michael";

  // Generate Trend Line Chart
  const trendLineChart = generateTrendLineChart(trendData.dataPoints);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1f;
      background: #ffffff;
      padding: 40px;
      line-height: 1.6;
    }
    .header {
      border-bottom: 3px solid #19E6C7;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      color: #0D0D10;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    .patient-info {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }
    .patient-label {
      font-weight: 600;
      color: #333;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #0D0D10;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-item {
      background: #f8f8f8;
      padding: 12px;
      border-radius: 8px;
    }
    .info-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #0D0D10;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: #f8f8f8;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-value {
      font-size: 32px;
      font-weight: 700;
      color: #19E6C7;
      margin-bottom: 4px;
    }
    .intervention-success {
      color: #22C55E;
    }
    .intervention-info {
      color: #3B82F6;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .waveform-summary {
      background: #f8f8f8;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .summary-item:last-child {
      border-bottom: none;
    }
    .summary-label {
      font-size: 14px;
      color: #666;
    }
    .summary-value {
      font-size: 14px;
      font-weight: 600;
      color: #0D0D10;
    }
    .timeline-container {
      margin-top: 20px;
    }
    .timeline-chart {
      display: flex;
      align-items: flex-end;
      height: 80px;
      gap: 4px;
      margin-bottom: 8px;
    }
    .timeline-bar {
      flex: 1;
      min-height: 4px;
      border-radius: 2px;
    }
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .tag {
      background: rgba(25, 230, 199, 0.15);
      color: #19E6C7;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid #19E6C7;
    }
    .notes-box {
      background: #f8f8f8;
      padding: 16px;
      border-radius: 8px;
      min-height: 60px;
    }
    .notes-text {
      font-size: 14px;
      color: #0D0D10;
      white-space: pre-wrap;
    }
    .notes-empty {
      font-size: 14px;
      color: #999;
      font-style: italic;
    }
    .vagal-score-card {
      background: linear-gradient(135deg, #f0fdf9 0%, #ecfdf5 100%);
      border: 2px solid #19E6C7;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .vagal-score-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .vagal-score-value {
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .vagal-score-components {
      display: flex;
      justify-content: space-around;
      padding-top: 16px;
      border-top: 1px solid rgba(25, 230, 199, 0.3);
    }
    .vagal-component {
      text-align: center;
    }
    .vagal-component-value {
      font-size: 20px;
      font-weight: 700;
      color: #0D0D10;
    }
    .vagal-component-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
    }
    .trend-chart-container {
      background: #f8f8f8;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .trend-summary {
      font-size: 14px;
      color: #0D0D10;
      line-height: 1.6;
      margin-top: 12px;
      padding: 12px;
      background: #fff;
      border-radius: 6px;
      border-left: 3px solid #19E6C7;
    }
    .knowledge-section {
      background: #fafafa;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .knowledge-title {
      font-size: 16px;
      font-weight: 600;
      color: #0D0D10;
      margin-bottom: 12px;
    }
    .knowledge-content {
      font-size: 13px;
      color: #444;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .knowledge-refs {
      font-size: 11px;
      color: #888;
      font-style: italic;
    }
    .knowledge-ref-item {
      margin-bottom: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    @media print {
      body {
        padding: 20px;
      }
      .knowledge-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">NeuroGut Clinical Report</div>
    <div class="subtitle">Self-Tracking Session Analysis with Vagal Readiness Assessment</div>
    ${patient ? `<p class="patient-info"><span class="patient-label">Patient Code:</span> ${patient.code}</p>` : ""}
    <p class="patient-info"><span class="patient-label">Lead Clinician:</span> ${clinicianName}</p>
  </div>

  ${vagalScore ? `
  <div class="section">
    <div class="section-title">Vagal Readiness Score</div>
    <div class="vagal-score-card">
      <div class="vagal-score-header">
        <span style="font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase;">Overall Score</span>
        <span style="background: ${getVagalReadinessCategoryColor(vagalScore.category)}20; color: ${getVagalReadinessCategoryColor(vagalScore.category)}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${getVagalReadinessCategoryLabel(vagalScore.category)}</span>
      </div>
      <div class="vagal-score-value" style="color: ${getVagalReadinessCategoryColor(vagalScore.category)};">${vagalScore.score}</div>
      <p style="font-size: 13px; color: #666; margin-bottom: 16px;">
        ${vagalScore.changeFromBaseline >= 0 ? "+" : ""}${vagalScore.changeFromBaseline}% from 7-day baseline (${vagalScore.baselineSessionCount} sessions)
      </p>
      <div class="vagal-score-components">
        <div class="vagal-component">
          <div class="vagal-component-value">${vagalScore.components.baselineComponent}</div>
          <div class="vagal-component-label">Baseline</div>
        </div>
        <div class="vagal-component">
          <div class="vagal-component-value">${vagalScore.components.rhythmicityComponent}</div>
          <div class="vagal-component-label">Rhythmicity</div>
        </div>
        <div class="vagal-component">
          <div class="vagal-component-value">${vagalScore.components.interventionComponent}</div>
          <div class="vagal-component-label">4-7-8 Delta</div>
        </div>
      </div>
    </div>
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Session Information</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Date</div>
        <div class="info-value">${formatDate(session.createdAt)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Time</div>
        <div class="info-value">${formatTime(session.createdAt)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Protocol</div>
        <div class="info-value">${protocol.label}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Duration</div>
        <div class="info-value">${formatDuration(session.durationSeconds)}</div>
      </div>
    </div>
  </div>

  ${analytics ? `
  <div class="section">
    <div class="section-title">Analytics</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value" style="color: #19E6C7;">${analytics.motilityIndex}</div>
        <div class="metric-label">Motility Index</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">${category}</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${analytics.eventsPerMinute}</div>
        <div class="metric-label">Events/Min</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Waveform Summary</div>
    <div class="waveform-summary">
      <div class="summary-item">
        <span class="summary-label">Total Detected Events</span>
        <span class="summary-value">${totalSpikes} events</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Active Time</span>
        <span class="summary-value">${analytics.totalActiveSeconds}s (${activePercent}%)</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Quiet Time</span>
        <span class="summary-value">${analytics.totalQuietSeconds}s (${quietPercent}%)</span>
      </div>
    </div>
    ${analytics.activityTimeline.length > 0 ? `
    <div class="timeline-container">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #0D0D10;">Activity Timeline</div>
      <div class="timeline-chart">
        ${timelineBars}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999;">
        <span>Start</span>
        <span>End</span>
      </div>
    </div>
    ` : ""}
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Recording Context</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Time Since Meal</div>
        <div class="info-value">${mealTiming?.label || "Unknown"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Stress Level</div>
        <div class="info-value">${session.context.stressLevel}/10</div>
      </div>
      <div class="info-item">
        <div class="info-label">Posture</div>
        <div class="info-value">${posture?.label || "Unknown"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">State of Mind</div>
        <div class="info-value">${session.context.stateOfMind || "Calm"}</div>
      </div>
    </div>
  </div>

  ${biofeedbackResult && session.context.intervention && session.context.intervention !== "None" ? `
  <div class="section">
    <div class="section-title">Vagal Intervention Analysis</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Intervention Used</div>
        <div class="info-value">${session.context.intervention}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Motility Increase</div>
        <div class="info-value" style="color: ${biofeedbackResult.success ? "#22C55E" : "#3B82F6"}; font-weight: 700;">
          ${biofeedbackResult.percentageChange > 0 ? "+" : ""}${biofeedbackResult.percentageChange}%
        </div>
      </div>
      <div class="info-item" style="grid-column: 1 / -1;">
        <div class="info-label">Analysis</div>
        <div class="info-value" style="font-size: 14px; font-weight: 400; margin-top: 4px; line-height: 1.5;">
          ${biofeedbackResult.message}
        </div>
      </div>
      <div class="info-item">
        <div class="info-label">Baseline Motility</div>
        <div class="info-value">${biofeedbackResult.beforeMotility}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Intervention Motility</div>
        <div class="info-value">${biofeedbackResult.afterMotility}</div>
      </div>
    </div>
  </div>
  ` : ""}

  <!-- TREND LINES SECTION -->
  <div class="section">
    <div class="section-title">Trend Analysis: Stress vs. Motility (30 Days)</div>
    <div class="trend-chart-container">
      ${trendLineChart}
      <div class="trend-summary">
        <strong>Correlation:</strong> ${trendData.correlation.charAt(0).toUpperCase() + trendData.correlation.slice(1)}<br/>
        ${trendData.summary}
      </div>
    </div>
  </div>

  ${session.tags && session.tags.length > 0 ? `
  <div class="section">
    <div class="section-title">Symptom Tags</div>
    <div class="tags-container">
      ${session.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
    </div>
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Clinical Interpretation</div>
    <div class="notes-box clinician-notes">
      <div class="${session.notes ? "notes-text" : "notes-empty"}">${session.notes ? session.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;") : "— Add clinical interpretation here —"}</div>
    </div>
  </div>

  <!-- KNOWLEDGE BASE SECTION -->
  <div class="section" style="page-break-before: always;">
    <div class="section-title">Knowledge Base</div>

    <div class="knowledge-section">
      <div class="knowledge-title">${KNOWLEDGE_BASE.acousticEnterography.title}</div>
      <div class="knowledge-content">${KNOWLEDGE_BASE.acousticEnterography.content}</div>
      <div class="knowledge-refs">
        <strong>References:</strong>
        ${KNOWLEDGE_BASE.acousticEnterography.references.map((ref) => `<div class="knowledge-ref-item">• ${ref}</div>`).join("")}
      </div>
    </div>

    <div class="knowledge-section">
      <div class="knowledge-title">${KNOWLEDGE_BASE.autonomicNervousSystem.title}</div>
      <div class="knowledge-content">${KNOWLEDGE_BASE.autonomicNervousSystem.content}</div>
      <div class="knowledge-refs">
        <strong>References:</strong>
        ${KNOWLEDGE_BASE.autonomicNervousSystem.references.map((ref) => `<div class="knowledge-ref-item">• ${ref}</div>`).join("")}
      </div>
    </div>

    <div class="knowledge-section">
      <div class="knowledge-title">${KNOWLEDGE_BASE.vagalInterventions.title}</div>
      <div class="knowledge-content">${KNOWLEDGE_BASE.vagalInterventions.content}</div>
      <div class="knowledge-refs">
        <strong>References:</strong>
        ${KNOWLEDGE_BASE.vagalInterventions.references.map((ref) => `<div class="knowledge-ref-item">• ${ref}</div>`).join("")}
      </div>
    </div>
  </div>

  <div class="section" style="margin-top: 60px;">
    <div style="border-top: 2px solid #e0e0e0; padding-top: 20px; margin-top: 20px;">
      <div style="margin-bottom: 40px;">
        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Signature</div>
        <div style="border-bottom: 1px solid #0D0D10; height: 40px; margin-bottom: 8px;"></div>
        <div style="font-size: 12px; color: #999;">${clinicianName}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>This report is for informational purposes to assist in clinical assessment. It is not an automated diagnosis.</p>
    <p>Generated by NeuroGut App v2.0 | Vagal Readiness Scoring Engine</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate and save PDF report from session data
 *
 * @param session - The session to generate a report for
 * @returns Promise<string> - URI of the saved PDF file
 */
export async function generatePDFReport(
  session: GutRecordingSession
): Promise<string> {
  try {
    const html = await generateHTMLTemplate(session);

    // Generate PDF using expo-print
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: 612, // US Letter width in points
      height: 792, // US Letter height in points
    });

    return uri;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF report");
  }
}

/**
 * Share PDF report using native share sheet
 *
 * @param pdfUri - URI of the PDF file to share
 */
export async function sharePDFReport(pdfUri: string): Promise<void> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Clinical Report",
      });
    } else {
      throw new Error("Sharing is not available on this device");
    }
  } catch (error) {
    console.error("Error sharing PDF:", error);
    throw new Error("Failed to share PDF report");
  }
}

/**
 * Generate, save, and optionally share PDF report
 *
 * @param session - The session to generate a report for
 * @param shouldShare - Whether to open share sheet after generation (default: true)
 * @returns Promise<string> - URI of the saved PDF file
 */
export async function exportSessionPDF(
  session: GutRecordingSession,
  shouldShare: boolean = true
): Promise<string> {
  const pdfUri = await generatePDFReport(session);

  if (shouldShare) {
    try {
      await sharePDFReport(pdfUri);
    } catch (error) {
      // If sharing fails, still return the URI so user can access the file
      console.warn("Sharing failed, but PDF was generated:", error);
    }
  }

  return pdfUri;
}
