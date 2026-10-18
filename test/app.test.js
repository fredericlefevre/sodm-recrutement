import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function start(options = {}) {
  const app = createApp({ dbPath: ':memory:', demo: false, ...options });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  return { app, request: (path, method = 'GET', body, headers = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), close: () => new Promise(resolve => app.close(resolve)) };
}
const job = { title: 'Développeur web', department: 'Informatique', location: 'Paris', contract: 'CDI', description: 'Construire nos outils.' };
test('le logo du dépôt apparaît sans import et reste disponible avec une base neuve', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sodm-brand-')), logoPath = join(directory, 'logo-sodm.png');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=', 'base64');
  writeFileSync(logoPath, png);
  let service;
  try {
    for (let run = 0; run < 2; run++) {
      service = await start({ logoPath, adminPassword: 'test-password' });
      assert.deepEqual(await (await service.request('/api/logo')).json(), { configured: true });
      const response = await service.request('/logo');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      await service.close(); service = null;
    }
  } finally { if (service) await service.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('le logo est réservé à l’équipe en écriture, public en lecture et conservé après redémarrage', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sodm-logo-')), dbPath = join(directory, 'test.sqlite');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=', 'base64');
  let service = await start({ dbPath, adminPassword: 'test-password' });
  const upload = (data, type, authenticated = true) => fetch(`http://127.0.0.1:${service.app.address().port}/api/logo`, { method: 'PUT', headers: { 'Content-Type': type, ...(authenticated ? { Authorization: 'Basic ' + Buffer.from('admin:test-password').toString('base64') } : {}) }, body: data });
  try {
    assert.deepEqual(await (await service.request('/api/logo')).json(), { configured: false });
    assert.equal((await upload(png, 'image/png', false)).status, 401);
    assert.equal((await upload('<svg></svg>', 'image/svg+xml')).status, 400);
    assert.equal((await upload('invalid', 'image/png')).status, 400);
    assert.equal((await upload(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png')).status, 413);
    assert.equal((await upload(png, 'image/png')).status, 200);
    await service.close(); service = await start({ dbPath, adminPassword: 'test-password' });
    assert.deepEqual(await (await service.request('/api/logo')).json(), { configured: true });
    const response = await service.request('/logo');
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  } finally { await service.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('le démarrage sur Render écoute sur 0.0.0.0 même sans variable HOST', { timeout: 10000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sodm-render-'));
  const env = { ...process.env, RENDER: 'true', PORT: '0', ADMIN_PASSWORD: 'test-only-password', SEED_DEMO: 'false', DB_PATH: join(directory, 'test.sqlite') };
  delete env.HOST;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/démarré sur 0\.0\.0\.0, port (\d+)/);
        if (match) resolve(Number(match[1]));
      });
      child.once('error', reject);
      child.once('exit', code => reject(new Error(`Le serveur s’est arrêté : ${code}`)));
      const timer = setTimeout(() => reject(new Error('Le serveur ne démarre pas sur 0.0.0.0.')), 5000);
      child.once('exit', () => clearTimeout(timer));
    });
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/jobs`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/data`)).status, 401);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
    rmSync(directory, { recursive: true, force: true });
  }
});
test('une offre publique reçoit une candidature et le recruteur fait avancer son statut', async () => {
  const service = await start();
  try {
    const created = await service.request('/api/jobs', 'POST', job); assert.equal(created.status, 201); const { id: job_id } = await created.json();
    const offers = await (await service.request('/api/jobs')).json(); assert.equal(offers[0].title, job.title);
    const application = await service.request('/api/candidates', 'POST', { name: 'Alice Test', email: 'alice@example.com', job_id, notes: 'Motivée.' });
    assert.equal(application.status, 201); const { id } = await application.json();
    let data = await (await service.request('/api/data')).json(); assert.equal(data.candidates[0].status, 'À étudier'); assert.equal(data.candidates[0].job_title, job.title);
    assert.equal((await service.request(`/api/candidates/${id}`, 'PATCH', { status: 'Entretien', notes: 'Rendez-vous vendredi.' })).status, 200);
    data = await (await service.request('/api/data')).json(); assert.equal(data.candidates[0].status, 'Entretien'); assert.equal(data.candidates[0].notes, 'Rendez-vous vendredi.');
    assert.equal((await service.request(`/api/candidates/${id}`, 'PATCH', { status: 'Inconnu' })).status, 400);
  } finally { await service.close(); }
});
test('les formulaires incorrects sont refusés sans créer de données', async () => {
  const service = await start();
  try {
    assert.equal((await service.request('/api/jobs', 'POST', { ...job, title: ' ' })).status, 400);
    assert.equal((await service.request('/api/jobs', 'POST', { ...job, contract: 'Invalide' })).status, 400);
    assert.equal((await service.request('/api/candidates', 'POST', { name: 'Alice', email: 'invalide', job_id: 1 })).status, 400);
    assert.equal((await service.request('/api/candidates', 'POST', { name: 'Alice', email: 'alice@example.com', job_id: 999 })).status, 400);
    assert.equal((await service.request('/api/jobs', 'POST', null)).status, 400);
    assert.deepEqual((await (await service.request('/api/data')).json()).candidates, []);
  } finally { await service.close(); }
});
test('la connexion protège les données internes et laisse les offres publiques accessibles', async () => {
  const password = 'test-only-password', service = await start({ adminPassword: password });
  try {
    assert.equal((await service.request('/')).status, 401);
    assert.equal((await service.request('/api/data')).status, 401);
    assert.equal((await service.request('/api/jobs', 'POST', job)).status, 401);
    assert.equal((await service.request('/api/candidates/1', 'PATCH', { status: 'Entretien' })).status, 401);
    assert.equal((await service.request('/api/data', 'GET', undefined, { Authorization: `Basic ${Buffer.from('admin:wrong').toString('base64')}` })).status, 401);
    assert.equal((await service.request('/api/data', 'GET', undefined, { Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}` })).status, 200);
    assert.equal((await service.request('/carrieres')).status, 200);
    assert.equal((await service.request('/api/jobs')).status, 200);
  } finally { await service.close(); }
});
test('les données survivent au redémarrage sans réinsérer les profils de démonstration', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sodm-test-')), dbPath = join(directory, 'test.sqlite');
  let service;
  try {
    service = await start({ dbPath, demo: true });
    assert.equal((await (await service.request('/api/data')).json()).candidates.length, 5);
    await service.request('/api/jobs', 'POST', job); await service.close(); service = null;
    service = await start({ dbPath, demo: true });
    const data = await (await service.request('/api/data')).json(); assert.equal(data.jobs.length, 4); assert.equal(data.candidates.length, 5);
  } finally { if (service) await service.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('les pages, les ressources et les erreurs HTTP sont servies correctement', async () => {
  const service = await start();
  try {
    for (const path of ['/', '/carrieres', '/app.js', '/careers.js', '/style.css', '/favicon.svg']) assert.equal((await service.request(path)).status, 200, path);
    const home = await service.request('/'); assert.match(await home.text(), /SODM/); assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await service.request('/api/missing')).status, 404);
    assert.equal((await service.request('/server.js')).status, 404);
    assert.equal((await service.request('/api/jobs', 'POST', job, { Origin: 'https://external.example' })).status, 403);
    assert.equal((await service.request('/api/jobs', 'POST', { ...job, description: 'a'.repeat(70000) })).status, 413);
  } finally { await service.close(); }
});
