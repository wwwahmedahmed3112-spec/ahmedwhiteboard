export const MOTIONS=['none','fade','up','right','zoom'];
export function validateMotion(m){if(m==null)return;if(typeof m!=='object'||!['start','hold','duration'].every(k=>Number.isFinite(m[k]))||m.start<0||m.start>3600||m.hold<.1||m.hold>3600||m.duration<.1||m.duration>5||!MOTIONS.includes(m.enter)||!MOTIONS.includes(m.exit))throw Error('توقيت النص غير صالح');}
export function motionState(m,time){
 if(!m||!Number.isFinite(time))return {visible:true,alpha:1,dx:0,dy:0,scale:1};
 const end=m.start+2*m.duration+m.hold;
 if(time<m.start||time>=end)return {visible:false,alpha:0,dx:0,dy:0,scale:1};
 let type='none',amount=0;
 if(time<m.start+m.duration){type=m.enter;amount=1-(time-m.start)/m.duration;}
 else if(time>=m.start+m.duration+m.hold){type=m.exit;amount=(time-m.start-m.duration-m.hold)/m.duration;}
 amount=Math.max(0,Math.min(1,amount));
 return {visible:true,alpha:type==='none'?1:1-amount,dx:type==='right'?80*amount:0,dy:type==='up'?50*amount:0,scale:type==='zoom'?1-.3*amount:1};
}
export function textFont(o){const family=/^[\w -]{1,80}$/.test(o.fontFamily||'')?o.fontFamily:'Tahoma';return (o.bold===false?'':'bold ')+(o.fontSize||42)+'px "'+family+'", Tahoma, Arial, sans-serif';}
