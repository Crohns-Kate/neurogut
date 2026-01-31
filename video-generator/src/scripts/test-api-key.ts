/**
 * Test script to verify ElevenLabs API key
 * Run: npx tsx src/scripts/test-api-key.ts
 */

import "dotenv/config";

const apiKey = (process.env.ELEVENLABS_API_KEY ?? "").trim();

if (!apiKey) {
  console.error("Error: ELEVENLABS_API_KEY not set");
  process.exit(1);
}

console.log("Testing ElevenLabs API key...");
console.log(`Key (first 10 chars): ${apiKey.substring(0, 10)}...`);

// Test with a simple request
const testText = "Hello, this is a test.";
const voiceId = "XB0fDUnXU5powFXDhCwa"; // Charlotte

fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: "POST",
  headers: {
    Accept: "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": apiKey,
  },
  body: JSON.stringify({
    text: testText,
    model_id: "eleven_multilingual_v2",
  }),
})
  .then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ API Error (${response.status}):`);
      console.error(JSON.parse(errorText));
      
      if (response.status === 401) {
        console.error("\n💡 Possible fixes:");
        console.error("1. Check your API key at: https://elevenlabs.io/app/settings/api-keys");
        console.error("2. Ensure 'Text to Speech' permission is enabled");
        console.error("3. Try creating a NEW API key (old keys may have different permissions)");
        console.error("4. Make sure you're using the full key (starts with 'sk_')");
      }
      process.exit(1);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`\n✅ SUCCESS! Generated ${arrayBuffer.byteLength} bytes of audio`);
    console.log("Your API key is working correctly!");
  })
  .catch((error) => {
    console.error("\n❌ Network/Request Error:", error.message);
    process.exit(1);
  });
