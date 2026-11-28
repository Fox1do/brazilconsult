(() => {
  'use strict';
  const detail = document.querySelector('.gran-detail');
  const intro = detail?.querySelector('.property-intro');
  const facts = intro?.querySelector('.property-facts');
  if (!intro || !facts) return;
  const grid = intro.querySelector('.bc-property-hero');
  const frame = grid?.querySelector('.bc-hero-carousel');
  if (!frame) return;
  const cover = frame.querySelector('.bc-property-hero-photo');
  if (!cover) return;
  const pictures = [];
  let current = 0, modal = null, prev = null, next = null, counter = null;
  let modalPrev = null, modalNext = null, modalCounter = null, modalImage = null;
  let photoLink = cover || null, photoImage = cover?.querySelector('img') || null;
  const keyOf = src => { try {return new URL(src, document.baseURI).pathname;} catch {return src;} };
  function addPhoto(src, original, alt) {
    if (!src || pictures.some(p => keyOf(p.src) === keyOf(src))) return;
    pictures.push({src, original: original || src, alt: alt || detail.querySelector('h1')?.textContent || 'Фото комплекса'});
  }
  function readPhoto(a) {const img = a?.querySelector('img'); if (img) addPhoto(img.getAttribute('src'), a.getAttribute('href'), img.alt);}
  readPhoto(cover);
  frame.querySelector('.bc-hero-pictures')?.content.querySelectorAll('a[data-lightbox]').forEach(readPhoto);
  const button = (text, label, cls, action) => {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
    el.className = cls; el.setAttribute('aria-label', label); el.addEventListener('click', action); return el;
  };
  function display() {
    if (!pictures.length || !frame) return;
    const p = pictures[current]; photoImage.src = p.src; photoImage.alt = p.alt; photoLink.href = p.original;
    counter.textContent = `${current+1} / ${pictures.length}`;
    prev.hidden = next.hidden = counter.hidden = pictures.length < 2;
    if (modal?.open) {modalImage.src = p.original; modalImage.alt = p.alt; modalCounter.textContent = counter.textContent; modalPrev.hidden = modalNext.hidden = modalCounter.hidden = pictures.length < 2;}
  }
  function step(n) {if (pictures.length > 1) {current = (current+n+pictures.length)%pictures.length; display();}}
  function keys(e) {if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}}
  let suppressClickUntil = 0;
  function swipe(el) {
    let start = null;
    el.addEventListener('touchstart', e => {start=e.touches.length===1?[e.touches[0].clientX,e.touches[0].clientY]:null;},{passive:true});
    el.addEventListener('touchcancel',()=>{start=null;});
    el.addEventListener('touchend',e=>{if(!start||!e.changedTouches.length)return;const t=e.changedTouches[0],dx=t.clientX-start[0],dy=t.clientY-start[1];start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4&&pictures.length>1){suppressClickUntil=Date.now()+400;step(dx<0?1:-1);}},{passive:true});
  }
  function openPhoto(e) {
    if (Date.now() < suppressClickUntil) {e.preventDefault(); return;}
    if (e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||!HTMLDialogElement.prototype.showModal) return;
    e.preventDefault();
    if (!modal) {
      modal=document.createElement('dialog'); modal.className='bc-hero-dialog';modal.setAttribute('aria-label','Фотографии комплекса');
      modalImage=document.createElement('img');modalImage.alt='';
      const close=button('×','Закрыть','bc-hero-close',()=>modal.close());
      modalPrev=button('‹','Предыдущая фотография','bc-hero-prev',()=>step(-1));
      modalNext=button('›','Следующая фотография','bc-hero-next',()=>step(1));
      modalCounter=document.createElement('span');modalCounter.className='bc-hero-count';modalCounter.setAttribute('aria-live','polite');
      modal.append(modalImage,close,modalPrev,modalNext,modalCounter);document.body.append(modal);
      modal.addEventListener('keydown',keys);modal.addEventListener('click',ev=>{if(ev.target===modal)modal.close();});
      modal.addEventListener('close',()=>photoLink.focus({preventScroll:true}));swipe(modalImage);
    }
    if(!modal.open)modal.showModal();display();
  }
  function mountGallery() {
    if (!pictures.length) return;
    photoLink.removeAttribute('data-lightbox');
    photoLink.setAttribute('aria-label','Открыть фотографию');
    prev=button('‹','Предыдущая фотография','bc-hero-prev',()=>step(-1));next=button('›','Следующая фотография','bc-hero-next',()=>step(1));counter=document.createElement('span');counter.className='bc-hero-count';counter.setAttribute('aria-live','polite');frame.append(prev,next,counter);
    frame.addEventListener('keydown',keys);photoLink.addEventListener('click',openPhoto);swipe(photoLink);
    display();

  }
  mountGallery();
})();
