/**
 * Audio Service - ElevenLabs Integration & Offline Caching
 *
 * Fetches and caches voice-over audio files for offline clinic use.
 * Uses expo-file-system for persistent caching and expo-av for playback.
 */

import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

// ElevenLabs API Configuration
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";
const CHARLOTTE_VOICE_ID = "XB0fDUnXU5powFXDhCwa"; // Australian Charlotte

// Audio cache directory
const AUDIO_CACHE_DIR = `${FileSystem.documentDirectory || ""}audio-cache/`;

// Audio file types
export type AudioAssetType =
  | "welcome_intro"
  | "placement_step1"
  | "placement_step2"
  | "placement_step3"
  | "placement_outro"
  | "breathing_478_intro"
  | "breathing_478_guide"
  | "humming_calibration"
  | "session_complete";

// Audio scripts for TTS generation
export const AUDIO_SCRIPTS: Record<AudioAssetType, string> = {
  welcome_intro:
    "Welcome to Neurogut. Let's begin your daily gut-brain wellness check-in. This will only take a few minutes.",
  placement_step1:
    "First, find your belly button. This is your starting reference point.",
  placement_step2:
    "Now, move your phone about two to three inches down, and to your right. This is the Lower Right Quadrant, where gut sounds are clearest.",
  placement_step3:
    "Press the phone firmly against your skin. Use your palm to apply steady, gentle pressure. Make sure the microphone makes full contact.",
  placement_outro:
    "Perfect! Hold this position during your recording session. Stay still and relaxed for the best results.",
  breathing_478_intro:
    "We'll now guide you through the 4-7-8 breathing technique. This helps activate your vagus nerve and promotes calm.",
  breathing_478_guide:
    "Breathe in through your nose for 4 seconds. Hold your breath for 7 seconds. Exhale slowly through your mouth for 8 seconds.",
  humming_calibration:
    "Now, let's calibrate your humming. Hum a low, steady note for about 10 seconds. This vibration stimulates the vagus nerve.",
  session_complete:
    "Your session is complete. Great work today. Remember, consistency is key for tracking your gut-brain wellness.",
};

// Audio metadata interface
interface AudioMetadata {
  assetType: AudioAssetType;
  cachedAt: string;
  fileSize: number;
  duration?: number;
}

// Sound instance cache for playback
const soundCache: Map<AudioAssetType, Audio.Sound> = new Map();

/**
 * Ensure audio cache directory exists
 */
async function ensureCacheDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, {
      intermediates: true,
    });
  }
}

/**
 * Get the local cache path for an audio asset
 */
function getAudioCachePath(assetType: AudioAssetType): string {
  return `${AUDIO_CACHE_DIR}${assetType}.mp3`;
}

/**
 * Get metadata cache path
 */
function getMetadataCachePath(): string {
  return `${AUDIO_CACHE_DIR}metadata.json`;
}

/**
 * Check if an audio file is cached locally
 */
export async function isAudioCached(assetType: AudioAssetType): Promise<boolean> {
  const cachePath = getAudioCachePath(assetType);
  const fileInfo = await FileSystem.getInfoAsync(cachePath);
  return fileInfo.exists;
}

/**
 * Get all cached audio metadata
 */
export async function getCachedAudioMetadata(): Promise<AudioMetadata[]> {
  try {
    const metadataPath = getMetadataCachePath();
    const fileInfo = await FileSystem.getInfoAsync(metadataPath);
    if (!fileInfo.exists) return [];

    const content = await FileSystem.readAsStringAsync(metadataPath);
    return JSON.parse(content) as AudioMetadata[];
  } catch {
    return [];
  }
}

/**
 * Save audio metadata
 */
async function saveAudioMetadata(metadata: AudioMetadata[]): Promise<void> {
  const metadataPath = getMetadataCachePath();
  await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Fetch audio from ElevenLabs and cache locally
 * Requires ELEVENLABS_API_KEY environment variable or passed as parameter
 */
export async function fetchAndCacheAudio(
  assetType: AudioAssetType,
  apiKey?: string
): Promise<string> {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ElevenLabs API key is required");
  }

  await ensureCacheDirectory();

  const script = AUDIO_SCRIPTS[assetType];
  const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${CHARLOTTE_VOICE_ID}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": key,
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  // Convert response to base64
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );

  // Save to cache
  const cachePath = getAudioCachePath(assetType);
  await FileSystem.writeAsStringAsync(cachePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Update metadata
  const metadata = await getCachedAudioMetadata();
  const existingIndex = metadata.findIndex((m) => m.assetType === assetType);
  const newEntry: AudioMetadata = {
    assetType,
    cachedAt: new Date().toISOString(),
    fileSize: arrayBuffer.byteLength,
  };

  if (existingIndex >= 0) {
    metadata[existingIndex] = newEntry;
  } else {
    metadata.push(newEntry);
  }
  await saveAudioMetadata(metadata);

  return cachePath;
}

