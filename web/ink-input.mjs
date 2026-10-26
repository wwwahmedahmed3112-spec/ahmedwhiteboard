export const PEN_COLORS=[['#111827','أسود'],['#263e67','كحلي'],['#1d4ed8','أزرق'],['#0284c7','سماوي'],['#0891b2','فيروزي'],['#0f766e','بترولي'],['#15803d','أخضر'],['#65a30d','ليموني'],['#eab308','أصفر'],['#b45309','بني ذهبي'],['#ea580c','برتقالي'],['#dc2626','أحمر'],['#b77567','مرجاني'],['#db2777','وردي'],['#9333ea','بنفسجي'],['#4c1d95','بنفسجي داكن'],['#688bbb','أزرق هادئ'],['#94a3b8','رمادي'],['#ffffff','أبيض'],['#bae6fd','سماوي فاتح'],['#bbf7d0','أخضر فاتح'],['#fef08a','أصفر فاتح'],['#fecdd3','وردي فاتح'],['#ddd6fe','لافندر']];
export const PEN_SIZES=[1,2,4,6,10,16,24,40];
export function normalizePenSize(value){const text=String(value).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace('٫','.');const n=Number(text);return text.trim()&&Number.isFinite(n)?Math.max(1,Math.min(60,Math.round(n))):null;}
export function pointerSamples(event){let samples=[];try{samples=event.getCoalescedEvents?.()||[];}catch{}samples=[...samples];const last=samples.at(-1);if(!last||last.clientX!==event.clientX||last.clientY!==event.clientY)samples.push(event);return samples.filter(p=>Number.isFinite(p.clientX)&&Number.isFinite(p.clientY));}
// Spatial filtering keeps latency bounded and preserves Arabic dots/short strokes.
export function appendInkPoint(stroke,point,{scale=1,smooth=false,final=false}={}){
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||stroke.points.length>=100000)return;
 const last=stroke.points.at(-1);if(!last){stroke.points.push({...point});return;}
 const distance=Math.hypot(point.x-last.x,point.y-last.y),screen=distance*Math.max(.01,scale);
 if(distance===0)return;
 let q={...point};
 if(smooth&&!final&&['pen','marker'].includes(stroke.type)){
  const follow=Math.min(.9,.4+screen/12);q.x=last.x+(q.x-last.x)*follow;q.y=last.y+(q.y-last.y)*follow;
 }
 if(final||Math.hypot(q.x-last.x,q.y-last.y)*scale>=.3)stroke.points.push(q);
 stroke.ex=point.x;stroke.ey=point.y;
}
