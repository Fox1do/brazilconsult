'use strict';
/* Brazil Consult — catalog validation, browser 0.370.
 * Worker 0.043 validates the same optional technical fields; 0.042 is accepted during rollout.
 * Validation is non-mutating. Empty optional fields are allowed.
 */
function bcValidateData(catalog, developers, previous = []) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const missing = v => v == null || v === '';
  const string = v => typeof v === 'string';
  const nonempty = v => string(v) && !!v.trim();
  const id = v => string(v) && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
  const slug = v => string(v) && /^[a-z0-9][a-z0-9-]{0,127}$/.test(v);
  const key = v => v.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
  let context = 'Каталог', target = {};
  const reject = msg => { throw Object.assign(new Error(context + ': ' + msg), {status:400,target:{...target,message:msg}}); };
  const need = (ok, msg) => { if (!ok) reject(msg); };
  const text = (v, name, max=20000) => need(missing(v) || (string(v) && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)), 'Некорректное поле «'+name+'»');
  const required = (v, name, max=250) => { need(nonempty(v), 'Заполните «'+name+'»'); text(v,name,max); };
  const boolean = (v, name) => need(v === undefined || typeof v === 'boolean', 'Некорректный переключатель «'+name+'»');
  const numeric = (v, name, {integer=false, min=0, positive=false, max=Number.MAX_SAFE_INTEGER}={}) => {
    if (missing(v)) return;
    need(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isSafeInteger(v)) && (!positive || v>0), 'Некорректное число «'+name+'»');
  };
  const range = (lo,hi,name,opts={}) => {numeric(lo,name+' от',opts);numeric(hi,name+' до',opts);need(missing(hi)||missing(lo)||hi>=lo,'Проверьте диапазон «'+name+'» (от ≤ до)');};
  const url = (v,name) => { if(missing(v))return; text(v,name,2048); let u; try{u=new URL(v)}catch{} need(u && ['http:','https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password && !/[\s\\]/.test(v), 'Допустима только корректная ссылка HTTP(S): '+name); };
  const optionalObject = (v,name) => {need(v==null || object(v),'Некорректный раздел «'+name+'»');return v||{};};
  const array = (v,name,optional=false) => {if(optional&&v==null)return [];need(Array.isArray(v),'Некорректный список «'+name+'»');return v;};
  const uniqueIds = (items,name) => {const ids=new Set();for(const x of items){need(object(x)&&id(x.id),'Некорректный ID: '+name);need(!ids.has(x.id),'Повторяющийся ID: '+name+' / '+x.id);ids.add(x.id);}return ids;};
  const stringIds = (v,name,max=500) => {const a=array(v,name,true);need(a.length<=max&&a.every(id)&&new Set(a).size===a.length,'Некорректные или повторяющиеся значения: '+name);};
  const media = (m,name) => {need(object(m),'Некорректное фото: '+name);required(m.src,name+' — источник',2000000);for(const k of ['name','caption','captionPt','category'])text(m[k],name+' / '+k);for(const k of ['original','thumb'])text(m[k],name+' / '+k,2000000);};
  const specs = new Set(['standard','studio','loft','garden','duplex','triplex','penthouse','penthouse-duplex','penthouse-triplex']);
  const flags=['garden','staff','pool','sauna','bath','jacuzzi','privateElevator','serviceEntrance','barbecue','doubleHeight','designRenovation','authorInterior','fullyFurnished','finished','furnished','duplex'];
  const devIds=new Set(),devNames=new Set();
  for(const d of array(developers,'Застройщики')) {
    target={developerId:d?.id};
    context='Застройщик «'+(nonempty(d?.name)?d.name:'без названия')+'»';
    need(object(d)&&slug(d.id)&&d.id!=='shared','Некорректный ID');required(d.name,'Название');
    need(!devIds.has(d.id),'Повторяющийся ID');need(!devNames.has(key(d.name)),'Повторяющееся название');devIds.add(d.id);devNames.add(key(d.name));
    boolean(d.active,'Активен');url(d.website,'Официальный сайт');text(d.description,'Описание');if(d.logo!=null)media(d.logo,'Логотип');
  }
  const path=p=>[p.countryId,p.cityId,p.developer,p.id].join('/');
  const priorPaths=new Map(previous.filter(object).map(p=>[path(p),p]));
  const priorUids=new Map(previous.filter(p=>object(p)&&nonempty(p.uid)).map(p=>[p.uid,path(p)]));
  const paths=new Set(),uids=new Set();
  for(const p of array(catalog,'ЖК')) {
    target={propertyUid:p?.uid,propertyId:p?.id};
    context='ЖК «'+(nonempty(p?.title)?p.title:'без названия')+'»';
    need(object(p)&&[p.countryId,p.cityId,p.developer,p.id].every(slug),'Некорректный путь ЖК');required(p.title,'Название ЖК');need(devIds.has(p.developer),'Застройщик не найден');
    need(id(p.uid),'Некорректный UID ЖК');need(!uids.has(p.uid),'Повторяющийся UID ЖК');uids.add(p.uid);
    const dir=path(p);need(!paths.has(dir),'Повторяющийся путь ЖК');paths.add(dir);
    need(!priorUids.has(p.uid)||priorUids.get(p.uid)===dir,'Нельзя менять путь опубликованного ЖК');
    const before=priorPaths.get(dir);need(!before?.uid||before.uid===p.uid,'Нельзя менять UID опубликованного ЖК');
    boolean(p.active,'Активен');boolean(p.completed,'Объект сдан');const active=p.active!==false;
    numeric(p.territoryArea,'Площадь территории',{positive:true});text(p.longDescription,'Описание');text(p.source,'Источник информации');
    if(!missing(p.completionMonth))need(string(p.completionMonth)&&/^\d{4}-(0[1-9]|1[0-2])$/.test(p.completionMonth),'Некорректный месяц сдачи');
    text(p.completion,'Срок сдачи');if(!missing(p.priceUpdatedAt))need(string(p.priceUpdatedAt)&&Number.isFinite(Date.parse(p.priceUpdatedAt)),'Некорректная дата обновления цены');
    need(object(p.location),'Не указано расположение');const loc=p.location;
    for(const k of ['city','state','district','neighborhood','address'])text(loc[k],k,500);
    numeric(loc.latitude,'Широта',{min:-90,max:90});numeric(loc.longitude,'Долгота',{min:-180,max:180});url(loc.mapsUrl,'Карта ЖК');
    const hero=array(p.hero,'Главная фотография',true);need(hero.length<=1,'Допустима одна главная фотография');
    for(const [name,items] of [['Главная фотография',hero],['Галерея',array(p.gallery,'Галерея',true)],['Галерея расположения',array(p.locationGallery,'Галерея расположения',true)]])for(const m of items)media(m,name);
    const buildings=array(p.buildings,'Корпуса'),buildingIds=uniqueIds(buildings,'корпус');
    need(['single','multiple'].includes(p.buildingMode),'Некорректная структура корпусов');
    need(p.buildingMode==='single'?buildings.length===1:buildings.length>=2,'Количество корпусов не соответствует структуре ЖК');
    for(const b of buildings){text(b.name,'Название корпуса',250);boolean(b.active,'Активность корпуса');}
    const tech=optionalObject(p.technical,'Технические характеристики');
    for(const [k,label] of [['total','Всего квартир'],['floors','Этажность'],['perFloor','Квартир на этаже'],['parkingLevels','Уровней паркинга'],['guestParking','Гостевых машино-мест']])numeric(tech[k],label,{integer:true});
    text(tech.parkingSize,'Размер машино-мест');boolean(tech.penthouseFloor,'Этаж с пентхаусами');
    numeric(tech.ceilingHeight,'Высота потолков',{positive:true});text(tech.finishing,'Отделка',500);for(const [k,l] of [["privateElevator","Индивидуальный лифт"],["backupGenerator","Резервный генератор"],["evCharging","Зарядка электромобилей"],["accessControl","Контроль доступа"],["smartHome","Система «Умный дом»"],["soundInsulation","Улучшенная звукоизоляция"]])boolean(tech[k],l);
    const architecture=optionalObject(p.architectureDesign,'Архитектура и дизайн');for(const k of ['architecture','interiors','landscape','development','jointDevelopment'])text(architecture[k],k);
    const sales=optionalObject(p.sales,'Статус продаж');need(missing(sales.status)||['none','launch','sold70','sold90','last'].includes(sales.status),'Некорректный статус продаж');
    stringIds(p.highlights,'Ключевые преимущества',3);stringIds(p.amenities,'Инфраструктура');
    for(const [index,x] of array(p.surroundings,'Окружение',true).entries()){target.surroundingIndex=index;need(object(x)&&id(x.category),'Некорректная категория окружения');text(x.name,'Название объекта окружения',500);url(x.mapsUrl,'Карта объекта окружения');for(const k of ['distanceKm','walkMin','driveMin','transitMin'])numeric(x[k],k);}
    delete target.surroundingIndex;
    boolean(p.surroundingsEnabled,'Показ раздела Что поблизости');stringIds(p.surroundingsPriorityIds,'Приоритетные объекты окружения',5);stringIds(p.audienceProfiles,'Целевая аудитория',8);need((p.audienceProfiles||[]).every(k=>["family","youth","business","resort","investment","quiet","student","tourist_rental"].includes(k)),'Неизвестный профиль целевой аудитории');boolean(p.surroundingsAuto,'Автоматический подбор окружения');stringIds(p.surroundingsExcludedIds,'Исключённые объекты окружения',10000);
    const nearbyIds=new Set();for(const x of array(p.surroundingsLinks,'Объекты из базы окружения',true)){need(object(x)&&id(x.objectId)&&!nearbyIds.has(x.objectId)&&Object.keys(x).every(k=>['objectId','distanceKm','travelMinutes','travelMode'].includes(k)),'Некорректная или повторная связь с объектом окружения');nearbyIds.add(x.objectId);numeric(x.distanceKm,'Расстояние до объекта окружения',{max:20050});numeric(x.travelMinutes,'Время в пути',{integer:true,positive:true,max:100000});need(missing(x.travelMode)||['walk','car','public'].includes(x.travelMode),'Некорректный способ передвижения');need(missing(x.travelMinutes)===missing(x.travelMode),'Укажите одновременно время в пути и способ передвижения');}
    const plans=array(p.plans,'Планировки');uniqueIds(plans,'планировка');const byId=new Map(plans.map(a=>[a.id,a]));
    const types=plans.filter(a=>missing(a.parentId));
    for(const a of plans){
      target={propertyUid:p.uid,propertyId:p.id,planId:a.id};
      context='ЖК «'+p.title+'», планировка '+a.id;
      const child=!missing(a.parentId);if(child)need(id(a.parentId)&&a.parentId!==a.id&&byId.has(a.parentId)&&missing(byId.get(a.parentId).parentId),'Некорректная связь с родительским типом');
      boolean(a.available,'Показывать планировку на сайте');numeric(a.priceBrl,'Цена',{positive:true});
      const s=optionalObject(a.spec,'Характеристики');
      need(missing(s.apartmentType)||specs.has(s.apartmentType),'Некорректный тип квартиры');
      range(s.areaMin,s.areaMax,'Площадь',{positive:true});
      for(const [k,label] of [['bedrooms','Спальни'],['suites','Спальни с санузлом'],['bathrooms','Санузлы'],['parking','Машино-места']])numeric(s[k],label,{integer:true});
      need(missing(s.suites)||missing(s.bedrooms)||s.suites<=s.bedrooms,'Спален с санузлом больше, чем спален');
      need(missing(s.suites)||missing(s.bathrooms)||s.suites<=s.bathrooms,'Спален с санузлом больше, чем санузлов');
      need(s.apartmentType!=='studio'||( (missing(s.bedrooms)||s.bedrooms===0)&&(missing(s.suites)||s.suites===0) ),'У студии не может быть отдельной спальни');
      for(const k of flags)boolean(s[k],k);
      const at=optionalObject(a.technical,'Данные типа');numeric(at.count,'Количество квартир',{integer:true});if(child){boolean(at.sold,'Все проданы');numeric(at.remaining,'Осталось в продаже',{integer:true});need(missing(at.remaining)||missing(at.count)||at.remaining<=at.count,'Остаток превышает общее количество квартир');need(missing(at.remaining)||(at.sold===true?at.remaining===0:at.sold!==false||at.remaining!==0),'Противоречивый статус продаж');}else{need(!Object.hasOwn(at,'sold')&&!Object.hasOwn(at,'remaining'),'Статус и остаток указываются только у варианта планировки');}
      if(a.media!=null)media(a.media,'Чертёж');
      for(const [index,l] of array(a.locations,'Расположение квартиры',true).entries()){target.locationIndex=index;need(object(l),'Некорректное расположение квартиры');need(missing(l.buildingId)||buildingIds.has(l.buildingId),'Планировка ссылается на отсутствующий корпус');range(l.floorMin,l.floorMax,'Этаж',{integer:true,min:-Number.MAX_SAFE_INTEGER});if(!missing(l.unit))need(string(l.unit)||Number.isSafeInteger(l.unit),'Некорректный номер квартиры');}
      delete target.locationIndex;const tr=optionalObject(a.translations,'Переводы');for(const [language,v] of Object.entries(tr)){need(object(v),'Некорректный перевод '+language);text(v.title,'Название планировки');text(v.description,'Описание планировки');}
    }
  }
}

const $=id=>document.getElementById(id);let data=[],selected=0,developers=[],mode="properties",devSelected=0,staleDraft=null;
let permissions={}, deleted=new Map();
const allowed=k=>permissions[k]!==false;
let published=new Map(), unlocked=new Set(), manualLocks=new Set(), histories=new Map(), freeze=false;
const keyOf=p=>p.uid||p.page;
const locked=p=>published.has(keyOf(p))?!unlocked.has(keyOf(p)):manualLocks.has(keyOf(p));
function eq(a,b){if(a===b)return true;if(!a||!b||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b))return false;const k=Object.keys(a);return k.length===Object.keys(b).length&&k.every(x=>Object.hasOwn(b,x)&&eq(a[x],b[x]));}
function record(){for(const p of data){const k=keyOf(p);let h=histories.get(k);if(!h){histories.set(k,{past:[],future:[],last:structuredClone(p)});continue}if(!eq(h.last,p)){h.past.push(h.last);if(h.past.length>20)h.past.shift();h.future=[];h.last=structuredClone(p);}}}
function restoreStep(p,redo=false){const h=histories.get(keyOf(p));if(!h||locked(p))return;const from=redo?h.future:h.past,to=redo?h.past:h.future;if(!from.length)return;to.push(h.last);h.last=from.pop();data[selected]=structuredClone(h.last);render();}
function protectEditor(root,p){if(!locked(p))return;for(const n of root.querySelectorAll("input,select,textarea,button"))if(!n.closest(".editor-fold-controls,.property-lock-controls")){n.disabled=true;n.dataset.lockedHit="1";}for(const n of root.querySelectorAll("[draggable]")){n.draggable=false;n.ondrop=null;n.ondragstart=null;n.ondragover=null;}for(const n of root.querySelectorAll(".upload")){n.ondrop=null;n.ondragover=null;n.dataset.lockedHit="1";}}
function lockControls(parent,p){const g=el("div",undefined,parent);g.className="property-lock-controls";button(g,locked(p)?"🔒 Разблокировать":"🔓 Заблокировать",()=>{const k=keyOf(p);if(published.has(k)){if(locked(p))unlocked.add(k);else unlocked.delete(k);}else{if(locked(p))manualLocks.delete(k);else manualLocks.add(k);}render()});const h=histories.get(keyOf(p));button(g,"↶ Отменить",()=>restoreStep(p)).disabled=locked(p)||!h?.past.length;button(g,"↷ Повторить",()=>restoreStep(p,true)).disabled=locked(p)||!h?.future.length;button(g,"Восстановить опубликованную версию",()=>{if(!confirm("Отменить изменения только этого ЖК?"))return;data[selected]=structuredClone(published.get(keyOf(p)));render()}).disabled=locked(p)||!published.has(keyOf(p));if(locked(p))for(const b of [...g.querySelectorAll("button")].slice(1))b.dataset.lockedHit="1";}

const defaultCountry='brazil',defaultCity='rio-de-janeiro';let countries=[],cities=[],geoCityId=defaultCity,geoDistrictName="",geoNeighborhoodName="";
const geoPath=p=>`${p.countryId||defaultCountry}/${p.cityId||defaultCity}/`;
function geoDefaults(p){p.countryId??=defaultCountry;p.cityId??=defaultCity;p.uid??=p.isNew?crypto.randomUUID():`br-rio-${p.developer}-${p.id}`;p.location??={};if(p.cityId===defaultCity&&!p.location.district&&geoKey(p.location.neighborhood)===geoKey("Península"))p.location.district="Barra da Tijuca";p.location.latitude??=null;p.location.longitude??=null;p.priceUpdatedAt??=null;p.source??=null;return p;}
function migrateGeo(v){return typeof v==='string'?v.replace(/(^|\/properties\/)(tegra\/|shared\/peninsula\/)/g,'$1brazil/rio-de-janeiro/$2'):Array.isArray(v)?v.map(migrateGeo):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,migrateGeo(x)])):v;}
function parseCoordinatePair(raw){
  const t=String(raw).trim();if(!t)return [null,null];
  const m=t.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/);
  if(!m)return null;const a=Number(m[1]),b=Number(m[2]);return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180?[a,b]:null;
}
function coordinatePair(parent,target){
  const a=target.latitude,b=target.longitude;
  const value=typeof a==='string'?a:a==null&&b==null?'':`${a??''}, ${b??''}`;
  const i=field(parent,'Координаты',value,()=>{});i.placeholder='-22.983425, -43.361872';i.autocomplete='off';i.spellcheck=false;
  const message='Вставьте широту и долготу через запятую, например -22.983425, -43.361872';
  i.setCustomValidity(parseCoordinatePair(value)?'':message);
  i.oninput=()=>{const pair=parseCoordinatePair(i.value);i.setCustomValidity(pair?'':message);if(pair){[target.latitude,target.longitude]=pair;i.removeAttribute('aria-invalid');i.classList.remove('field-error');}else{target.latitude=i.value;target.longitude=null;i.setAttribute('aria-invalid','true');}};
  i.onchange=()=>{if(!i.validity.valid)i.reportValidity();else{const pair=parseCoordinatePair(i.value);i.value=pair[0]===null?'':pair.join(', ');}saveDraft();};return i;
}
const statuses=[['none','Без плашки'],['launch','Старт продаж'],['sold70','Продано более 70%'],['sold90','Продано более 90%'],['last','Последние квартиры в продаже']];
function el(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
function parseNumeric(raw,money=false){
  const t=String(raw).trim();if(!t)return null;
  const plain=money?t.replace(/^R\$\s*/i,'').trim():t;
  if(money){if(!(/^\d+$/.test(plain)||/^\d{1,3}(?:[.\s]\d{3})+$/.test(plain)))return raw;const n=Number(plain.replace(/[.\s]/g,''));return Number.isSafeInteger(n)?n:raw;}
  if(!/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(plain))return raw;
  const n=Number(plain.replace(',','.'));return Number.isFinite(n)?n:raw;
}
function field(parent,label,value,change,type='text'){
  const l=el('label',label,parent),i=el(type==='textarea'?'textarea':'input',undefined,l);i.setAttribute('aria-label',label);
  if(type!=='textarea')i.type=['money','number'].includes(type)?'text':type;
  i.value=type==='money'&&typeof value==='number'?value.toLocaleString('ru-RU'):value??'';
  if(type==='number'||type==='money'){i.dataset.numeric=type;i.inputMode=type==='money'?'numeric':'decimal';if(type==='number'){i.min='0';i.step='any';}}
  i.oninput=()=>{i.removeAttribute('aria-invalid');i.classList.remove('field-error');i.setCustomValidity('');if(type==='money'||type==='number'){change(parseNumeric(i.value,type==='money'));}else change(i.value);};
  i.onblur=()=>{if(type==='money'){const v=parseNumeric(i.value,true);if(typeof v==='number')i.value=v.toLocaleString('ru-RU');}};return i;
}
function select(p,label,options,value,fn){const s=el('select',undefined,el('label',label,p));s.setAttribute('aria-label',label);for(const [v,t] of options){el('option',t,s).value=v;}s.value=value;s.onchange=()=>fn(s.value);return s;}
function check(p,label,value,fn){const l=el('label',undefined,p);l.className='check';const i=el('input',undefined,l);i.type='checkbox';i.checked=!!value;i.onchange=()=>fn(i.checked);el('span',label,l);}
function button(p,t,fn){const b=el('button',t,p);b.type='button';b.onclick=fn;return b;}
function grid(p){const g=el('div',undefined,p);g.className='fields';return g;}
const openSections=new Set();function fold(parent,p,title){const key=p.page+'|'+title.replace(/ \(\d+\)$/,''),d=el('details',undefined,parent);d.className='architecture-editor folded-editor';d.open=openSections.has(key);el('summary',title,d);d.ontoggle=()=>{if(d.open)openSections.add(key);else openSections.delete(key)};return d;}function article(p,t){const a=el('article',undefined,p);el('h3',t,a);return a;}
function leaves(p){return p.plans.filter(a=>!a.parentId&&a.available!==false);}
function minimum(p,key){const vals=leaves(p).filter(a=>key!=='price'||typeOnSale(p.plans,a)).map(a=>key==='price'?a.priceBrl:a.spec.areaMin).filter(v=>Number.isFinite(v)&&v>0);return vals.length?Math.min(...vals):null;}
function refresh(p){const price=minimum(p,'price'),areas=p.plans.filter(x=>!x.parentId).map(x=>x.spec).filter(x=>Number.isFinite(x?.areaMin)&&x.areaMin>0),area=areas.length?Math.min(...areas.map(x=>x.areaMin)):null,max=areas.length?Math.max(...areas.map(x=>Math.max(x.areaMin,Number.isFinite(x.areaMax)&&x.areaMax>0?x.areaMax:x.areaMin))):null;$('summary').textContent=(price===null?'Цена уточняется':'Цена от: R$ '+price.toLocaleString('ru-RU'))+' · Площадь квартир: '+(area===null?'—':area.toLocaleString('ru-RU')+(max!==area?'–'+max.toLocaleString('ru-RU'):'')+' м²');const a=p.territoryArea;$('orient').textContent=a>0?(a>=3570?'Футбольных полей: '+(a/7140).toLocaleString('ru-RU',{maximumFractionDigits:1}):'Теннисных кортов: '+Math.round(a/260.7569)):'Ориентир не указан';}
function activityToggle(parent,item,card=false){const l=el('label',undefined,parent);l.className='activity-toggle';const i=el('input',undefined,l);i.type='checkbox';i.setAttribute('role','switch');i.setAttribute('aria-label','Активность: '+(item.title||item.name));i.checked=item.active!==false;i.disabled=data.includes(item)&&(locked(item)||!allowed("canHideProperty"));if(data.includes(item)&&locked(item))i.dataset.lockedHit="1";el('span',undefined,l).className='switch-track';if(card)el('span',i.checked?'Активен':'Неактивен',l).className='switch-caption';i.onchange=()=>{item.active=i.checked;renderList();renderDevList();if((mode==='properties'?data[selected]:developers[devSelected])===item){const c=$('editor').querySelector('.activity-toggle input');if(c){c.checked=i.checked;c.parentElement.querySelector('.switch-caption').textContent=i.checked?'Активен':'Неактивен';}}saveDraft();};}
function sidebarItem(parent,item,title,current,open){const r=el('div',undefined,parent);r.className='sidebar-item'+(item.active===false?' inactive':'')+(current?' selected':'');button(r,title,open).setAttribute('aria-current',String(current));activityToggle(r,item);return r;}
function renderTrash(){const n=$('deleted-properties');n.replaceChildren();if(!deleted.size)return;el('h3','Удалённые ЖК (до публикации)',n);for(const [k,p] of deleted){const b=button(n,'↶ Восстановить '+p.title,()=>{if(!developers.some(d=>d.id===p.developer)){alert('Сначала восстановите застройщика.');return;}if(data.some(x=>keyOf(x)===k||x.page===p.page)){alert('ЖК с таким адресом уже существует.');return;}data.push(structuredClone(p));deleted.delete(k);selected=data.length-1;mode='properties';render();});b.disabled=freeze;}}

let reorderDrag=null, catalogOrderUndo=[];
function reorderControls(host,row,items,item,move,scope,canMove=()=>true){
 const controls=el('span',undefined,host);controls.className='reorder-controls';
 const handle=button(controls,'⠿',e=>{e.preventDefault();e.stopPropagation();});handle.className='reorder-handle';handle.title='Перетащить для изменения порядка';handle.setAttribute('aria-label','Перетащить для изменения порядка');handle.draggable=canMove();handle.disabled=!canMove();
 const index=items.indexOf(item);for(const [step,arrow] of [[-1,'↑'],[1,'↓']]){const b=button(controls,arrow,e=>{e.preventDefault();e.stopPropagation();if(canMove()&&items[index+step])move(item,items[index+step]);});b.setAttribute('aria-label',step<0?'Переместить выше':'Переместить ниже');b.disabled=!canMove()||!items[index+step];}
 handle.ondragstart=e=>{if(!canMove()){e.preventDefault();return;}reorderDrag={scope,item};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-bc-order','1');e.stopPropagation();};
 handle.ondragend=()=>{reorderDrag=null;};
 row.addEventListener('dragover',e=>{if(reorderDrag?.scope===scope&&reorderDrag.item!==item){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';}});
 row.addEventListener('drop',e=>{if(reorderDrag?.scope!==scope)return;e.preventDefault();e.stopPropagation();const from=reorderDrag.item;reorderDrag=null;if(from!==item)move(from,item);});
 return controls;
}
function moveItem(list,from,to){const i=list.indexOf(from),j=list.indexOf(to);if(i<0||j<0||i===j)return false;list.splice(j,0,list.splice(i,1)[0]);return true;}
function movePlan(p,from,to){if(freeze||operationBusy||locked(p)||(from.parentId||null)!==(to.parentId||null))return;const list=p.plans.filter(a=>(a.parentId||null)===(from.parentId||null));if(!moveItem(list,from,to))return;let i=0;p.plans=p.plans.map(a=>(a.parentId||null)===(from.parentId||null)?list[i++]:a);render();}
function moveProperty(from,to){if(freeze||operationBusy||locked(from)||!data.includes(to))return;const current=data[selected],before=data.map(keyOf);if(!moveItem(data,from,to))return;catalogOrderUndo.push(before);if(catalogOrderUndo.length>20)catalogOrderUndo.shift();selected=data.indexOf(current);render();}
function undoCatalogOrder(){if(freeze||operationBusy)return;const before=catalogOrderUndo.at(-1);if(!before)return;const byId=new Map(data.map(p=>[keyOf(p),p]));if(before.length!==data.length||before.some(k=>!byId.has(k))){catalogOrderUndo=[];renderList();return;}const current=data[selected];catalogOrderUndo.pop();data=before.map(k=>byId.get(k));selected=data.indexOf(current);render();}
function renderList(){renderTrash();const n=$('list');n.replaceChildren();if(data.length>1){const b=button(n,'↶ Отменить перестановку ЖК',undoCatalogOrder);b.className='order-undo';b.disabled=freeze||!catalogOrderUndo.length;}let previous;for(const [i,p] of data.entries()){if(p.developer!==previous){el('div',developers.find(d=>d.id===p.developer)?.name||p.developer,n).className='sidebar-group';previous=p.developer;}const r=sidebarItem(n,p,p.title,mode==='properties'&&i===selected,()=>{mode='properties';selected=i;render()});reorderControls(r,r,data,p,moveProperty,'catalog',()=>!freeze&&!locked(p));}}
const types=[['standard','Обычная квартира'],['studio','Студия'],['loft','Лофт'],['garden','Garden'],['duplex','Двухуровневая квартира'],['triplex','Трёхуровневая квартира'],['penthouse','Одноуровневый пентхаус'],['penthouse-duplex','Двухуровневый пентхаус'],['penthouse-triplex','Трёхуровневый пентхаус']];
const bedrooms=[['','Не указано'],['0','0 — студия'],...Array.from({length:6},(_,i)=>[String(i+1),i===5?'6+':String(i+1)])];
const extras=[['garden','Собственный дворик / терраса'],['staff','Комната для персонала'],['pool','Собственный бассейн'],['sauna','Собственная сауна'],['bath','Ванна'],['jacuzzi','Джакузи'],['privateElevator','Индивидуальный лифт'],['serviceEntrance','Отдельный служебный вход'],['barbecue','Своя зона барбекю'],['doubleHeight','Второй свет'],['designRenovation','Дизайнерский ремонт'],['authorInterior','Авторский интерьер'],['fullyFurnished','Полностью меблирована']];
function remove(p,label,fn){const b=button(p,'×',()=>{if(confirm(label+'?'))fn()});b.className='remove';b.title=label;b.setAttribute('aria-label',label);return b;}
function repeat(p,title){const r=el('div',undefined,p);r.className='repeat';el('h4',title,r);return r;}
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
function typeName(s){const n=s.bedrooms;const b=n==null?'':n===0?'':n===1?'1 спальня':n<5?n+' спальни':(n===6?'6+':n)+' спален';const t=types.find(x=>x[0]===s.apartmentType)?.[1]||'';return [s.apartmentType==='standard'?'':t,b].filter(Boolean).join(' · ')||'Обычная квартира';}
function typeFields(g,s,update){
 let bed;
 const suiteInput=()=>g.querySelector('[aria-label="Спальни с собственным санузлом"]');
 select(g,'Тип квартиры',types,s.apartmentType||'standard',v=>{
   s.apartmentType=v;s.duplex=v==='duplex'||v==='penthouse-duplex';
   if(v==='studio'){s.bedrooms=0;s.suites=0;}
   const suites=suiteInput();if(suites){if(v==='studio')suites.value='0';suites.disabled=v==='studio';}
   bed.value=String(s.bedrooms??'');bed.disabled=v==='studio';update();
 });
 bed=select(g,'Количество спален',bedrooms,String(s.bedrooms??''),v=>{
   s.bedrooms=v===''?null:Number(v);
   if(Number.isFinite(s.bedrooms)&&Number.isFinite(s.suites)&&s.suites>s.bedrooms){s.suites=s.bedrooms;const suites=suiteInput();if(suites)suites.value=String(s.suites);}
   update();
 });bed.disabled=s.apartmentType==='studio';
}
const collapsedPlans=new Set();
function salesStatusControl(parent,a,p){
  const fieldset=el('fieldset',undefined,parent);fieldset.className='sales-status';
  el('legend','Статус продаж',fieldset);
  const options=el('div',undefined,fieldset);options.className='sales-status-options';
  const radios=[];let count;
  const sync=()=>{const sold=a.technical?.sold===true||a.technical?.remaining===0;radios[0].checked=!sold;radios[1].checked=sold;count.disabled=sold;count.value=sold?'0':a.technical?.remaining??'';};
  for(const [sold,title] of [[false,'В продаже'],[true,'Все проданы']]){
    const label=el('label',undefined,options),input=el('input',undefined,label);
    input.type='radio';input.name='sales-status-'+a.id;input.value=sold?'sold':'selling';radios.push(input);
    el('span',title,label);
    input.onchange=()=>{if(!input.checked)return;a.technical??={};a.technical.sold=sold;a.technical.remaining=sold?0:null;sync();refresh(p);saveDraft();};
  }
  count=field(fieldset,'Осталось в продаже',a.technical?.remaining,v=>{a.technical??={};a.technical.remaining=v;a.technical.sold=v===0;if(v===0)sync();refresh(p);saveDraft();},'number');
  count.step='1';count.min='0';count.placeholder='Не указано';sync();
}
function locationFields(parent,p,a){
  const d=el('details',undefined,parent);d.className='plan-location';el('summary','Корпус, этаж и номер квартиры (необязательно)',d);
  for(const [index,l] of (a.locations||[]).entries()){
    const box=repeat(d,'Расположение № '+(index+1));box.dataset.locationIndex=String(index);const g=grid(box);
    const opts=[['','Не указан'],...p.buildings.map((b,i)=>[b.id,b.name||'Корпус № '+(i+1)])];if(l.buildingId&&!opts.some(x=>x[0]===l.buildingId))opts.push([l.buildingId,'Отсутствующий корпус']);
    select(g,'Корпус',opts,l.buildingId||'',v=>l.buildingId=v||null);
    field(g,'Этаж от',l.floorMin,v=>l.floorMin=v,'number');field(g,'Этаж до',l.floorMax,v=>l.floorMax=v,'number');field(g,'Номер квартиры',l.unit,v=>l.unit=v);
    remove(box,'Удалить расположение',()=>{a.locations.splice(index,1);render()});
  }
  button(d,'+ Добавить расположение',()=>{a.locations??=[];a.locations.push({buildingId:null,floorMin:null,floorMax:null,unit:''});render();const scope=[...$('editor').querySelectorAll('[data-plan-id]')].find(x=>x.dataset.planId===a.id);if(scope){for(let n=scope;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;const details=scope.querySelector('.plan-location');if(details)details.open=true;}});
}
function planCard(p,a,parent,num){const shell=el('details',undefined,parent);shell.className='plan-group';shell.dataset.planId=a.id;shell.open=openSections.has(p.page+'|plan|'+a.id);shell.ontoggle=()=>{const k=p.page+'|plan|'+a.id;if(shell.open)openSections.add(k);else openSections.delete(k)};const heading=el('summary',undefined,shell),label=el('span','Тип № '+num+' — '+typeName(a.spec),heading);const del=button(heading,'×',e=>{e.preventDefault();e.stopPropagation();if(confirm('Удалить тип и его чертежи?')){p.plans=p.plans.filter(b=>b.id!==a.id&&b.parentId!==a.id);render()}});del.hidden=!allowed('canDeletePlan')&&!!published.get(keyOf(p))?.plans.some(x=>x.id===a.id||x.parentId===a.id);del.className='type-delete';del.setAttribute('aria-label','Удалить тип');reorderControls(heading,shell,p.plans.filter(b=>!b.parentId),a,(from,to)=>movePlan(p,from,to),p.uid+'|types',()=>!locked(p)&&!freeze);const c=article(shell,'Тип квартиры'),g=grid(c),s=a.spec;const desc=field(g,'Краткое описание (необязательно)',planDescription(a),v=>{a.translations??={};a.translations.ru??={};a.translations.ru.description=v;syncDescription();saveDraft();},'textarea');desc.placeholder='Можно добавить описание вручную';const descMode=el('small','',desc.parentElement);const resetDesc=button(desc.parentElement,'Восстановить автоматическое описание',()=>{if(a.translations?.ru){delete a.translations.ru.description;if(!Object.keys(a.translations.ru).length)delete a.translations.ru;if(!Object.keys(a.translations).length)delete a.translations;}syncDescription();saveDraft();});function syncDescription(){const manual=typeof a.translations?.ru?.description==='string';desc.value=planDescription(a);descMode.textContent=manual?'Ручное описание':'Автоматическое описание';resetDesc.hidden=!manual;}syncDescription();const customTitle=field(g,'Заголовок на сайте (необязательно)',a.translations?.ru?.title,v=>{a.translations??={};a.translations.ru??={};a.translations.ru.title=v;});customTitle.maxLength=120;customTitle.placeholder='По умолчанию: количество спален';typeFields(g,s,()=>{label.textContent='Тип № '+num+' — '+typeName(s);syncDescription();refresh(p);saveDraft()});for(const [k,t] of [['areaMin','Площадь от, м²'],['areaMax','Площадь до, м²'],['suites','Спальни с собственным санузлом'],['bathrooms','Санузлы'],['parking','Машино-места']]){const input=field(g,t,s[k],v=>{s[k]=v;refresh(p)},'number');if(k==='suites'&&s.apartmentType==='studio')input.disabled=true;if(k==='areaMin'){input.min='0.01';}if(['suites','bathrooms','parking'].includes(k))input.step='1';if(k==='areaMax'){input.placeholder='Необязательно';input.min=String(s.areaMin||0);input.onfocus=()=>{input.min=String(s.areaMin||0)};}}field(g,'Цена от, R$',a.priceBrl,v=>{a.priceBrl=v;p.priceUpdatedAt=new Date().toISOString();refresh(p)},'money');check(g,'Показывать планировку на сайте',a.available!==false,v=>{if(!v&&!allowed('canHideLastPlan')&&published.get(keyOf(p))?.plans.some(x=>!x.parentId&&x.available!==false)&&!p.plans.some(x=>x!==a&&!x.parentId&&x.available!==false)){alert('Нельзя скрыть последнюю доступную планировку.');render();return;}a.available=v;refresh(p)});el('h4','Дополнительные характеристики',c);const eg=grid(c);for(const [k,t] of extras)check(eg,t,s[k],v=>{s[k]=v;syncDescription();saveDraft()});if(s.finished===true)check(eg,'С отделкой (старые данные, не дизайнерский ремонт)',true,v=>{s.finished=v;syncDescription();saveDraft()});if(s.furnished===true)check(eg,'С мебелью (старые данные)',true,v=>{s.furnished=v;syncDescription();saveDraft()});if(a.technical){el('h4','Данные по всему комплексу',c);const tg=grid(c);for(const [k,l] of [['count','Количество квартир']])field(tg,l,a.technical[k],v=>a.technical[k]=v,'number');}locationFields(c,p,a);el('h4','Варианты планировки',c);const variants=el('div',undefined,c);variants.className='drawing-list';const children=p.plans.filter(b=>b.parentId===a.id);children.forEach((b,i)=>{const r=el('div',undefined,variants);r.className='drawing-item';r.dataset.planId=b.id;el('strong','Вариант '+(i+1),r);salesStatusControl(r,b,p);locationFields(r,p,b);if(b.media)mediaPreview(r,b.media);else el('p','Чертёж пока не добавлен',r);const u=uploader(r,false,items=>{b.media=items[0];render()});u.querySelector('p').textContent=b.media?'Заменить чертёж':'Добавить чертёж';button(r,'Удалить вариант',()=>{if(confirm('Удалить вариант планировки?')){p.plans=p.plans.filter(x=>x!==b);render()}}).className='drawing-delete';if(!allowed('canDeletePlan')&&published.get(keyOf(p))?.plans.some(x=>x.id===b.id))r.querySelector('.drawing-delete').hidden=true;reorderControls(r,r,children,b,(from,to)=>movePlan(p,from,to),p.uid+'|'+a.id,()=>!locked(p)&&!freeze);});planUpload(c,p,a);button(c,'+ Добавить вариант без чертежа',()=>{p.plans.push({id:crypto.randomUUID(),parentId:a.id,available:true,locations:[],technical:{sold:false,remaining:null}});render()});}

function migrateHotel(p){p.amenities??=[];if(p.hotelService===true&&!p.amenities.includes('hotel-service'))p.amenities.push('hotel-service');delete p.hotelService;}
function renderHighlights(root,p){p.highlights??=[];const d=fold(root,p,'Ключевые преимущества');el('p','До трёх преимуществ. Порядок выбора соответствует порядку на сайте.',d);const g=grid(d);const controls=[];for(let i=0;i<3;i++){const control=select(g,'Преимущество '+(i+1),[['','Не выбрано'],...window.BCHighlights.map(x=>[x.id,x.emoji+' '+x.labels.ru])],p.highlights[i]||'',()=>{p.highlights=controls.map(c=>c.value).filter(Boolean);p.highlights=[...new Set(p.highlights)];sync();saveDraft()});controls.push(control)}function sync(){controls.forEach((c,i)=>{c.value=p.highlights[i]||'';for(const o of c.options)o.disabled=!!o.value&&p.highlights.includes(o.value)&&o.value!==c.value;});}sync();}
function renderAmenities(root,p){migrateHotel(p);const d=fold(root,p,'Инфраструктура ЖК');for(const group of window.BCAmenities){const h=el('h4',group.labels.ru,d);h.className='amenity-category';const g=grid(d);for(const item of group.items)check(g,item.emoji+' '+item.labels.ru,p.amenities.includes(item.id)||(item.id==='ev'&&p.technical?.evCharging===true),v=>{p.amenities=p.amenities.filter(x=>x!==item.id);if(v)p.amenities.push(item.id);if(item.id==='ev'&&p.technical&&Object.hasOwn(p.technical,'evCharging'))p.technical.evCharging=false;saveDraft();});}}
function renderLegacySurroundings(root,p){p.surroundings??=[];const d=fold(root,p,'Окружение (старые записи)');const opts=window.BCSurroundings.map(x=>[x[0],x[1]+' '+x[2]]);const sources=data.filter(x=>x!==p&&x.surroundings?.length);if(sources.length){const source=select(d,'Копировать окружение из ЖК',[['','Выберите ЖК'],...sources.map((x,i)=>[String(i),x.title])],'',()=>{});button(d,'Копировать',()=>{if(source.value==='')return;if(p.surroundings.length&&!confirm('Добавить объекты к существующему списку?'))return;p.surroundings.push(...JSON.parse(JSON.stringify(sources[Number(source.value)].surroundings)));render()});}p.surroundings.forEach((x,i)=>{const box=repeat(d,'Объект № '+(i+1));box.dataset.surroundingIndex=String(i);const g=grid(box);select(g,'Категория',opts,x.category,v=>x.category=v);field(g,'Название места',x.name,v=>x.name=v);for(const [k,t] of [['distanceKm','Расстояние, км'],['walkMin','Пешком, мин'],['driveMin','На автомобиле, мин'],['transitMin','Общественный транспорт, мин']])field(g,t,x[k],v=>x[k]=v,'number');field(g,'Ссылка на Google Maps',x.mapsUrl,v=>x.mapsUrl=v,'url');for(const [delta,label] of [[-1,'↑ Выше'],[1,'↓ Ниже']]){const b=button(box,label,()=>{const j=i+delta;[p.surroundings[i],p.surroundings[j]]=[p.surroundings[j],p.surroundings[i]];render()});b.disabled=i+delta<0||i+delta>=p.surroundings.length;}remove(box,'Удалить объект',()=>{p.surroundings.splice(i,1);render()});});button(d,'+ Добавить объект',()=>{p.surroundings.push({category:'shopping',name:'',distanceKm:null,walkMin:null,driveMin:null,transitMin:null,mapsUrl:''});render()});}
function renderSurroundings(root,p){
 const d=fold(root,p,'Что поблизости');const api=window.BCNearbyDistance;
 check(d,'Показывать раздел «Что поблизости» на сайте',p.surroundingsEnabled!==false,v=>{p.surroundingsEnabled=v;render();});
 if(p.surroundingsEnabled===false)el('p','Раздел отключён на сайте. Все настройки и привязки сохраняются; редактирование доступно.',d);
 el('p','Выберите объекты из общей базы, включая соседние города. Расстояние по прямой до ближайшей активной точки рассчитывается автоматически. При необходимости укажите расстояние и время вручную.',d);
 if(!api||!aroundBase||aroundBase!==publishBase){el('p','База окружения недоступна или устарела. Обновите каталог перед редактированием связей.',d);return ()=>{};}
 const audience=article(d,'Целевая аудитория');el('p','Необязательная внутренняя характеристика. Можно выбрать несколько профилей. Приоритет категории — максимальный балл выбранных профилей.',audience);for(const [id,label] of Object.entries(api.audienceProfiles))check(audience,label,(p.audienceProfiles||[]).includes(id),v=>{p.audienceProfiles=v?[...new Set([...(p.audienceProfiles||[]),id])]:(p.audienceProfiles||[]).filter(k=>k!==id);render();});
 const links=p.surroundingsLinks||[],byId=new Map(aroundItems.map(x=>[x.id,x]));
 const excluded=()=>p.surroundingsExcludedIds||[];
 const hide=id=>{p.surroundingsExcludedIds=[...new Set([...excluded(),id])];render();};
 const restore=id=>{p.surroundingsExcludedIds=excluded().filter(v=>v!==id);render();};
 check(d,'Автоматически подбирать объекты по категориям',p.surroundingsAuto!==false,v=>{p.surroundingsAuto=v;render();});
 el('p','Радиус и лимит берутся из настроек окружения. Ручные добавления и исключения имеют приоритет.',d);
 const priorityBox=article(d,'Приоритетные объекты');
 el('p','Закрепите до пяти объектов в нужном порядке. Остальные места заполняются по баллам и расстоянию. Приоритетные объекты должны быть доступны для показа.',priorityBox);
 const priorityRows=el('div',undefined,priorityBox);let prioritySignature='';
 function updatePriority(){
  const ids=p.surroundingsPriorityIds||[],ordered=api.orderedLinks(p,byId,aroundSettings),visible=new Map(ordered.map(v=>[v.x.id,v]));
  const choices=ordered.map(({x,link,score})=>[x.id,x.name,api.describe(p.location,x,link).text+' · '+score+' баллов']);
  const signature=JSON.stringify([ids,choices]);if(signature===prioritySignature)return;prioritySignature=signature;priorityRows.replaceChildren();
  const setIds=v=>{p.surroundingsPriorityIds=v;render();};
  el('p','Закреплено: '+ids.length+' из 5',priorityRows);
  for(const [i,id] of ids.entries()){
   const x=byId.get(id),row=repeat(priorityRows,(i+1)+'. '+(x?.name||id));
   if(!visible.has(id))el('p','Сейчас недоступен для показа. Место займёт следующий объект.',row);
   for(const [delta,label] of [[-1,'↑ Выше'],[1,'↓ Ниже']]){const b=button(row,label,()=>{const v=[...ids];[v[i],v[i+delta]]=[v[i+delta],v[i]];setIds(v);});b.disabled=i+delta<0||i+delta>=ids.length;}
   button(row,'Открепить',()=>setIds(ids.filter(v=>v!==id)));
  }
  const list=el('div',undefined,priorityRows);
  for(const [id,name,distance] of choices){if(ids.includes(id))continue;check(list,name+(distance?' · '+distance:''),false,v=>{if(v&&ids.length<5)setIds([...ids,id]);});const input=list.lastElementChild.querySelector('input');input.disabled=ids.length>=5;}
  if(ids.length)button(priorityRows,'Вернуться к автоматическому подбору',()=>setIds([]));
  el('p','На сайте без раскрытия: '+(ordered.slice(0,5).map(v=>v.x.name).join(' · ')||'нет объектов'),priorityRows);
  if(locked(p))protectEditor(priorityRows,p);
 }
 const auto=article(d,'Автоматически подобранные объекты');
 const hidden=article(d,'Скрытые объекты');
 if(!excluded().length)el('p','Нет исключений.',hidden);
 for(const id of excluded()){const x=byId.get(id),row=repeat(hidden,x?.name||'Объект отсутствует в базе');button(row,'Вернуть в подбор',()=>restore(id));}
 const autoRows=new Map();
 function updateAuto(){const current=api.selectLinks(p,byId,aroundSettings).filter(v=>v.automatic);const ids=new Set(current.map(v=>v.x.id));for(const [id,row] of autoRows)if(!ids.has(id)){row.box.remove();autoRows.delete(id);}
  for(const {x,categories} of current){let row=autoRows.get(x.id);if(!row){const box=repeat(auto,x.name),text=el('p','',box);button(box,'Уточнить расстояние и время',()=>{(p.surroundingsLinks??=[]).push({objectId:x.id,distanceKm:null,travelMinutes:null,travelMode:''});render();});button(box,'Скрыть объект',()=>hide(x.id));row={box,text};autoRows.set(x.id,row);if(locked(p))protectEditor(box,p);}row.text.textContent=names({...x,categories})+' · '+api.format(api.nearest(p.location,x));}
  emptyAuto.hidden=!!current.length;emptyAuto.textContent=p.surroundingsAuto===false?'Автоматический подбор отключён.':'Нет объектов в заданных радиусах или не указаны координаты ЖК.';
 }
 const emptyAuto=el('p','',auto);
 const names=x=>[x.cityId!==p.cityId?(aroundCities.find(c=>c.id===x.cityId)?.name||x.cityId):'',aroundCats(x).map(id=>aroundGroups.flatMap(g=>g[1]).find(c=>c[0]===id)?.[1]||aroundLegacy.find(c=>c[0]===id)?.[1]||id).join(', ')].filter(Boolean).join(' · ');
 const candidates=aroundItems.filter(x=>api.active(x)&&!excluded().includes(x.id)&&!links.some(l=>l.objectId===x.id));
 const previews=[];let choices=[];
 const filterChoices=()=>{const selected=picker.value,q=aroundKey(search.value);picker.replaceChildren();for(const [id,label] of choices)if(!id||aroundKey(label).includes(q))el('option',label,picker).value=id;if([...picker.options].some(o=>o.value===selected))picker.value=selected;};
 const search=field(d,'Поиск по названию или категории','',filterChoices);
 const picker=select(d,'Объект окружения',[],'',()=>{});
 const updateDistances=()=>{const sorted=candidates.map(x=>({x,distance:api.nearest(p.location,x)})).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.x.name.localeCompare(b.x.name,'pt-BR'));choices=[['','Выберите объект'],...sorted.map(({x,distance})=>{const label=api.format(distance);return [x.id,x.name+' · '+names(x)+(label?' · '+label:'')];})];filterChoices();for(const update of previews)update();updateAuto();updatePriority();};
 button(d,'+ Добавить объект из базы',()=>{if(!picker.value||links.some(x=>x.objectId===picker.value)||!candidates.some(x=>x.id===picker.value))return;(p.surroundingsLinks??=[]).push({objectId:picker.value,distanceKm:null,travelMinutes:null,travelMode:''});render();});
 for(const [i,l] of links.entries()){
  const x=byId.get(l.objectId),usable=x&&api.active(x)&&!excluded().includes(l.objectId);const b=repeat(d,x?.name||'Объект отсутствует в базе');
  if(excluded().includes(l.objectId))el('p','Скрыт вручную. Настройки сохранены.',b);else if(!usable)el('p','Объект отсутствует, закрыт, не имеет активных точек с координатами. На сайте не отображается.',b);else el('p',names(x),b);
  const g=grid(b),preview=el('p','',b);const update=()=>{const v=api.describe(p.location,usable?x:null,l);preview.textContent=(usable?'На сайте: '+(v.text||'только название — нет координат'):'Не публикуется')+(usable&&v.label&&!v.manual?' (расстояние по прямой)':'');};
  field(g,'Расстояние вручную, км',l.distanceKm,v=>{l.distanceKm=v;update();updatePriority();},'number');
  field(g,'Время в пути, мин',l.travelMinutes,v=>{l.travelMinutes=v;update();updatePriority();},'number');
  select(g,'Способ передвижения',[['','Не указан'],['walk','Пешком'],['car','На авто'],['public','На общественном транспорте']],l.travelMode||'',v=>{l.travelMode=v;update();updatePriority();});previews.push(update);
  if(!excluded().includes(l.objectId))button(b,'Скрыть объект',()=>hide(l.objectId));else button(b,'Вернуть объект',()=>restore(l.objectId));
  remove(b,'Удалить ручные настройки',()=>{links.splice(i,1);render();});
 }
 updateDistances();return updateDistances;
}
function render(){for(const p of data){normalizePlans(p);migrateHotel(p);}saveDraft();renderList();renderDevList();const p=data[selected],root=$('editor');root.replaceChildren();if(mode==="developers"){renderDeveloper(root);return;}if(mode==="geography"){renderGeography(root);return;}if(mode==="surroundings-base"){renderSurroundingsBase(root);return;}if(mode==="surroundings-settings"){renderAroundSettings(root);return;}if(!p){el("p","Добавьте жилой комплекс.",root);return;}const titleRow=el('div',undefined,root);titleRow.className='editor-heading';el('h2',p.title,titleRow);activityToggle(titleRow,p,true);const controls=el('div',undefined,titleRow);controls.className='editor-fold-controls';button(controls,'Свернуть всё',()=>root.querySelectorAll('details').forEach(d=>d.open=false));button(controls,'Развернуть всё',()=>root.querySelectorAll('details').forEach(d=>d.open=true));lockControls(root,p);propertyImportControls(root,p);el('p','Папка объекта: properties/'+p.page,root).className='editor-path';const a=fold(root,p,'Основные сведения'),f=grid(a);field(f,'Название',p.title,v=>{p.title=v;renderList()});select(f,'Застройщик',developers.map(d=>[d.id,d.name]),p.developer,v=>{const d=developers.find(x=>x.id===v);if(!d)return;if(data.some(x=>x!==p&&x.developer===v&&x.id===p.id&&x.cityId===p.cityId)){alert('Такой ЖК уже существует');render();return;}p.developer=v;p.developerName=d.name;p.page=geoPath(p)+v+'/'+p.id+'/';render()}).disabled=!p.isNew;field(f,'Площадь территории, м²',p.territoryArea,v=>{p.territoryArea=v;refresh(p)},'number');field(f,'Срок сдачи',p.completionMonth,v=>{p.completionMonth=v;p.completion=v?new Date(v+'-15T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}):''},'month');check(f,'Объект сдан',p.completed,v=>p.completed=v);field(a,'Краткое описание ЖК (200–400 символов)',p.longDescription,v=>p.longDescription=v,'textarea');el('p','',a).id='orient';el('p','',a).id='summary';select(f,'Статус продаж',statuses,p.sales?.status||'none',v=>p.sales.status=v);f.append(f.querySelector('label.check'));mediaGallery(a,p,'hero','Главная фотография',true);
const l=article(fold(root,p,'Расположение комплекса'),'Расположение комплекса'),lg=grid(l),loc=p.location;geographyFields(lg,p,()=>render());for(const [k,t] of [['address','Адрес'],['mapsUrl','Ссылка на Google Maps']])field(lg,t,loc[k],v=>loc[k]=v);
let updateNearby=()=>{};const coordsInput=coordinatePair(lg,loc);coordsInput.addEventListener('input',()=>updateNearby());coordsInput.addEventListener('change',()=>updateNearby());field(lg,'Источник информации',p.source,v=>p.source=v);
mediaGallery(fold(root,p,'Галерея комплекса ('+(p.gallery||[]).length+')'),p,'gallery','Галерея комплекса');mediaGallery(fold(root,p,'Галерея расположения ('+(p.locationGallery||[]).length+')'),p,'locationGallery','Галерея расположения',false,true);const b=article(fold(root,p,'Корпуса'),'Корпуса');select(b,'Структура комплекса',[['single','Один корпус'],['multiple','Два и более корпусов']],p.buildingMode,v=>{if(v==='single'&&p.buildings.length>1){alert('Сначала перенесите привязки и удалите лишние корпуса.');render();return;}p.buildingMode=v;if(v==='multiple'&&p.buildings.length<2)p.buildings.push({id:crypto.randomUUID(),name:'',active:false});render()});if(p.buildingMode==='multiple'){p.buildings.forEach((x,i)=>{const box=repeat(b,'Корпус № '+(i+1)),r=grid(box);field(r,'Название корпуса',x.name,v=>x.name=v);check(r,'Активен',x.active!==false,v=>{x.active=v;refresh(p)});remove(box,'Удалить корпус',()=>{if(p.plans.some(a=>(a.locations||[]).some(l=>l.buildingId===x.id))){alert('Корпус связан с планировками.');return;}p.buildings=p.buildings.filter(y=>y!==x);if(p.buildings.length===1)p.buildingMode='single';render()})});button(b,'Добавить корпус',()=>{p.buildings.push({id:crypto.randomUUID(),name:'',active:false});render()});}
const t=article(fold(root,p,'Технические характеристики'),'Технические характеристики'),tg=grid(t);field(tg,'Жилые корпуса',p.buildings.length,()=>{},'number').disabled=true;for(const [k,l] of [['total','Всего квартир'],['floors','Этажность'],['perFloor','Квартир на типовом этаже'],['guestParking','Гостевых машино-мест'],['ceilingHeight','Высота потолков, м']])field(tg,l,p.technical[k],v=>p.technical[k]=v,'number');field(tg,'Отделка',p.technical.finishing,v=>p.technical.finishing=v);for(const [k,l] of [["privateElevator","Индивидуальный лифт"],["backupGenerator","Резервный генератор"],["accessControl","Контроль доступа"],["smartHome","Система «Умный дом»"],["soundInsulation","Улучшенная звукоизоляция"]])check(t,l,p.technical[k],v=>p.technical[k]=v);renderHighlights(root,p);renderAmenities(root,p);updateNearby=renderSurroundings(root,p);if(p.surroundings?.length)renderLegacySurroundings(root,p);const arch=fold(root,p,'Архитектура и дизайн');const ag=grid(arch);p.architectureDesign??={};for(const [k,label] of [["architecture", "Архитектурный проект"], ["interiors", "Дизайн интерьеров"], ["landscape", "Ландшафтный дизайн"], ["development", "Девелопмент и строительство"], ["jointDevelopment", "Совместный девелопмент"]])field(ag,label,p.architectureDesign[k],v=>p.architectureDesign[k]=v);const plansRoot=fold(root,p,'Типы квартир и планировки');p.plans.filter(a=>!a.parentId).forEach((a,i)=>planCard(p,a,plansRoot,String(i+1)));button(plansRoot,'Добавить тип квартиры',()=>{p.plans.push({id:crypto.randomUUID(),parentId:null,available:true,priceBrl:null,spec:{apartmentType:'standard',bedrooms:3},locations:[],technical:{count:null}});render()});if(allowed('canDeleteProperty'))button(root,'Удалить ЖК',()=>{if(confirm('Удалить ЖК «'+p.title+'»? Изменение вступит в силу при публикации.')){deleted.set(keyOf(p),structuredClone(p));data.splice(selected,1);selected=0;render();}});refresh(p);protectEditor(root,p);}
async function load(reset=false){try{
 const state=await requestJSON('/api/state');if(state.workerVersion!=='0.054')throw Error('Обновите Cloudflare Worker до 0.054, затем перезагрузите админку.');const base=state.sha;permissions=state.permissions||{};
 const [cat,dev,ct,ci]=await Promise.all(['catalog.json','developers.json','countries.json','cities.json'].map(x=>requestJSON(x)));
 let nearby=null;try{nearby=await requestJSON('/api/surroundings');}catch(e){console.warn('База окружения:',e);}if(nearby?.base===base&&nearby.schemaVersion===6&&Array.isArray(nearby.items)){aroundBase=nearby.base;aroundItems=nearby.items;aroundCities=nearby.cities;aroundSettings=window.BCNearbyDistance.settings(nearby.settings);aroundSettingsDraft=null;}else{aroundBase=null;aroundItems=[];aroundSettings=null;aroundSettingsDraft=null;}
 const after=await requestJSON('/api/state');if(after.sha!==base)throw Error('Каталог изменился во время загрузки. Повторите.');
 const clean=p=>{geoDefaults(p);p.page=geoPath(p)+p.developer+'/'+p.id+'/';p.amenities??=[];p.architectureDesign??={};p.technical??={types:[]};normalizePlans(p);migrateHotel(p);return p};
 const pub=cat.map(p=>clean(structuredClone(p)));let next=structuredClone(pub),nextDevs=dev,nextCities=ci;
 staleDraft=null;deleted=new Map();
 if(!reset){const draft=await readDraft();if(draft?.catalog){let compatible=draft.base===base;if(!compatible&&draft.base){try{compatible=(await requestJSON('/api/draft-check',{base:draft.base,current:base,includeCities:Array.isArray(draft.cities)})).compatible===true}catch(e){console.warn(e)}}if(compatible){next=draft.catalog.map(raw=>{const p=migrateGeo(raw);const publishedProperty=pub.find(x=>keyOf(x)===keyOf(p));for(const a of p.plans||[]){const prior=publishedProperty?.plans.find(x=>x.id===a.id&&!x.parentId);if(!a.parentId&&!Array.isArray(a.legacyVariantIds)&&Array.isArray(prior?.legacyVariantIds))a.legacyVariantIds=structuredClone(prior.legacyVariantIds);}return clean(p);});nextDevs=draft.developers||dev;nextCities=Array.isArray(draft.cities)?draft.cities:ci;deleted=new Map(draft.deleted||[]);for(const p of pub)if(!next.some(x=>keyOf(x)===keyOf(p))&&!deleted.has(keyOf(p)))deleted.set(keyOf(p),p);}else{staleDraft=draft;await preserveConflictDraft(draft);}}}
 for(const p of pub)canonicalGeo(p,ci);for(const p of next)canonicalGeo(p,nextCities);data=next;developers=nextDevs;countries=ct;cities=nextCities;publishBase=base;published=new Map(pub.map(p=>[keyOf(p),p]));unlocked=new Set();manualLocks=new Set();histories=new Map();freeze=!!staleDraft;
 for(const p of data){const d=developers.find(x=>x.id===p.developer);if(d)p.developerName=d.name;}
 selected=0;devSelected=0;catalogOrderUndo=[];mode='properties';render();$('publish').disabled=freeze;
 $('error').textContent=staleDraft?'Сохранённый черновик относится к другой версии каталога. Он не перезаписан. Скачайте резервную копию.':'';
 $('download-draft').hidden=false;renderConflict();return true;
 }catch(e){$('error').textContent='Не удалось загрузить каталог: '+e.message;return false;}}

const categories=[['Фасад здания','Fachada'],['Входная группа','Entrada'],['Лобби','Lobby'],['Интерьер квартиры','Interior do apartamento'],['Балкон','Varanda'],['Вид из квартиры','Vista do apartamento'],['Бассейн','Piscina'],['Детский бассейн','Piscina infantil'],['Тренажёрный зал','Academia'],['Сауна','Sauna'],['SPA','Spa'],['Зона отдыха','Área de lazer'],['Зона барбекю','Churrasqueira'],['Зал для мероприятий','Salão de festas'],['Детская игровая комната','Brinquedoteca'],['Детская площадка','Playground'],['Спортивная площадка','Quadra esportiva'],['Теннисный корт','Quadra de tênis'],['Коворкинг','Coworking'],['Велопарковка','Bicicletário'],['Паркинг','Estacionamento'],['Помещение для доставки','Espaço delivery'],['Территория комплекса','Área do condomínio'],['Другое','Outro']];
const locationCategories=[['Район','Bairro'],['Окрестности','Arredores'],['Вид с дрона','Vista aérea'],['Карта','Mapa'],['Другое','Outro']];
async function processImage(file){if(!/\.(jpe?g|png|webp)$/i.test(file.name))throw Error('Допустимы JPEG, PNG и WebP');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();return {id:crypto.randomUUID(),name:file.name,src:await compressImage(img)};}finally{URL.revokeObjectURL(url)}}
async function compressImage(img){let max=2400;for(let attempt=0;attempt<7;attempt++){const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/webp',attempt<2?.90:.82));if(!b||b.type!=='image/webp')throw Error('Не удалось создать WebP');if(b.size<=1400000)return asData(b);max=Math.floor(max*.8);}throw Error('Фото слишком большое');}
function uploader(parent,multiple,callback){const box=el('div',undefined,parent);box.className='upload';const input=el('input',undefined,box);input.type='file';input.accept='.jpg,.jpeg,.png,.webp';input.multiple=multiple;el('p','Перетащите фотографии или выберите файлы · JPEG, PNG, WebP',box);async function run(files){if(operationBusy||freeze||input.disabled)return;const fs=Array.from(files).slice(0,multiple?undefined:1);if(!fs.length)return;operationBusy=true;document.querySelector('main').inert=true;const results=[],errors=[];try{for(const [i,f] of fs.entries()){operation('Обработка фотографий…',`${i+1} из ${fs.length} · ${f.name}`,i,fs.length);try{results.push(await processImage(f))}catch(e){errors.push(f.name+': '+e.message)}}if(results.length){callback(results);await persistDraft();}if(errors.length)alert(errors.join('\n'));}catch(e){$('error').textContent=e.message;}finally{operationBusy=false;document.querySelector('main').inert=false;if(freeze)freezeEditor();endOperation();input.value='';}}input.onchange=()=>run(input.files);box.ondragover=e=>e.preventDefault();box.ondrop=e=>{e.preventDefault();run(e.dataTransfer.files)};return box;}

function previewURL(v){if(typeof v!=='string')return '';if(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(v))return v;return /^(?:\.\.\/|\/)?(?:properties|assets|images)\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:webp|jpe?g|png|svg)(?:\?v=[0-9.]+)?$/i.test(v)?v:'';}
function mediaPreview(parent,m){const link=el('a',undefined,parent);const href=previewURL(m.original||m.src);if(href)link.href=href;link.target='_blank';link.rel='noopener noreferrer';const img=el('img',undefined,link);const src=previewURL(m.thumb||m.src);if(src)img.src=src;img.alt=m.caption||m.name||'Фото';img.className='media-thumb';}
function mediaGallery(parent,p,key,title,single=false,location=false){const c=article(parent,title);const cats=location?locationCategories:categories;let cat=cats[0][0];if(!single)select(c,'Категория загрузки',cats.map(x=>[x[0],x[0]]),cat,v=>cat=v);const list=p[key]||(p[key]=[]);uploader(c,!single,items=>{for(const m of items){if(single)continue;m.category=cat;m.caption='';m.captionPt='';}if(single)p[key]=items;else list.push(...items);render()});list.forEach((m,i)=>{const r=repeat(c,single?'Главная фотография':'Фото № '+(i+1));mediaPreview(r,m);if(!single){select(r,'Категория',cats.map(x=>[x[0],x[0]]),m.category||'Другое',v=>{m.category=v;});const ru=field(r,'Подпись (RU)',m.caption,v=>m.caption=v),pt=field(r,'Подпись (PT)',m.captionPt,v=>m.captionPt=v);const hints=()=>{ru.placeholder=m.category||'Другое';pt.placeholder=cats.find(x=>x[0]===m.category)?.[1]||'Outro'};hints();r.querySelector('select').addEventListener('change',hints);reorderControls(r.querySelector('h4'),r,list,m,(from,to)=>{if(!locked(p)&&!freeze&&!operationBusy&&moveItem(list,from,to))render();},p.uid+'|'+key,()=>!locked(p)&&!freeze);}const del=remove(r,'Удалить фото',()=>{list.splice(i,1);render()});if(!allowed('canClearGallery')&&published.get(keyOf(p))?.[key]?.length&&list.length<=1)del.hidden=true;});}
function clearTypeSales(a){if(a.technical&&typeof a.technical==='object'&&!Array.isArray(a.technical)){delete a.technical.sold;delete a.technical.remaining;}}
function normalizePlans(p){for(const a of p.plans.filter(x=>!x.parentId)){clearTypeSales(a);const children=p.plans.filter(x=>x.parentId===a.id);if(a.priceBrl==null&&!a.typePriceMigrated){const prices=children.map(x=>x.priceBrl).filter(x=>Number.isFinite(x)&&x>0);if(prices.length)a.priceBrl=Math.min(...prices);}a.typePriceMigrated=true;if(a.media){const id=a.id+'-variant-1';if(!children.some(x=>x.id===id))p.plans.push({...structuredClone(a),id,parentId:a.id});delete a.media;}}for(const [i,x] of (p.technical.types||[]).entries()){const key='technical-'+i;let a=p.plans.find(a=>!a.parentId&&a.technicalKey===key);if(!a){a=p.plans.find(a=>!a.parentId&&!a.technicalKey&&a.spec.apartmentType===x.apartmentType&&a.spec.bedrooms===x.bedrooms);if(!a){a={id:crypto.randomUUID(),parentId:null,available:false,priceBrl:null,spec:{apartmentType:x.apartmentType,bedrooms:x.bedrooms,areaMin:x.areaMin,areaMax:x.areaMax},locations:[]};p.plans.push(a);}a.technicalKey=key;a.technical=structuredClone(x);clearTypeSales(a);}}p.technical.types=[];for(const a of p.plans)if(a.spec&&typeof a.spec==='object')delete a.spec.storage;for(const a of p.plans.filter(x=>!x.parentId))if(!Array.isArray(a.legacyVariantIds))a.legacyVariantIds=p.plans.filter(x=>x.parentId===a.id&&x.available!==false).map(x=>x.id);}
function planUpload(c,p,a){const box=uploader(c,true,items=>{for(const m of items)p.plans.push({id:crypto.randomUUID(),parentId:a.id,available:true,locations:[],media:m});render()});box.querySelector('p').textContent='Добавить варианты планировки · один файл = один чертёж';}
function removePlan(c,p,a){button(c,'Удалить планировку ×',()=>{if(confirm('Удалить планировку?')){p.plans=p.plans.filter(b=>b!==a);render()}});}
function asData(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)})}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('bc-admin-drafts',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=reject})}
async function readDraft(){const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction('drafts').objectStore('drafts').get('catalog');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{d.close();}}
async function preserveConflictDraft(draft){try{const d=await db();const t=d.transaction('drafts','readwrite');t.objectStore('drafts').put({...draft,savedAt:new Date().toISOString()},'conflict-'+Date.now());await new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=reject});d.close();}catch(e){throw Error('Не удалось создать резервную копию черновика: '+e.message);}}
let timer,saveQueue=Promise.resolve();
function persistDraft(){clearTimeout(timer);if(freeze)return Promise.resolve();const snapshot=structuredClone({catalog:data,developers,cities,base:publishBase,deleted:[...deleted]});const work=saveQueue.catch(()=>{}).then(async()=>{const d=await db();try{await new Promise((resolve,reject)=>{const t=d.transaction('drafts','readwrite');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);t.objectStore('drafts').put(snapshot,'catalog');});$('save-state').textContent='Черновик сохранён на этом устройстве';}finally{d.close();}});saveQueue=work;return work;}
function saveDraft(){if(freeze)return;record();const p=data[selected],g=$('editor').querySelector('.property-lock-controls');if(p&&g){const b=g.querySelectorAll('button'),h=histories.get(keyOf(p));b[1].disabled=locked(p)||!h?.past.length;b[2].disabled=locked(p)||!h?.future.length;}clearTimeout(timer);$('save-state').textContent='Сохранение…';timer=setTimeout(()=>persistDraft().catch(()=>{$('save-state').textContent='Ошибка сохранения'}),150);}


