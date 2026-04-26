// api/claude.js — Smart Dual-AI Proxy with Automatic Fallback
// Primary:  Anthropic Claude (claude-sonnet-4-20250514)
// Fallback: OpenAI GPT-4o
// Keys: ANTHROPIC_API_KEY and OPENAI_TTS_KEY (reused for GPT-4o chat)

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o';
const TIMEOUT_MS   = 10000; // 10s before trying fallback

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
  // Reformat to match Claude response shape exactly — frontend never changes
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_TTS_KEY;
  const { model, max_tokens, system, messages } = req.body;

  // Attempt 1: Claude (primary)
  if (claudeKey) {
    try {
      const data = await callClaude(claudeKey, { model, max_tokens, system, messages });
      console.log('[AI Router] Claude OK');
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[AI Router] Claude failed:', err.message, '— trying OpenAI');
    }
  }

  // Attempt 2: OpenAI GPT-4o (fallback)
  if (openaiKey) {
    try {
      const data = await callOpenAI(openaiKey, { max_tokens, system, messages });
      console.log('[AI Router] OpenAI GPT-4o fallback OK');
      return res.status(200).json(data);
    } catch (err) {
      console.warn('[AI Router] OpenAI also failed:', err.message);
    }
  }

  // Both down
  return res.status(503).json({
    error: 'AI temporarily unavailable. Both Claude and OpenAI are unreachable. Please try again shortly.',
    _provider: 'none',
  });
}
