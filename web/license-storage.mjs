// Both copies hold the signed license, never a private signing key.
export function createLicenseStorage({read,store,verify,local={getItem:k=>globalThis.localStorage.getItem(k),setItem:(k,v)=>globalThis.localStorage.setItem(k,v)}}){
 const key='sabourati-license-v2';
 async function save(text){
  await verify(text);
  let saved=false;
  try{local.setItem(key,text);saved=true;}catch{}
  try{await store('license',text);saved=true;}catch{}
  if(!saved)throw Error('تعذّر حفظ الترخيص على هذا الجهاز');
  try{await globalThis.navigator?.storage?.persist?.();}catch{}
 }
 async function restore(){
  const candidates=[];
  try{const text=local.getItem(key);if(text)candidates.push(text);}catch{}
  try{const text=await read('license');if(text&&!candidates.includes(text))candidates.push(text);}catch{}
  for(const text of candidates){try{const license=await verify(text);await save(text);return {text,license};}catch{}}
  return null;
 }
 return {save,restore};
}
