// api/claude.js — Streaming Dual-AI Proxy
// Claude primary, GPT-4o fallback — streams via SSE

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o';

async function streamClaude(apiKey, body, res) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: body.model || CLAUDE_MODEL,
      max_tokens: body.max_tokens || 2000,
      system: body.system,
      messages: body.messages,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    throw new Error('Claude ' + upstream.status + ': ' + err.slice(0, 300));
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const evt = JSON.parse(data);
        if (evt.type === 'content_block_delta' && evt.delta?.text) {
          fullText += evt.delta.text;
          res.write('data: ' + JSON.stringify({ delta: evt.delta.text, provider: 'claude' }) + '\n\n');
        }
        if (evt.type === 'message_stop') {
          res.write('data: ' + JSON.stringify({ done: true, text: fullText, provider: 'claude' }) + '\n\n');
        }
      } catch(e) {}
    }
  }
  res.end();
}

async function streamOpenAI(apiKey, body, res) {
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  for (const m of (body.messages || [])) {
    messages.push({ role: m.role, content: m.content });
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: body.max_tokens || 2000,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    throw new Error('OpenAI ' + upstream.status + ': ' + err.slice(0, 300));
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      if (data === '[DONE]') {
        res.write('data: ' + JSON.stringify({ done: true, text: fullText, provider: 'openai' }) + '\n\n');
        continue;
      }
      try {
        const evt = JSON.parse(data);
        const delta = evt.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          res.write('data: ' + JSON.stringify({ delta, provider: 'openai' }) + '\n\n');
        }
      } catch(e) {}
    }
  }
  res.end();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_TTS_KEY;
  const { provider = 'auto', ...body } = req.body;

  function sendError(msg) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.write('data: ' + JSON.stringify({ error: msg, provider: 'none' }) + '\n\n');
    res.end();
  }

  if (provider === 'claude') {
    if (!claudeKey) return sendError('ANTHROPIC_API_KEY not configured.');
    try { await streamClaude(claudeKey, body, res); } 
    catch(err) { sendError('Claude unavailable: ' + err.message); }
    return;
  }

  if (provider === 'openai') {
    if (!openaiKey) return sendError('OPENAI_TTS_KEY not configured.');
    try { await streamOpenAI(openaiKey, body, res); }
    catch(err) { sendError('GPT-4o unavailable: ' + err.message); }
    return;
  }

  // AUTO — Claude first, OpenAI fallback
  if (claudeKey) {
    try { await streamClaude(claudeKey, body, res); return; }
    catch(err) { console.warn('[AI Router] Claude failed:', err.message); }
  }
  if (openaiKey) {
    try { await streamOpenAI(openaiKey, body, res); return; }
    catch(err) { console.warn('[AI Router] OpenAI failed:', err.message); }
  }
  sendError('Both Claude and GPT-4o are unreachable. Please try again.');
}