function renderConflict(){const n=$('conflict-panel');n.replaceChildren();n.hidden=!staleDraft;if(!staleDraft)return;el('h3','Восстановление черновика',n);el('p','Выберите ЖК из старого черновика. Выбранные карточки заменят только соответствующие ЖК в актуальном каталоге. Остальные останутся без изменений.',n);const choices=[];for(const p of staleDraft.catalog){const l=el('label',undefined,n),i=el('input',undefined,l);i.type='checkbox';el('span',p.title,l);choices.push([p,i]);}const geoChoice=el('input');geoChoice.type='checkbox';if(Array.isArray(staleDraft.cities)){const l=el('label',undefined,n);l.append(geoChoice);el('span','Восстановить также справочник географии из черновика (заменит текущий)',l);}button(n,'Восстановить выбранные ЖК',async()=>{const items=choices.filter(([,i])=>i.checked).map(([p])=>p);if(!items.length&&!geoChoice.checked){alert('Выберите ЖК или справочник географии.');return;}if(!confirm('Восстановить выбранные карточки поверх актуального каталога? Проверьте их перед публикацией.'))return;await resolveConflict(items,geoChoice.checked);});button(n,'Продолжить с актуальным каталогом',async()=>{if(confirm('Продолжить без старого черновика? Резервная копия останется на устройстве.'))await resolveConflict([]);});}
async function resolveConflict(items,restoreGeo=false){if(operationBusy||!staleDraft)return;operationBusy=true;const main=document.querySelector('main');main.inert=true;operation('Восстановление черновика…','Сохраняем резервную копию.');const previous={data,developers,cities};let old=staleDraft;try{await preserveConflictDraft(old);const next=structuredClone(data),devs=structuredClone(developers);for(const raw of items){const p=geoDefaults(migrateGeo(structuredClone(raw)));p.page=geoPath(p)+p.developer+'/'+p.id+'/';p.technical??={types:[]};p.architectureDesign??={};p.amenities??=[];normalizePlans(p);migrateHotel(p);if(!devs.some(d=>d.id===p.developer)){const d=old.developers?.find(x=>x.id===p.developer);if(!d)throw Error('Нет застройщика: '+p.developer);devs.push(structuredClone(d));}const j=next.findIndex(x=>keyOf(x)===keyOf(p)||x.page===p.page);if(j>=0){p.isNew=next[j].isNew||false;p.uid=next[j].uid;next[j]=p;}else next.push(p);}const nextCities=restoreGeo?structuredClone(old.cities):cities;for(const p of next)canonicalGeo(p,nextCities);data=next;developers=devs;cities=nextCities;freeze=false;await persistDraft();staleDraft=null;selected=items.length?Math.max(0,data.findIndex(x=>x.id===items[0].id&&x.developer===items[0].developer)):0;histories=new Map();render();$('error').textContent='';$('editor').inert=false;document.querySelector('aside').inert=false;$('publish').disabled=false;renderConflict();}catch(e){data=previous.data;developers=previous.developers;cities=previous.cities;staleDraft=old;freeze=true;$('error').textContent='Не удалось восстановить черновик: '+e.message;freezeEditor();}finally{main.inert=false;operationBusy=false;endOperation();}}
async function downloadConflictDraft(){try{const draft=staleDraft||await readDraft()||{catalog:data,developers,cities,base:publishBase};const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='brazilconsult-admin-draft-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){alert('Не удалось скачать черновик: '+e.message)}}
$('download-draft')?.addEventListener('click',downloadConflictDraft);
function slug(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function renderDevList(){const n=$('developers-list');n.replaceChildren();developers.forEach((d,i)=>sidebarItem(n,d,d.name,mode==='developers'&&i===devSelected,()=>{mode='developers';devSelected=i;render()}));}
function renderDeveloper(root){const d=developers[devSelected];if(!d){el('p','Добавьте застройщика.',root);return;}const titleRow=el('div',undefined,root);titleRow.className='editor-heading';el('h2',d.name,titleRow);activityToggle(titleRow,d,true);const a=article(root,'Данные застройщика');const name=field(a,'Название',d.name,()=>{});name.onchange=()=>{const v=name.value.trim();if(!v||developers.some(x=>x!==d&&x.name.toLowerCase()===v.toLowerCase())){alert('Введите уникальное название');name.value=d.name;return;}if(v!==d.name&&data.some(x=>x.developer===d.id&&locked(x))){alert('Сначала разблокируйте связанные ЖК, чтобы изменить название застройщика.');name.value=d.name;return;}d.name=v;for(const p of data.filter(x=>x.developer===d.id))p.developerName=v;render();};field(a,'Slug (не изменяется)',d.id,()=>{}).disabled=true;field(a,'Официальный сайт',d.website,v=>d.website=v,'url');field(a,'Описание',d.description,v=>d.description=v,'textarea');el('h4','Логотип',a);if(d.logo){mediaPreview(a,d.logo);button(a,'Удалить логотип',()=>{delete d.logo;render()});}el('p','Загрузка новых логотипов пока не поддерживается.',a);const c=article(root,'Жилые комплексы');for(const p of data.filter(x=>x.developer===d.id))button(c,p.title,()=>{selected=data.indexOf(p);mode='properties';render()});if(allowed('canDeleteDeveloper'))button(root,'Удалить застройщика',()=>{if(data.some(p=>p.developer===d.id)){alert('Сначала удалите связанные ЖК.');return;}if(confirm('Удалить застройщика?')){developers.splice(devSelected,1);devSelected=0;render();}});}
const geoKey=v=>String(v??'').trim().normalize('NFC').toLocaleLowerCase('pt-BR');
const geoSort=(a,b)=>a.localeCompare(b,'pt-BR');
function canonicalGeo(p,list){const c=list.find(x=>x.id===p.cityId&&x.countryId===p.countryId),loc=p.location;if(!c||!loc)return;const d=c.districts?.find(x=>geoKey(x.name)===geoKey(loc.district));if(d){loc.district=d.name;const n=d.neighborhoods.find(x=>geoKey(x)===geoKey(loc.neighborhood));if(n)loc.neighborhood=n;}try{geoApply(c,loc);}catch(e){/* preserve old geography until explicitly corrected */}}
function legacyGeoSame(p,old){return !!old&&old.cityId===p.cityId&&old.countryId===p.countryId&&geoKey(old.location?.district)===geoKey(p.location?.district)&&geoKey(old.location?.neighborhood)===geoKey(p.location?.neighborhood);}

const cityOf=p=>cities.find(c=>c.id===p.cityId&&c.countryId===p.countryId);
function geographyFields(root,p,redraw){const loc=p.location??={},c=cityOf(p),districts=c?.districts||[],d=districts.find(x=>x.name===loc.district);const opts=(values,current,placeholder)=>[['',placeholder],...values.sort(geoSort).map(x=>[x,x]),...(current&&!values.includes(current)?[[current,current+' (вне справочника)']]:[])];
 const city=select(root,'Город',cities.map(x=>[x.id,x.name+' · '+x.state]),p.cityId,v=>{const next=cities.find(x=>x.id===v);if(!next||!p.isNew)return;if(data.some(x=>x!==p&&x.cityId===v&&x.developer===p.developer&&x.id===p.id)){alert('Такой ЖК уже существует в этом городе');redraw();return;}p.cityId=v;p.countryId=next.countryId;loc.city=next.name;loc.state=next.state;geoClear(loc);if(p.id)p.page=geoPath(p)+p.developer+'/'+p.id+'/';redraw()});city.disabled=!p.isNew;
 field(root,'Штат',c?.state||loc.state,()=>{}).disabled=true;
 select(root,'Район',opts(districts.map(x=>x.name),loc.district,'Не указан'),loc.district||'',v=>{geoClear(loc);loc.district=v;geoApply(c,loc);redraw()});
 const micro=select(root,'Микрорайон / жилой кластер',opts([...(d?.neighborhoods||[])],loc.neighborhood,'Не указан'),loc.neighborhood||'',v=>{delete loc.neighborhoodId;loc.neighborhood=v;geoApply(c,loc);saveDraft()});micro.disabled=!d;
 if(c&&((loc.district&&!d)||(loc.neighborhood&&d&&!d.neighborhoods.includes(loc.neighborhood))))button(root,'Добавить прежнее значение в справочник',()=>{const dn=loc.district?.trim().normalize('NFC'),nn=loc.neighborhood?.trim().normalize('NFC');if(!dn||dn.length>100||nn?.length>100||/[\u0000-\u001f\u007f]/.test(dn+(nn||''))){alert('Проверьте название района и микрорайона.');return;}let entry=c.districts.find(x=>geoKey(x.name)===geoKey(dn));if(!entry){entry={id:crypto.randomUUID(),name:dn,neighborhoods:[],neighborhoodRefs:[]};c.districts.push(entry);}if(nn&&!entry.neighborhoods.some(x=>geoKey(x)===geoKey(nn))){geoMaterialize(c,entry);entry.neighborhoods.push(nn);entry.neighborhoodRefs.push({name:nn,id:crypto.randomUUID()});}canonicalGeo(p,cities);redraw();saveDraft();});

}
function validateGeography(items,list){for(const p of items){const c=list.find(x=>x.id===p.cityId&&x.countryId===p.countryId),d=c?.districts?.find(x=>x.name===p.location?.district);if(!c||(((p.location?.district&&!d)||p.location?.neighborhood&&!d?.neighborhoods.includes(p.location.neighborhood))&&!legacyGeoSame(p,published.get(keyOf(p)))))throw Object.assign(Error('Проверьте город, район и микрорайон ЖК «'+p.title+'» в справочнике географии.'),{target:{propertyUid:p.uid,message:'Проверьте город, район и микрорайон'}});}}
function geoInUse(c,d,n){return [...data,...deleted.values(),...published.values()].some(p=>p.cityId===c.id&&p.countryId===c.countryId&&geoRefUse(c,p.location||{},d,n))||aroundItems.some(x=>x.cityId===c.id&&[x,...aroundPoints(x)].some(v=>geoRefUse(c,v,d,n)));}
function geoName(question,current,used){const v=prompt(question,current||'');if(v===null)return null;const name=v.trim().normalize('NFC');if(!name||name.length>100||used.some(x=>geoKey(x)===geoKey(name))){alert('Введите уникальное название (до 100 символов).');return null;}return name;}
function geoGuard(c,d,n){if(aroundBase!==publishBase){alert('Обновите каталог: невозможно проверить привязки объектов окружения.');return false;}if(!geoInUse(c,d,n))return true;alert('Значение используется ЖК или объектами окружения. Сначала измените привязки.');return false;}
function renderGeography(root){el('h2','Справочник географии',root);el('p','Города, районы и жилые кластеры. Изменения сохраняются при публикации. Используемые значения защищены от удаления, переименования и переноса.',root);
 const c=cities.find(x=>x.id===geoCityId)||cities[0];if(c)geoCityId=c.id;
 const a=article(root,'Города');select(a,'Город',cities.map(x=>[x.id,x.name+' · '+x.state]),c?.id||'',v=>{geoCityId=v;geoDistrictName='';geoNeighborhoodName='';render()});const controls=el('div',undefined,a);controls.className='geo-actions';
 button(controls,'+ Добавить город',()=>{const name=geoName('Название города','',[]);if(!name)return;const raw=prompt('ID города латиницей (не меняется после создания)',slug(name));if(raw===null)return;const id=raw.trim();if(!/^[a-z0-9][a-z0-9-]*$/.test(id)||cities.some(x=>x.id===id)){alert('Введите уникальный ID латиницей.');return;}const state=prompt('Штат (например, SP)','SP')?.trim().toUpperCase();if(!state)return;if(!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(state)||cities.some(x=>geoKey(x.name)===geoKey(name)&&x.state===state)){alert('Проверьте штат и уникальность города.');return;}cities.push({id,countryId:defaultCountry,name,state,latitude:null,longitude:null,zoom:11,districts:[]});geoCityId=id;geoDistrictName='';geoNeighborhoodName='';render()});
 if(!c)return;button(controls,'Переименовать',()=>{if(!geoGuard(c))return;const name=geoName('Название города',c.name,cities.filter(x=>x!==c&&x.state===c.state).map(x=>x.name));if(name){c.name=name;render()}});button(controls,'Удалить город',()=>{if(!geoGuard(c)||!confirm('Удалить город и его районы?'))return;cities=cities.filter(x=>x!==c);geoCityId=cities[0]?.id||'';geoDistrictName='';geoNeighborhoodName='';render()});
 const districts=c.districts??=[],d=districts.find(x=>x.name===geoDistrictName)||districts[0];geoDistrictName=d?.name||'';
 const b=article(root,'Районы · '+c.name);select(b,'Район',districts.map(x=>x.name).sort(geoSort).map(n=>[n,n]),geoDistrictName,v=>{geoDistrictName=v;geoNeighborhoodName='';render()});const bc=el('div',undefined,b);bc.className='geo-actions';button(bc,'+ Добавить район',()=>{const name=geoName('Название района','',districts.map(x=>x.name));if(name){districts.push({id:crypto.randomUUID(),name,neighborhoods:[],neighborhoodRefs:[]});geoDistrictName=name;geoNeighborhoodName='';render()}});
 if(!d)return;button(bc,'Переименовать',()=>{if(!geoGuard(c,d.name))return;const name=geoName('Название района',d.name,districts.filter(x=>x!==d).map(x=>x.name));if(name){geoMaterialize(c,d);d.name=name;geoDistrictName=name;render()}});button(bc,'Удалить район',()=>{if(!geoGuard(c,d.name)||!confirm('Удалить район и его микрорайоны?'))return;c.districts=districts.filter(x=>x!==d);geoDistrictName='';geoNeighborhoodName='';render()});
 const m=article(root,'Микрорайоны · '+d.name),ns=d.neighborhoods??=[];geoNeighborhoodName=ns.includes(geoNeighborhoodName)?geoNeighborhoodName:ns[0]||'';select(m,'Микрорайон',ns.slice().sort(geoSort).map(n=>[n,n]),geoNeighborhoodName,v=>{geoNeighborhoodName=v;render()});const mc=el('div',undefined,m);mc.className='geo-actions';button(mc,'+ Добавить микрорайон',()=>{const name=geoName('Название микрорайона','',ns);if(name){geoMaterialize(c,d);ns.push(name);d.neighborhoodRefs.push({name,id:crypto.randomUUID()});geoNeighborhoodName=name;render()}});const n=geoNeighborhoodName;if(!n)return;button(mc,'Переименовать',()=>{if(!geoGuard(c,d.name,n))return;const name=geoName('Название микрорайона',n,ns.filter(x=>x!==n));if(name){geoMaterialize(c,d);d.neighborhoodRefs.find(r=>r.name===n).name=name;ns[ns.indexOf(n)]=name;geoNeighborhoodName=name;render()}});button(mc,'Удалить микрорайон',()=>{if(!geoGuard(c,d.name,n)||!confirm('Удалить микрорайон?'))return;geoMaterialize(c,d);d.neighborhoodRefs=d.neighborhoodRefs.filter(r=>r.name!==n);d.neighborhoods=ns.filter(x=>x!==n);geoNeighborhoodName='';render()});const target=select(m,'Перенести в район',[['','Выберите район'],...districts.filter(x=>x!==d).map(x=>[x.name,x.name])],'',()=>{});button(m,'Перенести микрорайон',()=>{const to=districts.find(x=>x.name===target.value);if(!to||!geoGuard(c,d.name,n))return;if(to.neighborhoods.some(x=>geoKey(x)===geoKey(n))){alert('В этом районе уже есть такой микрорайон.');return;}geoMaterialize(c,d);geoMaterialize(c,to);to.neighborhoodRefs.push(d.neighborhoodRefs.find(r=>r.name===n));d.neighborhoodRefs=d.neighborhoodRefs.filter(r=>r.name!==n);to.neighborhoods.push(n);d.neighborhoods=ns.filter(x=>x!==n);geoDistrictName=to.name;geoNeighborhoodName=n;render()});
}
let toastTimer;function lockedToast(){const t=$('lock-toast');t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,4000);}
document.addEventListener('pointerdown',e=>{if(freeze)return;const within=e.target.closest('#editor,#list');if(!within)return;for(const n of within.querySelectorAll('[data-locked-hit]')){if(!n.getClientRects().length)continue;const r=n.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){lockedToast();return;}}},true);
document.addEventListener('dragover',e=>{if(e.target.closest('[data-locked-hit].upload'))e.preventDefault()},true);document.addEventListener('drop',e=>{if(e.target.closest('[data-locked-hit].upload')){e.preventDefault();lockedToast()}},true);
function cancelCreation(){mode='properties';render();}
function creationRoot(title){mode='creating';renderList();renderDevList();const root=$('editor');root.replaceChildren();return article(root,title);}
function addDeveloper(){const a=creationRoot('Новый застройщик');const input=field(a,'Название застройщика','',()=>{});button(a,'Создать',()=>{const name=input.value.trim(),id=slug(name);if(!id||id==='shared'||developers.some(d=>d.id===id||d.name.toLowerCase()===name.toLowerCase())){input.setCustomValidity('Введите уникальное название с латинским slug');input.reportValidity();return;}developers.push({id,name,active:true,website:'',description:'',logo:null});devSelected=developers.length-1;mode='developers';render();});input.addEventListener('input',()=>input.setCustomValidity(''));button(a,'Отмена',cancelCreation);input.focus();}
function addProperty(){const a=creationRoot('Новый жилой комплекс');if(!developers.length){el('p','Сначала добавьте застройщика.',a);button(a,'Отмена',cancelCreation);return;}const title=field(a,'Название ЖК','',()=>{});const dev=select(a,'Застройщик',[['','Выберите застройщика'],...developers.map(d=>[d.id,d.name])],'',()=>{});if(!cities.length){el('p','Сначала добавьте город в справочнике географии.',a);button(a,'Отмена',cancelCreation);return;}const first=cities.find(x=>x.id===defaultCity)||cities[0];const choice={countryId:first.countryId,cityId:first.id,isNew:true,location:{city:first.name,state:first.state}};const g=grid(a);const redraw=()=>{g.replaceChildren();geographyFields(g,choice,redraw)};redraw();button(a,'Создать',()=>{const d=developers.find(x=>x.id===dev.value),name=title.value.trim(),id=slug(name),c=cities.find(x=>x.id===choice.cityId);if(!d||!id||!c||data.some(p=>p.developer===d.id&&p.id===id&&p.cityId===choice.cityId)){alert('Выберите город, застройщика и введите уникальное название ЖК латиницей');return;}data.push(geoDefaults({...choice,id,title:name,developer:d.id,developerName:d.name,page:geoPath(choice)+d.id+'/'+id+'/',active:!allowed('canHideProperty'),plans:[],technical:{types:[]},buildings:[{id:crypto.randomUUID(),name:'',active:true}],buildingMode:'single',location:{...choice.location,city:c.name,state:c.state},sales:{status:'none'},hero:[],gallery:[],locationGallery:[]}));selected=data.length-1;mode='properties';render();});button(a,'Отмена',cancelCreation);title.focus();}
// Text-only autofill of the selected property; no publishing or creation.
function bcImportFields(raw,property,env){
 const {developers,cities,amenities,highlights,uuid}=env;
 const err=m=>{throw Error(m)};
 const shape=(v,keys,path)=>{if(!v||typeof v!=='object'||Array.isArray(v))err(path+': ожидается объект');for(const k of Object.keys(v))if(!keys.includes(k))err(path+': запрещённое или неизвестное поле '+k);return v;};
 const present=v=>v!=null&&v!=='';
 const fields=(v,keys,path)=>v==null?{}:Object.fromEntries(Object.entries(shape(v,keys,path)).filter(([,x])=>present(x)));
 const list=(v,path,max=500)=>{if(v==null)return [];if(!Array.isArray(v)||v.length>max)err(path+': некорректный список');return v;};
 const ids=(v,known,path,max)=>{const a=list(v,path,max);if(a.some(x=>typeof x!=='string'||!known.has(x)))err(path+': неизвестный ID');return a.slice();};
 shape(raw,['format','title','developerId','cityId','territoryArea','completionMonth','completed','longDescription','source','location','buildingCount','buildingNames','technical','architectureDesign','amenities','highlights'],'JSON');
 if(raw.format!=='bc-property-import-v1')err('Неизвестный формат импорта. Требуется bc-property-import-v1.');
 const dev=developers.find(d=>d.id===property.developer),city=cities.find(c=>c.id===property.cityId&&c.countryId===property.countryId);
 if(!dev||!city)err('Проверьте застройщика и город выбранного ЖК.');
 for(const [k,expected] of [['title',property.title],['developerId',property.developer],['cityId',property.cityId]])if(raw[k]!=null&&(typeof raw[k]!=='string'||geoKey(raw[k])!==geoKey(expected)))err('Файл относится к другому ЖК: '+k+'. Выберите правильную карточку или файл.');
 const p=structuredClone(property);let supplied=0;
 const merge=(target,patch)=>{for(const [k,v] of Object.entries(patch)){target[k]=v;supplied++;}};
 merge(p,fields(Object.fromEntries(['territoryArea','completionMonth','completed','longDescription','source'].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]])),['territoryArea','completionMonth','completed','longDescription','source'],'Основные сведения'));
 const locKeys=['district','neighborhood','districtId','neighborhoodId','address','latitude','longitude','mapsUrl'];
 const loc=fields(raw.location,locKeys,'Расположение');for(const k of ['district','neighborhood','districtId','neighborhoodId'])if(raw.location?.[k]==='')loc[k]='';
 if(['district','neighborhood','districtId','neighborhoodId'].some(k=>Object.hasOwn(loc,k))){
   for(const k of ['district','neighborhood','districtId','neighborhoodId'])if(Object.hasOwn(loc,k)&&typeof loc[k]!=='string')err('Некорректное значение: '+k);
   const candidate={district:p.location.district||'',neighborhood:p.location.neighborhood||'',districtId:p.location.districtId||'',neighborhoodId:p.location.neighborhoodId||''};
   if(Object.hasOwn(loc,'district')||Object.hasOwn(loc,'districtId')){const prior=geoRefRows(city).find(d=>candidate.districtId?d.id===candidate.districtId:geoRefKey(d.name)===geoRefKey(candidate.district));candidate.district=loc.district||'';candidate.districtId=loc.districtId||'';const next=geoRead(city,{district:candidate.district,districtId:candidate.districtId});if((prior?.id||'')!==next.districtId){candidate.neighborhood='';candidate.neighborhoodId='';}}
   if(Object.hasOwn(loc,'neighborhood')||Object.hasOwn(loc,'neighborhoodId')){candidate.neighborhood=loc.neighborhood||'';candidate.neighborhoodId=loc.neighborhoodId||'';}
   Object.assign(loc,geoRead(city,candidate));
 }
 merge(p.location,loc);
 const techKeys=['total','floors','perFloor','parkingLevels','guestParking','parkingSize','penthouseFloor','ceilingHeight','finishing','privateElevator','backupGenerator','evCharging','accessControl','smartHome','soundInsulation'];
 merge(p.technical??={},fields(raw.technical,techKeys,'Технические характеристики'));
 const archKeys=['architecture','interiors','landscape','development','jointDevelopment'];
 merge(p.architectureDesign??={},fields(raw.architectureDesign,archKeys,'Архитектура и дизайн'));
 const names=list(raw.buildingNames,'Названия корпусов',100);
 if(names.some(n=>typeof n!=='string'||n.length>250))err('Некорректное название корпуса');
 const count=raw.buildingCount??(names.length||null);
 if(count!==null){
   if(!Number.isSafeInteger(count)||count<1||count>100||names.length>count)err('Некорректное количество корпусов');
   if(count<p.buildings.length)err('Импорт не удаляет существующие корпуса. Измените их вручную.');
   for(let i=0;i<names.length;i++)if(names[i].trim()&&p.buildings[i]?.name&&geoKey(names[i])!==geoKey(p.buildings[i].name))err('Импорт не переименовывает существующие корпуса. Измените их вручную.');
   // Existing IDs and plan bindings are preserved. Never remove a building.
   while(p.buildings.length<count)p.buildings.push({id:uuid(),name:'',active:false});
   for(let i=0;i<names.length;i++)if(names[i].trim()&&!p.buildings[i].name)p.buildings[i].name=names[i].trim();
   p.buildingMode=p.buildings.length>1?'multiple':'single';supplied++;
 }
 for(const [k,known,label,max] of [['amenities',amenities,'Инфраструктура',500],['highlights',highlights,'Преимущества',3]]){
   const a=ids(raw[k],known,label,max);if(!a.length)continue;
   const existing=p[k]||[],merged=[...new Set([...existing,...a])];
   if(k==='amenities'&&merged.length>max)err('Слишком много элементов инфраструктуры после объединения.');
   if(k==='highlights'&&merged.length>max){const skipped=merged.slice(max);env.warnings?.push('Лимит 3 преимуществ: не добавлены '+skipped.join(', ')+'. Выберите их вручную при необходимости.');}
   p[k]=merged.slice(0,max);supplied++;
 }
 if(!supplied)err('В файле нет данных для заполнения.');
 bcValidateData([p],[dev]);
 if(present(raw.completionMonth))p.completion=new Date(p.completionMonth+'-15T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
 return p;
}
function importEnvironment(){return {developers,cities,amenities:new Set(window.BCAmenities.flatMap(g=>g.items.map(x=>x.id))),highlights:new Set(window.BCHighlights.map(x=>x.id)),uuid:()=>crypto.randomUUID()};}
function canImportProperty(p){return !!publishBase&&!freeze&&!operationBusy&&permissions.canEditProperty===true&&mode==='properties'&&data[selected]===p&&!locked(p);}
function downloadImportReference(p){const ref={format:'bc-property-import-v1',property:{title:p.title,developerId:p.developer,cityId:p.cityId},instructions:'Создайте JSON по образцу template. Удалите неизвестные поля или оставьте null. Не добавляйте фотографии, цены, типы квартир, планировки или окружение. Инфраструктура дополняется без удаления старых ID; преимущества дополняются до лимита 3, старые имеют приоритет. ID берите из справочников. Название, застройщик и город служат для проверки выбранного ЖК.',template:{format:'bc-property-import-v1',title:p.title,developerId:p.developer,cityId:p.cityId,territoryArea:null,completionMonth:null,completed:null,longDescription:null,source:null,location:{districtId:null,neighborhoodId:null,address:null,latitude:null,longitude:null,mapsUrl:null},buildingCount:null,buildingNames:[],technical:{total:null,floors:null,perFloor:null,parkingLevels:null,guestParking:null,parkingSize:null,penthouseFloor:null,ceilingHeight:null,finishing:null,privateElevator:null,backupGenerator:null,evCharging:null,accessControl:null,smartHome:null,soundInsulation:null},architectureDesign:{architecture:null,interiors:null,landscape:null,development:null,jointDevelopment:null},amenities:[],highlights:[]},developers:developers.map(({id,name})=>({id,name})),cities:cities.map(c=>({id:c.id,countryId:c.countryId,name:c.name,state:c.state,districts:geoRefRows(c)})),amenities:window.BCAmenities.flatMap(g=>g.items.map(x=>({id:x.id,labels:x.labels}))),highlights:window.BCHighlights.map(x=>({id:x.id,labels:x.labels}))};const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(ref,null,2)],{type:'application/json'}));a.download='brazilconsult-import-reference.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function propertyImportControls(root,p){
 if(permissions.canEditProperty!==true)return;
 const g=el('div',undefined,root);g.className='property-import-controls';
 const input=el('input',undefined,g);input.type='file';input.accept='.json,application/json';input.hidden=true;
 const b=button(g,'Импорт данных из JSON',()=>{if(canImportProperty(p)){input.value='';input.click();}});
 button(g,'Скачать справочники для импорта',()=>{if(canImportProperty(p))downloadImportReference(p);});
 const status=el('p',undefined,g);status.className='import-status';status.setAttribute('role','status');
 input.onchange=async()=>{
   const f=input.files?.[0];input.value='';if(!f||!canImportProperty(p)||!g.isConnected)return;
   b.disabled=true;status.textContent='Чтение JSON…';
   try{
     if(!/\.json$/i.test(f.name)||f.size>256000)throw Error('Выберите JSON размером не более 256 КБ.');
     const raw=JSON.parse(await f.text());
     if(!g.isConnected||!canImportProperty(p))return;
     const warnings=[];const next=bcImportFields(raw,p,{...importEnvironment(),warnings});
     if(eq(next,p)){status.textContent=['Данные уже совпадают.',...warnings].join(' ');return;}
     record();data[selected]=next;render();publicationResult('Данные импортированы в ЖК «'+next.title+'». Проверьте поля. Изменения можно отменить; публикация не выполнена. '+warnings.join(' '));
   }catch(e){if(g.isConnected){status.textContent='Импорт: '+e.message;status.classList.add('field-error-note');}}
   finally{if(g.isConnected)b.disabled=locked(p);}
 };
}

