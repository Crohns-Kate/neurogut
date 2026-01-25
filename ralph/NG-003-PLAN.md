# NG-003: Audio Visualization - Implementation Plan

## Overview
Add interactive audio waveform visualization to the session detail screen, showing RMS energy over time with detected event markers. This will help users visually understand their gut sound patterns and correlate them with detected events.

## Current State Analysis

### audioAnalytics.ts Module
- **Windowed Energy Computation**: Already calculates RMS energy in 100ms windows via `computeWindowedEnergy()`
- **Event Detection**: Detects events using adaptive thresholding via `detectEvents()`
- **Data Available**: 
  - `activityTimeline`: 10-segment normalized timeline (0-100 scale)
  - `eventsPerMinute`: Aggregated metric
  - Internal `energyValues` array (not exported)
  - Internal `DetectedEvent[]` array (not exported)

### Session Detail Screen (app/session/[id].tsx)
- Currently shows: ActivityTimeline component with 10-segment bar chart
- Uses `session.analytics.activityTimeline` for visualization
- Missing: Detailed waveform, event markers, time scrubbing

## Implementation Strategy

### Phase 1: Export Audio Analysis Data

**File: `src/analytics/audioAnalytics.ts`**

1. **Modify `analyzeAudioSamples()` to return extended data:**
   - Export `energyValues` array (windowed RMS values)
   - Export `events` array with window indices and peak energy
   - Keep backward compatibility with existing `SessionAnalytics` interface

2. **Create new export function:**
   ```typescript
   export interface AudioVisualizationData {
     energyValues: number[];  // RMS energy per 100ms window
     events: Array<{
       startWindow: number;
       endWindow: number;
       peakEnergy: number;
       startTimeSeconds: number;
       endTimeSeconds: number;
     }>;
     windowSizeMs: number;
     sampleRate: number;
   }
   
   export function getVisualizationData(
     samples: number[],
     durationSeconds: number,
     sampleRate?: number
   ): AudioVisualizationData
   ```

3. **Alternative approach (preferred for backward compatibility):**
   - Add optional return value to `analyzeAudioSamples()` or create separate function
   - Store visualization data in session store alongside analytics
   - Use lazy computation: only compute when visualization is viewed

### Phase 2: Install Dependencies

**Package: `react-native-svg`**
- Required for drawing waveform paths
- Compatible with Expo 54
- Install: `npx expo install react-native-svg`
- Add types: `npm install --save-dev @types/react-native-svg`

### Phase 3: Create Waveform Component

**New File: `components/AudioWaveform.tsx`**

**Features:**
1. **Waveform Rendering:**
   - Draw RMS energy values as vertical bars or smooth path
   - Normalize energy values to fit component height
   - Use theme colors (accent for active, muted for quiet)

2. **Event Markers:**
   - Overlay colored markers/bands for detected events
   - Use different colors for event intensity (based on peakEnergy)
   - Show event boundaries clearly

3. **Time Axis:**
   - Display time labels (0:00, 0:30, 1:00, etc.)
   - Show current playback position if audio is playing
   - Responsive to component width

4. **Interactivity:**
   - Touch/pan to scrub through timeline
   - Show tooltip with time and energy value on press
   - Optional: Sync with audio playback if implemented

5. **Performance:**
   - Use memoization for expensive calculations
   - Limit rendering to visible viewport if waveform is very long
   - Consider downsampling for very long recordings (>5 minutes)

**Component Props:**
```typescript
interface AudioWaveformProps {
  energyValues: number[];
  events: Array<{
    startTimeSeconds: number;
    endTimeSeconds: number;
    peakEnergy: number;
  }>;
  durationSeconds: number;
  windowSizeMs: number;
  height?: number;
  onTimeSelect?: (timeSeconds: number) => void;
  currentTime?: number; // For playback sync
}
```

**Implementation Notes:**
- Use `react-native-svg` Path or Polyline for smooth waveform
- Calculate bar widths based on window size and component width
- Normalize energy values: `normalized = (value / maxEnergy) * height`
- Color mapping: quiet (info), normal (accent), active (success)

### Phase 4: Integrate into Session Detail Screen

**File: `app/session/[id].tsx`**

1. **Load Visualization Data:**
   - Check if session has audio file
   - Compute visualization data on-demand (lazy load)
   - Cache computed data in session store
   - Handle loading state

