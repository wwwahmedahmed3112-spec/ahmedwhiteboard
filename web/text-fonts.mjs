export const BUILTIN_FONTS=[['Tahoma','تاهوما — افتراضي'],['SabAmiri','أميري — نسخ'],['SabRuqaa','عارف رقعة'],['SabCairo','القاهرة — عصري'],['Arial','Arial']];
const paths={SabAmiri:'Amiri-Regular.ttf',SabRuqaa:'ArefRuqaa-Regular.ttf',SabCairo:'Cairo[slnt,wght].ttf'},loaded=new Map();
export function validateFontAssets(assets=[]){if(!Array.isArray(assets)||assets.length>12)throw Error('الحد الأقصى 12 خطًا');const ids=new Set();let bytes=0;for(const a of assets){if(!a||!/^SabCustom[0-9a-f]{24}$/.test(a.family)||ids.has(a.family)||typeof a.label!=='string'||a.label.length>100||typeof a.data!=='string'||!/^data:font\/(ttf|otf|woff2?);base64,[a-zA-Z0-9+/=]+$/.test(a.data)||a.data.length>2800000)throw Error('ملف خط غير صالح');ids.add(a.family);bytes+=a.data.length;}if(bytes>18000000)throw Error('حجم الخطوط أكبر من المسموح');}
export async function ensureFont(family,assets=[]){
 if(loaded.has(family))return loaded.get(family);
 let source;if(paths[family])source='url("'+new URL('fonts/'+paths[family],import.meta.url).href+'")';else{const a=assets.find(a=>a.family===family);if(a)source='url("'+a.data+'")';}
 if(!source)return;
 const promise=(async()=>{const face=new FontFace(family,source);await face.load();document.fonts.add(face);})();loaded.set(family,promise);
 try{await promise;}catch(error){loaded.delete(family);throw error;}
}
export async function importFont(file){
 if(file.size>2*1024*1024)throw Error('اختر خطًا أصغر من 2 ميجابايت');
 const ext=file.name.split('.').at(-1).toLowerCase();if(!['ttf','otf','woff','woff2'].includes(ext))throw Error('اختر TTF أو OTF أو WOFF أو WOFF2');
 const bytes=await file.arrayBuffer(),hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 const family='SabCustom'+[...hash].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('');
 const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve('data:font/'+ext+';base64,'+String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(new Blob([bytes]));});
 const asset={family,label:file.name.replace(/\.[^.]+$/,'').slice(0,100),data};await ensureFont(family,[asset]);return asset;
}