let publishBase=null;

let operationBusy=false;
function operation(title,detail,value,max){$('operation-title').textContent=title;$('operation-detail').textContent=detail;const bar=$('operation-overlay').querySelector('progress');if(max){bar.max=max;bar.value=value;}else bar.removeAttribute('value');$('operation-overlay').hidden=false;}
function endOperation(){$('operation-overlay').hidden=true;}
function publicationResult(message,kind='success'){const n=$('publish-result');n.textContent=message;n.dataset.kind=kind;n.hidden=false;}
async function requestJSON(path,body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);try{const r=await fetch(path,{cache:'no-store',signal:controller.signal,...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});let j;try{j=await r.json()}catch{throw Error('HTTP '+r.status+' — некорректный ответ сервера')};if(!r.ok)throw Object.assign(Error(j.error||'HTTP '+r.status),{status:r.status,target:j.target});return j;}finally{clearTimeout(timeout)}}
async function initialLoad(){operationBusy=true;const main=document.querySelector('main');main.inert=true;operation('Загрузка каталога…','Получаем актуальные данные из GitHub.');try{if(!await load())freeze=true;}finally{main.inert=false;operationBusy=false;endOperation();if(freeze)freezeEditor();}}
function freezeEditor(){ $('publish').disabled=true;$('editor').inert=true;document.querySelector('aside').inert=true; $('download-draft').hidden=false; }
const stagedCache=new Map();
async function stageCatalog(catalog,base){const jobs=[];for(const p of catalog){for(const [group,items] of [['main',p.hero],['gallery',p.gallery],['location',p.locationGallery],['floorplans',p.plans.map(a=>a.media).filter(Boolean)]])for(const m of items||[]){if(typeof m.src==='string'&&m.src.startsWith('data:'))jobs.push({p,group,m});}}
 if(jobs.length>500)throw Error('Не более 500 новых изображений за публикацию');
 for(const [i,{p,group,m}] of jobs.entries()){
  operation('Загрузка фотографий…',`${i} из ${jobs.length} · ${p.title}`,i,jobs.length);
  let src=m.src;if(!src.startsWith('data:image/webp;base64,')||src.length>1900000){const img=new Image();img.src=src;await img.decode();src=await compressImage(img);}
  const dir=`${p.countryId}/${p.cityId}/${p.developer}/${p.id}`,cacheKey=base+'|'+dir+'|'+group+'|'+src;
  let receipt=stagedCache.get(cacheKey);if(!receipt){receipt=await requestJSON('/api/stage-image',{base,property:{countryId:p.countryId,cityId:p.cityId,developer:p.developer,id:p.id},group,src});stagedCache.set(cacheKey,receipt);}
  m.src=m.original='../'+receipt.path;delete m.thumb;m.staged=receipt;
  operation('Загрузка фотографий…',`${i+1} из ${jobs.length}`,i+1,jobs.length);
 }
}
function revealValidationError(error){
  const t=error.target;if(!t)return;
  if(t.developerId){const i=developers.findIndex(d=>d.id===t.developerId);if(i<0)return;devSelected=i;mode='developers';}
  else {const i=data.findIndex(p=>t.propertyUid?p.uid===t.propertyUid:p.id===t.propertyId);if(i<0)return;selected=i;mode='properties';const p=data[i];if(locked(p)&&allowed('canEditProperty')){const k=keyOf(p);if(published.has(k))unlocked.add(k);else manualLocks.delete(k);}}
  render();let scope=$('editor');
  if(t.planId)scope=[...scope.querySelectorAll('[data-plan-id]')].find(n=>n.dataset.planId===t.planId)||scope;
  if(t.locationIndex!=null)scope=[...scope.querySelectorAll('[data-location-index]')].find(n=>n.dataset.locationIndex===String(t.locationIndex))||scope;
  if(t.surroundingIndex!=null)scope=[...scope.querySelectorAll('[data-surrounding-index]')].find(n=>n.dataset.surroundingIndex===String(t.surroundingIndex))||scope;
  const msg=t.message||error.message, name=msg.match(/«([^»]+)»/)?.[1]||'';
  const aliases={'Этаж от':'Этаж от','Этаж до':'Этаж до','Название объекта окружения':'Название места','Название корпуса':'Название корпуса','Размер машино-мест':'Размер машино-мест','architecture':'Архитектурный проект','interiors':'Дизайн интерьеров','landscape':'Ландшафтный дизайн','development':'Девелопмент и строительство','jointDevelopment':'Совместный девелопмент','Этажность':'Этажность','Площадь':'Площадь до, м²','Площадь от':'Площадь от, м²','Площадь до':'Площадь до, м²','Площадь территории':'Площадь территории, м²','Цена':'Цена от, R$','Спальни':'Количество спален','Спальни с санузлом':'Спальни с собственным санузлом','Квартир на этаже':'Квартир на типовом этаже','Уровней паркинга':'Уровней подземного паркинга','Этаж':'Этаж до','distanceKm':'Расстояние, км','walkMin':'Пешком, мин','driveMin':'На автомобиле, мин','transitMin':'Общественный транспорт, мин','Карта ЖК':'Ссылка на Google Maps','Карта объекта окружения':'Ссылка на Google Maps','Название ЖК':'Название','address':'Адрес','Описание':'Краткое описание ЖК (200–400 символов)'};
  let wanted=t.developerId&&name==='Описание'?'Описание':aliases[name]||name;if(msg.includes('спален с санузлом')||msg.includes('Спален с санузлом'))wanted='Спальни с собственным санузлом';if(msg.includes('отсутствующий корпус'))wanted='Корпус';if(msg.includes('Противоречивый статус')||msg.includes('Остаток превышает'))wanted='Осталось в продаже';if(msg.includes('Официальный сайт'))wanted='Официальный сайт';if(msg.includes('Карта ЖК')||msg.includes('Карта объекта окружения'))wanted='Ссылка на Google Maps';if(msg.includes('Некорректный номер квартиры'))wanted='Номер квартиры';if(msg.includes('Некорректная структура корпусов')||msg.includes('Количество корпусов не соответствует'))wanted='Структура комплекса';if(msg.includes('Повторяющееся название')&&t.developerId)wanted='Название';if(msg.includes('Некорректный тип квартиры'))wanted='Тип квартиры';if(msg.includes('Некорректный статус продаж'))wanted='Статус продаж';if(msg.includes('Некорректный месяц сдачи'))wanted='Срок сдачи';if(msg.includes('отдельной спальни'))wanted='Количество спален';if(msg.includes('район и микрорайон'))wanted='Район';
  const fields=[...scope.querySelectorAll('input,select,textarea')];const input=fields.find(n=>n.getAttribute('aria-label')===wanted);
  const node=input||scope;for(let n=node;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;if(!input&&scope===$('editor'))for(const n of scope.querySelectorAll('details'))n.open=true;
  node.classList.add('field-error');if(input){input.setAttribute('aria-invalid','true');input.setCustomValidity(msg);const note=el('small',msg,input.parentElement);note.className='field-error-note';note.setAttribute('role','alert');const clear=()=>{input.classList.remove('field-error');input.removeAttribute('aria-invalid');input.setCustomValidity('');note.remove();input.removeEventListener('input',clear);input.removeEventListener('change',clear);};input.addEventListener('input',clear);input.addEventListener('change',clear);}else{const note=el('p',msg,scope);note.className='field-error-note';note.setAttribute('role','alert');}
  node.scrollIntoView({block:'center',behavior:'smooth'});if(input&&!input.disabled)input.focus({preventScroll:true});
}
$('publish').onclick=async()=>{const b=$('publish');if(operationBusy||freeze||b.disabled||!publishBase)return;if(!confirm('Опубликовать изменения на основном сайте brazilconsult.com?'))return;operationBusy=true;b.disabled=true;b.textContent='Публикация…';const main=document.querySelector('main');main.inert=true;$('error').textContent='';$('publish-result').hidden=true;let sent=false,confirmed=false,validationError=null;
 try{operation('Подготовка публикации…','Сохраняем черновик и подготавливаем изображения.');await persistDraft();bcValidateData(data,developers,[...published.values()]);validateGeography(data,cities);const catalog=structuredClone(data),dev=structuredClone(developers);await stageCatalog(catalog,publishBase);operation('Публикация на сайте…','Все фотографии загружены. Сохраняем каталог одним коммитом; сайт собирается хостингом после коммита.');const payload={base:publishBase,catalog,developers:dev,cities:structuredClone(cities)};if(new Blob([JSON.stringify(payload)]).size>8000000)throw Error('Каталог превышает 8 МБ даже без фотографий. Проверьте логотипы застройщиков.');sent=true;const j=await requestJSON('/api/publish',payload);if(!j?.sha)throw Error('Сервер не подтвердил коммит');confirmed=true;clearTimeout(timer);operation('Обновление каталога…','GitHub подтвердил публикацию.');if(!await load(true)){freeze=true;throw Error('Коммит подтверждён, но каталог не загрузился. Обновите страницу.');}await persistDraft();stagedCache.clear();publicationResult(j.unchanged?'Изменений нет.':'Изменения сохранены в GitHub · версия '+j.version+'. Сайт обновится после успешной сборки.');
 }catch(e){validationError=e.target?e:null;if(confirmed||e.status===409||sent&&(!e.status||e.status>=500)){freeze=true;publicationResult(confirmed?'GitHub подтвердил коммит, но не удалось обновить локальные данные. Черновик сохранён.':e.status===409?'Версия каталога изменилась. Черновик сохранён; обновите страницу.':'Связь прервана или результат не подтверждён. Изменения могли сохраниться в GitHub. Черновик сохранён; обновите страницу перед повтором.','warning');}$('error').textContent='Публикация: '+e.message;}finally{b.textContent='Опубликовать на сайте';b.disabled=freeze||!publishBase;main.inert=false;operationBusy=false;endOperation();if(freeze)freezeEditor();else if(validationError)revealValidationError(validationError);}};
window.addEventListener('beforeunload',e=>{if(operationBusy){e.preventDefault();e.returnValue='';}});
$('geography').onclick=()=>{mode='geography';render()};$('add-developer').onclick=addDeveloper;$('add-property').onclick=addProperty;

let aroundSettings=null,aroundSettingsDraft=null,aroundScoreProfile="";
let aroundBase=null,aroundItems=[],aroundCities=[],aroundCity='',aroundCategory='',aroundSearch='',aroundSelected=null,aroundMessage='',aroundPending=null;
async function openSurroundingsBase(){
  if(operationBusy||freeze)return;operationBusy=true;const main=document.querySelector('main');main.inert=true;
  try{const j=await requestJSON('/api/surroundings');if(j.schemaVersion!==6)throw Error('Обновите Worker до 0.054.');aroundBase=j.base;aroundItems=j.items;aroundCities=j.cities;aroundSettings=window.BCNearbyDistance.settings(j.settings);aroundSettingsDraft=null;aroundSelected=null;aroundPending=null;aroundMessage='';mode='surroundings-base';render();}
  catch(e){alert('Не удалось открыть базу объектов окружения: '+e.message+'\nДля этого раздела нужен Worker 0.054.');}
  finally{main.inert=false;operationBusy=false;}
}

const aroundGroups=[["Покупки",[["supermarket","Супермаркет"],["mall","Торговый центр"],["pharmacy","Аптека"],["bakery","Пекарня"],["wholesale","Оптовый супермаркет"]]],["Образование",[["kindergarten","Детский сад"],["school","Школа"],["international_school","Международная школа"],["university","Университет"]]],["Медицина",[["public_clinic","Поликлиника (Clínica da Família)"],["hospital","Госпиталь"],["private_clinic","Частная клиника"],["maternity","Роддом"]]],["Отдых",[["park","Парк"],["beach","Пляж"],["cycleway","Велосипедная дорожка"],["trail","Пешая тропа (Trilha)"],["nature_reserve","Природный заповедник"]]],["Туризм и культура",[["attraction","Достопримечательность"],["museum","Музей"],["historic_monument","Исторический памятник"],["viewpoint","Смотровая площадка"],["aquarium_zoo","Аквариум / зоопарк"],["amusement_park","Парк развлечений"],["theatre","Театр"],["event_venue","Концертная и выставочная площадка"]]],["Спорт",[["fitness","Фитнес-центр"],["tennis","Теннисный клуб"],["golf","Гольф-клуб"],["yacht_club","Яхт-клуб"],["marina","Марина"],["sports_complex","Спортивный комплекс"]]],["Транспорт",[["metro","Метро"],["bus_stop","Автобусная остановка"],["brt","Станция BRT"],["train_station","Железнодорожная станция"],["airport","Аэропорт"],["bus_terminal","Автобусный вокзал"],["ferry","Паромный терминал"],["helipad","Вертолётная площадка"]]],["Услуги",[["vet","Ветеринарная клиника"],["pet_shop","Зоомагазин"],["bank","Банк"],["cartorio","Карторио"],["federal_police","Федеральная полиция"],["consulate","Консульство"]]]];
const aroundLegacy=[["shopping","Магазины и торговые центры"],["education","Школы и детские сады"],["health","Медицина"],["outdoors","Пляжи и парки"],["transport","Транспорт"],["food","Рестораны и развлечения"],["sport","Спорт"]];
const aroundCategoryIds=new Set(aroundGroups.flatMap(g=>g[1].map(c=>c[0])));
const aroundLegacyIds=new Set(aroundLegacy.map(c=>c[0]));
// Shared geographic references; legacy dictionaries need no destructive migration.
function geoRefKey(v){return String(v??'').trim().normalize('NFC').toLocaleLowerCase('pt-BR');}
function geoLegacyId(prefix,...parts){return prefix+'-'+parts.map(v=>encodeURIComponent(geoRefKey(v))).join('|');}
function geoDistrictId(c,d){return d.id||geoLegacyId('d',c.id,d.name);}
function geoMicroId(c,d,n){return d.neighborhoodRefs?.find(r=>r.name===n)?.id||geoLegacyId('n',c.id,d.name,n);}
function geoRefRows(c){return (c?.districts||[]).map(d=>({id:geoDistrictId(c,d),name:d.name,neighborhoods:(d.neighborhoods||[]).map(n=>({id:geoMicroId(c,d,n),name:n}))}));}
function geoMaterialize(c,d){d.id=geoDistrictId(c,d);d.neighborhoodRefs=(d.neighborhoods||[]).map(n=>({name:n,id:geoMicroId(c,d,n)}));}
function geoClear(v){for(const k of ['district','neighborhood','districtId','neighborhoodId'])delete v[k];}
function geoRead(c,v){const ds=geoRefRows(c),dn=v.district||'',nn=v.neighborhood||'',di=v.districtId||'',ni=v.neighborhoodId||'';for(const key of ['districtId','neighborhoodId'])if(v[key]!=null&&(typeof v[key]!=='string'||v[key].length>3000))throw Error('Некорректный ID географии');if(!di&&!dn){if(ni||nn)throw Error('Сначала выберите район');return {district:'',neighborhood:'',districtId:'',neighborhoodId:''};}const d=ds.find(r=>di?r.id===di:geoRefKey(r.name)===geoRefKey(dn));if(!d||dn&&geoRefKey(d.name)!==geoRefKey(dn))throw Error('Район не найден в справочнике выбранного города');const n=d.neighborhoods.find(r=>ni?r.id===ni:geoRefKey(r.name)===geoRefKey(nn));if((ni||nn)&&(!n||nn&&geoRefKey(n.name)!==geoRefKey(nn)))throw Error('Микрорайон не найден в выбранном районе');return {district:d.name,neighborhood:n?.name||'',districtId:d.id,neighborhoodId:n?.id||''};}
function geoApply(c,v,old=null){let resolved;try{resolved=geoRead(c,v);}catch(e){if(old&&['district','neighborhood','districtId','neighborhoodId'].every(k=>(old[k]||'')===(v[k]||'')))return;throw e;}for(const k of ['district','neighborhood','districtId','neighborhoodId']){if(resolved[k]||Object.hasOwn(v,k))v[k]=resolved[k];}}
function geoRefUse(c,v,d,n){if(!d)return true;const row=geoRefRows(c).find(r=>geoRefKey(r.name)===geoRefKey(d));if(!row)return false;const has=v.districtId===row.id||geoRefKey(v.district)===geoRefKey(d);if(!has||!n)return has;const micro=row.neighborhoods.find(r=>geoRefKey(r.name)===geoRefKey(n));return !!micro&&(v.neighborhoodId===micro.id||geoRefKey(v.neighborhood)===geoRefKey(n));}
const aroundFields={name:250,district:100,neighborhood:100,address:500,mapsUrl:2000,website:2000,description:2000,notes:4000};
const aroundObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const aroundError=m=>{throw new Error(m);};
const aroundKey=v=>String(v??'').trim().normalize('NFC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
const aroundCats=x=>Array.isArray(x.categories)?x.categories:[x.category].filter(Boolean);
const aroundPoints=x=>Array.isArray(x.points)?x.points:(Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)?[{name:'',latitude:x.latitude,longitude:x.longitude,active:true}]:[]);
const aroundStatus=x=>x.status||'active';
const aroundValidCoords=p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const aroundExactKey=x=>JSON.stringify([x.cityId,aroundKey(x.name),aroundKey(x.address)]);
const aroundMapKey=x=>x.mapsUrl?JSON.stringify([x.cityId,x.mapsUrl.trim().replace(/\/$/,'')]):'';
const aroundPairKey=(x,y)=>[x.id,y.id].sort().join('|');
function aroundDistance(a,b){const r=Math.PI/180;const d=(b.latitude-a.latitude)*r,l=(b.longitude-a.longitude)*r;const h=Math.sin(d/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(l/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));}
function aroundNear(x,y){if(x.cityId!==y.cityId||!aroundCats(x).some(c=>aroundCats(y).includes(c)))return null;let min=Infinity;for(const a of aroundPoints(x))for(const b of aroundPoints(y)){if(!aroundValidCoords(a)||!aroundValidCoords(b)||Math.abs(a.latitude-b.latitude)>.00028)continue;const d=aroundDistance(a,b);if(d<min)min=d;}return min<=30?min:null;}
function aroundPointNear(a,b){return aroundValidCoords(a)&&aroundValidCoords(b)&&aroundDistance(a,b)<=30;}
function aroundPointDuplicates(points){for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)if(aroundPointNear(points[i],points[j]))return [j+1,i+1];return null;}
function aroundCheckPoints(x){const duplicate=aroundPointDuplicates(x.points);if(duplicate)aroundError('Точки '+duplicate.join(' и ')+' находятся в пределах 30 м. Оставьте одну точку.');}
function aroundImportWarnings(items,old){const before=new Map(old.map(x=>[x.id,x]));const found=new Map();for(const x of items){const prev=before.get(x.id),points=prev?aroundPoints(x).slice(aroundPoints(prev).length):aroundPoints(x);if(!points.length)continue;for(const y of items){if(x.id===y.id)continue;const key=aroundPairKey(x,y),d=aroundNear({...x,points},y);if(d!==null&&(!found.has(key)||d<found.get(key).d))found.set(key,{key,a:x.name,b:y.name,d});}}return [...found.values()];}
function aroundSignature(x){return JSON.stringify([x.cityId,aroundCats(x).slice().sort(),aroundPoints(x).filter(aroundValidCoords).map(p=>[p.latitude,p.longitude]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])]);}
function aroundWarnings(items,old){const before=new Map(old.map(x=>[x.id,x]));const changed=items.filter(x=>!before.has(x.id)||aroundSignature(x)!==aroundSignature(before.get(x.id)));const found=new Map();for(const x of changed)for(const y of items){if(x.id===y.id)continue;const key=aroundPairKey(x,y);if(found.has(key))continue;const d=aroundNear(x,y);if(d!==null)found.set(key,{key,a:x.name,b:y.name,d});}return [...found.values()];}
function aroundHardDuplicates(items){const names=new Map(),maps=new Map(),ids=new Set();for(const x of items){if(ids.has(x.id))aroundError('Повторяющийся ID: '+x.name);ids.add(x.id);const k=aroundExactKey(x),m=aroundMapKey(x);if(names.has(k))aroundError('Повторяющийся объект: '+x.name+' / '+names.get(k));names.set(k,x.name);if(m){if(maps.has(m))aroundError('Повторяющаяся ссылка на карту: '+x.name+' / '+maps.get(m));maps.set(m,x.name);}}}
function aroundValidate(x,cities,prior=null){
 if(!aroundObject(x)||Object.keys(x).some(k=>!['id','cityId','categories','points','status','institutionType','updatedAt','updatedBy','districtId','neighborhoodId',...Object.keys(aroundFields)].includes(k)))aroundError('Неизвестные поля объекта');
 if(typeof x.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x.id)||!cities.some(c=>c.id===x.cityId))aroundError('Некорректный ID или город');
 if(!Array.isArray(x.categories)||!x.categories.length||new Set(x.categories).size!==x.categories.length||x.categories.some(c=>!aroundCategoryIds.has(c)))aroundError('Выберите хотя бы одну детальную категорию');
 for(const [k,max] of Object.entries(aroundFields))if(typeof x[k]!=='string'||x[k].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x[k]))aroundError('Некорректное поле: '+k);
 if(!x.name.trim())aroundError('Укажите название объекта');
 for(const k of ['mapsUrl','website'])if(x[k]){let u;try{u=new URL(x[k]);}catch{aroundError('Некорректная ссылка: '+k);}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)aroundError('Некорректная ссылка: '+k);}
 if(!['active','temporarily_closed','closed'].includes(x.status)||!['','public','private'].includes(x.institutionType))aroundError('Некорректный статус или тип учреждения');
 if(!Array.isArray(x.points)||!x.points.length)aroundError('Укажите хотя бы одну точку');
 for(const p of x.points)if(!aroundObject(p)||Object.keys(p).some(k=>!['name','latitude','longitude','active','district','neighborhood','districtId','neighborhoodId'].includes(k))||typeof p.name!=='string'||p.name.length>250||/[\u0000-\u001f\u007f]/.test(p.name)||typeof p.active!=='boolean'||!aroundValidCoords(p))aroundError('Некорректная точка координат');
 const c=cities.find(c=>c.id===x.cityId);const checkGeo=(v,old)=>{for(const k of ['district','neighborhood'])if(v[k]!=null&&(typeof v[k]!=='string'||v[k].length>100||/[\u0000-\u001f\u007f]/.test(v[k])))aroundError('Некорректная география');geoApply(c,{...v},old);};checkGeo(x,prior?.cityId===x.cityId?prior:null);for(const p of x.points)checkGeo(p,prior?.cityId===x.cityId?aroundPoints(prior).find(q=>q.latitude===p.latitude&&q.longitude===p.longitude):null);
}

