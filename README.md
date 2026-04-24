# 🎙 Sprechen v3 — German Fluency Engine

**A2 → B1 German learning app** featuring AI podcast conversations between Anna & Max,
spaced repetition flashcards (SM-2), and AI-graded speaking tests.

---

## Project Structure

```
sprechen-v3/
├── index.html          ← Complete single-page app (HTML + CSS + JS)
├── api/
│   └── claude.js       ← Vercel serverless proxy (API key stays server-side)
├── vercel.json         ← Vercel routing config
├── .gitignore          ← Keeps .env out of git
└── README.md
```

---

## 🔑 API Key — Environment Variable (NEVER in code)

The API key is stored exclusively in Vercel's environment — never in any file.

### Step 1 — Deploy first (see below), then add the key in Vercel Dashboard:
```
vercel.com → Your Project → Settings → Environment Variables
```
Add:
- **Name:** `ANTHROPIC_API_KEY`
- **Value:** `sk-ant-...your key...`
- **Environments:** ✅ Production  ✅ Preview  ✅ Development

Then redeploy once:
```bash
vercel --prod
```

### Local development in Termux:
Create a `.env` file (already in `.gitignore`):
```
ANTHROPIC_API_KEY=sk-ant-...your key...
```
Run locally:
```bash
vercel dev   # starts http://localhost:3000
```

---

## 🚀 Deploy from Termux — Step by Step

### First time only:
```bash
pkg install nodejs
npm install -g vercel
vercel login
# Enter: joysilas389@gmail.com
```

### Deploy:
```bash
cd ~/sprechen-v3
vercel          # first deploy (asks setup questions)
vercel --prod   # production deploy
```

### Redeploy after changes:
```bash
vercel --prod
```

---

## 📤 Push to GitHub from Termux

```bash
cd ~/sprechen-v3
git init
git add .
git commit -m "feat: Sprechen v3 - animated characters, SM-2 flashcards, longer podcasts"
git remote add origin https://github.com/Joysilas389/b1deutch.git
git branch -M main
git push -u origin main
# Password prompt → paste your Personal Access Token
```

---

## 🐍 Should You Add a Python Backend?

**Short answer: Yes, later — here's why and when.**

### What you have now (works great):
- Static HTML + Vercel serverless function (Node.js)
- No database — all data lives in browser memory
- Cost: $0/month

### What Python (FastAPI) adds:

| Feature | Without Python | With Python |
|---|---|---|
| Save podcasts across sessions | ❌ Lost on refresh | ✅ Persists forever |
| User accounts / login | ❌ | ✅ |
| SR card progress saved | ❌ Lost on refresh | ✅ Synced to server |
| Real speech recognition | Browser TTS only | ✅ Whisper AI (much better) |
| Audio generation | Browser TTS | ✅ ElevenLabs / OpenAI TTS (real voices) |
| Multiple users | ❌ | ✅ |
| Usage analytics | ❌ | ✅ |

### When to add Python backend:
- When you want data to **persist between sessions**
- When you want **real AI voices** (ElevenLabs/OpenAI TTS) instead of browser TTS
- When you want **real speech recognition** (OpenAI Whisper instead of browser API)
- When you want multiple users / accounts

### How to add it (future step):
```
sprechen-v3/
├── backend/           ← NEW: Python FastAPI
│   ├── main.py        ← API routes
│   ├── models.py      ← Pydantic schemas
│   ├── db.py          ← SQLite / PostgreSQL
│   └── requirements.txt
├── index.html
├── api/claude.js      ← Keep for Vercel
└── vercel.json
```

Deploy backend to **Render.com** (free tier):
```bash
# backend/requirements.txt
fastapi
uvicorn
anthropic
sqlalchemy
python-dotenv
```

```python
# backend/main.py (minimal example)
from fastapi import FastAPI
from anthropic import Anthropic

app = FastAPI()
client = Anthropic()  # reads ANTHROPIC_API_KEY from env

@app.post("/api/generate-podcast")
async def generate(req: dict):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        messages=[{"role": "user", "content": req["prompt"]}]
    )
    return {"content": response.content[0].text}
```

---

## Podcast Durations

| Setting | Target | Dialogue turns |
|---|---|---|
| Short  | ~12 minutes | 22 turns |
| Medium | ~20 minutes | 36 turns |
| Long   | ~30 minutes | 54 turns |

Each turn ≈ 30–35 seconds of natural spoken German.

---

## Flashcard System (SM-2 Algorithm)

The app uses the same algorithm as **Anki** — the world's most popular spaced repetition tool.

| Rating | Quality | Next Review |
|---|---|---|
| Again | 1 | 10 minutes |
| Hard  | 2 | 1 day |
| Good  | 4 | Calculated (×ease factor) |
| Easy  | 5 | Longer interval |

**Ease Factor** starts at 2.5 and adjusts per card. Cards you know well get reviewed less often. Cards you struggle with come back sooner.

**Progress rings** on each card show how many successful repetitions you've completed (0-5).

---

## Features Summary

- ✅ AI podcast generation (22–54 dialogue turns)
- ✅ Animated Anna & Max characters with speaking glow, mouth animation, sound waves
- ✅ Distinct male/female voices (browser TTS)
- ✅ Subtitle with translation toggle
- ✅ Speed control: 0.75× 1× 1.25× 1.5×
- ✅ Full dialogue scrollable script
- ✅ 6 AI-graded speaking challenges per podcast
- ✅ 10–14 vocabulary cards per podcast
- ✅ SM-2 spaced repetition with Again/Hard/Good/Easy ratings
- ✅ Progress ring per card (0–5 repetitions)
- ✅ Session stats (correct/total this session)
- ✅ Streak counter
- ✅ Deck filtering by podcast
- ✅ Word list view with due status badges
- ✅ API key server-side only (Vercel env var)
- ✅ SF Pro / system font throughout
- ✅ English UI, German learning content
