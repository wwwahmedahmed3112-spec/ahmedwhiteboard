import {DatabaseSync} from 'node:sqlite';
export class LicenseError extends Error{constructor(code,message,status=403){super(message);this.code=code;this.status=status;}}
export function createStore(path=':memory:'){
 const db=new DatabaseSync(path);db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS licenses(id TEXT PRIMARY KEY,customer TEXT NOT NULL,payload_hash TEXT NOT NULL,starts_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS devices(license_id TEXT NOT NULL REFERENCES licenses(id),device_id TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(license_id,device_id));
 CREATE TABLE IF NOT EXISTS challenges(nonce TEXT PRIMARY KEY,digest TEXT NOT NULL,device_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS challenge_expiry ON challenges(expires_at);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,action TEXT NOT NULL,license_id TEXT,device_id TEXT);`);
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
 return {
  db,configureAdmin(version){const old=db.prepare("SELECT value FROM settings WHERE key='admin-version'").get();if(old?.value!==version)transaction(()=>{db.exec('DELETE FROM admin_sessions');db.prepare("INSERT INTO settings(key,value) VALUES('admin-version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(version);});},close:()=>db.close(),health:()=>db.prepare('SELECT 1').get(),
  challenge(nonce,digest,device,expires,now){db.prepare('DELETE FROM challenges WHERE expires_at<=?').run(now);if(db.prepare('SELECT count(*) n FROM challenges').get().n>=10000)throw new LicenseError('BUSY','الخادم مشغول، حاول بعد دقيقة.',429);db.prepare('INSERT INTO challenges VALUES(?,?,?,?)').run(nonce,digest,device,expires);},
  getChallenge:nonce=>db.prepare('SELECT * FROM challenges WHERE nonce=?').get(nonce),
  authorize({license,payloadHash,digest,deviceId,nonce,now,maxDevices}){return transaction(()=>{
   const challenge=db.prepare('SELECT * FROM challenges WHERE nonce=?').get(nonce);
   if(!challenge||challenge.expires_at<=now||challenge.digest!==digest||challenge.device_id!==deviceId)throw new LicenseError('CHALLENGE_EXPIRED','أعد محاولة التحقق من الترخيص.',401);
   db.prepare('DELETE FROM challenges WHERE nonce=?').run(nonce);
   const start=Date.parse(license.startsAt||license.issuedAt),end=Date.parse(license.expiresAt);
   if(now<start)throw new LicenseError('NOT_STARTED','لم تبدأ مدة هذا الاشتراك بعد.');
   if(now>=end)throw new LicenseError('EXPIRED','انتهى الاشتراك. دروسك والأدوات الأساسية محفوظة.');
   const previous=db.prepare('SELECT * FROM licenses WHERE id=?').get(license.id);
   if(previous&&previous.payload_hash!==payloadHash)throw new LicenseError('LICENSE_CONFLICT','ملف مختلف يستخدم رقم ترخيص موجودًا. تواصل مع المالك.');
   if(previous?.revoked)throw new LicenseError('REVOKED','أوقف المالك هذا الترخيص. تواصل معه.');
   if(!previous)db.prepare('INSERT INTO licenses VALUES(?,?,?,?,?,0,?,?)').run(license.id,license.customer,payloadHash,start,end,now,now);
   const device=db.prepare('SELECT * FROM devices WHERE license_id=? AND device_id=?').get(license.id,deviceId);
   if(device?.disabled)throw new LicenseError('DEVICE_DISABLED','أوقف المالك تفعيل هذا المتصفح.');
   if(!device){const count=db.prepare('SELECT count(*) n FROM devices WHERE license_id=? AND disabled=0').get(license.id).n;if(count>=maxDevices)throw new LicenseError('DEVICE_LIMIT','اكتمل عدد المتصفحات المسموح بها لهذا الترخيص. اطلب من المالك إلغاء تفعيل متصفح قديم.');db.prepare('INSERT INTO devices VALUES(?,?,0,?,?)').run(license.id,deviceId,now,now);}
   db.prepare('UPDATE licenses SET last_seen=? WHERE id=?').run(now,license.id);db.prepare('UPDATE devices SET last_seen=? WHERE license_id=? AND device_id=?').run(now,license.id,deviceId);
   return {active:true,licenseId:license.id,deviceId,serverTime:now,expiresAt:end,leaseSeconds:Math.floor(Math.min(15*60,(end-now)/1000)),maxDevices};
  });},
  list(){const licenses=db.prepare('SELECT * FROM licenses ORDER BY created_at DESC LIMIT 500').all();for(const l of licenses)l.devices=db.prepare('SELECT device_id,disabled,created_at,last_seen FROM devices WHERE license_id=? ORDER BY created_at').all(l.id);return licenses;},
  setRevoked(id,revoked,now){if(db.prepare('UPDATE licenses SET revoked=? WHERE id=?').run(revoked?1:0,id).changes!==1)throw new LicenseError('NOT_FOUND','الترخيص غير موجود.',404);db.prepare('INSERT INTO audit(at,action,license_id) VALUES(?,?,?)').run(now,revoked?'revoke':'restore',id);},
  setDevice(id,device,disabled,now,maxDevices){return transaction(()=>{const row=db.prepare('SELECT * FROM devices WHERE license_id=? AND device_id=?').get(id,device);if(!row)throw new LicenseError('NOT_FOUND','المتصفح غير موجود.',404);if(!disabled&&row.disabled&&db.prepare('SELECT count(*) n FROM devices WHERE license_id=? AND disabled=0').get(id).n>=maxDevices)throw new LicenseError('DEVICE_LIMIT','ألغِ تفعيل متصفح آخر أولًا.');db.prepare('UPDATE devices SET disabled=? WHERE license_id=? AND device_id=?').run(disabled?1:0,id,device);db.prepare('INSERT INTO audit(at,action,license_id,device_id) VALUES(?,?,?,?)').run(now,disabled?'disable-device':'restore-device',id,device);});},
  session(hash,csrf,expires,now){db.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(now);db.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(hash,csrf,expires);},
  getSession:(hash,now)=>db.prepare('SELECT csrf,expires_at FROM admin_sessions WHERE token_hash=? AND expires_at>?').get(hash,now),
  deleteSession:hash=>db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hash),
  export(){return transaction(()=>({version:1,licenses:db.prepare('SELECT * FROM licenses').all(),devices:db.prepare('SELECT * FROM devices').all(),audit:db.prepare('SELECT * FROM audit').all()}));}
 };
}
