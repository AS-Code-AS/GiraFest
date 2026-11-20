import React,{useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import confetti from 'canvas-confetti';
import {db as realDb,dl as dlObj} from './storage.js';
import './index.css';
import logo from './logo.png';
import QRCode from 'qrcode';
const h=React.createElement;
const THEMES={
 clasico:{name:'Clásico',e:'🍮',deco:'✨',bg1:'#fff4ea',bg2:'#ffd9c2',card:'rgba(255,255,255,.78)',cardS:'rgba(255,255,255,.9)',tx:'#3a1d12',mut:'#8a5e4b',acc:'#d6336c',acc2:'#f59f00',bd:'rgba(214,51,108,.18)',btx:'#fff',ring:'#fff',lights:['#fff','#ffd43b'],colors:['#e63946','#e8590c','#2a9d8f','#8338ec','#d6336c','#3a86ff','#c77700','#0ca678'],tf:"'Pacifico'",wf:"'Fredoka'",bf:"'Poppins'"},
 navideno:{name:'Navideño',e:'🎄',deco:'❄',bg1:'#082a1e',bg2:'#5a0e22',card:'rgba(7,30,22,.78)',cardS:'rgba(7,28,20,.93)',tx:'#fdf2d8',mut:'#e2cd9b',acc:'#ecc979',acc2:'#b98a30',bd:'rgba(236,201,121,.42)',btx:'#2a1400',ring:'#d4af37',lights:['#fff1c1','#ff5d62','#86e8a8'],colors:['#a4161a','#0f5c3a','#b0802a','#78122e','#1d7a4b','#8a5718'],tf:"'Great Vibes'",tw:400,h1:'3.1rem',wf:"'Cormorant Garamond'",bf:"'Lato'"},
 fiesta:{name:'Fiesta',e:'🎉',deco:'🎉',bg1:'#1a0533',bg2:'#5b0a73',card:'rgba(40,10,70,.7)',cardS:'rgba(30,8,60,.88)',tx:'#ffffff',mut:'#e0b3ff',acc:'#ff2e93',acc2:'#00e5ff',bd:'rgba(255,255,255,.22)',btx:'#1a0533',ring:'#ffe066',lights:['#ff2e93','#00e5ff','#ffe066'],colors:['#e91e8c','#7c3aed','#0891b2','#ea580c','#16a34a','#ca8a04','#dc2626','#2563eb'],tf:"'Lilita One'",wf:"'Fredoka'",bf:"'Fredoka'"},
 elegante:{name:'Elegante',e:'👑',deco:'✦',bg1:'#14110f',bg2:'#2b2118',card:'rgba(30,24,18,.75)',cardS:'rgba(24,18,12,.92)',tx:'#f8ecd0',mut:'#c8b27a',acc:'#d4a017',acc2:'#f5d77a',bd:'rgba(212,160,23,.38)',btx:'#2b1b00',ring:'#d4a017',lights:['#f5d77a','#fff'],colors:['#7b1e3a','#1f3a5f','#4a3b2f','#0f5132','#5b2a86','#8a4b08'],tf:"'Playfair Display'",wf:"'Playfair Display'",bf:"'Poppins'"}
};
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'x';
const withIds=list=>{const seen={};return list.map(l=>{let b=slug(l);seen[b]=(seen[b]||0)+1;return{id:seen[b]>1?b+'-'+seen[b]:b,label:l}})};
const lines=t=>t.split('\n').map(x=>x.trim()).filter(Boolean);
const DEF_OPTS="Natilla tradicional\nBuñuelos\n25 buñuelos\nNatilla con arequipe\nGalletas y vino\nVino y galletas";
/* Ronda: cada vez que se crea una ruleta nueva cambia el id. Resultados de otras rondas se ignoran. */
const roundOf=cfg=>String((cfg&&cfg.round)||'0');
const inRound=(r,round)=>String((r&&r.round)||'0')===round;
/* Opciones que se DIBUJAN en la ruleta: todas las que no se han llevado otras personas (aunque tengas tapadas algunas para esta persona). */
function visibleFor(cfg,taken){return withIds(cfg.options).filter(o=>!taken.has(o.id))}
/* Opciones en las que esta persona SÍ puede caer (respeta las restricciones). */
/* ¿Puede esta persona llevarse esta opción? (restricciones + en modo amigo secreto, nadie se saca a sí mismo) */
const canTake=(cfg,pid,oid)=>{const a=cfg.restr&&cfg.restr[pid];return(!a||a.includes(oid))&&!(cfg.secret&&oid===pid)};
function poolFor(cfg,pid,taken){return withIds(cfg.options).filter(o=>!taken.has(o.id)&&canTake(cfg,pid,o.id))}
/* Si 'me' se lleva 'winId', ¿todos los que faltan todavía pueden quedar con algo? (emparejamiento) */
function canFinish(cfg,people,done,taken,meId,winId){
  const opts=withIds(cfg.options).filter(o=>!taken.has(o.id)&&o.id!==winId);
  const left=people.filter(p=>p.id!==meId&&!done.has(p.id));
  const owner={};
  const tryP=(p,seen)=>{for(const o of opts){if(!canTake(cfg,p.id,o.id)||seen[o.id])continue;seen[o.id]=1;if(!owner[o.id]||tryP(owner[o.id],seen)){owner[o.id]=p;return true}}return false};
  return left.every(p=>tryP(p,{}));
}
const split=t=>{if(t.length<=13)return[t];const m=t.length/2;let b=-1,bd=99;for(let i=0;i<t.length;i++)if(t[i]===' '&&Math.abs(i-m)<bd){bd=Math.abs(i-m);b=i}const c=s=>s.length>14?s.slice(0,13)+'…':s;return b<0?[c(t)]:[c(t.slice(0,b)),c(t.slice(b+1))]};

/* ---------- Imagen del premio (PNG) ---------- */
function wrap(x,t,maxW){const w=t.split(' '),out=[];let l='';w.forEach(p=>{const tt=l?l+' '+p:p;if(x.measureText(tt).width>maxW&&l){out.push(l);l=p}else l=tt});if(l)out.push(l);return out}
async function makeImage(r,T,title,evDate,ex){
  ex=ex||{};
  const W=1080;
  try{await Promise.all([T.tf,T.wf,T.bf].map(f=>document.fonts.load('700 60px '+f)))}catch(e){}
  const li=await new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=logo});
  const lw=130,lh=li?Math.round(lw*li.height/li.width):0;
  const wishes=(ex.wishes||[]).filter(Boolean),budget=fmtMoney(ex.budget||'');
  /* ---- 1) medir todo para que la tarjeta se ajuste al contenido ---- */
  const mc=document.createElement('canvas').getContext('2d');
  let ns=104;mc.font='700 '+ns+'px '+T.wf+',sans-serif';
  let nl=wrap(mc,r.label,W-220);if(nl.length>1){ns=88;mc.font='700 '+ns+'px '+T.wf+',sans-serif';nl=wrap(mc,r.label,W-220)}
  nl=nl.slice(0,3);const lineH=Math.round(ns*1.14);
  mc.font='500 40px '+T.bf+',sans-serif';
  const wl=[];wishes.forEach(w=>wrap(mc,w,W-340).slice(0,2).forEach((l,k)=>wl.push((k===0?'• ':'')+l)));
  const nameY=850,nameEnd=nameY+(nl.length-1)*lineH;
  const divY=nameEnd+62,paraY=divY+88,dateY=paraY+60;
  const hasPanel=!!budget||wl.length>0,panelTop=dateY+54;
  let ph=0;if(hasPanel){ph=46;if(budget)ph+=64+(wl.length?18:0);if(wl.length)ph+=58+wl.length*52;ph+=10}
  const logoY=(hasPanel?panelTop+ph:dateY)+64;
  const H=logoY+lh+112;
  /* ---- 2) dibujar ---- */
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,T.bg1);g.addColorStop(1,T.bg2);x.fillStyle=g;x.fillRect(0,0,W,H);
  x.font='54px serif';x.globalAlpha=.5;for(let i=0;i<Math.round(H/45);i++)x.fillText(T.deco,(i*337)%W,(i*211)%H+40);x.globalAlpha=1;
  x.beginPath();x.roundRect(60,60,W-120,H-120,52);x.fillStyle=T.cardS;x.fill();x.lineWidth=5;x.strokeStyle=T.acc2;x.stroke();
  const cx=W/2,cy=330,R=210,n=T.colors.length*1;
  x.beginPath();x.arc(cx,cy,R+30,0,7);x.fillStyle=T.ring;x.fill();
  for(let i=0;i<n;i++){x.beginPath();x.moveTo(cx,cy);x.arc(cx,cy,R,i*2*Math.PI/n-Math.PI/2,(i+1)*2*Math.PI/n-Math.PI/2);x.fillStyle=T.colors[i];x.fill();x.strokeStyle='#fff';x.lineWidth=4;x.stroke()}
  for(let i=0;i<24;i++){const a=i*Math.PI/12;x.beginPath();x.arc(cx+(R+15)*Math.cos(a),cy+(R+15)*Math.sin(a),7,0,7);x.fillStyle=T.lights[i%T.lights.length];x.fill()}
  x.beginPath();x.arc(cx,cy,34,0,7);x.fillStyle='#fff';x.fill();x.beginPath();x.arc(cx,cy,16,0,7);x.fillStyle=T.acc;x.fill();
  x.beginPath();x.moveTo(cx-24,cy-R-50);x.lineTo(cx+24,cy-R-50);x.lineTo(cx,cy-R+4);x.closePath();x.fillStyle=T.acc2;x.fill();x.strokeStyle='#fff';x.lineWidth=4;x.stroke();
  x.textAlign='center';x.fillStyle=T.tx;x.font=(T.tw||700)+' 64px '+T.tf+',serif';x.fillText('GiraFest',cx,630);
  x.fillStyle=T.mut;x.font='500 34px '+T.bf+',sans-serif';x.fillText(title,cx,682);
  x.font='500 46px '+T.bf+',sans-serif';x.fillText('¡Te tocó!',cx,752);
  x.font='700 '+ns+'px '+T.wf+',sans-serif';x.fillStyle=T.acc;
  nl.forEach((l,k)=>x.fillText(l,cx,nameY+k*lineH));
  /* separador */
  x.strokeStyle=T.acc2;x.lineWidth=3;x.globalAlpha=.7;
  x.beginPath();x.moveTo(cx-190,divY);x.lineTo(cx-34,divY);x.moveTo(cx+34,divY);x.lineTo(cx+190,divY);x.stroke();x.globalAlpha=1;
  x.fillStyle=T.acc2;x.font='34px serif';x.fillText(T.deco,cx,divY+12);
  x.fillStyle=T.tx;x.font=(T.tw||700)+' 66px '+T.tf+',serif';x.fillText('para '+r.name,cx,paraY);
  x.fillStyle=T.mut;x.font='500 34px '+T.bf+',sans-serif';x.fillText(fmtDate(evDate,r.at),cx,dateY);
  if(hasPanel){
    x.beginPath();x.roundRect(110,panelTop,W-220,ph,34);x.fillStyle='rgba(128,128,128,.16)';x.fill();
    x.lineWidth=2;x.strokeStyle=T.acc2;x.globalAlpha=.55;x.stroke();x.globalAlpha=1;
    let yy=panelTop+46;
    if(budget){x.fillStyle=T.tx;x.font='700 40px '+T.wf+',sans-serif';x.fillText('🎁 Valor del regalo: '+budget,cx,yy+28);yy+=64+(wl.length?18:0)}
    if(wl.length){x.fillStyle=T.acc;x.font='700 38px '+T.wf+',sans-serif';x.fillText('Lo que pidió '+r.label+':',cx,yy+28);yy+=58;
      x.fillStyle=T.tx;x.font='500 40px '+T.bf+',sans-serif';wl.forEach(l=>{x.fillText(l,cx,yy+28);yy+=52})}
  }
  if(li){const t=document.createElement('canvas');t.width=lw;t.height=lh;const tx=t.getContext('2d');tx.drawImage(li,0,0,lw,lh);tx.globalCompositeOperation='source-in';tx.fillStyle=T.tx;tx.fillRect(0,0,lw,lh);x.globalAlpha=.9;x.drawImage(t,(W-lw)/2,logoY);x.globalAlpha=1}
  return new Promise(res=>c.toBlob(res,'image/png'));
}

