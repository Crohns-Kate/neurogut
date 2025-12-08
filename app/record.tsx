import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

type SavedRecording = {
  id: string;
  uri: string;
  createdAt: string;
};

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;

export default function GutSoundRecordingScreen() {
  const router = useRouter();
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "granted" | "denied">(
    "undetermined"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);

  // Ensure recordings directory exists and load past recordings
  useEffect(() => {
    const ensureDirAndLoad = async () => {
      const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
      } else {
        // Load existing recordings
        try {
          const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
          const recordings: SavedRecording[] = files
            .filter((file) => file.endsWith(".m4a"))
            .map((file) => {
              const fileInfo = file.replace("gut-", "").replace(".m4a", "");
              const dateStr = fileInfo.replace(/-/g, ":").replace("T", " ");
              return {
                id: fileInfo,
                uri: `${RECORDINGS_DIR}${file}`,
                createdAt: new Date(dateStr).toLocaleString() || file,
              };
            })
            .sort((a, b) => b.id.localeCompare(a.id)); // Most recent first
          setSavedRecordings(recordings);
        } catch (err) {
          console.error("Error loading recordings:", err);
        }
      }
    };
    ensureDirAndLoad();
  }, []);

  const requestPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setPermissionStatus(status === "granted" ? "granted" : "denied");
    return status === "granted";
  };

  const startRecording = async () => {
    try {
      // Permissions
      if (permissionStatus !== "granted") {
        const ok = await requestPermission();
        if (!ok) return;
      }

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
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);

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
          createdAt: new Date().toLocaleString(),
        };

        setSavedRecordings((prev) => [newItem, ...prev]);
        console.log("Saved recording to:", targetUri);
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

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Gut Sound Recording</Text>
      <Text style={styles.subtitle}>
        Find a quiet spot, relax your belly, and tap the button to capture gurgles.
      </Text>

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={handleToggleRecording}
      >
        <Text style={styles.recordButtonText}>
          {isRecording ? "Stop Recording" : "Start Recording"}
        </Text>
      </TouchableOpacity>

      {permissionStatus === "denied" && (
        <Text style={styles.warning}>
          Microphone permission denied. Please enable it in system settings.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Recent recordings</Text>
      {savedRecordings.length === 0 ? (
        <Text style={styles.emptyText}>No recordings yet.</Text>
      ) : (
        <FlatList
          data={savedRecordings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.recordItem}>
              <Text style={styles.recordName}>{item.createdAt}</Text>
              <Text style={styles.recordUri} numberOfLines={1}>
                {item.uri}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05060A",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backText: {
    color: "#9CA3AF",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 32,
  },
  recordButton: {
    backgroundColor: "#1D4ED8",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 24,
  },
  recordButtonActive: {
    backgroundColor: "#DC2626",
  },
  recordButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  warning: {
    color: "#F97316",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    color: "#6B7280",
  },
  recordItem: {
    paddingVertical: 8,
    borderBottomColor: "#1F2937",
    borderBottomWidth: 1,
  },
  recordName: {
    color: "white",
  },
  recordUri: {
    color: "#6B7280",
    fontSize: 10,
  },
});
