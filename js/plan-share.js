(()=>{
  const plans = [...document.querySelectorAll('details.unit-option[id][data-share-title]')];
  if (!plans.length) return;
  function choose(plan, value){
    const panels=[...plan.querySelectorAll('[data-variant]')];
    if(!panels.some(p=>p.dataset.variant===value))return;
    plan.dataset.selectedVariant=value;
    for(const panel of panels)panel.hidden=panel.dataset.variant!==value;
    for(const button of plan.querySelectorAll('[data-select-variant]'))button.setAttribute('aria-pressed',String(button.dataset.selectVariant===value));
    
    const request=plan.querySelector('.unit-request'); if(request&&!request.hasAttribute('data-specific')){const panel=panels.find(p=>p.dataset.variant===value);request.href='https://wa.me/5524999592093?text='+encodeURIComponent('Здравствуйте! Интересует Gran Thai, '+plan.dataset.shareTitle+', вариант '+value+' — '+panel.querySelector('.gran-caption').textContent+'. Уточните цену и наличие.');}
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
    button.addEventListener('click',async()=>{
      const url=new URL(document.querySelector('link[rel="canonical"]')?.href||location.href);
      url.hash=plan.id+(plan.dataset.selectedVariant?"/variant-"+plan.dataset.selectedVariant:"");
      const title=`${document.querySelector('h1')?.textContent.trim()||document.title} — ${plan.dataset.shareTitle}${plan.dataset.selectedVariant?" · вариант "+plan.dataset.selectedVariant:""}`;
      status.textContent='';
      if(typeof navigator.share==='function'){
        try{await navigator.share({title,text:title,url:url.href});return;}
        catch(error){if(error.name==='AbortError')return;}
      }
      try{await navigator.clipboard.writeText(url.href);status.textContent='Ссылка скопирована';}
      catch{window.prompt('Скопируйте ссылку на планировку:',url.href);}
    });
  }
})();
