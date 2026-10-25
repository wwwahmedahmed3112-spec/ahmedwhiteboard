import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {hasLessonContent,rememberUpdateLesson,takeUpdateLesson} from '../web/lesson-storage.mjs';
import {subscriptionReminder} from '../web/subscription-reminder.mjs';
import {createUpdateApplier} from '../web/app-updates.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('ordinary opens never resume; update resume is one-use and expires',()=>{
 const storage=memory();assert.equal(takeUpdateLesson(storage,1000),null);
 rememberUpdateLesson(storage,'lesson-a',1000);assert.equal(takeUpdateLesson(storage,2000),'lesson-a');assert.equal(takeUpdateLesson(storage,2001),null);
 rememberUpdateLesson(storage,'lesson-b',1000);assert.equal(takeUpdateLesson(storage,122000),null);
 rememberUpdateLesson(storage,'lesson-c',1000);assert.equal(takeUpdateLesson(storage,999),null);
});
test('archives include PDF, ink, video-only lessons, notes and named lessons',()=>{
 assert.equal(hasLessonContent({title:'درس جديد',pages:[{ops:[]}]}),false);
 for(const project of [{pages:[{pdf:'data:test'}]},{pages:[{ops:[{type:'pen'}]}]},{pages:[{videos:[{id:'M7lc1UVf-VE',ops:[]}]}]},{notes:'ملاحظات'},{title:'نحو'}])assert.equal(hasLessonContent(project),true);
});
test('monthly reminder covers seven days, final hours and expiry; permanent licenses never nag',()=>{
 const start=Date.UTC(2026,9,1),end=Date.UTC(2026,10,1),license={licenseType:'monthly',startsAt:new Date(start).toISOString(),expiresAt:new Date(end).toISOString()};
 assert.equal(subscriptionReminder(license,end-8*86400000),null);
 assert.equal(subscriptionReminder(license,start-1),null);
 assert.equal(subscriptionReminder(license,end-7*86400000).state,'soon');
 assert.match(subscriptionReminder(license,end-30*60000).text,/ساعة/);
 assert.equal(subscriptionReminder(license,end).state,'expired');
 assert.equal(subscriptionReminder({}),null);assert.equal(subscriptionReminder({licenseType:'perpetual'}),null);
});
test('updates wait while recording/busy, then save and mark the lesson before reload',async()=>{
 let safe=false;const steps=[];const u=createUpdateApplier({canApply:()=>safe,save:async()=>steps.push('save'),resume:()=>steps.push('resume'),reload:()=>steps.push('reload'),onError:()=>steps.push('error')});
 u.queue();assert.equal(await u.apply(),false);assert.deepEqual(steps,[]);safe=true;assert.equal(await u.apply(),true);assert.deepEqual(steps,['save','resume','reload']);assert.equal(await u.apply(),false);
});
test('failed saves and work started during a save prevent reload',async()=>{
 let safe=true,failed=true;const steps=[];
 const u=createUpdateApplier({canApply:()=>safe,save:async()=>{if(failed)throw Error('disk full');safe=false;},resume:()=>steps.push('resume'),reload:()=>steps.push('reload'),onError:()=>steps.push('error')});
 u.queue();assert.equal(await u.apply(),false);assert.deepEqual(steps,['error']);failed=false;assert.equal(await u.apply(),false);assert.deepEqual(steps,['error']);
});
test('navigation serves the same installed version as modules; APIs and recovery bypass caches',async()=>{
 const listeners={},reads=[];let fetched=0,response;
 const context={Response,Request,URL,location:{origin:'https://board.test'},CACHE:'v2',ASSETS:['index.html','app.mjs'],self:{addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({match:async key=>{reads.push(key);return new Response('installed release');}})},fetch:async()=>{fetched++;return new Response('future release');}};
 vm.runInNewContext(await readFile(new URL('../scripts/service-worker-runtime.js',import.meta.url),'utf8'),context);
 listeners.fetch({request:{method:'GET',url:'https://board.test/',mode:'navigate'},respondWith:p=>response=p});
 assert.equal(await(await response).text(),'installed release');assert.equal(fetched,0);assert.deepEqual(reads,['index.html']);
 for(const path of ['/api/payment','/repair.html','/release.json']){let intercepted=false;listeners.fetch({request:{method:'GET',url:'https://board.test'+path,mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
});
