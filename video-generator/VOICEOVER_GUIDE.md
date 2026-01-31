# ElevenLabs Voiceover Generation Guide

## Step 1: Get Your API Key

1. Sign up at https://elevenlabs.io
2. Go to **Profile → API Keys**: https://elevenlabs.io/app/settings/api-keys
3. **Create** a new API key (or edit existing) and ensure **"Text to Speech"** permission is **enabled**
4. Copy the key. (If you get `missing_permissions` / `text_to_speech`, the key doesn’t have that permission.)

## Step 2: Set Environment Variable

**PowerShell:**
```powershell
$env:ELEVENLABS_API_KEY='your-api-key-here'
```

**Command Prompt:**
```cmd
set ELEVENLABS_API_KEY=your-api-key-here
```

## Step 3: Generate Audio Files

```bash
npm run generate-voiceover
```

This will:
- Generate 7 audio files (one for each narration segment)
- Use Charlotte voice (Australian female) - voice_id: XB0fDUnXU5powFXDhCwa
- Save files to `public/audio/` directory:
  - `intro.mp3`
  - `protocols.mp3`
  - `context.mp3`
  - `motility.mp3`
  - `insights.mp3`
  - `symptoms.mp3`
  - `outro.mp3`

## Step 4: Combine Audio Files (Optional)

You can combine all segments into one file using ffmpeg:

```bash
ffmpeg -i public/audio/intro.mp3 -i public/audio/protocols.mp3 -i public/audio/context.mp3 -i public/audio/motility.mp3 -i public/audio/insights.mp3 -i public/audio/symptoms.mp3 -i public/audio/outro.mp3 -filter_complex "[0:0][1:0][2:0][3:0][4:0][5:0][6:0]concat=n=7:v=0:a=1[out]" -map "[out]" public/audio/full-narration.mp3
```

## Step 5: Add Audio to Video

1. If using combined file, update `src/NeurogutDemo.tsx`:
   ```tsx
   <Audio
     src="/audio/full-narration.mp3"
     volume={1}
   />
   ```

2. Or use individual segments with Sequence timing (already configured in the code)

## Charlotte Voice Settings

- **Voice ID:** XB0fDUnXU5powFXDhCwa
- **Model:** eleven_multilingual_v2
- **Stability:** 0.5 (balanced)
- **Similarity Boost:** 0.75 (high voice match)
- **Style:** 0.0 (neutral)
- **Speaker Boost:** true (enhanced clarity)

## Narration Timing

All timings are synchronized in `src/utils/elevenlabs.ts`:
- Intro: 0-3.5s
- Protocols: 3.5-11.5s
- Context: 11.5-17.5s
- Motility: 17.5-25.5s
- Insights: 25.5-33.5s
- Symptoms: 33.5-38.5s
- Outro: 38.5-45s

Total: 45 seconds