function aroundEditable(x){return {...Object.fromEntries(['districtId','neighborhoodId'].filter(k=>Object.hasOwn(x,k)).map(k=>[k,x[k]])),id:x.id,cityId:x.cityId,categories:aroundCats(x).slice(),points:aroundPoints(x).map(p=>({...p})),status:aroundStatus(x),institutionType:x.institutionType||'',...Object.fromEntries(Object.keys(aroundFields).map(k=>[k,x[k]||'']))};}
function aroundNew(cityId,categories=[]){return {id:crypto.randomUUID(),cityId,categories,points:[{name:'',latitude:null,longitude:null,active:true}],status:'active',institutionType:'',...Object.fromEntries(Object.keys(aroundFields).map(k=>[k,'']))};}
function aroundNormalize(x){const y=structuredClone(x);for(const k of Object.keys(aroundFields))y[k]=(y[k]??'').trim();for(const p of y.points)p.name=p.name.trim();return y;}
function aroundImportRow(raw,cities){if(!aroundObject(raw)||Object.keys(raw).some(k=>!['cityId','categories','points','status','institutionType','districtId','neighborhoodId',...Object.keys(aroundFields)].includes(k)))aroundError('Неизвестные поля строки (ID и служебные поля импортировать нельзя)');const x=aroundNew(raw.cityId);for(const k of ['cityId','categories','status','institutionType','districtId','neighborhoodId',...Object.keys(aroundFields)])if(raw[k]!==undefined&&raw[k]!==null)x[k]=raw[k];
 if(!Array.isArray(raw.points))aroundError('Нужен список points');x.points=raw.points.map(p=>{if(!aroundObject(p)||Object.keys(p).some(k=>!['name','coordinates','latitude','longitude','active','district','neighborhood','districtId','neighborhoodId'].includes(k)))aroundError('Неизвестное поле точки');let pair;if(Object.hasOwn(p,'coordinates')){if(Object.hasOwn(p,'latitude')||Object.hasOwn(p,'longitude')||typeof p.coordinates!=='string')aroundError('Укажите координаты одним способом');pair=parseCoordinatePair(p.coordinates);}else pair=[p.latitude,p.longitude];if(!pair)aroundError('Некорректные координаты');return {name:p.name??'',latitude:pair[0],longitude:pair[1],active:p.active??true,...Object.fromEntries(['district','neighborhood','districtId','neighborhoodId'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))};});aroundValidate(x,cities);const city=cities.find(c=>c.id===x.cityId);geoApply(city,x);for(const p of x.points)geoApply(city,p);return aroundNormalize(x);}
