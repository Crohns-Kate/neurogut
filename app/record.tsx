import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import {
  RecordingProtocolType,
  PROTOCOL_CONFIG,
  MealTiming,
  MEAL_TIMING_OPTIONS,
  PostureType,
  POSTURE_OPTIONS,
  SessionContext as SessionContextType,
  DEFAULT_SESSION_CONTEXT,
  createSession,
  StateOfMind,
  STATE_OF_MIND_OPTIONS,
  VagalIntervention,
  VAGAL_INTERVENTION_OPTIONS,
} from "../src/models/session";
import { addSession, updateSessionAnalytics } from "../src/storage/sessionStore";
import { generatePlaceholderAnalytics } from "../src/analytics/audioAnalytics";
import AnatomicalMirror from "../components/AnatomicalMirror";
import PlacementGuide from "../components/PlacementGuide";
import VagalPrimer from "../components/VagalPrimer";
import {
  loadAllPatients,
  getActivePatient,
  setActivePatientId,
  createAndAddPatient,
  PatientProfile,
} from "../src/storage/patientStore";
import { useSession, requiresPrimer, getModeLabel } from "../src/context/SessionContext";

type SavedRecording = {
  id: string;
  uri: string;
  createdAt: string;
  durationMs: number;
  protocolType?: RecordingProtocolType;
};

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;

