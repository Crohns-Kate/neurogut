# ElevenLabs API Key Setup Guide

## Where to Manage API Keys

**Direct URL:** https://elevenlabs.io/app/settings/api-keys

**Steps:**
1. Go to https://elevenlabs.io
2. Sign in
3. Click your profile icon (top right)
4. Go to **Settings** → **API Keys** (or use the direct link above)

## Creating a New API Key

1. On the API Keys page, click **"Add API Key"** or **"Create New Key"**
2. Give it a name (e.g., "Neurogut Demo")
3. **IMPORTANT:** Check the **"Text to Speech"** permission checkbox
4. Click **"Create"** or **"Save"**
5. **Copy the key immediately** (you won't see it again!)

## Testing Your API Key

Run this test script:

```powershell
cd C:\code\neurogut-demo
$env:ELEVENLABS_API_KEY='your-key-here'
npx tsx src/scripts/test-api-key.ts
```

If it works, you'll see: `✅ SUCCESS! Generated X bytes of audio`

## Common Issues

### "missing_permissions" / "text_to_speech"
- **Fix:** Create a NEW API key with "Text to Speech" enabled
- Old keys may have been created before permissions were granular
- New keys have explicit permission checkboxes

### "Unauthorized" (401)
- Check that your key starts with `sk_`
- Make sure there's no extra whitespace
- Try creating a fresh key

### Key Not Working
- Regenerate the key at https://elevenlabs.io/app/settings/api-keys
- Ensure "Text to Speech" is checked when creating
- Use the test script to verify before generating voiceover

## Using the Key

**Option 1: Environment Variable (PowerShell)**
```powershell
$env:ELEVENLABS_API_KEY='sk_your-key-here'
npm run generate-voiceover
```

**Option 2: .env File (Recommended)**
1. Create `.env` in `C:\code\neurogut-demo\`
2. Add: `ELEVENLABS_API_KEY=sk_your-key-here`
3. Run: `npm run generate-voiceover`

**⚠️ Never commit `.env` to git!**
