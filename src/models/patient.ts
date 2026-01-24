/**
 * NeuroGut Patient Profile Model
 *
 * Data model for managing patient profiles in a clinical setting.
 * Each patient has a unique ID, code (e.g., GC-101), notes, and join date.
 */

export interface PatientProfile {
  id: string; // UUID
  code: string; // Patient code (e.g., "GC-101")
  name?: string; // Optional full name
  notes?: string; // Optional clinical notes
  joinDate: string; // ISO timestamp when patient was added
  updatedAt: string; // ISO timestamp
}

/**
 * Create a new patient profile
 */
export function createPatientProfile(
  code: string,
  name?: string,
  notes?: string
): PatientProfile {
  const now = new Date().toISOString();
  return {
    id: `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    code,
    name,
    notes,
    joinDate: now,
    updatedAt: now,
  };
}
