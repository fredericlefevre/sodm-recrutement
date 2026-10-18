import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
export const statuses = ['À étudier', 'Entretien', 'Proposition', 'Recruté', 'Refusé'];

export function createApp({ dbPath = join(root, 'data/recrutement.sqlite'), demo = true, adminPassword = '' } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY, title TEXT NOT NULL, department TEXT NOT NULL,
      location TEXT NOT NULL, contract TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS candidates (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
      job_id INTEGER NOT NULL REFERENCES jobs(id), status TEXT NOT NULL DEFAULT 'À étudier', notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  if (!db.prepare("SELECT 1 FROM settings WHERE key = 'initialized'").get()) {
    db.exec('BEGIN');
    try {
      if (demo) {
        const job = db.prepare('INSERT INTO jobs (title, department, location, contract, description) VALUES (?, ?, ?, ?, ?)');
        job.run('Responsable des ressources humaines', 'Ressources humaines', 'Paris', 'CDI', 'Accompagner les équipes, piloter les recrutements et faire grandir notre culture d’entreprise.');
        job.run('Chargé·e de communication', 'Communication', 'Lyon · Hybride', 'CDI', 'Imaginer et déployer nos campagnes de communication, du premier concept à leur diffusion.');
        job.run('Assistant·e administratif·ve', 'Administration', 'Paris', 'CDD', 'Participer au suivi des dossiers et à l’organisation quotidienne des équipes.');
        const candidate = db.prepare('INSERT INTO candidates (name, email, job_id, status, notes) VALUES (?, ?, ?, ?, ?)');
        candidate.run('Camille Martin', 'camille@example.com', 1, 'Entretien', 'Profil de démonstration. Entretien à planifier avec l’équipe.');
        candidate.run('Thomas Bernard', 'thomas@example.com', 2, 'À étudier', 'Profil de démonstration.');
        candidate.run('Sarah Dubois', 'sarah@example.com', 1, 'Proposition', 'Profil de démonstration.');
        candidate.run('Lucas Petit', 'lucas@example.com', 3, 'À étudier', 'Profil de démonstration.');
        candidate.run('Emma Laurent', 'emma@example.com', 2, 'Recruté', 'Profil de démonstration.');
      }
      db.prepare('INSERT INTO settings VALUES (?, ?)').run('initialized', '1');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  async function body(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 65536) throw Object.assign(new Error('Formulaire trop volumineux.'), { status: 413 }); }
    try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Formulaire invalide.'), { status: 400 }); }
  }
  function field(data, key, max = 200, optional = false) {
    const value = typeof data?.[key] === 'string' ? data[key].trim() : '';
    if ((!optional && !value) || value.length > max) throw Object.assign(new Error(`Champ invalide : ${key}.`), { status: 400 });
    return value;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const adminRoute = url.pathname === '/' || url.pathname === '/api/data' || (url.pathname === '/api/logo' && req.method !== 'GET') || (url.pathname === '/api/jobs' && req.method !== 'GET') || (url.pathname.startsWith('/api/candidates/') && req.method !== 'POST');
      if (adminPassword && adminRoute) {
        const authorization = req.headers.authorization || '';
        const credentials = authorization.startsWith('Basic ') ? Buffer.from(authorization.slice(6), 'base64').toString() : '';
        const digest = value => createHash('sha256').update(value).digest();
        if (!timingSafeEqual(digest(credentials), digest(`admin:${adminPassword}`))) {
          res.setHeader('WWW-Authenticate', 'Basic realm="SODM recrutement", charset="UTF-8"');
          return json(res, 401, { error: 'Connexion administrateur requise.' });
        }
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return json(res, 403, { error: 'Origine non autorisée.' });
        if (url.pathname === '/api/logo' && req.method === 'GET') return json(res, 200, { configured: Boolean(db.prepare("SELECT 1 FROM settings WHERE key = 'logo'").get()) });
        if (url.pathname === '/api/logo' && req.method === 'PUT') {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 2 * 1024 * 1024) return json(res, 413, { error: 'Le logo doit peser moins de 2 Mo.' });
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks), mime = req.headers['content-type'];
          const valid = (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (mime === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) || (mime === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
          if (!valid) return json(res, 400, { error: 'Choisissez une image PNG, JPEG ou WebP valide.' });
          db.prepare("INSERT INTO settings (key, value) VALUES ('logo', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify({ mime, data: buffer.toString('base64') }));
          return json(res, 200, { ok: true });
        }
        if (req.method === 'GET' && url.pathname === '/api/jobs') return json(res, 200, db.prepare('SELECT * FROM jobs ORDER BY id DESC').all());
        if (req.method === 'GET' && url.pathname === '/api/data') return json(res, 200, {
          jobs: db.prepare('SELECT * FROM jobs ORDER BY id DESC').all(),
          candidates: db.prepare('SELECT c.*, j.title AS job_title FROM candidates c JOIN jobs j ON c.job_id = j.id ORDER BY c.id DESC').all(), statuses
        });
        if (req.method === 'POST' && url.pathname === '/api/jobs') {
          const data = await body(req);
          const values = ['title', 'department', 'location', 'contract'].map(k => field(data, k));
          if (!['CDI', 'CDD', 'Alternance', 'Stage', 'Freelance'].includes(values[3])) return json(res, 400, { error: 'Contrat invalide.' });
          const result = db.prepare('INSERT INTO jobs (title, department, location, contract, description) VALUES (?, ?, ?, ?, ?)').run(...values, field(data, 'description', 10000, true));
          return json(res, 201, { id: Number(result.lastInsertRowid) });
        }
        if (req.method === 'POST' && url.pathname === '/api/candidates') {
          const data = await body(req), name = field(data, 'name'), email = field(data, 'email', 254);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Adresse e-mail invalide.' });
          if (!Number.isSafeInteger(Number(data.job_id)) || !db.prepare('SELECT id FROM jobs WHERE id = ?').get(Number(data.job_id))) return json(res, 400, { error: 'Sélectionnez une offre existante.' });
          const result = db.prepare('INSERT INTO candidates (name, email, job_id, notes) VALUES (?, ?, ?, ?)').run(name, email, Number(data.job_id), field(data, 'notes', 10000, true));
          return json(res, 201, { id: Number(result.lastInsertRowid) });
        }
        const match = url.pathname.match(/^\/api\/candidates\/(\d+)$/);
        if (req.method === 'PATCH' && match) {
          const data = await body(req), status = field(data, 'status');
          if (!statuses.includes(status)) return json(res, 400, { error: 'Statut invalide.' });
          const result = db.prepare('UPDATE candidates SET status = ?, notes = ? WHERE id = ?').run(status, field(data, 'notes', 10000, true), Number(match[1]));
          return json(res, result.changes ? 200 : 404, result.changes ? { ok: true } : { error: 'Candidature introuvable.' });
        }
        return json(res, 404, { error: 'Ressource introuvable.' });
      }
      if (url.pathname === '/logo' && ['GET', 'HEAD'].includes(req.method)) {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'logo'").get();
        if (!row) return json(res, 404, { error: 'Aucun logo importé.' });
        const logo = JSON.parse(row.value);
        res.writeHead(200, { 'Content-Type': logo.mime, 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? undefined : Buffer.from(logo.data, 'base64'));
      }
      const files = { '/': ['index.html', 'text/html'], '/carrieres': ['careers.html', 'text/html'], '/branding.js': ['branding.js', 'text/javascript'], '/careers.js': ['careers.js', 'text/javascript'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
      if (!files[url.pathname] || !['GET', 'HEAD'].includes(req.method)) return json(res, 404, { error: 'Page introuvable.' });
      const [file, mime] = files[url.pathname];
      res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : readFileSync(join(root, 'public', file)));
    } catch (error) { if (!error.status) console.error(error); json(res, error.status || 500, { error: error.status ? error.message : 'Une erreur interne est survenue.' }); }
  });
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const host = process.env.HOST || (process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1');
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD est requis pour une écoute hors de la machine locale.');
  const server = createApp({ dbPath: process.env.DB_PATH, demo: process.env.SEED_DEMO !== 'false', adminPassword: process.env.ADMIN_PASSWORD });
  server.listen(Number(process.env.PORT || 3000), host, () => console.log(`SODM Recrutement démarré sur ${server.address().address}, port ${server.address().port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
}
