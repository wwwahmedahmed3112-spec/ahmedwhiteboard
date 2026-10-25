// Records the browser-approved surface, including its DOM overlays and camera preview.
export async function createWindowRecording({microphone=true,camera=true,sharedAudio=true,existingCamera=null,signal,onCamera=()=>{},onCameraReleased=()=>{},onStarted=()=>{},onFinished=()=>{},onWarning=()=>{},onError=()=>{},maxBytes=450*1024*1024},api={mediaDevices:navigator.mediaDevices,MediaRecorder:globalThis.MediaRecorder,MediaStream:globalThis.MediaStream,AudioContext:globalThis.AudioContext||globalThis.webkitAudioContext}){
 const owned=[],nodes=[];let audioContext=null,recorder=null,closed=false,finished=false,cameraOwned=false;
 const stopTracks=stream=>stream?.getTracks().forEach(t=>t.stop());
 function cleanup(){if(closed)return;closed=true;signal?.removeEventListener('abort',cancel);owned.forEach(stopTracks);for(const n of nodes){try{n.disconnect();}catch{}}if(audioContext)Promise.resolve(audioContext.close()).catch(()=>{});if(cameraOwned)onCameraReleased();}
 function stop(){if(recorder&&recorder.state!=='inactive')recorder.stop();else cleanup();}
 function cancel(){stop();}
 function check(){if(signal?.aborted||closed){const e=Error('Recording cancelled');e.name='AbortError';throw e;}}
 function own(stream){if(signal?.aborted||closed){stopTracks(stream);check();}owned.push(stream);check();return stream;}
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  check();
  // Must be the first awaited browser request so the click's user activation is retained.
  const display=own(await api.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:sharedAudio,preferCurrentTab:true,selfBrowserSurface:'include',systemAudio:sharedAudio?'include':'exclude'}));
  const video=display.getVideoTracks()[0];if(!video||video.readyState==='ended')throw Error('لم يتم اختيار نافذة صالحة للتسجيل.');
  video.addEventListener('ended',stop,{once:true});
  const inputs=[];
  if(display.getAudioTracks().length)inputs.push(display);
  else if(sharedAudio)onWarning('لم يشارك المتصفح صوت النافذة؛ يُسجّل الميكروفون إذا اخترته.');
  if(microphone){const mic=own(await api.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}));if(!mic.getAudioTracks().length)throw Error('لم يصل صوت الميكروفون.');inputs.push(mic);}
  if(camera){let webcam=existingCamera?.getVideoTracks().some(t=>t.readyState==='live')?existingCamera:null;if(!webcam){webcam=own(await api.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false}));cameraOwned=true;}check();await onCamera(webcam);check();}
  check();
  const output=new api.MediaStream([video]);
  if(inputs.length===1){inputs[0].getAudioTracks().forEach(t=>output.addTrack(t));}
  else if(inputs.length>1){
   if(!api.AudioContext)throw Error('المتصفح لا يدعم مزج الميكروفون مع صوت النافذة.');
   audioContext=new api.AudioContext();await audioContext.resume();check();const destination=audioContext.createMediaStreamDestination();
   for(const input of inputs){const source=audioContext.createMediaStreamSource(input);source.connect(destination);nodes.push(source);}destination.stream.getAudioTracks().forEach(t=>output.addTrack(t));owned.push(destination.stream);
  }
  const type=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>api.MediaRecorder.isTypeSupported(t));
  recorder=new api.MediaRecorder(output,{...(type?{mimeType:type}:{}),videoBitsPerSecond:2500000});
  let chunks=[],bytes=0;
  recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>=maxBytes&&recorder.state==='recording'){onWarning('تم إيقاف التسجيل عند الحد الآمن للذاكرة.');stop();}}};
  recorder.onstop=()=>{if(finished)return;finished=true;const mime=recorder.mimeType||'video/webm',blob=new Blob(chunks,{type:mime});chunks=[];cleanup();onFinished(blob,mime);};
  recorder.onerror=event=>{onError(event.error||Error('تعذّر التسجيل'));stop();};
  check();if(video.readyState==='ended')throw Error('توقفت مشاركة النافذة قبل بدء التسجيل.');recorder.start(1000);onStarted();
  return {stop,get state(){return recorder.state;}};
 }catch(error){cleanup();throw error;}
}
