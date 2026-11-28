(() => {
  'use strict';

  const facts = document.querySelector('.property-facts');
  if (!facts) return;

  const costLabel = [...facts.querySelectorAll('.property-fact-label')]
    .find(el => el.textContent.trim() === 'Стоимость');
  const cost = costLabel?.nextElementSibling;
  const factCurrencies = costLabel?.parentElement.querySelector('.fact-currencies');
  const units = [...document.querySelectorAll('.gran-plans .unit-option[id]')];
  const fmt = value => 'от R$ ' + Math.round(value).toLocaleString('ru-RU');

  function positive(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function clearCurrency(el) {
    if (!el) return;
    delete el.dataset.brl;
    el.querySelectorAll('.currency-extra').forEach(node => node.remove());
    el.classList.remove('currency-wrap');
  }

  function showCost(price, pending = false) {
    if (!cost) return;
    clearCurrency(cost);
    cost.textContent = price ? fmt(price) : pending ? 'Уточняем цену…' : 'Цена уточняется';
    if (factCurrencies) {
      clearCurrency(factCurrencies);
      factCurrencies.hidden = true;
      if (price) factCurrencies.dataset.brl = String(price);
    } else if (price) {
      cost.classList.add('currency-price');
      cost.dataset.brl = String(price);
    }
  }

  function showUnit(unit, price, pending = false) {
    delete unit.dataset.startPrice;
    const label = unit.querySelector(':scope > summary .unit-price');
    if (!label) return;
    clearCurrency(label);
    label.classList.toggle('currency-price', !!price);
    label.classList.toggle('price-unknown', !price);
    if (!price) {
      label.textContent = pending ? 'Уточняем цену…' : 'Цена уточняется';
      return;
    }
    unit.dataset.startPrice = String(price);
    label.dataset.brl = String(price);
    const brl = document.createElement('span');
    brl.className = 'currency-brl';
    const value = document.createElement('span');
    value.className = 'currency-value';
    value.textContent = fmt(price);
    brl.append(value);
    label.replaceChildren(brl);
  }


function typeOnSale(plans,type) {
  if(!type||type.parentId||type.available===false)return false;
  const children=plans.filter(p=>p.parentId===type.id);
  return !children.length||children.some(p=>p.available!==false&&p.technical?.sold!==true&&p.technical?.remaining!==0);
}

  function restoreGeneratedPlans(property) {
    if (!document.querySelector('main[data-bc-generated="true"]')) return;
    const css=document.createElement('link');css.rel='stylesheet';css.href='/css/plan-cards.css?v=0.360';document.head.append(css);
    const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
    const map=new Map(property.plans.map(p=>[p.id,p]));
    const icon='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/></svg>';
function automaticPlanDescription(s={}) {
  const type=s.apartmentType||'standard';
  const male=['penthouse','penthouse-duplex','penthouse-triplex'].includes(type);
  const base={standard:'Квартира',studio:'Студия',loft:'Квартира',garden:'Квартира',duplex:'Двухуровневая квартира',triplex:'Трёхуровневая квартира',penthouse:'Одноуровневый пентхаус','penthouse-duplex':'Двухуровневый пентхаус','penthouse-triplex':'Трёхуровневый пентхаус'}[type]||'Квартира';
  const optional=[['garden','собственным двориком'],['pool','своим бассейном'],['privateElevator','индивидуальным лифтом'],['staff','комнатой для персонала'],['serviceEntrance','служебным входом'],['doubleHeight','вторым светом'],['barbecue','своей зоной барбекю'],['sauna','приватной сауной'],['designRenovation','дизайнерским ремонтом'],['authorInterior','авторским интерьером'],['fullyFurnished',''],['jacuzzi','джакузи'],['bath','ванной']];
  const inherent=type==='garden'?['своим двориком']:type==='loft'?['открытой планировкой']:[];
  const eligible=optional.filter(([key])=>!(type==='garden'&&key==='garden'));
  const selected=eligible.filter(([key])=>s[key]===true);
  if(selected.length===eligible.length){
    const intro=base+(type==='garden'?' со своим двориком':type==='loft'?' с открытой планировкой':'');
    return intro+(male?', в котором':', в которой')+' предусмотрено всё для комфортной жизни';
  }
  // The old furniture flag does not establish full furnishing; never infer a designer renovation from old "finished".
  if(s.furnished===true&&s.fullyFurnished!==true)selected.push(['legacyFurniture','мебелью']);
  const shown=selected.slice(0,3);
  const full=shown.some(([key])=>key==='fullyFurnished');
  const features=[...inherent,...shown.filter(([key])=>key!=='fullyFurnished').map(([,phrase])=>phrase)];
  let possessive=false;
  const phrases=features.map(phrase=>{
    if(/^(?:своим|своей|собственным|собственной) /.test(phrase)){
      if(possessive)return phrase.replace(/^(?:своим|своей|собственным|собственной) /,'');
      possessive=true;
    }
    return phrase;
  });
  const label=full?(male?'Полностью меблированный ':'Полностью меблированная ')+base[0].toLowerCase()+base.slice(1):base;
  if(!phrases.length)return !full&&['standard','studio'].includes(type)?'':label;
  const joined=phrases.length===1?phrases[0]:phrases.slice(0,-1).join(', ')+' и '+phrases.at(-1);
  return label+(/^(своим|своей|служебным|вторым) /.test(joined)?' со ':' с ')+joined;
}
function planDescription(plan) {
  const manual=plan.translations?.ru?.description;
  return typeof manual==='string'?manual:automaticPlanDescription(plan.spec||{});
}

    const bedroomLabel=s=>{const n=s?.bedrooms;if(s?.apartmentType==='studio')return 'Студия';if(s?.apartmentType==='loft'&&!n)return 'Лофт';if(n==null||n==='')return 'Планировка';if(n===0)return 'Без отдельной спальни';return n+' '+(n%100>=11&&n%100<=14?'спален':n%10===1?'спальня':n%10>=2&&n%10<=4?'спальни':'спален');};
    const area=s=>s?.areaMin>0?Number(s.areaMin).toLocaleString('ru-RU')+(s.areaMax>s.areaMin?'–'+Number(s.areaMax).toLocaleString('ru-RU'):'')+' м²':'';
    const targets=new Map();let activeMenu=null;
    function close(){if(!activeMenu)return;activeMenu.menu.hidden=true;activeMenu.button.setAttribute('aria-expanded','false');activeMenu=null;}
    document.addEventListener('click',e=>{if(activeMenu&&!activeMenu.menu.contains(e.target)&&!activeMenu.button.contains(e.target))close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeMenu){const b=activeMenu.button;close();b.focus();}});
    for(const unit of units){
      const parent=map.get(unit.id);if(!parent||parent.parentId)continue;
      const summary=unit.querySelector(':scope > summary');if(!summary)continue;
      const heading=summary.querySelector('strong');const s=parent.spec||{};
      const title=parent.translations?.ru?.title?.trim()||bedroomLabel(s);
      if(heading){heading.textContent=title;summary.querySelectorAll('.bc-plan-description').forEach(n=>n.remove());const desc=planDescription(parent);if(desc.trim())heading.after(make('small','bc-plan-description',desc.trim()));}
      const toggle=make('span','plan-toggle-label');toggle.append(make('span','when-closed','Развернуть планировку'),make('span','when-open','Свернуть планировку'));summary.append(toggle);
      const variants=property.plans.filter(p=>p.parentId===parent.id&&p.available!==false);
      const legacyIds=Array.isArray(parent.legacyVariantIds)?parent.legacyVariantIds:variants.map(v=>v.id);
      const entries=variants.length?variants:[parent];
      // HTML may be cached while data.json is fresh. Build the variant contents from
      // the same record as the share URL; never attach an ID to a drawing by position.
      unit.querySelectorAll(':scope > .unit-content').forEach(panel=>panel.remove());
      const mediaPath=v=>typeof v==='string'&&/^(?:\.\.\/|\/)?properties\/(?:[a-z0-9_-]+\/)+[a-z0-9_.-]+\.(?:webp|jpe?g|png)(?:\?v=[0-9.]+)?$/i.test(v)?'/'+v.replace(/^\.\.\//,'').replace(/^\//,''):'';
      entries.forEach((variant,i)=>{
        const panel=make('div','unit-content'),inner=make('div','unit-inner');panel.append(inner);unit.append(panel);
        inner.append(make('h3','',variant.translations?.ru?.title||(variant===parent?title:'Вариант '+(i+1))));
        const t=variant.technical||{},n=t.remaining;
        const statusText=variant===parent?'':t.sold===true||n===0?'Все проданы':Number.isSafeInteger(n)&&n>0&&n<=10?(n===1?'Осталась 1 квартира':`Осталось ${n} ${n<=4?'квартиры':'квартир'}`):'';
        if(statusText)inner.append(make('small','unit-sales-status',statusText));
        const locationText=(variant.locations||[]).map(l=>[property.buildings?.find(x=>x.id===l.buildingId)?.name,l.floorMin!=null?'Этаж '+l.floorMin+(l.floorMax!=null&&l.floorMax!==l.floorMin?'–'+l.floorMax:''):l.floorMax!=null?'Этаж до '+l.floorMax:'',l.unit!=null&&l.unit!==''?'Квартира '+l.unit:''].filter(Boolean).join(' · ')).filter(Boolean).join('; ');
        if(locationText)inner.append(make('p','',locationText));
        const m=variant.media?.src?variant.media:parent.media;
        const thumb=mediaPath(m?.src),original=mediaPath(m?.original)||thumb;
        if(thumb){const frame=make('div','unit-drawing'),a=make('a');a.dataset.lightbox='';a.href=original;const img=make('img');img.loading='lazy';img.src=thumb;img.alt=m.caption||'Планировка';a.append(img);frame.append(a);inner.append(frame);}
        // Stable ID is independent of ordering. Parent IDs are not duplicated.
        const hash='#'+encodeURIComponent(parent.id)+(variant===parent?'':'/variant-'+encodeURIComponent(variant.id));
        targets.set(hash,{unit,panel});if(variant!==parent){const legacyIndex=legacyIds.indexOf(variant.id);const alias='#'+encodeURIComponent(parent.id)+'/variant-'+(legacyIndex+1);if(legacyIndex>=0&&!targets.has(alias))targets.set(alias,{unit,panel});}if(i===0)targets.set('#'+encodeURIComponent(parent.id),{unit,panel});
        const row=make('div','unit-share-row bc-plan-actions');const request=make('button','btn btn--navy unit-request','Хочу эту квартиру');request.type='button';
        const share=make('button','unit-share');share.type='button';share.innerHTML=icon;share.append(make('span','','Поделиться'));share.setAttribute('aria-expanded','false');
        const status=make('span','unit-share-status');status.setAttribute('role','status');const menu=make('div','plan-share-menu');menu.hidden=true;menu.setAttribute('aria-label','Поделиться планировкой');
        const shareTitle=property.title+' — '+title+(variant!==parent?' · '+(variant.translations?.ru?.title||'Вариант '+(i+1)):'');
        const url=new URL(document.querySelector('link[rel="canonical"]')?.href||location.href);url.hash=hash;
        const glyphs={copy:'M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2',wa:'M21 11a9 9 0 0 1-13 8l-5 2 2-5a9 9 0 1 1 16-5Z',tg:'M22 2 2 10l8 3 3 9 9-20ZM10 13 22 2',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'};const menuLabel=(el,key,label)=>{el.innerHTML=`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyphs[key]}"/></svg>`;el.append(make('span','',label));};const copy=make('button');menuLabel(copy,'copy','Скопировать ссылку');copy.type='button';copy.onclick=async()=>{close();try{await navigator.clipboard.writeText(url.href);status.textContent='Ссылка скопирована';}catch{window.prompt('Скопируйте ссылку на планировку:',url.href);}share.focus();};menu.append(copy);
        const link=(key,label,href)=>{const a=make('a');menuLabel(a,key,label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',close);menu.append(a);return a;};
        link('wa','Отправить в WhatsApp','https://wa.me/?text='+encodeURIComponent(shareTitle+'\n'+url.href));
        link('tg','Отправить в Telegram','https://t.me/share/url?url='+encodeURIComponent(url.href)+'&text='+encodeURIComponent(shareTitle));
        const drawing=panel.querySelector('.unit-drawing a[data-lightbox]');if(drawing){const a=link('download','Скачать планировку',drawing.href);a.download=new URL(drawing.href).pathname.split('/').pop();a.removeAttribute('target');}
        share.onclick=()=>{const wasOpen=activeMenu?.button===share;close();if(wasOpen)return;status.textContent='';menu.hidden=false;share.setAttribute('aria-expanded','true');activeMenu={menu,button:share};};
        request.onclick=()=>{
          const locs=variant.locations?.length?variant.locations:parent.locations||[];
          const blocks=[...new Set(locs.map(l=>property.buildings?.find(b=>b.id===l.buildingId)?.name).filter(Boolean))];
          const floors=[...new Set(locs.map(l=>l.floorMin!=null?String(l.floorMin)+(l.floorMax!=null&&l.floorMax!==l.floorMin?'–'+l.floorMax:''):l.floorMax!=null?'до '+l.floorMax:'').filter(Boolean))];
          const nums=[...new Set(locs.map(l=>l.unit).filter(v=>v!=null&&v!==''))];
          if(typeof window.bcApartmentRequest!=='function'){location.href='/properties/consultation.html';return;}
          window.bcApartmentRequest({developer:property.developerName||'Уточняется',type:title,variant:variant===parent?'':variant.translations?.ru?.title||'Вариант '+(i+1),block:blocks.join(', '),floor:floors.join(', '),unit:nums.join(', '),area:area(variant.spec)||area(s),bedrooms:bedroomLabel(s),price:positive(parent.priceBrl)??undefined,hash});
        };
        row.append(request,share,menu,status);inner.append(row);
        // Sold-out variants stay visible, but cannot be requested as available.
        if(!typeOnSale(property.plans,parent)||(variant!==parent&&(variant.technical?.sold===true||variant.technical?.remaining===0))){request.disabled=true;request.title='Все проданы';}
      });
      unit.addEventListener('toggle',()=>{if(!unit.open&&activeMenu&&unit.contains(activeMenu.button))close();});
    }
    function reveal(){const target=targets.get(location.hash);if(!target)return;target.unit.open=true;requestAnimationFrame(()=>target.panel.scrollIntoView({block:'start'}));}
    window.addEventListener('hashchange',reveal);reveal();
  }

  showCost(null, true);
  units.forEach(unit => showUnit(unit, null, true));

  // Цены устанавливаются по типу квартиры, а не по отдельному чертежу.
  // Вариант наследует цену своего доступного родительского типа.
  window.bcPropertyPricesReady = fetch(
    './data.json',
    { cache: 'no-store' }
  ).then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }).then(property => {
    if (!property || !Array.isArray(property.plans)) {
      throw new Error('Некорректные данные ЖК');
    }
    const plans = new Map(property.plans.map(plan => [plan.id, plan]));
    const priceOf = plan => {
      if (!plan || plan.available === false) return null;
      const type = plan.parentId ? plans.get(plan.parentId) : plan;
      if (!typeOnSale(property.plans,type)) return null;
      return positive(type.priceBrl);
    };
    const prices = property.plans
      .filter(plan => !plan.parentId)
      .map(priceOf)
      .filter(price => price !== null);
    const minimum = prices.length ? Math.min(...prices) : null;
    showCost(minimum);
    units.forEach(unit => showUnit(unit, priceOf(plans.get(unit.id))));
    try { restoreGeneratedPlans(property); } catch (error) { console.warn('Не удалось восстановить оформление планировок:', error); }
    window.bcRenderCurrencies?.();
    // Калькулятор получает тот же минимум, что и заголовок ЖК.
    return { ...property, priceBrl: minimum };
  }).catch(error => {
    showCost(null);
    units.forEach(unit => showUnit(unit, null));
    console.warn('Не удалось обновить цены ЖК:', error);
    return null;
  });
})();
