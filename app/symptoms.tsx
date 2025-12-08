import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SymptomEntry = {
  id: string;
  dateISO: string;
  energy: number;
  pain: number;
  bloating: number;
  mood: number;
  notes: string;
};

// Support old entries that used createdAt instead of dateISO
type LegacyEntry = {
  id: string;
  createdAt?: string;
  dateISO?: string;
  energy: number;
  pain: number;
  bloating: number;
  mood: number;
  notes?: string;
};

function normalizeEntry(entry: LegacyEntry): SymptomEntry {
  return {
    id: entry.id,
    dateISO: entry.dateISO || entry.createdAt || new Date().toISOString(),
    energy: entry.energy,
    pain: entry.pain,
    bloating: entry.bloating,
    mood: entry.mood,
    notes: entry.notes || "",
  };
}

const STORAGE_KEY = "symptomEntries";
const DEFAULT_VALUE = 5;

// Segmented button row for 0-10 rating
function RatingSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <View style={styles.ratingGroup}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.ratingButton,
              value === num && styles.ratingButtonActive,
            ]}
            onPress={() => onChange(num)}
          >
            <Text
              style={[
                styles.ratingButtonText,
                value === num && styles.ratingButtonTextActive,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SymptomTrackingScreen() {
  const router = useRouter();
  const [energy, setEnergy] = useState(DEFAULT_VALUE);
  const [pain, setPain] = useState(DEFAULT_VALUE);
  const [bloating, setBloating] = useState(DEFAULT_VALUE);
  const [mood, setMood] = useState(DEFAULT_VALUE);
  const [notes, setNotes] = useState("");
  const [recentEntries, setRecentEntries] = useState<SymptomEntry[]>([]);

  const loadRecentEntries = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const rawEntries: LegacyEntry[] = JSON.parse(data);
        // Normalize entries (support old createdAt field) and sort
        const normalized = rawEntries.map(normalizeEntry);
        const sorted = normalized
          .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
          .slice(0, 7);
        setRecentEntries(sorted);
      }
    } catch (err) {
      console.error("Error loading entries:", err);
    }
  }, []);

  useEffect(() => {
    loadRecentEntries();
  }, [loadRecentEntries]);

  const clearForm = () => {
    setEnergy(DEFAULT_VALUE);
    setPain(DEFAULT_VALUE);
    setBloating(DEFAULT_VALUE);
    setMood(DEFAULT_VALUE);
    setNotes("");
  };

  const saveEntry = async () => {
    try {
      const entry: SymptomEntry = {
        id: Date.now().toString(),
        dateISO: new Date().toISOString(),
        energy,
        pain,
        bloating,
        mood,
        notes: notes.trim(),
      };

      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const allEntries: SymptomEntry[] = data ? JSON.parse(data) : [];
      allEntries.push(entry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));

      clearForm();
      await loadRecentEntries();
    } catch (err) {
      console.error("Error saving entry:", err);
    }
  };

  const formatFriendlyDate = (isoString: string) => {
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
    if (diffDays < 7)
      return `${date.toLocaleDateString([], { weekday: "long" })} at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Daily Symptom Check-in</Text>
      <Text style={styles.subtitle}>
        Quick log of today's gut symptoms in under 30 seconds.
      </Text>

      <RatingSelector label="Energy" value={energy} onChange={setEnergy} />
      <RatingSelector label="Pain" value={pain} onChange={setPain} />
      <RatingSelector label="Bloating" value={bloating} onChange={setBloating} />
      <RatingSelector label="Mood" value={mood} onChange={setMood} />

      <View style={styles.notesGroup}>
        <Text style={styles.notesLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional notes..."
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.clearButton} onPress={clearForm}>
          <Text style={styles.clearButtonText}>Clear form</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
          <Text style={styles.saveButtonText}>Save today</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Entries</Text>
      {recentEntries.length === 0 ? (
        <Text style={styles.emptyText}>No entries yet. Start tracking!</Text>
      ) : (
        recentEntries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <Text style={styles.entryDate}>
              {formatFriendlyDate(entry.dateISO)}
            </Text>
            <View style={styles.entrySummary}>
              <View style={styles.entryMetric}>
                <Text style={styles.metricLabel}>Energy</Text>
                <Text style={styles.metricValue}>{entry.energy}</Text>
              </View>
              <View style={styles.entryMetric}>
                <Text style={styles.metricLabel}>Pain</Text>
                <Text style={styles.metricValue}>{entry.pain}</Text>
              </View>
              <View style={styles.entryMetric}>
                <Text style={styles.metricLabel}>Bloating</Text>
                <Text style={styles.metricValue}>{entry.bloating}</Text>
              </View>
              <View style={styles.entryMetric}>
                <Text style={styles.metricLabel}>Mood</Text>
                <Text style={styles.metricValue}>{entry.mood}</Text>
              </View>
            </View>
            {entry.notes ? (
              <Text style={styles.entryNotes} numberOfLines={2}>
                {entry.notes}
              </Text>
            ) : null}
          </View>
        ))
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05060A",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backText: {
    color: "#9CA3AF",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 28,
    lineHeight: 20,
  },
  // Rating selector styles
  ratingGroup: {
    marginBottom: 20,
  },
  ratingLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratingButton: {
    width: 28,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingButtonActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  ratingButtonText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
  ratingButtonTextActive: {
    color: "white",
    fontWeight: "700",
  },
  // Notes input styles
  notesGroup: {
    marginBottom: 24,
  },
  notesLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 8,
    padding: 12,
    color: "white",
    fontSize: 15,
    minHeight: 80,
  },
  // Button styles
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 36,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
  },
  clearButtonText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  // History section styles
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyText: {
    color: "#6B7280",
    marginBottom: 32,
  },
  entryCard: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  entryDate: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 10,
  },
  entrySummary: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryMetric: {
    alignItems: "center",
  },
  metricLabel: {
    color: "#6B7280",
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  entryNotes: {
    color: "#9CA3AF",
    fontSize: 13,
    marginTop: 10,
    fontStyle: "italic",
  },
  bottomSpacer: {
    height: 40,
  },
});
