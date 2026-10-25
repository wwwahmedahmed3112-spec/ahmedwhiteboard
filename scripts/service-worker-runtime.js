// CACHE, ASSETS and APP_VERSION are injected by build-offline.mjs.
// Optional PDF resources load on demand instead of blocking every update.
const STARTUP_ASSETS=ASSETS.filter(path=>!/(?:^|\/)vendor\/(cmaps|standard_fonts|wasm)\//.test(path));
async function clean(response){
 if(!response.ok)throw Error('Asset unavailable');
 // A redirected precache response cannot satisfy a manual-redirect navigation.
 return new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers:response.headers});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 let cursor=0;await Promise.all(Array.from({length:Math.min(6,STARTUP_ASSETS.length)},async()=>{while(cursor<STARTUP_ASSETS.length){const path=STARTUP_ASSETS[cursor++];await cache.put(path,await clean(await fetch(new Request(path==='index.html'&&typeof ENTRY_URL==='string'?ENTRY_URL:path,{cache:'reload'}))));}}));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('sabourati-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
 for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage({type:'SABOURATI_VERSION',version:APP_VERSION});
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SABOURATI_GET_VERSION')event.source?.postMessage({type:'SABOURATI_VERSION',version:APP_VERSION});});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const path=url.pathname.replace(/^\//,'')||'index.html';
 // Auth, APIs, receipts and the recovery page must always go to the server.
 if(!ASSETS.includes(path)&&!path.startsWith('camera/')&&!/^release\/[^/]+\/camera\//.test(path))return;
 event.respondWith((async()=>{
 const cache=await caches.open(CACHE);
 if(event.request.mode==='navigate'){
  // HTML and modules must come from the same installed release.
  const saved=await cache.match(path);if(saved)return clean(saved);
  try{return await clean(await fetch(event.request));}catch{
   return new Response('تعذّر الاتصال. أعد المحاولة عند عودة الإنترنت.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
 }
 const saved=await cache.match(path);if(saved)return saved;const response=await fetch(event.request);if(response.ok)await cache.put(path,response.clone());return response;
 })());
});
