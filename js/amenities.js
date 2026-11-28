(() => {
  'use strict';
  const detail=document.querySelector('.gran-detail'),section=detail?.querySelector(':scope > .bc-amenities');
  if(!section)return;
  const ready=window.bcPropertyPricesReady||fetch('./data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()});
  const illustrations={
    football:'<rect x="4" y="8" width="112" height="74" rx="6" fill="#86AB85"/><g stroke="#fff" stroke-width="1.5" fill="none"><rect x="11" y="15" width="98" height="60"/><path d="M60 15V75"/><circle cx="60" cy="45" r="10"/><rect x="11" y="27" width="19" height="36"/><rect x="90" y="27" width="19" height="36"/><rect x="11" y="36" width="8" height="18"/><rect x="101" y="36" width="8" height="18"/></g>',
    tennis:'<rect x="4" y="8" width="112" height="74" rx="6" fill="#B98267"/><g stroke="#fff" stroke-width="1.5" fill="none"><rect x="11" y="15" width="98" height="60"/><path d="M11 24H109M11 66H109M35 24V66M85 24V66M35 45H85M60 12V78"/></g>',
    sand:'<rect x="4" y="8" width="112" height="74" rx="6" fill="#DBC292"/><g stroke="#fff" stroke-width="1.5" fill="none"><rect x="13" y="18" width="94" height="54"/><path d="M60 12V78" stroke="#8C7959" stroke-width="2" stroke-dasharray="3 2"/><circle cx="60" cy="12" r="2" fill="#8C7959"/><circle cx="60" cy="78" r="2" fill="#8C7959"/></g>',
    'pool-50':'<rect x="4" y="8" width="112" height="74" rx="6" fill="#8DB9CE"/><rect x="11" y="15" width="98" height="60" rx="2" fill="#6DA8C6"/><g stroke="#fff" stroke-width="1.3" stroke-dasharray="3 3"><path d="M15 27H105M15 39H105M15 51H105M15 63H105"/></g><rect x="40" y="34" width="40" height="22" rx="5" fill="#477D99"/><text x="60" y="49" text-anchor="middle" font-size="13" fill="white" font-family="sans-serif">50 м</text>'
  };
  const make=(tag,text,parent,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;if(parent)parent.append(n);return n;};
  ready.then(p=>{
    if(!p)return;
    const selected=new Set(Array.isArray(p.amenities)?p.amenities:[]);if(p.hotelService===true)selected.add('hotel-service');
    const items=(window.BCAmenities||[]).flatMap(g=>g.items).filter(i=>selected.has(i.id));
    const area=Number(p.territoryArea),hasArea=Number.isFinite(area)&&area>0;
    const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
    const buildings=Array.isArray(p.buildings)?p.buildings.length:0;
    const floors=p.technical?.floors,total=p.technical?.total;
    const areas=(p.plans||[]).filter(x=>!x.parentId).map(x=>x.spec?.areaMin).filter(positive);
    const minArea=areas.length?Math.min(...areas):null;
    if(!items.length&&!hasArea&&!buildings&&!positive(total)&&!positive(floors)&&!minArea)return;
    const lang=(document.documentElement.lang||'ru').slice(0,2),label=o=>o[lang]||o.ru;
    section.replaceChildren();make('h2',label({ru:'Инфраструктура комплекса',pt:'Lazer e conveniências',en:'Amenities'}),section);
    const fmt=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:2});
    const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
    if(hasArea||buildings||positive(total)||positive(floors)||minArea){
      const card=make('div',null,section,'bc-territory-card');
      const cell=(label,value,sub)=>{const col=make('div',null,card,'bc-territory-cell');make('span',label,col,'bc-territory-label');if(value)make('strong',value,col,'bc-territory-value');if(sub)make('span',sub,col,'bc-territory-comparison');};
      if(hasArea){const courts=area/260.7569,rounded=Math.round(courts);const comparison=area>=3570?'≈ '+(area/7140).toLocaleString('ru-RU',{maximumFractionDigits:1})+' футбольного поля':courts<1?'Менее одного теннисного корта':'≈ '+rounded+' '+plural(rounded,'теннисный корт','теннисных корта','теннисных кортов');cell('Площадь территории',fmt(area)+' м²',comparison);}
      if(buildings||positive(floors))cell(buildings?'Количество корпусов':'Этажность',buildings?fmt(buildings):fmt(floors),buildings&&positive(floors)?fmt(floors)+' '+plural(floors,'этаж','этажа','этажей'):null);
      if(positive(total)||minArea)cell(positive(total)?'Количество квартир':'Площадь квартир',positive(total)?fmt(total):'От '+fmt(minArea)+' м²',positive(total)&&minArea?'От '+fmt(minArea)+' м²':null);
      card.style.setProperty('--fact-cols',String(card.children.length));
    }
    const sports=items.filter(i=>Object.hasOwn(illustrations,i.id));
    if(sports.length){const list=make('ul',null,section,'bc-sports-pictograms');for(const i of sports){const li=make('li',null,list);const art=make('div',null,li);art.innerHTML='<svg viewBox="0 0 120 90" aria-hidden="true" focusable="false">'+illustrations[i.id]+'</svg>';make('span',label(i.labels),li);}}
    const rest=items.filter(i=>!Object.hasOwn(illustrations,i.id));
    if(rest.length){const list=make('ul',null,section,'bc-amenities-grid');for(const i of rest){const li=make('li',null,list);const icon=make('span',i.emoji,li,'bc-amenity-icon');icon.setAttribute('aria-hidden','true');make('span',label(i.labels),li);}}
    section.hidden=false;
  }).catch(e=>console.warn('Amenities:',e));
})();
