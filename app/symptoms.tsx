import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SymptomEntry = {
  id: string;
  energy: number;
  pain: number;
  bloating: number;
  mood: number;
  createdAt: string;
};

const STORAGE_KEY = "symptomEntries";

export default function SymptomTrackingScreen() {
  const router = useRouter();
  const [energy, setEnergy] = useState("5");
  const [pain, setPain] = useState("5");
  const [bloating, setBloating] = useState("5");
  const [mood, setMood] = useState("5");
  const [todayEntries, setTodayEntries] = useState<SymptomEntry[]>([]);

  useEffect(() => {
    loadTodayEntries();
  }, []);

  const loadTodayEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const allEntries: SymptomEntry[] = JSON.parse(data);
        const today = new Date().toDateString();
        const filtered = allEntries.filter(
          (entry) => new Date(entry.createdAt).toDateString() === today
        );
        setTodayEntries(filtered);
      }
    } catch (err) {
      console.error("Error loading entries:", err);
    }
  };

  const saveEntry = async () => {
    try {
      const entry: SymptomEntry = {
        id: Date.now().toString(),
        energy: parseInt(energy) || 5,
        pain: parseInt(pain) || 5,
        bloating: parseInt(bloating) || 5,
        mood: parseInt(mood) || 5,
        createdAt: new Date().toISOString(),
      };

      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const allEntries: SymptomEntry[] = data ? JSON.parse(data) : [];
      allEntries.push(entry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));

      // Reset inputs
      setEnergy("5");
      setPain("5");
      setBloating("5");
      setMood("5");

      // Reload today's entries
      await loadTodayEntries();
    } catch (err) {
      console.error("Error saving entry:", err);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Symptom Tracking</Text>
      <Text style={styles.subtitle}>Rate how you're feeling right now (0-10)</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Energy</Text>
        <TextInput
          style={styles.input}
          value={energy}
          onChangeText={setEnergy}
          keyboardType="numeric"
          placeholder="0-10"
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Pain</Text>
        <TextInput
          style={styles.input}
          value={pain}
          onChangeText={setPain}
          keyboardType="numeric"
          placeholder="0-10"
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bloating</Text>
        <TextInput
          style={styles.input}
          value={bloating}
          onChangeText={setBloating}
          keyboardType="numeric"
          placeholder="0-10"
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mood</Text>
        <TextInput
          style={styles.input}
          value={mood}
          onChangeText={setMood}
          keyboardType="numeric"
          placeholder="0-10"
          placeholderTextColor="#6B7280"
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
        <Text style={styles.saveButtonText}>Save Entry</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Today's Entries</Text>
      {todayEntries.length === 0 ? (
        <Text style={styles.emptyText}>No entries yet today.</Text>
      ) : (
        todayEntries.map((entry) => (
          <View key={entry.id} style={styles.entryItem}>
            <Text style={styles.entryTime}>{formatTime(entry.createdAt)}</Text>
            <View style={styles.entryRow}>
              <Text style={styles.entryLabel}>Energy:</Text>
              <Text style={styles.entryValue}>{entry.energy}</Text>
            </View>
            <View style={styles.entryRow}>
              <Text style={styles.entryLabel}>Pain:</Text>
              <Text style={styles.entryValue}>{entry.pain}</Text>
            </View>
            <View style={styles.entryRow}>
              <Text style={styles.entryLabel}>Bloating:</Text>
              <Text style={styles.entryValue}>{entry.bloating}</Text>
            </View>
            <View style={styles.entryRow}>
              <Text style={styles.entryLabel}>Mood:</Text>
              <Text style={styles.entryValue}>{entry.mood}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 8,
    padding: 12,
    color: "white",
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#1D4ED8",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 32,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
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
  entryItem: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  entryTime: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 8,
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  entryLabel: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  entryValue: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

