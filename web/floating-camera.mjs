export function clampCameraPosition(x,y,width,height,viewportWidth,viewportHeight){return{x:Math.max(0,Math.min(Math.max(0,viewportWidth-width),x)),y:Math.max(0,Math.min(Math.max(0,viewportHeight-height),y))};}
export function initFloatingCamera(panel,handle){
 let drag=null;const storageKey='sabourati-camera-position-v1';
 function move(x,y,save=false){const r=panel.getBoundingClientRect(),p=clampCameraPosition(x,y,r.width,r.height,innerWidth,innerHeight);panel.style.left=p.x+'px';panel.style.top=p.y+'px';panel.style.right='auto';if(save)try{localStorage.setItem(storageKey,JSON.stringify({x:p.x/Math.max(1,innerWidth),y:p.y/Math.max(1,innerHeight)}));}catch{}}
 try{const p=JSON.parse(localStorage.getItem(storageKey));if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))move(p.x*innerWidth,p.y*innerHeight);}catch{}
 handle.onpointerdown=e=>{if(e.button>0)return;e.preventDefault();const r=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};handle.setPointerCapture(e.pointerId);};
 handle.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();move(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);};
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);const r=panel.getBoundingClientRect();move(r.left,r.top,true);};handle.onpointerup=handle.onpointercancel=end;
 handle.onkeydown=e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const r=panel.getBoundingClientRect(),step=e.shiftKey?20:5;move(r.left+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),r.top+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0),true);};
 const fit=()=>{if(panel.hidden)return;const r=panel.getBoundingClientRect();move(r.left,r.top);};window.addEventListener('resize',fit);new ResizeObserver(fit).observe(panel);
}
