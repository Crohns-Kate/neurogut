import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  colors,
  typography,
  spacing,
  radius,
  safeArea,
  textStyles,
} from "../styles/theme";
import {
  getAveragesByDate,
  DailyAverages,
  getSessionsByDateWithState,
} from "../src/storage/sessionStore";
import { getActivePatient } from "../src/storage/patientStore";
import TrendsChart from "../components/TrendsChart";
import SymptomTagChip from "../components/SymptomTagChip";
import { SymptomTag, SYMPTOM_TAG_OPTIONS, StateOfMind } from "../src/models/session";
import {
  generateInsight,
  generateMindBodyInsight,
  generateInterventionInsight,
  getInterventionRankings,
  Insight,
  InterventionEffectiveness,
} from "../src/logic/insightEngine";

type DateRange = "7D" | "30D" | "90D" | "ALL";

// At a Glance summary card component
function SummaryCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueRow}>
        <Text style={styles.summaryValue}>{value}</Text>
        {unit && <Text style={styles.summaryUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

// Date range chip component
function DateRangeChip({
  label,
  selected,
  onPress,
}: {
  label: DateRange;
  selected: boolean;
  onPress: (range: DateRange) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.dateRangeChip,
        selected ? styles.dateRangeChipSelected : styles.dateRangeChipUnselected,
      ]}
      onPress={() => onPress(label)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.dateRangeChipText,
          selected
            ? styles.dateRangeChipTextSelected
            : styles.dateRangeChipTextUnselected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TrendsDashboardScreen() {
  const router = useRouter();
  const [dailyAverages, setDailyAverages] = useState<DailyAverages[]>([]);
  const [globalAverages, setGlobalAverages] = useState<DailyAverages[]>([]);
  const [stateData, setStateData] = useState<Map<string, StateOfMind[]>>(new Map());
  const [interventionEffectiveness, setInterventionEffectiveness] = useState<InterventionEffectiveness[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30D");
  const [selectedTags, setSelectedTags] = useState<SymptomTag[]>([]);

  const loadTrendsData = useCallback(async () => {
    try {
      const activePatient = await getActivePatient();
      const patientId = activePatient?.id;

      // SECURITY: Only load data if patient is selected
      if (!patientId) {
        setDailyAverages([]);
        setGlobalAverages([]);
        setStateData(new Map());
        setLoading(false);
        return;
      }

      // Load filtered data (current selection, scoped to active patient)
      const averages = await getAveragesByDate(
        patientId,
        selectedTags.length > 0 ? selectedTags : undefined
      );
      setDailyAverages(averages);

      // Load global data (all time, no tag filters, same patient) for comparison
      const global = await getAveragesByDate(patientId);
      setGlobalAverages(global);

      // Load state of mind data for chart overlay (scoped to active patient)
      const stateMap = await getSessionsByDateWithState(patientId);
      // Convert to Map<string, StateOfMind[]> format for chart
      const stateDataMap = new Map<string, StateOfMind[]>();
      stateMap.forEach((sessions, date) => {
        stateDataMap.set(date, sessions.map((s) => s.stateOfMind as StateOfMind));
      });
      setStateData(stateDataMap);
    } catch (error) {
      console.error("Error loading trends data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTags]);

  useFocusEffect(
    useCallback(() => {
      loadTrendsData();
    }, [loadTrendsData])
  );

  // Filter data by selected date range
  const filteredData = useMemo(() => {
    if (dateRange === "ALL") {
      return dailyAverages;
    }

    const days = dateRange === "7D" ? 7 : dateRange === "30D" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return dailyAverages.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= cutoffDate;
    });
  }, [dailyAverages, dateRange]);

  // Calculate summary stats for last 7 days
  const summaryStats = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const last7Days = dailyAverages.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= sevenDaysAgo;
    });

    if (last7Days.length === 0) {
      return {
        avgMotility: null,
        totalSessions: 0,
      };
    }

    const totalSessions = last7Days.reduce(
      (sum, item) => sum + item.sessionCount,
      0
    );

    const avgMotility =
      last7Days.reduce(
        (sum, item) => sum + item.avgMotilityIndex * item.sessionCount,
        0
      ) / totalSessions;

    return {
      avgMotility: Math.round(avgMotility * 10) / 10,
      totalSessions,
    };
  }, [dailyAverages]);

  // Generate insight comparing current selection against global average
  const insight = useMemo(() => {
    return generateInsight(filteredData, globalAverages, selectedTags);
  }, [filteredData, globalAverages, selectedTags]);

  // Generate mind-body correlation insight
  const [mindBodyInsight, setMindBodyInsight] = useState<Insight | null>(null);

  const loadMindBodyInsight = useCallback(async () => {
    try {
      const activePatient = await getActivePatient();
      const patientId = activePatient?.id;
      // SECURITY: Skip if no patient selected
      if (!patientId) {
        setMindBodyInsight(null);
        return;
      }
      const insight = await generateMindBodyInsight(patientId);
      setMindBodyInsight(insight);
    } catch (error) {
      console.error("Error loading mind-body insight:", error);
      setMindBodyInsight(null);
    }
  }, []);

  const loadInterventionData = useCallback(async () => {
    try {
      const activePatient = await getActivePatient();
      const patientId = activePatient?.id;
      // SECURITY: Skip if no patient selected
      if (!patientId) {
        setInterventionEffectiveness([]);
        return;
      }
      const rankings = await getInterventionRankings(patientId);
      setInterventionEffectiveness(rankings);
    } catch (error) {
      console.error("Error loading intervention data:", error);
      setInterventionEffectiveness([]);
    }
  }, []);

  const [interventionInsight, setInterventionInsight] = useState<Insight | null>(null);

  const loadInterventionInsight = useCallback(async () => {
    try {
      const activePatient = await getActivePatient();
      const patientId = activePatient?.id;
      // SECURITY: Skip if no patient selected
      if (!patientId) {
        setInterventionInsight(null);
        return;
      }
      const insight = await generateInterventionInsight(patientId);
      setInterventionInsight(insight);
    } catch (error) {
      console.error("Error loading intervention insight:", error);
      setInterventionInsight(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMindBodyInsight();
      loadInterventionData();
      loadInterventionInsight();
    }, [loadMindBodyInsight, loadInterventionData, loadInterventionInsight])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading trends...</Text>
        </View>
      </View>
    );
  }

  const hasData = dailyAverages.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={textStyles.heading1}>Trends</Text>
      </View>

      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Trends Data</Text>
          <Text style={styles.emptyText}>
            {selectedTags.length > 0
              ? "No sessions match these filters. Try selecting fewer symptoms."
              : "Record sessions to see your motility patterns over time"}
          </Text>
        </View>
      ) : (
        <>
          {/* At a Glance Summary */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>At a Glance</Text>
            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Avg Motility Index"
                value={summaryStats.avgMotility ?? "-"}
                unit={summaryStats.avgMotility !== null ? "" : ""}
              />
              <SummaryCard
                label="Total Sessions"
                value={summaryStats.totalSessions}
                unit="last 7 days"
              />
            </View>
          </View>

          {/* Intervention Leaderboard Card */}
          {interventionInsight && (
            <View
              style={[
                styles.insightCard,
                interventionInsight.type === "success"
                  ? styles.insightCardSuccess
                  : interventionInsight.type === "info"
                    ? styles.insightCardInfo
                    : styles.insightCardWarning,
              ]}
            >
              <View style={styles.insightHeader}>
                <Text
                  style={[
                    styles.insightIcon,
                    interventionInsight.type === "success"
                      ? styles.insightIconSuccess
                      : interventionInsight.type === "info"
                        ? styles.insightIconInfo
                        : styles.insightIconWarning,
                  ]}
                >
                  🏆
                </Text>
                <Text
                  style={[
                    styles.insightTitle,
                    interventionInsight.type === "success"
                      ? styles.insightTitleSuccess
                      : interventionInsight.type === "info"
                        ? styles.insightTitleInfo
                        : styles.insightTitleWarning,
                  ]}
                >
                  Intervention Leaderboard
                </Text>
              </View>
              <Text
                style={[
                  styles.insightMessage,
                  interventionInsight.type === "success"
                    ? styles.insightMessageSuccess
                    : interventionInsight.type === "info"
                      ? styles.insightMessageInfo
                      : styles.insightMessageWarning,
                ]}
              >
                {interventionInsight.message}
              </Text>
            </View>
          )}

          {/* Mind-Body Insight Card */}
          {mindBodyInsight && (
            <View
              style={[
                styles.insightCard,
                mindBodyInsight.type === "success"
                  ? styles.insightCardSuccess
                  : mindBodyInsight.type === "info"
                    ? styles.insightCardInfo
                    : styles.insightCardWarning,
              ]}
            >
              <View style={styles.insightHeader}>
                <Text
                  style={[
                    styles.insightIcon,
                    mindBodyInsight.type === "success"
                      ? styles.insightIconSuccess
                      : mindBodyInsight.type === "info"
                        ? styles.insightIconInfo
                        : styles.insightIconWarning,
                  ]}
                >
                  {mindBodyInsight.type === "success" ? "🧠" : "ℹ"}
                </Text>
                <Text
                  style={[
                    styles.insightTitle,
                    mindBodyInsight.type === "success"
                      ? styles.insightTitleSuccess
                      : mindBodyInsight.type === "info"
                        ? styles.insightTitleInfo
                        : styles.insightTitleWarning,
                  ]}
                >
                  Mind-Body Connection
                </Text>
              </View>
              <Text
                style={[
                  styles.insightMessage,
                  mindBodyInsight.type === "success"
                    ? styles.insightMessageSuccess
                    : mindBodyInsight.type === "info"
                      ? styles.insightMessageInfo
                      : styles.insightMessageWarning,
                ]}
              >
                {mindBodyInsight.message}
              </Text>
            </View>
          )}

          {/* Insights Card */}
          {insight && (
            <View
              style={[
                styles.insightCard,
                insight.type === "success"
                  ? styles.insightCardSuccess
                  : insight.type === "info"
                    ? styles.insightCardInfo
                    : styles.insightCardWarning,
              ]}
            >
              <View style={styles.insightHeader}>
                <Text
                  style={[
                    styles.insightIcon,
                    insight.type === "success"
                      ? styles.insightIconSuccess
                      : insight.type === "info"
                        ? styles.insightIconInfo
                        : styles.insightIconWarning,
                  ]}
                >
                  {insight.type === "success" ? "✓" : "ℹ"}
                </Text>
                <Text
                  style={[
                    styles.insightTitle,
                    insight.type === "success"
                      ? styles.insightTitleSuccess
                      : insight.type === "info"
                        ? styles.insightTitleInfo
                        : styles.insightTitleWarning,
                  ]}
                >
                  Insight
                </Text>
              </View>
              <Text
                style={[
                  styles.insightMessage,
                  insight.type === "success"
                    ? styles.insightMessageSuccess
                    : insight.type === "info"
                      ? styles.insightMessageInfo
                      : styles.insightMessageWarning,
                ]}
              >
                {insight.message}
              </Text>
            </View>
          )}

          {/* Date Range Selector */}
          <View style={styles.dateRangeSection}>
            <Text style={styles.sectionTitle}>Time Period</Text>
            <View style={styles.dateRangeContainer}>
              <DateRangeChip
                label="7D"
                selected={dateRange === "7D"}
                onPress={setDateRange}
              />
              <DateRangeChip
                label="30D"
                selected={dateRange === "30D"}
                onPress={setDateRange}
              />
              <DateRangeChip
                label="90D"
                selected={dateRange === "90D"}
                onPress={setDateRange}
              />
              <DateRangeChip
                label="ALL"
                selected={dateRange === "ALL"}
                onPress={setDateRange}
              />
            </View>
          </View>

          {/* Filter by Symptom */}
          <View style={styles.symptomFilterSection}>
            <View style={styles.symptomFilterHeader}>
              <Text style={styles.sectionTitle}>Filter by Symptom</Text>
              {selectedTags.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSelectedTags([])}
                  style={styles.clearAllButton}
                >
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.symptomFilterContainer}
            >
              {SYMPTOM_TAG_OPTIONS.map((option) => (
                <SymptomTagChip
                  key={option.value}
                  tag={option.value}
                  selected={selectedTags.includes(option.value)}
                  onPress={(tag) => {
                    setSelectedTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                />
              ))}
            </ScrollView>
          </View>

          {/* Motility Index Chart */}
          <View style={styles.chartSection}>
            <TrendsChart
              data={filteredData}
              chartType="motility"
              height={220}
              stateData={stateData}
            />
          </View>

          {/* Events Per Minute Chart */}
          <View style={styles.chartSection}>
            <TrendsChart
              data={filteredData}
              chartType="events"
              height={220}
              stateData={stateData}
            />
          </View>

          {/* Footer Note */}
          <View style={styles.footerNote}>
            <Text style={styles.footerText}>
              Track consistently to see meaningful patterns over time
            </Text>
          </View>
        </>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: safeArea.horizontal,
    paddingTop: Platform.OS === "ios" ? safeArea.top + spacing.lg : safeArea.top,
    paddingBottom: spacing["2xl"],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  loadingText: {
    ...textStyles.bodySecondary,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.base,
  },
  backText: {
    ...textStyles.bodySecondary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["5xl"],
  },
  emptyIcon: {
    fontSize: typography.sizes["4xl"],
    marginBottom: spacing.base,
  },
  emptyTitle: {
    ...textStyles.heading3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...textStyles.bodySecondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  summarySection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...textStyles.heading3,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    ...textStyles.caption,
    marginBottom: spacing.xs,
  },
  summaryValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  summaryValue: {
    ...textStyles.heading2,
    color: colors.accent,
  },
  summaryUnit: {
    ...textStyles.caption,
    marginLeft: spacing.xs,
  },
  insightCard: {
    marginBottom: spacing.xl,
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  insightCardSuccess: {
    backgroundColor: colors.success + "15", // 15% opacity
    borderColor: colors.success,
  },
  insightCardInfo: {
    backgroundColor: colors.info + "15", // 15% opacity
    borderColor: colors.info,
  },
  insightCardWarning: {
    backgroundColor: colors.warning + "15", // 15% opacity
    borderColor: colors.warning,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  insightIcon: {
    fontSize: typography.sizes.lg,
    marginRight: spacing.sm,
  },
  insightIconSuccess: {
    color: colors.success,
  },
  insightIconInfo: {
    color: colors.info,
  },
  insightIconWarning: {
    color: colors.warning,
  },
  insightTitle: {
    ...textStyles.heading3,
  },
  insightTitleSuccess: {
    color: colors.success,
  },
  insightTitleInfo: {
    color: colors.info,
  },
  insightTitleWarning: {
    color: colors.warning,
  },
  insightMessage: {
    ...textStyles.body,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
  insightMessageSuccess: {
    color: colors.textPrimary,
  },
  insightMessageInfo: {
    color: colors.textPrimary,
  },
  insightMessageWarning: {
    color: colors.textPrimary,
  },
  dateRangeSection: {
    marginBottom: spacing.xl,
  },
  dateRangeContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  symptomFilterSection: {
    marginBottom: spacing.xl,
  },
  symptomFilterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  clearAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearAllText: {
    ...textStyles.caption,
    color: colors.accent,
  },
  symptomFilterContainer: {
    flexDirection: "row",
    paddingRight: spacing.base,
  },
  dateRangeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dateRangeChipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  dateRangeChipUnselected: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
  },
  dateRangeChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  dateRangeChipTextSelected: {
    color: colors.accent,
  },
  dateRangeChipTextUnselected: {
    color: colors.textSecondary,
  },
  chartSection: {
    marginBottom: spacing.xl,
  },
  chartTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.base,
  },
  interventionChart: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  interventionBarContainer: {
    marginBottom: spacing.md,
  },
  interventionBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  interventionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  interventionValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  interventionBarBackground: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  interventionBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  interventionMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  footerNote: {
    backgroundColor: colors.backgroundElevated,
    padding: spacing.base,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  footerText: {
    ...textStyles.caption,
    textAlign: "center",
  },
  bottomSpacer: {
    height: spacing["3xl"],
  },
});
