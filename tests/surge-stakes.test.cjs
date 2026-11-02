const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js'),P=require('../src/campaign-data.js'),drive=require('../tools/route-check.cjs');
function open(options={}){const r=new C.Run(C.SEED,{mode:'practice',...options});r.state.countdown=0;r.entities=[];return r;}
function steps(r,n){const events=[];for(let i=0;i<n;i++){r.step();events.push(...r.events);}return events;}

test('SURGE charges only from clean clears, perfect bonuses, near misses and reflects',()=>{
 const r=open();
 for(const reason of ['check','shard','distance','smash','bossHit','bossDefeated','sectorClear','noHit'])r.award(1,reason,false);
 assert.deepEqual(r.state.surge,{meter:0,ticks:0});
 for(const [reason,charge] of Object.entries(C.SURGE_FILL)){const before=r.state.surge.meter;r.award(1,reason,false);assert.equal(r.state.surge.meter,before+charge);}
 assert.equal(r.state.surge.meter,71);r.award(1,'reflect',false);
 assert.deepEqual(r.state.surge,{meter:0,ticks:360});assert.equal(r.state.surges,1);assert.equal(r.state.levelSurges,1);
 assert.deepEqual(r.events.filter(e=>e.type==='surgeStart'),[{type:'surgeStart',surges:1,ticks:360}]);
 r.award(1,'reflect',false);assert.deepEqual(r.state.surge,{meter:0,ticks:360});assert.equal(r.state.surges,1);
});
test('SURGE lasts exactly 360 active ticks and countdowns/intermissions do not spend it',()=>{
 const r=open();r.fillSurge(100);r.state.countdown=1;steps(r,60);assert.equal(r.state.surge.ticks,360);
 r.pendingStage=true;const tick=r.ticks;steps(r,20);assert.equal(r.ticks,tick);assert.equal(r.state.surge.ticks,360);r.pendingStage=false;
 assert.ok(!steps(r,359).some(e=>e.type==='surgeEnd'));assert.equal(r.state.surge.ticks,1);
 r.step();assert.deepEqual(r.state.surge,{meter:0,ticks:0});assert.deepEqual(r.events.filter(e=>e.type==='surgeEnd'),[{type:'surgeEnd',reason:'elapsed'}]);assert.ok(!steps(r,2).some(e=>e.type==='surgeEnd'));
});
test('a damaging hit drains charge and ends SURGE once; shield and invulnerability preserve it',()=>{
 const r=open();r.fillSurge(55);r.hit('van');assert.deepEqual(r.state.surge,{meter:0,ticks:0});assert.ok(!r.events.some(e=>e.type==='surgeEnd'));
 r.fillSurge(100);r.hit('van');assert.equal(r.state.surge.ticks,360,'hit grace is not damage');
 r.state.invulnerable=0;r.state.power.snapshot=100;r.hit('van');assert.equal(r.state.surge.ticks,360,'shield is not damage');
 r.state.invulnerable=0;r.hit('van');assert.deepEqual(r.state.surge,{meter:0,ticks:0});assert.equal(r.events.filter(e=>e.type==='surgeEnd'&&e.reason==='hit').length,1);
});
test('SURGE doubles every reward category without changing chain multipliers or benchmark credit',()=>{
 for(const reason of [...Object.keys(C.REWARD_POINTS),'distance']){
  const a=open(),b=open();a.state.chain=b.state.chain=24;a.state.mult=b.state.mult=2;b.fillSurge(100);
  const clean=!['distance','bossHit','bossDefeated','sectorClear','noHit','perfect'].includes(reason),multiplied=reason!=='distance';
  a.award(10,reason,clean,multiplied);b.award(10,reason,clean,multiplied);
  assert.equal(b.state.reward,a.state.reward*2,reason);assert.equal(b.state.levelReward,a.state.levelReward*2,reason);assert.equal(a.state.chain,b.state.chain);assert.equal(a.state.mult,b.state.mult);
  assert.equal(b.events.at(-1).surge,2);assert.equal(b.events.at(-1).mult,multiplied?b.state.mult:1);assert.equal(b.state.papers,0);assert.equal(b.state.score,0);assert.equal(b.state.evalTotal,a.state.evalTotal);
 }
 const r=open();r.fillSurge(99);r.award(25,'clear');assert.equal(r.events.at(-1).points,50,'threshold action receives the lift');
});
test('SURGE and OVERSPEED multiply the speed target, including boost, without changing geometry',()=>{
 for(const stakes of [[],['overspeed']])for(const boost of [false,true]){
  const r=open({stakes}),scale=stakes.length?1.15:1,g=r.state;r.fillSurge(100);if(boost)r.input('boostOn');
  const before=g.speed,target=(C.baseSpeed(0,0)+(boost?10:0))*scale*1.04;r.step();assert.equal(g.speed,before+(target-before)*(1-Math.exp(-5*C.DT)));
 }
 const a=new C.Run(C.SEED,{mode:'practice'}),b=new C.Run(C.SEED,{mode:'practice',stakes:['overspeed']});assert.equal(b.state.speed,a.state.speed*1.15);assert.deepEqual(a.entities,b.entities);
});
test('checkpoint, repeated restore and serialized resume independently copy charge, duration and counts',()=>{
 for(const active of [false,true]){
  const r=open({mode:'story',stakes:['glass','overspeed']});r.fillSurge(active?100:71);if(active)steps(r,30);r.checkpoint();const expected={...r.state.surge},count=r.state.surges;
  r.state.surge.meter=3;r.state.surge.ticks=8;r.state.surges=9;r.restore();assert.deepEqual(r.state.surge,expected);assert.equal(r.state.surges,count);
  r.state.surge.meter=8;assert.deepEqual(r.snapshot.state.surge,expected);r.restore();assert.deepEqual(r.state.surge,expected);
  const resumed=C.Run.fromSave(JSON.parse(JSON.stringify(r.serialize())));assert.deepEqual(resumed.state.surge,expected);assert.equal(resumed.state.surges,count);assert.deepEqual(resumed.options.stakes,['overspeed','glass']);
  resumed.state.surge.ticks=2;assert.deepEqual(r.snapshot.state.surge,expected);
 }
});
test('STAKES metadata and normalization use canonical unique ids, with ranked and daily always clear',()=>{
 const ids=P.STAKES.map(s=>s.id);assert.deepEqual(ids,['overspeed','glass','nosafety','purgeclock']);assert.deepEqual(P.STAKES.map(s=>s.rtMultiplier),[1.4,2,1.3,1.5]);assert.ok(P.STAKES.every(s=>s.label&&s.description));
 for(const mode of ['story','practice','endless']){const input=['glass','unknown','purgeclock','glass','overspeed',null,'nosafety'],before=input.slice();assert.deepEqual(P.normalize({mode,stakes:input}).stakes,ids);assert.deepEqual(input,before);for(const stakes of [undefined,null,'glass',{},true])assert.deepEqual(P.normalize({mode,stakes}).stakes,[]);}
 for(const mode of ['benchmark','daily','ranked','unknown',undefined])assert.deepEqual(P.normalize({mode,stakes:ids}).stakes,[]);
 const r=new C.Run(42,{stakes:ids}),plain=new C.Run(42);assert.deepEqual(r.state,plain.state);assert.deepEqual(r.options,plain.options);
});
test('GLASS caps integrity at one through midpoint, phase, sector and restored checkpoints',()=>{
 for(const difficulty of ['hard','expert','nightmare']){
  const r=open({mode:'story',difficulty,stakes:['glass']});assert.equal(r.state.hp,1);assert.equal(r.state.maxHP,1);
  for(const reason of ['midpoint','boss-arena','boss-phase']){r.recover(reason);assert.equal(r.state.hp,1);}
  r.pendingStage=true;r.nextStage();assert.equal(r.state.hp,1);r.restore();assert.equal(r.state.hp,1);r.state.invulnerable=0;r.hit('van');assert.equal(r.ended,true);assert.equal(r.won,false);
 }
});
test('NO SAFETY removes ordinary and boss power-ups, never checks or hazards',()=>{
 for(let stage=0;stage<12;stage++){
  const a=new C.Run(C.SEED,{mode:'practice',startStage:stage}),b=new C.Run(C.SEED,{mode:'practice',startStage:stage,stakes:['nosafety']});assert.deepEqual(b.entities,a.entities.filter(e=>e.kind!=='power'));assert.equal(b.state.evalTotal,a.state.evalTotal);assert.equal(b.state.levelTotal,a.state.levelTotal);
  if(b.state.boss){b.state.distance=b.state.boss.arenaStart+400;b.state.speed=50;for(let i=0;i<12;i++){b.spawnBossWave();b.state.distance+=400;}assert.ok(!b.entities.some(e=>e.kind==='power'));}
 }
});
test('PURGE CLOCK removes a quarter of the arena-to-purge distance and remains lethal',()=>{
 for(const stage of [3,7,11]){
  const a=new C.Run(C.SEED,{mode:'practice',startStage:stage}),b=open({startStage:stage,stakes:['purgeclock']}),normal=a.state.boss,fast=b.state.boss;
  assert.equal(fast.arenaStart,normal.arenaStart);assert.equal(fast.purgeAt-fast.arenaStart,(normal.purgeAt-normal.arenaStart)*.75);b.state.distance=fast.purgeAt;b.state.power.snapshot=100;b.state.power.overclock=100;b.step();assert.equal(b.state.lastHit.type,'purge');assert.equal(b.ended,true);
 }
});
test('PURGE CLOCK offers the full reflect set before its earlier line on every Hard boss',()=>{
 for(const stage of [3,7,11]){
  const t=drive(C.SEED,'hard',stage,{stakes:['purgeclock'],gifts:'refuse'}),hp=P.BOSSES[P.LEVELS[stage].id].hp;
  assert.equal(t.result.won,true,'sector '+stage);assert.equal(t.result.hits,0,'sector '+stage);assert.equal(t.result.reflects,hp);assert.ok(!t.events.some(e=>e.type==='shieldBreak'));assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
  const normal=open({startStage:stage}),fast=open({startStage:stage,stakes:['purgeclock']});normal.spawnBossWave();fast.spawnBossWave();assert.equal(fast.bossRuntime.nextWaveAt,normal.bossRuntime.nextWaveAt*P.BOSSES[P.LEVELS[stage].id].purgeWaveScale);
 }
});
test('all four STAKES stack into a winnable Hard boss run with no power-ups or spare integrity',()=>{
 const stakes=P.STAKES.map(s=>s.id);
 for(const stage of [3,7,11]){
  const t=drive(C.SEED,'hard',stage,{stakes,gifts:'refuse'});assert.equal(t.result.won,true,'sector '+stage);assert.equal(t.result.hits,0,'sector '+stage);assert.equal(t.result.reflects,P.BOSSES[P.LEVELS[stage].id].hp);assert.equal(t.result.powers,0);assert.equal(t.result.stages[0].hp,1);assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
  const r=open({mode:'story',stakes});r.state.stage=stage;r.generate();r.spawnBossWave();r.checkpoint();const resumed=C.Run.fromSave(JSON.parse(JSON.stringify(r.serialize())));r.restore();r.spawnBossWave();resumed.spawnBossWave();assert.deepEqual(resumed.bossRuntime,r.bossRuntime);assert.deepEqual(resumed.entities,r.entities);
 }
});
test('STAKES result is an independent array and every combination preserves both suite denominators',()=>{
 const ids=P.STAKES.map(s=>s.id);
 for(let bits=0;bits<16;bits++)for(let stage=0;stage<12;stage++){
  const stakes=ids.filter((_,i)=>bits&(1<<i)),r=open({startStage:stage,stakes}),total=C.totalChecks(C.SEED,stage,1);assert.equal(r.state.evalTotal,total);assert.equal(r.state.levelTotal,total);r.fillSurge(100);steps(r,5);assert.equal(r.state.evalTotal,total);assert.equal(r.state.levelTotal,total);assert.equal(r.result().totalChecks,total);assert.deepEqual(r.result().stakes,stakes);
  const result=r.result();result.stakes.push('unknown');assert.deepEqual(r.options.stakes,stakes);
 }
});
test('Hard GLASS driver clears every practice sector without hits or shield rescues and replay records stakes',()=>{
 for(let stage=0;stage<12;stage++){const t=drive(C.SEED,'hard',stage,{stakes:['glass']});assert.equal(t.result.won,true,'sector '+stage);assert.equal(t.result.hits,0,'sector '+stage);assert.ok(!t.events.some(e=>e.type==='shieldBreak'),'sector '+stage);assert.deepEqual(t.result.stakes,['glass']);assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);}
});
test('SURGE events, rewards and counts are deterministic, replay-verified and tuned for sector cadence',()=>{
 const a=drive(),b=drive();assert.deepEqual(a.inputs,b.inputs);assert.deepEqual(a.result,b.result);assert.deepEqual(a.events,b.events);assert.deepEqual(C.replay(a.inputs,a.ticks,a.seed,a.options),a.result);
 const starts=a.events.filter(e=>e.type==='surgeStart');assert.equal(a.result.surges,starts.length);assert.equal(a.result.surges,a.result.stages.reduce((n,s)=>n+s.surges,0));assert.equal(a.result.totalChecks,762);assert.equal(a.result.score,C.scoreBps(a.result.papers,762));
 const normal=a.result.stages.filter(s=>!P.LEVELS[s.stage].boss),boss=a.result.stages.filter(s=>P.LEVELS[s.stage].boss);assert.ok(normal.reduce((n,s)=>n+s.surges,0)>=normal.length*.8);assert.ok(normal.reduce((n,s)=>n+s.surges,0)<=normal.length*1.6);assert.ok(boss.every(s=>s.surges>=2&&s.surges<=4));
 for(const end of a.events.filter(e=>e.type==='surgeEnd'&&e.reason==='elapsed')){const start=starts.findLast(e=>e.tick<end.tick);assert.equal(end.tick-start.tick,360);}
});
