# Neurogut Demo Video - Quick Start

## 🎬 Remotion Studio URL

When you run `npm run dev`, Remotion Studio opens at:
**http://localhost:3001** (or check the terminal output for the exact port)

## 🔑 ElevenLabs API Key Setup

### Option 1: Environment Variable (PowerShell)
```powershell
$env:ELEVENLABS_API_KEY='your-api-key-here'
npm run generate-voiceover
```

### Option 2: .env File (Recommended)
1. Create `.env` file in `C:\code\neurogut-demo\`
2. Add: `ELEVENLABS_API_KEY=your-api-key-here`
3. Run: `npm run generate-voiceover`

### Where to Get/Manage API Keys
- **URL:** https://elevenlabs.io/app/settings/api-keys
- **Steps:**
  1. Go to the URL above
  2. Click **"Create API Key"** or edit existing
  3. Ensure **"Text to Speech"** permission is **enabled**
  4. Copy the key (starts with `sk_`)

## 🎤 Generate Voiceover

```bash
npm run generate-voiceover
```

This creates 7 audio files in `public/audio/`:
- `intro.mp3`
- `protocols.mp3`
- `context.mp3`
- `motility.mp3`
- `insights.mp3`
- `symptoms.mp3`
- `outro.mp3`

## 🎥 Preview Video

```bash
npm run dev
```

Opens Remotion Studio in your browser. You can:
- Scrub through the timeline
- Preview each scene
- Adjust timing/animations

## 🎬 Render Final Video

```bash
npm run render
```

Output: `out/neurogut-demo.mp4` (45 seconds, 1920x1080)

## 🐛 Troubleshooting

**"serialize binary: invalid int 32" error:**
- ✅ Fixed! Frame calculations now have validation
- Restart `npm run dev` if you see this error

**Blank/empty video:**
- Check that Remotion Studio is running
- Verify scenes are rendering (you should see content in the preview)
- Audio files are optional - video works without them

**API Key "missing_permissions":**
- Go to https://elevenlabs.io/app/settings/api-keys
- Create a NEW API key with "Text to Speech" enabled
- Old keys may have different permission structures

## 📁 Project Structure

```
neurogut-demo/
├── src/
│   ├── NeurogutDemo.tsx    # Main video (7 scenes)
│   ├── scenes/              # Individual scene components
│   └── utils/elevenlabs.ts  # API integration
├── public/audio/            # Generated voiceover files
└── out/                     # Rendered video
```
