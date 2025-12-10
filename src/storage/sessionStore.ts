/**
 * NeuroGut Session Store
 *
 * Handles persistence and retrieval of gut recording sessions.
 * Uses AsyncStorage for local storage with a design that allows
 * future sync to a backend API without breaking the UI.
 *
 * Key features:
 * - Save/load sessions list
 * - Get sessions sorted by date
 * - Compute stats by protocol type
 * - Update session analytics after processing
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GutRecordingSession,
  RecordingProtocolType,
  SessionAnalytics,
  MotilityCategory,
  getMotilityCategory,
} from "../models/session";

const SESSIONS_STORAGE_KEY = "gutRecordingSessions";

// Stats for a specific protocol type
export interface ProtocolStats {
  protocolType: RecordingProtocolType;
  sessionCount: number;
  averageMotilityIndex: number;
  averageStressLevel: number;
}

// Stats comparing high vs low stress sessions
export interface StressCorrelationStats {
  lowStressSessions: number; // stress 0-3
  lowStressAvgMotility: number;
  highStressSessions: number; // stress 7-10
  highStressAvgMotility: number;
}

// In-memory cache of sessions (loaded on first access)
let sessionsCache: GutRecordingSession[] | null = null;

/**
 * Load all sessions from storage
 */
export async function loadAllSessions(): Promise<GutRecordingSession[]> {
  if (sessionsCache !== null) {
    return sessionsCache;
  }

  try {
    const data = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
    if (data) {
      sessionsCache = JSON.parse(data) as GutRecordingSession[];
      return sessionsCache;
    }
  } catch (error) {
    console.error("Error loading sessions:", error);
  }

  sessionsCache = [];
  return sessionsCache;
}

/**
 * Save all sessions to storage
 */
async function saveAllSessions(sessions: GutRecordingSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    sessionsCache = sessions;
  } catch (error) {
    console.error("Error saving sessions:", error);
    throw error;
  }
}

/**
 * Add a new session
 */
export async function addSession(session: GutRecordingSession): Promise<void> {
  const sessions = await loadAllSessions();
  sessions.push(session);
  await saveAllSessions(sessions);
}

/**
 * Update a session (e.g., after analytics processing or note editing)
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<GutRecordingSession>
): Promise<void> {
  const sessions = await loadAllSessions();
  const index = sessions.findIndex((s) => s.id === sessionId);

  if (index === -1) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  sessions[index] = { ...sessions[index], ...updates };
  await saveAllSessions(sessions);
}

/**
 * Update session analytics after audio processing
 */
export async function updateSessionAnalytics(
  sessionId: string,
  analytics: SessionAnalytics
): Promise<void> {
  await updateSession(sessionId, { analytics });
}

/**
 * Update session notes
 */
export async function updateSessionNotes(
  sessionId: string,
  notes: string
): Promise<void> {
  await updateSession(sessionId, { notes });
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await loadAllSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  await saveAllSessions(filtered);
}

/**
 * Get a single session by ID
 */
export async function getSession(
  sessionId: string
): Promise<GutRecordingSession | null> {
  const sessions = await loadAllSessions();
  return sessions.find((s) => s.id === sessionId) || null;
}

/**
 * Get sessions sorted by date (newest first)
 */
export async function getSessionsSortedByDate(
  limit?: number
): Promise<GutRecordingSession[]> {
  const sessions = await loadAllSessions();
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (limit) {
    return sorted.slice(0, limit);
  }
  return sorted;
}

/**
 * Get sessions filtered by protocol type
 */
export async function getSessionsByProtocol(
  protocolType: RecordingProtocolType
): Promise<GutRecordingSession[]> {
  const sessions = await loadAllSessions();
  return sessions.filter((s) => s.protocolType === protocolType);
}

/**
 * Get sessions with analytics computed
 */
export async function getSessionsWithAnalytics(): Promise<
  GutRecordingSession[]
> {
  const sessions = await loadAllSessions();
  return sessions.filter((s) => s.analytics !== null);
}

