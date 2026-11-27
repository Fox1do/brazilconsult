(() => {
  'use strict';
  const detail = document.querySelector('.gran-detail');
  const intro = detail?.querySelector('.property-intro');
  const facts = intro?.querySelector('.property-facts');
  if (!intro || !facts) return;
  const cover = [...detail.children].find(el => el.matches('a[data-lightbox]') && el.querySelector('img'));
  const request = detail.querySelector(':scope > .gran-price');
  const grid = document.createElement('div');
  grid.className = 'bc-property-hero';
  const side = document.createElement('div');
  side.className = 'bc-property-hero-side';
  facts.before(grid);
  if (cover) {
    cover.classList.add('bc-property-hero-photo');
    grid.append(cover);
  } else grid.classList.add('bc-property-hero-no-photo');
  grid.append(side);
  side.append(facts);
  if (request) grid.after(request);
  const description = document.createElement('p');
  description.className = 'bc-property-description';
  description.hidden = true;
  (request || grid).after(description);
  // Remove only the old description fold, not other technical sections.
  for (const section of detail.querySelectorAll(':scope > .gran-tech')) {
    const fold = section.querySelector(':scope > details');
    if (fold?.querySelector(':scope > summary')?.textContent.trim() !== 'О жилом комплексе') continue;
    const text = [...fold.children].filter(el => el.tagName !== 'SUMMARY').map(el => el.textContent.trim()).filter(Boolean).join('\n');
    if (text) { description.textContent = text; description.hidden = false; }
    section.remove();
  }
  // The same fresh JSON request already used for prices supplies the description.
  const ready = window.bcPropertyPricesReady;
  if (ready) ready.then(property => {
    if (!property) return;
    const text = typeof property.longDescription === 'string' ? property.longDescription.trim() : '';
    description.textContent = text;
    description.hidden = !text;
  });
})();
