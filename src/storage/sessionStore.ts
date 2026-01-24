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
  SymptomTag,
  StateOfMind,
} from "../models/session";
import { getOrCreateDefaultPatient } from "./patientStore";

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
 * Ensures patientId is always set (assigns to default if missing)
 */
export async function addSession(session: GutRecordingSession): Promise<void> {
  // Ensure patientId is set
  if (!session.patientId) {
    const defaultPatient = await getOrCreateDefaultPatient();
    session.patientId = defaultPatient.id;
  }
  
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
 * Update session tags
 */
export async function updateSessionTags(
  sessionId: string,
  tags: SymptomTag[]
): Promise<void> {
  await updateSession(sessionId, { tags: tags.length > 0 ? tags : undefined });
}

/**
 * Get sessions filtered by symptom tags
 */
export async function getSessionsByTags(
  tags: SymptomTag[]
): Promise<GutRecordingSession[]> {
  const sessions = await loadAllSessions();
  if (tags.length === 0) return sessions;

  return sessions.filter((session) => {
    if (!session.tags || session.tags.length === 0) return false;
    // Session must have at least one of the requested tags
    return tags.some((tag) => session.tags?.includes(tag));
  });
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
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @param limit Optional limit on number of sessions returned
 * @throws Error if patientId is not provided
 */
export async function getSessionsSortedByDate(
  patientId: string,
  limit?: number
): Promise<GutRecordingSession[]> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required to retrieve sessions. This prevents cross-patient data leaks.");
  }

  const sessions = await loadAllSessions();
  const filtered = sessions.filter((s) => s.patientId === patientId);

  const sorted = [...filtered].sort(
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
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @throws Error if patientId is not provided
 */
export async function getSessionsWithAnalytics(
  patientId: string
): Promise<GutRecordingSession[]> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required to retrieve sessions. This prevents cross-patient data leaks.");
  }

  const sessions = await loadAllSessions();
  const filtered = sessions.filter(
    (s) => s.analytics !== null && s.patientId === patientId
  );

  return filtered;
}

/**
 * Compute average motility index across all sessions for a patient
 * @param patientId REQUIRED - Patient ID to filter sessions
 * @throws Error if patientId is not provided
 */
export async function getAverageMotilityIndex(patientId: string): Promise<number | null> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required. This prevents cross-patient data leaks.");
  }

  const sessions = await getSessionsWithAnalytics(patientId);

  if (sessions.length === 0) return null;

  const sum = sessions.reduce(
    (acc, s) => acc + (s.analytics?.motilityIndex || 0),
    0
  );
  return sum / sessions.length;
}

/**
 * Get motility category relative to user's historical average
 * @param motilityIndex The motility index to categorize
 * @param patientId REQUIRED - Patient ID to filter sessions
 * @throws Error if patientId is not provided
 */
export async function getRelativeMotilityCategory(
  motilityIndex: number,
  patientId: string
): Promise<MotilityCategory> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required. This prevents cross-patient data leaks.");
  }

  const average = await getAverageMotilityIndex(patientId);

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
 * Get stats per protocol type for a patient
 * @param patientId REQUIRED - Patient ID to filter sessions
 * @throws Error if patientId is not provided
 */
export async function getStatsByProtocol(patientId: string): Promise<ProtocolStats[]> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required. This prevents cross-patient data leaks.");
  }

  const sessions = await getSessionsWithAnalytics(patientId);
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
 * Get stress correlation stats for a patient
 * @param patientId REQUIRED - Patient ID to filter sessions
 * @throws Error if patientId is not provided
 */
export async function getStressCorrelationStats(patientId: string): Promise<StressCorrelationStats> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required. This prevents cross-patient data leaks.");
  }

  const sessions = await getSessionsWithAnalytics(patientId);

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
 * Daily averages for trends dashboard
 */
export interface DailyAverages {
  date: string; // ISO date string (YYYY-MM-DD)
  avgMotilityIndex: number;
  avgEventsPerMinute: number;
  sessionCount: number;
}

