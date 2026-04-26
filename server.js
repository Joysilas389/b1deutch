// Sprechen Local SQLite Server
// Run in Termux: node server.js
// Listens on http://localhost:3001

const http    = require('http');
const path    = require('path');
const fs      = require('fs');

// ── SQLite setup ──────────────────────────────────────────────────────────
let db;
try {
  const Database = require('better-sqlite3');
  const dbPath   = path.join(__dirname, 'sprechen.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Single key-value table — mirrors localStorage exactly
  db.exec(`
    CREATE TABLE IF NOT EXISTS store (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS backups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      data       TEXT NOT NULL
    );
  `);
  console.log('[Sprechen DB] SQLite ready at', dbPath);
} catch(e) {
  console.error('[Sprechen DB] SQLite error:', e.message);
  console.error('Run: npm install better-sqlite3');
  process.exit(1);
}

// ── Prepared statements ───────────────────────────────────────────────────
const stmtGet    = db.prepare('SELECT value FROM store WHERE key = ?');
const stmtSet    = db.prepare('INSERT OR REPLACE INTO store (key, value, updated_at) VALUES (?, ?, datetime("now"))');
const stmtDel    = db.prepare('DELETE FROM store WHERE key = ?');
const stmtAll    = db.prepare('SELECT key, value FROM store');
const stmtBackup = db.prepare('INSERT INTO backups (data) VALUES (?)');
const stmtGetBkp = db.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 10');

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
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, 'http://localhost:3001');
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') { cors(res); res.writeHead(200); res.end(); return; }

  // ── GET /ping — health check ──────────────────────────────────────────
  if (method === 'GET' && url.pathname === '/ping') {
    return json(res, { ok: true, db: 'sqlite', version: 1 });
  }

  // ── GET /store — get all keys ─────────────────────────────────────────
  if (method === 'GET' && url.pathname === '/store') {
    const rows = stmtAll.all();
    const result = {};
    rows.forEach(r => result[r.key] = r.value);
    return json(res, result);
  }

  // ── GET /store/:key — get one key ─────────────────────────────────────
  if (method === 'GET' && url.pathname.startsWith('/store/')) {
    const key = decodeURIComponent(url.pathname.slice(7));
    const row = stmtGet.get(key);
    if (!row) return json(res, { error: 'Not found' }, 404);
    return json(res, { key, value: row.value });
  }

  // ── POST /store — set one key ─────────────────────────────────────────
  if (method === 'POST' && url.pathname === '/store') {
    const body = await readBody(req);
    if (!body.key) return json(res, { error: 'Missing key' }, 400);
    stmtSet.run(body.key, body.value);
    return json(res, { ok: true, key: body.key });
  }

  // ── POST /store/bulk — set multiple keys at once ──────────────────────
  if (method === 'POST' && url.pathname === '/store/bulk') {
    const body = await readBody(req);
    const setBulk = db.transaction((entries) => {
      entries.forEach(([k, v]) => stmtSet.run(k, v));
    });
    setBulk(Object.entries(body));
    return json(res, { ok: true, count: Object.keys(body).length });
  }

  // ── DELETE /store/:key — delete one key ───────────────────────────────
  if (method === 'DELETE' && url.pathname.startsWith('/store/')) {
    const key = decodeURIComponent(url.pathname.slice(7));
    stmtDel.run(key);
    return json(res, { ok: true });
  }

  // ── POST /backup — create a named backup ─────────────────────────────
  if (method === 'POST' && url.pathname === '/backup') {
    const rows = stmtAll.all();
    const data = {};
    rows.forEach(r => data[r.key] = r.value);
    stmtBackup.run(JSON.stringify({ exportedAt: new Date().toISOString(), data }));
    return json(res, { ok: true, keys: rows.length });
  }

  // ── GET /backups — list recent backups ────────────────────────────────
  if (method === 'GET' && url.pathname === '/backups') {
    const backups = stmtGetBkp.all();
    return json(res, backups.map(b => ({ id: b.id, created_at: b.created_at })));
  }

  json(res, { error: 'Not found' }, 404);
});

const PORT = 3001;
server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Sprechen SQLite Server Running      ║');
  console.log('║   http://localhost:' + PORT + '               ║');
  console.log('║   Database: sprechen.db               ║');
  console.log('║   Press Ctrl+C to stop                ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Sprechen DB] Closing database...');
  db.close();
  process.exit(0);
});
