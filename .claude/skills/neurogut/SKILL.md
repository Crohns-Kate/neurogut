# NeuroGut (Expo) — Skill Rules

Use these rules when implementing changes in this repo (`neurogut-expo`). They are derived from `app.json`, `styles/theme.ts`, and `src/analytics/audioAnalytics.ts`.

## Expo SDK 54 / app config invariants

- **Keep the app configuration in `app.json` coherent with current intent**:
  - **Platforms**: `["android", "ios", "web"]`
  - **Deep link scheme**: `scheme: "neurogut"` (preserve unless intentionally changing deep linking)
  - **New architecture**: `newArchEnabled: false` (do not “silently” flip this; it changes runtime behavior)
  - **UI style**: `userInterfaceStyle: "light"` (if visual design remains dark, ensure status bar/system UI remains readable)
  - **Android**:
    - `edgeToEdgeEnabled: true` (layouts should respect safe areas / insets)
    - `predictiveBackGestureEnabled: false` (don’t rely on predictive-back behaviors)
- **Prefer Expo-first implementations** compatible with Expo SDK 54.
  - Avoid adding native-only dependencies unless necessary; if unavoidable, ensure config/plugins are properly represented in Expo config.

## Design system rules (`styles/theme.ts`)

- **Single source of truth**: Use tokens from `styles/theme.ts` (or `styles/index.ts` if it re-exports) instead of ad-hoc values.
  - **Colors**:
    - Backgrounds: `colors.background`, `colors.backgroundElevated`, `colors.backgroundCard`
    - Text: `colors.textPrimary`, `colors.textSecondary`, `colors.textMuted`
    - Accent: `colors.accent`, `colors.accentDim`, `colors.accentHover`
    - Status: `colors.success`, `colors.warning`, `colors.error`, `colors.info`
    - Borders: `colors.border`, `colors.borderLight`
- **Spacing is 4px-based**: Prefer `spacing` tokens (`xs`…`5xl`) over raw numbers.
- **Typography**:
  - Prefer `textStyles` (`heading1`, `heading2`, `heading3`, `body`, `bodySecondary`, `caption`, `label`) for consistent font sizes/weights/colors.
  - If you must customize, compose from `typography.sizes`, `typography.weights`, `typography.lineHeights`, `typography.letterSpacing`.
- **Shape & elevation**:
  - Use `radius` tokens (`sm`…`full`) for corners.
  - Use `shadows` presets (`sm`/`md`/`lg`) rather than bespoke shadow values.
- **Safe area defaults**:
  - Use `safeArea` (`top`, `bottom`, `horizontal`) as baseline padding where appropriate; adjust only when the screen’s layout requires it.

## Gut-sound analytics rules (`src/analytics/audioAnalytics.ts`)

- **This module is heuristic self-tracking, not diagnosis**. Preserve the non-medical intent and messaging.
- **Inputs / assumptions**:
  - `analyzeAudioSamples(samples, durationSeconds, sampleRate?)`
  - `samples` are expected **normalized in the range \([-1, 1]\)**.
  - Default `sampleRate` is **44100 Hz** (`CONFIG.sampleRate`).
  - Keep `durationSeconds` consistent with sample count and sample rate; mismatches skew events/minute and time metrics.
- **Event detection pipeline (must remain logically consistent)**:
  - Windowed RMS energy using:
    - `CONFIG.windowSizeMs = 100` ms
    - `windowSizeSamples = floor((windowSizeMs / 1000) * sampleRate)`
  - Adaptive threshold:
    - `threshold = mean(energyValues) + CONFIG.thresholdMultiplier * stdDev(energyValues)`
    - Current `CONFIG.thresholdMultiplier = 1.5`
  - Event grouping / validation:
    - A gap of `CONFIG.minGapWindows = 3` windows ends an event.
    - Events shorter than `CONFIG.minEventWindows = 2` windows are discarded.
- **Metrics (contract with the rest of the app)**:
  - `eventsPerMinute = events.length / (durationSeconds / 60)` rounded to 1 decimal.
  - Active time is derived from counted event windows:
    - `windowDurationSeconds = windowSizeMs / 1000`
    - `totalActiveSeconds = activeWindows * windowDurationSeconds`
    - `totalQuietSeconds = max(0, durationSeconds - totalActiveSeconds)`
  - **Motility Index (0–100)**:
    - Normalizes events/minute into 0–100 over the range \(0 \rightarrow 20\) EPM.
    - Combines: `0.7 * normalizedEPM + 0.3 * (activeFraction * 100)` and clamps to `[0, 100]`.
  - **Activity timeline**:
    - Exactly `CONFIG.timelineSegments = 10` bins.
    - Each segment is normalized to 0–100 relative to the recording’s **max window energy**.
- **Fallback behavior**:
  - `generatePlaceholderAnalytics(durationSeconds)` is for cases where real analysis isn’t available (e.g., web / unreadable audio).
  - Do not use placeholder analytics when real samples are available.
- **Performance constraints**:
  - Keep algorithms lightweight and on-device friendly (Expo/React Native). Avoid heavy CPU or allocations in hot paths.

## Required pre-finish check

- **Before finishing any task, always run** `npx tsc` **and address any type errors you introduced.**

