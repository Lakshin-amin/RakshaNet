export default async function handler(req, res) {

 
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing API Key" });
    }

    
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    
    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
