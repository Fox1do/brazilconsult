/* Shared distance rules for admin preview and static page build. */
(function(g){
'use strict';
const modes={walk:'пешком',car:'на авто',public:'на общественном транспорте'};
const valid=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const points=x=>Array.isArray(x?.points)?x.points:valid(x)?[x]:[];
const active=x=>!!x&&(x.status==null||x.status===''||x.status==='active')&&points(x).some(point=>valid(point)&&point.active!==false);
function meters(a,b){const r=Math.PI/180,d=(b.latitude-a.latitude)*r,l=(b.longitude-a.longitude)*r;const h=Math.sin(d/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(l/2)**2;return 12742000*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
function nearest(loc,x){if(!valid(loc)||!active(x))return null;let min=Infinity;for(const point of points(x))if(valid(point)&&point.active!==false)min=Math.min(min,meters(loc,point));return Number.isFinite(min)?min:null;}
function format(m){if(!Number.isFinite(m)||m<0)return '';if(m<50)return 'Менее 50 м';const step=m<1000?50:m<2000?100:m<10000?500:1000;const rounded=Math.round(m/step)*step;return rounded<1000?rounded+' м':(rounded/1000).toLocaleString('ru-RU',{maximumFractionDigits:1})+' км';}
function describe(loc,x,link){const manual=Number.isFinite(link?.distanceKm)&&link.distanceKm>=0;const distance=manual?link.distanceKm*1000:nearest(loc,x);const label=format(distance);const time=Number.isSafeInteger(link?.travelMinutes)&&link.travelMinutes>0&&Object.hasOwn(modes,link.travelMode)?`${link.travelMinutes} мин ${modes[link.travelMode]}`:'';return {distance,manual,label,time,text:[label,time&&label?'('+time+')':time].filter(Boolean).join(' ')};}
g.BCNearbyDistance=Object.freeze({nearest,format,describe,active,modes});
})(globalThis);