function aroundImportPreview(raw,existing,cities){
 if(!aroundObject(raw)||raw.format!=='bc-surroundings-import-v1'||!Array.isArray(raw.objects)||raw.objects.length>10000||Object.keys(raw).some(k=>!['format','objects'].includes(k)))aroundError('Нужен JSON формата bc-surroundings-import-v1 с массивом objects (до 10 000 записей)');
 const working=existing.slice(),original=new Map(existing.map(x=>[x.id,x])),changes=new Map(),rejected=[];
 for(const [i,r] of raw.objects.entries()){
  try{
   const x=aroundImportRow(r,cities),n=aroundExactKey(x),m=aroundMapKey(x);
   const matches=working.filter(y=>aroundExactKey(y)===n||m&&aroundMapKey(y)===m||y.cityId===x.cityId&&aroundKey(y.name)===aroundKey(x.name)&&(!aroundKey(y.address)||!aroundKey(x.address))&&aroundCats(x).some(c=>aroundCats(y).includes(c)));
   if(matches.length>1)aroundError('Название/адрес и ссылка относятся к разным объектам. Проверьте вручную');
   const target=matches[0];
   if(target&&!aroundCats(x).some(c=>aroundCats(target).includes(c)))aroundError('Совпадает название/адрес или ссылка, но категории различаются. Проверьте вручную');
   if(target&&(!Array.isArray(target.points)||aroundCats(target).some(c=>!aroundCategoryIds.has(c))))aroundError('Сначала уточните категории и точки существующего объекта вручную');
   const current=target?aroundPoints(target):[],added=[],skippedPoints=[];let skipped=0;
   const others=working.filter(y=>y.id!==target?.id),probe=target||x;
   if(!target){const near=others.map(y=>({y,d:aroundNear(x,y)})).filter(z=>z.d!==null).sort((a,b)=>a.d-b.d)[0];if(near)aroundError('Возможный дубль: '+near.y.name+' ('+Math.round(near.d)+' м). Новый объект не создан');}
   for(const rawPoint of x.points){
    const point=target&&x.districtId&&!rawPoint.districtId?{...rawPoint,...Object.fromEntries(['district','neighborhood','districtId','neighborhoodId'].filter(k=>x[k]).map(k=>[k,x[k]]))}:rawPoint;
    if(current.concat(added).some(p=>aroundPointNear(p,point))){skipped++;skippedPoints.push({point,reason:'Уже есть точка в пределах 30 м'});continue;}
    if(target&&others.some(y=>aroundNear({...probe,points:[point]},y)!==null)){skipped++;skippedPoints.push({point,reason:'Совпадение с другим объектом'});continue;}
    added.push(point);
   }
   if(!added.length)aroundError('Нет новых точек: все совпадают или находятся в пределах 30 м от существующих');
   if(!target&&working.length>=10000)aroundError('Достигнут лимит базы 10 000 объектов');
   const next=target?{...target,points:current.concat(added)}:{...x,points:added};
   aroundCheckPoints(next);
   if(target)working[working.findIndex(y=>y.id===target.id)]=next;else working.push(next);
   const prev=changes.get(next.id),base=original.get(next.id);
   changes.set(next.id,{item:next,kind:base?'append':'new',added:next.points.length-(base?aroundPoints(base).length:0),skipped:(prev?.skipped||0)+skipped,skippedPoints:[...(prev?.skippedPoints||[]),...skippedPoints]});
  }catch(e){rejected.push({row:i+1,name:typeof r?.name==='string'?r.name:'',error:e.message});}
 }
 return {changes:[...changes.values()],rejected};
}
function aroundImportSelection(existing,changes,selected,pointChoices=new Map()){
 const result=new Map(existing.map(x=>[x.id,x]));for(const c of changes){if(!selected.has(c.item.id))continue;const old=result.get(c.item.id),base=old?aroundPoints(old):[],choices=pointChoices.get(c.item.id),added=c.item.points.slice(base.length).filter((_,i)=>!choices||choices.has(i));if(!added.length)continue;result.set(c.item.id,{...c.item,points:base.concat(added)});}return [...result.values()];}
