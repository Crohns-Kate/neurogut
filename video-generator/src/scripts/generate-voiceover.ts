/**
 * Script to generate ElevenLabs voiceover for the demo video
 * Run: npm run generate-voiceover
 *
 * API key: set ELEVENLABS_API_KEY env var, or add to .env:
 *   ELEVENLABS_API_KEY=your-api-key
 */

import "dotenv/config";
import { NARRATION_SCRIPT } from "../utils/elevenlabs";
import * as fs from "fs";
import * as path from "path";

const VOICE_ID = "aRlmTYIQo6Tlg5SlulGC";

/**
 * Generate audio from text using ElevenLabs API (Node.js compatible)
 */
async function generateVoiceoverNode(
  text: string,
  apiKey: string
): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const apiKey = (process.env.ELEVENLABS_API_KEY ?? "").trim();

  if (!apiKey) {
    console.error("Error: ELEVENLABS_API_KEY is required.");
    console.log("  Option 1: Add to .env: ELEVENLABS_API_KEY=your-api-key");
    console.log("  Option 2: PowerShell: $env:ELEVENLABS_API_KEY='your-api-key'");
    process.exit(1);
  }

  console.log("Generating voiceover with Australian voice (ID: aRlmTYIQo6Tlg5SlulGC)...\n");

  // Create public/audio directory if it doesn't exist
  const audioDir = path.join(process.cwd(), "public", "audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // Generate audio for each narration segment
  const segments = Object.entries(NARRATION_SCRIPT);
  const generatedFiles: string[] = [];

  for (const [key, script] of segments) {
    console.log(`Generating: "${script.text.substring(0, 50)}..."`);

    try {
      const audioBuffer = await generateVoiceoverNode(script.text, apiKey);

      const filename = `${key}.mp3`;
      const filepath = path.join(audioDir, filename);
      fs.writeFileSync(filepath, audioBuffer);
      generatedFiles.push(filename);

      console.log(`✓ Saved: ${filename} (${audioBuffer.length} bytes)\n`);
    } catch (error) {
      console.error(`✗ Error generating ${key}:`, error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("missing_permissions") && msg.includes("text_to_speech")) {
        console.error("\n  → Fix: Create an API key with 'text_to_speech' enabled at https://elevenlabs.io/app/settings/api-keys\n");
      }
      process.exit(1);
    }
  }

  console.log("\n✅ Voiceover generation complete!");
  console.log(`Generated ${generatedFiles.length} audio files in: ${audioDir}`);
  console.log("\nFiles created:");
  generatedFiles.forEach(f => console.log(`  - ${f}`));
}

main().catch(console.error);
