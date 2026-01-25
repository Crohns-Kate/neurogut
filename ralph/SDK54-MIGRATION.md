# Expo SDK 54 Migration Plan

## Audio Library Migration: expo-av → expo-audio

### Current State
- **Current Library**: `expo-av` v16.0.8
- **Usage**: Audio recording and playback in `app/record.tsx`
- **Status**: Working, but deprecated in favor of `expo-audio`

### Migration Assessment

**Complexity**: Medium-High
**Estimated Time**: 2-4 hours
**Risk Level**: Medium (affects core recording functionality)

### Key Differences

#### expo-av (Current)
```typescript
import { Audio } from "expo-av";

// Recording
const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY
);

// Playback
const { sound } = await Audio.Sound.createAsync({ uri });

// Permissions
const { status } = await Audio.requestPermissionsAsync();

// Audio Mode
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
});
```

#### expo-audio (New)
```typescript
import { useAudioRecorder, useAudioPlayer } from "expo-audio";

// Recording (Hook-based)
const recorder = useAudioRecorder();
await recorder.record();

// Playback (Hook-based)
const player = useAudioPlayer(uri);
player.play();

// Permissions (Different API)
import * as Audio from "expo-audio";
const { status } = await Audio.requestPermissionsAsync();
```

### Migration Steps

1. **Install expo-audio**
   ```bash
   npx expo install expo-audio
   ```

2. **Update app/record.tsx**
   - Replace `Audio.Recording` with `useAudioRecorder()` hook
   - Replace `Audio.Sound` with `useAudioPlayer()` hook
   - Update permission requests
   - Update audio mode configuration
   - Test recording functionality thoroughly

3. **Update TypeScript Types**
   - Replace `AVPlaybackStatus` with new status types
   - Update recording state management

4. **Testing Checklist**
   - [ ] Recording starts correctly
   - [ ] Recording stops correctly
   - [ ] Playback works for saved recordings
   - [ ] Permissions request works on iOS/Android
   - [ ] Audio mode configuration works
   - [ ] Timer-based auto-stop works
   - [ ] File saving works correctly

### Current Decision

**Status**: Defer migration for now
**Reason**: 
- `expo-av` is still supported in SDK 54
- Migration requires significant refactoring (hooks vs class-based API)
- Core functionality is working correctly
- Risk of breaking recording feature during migration

### Future Migration

**Recommended Timeline**: Before Clinical V1.0 release
**Prerequisites**:
- Comprehensive test suite for audio recording
- Backup of current working implementation
- Test on both iOS and Android devices

### Alternative: Suppress Warning

If warnings persist, we can suppress them via:
- Metro config: `resolver.extraNodeModules` configuration
- Or wait for expo-av to be fully deprecated (not yet in SDK 54)

---

## New Architecture Configuration

### Current State
- **Status**: Removed `newArchEnabled: false` from app.json
- **Reason**: Field is deprecated in SDK 54. New Architecture is opt-in via separate configuration.

### Impact
- No functional changes
- Removes deprecation warning
- Expo Go compatibility maintained

---

## Metro Runtime Fixes

### Error-Overlay Import Warning

**Issue**: Subpath export warning for error-overlay
**Solution**: 
1. Clear Metro cache: `npx expo start -c`
2. If persists, check `@expo/metro-runtime` version compatibility
3. Update if needed: `npx expo install @expo/metro-runtime`

**Current Version**: `@expo/metro-runtime": "~6.1.2`
**Status**: Compatible with Expo SDK 54

**Note**: The error-overlay warning is typically a non-blocking Metro bundler warning that doesn't affect app functionality. Clearing the cache usually resolves it.

### Dependency Updates Available

**Outdated Packages** (non-critical, but recommended for future updates):
- `expo@54.0.27` → `~54.0.32`
- `expo-constants@18.0.11` → `~18.0.13`
- `expo-file-system@19.0.20` → `~19.0.21`
- `expo-linking@8.0.10` → `~8.0.11`
- `expo-router@6.0.17` → `~6.0.22`

**Action**: Defer updates for now to maintain stability. Update before Clinical V1.0 release.

---

## Verification Checklist

- [x] Removed `newArchEnabled` from app.json
- [ ] Verified app starts without New Architecture warning
- [ ] Verified audio recording still works
- [ ] Verified Metro cache cleared
- [ ] Verified no error-overlay warnings
- [ ] Tested on Expo Go (iOS)
- [ ] Tested on Expo Go (Android)