/* ---------- Fecha del evento ---------- */
/* 70000 -> $70.000 (si ya escribiste algo como '$70 mil', se respeta tal cual) */
function fmtMoney(b){b=String(b||'').trim();return /^\d+$/.test(b)?'$'+Number(b).toLocaleString('es-CO'):b}
function fmtDate(d,fallback){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||'');
  const dt=m?new Date(+m[1],+m[2]-1,+m[3]):new Date(fallback||Date.now());
  return dt.toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
}

/* ---------- Sonido ---------- */
let AC=null,MUTED=(()=>{try{return localStorage.getItem('gf_mute')==='1'}catch(e){return false}})();
const isMuted=()=>MUTED;
const toggleMute=()=>{MUTED=!MUTED;try{localStorage.setItem('gf_mute',MUTED?'1':'0')}catch(e){}};
function initAudio(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){}}
function beep(f,d,v,type){if(MUTED||!AC)return;try{const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'triangle';o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d)}catch(e){}}
const tick=()=>beep(850+Math.random()*100,.05,.25,'triangle');
const winSound=()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.4,.22),i*140));

/* ---------- Imagen resumen (todos los premios) ---------- */
async function tintedLogo(T,lw){
  const li=await new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=logo});
  if(!li)return null;
  const lh=Math.round(lw*li.height/li.width),t=document.createElement('canvas');t.width=lw;t.height=lh;const tx=t.getContext('2d');
  tx.drawImage(li,0,0,lw,lh);tx.globalCompositeOperation='source-in';tx.fillStyle=T.tx;tx.fillRect(0,0,lw,lh);return t;
}
async function makeSummary(cfg,res,T,title){
  const ppl=withIds(cfg.people||[]),n=ppl.length,W=1080,rowH=88,H=Math.max(900,400+n*rowH+250);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  try{await Promise.all([T.tf,T.wf,T.bf].map(f=>document.fonts.load('700 60px '+f)))}catch(e){}
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,T.bg1);g.addColorStop(1,T.bg2);x.fillStyle=g;x.fillRect(0,0,W,H);
  x.font='54px serif';x.globalAlpha=.5;for(let i=0;i<Math.round(H/45);i++)x.fillText(T.deco,(i*337)%W,(i*211)%H+40);x.globalAlpha=1;
  x.beginPath();x.roundRect(60,60,W-120,H-120,52);x.fillStyle=T.cardS;x.fill();x.lineWidth=5;x.strokeStyle=T.acc2;x.stroke();
  const done=ppl.filter(p=>res[p.id]&&res[p.id].optionId).length;
  x.textAlign='center';x.fillStyle=T.tx;x.font=(T.tw||700)+' 84px '+T.tf+',serif';x.fillText('GiraFest',W/2,195);
  x.fillStyle=T.mut;x.font='500 40px '+T.bf+',sans-serif';x.fillText(title,W/2,255);
  x.font='500 30px '+T.bf+',sans-serif';x.fillText(`${done} de ${n} ya jugaron · ${fmtDate(cfg.date)}`,W/2,305);
  ppl.forEach((p,i)=>{
    const y=350+i*rowH,r=res[p.id],has=r&&r.optionId;
    if(i%2===0){x.beginPath();x.roundRect(100,y,W-200,rowH-8,20);x.fillStyle='rgba(128,128,128,.16)';x.fill()}
    x.textAlign='left';x.fillStyle=T.tx;x.font='700 38px '+T.wf+',sans-serif';x.fillText(p.label,135,y+rowH/2+8);
    x.textAlign='right';x.fillStyle=has?T.acc:T.mut;x.font=(has?'700':'500')+' 36px '+T.wf+',sans-serif';
    let t=has?r.label:'— pendiente';while(x.measureText(t).width>520&&t.length>3)t=t.slice(0,-2);if(has&&t!==r.label)t+='…';
    x.fillText(t,W-135,y+rowH/2+8);
  });
  const lg=await tintedLogo(T,140);if(lg){x.globalAlpha=.9;x.drawImage(lg,(W-140)/2,H-100-lg.height-30);x.globalAlpha=1}
  return new Promise(res=>c.toBlob(res,'image/png'));
}

