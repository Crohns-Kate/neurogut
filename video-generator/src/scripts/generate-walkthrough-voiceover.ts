/**
 * Script to generate ElevenLabs voiceover for the App Walkthrough demo video
 * Run: npx ts-node src/scripts/generate-walkthrough-voiceover.ts
 *
 * API key: set ELEVENLABS_API_KEY env var, or add to .env:
 *   ELEVENLABS_API_KEY=your-api-key
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const VOICE_ID = "aRlmTYIQo6Tlg5SlulGC"; // Charlotte (Australian)

/**
 * Walkthrough narration script
 */
const WALKTHROUGH_SCRIPT = {
  intro: {
    text: "Let's take a journey through NeuroGut Acoustics. In less than five minutes a day, you'll gain unprecedented insight into your gut-brain connection.",
  },
  home: {
    text: "When you open the app, you're greeted with your personal dashboard. Here you'll see your Vagal Readiness Score, recent sessions, and a clear call to action for your daily check-in.",
  },
  placement: {
    text: "Before recording, our guided placement system helps you position your device correctly. We target the lower right quadrant of your abdomen, directly over the ileocecal valve, the gateway between your small and large intestine.",
  },
  recording: {
    text: "During the recording, you'll see real-time feedback. The anatomical mirror visualizes your gut sounds as they happen, while our signal quality indicator ensures you're capturing clean acoustic data.",
  },
  analysis: {
    text: "Once complete, our proprietary Insight Engine processes your recording. Advanced signal analysis extracts motility patterns, identifies borborygmi events, and measures the rhythmic signatures of your digestive system.",
  },
  results: {
    text: "Your results arrive in seconds. See your gut activity level, sound event timeline, and personalized insights. Every session builds your baseline, helping the app understand what's normal for you.",
  },
  vagal: {
    text: "The Vagal Readiness Score is your headline metric. It combines acoustic patterns, breathing response, and contextual factors to quantify your autonomic balance. This isn't just data. It's your personal window into gut-brain wellness.",
  },
  outro: {
    text: "Start your journey today. Download NeuroGut Acoustics and listen to what your gut is telling you.",
  },
};

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

  console.log("🎙️  Generating App Walkthrough voiceover...");
  console.log("    Voice: Charlotte (Australian) - ID:", VOICE_ID);
  console.log("");

  // Create public/audio/walkthrough directory
  const audioDir = path.join(process.cwd(), "public", "audio", "walkthrough");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log(`📁 Created directory: ${audioDir}\n`);
  }

  // Generate audio for each narration segment
  const segments = Object.entries(WALKTHROUGH_SCRIPT);
  const generatedFiles: string[] = [];

  for (const [key, script] of segments) {
    console.log(`🔊 Generating: "${script.text.substring(0, 50)}..."`);

    try {
      const audioBuffer = await generateVoiceoverNode(script.text, apiKey);

      const filename = `${key}.mp3`;
      const filepath = path.join(audioDir, filename);
      fs.writeFileSync(filepath, audioBuffer);
      generatedFiles.push(filename);

      console.log(`   ✓ Saved: ${filename} (${(audioBuffer.length / 1024).toFixed(1)} KB)\n`);
    } catch (error) {
      console.error(`   ✗ Error generating ${key}:`, error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("missing_permissions") && msg.includes("text_to_speech")) {
        console.error("\n  → Fix: Create an API key with 'text_to_speech' enabled at https://elevenlabs.io/app/settings/api-keys\n");
      }
      process.exit(1);
    }
  }

  console.log("\n✅ Walkthrough voiceover generation complete!");
  console.log(`   Generated ${generatedFiles.length} audio files in: ${audioDir}`);
  console.log("\nFiles created:");
  generatedFiles.forEach(f => console.log(`   - ${f}`));
  console.log("\n🎬 Ready to render! Run: npx remotion render AppWalkthrough out/app-walkthrough.mp4");
}

main().catch(console.error);
