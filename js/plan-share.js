(()=>{
  const plans = [...document.querySelectorAll('details.unit-option[id][data-share-title]')];
  if (!plans.length) return;
  function choose(plan, value){
    const panels=[...plan.querySelectorAll('[data-variant]')];
    if(!panels.some(p=>p.dataset.variant===value))return;
    plan.dataset.selectedVariant=value;
    for(const panel of panels)panel.hidden=panel.dataset.variant!==value;
    for(const button of plan.querySelectorAll('[data-select-variant]'))button.setAttribute('aria-pressed',String(button.dataset.selectVariant===value));
    
  }
  for(const plan of plans){if(plan.dataset.variants){choose(plan,'1');for(const button of plan.querySelectorAll('[data-select-variant]'))button.addEventListener('click',()=>choose(plan,button.dataset.selectVariant));}}
  function reveal(){
    let id; try { id=decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const [base,variant]=id.split("/variant-"); const plan=plans.find(p=>p.id===base); if(!plan)return;
    plan.open=true; const merged=plan.closest(".merged-unit");if(merged)merged.open=true; const group=plan.closest(".bedroom-group"); if(group)group.open=true; if(variant)choose(plan,variant);
    requestAnimationFrame(()=>plan.scrollIntoView({block:'start'}));
  }
  window.addEventListener('hashchange',reveal);
  window.addEventListener('load',reveal,{once:true});
  reveal();
  for(const plan of plans){
    const button=plan.querySelector('.unit-share');
    const status=plan.querySelector('.unit-share-status');
    if(!button||!status)continue;
    const menu=document.createElement('div');
    menu.className='plan-share-menu'; menu.hidden=true;
    menu.setAttribute('aria-label','Поделиться планировкой');
    button.setAttribute('aria-expanded','false');
    const actions=[['copy','Скопировать ссылку','M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2'],['wa','Отправить в WhatsApp','M21 11a9 9 0 0 1-13 8l-5 2 2-5a9 9 0 1 1 16-5Z'],['tg','Отправить в Telegram','M22 2 2 10l8 3 3 9 9-20ZM10 13 22 2'],['download','Скачать планировку','M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5']];
    for(const [key,label,path] of actions){const el=document.createElement(key==='copy'?'button':'a'); if(key==='copy')el.type='button'; else {el.target='_blank';el.rel='noopener noreferrer';} el.dataset.action=key;el.innerHTML=`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span>`;menu.append(el);}
    button.after(menu);
    function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');}
    function update(){
      const url=new URL(document.querySelector('link[rel="canonical"]')?.href||location.href);
      url.hash=plan.id+(plan.dataset.selectedVariant?"/variant-"+plan.dataset.selectedVariant:"");
      const title=`${document.querySelector('h1')?.textContent.trim()||document.title} — ${plan.dataset.shareTitle}${plan.dataset.selectedVariant?" · вариант "+plan.dataset.selectedVariant:""}`;
      menu.querySelector('[data-action="wa"]').href='https://wa.me/?text='+encodeURIComponent(title+'\n'+url.href);
      menu.querySelector('[data-action="tg"]').href='https://t.me/share/url?url='+encodeURIComponent(url.href)+'&text='+encodeURIComponent(title);
      const drawing=plan.dataset.selectedVariant?plan.querySelector('[data-variant="'+plan.dataset.selectedVariant+'"]'):plan;
      const image=drawing?.querySelector('a[data-lightbox]');const download=menu.querySelector('[data-action="download"]');
      download.hidden=!image;if(image){download.href=image.href;download.download=new URL(image.href).pathname.split('/').pop();download.removeAttribute('target');}
      return url.href;
    }
    button.addEventListener('click',()=>{if(!menu.hidden){close();return;}status.textContent='';update();menu.hidden=false;button.setAttribute('aria-expanded','true');});
    menu.querySelector('[data-action="copy"]').addEventListener('click',async()=>{const url=update();close();try{await navigator.clipboard.writeText(url);status.textContent='Ссылка скопирована';}catch{window.prompt('Скопируйте ссылку на планировку:',url);}button.focus();});
    menu.addEventListener('click',e=>{if(e.target.closest('a')){update();close();}});
    document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!button.contains(e.target))close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();button.focus();}});
    plan.addEventListener('toggle',()=>{if(!plan.open)close();});
  }
})();
