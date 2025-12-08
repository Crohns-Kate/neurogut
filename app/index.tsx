import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { colors, typography, spacing, radius, safeArea } from "../styles/theme";
import PrimaryButton from "../components/PrimaryButton";

const RECORDINGS_DIR = `${FileSystem.documentDirectory || ""}recordings/`;
const SYMPTOM_STORAGE_KEY = "symptomEntries";

// Feature card data type
type FeatureCard = {
  id: string;
  icon: string;
  title: string;
  description: string;
  route: "/record" | "/symptoms" | "/analysis";
  getStatus: () => string;
  accentColor?: string;
};

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

  const features: FeatureCard[] = [
    {
      id: "recording",
      icon: "🎙",
      title: "Gut Sound Recording",
      description: "Capture and analyze your gut sounds",
      route: "/record",
      getStatus: getRecordingStatus,
    },
    {
      id: "symptoms",
      icon: "📊",
      title: "Symptom Tracking",
      description: "Daily check-in for energy, pain, bloating, mood",
      route: "/symptoms",
      getStatus: getSymptomStatus,
    },
    {
      id: "insights",
      icon: "🧠",
      title: "AI Gut Insights",
      description: "Pattern analysis and recommendations",
      route: "/analysis",
      getStatus: () => "Coming soon",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandIcon}>🌿</Text>
          <Text style={styles.brandName}>Neurogut</Text>
        </View>
        <Text style={styles.tagline}>Your gut-brain wellness companion</Text>
      </View>

      {/* Feature Cards */}
      <View style={styles.featuresSection}>
        {features.map((feature, index) => (
          <View
            key={feature.id}
            style={[
              styles.featureCard,
              index === features.length - 1 && styles.featureCardLast,
            ]}
          >
            <View style={styles.featureHeader}>
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </View>

            <View style={styles.featureFooter}>
              <View style={styles.statusContainer}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{feature.getStatus()}</Text>
              </View>
              <PrimaryButton
                title="Open"
                onPress={() => router.push(feature.route)}
                size="sm"
                fullWidth={false}
                style={styles.featureButton}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>Track daily for better insights</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: safeArea.horizontal,
  },

  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
    paddingBottom: spacing["2xl"],
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  brandIcon: {
    fontSize: typography.sizes["2xl"],
    marginRight: spacing.sm,
  },
  brandName: {
    fontSize: typography.sizes["3xl"],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: typography.letterSpacing.tight,
  },
  tagline: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginLeft: spacing["3xl"] + spacing.sm, // Align with brand name
  },

  // Features Section
  featuresSection: {
    flex: 1,
  },
  featureCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureCardLast: {
    marginBottom: 0,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.base,
  },
  featureIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.base,
  },
  featureIcon: {
    fontSize: typography.sizes.xl,
  },
  featureInfo: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  featureTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.sizes.sm * typography.lineHeights.relaxed,
  },
  featureFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    color: colors.accent,
    fontWeight: typography.weights.medium,
  },
  featureButton: {
    paddingHorizontal: spacing.lg,
    minWidth: 80,
  },

  // Footer
  footer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  footerDivider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.base,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
