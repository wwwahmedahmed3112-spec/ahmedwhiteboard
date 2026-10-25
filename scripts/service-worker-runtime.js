// CACHE and ASSETS are injected by build-offline.mjs.
async function clean(response){
 if(!response.ok)throw Error('Asset unavailable');
 // A redirected precache response cannot satisfy a manual-redirect navigation.
 return new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers:response.headers});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const path of ASSETS){await cache.put(path,await clean(await fetch(new Request(path,{cache:'reload'}))));}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('sabourati-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const path=url.pathname.replace(/^\//,'')||'index.html';
 // Auth, APIs, receipts and the recovery page must always go to the server.
 if(!ASSETS.includes(path)&&!path.startsWith('camera/'))return;
 event.respondWith((async()=>{
 const cache=await caches.open(CACHE);
 if(event.request.mode==='navigate'){
  try{return await clean(await fetch(event.request));}catch{
   const saved=await cache.match(path);if(saved)return clean(saved);
   return new Response('تعذّر الاتصال. أعد المحاولة عند عودة الإنترنت.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
 }
 const saved=await cache.match(path);if(saved)return saved;const response=await fetch(event.request);if(response.ok&&path.startsWith('camera/'))await cache.put(path,response.clone());return response;
 })());
});
