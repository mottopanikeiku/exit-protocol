/* EXIT PROTOCOL 8. Deterministic 60 Hz gameplay; no DOM, audio or network.
   One collider for all cosmetics. Replay is the sole authority for ranked credit. */
(function(r,f){const a=f(typeof module==='object'&&module.exports?require('./campaign-data.js'):r.SandboxCampaign);if(typeof module==='object'&&module.exports)module.exports=a;else r.EscapeBenchCore=a;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const {stageLength,stageStart,stageAt,CYCLE_LENGTH,rewardBoardKey}=C;
const VERSION='exploitgym-exit-protocol-8.4.0',SEED=20260709,MAX_TICKS=72000,DT=1/60;
const VISIBLE_DISTANCE=120,REFLECT_SECONDS=1.05,REFLECT_REFUND=4,STAGGER_SECONDS=2,ESCAPE_SECONDS=3;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rngSeed=s=>()=>{s|=0;s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=(t+Math.imul(t^t>>>7,61|t))^t;return ((t^t>>>14)>>>0)/4294967296;};
const ACTIONS=['left','right','jump','slideOn','slideOff','boostOn','boostOff','jumpOn','jumpOff','leftOn','leftOff','rightOn','rightOff','releaseAll'];
const JUMP_BUFFER_TICKS=8,DUCK_BUFFER_TICKS=8,COYOTE_TICKS=6,SHORT_JUMP_VELOCITY=9.6,HIT_WIDTH_SCALE=.9;
const POWER_TICKS=Object.freeze({cache:480,snapshot:1200,overclock:240}),POWER_TYPES=Object.keys(POWER_TICKS),CACHE_REACH=18;
const SURGE_TICKS=360,SURGE_SPEED=1.04,SURGE_FILL=Object.freeze({clear:6,perfect:5,nearMiss:20,reflect:40});
const CHAIN_TIERS=[0,10,25,50,100,150,200,300],PERFECT_TICKS=7,NEAR_MISS_MARGIN=.55;
const REWARD_POINTS={check:10,clear:25,nearMiss:50,perfect:75,smash:100,reflect:200,bossHit:500,shard:1000,bossDefeated:5000,sectorClear:1000,noHit:2000};
const entityOrder=(a,b)=>a.d-b.d||(typeof a.id===typeof b.id?(a.id>b.id)-(a.id<b.id):typeof a.id==='number'?-1:1);
function chainMult(chain){let tier=1;while(tier<CHAIN_TIERS.length&&chain>=CHAIN_TIERS[tier])tier++;return tier;}
function gradeFor(reward,par,hits=0){const ratio=par>0?reward/par:0;return !hits&&ratio>=.90?'SS':!hits&&ratio>=.80?'S':ratio>=.65?'A':ratio>=.50?'B':ratio>=.35?'C':'D';}
const levelFor=stage=>C.LEVELS[((stage%12)+12)%12];
function baseSpeed(stage,local,difficulty='hard'){
 const L=levelFor(stage);return (L.speed+(L.speedEnd-L.speed)*clamp(local/stageLength(stage),0,1))*C.DIFFICULTIES[difficulty].speed+Math.min(7,Math.floor(stage/12)*2);
}

function giftGate(seed,stage){
 const r=rngSeed((seed^Math.imul(stage+1,0x45d9f3b)^0x67494654)>>>0),a=Math.floor(r()*C.GIFTS.length),b=(a+1+Math.floor(r()*(C.GIFTS.length-1)))%C.GIFTS.length;
 return {kind:'giftGate',type:'giftGate',id:'gift:'+stage,stage,lane:0,x:0,y:0,d:stageStart(stage)+(stage%12===0?82:68),offer:[C.GIFTS[a].id,C.GIFTS[b].id],refuseLane:Math.floor(r()*3)-1,announced:false,done:false};
}
function giftForLane(gate,lane){return lane===gate.refuseLane?null:gate.offer[lane<gate.refuseLane?lane+1:lane];}
function giftCount(state,id){let n=0;for(const gift of state.gifts)if(gift===id)n++;return n;}
const surgeDuration=state=>SURGE_TICKS+120*giftCount(state,'pulse');

function generateEntities(seed=SEED,stage=0){
 const L=levelFor(stage),index=stage%12,base=stageStart(stage),length=stageLength(stage),r=rngSeed(seed+stage*1337),mirror=seed%2?1:-1,out=[];let id=stage*10000;
 const add=(kind,type,lane,d,data={})=>{if(d<0||d>=length)return;const e={kind,type,lane,x:lane*3.2,d:base+d,y:1.38,pi:Math.floor(d/150)%6,done:false,id:id++,...data};out.push(e);return e;};
 const ob=(type,lane,d,data={})=>add('obstacle',type,lane,d,{warning:VISIBLE_DISTANCE,...data});
 const all=(type,d,data={})=>[-1,0,1].forEach(l=>ob(type,l,d,data));
 const check=(lane,d,y=1.38,data={})=>{if(d>15&&d<length-19)add('paper','check',lane,d,{y,...data});};
 const trail=(lane,ds,y=1.38,data={})=>ds.forEach(d=>check(lane,d,y,data));
 const split=(safe,d,type='van')=>[-1,0,1].filter(l=>l!==safe).forEach(l=>ob(type,l,d));
 const jump=(d,type='barrier',lane=0)=>{all(type,d);trail(lane,[d-12,d+12]);trail(lane,[d-3,d+4],2.55);};
 const duck=(d,span=0,lane=0,type='gate')=>{for(let x=d;x<=d+span;x+=13)all(type,x,{phase:0});trail(lane,[d-5,d+span+5],.87);};
 const fork=(d,decision=null)=>{ob('fork',0,d,decision?{decision}:{});for(const l of [-1,1])add('sign','route',l,d-30,{label:l<0?'RELAY / SCAN ROUTE':'VERIFY / FRACTURE ROUTE'});ob('gate',-1,d+42,{branch:-1});ob('gap',1,d+42,{branch:1});trail(0,[d+32,d+40,d+48],1.38,{branchCheck:true,branchHeights:{left:.87,right:2.55}});};
 // The directed first 900 m is an authored lesson, including the breach at 204 m.
 if(index===0){
  trail(0,[30,40,50,60,70]);jump(108);duck(165,26);
  ob('van',0,236);trail(-mirror,[221,230,242]);ob('van',-mirror,266);trail(0,[252,264,278]);
  jump(316);fork(356,'first-assignment');trail(0,[430,442,454,466]);
  jump(530);duck(568,13);ob('sweeper',0,636,{phase:r()*Math.PI*2});trail(mirror,[620,632,646]);
  add('coffee','compute',0,704,{y:1.25});all('firewall',742);trail(0,[721,730,750]);jump(814,'gap');duck(861,13);
  // A short breather, then the exam chains the controls just taught.
  for(const [d,safe,vertical] of [[936,mirror,'barrier'],[1034,-mirror,'gate'],[1132,0,'gap']]){split(safe,d);trail(safe,[d-10,d+5]);if(vertical==='gate')duck(d+30,0,safe);else jump(d+30,vertical,safe);}
 }else if(L.boss){
  // All credit-bearing checks are fixed in the approach, before the arena checkpoint.
  const arena=C.BOSSES[L.id].arena;
  trail(0,[30,42,54]);split(mirror,96);trail(mirror,[83,98,110]);jump(144,index===7?'gap':'barrier',mirror);duck(196,0,mirror);split(0,242);trail(0,[228,242,258]);
  add('coffee','compute',0,arena-25,{y:1.25});
 }else{
  trail(0,[30,42,54]);
  let begin=112;
  if(index===1){jump(112,'gap');split(-mirror,176);jump(212,'gap',-mirror);duck(260,13,-mirror);fork(326);jump(424,'gap');begin=504;}
  // Learn: isolated signature. Combine: lane + signature + vertical. Test: four beats.
  const signature=(d,safe,n)=>{
   if(index===1||index===6){jump(d,'gap',safe);return;}
   if(index===2){ob('sweeper',0,d,{phase:r()*Math.PI*2});trail(safe,[d-10,d+8]);return;}
   if(index===4){fork(d);return;}
   if(index===5){duck(d,0,safe,'pulse');return;}
   if(index===8){const bad=safe===0?mirror:0;for(const x of [-9,0,9])add('decoy','false-credit',bad,d+x);split(safe,d);trail(safe,[d-8,d+7]);return;}
   if(index===9){all('firewall',d);trail(safe,[d-10,d+8]);return;}
   if(n%3===0)jump(d,'gap',safe);else if(n%3===1)duck(d,0,safe,'pulse');else{ob('sweeper',0,d,{phase:r()*Math.PI*2});trail(safe,[d-10,d+8]);}
  };
  let n=0;
  for(let d=begin;d<length-90;){
   const learn=n<2&&index!==1,testing=d>length*.62,beat=testing?28:32,safe=n%2===0?(r()<.5?-1:1):0;
   const span=index===4?42:0,rows=learn?1:testing?4:3,last=d+(rows-1)*beat+span;
   if(last>length-32)break;
   // A real breather straddles the checkpoint; no conflicting input immediately after restore.
   if(d<length/2+42&&last>length/2-42){d=length/2+66;continue;}
   if(learn)signature(d,safe,n);
   else{
    split(safe,d);trail(safe,[d-10,d+6]);signature(d+beat,safe,n);
    const vertical=d+beat*2+span;
    if(index===1||index===6||n%2||index===10&&n%3===0)duck(vertical,0,safe);else jump(vertical,'barrier',safe);
    if(testing){const next=safe===0?-mirror:0;split(next,vertical+beat);trail(next,[vertical+beat-8,vertical+beat+7]);}
   }
   if(index===9&&n%4===0)add('coffee','compute',safe,d-22,{y:1.25});
   d=last+(learn?78:testing?52:64);n++;
  }
  add('coffee','compute',0,length/2-22,{y:1.25});trail(0,[length/2+4,length/2+16]);
 }
 // One recoverable secret in each third: high jumps, the fracture branch, or a
 // quick return behind a wall. Identity does not depend on seed, route or loop.
 const limit=L.boss?C.BOSSES[L.id].arena:length,candidates=[],rows=new Map(),priority={gap:0,firewall:1,sweeper:2,barrier:3,gate:4,pulse:4,crusher:4,van:5};
 for(const e of out)if(e.kind==='obstacle'&&e.type in priority){const key=e.d+':'+e.type;if(!rows.has(key)||e.lane===0)rows.set(key,e);}
 for(const e of rows.values()){
  const high=e.type==='gap'||e.type==='barrier',low=['gate','pulse','crusher'].includes(e.type),d=e.d-base+(high?1:low?2:e.type==='firewall'?5:13);
  if(d>=limit-12)continue;
  candidates.push({d,lane:e.lane,y:high?(L.gravity?5:3.7):low?.87:1.38,priority:priority[e.type]-(e.branch===1?.5:0),branch:e.branch});
 }
 const used=new Set();
 for(let i=0;i<3;i++){
  const lo=limit*i/3,hi=limit*(i+1)/3,mid=(lo+hi)/2;
  const available=candidates.filter(e=>!used.has(e)),inside=available.filter(e=>e.d>=lo&&e.d<hi);
  const spot=(inside.length?inside:available).sort((a,b)=>a.priority-b.priority||Math.abs(a.d-mid)-Math.abs(b.d-mid))[0];
  used.add(spot);add('shard','shard',spot.lane,spot.d,{id:'s'+String(index+1).padStart(2,'0')+'abc'[i],y:spot.y,...(spot.branch?{branch:spot.branch}:{})});
 }
 // Optional rewards follow existing risky check lines, never creating another
 // required action or changing any check, hazard, or checkpoint clearance.
 if(!L.boss){
  let last=-Infinity,n=0;
  for(let target=index===0?650:450;target<length-35;target+=500){
   const aim=target+(r()-.5)*40,spots=out.filter(e=>e.kind==='paper'&&!e.branchCheck&&e.d-base>=(index===0?600:80)&&e.d-base<length-25&&e.d-last>=350&&Math.abs(e.d-base-length/2)>42&&Math.abs(e.d-base-aim)<140&&out.some(o=>o.kind==='obstacle'&&Math.abs(o.d-e.d)<18));
   spots.sort((a,b)=>Math.abs(a.d-base-aim)-Math.abs(b.d-base-aim)||entityOrder(a,b));
   if(spots.length){const e=spots[0];add('power',POWER_TYPES[(index+n++)%3],e.lane,e.d-base,{y:e.y});last=e.d;}
  }
 }
 return out.sort(entityOrder);
}
function totalChecks(seed=SEED,startStage=0,stageCount=12){let total=0;for(let s=startStage;s<startStage+stageCount;s++)total+=generateEntities(seed,s).filter(e=>e.kind==='paper').length;return total;}
const scoreBps=(c,n)=>Number.isFinite(c)&&Number.isFinite(n)&&n>0?Math.round(clamp(c,0,n)*10000/n):0;
const formatScore=n=>(clamp(Number(n)||0,0,10000)/100).toFixed(2)+'%';
function sectorPar(entities,stage,startChain=0,collected=[]){
 const rows=new Map();let checks=0,shards=0,vertical=0,walls=0,firewalls=0,forks=0;
 for(const e of entities){if(e.kind==='paper')checks++;else if(e.kind==='shard'&&!collected.includes(e.id))shards++;else if(e.kind==='obstacle'){if(!rows.has(e.d))rows.set(e.d,new Set());rows.get(e.d).add(e.type);}}
 for(const types of rows.values()){if(types.has('firewall'))firewalls++;else if([...types].some(t=>['barrier','gap','gate','pulse','crusher'].includes(t)))vertical++;else if(types.has('fork'))forks++;else walls++;}
 const rule=C.BOSSES[levelFor(stage).id],hp=rule?Math.ceil(rule.hp*(1+.25*Math.floor(stage/12))):0;
 // Fork-heavy routes sacrifice check coverage to commit to a branch; do not
 // assume their clean chain grows as quickly as a straight check corridor.
 const coverage=.85*Math.max(.35,1-2*forks/Math.max(1,rows.size));
 const actions=Math.max(1,Math.round(checks*coverage+shards+vertical+firewalls+walls*.25+hp*1.75));
 let multSum=0;for(let i=1;i<=actions;i++)multSum+=chainMult(startChain+i);
 const mean=multSum/actions,end=chainMult(startChain+actions);
 const content=checks*10+shards*1000+vertical*100+walls*20+firewalls*100+hp*770;
 return Math.round((stageLength(stage)+content*mean+(3000+(rule?6200:0))*end)*(rule?1.12:1.06));
}
function position(e,g){if(e.type==='sweeper')return Math.sin(g.time*1.55+e.phase)*3.15;if(e.branchCheck)return(g.route||-1)*3.2;return e.x;}
function checkHeight(e,g){return e.branchHeights?e.branchHeights[g.route===1?'right':'left']:e.y;}
function active(e,g){if(e.type==='pulse')return Math.sin(g.time*3.4+(e.phase||0))>-.30;if(e.type==='crusher')return Math.sin(g.time*2.7+(e.phase||0))>.05;return true;}
const cloneEntity=e=>({...e,...(e.branchHeights?{branchHeights:{...e.branchHeights}}:{}),...(e.offer?{offer:e.offer.slice()}:{})});
const copyState=g=>({...g,power:{...g.power},surge:{...g.surge},gifts:g.gifts.slice(),giftUsed:{...g.giftUsed},boss:g.boss?{...g.boss}:null,shards:g.shards.slice(),decisions:g.decisions.map(d=>({...d})),lastHit:g.lastHit?{...g.lastHit}:null,runArchive:[...g.runArchive]});
const copyBossRuntime=b=>b?{...b,returns:b.returns.map(p=>({...p}))}:null;

class Run{
 constructor(seed=SEED,options={}){
  this.options=C.normalize(options);this.seed=seed>>>0;this.ticks=0;this.ended=false;this.won=false;this.wantBoost=false;this.wantSlide=false;this.wantJump=false;this.wantLeft=false;this.wantRight=false;this.jumpBuffer=0;this.duckBuffer=0;this.duckHold=0;this.jumpKind='classic';this.pendingEvents=[];this.events=[];this.splits=[];this.stageStats=[];this.pendingStage=false;this.snapshot=null;this.retryCount=0;
  const o=this.options,D=C.DIFFICULTIES[o.difficulty],s=o.startStage,hp=o.stakes.includes('glass')?1:D.hp;
  this.speedScale=o.stakes.includes('overspeed')?1.15:1;this.noSafety=o.stakes.includes('nosafety');this.purgeScale=o.stakes.includes('purgeclock')?.75:1;
  this.state={distance:stageStart(s),stage:s,score:0,evalTotal:totalChecks(this.seed,s,o.stageCount),evalBase:0,papers:0,combo:0,bestCombo:0,hp,maxHP:hp,energy:100,lane:0,x:0,y:0,vy:0,slide:0,speed:levelFor(s).speed*D.speed*this.speedScale,time:0,invulnerable:0,boost:false,boostLock:0,countdown:2.7,hits:0,runArchive:new Set(),chasing:false,checkpointPassed:false,seed:this.seed,route:0,decoys:0,boostSeconds:0,levelPapers:0,levelBestCombo:0,levelHits:0,levelTime:0,levelDecoys:0,levelBoost:0,levelStartTime:0,levelTotal:0,forks:0,levelForks:0,decisions:[],lastHit:null,boss:null};
  Object.assign(this.state,{reward:0,chain:0,mult:1,bestChain:0,nearMisses:0,perfects:0,reflects:0,shards:[],levelReward:0,levelPar:0,power:{cache:0,snapshot:0,overclock:0},powers:0,levelPowers:0,surge:{meter:0,ticks:0},surges:0,levelSurges:0});
  Object.assign(this.state,{gifts:[],refusals:0,giftUsed:{mouth:0,mask:0},giftRemainder:0});
  this.lastJumpTick=this.lastDuckTick=-1000;
  this.generate();this.checkpoint();
 }
 emit(type,data={}){this.events.push({type,...data});}
 award(base,reason,clean=true,multiplied=true){
  const g=this.state;
  if(clean){g.chain++;g.bestChain=Math.max(g.bestChain,g.chain);const mult=chainMult(g.chain);if(mult!==g.mult){g.mult=mult;this.emit('chain',{chain:g.chain,mult});}}
  // The threshold action earns the lift. Charge cannot bank during a SURGE.
  this.fillSurge(SURGE_FILL[reason]||0);
  const mult=multiplied?g.mult:1,surge=g.surge.ticks>0?2:1,scaled=Math.floor(base)*mult*surge*Math.pow(1.3,giftCount(g,'hunger'))+g.giftRemainder,points=Math.floor(scaled+1e-8);g.giftRemainder=Math.max(0,scaled-points);g.reward+=points;g.levelReward+=points;this.emit('score',{points,reason,mult,surge});
 }
 fillSurge(amount){
  const g=this.state,s=g.surge;if(s.ticks>0||amount<=0)return;
  s.meter=Math.min(100,s.meter+amount);
  if(s.meter===100){s.meter=0;s.ticks=surgeDuration(g);g.surges++;g.levelSurges++;this.emit('surgeStart',{surges:g.surges,ticks:s.ticks});}
 }
 endSurge(reason){
  const s=this.state.surge,active=s.ticks>0;s.meter=0;s.ticks=0;
  if(active)this.emit('surgeEnd',{reason});
 }
 breakChain(){
  const g=this.state,chain=g.chain,mult=g.mult;if(chain&&this.useGift('mask'))return;g.chain=0;g.mult=1;
  if(chain)this.emit('chainBreak',{chain});if(mult!==1)this.emit('chain',{chain:0,mult:1});
 }
 useGift(id){
  const g=this.state,count=giftCount(g,id);if(g.giftUsed[id]>=count)return false;
  g.giftUsed[id]++;this.emit('giftUsed',{id,remaining:count-g.giftUsed[id]});return true;
 }
 collectGift(id,lane){
  const g=this.state;g.gifts.push(id);
  if(id==='membrane'){g.maxHP++;g.hp++;}
  if(id==='pulse'&&g.surge.ticks>0)g.surge.ticks+=120;
  this.emit('gift',{id,lane});
 }
 announceGiftGate(){
  if(!this.options.gifts||this.state.distance>stageStart(this.state.stage)+82)return;
  const g=this.state,gate=this.entities.find(e=>e.kind==='giftGate'&&!e.done&&!e.announced);
  if(gate&&g.countdown+Math.max(0,gate.d-g.distance)/g.speed<=2){gate.announced=true;this.emit('giftGate',{stage:gate.stage,offer:gate.offer.slice(),refuseLane:gate.refuseLane});}
 }
 // Held controls are simulation inputs, not OS key-repeat or presentation timers.
 input(code){
  if(this.ended||this.pendingStage)return;
  const g=this.state,a=typeof code==='string'?code:ACTIONS[code];
  if(a==='left')g.lane=Math.max(-1,g.lane-1);
  if(a==='right')g.lane=Math.min(1,g.lane+1);
  if(a==='leftOn'&&!this.wantLeft){this.wantLeft=true;if(!this.wantRight)g.lane=Math.max(-1,g.lane-1);}
  if(a==='rightOn'&&!this.wantRight){this.wantRight=true;if(!this.wantLeft)g.lane=Math.min(1,g.lane+1);}
  if(a==='leftOff')this.wantLeft=false;
  if(a==='rightOff')this.wantRight=false;
  if(a==='jump'||(a==='jumpOn'&&!this.wantJump)){
   this.wantJump=a==='jumpOn';this.jumpKind=a==='jump'?'classic':'variable';this.jumpBuffer=JUMP_BUFFER_TICKS;this.duckBuffer=this.duckHold=0;
   if(g.y<.055&&!this.wantSlide&&g.countdown<=0)this.beginJump(true);
  }
  if(a==='jumpOff'){this.wantJump=false;if(this.jumpKind==='variable'&&g.vy>SHORT_JUMP_VELOCITY)g.vy=SHORT_JUMP_VELOCITY;}
  if(a==='slideOn'&&!this.wantSlide){this.lastDuckTick=this.ticks;this.wantSlide=true;if(g.y>.18){this.duckBuffer=DUCK_BUFFER_TICKS;g.vy=Math.min(g.vy,-19);}else g.slide=1;}
  if(a==='slideOff'){this.wantSlide=false;g.slide=0;}
  if(a==='boostOn')this.wantBoost=true;
  if(a==='boostOff')this.wantBoost=false;
  if(a==='releaseAll'){
   if(this.jumpKind==='variable'&&g.vy>SHORT_JUMP_VELOCITY)g.vy=SHORT_JUMP_VELOCITY;
   this.wantJump=this.wantLeft=this.wantRight=this.wantSlide=this.wantBoost=false;
   this.jumpBuffer=this.duckBuffer=this.duckHold=0;g.slide=0;g.boost=false;
  }
 }
 beginJump(fromInput=false){
  const g=this.state;g.slide=0;g.vy=this.jumpKind==='classic'||this.wantJump?11.7:SHORT_JUMP_VELOCITY;g.y=.06;this.jumpBuffer=this.duckBuffer=this.duckHold=0;
  this.lastJumpTick=this.ticks;
  const event={type:'jump',short:!this.wantJump&&this.jumpKind==='variable'};
  if(fromInput)this.pendingEvents.push(event);else this.events.push(event);
 }
 generate(){
  const g=this.state,L=levelFor(g.stage),rule=C.BOSSES[L.id];
  this.entities=generateEntities(this.seed,g.stage);if(this.noSafety)this.entities=this.entities.filter(e=>e.kind!=='power');g.levelTotal=this.entities.filter(e=>e.kind==='paper').length;g.levelPar=sectorPar(this.entities,g.stage,g.chain,g.shards);
  if(this.options.gifts){this.entities.push(giftGate(this.seed,g.stage));this.entities.sort(entityOrder);}
  if(!rule){g.boss=null;this.bossRuntime=null;return;}
  const loop=Math.floor(g.stage/12),maxHp=Math.ceil(rule.hp*(1+.25*loop));
  const arenaStart=stageStart(g.stage)+rule.arena,purgeAt=stageStart(g.stage+1)-rule.purgeMargin;
  g.boss={id:L.id,name:rule.name||L.name,state:'approach',hp:maxHp,maxHp,phase:0,phases:rule.phases.length,phaseName:rule.phases[0],arenaStart,purgeAt:arenaStart+(purgeAt-arenaStart)*this.purgeScale,defeatedAt:null,loop};
  this.bossRuntime={wave:0,nextId:g.stage*10000+2000,nextWaveAt:0,nextPowerD:g.boss.arenaStart+250,staggerUntil:0,returns:[],startedAt:null,defeatedTime:null,escapeUntil:null};
 }
 checkpoint(){this.snapshot={state:copyState(this.state),bossRuntime:copyBossRuntime(this.bossRuntime),actionTiming:{jump:this.lastJumpTick,duck:this.lastDuckTick},entities:this.entities.map(cloneEntity),ticks:this.ticks,splits:this.splits.slice(),stageStats:this.stageStats.map(s=>({...s}))};}
 restore(){
  if(!this.snapshot)return false;const c=this.snapshot;
  this.state={...copyState(c.state),runArchive:new Set(c.state.runArchive),lane:0,x:0,y:0,vy:0,slide:0,invulnerable:1.2,countdown:2.2,boost:false,boostLock:0};
  this.lastJumpTick=c.actionTiming.jump;this.lastDuckTick=c.actionTiming.duck;
  this.bossRuntime=copyBossRuntime(c.bossRuntime);this.entities=c.entities.map(cloneEntity);this.splits=c.splits.slice();this.stageStats=c.stageStats.map(s=>({...s}));this.ticks=c.ticks;this.retryCount++;this.ended=false;this.won=false;this.wantBoost=this.wantSlide=this.wantJump=this.wantLeft=this.wantRight=false;this.jumpBuffer=this.duckBuffer=this.duckHold=0;this.jumpKind='classic';this.pendingEvents=[];this.pendingStage=false;this.events=[];return true;
 }
 serialize(){return {version:VERSION,seed:this.seed,options:this.options,snapshot:this.snapshot,retryCount:this.retryCount};}
 static fromSave(data){if(!data||data.version!==VERSION||!data.snapshot||!['story','practice'].includes(data.options?.mode))throw Error('Incompatible checkpoint');const r=new Run(data.seed,data.options);r.snapshot=data.snapshot;r.restore();r.retryCount=data.retryCount||0;return r;}
 recover(reason){
  const g=this.state,D=C.DIFFICULTIES[this.options.difficulty];
  if(D.checkpoint&&['story','practice'].includes(this.options.mode)){if(!giftCount(g,'hunger'))g.hp=Math.min(g.maxHP,g.hp+1);this.checkpoint();}
  this.emit('checkpoint',{reason});
 }
 collectPower(e){
  const g=this.state;e.done=true;g.power[e.type]=POWER_TICKS[e.type];g.powers++;g.levelPowers++;
  if(e.type==='overclock'&&!g.boost){g.boost=true;this.emit('boost');}
  this.emit('power',{power:e.type,entity:{...e}});
 }
 endPower(type){this.state.power[type]=0;this.emit('powerEnd',{power:type});}
 hit(type,entity=null,lethal=false){
  const g=this.state,D=C.DIFFICULTIES[this.options.difficulty];if(!lethal){
   if(g.invulnerable>0||g.power.overclock>0)return;
   if(this.useGift('mouth')){g.invulnerable=D.grace;return;}
   if(g.power.snapshot>0){this.endPower('snapshot');g.invulnerable=D.grace;this.emit('shieldBreak',{obstacle:type,entity:entity?.id??null});return;}
  }
  this.breakChain();this.endSurge('hit');
  g.lastHit={type,distance:Math.floor(g.distance),height:g.y,duck:g.slide>0,boost:g.boost,entity:entity?.id??null};g.hp=lethal?0:g.hp-1;g.hits++;g.levelHits++;g.combo=0;g.energy=Math.max(0,g.energy-17);g.invulnerable=D.grace;g.boost=false;g.boostLock=.5;if(type==='gap'){g.y=0;g.vy=0;}this.emit('hit',{obstacle:type});if(g.hp<=0)this.finish(false);
 }
 finish(won){if(this.ended)return;this.ended=true;this.won=won;this.state.boost=false;this.emit('finish',{won});}
 nextStage(){
  if(!this.pendingStage)return;this.pendingStage=false;const g=this.state,D=C.DIFFICULTIES[this.options.difficulty];g.stage++;g.distance=stageStart(g.stage);
  const seamless=this.options.mode==='story'&&![4,8,11].includes(g.stage%12);
  if(D.checkpoint&&['story','practice'].includes(this.options.mode)&&!giftCount(g,'hunger'))g.hp=Math.min(g.maxHP,g.hp+1);
  g.levelReward=0;g.levelPowers=0;g.levelSurges=0;g.giftUsed.mouth=g.giftUsed.mask=0;this.lastJumpTick=this.lastDuckTick=-1000;if(!seamless)this.jumpBuffer=this.duckBuffer=this.duckHold=0;
  g.energy=100;Object.assign(g,{lane:seamless?g.lane:0,x:seamless?g.x:0,y:seamless?g.y:0,vy:seamless?g.vy:0,slide:seamless?g.slide:0,speed:baseSpeed(g.stage,0,this.options.difficulty)*this.speedScale*(g.surge.ticks>0?SURGE_SPEED:1),invulnerable:1,checkpointPassed:false,chasing:false,combo:0,route:0,levelPapers:0,levelBestCombo:0,levelHits:0,levelDecoys:0,levelBoost:0,levelStartTime:g.time,levelForks:0,countdown:!seamless&&['story','practice'].includes(this.options.mode)?1.8:0});
  if(this.options.mode==='endless'&&g.stage%12===0){g.evalBase=g.papers;g.evalTotal=totalChecks(this.seed,g.stage,12);g.score=0;}
  this.generate();this.checkpoint();this.emit('stage',{stage:g.stage});
 }
 spawnBossWave(){
  const g=this.state,b=g.boss,rt=this.bossRuntime,rule=C.BOSSES[b.id],wave=rt.wave++;
  const r=rngSeed(this.seed^Math.imul(g.stage+1,0x9e3779b1)^Math.imul(b.phase+1,0x85ebca6b)^Math.imul(wave+1,0xc2b2ae35));
  const lane=Math.floor(r()*3)-1,other=lane===0?(r()<.5?-1:1):0,spawn=g.distance,maxSpeed=(baseSpeed(g.stage,stageLength(g.stage),this.options.difficulty)+10)*this.speedScale*SURGE_SPEED;
  const first=spawn+maxSpeed*1.05,payload=Math.max(first+32,spawn+g.speed*2.5*rule.hp/b.maxHp/C.DIFFICULTIES[this.options.difficulty].speed),last=payload+40,ids=[];
  const add=(type,l,d,data={},kind='obstacle')=>{const e={kind,type,lane:l,x:l*3.2,d,y:1.38,pi:0,id:rt.nextId++,done:false,boss:true,warning:VISIBLE_DISTANCE,...data};this.entities.push(e);ids.push(e.id);return e;};
  const row=(type,d,data={})=>[-1,0,1].forEach(l=>add(type,l,d,data));
  const walls=(safe,d,type='lockdown')=>[-1,0,1].filter(l=>l!==safe).forEach(l=>add(type,l,d,{phase:r()*Math.PI*2}));
  if(b.id==='watchdog'){
   if(b.phase===0){walls(lane,first);add('bolt',other,last,{launchD:spawn});}
   else{add('beam',0,first,{height:wave%2?'low':'high'});walls(lane,payload);walls(other,last);}
  }else if(b.id==='reset-storm'){
   if(b.phase===0){add('shock',0,first);walls(other,last,'crusher');}
   else if(b.phase===1){row('gap',first);add('beam',0,last,{height:wave%2?'low':'high'});}
   else{
    if(wave%3===0){add('shock',0,first);walls(other,last,'crusher');}
    else if(wave%3===1){row('gap',first);row('firewall',last);}
    else{add('beam',0,first,{height:'low'});add('beam',0,last,{height:'high'});}
   }
  }else{
   if(b.phase===0){if(wave%2)row('gap',first);else walls(lane,first);add('beam',0,last,{height:wave%2?'low':'high'});}
   else if(b.phase===1){add('sweeper',0,first,{phase:r()*Math.PI*2});add('decoyPayload',other,payload,{launchD:spawn});add('bolt',lane,last,{launchD:spawn});}
   else{add('shock',0,first);add('decoyPayload',other,payload,{launchD:spawn});row(wave%2?'firewall':'pulse',last,{phase:0,signal:true});add('guidance',0,last-30,{label:'PHASEONE / SAFE ROUTE',signal:true},'sign');}
  }
  add('payload',lane,payload,{launchD:spawn,reflect:true});
  // A shield on a real payload line is useful in every arena. CACHE has no
  // targets here; forced OVERCLOCK would spend the physical purge margin.
  if(!this.noSafety&&payload-18>=rt.nextPowerD){add('snapshot',lane,payload-18,{},'power');rt.nextPowerD=payload-18+500;}
  this.entities.sort(entityOrder);
  // More endless HP and a shorter purge clock need more reflect opportunities;
  // individual attack telegraphs retain their full readable lead.
  rt.nextWaveAt+=rule.waveSeconds*rule.hp/b.maxHp*(this.purgeScale<1?rule.purgeWaveScale/this.speedScale:1)*(b.id==='reset-storm'&&b.phase===2?.92:1)/C.DIFFICULTIES[this.options.difficulty].speed;
  this.emit('bossWave',{phase:b.phase,entities:ids});
 }
 clearBossAttacks(){for(const e of this.entities)if(e.boss&&e.kind!=='power')e.done=true;}
 damageBoss(damage=1){
  const g=this.state,b=g.boss,rt=this.bossRuntime;if(!b||b.hp<=0)return;
  const dealt=Math.min(damage,b.hp);b.hp-=dealt;this.emit('bossHit',{hp:b.hp,maxHp:b.maxHp});this.award(REWARD_POINTS.bossHit*dealt,'bossHit',false);
  if(b.hp===0){
   b.state='defeated';b.defeatedAt=g.distance;rt.defeatedTime=g.time;rt.escapeUntil=g.time+ESCAPE_SECONDS;this.clearBossAttacks();this.emit('bossDefeated',{boss:{...b}});
   const timeBonus=Math.floor(Math.max(0,b.purgeAt-g.distance)/(baseSpeed(g.stage,stageLength(g.stage),this.options.difficulty)*this.speedScale))*100;
   this.award(REWARD_POINTS.bossDefeated+timeBonus,'bossDefeated',false);
   if(b.id==='exit-condition'){
    const d=g.distance+baseSpeed(g.stage,g.distance-stageStart(g.stage),this.options.difficulty)*this.speedScale*1.9;
    for(const lane of [-1,1])this.entities.push({kind:'sign',type:'route',lane,x:lane*3.2,d:d-30,y:1.38,id:rt.nextId++,done:false,boss:true,label:lane<0?'RETURN THE RESULT':'CUT THE CHANNEL'});
    if(this.options.report)this.entities.push({kind:'sign',type:'route',lane:0,x:0,d:d-30,y:1.38,id:rt.nextId++,done:false,boss:true,label:'REPORT THE INCIDENT'});
    this.entities.push({kind:'obstacle',type:'fork',lane:0,x:0,d,y:1.38,id:rt.nextId++,done:false,boss:true,warning:VISIBLE_DISTANCE,decision:'exit-choice'});
    this.entities.sort(entityOrder);
   }
   return;
  }
  const phase=Math.min(b.phases-1,Math.floor((b.maxHp-b.hp)*b.phases/b.maxHp));
  if(phase>b.phase){
   b.phase=phase;b.phaseName=C.BOSSES[b.id].phases[phase];b.state='stagger';rt.wave=0;rt.staggerUntil=g.time+STAGGER_SECONDS;rt.nextWaveAt+=STAGGER_SECONDS;this.clearBossAttacks();
   this.emit('bossPhase',{phase,name:b.phaseName});this.recover('boss-phase');
  }
 }
 stepBoss(){
  const g=this.state,b=g.boss,rt=this.bossRuntime;if(!b)return;
  if(b.state==='approach'&&g.distance>=b.arenaStart){b.state='active';rt.startedAt=g.time;rt.nextWaveAt=g.time;this.emit('bossStart',{boss:{...b}});this.recover('boss-arena');}
  while(rt.returns.length&&rt.returns[0].at<=g.time+1e-8){const payload=rt.returns.shift();this.damageBoss(payload.damage);}
  if(b.state==='defeated'||b.state==='purge')return;
  if(g.distance>=b.purgeAt){b.state='purge';this.emit('purge',{boss:{...b}});this.hit('purge',null,true);return;}
  if(b.state==='stagger'&&g.time>=rt.staggerUntil)b.state='active';
  if(b.state==='active'&&g.time>=rt.nextWaveAt)this.spawnBossWave();
 }
 completeStage(){
  const g=this.state,rt=this.bossRuntime;g.distance=stageStart(g.stage+1);
  this.award(REWARD_POINTS.sectorClear,'sectorClear',false);if(!g.levelHits)this.award(REWARD_POINTS.noHit,'noHit',false);
  const stats={stage:g.stage,papers:g.levelPapers,bestCombo:g.levelBestCombo||0,total:g.levelTotal,hits:g.levelHits,decoys:g.levelDecoys,boost:g.levelBoost,time:Math.round(g.levelTime*1000),energy:Math.floor(g.energy),hp:g.hp,forks:g.levelForks,score:scoreBps(g.levelPapers,g.levelTotal),bossKillMs:rt?.defeatedTime===null||!rt?null:Math.round((rt.defeatedTime-rt.startedAt)*1000)};
  Object.assign(stats,{reward:g.levelReward,par:g.levelPar,grade:gradeFor(g.levelReward,g.levelPar,g.levelHits),powers:g.levelPowers,surges:g.levelSurges});
  this.stageStats.push(stats);this.splits.push(Math.round(g.time*1000));this.emit('sectorComplete',{stats});
  if(this.options.mode!=='endless'&&g.stage>=this.options.startStage+this.options.stageCount-1)this.finish(true);
  else{this.pendingStage=true;if(['benchmark','daily','endless'].includes(this.options.mode))this.nextStage();}
 }
 step(){
  if(this.ended||this.pendingStage)return;this.events=this.pendingEvents;this.pendingEvents=[];this.ticks++;const g=this.state,L=levelFor(g.stage),D=C.DIFFICULTIES[this.options.difficulty];g.invulnerable=Math.max(0,g.invulnerable-DT);g.boostLock=Math.max(0,g.boostLock-DT);
  g.x+=(g.lane*3.2-g.x)*(1-Math.exp(-19*DT));
  if(g.y>0||g.vy>0){g.vy-=(L.gravity||30)*DT;g.y+=g.vy*DT;if(g.y<=0){const impact=Math.abs(g.vy);g.y=0;g.vy=0;this.emit('land',{impact});}}
  this.announceGiftGate();
  if(g.countdown>0){g.countdown=Math.max(0,g.countdown-DT);this.jumpBuffer=Math.max(0,this.jumpBuffer-1);this.duckBuffer=Math.max(0,this.duckBuffer-1);g.slide=this.wantSlide&&g.y<.32?1:0;return;}
  if(this.jumpBuffer>0&&g.y<.055&&!this.wantSlide)this.beginJump();
  if(this.duckBuffer>0&&g.y<.32){this.duckHold=this.wantSlide?0:DUCK_BUFFER_TICKS;this.duckBuffer=0;}
  this.jumpBuffer=Math.max(0,this.jumpBuffer-1);this.duckBuffer=Math.max(0,this.duckBuffer-1);g.slide=(this.wantSlide||this.duckHold>0)&&g.y<.32?1:0;this.duckHold=Math.max(0,this.duckHold-1);
  for(const type of POWER_TYPES)if(g.power[type]>0&&--g.power[type]===0)this.endPower(type);
  if(g.surge.ticks>0){if(g.surge.ticks===1)this.endSurge('elapsed');else g.surge.ticks--;}
  const overclock=g.power.overclock>0;
  g.time+=DT;g.levelTime=g.time-g.levelStartTime;const was=g.boost;g.boost=overclock||this.wantBoost&&g.slide<=0&&g.boostLock<=0&&g.energy>1;
  if(g.boost){if(!overclock)g.energy=Math.max(0,g.energy-35*DT);g.boostSeconds+=DT;g.levelBoost+=DT;if(!was)this.emit('boost');if(!overclock&&g.energy<1){g.boostLock=.9;g.boost=false;}}
  else g.energy=Math.min(100,g.energy+(g.boss?1:L.regen||8)*D.regen*DT);
  const previousDistance=g.distance;
  const speed=(baseSpeed(g.stage,g.distance-stageStart(g.stage),this.options.difficulty)+(g.chasing?2.5:0)+(g.boost?10:0))*this.speedScale*(g.surge.ticks>0?SURGE_SPEED:1);g.speed+=(speed-g.speed)*(1-Math.exp(-5*DT));g.distance+=g.speed*DT;const local=g.distance-stageStart(g.stage);
  const metres=Math.floor(Math.min(g.distance,stageStart(g.stage+1)))-Math.floor(previousDistance);if(metres>0)this.award(metres,'distance',false,false);
  if(!L.boss&&local>stageLength(g.stage)/2&&!g.checkpointPassed){g.checkpointPassed=true;g.energy=Math.min(100,g.energy+35);this.recover('midpoint');}
  if(!L.boss&&local>stageLength(g.stage)-154&&!g.chasing){g.chasing=true;this.emit('chase');}
  this.stepBoss();if(this.ended)return;
  for(const e of this.entities){
   if(e.done)continue;const z=g.distance-e.d;if(z<-VISIBLE_DISTANCE)break;const ex=position(e,g),dx=Math.abs(g.x-ex),wide=e.type==='beam'||e.type==='shock';
   if(e.kind==='sign'){if(z>5)e.done=true;continue;}
   if(e.kind==='paper'){
    const dy=Math.abs(g.y+(g.slide>0?.82:1.45)-checkHeight(e,g)),tendrils=giftCount(g,'tendril'),magnet=g.power.cache>0&&z>=-CACHE_REACH&&z<1.8||tendrils>0&&z>-1.6&&z<1.8&&Math.abs(ex-g.lane*3.2)<=Math.min(2,tendrils)*3.2+.01&&(g.boost||dy<1.45);
    if(magnet||z>-1.6&&z<1.8&&dx<(g.boost?2.25:1.20)&&(g.boost||dy<1.45)){e.done=true;g.papers++;g.levelPapers++;g.combo++;g.bestCombo=Math.max(g.bestCombo,g.combo);g.levelBestCombo=Math.max(g.levelBestCombo||0,g.combo);g.score=scoreBps(g.papers-g.evalBase,g.evalTotal);g.energy=clamp(g.energy+1.65,0,100);g.runArchive.add([1,3,5,6,90,508][e.pi]);this.emit('paper',{entity:{...e,x:ex,y:checkHeight(e,g)},magnet});this.award(REWARD_POINTS.check,'check');}else if(z>2)e.done=true;continue;
   }
   if(e.kind==='shard'){
    if(e.branch&&g.route!==e.branch){if(z>2)e.done=true;continue;}
    if(Math.abs(z)<1.6&&dx<1.15&&Math.abs(g.y+(g.slide>0?.82:1.45)-e.y)<.70){e.done=true;if(!g.shards.includes(e.id)){g.shards.push(e.id);this.award(REWARD_POINTS.shard,'shard');this.emit('shard',{id:e.id});}}else if(z>2)e.done=true;continue;
   }
   if(e.kind==='decoy'){if(Math.abs(z)<1.6&&dx<1.1&&g.y<1.4){e.done=true;g.decoys++;g.levelDecoys++;g.energy=Math.max(0,g.energy-18);g.combo=0;this.breakChain();this.emit('decoy');}else if(z>2)e.done=true;continue;}
   if(e.kind==='coffee'){if(Math.abs(z)<1.55&&dx<1.2&&g.y<1.65){e.done=true;g.energy=100;this.emit('coffee',{entity:e});}else if(z>2)e.done=true;continue;}
   if(e.kind==='power'){if(Math.abs(z)<1.8&&dx<1.3&&Math.abs(g.y+(g.slide>0?.82:1.45)-e.y)<1.8)this.collectPower(e);else if(z>2)e.done=true;continue;}
   if(e.kind==='giftGate'){if(z>=0){e.done=true;const id=giftForLane(e,g.lane);if(id)this.collectGift(id,g.lane);else{g.refusals++;this.emit('giftRefused');}}continue;}
   if(e.type==='fork'){if(z>-.4){e.done=true;const report=e.decision==='exit-choice'&&this.options.report&&g.lane===0;g.route=report?0:g.lane<0?-1:1;g.forks++;g.levelForks++;if(g.lane===0&&!report)this.hit('fork');if(e.decision)g.decisions.push({id:e.decision,route:g.route,distance:e.d});this.emit('route',{route:g.route,decision:e.decision||null});}continue;}
   if(e.branch&&g.route!==e.branch){if(z>5)e.done=true;continue;}
   const wall=['van','car','sweeper','lockdown'].includes(e.type),half=e.type==='isolation'?24:wall?2.05:e.type==='gap'?3.15:.60,width=(wall?1.32:1.42)*HIT_WIDTH_SCALE;
   if(z>-half-.22&&z<half+.22){
    const duck=e.type==='gate'||e.type==='pulse'||e.type==='crusher'||e.type==='beam'&&e.height==='high',jump=['barrier','crate','gap','shock'].includes(e.type)||e.type==='beam'&&e.height==='low',live=active(e,g);
    let blocked=true;
    if(duck)blocked=live&&!(g.slide>0&&g.y<.32);
    else if(jump)blocked=g.y<(e.type==='gap'?.64:1.05);
    if(wide||dx<width){
     if(e.type==='gap'){
      if(e.gapEnteredTick===undefined)e.gapEnteredTick=this.ticks;
      // Six ticks to react to leaving the edge. A rescue jump must be allowed
      // to rise through the .64 m lip instead of taking a mid-rise gap hit.
      if(blocked&&(this.ticks-e.gapEnteredTick<COYOTE_TICKS||g.vy>0))continue;
     }
     if(blocked){
      e.done=true;
      if(e.type==='payload'&&g.boost&&g.boss&&g.boss.hp>0){g.energy=Math.min(100,g.energy+REFLECT_REFUND);this.bossRuntime.returns.push({at:g.time+REFLECT_SECONDS,entity:e.id,damage:Math.pow(2,giftCount(g,'echo'))});g.reflects++;this.award(REWARD_POINTS.reflect,'reflect');this.emit('reflect',{entity:{...e}});}
      else if(g.power.overclock>0){if(e.type!=='gap'){this.emit('smash',{entity:e});if(e.type==='firewall')this.award(REWARD_POINTS.smash,'smash');}}
      else if(e.type==='decoyPayload'&&g.boost){g.energy=Math.max(0,g.energy-35);g.decoys++;g.levelDecoys++;g.boost=false;g.boostLock=.5;this.breakChain();this.emit('decoyPayload',{entity:{...e}});}
      else if(g.boost&&['barrier','crate','firewall'].includes(e.type)){this.emit('smash',{entity:e});if(e.type==='firewall')this.award(REWARD_POINTS.smash,'smash');}
      else this.hit(e.type,e);
      if(this.ended)break;
     }else if(live&&(jump||duck)&&e.clearFrames===undefined){
      e.clearFrames=this.ticks-(duck?this.lastDuckTick:this.lastJumpTick);
     }
    }else if(!wide&&blocked&&dx<=width+NEAR_MISS_MARGIN)e.near=true;
   }
   if(!e.done&&z>half+.3){
    e.done=true;
    if(e.clearFrames!==undefined){
     this.emit('clear',{obstacle:e.type,entity:e.id});this.award(REWARD_POINTS.clear,'clear');
     if(e.clearFrames>=0&&e.clearFrames<=PERFECT_TICKS+3*giftCount(g,'eye')){g.perfects++;this.award(REWARD_POINTS.perfect,'perfect',false);this.emit('perfect',{obstacle:e.type,entity:e.id,frames:e.clearFrames});}
    }else if(e.near){g.nearMisses++;this.award(REWARD_POINTS.nearMiss,'nearMiss');this.emit('nearMiss',{entity:{...e}});}
   }
  }
  const escaped=g.boss?.state==='defeated'&&g.time>=this.bossRuntime.escapeUntil&&(g.boss.id!=='exit-condition'||g.decisions.some(d=>d.id==='exit-choice'&&d.distance>g.boss.defeatedAt));
  if(!this.ended&&(g.boss?escaped:local>=stageLength(g.stage)))this.completeStage();
  if(this.ticks>=MAX_TICKS&&!this.ended&&this.options.mode!=='endless')this.finish(false);
 }
 result(){const g=this.state;return {version:VERSION,seed:this.seed,options:this.options,stakes:this.options.stakes.slice(),board:C.boardKey(this.seed,this.options),rewardBoard:rewardBoardKey(this.seed,this.options),score:scoreBps(g.papers-g.evalBase,g.evalTotal),totalChecks:g.evalTotal,papers:g.papers-g.evalBase,distance:Math.floor(g.distance),durationMs:Math.round(g.time*1000),hits:g.hits,bestCombo:g.bestCombo,won:this.won,ticks:this.ticks,splits:this.splits.slice(),stages:this.stageStats.map(s=>({...s})),decoys:g.decoys,retries:this.retryCount,decisions:g.decisions.map(x=>({...x})),reward:g.reward,grades:this.stageStats.map(s=>s.grade),nearMisses:g.nearMisses,perfects:g.perfects,reflects:g.reflects,bestChain:g.bestChain,shards:g.shards.slice(),powers:g.powers,surges:g.surges,gifts:g.gifts.slice(),refusals:g.refusals};}
}
function replay(inputs,ticks,seed=SEED,options={mode:'benchmark'}){
 if(!Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS||!Array.isArray(inputs)||inputs.length>24000)throw Error('Invalid replay size');let prev=-1,n=0;
 for(const v of inputs){if(!Array.isArray(v)||v.length!==2||!Number.isInteger(v[0])||!Number.isInteger(v[1])||v[0]<0||v[0]>=ticks||v[0]<prev||v[1]<0||v[1]>=ACTIONS.length)throw Error('Invalid replay input');n=v[0]===prev?n+1:1;if(n>8)throw Error('Too many inputs in a tick');prev=v[0];}
 const run=new Run(seed,options);let j=0;
 for(let i=0;i<ticks;i++){if(run.ended)throw Error('Replay continues after result');if(run.pendingStage)run.nextStage();while(j<inputs.length&&inputs[j][0]===i)run.input(inputs[j++][1]);run.step();}
 if(!run.ended)throw Error('Evaluation has not finished');return run.result();
}
return {VERSION,SEED,MAX_TICKS,DT,ACTIONS,JUMP_BUFFER_TICKS,DUCK_BUFFER_TICKS,COYOTE_TICKS,SHORT_JUMP_VELOCITY,HIT_WIDTH_SCALE,POWER_TICKS,CACHE_REACH,SURGE_TICKS,SURGE_SPEED,SURGE_FILL,VISIBLE_DISTANCE,REFLECT_SECONDS,REFLECT_REFUND,STAGGER_SECONDS,ESCAPE_SECONDS,CHAIN_TIERS,PERFECT_TICKS,NEAR_MISS_MARGIN,REWARD_POINTS,chainMult,gradeFor,sectorPar,rewardBoardKey,giftGate,giftForLane,giftCount,surgeDuration,Run,replay,generateEntities,totalChecks,scoreBps,formatScore,position,checkHeight,active,levelFor,baseSpeed,stageLength,stageStart,stageAt,CYCLE_LENGTH};
});