/**
 * Compute average motility index across all sessions
 */
export async function getAverageMotilityIndex(): Promise<number | null> {
  const sessions = await getSessionsWithAnalytics();

  if (sessions.length === 0) return null;

  const sum = sessions.reduce(
    (acc, s) => acc + (s.analytics?.motilityIndex || 0),
    0
  );
  return sum / sessions.length;
}

/**
 * Get motility category relative to user's historical average
 */
export async function getRelativeMotilityCategory(
  motilityIndex: number
): Promise<MotilityCategory> {
  const average = await getAverageMotilityIndex();

  if (average === null) {
    // No history, use absolute thresholds
    return getMotilityCategory(motilityIndex);
  }

  // Relative to personal average
  const deviation = motilityIndex - average;
  if (deviation < -15) return "quiet";
  if (deviation > 15) return "active";
  return "normal";
}

/**
 * Get stats per protocol type
 */
export async function getStatsByProtocol(): Promise<ProtocolStats[]> {
  const sessions = await getSessionsWithAnalytics();
  const protocols: RecordingProtocolType[] = [
    "quick_check",
    "post_meal",
    "mind_body",
  ];

  return protocols.map((protocolType) => {
    const protocolSessions = sessions.filter(
      (s) => s.protocolType === protocolType
    );

    if (protocolSessions.length === 0) {
      return {
        protocolType,
        sessionCount: 0,
        averageMotilityIndex: 0,
        averageStressLevel: 0,
      };
    }

    const avgMotility =
      protocolSessions.reduce(
        (acc, s) => acc + (s.analytics?.motilityIndex || 0),
        0
      ) / protocolSessions.length;

    const avgStress =
      protocolSessions.reduce((acc, s) => acc + s.context.stressLevel, 0) /
      protocolSessions.length;

    return {
      protocolType,
      sessionCount: protocolSessions.length,
      averageMotilityIndex: Math.round(avgMotility),
      averageStressLevel: Math.round(avgStress * 10) / 10,
    };
  });
}

/**
 * Get stress correlation stats
 */
export async function getStressCorrelationStats(): Promise<StressCorrelationStats> {
  const sessions = await getSessionsWithAnalytics();

  const lowStressSessions = sessions.filter((s) => s.context.stressLevel <= 3);
  const highStressSessions = sessions.filter((s) => s.context.stressLevel >= 7);

  const lowStressAvgMotility =
    lowStressSessions.length > 0
      ? lowStressSessions.reduce(
          (acc, s) => acc + (s.analytics?.motilityIndex || 0),
          0
        ) / lowStressSessions.length
      : 0;

  const highStressAvgMotility =
    highStressSessions.length > 0
      ? highStressSessions.reduce(
          (acc, s) => acc + (s.analytics?.motilityIndex || 0),
          0
        ) / highStressSessions.length
      : 0;

  return {
    lowStressSessions: lowStressSessions.length,
    lowStressAvgMotility: Math.round(lowStressAvgMotility),
    highStressSessions: highStressSessions.length,
    highStressAvgMotility: Math.round(highStressAvgMotility),
  };
}

/**
 * Get total session count
 */
export async function getSessionCount(): Promise<number> {
  const sessions = await loadAllSessions();
  return sessions.length;
}

/**
 * Get count of unique days with recordings
 */
export async function getUniqueDaysTracked(): Promise<number> {
  const sessions = await loadAllSessions();
  const uniqueDays = new Set<string>();

  sessions.forEach((session) => {
    const day = new Date(session.createdAt).toDateString();
    uniqueDays.add(day);
  });

  return uniqueDays.size;
}

/**
 * Clear the in-memory cache (useful for testing or after logout)
 */
export function clearCache(): void {
  sessionsCache = null;
}

/**
 * Export all sessions (for potential future backup/sync)
 */
export async function exportAllSessions(): Promise<string> {
  const sessions = await loadAllSessions();
  return JSON.stringify(sessions, null, 2);
}
