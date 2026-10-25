import {licensePeriod} from './subscription.mjs';
export function subscriptionReminder(license,now=Date.now()){
 let p;try{p=licensePeriod(license);}catch{return null;}
 if(!p||p.kind!=='monthly'||now<p.start)return null;
 const remaining=p.end-now,date=new Date(p.end).toLocaleDateString('ar-EG');
 if(remaining<=0)return {state:'expired',text:'انتهى اشتراكك. جدّد بـ١٠٠ جنيه شهريًا لاستعادة الأدوات المتقدمة. دروسك محفوظة.',end:p.end};
 if(remaining>7*86400000)return null;
 const hours=Math.ceil(remaining/3600000),days=Math.ceil(remaining/86400000);
 const time=hours<=24?'خلال '+hours.toLocaleString('ar-EG')+' ساعة':'خلال '+days.toLocaleString('ar-EG')+' أيام';
 return {state:'soon',text:'ينتهي اشتراكك '+time+'، بتاريخ '+date+'. جدّد بـ١٠٠ جنيه شهريًا؛ التجديد المبكر يُضاف إلى نهاية مدتك الحالية.',end:p.end};
}
