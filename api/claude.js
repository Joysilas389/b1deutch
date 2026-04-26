// api/claude.js — Dual-AI Proxy: Claude primary, GPT-4o fallback
// Provider passed in request body as { provider: 'auto'|'claude'|'openai' }

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o';
const TIMEOUT_MS   = 25000;

function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function callClaude(apiKey, body) {
  const res = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model || CLAUDE_MODEL,
        max_tokens: body.max_tokens || 1000,
        system: body.system,
        messages: body.messages,
      }),
    },
    TIMEOUT_MS
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Claude ' + res.status + ': ' + err.slice(0, 200));
  }
  const data = await res.json();
  data._provider = 'claude';
  return data;
}

async function callOpenAI(apiKey, body) {
  // Build OpenAI messages from Claude format
  const messages = [];
  if (body.system) messages.push({ role: 'system', content: body.system });
  for (const m of (body.messages || [])) {
    messages.push({ role: m.role, content: m.content });
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
        max_tokens: body.max_tokens || 1000,
        messages,
        temperature: 0.7,
      }),
    },
    TIMEOUT_MS
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error('OpenAI ' + res.status + ': ' + err.slice(0, 200));
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  // Return in Claude response shape so frontend needs no changes
  return {
    id: data.id,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: OPENAI_MODEL,
    stop_reason: 'end_turn',
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
    _provider: 'openai',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_TTS_KEY;

  // Provider comes in the body — no custom headers needed
  const { provider = 'auto', ...body } = req.body;
  console.log('[AI Router] provider=' + provider + ' max_tokens=' + body.max_tokens);

  // ── CLAUDE ONLY ────────────────────────────────────────────────────────
  if (provider === 'claude') {
    if (!claudeKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server.', _provider: 'none' });
    }
    try {
      const data = await callClaude(claudeKey, body);
      console.log('[AI Router] Claude OK (manual)');
      return res.status(200).json(data);
    } catch (err) {
      console.error('[AI Router] Claude failed (manual):', err.message);
      return res.status(503).json({ error: 'Claude unavailable: ' + err.message, _provider: 'none' });
    }
  }

  // ── OPENAI ONLY ────────────────────────────────────────────────────────
  if (provider === 'openai') {
    if (!openaiKey) {
      return res.status(500).json({ error: 'OPENAI_TTS_KEY not configured on server.', _provider: 'none' });
    }
    try {
      const data = await callOpenAI(openaiKey, body);
      console.log('[AI Router] OpenAI OK (manual)');
      return res.status(200).json(data);
    } catch (err) {
      console.error('[AI Router] OpenAI failed (manual):', err.message);
      return res.status(503).json({ error: 'GPT-4o unavailable: ' + err.message, _provider: 'none' });
    }
  }

  // ── AUTO: Claude first → OpenAI fallback ──────────────────────────────
  if (claudeKey) {
    try {
      const data = await callClaude(claudeKey, body);
      console.log('[AI Router] Claude OK (auto)');
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[AI Router] Claude failed, trying OpenAI:', err.message);
    }
  } else {
    console.warn('[AI Router] No ANTHROPIC_API_KEY — skipping Claude');
  }

  if (openaiKey) {
    try {
      const data = await callOpenAI(openaiKey, body);
      console.log('[AI Router] OpenAI fallback OK (auto)');
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[AI Router] OpenAI also failed:', err.message);
    }
  } else {
    console.warn('[AI Router] No OPENAI_TTS_KEY — skipping OpenAI fallback');
  }

  // Both down
  console.error('[AI Router] Both providers failed');
  return res.status(503).json({
    error: 'Both Claude and GPT-4o are currently unreachable. Please try again in a moment.',
    _provider: 'none',
  });
}
