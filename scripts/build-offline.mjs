import {CONFIG} from '../web/config.mjs';
import{readdir,writeFile,readFile}from'node:fs/promises';import crypto from'node:crypto';
async function walk(dir){const out=[];for(const e of await readdir('web/'+dir,{withFileTypes:true})){const p=dir+e.name;if(e.isDirectory())out.push(...await walk(p+'/'));else if(!['sw.js','asset-list.json','repair.html','account.html','release.json'].includes(p))out.push(p);}return out;}
const allFiles=await walk(''),prefix='release/'+CONFIG.appVersion+'/';
const files=['index.html',...allFiles.filter(p=>!p.startsWith('camera/')).map(p=>prefix+p)];
const runtime=await readFile('scripts/service-worker-runtime.js','utf8'),hash=crypto.createHash('sha256').update(runtime);
for(const file of allFiles)hash.update(await readFile('web/'+file));
const cache='sabourati-'+hash.digest('hex').slice(0,12),entry='entry-'+CONFIG.appVersion+'.html';
await writeFile('web/asset-list.json',JSON.stringify([...files,'sw.js','asset-list.json']));
await writeFile('web/sw.js',`const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(files)},APP_VERSION=${JSON.stringify(CONFIG.appVersion)},ENTRY_URL=${JSON.stringify(entry)};\n${runtime}`);
await writeFile('web/release.json',JSON.stringify({version:CONFIG.appVersion,entry}));
console.log('Offline release: '+CONFIG.appVersion+'; '+files.length+' cacheable assets');
