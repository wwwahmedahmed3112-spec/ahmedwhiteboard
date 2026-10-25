import {CONFIG} from '../web/config.mjs';
import{readdir,writeFile,readFile}from'node:fs/promises';import crypto from'node:crypto';
async function walk(dir){const out=[];for(const e of await readdir('web/'+dir,{withFileTypes:true})){const p=dir+e.name;if(e.isDirectory())out.push(...await walk(p+'/'));else if(!['sw.js','asset-list.json','repair.html','account.html','release.json'].includes(p))out.push(p);}return out;}
const allFiles=await walk('');const files=allFiles.filter(p=>!p.startsWith('camera/'));const runtime=await readFile('scripts/service-worker-runtime.js','utf8');const hash=crypto.createHash('sha256').update(runtime);for(const file of allFiles)hash.update(await readFile('web/'+file));const version='sabourati-'+hash.digest('hex').slice(0,12);await writeFile('web/asset-list.json',JSON.stringify([...files,'sw.js','asset-list.json']));await writeFile('web/sw.js',`const CACHE=${JSON.stringify(version)},ASSETS=${JSON.stringify(files)},APP_VERSION=${JSON.stringify(CONFIG.appVersion)};\n${runtime}`);console.log('Offline bundle generated: '+files.length+' assets');

await writeFile('web/release.json',JSON.stringify({version:CONFIG.appVersion}));
