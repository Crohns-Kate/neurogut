/**
 * Audio Sample Extraction Utility
 *
 * Extracts audio samples from recorded m4a files for analysis.
 *
 * Note: Expo/React Native doesn't have native PCM decoding for m4a files.
 * This implementation uses a byte-level approximation that works for
 * energy-based analysis (RMS, envelope detection) but is not true PCM.
 *
 * IMPORTANT: Uses chunked processing to avoid stack overflow on large files.
 * A 3-minute recording at 44.1kHz = ~8 million samples, which exceeds
 * JavaScript's call stack limits if processed with spread operators.
 *
 * For production use, consider:
 * - expo-av's metering during recording
 * - Native module for proper audio decoding
 * - Server-side processing with ffmpeg
 */

import * as FileSystem from "expo-file-system/legacy";

// ════════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════════

const EXTRACTION_CONFIG = {
  // Process base64 in chunks to avoid stack overflow
  base64ChunkSize: 50000,

  // Target sample rate for analysis (downsampled from 44.1kHz)
  // 4410 Hz is sufficient for both gut sounds (100-500Hz) and heart (20-80Hz)
  // This reduces 8M samples to 800K - much more manageable
  targetSampleRate: 4410,

  // Original recording sample rate
  sourceSampleRate: 44100,

  // Skip m4a header bytes (metadata)
  headerSkipBytes: 1000,
};

// ════════════════════════════════════════════════════════════════════════════════
// CHUNKED BASE64 DECODING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Decode base64 string in chunks to avoid stack overflow
 */
function decodeBase64Chunked(base64: string): Uint8Array {
  // Calculate the output size (base64 is ~4/3 the size of binary)
  const outputLength = Math.floor((base64.length * 3) / 4);
  const output = new Uint8Array(outputLength);

  let outputIndex = 0;
  const chunkSize = EXTRACTION_CONFIG.base64ChunkSize;

  // Process in chunks
  for (let i = 0; i < base64.length; i += chunkSize) {
    const chunk = base64.slice(i, Math.min(i + chunkSize, base64.length));

    // Ensure chunk ends on a 4-character boundary (base64 requirement)
    const adjustedEnd = Math.min(i + chunkSize, base64.length);
    const remainder = (adjustedEnd - i) % 4;
    const adjustedChunk = remainder === 0 ? chunk : base64.slice(i, adjustedEnd - remainder);

    if (adjustedChunk.length === 0) continue;

    try {
      const decoded = atob(adjustedChunk);
      for (let j = 0; j < decoded.length && outputIndex < output.length; j++) {
        output[outputIndex++] = decoded.charCodeAt(j);
      }
    } catch (e) {
      // Skip invalid chunks
      console.warn(`Base64 decode error at offset ${i}`);
    }
  }

  return output.slice(0, outputIndex);
}

// ════════════════════════════════════════════════════════════════════════════════
// SAMPLE EXTRACTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Extract audio samples from a recording file
 *
 * Uses downsampling to reduce memory usage and avoid stack overflow.
 * A 3-minute recording is reduced from ~8M samples to ~800K samples.
 *
 * @param uri - File URI of the recording (m4a format)
 * @param durationSeconds - Duration of the recording in seconds
 * @param sampleRate - Target sample rate (default 44100, will be downsampled)
 * @returns Array of normalized audio samples (-1 to 1)
 */
export async function extractAudioSamples(
  uri: string,
  durationSeconds: number,
  sampleRate: number = 44100
): Promise<number[]> {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              AUDIO SAMPLE EXTRACTION (Chunked)                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`URI: ${uri}`);
  console.log(`Duration: ${durationSeconds}s`);
  console.log(`Requested sample rate: ${sampleRate}Hz`);
  console.log(`Target sample rate: ${EXTRACTION_CONFIG.targetSampleRate}Hz (downsampled)`);

  // Check if file exists
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    console.error('>>> File not found:', uri);
    throw new Error(`Recording file not found: ${uri}`);
  }

  const fileSizeBytes = (fileInfo as any).size || 0;
  console.log(`File size: ${(fileSizeBytes / 1024).toFixed(1)} KB`);

  // Read the raw file data as base64
  console.log('Reading file as base64...');
  const base64Data = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
  console.log(`Base64 length: ${base64Data.length} chars`);

  // Decode base64 to binary in chunks
  console.log('Decoding base64 in chunks...');
  const binaryData = decodeBase64Chunked(base64Data);
  console.log(`Binary data length: ${binaryData.length} bytes`);

  // Calculate downsampling factor
  const downsampleFactor = Math.floor(EXTRACTION_CONFIG.sourceSampleRate / EXTRACTION_CONFIG.targetSampleRate);
  const expectedSamples = Math.floor(durationSeconds * EXTRACTION_CONFIG.targetSampleRate);
  console.log(`Downsample factor: ${downsampleFactor}x`);
  console.log(`Expected samples (downsampled): ${expectedSamples}`);

  // Extract samples from binary data with downsampling
  // m4a is compressed, so we're extracting an approximation
  const samples: number[] = [];

  // Skip the m4a header
  const headerOffset = EXTRACTION_CONFIG.headerSkipBytes;
  const dataLength = binaryData.length - headerOffset;

  // Calculate stride: how many bytes per output sample
  // We want expectedSamples from (dataLength/2) 16-bit samples
  // Then apply downsampling factor
  const bytesPerSample = 2;
  const totalPossibleSamples = Math.floor(dataLength / bytesPerSample);
  const baseStride = Math.max(1, Math.floor(totalPossibleSamples / expectedSamples));
  const stride = baseStride * bytesPerSample;

  console.log(`Processing ${dataLength} bytes with stride ${stride}...`);

  // Process samples
  for (let i = headerOffset; i < binaryData.length - 1 && samples.length < expectedSamples; i += stride) {
    // Read two bytes and combine them into a 16-bit value
    const byte1 = binaryData[i];
    const byte2 = binaryData[i + 1];

    // Combine bytes (little-endian) and normalize to -1 to 1 range
    const value16 = (byte1 | (byte2 << 8));
    // Treat as signed 16-bit integer
    const signedValue = value16 > 32767 ? value16 - 65536 : value16;
    const normalizedSample = signedValue / 32768;

    samples.push(normalizedSample);
  }

  console.log(`Extracted ${samples.length} samples`);

  // Calculate basic stats without using spread operator (avoids stack overflow)
  let maxAmp = 0;
  let sumSquares = 0;

  for (let i = 0; i < samples.length; i++) {
    const absVal = Math.abs(samples[i]);
    if (absVal > maxAmp) maxAmp = absVal;
    sumSquares += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sumSquares / samples.length);

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

/**
 * Get the effective sample rate used by the extractor
 * (for callers that need to know the actual rate after downsampling)
 */
export function getEffectiveSampleRate(): number {
  return EXTRACTION_CONFIG.targetSampleRate;
}
