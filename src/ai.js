// src/ai.js
// Returns hardcoded safety tips — no API key required

export async function getAISafetySuggestions(prompt) {
  return {
    choices: [{
      message: {
        content:
`1. 🌙 Stick to well-lit, busy streets at night — avoid shortcuts through alleys or parks.
2. 📍 Share your live location with a trusted contact before travelling alone.
3. 🎧 Keep one earbud out so you stay aware of your surroundings.
4. 🚕 Always verify the cab number plate matches the app before getting in.
5. 🆘 Trust your gut — if something feels wrong, leave immediately and call someone.`
      }
    }]
  };
}