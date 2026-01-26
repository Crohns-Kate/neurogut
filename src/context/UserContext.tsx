/**
 * UserContext - Multi-Patient User Switching Provider
 *
 * Provides global state for managing patient profiles and switching
 * between different patients (e.g., 'Bishop' vs 'New Trial Patient').
 * Used throughout the app for data isolation and patient-specific sessions.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  loadAllPatients,
  getActivePatient,
  setActivePatientId,
  createAndAddPatient,
  deletePatient,
  updatePatient,
  PatientProfile,
  clearPatientCache,
} from "../storage/patientStore";

// Context state interface
interface UserContextState {
  /** All available patient profiles */
  patients: PatientProfile[];
  /** Currently active patient profile */
  activePatient: PatientProfile | null;
  /** Whether context is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

// Context actions interface
interface UserContextActions {
  /** Switch to a different patient */
  switchPatient: (patientId: string) => Promise<void>;
  /** Create a new patient profile */
  createPatient: (code: string, name?: string, notes?: string) => Promise<PatientProfile>;
  /** Update an existing patient */
  updatePatient: (patientId: string, updates: Partial<PatientProfile>) => Promise<void>;
  /** Delete a patient profile */
  deletePatient: (patientId: string) => Promise<void>;
  /** Refresh patient data */
  refreshPatients: () => Promise<void>;
  /** Clear active patient (logout) */
  clearActivePatient: () => Promise<void>;
}

// Combined context type
type UserContextValue = UserContextState & UserContextActions;

// Create context with undefined default
const UserContext = createContext<UserContextValue | undefined>(undefined);

// Provider props
interface UserProviderProps {
  children: ReactNode;
}

/**
 * UserProvider - Context provider for patient management
 */
export function UserProvider({ children }: UserProviderProps) {
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [activePatient, setActivePatientState] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [allPatients, active] = await Promise.all([
        loadAllPatients(),
        getActivePatient(),
      ]);

      setPatients(allPatients);
      setActivePatientState(active);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load patient data";
      setError(message);
      console.error("UserContext load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Switch to a different patient
  const switchPatient = useCallback(async (patientId: string) => {
    try {
      setError(null);
      await setActivePatientId(patientId);
      const patient = patients.find((p) => p.id === patientId) || null;
      setActivePatientState(patient);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch patient";
      setError(message);
      throw err;
    }
  }, [patients]);

  // Create a new patient
  const createPatientAction = useCallback(
    async (code: string, name?: string, notes?: string): Promise<PatientProfile> => {
      try {
        setError(null);
        const newPatient = await createAndAddPatient(code, name, notes);

        // Update local state
        setPatients((prev) => [...prev, newPatient]);

        // Auto-switch to new patient
        await setActivePatientId(newPatient.id);
        setActivePatientState(newPatient);

        return newPatient;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create patient";
        setError(message);
        throw err;
      }
    },
    []
  );

  // Update an existing patient
  const updatePatientAction = useCallback(
    async (patientId: string, updates: Partial<PatientProfile>): Promise<void> => {
      try {
        setError(null);
        await updatePatient(patientId, updates);

        // Update local state
        setPatients((prev) =>
          prev.map((p) =>
            p.id === patientId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          )
        );

        // Update active patient if it's the one being updated
        if (activePatient?.id === patientId) {
          setActivePatientState((prev) =>
            prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : prev
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update patient";
        setError(message);
        throw err;
      }
    },
    [activePatient]
  );

  // Delete a patient
  const deletePatientAction = useCallback(
    async (patientId: string): Promise<void> => {
      try {
        setError(null);
        await deletePatient(patientId);

        // Update local state
        setPatients((prev) => prev.filter((p) => p.id !== patientId));

        // Clear active patient if it was deleted
        if (activePatient?.id === patientId) {
          setActivePatientState(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete patient";
        setError(message);
        throw err;
      }
    },
    [activePatient]
  );

  // Refresh patient data
  const refreshPatients = useCallback(async () => {
    clearPatientCache();
    await loadInitialData();
  }, [loadInitialData]);

  // Clear active patient
  const clearActivePatient = useCallback(async () => {
    try {
      setError(null);
      await setActivePatientId(null);
      setActivePatientState(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear active patient";
      setError(message);
      throw err;
    }
  }, []);

  // Context value
  const value: UserContextValue = {
    // State
    patients,
    activePatient,
    isLoading,
    error,
    // Actions
    switchPatient,
    createPatient: createPatientAction,
    updatePatient: updatePatientAction,
    deletePatient: deletePatientAction,
    refreshPatients,
    clearActivePatient,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * useUser - Hook to access user context
 */
export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

/**
 * useActivePatient - Convenience hook for just the active patient
 */
export function useActivePatient(): {
  patient: PatientProfile | null;
  isLoading: boolean;
} {
  const { activePatient, isLoading } = useUser();
  return { patient: activePatient, isLoading };
}

/**
 * usePatientSwitcher - Hook for patient switching functionality
 */
export function usePatientSwitcher() {
  const { patients, activePatient, switchPatient, createPatient, isLoading } = useUser();
  return {
    patients,
    activePatient,
    switchPatient,
    createPatient,
    isLoading,
  };
}

export default UserContext;