/* ---------- Ruleta ---------- */
function Wheel({slices,rot,spinning,T,onTick}){
  const n=slices.length,R=96,cols=T.colors,ref=useRef(null);
  useEffect(()=>{
    if(!spinning||!ref.current)return;
    let raf,prev=null,acc=0,last=-1;const seg=360/n;
    const loop=()=>{
      const m=getComputedStyle(ref.current).transform,v=m&&m.match(/matrix\(([^)]+)\)/);
      if(v){const q=v[1].split(',').map(Number),ang=Math.atan2(q[1],q[0])*180/Math.PI;
        if(prev===null){acc=ang<0?ang+360:ang;last=Math.floor(acc/seg)}
        else{let d=ang-prev;while(d<-180)d+=360;while(d>180)d-=360;acc+=d;const k=Math.floor(acc/seg);if(k!==last){last=k;onTick&&onTick()}}
        prev=ang}
      raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf)
  },[spinning]);
  const fs=n>10?6:n>7?7.2:n>4?8.6:10;
  const txt=(lines_,extra)=>h('text',Object.assign({fontSize:lines_.length>1?fs*.9:fs,fill:'#fff',style:{fontFamily:T.wf,fontWeight:700,paintOrder:'stroke',stroke:'rgba(0,0,0,.4)',strokeWidth:.9,strokeLinejoin:'round'}},extra),lines_.map((l,j)=>h('tspan',{key:j,x:0,dy:lines_.length===1?'.35em':(j===0?'-.2em':'1.05em')},l)));
  const body=n===1?[h('circle',{key:0,r:R,fill:cols[0]}),h('g',{key:1},txt(split(slices[0].label),{textAnchor:'middle'}))]
  :slices.map((s,i)=>{const a0=i*2*Math.PI/n-Math.PI/2,a1=(i+1)*2*Math.PI/n-Math.PI/2,m=(a0+a1)/2*180/Math.PI;
    const d=`M0 0L${R*Math.cos(a0)} ${R*Math.sin(a0)}A${R} ${R} 0 ${n>2?0:1} 1 ${R*Math.cos(a1)} ${R*Math.sin(a1)}Z`;
    return h('g',{key:s.id},h('path',{d,fill:cols[i%cols.length],stroke:'rgba(255,255,255,.85)',strokeWidth:1}),txt(split(s.label),{transform:`rotate(${m}) translate(${R-8} 0)`,textAnchor:'end'}))});
  const bulbs=Array.from({length:28},(_,i)=>{const a=i*2*Math.PI/28;return h('circle',{key:i,className:'bulb',cx:102*Math.cos(a),cy:102*Math.sin(a),r:2.7,fill:T.lights[i%T.lights.length],style:{animationDelay:(i%4)*.2+'s'}})});
  return h('div',{className:'wheelbox'+(spinning?' spinning':'')},h('div',{className:'ptr'+(spinning?' spin':'')}),
    h('svg',{ref,viewBox:'-112 -112 224 224',style:{transform:`rotate(${rot}deg)`,transition:spinning?'transform 6s cubic-bezier(.12,.62,.08,1)':'none'}},
      h('defs',null,h('radialGradient',{id:'shade'},h('stop',{offset:0,stopColor:'#fff',stopOpacity:.3}),h('stop',{offset:.55,stopColor:'#fff',stopOpacity:0}),h('stop',{offset:1,stopColor:'#000',stopOpacity:.3}))),
      body,h('circle',{r:R,fill:'url(#shade)'})),
    h('svg',{viewBox:'-112 -112 224 224',style:{pointerEvents:'none'}},
      h('circle',{r:102,fill:'none',stroke:T.ring,strokeWidth:14}),h('circle',{r:109,fill:'none',stroke:'rgba(0,0,0,.25)',strokeWidth:1.5}),h('circle',{r:95.5,fill:'none',stroke:'rgba(0,0,0,.25)',strokeWidth:1.5}),bulbs,
      h('circle',{r:14,fill:'#fff',stroke:T.acc2,strokeWidth:3}),h('circle',{r:6,fill:T.acc})));
}

