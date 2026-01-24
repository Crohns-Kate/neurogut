import React, { useMemo } from "react";
import { View, StyleSheet, Text, LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Circle, Text as SvgText } from "react-native-svg";
import { colors, spacing, radius, typography } from "../styles/theme";
import { DailyAverages } from "../src/storage/sessionStore";
import { StateOfMind } from "../src/models/session";

/**
 * TrendsChart Component
 *
 * Displays time-series line charts for motility trends and events per minute
 * over time. Reusable component for trends dashboard.
 *
 * @component
 */

export interface TrendsChartProps {
  // Daily averages data from getAveragesByDate()
  data: DailyAverages[];
  // Chart type: 'motility' for motility index, 'events' for events per minute
  chartType: "motility" | "events";
  // Component height (optional, defaults to 200)
  height?: number;
  // Show data points (optional, defaults to true)
  showPoints?: boolean;
  // State of mind data for mind-body overlay (optional)
  stateData?: Map<string, StateOfMind[]>;
}

// State of Mind color mapping for chart overlay
const STATE_COLORS: Record<StateOfMind, string> = {
  Calm: colors.success,
  Anxious: colors.warning,
  Rushed: colors.error,
  Distracted: colors.info,
};

/**
 * TrendsChart - Time-series line chart component
 *
 * Renders a line chart showing trends over time using react-native-svg.
 * Handles empty data gracefully and uses design system colors.
 */
export default function TrendsChart({
  data,
  chartType,
  height = 200,
  showPoints = true,
  stateData,
}: TrendsChartProps) {
  const [width, setWidth] = React.useState(0);

  // Calculate chart dimensions and data points
  const { path, points, maxValue, minValue, yAxisLabels } = useMemo(() => {
    if (data.length === 0 || width === 0) {
      return {
        path: "",
        points: [],
        maxValue: 100,
        minValue: 0,
        yAxisLabels: [],
      };
    }

    const chartHeight = height - 60; // Reserve space for labels
    const chartWidth = width - 80; // Reserve space for y-axis
    const padding = spacing.base;

    // Extract values based on chart type
    const values = data.map((d) =>
      chartType === "motility" ? d.avgMotilityIndex : d.avgEventsPerMinute
    );

    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const valueRange = maxValue - minValue || 1; // Avoid division by zero

    // Calculate x positions (evenly spaced)
    const xStep = chartWidth / Math.max(1, data.length - 1);
    const points: Array<{ x: number; y: number; value: number }> = [];

    // Generate path and points
    let pathString = "";
    values.forEach((value, index) => {
      const x = padding + index * xStep;
      const normalizedValue = (value - minValue) / valueRange;
      const y = chartHeight - normalizedValue * chartHeight + padding;

      points.push({ x, y, value });

      if (index === 0) {
        pathString = `M ${x} ${y}`;
      } else {
        pathString += ` L ${x} ${y}`;
      }
    });

    // Generate y-axis labels (5 labels)
    const yAxisLabels: Array<{ value: number; y: number }> = [];
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (valueRange * i) / 4;
      const normalizedValue = i / 4;
      const y = chartHeight - normalizedValue * chartHeight + padding;
      yAxisLabels.push({ value, y });
    }

    return { path: pathString, points, maxValue, minValue, yAxisLabels };
  }, [data, chartType, width, height]);

  // Handle layout to get component width
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data available</Text>
          <Text style={styles.emptySubtext}>
            Record sessions to see trends over time
          </Text>
        </View>
      </View>
    );
  }

  const chartColor = chartType === "motility" ? colors.accent : colors.info;
  const chartLabel =
    chartType === "motility" ? "Motility Index" : "Events per Minute";

  return (
    <View style={[styles.container, { height }]} onLayout={handleLayout}>
      <Text style={styles.chartTitle}>{chartLabel}</Text>
      <Svg width={width || 1} height={height - 40} style={styles.svg}>
        {/* Y-axis labels */}
        {yAxisLabels.map((label, index) => (
          <React.Fragment key={`y-label-${index}`}>
            <Line
              x1={spacing.base}
              y1={label.y}
              x2={width - spacing.base}
              y2={label.y}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.3}
            />
            <SvgText
              x={spacing.base + spacing.sm}
              y={label.y + 4}
              fontSize={typography.sizes.xs}
              fill={colors.textMuted}
              textAnchor="start"
            >
              {Math.round(label.value)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Chart line */}
        {path && (
          <Path
            d={path}
            fill="none"
            stroke={chartColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points with mind-body state overlay */}
        {showPoints &&
          points.map((point, index) => {
            const dateKey = data[index]?.date;
            const states = dateKey && stateData ? stateData.get(dateKey) : undefined;
            // Use state color if available, otherwise use chart color
            const pointColor = states && states.length > 0
              ? STATE_COLORS[states[0] as StateOfMind] || chartColor
              : chartColor;
            
            return (
              <Circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r={states && states.length > 0 ? 6 : 4}
                fill={pointColor}
                stroke={colors.background}
                strokeWidth={2}
                opacity={states && states.length > 0 ? 0.9 : 0.7}
              />
            );
          })}

        {/* X-axis date labels (show first, middle, last) */}
        {data.length > 0 && (
          <>
            {[0, Math.floor(data.length / 2), data.length - 1]
              .filter((idx) => idx < data.length)
              .map((idx) => {
                const xStep = (width - 80) / Math.max(1, data.length - 1);
                const x = spacing.base + idx * xStep;
                const date = new Date(data[idx].date);
                const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
                return (
                  <SvgText
                    key={`x-label-${idx}`}
                    x={x}
                    y={height - 50}
                    fontSize={typography.sizes.xs}
                    fill={colors.textMuted}
                    textAnchor="middle"
                  >
                    {dateLabel}
                  </SvgText>
                );
              })}
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    overflow: "hidden",
  },
  svg: {
    flex: 1,
  },
  chartTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
});
