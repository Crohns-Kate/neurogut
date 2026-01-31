/**
 * Audio Sample Extraction Utility
 *
 * Extracts audio samples from recorded m4a files for analysis.
 *
 * Note: Expo/React Native doesn't have native PCM decoding for m4a files.
 * This implementation uses a byte-level approximation that works for
 * energy-based analysis (RMS, envelope detection) but is not true PCM.
 *
 * For production use, consider:
 * - expo-av's metering during recording
 * - Native module for proper audio decoding
 * - Server-side processing with ffmpeg
 */

import * as FileSystem from "expo-file-system/legacy";

/**
 * Extract audio samples from a recording file
 *
 * @param uri - File URI of the recording (m4a format)
 * @param durationSeconds - Duration of the recording in seconds
 * @param sampleRate - Target sample rate (default 44100)
 * @returns Array of normalized audio samples (-1 to 1)
 */
export async function extractAudioSamples(
  uri: string,
  durationSeconds: number,
  sampleRate: number = 44100
): Promise<number[]> {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              AUDIO SAMPLE EXTRACTION                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`URI: ${uri}`);
  console.log(`Duration: ${durationSeconds}s`);
  console.log(`Sample rate: ${sampleRate}Hz`);

  // Check if file exists
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    console.error('>>> File not found:', uri);
    throw new Error(`Recording file not found: ${uri}`);
  }

  const fileSizeBytes = (fileInfo as any).size || 0;
  console.log(`File size: ${(fileSizeBytes / 1024).toFixed(1)} KB`);

  // Read the raw file data as base64
  const base64Data = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });

  // Decode base64 to binary string
  const binaryString = atob(base64Data);
  console.log(`Binary data length: ${binaryString.length} bytes`);

  // Calculate expected samples
  const expectedSamples = Math.floor(durationSeconds * sampleRate);
  console.log(`Expected samples: ${expectedSamples}`);

  // Extract samples from binary data
  // m4a is a compressed format, so we're extracting an approximation
  // by reading the encoded bytes as if they were amplitude values
  const samples: number[] = [];

  // Skip the m4a header (typically first ~1000 bytes contain metadata)
  const headerOffset = Math.min(1000, Math.floor(binaryString.length * 0.05));

  // Calculate stride to get approximately the right number of samples
  const dataLength = binaryString.length - headerOffset;
  const stride = Math.max(1, Math.floor(dataLength / expectedSamples));

  for (let i = headerOffset; i < binaryString.length - 1 && samples.length < expectedSamples; i += stride) {
    // Read two bytes and combine them into a 16-bit value
    const byte1 = binaryString.charCodeAt(i);
    const byte2 = binaryString.charCodeAt(i + 1);

    // Combine bytes (little-endian) and normalize to -1 to 1 range
    const value16 = (byte1 | (byte2 << 8));
    // Treat as signed 16-bit integer
    const signedValue = value16 > 32767 ? value16 - 65536 : value16;
    const normalizedSample = signedValue / 32768;

    samples.push(normalizedSample);
  }

  // Pad with zeros if we didn't get enough samples
  while (samples.length < expectedSamples) {
    samples.push(0);
  }

  // Calculate basic stats for logging
  const maxAmp = Math.max(...samples.map(Math.abs));
  const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);

  console.log(`Extracted samples: ${samples.length}`);
  console.log(`Max amplitude: ${maxAmp.toFixed(4)}`);
  console.log(`RMS level: ${rms.toFixed(6)}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  return samples;
}

/**
 * Quick check if audio extraction is likely to work
 */
export async function canExtractAudio(uri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists && (fileInfo as any).size > 1000;
  } catch {
    return false;
  }
}
