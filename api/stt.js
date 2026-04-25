// api/stt.js — OpenAI Whisper Speech-to-Text Proxy
// Accepts audio blob, returns transcript in German

import { IncomingForm } from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_TTS_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_TTS_KEY not set.' });

  try {
    // Parse multipart form data
    const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true });
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const audioFile = files.audio?.[0] || files.audio;
    if (!audioFile) return res.status(400).json({ error: 'No audio file received' });

    const filePath = audioFile.filepath || audioFile.path;

    // Send to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'de'); // German
    formData.append('response_format', 'json');

    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch(e) {}

    if (!upstream.ok) {
      const err = await upstream.json();
      return res.status(upstream.status).json(err);
    }

    const data = await upstream.json();
    return res.status(200).json({ transcript: data.text || '' });
  } catch (err) {
    console.error('STT error:', err);
    return res.status(500).json({ error: err.message });
  }
}
