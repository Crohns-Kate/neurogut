# How to Set Up ElevenLabs API Key

## ✅ Quick Setup (Already Done!)

I've created a `.env` file in `C:\code\neurogut-demo\` with your API key.

## 🔑 To Change or Update Your API Key

### Option 1: Edit .env File (Easiest)
1. Open `C:\code\neurogut-demo\.env` in any text editor
2. Replace the API key value:
   ```
   ELEVENLABS_API_KEY=your-new-api-key-here
   ```
3. Save the file

### Option 2: PowerShell Environment Variable (Temporary)
```powershell
cd C:\code\neurogut-demo
$env:ELEVENLABS_API_KEY='your-api-key-here'
npm run generate-voiceover
```

## 📍 Where to Get/Manage API Keys

**URL:** https://elevenlabs.io/app/settings/api-keys

**Steps:**
1. Go to the URL above
2. Click **"Create API Key"** button (or edit existing)
3. **Enable "Text to Speech" permission** (important!)
4. Copy the key (starts with `sk_`)
5. Paste it in the `.env` file

## 🎤 Generate Voiceover

Once your API key is set in `.env`:

```powershell
cd C:\code\neurogut-demo
npm run generate-voiceover
```

This will create 7 audio files in `public/audio/`:
- `intro.mp3`
- `protocols.mp3`
- `context.mp3`
- `motility.mp3`
- `insights.mp3`
- `symptoms.mp3`
- `outro.mp3`

## ⚠️ Important Notes

- **Never commit `.env` to git** - it contains your secret API key
- The `.env` file is already in `.gitignore` (safe)
- If you get "missing_permissions" error, create a NEW API key with Text to Speech enabled