/**
 * Get daily averages of motility index and events per minute
 *
 * Groups sessions by date (YYYY-MM-DD) and calculates arithmetic mean
 * for motility index and events per minute for each day.
 *
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @param tags Optional array of symptom tags to filter sessions. If provided,
 *             only sessions containing at least one of the specified tags will be included.
 * @returns Array of daily averages sorted by date (oldest first)
 * @throws Error if patientId is not provided
 */
export async function getAveragesByDate(
  patientId: string,
  tags?: SymptomTag[]
): Promise<DailyAverages[]> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required to retrieve session averages. This prevents cross-patient data leaks.");
  }

  let sessions = await getSessionsWithAnalytics(patientId);
  
  // Filter by tags if provided
  if (tags && tags.length > 0) {
    sessions = sessions.filter((session) => {
      if (!session.tags || session.tags.length === 0) {
        return false;
      }
      // Session must have at least one of the specified tags
      return tags.some((tag) => session.tags?.includes(tag));
    });
  }
  
  if (sessions.length === 0) {
    return [];
  }

  // Group sessions by date (YYYY-MM-DD)
  const sessionsByDate = new Map<string, GutRecordingSession[]>();

  sessions.forEach((session) => {
    const date = new Date(session.createdAt);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey)!.push(session);
  });

  // Calculate averages for each date
  const dailyAverages: DailyAverages[] = [];

  sessionsByDate.forEach((daySessions, dateKey) => {
    const sessionsWithAnalytics = daySessions.filter((s) => s.analytics !== null);
    
    if (sessionsWithAnalytics.length === 0) {
      return; // Skip days with no analytics
    }

    // Calculate arithmetic mean for motility index
    const sumMotility = sessionsWithAnalytics.reduce(
      (acc, s) => acc + (s.analytics?.motilityIndex || 0),
      0
    );
    const avgMotilityIndex = sumMotility / sessionsWithAnalytics.length;

    // Calculate arithmetic mean for events per minute
    const sumEventsPerMin = sessionsWithAnalytics.reduce(
      (acc, s) => acc + (s.analytics?.eventsPerMinute || 0),
      0
    );
    const avgEventsPerMinute = sumEventsPerMin / sessionsWithAnalytics.length;

    dailyAverages.push({
      date: dateKey,
      avgMotilityIndex: Math.round(avgMotilityIndex * 10) / 10, // Round to 1 decimal
      avgEventsPerMinute: Math.round(avgEventsPerMinute * 10) / 10, // Round to 1 decimal
      sessionCount: sessionsWithAnalytics.length,
    });
  });

  // Sort by date (oldest first)
  dailyAverages.sort((a, b) => a.date.localeCompare(b.date));

  return dailyAverages;
}

/**
 * Get sessions grouped by date with state of mind information
 * Used for mind-body correlation visualization in trends
 * @param patientId REQUIRED - Patient ID to filter sessions (prevents cross-patient data leak)
 * @throws Error if patientId is not provided
 */
export async function getSessionsByDateWithState(
  patientId: string
): Promise<
  Map<string, Array<{ stateOfMind: StateOfMind; motilityIndex: number }>>
> {
  // SECURITY: Require patientId to prevent cross-patient data exposure
  if (!patientId || patientId.trim() === "") {
    throw new Error("Patient ID is required to retrieve session data. This prevents cross-patient data leaks.");
  }

  const sessions = await getSessionsWithAnalytics(patientId);
  const sessionsByDate = new Map<
    string,
    Array<{ stateOfMind: StateOfMind; motilityIndex: number }>
  >();

  sessions.forEach((session) => {
    if (!session.analytics) return;

    const date = new Date(session.createdAt);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }

    // Handle backward compatibility: sessions without stateOfMind default to "Calm"
    sessionsByDate.get(dateKey)!.push({
      stateOfMind: session.context.stateOfMind || "Calm",
      motilityIndex: session.analytics.motilityIndex,
    });
  });

  return sessionsByDate;
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
