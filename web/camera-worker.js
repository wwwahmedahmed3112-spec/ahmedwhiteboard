let segmenter,background=null;const source=new OffscreenCanvas(320,240),mask=new OffscreenCanvas(320,240),person=new OffscreenCanvas(320,240),output=new OffscreenCanvas(320,240);
const sc=source.getContext('2d'),mc=mask.getContext('2d'),pc=person.getContext('2d'),oc=output.getContext('2d');
async function init(){const {ImageSegmenter}=await import('./camera/vision_bundle.mjs');segmenter=await ImageSegmenter.createFromOptions({wasmLoaderPath:new URL('./camera/wasm/vision_wasm_internal.js',self.location.href).href,wasmBinaryPath:new URL('./camera/wasm/vision_wasm_internal.wasm',self.location.href).href},{canvas:new OffscreenCanvas(320,240),baseOptions:{modelAssetPath:new URL('./camera/selfie_segmenter.tflite',self.location.href).href,delegate:'GPU'},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});postMessage({type:'ready'});}
function cover(ctx,image,w,h){const scale=Math.max(w/image.width,h/image.height);ctx.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale);}
self.onmessage=async({data})=>{
 if(data.type==='init'){try{if(!new OffscreenCanvas(16,16).getContext('webgl2'))throw Error('WebGL2 unavailable');await init();}catch(error){postMessage({type:'error',message:'تعذّر تشغيل تغيير الخلفية. يمكنك استخدام الخلفية الأصلية.',detail:error.message});}return;}
 if(data.type==='background'){background?.close();background=data.image;return;}
 if(data.type!=='frame')return;
 const frame=data.frame;
 try{
  const w=320,h=Math.max(1,Math.round(320*frame.height/frame.width));for(const canvas of[source,mask,person,output]){if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;}
  sc.drawImage(frame,0,0,w,h);
  segmenter.segmentForVideo(source,data.timestamp,result=>{
   // The official SelfieSegmenter binary model returns one foreground confidence channel.
   const confidence=result.confidenceMasks?.[result.confidenceMasks.length-1];if(!confidence)throw Error('Missing segmentation');
   const values=confidence.getAsFloat32Array(),pixels=mc.createImageData(confidence.width,confidence.height);
   for(let i=0;i<values.length;i++){const at=i*4;pixels.data[at]=pixels.data[at+1]=pixels.data[at+2]=255;pixels.data[at+3]=Math.round(Math.max(0,Math.min(1,(values[i]-.25)/.5))*255);}
   if(mask.width!==confidence.width)mask.width=confidence.width;if(mask.height!==confidence.height)mask.height=confidence.height;mc.putImageData(pixels,0,0);
   pc.clearRect(0,0,w,h);pc.globalCompositeOperation='source-over';pc.drawImage(source,0,0);pc.globalCompositeOperation='destination-in';pc.drawImage(mask,0,0,w,h);pc.globalCompositeOperation='source-over';
   oc.clearRect(0,0,w,h);if(data.mode==='blur'){oc.filter='blur(12px)';oc.drawImage(source,-16,-16,w+32,h+32);oc.filter='none';}else if(data.mode==='image'&&background){cover(oc,background,w,h);}else{oc.fillStyle=data.color||'#183153';oc.fillRect(0,0,w,h);}oc.drawImage(person,0,0);
  });
  const image=output.transferToImageBitmap();postMessage({type:'frame',image},[image]);
 }catch(error){postMessage({type:'error',message:'توقفت معالجة الخلفية. تم الرجوع إلى الكاميرا الأصلية.',detail:error.stack});}finally{frame.close();}
};