// Recording phases
type RecordingPhase = "setup" | "recording" | "processing";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Unknown date";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const recordDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const diffDays = Math.floor(
      (today.getTime() - recordDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Yesterday at ${timeStr}`;
    if (diffDays < 7) {
      return `${date.toLocaleDateString([], { weekday: "long" })} at ${timeStr}`;
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown date";
  }
}

// Protocol selector component
function ProtocolSelector({
  selected,
  onSelect,
}: {
  selected: RecordingProtocolType;
  onSelect: (p: RecordingProtocolType) => void;
}) {
  const protocols: RecordingProtocolType[] = ["quick_check", "post_meal", "mind_body"];

  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Protocol</Text>
      <View style={styles.protocolButtons}>
        {protocols.map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.protocolButton,
              selected === p && styles.protocolButtonActive,
            ]}
            onPress={() => onSelect(p)}
          >
            <Text
              style={[
                styles.protocolButtonText,
                selected === p && styles.protocolButtonTextActive,
              ]}
            >
              {PROTOCOL_CONFIG[p].label}
            </Text>
            <Text
              style={[
                styles.protocolDuration,
                selected === p && styles.protocolDurationActive,
              ]}
            >
              {Math.floor(PROTOCOL_CONFIG[p].durationSeconds / 60)} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.protocolDescription}>
        {PROTOCOL_CONFIG[selected].description}
      </Text>
    </View>
  );
}

// Meal timing selector
function MealTimingSelector({
  selected,
  onSelect,
}: {
  selected: MealTiming;
  onSelect: (m: MealTiming) => void;
}) {
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Since last meal</Text>
      <View style={styles.optionRow}>
        {MEAL_TIMING_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionButton,
              selected === opt.value && styles.optionButtonActive,
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                styles.optionButtonText,
                selected === opt.value && styles.optionButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Stress level slider (0-10 as buttons)
function StressSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Stress level</Text>
      <View style={styles.stressRow}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.stressButton,
              value === num && styles.stressButtonActive,
            ]}
            onPress={() => onChange(num)}
          >
            <Text
              style={[
                styles.stressButtonText,
                value === num && styles.stressButtonTextActive,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.stressLabels}>
        <Text style={styles.stressLabelText}>Calm</Text>
        <Text style={styles.stressLabelText}>Very stressed</Text>
      </View>
    </View>
  );
}

// Posture selector
function PostureSelector({
  selected,
  onSelect,
}: {
  selected: PostureType;
  onSelect: (p: PostureType) => void;
}) {
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Posture</Text>
      <View style={styles.optionRow}>
        {POSTURE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionButton,
              selected === opt.value && styles.optionButtonActive,
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                styles.optionButtonText,
                selected === opt.value && styles.optionButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// State of Mind selector (mandatory before recording)
function StateOfMindSelector({
  selected,
  onSelect,
}: {
  selected: StateOfMind;
  onSelect: (s: StateOfMind) => void;
}) {
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Current State *</Text>
      <Text style={styles.selectorHint}>Required before recording</Text>
      <View style={styles.optionRow}>
        {STATE_OF_MIND_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionButton,
              selected === opt.value && styles.optionButtonActive,
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                styles.optionButtonText,
                selected === opt.value && styles.optionButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Intervention instructions map
const INTERVENTION_INSTRUCTIONS: Record<VagalIntervention, string> = {
  None: "",
  "Deep Breathing": "4-7-8: Inhale 4s, hold 7s, exhale 8s. Focus on your diaphragm expanding.",
  Humming: "Hum a low, steady tone (like 'om') for 30 seconds. Feel the vibration in your throat and chest.",
  Gargling: "Gargle forcefully with water for 30 seconds. Create strong vibrations in the back of your throat.",
  "Cold Exposure": "Apply cold water to your face or hold ice in your hands for 30 seconds. Focus on your breath.",
};

const VAGUS_FACTS = [
  "Your humming is now vibrating the laryngeal branch of the Vagus nerve.",
  "Deep breathing increases blood flow to your enteric nervous system.",
  "The Vagus nerve carries signals from your gut to your brain in real-time.",
  "Your diaphragm is massaging your abdominal organs as you breathe.",
  "Vagal stimulation activates your parasympathetic nervous system.",
  "The Vagus nerve connects your brainstem to your heart, lungs, and digestive tract.",
  "Each breath sends signals through the Vagus nerve to calm your body.",
  "Humming creates vibrations that directly stimulate the Vagus nerve in your throat.",
];

// Focus Mode Component - Full-screen guided intervention experience
function FocusModeOverlay({
  intervention,
  phase,
  timeRemaining,
  bubbleScale,
  bubbleGlow,
  vibrationIntensity,
  onExit,
}: {
  intervention: VagalIntervention;
  phase: "inhale" | "hold" | "exhale" | "hum";
  timeRemaining: number;
  bubbleScale: Animated.Value;
  bubbleGlow: Animated.Value;
  vibrationIntensity: Animated.Value;
  onExit: () => void;
}) {
  const diaphragmProgress = useRef(new Animated.Value(0)).current;
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    if (intervention !== "Deep Breathing") return;
    if (phase === "inhale") {
      diaphragmProgress.setValue(0);
      Animated.timing(diaphragmProgress, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      }).start();
    } else if (phase === "exhale") {
      diaphragmProgress.setValue(1);
      Animated.timing(diaphragmProgress, {
        toValue: 0,
        duration: 8000,
        useNativeDriver: true,
      }).start();
    }
  }, [phase, intervention, diaphragmProgress]);

  useEffect(() => {
    const id = setInterval(() => {
      setTickerIndex((i) => (i + 1) % VAGUS_FACTS.length);
    }, 30000); // Cycle every 30 seconds
    return () => clearInterval(id);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPhaseInstruction = () => {
    if (intervention === "Deep Breathing") {
      switch (phase) {
        case "inhale":
          return "Inhale deeply...";
        case "hold":
          return "Hold...";
        case "exhale":
          return "Exhale slowly...";
        default:
          return "Breathe";
      }
    } else if (intervention === "Humming") {
      return "Hum low and steady...";
    }
    return "";
  };

  return (
    <View style={styles.focusModeContainer}>
      {/* Anatomical layer – Gut–Brain Axis background */}
      <AnatomicalMirror
        phase={phase}
        intervention={intervention}
        vagusGlow={vibrationIntensity}
        diaphragmProgress={diaphragmProgress}
      />

      {/* Exit button (subtle, top-right) */}
      <TouchableOpacity
        style={styles.focusModeExitButton}
        onPress={onExit}
        activeOpacity={0.7}
      >
        <Text style={styles.focusModeExitText}>✕</Text>
      </TouchableOpacity>

      {/* Timer */}
      <View style={styles.focusModeTimer}>
        <Text style={styles.focusModeTimerLabel}>Intervention Time</Text>
        <Text style={styles.focusModeTimerValue}>{formatTime(timeRemaining)}</Text>
      </View>

      {/* Expanding Bubble Visualizer */}
      <View style={styles.bubbleContainer}>
        <Animated.View
          style={[
            styles.bubbleGlow,
            { transform: [{ scale: bubbleGlow }], opacity: vibrationIntensity },
          ]}
        />
        <Animated.View
          style={[styles.bubble, { transform: [{ scale: bubbleScale }] }]}
        />
      </View>

      {/* Phase Instruction */}
      <Text style={styles.focusModeInstruction}>{getPhaseInstruction()}</Text>

      {/* Intervention Name */}
      <Text style={styles.focusModeInterventionName}>{intervention}</Text>

      {/* "Did you know?" education ticker */}
      <View style={styles.tickerContainer}>
        <Text style={styles.tickerLabel}>Did you know?</Text>
        <Text style={styles.tickerText}>{VAGUS_FACTS[tickerIndex]}</Text>
      </View>
    </View>
  );
}

// Vagal Intervention selector
function InterventionSelector({
  selected,
  onSelect,
}: {
  selected: VagalIntervention;
  onSelect: (i: VagalIntervention) => void;
}) {
  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Vagal Intervention</Text>
      <Text style={styles.selectorHint}>
        Optional: Test physical vagal stimulation techniques
      </Text>
      <View style={styles.optionRow}>
        {VAGAL_INTERVENTION_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionButton,
              selected === opt.value && styles.optionButtonActive,
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                styles.optionButtonText,
                selected === opt.value && styles.optionButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selected !== "None" && (
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>Instructions</Text>
          <Text style={styles.instructionText}>
            {INTERVENTION_INSTRUCTIONS[selected]}
          </Text>
          <Text style={styles.instructionNote}>
            Start the intervention after 30 seconds of baseline recording.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function GutSoundRecordingScreen() {
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState<
    "undetermined" | "granted" | "denied"
  >("undetermined");

  // Recording phase state
  const [phase, setPhase] = useState<RecordingPhase>("setup");

  // Placement Guide state (Step-by-step wizard before recording)
  const [showPlacementGuide, setShowPlacementGuide] = useState(false);
  const [placementStep, setPlacementStep] = useState(1);
  const [step1Completed, setStep1Completed] = useState(false); // Locate LRQ
  const [step2Completed, setStep2Completed] = useState(false); // Apply Pressure (video watched)
  const [step3Completed, setStep3Completed] = useState(false); // Silence Check passed
  const [isCheckingSignal, setIsCheckingSignal] = useState(false);
  const [signalProgress, setSignalProgress] = useState(0);
  const [signalPassed, setSignalPassed] = useState<boolean | null>(null);
  const [decibelLevel, setDecibelLevel] = useState(0);
  const [ambientNoiseLevel, setAmbientNoiseLevel] = useState<number | null>(null);
  const [hummingDetected, setHummingDetected] = useState(false);

  // Protocol and context state
  const [selectedProtocol, setSelectedProtocol] =
    useState<RecordingProtocolType>("quick_check");
  const [context, setContext] = useState<SessionContextType>(DEFAULT_SESSION_CONTEXT);

  // Session flow context (prevents state loops)
  const sessionContext = useSession();

  // VagalPrimer modal state
  const [showVagalPrimer, setShowVagalPrimer] = useState(false);
  
  // Patient profile state
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [activePatientId, setActivePatientIdState] = useState<string | null>(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [newPatientCode, setNewPatientCode] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  
  // Intervention tracking state
  const [interventionStartTime, setInterventionStartTime] = useState<number | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(true); // Default enabled for 4-7-8 breathing
  const [showContactWarning, setShowContactWarning] = useState(false);
  const [interventionPhase, setInterventionPhase] = useState<"inhale" | "hold" | "exhale" | "hum">("inhale");
  const [interventionTimeRemaining, setInterventionTimeRemaining] = useState(300); // 5 minutes in seconds
  
  // Animation refs for bubble
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const bubbleGlow = useRef(new Animated.Value(0.3)).current;
  const vibrationIntensity = useRef(new Animated.Value(0)).current;
  
  // Live biofeedback state (for intervention tracking)
  const [baselineMotility, setBaselineMotility] = useState<number | null>(null);
  const [interventionMotility, setInterventionMotility] = useState<number | null>(null);
  
  // Audio refs for drone, nature backdrop, and voice
  const droneSoundRef = useRef<Audio.Sound | null>(null);
  const natureSoundRef = useRef<Audio.Sound | null>(null);
  const isVoiceSpeakingRef = useRef<boolean>(false);

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);
  const contactCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const targetDuration = PROTOCOL_CONFIG[selectedProtocol].durationSeconds * 1000;

  // Load recordings on mount
  const loadRecordings = useCallback(async () => {
    try {
      const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, {
          intermediates: true,
        });
        return;
      }

      const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
      const recordingsWithDuration: SavedRecording[] = [];

      for (const file of files) {
        if (!file.endsWith(".m4a")) continue;

        const uri = `${RECORDINGS_DIR}${file}`;
        const fileInfo = file.replace("gut-", "").replace(".m4a", "");

        // Parse date from filename
        let dateStr: string;
        try {
          const parts = fileInfo.split("T");
          if (parts.length === 2) {
            const datePart = parts[0];
            const timePart = parts[1];
            const timeSegments = timePart.replace("Z", "").split("-");
            if (timeSegments.length >= 3) {
              const hours = timeSegments[0];
              const minutes = timeSegments[1];
              const seconds = timeSegments[2];
              const ms = timeSegments[3] || "000";
              dateStr = new Date(
                `${datePart}T${hours}:${minutes}:${seconds}.${ms}Z`
              ).toISOString();
            } else {
              dateStr = new Date().toISOString();
            }
          } else {
            dateStr = new Date().toISOString();
          }
        } catch {
          dateStr = new Date().toISOString();
        }

        // Get duration by loading sound briefly
        let durationMs = 0;
        try {
          const { sound, status } = await Audio.Sound.createAsync({ uri });
          if (status.isLoaded && status.durationMillis) {
            durationMs = status.durationMillis;
          }
          await sound.unloadAsync();
        } catch {
          durationMs = 0;
        }

        recordingsWithDuration.push({
          id: fileInfo,
          uri,
          createdAt: dateStr,
          durationMs,
        });
      }

      recordingsWithDuration.sort((a, b) => b.id.localeCompare(a.id));
      setSavedRecordings(recordingsWithDuration);
    } catch (err) {
      console.error("Error loading recordings:", err);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const all = await loadAllPatients();
      setPatients(all);
      const active = await getActivePatient();
      setActivePatientIdState(active?.id ?? null);
    } catch (e) {
      console.error("Error loading patients:", e);
    }
  }, []);

  const handleSelectPatient = useCallback(async (patientId: string) => {
    await setActivePatientId(patientId);
    setActivePatientIdState(patientId);
    setShowPatientModal(false);
  }, []);

  const handleCreatePatient = useCallback(async () => {
    // Patient Code is required, Full Name is optional
    if (!newPatientCode.trim()) {
      Alert.alert("Error", "Please enter a patient code (e.g., GC-101)");
      return;
    }
    try {
      // Use code as the primary identifier, with optional name
      const patientIdentifier = newPatientName.trim()
        ? `${newPatientName.trim()} (${newPatientCode.trim()})`
        : newPatientCode.trim();
      const p = await createAndAddPatient(patientIdentifier);
      await setActivePatientId(p.id);
      setActivePatientIdState(p.id);
      setNewPatientCode("");
      setNewPatientName("");
      setShowPatientModal(false);
      await loadPatients();
    } catch (e) {
      console.error("Error creating patient:", e);
      Alert.alert("Error", "Failed to create patient profile");
    }
  }, [newPatientCode, newPatientName, loadPatients]);

  useEffect(() => {
    loadRecordings();
    loadPatients();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      stopDroneAudio();
      Speech.stop();
    };
  }, [loadRecordings, loadPatients]);

  // Auto-stop when duration reached
  useEffect(() => {
    if (phase === "recording" && recordingDuration >= targetDuration) {
      stopRecording();
    }
  }, [recordingDuration, targetDuration, phase]);
  
  // ============================================================================
  // MONOTONIC CLOCK SYSTEM for Precision 4-7-8 Breathing
  // Uses Date.now() baseline to prevent setTimeout drift over 5-minute sessions
  // ============================================================================

  // 4-7-8 Breathing constants (in milliseconds)
  const INHALE_DURATION_MS = 4000;
  const HOLD_DURATION_MS = 7000;
  const EXHALE_DURATION_MS = 8000;
  const CYCLE_DURATION_MS = INHALE_DURATION_MS + HOLD_DURATION_MS + EXHALE_DURATION_MS; // 19000ms

  // Refs for monotonic timing
  const breathingStartTimeRef = useRef<number | null>(null);
  const breathingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPhaseRef = useRef<"inhale" | "hold" | "exhale" | "hum" | null>(null);
  const interventionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interventionStartTimeRef = useRef<number | null>(null);

  /**
   * Calculate current breathing phase from elapsed time using monotonic clock
   * No drift accumulation - always calculates from baseline timestamp
   */
  const getBreathingPhaseAtTime = useCallback((elapsedMs: number): "inhale" | "hold" | "exhale" => {
    const cyclePosition = elapsedMs % CYCLE_DURATION_MS;

    if (cyclePosition < INHALE_DURATION_MS) {
      return "inhale";
    } else if (cyclePosition < INHALE_DURATION_MS + HOLD_DURATION_MS) {
      return "hold";
    } else {
      return "exhale";
    }
  }, []);

  /**
   * Calculate bubble scale target based on phase and position within phase
   */
  const getBubbleScaleForPhase = useCallback((phase: "inhale" | "hold" | "exhale", cyclePosition: number): number => {
    if (phase === "inhale") {
      // 1.0 → 1.5 over 4 seconds
      const progress = cyclePosition / INHALE_DURATION_MS;
      return 1.0 + (0.5 * progress);
    } else if (phase === "hold") {
      // Stay at 1.5
      return 1.5;
    } else {
      // 1.5 → 0.8 over 8 seconds
      const exhalePosition = cyclePosition - INHALE_DURATION_MS - HOLD_DURATION_MS;
      const progress = exhalePosition / EXHALE_DURATION_MS;
      return 1.5 - (0.7 * progress);
    }
  }, []);

  /**
   * Start monotonic breathing animation - drift-free
   */
  const startInterventionAnimation = useCallback((intervention: VagalIntervention) => {
    // Clean up any existing intervals
    if (breathingIntervalRef.current) {
      clearInterval(breathingIntervalRef.current);
    }

    if (intervention === "Deep Breathing") {
      // Record baseline timestamp for monotonic timing
      breathingStartTimeRef.current = Date.now();
      lastPhaseRef.current = null;

      // Set initial phase
      setInterventionPhase("inhale");
      bubbleScale.setValue(1.0);

      // Monotonic clock loop - checks every 50ms for precision
      breathingIntervalRef.current = setInterval(() => {
        if (!breathingStartTimeRef.current) return;

        const elapsed = Date.now() - breathingStartTimeRef.current;
        const cyclePosition = elapsed % CYCLE_DURATION_MS;
        const currentPhase = getBreathingPhaseAtTime(elapsed);

        // Only update state on phase transitions (prevents unnecessary re-renders)
        if (currentPhase !== lastPhaseRef.current) {
          lastPhaseRef.current = currentPhase;
          setInterventionPhase(currentPhase);

          // Animate bubble to target for new phase
          const targetScale = currentPhase === "inhale" ? 1.5 :
                             currentPhase === "hold" ? 1.5 : 0.8;
          const duration = currentPhase === "inhale" ? INHALE_DURATION_MS :
                          currentPhase === "hold" ? 0 : EXHALE_DURATION_MS;

          if (duration > 0) {
            Animated.timing(bubbleScale, {
              toValue: targetScale,
              duration: duration,
              useNativeDriver: true,
            }).start();
          }
        }
      }, 50); // 50ms precision check interval

    } else if (intervention === "Humming") {
      // Humming: continuous gentle pulse (no drift issues here since it loops)
      setInterventionPhase("hum");
      const pulse = () => {
        Animated.sequence([
          Animated.timing(bubbleScale, {
            toValue: 1.2,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(bubbleScale, {
            toValue: 1.0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }
  }, [bubbleScale, getBreathingPhaseAtTime]);

  /**
   * Stop breathing animation and clean up
   */
  const stopInterventionAnimation = useCallback(() => {
    if (breathingIntervalRef.current) {
      clearInterval(breathingIntervalRef.current);
      breathingIntervalRef.current = null;
    }
    breathingStartTimeRef.current = null;
    lastPhaseRef.current = null;
    bubbleScale.stopAnimation();
  }, [bubbleScale]);

  /**
   * Start monotonic intervention timer (5 minutes countdown)
   * Uses Date.now() baseline for drift-free timing
   */
  const startInterventionTimer = useCallback((intervention: VagalIntervention) => {
    // Clean up any existing timer
    if (interventionTimerRef.current) {
      clearInterval(interventionTimerRef.current);
    }

    // Record baseline timestamp
    interventionStartTimeRef.current = Date.now();
    const INTERVENTION_DURATION_MS = 300000; // 5 minutes in milliseconds

    // Monotonic timer - calculates remaining time from baseline
    interventionTimerRef.current = setInterval(() => {
      if (!interventionStartTimeRef.current) return;

      const elapsed = Date.now() - interventionStartTimeRef.current;
      const remainingMs = Math.max(0, INTERVENTION_DURATION_MS - elapsed);
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      setInterventionTimeRemaining(remainingSeconds);

      if (remainingSeconds <= 0) {
        if (interventionTimerRef.current) {
          clearInterval(interventionTimerRef.current);
          interventionTimerRef.current = null;
        }
        setIsFocusMode(false);
        stopInterventionAnimation();
      }
    }, 100); // Check every 100ms for smooth countdown
  }, [stopInterventionAnimation]);
  
  // Start drone audio for humming (60Hz low-frequency tone)
  const startDroneAudio = useCallback(async () => {
    try {
      // Load and play 60Hz sine wave tone
      // Note: In production, you would use a pre-recorded 60Hz audio file
      // For now, we'll create a placeholder that can be replaced with an actual audio file
      // The audio file should be placed in assets/audio/60hz-drone.mp3 or similar
      
      // Configure audio mode for playback while recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true, // Enable audio ducking on Android
      });
      
      // Load drone sound (60Hz tone)
      // TODO: Replace with actual 60Hz audio file path
      // For now, using a placeholder - in production, use: require('../assets/audio/60hz-drone.mp3')
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }, // Placeholder - replace with 60Hz tone
        { 
          shouldPlay: true,
          isLooping: true,
          volume: 0.3, // 30% volume for drone
        }
      );
      
      droneSoundRef.current = sound;
      
      // Start nature backdrop (Brownian noise or soft rain) at 20% volume
      const { sound: natureSound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }, // Placeholder - replace with nature sound
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.2, // 20% volume for nature backdrop
        }
      );
      
      natureSoundRef.current = natureSound;
    } catch (error) {
      console.error("Error starting drone audio:", error);
    }
  }, []);
  
  // Start nature backdrop only (for Deep Breathing)
  const startNatureBackdrop = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      
      // Start nature backdrop (Brownian noise or soft rain) at 20% volume
      const { sound: natureSound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }, // Placeholder - replace with nature sound
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.2, // 20% volume for nature backdrop
        }
      );
      
      natureSoundRef.current = natureSound;
    } catch (error) {
      console.error("Error starting nature backdrop:", error);
    }
  }, []);

  // Stop drone and nature audio
  const stopDroneAudio = useCallback(async () => {
    try {
      if (droneSoundRef.current) {
        await droneSoundRef.current.unloadAsync();
        droneSoundRef.current = null;
      }
      if (natureSoundRef.current) {
        await natureSoundRef.current.unloadAsync();
        natureSoundRef.current = null;
      }
    } catch (error) {
      console.error("Error stopping drone audio:", error);
    }
  }, []);
  
  // Audio ducking: Lower drone/nature volume when voice is speaking
  const duckBackgroundAudio = useCallback(async (duck: boolean) => {
    try {
      isVoiceSpeakingRef.current = duck;
      
      if (duck) {
        // Lower volume to 10% when voice is speaking
        if (droneSoundRef.current) {
          await droneSoundRef.current.setVolumeAsync(0.1);
        }
        if (natureSoundRef.current) {
          await natureSoundRef.current.setVolumeAsync(0.1);
        }
      } else {
        // Restore normal volume
        if (droneSoundRef.current) {
          await droneSoundRef.current.setVolumeAsync(0.3);
        }
        if (natureSoundRef.current) {
          await natureSoundRef.current.setVolumeAsync(0.2);
        }
      }
    } catch (error) {
      console.error("Error ducking audio:", error);
    }
  }, []);
  
  // VibeMeter: Monitor microphone input for Vagus Nerve glow biofeedback
  // Links microphone volume to opacity of Vagus Nerve graphic
  useEffect(() => {
    if (isFocusMode && context.intervention === "Humming") {
      // Note: In production, this would monitor real-time microphone RMS levels
      // For now, simulates mic volume to drive Vagus glow intensity
      // The vibeMeter drives the opacity: higher volume = more intense glow
      const glowInterval = setInterval(() => {
        // Simulate mic volume: 0.4 to 0.9 (more intense range for visible feedback)
        Animated.timing(vibrationIntensity, {
          toValue: 0.4 + Math.random() * 0.5, // 0.4 to 0.9 for intense glow
          duration: 300, // Faster response for real-time feel
          useNativeDriver: true, // Hardware-accelerated
        }).start();
      }, 300); // Update more frequently for responsive feedback
      
      return () => clearInterval(glowInterval);
    } else {
      // Reset when not humming
      vibrationIntensity.setValue(0);
    }
  }, [isFocusMode, context.intervention, vibrationIntensity]);
  
  // ============================================================================
  // MONOTONIC VOICE GUIDE SYSTEM - Synced with Breathing Animation
  // Triggers voice prompts at phase transitions, perfectly aligned with visuals
  // ============================================================================

  // Ref to track the last voiced phase (prevents duplicate prompts)
  const lastVoicedPhaseRef = useRef<"inhale" | "hold" | "exhale" | null>(null);
  const voiceGuideStartTimeRef = useRef<number | null>(null);
  const voiceGuideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isFocusMode && voiceGuideEnabled && context.intervention) {
      const speakPrompt = async (text: string) => {
        try {
          // Duck background audio when voice starts speaking
          await duckBackgroundAudio(true);

          // Speak with calm, natural voice at slower rate (0.85x)
          Speech.speak(text, {
            language: 'en',
            pitch: 0.9,
            rate: 0.85,
            onDone: () => {
              duckBackgroundAudio(false).catch(console.error);
            },
            onStopped: () => {
              duckBackgroundAudio(false).catch(console.error);
            },
          });
        } catch (error) {
          console.error("Error speaking prompt:", error);
          duckBackgroundAudio(false).catch(console.error);
        }
      };

      if (context.intervention === "Deep Breathing") {
        // Monotonic voice guide - synced with breathing animation baseline
        voiceGuideStartTimeRef.current = breathingStartTimeRef.current || Date.now();
        lastVoicedPhaseRef.current = null;

        // Initial prompt
        speakPrompt("Inhale deeply through your nose...");
        lastVoicedPhaseRef.current = "inhale";

        // Monotonic check loop - triggers prompts at phase transitions
        voiceGuideIntervalRef.current = setInterval(() => {
          if (!voiceGuideStartTimeRef.current || !isFocusMode || !voiceGuideEnabled) return;

          const elapsed = Date.now() - voiceGuideStartTimeRef.current;
          const cyclePosition = elapsed % CYCLE_DURATION_MS;

          let currentPhase: "inhale" | "hold" | "exhale";
          if (cyclePosition < INHALE_DURATION_MS) {
            currentPhase = "inhale";
          } else if (cyclePosition < INHALE_DURATION_MS + HOLD_DURATION_MS) {
            currentPhase = "hold";
          } else {
            currentPhase = "exhale";
          }

          // Only speak on phase transition
          if (currentPhase !== lastVoicedPhaseRef.current) {
            lastVoicedPhaseRef.current = currentPhase;

            switch (currentPhase) {
              case "inhale":
                speakPrompt("Inhale deeply through your nose...");
                break;
              case "hold":
                speakPrompt("Hold your breath...");
                break;
              case "exhale":
                speakPrompt("Exhale slowly through your mouth...");
                break;
            }
          }
        }, 100); // Check every 100ms for precise phase detection

        return () => {
          if (voiceGuideIntervalRef.current) {
            clearInterval(voiceGuideIntervalRef.current);
            voiceGuideIntervalRef.current = null;
          }
          voiceGuideStartTimeRef.current = null;
          lastVoicedPhaseRef.current = null;
          Speech.stop();
        };

      } else if (context.intervention === "Humming") {
        // Humming uses simple interval (no complex phase sync needed)
        const hummingStartTime = Date.now();
        const HUMMING_PROMPT_INTERVAL_MS = 10000;

        const hummingInterval = setInterval(() => {
          if (!isFocusMode || !voiceGuideEnabled) return;
          speakPrompt("Hum low and steady... feel the vibration in your throat and chest.");
        }, HUMMING_PROMPT_INTERVAL_MS);

        return () => {
          clearInterval(hummingInterval);
          Speech.stop();
        };
      }
    }
  }, [isFocusMode, voiceGuideEnabled, context.intervention, duckBackgroundAudio]);


  const requestPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setPermissionStatus(status === "granted" ? "granted" : "denied");
    return status === "granted";
  };

  const startRecording = async () => {
    try {
      if (permissionStatus !== "granted") {
        const ok = await requestPermission();
        if (!ok) return;
      }

      await stopPlayback();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setPhase("recording");
      setRecordingDuration(0);
      setInterventionStartTime(null); // Reset intervention start time
      setIsFocusMode(false); // Reset focus mode
      setInterventionTimeRemaining(300); // Reset timer
      setBaselineMotility(null); // Reset biofeedback
      setInterventionMotility(null);
      
      // Stop any audio that might be playing
      await stopDroneAudio();
      Speech.stop();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1000);
      }, 1000);

      // Contact warning detection: Check for flat background noise (phone on table)
      // Monitor first 10 seconds to detect if phone is not in contact with skin
      const contactCheckInterval = setInterval(() => {
        if (recordingDuration >= 10000 && recordingDuration < 30000) {
          // Simulate checking for flat noise (very low variance in energy)
          // In production, this would analyze real-time audio RMS variance
          // For now, simulate: if baseline motility is very low, show warning
          const simulatedEnergyVariance = Math.random();
          if (simulatedEnergyVariance < 0.1) {
            // Very flat noise detected (like phone on table)
            setShowContactWarning(true);
          }
        }
      }, 2000); // Check every 2 seconds
      
      // Clear contact check after 30 seconds
      setTimeout(() => {
        clearInterval(contactCheckInterval);
      }, 30000);

      // Auto-start intervention after 30 seconds if selected
      if (context.intervention && context.intervention !== "None") {
        setTimeout(() => {
          setInterventionStartTime(30); // Start intervention at 30 seconds
          setIsFocusMode(true); // Enter Focus Mode
          setInterventionTimeRemaining(300); // 5 minutes
          
          // Start intervention animation and timer
          const intervention = context.intervention;
          if (intervention && intervention !== "None") {
            startInterventionAnimation(intervention);
            startInterventionTimer(intervention);
            
            // Start audio: 60Hz drone + nature backdrop for full 5 min (Humming & Deep Breathing)
            if (intervention === "Humming" || intervention === "Deep Breathing") {
              startDroneAudio();
            }
          }
        }, 30000);
        
        // Simulate baseline/intervention motility for live biofeedback
        // In a real implementation, this would come from real-time audio analysis
        // Simulate baseline (first 30 seconds)
        setTimeout(() => {
          const baseline = 50 + Math.random() * 20; // 50-70 range
          setBaselineMotility(baseline);
          
          // Check for contact warning: if baseline is very low, likely no contact
          if (baseline < 10) {
            setShowContactWarning(true);
          }
        }, 30000);
        
        // Update intervention motility periodically after baseline
        const interventionInterval = setInterval(() => {
          if (recordingDuration > 30000) {
            // Simulate intervention effect (slightly higher)
            const baseValue = 50 + Math.random() * 20;
            const interventionEffect = Math.random() * 15; // 0-15% boost
            setInterventionMotility(baseValue * (1 + interventionEffect / 100));
          }
        }, 5000);
        
        // Clean up interval when recording stops
        setTimeout(() => {
          clearInterval(interventionInterval);
        }, targetDuration);
      }
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (contactCheckIntervalRef.current) {
        clearInterval(contactCheckIntervalRef.current);
        contactCheckIntervalRef.current = null;
      }

      setPhase("processing");

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const finalDuration = recordingDuration;

      setRecording(null);
      setRecordingDuration(0);
      setShowContactWarning(false); // Reset contact warning

      if (uri) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const targetUri = `${RECORDINGS_DIR}gut-${timestamp}.m4a`;

        await FileSystem.moveAsync({
          from: uri,
          to: targetUri,
        });

        // Require active patient before saving session
        if (!activePatientId) {
          Alert.alert(
            "No Patient Selected",
            "Please select a patient profile before saving the recording.",
            [{ text: "OK" }]
          );
          setPhase("setup");
          return;
        }

        // Create and save session to the new store
        const durationSeconds = Math.floor(finalDuration / 1000);
        const session = createSession(
          selectedProtocol,
          targetUri,
          durationSeconds,
          context,
          activePatientId
        );

        // Add intervention tracking data if intervention was used
        if (context.intervention && context.intervention !== "None" && interventionStartTime !== null) {
          session.vagalBreathing = {
            enabled: true,
            startTimeSeconds: interventionStartTime,
          };
        }
        
        // Tag as guided intervention if Focus Mode was used
        if (isFocusMode) {
          session.guidedIntervention = true;
        }

        await addSession(session);

        // Generate analytics for the session
        // TODO: In the future, implement proper audio sample extraction
        // For now, we use placeholder analytics that simulate realistic values
        const analytics = generatePlaceholderAnalytics(durationSeconds);
        await updateSessionAnalytics(session.id, analytics);

        // Also update local list for display
        const newItem: SavedRecording = {
          id: timestamp,
          uri: targetUri,
          createdAt: new Date().toISOString(),
          durationMs: finalDuration,
          protocolType: selectedProtocol,
        };

        setSavedRecordings((prev) => [newItem, ...prev]);

        // Navigate to session detail to show results
        setPhase("setup");
        router.push(`/session/${session.id}`);
        return;
      }

      setPhase("setup");
    } catch (err) {
      console.error("Error stopping recording:", err);
      setPhase("setup");
    }
  };

  const handleStartRecording = () => {
    if (!activePatientId) {
      Alert.alert(
        "Select Patient",
        "Please select an active patient before starting a recording.",
        [{ text: "OK" }]
      );
      setShowPatientModal(true);
      return;
    }

    // Determine the recording mode based on intervention
    const intervention = context.intervention || "None";
    const mode = intervention === "None" ? "standard" :
                 intervention === "Humming" ? "humming" :
                 intervention === "Deep Breathing" ? "deep_breathing" :
                 intervention === "Cold Exposure" ? "cold_exposure" :
                 intervention === "Gargling" ? "gargling" : "standard";

    // Start session and lock the track (prevents mode changes mid-session)
    sessionContext.startSession(mode, intervention !== "None" ? intervention : undefined);

    // Show PlacementGuide wizard first
    setShowPlacementGuide(true);
    setPlacementStep(1);
    setStep1Completed(false);
    setStep2Completed(false);
    setStep3Completed(false);
  };

  // Handle VagalPrimer completion
  const handlePrimerComplete = () => {
    setShowVagalPrimer(false);
    sessionContext.completePrimer();
    sessionContext.setPhase("recording");
    // Skip signal check after primer - go directly to recording
    setStep3Completed(true);
    startRecording();
  };

  // Handle VagalPrimer skip
  const handlePrimerSkip = () => {
    setShowVagalPrimer(false);
    sessionContext.setPhase("recording");
    // Skip signal check after primer skip - go directly to recording
    setStep3Completed(true);
    startRecording();
  };

  // PlacementGuide handlers
  const handlePlacementStepComplete = () => {
    if (placementStep === 1) {
      // Step 1: Locate LRQ - user confirms they found it
      setStep1Completed(true);
      setPlacementStep(2);
    } else if (placementStep === 2) {
      // Step 2: Apply Pressure - INSTRUCTIONAL GATE: User must confirm they watched video and are pressing firmly
      // The video must be displayed before proceeding
      Alert.alert(
        "Confirm Pressure",
        "Have you watched the 'How to Hold' video and are now pressing the phone firmly against your LRQ?",
        [
          { text: "Not Yet", style: "cancel" },
          {
            text: "Yes, Pressing Firmly",
            onPress: () => {
              setStep2Completed(true);

              // Check if we need to show the VagalPrimer (for interventions)
              const intervention = context.intervention;
              if (intervention && intervention !== "None" && requiresPrimer(sessionContext.selectedMode)) {
                // Close PlacementGuide and show VagalPrimer
                setShowPlacementGuide(false);
                sessionContext.setPhase("primer");
                setShowVagalPrimer(true);
              } else {
                // Skip primer, go directly to calibration
                setPlacementStep(3);
              }
            },
          },
        ]
      );
    } else if (placementStep === 3) {
      // Step 3 completion is handled by signal check
      if (signalPassed) {
        setStep3Completed(true);
        setShowPlacementGuide(false);
        sessionContext.setPhase("recording");
        // All checks passed - start recording
        startRecording();
      }
    }
  };

  const handleStartSignalCheck = async () => {
    setIsCheckingSignal(true);
    setSignalProgress(0);
    setSignalPassed(null);
    setHummingDetected(false);
    setAmbientNoiseLevel(null);

    // Request microphone permission if needed
    if (permissionStatus !== "granted") {
      const ok = await requestPermission();
      if (!ok) {
        setIsCheckingSignal(false);
        Alert.alert("Permission Required", "Microphone permission is needed for noise calibration.");
        return;
      }
    }

    // Start a temporary recording for noise analysis
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { recording: noiseCheckRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // Simulate 5-second noise check - always passes for development
      // In production, this would analyze real-time audio RMS and frequency
      let progress = 0;

      const checkInterval = setInterval(() => {
        progress += 10;
        setSignalProgress(progress);

        // Show simulated low noise values for UI feedback
        const simulatedNoise = Math.random() * 0.03;
        setAmbientNoiseLevel(simulatedNoise);

        if (progress >= 100) {
          clearInterval(checkInterval);
          setIsCheckingSignal(false);

          // Stop the temporary recording
          (async () => {
            try {
              await noiseCheckRecording.stopAndUnloadAsync();
            } catch (e) {
              console.error("Error stopping noise check recording:", e);
            }
          })();

          // Always pass in development mode
          setSignalPassed(true);
          setStep3Completed(true);
        }
      }, 500); // Update every 500ms for 5 seconds
    } catch (error) {
      console.error("Error starting noise check:", error);
      setIsCheckingSignal(false);
      Alert.alert("Error", "Failed to start noise calibration. Please try again.");
    }
  };

  const handleRetrySignalCheck = () => {
    setSignalPassed(null);
    setHummingDetected(false);
    setAmbientNoiseLevel(null);
    handleStartSignalCheck();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlayingId(null);
    setPlaybackPosition(0);
  };

  const handlePlayPause = async (item: SavedRecording) => {
    try {
      if (playingId === item.id) {
        await stopPlayback();
        return;
      }

      await stopPlayback();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: item.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setPlayingId(item.id);
    } catch (err) {
      console.error("Error playing recording:", err);
      await stopPlayback();
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setPlaybackPosition(status.positionMillis);

    if (status.didJustFinish) {
      stopPlayback();
    }
  };

  const handleDelete = (item: SavedRecording) => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this recording? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (playingId === item.id) {
                await stopPlayback();
              }

              await FileSystem.deleteAsync(item.uri);
              setSavedRecordings((prev) =>
                prev.filter((r) => r.id !== item.id)
              );
            } catch (err) {
              console.error("Error deleting recording:", err);
            }
          },
        },
      ]
    );
  };

  const renderRecordingItem = ({ item }: { item: SavedRecording }) => {
    const isPlaying = playingId === item.id;

    return (
      <View style={styles.recordCard}>
        <View style={styles.recordInfo}>
          <Text style={styles.recordDate}>
            {formatRelativeDate(item.createdAt)}
          </Text>
          <Text style={styles.recordDuration}>
            {isPlaying
              ? `${formatDuration(playbackPosition)} / ${formatDuration(item.durationMs)}`
              : formatDuration(item.durationMs)}
          </Text>
        </View>

        <View style={styles.recordActions}>
          <TouchableOpacity
            style={[styles.actionButton, isPlaying && styles.actionButtonActive]}
            onPress={() => handlePlayPause(item)}
          >
            <Text style={styles.actionButtonText}>
              {isPlaying ? "⏹" : "▶"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.actionButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Calculate progress for recording
  const progressPercent = Math.min((recordingDuration / targetDuration) * 100, 100);
  const remainingMs = Math.max(targetDuration - recordingDuration, 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Gut Sound Recording</Text>

      {/* PlacementGuide Modal - Step-by-step wizard before recording */}
      {showPlacementGuide && (
        <Modal
          visible={showPlacementGuide}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            if (placementStep === 1 && !step1Completed) {
              setShowPlacementGuide(false);
            }
          }}
        >
          <View style={styles.placementGuideContainer}>
            <PlacementGuide
              step={placementStep}
              onPlacementConfirmed={handlePlacementStepComplete}
              isCheckingSignal={isCheckingSignal}
              signalProgress={signalProgress}
              signalPassed={signalPassed}
              decibelLevel={decibelLevel}
              onStartSignalCheck={handleStartSignalCheck}
              onRetrySignalCheck={handleRetrySignalCheck}
              onClose={() => setShowPlacementGuide(false)}
            />
            {(hummingDetected || (ambientNoiseLevel !== null && ambientNoiseLevel >= 0.05)) && (
              <View style={styles.noiseWarningContainer}>
                <Text style={styles.noiseWarningText}>
                  ⚠️ Too much noise. Please find a quiet space.
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* VagalPrimer Modal - Pre-Recording Vagus Nerve Stimulation */}
      {showVagalPrimer && context.intervention && context.intervention !== "None" && (
        <Modal
          visible={showVagalPrimer}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            // Allow dismissing with back button
            handlePrimerSkip();
          }}
        >
          <VagalPrimer
            intervention={context.intervention as "Humming" | "Deep Breathing" | "Gargling" | "Cold Exposure"}
            onComplete={handlePrimerComplete}
            onSkip={handlePrimerSkip}
            showSkip={true}
          />
        </Modal>
      )}

      {phase === "setup" && (
        <ScrollView
          style={styles.setupScrollView}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            Set up your recording session, then relax and capture your gut sounds.
          </Text>

          <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>Active Patient *</Text>
            <Text style={styles.selectorHint}>Required before recording</Text>
            {activePatientId ? (
              <View style={styles.patientSelectedContainer}>
                <Text style={styles.patientSelectedName}>
                  {patients.find((p) => p.id === activePatientId)?.code ?? "Unknown"}
                </Text>
                <TouchableOpacity
                  style={styles.changePatientButton}
                  onPress={() => setShowPatientModal(true)}
                >
                  <Text style={styles.changePatientText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectPatientButton}
                onPress={() => setShowPatientModal(true)}
              >
                <Text style={styles.selectPatientButtonText}>Select Patient</Text>
              </TouchableOpacity>
            )}
          </View>

          <ProtocolSelector
            selected={selectedProtocol}
            onSelect={setSelectedProtocol}
          />

          <MealTimingSelector
            selected={context.mealTiming}
            onSelect={(m) => setContext({ ...context, mealTiming: m })}
          />

          <StressSelector
            value={context.stressLevel}
            onChange={(v) => setContext({ ...context, stressLevel: v })}
          />

          <PostureSelector
            selected={context.posture}
            onSelect={(p) => setContext({ ...context, posture: p })}
          />

          <StateOfMindSelector
            selected={context.stateOfMind}
            onSelect={(s) => setContext({ ...context, stateOfMind: s })}
          />

          <InterventionSelector
            selected={context.intervention || "None"}
            onSelect={(i) => setContext({ ...context, intervention: i })}
          />

          {/* BEGIN SESSION Button - Large, High-Contrast CTA */}
          <TouchableOpacity
            style={[styles.beginSessionButton, !activePatientId && styles.beginSessionButtonDisabled]}
            onPress={handleStartRecording}
            activeOpacity={0.8}
            disabled={!activePatientId}
          >
            <View style={styles.beginSessionContent}>
              <Text style={styles.beginSessionIcon}>🎙</Text>
              <View style={styles.beginSessionTextContainer}>
                <Text style={styles.beginSessionTitle}>
                  {activePatientId ? "BEGIN SESSION" : "Select Patient First"}
                </Text>
                <Text style={styles.beginSessionSubtitle}>
                  {activePatientId
                    ? context.intervention && context.intervention !== "None"
                      ? `${context.intervention} Protocol`
                      : "Standard Recording"
                    : "Required before recording"}
                </Text>
              </View>
            </View>
            <View style={styles.beginSessionArrow}>
              <Text style={styles.beginSessionArrowText}>→</Text>
            </View>
          </TouchableOpacity>

          {permissionStatus === "denied" && (
            <Text style={styles.warning}>
              Microphone permission denied. Please enable it in system settings.
            </Text>
          )}

          <Text style={styles.sectionTitle}>
            Recent Recordings ({savedRecordings.length})
          </Text>

          {savedRecordings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎙</Text>
              <Text style={styles.emptyText}>No recordings yet</Text>
              <Text style={styles.emptySubtext}>
                Set your preferences and tap Start Recording
              </Text>
            </View>
          ) : (
            <FlatList
              data={savedRecordings.slice(0, 5)}
              keyExtractor={(item) => item.id}
              renderItem={renderRecordingItem}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {phase === "recording" && (
        <>
          {/* Focus Mode Overlay - Full screen when intervention is active */}
          {isFocusMode && context.intervention && context.intervention !== "None" ? (
            <FocusModeOverlay
              intervention={context.intervention}
              phase={interventionPhase}
              timeRemaining={interventionTimeRemaining}
              bubbleScale={bubbleScale}
              bubbleGlow={bubbleGlow}
              vibrationIntensity={vibrationIntensity}
              onExit={async () => {
                setIsFocusMode(false);
                // Stop monotonic timing systems
                stopInterventionAnimation();
                if (interventionTimerRef.current) {
                  clearInterval(interventionTimerRef.current);
                  interventionTimerRef.current = null;
                }
                if (voiceGuideIntervalRef.current) {
                  clearInterval(voiceGuideIntervalRef.current);
                  voiceGuideIntervalRef.current = null;
                }
                // Stop all audio when exiting Focus Mode
                await stopDroneAudio();
                // Stop any ongoing speech
                Speech.stop();
              }}
            />
          ) : (
            <View style={styles.recordingPhase}>
              <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>Recording</Text>
                <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                <Text style={styles.timerRemaining}>
                  {formatDuration(remainingMs)} remaining
                </Text>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                  />
                </View>

                <Text style={styles.protocolLabel}>
                  {PROTOCOL_CONFIG[selectedProtocol].label}
                </Text>
              </View>

              {/* Recording indicator */}
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Listening...</Text>
              </View>

              {/* Contact Warning */}
              {showContactWarning && (
                <View style={styles.contactWarningContainer}>
                  <Text style={styles.contactWarningText}>
                    ⚠️ Ensure phone is placed firmly against the abdomen for an accurate reading.
                  </Text>
                </View>
              )}

              {/* Real-Time Impact Meter (for interventions) */}
              {context.intervention && context.intervention !== "None" && recordingDuration > 30000 && (
                <View style={styles.impactMeterContainer}>
                  <Text style={styles.impactMeterTitle}>Real-Time Impact</Text>
                  <View style={styles.impactMeterRow}>
                    <View style={styles.impactMeterSegment}>
                      <Text style={styles.impactMeterLabel}>Baseline</Text>
                      <Text style={styles.impactMeterValue}>
                        {baselineMotility !== null ? `${Math.round(baselineMotility)}` : "..."}
                      </Text>
                    </View>
                    <View style={styles.impactMeterSegment}>
                      <Text style={styles.impactMeterLabel}>Intervention</Text>
                      <Text style={styles.impactMeterValue}>
                        {interventionMotility !== null ? `${Math.round(interventionMotility)}` : "..."}
                      </Text>
                    </View>
                    <View style={styles.impactMeterSegment}>
                      <Text style={styles.impactMeterLabel}>Change</Text>
                      <Text
                        style={[
                          styles.impactMeterChange,
                          baselineMotility !== null &&
                            interventionMotility !== null &&
                            interventionMotility > baselineMotility
                            ? styles.impactMeterChangePositive
                            : styles.impactMeterChangeNeutral,
                        ]}
                      >
                        {baselineMotility !== null && interventionMotility !== null
                          ? `${Math.round(
                              ((interventionMotility - baselineMotility) / baselineMotility) * 100
                            )}%`
                          : "..."}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Context summary */}
              <View style={styles.contextSummary}>
                <Text style={styles.contextItem}>
                  Stress: {context.stressLevel}/10
                </Text>
                <Text style={styles.contextItem}>
                  {POSTURE_OPTIONS.find((p) => p.value === context.posture)?.label}
                </Text>
                <Text style={styles.contextItem}>
                  {MEAL_TIMING_OPTIONS.find((m) => m.value === context.mealTiming)?.label}{" "}
                  since meal
                </Text>
              </View>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopRecording}
                activeOpacity={0.8}
              >
                <Text style={styles.stopButtonIcon}>⏹</Text>
                <Text style={styles.stopButtonText}>Stop Early</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {phase === "processing" && (
        <View style={styles.processingPhase}>
          <Text style={styles.processingIcon}>⏳</Text>
          <Text style={styles.processingText}>Saving recording...</Text>
        </View>
      )}

      {/* Patient Selection Modal */}
      {showPatientModal && (
        <View style={[styles.modalOverlay, { zIndex: 9999, opacity: 1 }]}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', opacity: 1, zIndex: 9999 }]}>
            <Text style={[styles.modalTitle, { color: '#000000', opacity: 1 }]}>Select Patient</Text>

            {/* Existing Patients */}
            <ScrollView style={styles.patientList}>
              {patients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  style={[
                    styles.patientItem,
                    { backgroundColor: '#F5F5F5' },
                    activePatientId === patient.id && styles.patientItemActive,
                  ]}
                  onPress={() => handleSelectPatient(patient.id)}
                >
                  <Text
                    style={[
                      styles.patientItemName,
                      { color: '#000000', opacity: 1 },
                      activePatientId === patient.id && styles.patientItemNameActive,
                    ]}
                  >
                    {patient.name}
                  </Text>
                  {activePatientId === patient.id && (
                    <Text style={[styles.patientItemCheck, { color: '#19E6C7' }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Create New Patient */}
            <View style={styles.createPatientSection}>
              <Text style={[styles.createPatientLabel, { color: '#333333', opacity: 1 }]}>Create New Patient</Text>
              <TextInput
                style={[styles.createPatientInput, { color: '#000000', backgroundColor: '#FFFFFF', opacity: 1 }]}
                placeholder="Patient Code * (e.g., GC-101)"
                value={newPatientCode}
                onChangeText={setNewPatientCode}
                placeholderTextColor="#666666"
                keyboardAppearance="light"
              />
              <TextInput
                style={[styles.createPatientInput, { marginTop: spacing.sm, color: '#000000', backgroundColor: '#FFFFFF', opacity: 1 }]}
                placeholder="Full Name (optional)"
                value={newPatientName}
                onChangeText={setNewPatientName}
                placeholderTextColor="#666666"
                keyboardAppearance="light"
              />
              <TouchableOpacity
                style={styles.createPatientButton}
                onPress={handleCreatePatient}
              >
                <Text style={styles.createPatientButtonText}>Create</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowPatientModal(false);
                setNewPatientCode("");
                setNewPatientName("");
              }}
            >
              <Text style={[styles.modalCloseButtonText, { color: '#333333', opacity: 1 }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: safeArea.horizontal,
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
  },
  backButton: {
    marginBottom: spacing.base,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  title: {
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  setupScrollView: {
    flex: 1,
  },
  // Selector styles
  selectorContainer: {
    marginBottom: spacing.lg,
  },
  selectorLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  selectorHint: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginBottom: spacing.sm,
    fontStyle: "italic",
  },
  protocolButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  protocolButton: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  protocolButtonActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  protocolButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  protocolButtonTextActive: {
    color: colors.accent,
  },
  protocolDuration: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  protocolDurationActive: {
    color: colors.accent,
  },
  protocolDescription: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  optionButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  optionButtonTextActive: {
    color: colors.accent,
  },
  stressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stressButton: {
    width: 28,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stressButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stressButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  stressButtonTextActive: {
    color: colors.background,
    fontWeight: typography.weights.bold,
  },
  stressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  stressLabelText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  // Start button
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  startButtonIcon: {
    color: colors.background,
    fontSize: typography.sizes.lg,
  },
  startButtonText: {
    color: colors.background,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  startButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.7,
  },
  warning: {
    color: colors.warning,
    marginBottom: spacing.base,
    textAlign: "center",
    fontSize: typography.sizes.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.base,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.base,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },
  bottomSpacer: {
    height: spacing["3xl"],
  },
  // Recording phase styles
  recordingPhase: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing["4xl"],
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: spacing["2xl"],
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    marginBottom: spacing.sm,
  },
  timerText: {
    color: colors.textPrimary,
    fontSize: typography.sizes["4xl"],
    fontWeight: typography.weights.bold,
    fontVariant: ["tabular-nums"],
  },
  timerRemaining: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  progressBar: {
    width: 200,
    height: 6,
    backgroundColor: colors.backgroundCard,
    borderRadius: 3,
    marginTop: spacing.lg,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  protocolLabel: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: spacing.md,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  recordingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  contactWarningContainer: {
    backgroundColor: colors.warning + "20",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  contactWarningText: {
    color: colors.warning,
    fontSize: typography.sizes.sm,
    textAlign: "center",
    fontWeight: typography.weights.medium,
  },
  contextSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    marginBottom: spacing["2xl"],
  },
  contextItem: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  // Toggle styles
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  toggleContainerActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    position: "relative",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: colors.accent,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    position: "absolute",
    left: 2,
    top: 2,
  },
  toggleThumbActive: {
    left: "auto",
    right: 2,
  },
  toggleLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  toggleLabelActive: {
    color: colors.accent,
  },
  // Instruction card styles
  instructionCard: {
    marginTop: spacing.base,
    padding: spacing.base,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  instructionTitle: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  instructionText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
    marginBottom: spacing.xs,
  },
  instructionNote: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontStyle: "italic",
  },
  // Breathing visualizer styles (kept for backward compatibility)
  breathingContainer: {
    alignItems: "center",
    marginVertical: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  breathingLabel: {
    color: colors.accent,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  breathingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accentDim,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  // Impact meter styles
  impactMeterContainer: {
    marginVertical: spacing.lg,
    padding: spacing.base,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  impactMeterTitle: {
    color: colors.accent,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  impactMeterRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: spacing.sm,
  },
  impactMeterSegment: {
    alignItems: "center",
    flex: 1,
  },
  impactMeterLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
  },
  impactMeterValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  impactMeterChange: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  impactMeterChangePositive: {
    color: colors.success,
  },
  impactMeterChangeNeutral: {
    color: colors.textSecondary,
  },
  // Focus Mode styles
  focusModeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  focusModeExitButton: {
    position: "absolute",
    top: safeArea.top + spacing.base,
    right: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1001,
  },
  focusModeExitText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  focusModeTimer: {
    position: "absolute",
    top: safeArea.top + spacing.base,
    alignItems: "center",
  },
  focusModeTimerLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  focusModeTimerValue: {
    color: colors.accent,
    fontSize: typography.sizes["2xl"],
    fontWeight: typography.weights.bold,
    fontVariant: ["tabular-nums"],
  },
  bubbleContainer: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing["2xl"],
  },
  bubble: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentDim,
    borderWidth: 3,
    borderColor: colors.accent,
    position: "absolute",
  },
  bubbleGlow: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.accent,
    position: "absolute",
    opacity: 0.3,
  },
  focusModeInstruction: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  focusModeInterventionName: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    textAlign: "center",
  },
  tickerContainer: {
    position: "absolute",
    bottom: safeArea.bottom + spacing.lg,
    left: spacing.base,
    right: spacing.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: radius.md,
  },
  tickerLabel: {
    color: colors.accent,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tickerText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
    textAlign: "center",
  },
  // Patient selector styles
  patientSelectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.base,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  patientSelectedName: {
    color: colors.accent,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  changePatientButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.sm,
  },
  changePatientText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  selectPatientButton: {
    padding: spacing.base,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    alignItems: "center",
  },
  selectPatientButtonText: {
    color: "white",
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  // Patient modal styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  patientList: {
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  patientItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.base,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patientItemActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  patientItemName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  patientItemNameActive: {
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  patientItemCheck: {
    color: colors.accent,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  createPatientSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createPatientLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.sm,
  },
  createPatientRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  createPatientInput: {
    flex: 1,
    padding: spacing.base,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    color: "#000000",
    fontSize: typography.sizes.base,
    minHeight: 50,
  },
  createPatientButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 50,
  },
  createPatientButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  modalCloseButton: {
    marginTop: spacing.lg,
    padding: spacing.base,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  stopButtonIcon: {
    color: "white",
    fontSize: typography.sizes.md,
  },
  stopButtonText: {
    color: "white",
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  // Processing phase
  processingPhase: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  processingIcon: {
    fontSize: 48,
    marginBottom: spacing.base,
  },
  processingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
  // Recording list styles
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordInfo: {
    flex: 1,
  },
  recordDate: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  recordDuration: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontVariant: ["tabular-nums"],
  },
  recordActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonActive: {
    backgroundColor: colors.accent,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  placementGuideContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  noiseWarningContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.warning + "20",
    borderTopWidth: 2,
    borderTopColor: colors.warning,
    padding: spacing.lg,
    alignItems: "center",
  },
  noiseWarningText: {
    color: colors.warning,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    textAlign: "center",
  },
  // BEGIN SESSION Button - Large, High-Contrast CTA
  beginSessionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accent,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    minHeight: 100,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  beginSessionButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.7,
    shadowOpacity: 0,
  },
  beginSessionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  beginSessionIcon: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  beginSessionTextContainer: {
    flex: 1,
  },
  beginSessionTitle: {
    color: colors.background,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  beginSessionSubtitle: {
    color: "rgba(13, 13, 16, 0.7)",
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  beginSessionArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  beginSessionArrowText: {
    color: colors.accent,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
});