function Deco({e}){const ps=useRef(Array.from({length:18},()=>({l:Math.random()*100,d:9+Math.random()*10,s:14+Math.random()*18,w:-Math.random()*16})));
  return h('div',{className:'deco','aria-hidden':true},ps.current.map((p,i)=>h('span',{key:i,style:{left:p.l+'%',fontSize:p.s,animationDuration:p.d+'s',animationDelay:p.w+'s'}},e)))}

function Wishes({db,res,me,locked}){
  const cur=(res[me]&&res[me].wishes)||[];
  const [a,setA]=useState(cur[0]||''),[b,setB]=useState(cur[1]||''),[ok,setOk]=useState('');
  async function save(){const w=[a,b].map(x=>x.trim().slice(0,80)).filter(Boolean);try{await db.doc('results/'+me).set({...res[me],wishes:w});setOk('¡Guardado!')}catch(e){setOk('No se pudo guardar')}setTimeout(()=>setOk(''),2000)}
  return h('div',{className:'card'},h('b',null,'🎁 Lo que me gustaría recibir'),h('p',{className:'mut'},'Opcional. Tu amigo secreto lo verá en su tarjeta. Puedes cambiarlo cuando quieras.'),
    h('input',{value:a,maxLength:80,placeholder:'Idea 1 (opcional)',onChange:e=>setA(e.target.value)}),
    h('input',{value:b,maxLength:80,placeholder:'Idea 2 (opcional)',style:{marginTop:8},onChange:e=>setB(e.target.value)}),
    h('button',{className:'btn',disabled:locked,onClick:save},ok||'Guardar'));
}

