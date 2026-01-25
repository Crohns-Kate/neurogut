import React, { useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  LayoutChangeEvent,
} from "react-native";
import Svg, { Path, Rect, Line, Text as SvgText } from "react-native-svg";
import { colors, spacing, radius, typography } from "../styles/theme";

/**
 * AudioWaveform Component
 *
 * Displays an interactive waveform visualization of audio RMS energy over time
 * with detected gut sound event markers.
 *
 * @component
 */

export interface AudioWaveformProps {
  // RMS energy values per window (100ms windows)
  energyValues: number[];
  // Detected events with time information
  events: Array<{
    startTimeSeconds: number;
    endTimeSeconds: number;
    peakEnergy: number;
  }>;
  // Total duration in seconds
  durationSeconds: number;
  // Window size in milliseconds
  windowSizeMs: number;
  // Component height (optional, defaults to 120)
  height?: number;
  // Callback when user selects a time position
  onTimeSelect?: (timeSeconds: number) => void;
  // Current playback time (for sync with audio playback)
  currentTime?: number;
}

/**
 * AudioWaveform - Interactive waveform visualization component
 *
 * This component renders a waveform showing RMS energy over time with
 * detected event markers. Users can interact by touching/scrubbing the timeline.
 */
export default function AudioWaveform({
  energyValues,
  events,
  durationSeconds,
  windowSizeMs,
  height = 120,
  onTimeSelect,
  currentTime,
}: AudioWaveformProps) {
  const [width, setWidth] = React.useState(0);

  // Calculate normalized energy values and waveform path
  const { normalizedEnergies, maxEnergy, waveformPath } = useMemo(() => {
    if (energyValues.length === 0 || width === 0) {
      return { normalizedEnergies: [], maxEnergy: 1, waveformPath: "" };
    }

    const maxEnergy = Math.max(...energyValues, 0.001); // Avoid division by zero
    const waveformHeight = height - 40; // Reserve space for time axis
    const barWidth = width / energyValues.length;

    // Normalize energy values to waveform height
    const normalizedEnergies = energyValues.map(
      (energy) => (energy / maxEnergy) * waveformHeight
    );

    // Create waveform path (smooth line connecting energy peaks)
    let path = `M 0 ${waveformHeight}`;
    normalizedEnergies.forEach((energy, index) => {
      const x = index * barWidth;
      const y = waveformHeight - energy;
      path += ` L ${x} ${y}`;
    });
    path += ` L ${width} ${waveformHeight} Z`;

    return { normalizedEnergies, maxEnergy, waveformPath: path };
  }, [energyValues, width, height]);

  // Calculate event positions and colors
  const eventRects = useMemo(() => {
    if (width === 0 || durationSeconds === 0) return [];

    return events.map((event) => {
      const startX = (event.startTimeSeconds / durationSeconds) * width;
      const endX = (event.endTimeSeconds / durationSeconds) * width;
      const widthPx = endX - startX;

      // Color based on peak energy (normalized to maxEnergy)
      const energyRatio = event.peakEnergy / maxEnergy;
      let eventColor: string = colors.info; // Quiet
      if (energyRatio > 0.6) {
        eventColor = colors.success; // Active
      } else if (energyRatio > 0.3) {
        eventColor = colors.accent; // Normal
      }

      return {
        x: startX,
        width: widthPx,
        color: eventColor,
        opacity: 0.2,
      };
    });
  }, [events, width, durationSeconds, maxEnergy]);

  // Generate time axis labels
  const timeLabels = useMemo(() => {
    if (width === 0 || durationSeconds === 0) return [];

    const labelCount = Math.min(5, Math.floor(durationSeconds / 10) + 1);
    const labels: Array<{ x: number; label: string }> = [];

    for (let i = 0; i <= labelCount; i++) {
      const timeSeconds = (i / labelCount) * durationSeconds;
      const x = (timeSeconds / durationSeconds) * width;
      const minutes = Math.floor(timeSeconds / 60);
      const seconds = Math.floor(timeSeconds % 60);
      const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      labels.push({ x, label });
    }

    return labels;
  }, [width, durationSeconds]);

  // Handle layout to get component width
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  // Handle touch to scrub timeline
  const handlePress = useCallback(
    (event: any) => {
      if (!onTimeSelect || width === 0) return;
      const { locationX } = event.nativeEvent;
      const timeSeconds = Math.max(
        0,
        Math.min(durationSeconds, (locationX / width) * durationSeconds)
      );
      onTimeSelect(timeSeconds);
    },
    [onTimeSelect, width, durationSeconds]
  );

  // Calculate current time indicator position
  const currentTimeX = useMemo(() => {
    if (currentTime === undefined || width === 0 || durationSeconds === 0)
      return null;
    return (currentTime / durationSeconds) * width;
  }, [currentTime, width, durationSeconds]);

  if (energyValues.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No audio data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]} onLayout={handleLayout}>
      <TouchableOpacity
        style={styles.touchArea}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <Svg width={width || 1} height={height} style={styles.svg}>
          {/* Event markers (background bands) */}
          {eventRects.map((rect, index) => (
            <Rect
              key={`event-${index}`}
              x={rect.x}
              y={0}
              width={rect.width}
              height={height - 30}
              fill={rect.color}
              opacity={rect.opacity}
            />
          ))}

          {/* Waveform path */}
          {waveformPath && (
            <Path
              d={waveformPath}
              fill={colors.accent}
              opacity={0.6}
              stroke={colors.accent}
              strokeWidth={1}
            />
          )}

          {/* Current time indicator */}
          {currentTimeX !== null && (
            <Line
              x1={currentTimeX}
              y1={0}
              x2={currentTimeX}
              y2={height - 30}
              stroke={colors.accent}
              strokeWidth={2}
              strokeDasharray="4,4"
            />
          )}

          {/* Time axis line */}
          <Line
            x1={0}
            y1={height - 30}
            x2={width}
            y2={height - 30}
            stroke={colors.border}
            strokeWidth={1}
          />

          {/* Time labels */}
          {timeLabels.map((label, index) => (
            <React.Fragment key={`label-${index}`}>
              <Line
                x1={label.x}
                y1={height - 30}
                x2={label.x}
                y2={height - 25}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={label.x}
                y={height - 20}
                fontSize={typography.sizes.xs}
                fill={colors.textMuted}
                textAnchor="middle"
                alignmentBaseline="hanging"
              >
                {label.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </TouchableOpacity>
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
  touchArea: {
    flex: 1,
    width: "100%",
  },
  svg: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
});
