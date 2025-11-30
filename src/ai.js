export async function getAISafetySuggestions(prompt) {
  try {
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    return await res.json();

  } catch (err) {
    return { error: err.message };
  }
}
