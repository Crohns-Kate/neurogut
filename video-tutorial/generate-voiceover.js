/**
 * ElevenLabs Voiceover Generator
 * Generates Australian Charlotte voiceover for the placement tutorial
 */

const fs = require('fs');
const path = require('path');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_1e37af9a7f1ea4fbfb951e8ca845986110f72b230209a716';

// Charlotte voice ID (Australian accent)
// Charlotte is a warm, friendly Australian voice
const CHARLOTTE_VOICE_ID = 'XB0fDUnXU5powFXDhCwa'; // Charlotte

const SCRIPT_SEGMENTS = [
  {
    id: 'intro',
    text: "Let's learn how to position your phone for accurate gut sound recording.",
    duration: 4000,
  },
  {
    id: 'step1',
    text: "First, find your belly button. This is your starting reference point.",
    duration: 4000,
  },
  {
    id: 'step2',
    text: "Now, move your phone about two to three inches down, and to your right. This is the Lower Right Quadrant, where gut sounds are clearest.",
    duration: 7000,
  },
  {
    id: 'step3',
    text: "Press the phone firmly against your skin. Use your palm to apply steady, gentle pressure. Make sure the microphone makes full contact.",
    duration: 7000,
  },
  {
    id: 'outro',
    text: "Perfect! Hold this position during your recording session. Stay still and relaxed for the best results.",
    duration: 5000,
  },
];

async function generateVoiceover(segment) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${CHARLOTTE_VOICE_ID}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: segment.text,
      model_id: 'eleven_multilingual_v2',
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

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}

async function main() {
  console.log('Generating voiceover with Australian Charlotte...\n');

  const outputDir = path.join(__dirname, 'audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const segment of SCRIPT_SEGMENTS) {
    console.log(`Generating: ${segment.id}...`);
    console.log(`  "${segment.text}"`);

    try {
      const audio = await generateVoiceover(segment);
      const outputPath = path.join(outputDir, `${segment.id}.mp3`);
      fs.writeFileSync(outputPath, audio);
      console.log(`  Saved to: ${outputPath}\n`);
    } catch (error) {
      console.error(`  Error: ${error.message}\n`);
    }
  }

  // Generate combined metadata
  const metadata = {
    voice: 'Charlotte (Australian)',
    segments: SCRIPT_SEGMENTS,
    totalDuration: SCRIPT_SEGMENTS.reduce((sum, s) => sum + s.duration, 0),
  };

  fs.writeFileSync(
    path.join(outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log('Voiceover generation complete!');
  console.log(`Total duration: ${metadata.totalDuration / 1000} seconds`);
}

main().catch(console.error);
