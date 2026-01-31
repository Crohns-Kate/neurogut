/**
 * NeuroGut Experiment Store
 *
 * Handles persistence and retrieval of Before/After comparison experiments.
 * Uses AsyncStorage for local storage.
 *
 * Key features:
 * - Save/load experiments
 * - Get active (incomplete) experiment for resume
 * - Update experiment status and session links
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Experiment,
  ExperimentStatus,
  ComparisonIntervention,
  createExperiment,
  calculateDeltas,
} from "../models/experiment";
import { SessionAnalytics } from "../models/session";

const EXPERIMENTS_STORAGE_KEY = "gutExperiments";

// In-memory cache of experiments
let experimentsCache: Experiment[] | null = null;

/**
 * Load all experiments from storage
 */
export async function loadAllExperiments(): Promise<Experiment[]> {
  if (experimentsCache !== null) {
    return experimentsCache;
  }

  try {
    const data = await AsyncStorage.getItem(EXPERIMENTS_STORAGE_KEY);
    if (data) {
      experimentsCache = JSON.parse(data) as Experiment[];
      return experimentsCache;
    }
  } catch (error) {
    console.error("Error loading experiments:", error);
  }

  experimentsCache = [];
  return experimentsCache;
}

/**
 * Save all experiments to storage
 */
async function saveAllExperiments(experiments: Experiment[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPERIMENTS_STORAGE_KEY, JSON.stringify(experiments));
    experimentsCache = experiments;
  } catch (error) {
    console.error("Error saving experiments:", error);
    throw error;
  }
}

/**
 * Save a new experiment
 */
export async function saveExperiment(experiment: Experiment): Promise<void> {
  const experiments = await loadAllExperiments();
  experiments.push(experiment);
  await saveAllExperiments(experiments);
}

/**
 * Update an existing experiment
 */
export async function updateExperiment(
  experimentId: string,
  updates: Partial<Experiment>
): Promise<void> {
  const experiments = await loadAllExperiments();
  const index = experiments.findIndex((e) => e.id === experimentId);

  if (index === -1) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }

  experiments[index] = { ...experiments[index], ...updates };
  await saveAllExperiments(experiments);
}

/**
 * Get a single experiment by ID
 */
export async function getExperiment(
  experimentId: string
): Promise<Experiment | null> {
  const experiments = await loadAllExperiments();
  return experiments.find((e) => e.id === experimentId) || null;
}

/**
 * Get the most recent active (incomplete) experiment for a patient
 * Used for resuming an interrupted flow
 */
export async function getActiveExperiment(
  patientId: string
): Promise<Experiment | null> {
  const experiments = await loadAllExperiments();

  // Find incomplete experiments for this patient, sorted by most recent
  const activeExperiments = experiments
    .filter((e) => e.patientId === patientId && e.status !== "complete")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return activeExperiments[0] || null;
}

/**
 * Get all experiments for a patient
 */
export async function getExperimentsByPatient(
  patientId: string
): Promise<Experiment[]> {
  const experiments = await loadAllExperiments();
  return experiments
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Delete an experiment
 */
export async function deleteExperiment(experimentId: string): Promise<void> {
  const experiments = await loadAllExperiments();
  const filtered = experiments.filter((e) => e.id !== experimentId);
  await saveAllExperiments(filtered);
}

/**
 * Create a new experiment and save it
 */
export async function createAndSaveExperiment(
  interventionType: ComparisonIntervention,
  interventionDurationSeconds: number,
  patientId: string
): Promise<Experiment> {
  const experiment = createExperiment(
    interventionType,
    interventionDurationSeconds,
    patientId
  );
  await saveExperiment(experiment);
  return experiment;
}

/**
 * Mark baseline recording complete
 */
export async function completeBaseline(
  experimentId: string,
  sessionId: string,
  analytics: SessionAnalytics
): Promise<void> {
  await updateExperiment(experimentId, {
    status: "baseline_complete",
    beforeSessionId: sessionId,
    beforeAnalytics: analytics,
  });
}

/**
 * Mark intervention complete
 */
export async function completeIntervention(
  experimentId: string
): Promise<void> {
  await updateExperiment(experimentId, {
    status: "intervention_complete",
  });
}

/**
 * Mark post-recording complete and calculate deltas
 */
export async function completePost(
  experimentId: string,
  sessionId: string,
  analytics: SessionAnalytics
): Promise<Experiment> {
  const experiment = await getExperiment(experimentId);
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }

  if (!experiment.beforeAnalytics) {
    throw new Error(`Experiment ${experimentId} has no baseline analytics`);
  }

  const deltas = calculateDeltas(experiment.beforeAnalytics, analytics);

  await updateExperiment(experimentId, {
    status: "complete",
    afterSessionId: sessionId,
    afterAnalytics: analytics,
    deltas,
  });

  // Return updated experiment
  return (await getExperiment(experimentId))!;
}

/**
 * Clear the in-memory cache
 */
export function clearExperimentsCache(): void {
  experimentsCache = null;
}
