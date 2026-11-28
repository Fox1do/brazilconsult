// Static site build. Run at the repository root: node scripts/build-properties.mjs
// The source tree is never modified. Only the disposable dist/ directory is written.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pageHTML,root} from './property-render.mjs';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(source,'dist');
const read=rel=>fs.readFile(path.join(source,rel),'utf8');
const parse=async rel=>JSON.parse(await read(rel));
const [catalog,developers,template,sitemap]=await Promise.all([parse('admin/catalog.json'),parse('admin/developers.json'),read('admin/property-template.html'),read('sitemap.xml')]);
if(!Array.isArray(catalog)||!Array.isArray(developers)||!sitemap.includes('</urlset>'))throw Error('Некорректные данные сборки');
const nearby=await parse('admin/surroundings.json').catch(e=>{if(e.code==='ENOENT')return [];throw e;});
if(!Array.isArray(nearby))throw Error('Некорректная база окружения');
const aroundById=new Map(nearby.map(x=>[x.id,x]));
const settings=globalThis.BCNearbyDistance.settings(await parse('admin/surroundings-settings.json').catch(e=>{if(e.code==='ENOENT')return undefined;throw e;}));
const names=new Map(developers.map(d=>[d.id,d.name]));
const entries=new Map();
for(const p of catalog){
 const dir=root(p); if(entries.has(dir)||!names.has(p.developer)||!Array.isArray(p.plans))throw Error('Некорректный ЖК: '+dir);
 const data={...p,developerName:names.get(p.developer),page:dir.slice('properties/'.length)};
 // Render before changing the output; a malformed catalog must fail the build.
 const html=pageHTML(data,template,aroundById,settings);
 const {audienceProfiles:internalAudience,...publicData}=data;
 entries.set(dir,{data:publicData,html});
}
const skip=new Set(['dist','admin','scripts','node_modules','.git','.github','.wrangler','.assetsignore','.gitignore','wrangler.toml','wrangler.json','wrangler.jsonc']);
const excluded=rel=>rel.split('/').some(s=>s.startsWith('.')&&s!=='.well-known');
// Recreate output, retaining all normal public files, including independent landing pages.
// Reject symlinks instead of following potentially unsafe paths.
async function copyTree(rel=''){
 for(const ent of await fs.readdir(path.join(source,rel),{withFileTypes:true})){
  const next=rel?rel+'/'+ent.name:ent.name;
  if((!rel&&skip.has(ent.name))||excluded(next))continue;
  if(ent.isSymbolicLink())throw Error('Символическая ссылка не поддерживается: '+next);
  if(ent.isDirectory()){await fs.mkdir(path.join(output,next),{recursive:true});await copyTree(next);}
  else if(ent.isFile())await fs.copyFile(path.join(source,next),path.join(output,next));
 }
}
// Dist is reserved for build output; never delete a source directory or follow a symlink.
try{const s=await fs.lstat(output);if(!s.isDirectory()||s.isSymbolicLink())throw Error('dist должен быть обычной папкой');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output);await copyTree();
const write=async(rel,content)=>{const dest=path.join(output,rel);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,content);};
const json=v=>JSON.stringify(v,null,2)+'\n';
for(const [dir,{data,html}] of entries){await write(dir+'index.html',html);await write(dir+'data.json',json(data));}
const active=[...entries.values()].map(x=>x.data).filter(p=>p.active!==false);
await write('properties/properties.json',json(active));
// Managed property URLs have four slug segments. Keep independent pages and blog URLs.
const isManaged=url=>/^https:\/\/brazilconsult\.com\/properties\/(?:[a-z0-9][a-z0-9-]*\/){4}$/i.test(url);
const cleaned=sitemap.replace(/<url(?:\s[^>]*)?>[\s\S]*?<\/url>[ \t]*\r?\n?/gi,block=>{
 const m=block.match(/<loc>\s*([^<]+?)\s*<\/loc>/i);return m&&isManaged(m[1].trim().replace(/\/?$/,'/'))?'':block;
});
await write('sitemap.xml',cleaned.replace('</urlset>',active.map(p=>`<url><loc>https://brazilconsult.com/${root(p)}</loc></url>`).join('\n')+'\n</urlset>'));
console.log(`Brazil Consult: ${entries.size} property pages built (${active.length} active). Output: dist/`);
