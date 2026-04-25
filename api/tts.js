// api/tts.js — OpenAI TTS Proxy
// Keeps OPENAI_TTS_KEY secret on server, never exposed to browser

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_TTS_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_TTS_KEY not set on server.' });

  try {
    const { text, voice, speed } = req.body;
    // Anna = nova (warm female), Max = onyx (deep male)
    // Examiner1 = shimmer (clear female), Examiner2 = echo (male)
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',       // higher quality for better German pronunciation
        input: text,
        voice: voice || 'nova',  // nova | onyx | shimmer | echo | alloy | fable
        speed: speed || 1.0,     // 0.25 - 4.0
        response_format: 'mp3',
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(upstream.status).json(err);
    }

    // Stream audio back to browser
    const audioBuffer = await upstream.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
