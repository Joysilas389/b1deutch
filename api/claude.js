// api/claude.js — Smart Dual-AI Proxy with Manual Override + Auto Fallback
// Primary:  Anthropic Claude
// Fallback: OpenAI GPT-4o
// Header x-ai-provider: 'auto' | 'claude' | 'openai'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o';
const TIMEOUT_MS   = 10000;

function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function callClaude(apiKey, { model, max_tokens, system, messages }) {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: model || CLAUDE_MODEL, max_tokens, system, messages }),
    },
    TIMEOUT_MS
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error('Claude ' + res.status + ': ' + JSON.stringify(err));
  }
  const data = await res.json();
  data._provider = 'claude';
  return data;
}

async function callOpenAI(apiKey, { max_tokens, system, messages }) {
  const openaiMessages = [];
  if (system) openaiMessages.push({ role: 'system', content: system });
  for (const msg of messages) {
    openaiMessages.push({ role: msg.role, content: msg.content });
  }
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: max_tokens || 1000,
        messages: openaiMessages,
        temperature: 0.7,
      }),
    },
    TIMEOUT_MS
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error('OpenAI ' + res.status + ': ' + JSON.stringify(err));
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return {
    id: data.id,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: OPENAI_MODEL,
    stop_reason: data.choices?.[0]?.finish_reason || 'end_turn',
    usage: {
      input_tokens:  data.usage?.prompt_tokens     || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
    _provider: 'openai',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ai-provider');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const claudeKey  = process.env.ANTHROPIC_API_KEY;
  const openaiKey  = process.env.OPENAI_TTS_KEY;
  const { model, max_tokens, system, messages } = req.body;

  // Read user preference from header — default to 'auto'
  const preference = (req.headers['x-ai-provider'] || 'auto').toLowerCase();
  console.log('[AI Router] Provider preference:', preference);

  // ── CLAUDE ONLY ──────────────────────────────────────────────────────────
  if (preference === 'claude') {
    if (!claudeKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.', _provider: 'none' });
    try {
      const data = await callClaude(claudeKey, { model, max_tokens, system, messages });
      console.log('[AI Router] Claude OK (manual)');
      return res.status(200).json(data);
    } catch (err) {
      console.error('[AI Router] Claude failed (manual, no fallback):', err.message);
      return res.status(503).json({ error: 'Claude is currently unavailable: ' + err.message, _provider: 'none' });
    }
  }

  // ── OPENAI ONLY ──────────────────────────────────────────────────────────
  if (preference === 'openai') {
    if (!openaiKey) return res.status(500).json({ error: 'OPENAI_TTS_KEY not set.', _provider: 'none' });
    try {
      const data = await callOpenAI(openaiKey, { max_tokens, system, messages });
      console.log('[AI Router] OpenAI OK (manual)');
      return res.status(200).json(data);
    } catch (err) {
      console.error('[AI Router] OpenAI failed (manual, no fallback):', err.message);
      return res.status(503).json({ error: 'GPT-4o is currently unavailable: ' + err.message, _provider: 'none' });
    }
  }

  // ── AUTO: Claude first → OpenAI fallback ─────────────────────────────────
  if (claudeKey) {
    try {
      const data = await callClaude(claudeKey, { model, max_tokens, system, messages });
      console.log('[AI Router] Claude OK (auto)');
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[AI Router] Claude failed, switching to GPT-4o:', err.message);
    }
  }

  if (openaiKey) {
    try {
      const data = await callOpenAI(openaiKey, { max_tokens, system, messages });
      console.log('[AI Router] GPT-4o fallback OK (auto)');
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[AI Router] GPT-4o also failed:', err.message);
    }
  }

  // Both down
  console.error('[AI Router] Both providers unavailable');
  return res.status(503).json({
    error: 'AI temporarily unavailable. Both Claude and GPT-4o are unreachable. Please try again shortly.',
    _provider: 'none',
  });
}
