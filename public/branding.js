async function refreshLogo() {
  try {
    const response = await fetch('/api/logo');
    if (!response.ok || !(await response.json()).configured) return;
    const source = `/logo?v=${Date.now()}`;
    const preview = new Image();
    preview.src = source;
    await preview.decode();
    for (const brand of document.querySelectorAll('.brand')) {
      const image = document.createElement('img');
      image.src = source; image.alt = 'SODM'; image.width = 190; image.height = 79;
      const caption = document.createElement('small'); caption.textContent = 'RECRUTEMENT';
      brand.replaceChildren(image, caption);
      brand.classList.add('custom-logo');
    }
    const importButton = document.querySelector('#import-logo');
    if (importButton) importButton.textContent = 'Changer le logo';
  } catch { /* Keep the existing brand if a logo cannot be loaded. */ }
}
refreshLogo();
