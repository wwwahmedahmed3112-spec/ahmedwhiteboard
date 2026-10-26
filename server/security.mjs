import {createHash,createPublicKey,verify,scryptSync,timingSafeEqual,randomBytes} from 'node:crypto';
import {CONFIG} from '../web/config.mjs';import {licensePeriod} from '../web/subscription.mjs';import {LicenseError} from './store.mjs';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export const proofMessage=(nonce,digest)=>'sabourati-check-v1\n'+nonce+'\n'+digest;
export function ownerVerifier(jwk=CONFIG.publicKey){const key=createPublicKey({key:jwk,format:'jwk'});return envelope=>{
 try{
  if(!envelope||typeof envelope.payload!=='string'||typeof envelope.signature!=='string'||envelope.payload.length>16000||envelope.signature.length>200||!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.payload)||!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature))throw Error();
  const bytes=Buffer.from(envelope.payload,'base64'),signature=Buffer.from(envelope.signature,'base64');if(signature.length!==64||!verify('sha256',bytes,{key,dsaEncoding:'ieee-p1363'},signature))throw Error();
  const license=JSON.parse(bytes.toString('utf8'));
  if(license.product!=='sabourati-pro-v2'||license.edition!=='pro'||license.majorVersion!==2||!/^[-_a-zA-Z0-9]{8,128}$/.test(license.id)||typeof license.customer!=='string'||!license.customer.trim()||license.customer.length>120)throw Error();
  if(licensePeriod(license)?.kind!=='monthly')throw new LicenseError('PERPETUAL_OFFLINE','الترخيص الدائم السابق يظل محليًا ولا يحتاج تحققًا شهريًا.');
  return {license,payloadHash:sha256(bytes),digest:sha256(envelope.payload+'.'+envelope.signature)};
 }catch(e){if(e instanceof LicenseError)throw e;throw new LicenseError('INVALID_LICENSE','ملف الترخيص أو توقيعه غير صحيح.',401);}
};}
export function deviceIdentity(jwk){try{if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||jwk.d!==undefined||!/^[-_A-Za-z0-9]{43}$/.test(jwk.x)||!/^[-_A-Za-z0-9]{43}$/.test(jwk.y))throw Error();const publicKey=createPublicKey({key:{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y},format:'jwk'});return {publicKey,id:sha256('P-256:'+jwk.x+':'+jwk.y)};}catch{throw new LicenseError('INVALID_DEVICE','هوية المتصفح غير صحيحة.',400);}}
export function verifyProof(publicKey,message,signature){try{return typeof signature==='string'&&signature.length<=100&&verify('sha256',Buffer.from(message),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url'));}catch{return false;}}
export function hashPassword(password,salt=randomBytes(16).toString('hex')){return 'scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');}
export function checkPassword(password,encoded){try{if(typeof password!=='string'||password.length>256)return false;const [method,salt,hash]=encoded.split(':');if(method!=='scrypt'||!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(hash))return false;const candidate=scryptSync(password,salt,64);return timingSafeEqual(candidate,Buffer.from(hash,'hex'));}catch{return false;}}
export function rateLimiter(limit,interval=60000){const map=new Map();return(key,now)=>{let bucket=map.get(key);if(!bucket||now>=bucket.until){bucket={count:0,until:now+interval};map.set(key,bucket);}if(map.size>5000)for(const [k,b]of map)if(now>=b.until)map.delete(k);return ++bucket.count<=limit;};}
