/**
 * Audio Chime Utility
 *
 * Plays a notification chime when timers or recordings complete.
 * Uses the session_complete.mp3 sound file.
 */

import { Audio } from "expo-av";

// Keep a reference to allow cleanup
let chimeSound: Audio.Sound | null = null;

/**
 * Play a chime sound to notify the user of completion.
 * Automatically cleans up after playback finishes.
 */
export async function playChime(): Promise<void> {
  try {
    // Unload any previous sound
    if (chimeSound) {
      await chimeSound.unloadAsync();
      chimeSound = null;
    }

    // Load and play the chime
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/audio/session_complete.mp3"),
      { shouldPlay: true, volume: 0.7 }
    );

    chimeSound = sound;

    // Cleanup after playing
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(console.error);
        chimeSound = null;
      }
    });
  } catch (error) {
    console.error("Error playing chime:", error);
  }
}

/**
 * Cleanup any loaded chime sound.
 * Call this when unmounting components that use chimes.
 */
export async function unloadChime(): Promise<void> {
  if (chimeSound) {
    try {
      await chimeSound.unloadAsync();
    } catch (error) {
      console.error("Error unloading chime:", error);
    }
    chimeSound = null;
  }
}
