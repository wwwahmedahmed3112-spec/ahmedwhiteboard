export function initCameraBackground({video,canvas,controls,status,onError=()=>{}}){
 let worker=null,ready=false,busy=false,generation=0,stream=null,mode='original',color='#183153',frameId=0,lastFrame=0,imageFile=null,initializing=null,workerTimer=null;
 const ctx=canvas.getContext('2d'),select=controls.querySelector('select'),colorInput=controls.querySelector('input[type=color]'),fileInput=controls.querySelector('input[type=file]');
 function original(){canvas.hidden=true;video.hidden=false;}
 function fail(message){mode='original';select.value=mode;original();status.textContent=message;busy=false;worker?.terminate();worker=null;ready=false;initializing=null;onError(message);}
 async function sendImage(){if(!worker||!ready||!imageFile)return;const image=await createImageBitmap(imageFile);if(!worker){image.close();return;}worker.postMessage({type:'background',image},[image]);}
 function ensureWorker(){if(initializing)return initializing;
  const token=generation;status.textContent='جارٍ تجهيز فصل الخلفية محليًا…';
  initializing=new Promise((resolve,reject)=>{const w=worker=new Worker(new URL('./camera-worker.js',import.meta.url));const timer=workerTimer=setTimeout(()=>{if(token!==generation)return;fail('تأخر تحميل الخلفية. اختر الخلفية مجددًا عند اتصال الإنترنت.');reject(Error('Background timeout'));},45000);
   w.onmessage=({data})=>{if(token!==generation){data.image?.close();return;}if(data.type==='ready'){clearTimeout(timer);ready=true;status.textContent='معالجة الخلفية تعمل على جهازك';resolve();sendImage().catch(()=>fail('تعذّر فتح صورة الخلفية.'));}else if(data.type==='frame'){busy=false;if(mode!=='original'&&stream){canvas.width=data.image.width;canvas.height=data.image.height;ctx.drawImage(data.image,0,0);canvas.hidden=false;video.hidden=true;}data.image.close();}else if(data.type==='error'){clearTimeout(timer);fail(data.message);reject(Error(data.message));}};
   w.onerror=()=>{clearTimeout(timer);fail('هذا المتصفح لا يدعم معالجة الخلفية. الكاميرا الأصلية متاحة.');reject(Error('Background worker failed'));};w.postMessage({type:'init'});
  });return initializing;
 }
 async function tick(timestamp){frameId=requestAnimationFrame(tick);if(!stream||mode==='original'||!ready||busy||video.readyState<2||timestamp-lastFrame<100)return;busy=true;lastFrame=timestamp;const token=generation;try{const frame=await createImageBitmap(video);if(token!==generation||!worker||mode==='original'){frame.close();busy=false;return;}worker.postMessage({type:'frame',frame,timestamp,mode,color},[frame]);}catch{busy=false;}}
 select.onchange=async()=>{mode=select.value;if(mode==='original'){original();status.textContent='الخلفية الأصلية';return;}if(mode==='image'&&!imageFile){status.textContent='اختر صورة للخلفية أولًا.';original();return;}try{await ensureWorker();if(mode==='image')await sendImage();}catch{}};
 colorInput.oninput=()=>{color=colorInput.value;if(mode!=='color'){select.value='color';select.onchange();}};
 fileInput.onchange=async()=>{const file=fileInput.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){status.textContent='اختر صورة JPG أو PNG أو WebP أصغر من 8 ميجابايت.';return;}imageFile=file;select.value='image';await select.onchange();};
 return {async attach(value){stream=value;video.srcObject=value;await video.play();controls.hidden=false;original();cancelAnimationFrame(frameId);frameId=requestAnimationFrame(tick);if(mode!=='original')select.onchange();},detach(){stream=null;generation++;cancelAnimationFrame(frameId);clearTimeout(workerTimer);worker?.terminate();worker=null;initializing=null;ready=false;busy=false;original();video.srcObject=null;controls.hidden=true;status.textContent='';}};
}
