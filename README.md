# 🎓 Sprechen — German Exam Prep Platform

**Live:** https://learndeutch.vercel.app  
**Stack:** HTML · Bootstrap 5.3.8 · Vanilla JS · Claude AI · Vercel Serverless

---

## 🧩 Four Learning Modules

| Module | Icon | Description |
|--------|------|-------------|
| **Sprechen** | 🎙 | AI podcast (Anna & Max) + 6 speaking challenges with AI grading |
| **Lesen** | 📖 | AI reading passages + comprehension questions + vocab extraction |
| **Schreiben** | ✍️ | AI writing prompts + model answers + AI feedback on your writing |
| **Hören** | 🎧 | AI listening scripts via TTS + comprehension questions |

---

## 🏛 Exam Standards
- **TELC** — offizielle Prüfungen
- **Goethe Institut** — Institut standard

## 📊 Levels
- **A2** — Basic (Grundstufe)
- **B1** — Intermediate (Mittelstufe)
- **B2** — Upper-Intermediate (Oberstufe)

---

## 🃏 Flashcard System
- **SM-2 Spaced Repetition** — scientifically proven memory algorithm
- **Synonyms** — every card includes German synonyms
- **Module filter** — study vocab by module (Sprechen/Lesen/Schreiben/Hören)
- **Clear & restart** — reset any deck for fresh revision
- **Again / Hard / Good / Easy** — 4-button rating system

---

## 🎭 Exam Atmosphere
- Animated exam room with 2 Examiners + 2 Students
- Characters glow and animate when speaking
- Realistic exam scenario feel for mental preparation

---

## 🗂 Project Structure

```
sprechen-v3/
├── index.html        ← Complete SPA (Bootstrap 5.3.8 + Claude AI)
├── api/
│   └── claude.js     ← Vercel serverless proxy (keeps API key secret)
├── vercel.json       ← Routing config
├── .gitignore
└── README.md
```

---

## 🚀 Deployment

### Environment Variable
Set in Vercel Dashboard → Project Settings → Environment Variables:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### Push to deploy
```bash
git add . && git commit -m "update" && git push
```
Vercel auto-deploys on every push to `main`.

---

## 🔧 Local Development
Open `index.html` directly will not work (API key needed).  
Use the live Vercel deployment for full functionality.

---

## 📱 Mobile First
- Designed for mobile (375px+)
- Bootstrap 5.3.8 responsive grid
- Fixed bottom nav (Home + Flashcards)
- Apple SF Pro font family
- Dark theme throughout
