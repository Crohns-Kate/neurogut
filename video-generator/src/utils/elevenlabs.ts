/**
 * ElevenLabs API integration for voiceover
 * Uses Australian voice - voice_id: aRlmTYIQo6Tlg5SlulGC
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
}

const VOICE_ID = "aRlmTYIQo6Tlg5SlulGC";

/**
 * Generate audio from text using ElevenLabs API
 */
export async function generateVoiceover(
  text: string,
  apiKey: string
): Promise<string> {
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
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  return url;
}

/**
 * Professional Sales Pitch Narration Script
 * Total Duration: 85 seconds
 * Voice: Charlotte (Australian) - ID: aRlmTYIQo6Tlg5SlulGC
 *
 * Timings based on actual audio file durations from ElevenLabs
 */
export const NARRATION_SCRIPT = {
  intro: {
    text: "Welcome to NeuroGut Acoustics. We've built the world's first clinical mirror for your autonomic nervous system, right here on Australia's Gold Coast. This is the future of gut-brain intelligence.",
    startTime: 0,
    duration: 15, // actual: 14.86s
  },
  founder: {
    text: "Behind this innovation is Doctor Michael Bishopp, a clinician with over fifteen years of patient care experience. After his own journey through gut challenges and bowel surgery, he set out to create the diagnostic tool he always wished existed. And now, it's here for you.",
    startTime: 15,
    duration: 18, // actual: 18.05s
  },
  anatomical: {
    text: "So how does it work? It starts with precision placement. Our guided protocol targets the Lower Right Quadrant, home of the ileocecal valve. This isn't just sound capture. It's standardized, clinical-grade acoustic measurement.",
    startTime: 33,
    duration: 15, // actual: 14.99s
  },
  engine: {
    text: "From there, our proprietary Insight Engine takes over. It decodes the complex rhythms of your digestive system, filtering out environmental noise to reveal true gut motility in real time.",
    startTime: 48,
    duration: 14, // actual: 13.79s
  },
  vrs: {
    text: "All of this comes together in your Vagal Readiness Score. By analyzing baseline motility, rhythmicity, and breathing response, we quantify your vagal tone. This isn't just a number. It's a window into your body's capacity to heal, restore, and thrive.",
    startTime: 62,
    duration: 17, // actual: 16.90s
  },
  outro: {
    text: "NeuroGut Acoustics. Listen to your gut. Visit neurogut.com to learn more.",
    startTime: 79,
    duration: 6, // actual: 5.46s
  },
};

/**
 * Total video duration in seconds
 */
export const VIDEO_DURATION_SECONDS = 85;
