/**
 * NeuroGut Session Cleanup Utility
 *
 * Identifies and removes "ghost data" - incomplete, orphaned, or corrupted sessions.
 * Run periodically to maintain data integrity.
 *
 * Ghost data includes:
 * - Sessions without analytics after 24+ hours
 * - Sessions with missing/deleted audio files
 * - Sessions without patientId (orphaned)
 * - Sessions with corrupted context data
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { GutRecordingSession } from "../models/session";
import { loadAllSessions, deleteSession, clearCache } from "./sessionStore";

export interface CleanupResult {
  totalSessions: number;
  ghostSessionsFound: number;
  orphanedAudioFiles: number;
  sessionsWithMissingAudio: number;
  sessionsWithoutPatient: number;
  staleAnalyticsSessions: number;
  deletedSessions: string[];
  deletedAudioFiles: string[];
  errors: string[];
}

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;
const STALE_THRESHOLD_HOURS = 24; // Sessions without analytics after 24h are considered stale

/**
 * Scan for ghost sessions and orphaned files
 * @param dryRun If true, only report issues without deleting
 */
export async function scanForGhostData(dryRun: boolean = true): Promise<CleanupResult> {
  const result: CleanupResult = {
    totalSessions: 0,
    ghostSessionsFound: 0,
    orphanedAudioFiles: 0,
    sessionsWithMissingAudio: 0,
    sessionsWithoutPatient: 0,
    staleAnalyticsSessions: 0,
    deletedSessions: [],
    deletedAudioFiles: [],
    errors: [],
  };

  try {
    // Load all sessions
    const sessions = await loadAllSessions();
    result.totalSessions = sessions.length;

    // Get all audio files in recordings directory
    const audioFiles = new Set<string>();
    try {
      const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
        files.forEach((f) => audioFiles.add(`${RECORDINGS_DIR}${f}`));
      }
    } catch (err) {
      result.errors.push(`Error reading recordings directory: ${err}`);
    }

    // Track referenced audio files
    const referencedAudioFiles = new Set<string>();

    // Check each session for issues
    const now = Date.now();
    const staleThreshold = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

    for (const session of sessions) {
      let isGhost = false;
      const issues: string[] = [];

      // Check 1: Session without patientId
      if (!session.patientId) {
        result.sessionsWithoutPatient++;
        issues.push("missing patientId");
        isGhost = true;
      }

      // Check 2: Audio file exists
      if (session.audioFileUri) {
        referencedAudioFiles.add(session.audioFileUri);
        try {
          const fileInfo = await FileSystem.getInfoAsync(session.audioFileUri);
          if (!fileInfo.exists) {
            result.sessionsWithMissingAudio++;
            issues.push("audio file missing");
            isGhost = true;
          }
        } catch (err) {
          result.sessionsWithMissingAudio++;
          issues.push("error checking audio file");
          isGhost = true;
        }
      } else {
        result.sessionsWithMissingAudio++;
        issues.push("no audio file URI");
        isGhost = true;
      }

      // Check 3: Stale analytics (no analytics after 24h)
      if (!session.analytics) {
        const sessionAge = now - new Date(session.createdAt).getTime();
        if (sessionAge > staleThreshold) {
          result.staleAnalyticsSessions++;
          issues.push("stale (no analytics after 24h)");
          isGhost = true;
        }
      }

      // Check 4: Invalid context data
      if (!session.context ||
          typeof session.context.stressLevel !== "number" ||
          !session.context.mealTiming ||
          !session.context.posture) {
        issues.push("corrupted context data");
        isGhost = true;
      }

      // Check 5: Invalid duration
      if (!session.durationSeconds || session.durationSeconds <= 0) {
        issues.push("invalid duration");
        isGhost = true;
      }

      if (isGhost) {
        result.ghostSessionsFound++;

        if (!dryRun) {
          try {
            await deleteSession(session.id);
            result.deletedSessions.push(`${session.id} (${issues.join(", ")})`);
          } catch (err) {
            result.errors.push(`Failed to delete session ${session.id}: ${err}`);
          }
        } else {
          result.deletedSessions.push(`[DRY RUN] ${session.id} (${issues.join(", ")})`);
        }
      }
    }

    // Check for orphaned audio files (files not referenced by any session)
    for (const audioFile of audioFiles) {
      if (!referencedAudioFiles.has(audioFile)) {
        result.orphanedAudioFiles++;

        if (!dryRun) {
          try {
            await FileSystem.deleteAsync(audioFile);
            result.deletedAudioFiles.push(audioFile);
          } catch (err) {
            result.errors.push(`Failed to delete orphaned file ${audioFile}: ${err}`);
          }
        } else {
          result.deletedAudioFiles.push(`[DRY RUN] ${audioFile}`);
        }
      }
    }

    // Clear cache after cleanup
    if (!dryRun && (result.deletedSessions.length > 0 || result.deletedAudioFiles.length > 0)) {
      clearCache();
    }

  } catch (err) {
    result.errors.push(`Critical error during cleanup: ${err}`);
  }

  return result;
}

/**
 * Run cleanup in dry-run mode (report only, no deletions)
 */
export async function auditGhostData(): Promise<CleanupResult> {
  return scanForGhostData(true);
}

/**
 * Run actual cleanup (will delete ghost data)
 */
export async function cleanupGhostData(): Promise<CleanupResult> {
  return scanForGhostData(false);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalSessions: number;
  sessionsWithAnalytics: number;
  sessionsWithoutAnalytics: number;
  totalAudioFilesBytes: number;
  uniquePatients: Set<string>;
}> {
  const sessions = await loadAllSessions();
  const uniquePatients = new Set<string>();
  let totalAudioBytes = 0;

  for (const session of sessions) {
    if (session.patientId) {
      uniquePatients.add(session.patientId);
    }

    if (session.audioFileUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(session.audioFileUri);
        if (fileInfo.exists && "size" in fileInfo) {
          totalAudioBytes += fileInfo.size || 0;
        }
      } catch {}
    }
  }

  return {
    totalSessions: sessions.length,
    sessionsWithAnalytics: sessions.filter((s) => s.analytics !== null).length,
    sessionsWithoutAnalytics: sessions.filter((s) => s.analytics === null).length,
    totalAudioFilesBytes: totalAudioBytes,
    uniquePatients,
  };
}

/**
 * Validate patient data isolation
 * Returns sessions that may have cross-patient data exposure
 */
export async function auditPatientIsolation(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const sessions = await loadAllSessions();
  const issues: string[] = [];

  // Check for sessions without patientId
  const orphanedSessions = sessions.filter((s) => !s.patientId);
  if (orphanedSessions.length > 0) {
    issues.push(`Found ${orphanedSessions.length} sessions without patientId assignment`);
  }

  // Check for duplicate session IDs (should never happen)
  const sessionIds = sessions.map((s) => s.id);
  const duplicates = sessionIds.filter((id, idx) => sessionIds.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    issues.push(`Found ${duplicates.length} duplicate session IDs: ${duplicates.join(", ")}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
