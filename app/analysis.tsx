import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function AIGutInsightsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>AI Gut Insights</Text>
      <Text style={styles.subtitle}>
        This screen will analyze your gut sounds and symptom patterns to provide
        insights and early pattern detection.
      </Text>

      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>
          AI analysis features coming soon. This will integrate with your recorded
          gut sounds and symptom entries to identify patterns and provide
          personalized insights.
        </Text>
      </View>
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
    lineHeight: 20,
  },
  placeholderBox: {
    backgroundColor: "#111827",
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  placeholderText: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
  },
});

