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
    delete target.surroundingIndex;const plans=array(p.plans,'Планировки');uniqueIds(plans,'планировка');const byId=new Map(plans.map(a=>[a.id,a]));
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
function coordinate(p,label,value,limit,fn){const i=field(p,label,value,()=>{});i.inputMode='decimal';i.oninput=()=>{const raw=i.value;const n=parseNumeric(raw),valid=n===null||(typeof n==='number'&&Math.abs(n)<=limit);i.setCustomValidity(valid?'':'Недопустимая координата');fn(valid?n:raw);};i.onchange=()=>{if(!i.validity.valid)i.reportValidity();saveDraft();};return i;}
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
function renderAmenities(root,p){migrateHotel(p);const d=fold(root,p,'Инфраструктура ЖК');for(const group of window.BCAmenities){const h=el('h4',group.labels.ru,d);h.className='amenity-category';const g=grid(d);for(const item of group.items)check(g,item.emoji+' '+item.labels.ru,p.amenities.includes(item.id),v=>{p.amenities=p.amenities.filter(x=>x!==item.id);if(v)p.amenities.push(item.id);saveDraft();});}}
function renderSurroundings(root,p){p.surroundings??=[];const d=fold(root,p,'Расположение и окружение');const opts=window.BCSurroundings.map(x=>[x[0],x[1]+' '+x[2]]);const sources=data.filter(x=>x!==p&&x.surroundings?.length);if(sources.length){const source=select(d,'Копировать окружение из ЖК',[['','Выберите ЖК'],...sources.map((x,i)=>[String(i),x.title])],'',()=>{});button(d,'Копировать',()=>{if(source.value==='')return;if(p.surroundings.length&&!confirm('Добавить объекты к существующему списку?'))return;p.surroundings.push(...JSON.parse(JSON.stringify(sources[Number(source.value)].surroundings)));render()});}p.surroundings.forEach((x,i)=>{const box=repeat(d,'Объект № '+(i+1));box.dataset.surroundingIndex=String(i);const g=grid(box);select(g,'Категория',opts,x.category,v=>x.category=v);field(g,'Название места',x.name,v=>x.name=v);for(const [k,t] of [['distanceKm','Расстояние, км'],['walkMin','Пешком, мин'],['driveMin','На автомобиле, мин'],['transitMin','Общественный транспорт, мин']])field(g,t,x[k],v=>x[k]=v,'number');field(g,'Ссылка на Google Maps',x.mapsUrl,v=>x.mapsUrl=v,'url');for(const [delta,label] of [[-1,'↑ Выше'],[1,'↓ Ниже']]){const b=button(box,label,()=>{const j=i+delta;[p.surroundings[i],p.surroundings[j]]=[p.surroundings[j],p.surroundings[i]];render()});b.disabled=i+delta<0||i+delta>=p.surroundings.length;}remove(box,'Удалить объект',()=>{p.surroundings.splice(i,1);render()});});button(d,'+ Добавить объект',()=>{p.surroundings.push({category:'shopping',name:'',distanceKm:null,walkMin:null,driveMin:null,transitMin:null,mapsUrl:''});render()});}
function render(){for(const p of data){normalizePlans(p);migrateHotel(p);}saveDraft();renderList();renderDevList();const p=data[selected],root=$('editor');root.replaceChildren();if(mode==="developers"){renderDeveloper(root);return;}if(mode==="geography"){renderGeography(root);return;}if(!p){el("p","Добавьте жилой комплекс.",root);return;}const titleRow=el('div',undefined,root);titleRow.className='editor-heading';el('h2',p.title,titleRow);activityToggle(titleRow,p,true);const controls=el('div',undefined,titleRow);controls.className='editor-fold-controls';button(controls,'Свернуть всё',()=>root.querySelectorAll('details').forEach(d=>d.open=false));button(controls,'Развернуть всё',()=>root.querySelectorAll('details').forEach(d=>d.open=true));lockControls(root,p);propertyImportControls(root,p);el('p','Папка объекта: properties/'+p.page,root).className='editor-path';const a=fold(root,p,'Основные сведения'),f=grid(a);field(f,'Название',p.title,v=>{p.title=v;renderList()});select(f,'Застройщик',developers.map(d=>[d.id,d.name]),p.developer,v=>{const d=developers.find(x=>x.id===v);if(!d)return;if(data.some(x=>x!==p&&x.developer===v&&x.id===p.id&&x.cityId===p.cityId)){alert('Такой ЖК уже существует');render();return;}p.developer=v;p.developerName=d.name;p.page=geoPath(p)+v+'/'+p.id+'/';render()}).disabled=!p.isNew;field(f,'Площадь территории, м²',p.territoryArea,v=>{p.territoryArea=v;refresh(p)},'number');field(f,'Срок сдачи',p.completionMonth,v=>{p.completionMonth=v;p.completion=v?new Date(v+'-15T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'}):''},'month');check(f,'Объект сдан',p.completed,v=>p.completed=v);field(a,'Краткое описание ЖК (200–400 символов)',p.longDescription,v=>p.longDescription=v,'textarea');el('p','',a).id='orient';el('p','',a).id='summary';select(f,'Статус продаж',statuses,p.sales?.status||'none',v=>p.sales.status=v);f.append(f.querySelector('label.check'));mediaGallery(a,p,'hero','Главная фотография',true);
const l=article(fold(root,p,'Расположение комплекса'),'Расположение комплекса'),lg=grid(l),loc=p.location;geographyFields(lg,p,()=>render());for(const [k,t] of [['address','Адрес'],['mapsUrl','Ссылка на Google Maps']])field(lg,t,loc[k],v=>loc[k]=v);
coordinate(lg,'Широта',loc.latitude,90,v=>loc.latitude=v);coordinate(lg,'Долгота',loc.longitude,180,v=>loc.longitude=v);field(lg,'Источник информации',p.source,v=>p.source=v);
mediaGallery(fold(root,p,'Галерея комплекса ('+(p.gallery||[]).length+')'),p,'gallery','Галерея комплекса');mediaGallery(fold(root,p,'Галерея расположения ('+(p.locationGallery||[]).length+')'),p,'locationGallery','Галерея расположения',false,true);const b=article(fold(root,p,'Корпуса'),'Корпуса');select(b,'Структура комплекса',[['single','Один корпус'],['multiple','Два и более корпусов']],p.buildingMode,v=>{if(v==='single'&&p.buildings.length>1){alert('Сначала перенесите привязки и удалите лишние корпуса.');render();return;}p.buildingMode=v;if(v==='multiple'&&p.buildings.length<2)p.buildings.push({id:crypto.randomUUID(),name:'',active:false});render()});if(p.buildingMode==='multiple'){p.buildings.forEach((x,i)=>{const box=repeat(b,'Корпус № '+(i+1)),r=grid(box);field(r,'Название корпуса',x.name,v=>x.name=v);check(r,'Активен',x.active!==false,v=>{x.active=v;refresh(p)});remove(box,'Удалить корпус',()=>{if(p.plans.some(a=>(a.locations||[]).some(l=>l.buildingId===x.id))){alert('Корпус связан с планировками.');return;}p.buildings=p.buildings.filter(y=>y!==x);if(p.buildings.length===1)p.buildingMode='single';render()})});button(b,'Добавить корпус',()=>{p.buildings.push({id:crypto.randomUUID(),name:'',active:false});render()});}
const t=article(fold(root,p,'Технические характеристики'),'Технические характеристики'),tg=grid(t);field(tg,'Жилые корпуса',p.buildings.length,()=>{},'number').disabled=true;for(const [k,l] of [['total','Всего квартир'],['floors','Этажность'],['perFloor','Квартир на типовом этаже'],['guestParking','Гостевых машино-мест'],['ceilingHeight','Высота потолков, м']])field(tg,l,p.technical[k],v=>p.technical[k]=v,'number');field(tg,'Отделка',p.technical.finishing,v=>p.technical.finishing=v);for(const [k,l] of [["privateElevator","Индивидуальный лифт"],["backupGenerator","Резервный генератор"],["evCharging","Зарядка электромобилей"],["accessControl","Контроль доступа"],["smartHome","Система «Умный дом»"],["soundInsulation","Улучшенная звукоизоляция"]])check(t,l,p.technical[k],v=>p.technical[k]=v);renderHighlights(root,p);renderAmenities(root,p);renderSurroundings(root,p);const arch=fold(root,p,'Архитектура и дизайн');const ag=grid(arch);p.architectureDesign??={};for(const [k,label] of [["architecture", "Архитектурный проект"], ["interiors", "Дизайн интерьеров"], ["landscape", "Ландшафтный дизайн"], ["development", "Девелопмент и строительство"], ["jointDevelopment", "Совместный девелопмент"]])field(ag,label,p.architectureDesign[k],v=>p.architectureDesign[k]=v);const plansRoot=fold(root,p,'Типы квартир и планировки');p.plans.filter(a=>!a.parentId).forEach((a,i)=>planCard(p,a,plansRoot,String(i+1)));button(plansRoot,'Добавить тип квартиры',()=>{p.plans.push({id:crypto.randomUUID(),parentId:null,available:true,priceBrl:null,spec:{apartmentType:'standard',bedrooms:3},locations:[],technical:{count:null}});render()});if(allowed('canDeleteProperty'))button(root,'Удалить ЖК',()=>{if(confirm('Удалить ЖК «'+p.title+'»? Изменение вступит в силу при публикации.')){deleted.set(keyOf(p),structuredClone(p));data.splice(selected,1);selected=0;render();}});refresh(p);protectEditor(root,p);}
async function load(reset=false){try{
 const state=await requestJSON('/api/state');if(!['0.042','0.043'].includes(state.workerVersion))throw Error('Обновите Cloudflare Worker до 0.043, затем перезагрузите админку.');const base=state.sha;permissions=state.permissions||{};
 const [cat,dev,ct,ci]=await Promise.all(['catalog.json','developers.json','countries.json','cities.json'].map(x=>requestJSON(x)));
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
function canonicalGeo(p,list){const c=list.find(x=>x.id===p.cityId&&x.countryId===p.countryId),loc=p.location;if(!c||!loc)return;const d=c.districts?.find(x=>geoKey(x.name)===geoKey(loc.district));if(d){loc.district=d.name;const n=d.neighborhoods.find(x=>geoKey(x)===geoKey(loc.neighborhood));if(n)loc.neighborhood=n;}}
function legacyGeoSame(p,old){return !!old&&old.cityId===p.cityId&&old.countryId===p.countryId&&geoKey(old.location?.district)===geoKey(p.location?.district)&&geoKey(old.location?.neighborhood)===geoKey(p.location?.neighborhood);}

const cityOf=p=>cities.find(c=>c.id===p.cityId&&c.countryId===p.countryId);
function geographyFields(root,p,redraw){const loc=p.location??={},c=cityOf(p),districts=c?.districts||[],d=districts.find(x=>x.name===loc.district);const opts=(values,current,placeholder)=>[['',placeholder],...values.sort(geoSort).map(x=>[x,x]),...(current&&!values.includes(current)?[[current,current+' (вне справочника)']]:[])];
 const city=select(root,'Город',cities.map(x=>[x.id,x.name+' · '+x.state]),p.cityId,v=>{const next=cities.find(x=>x.id===v);if(!next||!p.isNew)return;if(data.some(x=>x!==p&&x.cityId===v&&x.developer===p.developer&&x.id===p.id)){alert('Такой ЖК уже существует в этом городе');redraw();return;}p.cityId=v;p.countryId=next.countryId;loc.city=next.name;loc.state=next.state;loc.district='';loc.neighborhood='';if(p.id)p.page=geoPath(p)+p.developer+'/'+p.id+'/';redraw()});city.disabled=!p.isNew;
 field(root,'Штат',c?.state||loc.state,()=>{}).disabled=true;
 select(root,'Район',opts(districts.map(x=>x.name),loc.district,'Выберите район'),loc.district||'',v=>{loc.district=v;loc.neighborhood='';redraw()});
 const micro=select(root,'Микрорайон / жилой кластер',opts([...(d?.neighborhoods||[])],loc.neighborhood,'Не указан'),loc.neighborhood||'',v=>{loc.neighborhood=v;saveDraft()});micro.disabled=!d;
 if(c&&((loc.district&&!d)||(loc.neighborhood&&d&&!d.neighborhoods.includes(loc.neighborhood))))button(root,'Добавить прежнее значение в справочник',()=>{const dn=loc.district?.trim().normalize('NFC'),nn=loc.neighborhood?.trim().normalize('NFC');if(!dn||dn.length>100||nn?.length>100||/[\u0000-\u001f\u007f]/.test(dn+(nn||''))){alert('Проверьте название района и микрорайона.');return;}let entry=c.districts.find(x=>geoKey(x.name)===geoKey(dn));if(!entry){entry={name:dn,neighborhoods:[]};c.districts.push(entry);}if(nn&&!entry.neighborhoods.some(x=>geoKey(x)===geoKey(nn)))entry.neighborhoods.push(nn);canonicalGeo(p,cities);redraw();saveDraft();});

}
function validateGeography(items,list){for(const p of items){const c=list.find(x=>x.id===p.cityId&&x.countryId===p.countryId),d=c?.districts?.find(x=>x.name===p.location?.district);if(!c||((!d||p.location?.neighborhood&&!d.neighborhoods.includes(p.location.neighborhood))&&!legacyGeoSame(p,published.get(keyOf(p)))))throw Object.assign(Error('Проверьте город, район и микрорайон ЖК «'+p.title+'» в справочнике географии.'),{target:{propertyUid:p.uid,message:'Проверьте город, район и микрорайон'}});}}
function geoInUse(c,d,n){return [...data,...deleted.values(),...published.values()].some(p=>p.cityId===c.id&&p.countryId===c.countryId&&(!d||geoKey(p.location?.district)===geoKey(d))&&(!n||geoKey(p.location?.neighborhood)===geoKey(n)));}
function geoName(question,current,used){const v=prompt(question,current||'');if(v===null)return null;const name=v.trim().normalize('NFC');if(!name||name.length>100||used.some(x=>geoKey(x)===geoKey(name))){alert('Введите уникальное название (до 100 символов).');return null;}return name;}
function geoGuard(c,d,n){if(!geoInUse(c,d,n))return true;alert('Значение используется ЖК. Сначала измените его привязку в соответствующих ЖК.');return false;}
function renderGeography(root){el('h2','Справочник географии',root);el('p','Города, районы и жилые кластеры. Изменения сохраняются при публикации. Используемые значения защищены от удаления, переименования и переноса.',root);
 const c=cities.find(x=>x.id===geoCityId)||cities[0];if(c)geoCityId=c.id;
 const a=article(root,'Города');select(a,'Город',cities.map(x=>[x.id,x.name+' · '+x.state]),c?.id||'',v=>{geoCityId=v;geoDistrictName='';geoNeighborhoodName='';render()});const controls=el('div',undefined,a);controls.className='geo-actions';
 button(controls,'+ Добавить город',()=>{const name=geoName('Название города','',[]);if(!name)return;const raw=prompt('ID города латиницей (не меняется после создания)',slug(name));if(raw===null)return;const id=raw.trim();if(!/^[a-z0-9][a-z0-9-]*$/.test(id)||cities.some(x=>x.id===id)){alert('Введите уникальный ID латиницей.');return;}const state=prompt('Штат (например, SP)','SP')?.trim().toUpperCase();if(!state)return;if(!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(state)||cities.some(x=>geoKey(x.name)===geoKey(name)&&x.state===state)){alert('Проверьте штат и уникальность города.');return;}cities.push({id,countryId:defaultCountry,name,state,latitude:null,longitude:null,zoom:11,districts:[]});geoCityId=id;geoDistrictName='';geoNeighborhoodName='';render()});
 if(!c)return;button(controls,'Переименовать',()=>{if(!geoGuard(c))return;const name=geoName('Название города',c.name,cities.filter(x=>x!==c&&x.state===c.state).map(x=>x.name));if(name){c.name=name;render()}});button(controls,'Удалить город',()=>{if(!geoGuard(c)||!confirm('Удалить город и его районы?'))return;cities=cities.filter(x=>x!==c);geoCityId=cities[0]?.id||'';geoDistrictName='';geoNeighborhoodName='';render()});
 const districts=c.districts??=[],d=districts.find(x=>x.name===geoDistrictName)||districts[0];geoDistrictName=d?.name||'';
 const b=article(root,'Районы · '+c.name);select(b,'Район',districts.map(x=>x.name).sort(geoSort).map(n=>[n,n]),geoDistrictName,v=>{geoDistrictName=v;geoNeighborhoodName='';render()});const bc=el('div',undefined,b);bc.className='geo-actions';button(bc,'+ Добавить район',()=>{const name=geoName('Название района','',districts.map(x=>x.name));if(name){districts.push({name,neighborhoods:[]});geoDistrictName=name;geoNeighborhoodName='';render()}});
 if(!d)return;button(bc,'Переименовать',()=>{if(!geoGuard(c,d.name))return;const name=geoName('Название района',d.name,districts.filter(x=>x!==d).map(x=>x.name));if(name){d.name=name;geoDistrictName=name;render()}});button(bc,'Удалить район',()=>{if(!geoGuard(c,d.name)||!confirm('Удалить район и его микрорайоны?'))return;c.districts=districts.filter(x=>x!==d);geoDistrictName='';geoNeighborhoodName='';render()});
 const m=article(root,'Микрорайоны · '+d.name),ns=d.neighborhoods??=[];geoNeighborhoodName=ns.includes(geoNeighborhoodName)?geoNeighborhoodName:ns[0]||'';select(m,'Микрорайон',ns.slice().sort(geoSort).map(n=>[n,n]),geoNeighborhoodName,v=>{geoNeighborhoodName=v;render()});const mc=el('div',undefined,m);mc.className='geo-actions';button(mc,'+ Добавить микрорайон',()=>{const name=geoName('Название микрорайона','',ns);if(name){ns.push(name);geoNeighborhoodName=name;render()}});const n=geoNeighborhoodName;if(!n)return;button(mc,'Переименовать',()=>{if(!geoGuard(c,d.name,n))return;const name=geoName('Название микрорайона',n,ns.filter(x=>x!==n));if(name){ns[ns.indexOf(n)]=name;geoNeighborhoodName=name;render()}});button(mc,'Удалить микрорайон',()=>{if(!geoGuard(c,d.name,n)||!confirm('Удалить микрорайон?'))return;d.neighborhoods=ns.filter(x=>x!==n);geoNeighborhoodName='';render()});const target=select(m,'Перенести в район',[['','Выберите район'],...districts.filter(x=>x!==d).map(x=>[x.name,x.name])],'',()=>{});button(m,'Перенести микрорайон',()=>{const to=districts.find(x=>x.name===target.value);if(!to||!geoGuard(c,d.name,n))return;if(to.neighborhoods.some(x=>geoKey(x)===geoKey(n))){alert('В этом районе уже есть такой микрорайон.');return;}to.neighborhoods.push(n);d.neighborhoods=ns.filter(x=>x!==n);geoDistrictName=to.name;geoNeighborhoodName=n;render()});
}
let toastTimer;function lockedToast(){const t=$('lock-toast');t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,4000);}
document.addEventListener('pointerdown',e=>{if(freeze)return;const within=e.target.closest('#editor,#list');if(!within)return;for(const n of within.querySelectorAll('[data-locked-hit]')){if(!n.getClientRects().length)continue;const r=n.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){lockedToast();return;}}},true);
document.addEventListener('dragover',e=>{if(e.target.closest('[data-locked-hit].upload'))e.preventDefault()},true);document.addEventListener('drop',e=>{if(e.target.closest('[data-locked-hit].upload')){e.preventDefault();lockedToast()}},true);
function cancelCreation(){mode='properties';render();}
function creationRoot(title){mode='creating';renderList();renderDevList();const root=$('editor');root.replaceChildren();return article(root,title);}
function addDeveloper(){const a=creationRoot('Новый застройщик');const input=field(a,'Название застройщика','',()=>{});button(a,'Создать',()=>{const name=input.value.trim(),id=slug(name);if(!id||id==='shared'||developers.some(d=>d.id===id||d.name.toLowerCase()===name.toLowerCase())){input.setCustomValidity('Введите уникальное название с латинским slug');input.reportValidity();return;}developers.push({id,name,active:true,website:'',description:'',logo:null});devSelected=developers.length-1;mode='developers';render();});input.addEventListener('input',()=>input.setCustomValidity(''));button(a,'Отмена',cancelCreation);input.focus();}
function addProperty(){const a=creationRoot('Новый жилой комплекс');if(!developers.length){el('p','Сначала добавьте застройщика.',a);button(a,'Отмена',cancelCreation);return;}const title=field(a,'Название ЖК','',()=>{});const dev=select(a,'Застройщик',[['','Выберите застройщика'],...developers.map(d=>[d.id,d.name])],'',()=>{});if(!cities.length){el('p','Сначала добавьте город в справочнике географии.',a);button(a,'Отмена',cancelCreation);return;}const first=cities.find(x=>x.id===defaultCity)||cities[0];const choice={countryId:first.countryId,cityId:first.id,isNew:true,location:{city:first.name,state:first.state}};const g=grid(a);const redraw=()=>{g.replaceChildren();geographyFields(g,choice,redraw)};redraw();button(a,'Создать',()=>{const d=developers.find(x=>x.id===dev.value),name=title.value.trim(),id=slug(name),c=cities.find(x=>x.id===choice.cityId);if(!d||!id||!c||!choice.location.district||data.some(p=>p.developer===d.id&&p.id===id&&p.cityId===choice.cityId)){alert('Выберите город, район, застройщика и введите уникальное название ЖК латиницей');return;}data.push(geoDefaults({...choice,id,title:name,developer:d.id,developerName:d.name,page:geoPath(choice)+d.id+'/'+id+'/',active:!allowed('canHideProperty'),plans:[],technical:{types:[]},buildings:[{id:crypto.randomUUID(),name:'',active:true}],buildingMode:'single',location:{...choice.location,city:c.name,state:c.state},sales:{status:'none'},hero:[],gallery:[],locationGallery:[]}));selected=data.length-1;mode='properties';render();});button(a,'Отмена',cancelCreation);title.focus();}
// Text-only autofill of the selected property; no publishing or creation.
function bcImportFields(raw,property,env){
 const {developers,cities,amenities,highlights,surroundings,uuid}=env;
 const err=m=>{throw Error(m)};
 const shape=(v,keys,path)=>{if(!v||typeof v!=='object'||Array.isArray(v))err(path+': ожидается объект');for(const k of Object.keys(v))if(!keys.includes(k))err(path+': запрещённое или неизвестное поле '+k);return v;};
 const present=v=>v!=null&&v!=='';
 const fields=(v,keys,path)=>v==null?{}:Object.fromEntries(Object.entries(shape(v,keys,path)).filter(([,x])=>present(x)));
 const list=(v,path,max=500)=>{if(v==null)return [];if(!Array.isArray(v)||v.length>max)err(path+': некорректный список');return v;};
 const ids=(v,known,path,max)=>{const a=list(v,path,max);if(a.some(x=>typeof x!=='string'||!known.has(x)))err(path+': неизвестный ID');return a.slice();};
 shape(raw,['format','title','developerId','cityId','territoryArea','completionMonth','completed','longDescription','source','location','buildingCount','buildingNames','technical','architectureDesign','amenities','highlights','surroundings'],'JSON');
 if(raw.format!=='bc-property-import-v1')err('Неизвестный формат импорта. Требуется bc-property-import-v1.');
 const dev=developers.find(d=>d.id===property.developer),city=cities.find(c=>c.id===property.cityId&&c.countryId===property.countryId);
 if(!dev||!city)err('Проверьте застройщика и город выбранного ЖК.');
 for(const [k,expected] of [['title',property.title],['developerId',property.developer],['cityId',property.cityId]])if(raw[k]!=null&&(typeof raw[k]!=='string'||geoKey(raw[k])!==geoKey(expected)))err('Файл относится к другому ЖК: '+k+'. Выберите правильную карточку или файл.');
 const p=structuredClone(property);let supplied=0;
 const merge=(target,patch)=>{for(const [k,v] of Object.entries(patch)){target[k]=v;supplied++;}};
 merge(p,fields(Object.fromEntries(['territoryArea','completionMonth','completed','longDescription','source'].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]])),['territoryArea','completionMonth','completed','longDescription','source'],'Основные сведения'));
 const locKeys=['district','neighborhood','address','latitude','longitude','mapsUrl'];
 const loc=fields(raw.location,locKeys,'Расположение');
 if(Object.hasOwn(loc,'district')||Object.hasOwn(loc,'neighborhood')){
   for(const k of ['district','neighborhood'])if(Object.hasOwn(loc,k)&&typeof loc[k]!=='string')err('Некорректное название: '+k);
   const d=city.districts.find(x=>geoKey(x.name)===geoKey(loc.district??p.location.district));
   if(!d)err('Район отсутствует в справочнике города. Выберите его вручную или добавьте в справочник.');
   if(Object.hasOwn(loc,'district'))loc.district=d.name;
   const n=loc.neighborhood??p.location.neighborhood;
   if(n){const canonical=d.neighborhoods.find(x=>geoKey(x)===geoKey(n));if(!canonical)err('Микрорайон отсутствует в выбранном районе. Уточните его вручную.');if(Object.hasOwn(loc,'neighborhood'))loc.neighborhood=canonical;}
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
   const a=ids(raw[k],known,label,max);if(a.length){p[k]=a;supplied++;}
 }
 const sk=['category','name','distanceKm','walkMin','driveMin','transitMin','mapsUrl'];
 const around=list(raw.surroundings,'Окружение').map((v,i)=>{const x=fields(v,sk,'Окружение '+(i+1));if(!surroundings.has(x.category))err('Неизвестная категория окружения: '+String(x.category));return x;});
 if(around.length){p.surroundings=around;supplied++;}
 if(!supplied)err('В файле нет данных для заполнения.');
 bcValidateData([p],[dev]);
 if(present(raw.completionMonth))p.completion=new Date(p.completionMonth+'-15T12:00:00').toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
 return p;
}
function importEnvironment(){return {developers,cities,amenities:new Set(window.BCAmenities.flatMap(g=>g.items.map(x=>x.id))),highlights:new Set(window.BCHighlights.map(x=>x.id)),surroundings:new Set(window.BCSurroundings.map(x=>x[0])),uuid:()=>crypto.randomUUID()};}
function canImportProperty(p){return !!publishBase&&!freeze&&!operationBusy&&permissions.canEditProperty===true&&mode==='properties'&&data[selected]===p&&!locked(p);}
function downloadImportReference(p){const ref={format:'bc-property-import-v1',property:{title:p.title,developerId:p.developer,cityId:p.cityId},instructions:'Создайте JSON по образцу template. Удалите неизвестные поля или оставьте null. Не добавляйте фотографии, цены, типы квартир или планировки. ID берите из справочников. Название, застройщик и город служат для проверки выбранного ЖК.',template:{format:'bc-property-import-v1',title:p.title,developerId:p.developer,cityId:p.cityId,territoryArea:null,completionMonth:null,completed:null,longDescription:null,source:null,location:{district:null,neighborhood:null,address:null,latitude:null,longitude:null,mapsUrl:null},buildingCount:null,buildingNames:[],technical:{total:null,floors:null,perFloor:null,guestParking:null,ceilingHeight:null,finishing:null,privateElevator:null,backupGenerator:null,evCharging:null,accessControl:null,smartHome:null,soundInsulation:null},architectureDesign:{architecture:null,interiors:null,landscape:null,development:null,jointDevelopment:null},amenities:[],highlights:[],surroundings:[]},developers:developers.map(({id,name})=>({id,name})),cities:cities.map(({id,countryId,name,state,districts})=>({id,countryId,name,state,districts})),amenities:window.BCAmenities.flatMap(g=>g.items.map(x=>({id:x.id,labels:x.labels}))),highlights:window.BCHighlights.map(x=>({id:x.id,labels:x.labels})),surroundings:window.BCSurroundings.map(([id,emoji,ru,pt,en])=>({id,ru,pt,en})),surroundingsExample:{category:'<ID из справочника>',name:null,distanceKm:null,walkMin:null,driveMin:null,transitMin:null,mapsUrl:null}};const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(ref,null,2)],{type:'application/json'}));a.download='brazilconsult-import-reference.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
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
     const next=bcImportFields(raw,p,importEnvironment());
     if(eq(next,p)){status.textContent='Данные уже совпадают.';return;}
     record();data[selected]=next;render();publicationResult('Данные импортированы в ЖК «'+next.title+'». Проверьте поля. Изменения можно отменить; публикация не выполнена.');
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
document.addEventListener('input',saveDraft);document.addEventListener('change',saveDraft);initialLoad();
