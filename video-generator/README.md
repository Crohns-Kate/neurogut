# Neurogut Demo Video

A product demo video for the Neurogut app created with Remotion and ElevenLabs voiceover.

## Features Showcased

- Gut Sound Recording with 3 protocols (Quick Check, Post-Meal, Mind-Body)
- Pre-recording context tags (meal timing, stress level, posture)
- Motility Index (0-100) with color badges
- Activity Timeline chart
- AI-Powered Insights (pattern analysis, protocol comparison, stress correlation)
- Daily Symptom Tracking (energy, pain, bloating, mood)

## Setup

```bash
npm install
```

## Generate Voiceover (ElevenLabs)

1. Get your ElevenLabs API key from https://elevenlabs.io
2. Set the environment variable:
   ```powershell
   $env:ELEVENLABS_API_KEY='your-api-key-here'
   ```
3. Generate audio files:
   ```bash
   npm run generate-voiceover
   ```
   This will create audio files in `public/audio/` using Charlotte voice (Australian female).

4. Update `src/NeurogutDemo.tsx` to uncomment the Audio component and point to your audio file.

## Development

```bash
npm run dev
```

Opens Remotion Studio at http://localhost:3000

## Render Video

```bash
npm run render
```

Outputs to `out/neurogut-demo.mp4`

## Video Structure

- **Duration:** 45 seconds (1350 frames @ 30fps)
- **Resolution:** 1920x1080 (Full HD)
- **Color Scheme:** Dark theme (#0D0D10) with teal accents (#14B8A6)
- **Font:** Space Grotesk

## Narration Script (Charlotte Voice)

1. **Intro (0-3.5s):** "Introducing Neurogut - your gut-brain wellness companion."
2. **Protocols (3.5-11.5s):** "Record your gut sounds with three simple protocols..."
3. **Context (11.5-17.5s):** "Before each recording, tag your context..."
4. **Motility (17.5-25.5s):** "After recording, see your personal Motility Index..."
5. **Insights (25.5-33.5s):** "As you track consistently, unlock AI-powered insights..."
6. **Symptoms (33.5-38.5s):** "Track daily symptoms too..."
7. **Outro (38.5-45s):** "Neurogut. Listen to your gut."

## Project Structure

```
neurogut-demo/
├── src/
│   ├── Root.tsx              # Composition registration
│   ├── NeurogutDemo.tsx      # Main video component
│   ├── index.ts              # Entry point
│   ├── index.css             # Tailwind + fonts
│   ├── utils/
│   │   └── elevenlabs.ts     # ElevenLabs API integration
│   ├── scripts/
│   │   └── generate-voiceover.ts  # Script to generate audio
│   ├── components/
│   │   └── Voiceover.tsx    # Audio playback component
│   └── scenes/
│       ├── Intro.tsx         # App introduction
│       ├── ProtocolsScene.tsx # 3 protocols showcase
│       ├── ContextScene.tsx   # Context tagging
│       ├── MotilityScene.tsx # Motility Index + Timeline
│       ├── InsightsScene.tsx # AI insights
│       ├── SymptomsScene.tsx # Symptom tracking
│       └── Outro.tsx         # Closing
├── public/
│   └── audio/                # Generated voiceover files
└── out/                      # Rendered video output
```

## Notes

- The video uses smooth spring animations and interpolations
- All scenes are synchronized to Charlotte's narration timing
- Dark theme with teal accents creates a modern, health-focused aesthetic
- Space Grotesk font provides clean, professional typography
