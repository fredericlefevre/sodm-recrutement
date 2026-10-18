const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let jobs = [], selectedJob, submitting = false;
function render() {
  const query = $('#search').value.toLocaleLowerCase('fr');
  const filtered = jobs.filter(j => `${j.title} ${j.location} ${j.department} ${j.contract}`.toLocaleLowerCase('fr').includes(query));
  $('#offer-count').textContent = `${filtered.length} offre${filtered.length > 1 ? 's' : ''}`;
  $('#offers').innerHTML = filtered.length ? filtered.map(j => `<article class="job-card full"><div class="job-card-top"><span class="department">${esc(j.department)}</span><span class="contract">${esc(j.contract)}</span></div><h3>${esc(j.title)}</h3><p class="job-location">⌖ ${esc(j.location)}</p><p class="job-description">${esc(j.description)}</p><div class="job-card-footer"><span>Votre talent a sa place ici.</span><button class="button primary" data-apply="${j.id}">Postuler ↗</button></div></article>`).join('') : '<p class="empty">Aucune offre ne correspond à votre recherche.<br>Revenez bientôt découvrir nos prochaines opportunités.</p>';
}
$('#search').oninput = render;
$('#offers').onclick = event => {
  const button = event.target.closest('[data-apply]'); if (!button) return;
  selectedJob = Number(button.dataset.apply);
  $('#apply-form').reset(); $('#form-error').textContent = ''; $('#application-fields').hidden = false; $('#application-success').hidden = true;
  $('#job-title').textContent = jobs.find(j => j.id === selectedJob).title;
  $('#apply-modal').showModal();
};
$('#close-modal').onclick = () => { if (!submitting) $('#apply-modal').close(); };
$('#apply-form').onsubmit = async event => {
  event.preventDefault(); if (submitting) return; submitting = true; $('#submit-button').disabled = true; $('#form-error').textContent = '';
  try {
    const data = new FormData(event.currentTarget);
    data.set('job_id', String(selectedJob));
    const file = data.get('cv');
    if (file && file.size > 5 * 1024 * 1024) throw new Error('La pièce jointe doit peser au maximum 5 Mo.');
    const response = await fetch('/api/applications', { method: 'POST', body: data });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    $('#application-fields').hidden = true; $('#application-success').hidden = false;
  } catch (error) { $('#form-error').textContent = error.message || 'Envoi impossible. Réessayez dans quelques instants.'; }
  finally { submitting = false; $('#submit-button').disabled = false; }
};
fetch('/api/jobs').then(async response => { if (!response.ok) throw new Error('Chargement impossible.'); jobs = await response.json(); render(); }).catch(() => { $('#offers').innerHTML = ''; $('#error-banner').textContent = 'Les offres sont momentanément indisponibles. Rechargez la page pour réessayer.'; $('#error-banner').hidden = false; });