2. **Add Waveform Section:**
   - Place after ActivityTimeline or replace it
   - Add section title: "Audio Waveform"
   - Include duration and event count summary
   - Show loading spinner while computing

3. **Handle Edge Cases:**
   - No audio file available
   - Analysis not yet computed
   - Very long recordings (consider pagination or zoom)
   - Placeholder for web platform (if audio analysis unavailable)

### Phase 5: Data Storage Strategy

**Option A: Compute on-demand (Recommended)**
- Store raw audio file URI
- Compute visualization data when viewing session
- Cache in memory during session
- Pros: No storage overhead, always fresh
- Cons: Computation delay on first view

**Option B: Store with analytics**
- Extend `SessionAnalytics` interface to include visualization data
- Compute during initial analysis
- Store in session store
- Pros: Instant display, no computation delay
- Cons: Larger storage footprint

**Recommendation: Option A** - Compute on-demand with in-memory caching

### Phase 6: Audio File Access

**Challenge:** Need to read audio file to get samples for visualization

**Solution:**
1. Use `expo-av` to load audio file
2. Extract audio samples (may require native module or Web Audio API)
3. For Expo: Consider using `expo-audio` or Web Audio API polyfill
4. Alternative: Use pre-computed energy values stored during analysis

**Note:** If extracting raw samples is complex, we can:
- Store energy values during initial analysis (recommended)
- Use the existing `activityTimeline` as a starting point
- Enhance with more granular data (50 segments instead of 10)

## Technical Considerations

### Performance
- **Long Recordings**: 5-minute recording = 3000 windows (100ms each)
- **Rendering**: Use FlatList or ScrollView for horizontal scrolling
- **Memory**: Limit to ~1000-2000 data points for smooth rendering
- **Downsampling**: For very long recordings, average adjacent windows

### Design System Compliance
- Use `colors`, `spacing`, `radius` from `styles/theme.ts`
- Use `textStyles` for labels
- Follow existing card/container patterns
- Match ActivityTimeline visual style

### Error Handling
- Handle missing audio files gracefully
- Show placeholder if analysis unavailable
- Handle computation errors (show error message)
- Fallback to existing ActivityTimeline if visualization fails

## Acceptance Criteria Checklist

- [ ] Export windowed energy values from audioAnalytics.ts
- [ ] Install react-native-svg dependency
- [ ] Create AudioWaveform component with waveform rendering
- [ ] Add event markers to waveform
- [ ] Display time axis with labels
- [ ] Implement touch interaction for scrubbing
- [ ] Integrate into session detail screen
- [ ] Handle loading and error states
- [ ] Test with various recording lengths
- [ ] Typecheck passes (npx tsc)
- [ ] Follow design system (theme.ts)
- [ ] Performance acceptable for 5-minute recordings

## Dependencies

**New Packages:**
- `react-native-svg` - SVG rendering
- `@types/react-native-svg` - TypeScript types

**Existing Packages (already installed):**
- `expo-av` - Audio file access
- `expo-file-system` - File system access

## File Changes Summary

**New Files:**
- `components/AudioWaveform.tsx` - Waveform visualization component

**Modified Files:**
- `src/analytics/audioAnalytics.ts` - Export visualization data
- `app/session/[id].tsx` - Add waveform section
- `src/models/session.ts` - Optional: extend SessionAnalytics interface
- `src/storage/sessionStore.ts` - Optional: store visualization data

**Package Updates:**
- `package.json` - Add react-native-svg

## Testing Strategy

1. **Unit Tests:**
   - Test energy value normalization
   - Test event marker positioning
   - Test time axis calculation

2. **Integration Tests:**
   - Test with real session data
   - Test with various recording lengths
   - Test touch interaction

3. **Visual Testing:**
   - Verify waveform renders correctly
   - Check event markers align with timeline
   - Verify colors match design system
   - Test on different screen sizes

## Future Enhancements (Out of Scope)

- Audio playback with waveform scrubbing
- Zoom in/out functionality
- Frequency spectrum visualization
- Export waveform as image
- Comparison view (multiple sessions)

## Estimated Complexity

- **Time**: 4-6 hours
- **Complexity**: Medium
- **Risk**: Low-Medium (depends on audio sample extraction complexity)

## Notes

- If extracting raw audio samples proves difficult, we can use the existing `activityTimeline` data and enhance it with more granular segments
- Consider using a library like `react-native-waveform` if available, but custom implementation gives more control
- Ensure waveform is accessible (screen reader support, high contrast mode)