/**
 * Pre-cache all audio assets for offline use
 */
export async function preCacheAllAudio(
  apiKey?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: AudioAssetType[]; failed: AudioAssetType[] }> {
  const assets = Object.keys(AUDIO_SCRIPTS) as AudioAssetType[];
  const success: AudioAssetType[] = [];
  const failed: AudioAssetType[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      // Check if already cached
      const isCached = await isAudioCached(asset);
      if (!isCached) {
        await fetchAndCacheAudio(asset, apiKey);
      }
      success.push(asset);
    } catch (error) {
      console.error(`Failed to cache ${asset}:`, error);
      failed.push(asset);
    }

    onProgress?.(i + 1, assets.length);

    // Rate limiting - wait 500ms between requests
    if (i < assets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { success, failed };
}

/**
 * Load audio from cache for playback
 */
export async function loadAudio(assetType: AudioAssetType): Promise<Audio.Sound | null> {
  // Check if already loaded
  const cached = soundCache.get(assetType);
  if (cached) {
    return cached;
  }

  const cachePath = getAudioCachePath(assetType);
  const fileInfo = await FileSystem.getInfoAsync(cachePath);

  if (!fileInfo.exists) {
    console.warn(`Audio not cached: ${assetType}`);
    return null;
  }

  try {
    const { sound } = await Audio.Sound.createAsync({ uri: cachePath });
    soundCache.set(assetType, sound);
    return sound;
  } catch (error) {
    console.error(`Failed to load audio ${assetType}:`, error);
    return null;
  }
}

/**
 * Play cached audio
 */
export async function playAudio(assetType: AudioAssetType): Promise<void> {
  const sound = await loadAudio(assetType);
  if (!sound) {
    console.warn(`Cannot play: ${assetType} not cached`);
    return;
  }

  // Reset to beginning and play
  await sound.setPositionAsync(0);
  await sound.playAsync();
}

/**
 * Stop audio playback
 */
export async function stopAudio(assetType: AudioAssetType): Promise<void> {
  const sound = soundCache.get(assetType);
  if (sound) {
    await sound.stopAsync();
  }
}

/**
 * Stop all audio playback
 */
export async function stopAllAudio(): Promise<void> {
  for (const sound of soundCache.values()) {
    try {
      await sound.stopAsync();
    } catch {
      // Ignore errors when stopping
    }
  }
}

/**
 * Unload all audio from memory
 */
export async function unloadAllAudio(): Promise<void> {
  for (const sound of soundCache.values()) {
    try {
      await sound.unloadAsync();
    } catch {
      // Ignore errors when unloading
    }
  }
  soundCache.clear();
}

/**
 * Clear audio cache
 */
export async function clearAudioCache(): Promise<void> {
  await unloadAllAudio();
  try {
    await FileSystem.deleteAsync(AUDIO_CACHE_DIR, { idempotent: true });
  } catch (error) {
    console.error("Failed to clear audio cache:", error);
  }
}

/**
 * Get cache status for UI display
 */
export async function getAudioCacheStatus(): Promise<{
  totalAssets: number;
  cachedAssets: number;
  cacheSize: number;
  assets: Array<{ type: AudioAssetType; cached: boolean; size?: number }>;
}> {
  const assets = Object.keys(AUDIO_SCRIPTS) as AudioAssetType[];
  const metadata = await getCachedAudioMetadata();
  const metadataMap = new Map(metadata.map((m) => [m.assetType, m]));

  let totalSize = 0;
  const assetStatus = await Promise.all(
    assets.map(async (type) => {
      const cached = await isAudioCached(type);
      const meta = metadataMap.get(type);
      if (meta) {
        totalSize += meta.fileSize || 0;
      }
      return {
        type,
        cached,
        size: meta?.fileSize,
      };
    })
  );

  return {
    totalAssets: assets.length,
    cachedAssets: assetStatus.filter((a) => a.cached).length,
    cacheSize: totalSize,
    assets: assetStatus,
  };
}
