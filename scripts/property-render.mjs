// Public presentation only. No credentials, API calls or GitHub writes.
const slug=/^[a-z0-9][a-z0-9-]*$/;
const imagePath=/^properties\/(?:[a-z0-9_-]+\/)+[a-z0-9_.-]+\.(webp|jpe?g|png)$/i;
const safePath=p=>!p.split('/').some(s=>s==='.'||s==='..');
const fail=message=>{throw new Error(message)};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function root(p) {
  if(!obj(p)||![p.countryId,p.cityId,p.developer,p.id].every(v=>typeof v==='string'&&slug.test(v))||p.developer==='shared')
    fail('Недопустимый путь ЖК');
  return `properties/${p.countryId}/${p.cityId}/${p.developer}/${p.id}/`;
}
function mediaUrl(v,logo=false) {
  if(v==null||v==='') return '';
  if(typeof v!=='string') fail('Некорректный адрес фото');
  const s=v.replace(/^\.\.\//,'').replace(/^\//,'');
  const path=s.split('?')[0];
  const logoPath=/^(?:assets|images)\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(webp|jpe?g|png|svg)$/i;
  if(!(imagePath.test(path)||(logo&&logoPath.test(path)))||!safePath(path)||!/^[^?]+(?:\?v=[0-9.]+)?$/.test(s))
    fail('Недопустимый адрес фото: '+s);
  return '/'+s;
}
export {root};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n>0?'R$ '+Math.round(n).toLocaleString('ru-RU'):'Цена уточняется';
const number=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
function bedroomLabel(v) {
  if(v==null||v==='') return 'Квартира';
  const n=Number(v); if(!Number.isInteger(n)||n<0) return 'Квартира';
  if(n===0) return 'Студия';
  const a=n%10,b=n%100;
  return `${n} ${b>=11&&b<=14?'спален':a===1?'спальня':a>=2&&a<=4?'спальни':'спален'}`;
}
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
function typeOnSale(plans,type) {
  if(!type||type.parentId||type.available===false)return false;
  const children=plans.filter(p=>p.parentId===type.id);
  return !children.length||children.some(p=>p.available!==false&&p.technical?.sold!==true&&p.technical?.remaining!==0);
}
function planLabel(p) {
  const s=p.spec||{}, n=s.bedrooms;
  return p.translations?.ru?.title?.trim()||(s.apartmentType==='studio'?'Студия':s.apartmentType==='loft'&&!n?'Лофт':n==null||n===''?'Планировка':n===0?'Без отдельной спальни':bedroomLabel(n));
}
function hasContent(v) {
  if(v==null) return false; if(Array.isArray(v)) return v.some(hasContent);
  if(typeof v==='object') return Object.values(v).some(hasContent);
  return typeof v==='boolean'?v:!!String(v).trim();
}
function salesLabel(plan) {
  if(!plan.parentId)return '';
  const t=plan.technical||{}, n=t.remaining;
  if(t.sold===true||n===0)return 'Все проданы';
  if(!Number.isSafeInteger(n)||n<1||n>10)return '';
  return n===1?'Осталась 1 квартира':`Осталось ${n} ${n<=4?'квартиры':'квартир'}`;
}

export function pageHTML(p,template) {
  const e=esc,title=e(p.title);
  const pic=m=>m?.src?`<a data-lightbox href="${e(mediaUrl(m.original||m.src))}"><img loading="lazy" src="${e(mediaUrl(m.src))}" alt="${e(m.caption||m.category||p.title)}"></a>`:'';
  const gallery=(items,label)=>items?.length?`<section class="gran-gallery"><h2>${label}</h2><div class="gran-gallery__grid">${items.map(m=>`<figure>${pic(m)}<figcaption>${e(m.caption||m.category)}</figcaption></figure>`).join('')}</div></section>`:'';
  const price=n=>`<span class="unit-price currency-price" ${Number.isFinite(Number(n))&&n>0?`data-brl="${e(Number(n))}"`:''}>${money(n)}</span>`;
  const plans=p.plans.filter(a=>!a.parentId&&a.available!==false).map(a=>{
    const s=a.spec||{}, label=planLabel(a);
    const meta=[s.areaMin?`${number(s.areaMin)}${s.areaMax&&s.areaMax!==s.areaMin?'–'+number(s.areaMax):''} м²`:'',
      s.bathrooms!=null?'🚿 '+s.bathrooms:'',s.parking!=null?'🚗 '+s.parking:''].filter(Boolean).join(' · ');
    const children=p.plans.filter(b=>b.parentId===a.id&&b.available!==false);
    const variants=p.plans.some(b=>b.parentId===a.id)?children:[a];
    const salesMarkup=label=>label?`<small class="unit-sales-status">${e(label)}</small>`:'';
    return `<details class="unit-option merged-unit" id="${e(a.id)}"><summary><span><strong>${e(label)}</strong>${planDescription(a).trim()?`<small class="bc-plan-description">${e(planDescription(a).trim())}</small>`:''}<small class="unit-meta">${e(meta)}</small>${price(typeOnSale(p.plans,a)?a.priceBrl:null)}</span></summary>
      ${variants.map((b,i)=>`<div class="unit-content"><div class="unit-inner"><h3>${e(b.translations?.ru?.title||(b.parentId?`Вариант ${i+1}`:label))}</h3>${salesMarkup(salesLabel(b))}
      ${(b.locations||[]).length?`<p>${e(b.locations.map(l=>[p.buildings?.find(x=>x.id===l.buildingId)?.name,
        l.floorMin!=null?'Этаж '+l.floorMin+(l.floorMax!=null&&l.floorMax!==l.floorMin?'–'+l.floorMax:''):l.floorMax!=null?'Этаж до '+l.floorMax:'',
        l.unit?'Квартира '+l.unit:''].filter(Boolean).join(' · ')).join('; '))}</p>`:''}
      ${(b.media?.src||a.media?.src)?`<div class="unit-drawing">${pic(b.media?.src?b.media:a.media)}</div>`:''}</div></div>`).join('')}</details>`;
  }).join('');
  // All primary sections are emitted in their final order. Scripts populate fixed slots only.
  const photos=[...(p.hero||[]),...(p.gallery||[])].filter(m=>m?.src).filter((m,i,a)=>a.findIndex(x=>mediaUrl(x.src).split('?')[0]===mediaUrl(m.src).split('?')[0])===i);
  const first=photos[0];
  const hero=first?`<div class="bc-hero-carousel" role="region" aria-label="Фотографии комплекса"><a class="bc-property-hero-photo" data-lightbox href="${e(mediaUrl(first.original||first.src))}"><img src="${e(mediaUrl(first.src))}" alt="${e(first.caption||first.category||p.title)}" loading="eager"></a><template class="bc-hero-pictures">${photos.slice(1).map(pic).join('')}</template></div>`:'';
  const area=Number(p.territoryArea); const courts=Math.max(1,Math.round(area/260.7569));
  const courtWord=courts%100>=11&&courts%100<=14?'теннисных кортов':courts%10===1?'теннисный корт':courts%10>=2&&courts%10<=4?'теннисных корта':'теннисных кортов';
  const comparison=area>=3570?'≈ '+(area/7140).toLocaleString('ru-RU',{maximumFractionDigits:1})+' футбольного поля':'≈ '+courts+' '+courtWord;
  const rows=(source,labels)=>labels.filter(([k])=>source?.[k]!=null&&String(source[k]).trim()!==''&&source[k]!==false).map(([k,label])=>`<dt>${e(label)}</dt><dd>${e(typeof source[k]==='boolean'?'Да':source[k])}</dd>`).join('');
  const tech=rows(p.technical,[['total','Всего квартир'],['floors','Этажность'],['perFloor','Квартир на этаже'],['parkingLevels','Уровней паркинга'],['guestParking','Гостевых машино-мест'],['parkingSize','Размер машино-мест'],['penthouseFloor','Этаж с пентхаусами']]);
  const architecture=rows(p.architectureDesign,[['architecture','Архитектурный проект'],['interiors','Дизайн интерьеров'],['landscape','Ландшафтный дизайн'],['development','Девелопмент и строительство'],['jointDevelopment','Совместный девелопмент']]);
  const locationPhotos=(p.locationGallery||[]).filter(m=>m?.src);
  const hasLocation=locationPhotos.length>0;
  const body=`<header class="property-intro" data-bc-layout="0.365"><a class="link-arrow" href="/properties/">← Все объекты</a>
    <p class="eyebrow property-location">${e([p.city,p.district].filter(Boolean).join(' · '))}</p><h1>${title}</h1>
    <p class="gran-developer">Кто строит: ${e(p.developerName)}</p>${area>0?`<p class="gran-territory">Площадь территории: ${e(number(area))} м² <span class="bc-territory-comparison">(${e(comparison)})</span></p>`:''}
    <div class="bc-property-hero${first?'':' bc-property-hero-no-photo'}">${hero}<div class="bc-property-hero-side"><div data-bc-highlights hidden></div><div class="gran-facts property-facts"><div><p class="property-fact-label">Стоимость</p><h2>${p.priceBrl>0?'от ':''}${money(p.priceBrl)}</h2><div class="fact-currencies" hidden></div></div>
    <div><p class="property-fact-label">Срок сдачи</p><h2>${e(p.completed?'Объект сдан':p.completion||'По запросу')}</h2></div></div></div></div>
    ${p.longDescription?`<p class="bc-property-description">${e(p.longDescription)}</p>`:''}</header>
    ${plans?`<section class="gran-plans"><h2>Квартиры и планировки</h2>${plans}</section><section id="installment-calculator" class="installment-calculator" hidden></section>`:''}
    <section class="gran-tech bc-amenities" hidden></section>
    <section class="gran-tech bc-surroundings" ${hasLocation?'':'hidden'}><h2>Расположение и окружение</h2>${hasLocation?`<div class="gran-gallery__grid">${locationPhotos.map(m=>`<figure>${pic(m)}<figcaption>${e(m.caption||m.category)}</figcaption></figure>`).join('')}</div>`:''}<div data-bc-nearby></div></section>
    ${tech?`<section class="gran-tech bc-technical"><details class="bc-public-fold"><summary>Технические характеристики ЖК</summary><dl class="gran-team">${tech}</dl></details></section>`:''}
    ${architecture?`<section class="gran-tech bc-architecture"><details class="bc-public-fold"><summary>Архитектура и дизайн</summary><dl class="gran-team">${architecture}</dl></details></section>`:''}
    <p class="property-disclaimer">Информация носит ознакомительный характер. Цены, характеристики и наличие необходимо уточнять перед покупкой.</p>`;
  if(!template.includes('__TITLE__')||!template.includes('__BODY__')||!template.includes('</head>')) fail('Некорректный шаблон страницы ЖК',502);
  return template.replace('__TITLE__',()=>title).replace('__BODY__',()=>body).replace('</head>',()=>`<meta name="description" content="${title} — квартиры и планировки"><link rel="canonical" href="https://brazilconsult.com/${root(p)}">${p.active===false?'<meta name="robots" content="noindex">':''}</head>`);
}
