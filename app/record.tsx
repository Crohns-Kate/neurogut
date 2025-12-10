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
} from "react-native";
import { useRouter } from "expo-router";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import {
  RecordingProtocolType,
  PROTOCOL_CONFIG,
  MealTiming,
  MEAL_TIMING_OPTIONS,
  PostureType,
  POSTURE_OPTIONS,
  SessionContext,
  DEFAULT_SESSION_CONTEXT,
  createSession,
} from "../src/models/session";
import { addSession } from "../src/storage/sessionStore";

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

export default function GutSoundRecordingScreen() {
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState<
    "undetermined" | "granted" | "denied"
  >("undetermined");

  // Recording phase state
  const [phase, setPhase] = useState<RecordingPhase>("setup");

  // Protocol and context state
  const [selectedProtocol, setSelectedProtocol] =
    useState<RecordingProtocolType>("quick_check");
  const [context, setContext] = useState<SessionContext>(DEFAULT_SESSION_CONTEXT);

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    loadRecordings();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [loadRecordings]);

  // Auto-stop when duration reached
  useEffect(() => {
    if (phase === "recording" && recordingDuration >= targetDuration) {
      stopRecording();
    }
  }, [recordingDuration, targetDuration, phase]);

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

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1000);
      }, 1000);
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

      setPhase("processing");

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const finalDuration = recordingDuration;

      setRecording(null);
      setRecordingDuration(0);

      if (uri) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const targetUri = `${RECORDINGS_DIR}gut-${timestamp}.m4a`;

        await FileSystem.moveAsync({
          from: uri,
          to: targetUri,
        });

        // Create and save session to the new store
        const session = createSession(
          selectedProtocol,
          targetUri,
          Math.floor(finalDuration / 1000),
          context
        );

        await addSession(session);

        // Also update local list for display
        const newItem: SavedRecording = {
          id: timestamp,
          uri: targetUri,
          createdAt: new Date().toISOString(),
          durationMs: finalDuration,
          protocolType: selectedProtocol,
        };

        setSavedRecordings((prev) => [newItem, ...prev]);
      }

      setPhase("setup");
    } catch (err) {
      console.error("Error stopping recording:", err);
      setPhase("setup");
    }
  };

  const handleStartRecording = () => {
    startRecording();
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

      {phase === "setup" && (
        <ScrollView
          style={styles.setupScrollView}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            Set up your recording session, then relax and capture your gut sounds.
          </Text>

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

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonIcon}>●</Text>
            <Text style={styles.startButtonText}>Start Recording</Text>
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

      {phase === "processing" && (
        <View style={styles.processingPhase}>
          <Text style={styles.processingIcon}>⏳</Text>
          <Text style={styles.processingText}>Saving recording...</Text>
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
    marginBottom: spacing.sm,
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
});
