export function instrumentEdges(kind){return kind==='ruler'?[[{x:0,y:0},{x:500,y:0}],[{x:0,y:70},{x:500,y:70}]]:[[{x:20,y:190},{x:20,y:20}],[{x:20,y:20},{x:340,y:190}],[{x:340,y:190},{x:20,y:190}]];}
export function projectToEdge(p,[a,b]){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;return{x:a.x+t*dx,y:a.y+t*dy};}
export function nearestEdge(p,edges){return edges.reduce((best,edge)=>{const q=projectToEdge(p,edge),d=Math.hypot(p.x-q.x,p.y-q.y);return !best||d<best.d?{edge,d}:best;},null).edge;}