function Play({db,cfg,res,me,setMe,dl,T,title}){
  const [pick,setPick]=useState(null),[rot,setRot]=useState(0),[spinning,setSpinning]=useState(false),[frozen,setFrozen]=useState(null),[msg,setMsg]=useState(''),[confirmOpen,setConfirmOpen]=useState(false),[muted,setMuted]=useState(isMuted());
  const [blob,setBlob]=useState(null),[url,setUrl]=useState(null),[w1,setW1]=useState(''),[w2,setW2]=useState('');const auto=useRef(false);
  const round=roundOf(cfg);
  const people=withIds(cfg.people||[]);
  const mine=me&&res[me];
  const taken=new Set(Object.values(res).map(r=>r.optionId).filter(Boolean));
  const player=people.find(p=>p.id===me);
  const won=mine&&mine.optionId?mine:null;
  const fr=won&&res[won.optionId],fw=(fr&&fr.wishes)||[]; /* lo que pidió tu amigo secreto */
  function save(b,r,manual){if(dl&&b)dl.save({filename:`mi-premio-${slug(r.name)}.png`,data:b,share:!!manual}).catch(()=>{})}
  useEffect(()=>{if(!won||spinning)return;let dead=false,u;
    makeImage(won,T,title,cfg.date,{budget:cfg.budget,wishes:fw}).then(b=>{if(dead)return;setBlob(b);u=URL.createObjectURL(b);setUrl(u);if(auto.current){auto.current=false;setTimeout(()=>save(b,won),700)}});
    return()=>{dead=true;if(u)URL.revokeObjectURL(u)}},[won&&won.optionId,spinning,T.name,cfg.date,cfg.budget,JSON.stringify(fw)]);
  async function join(){
    try{await db.doc('results/'+pick).set({name:people.find(p=>p.id===pick).label,joined:true,at:Date.now(),round,wishes:[w1,w2].map(x=>x.trim().slice(0,80)).filter(Boolean)});localStorage.setItem('ruleta_me',pick);localStorage.setItem('ruleta_round',round)}catch(e){}
    setConfirmOpen(false);setMe(pick);
  }
  async function spin(){
    initAudio();setMsg('');setSpinning(false);
    const snap=await db.collection('results').get();
    const docs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>inRound(d,round));
    const tk=new Set(docs.map(d=>d.optionId).filter(Boolean)),done=new Set(docs.filter(d=>d.optionId).map(d=>d.id)),myW=(docs.find(d=>d.id===me)||{}).wishes||[];
    const pool=poolFor(cfg,me,tk);              /* donde SÍ puede caer */
    const vis=visibleFor(cfg,tk);               /* lo que se dibuja: todas */
    if(!pool.length){setMsg('Ya no quedan opciones disponibles para ti. Avísale a quien organiza.');return}
    const safe=pool.filter(o=>canFinish(cfg,people,done,tk,me,o.id)); /* evita que alguien se quede sin opciones */
    const pick_=safe.length?safe:pool,win=pick_[Math.floor(Math.random()*pick_.length)];
    const idx=Math.max(0,vis.findIndex(o=>o.id===win.id)),seg=360/vis.length;
    setFrozen(vis);
    const target=rot-(rot%360)+360*7+(360-(idx+.5)*seg)+(Math.random()-.5)*seg*.7;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{setSpinning(true);setRot(target)}));
    setTimeout(async()=>{
      const r={name:player.label,optionId:win.id,label:win.label,joined:true,at:Date.now(),round,wishes:myW};
      auto.current=true;
      try{await db.doc('results/'+me).set(r)}catch(e){setMsg('No se pudo guardar. Intenta de nuevo.');auto.current=false}
      setSpinning(false);setFrozen(null);winSound();
      try{navigator.vibrate&&navigator.vibrate([80,60,160])}catch(e){}
      const co=T.colors.concat(T.lights);
      confetti({particleCount:170,spread:100,origin:{y:.5},colors:co});setTimeout(()=>confetti({particleCount:90,angle:60,spread:60,origin:{x:0,y:.7},colors:co}),300);setTimeout(()=>confetti({particleCount:90,angle:120,spread:60,origin:{x:1,y:.7},colors:co}),500);
    },6300);
  }
  if(won&&!spinning) return h(React.Fragment,null,h('div',{className:'card win'},h('div',{className:'mut'},`${won.name}, te tocó:`),h('div',{className:'big'},T.e+' '+won.label),cfg.budget&&h('div',{className:'mut'},'🎁 Valor del regalo: '+fmtMoney(cfg.budget)),fw.length>0&&h('div',{className:'mut',style:{margin:'8px 0'}},h('b',null,`Lo que pidió ${won.label}:`),fw.map((w,i)=>h('div',{key:i},'• '+w))),
    url?h('img',{src:url,alt:'Tu premio'}):h('div',{className:'mut'},'Preparando tu imagen…'),
    h('div',{className:'mut',style:{marginTop:8}},'Tip: mantén presionada la imagen para guardarla en tu galería.'),
    h('div',{className:'mut',style:{marginTop:4}},'Ya participaste. Este enlace no permite volver a jugar.'),
    dl&&blob&&h('button',{className:'btn',onClick:()=>save(blob,won,true)},'⬇ Guardar mi imagen')),cfg.secret&&h(Wishes,{db,res,me}));
  if(!me||!player){
    const free=people.filter(p=>!res[p.id]);
    const who=pick&&people.find(p=>p.id===pick);
    return h(React.Fragment,null,confirmOpen&&who&&h('div',{className:'modal',onClick:()=>setConfirmOpen(false)},
      h('div',{className:'card win',onClick:e=>e.stopPropagation()},h('h3',{style:{marginTop:0,fontFamily:T.tf,fontSize:'1.5rem'}},`¿Eres ${who.label}?`),
        h('p',{className:'mut'},'Cuando confirmes, ese nombre queda tomado y no se puede cambiar. Si te equivocas, solo la organizadora puede liberarlo.'),
        cfg.secret&&h('div',null,h('p',{className:'mut'},'🎁 Opcional: dos ideas de regalo que te gustaría recibir'),h('input',{value:w1,maxLength:80,placeholder:'Idea 1 (opcional)',onChange:e=>setW1(e.target.value)}),h('input',{value:w2,maxLength:80,placeholder:'Idea 2 (opcional)',style:{marginTop:8},onChange:e=>setW2(e.target.value)})),
        h('button',{className:'btn pulse',onClick:join},`Sí, soy ${who.label}`),
        h('button',{className:'btn ghost',onClick:()=>setConfirmOpen(false)},'Volver'))),
    h('div',{className:'card'},h('h3',{style:{textAlign:'center',marginTop:0,fontFamily:T.tf}},'¿Quién eres?'),
      free.length?h('div',{className:'chips'},free.map((p,i)=>h('button',{key:p.id,className:'chip'+(pick===p.id?' on':''),style:{animationDelay:i*60+'ms'},onClick:()=>setPick(p.id)},p.label))):h('p',{className:'mut'},people.length?'Todos ya entraron. 🎄':'Aún no hay participantes. Vuelve en un momento.'),
      pick&&h('button',{className:'btn pulse',onClick:()=>setConfirmOpen(true)},'Soy '+people.find(p=>p.id===pick).label),
      h('p',{className:'mut'},'Elige con cuidado: una vez entres, ese nombre queda tomado.')));
  }
  const live=poolFor(cfg,me,taken),visible=visibleFor(cfg,taken),slices=frozen||visible;
  return h(React.Fragment,null,h('div',{className:'card'},h('h3',{style:{textAlign:'center',marginTop:0,fontFamily:T.tf,fontSize:'1.4rem'}},`Hola, ${player.label} 👋`),cfg.budget&&h('p',{className:'mut'},'🎁 Valor del regalo: '+fmtMoney(cfg.budget)),
    slices.length?h(Wheel,{slices,rot,spinning,T,onTick:tick}):h('p',{className:'mut'},'No quedan opciones.'),
    msg&&h('p',{className:'mut'},msg),
    h('button',{className:'btn pulse',disabled:spinning||!live.length,onClick:spin},spinning?'Girando…':'🎰 ¡Girar la ruleta!'),
    h('p',{className:'mut'},`Opciones en la ruleta: ${slices.length}`),
    h('div',{style:{textAlign:'center'}},h('button',{className:'chip small',onClick:()=>{toggleMute();setMuted(isMuted())}},muted?'🔇 Sonido apagado':'🔊 Sonido activado'))),cfg.secret&&h(Wishes,{db,res,me,locked:spinning}));
}

