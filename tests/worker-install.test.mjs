import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {isNewWorkerVersion} from '../web/app-updates.mjs';
const runtime=await readFile(new URL('../scripts/service-worker-runtime.js',import.meta.url),'utf8');
function environment(){const listeners={},requests=[],stored=new Map(),messages=[];let active=0,max=0,skip=false;
 const context={URL,Response,Request:class{constructor(path){this.path=path;}},CACHE:'release-new',APP_VERSION:'2.5.1',ASSETS:['index.html','app.mjs','style.css','core.mjs','config.mjs','vendor/pdf.mjs','vendor/pdf.worker.mjs','vendor/cmaps/test.bcmap','vendor/standard_fonts/font.ttf','vendor/wasm/test.wasm'],location:{origin:'https://board.test'},self:{addEventListener:(key,fn)=>listeners[key]=fn,skipWaiting:async()=>{skip=true;},clients:{claim:async()=>{},matchAll:async()=>[{postMessage:data=>messages.push(data)}]}},caches:{open:async()=>({put:async(k,v)=>stored.set(k,v),match:async k=>stored.get(k)}),keys:async()=>[],delete:async()=>true},fetch:async request=>{const path=request.path||new URL(request.url).pathname.slice(1);requests.push(path);active++;max=Math.max(max,active);await new Promise(resolve=>setImmediate(resolve));active--;if(path.startsWith('vendor/cmaps/'))throw Error('optional offline');return new Response(path);}};
 vm.runInNewContext(runtime,context);return{listeners,requests,stored,messages,get max(){return max;},get skip(){return skip;}};
}
test('optional PDF failure never blocks installation; startup requests run with bounded concurrency',async()=>{
 const e=environment();let job;e.listeners.install({waitUntil:p=>job=p});await job;assert.equal(e.skip,true);assert.ok(e.max>1&&e.max<=6);assert.ok(e.stored.has('app.mjs'));assert.ok(e.stored.has('index.html'));assert.ok(e.requests.every(path=>!/^vendor\/(cmaps|standard_fonts|wasm)\//.test(path)));
});
test('activation and version requests report the installed release, including first control',async()=>{
 const e=environment();let job;e.listeners.activate({waitUntil:p=>job=p});await job;assert.equal(e.messages[0].version,'2.5.1');assert.equal(isNewWorkerVersion(e.messages[0],'2.5.0'),true);assert.equal(isNewWorkerVersion(e.messages[0],'2.5.1'),false);assert.equal(isNewWorkerVersion({type:'other',version:'3'},'2.5.1'),false);
 let response;e.listeners.message({data:{type:'SABOURATI_GET_VERSION'},source:{postMessage:v=>response=v}});assert.equal(response.version,'2.5.1');
});
test('successful optional PDF resources are cached on demand',async()=>{
 const e=environment();let job;const request={method:'GET',url:'https://board.test/vendor/standard_fonts/font.ttf',mode:'cors'};e.listeners.fetch({request,respondWith:p=>job=p});await job;assert.ok(e.stored.has('vendor/standard_fonts/font.ttf'));
});
