const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = name => name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
const date = value => new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
let state = { jobs: [], candidates: [], statuses: [] }, page = 'dashboard', saving = false;
const colors = ['pending', 'interview', 'proposal', 'hired', 'rejected'];
function badge(status) { return `<span class="badge ${colors[state.statuses.indexOf(status)] || 'pending'}"><i></i>${esc(status)}</span>`; }
async function api(path, options) {
  const response = await fetch(path, options ? { ...options, headers: { 'Content-Type': 'application/json' } } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Impossible de contacter le serveur.');
  return data;
}
function candidateRow(c, compact = false) {
  return `<tr><td><button class="candidate-name" data-candidate="${c.id}"><span class="avatar ${colors[c.id % 4]}">${esc(initials(c.name))}</span><span>${esc(c.name)}<small>${esc(compact ? c.job_title : c.email)}</small></span></button></td>${compact ? '' : `<td>${esc(c.job_title)}</td>`}<td>${badge(c.status)}</td>${compact ? '' : `<td class="muted">${date(c.created_at)}</td>`}<td><button class="arrow-button" data-candidate="${c.id}" aria-label="Ouvrir ${esc(c.name)}">↗</button></td></tr>`;
}
function jobCard(j, full = false) {
  const count = state.candidates.filter(c => c.job_id === j.id).length;
  return `<article class="job-card ${full ? 'full' : ''}"><div class="job-card-top"><span class="department">${esc(j.department)}</span><span class="contract">${esc(j.contract)}</span></div><h3>${esc(j.title)}</h3><p class="job-location">⌖ ${esc(j.location)}</p>${full ? `<p class="job-description">${esc(j.description || 'Aucune description ajoutée.')}</p>` : ''}<div class="job-card-footer"><span><span class="tiny-avatars">● ●</span> ${count} candidature${count > 1 ? 's' : ''}</span><button class="arrow-button" data-job="${j.id}" aria-label="Voir l’offre ${esc(j.title)}">↗</button></div></article>`;
}
function render() {
  $('#job-count').textContent = state.jobs.length;
  $('#candidate-count').textContent = state.candidates.length;
  const count = status => state.candidates.filter(c => c.status === status).length;
  const metrics = [ ['Offres en cours', state.jobs.length, 'Des opportunités à partager', '▱'], ['Candidatures reçues', state.candidates.length, 'Des talents à rencontrer', '♧'], ['Entretiens en cours', count('Entretien'), 'La prochaine étape se prépare', '◷'], ['Talents recrutés', count('Recruté'), 'De nouvelles histoires commencent', '✧'] ];
  $('#stats').innerHTML = metrics.map(([title, value, caption, icon], i) => `<article class="stat-card"><div><span>${title}</span><span class="stat-icon ${i === 3 ? 'hired' : ''}">${icon}</span></div><strong>${value.toString().padStart(2, '0')}</strong><p>${caption}</p></article>`).join('');
  $('#pipeline').innerHTML = state.statuses.map((s, i) => `<button class="pipeline-step ${colors[i]}" data-status="${esc(s)}"><span><i></i>${esc(s)}</span><strong>${count(s).toString().padStart(2, '0')}</strong><div class="track"></div></button>`).join('');
  // Progress uses an HTML meter to respect the application's strict style policy.
  document.querySelectorAll('.track').forEach((track, i) => { const meter = document.createElement('meter'); meter.min = 0; meter.max = Math.max(state.candidates.length, 1); meter.value = count(state.statuses[i]); meter.setAttribute('aria-label', state.statuses[i]); track.replaceWith(meter); });
  $('#recent-candidates').innerHTML = state.candidates.length ? `<div class="table-wrap"><table><tbody>${state.candidates.slice(0, 5).map(c => candidateRow(c, true)).join('')}</tbody></table></div>` : '<p class="empty">Les premières rencontres commencent ici.<br>Ajoutez une candidature pour démarrer.</p>';
  $('#recent-jobs').innerHTML = state.jobs.length ? state.jobs.slice(0, 2).map(j => jobCard(j)).join('') : '<p class="empty">Créez votre première offre.</p>';
  $('#status-filter').innerHTML = '<option value="">Tous les statuts</option>' + state.statuses.map(s => `<option>${esc(s)}</option>`).join('');
  renderJobs(); renderCandidates();
}
function renderJobs() {
  const query = $('#job-search').value.toLocaleLowerCase('fr');
  const jobs = state.jobs.filter(j => `${j.title} ${j.department} ${j.location}`.toLocaleLowerCase('fr').includes(query));
  $('#jobs-total').textContent = `${jobs.length} offre${jobs.length > 1 ? 's' : ''}`;
  $('#jobs-list').innerHTML = jobs.length ? jobs.map(j => jobCard(j, true)).join('') : '<p class="empty">Aucune offre pour le moment.</p>';
}
function renderCandidates() {
  const query = $('#candidate-search').value.toLocaleLowerCase('fr'), status = $('#status-filter').value;
  const rows = state.candidates.filter(c => (!status || c.status === status) && `${c.name} ${c.email} ${c.job_title}`.toLocaleLowerCase('fr').includes(query));
  $('#candidates-list').innerHTML = rows.map(c => candidateRow(c)).join('');
  $('#candidates-empty').hidden = rows.length > 0;
}
function navigate(next) {
  page = next;
  for (const name of ['dashboard', 'jobs', 'candidates']) $(`#${name}-page`).hidden = name !== page;
  document.querySelectorAll('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.page === page); el.setAttribute('aria-current', el.dataset.page === page ? 'page' : 'false'); });
  const titles = { dashboard: ['Vue d’ensemble', 'Chaque recrutement commence ici.', 'Une vue claire sur vos recrutements, pour avancer ensemble.'], jobs: ['Offres d’emploi', 'Le prochain chapitre de votre équipe.', 'Créez des opportunités et rencontrez les bons talents.'], candidates: ['Candidatures', 'Des talents, des parcours, des rencontres.', 'Retrouvez chaque candidature et faites avancer les échanges.'] };
  $('#breadcrumb').textContent = titles[page][0]; $('#page-title').textContent = titles[page][1]; $('#page-subtitle').textContent = titles[page][2];
  $('#primary-action').innerHTML = page === 'candidates' ? '<span>＋</span>Ajouter un candidat' : '<span>＋</span>Créer une offre';
}
const input = (label, name, type = 'text', value = '', max = 200) => `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}" required></label>`;
function setupAttachments(id) {
  $('#modal-fields').insertAdjacentHTML('beforeend', `<section class="attachments-section" aria-labelledby="attachments-title"><h3 id="attachments-title">Pièces jointes</h3><div id="attachments-list" class="attachments-list" aria-live="polite">Chargement des documents…</div><label class="field">Ajouter un document<input id="attachment-file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"><small class="file-help">PDF, Word, PNG ou JPEG · 5 Mo maximum par fichier</small></label><button type="button" id="attachment-upload" class="button secondary">Ajouter la pièce jointe</button><p id="attachment-status" class="attachment-status" role="status"></p></section>`);
  const list = $('#attachments-list'), picker = $('#attachment-file'), button = $('#attachment-upload'), status = $('#attachment-status');
  async function refresh() {
    try {
      const files = await api(`/api/candidates/${id}/attachments`);
      list.innerHTML = files.length ? files.map(file => `<a class="attachment-link" href="/api/attachments/${file.id}" download><span>${esc(file.name)}</span><small>${Math.max(1, Math.round(file.size / 1024))} Ko · Télécharger ↓</small></a>`).join('') : '<p class="muted">Aucun document pour cette candidature.</p>';
    } catch (error) { list.textContent = `Chargement impossible : ${error.message}`; }
  }
  button.onclick = async () => {
    const file = picker.files[0];
    if (!file) { status.textContent = 'Sélectionnez un document à ajouter.'; return; }
    if (file.size > 5 * 1024 * 1024) { status.textContent = 'La pièce jointe doit peser au maximum 5 Mo.'; return; }
    button.disabled = true; status.textContent = 'Ajout du document…';
    try {
      const data = new FormData(); data.append('file', file);
      const response = await fetch(`/api/candidates/${id}/attachments`, { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      picker.value = ''; status.textContent = 'Document enregistré.'; await refresh();
    } catch (error) { status.textContent = error.message || 'Impossible d’ajouter ce document.'; }
    finally { button.disabled = false; }
  };
  refresh();
}
function openModal(kind, id) {
  $('#form-error').textContent = ''; $('#save-button').hidden = false;
  let candidate;
  if (kind === 'job') {
    $('#modal-title').textContent = 'Créer une offre';
    $('#modal-fields').innerHTML = input('Intitulé du poste', 'title') + '<div class="form-grid">' + input('Service', 'department') + input('Lieu', 'location') + '</div><label class="field">Type de contrat<select name="contract">' + ['CDI', 'CDD', 'Alternance', 'Stage', 'Freelance'].map(c => `<option>${c}</option>`).join('') + '</select></label><label class="field">Description du poste<textarea name="description" rows="4" maxlength="10000" placeholder="Les missions, le profil recherché…"></textarea></label>';
  } else if (kind === 'candidate') {
    if (!state.jobs.length) { notify('Créez d’abord une offre pour y associer un candidat.'); return; }
    $('#modal-title').textContent = 'Ajouter un candidat';
    $('#modal-fields').innerHTML = input('Nom et prénom', 'name') + input('Adresse e-mail', 'email', 'email', '', 254) + '<label class="field">Offre concernée<select name="job_id">' + state.jobs.map(j => `<option value="${j.id}">${esc(j.title)}</option>`).join('') + '</select></label><label class="field">Notes internes<textarea name="notes" rows="3" maxlength="10000"></textarea></label>';
  } else if (kind === 'edit') {
    candidate = state.candidates.find(c => c.id === id);
    $('#modal-title').textContent = candidate.name;
    $('#modal-fields').innerHTML = `<p class="detail-meta">${esc(candidate.email)}<br>${esc(candidate.job_title)}</p><label class="field">Étape du recrutement<select name="status">${state.statuses.map(s => `<option ${s === candidate.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label><label class="field">Notes internes<textarea name="notes" rows="5" maxlength="10000">${esc(candidate.notes)}</textarea></label>`;
    setupAttachments(id);
  } else {
    const job = state.jobs.find(j => j.id === id);
    $('#modal-title').textContent = job.title;
    $('#modal-fields').innerHTML = `<p class="detail-meta">${esc(job.department)} · ${esc(job.location)} · ${esc(job.contract)}</p><p class="description-text">${esc(job.description || 'Aucune description ajoutée.')}</p><p class="muted">Cette offre est visible dans votre <a href="/carrieres">espace carrières</a>.</p>`;
    $('#save-button').hidden = true;
  }
  $('#modal-form').onsubmit = async event => {
    event.preventDefault(); if (saving || kind === 'view') return;
    saving = true; $('#save-button').disabled = true; $('#form-error').textContent = '';
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      await api(kind === 'job' ? '/api/jobs' : kind === 'candidate' ? '/api/candidates' : `/api/candidates/${id}`, { method: kind === 'edit' ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      $('#modal').close(); await load(); notify(kind === 'job' ? 'Votre offre est publiée dans l’espace carrières.' : 'La candidature a bien été enregistrée.');
    } catch (error) { $('#form-error').textContent = error.message; }
    finally { saving = false; $('#save-button').disabled = false; }
  };
  $('#modal').showModal();
}
let toastTimer;
function notify(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
async function load() {
  try { state = await api('/api/data'); render(); $('#error-banner').hidden = true; }
  catch (error) { $('#error-banner').textContent = `${error.message} Rechargez la page pour réessayer.`; $('#error-banner').hidden = false; }
  finally { $('#loading').hidden = true; }
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.page) navigate(button.dataset.page);
  if (button.dataset.candidate) openModal('edit', Number(button.dataset.candidate));
  if (button.dataset.job) openModal('view', Number(button.dataset.job));
  if (button.dataset.status) { navigate('candidates'); $('#status-filter').value = button.dataset.status; renderCandidates(); }
});
$('#primary-action').onclick = () => openModal(page === 'candidates' ? 'candidate' : 'job');
$('#close-modal').onclick = $('#cancel-modal').onclick = () => { if (!saving) $('#modal').close(); };
$('#job-search').oninput = renderJobs; $('#candidate-search').oninput = $('#status-filter').onchange = renderCandidates;
$('#import-logo').onclick = () => $('#logo-file').click();
$('#logo-file').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  const status = $('#logo-status'), button = $('#import-logo');
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choisissez une image PNG, JPEG ou WebP.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Le logo doit peser moins de 2 Mo.');
    const image = await createImageBitmap(file);
    image.close();
    button.disabled = true; status.textContent = 'Importation du logo…';
    const response = await fetch('/api/logo', { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    await refreshLogo();
    button.textContent = 'Changer le logo';
    status.textContent = 'Logo enregistré sur les deux espaces.';
  } catch (error) { status.textContent = error.message || 'Impossible d’importer cette image.'; }
  finally { button.disabled = false; event.target.value = ''; }
};
load();
