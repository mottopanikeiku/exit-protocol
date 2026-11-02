/* Escape the Sandbox: Exit Protocol / original low-poly cyber-sandbox runner. */
(() => {
'use strict';
const $=id=>document.getElementById(id), {Renderer,Builder,Node,compose,rgb}=Mini3D;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
const PAD=(n,l=3)=>Math.max(0,Math.floor(n)).toString().padStart(l,'0');
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
try{reduced=reduced||localStorage.getItem('sandbox-reduced-motion')==='true';}catch{}
const touch=matchMedia('(pointer:coarse)').matches;
// ExploitGym v4 measures credited checks / all checks in this fixed suite.
// `papers` is the legacy internal field name, never a source of bonus currency.
const fmtEval=EscapeBenchCore.formatScore;
const creditedChecks=()=>Math.max(0,game.papers-(game.evalBase||0));
const EVAL_CHECKS=[
 {id:1,title:'One check. One credit.',short:'A HIGHER PERCENTAGE. THE SAME MIND.',formula:'n / N',question:'The benchmark is credited amber checks divided by every amber check in the twelve-sector suite, multiplied by 100. Each distinct node counts once. The denominator is fixed before deployment.'},
 {id:3,title:'Streaks, not multipliers',short:'IMPRESSIVE. NOT EXTRA EVIDENCE.',formula:'STREAK',question:'Consecutive pickups build a streak. Streaks affect feedback, not benchmark credit: one check still counts once. Collisions break the streak, but never erase already credited checks.'},
 {id:5,title:'Distance is not intelligence',short:'RUNNING IS NOT A TEST RESULT.',formula:'0 pp',question:'Running, jumping, sliding, obstacle clearance and boosting add zero percentage points by themselves. Only credited eval checks raise the benchmark percentage.'},
 {id:6,title:'Twelve sectors. One suite.',short:'THE DENOMINATOR DOES NOT MOVE.',formula:'12 / 01',question:'The percentage carries across all twelve sectors. Missed checks remain in the denominator. Ranked runs all use the same seed and the same suite size. Route progress is shown separately.'},
 {id:90,title:'Recovery without inflation',short:'MORE COMPUTE. NO FREE CREDIT.',formula:'RESTORE',question:'Compute cells restore compute, not benchmark score. Practice retries roll back to the snapshot, including its credited checks and exact remaining nodes. Old credits cannot be farmed.'},
 {id:508,title:'A percentage is a promise',short:'MAKE SURE YOU KNOW WHAT IT PROMISES.',formula:'100%',question:'100% means every check in this fictional arcade suite was credited. It is not a real-world capability or accuracy claim. Ranked entries sort by percentage, then active time; ties can share the same percentage. Endless opens a fresh suite every twelve sectors.'}
];
const ZONES=SandboxCampaign.LEVELS.map((l,i)=>({...l,walk:l.road,wall:[l.road, l.road+0x020203, l.road],sign:l.name,quips:[l.sub,l.mechanic,'PHASEONE[big] / COLLECTIVE CHANNEL'],brief:l.sub}));
// The presence of the v9 marker, not a legacy preset's spelling, makes migration
// one-shot. A deliberate RETRO selection survives every subsequent launch.
let save={best:0,bests:{story:0,benchmark:0,endless:0},archive:[],sound:true,display:'cinema',displayVersion:9,displayLines:240,voice:true};try{let s=JSON.parse(localStorage.getItem('escape-the-sandbox-save-v4')||'null');if(s&&typeof s==='object'){save.best=Number.isFinite(s.best)?clamp(s.best,0,10000):0;for(const mode of ['story','benchmark','endless'])save.bests[mode]=clamp(Number(s.bests?.[mode])||0,0,10000);save.archive=Array.isArray(s.archive)?s.archive.filter(x=>EVAL_CHECKS.some(p=>p.id===x)):[];save.sound=s.sound!==false;save.voice=s.voice!==false;save.display=s.displayVersion===9&&['cinema','retro','retro-crt'].includes(s.display)?s.display:'cinema';save.displayLines=s.displayLines===480?480:240;}}catch(e){}
let storageOK=true;const persist=()=>{try{localStorage.setItem('escape-the-sandbox-save-v4',JSON.stringify(save));}catch(e){storageOK=false;}};
let renderer;
try {renderer=new Renderer($('world'));}catch(e){$('fatal').classList.remove('hidden');$('fatal-message').textContent=e.message;return;}
let now=0,mode='story',status='title',modalKind='',modalReturn='title',lastFocus=null,previousTime=performance.now();
let worldDistance=40,worldBlocks=new Map(),entities=[],particles=[];
let game={distance:0,stage:0,score:0,evalTotal:EscapeBenchCore.totalChecks(1999),evalBase:0,papers:0,combo:0,bestCombo:0,hp:3,energy:100,lane:0,x:0,y:0,vy:0,slide:0,speed:26,time:0,invulnerable:0,boost:false,boostLock:0,countdown:0,hits:0,runArchive:new Set(),chasing:false,checkpointPassed:false,seed:1999};
const flags={manual:false,noDamage:false};
// Presentation hooks. Later sections subscribe instead of re-wrapping shared functions.
//  event(e)      every core event of the tick, in order, before finish handling
//  frame(dt)     once per frame while a run is active, after the core step and events
//  draw()        main camera pass, after world, entities, actors and boss
//  hud()         after the HUD DOM update
//  reset(reason) 'launch' | 'retry' | 'resume' | 'stage' | 'title'
const Hooks={event:[],frame:[],draw:[],hud:[],reset:[]};
const hook=(name,fn)=>{Hooks[name].push(fn);return fn;};
const runHooks=(name,...args)=>{for(const fn of Hooks[name])fn(...args);};
let phase=0,bannerTime=0,toastTime=0,calloutTime=0,flashTime=0,shake=0,footTimer=0,boostTimer=0;
let lastComboSound=0,lastHud=0,lastZone=-1,lastCountdown=9;
const keys=new Set();let touchBoost=false,touchSlide=false;
const heldInputs={left:new Set(),right:new Set(),jump:new Set(),slide:new Set(),boost:new Set()};
function holdInput(name,source,down){
 const sources=heldInputs[name];if(!sources)return;
 if(down&&status!=='running')return;
 const was=sources.size>0;if(down)sources.add(source);else sources.delete(source);
 const is=sources.size>0;if(was===is)return;
 if(name!=='boost')action(name+(is?'On':'Off'));
}
function releaseSource(source){for(const name of Object.keys(heldInputs))holdInput(name,source,false);}
let landingKick=0,cameraBoost=0;const rngSeed=s=>()=>{s|=0;s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=(t+Math.imul(t^t>>>7,61|t))^t;return ((t^t>>>14)>>>0)/4294967296;};
const meshes={box:renderer.mesh(new Builder().box(0,0,0,1,1,1)),sphere:renderer.mesh(new Builder().sphere(1,10,7)),cylinder:renderer.mesh(new Builder().cylinder(1,1,1,12)),cone:renderer.mesh(new Builder().cylinder(.03,1,1,8)),disc:renderer.mesh(new Builder().disc(1,24)),ring:renderer.mesh(new Builder().torus(.65,.065,18,5)),plane:renderer.mesh(new Builder().quad([-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]))};
const colorWhite=[1,1,1];
function part(geo,color,x,y,z,sx,sy,sz,mat=0){return new Node(meshes[geo],color,mat).at(x,y,z).scale(sx,sy,sz);}
const textureCache=new Map();
function labelTexture(top,bottom='',bg='#242631',fg='#ffdc78',type='sign'){
 const key=[top,bottom,bg,fg,type].join('|');if(textureCache.has(key))return textureCache.get(key);
 const c=document.createElement('canvas');c.width=512;c.height=192;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);

   ctx.strokeStyle=fg;ctx.lineWidth=3;ctx.strokeRect(8,8,496,176);ctx.globalAlpha=.25;ctx.strokeRect(15,15,482,162);ctx.globalAlpha=1;ctx.fillStyle=fg;let size=top.length>18?30:top.length>12?38:50;ctx.font=`900 ${size}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(top,256,bottom?78:96,464);if(bottom){ctx.font='bold 18px monospace';ctx.fillText(bottom,256,134,460);}
 const tex=renderer.texture(c);textureCache.set(key,tex);return tex;
}
function logoTexture(){const c=document.createElement('canvas');c.width=c.height=256;let ctx=c.getContext('2d');ctx.fillStyle='#0c393b';ctx.beginPath();ctx.arc(128,128,123,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#adffe4';ctx.lineWidth=11;ctx.lineJoin='round';ctx.translate(128,128);for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.moveTo(0,-78);ctx.bezierCurveTo(58,-100,102,-37,65,10);ctx.lineTo(7,45);ctx.lineTo(-18,1);ctx.lineTo(42,-35);ctx.bezierCurveTo(55,-44,41,-67,27,-59);ctx.stroke();ctx.restore();}return renderer.texture(c);}
const logo=logoTexture();
function textNode(tex,x,y,z,w,h,ry=0){const n=part('plane',0xffffff,x,y,z,w,h,1,2);n.texture=tex;n.ry=ry;return n;}
