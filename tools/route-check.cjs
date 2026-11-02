/* Deterministic external player. Uses public inputs only; never writes simulation state.
   Reaction mode sees only the rendered 120 m window; reactionTicks selects 0–30 ticks. */
const C=require('../src/benchmark-core.js');
function drive(seed=C.SEED,difficulty='hard',start=null,config={}){
 const options={mode:config.mode||(start===null?'benchmark':'practice'),difficulty,startStage:start||0,report:config.report===true,stakes:config.stakes};
 const r=new C.Run(seed,options),inputs=[],events=[],maneuvers=[],observations=[],queue=[],seen=new Set();
 const delay=Number.isInteger(config.reactionTicks)?Math.max(0,Math.min(30,config.reactionTicks)):config.reaction?9:0,minPressTicks=difficulty==='hard'?18:difficulty==='expert'?17:15,channelTicks={};
 // Fictional pilots use the same public controls and physics, never a scaled clock.
 const pilot=({trace:{caution:.09,detours:false,sprint:0},patch:{caution:0,detours:true,sprint:2},mica:{caution:0,detours:true,sprint:1}})[config.rival]||{caution:0,detours:true,sprint:0};
 let rowId=null,target=0,lastJump=-100,boost=false,slide=false,steeringUntil=0,nextPressTick=0,sprintOpportunity=0,sprintOpen=false,sprintSpent=false;
 const emit=(a,reason,row)=>{r.input(a);inputs.push([r.ticks,C.ACTIONS.indexOf(a)]);if(!a.endsWith('Off'))maneuvers.push({tick:r.ticks,time:r.state.time,distance:r.state.distance,action:a,reason,row});};
 const schedule=(a,reason,row)=>{
  const channel=a.replace(/On$|Off$/,''),off=a.endsWith('Off');
  const tick=Math.max(r.ticks+delay,off?(channelTicks[channel]||0)+1:nextPressTick);
  if(!off){nextPressTick=tick+minPressTicks;channelTicks[channel]=tick;}
  queue.push({tick,a,reason,row});return tick;
 };
 const flush=()=>{for(let i=0;i<queue.length;){const q=queue[i];if(q.tick<=r.ticks){emit(q.a,q.reason,q.row);queue.splice(i,1);}else i++;}};
 const observe=row=>{if(!seen.has(row)){seen.add(row);observations.push({tick:r.ticks,row,distance:r.state.distance,lead:(row-r.state.distance)/r.state.speed});}};
 const steer=(lane,row)=>{if(lane===r.state.lane||r.ticks<steeringUntil)return;const direction=lane>r.state.lane?'right':'left';for(let n=0;n<Math.abs(lane-r.state.lane);n++){const at=schedule(direction+'On','lane',row);queue.push({tick:at+1,a:direction+'Off',reason:'lane',row});steeringUntil=at+1;}};
 while(!r.ended&&r.ticks<C.MAX_TICKS){
  if(r.pendingStage){r.nextStage();rowId=null;}
  const g=r.state;
  if(g.countdown>0){r.step();for(const e of r.events)if(e.type==='giftGate')events.push({tick:r.ticks,time:g.time,distance:g.distance,stage:g.stage,...e});continue;}
  flush();
  const L=C.levelFor(g.stage),visible=r.entities.filter(e=>!e.done&&(e.kind==='obstacle'||e.kind==='decoy')&&e.d-g.distance<=C.VISIBLE_DISTANCE&&(!e.branch||e.branch===(g.route||-1)));
  const near=visible[0],lead=delay/60,caution=L.boss?0:pilot.caution,shards=pilot.detours?r.entities.filter(e=>!e.done&&e.kind==='shard'&&e.d-g.distance<=C.VISIBLE_DISTANCE&&!g.shards.includes(e.id)):[],powers=pilot.detours||L.boss?r.entities.filter(e=>!e.done&&e.kind==='power'&&e.d-g.distance<=C.VISIBLE_DISTANCE):[];
  const gate=r.entities.find(e=>!e.done&&e.kind==='giftGate'&&e.d-g.distance<=C.VISIBLE_DISTANCE);
  const detour=[...shards,...powers].find(e=>e.y<2&&e.d>g.distance&&(!e.branch||e.branch===g.route)&&(e.kind!=='power'||Math.abs(e.lane-g.lane)<=1)&&(e.d-g.distance)/g.speed<.65+lead&&(!near||(near.d-g.distance)/g.speed>.7));
  // Finish a committed pickup before choosing the next row. Instant reactions
  // otherwise steer away just outside its reach and miss the faster line.
  const committedPickup=powers.some(e=>Math.abs(e.x-g.x)<1.3&&e.d>=g.distance&&e.d-g.distance<g.speed*.15&&(!near||(near.d-e.d)/g.speed>.30));
  let duck=false,thrust=false;
  if(gate){target=config.gifts==='refuse'?gate.refuseLane:[-1,0,1].find(lane=>C.giftForLane(gate,lane)===gate.offer[0]);rowId=null;observe(gate.d);steer(target,gate.d);}
  else if(detour){target=detour.lane;rowId=null;observe(detour.d);steer(target,detour.d);}
  if(!gate&&near){
   const time=(near.d-g.distance)/g.speed,row=visible.filter(e=>Math.abs(e.d-near.d)<.1||near.kind==='decoy'&&e.d>=near.d&&e.d<=near.d+18),rowShard=shards.find(e=>Math.abs(e.d-near.d)<=6&&(!e.branch||e.branch===g.route)),rowPower=powers.find(e=>Math.abs(e.d-near.d)<=20);
   const nextPayload=visible.find(e=>e.type==='payload'&&e.d>near.d&&e.d-near.d<=45);
   if(!detour&&!committedPickup&&rowId!==near.d&&time<1.05+lead){
    rowId=near.d;let best=Infinity;
    for(const lane of [-1,0,1]){
     let cost=Math.abs(lane-g.lane)*.05-(rowShard?.lane===lane&&(lane===g.lane||time>(rowShard.y>2?.5:.35)+lead)?12:0)-(rowPower?.lane===lane&&Math.abs(lane-g.lane)<=1?.4:0)-(nextPayload?.lane===lane?1:0);
     for(const e of row){
      const predicted=e.type==='sweeper'?Math.sin((g.time+Math.max(0,time))*1.55+e.phase)*3.15:C.position(e,g),wide=e.type==='beam'||e.type==='shock';
      if(e.type==='fork'){
       const preferred=typeof config.route==='number'?config.route:config.route?.[e.decision]??(e.decision==='exit-choice'?1:shards.some(s=>s.branch===1&&s.d>e.d&&s.d<e.d+60)?1:-1);
       const centre=e.decision==='exit-choice'&&r.options.report;cost+=lane===0&&!centre?100:lane===preferred?0:10;continue;
      }
      if(wide||Math.abs(lane*3.2-predicted)<1.9){
       if(e.type==='payload')cost+=g.energy>=16?-20:100;
       else cost+=({van:100,car:100,lockdown:100,sweeper:100,bolt:100,decoyPayload:100,firewall:8,gate:3,pulse:3,crusher:3,gap:5,barrier:4,beam:4,shock:4})[e.type]??100;
      }
     }
     if(cost<best){best=cost;target=lane;}
    }
    observe(near.d);steer(target,near.d);
   }
   const aligned=row.filter(e=>e.type!=='fork'&&(e.type==='beam'||e.type==='shock'||Math.abs(C.position(e,g)-target*3.2)<1.9));
   // Release is planned with the same reaction lead as the press. Waiting until
   // after contact to decide wastes compute and starves later payload returns.
   thrust=aligned.some(e=>e.type==='firewall'||e.type==='payload'&&g.energy>=10)&&time<.24+lead&&time>lead-.12;
   duck=aligned.some(e=>['gate','pulse','crusher'].includes(e.type)||e.type==='beam'&&e.height==='high')&&(slide||time<(g.y>.18?.38:.09+.82/g.speed)+lead+caution)&&time>lead-.12;
   const jump=aligned.some(e=>['gap','barrier','shock'].includes(e.type)||e.type==='beam'&&e.height==='low'),gap=aligned.some(e=>e.type==='gap');
   const jumpLead=(rowShard&&rowShard.y>2?(L.gravity?.54:.36):.112+(gap?3.37:.82)/g.speed)+caution;
   const landingSoon=g.y<.06||g.vy<0&&g.y/-g.vy<lead+.1;
   if(jump&&time<jumpLead+lead&&time>.05&&landingSoon&&r.ticks-lastJump>30){
    if(slide){schedule('slideOff','stand',near.d);slide=false;}
    schedule('jump','jump',near.d);lastJump=r.ticks;
   }
  }
  const local=g.distance-C.stageStart(g.stage),clearRunway=local>4&&local<54,clearStraight=!L.boss&&local>C.stageLength(g.stage)/2&&(!near||near.d-g.distance>55),safeSprint=clearRunway||clearStraight;
  if(safeSprint&&!sprintOpen){sprintOpportunity++;sprintSpent=false;}sprintOpen=safeSprint;if(g.energy<=45)sprintSpent=true;
  if(pilot.sprint&&safeSprint&&!sprintSpent&&(sprintOpportunity-1)%pilot.sprint===0&&!duck&&g.energy>45)thrust=true;
  if(config.openingBoost>0&&clearRunway&&local<Math.min(54,config.openingBoost)&&!duck&&g.energy>45)thrust=true;
  if(duck!==slide){schedule(duck?'slideOn':'slideOff','duck',near?.d);slide=duck;}
  if(thrust!==boost){schedule(thrust?'boostOn':'boostOff','reflect/firewall',near?.d);boost=thrust;}
  flush();r.step();
  for(const e of r.events){
   if(['bossStart','bossWave','reflect','bossHit','bossPhase','bossDefeated','purge','decoyPayload','hit','route','checkpoint','sectorComplete','finish','nearMiss','perfect','chain','chainBreak','shard','power','powerEnd','shieldBreak','surgeStart','surgeEnd','giftGate','gift','giftRefused','giftUsed'].includes(e.type)||e.type==='paper'&&e.magnet||e.type==='score'&&e.reason!=='distance')events.push({tick:r.ticks,time:g.time,distance:g.distance,stage:g.stage,...e});
   if(e.type==='hit'&&config.debug)console.error({event:e,tick:r.ticks,distance:g.distance,stage:g.stage,lane:g.lane,x:g.x,y:g.y,slide:g.slide,energy:g.energy,speed:g.speed,near,target});
  }
 }
 return {result:r.result(),inputs,ticks:r.ticks,seed,options:r.options,events,maneuvers,observations};
}
if(require.main===module){
 console.log('SECTOR  DIFFICULTY  DRIVER    WON  HITS  TIME(s)  SCORE     BOSS(s)  REWARD    PAR       GRADE  SHARDS  PERFECT  POWERS  SURGES');
 const requireClear=(result,label)=>{if(!result.won||result.hits)throw Error(label+' did not clear without hits: '+JSON.stringify(result));};
 for(const gifts of ['take','refuse']){
 console.log('GIFT POLICY / '+gifts.toUpperCase());
 for(let stage=0;stage<12;stage++)for(const difficulty of ['hard','expert','nightmare'])for(const reaction of [false,true]){
  const trace=drive(C.SEED,difficulty,stage,{reaction,gifts}),{result}=trace,stats=result.stages[0],boss=stats?.bossKillMs;requireClear(result,`${gifts} ${stage+1} ${difficulty} ${reaction?'reaction':'full'}`);
  if(trace.events.some(e=>e.type==='giftUsed'&&e.id==='mouth'))throw Error('A MOUTH charge concealed sector driver damage');
  console.log(`${String(stage+1).padStart(2,'0')}      ${difficulty.padEnd(10)}  ${(reaction?'reaction':'full').padEnd(8)}  ${String(result.won).padEnd(5)}${String(result.hits).padEnd(6)}${(result.durationMs/1000).toFixed(2).padEnd(9)}${C.formatScore(result.score).padEnd(10)}${(boss==null?'-':(boss/1000).toFixed(2)).padEnd(9)}${String(result.reward).padEnd(10)}${String(stats?.par??'-').padEnd(10)}${(stats?.grade??'-').padEnd(7)}${String(result.shards.length).padEnd(8)}${String(result.perfects).padEnd(9)}${String(result.powers).padEnd(8)}${result.surges}`);
 }
 }
 for(const reaction of [false,true]){const t=drive(C.SEED,'hard',null,{reaction});requireClear(t.result,'Campaign');console.log(`CAMPAIGN ${reaction?'reaction':'full'}: ${JSON.stringify(t.result)}`);}
 for(let stage=0;stage<12;stage++){
  const t=drive(C.SEED,'hard',stage,{stakes:['glass']});requireClear(t.result,`GLASS sector ${stage+1}`);
  console.log(`GLASS ${String(stage+1).padStart(2,'0')}: clear / ${t.result.hits} hits / ${t.result.surges} SURGEs`);
 }
 for(const stakes of [['purgeclock'],['overspeed','glass','nosafety','purgeclock']])for(const stage of [3,7,11]){
  const label=stakes.length===1?'PURGE CLOCK':'ALL STAKES',t=drive(C.SEED,'hard',stage,{stakes,gifts:'refuse'});requireClear(t.result,`${label} sector ${stage+1}`);
  console.log(`${label} ${String(stage+1).padStart(2,'0')}: clear / ${t.result.hits} hits / ${t.result.reflects} reflects`);
 }
 for(const gifts of ['take','refuse'])for(const reaction of [false,true]){
  const t=drive(C.SEED,'hard',null,{mode:'story',gifts,reaction});requireClear(t.result,`GIFTS ${gifts}`);
  if(t.events.some(e=>e.type==='giftUsed'&&e.id==='mouth'))throw Error('A MOUTH charge concealed driver damage');
  if(t.result.gifts.length+t.result.refusals!==12||gifts==='refuse'&&t.result.refusals!==12)throw Error('Driver missed a gift gate');
  console.log(`GIFTS ${gifts} ${reaction?'reaction':'full'}: ${t.result.gifts.length} gifts / ${t.result.refusals} refusals / ${t.result.hits} hits`);
 }
}
module.exports=drive;
