// Sweep a fixed, tilted elliptical nib along the pointer path. Its width
// varies with direction even on touchscreens without pressure sensing.
export function drawArabicNib(ctx,{points,size}){
 if(!points?.length)return;
 const width=Math.min(60,Math.max(1,size||4)), major=width*.95, minor=width*.17;
 const angle=-Math.PI/4, co=Math.cos(angle), si=Math.sin(angle);
 ctx.save();
 ctx.rotate(angle);
 ctx.scale(major,minor);
 ctx.beginPath();
 let px,py;
 for(const point of points){
  const x=(point.x*co+point.y*si)/major,y=(-point.x*si+point.y*co)/minor;
  if(px!==undefined){
   const dx=x-px,dy=y-py,len=Math.hypot(dx,dy);
   if(len){
    const nx=-dy/len,ny=dx/len;
    ctx.moveTo(px-nx,py-ny);ctx.lineTo(x-nx,y-ny);
    ctx.lineTo(x+nx,y+ny);ctx.lineTo(px+nx,py+ny);ctx.closePath();
   }
  }
  ctx.moveTo(x+1,y);ctx.arc(x,y,1,0,2*Math.PI);ctx.closePath();
  px=x;py=y;
 }
 // One fill preserves the chosen opacity where segments overlap.
 ctx.fill();
 ctx.restore();
}
