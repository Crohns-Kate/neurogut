import { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;
const SYMPTOM_STORAGE_KEY = "symptomEntries";

type NavCardProps = {
  icon: string;
  title: string;
  description: string;
  status: string;
  statusMuted?: boolean;
  onPress: () => void;
};

function NavCard({
  icon,
  title,
  description,
  status,
  statusMuted,
  onPress,
}: NavCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardIcon}>
        <Text style={styles.cardIconText}>{icon}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
        <Text style={[styles.cardStatus, statusMuted && styles.cardStatusMuted]}>
          {status}
        </Text>
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [recordingCount, setRecordingCount] = useState<number | null>(null);
  const [lastSymptomDate, setLastSymptomDate] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    // Load recording count
    try {
      const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (info.exists) {
        const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
        const m4aFiles = files.filter((f) => f.endsWith(".m4a"));
        setRecordingCount(m4aFiles.length);
      } else {
        setRecordingCount(0);
      }
    } catch {
      setRecordingCount(0);
    }

    // Load last symptom entry
    try {
      const data = await AsyncStorage.getItem(SYMPTOM_STORAGE_KEY);
      if (data) {
        const entries = JSON.parse(data) as Array<{
          dateISO?: string;
          createdAt?: string;
        }>;
        if (entries.length > 0) {
          // Sort by date descending and get most recent
          const sorted = entries.sort((a, b) => {
            const dateA = a.dateISO || a.createdAt || "";
            const dateB = b.dateISO || b.createdAt || "";
            return dateB.localeCompare(dateA);
          });
          const latest = sorted[0];
          const dateStr = latest.dateISO || latest.createdAt;
          if (dateStr) {
            setLastSymptomDate(formatRelativeDate(dateStr));
          }
        }
      }
    } catch {
      setLastSymptomDate(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const formatRelativeDate = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const diffDays = Math.floor(
      (today.getTime() - entryDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Yesterday at ${timeStr}`;
    if (diffDays < 7) {
      return `${date.toLocaleDateString([], { weekday: "long" })}`;
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getRecordingStatus = (): string => {
    if (recordingCount === null) return "Loading...";
    if (recordingCount === 0) return "No recordings yet";
    if (recordingCount === 1) return "1 recording saved";
    return `${recordingCount} recordings saved`;
  };

  const getSymptomStatus = (): string => {
    if (lastSymptomDate === null) return "No entries yet";
    return `Last: ${lastSymptomDate}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Neurogut</Text>
        <Text style={styles.subtitle}>
          Your gut-brain wellness companion
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        <NavCard
          icon="🎙"
          title="Gut Sound Recording"
          description="Capture and analyze your gut sounds"
          status={getRecordingStatus()}
          onPress={() => router.push("/record")}
        />

        <NavCard
          icon="📊"
          title="Symptom Tracking"
          description="Daily check-in for energy, pain, bloating, mood"
          status={getSymptomStatus()}
          onPress={() => router.push("/symptoms")}
        />

        <NavCard
          icon="🧠"
          title="AI Gut Insights"
          description="Pattern analysis and recommendations"
          status="Coming soon"
          statusMuted
          onPress={() => router.push("/analysis")}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Track daily for better insights
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#02010a",
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 70,
    paddingBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: "#9ca3af",
    lineHeight: 22,
  },
  cardsContainer: {
    flex: 1,
    gap: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardIconText: {
    fontSize: 22,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f9fafb",
    marginBottom: 3,
  },
  cardDescription: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 6,
    lineHeight: 18,
  },
  cardStatus: {
    fontSize: 12,
    color: "#60a5fa",
    fontWeight: "500",
  },
  cardStatusMuted: {
    color: "#6b7280",
  },
  cardChevron: {
    fontSize: 24,
    color: "#4b5563",
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#4b5563",
  },
});
