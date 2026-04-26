// Sprechen Local SQLite Server for Termux
// Uses sql.js — pure JavaScript, no compilation needed
// Setup: npm install sql.js express
// Run:   node server.js

const http = require('http');
const path = require('path');
const fs   = require('fs');

const DB_FILE = path.join(__dirname, 'sprechen.db.json');

// ── Simple JSON file database (works everywhere, no native deps) ──────────
// We use a JSON file instead of binary SQLite since sql.js has issues too.
// This is just as persistent, just as reliable, and works on all platforms.

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch(e) { console.warn('DB load error:', e.message); }
  return { store: {}, backups: [], updatedAt: null };
}

function saveDB(db) {
  try {
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch(e) { console.error('DB save error:', e.message); }
}

let DB = loadDB();
console.log('[Sprechen DB] Loaded', Object.keys(DB.store).length, 'keys from', DB_FILE);

// Auto-save every 30 seconds
setInterval(() => saveDB(DB), 30000);

// ── HTTP Server ───────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status=200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch(e) { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, 'http://localhost:3001');
  const method = req.method;

  if (method === 'OPTIONS') { cors(res); res.writeHead(200); res.end(); return; }

  // GET /ping
  if (method === 'GET' && url.pathname === '/ping') {
    return json(res, { ok: true, db: 'json-file', keys: Object.keys(DB.store).length, version: 1 });
  }

  // GET /store — get all keys
  if (method === 'GET' && url.pathname === '/store') {
    return json(res, DB.store);
  }

  // GET /store/:key
  if (method === 'GET' && url.pathname.startsWith('/store/')) {
    const key = decodeURIComponent(url.pathname.slice(7));
    if (!(key in DB.store)) return json(res, { error: 'Not found' }, 404);
    return json(res, { key, value: DB.store[key] });
  }

  // POST /store — set one key
  if (method === 'POST' && url.pathname === '/store') {
    const body = await readBody(req);
    if (!body.key) return json(res, { error: 'Missing key' }, 400);
    DB.store[body.key] = body.value;
    saveDB(DB);
    return json(res, { ok: true });
  }

  // POST /store/bulk — set many keys at once
  if (method === 'POST' && url.pathname === '/store/bulk') {
    const body = await readBody(req);
    Object.assign(DB.store, body);
    saveDB(DB);
    return json(res, { ok: true, count: Object.keys(body).length });
  }

  // DELETE /store/:key
  if (method === 'DELETE' && url.pathname.startsWith('/store/')) {
    const key = decodeURIComponent(url.pathname.slice(7));
    delete DB.store[key];
    saveDB(DB);
    return json(res, { ok: true });
  }

  // POST /backup — snapshot
  if (method === 'POST' && url.pathname === '/backup') {
    const snapshot = {
      createdAt: new Date().toISOString(),
      data: { ...DB.store }
    };
    DB.backups.unshift(snapshot);
    if (DB.backups.length > 30) DB.backups = DB.backups.slice(0, 30); // keep 30
    saveDB(DB);
    return json(res, { ok: true, keys: Object.keys(DB.store).length });
  }

  // GET /backups
  if (method === 'GET' && url.pathname === '/backups') {
    return json(res, DB.backups.map(b => ({ createdAt: b.createdAt, keys: Object.keys(b.data).length })));
  }

  json(res, { error: 'Not found' }, 404);
});

const PORT = 3001;
server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Sprechen DB Server Running          ║');
  console.log('║   http://localhost:' + PORT + '               ║');
  console.log('║   File: sprechen.db.json              ║');
  console.log('║   Press Ctrl+C to stop                ║');
  console.log('╚═══════════════════════════════════════╝');
});

process.on('SIGINT', () => {
  console.log('\n[Sprechen DB] Saving and closing...');
  saveDB(DB);
  process.exit(0);
});
