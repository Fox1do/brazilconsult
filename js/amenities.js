(() => {
  const detail = document.querySelector('.gran-detail');
  if (!detail) return;
  const ready = window.bcPropertyPricesReady || fetch('./data.json', {cache:'no-store'}).then(r => {if (!r.ok) throw Error('HTTP '+r.status); return r.json();});
  ready.then(p => {
    if (!p || !Array.isArray(window.BCAmenities) || !detail.querySelector(':scope > .bc-amenities')) return;
    const selected = new Set(Array.isArray(p.amenities) ? p.amenities : []);
    if (p.hotelService === true) selected.add('hotel-service');
    const groups = window.BCAmenities.filter(g => g.items.some(i => selected.has(i.id)));
    if (!groups.length) return;
    const lang = (document.documentElement.lang || 'ru').slice(0,2);
    const label = o => o[lang] || o.ru;
    const make = (tag, text, parent) => {const n = document.createElement(tag); if (text != null) n.textContent = text; if (parent) parent.append(n); return n;};
    const section = detail.querySelector(':scope > .bc-amenities'); section.replaceChildren();
    make('h2', label({ru:'Инфраструктура комплекса',pt:'Lazer e conveniências',en:'Amenities'}), section);
    for (const g of groups) {
      make('h3', label(g.labels), section);
      const list = make('ul', null, section); list.className = 'bc-amenities-grid';
      for (const i of g.items.filter(i => selected.has(i.id))) {
        const li = make('li', null, list);
        const icon = make('span', i.emoji, li); icon.className = 'bc-amenity-icon'; icon.setAttribute('aria-hidden','true');
        make('span', label(i.labels), li);
      }
    }
    section.hidden = false;
  }).catch(error => console.warn('Amenities:', error));
})();
