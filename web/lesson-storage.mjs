// Keep the latest draft for old clients and a separate entry for every lesson.
export function hasLessonContent(p){return !!(p&&(p.title&&p.title!=='درس جديد'||p.notes||p.pages?.some(page=>page.ops?.length||page.pdf||page.videos?.length)));}
export function createLessonStorage({database,uid}){
 async function write(project,{latest=true}={}){
  const snapshot=structuredClone({...project,lessonId:project.lessonId||uid()});
  const db=await database();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('data','readwrite'),store=tx.objectStore('data');
   const request=store.get('lesson-index');
   request.onsuccess=()=>{
    const entries=Array.isArray(request.result)?request.result:[];
    const entry={id:snapshot.lessonId,title:snapshot.title||'درس جديد',updatedAt:Date.now(),pages:snapshot.pages.length};
    store.put([entry,...entries.filter(x=>x.id!==entry.id)],'lesson-index');
    store.put(snapshot,'lesson:'+entry.id);
    if(latest)store.put(snapshot,'project');
   };
   tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('تعذّر حفظ الدرس'));
  });return snapshot;
 }
 async function get(key){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 return {save:write,archive:project=>write(project,{latest:false}),list:async()=>await get('lesson-index')||[],open:id=>get('lesson:'+id)};
}
const RESUME='sabourati-update-resume-v1';
export function rememberUpdateLesson(storage,lessonId,now=Date.now()){storage.setItem(RESUME,JSON.stringify({lessonId,at:now}));}
export function takeUpdateLesson(storage,now=Date.now()){
 try{const raw=storage.getItem(RESUME);storage.removeItem(RESUME);if(!raw)return null;const v=JSON.parse(raw);return typeof v.lessonId==='string'&&now-v.at>=0&&now-v.at<120000?v.lessonId:null;}catch{return null;}
}
