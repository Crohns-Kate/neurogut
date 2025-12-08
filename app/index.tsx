import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Neurogut</Text>
      <Text style={styles.subtitle}>
        Map gut sounds, symptoms, and mind–body patterns.
      </Text>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.push("/record")}
      >
        <Text style={styles.buttonText}>Gut Sound Recording</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.push("/symptoms")}
      >
        <Text style={styles.buttonText}>Symptom Tracking</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.push("/analysis")}
      >
        <Text style={styles.buttonText}>AI Gut Insights</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#02010a",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 24,
  },
  button: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f9fafb",
  },
});
