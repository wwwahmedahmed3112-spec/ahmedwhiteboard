import {licensePeriod} from './subscription.mjs';
const encoder=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const base64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function createBrowserIdentity({read,store,cryptoAPI=crypto}){let value;return async()=>{if(value)return value;const saved=await read('license-device-key-v1');if(saved?.privateKey?.type==='private'&&saved.privateKey.extractable===false&&saved.publicKey){value=saved;return value;}const pair=await cryptoAPI.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const publicKey=await cryptoAPI.subtle.exportKey('jwk',pair.publicKey);value={privateKey:pair.privateKey,publicKey};try{await store('license-device-key-v1',value);}catch(e){value=null;throw Error('تعذّر حفظ هوية هذا المتصفح. اسمح بالتخزين المحلي ثم أعد المحاولة.');}return value;};}
export function createOnlineLicense({apiUrl,identity,onChange=()=>{},cryptoAPI=crypto,fetchImpl=fetch,monotonic=()=>performance.now(),wall=()=>Date.now()}){
 const enabled=!!apiUrl;let current=null,currentText=null,generation=0,inflight=null,lease=null,anchor=null,state={status:'idle',message:''};
 let base;if(enabled){base=new URL(apiUrl);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('خادم الترخيص يجب أن يستخدم HTTPS');}
 const monthly=l=>{try{return licensePeriod(l)?.kind==='monthly';}catch{return false;}};
 function emit(next){state={...state,...next};onChange({...state});}
 function isActive(){if(!enabled||!lease||!current||lease.licenseId!==current.id)return false;const delta=monotonic()-lease.at,wallDelta=wall()-lease.wall;return delta>=0&&delta<lease.duration&&wallDelta>=-5000&&wallDelta<lease.duration;}
 async function request(path,data,signal){const r=await fetchImpl(new URL(path,base).href,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',body:JSON.stringify(data),signal});let value;try{value=await r.json();}catch{throw Error('خادم التحقق غير متاح الآن.');}if(!r.ok){const e=Error(value.message||'تعذّر التحقق');e.code=value.code;e.status=r.status;e.serverTime=value.serverTime;throw e;}return value;}
 async function check(){
  if(!enabled||!current||!monthly(current)||!currentText)return false;if(inflight)return inflight;
  const ticket=generation,license=current,text=currentText,started=monotonic();const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  const task=(async()=>{try{
   emit({status:'checking',message:'جارٍ التحقق من الاشتراك لدى الخادم…',code:null});
   const device=await identity(),envelope=JSON.parse(text),digest=hex(await cryptoAPI.subtle.digest('SHA-256',encoder.encode(envelope.payload+'.'+envelope.signature)));
   const challenge=await request('/v1/challenge',{publicKey:device.publicKey,digest},abort.signal);
   if(typeof challenge.nonce!=='string'||challenge.nonce.length>100)throw Error('استجابة تحقق غير صحيحة');
   const proof=base64url(await cryptoAPI.subtle.sign({name:'ECDSA',hash:'SHA-256'},device.privateKey,encoder.encode('sabourati-check-v1\n'+challenge.nonce+'\n'+digest)));
   const result=await request('/v1/verify',{license:envelope,publicKey:device.publicKey,nonce:challenge.nonce,proof},abort.signal);
   if(ticket!==generation)return false;
   if(result.active!==true||result.licenseId!==license.id||!Number.isFinite(result.serverTime)||!Number.isFinite(result.expiresAt)||result.expiresAt<=result.serverTime||!Number.isFinite(result.leaseSeconds)||result.leaseSeconds<=0||result.leaseSeconds>900)throw Error('استجابة تحقق غير صحيحة');
   const at=monotonic(),elapsed=Math.max(0,at-started),duration=Math.min(result.leaseSeconds*1000,result.expiresAt-result.serverTime)-elapsed;if(duration<=0)throw Error('استجابة التحقق تأخرت؛ أعد المحاولة.');anchor={serverTime:result.serverTime+elapsed,at};lease={licenseId:license.id,at,wall:wall(),duration};
   emit({status:'active',message:'تم التحقق من الاشتراك بوقت الخادم.',code:null});return true;
  }catch(e){if(ticket!==generation)return false;const denied=e.status>=400&&e.status<500;if(denied){lease=null;if(Number.isFinite(e.serverTime))anchor={serverTime:e.serverTime,at:monotonic()};}emit({status:denied?'denied':'unavailable',code:e.code||null,message:denied?e.message:isActive()?'تعذّر الاتصال بخادم التحقق. التفعيل الحالي مؤقت حتى اكتمال مهلة التحقق.':'اتصل بالإنترنت للتحقق من الاشتراك. دروسك والأدوات الأساسية متاحة.'});return false;}
  finally{clearTimeout(timer);if(ticket===generation)inflight=null;}})();inflight=task;return task;
 }
 return {enabled,get state(){return {...state};},isActive,check,async setLicense(text,license){generation++;inflight=null;current=license;currentText=text;lease=null;anchor=null;if(!enabled||!monthly(license)){emit({status:'idle',message:'',code:null});return false;}return check();},trustedNow(){if(!anchor)return null;const delta=monotonic()-anchor.at;return delta>=0?anchor.serverTime+delta:null;},bind(events=globalThis){if(!enabled)return()=>{};const run=()=>check();events.addEventListener('focus',run);events.addEventListener('online',run);const timer=setInterval(run,5*60000);return()=>{clearInterval(timer);events.removeEventListener('focus',run);events.removeEventListener('online',run);};}};
}