function aroundDownload(data,name){const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function aroundReference(){return {format:'bc-surroundings-import-reference-v1',instructions:'Для импорта сохраните только объект template. В objects можно передать несколько записей. ID города, района, микрорайона и категории берите из справочников. districtId и neighborhoodId необязательны, доступны у объекта и каждой точки. Названия для известных ID подставляются автоматически. Географию новых районов сначала опубликуйте через справочник географии. Не выдумывайте координаты; неизвестные объекты не импортируйте. Дополнительные поля можно опустить. Дубли в пределах 30 м при совпадении категории пропускаются. При однозначном совпадении названия и адреса (или если один адрес не указан) либо ссылки при общей категории по умолчанию добавляются новые точки; другие поля не изменяются. Для сети указывайте общее название, адрес филиала — в названии точки.',cities:aroundCities.map(c=>({id:c.id,name:c.name,state:c.state,countryId:c.countryId,districts:geoRefRows(c)})),categories:aroundGroups.flatMap(([group,types])=>types.map(([id,name])=>({id,name,group}))),status:['active','temporarily_closed','closed'],institutionType:['','public','private'],template:{format:'bc-surroundings-import-v1',objects:[{name:'',cityId:aroundCity||aroundCities[0]?.id||'',categories:[],points:[{name:'',coordinates:'',active:true,districtId:'',neighborhoodId:''}],status:'active',institutionType:'',districtId:'',neighborhoodId:'',address:'',mapsUrl:'',website:'',description:'',notes:''}]}};}
function aroundGeoFields(root,c,v,onChange,point=false){const rows=geoRefRows(c),prefix=point?' точки':'',oldDistrict=v.district||'',oldMicro=v.neighborhood||'';let d=rows.find(r=>v.districtId?r.id===v.districtId:geoRefKey(r.name)===geoRefKey(oldDistrict));const unknownDistrict=!d&&(oldDistrict||v.districtId);const legacy='__legacy__';const ds=select(root,'Район'+prefix,[['','Не указан'],...rows.map(r=>[r.id,r.name]).sort((a,b)=>geoSort(a[1],b[1])),...(unknownDistrict?[[legacy,(oldDistrict||v.districtId)+' (вне справочника)']]:[])],d?.id||(unknownDistrict?legacy:''),()=>{if(ds.value===legacy)return;geoClear(v);ds.querySelector('option[value=__legacy__]')?.remove();d=rows.find(r=>r.id===ds.value);if(d){v.district=d.name;v.districtId=d.id;}drawMicro();onChange();});const ms=select(root,'Микрорайон'+prefix,[],'',()=>{if(ms.value===legacy)return;ms.querySelector('option[value=__legacy__]')?.remove();delete v.neighborhood;delete v.neighborhoodId;const n=d?.neighborhoods.find(r=>r.id===ms.value);if(n){v.neighborhood=n.name;v.neighborhoodId=n.id;}onChange();});function drawMicro(){const current=d?.neighborhoods.find(r=>v.neighborhoodId?r.id===v.neighborhoodId:geoRefKey(r.name)===geoRefKey(v.neighborhood));const unknown=!current&&(v.neighborhood||v.neighborhoodId);ms.replaceChildren();for(const [id,name] of [['','Не указан'],...(d?.neighborhoods||[]).map(r=>[r.id,r.name]).sort((a,b)=>geoSort(a[1],b[1])),...(unknown?[[legacy,(v.neighborhood||v.neighborhoodId)+' (вне справочника)']]:[])])el('option',name,ms).value=id;ms.value=current?.id||(unknown?legacy:'');ms.disabled=!d;};drawMicro();ds.disabled=!c;}
function renderSurroundingsBase(root){
 el('h2','База объектов окружения',root);el('p','Единый справочник по городам. В карточках ЖК объекты подбираются автоматически по радиусу категории; ручные настройки имеют приоритет. Внутренние заметки не публикуются. Сохраняется отдельно от каталога. Для новых районов сначала опубликуйте справочник географии, затем обновите базу окружения.',root);
 if(aroundMessage)el('p',aroundMessage,root).setAttribute('role','status');if(!aroundBase){button(root,'Загрузить базу',openSurroundingsBase);return;}
 const cats=[...aroundGroups.flatMap(g=>g[1]),...aroundLegacy.map(([id,n])=>[id,n+' (старая категория)'])],cityLabel=c=>c.name+' · '+c.state,filters=grid(root);
 select(filters,'Город',[['','Все города'],...aroundCities.map(c=>[c.id,cityLabel(c)])],aroundCity,v=>{aroundCity=v;drawList();});select(filters,'Категория',[['','Все категории'],...cats],aroundCategory,v=>{aroundCategory=v;drawList();});field(filters,'Поиск',aroundSearch,v=>{aroundSearch=v;drawList();});
 const controls=el('div',undefined,root);controls.className='geo-actions';const editor=el('div',undefined,root),preview=el('div',undefined,root),list=el('div',undefined,root);
 const canDiscard=()=>!aroundSelected&&!aroundPending||confirm('Отменить несохранённые изменения или импорт?');
 const clearPreview=()=>{aroundPending=null;preview.replaceChildren();};
 button(controls,'+ Добавить объект',()=>{if(!canDiscard())return;clearPreview();aroundSelected=aroundNew(aroundCity||aroundCities[0]?.id||'',aroundCategoryIds.has(aroundCategory)?[aroundCategory]:[]);drawEditor();});
 button(controls,'Обновить базу',()=>{if(canDiscard())openSurroundingsBase();});
 button(controls,'Настройки окружения',()=>{if(!canDiscard())return;aroundSelected=null;aroundPending=null;aroundSettingsDraft=null;mode='surroundings-settings';render();});
 button(controls,'Скачать справочники для импорта',()=>aroundDownload(aroundReference(),'brazilconsult-surroundings-reference.json'));
 const file=el('input',undefined,controls);file.type='file';file.accept='.json,application/json';file.hidden=true;
 button(controls,'Импорт JSON',()=>{if(!canDiscard())return;file.value='';file.click();});
 file.onchange=async()=>{const f=file.files?.[0];file.value='';if(!f)return;try{if(!/\.json$/i.test(f.name)||f.size>4000000)aroundError('Выберите JSON не более 4 МБ');const previousSelected=aroundSelected,previousPending=aroundPending;const raw=JSON.parse(await f.text());if(!controls.isConnected||mode!=='surroundings-base'||operationBusy||freeze||aroundSelected!==previousSelected||aroundPending!==previousPending)return;const result=aroundImportPreview(raw,aroundItems,aroundCities);aroundSelected=null;drawEditor();aroundPending=result;drawPreview();}catch(e){alert('Импорт: '+e.message);}};
 function drawPreview(){preview.replaceChildren();if(!aroundPending)return;const a=article(preview,'Предпросмотр импорта');const {changes,rejected}=aroundPending;el('p',`Новых: ${changes.filter(c=>c.kind==='new').length} · Дополнений: ${changes.filter(c=>c.kind==='append').length} · Пропущено строк: ${rejected.length}. Дубли до 30 м не создаются.`,a);for(const r of rejected)el('p',`Строка ${r.row} ${r.name}: ${r.error}`,a);
 const selected=aroundPending.selected??=new Set(changes.map(c=>c.item.id));const pointChoices=aroundPending.pointChoices??=new Map(changes.map(c=>[c.item.id,new Set(Array.from({length:c.added},(_,i)=>i))]));const warnings=el('div',undefined,a);
 const save=button(a,'Сохранить выбранные',()=>{try{const next=aroundImportSelection(aroundItems,changes,selected,pointChoices);if(JSON.stringify(next)===JSON.stringify(aroundItems))return;aroundHardDuplicates(next);const w=aroundImportWarnings(next,aroundItems);if(w.length)aroundError('Найдены возможные дубли. Обновите предпросмотр.');saveAround(next,[],true);}catch(e){alert(e.message);}});button(a,'Отмена импорта',()=>{if(confirm('Отменить импорт?'))clearPreview();});
 const rows=el('div',undefined,a),summaries=[];function update(){warnings.replaceChildren();const proposed=aroundImportSelection(aroundItems,changes,selected,pointChoices);const w=aroundImportWarnings(proposed,aroundItems);for(const z of w)el('p',`Возможный дубль: ${z.a} ↔ ${z.b} (${Math.round(z.d)} м)`,warnings);let count=0;for(const [id,summary,baseCount,fields] of summaries){const active=selected.has(id),n=active?pointChoices.get(id).size:0;if(n)count++;summary.textContent='После импорта: '+(baseCount+n)+' точек'+(baseCount?' · ID не изменится':'');fields.disabled=!active;}save.disabled=!count||!!w.length;save.textContent='Сохранить выбранные ('+count+')';}
 for(const c of changes){const x=c.item,id=x.id,old=aroundItems.find(y=>y.id===id),baseCount=old?aroundPoints(old).length:0;const row=article(rows,x.name);el('p',(c.kind==='append'?'Уже в базе':'Новый объект')+' · '+(aroundCities.find(c=>c.id===x.cityId)?.name||'')+' · '+aroundCats(x).map(k=>cats.find(c=>c[0]===k)?.[1]||k).join(', '),row);el('p','В базе: '+baseCount+' · Новых точек: '+c.added+' · Пропущено: '+c.skipped,row);
  for(const {point,reason} of c.skippedPoints||[])el('p',(point.name||`${point.latitude}, ${point.longitude}`)+' — '+reason,row);
  const actions=el('fieldset',undefined,row);el('legend','Действие',actions);for(const [v,label] of [[true,old?'Дополнить существующий объект':'Добавить объект'],[false,'Не добавлять объект']]){const l=el('label',undefined,actions);l.className='check';const input=el('input',undefined,l);input.type='radio';input.name='around-import-'+id;input.checked=selected.has(id)===v;input.onchange=()=>{if(!input.checked)return;if(v)selected.add(id);else selected.delete(id);update();};el('span',label,l);}
  const fields=el('fieldset',undefined,row);el('legend','Новые точки',fields);x.points.slice(baseCount).forEach((point,i)=>check(fields,(point.name?point.name+' · ':'')+point.latitude+', '+point.longitude+([point.district||x.district,point.district?point.neighborhood:x.neighborhood].filter(Boolean).length?' · '+[point.district||x.district,point.district?point.neighborhood:x.neighborhood].filter(Boolean).join(' / '):''),pointChoices.get(id).has(i),v=>{if(v)pointChoices.get(id).add(i);else pointChoices.get(id).delete(i);update();}));const summary=el('p','',row);summaries.push([id,summary,baseCount,fields]);
 }update();}
 function drawList(){list.replaceChildren();const q=aroundKey(aroundSearch),rows=aroundItems.filter(x=>(!aroundCity||x.cityId===aroundCity)&&(!aroundCategory||aroundCats(x).includes(aroundCategory))&&(!q||aroundKey([x.name,x.address,x.district,x.neighborhood,...aroundPoints(x).flatMap(p=>[p.name,p.district,p.neighborhood])].join(' ')).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));el('h3','Объектов: '+rows.length+' из '+aroundItems.length,list);for(const x of rows){const row=article(list,x.name);el('p',[aroundCities.find(c=>c.id===x.cityId)?.name,...aroundCats(x).map(k=>cats.find(c=>c[0]===k)?.[1]||k),'Точек: '+aroundPoints(x).length,x.address,aroundStatus(x)==='closed'?'Закрыт':aroundStatus(x)==='temporarily_closed'?'Временно закрыт':''].filter(Boolean).join(' · '),row);button(row,'Редактировать',()=>{if(!canDiscard())return;clearPreview();aroundSelected=aroundEditable(x);if(!aroundSelected.points.length)aroundSelected.points.push({name:'',latitude:null,longitude:null,active:true});drawEditor();});}}
 function drawEditor(){editor.replaceChildren();if(!aroundSelected)return;const x=aroundSelected,old=aroundItems.find(y=>y.id===x.id),form=article(editor,old?'Редактирование объекта':'Новый объект'),g=grid(form);
 select(g,'Город',[['','Выберите город'],...aroundCities.map(c=>[c.id,cityLabel(c)])],x.cityId,v=>{if(x.cityId===v)return;x.cityId=v;geoClear(x);for(const p of x.points)geoClear(p);x.district='';x.neighborhood='';drawEditor();});field(g,'Название',x.name,v=>{x.name=v;showWarnings();});aroundGeoFields(g,aroundCities.find(c=>c.id===x.cityId),x,showWarnings);for(const [k,label] of [['address','Адрес'],['mapsUrl','Ссылка на Google Maps'],['website','Официальный сайт']])field(g,label,x[k],v=>{x[k]=v;showWarnings();});
 select(g,'Тип учреждения',[['','Не указан'],['public','Государственное'],['private','Частное']],x.institutionType,v=>x.institutionType=v);select(g,'Статус',[['active','Активен'],['temporarily_closed','Временно закрыт'],['closed','Закрыт']],x.status,v=>x.status=v);
 const category=el('details',undefined,form);category.open=true;el('summary','Категории',category);if(x.categories.some(k=>aroundLegacyIds.has(k)))el('p','Уточните старую категорию перед сохранением.',category);const cg=grid(category);for(const [label,types] of aroundGroups){const section=el('div',undefined,cg);el('h4',label,section);for(const [id,name] of types)check(section,name,x.categories.includes(id),v=>{x.categories=x.categories.filter(k=>!aroundLegacyIds.has(k)&&k!==id);if(v)x.categories.push(id);showWarnings();});}
 const points=article(form,'Точки расположения / входы / филиалы');el('p','Район и микрорайон точки необязательны. Если не указаны, используется общая география объекта. Для сети в разных районах оставьте общие поля пустыми.',points);x.points.forEach((p,i)=>{const section=article(points,'Точка '+(i+1));const pg=grid(section);field(pg,'Название точки (необязательно)',p.name,v=>p.name=v);const input=coordinatePair(pg,p);input.required=true;input.addEventListener('input',showWarnings);input.addEventListener('change',showWarnings);aroundGeoFields(pg,aroundCities.find(c=>c.id===x.cityId),p,showWarnings,true);check(section,'Активна',p.active,v=>p.active=v);if(x.points.length>1)button(section,'Удалить точку',()=>{x.points.splice(i,1);drawEditor();});});button(points,'+ Добавить точку',()=>{x.points.push({name:'',latitude:null,longitude:null,active:true});drawEditor();});
 field(form,'Описание',x.description,v=>x.description=v,'textarea');field(form,'Внутренние заметки',x.notes,v=>x.notes=v,'textarea');if(old?.updatedAt)el('p','Последнее изменение: '+old.updatedAt+' · '+(old.updatedBy||''),form);
 const warnings=el('div',undefined,form);function showWarnings(){warnings.replaceChildren();const duplicate=aroundPointDuplicates(x.points);if(duplicate)el('p','Повтор точек в пределах 30 м: '+duplicate.join(' и '),warnings);const candidates=aroundItems.filter(y=>y.id!==x.id);for(const y of candidates){const d=aroundNear(x,y);if(d!==null)el('p',`Возможный дубль: ${y.name} (${Math.round(d)} м)`,warnings);}}
 button(form,'Сохранить объект',()=>{try{const normalized=aroundNormalize(x);aroundValidate(normalized,aroundCities,old);const city=aroundCities.find(c=>c.id===normalized.cityId);geoApply(city,normalized,old?.cityId===normalized.cityId?old:null);for(const p of normalized.points)geoApply(city,p,old?.cityId===normalized.cityId?aroundPoints(old).find(q=>q.latitude===p.latitude&&q.longitude===p.longitude):null);aroundCheckPoints(normalized);const next=aroundItems.map(y=>y.id===x.id?normalized:y);if(!old)next.push(normalized);saveWithWarnings(next);}catch(e){alert(e.message);}});button(form,'Отмена',()=>{aroundSelected=null;drawEditor();});if(old&&permissions.canDeleteProperty===true)button(form,'Удалить объект',()=>{if(confirm('Удалить объект «'+x.name+'» из базы?'))saveWithWarnings(aroundItems.filter(y=>y.id!==x.id));});showWarnings();}
 function saveWithWarnings(next){try{aroundHardDuplicates(next);const w=aroundWarnings(next,aroundItems);if(w.length&&!confirm('Возможные дубли (общая категория, до 30 м):\n'+w.map(z=>`${z.a} ↔ ${z.b} (${Math.round(z.d)} м)`).join('\n')+'\nВсё равно сохранить?'))return;saveAround(next,w.map(z=>z.key));}catch(e){alert(e.message);}}
 drawEditor();drawPreview();drawList();
}
function renderAroundSettings(root){
 const api=window.BCNearbyDistance,editable=permissions.canManageUsers===true;
 el('h2','Настройки окружения',root);el('p','Радиус по прямой в километрах; максимум автоматически отображаемых объектов данной категории на один ЖК. Ручные добавления могут превышать лимит.',root);
 if(!editable)el('p','Изменять глобальные настройки может только администратор.',root);
 if(aroundMessage)el('p',aroundMessage,root);
 const draft=aroundSettingsDraft||structuredClone(aroundSettings||api.defaults());
 el('p','Баллы от 0 до 100 определяют порядок показа, но не меняют радиус и лимит. Выберите профиль для редактирования баллов.',root);select(root,'Баллы для профиля',[['','Общие баллы'],...Object.entries(api.audienceProfiles)],aroundScoreProfile,v=>{aroundScoreProfile=v;render();});
 for(const [group,types] of aroundGroups){const box=article(root,group);for(const [id,label] of types){const row=grid(box),v=draft[id];const flag=check(row,label,v.enabled,b=>{v.enabled=b;aroundSettingsDraft=draft;});const radius=field(row,label+' — радиус, км',v.radiusKm,n=>{v.radiusKm=n;aroundSettingsDraft=draft;},'number');const limit=field(row,label+' — максимум',v.limit,n=>{v.limit=n;aroundSettingsDraft=draft;},'number');field(row,label+' — баллы',aroundScoreProfile?v.profileScores[aroundScoreProfile]:v.score,n=>{if(aroundScoreProfile)v.profileScores[aroundScoreProfile]=n;else v.score=n;aroundSettingsDraft=draft;},'number');if(!editable)for(const e of row.querySelectorAll('input'))e.disabled=true;}}
 if(editable){button(root,'Сохранить настройки',()=>{try{const next=api.settings(draft);saveAround(aroundItems,[],false,next);}catch(e){alert(e.message);}});button(root,'Лимит 1 для всех категорий',()=>{if(!confirm('Установить максимум 1 для всех категорий? Радиусы и включённые категории не изменятся.'))return;aroundSettingsDraft=Object.fromEntries(Object.entries(draft).map(([id,v])=>[id,{...v,limit:1}]));render();});button(root,'Восстановить рекомендуемые значения',()=>{if(!confirm('Восстановить значения по умолчанию?'))return;aroundSettingsDraft=api.defaults();render();});}
 button(root,'Вернуться к базе',()=>{if(aroundSettingsDraft&&!confirm('Отменить несохранённые настройки?'))return;aroundSettingsDraft=null;mode='surroundings-base';render();});
}
async function saveAround(next,acknowledged=[],importMode=false,settings=null){
  if(operationBusy||freeze||!aroundBase)return;operationBusy=true;const main=document.querySelector('main');main.inert=true;const base=aroundBase;
  try{await persistDraft();const j=await requestJSON('/api/surroundings',settings?{base,settings}:{base,items:next,acknowledged,importMode});if(!j.sha)throw Error('Сохранение не подтверждено');aroundItems=j.items??next;aroundBase=j.sha;aroundSelected=null;aroundPending=null;if(settings){aroundSettings=window.BCNearbyDistance.settings(j.settings);aroundSettingsDraft=null;}aroundMessage=(settings?'Настройки сохранены':'База сохранена')+' · версия сайта '+j.version;
    if(publishBase===base){publishBase=j.sha;await persistDraft();}else aroundMessage+=' · Перед публикацией каталога обновите страницу.';
    render();
  }catch(e){alert('Не удалось подтвердить сохранение: '+e.message+'\nПри конфликте или сбое обновите базу перед повтором.');}
  finally{main.inert=false;operationBusy=false;}
}
$('surroundings-base').onclick=openSurroundingsBase;
function aroundHasDraft(){return (mode==='surroundings-base'&&!!(aroundSelected||aroundPending))||(mode==='surroundings-settings'&&!!aroundSettingsDraft);}
window.addEventListener('beforeunload',e=>{if(aroundHasDraft()){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{if(!aroundHasDraft())return;const t=e.target.closest('button,input');if(!t)return;if(t.id==='publish'){e.preventDefault();e.stopImmediatePropagation();alert('Сначала сохраните или отмените изменения в базе окружения.');return;}if(!t.closest('aside')||!t.matches('#geography,#surroundings-base,#add-developer,#add-property,.sidebar-item > button,#deleted-properties button'))return;if(!confirm('Отменить несохранённые изменения или импорт?')){e.preventDefault();e.stopImmediatePropagation();return;}if(t.id==='surroundings-base')return;aroundSelected=null;aroundPending=null;aroundSettingsDraft=null;},true);


document.addEventListener('input',saveDraft);document.addEventListener('change',saveDraft);initialLoad();
