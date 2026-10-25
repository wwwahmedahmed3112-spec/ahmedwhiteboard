// Licensing is offline and therefore uses the device clock.
export function licensePeriod(license){
 if(!license)return null;
 if((license.licenseType===undefined||license.licenseType==='perpetual')&&license.expiresAt===undefined)return {kind:'perpetual'};
 if(license.licenseType!=='monthly')throw Error('نوع الترخيص غير مدعوم');
 const start=Date.parse(license.startsAt||license.issuedAt),end=Date.parse(license.expiresAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('مدة الترخيص الشهري غير صحيحة');
 return {kind:'monthly',start,end};
}
export function isLicenseActive(license,now=Date.now()){
 try{const p=licensePeriod(license);return !!p&&(p.kind==='perpetual'||(now>=p.start&&now<p.end));}catch{return false;}
}
export function addCalendarMonth(value){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))throw Error('تاريخ غير صحيح');
 const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);
 const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 date.setUTCDate(Math.min(day,last));return date.toISOString();
}
export function monthlyPayload({id,customer,now=new Date().toISOString(),previous=null}){
 const current=Date.parse(now);if(!Number.isFinite(current)||!id||!customer?.trim())throw Error('بيانات الترخيص غير مكتملة');
 if(previous&&previous.customer!==customer.trim())throw Error('الترخيص السابق يخص اسمًا آخر');
 const p=licensePeriod(previous);if(p?.kind==='perpetual')throw Error('الترخيص السابق دائم ولا يحتاج إلى تجديد');
 const continuing=p&&current<p.end;
 return {product:'sabourati-pro-v2',edition:'pro',majorVersion:2,id,customer:customer.trim(),issuedAt:new Date(current).toISOString(),licenseType:'monthly',startsAt:continuing?new Date(p.start).toISOString():new Date(current).toISOString(),expiresAt:addCalendarMonth(continuing?p.end:current)};
}
