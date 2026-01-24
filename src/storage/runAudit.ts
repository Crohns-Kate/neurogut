/**
 * Ghost Data Audit Runner
 *
 * This file exports a function that can be called from within the app
 * to run the ghost data audit. Call this from a development screen or
 * via the debug menu.
 *
 * Usage in app:
 *   import { runGhostDataAudit } from '../src/storage/runAudit';
 *   const report = await runGhostDataAudit();
 *   console.log(JSON.stringify(report, null, 2));
 */

import {
  auditGhostData,
  cleanupGhostData,
  getStorageStats,
  auditPatientIsolation,
  CleanupResult,
} from "./sessionCleanup";

export interface AuditReport {
  timestamp: string;
  ghostData: CleanupResult;
  storageStats: {
    totalSessions: number;
    sessionsWithAnalytics: number;
    sessionsWithoutAnalytics: number;
    totalAudioFilesBytes: number;
    uniquePatientCount: number;
  };
  patientIsolation: {
    valid: boolean;
    issues: string[];
  };
  recommendations: string[];
}

/**
 * Run comprehensive ghost data audit
 * Returns a detailed report without making any changes
 */
export async function runGhostDataAudit(): Promise<AuditReport> {
  console.log("[AUDIT] Starting ghost data audit...");

  // Run all audit checks in parallel
  const [ghostData, storageStats, patientIsolation] = await Promise.all([
    auditGhostData(),
    getStorageStats(),
    auditPatientIsolation(),
  ]);

  // Generate recommendations
  const recommendations: string[] = [];

  if (ghostData.ghostSessionsFound > 0) {
    recommendations.push(
      `Found ${ghostData.ghostSessionsFound} ghost sessions that should be cleaned up`
    );
  }

  if (ghostData.orphanedAudioFiles > 0) {
    recommendations.push(
      `Found ${ghostData.orphanedAudioFiles} orphaned audio files (${formatBytes(
        ghostData.orphanedAudioFiles * 500000 // Estimate ~500KB per file
      )} estimated)`
    );
  }

  if (ghostData.sessionsWithoutPatient > 0) {
    recommendations.push(
      `CRITICAL: ${ghostData.sessionsWithoutPatient} sessions have no patient assignment`
    );
  }

  if (!patientIsolation.valid) {
    recommendations.push(...patientIsolation.issues);
  }

  if (ghostData.staleAnalyticsSessions > 0) {
    recommendations.push(
      `${ghostData.staleAnalyticsSessions} sessions are missing analytics after 24+ hours`
    );
  }

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    ghostData,
    storageStats: {
      totalSessions: storageStats.totalSessions,
      sessionsWithAnalytics: storageStats.sessionsWithAnalytics,
      sessionsWithoutAnalytics: storageStats.sessionsWithoutAnalytics,
      totalAudioFilesBytes: storageStats.totalAudioFilesBytes,
      uniquePatientCount: storageStats.uniquePatients.size,
    },
    patientIsolation,
    recommendations,
  };

  console.log("[AUDIT] Audit complete");
  console.log("[AUDIT] Ghost sessions found:", ghostData.ghostSessionsFound);
  console.log("[AUDIT] Orphaned audio files:", ghostData.orphanedAudioFiles);
  console.log("[AUDIT] Sessions without patient:", ghostData.sessionsWithoutPatient);

  return report;
}

/**
 * Run cleanup after user approval
 * CAUTION: This will permanently delete ghost data
 */
export async function runGhostDataCleanup(): Promise<CleanupResult> {
  console.log("[CLEANUP] Starting ghost data cleanup...");
  console.log("[CLEANUP] WARNING: This will permanently delete data");

  const result = await cleanupGhostData();

  console.log("[CLEANUP] Cleanup complete");
  console.log("[CLEANUP] Sessions deleted:", result.deletedSessions.length);
  console.log("[CLEANUP] Audio files deleted:", result.deletedAudioFiles.length);

  if (result.errors.length > 0) {
    console.error("[CLEANUP] Errors:", result.errors);
  }

  return result;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Export types for use elsewhere
export type { CleanupResult } from "./sessionCleanup";
