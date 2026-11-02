/* PB RACE / RIVALS / quick bounties. Presentation only; Run/ranked ghosts untouched.
   PB samples: [active tick, local cm, x cm, y cm, pose flags], stride 5, 10 Hz.
   Rival samples come from tools/rivals.cjs (documented driver habits/late launches).
   Medals are lifetime, once per sector/rival, shared across difficulty/story/practice.
   Targets follow difficulty; gifts/stakes may help. Partial restored sectors never
   earn PBs or medals. Earned medals survive a quit; unclaimed RT/keys settle at results.
   RaceAPI exposes rivalStatus(stage,options?), pbStatus(stage,options?), goals(), archive().
   marginMs = playerMs - timeMs: positive means the player still needs to improve.
   Archive PB completion survives the 72-record ghost cache. Test observations: __race. */
const Race=(()=>{
 const KEY='exit-protocol-pb-v1',MEDAL_KEY='exit-protocol-rivals-v1',STRIDE=5,MAX_SAMPLES=12002,MAX_RECORDS=72;
 const rivals=[
  {id:'trace',name:'TRACE-19',medal:'bronze',color:0x73caff,rt:80,keys:1},
  {id:'patch',name:'PATCH-03',medal:'silver',color:0x88e5be,rt:160,keys:2},
  {id:'mica',name:'MICA-02',medal:'gold',color:0xffd586,rt:300,keys:4}
 ];
 const validMedal=id=>/^(?:[0-9]|1[01]):(?:trace|patch|mica)$/.test(id);
 let ledger={version:1,records:{},stages:[]},medalLedger={version:1,medals:{},paid:[],best:{}},storage=true,owner=null,sector=null,run=null,lastGhost=null,lastRivalGhost=null;
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.version===1&&saved.records&&typeof saved.records==='object'&&!Array.isArray(saved.records)){ledger.records=saved.records;ledger.stages=Array.isArray(saved.stages)?[...new Set(saved.stages.filter(n=>Number.isInteger(n)&&n>=0&&n<12))]:[];}}catch{}
 try{const saved=JSON.parse(localStorage.getItem(MEDAL_KEY)||'null');if(saved?.version===1){
  for(const [id,value] of Object.entries(saved.medals||{}))if(validMedal(id)&&Number.isInteger(value?.timeMs)&&value.timeMs>0&&Campaign.DIFFICULTIES[value.difficulty])medalLedger.medals[id]={timeMs:value.timeMs,difficulty:value.difficulty};
  medalLedger.paid=Array.isArray(saved.paid)?[...new Set(saved.paid.filter(id=>medalLedger.medals[id]))]:[];
  for(const [id,time] of Object.entries(saved.best||{}))if(/^(hard|expert|nightmare):(?:[0-9]|1[01])$/.test(id)&&Number.isInteger(time)&&time>0)medalLedger.best[id]=time;
 }}catch{}
 const hud=document.createElement('aside');hud.id='race-hud';hud.hidden=true;hud.setAttribute('aria-label','Personal best race and quick bounties');
 hud.innerHTML='<section id="race-bounties"><h2><span>BOUNTIES</span><b>0 / 3</b></h2><ol></ol><small>THIS RUN · RT + KEYS</small></section><section id="race-split" hidden><div><span id="race-split-label">PB RACE</span><b id="race-pb-stamp" hidden>NEW PB</b></div><strong id="race-split-time">SET A TIME</strong><small id="race-split-detail"></small></section><section id="race-rival" hidden><small>RIVAL TO BEAT</small><strong></strong><span></span></section>';
 document.body.append(hud);
 const list=hud.querySelector('ol'),count=hud.querySelector('h2 b'),split=$('race-split'),splitLabel=$('race-split-label'),splitTime=$('race-split-time'),splitDetail=$('race-split-detail'),stamp=$('race-pb-stamp');
 const rivalHUD=$('race-rival'),rivalLabel=rivalHUD.querySelector('small'),rivalName=rivalHUD.querySelector('strong'),rivalTime=rivalHUD.querySelector('span');
 const sound=name=>{if(Sound.hasEffect?.(name))Sound.effect(name);};
 const clock=ms=>(ms/1000).toFixed(2)+' s',delta=ms=>(ms<0?'−':ms>0?'+':'±')+(Math.abs(ms)/1000).toFixed(2)+' s';
 const localTick=g=>Math.max(0,Math.round((g.time-g.levelStartTime)*60));
 const enabled=()=>campaignRun&&['story','practice'].includes(campaignRun.options.mode);
 const context=options=>options||(campaignRun&&status!=='title'?campaignRun.options:{mode:'practice',difficulty:progress.difficulty,stakes:[]});
 const keyFor=(stage,options=campaignRun.options,seed=campaignRun.seed)=>[Core.VERSION,seed,options.mode,options.difficulty,stage,(options.stakes||[]).join('+')||'none'].join(':');
 function recordFor(key,length){
  const r=ledger.records[key];if(!r||!Number.isInteger(r.time)||r.time<=0||r.time>Core.MAX_TICKS*1000/60||!Number.isInteger(r.mid)||r.mid<=0||r.mid>=r.time||!Array.isArray(r.samples)||r.samples.length<STRIDE*2||r.samples.length>MAX_SAMPLES*STRIDE||r.samples.length%STRIDE)return null;
  const a=r.samples;let tick=-1,d=-1;
  for(let i=0;i<a.length;i+=STRIDE){if(!Number.isInteger(a[i])||a[i]<=tick||!Number.isInteger(a[i+1])||a[i+1]<d||a[i+1]>length*100||!Number.isInteger(a[i+2])||Math.abs(a[i+2])>400||!Number.isInteger(a[i+3])||a[i+3]<0||a[i+3]>3000||!Number.isInteger(a[i+4])||a[i+4]<0||a[i+4]>3)return null;tick=a[i];d=a[i+1];}
  return a[0]===0&&a[1]===0&&a[a.length-4]===length*100&&Math.abs(tick*1000/60-r.time)<1?r:null;
 }
 function persist(){
  const keys=Object.keys(ledger.records).sort((a,b)=>(ledger.records[b]?.at||0)-(ledger.records[a]?.at||0));for(const key of keys.slice(MAX_RECORDS))delete ledger.records[key];
  try{localStorage.setItem(KEY,JSON.stringify(ledger));storage=true;}catch{storage=false;}
 }
 function persistMedals(){try{localStorage.setItem(MEDAL_KEY,JSON.stringify(medalLedger));}catch{storage=false;}}
 // Migrate existing PBs once without treating malformed saved tracks as completion.
 for(const key of Object.keys(ledger.records)){const stage=Number(key.split(':')[4]);if(Number.isInteger(stage)&&stage>=0&&stage<12&&recordFor(key,Core.stageLength(stage))&&!ledger.stages.includes(stage))ledger.stages.push(stage);}
 if(ledger.stages.length)persist();
 function rivalStatus(stage,options){
  const o=context(options),courses=RIVAL_DATA.courses[o.difficulty]||RIVAL_DATA.courses.hard,rows=courses[stage];
  if(!Number.isInteger(stage)||!rows)return {next:null,medals:[]};
  const playerMs=medalLedger.best[o.difficulty+':'+stage]??null;
  const medals=rivals.map((r,i)=>({id:stage+':'+r.id,name:r.name,medal:r.medal,earned:!!medalLedger.medals[stage+':'+r.id],timeMs:rows[i][0],playerMs:medalLedger.medals[stage+':'+r.id]?.timeMs??playerMs}));
  const index=medals.findIndex(m=>!m.earned),next=index<0?null:{id:medals[index].id,name:rivals[index].name,timeMs:rows[index][0],playerMs,marginMs:playerMs===null?null:playerMs-rows[index][0],stage};
  return {next,medals};
 }
 function pbStatus(stage,options){
  if(!Number.isInteger(stage)||stage<0||stage>11)return null;const o=context(options),r=recordFor(keyFor(stage,o,Core.SEED),Core.stageLength(stage));
  return r?{stage,timeMs:r.time,midMs:r.mid,mode:o.mode,difficulty:o.difficulty}:null;
 }
 function archive(){
  let next=null;for(const r of rivals){for(let stage=0;stage<12;stage++)if(!medalLedger.medals[stage+':'+r.id]){const m=rivalStatus(stage).medals.find(m=>m.id===stage+':'+r.id);next={stage,id:m.id,name:r.name,timeMs:m.timeMs};break;}if(next)break;}
  const stage=Array.from({length:12},(_,i)=>i).find(i=>!ledger.stages.includes(i));
  return {medals:{earned:Object.keys(medalLedger.medals).length,total:36,next},pbs:{earned:ledger.stages.length,total:12,next:stage===undefined?null:{stage,name:Core.levelFor(stage).name}}};
 }
 function goals(){
  const last=run?.races.at(-1),stage=last?.stage??sector?.stage??game.stage;let pb=null;
  if(last?.previous!=null)pb={stage:last.stage,previousMs:last.previous,currentMs:last.time,deltaMs:last.delta};
  else if(sector?.mid!==null&&sector?.previous)pb={stage:sector.stage,previousMs:sector.previous.mid,currentMs:sector.mid,deltaMs:sector.mid-sector.previous.mid,split:'midpoint'};
  return {pb,rival:enabled()?rivalStatus(stage).next:null,bounties:run?.bounties.map(({id,label,value,target,done})=>({id,label,value,target,done}))||[]};
 }
 function decodeRival(row){
  const bytes=atob(row[3]),samples=[],finalTick=Math.round((row[0]-row[1])*60/1000);let d=0,index=0;
  for(let i=0;i<bytes.length;){let step=bytes.charCodeAt(i++);if(step===255){step=bytes.charCodeAt(i)|(bytes.charCodeAt(i+1)<<8);i+=2;}d+=step;const x=bytes.charCodeAt(i++)-128,pose=bytes.charCodeAt(i++);
   samples.push(i===bytes.length?finalTick:index*RIVAL_DATA.step,d*25,Math.round(x*100/32),Math.round((pose&63)*100/16),(pose>>6)&3);index++;
  }
  return {time:row[0],launchMs:row[1],samples,cursor:0};
 }
 function chooseRival(stage){
  const current=rivalStatus(stage),index=current.medals.findIndex(m=>!m.earned);rivalHUD.hidden=false;
  if(index<0){rivalLabel.textContent='RIVAL MEDALS';rivalName.textContent='ALL MEDALS';rivalTime.textContent='3 / 3';rivalHUD.style.setProperty('--rival-color','#ffd586');return null;}
  const rival=rivals[index],row=RIVAL_DATA.courses[campaignRun.options.difficulty][stage],record=decodeRival(row[index]);
  rivalHUD.style.setProperty('--rival-color','#'+rival.color.toString(16));rivalLabel.textContent=record.launchMs?'LATE +'+clock(record.launchMs):'RIVAL TO BEAT';rivalName.textContent=rival.name;rivalTime.textContent=clock(record.time);
  rivalHUD.title=rival.name+' / '+rival.medal.toUpperCase()+' / '+(record.launchMs?'LATE START '+clock(record.launchMs):'DRIVER BOOST / LINE HABITS');
  return {index,...record};
 }
 function earnMedals(stage,time){
  const difficulty=campaignRun.options.difficulty,key=difficulty+':'+stage;medalLedger.best[key]=Math.min(medalLedger.best[key]??Infinity,time);
  const earned=[];for(let i=0;i<rivals.length;i++){const r=rivals[i],id=stage+':'+r.id,target=RIVAL_DATA.courses[difficulty][stage][i][0];if(time<target&&!medalLedger.medals[id]){medalLedger.medals[id]={timeMs:time,difficulty};earned.push({id,stage,name:r.name,medal:r.medal,timeMs:time,targetMs:target,rt:r.rt,keys:r.keys});}}
  persistMedals();return earned;
 }
 function settleMedals(){
  const medals=Object.keys(medalLedger.medals).filter(id=>!medalLedger.paid.includes(id)).map(id=>{const [stage,name]=id.split(':'),r=rivals.find(r=>r.id===name);return {id,stage:Number(stage),name:r.name,medal:r.medal,rt:r.rt,keys:r.keys};});
  if(!medals.length)return {medals,rt:0,keys:0};if(!Loop.grantRT||!Loop.grantKeys)return {medals:[],rt:0,keys:0};
  medalLedger.paid.push(...medals.map(m=>m.id));persistMedals();
  return {medals,rt:Loop.grantRT?.(medals.reduce((n,m)=>n+m.rt,0),'rivals')??0,keys:Loop.grantKeys?.(medals.reduce((n,m)=>n+m.keys,0),'rivals')??0};
 }
 function setSplit(label,text,detail,diff=null,isPB=false){
  splitLabel.textContent=label;splitTime.textContent=text;splitDetail.textContent=detail;stamp.hidden=!isPB;
  split.classList.toggle('ahead',diff!==null&&diff<0);split.classList.toggle('behind',diff!==null&&diff>0);split.classList.toggle('personal-best',isPB);
 }
 function startSector(reason){
  if(!enabled()){sector=null;split.hidden=true;rivalHUD.hidden=true;return;}
  const g=campaignRun.state,stage=g.stage,start=Core.stageStart(stage),length=Core.stageLength(stage),key=keyFor(stage),tick=localTick(g),distance=Math.max(0,g.distance-start);
  const previous=recordFor(key,length),eligible=distance<.01&&tick===0;
  sector={stage,start,length,key,previous,eligible,done:false,samples:[],lastTick:tick,lastDistance:distance,sampleTick:-6,mid:null,pbGhost:previous?{samples:previous.samples,cursor:0}:null,rival:chooseRival(stage)};
  if(eligible)capture(true);split.hidden=false;
  // A seamless story handoff keeps the end split readable before showing the next PB.
  if(reason==='stage'&&run?.splitUntil>g.time)return;
  setSplit('PB RACE / '+PAD(stage+1,2),previous?clock(previous.time):'SET A TIME',eligible?(previous?'VIOLET GHOST / YOUR BEST':'COMPLETE THIS SECTOR'):'RESTORED / NO NEW PB');
 }
 function capture(force=false){
  const s=sector;if(!s||s.done||s.stage!==campaignRun.state.stage)return;const g=campaignRun.state,tick=localTick(g),distance=clamp(g.distance-s.start,0,s.length),half=s.length/2;
  if(s.mid===null&&s.lastDistance<half&&distance>=half){
   const fraction=(half-s.lastDistance)/(distance-s.lastDistance);s.mid=Math.round(lerp(s.lastTick,tick,fraction)*1000/60);
   if(s.previous){const diff=s.mid-s.previous.mid;setSplit('MIDPOINT / '+PAD(s.stage+1,2),delta(diff),'AGAINST YOUR SECTOR BEST',diff);}
   else setSplit('MIDPOINT / '+PAD(s.stage+1,2),clock(s.mid),'FIRST SECTOR RECORDING');
   if(run)run.splitUntil=g.time+5;
  }
  if(s.eligible&&(force||tick-s.sampleTick>=6)&&tick>s.sampleTick){
   if(s.samples.length>=MAX_SAMPLES*STRIDE){s.eligible=false;s.samples.length=0;}
   else{s.samples.push(tick,Math.round(distance*100),Math.round(g.x*100),Math.round(Math.max(0,g.y)*100),(g.slide>0?1:0)|(g.boost?2:0));s.sampleTick=tick;}
  }
  s.lastTick=tick;s.lastDistance=distance;
 }
 function completeSector(stats){
  const s=sector;if(!s||s.done||stats.stage!==s.stage)return;capture(true);s.done=true;
  const time=stats.time,previous=s.previous?.time??null,diff=previous===null?null:time-previous,isPB=s.eligible&&s.mid!==null&&(previous===null||time<previous);
  if(isPB){ledger.records[s.key]={time,mid:s.mid,samples:s.samples,at:Date.now()};if(!ledger.stages.includes(s.stage))ledger.stages.push(s.stage);persist();sound('levelUp');}
  const medals=s.eligible?earnMedals(s.stage,time):[];
  run.races.push({stage:s.stage,time,previous,delta:diff,pb:isPB,eligible:s.eligible,medals});run.splitUntil=campaignRun.state.time+6;
  const medal=medals.at(-1);if(medal)sound('achievement');
  setSplit('SECTOR '+PAD(s.stage+1,2)+' / FINISH',diff===null?clock(time):delta(diff),medal?medal.medal.toUpperCase()+' / '+medal.name:isPB?(storage?'BEST '+clock(time):'BEST '+clock(time)+' / SESSION ONLY'):s.eligible?'TIME '+clock(time):'RESTORED / PB UNCHANGED',diff,isPB);
  Loop.refreshArchive?.();
 }
 // A goal can only be drawn when its content exists in the chosen run. Counts are
 // run-local, not inherited from a checkpoint or accumulated in attract mode.
 const catalog=[
  ['checks8',0,'paper',8,'Collect 8 checks'],['jumps3',0,'jump',3,'Jump 3 times'],['clears3',0,'clear',3,'Clear 3 hazards'],['distance300',0,'distance',300,'Run 300 m'],['chain10',0,'chain',10,'Chain 10 clean actions'],
  ['boost1',0,'boost',1,'Use boost'],['midpoint1',0,'checkpoint',1,'Reach a midpoint','midpoint'],['compute1',0,'coffee',1,'Collect compute','coffee'],['route1',0,'route',1,'Choose a fork','fork'],['reflect1',0,'reflect',1,'Reflect a payload','boss'],
  ['checks25',1,'paper',25,'Collect 25 checks'],['clears10',1,'clear',10,'Clear 10 hazards'],['shard1',1,'shard',1,'Collect a shard'],['perfect2',1,'perfect',2,'Land 2 perfects'],['near1',1,'nearMiss',1,'Make a near miss'],
  ['mult3',1,'mult',3,'Reach chain ×3'],['smash2',1,'smash',2,'Smash 2 hazards','smash'],['power1',1,'power',1,'Collect a power-up','power'],['surge1',1,'surgeStart',1,'Trigger SURGE','surge'],['reflect2',1,'reflect',2,'Reflect 2 payloads','boss'],
  ['checks50',2,'paper',50,'Collect 50 checks','checks50'],['mult5',2,'mult',5,'Reach chain ×5'],['shards2',2,'shard',2,'Collect 2 shards'],['perfect6',2,'perfect',6,'Land 6 perfects'],['near3',2,'nearMiss',3,'Make 3 near misses'],
  ['clean1',2,'cleanSector',1,'Finish a no-hit sector'],['gradeS',2,'gradeS',1,'Finish a sector with S'],['surge2',2,'surgeStart',2,'Trigger SURGE twice','surge'],['boss1',2,'bossDefeated',1,'Defeat a boss','boss'],['reflect3',2,'reflect',3,'Reflect 3 payloads','boss']
 ];
 function chooseBounties(){
  const options=campaignRun.options,practice=options.mode==='practice',g=campaignRun.state,content=campaignRun.entities;
  const boss=!practice||!!Core.levelFor(g.stage).boss;
  const available={boss,midpoint:!practice||!boss,coffee:!practice||content.some(e=>e.kind==='coffee'),fork:!practice||content.some(e=>e.type==='fork'),smash:!practice||content.filter(e=>['firewall','crate','barrier'].includes(e.type)).length>=2,power:!options.stakes?.includes('nosafety')&&(!practice||boss||content.some(e=>e.kind==='power')),surge:!!g.surge,checks50:!practice||g.levelTotal>=50};
  let seed=campaignRun.seed^Date.now();for(const c of rankedId||'')seed=Math.imul(seed^c.charCodeAt(0),16777619);const random=rngSeed(seed),used=new Set(),chosen=[];
  for(let tier=0;tier<3;tier++){const pool=catalog.filter(b=>b[1]===tier&&!used.has(b[2])&&(!b[5]||available[b[5]]));const item=pool[Math.floor(random()*pool.length)];used.add(item[2]);chosen.push({id:item[0],tier,metric:item[2],target:item[3],label:item[4],value:-1,done:false,rt:[30,60,90][tier],keys:tier===2?2:1,flashUntil:0});}
  return chosen;
 }
 function begin(reason){
  owner=campaignRun;lastGhost=lastRivalGhost=null;sector=null;
  if(!campaignRun||loopDemo){run=null;hud.hidden=true;return;}
  const g=campaignRun.state;
  run={bounties:chooseBounties(),metrics:Object.create(null),origin:g.distance,introUntil:g.time+7,races:[],paid:false,payout:null,medalReceipt:null,splitUntil:0,completed:0,fresh:g.distance-Core.stageStart(g.stage)<.01};count.textContent='0 / 3';
  const short={paper:'CHECKS',jump:'JUMPS',clear:'CLEARS',distance:'METRES',chain:'CHAIN',boost:'BOOST',checkpoint:'MIDWAY',coffee:'COMPUTE',route:'FORK',reflect:'REFLECT',shard:'SHARDS',perfect:'PERFECT',nearMiss:'NEAR',mult:'CHAIN ×',smash:'SMASH',power:'POWER',surgeStart:'SURGE',cleanSector:'NO HIT',gradeS:'GRADE S',bossDefeated:'BOSS'};
  list.replaceChildren();for(const b of run.bounties){const li=document.createElement('li');li.innerHTML='<span class="race-tick" aria-hidden="true">□</span><span class="race-goal"></span><b></b>';const goal=li.querySelector('.race-goal');goal.textContent=b.label;goal.dataset.short=short[b.metric];li.title=b.label;b.element=li;b.counter=li.querySelector('b');b.tick=li.querySelector('.race-tick');list.append(li);}
  startSector(reason);refreshBounties();updateHUD();
 }
 function refreshBounties(){
  if(!run)return;const g=campaignRun.state,m=run.metrics;m.distance=Math.max(0,Math.floor(g.distance-run.origin));m.chain=Math.max(m.chain||0,g.chain||0);m.mult=Math.max(m.mult||0,g.mult||1);
  for(const b of run.bounties){const value=Math.min(b.target,m[b.metric]||0);if(value!==b.value){b.value=value;b.counter.textContent=value+'/'+b.target;}
   if(!b.done&&value>=b.target){b.done=true;b.flashUntil=g.time+1.2;b.element.classList.add('complete');b.tick.textContent='✓';count.textContent=++run.completed+' / 3';sound('ticket');}
   b.element.classList.toggle('just-completed',b.done&&g.time<b.flashUntil);
  }
 }
 function event(e){
  if(!run||owner!==campaignRun||loopDemo)return;const m=run.metrics;
  if(['paper','jump','clear','boost','checkpoint','coffee','route','reflect','shard','perfect','nearMiss','smash','power','surgeStart','bossDefeated'].includes(e.type))m[e.type]=(m[e.type]||0)+1;
  if(e.type==='sectorComplete'){
   if(run.fresh){if(e.stats.hits===0)m.cleanSector=(m.cleanSector||0)+1;if(['S','SS'].includes(e.stats.grade))m.gradeS=(m.gradeS||0)+1;}
   completeSector(e.stats);
  }
  refreshBounties();
 }
 function layoutHUD(){
  if(hud.hidden)return;const portrait=innerWidth<=760,base=portrait?innerHeight*.38+8:innerHeight<=650?190:146,panel=$('phase-panel');
  let top=base;if(panel.classList.contains('compact')&&!panel.classList.contains('hidden')){
   const rect=panel.getBoundingClientRect(),height=portrait?110:hud.offsetHeight;
   if(rect.left<innerWidth*.2&&rect.bottom>base&&rect.top<base+height)top=rect.bottom+8;
  }
  hud.style.setProperty(portrait?'--race-list-top':'--race-top',Math.ceil(top)+'px');
 }
 function updateHUD(){
  hud.hidden=!run||owner!==campaignRun||!!loopDemo||!['running','paused'].includes(status)||!!modalKind;
  if(hud.hidden)return;const g=campaignRun.state,introducing=g.time<run.introUntil;hud.classList.toggle('introducing',introducing);hud.classList.toggle('compact-list',!introducing||Object.values(g.power||{}).filter(n=>n>0).length>1);split.hidden=!sector;layoutHUD();
 }
 function frame(){
  if(!run||owner!==campaignRun||loopDemo)return;capture();refreshBounties();
  if(sector&&!sector.done&&run.splitUntil&&campaignRun.state.time>=run.splitUntil){run.splitUntil=0;setSplit('PB RACE / '+PAD(sector.stage+1,2),sector.previous?clock(sector.previous.time):'SET A TIME',sector.eligible?(sector.previous?'VIOLET GHOST / YOUR BEST':'COMPLETE THIS SECTOR'):'RESTORED / NO NEW PB');}
 }
 // Both ghosts share retained mesh primitives, but have independent poses/materials.
 const cloakMesh=renderer.mesh(new Builder().tri([-.38,2.37,-.25],[-.63,1.07,-.48],[.20,1.31,-.41]).tri([.20,1.31,-.41],[.21,2.37,-.25],[-.38,2.37,-.25]));
 function makeGhost(color){
  const root=new Node(),body=new Node(),arms=[],legs=[],knees=[],tint=rgb(color),white=0xeee6ff;root.snap=false;root.alpha=.42;root.add(body);
  body.add(part('box',tint,0,1.97,0,.64,.85,.38,2),part('box',white,0,2.31,0,.82,.13,.41,2),part('box',tint,0,1.45,0,.48,.27,.35,2),part('sphere',tint,0,2.77,0,.30,.34,.29,2),part('box',white,0,2.79,.29,.47,.07,.03,2),part('box',white,0,1.98,.205,.045,.61,.026,2));
  for(const side of [-1,1]){
   const arm=new Node().at(side*.44,2.27,0);arm.add(part('box',tint,0,-.33,0,.18,.65,.20,2),part('box',white,0,-.73,.08,.15,.26,.17,2));body.add(arm);arms.push(arm);
   const leg=new Node().at(side*.20,1.35,0),knee=new Node().at(0,-.64,0);leg.add(part('box',tint,0,-.31,0,.24,.61,.27,2),knee);knee.add(part('box',tint,0,-.28,0,.18,.56,.20,2),part('box',white,0,-.58,-.09,.24,.14,.40,2));body.add(leg);legs.push(leg);knees.push(knee);
  }
  const cloak=new Node(cloakMesh,tint,2);cloak.alpha=.6;body.add(cloak);
  const marker=part('ring',white,0,.045,0,1.05,1.05,1.05,2);marker.rx=Math.PI/2;marker.alpha=.6;root.add(marker);
  return {root,body,arms,legs,knees,tint};
 }
 const pbRig=makeGhost(0xa98bff),rivalRig=makeGhost(rivals[0].color),rivalTints=rivals.map(r=>rgb(r.color));
 const rivalLabels=rivals.map(r=>{const tag=textNode(labelTexture(r.name,r.medal.toUpperCase()+' RIVAL','#101b24','#'+r.color.toString(16)),0,0,0,2.5,.68);tag.snap=false;tag.alpha=.95;return tag;});
 let paintedRival=-1;
 function drawTrack(rig,record,elapsed,start,label=null){
  const launching=elapsed<(record.launchMs||0)*.06,tick=Math.max(0,elapsed-(record.launchMs||0)*.06),a=record.samples,last=a.length-STRIDE;if(tick>a[last]+30)return null;
  let i=record.cursor;while(i<last&&a[i+STRIDE]<tick)i+=STRIDE;while(i>0&&a[i]>tick)i-=STRIDE;record.cursor=i;
  const next=Math.min(last,i+STRIDE),q=next===i?0:clamp((tick-a[i])/(a[next]-a[i]),0,1),distance=lerp(a[i+1],a[next+1],q)/100+start,x=lerp(a[i+2],a[next+2],q)/100,y=lerp(a[i+3],a[next+3],q)/100,z=worldDistance-distance;
  if(z<-125||z>5.5)return null;const flags=a[q<.5?i+4:next+4],duck=!!(flags&1),quiet=reduced||renderer.style.reducedMotion,swing=quiet||launching||y>.2?0:Math.sin(distance*1.7)*.7;
  rig.root.at(x,y,z);rig.body.sy=duck?.52:1;rig.body.rx=duck?-.22:flags&2?-.13:-.05;
  for(let k=0;k<2;k++){const sign=k?1:-1;rig.arms[k].rx=-sign*swing-.2;rig.legs[k].rx=sign*swing;rig.knees[k].rx=Math.max(0,-sign*swing)*.9;}
  rig.root.alpha=clamp((125+z)/30,0,1)*.42;renderer.node(rig.root);
  if(label){label.at(x,y+(duck?2.2:3.7),z);renderer.node(label);}
  return {x,y,z,distance,tick,launching};
 }
 function draw(){
  lastGhost=lastRivalGhost=null;const s=sector;if(!s||!run||owner!==campaignRun||!enabled()||loopDemo||!['running','paused'].includes(status))return;
  const elapsed=Math.max(0,(game.time-game.levelStartTime)*60);renderer.gl.depthMask(false);
  if(s.pbGhost)lastGhost=drawTrack(pbRig,s.pbGhost,elapsed,s.start);
  if(s.rival){
   const index=s.rival.index;if(index!==paintedRival){visitNodes(rivalRig.root,n=>{if(n.color===rivalRig.tint)n.color=rivalTints[index];});rivalRig.tint=rivalTints[index];paintedRival=index;}
   lastRivalGhost=drawTrack(rivalRig,s.rival,elapsed,s.start,rivalLabels[index]);
   if(lastRivalGhost)lastRivalGhost.name=rivals[index].name;
  }
  renderer.gl.depthMask(true);
 }
 function result(){
  if(!run||owner!==campaignRun||loopDemo||!campaignRun.ended)return;
  if(!run.paid){
   const completed=run.bounties.filter(b=>b.done),rt=completed.reduce((n,b)=>n+b.rt,0),keys=completed.reduce((n,b)=>n+b.keys,0);run.paid=true;
   const paidRT=Loop.grantRT?.(rt,'bounties'),paidKeys=Loop.grantKeys?.(keys,'bounties');run.payout={rt:paidRT??0,keys:paidKeys??0,available:typeof Loop.grantRT==='function'&&typeof Loop.grantKeys==='function'};
   run.medalReceipt=settleMedals();if(run.medalReceipt.medals.length)sound('achievement');
  }
  let target=$('race-results');if(!target){target=document.createElement('section');target.id='race-results';const anchor=$('results-loop')||$('modal-content').querySelector('.primary');if(anchor)anchor.before(target);else $('modal-content').append(target);}
  const completed=run.bounties.filter(b=>b.done).length,pay=run.payout;
  target.innerHTML=`<header><h3>BOUNTIES <b>${completed} / 3</b></h3><strong>+${pay.rt} RT <span>◆ +${pay.keys} KEYS</span></strong></header><ul>${run.bounties.map(b=>`<li class="${b.done?'complete':'missed'}"><span aria-hidden="true">${b.done?'✓':'—'}</span><span>${htmlEscape(b.label)}</span><b>${b.done?'COMPLETE':b.value+' / '+b.target}</b></li>`).join('')}</ul>${pay.available?'':'<p class="race-storage-note">Reward ledger unavailable in this build.</p>'}${run.races.length?`<div class="race-result-splits"><h3>PB RACE <small>${campaignRun.options.difficulty.toUpperCase()} / ${campaignRun.options.mode.toUpperCase()}</small></h3>${run.races.map(r=>`<div><span>SECTOR ${PAD(r.stage+1,2)}</span><strong>${clock(r.time)}</strong><b class="${r.delta<0?'ahead':r.delta>0?'behind':''}">${r.delta===null?'FIRST TIME':delta(r.delta)}</b>${r.pb?'<em>NEW PB</em>':!r.eligible?'<small>RESTORED / NO PB</small>':''}</div>`).join('')}</div>`:''}${storage?'':'<p class="race-storage-note">Storage unavailable: personal bests last for this session only.</p>'}`;
  if(run.medalReceipt?.medals.length){
   const receipt=run.medalReceipt,section=document.createElement('section');section.id='race-medal-results';
   section.innerHTML=`<header><h3>RIVAL MEDALS <b>${receipt.medals.length} NEW</b></h3><strong>+${receipt.rt} RT <span>◆ +${receipt.keys} KEYS</span></strong></header><div class="race-medal-awards">${receipt.medals.map(m=>`<article class="race-medal ${m.medal}"><b>${m.medal.toUpperCase()}</b><strong>${m.name}</strong><small>SECTOR ${PAD(m.stage+1,2)} / BEATEN</small></article>`).join('')}</div>`;
   target.prepend(section);
  }
  updateHUD();Loop.refreshArchive?.();
 }
 // Reuse the single sector-message band rather than adding a second transient.
 const priorBanner=showBanner;
 showBanner=(tag,title,sub,duration=3,grade='')=>{
  const medal=grade&&tag.startsWith('SECTOR ')?run?.races.at(-1)?.medals.at(-1):null;
  priorBanner(medal?tag+' / '+medal.medal.toUpperCase()+' RIVAL MEDAL':tag,title,sub,duration,grade);
  $('chapter-banner').dataset.rivalMedal=medal?.medal||'';
 };
 function decoratePractice(){
  for(const card of document.querySelectorAll('[data-exp="practice"][data-sector]')){
   const stage=Number(card.dataset.sector),state=rivalStatus(stage,{mode:'practice',difficulty:progress.difficulty,stakes:[]}),row=document.createElement('div');row.className='race-map-medals';row.setAttribute('aria-label','Rival medals');
   row.innerHTML=state.medals.map(m=>`<span class="race-medal-mini ${m.medal} ${m.earned?'earned':'locked'}" title="${m.name} / ${m.earned?'BEATEN':'BEAT '+clock(m.timeMs)}"><b>${m.medal.toUpperCase()}</b><small>${m.name}</small><i>${m.earned?'WON':clock(m.timeMs)}</i></span>`).join('');
   card.querySelector('.race-map-medals')?.remove();card.append(row);
  }
 }
 const priorModal=showModal;showModal=(html,kind,wide=false)=>{priorModal(html,kind,wide);if(kind==='sectors')decoratePractice();};
 hook('reset',reason=>{
  if(reason==='title'){run=null;sector=null;owner=null;lastGhost=lastRivalGhost=null;hud.hidden=true;return;}
  if(reason==='stage'){if(run){run.fresh=true;startSector(reason);}return;}
  if(['launch','retry','resume'].includes(reason))begin(reason);
 });
 hook('event',event);hook('frame',frame);hook('hud',updateHUD);hook('draw',draw);
 const previousResult=Loop.result;Loop.result=value=>{previousResult(value);result();};
 const snapshot=()=>({active:!!run,storage,sector:sector&&{stage:sector.stage,eligible:sector.eligible,time:sector.previous?.time??null,mid:sector.mid,samples:sector.samples.length/STRIDE,key:sector.key},ghost:lastGhost&&{...lastGhost},rivalGhost:lastRivalGhost&&{...lastRivalGhost},rival:sector?rivalStatus(sector.stage):null,bounties:run?.bounties.map(({id,label,value,target,done,rt,keys})=>({id,label,value,target,done,rt,keys}))||[],races:run?.races.map(r=>({...r}))||[],paid:run?.paid||false,payout:run?.payout&&{...run.payout},medalReceipt:run?.medalReceipt,archive:archive()});
 const api={rivalStatus,pbStatus,goals,archive};globalThis.RaceAPI=Object.freeze(api);
 if(new URLSearchParams(location.search).get('test')==='1')window.__race={snapshot,...api};
 return {snapshot,...api};
})();
