import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";

type SavedRecording = {
  id: string;
  uri: string;
  createdAt: string;
  durationMs: number;
};

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;

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

export default function GutSoundRecordingScreen() {
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState<
    "undetermined" | "granted" | "denied"
  >("undetermined");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

        // Parse date from filename (format: 2025-12-08T07-11-36-123Z)
        let dateStr: string;
        try {
          // Convert filename back to ISO format
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
              dateStr = new Date(`${datePart}T${hours}:${minutes}:${seconds}.${ms}Z`).toISOString();
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
      setIsRecording(true);
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

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const finalDuration = recordingDuration;

      setIsRecording(false);
      setRecording(null);
      setRecordingDuration(0);

      if (uri) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const targetUri = `${RECORDINGS_DIR}gut-${timestamp}.m4a`;

        await FileSystem.moveAsync({
          from: uri,
          to: targetUri,
        });

        const newItem: SavedRecording = {
          id: timestamp,
          uri: targetUri,
          createdAt: new Date().toISOString(),
          durationMs: finalDuration,
        };

        setSavedRecordings((prev) => [newItem, ...prev]);
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Gut Sound Recording</Text>
      <Text style={styles.subtitle}>
        Find a quiet spot, relax your belly, and tap the button to capture
        gurgles.
      </Text>

      <View style={styles.recordSection}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={handleToggleRecording}
          activeOpacity={0.8}
        >
          <Text style={styles.recordButtonIcon}>
            {isRecording ? "⏹" : "●"}
          </Text>
          <Text style={styles.recordButtonText}>
            {isRecording ? "Stop Recording" : "Start Recording"}
          </Text>
        </TouchableOpacity>

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTime}>
              {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}
      </View>

      {permissionStatus === "denied" && (
        <Text style={styles.warning}>
          Microphone permission denied. Please enable it in system settings.
        </Text>
      )}

      <Text style={styles.sectionTitle}>
        Your Recordings ({savedRecordings.length})
      </Text>

      {savedRecordings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎙</Text>
          <Text style={styles.emptyText}>No recordings yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the button above to capture your first gut sounds
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedRecordings}
          keyExtractor={(item) => item.id}
          renderItem={renderRecordingItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
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
  recordSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  recordButtonActive: {
    backgroundColor: colors.error,
  },
  recordButtonIcon: {
    color: colors.background,
    fontSize: typography.sizes.lg,
  },
  recordButtonText: {
    color: colors.background,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.base,
    gap: spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  recordingTime: {
    color: colors.error,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    fontVariant: ["tabular-nums"],
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
    paddingVertical: spacing["4xl"],
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
  listContent: {
    paddingBottom: spacing["2xl"],
  },
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
