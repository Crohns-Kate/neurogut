/**
 * NeuroGut Patient Profile Store
 *
 * Handles persistence and retrieval of patient profiles.
 * Uses AsyncStorage for local storage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { PatientProfile, createPatientProfile } from "../models/patient";

export type { PatientProfile };

const PATIENTS_STORAGE_KEY = "patientProfiles";
const ACTIVE_PATIENT_KEY = "activePatientId";

// In-memory cache
let patientsCache: PatientProfile[] | null = null;

/**
 * Load all patient profiles from storage
 */
export async function loadAllPatients(): Promise<PatientProfile[]> {
  if (patientsCache !== null) {
    return patientsCache;
  }

  try {
    const data = await AsyncStorage.getItem(PATIENTS_STORAGE_KEY);
    if (data) {
      patientsCache = JSON.parse(data) as PatientProfile[];
      return patientsCache;
    }
  } catch (error) {
    console.error("Error loading patients:", error);
  }

  patientsCache = [];
  return patientsCache;
}

/**
 * Save all patient profiles to storage
 */
async function saveAllPatients(patients: PatientProfile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(patients));
    patientsCache = patients;
  } catch (error) {
    console.error("Error saving patients:", error);
    throw error;
  }
}

/**
 * Add a new patient profile
 */
export async function addPatient(patient: PatientProfile): Promise<void> {
  const patients = await loadAllPatients();
  patients.push(patient);
  await saveAllPatients(patients);
}

/**
 * Create and add a new patient profile
 */
export async function createAndAddPatient(
  code: string,
  name?: string,
  notes?: string
): Promise<PatientProfile> {
  const patient = createPatientProfile(code, name, notes);
  await addPatient(patient);
  return patient;
}

/**
 * Get or create the default/internal patient profile for ghost sessions
 */
export async function getOrCreateDefaultPatient(): Promise<PatientProfile> {
  const DEFAULT_PATIENT_CODE = "INTERNAL";
  const patients = await loadAllPatients();
  let defaultPatient = patients.find((p) => p.code === DEFAULT_PATIENT_CODE);
  
  if (!defaultPatient) {
    defaultPatient = createPatientProfile(DEFAULT_PATIENT_CODE, "Default/Internal", "Internal profile for sessions without assigned patient");
    await addPatient(defaultPatient);
  }
  
  return defaultPatient;
}

/**
 * Update a patient profile
 */
export async function updatePatient(
  patientId: string,
  updates: Partial<PatientProfile>
): Promise<void> {
  const patients = await loadAllPatients();
  const index = patients.findIndex((p) => p.id === patientId);

  if (index === -1) {
    throw new Error(`Patient not found: ${patientId}`);
  }

  patients[index] = {
    ...patients[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveAllPatients(patients);
}

/**
 * Delete a patient profile
 */
export async function deletePatient(patientId: string): Promise<void> {
  const patients = await loadAllPatients();
  const filtered = patients.filter((p) => p.id !== patientId);
  await saveAllPatients(filtered);
  
  // If this was the active patient, clear it
  const activeId = await getActivePatientId();
  if (activeId === patientId) {
    await setActivePatientId(null);
  }
}

/**
 * Get a patient by ID
 */
export async function getPatient(patientId: string): Promise<PatientProfile | null> {
  const patients = await loadAllPatients();
  return patients.find((p) => p.id === patientId) || null;
}

/**
 * Get active patient ID
 */
export async function getActivePatientId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_PATIENT_KEY);
  } catch (error) {
    console.error("Error getting active patient:", error);
    return null;
  }
}

/**
 * Set active patient ID
 */
export async function setActivePatientId(patientId: string | null): Promise<void> {
  try {
    if (patientId) {
      await AsyncStorage.setItem(ACTIVE_PATIENT_KEY, patientId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_PATIENT_KEY);
    }
  } catch (error) {
    console.error("Error setting active patient:", error);
    throw error;
  }
}

/**
 * Get active patient profile
 */
export async function getActivePatient(): Promise<PatientProfile | null> {
  const activeId = await getActivePatientId();
  if (!activeId) return null;
  return await getPatient(activeId);
}

/**
 * Clear the in-memory cache
 */
export function clearPatientCache(): void {
  patientsCache = null;
}
