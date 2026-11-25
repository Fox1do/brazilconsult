(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'property-lightbox';
  dialog.setAttribute('aria-label', 'Просмотр изображения');
  dialog.innerHTML = '<button type="button" class="property-lightbox-close" aria-label="Закрыть">×</button><div class="property-lightbox-scroll"><img alt=""></div><button type="button" class="property-lightbox-zoom" aria-label="Увеличить изображение" aria-pressed="false">+</button>';
  document.body.append(dialog);
  const img = dialog.querySelector('img'), zoom = dialog.querySelector('.property-lightbox-zoom'), close = dialog.querySelector('.property-lightbox-close'), scroll = dialog.querySelector('.property-lightbox-scroll');
  let trigger, oldOverflow;
  function reset() { dialog.classList.remove('is-zoomed'); zoom.textContent = '+'; zoom.setAttribute('aria-pressed','false'); zoom.setAttribute('aria-label','Увеличить изображение'); scroll.scrollTop = scroll.scrollLeft = 0; }
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-lightbox]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !dialog.showModal) return;
    e.preventDefault(); trigger = link; img.src = link.href; img.alt = link.querySelector('img')?.alt || ''; reset();
    oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal(); close.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog || e.target === scroll) dialog.close(); });
  zoom.addEventListener('click', () => { const on = dialog.classList.toggle('is-zoomed'); zoom.textContent = on ? '−' : '+'; zoom.setAttribute('aria-pressed', String(on)); zoom.setAttribute('aria-label', on ? 'Уменьшить изображение' : 'Увеличить изображение'); if (!on) reset(); });
  dialog.addEventListener('close', () => { document.body.style.overflow = oldOverflow || ''; reset(); img.removeAttribute('src'); trigger?.focus({preventScroll:true}); });
})();
