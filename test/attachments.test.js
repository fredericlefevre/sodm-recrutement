import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
const credentials = { Authorization: 'Basic ' + Buffer.from('admin:test-password').toString('base64') };
async function start(options = {}) {
  const app = createApp({ dbPath: ':memory:', demo: true, adminPassword: 'test-password', ...options });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  return { request: (path, options) => fetch(base + path, options), close: () => new Promise(resolve => app.close(resolve)) };
}
function application(file = pdf, name = 'CV Élodie.pdf') {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Élodie Test', email: 'elodie@example.com', job_id: '1', notes: 'Ma candidature.' })) form.set(key, value);
  if (file !== null) form.set('cv', new Blob([file]), name);
  return form;
}

test('CV public et document interne : téléchargement privé, octets conservés et persistance', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sodm-files-')), dbPath = join(directory, 'test.sqlite');
  let service = await start({ dbPath });
  try {
    const response = await service.request('/api/applications', { method: 'POST', body: application() });
    assert.equal(response.status, 201); const { id } = await response.json();
    const route = `/api/candidates/${id}/attachments`;
    assert.equal((await service.request(route)).status, 401);
    let files = await (await service.request(route, { headers: credentials })).json();
    assert.equal(files.length, 1); assert.equal(files[0].name, 'CV Élodie.pdf'); assert.equal(files[0].size, pdf.length);
    const download = `/api/attachments/${files[0].id}`;
    assert.equal((await service.request(download)).status, 401);
    const authenticated = await service.request(download, { headers: credentials });
    assert.equal(authenticated.headers.get('content-type'), 'application/octet-stream');
    assert.equal(authenticated.headers.get('cache-control'), 'no-store');
    assert.match(authenticated.headers.get('content-disposition'), /attachment; filename\*=UTF-8''CV%20%C3%89lodie.pdf/);
    assert.deepEqual(Buffer.from(await authenticated.arrayBuffer()), pdf);
    const form = new FormData(); form.set('file', new Blob([pdf]), 'Lettre.pdf');
    assert.equal((await service.request(route, { method: 'POST', body: form })).status, 401);
    assert.equal((await service.request(route, { method: 'POST', headers: credentials, body: form })).status, 201);
    await service.close(); service = await start({ dbPath });
    files = await (await service.request(route, { headers: credentials })).json(); assert.equal(files.length, 2);
    assert.deepEqual(Buffer.from(await (await service.request(download, { headers: credentials })).arrayBuffer()), pdf);
  } finally { await service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('les fichiers invalides ou trop lourds ne créent pas de candidature partielle', async () => {
  const service = await start();
  try {
    for (const [content, name, expected] of [
      ['<script>alert(1)</script>', 'CV.pdf', 400],
      ['test', 'CV.exe', 400],
      [Buffer.alloc(0), 'CV.pdf', 400],
      [Buffer.alloc(5 * 1024 * 1024 + 1), 'CV.pdf', 413],
    ]) {
      assert.equal((await service.request('/api/applications', { method: 'POST', body: application(content, name) })).status, expected, name);
    }
    const data = await (await service.request('/api/data', { headers: credentials })).json();
    assert.equal(data.candidates.length, 5);
    const form = new FormData(); form.set('file', new Blob([pdf]), 'CV.pdf');
    assert.equal((await service.request('/api/candidates/9999/attachments', { method: 'POST', headers: credentials, body: form })).status, 404);
    assert.equal((await service.request('/api/attachments/9999', { headers: credentials })).status, 404);
    assert.equal((await service.request('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  } finally { await service.close(); }
});

test('une candidature sans CV reste possible et une erreur de formulaire ne crée aucun fichier', async () => {
  const service = await start();
  try {
    const response = await service.request('/api/applications', { method: 'POST', body: application(null) });
    assert.equal(response.status, 201); const { id } = await response.json();
    assert.deepEqual(await (await service.request(`/api/candidates/${id}/attachments`, { headers: credentials })).json(), []);
    const invalid = application(); invalid.set('email', 'invalide');
    assert.equal((await service.request('/api/applications', { method: 'POST', body: invalid })).status, 400);
    const data = await (await service.request('/api/data', { headers: credentials })).json();
    assert.equal(data.candidates.length, 6); assert.equal(data.candidates[0].name, 'Élodie Test');
  } finally { await service.close(); }
});
