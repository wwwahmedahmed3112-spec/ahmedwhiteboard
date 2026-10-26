import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';
import {LicenseError} from './store.mjs';import {sha256,token,proofMessage,ownerVerifier,deviceIdentity,verifyProof,checkPassword,rateLimiter} from './security.mjs';
const secureHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
async function body(req){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new LicenseError('JSON_REQUIRED','أرسل طلب JSON.',415);let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>32768)throw new LicenseError('TOO_LARGE','الطلب أكبر من المسموح.',413);chunks.push(chunk);}try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw new LicenseError('BAD_JSON','الطلب غير صحيح.',400);}}
export function createLicenseServer({store,publicOrigin,allowedOrigins=['https://ahmedwhiteboard.onrender.com'],adminPasswordHash,maxDevices=2,now=Date.now,ownerPublicKey,production=true}){
 store.configureAdmin(sha256(adminPasswordHash));
 const verifyOwner=ownerVerifier(ownerPublicKey),limit=rateLimiter(600),globalLimit=rateLimiter(3000),loginLimit=rateLimiter(8);
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 const cookie=token=>'sabourati_admin='+token+'; HttpOnly; SameSite=Strict; Path=/admin/; Max-Age=43200'+(production?'; Secure':'');
 function admin(req,write=false){const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sabourati_admin='))?.slice(16);if(!raw)throw new LicenseError('LOGIN_REQUIRED','سجّل دخول المالك.',401);const hash=sha256(raw),session=store.getSession(hash,now());if(!session)throw new LicenseError('LOGIN_REQUIRED','انتهت جلسة المالك. سجّل الدخول مجددًا.',401);if(write&&(req.headers.origin!==publicOrigin||req.headers['x-csrf-token']!==session.csrf))throw new LicenseError('CSRF','طلب غير مسموح.',403);return {...session,hash};}
 return createServer(async(req,res)=>{
  for(const [k,v]of Object.entries(secureHeaders))res.setHeader(k,v);
  const time=now(),origin=req.headers.origin;
  try{const path=new URL(req.url,'http://internal').pathname;
   if(path.startsWith('/v1/')){
    if(!allowedOrigins.includes(origin))throw new LicenseError('ORIGIN','هذا الموقع غير مسموح له بالاتصال.',403);
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.method!=='POST')throw new LicenseError('METHOD','طريقة الطلب غير مسموحة.',405);
    if(!globalLimit('all',time)||!limit(req.socket.remoteAddress||'global',time))throw new LicenseError('RATE_LIMIT','طلبات كثيرة، حاول بعد دقيقة.',429);
    const data=await body(req),device=deviceIdentity(data.publicKey);
    if(path==='/v1/challenge'){
     if(!/^[a-f0-9]{64}$/.test(data.digest))throw new LicenseError('BAD_DIGEST','بصمة الترخيص غير صحيحة.',400);
     const nonce=token();store.challenge(nonce,data.digest,device.id,time+90000,time);json(res,200,{nonce,serverTime:time});return;
    }
    if(path==='/v1/verify'){
     const signed=verifyOwner(data.license),challenge=store.getChallenge(data.nonce),verifiedAt=now();
     if(!challenge||challenge.expires_at<=verifiedAt||challenge.device_id!==device.id||challenge.digest!==signed.digest||!verifyProof(device.publicKey,proofMessage(data.nonce,signed.digest),data.proof))throw new LicenseError('INVALID_PROOF','تعذّر إثبات هوية المتصفح. أعد المحاولة.',401);
     json(res,200,store.authorize({...signed,deviceId:device.id,nonce:data.nonce,now:verifiedAt,maxDevices}));return;
    }
    throw new LicenseError('NOT_FOUND','المسار غير موجود.',404);
   }
   if(path==='/healthz'&&req.method==='GET'){store.health();json(res,200,{ok:true});return;}
   if(path==='/admin/api/login'&&req.method==='POST'){
    if(origin!==publicOrigin)throw new LicenseError('ORIGIN','طلب غير مسموح.',403);
    if(!loginLimit('all',time))throw new LicenseError('RATE_LIMIT','محاولات كثيرة. انتظر دقيقة.',429);
    const data=await body(req);if(!checkPassword(data.password,adminPasswordHash))throw new LicenseError('INVALID_LOGIN','بيانات دخول المالك غير صحيحة.',401);
    const secret=token(),csrf=token();store.session(sha256(secret),csrf,time+12*3600000,time);res.setHeader('Set-Cookie',cookie(secret));json(res,200,{csrf});return;
   }
   if(path.startsWith('/admin/api/')){
    const session=admin(req,req.method!=='GET');
    if(path==='/admin/api/session'&&req.method==='GET'){json(res,200,{csrf:session.csrf,serverTime:time});return;}
    if(path==='/admin/api/licenses'&&req.method==='GET'){json(res,200,{licenses:store.list(),serverTime:time,maxDevices});return;}
    if(path==='/admin/api/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="Sabourati-License-Backup.json"');json(res,200,store.export());return;}
    if(path==='/admin/api/logout'&&req.method==='POST'){store.deleteSession(session.hash);res.setHeader('Set-Cookie','sabourati_admin=; Path=/admin/; Max-Age=0; HttpOnly; SameSite=Strict'+(production?'; Secure':''));json(res,200,{ok:true});return;}
    if(req.method==='POST'){
     const data=await body(req);if(typeof data.licenseId!=='string'||data.licenseId.length>128)throw new LicenseError('INVALID_ID','رقم ترخيص غير صحيح.',400);
     if(path==='/admin/api/revoke'&&typeof data.revoked==='boolean')store.setRevoked(data.licenseId,data.revoked,time);
     else if(path==='/admin/api/device'&&typeof data.disabled==='boolean'&&typeof data.deviceId==='string')store.setDevice(data.licenseId,data.deviceId,data.disabled,time,maxDevices);
     else throw new LicenseError('NOT_FOUND','المسار غير موجود.',404);
     json(res,200,{ok:true});return;
    }
    throw new LicenseError('NOT_FOUND','المسار غير موجود.',404);
   }
   const assets={'/admin/':['admin.html','text/html; charset=utf-8'],'/admin/admin.mjs':['admin.mjs','text/javascript; charset=utf-8'],'/admin/admin.css':['admin.css','text/css; charset=utf-8']};
   if(assets[path]&&req.method==='GET'){const [file,type]=assets[path];res.setHeader('Content-Type',type);res.end(await readFile(new URL('./public/'+file,import.meta.url)));return;}
   if(path==='/'||path==='/admin'){res.writeHead(302,{Location:'/admin/'});res.end();return;}
   throw new LicenseError('NOT_FOUND','المسار غير موجود.',404);
  }catch(e){if(res.headersSent){res.end();return;}if(e instanceof LicenseError){json(res,e.status,{code:e.code,message:e.message,serverTime:time});}else{console.error('License request failed:',e.name);json(res,503,{code:'UNAVAILABLE',message:'تعذّر التحقق الآن. حاول بعد قليل.',serverTime:time});}}
 });
}
