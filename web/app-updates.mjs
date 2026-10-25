// Reload only after a coherent new worker has installed, never while recording.
export function createUpdateApplier({canApply,save,resume,reload,onError}){
 let pending=false,applying=false;
 return {queue(){pending=true;},get pending(){return pending;},async apply(){
  if(!pending||applying||!canApply())return false;applying=true;
  try{await save();if(!canApply()){applying=false;return false;}resume();reload();return true;}
  catch(e){applying=false;onError(e);return false;}
 }};
}
export function initAppUpdates({version,canApply,save,resume,notice}){
 let lastInput=Date.now(),registration=null,checking=false,ready=false;
 const applier=createUpdateApplier({canApply,save,resume,reload:()=>location.reload(),onError:()=>notice('التحديث جاهز، لكن تعذّر حفظ الدرس. احفظ نسخة ثم حاول مجددًا.',()=>applier.apply())});
 function queue(){if(ready)return;ready=true;applier.queue();notice('تحديث جديد جاهز. سيُطبّق تلقائيًا عند توقفك عن العمل، مع حفظ درسك.',()=>applier.apply());}
 for(const event of ['pointerdown','pointermove','keydown','input'])document.addEventListener(event,()=>lastInput=Date.now(),{passive:true});
 const supported='serviceWorker'in navigator&&location.protocol==='https:';
 let controlled=supported&&!!navigator.serviceWorker.controller;
 if(supported){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)queue();controlled=true;});}
 async function check(){
  if(checking||!navigator.onLine)return;checking=true;
  try{
   if(supported){registration ||= await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await registration.update();}
   else {const r=await fetch('./release.json',{cache:'no-store'});if(r.ok&&(await r.json()).version!==version)queue();}
  }catch{/* Offline clients keep their installed version. */}finally{checking=false;}
 }
 check();setInterval(check,5*60*1000);window.addEventListener('online',check);window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 setInterval(()=>{if(applier.pending&&(document.hidden||Date.now()-lastInput>=30000))applier.apply();},3000);
 return applier;
}