function Admin({db,cfg,res,raw,theme,T,title:evTitle,dl}){
  const [title,setTitle]=useState(cfg?cfg.title:'Ruleta de la Novena');
  const [date,setDate]=useState(cfg&&cfg.date||'');
  const [pt,setPt]=useState(cfg?cfg.people.join('\n'):'');
  const [ot,setOt]=useState(cfg?cfg.options.join('\n'):DEF_OPTS);
  const [allow,setAllow]=useState(cfg&&cfg.restr?cfg.restr:{});
  const [ok,setOk]=useState(''),[secret,setSecret]=useState(!!(cfg&&cfg.secret)),[reveal,setReveal]=useState(false),[budget,setBudget]=useState(cfg&&cfg.budget||'');
  const [qr,setQr]=useState(null),[sumUrl,setSumUrl]=useState(null),[sumBlob,setSumBlob]=useState(null),[copied,setCopied]=useState(false);
  const link=window.location.origin+window.location.pathname;
  useEffect(()=>{QRCode.toDataURL(link,{width:420,margin:2,color:{dark:'#1a1a1a',light:'#ffffff'}}).then(setQr).catch(()=>{})},[]);
  async function buildSummary(){if(!cfg)return;const b=await makeSummary(cfg,res,T,evTitle);setSumBlob(b);setSumUrl(URL.createObjectURL(b))}
  async function copyLink(){try{await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch(e){prompt('Copia el link:',link)}}
  function whatsapp(){window.open('https://wa.me/?text='+encodeURIComponent('¡Entra a GiraFest y gira la ruleta! 🎰 '+link),'_blank')}
  async function saveQr(){if(qr)dl.save({filename:'girafest-qr.png',data:await (await fetch(qr)).blob(),share:true})}
  const people=withIds(lines(pt)),opts=withIds(lines(ot));
  const isAllowed=(p,o)=>!allow[p]||allow[p].includes(o);
  const hide=secret&&!reveal;
  function toggle(p,o){const cur=allow[p]||opts.map(x=>x.id);setAllow({...allow,[p]:cur.includes(o)?cur.filter(x=>x!==o):[...cur,o]})}
  const newRound=()=>String(Date.now());
  async function wipeAll(){for(const id of Object.keys(raw||{}))await db.doc('results/'+id).delete()}
  async function saveCfg(){
    const restr={};people.forEach(p=>{if(allow[p.id]&&allow[p.id].length<opts.length)restr[p.id]=allow[p.id].filter(o=>opts.some(x=>x.id===o))});
    /* Si cambió la lista de personas u opciones = ruleta nueva: ronda nueva y resultados viejos fuera. */
    const changed=!cfg||JSON.stringify(cfg.people||[])!==JSON.stringify(lines(pt))||JSON.stringify(cfg.options||[])!==JSON.stringify(lines(ot));
    const round=changed?newRound():roundOf(cfg);
    if(changed)await wipeAll();
    await db.doc('config/main').set({title,people:lines(pt),options:lines(ot),restr,theme,date,round,secret,budget});setOk(changed?'¡Guardado! Ruleta nueva 🎉':'¡Guardado!');setTimeout(()=>setOk(''),2500);
  }
  async function free(id){await db.doc('results/'+id).delete()}
  async function resetAll(){if(confirm('¿Borrar TODOS los resultados y empezar de nuevo?')){await wipeAll();if(cfg)await db.doc('config/main').set({...cfg,round:newRound()})}}
  async function newDraw(){if(!confirm('¿Empezar un sorteo NUEVO? Se borran resultados, participantes, opciones y restricciones.'))return;await wipeAll();await db.doc('config/main').set({title,theme,secret,budget,people:[],options:[],restr:{},date:'',round:newRound()});setPt('');setOt('');setAllow({});setDate('');setReveal(false)}
  return h('div',null,
    h('div',{className:'card'},h('label',null,'Título'),h('input',{value:title,onChange:e=>setTitle(e.target.value)}),
      h('label',null,'Fecha del evento'),
      h('input',{type:'date',value:date,onChange:e=>setDate(e.target.value)}),
      h('div',{style:{display:'flex',gap:8,alignItems:'center',marginTop:8,flexWrap:'wrap'}},
        h('button',{className:'chip small'+(date?'':' on'),onClick:()=>setDate('')},'📅 Usar la fecha de hoy'),
        h('span',{className:'mut',style:{textAlign:'left'}},date?'Fecha fija: '+fmtDate(date):'Automática: cada imagen lleva el día en que se juega')),
      h('label',null,'Valor del regalo (opcional, sale en la tarjeta)'),h('input',{value:budget,placeholder:'Ej: $50.000',onChange:e=>setBudget(e.target.value)}),
      h('label',null,'Participantes (uno por línea)'),h('textarea',{rows:6,value:pt,placeholder:'Angie\nSandra\n…',onChange:e=>setPt(e.target.value)}),
      h('label',null,'Opciones de la ruleta (una por línea)'),h('textarea',{rows:7,value:ot,onChange:e=>setOt(e.target.value)}),
      h('label',{style:{display:'flex',gap:8,alignItems:'center',marginTop:12}},h('input',{type:'checkbox',checked:secret,style:{width:'auto'},onChange:e=>setSecret(e.target.checked)}),'🎁 Modo amigo secreto (nadie se saca a sí mismo y nadie se queda sin opción)'),
      secret&&h('div',{style:{marginTop:6}},h('button',{className:'chip small',onClick:()=>setOt(pt)},'Usar los participantes como opciones'),h('p',{className:'mut'},'En este modo las opciones deben ser los mismos nombres de los participantes, escritos igual.')),
      h('p',{className:'mut'},'El diseño que tengas elegido arriba se guarda como el predeterminado para todos.'),
      h('p',{className:'mut'},'Si cambias participantes u opciones, se crea una ruleta nueva y todos los celulares empiezan de cero.')),
    people.length>0&&h('div',{className:'card'},h('b',null,'Restricciones'),h('p',{className:'mut'},'Toca una opción para prohibírsela a esa persona (se tacha). La ruleta igual muestra todas las opciones, solo que nunca caerá en las tachadas.'),
      people.map(p=>h('div',{key:p.id,style:{margin:'10px 0'}},h('div',{style:{fontWeight:700,marginBottom:4}},p.label),
        h('div',{className:'chips',style:{justifyContent:'flex-start'}},opts.map(o=>h('button',{key:o.id,className:'chip small'+(isAllowed(p.id,o.id)?'':' off'),onClick:()=>toggle(p.id,o.id)},o.label)))))),
    h('button',{className:'btn',onClick:saveCfg},ok||'💾 Guardar configuración'),
    h('div',{className:'card'},h('b',null,'Resultados'),
      people.map(p=>{const r=res[p.id];return h('div',{className:'row',key:p.id},h('span',null,p.label),h('span',null,r?(r.label?(hide?'ya jugó ✓':r.label):'entró, sin girar'):'—'),r&&h('button',{className:'chip small',onClick:()=>free(p.id)},'Liberar'))}),
      secret&&h('button',{className:'btn ghost',onClick:()=>setReveal(!reveal)},reveal?'🙈 Ocultar resultados':'👁 Mostrar resultados (arruina la sorpresa)'),
      !hide&&h('button',{className:'btn',onClick:buildSummary},'🖼 Imagen con todos los premios'),
      !hide&&sumUrl&&h('div',{style:{textAlign:'center'}},h('img',{src:sumUrl,alt:'Resumen',style:{width:'100%',borderRadius:14,marginTop:10}}),
        h('button',{className:'btn',onClick:()=>dl.save({filename:'girafest-premios.png',data:sumBlob,share:true})},'⬇ Guardar imagen')),
      h('button',{className:'btn ghost',onClick:resetAll},'Reiniciar todo (ronda nueva)'),
      h('button',{className:'btn',onClick:newDraw},'🆕 Nuevo sorteo (limpiar todo)')),
    h('div',{className:'card',style:{textAlign:'center'}},h('b',null,'Compartir GiraFest'),
      qr&&h('img',{src:qr,alt:'QR',style:{width:'min(70vw,240px)',borderRadius:14,display:'block',margin:'12px auto'}}),
      h('input',{readOnly:true,value:link,onFocus:e=>e.target.select()}),
      h('button',{className:'btn',onClick:whatsapp},'💬 Enviar por WhatsApp'),
      h('button',{className:'btn ghost',onClick:copyLink},copied?'¡Copiado!':'📋 Copiar link'),
      h('button',{className:'btn ghost',onClick:saveQr},'⬇ Guardar código QR')));
}

function App(){
  const db=realDb,dl=dlObj,[admin,setAdmin]=useState(()=>sessionStorage.getItem('ruleta_admin')==='1'),[tab,setTab]=useState('play');
  const [st,setSt]=useState('loading'),[cfg,setCfg]=useState(null),[raw,setRaw]=useState({});
  const [me,setMe]=useState(()=>{try{return localStorage.getItem('ruleta_me')}catch(e){return null}});
  const [tp,setTp]=useState(null),[showPin,setShowPin]=useState(false),[pin,setPin]=useState(''),[bad,setBad]=useState(false);
  const round=roundOf(cfg);
  /* Solo cuentan los resultados de la ronda actual */
  const res={};Object.keys(raw).forEach(k=>{if(inRound(raw[k],round))res[k]=raw[k]});
  const themeId=(admin&&tp&&THEMES[tp]?tp:null)||(cfg&&THEMES[cfg.theme]?cfg.theme:'clasico'),T=THEMES[themeId];
  useEffect(()=>{const s=document.documentElement.style;['bg1','bg2','card','tx','mut','acc','acc2','bd','btx'].forEach(k=>s.setProperty('--'+k,T[k]));document.body.style.fontFamily=T.bf+",system-ui,sans-serif"},[themeId]);
  /* Si cambió la ronda, este celular olvida quién era y a qué jugó */
  useEffect(()=>{
    if(!cfg)return;
    try{
      const stored=localStorage.getItem('ruleta_round')||'0';
      if(stored!==round){localStorage.removeItem('ruleta_me');setMe(null)}
      localStorage.setItem('ruleta_round',round);
    }catch(e){}
  },[round,!!cfg]);
  function unlock(){if(pin===String(import.meta.env.VITE_ADMIN_PIN)){sessionStorage.setItem('ruleta_admin','1');setAdmin(true)}else{setBad(true)}}
  function chooseTheme(id){setTp(id);if(cfg)db.doc('config/main').set({...cfg,theme:id}).catch(()=>{})}
  useEffect(()=>{
    let un=[],ready=false;
    const t=setTimeout(()=>{if(!ready)setSt('nodb')},10000);
    (async()=>{
      const d=realDb;
      un.push(d.doc('config/main').onSnapshot(s=>{ready=true;setCfg(s.exists?s.data():null);setSt('ok')},()=>setSt('nodb')));
      un.push(d.collection('results').onSnapshot(s=>{const m={};s.docs.forEach(x=>m[x.id]=x.data());setRaw(m)},()=>{}));
    })();
    return()=>{clearTimeout(t);un.forEach(f=>f())};
  },[]);
  /* Al volver a la pestaña/app (p. ej. escanear el QR otra vez) se recarga si hay versión nueva de la ruleta */
  useEffect(()=>{
    const onVis=()=>{if(document.visibilityState==='visible'){try{const k=localStorage.getItem('ruleta_round');if(k&&k!==round&&cfg)location.reload()}catch(e){}}};
    document.addEventListener('visibilitychange',onVis);return()=>document.removeEventListener('visibilitychange',onVis);
  },[round,!!cfg]);
  const title=cfg&&cfg.title||'Ruleta de la Novena';
  let body;
  if(st==='loading')body=h('p',{className:'mut'},'Cargando…');
  else if(st==='nodb')body=h('div',{className:'card'},h('p',{className:'mut'},'No pude conectar con la base de datos compartida. Abre el enlace con tu sesión de Claude iniciada o pide acceso a quien organiza.'));
  else if(admin&&tab==='admin')body=h(Admin,{db,cfg,res,raw,theme:themeId,T,title,dl});
  else if(!cfg)body=h('div',{className:'card'},h('p',{className:'mut'},admin?'Aún no hay configuración. Ve a Panel y crea la lista.':'El organizador aún no ha configurado la ruleta.'));
  else body=h(Play,{key:round,db,cfg,res,me,setMe,dl,T,title});
  return h('div',null,h(Deco,{key:themeId,e:T.deco}),
    h('div',{className:'logo','aria-label':'AAS',style:{WebkitMaskImage:`url(${logo})`,maskImage:`url(${logo})`}}),
    h('h1',{style:{fontFamily:T.tf,fontSize:T.h1}},T.e+' GiraFest '+T.e),h('p',{className:'sub'},title+(cfg&&cfg.date?' · '+fmtDate(cfg.date):'')),
    admin&&h('div',{className:'themes'},Object.keys(THEMES).map(k=>h('button',{key:k,className:'chip'+(k===themeId?' on':''),onClick:()=>chooseTheme(k)},THEMES[k].e+' '+THEMES[k].name))),
    admin&&st==='ok'&&h('div',{className:'tabs'},h('button',{className:'chip'+(tab==='play'?' on':''),onClick:()=>setTab('play')},'Mi turno'),h('button',{className:'chip'+(tab==='admin'?' on':''),onClick:()=>setTab('admin')},'⚙ Panel')),body,!admin&&h('div',{style:{textAlign:'center',marginTop:24}},
    !showPin?h('button',{className:'chip small',onClick:()=>setShowPin(true)},'🔒 Organizadora')
    :h('div',{className:'card'},
      h('input',{type:'password',placeholder:'Tu PIN',value:pin,onChange:e=>{setPin(e.target.value);setBad(false)},onKeyDown:e=>{if(e.key==='Enter')unlock()}}),
      bad&&h('p',{className:'mut'},'PIN incorrecto'),
      h('button',{className:'btn',onClick:unlock},'Entrar'))));
}
createRoot(document.getElementById('root')).render(h(App));
