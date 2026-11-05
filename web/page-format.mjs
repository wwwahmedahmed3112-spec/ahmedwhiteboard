export const PAGE_FORMATS={landscape:{w:1600,h:900},reels:{w:1080,h:1920}};
export function reframePage(page,format){
 const target=PAGE_FORMATS[format];if(!target)throw Error('مقاس غير صالح');
 if(page.format===format)return {...page};
 const f=Math.min(target.w/page.w,target.h/page.h),dx=(target.w-page.w*f)/2,dy=(target.h-page.h*f)/2;
 const map=o=>{const n={...o};for(const k of ['x','ex'])if(Number.isFinite(n[k]))n[k]=n[k]*f+dx;for(const k of ['y','ey'])if(Number.isFinite(n[k]))n[k]=n[k]*f+dy;for(const k of ['size','fontSize','w','h'])if(Number.isFinite(n[k]))n[k]*=f;if(o.points)n.points=o.points.map(p=>({...p,x:p.x*f+dx,y:p.y*f+dy}));return n;};
 const box=page.pdfBox||{x:0,y:0,w:page.w,h:page.h};
 return {...page,...target,format,ops:page.ops.map(map),pdfBox:page.pdf?{x:box.x*f+dx,y:box.y*f+dy,w:box.w*f,h:box.h*f}:null};
}
export function pdfRect(page){const b=page.pdfBox;return b?[b.x,b.y,b.w,b.h]:[0,0,page.w,page.h];}
export function frameView(width,height,page){
 const fixed=page.format==='reels'||page.format==='landscape';
 const f=fixed?Math.min(width/page.w,height/page.h):width/page.w;
 return {w:fixed?page.w*f:width,h:fixed?page.h*f:height,fixed};
}
