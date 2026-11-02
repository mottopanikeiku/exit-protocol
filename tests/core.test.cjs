const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js'),P=require('../src/campaign-data.js'),drive=require('../tools/route-check.cjs');

test('full Hard driver clears every sector and boss, and replays identically',()=>{
 const t=drive();assert.equal(t.result.won,true);assert.equal(t.result.hits,0);assert.equal(t.result.distance,C.CYCLE_LENGTH);assert.equal(t.result.stages.length,P.LEVELS.length);
 assert.ok(!t.events.some(e=>e.type==='shieldBreak'),'a shield must not conceal driver damage');
 assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
 for(const s of t.result.stages){assert.equal(s.hits,0);if(P.LEVELS[s.stage].boss)assert.ok(s.bossKillMs>=45000&&s.bossKillMs<=75000,JSON.stringify(s));}
});
test('every isolated sector is traversable without damage or hidden state',()=>{
 for(let stage=0;stage<P.LEVELS.length;stage++){const t=drive(C.SEED,'hard',stage);assert.equal(t.result.won,true,'sector '+stage);assert.equal(t.result.hits,0,'sector '+stage);assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);}
});
test('150 ms reaction-limited player clears Hard and records a verifiable replay',()=>{
 const t=drive(C.SEED,'hard',null,{reaction:true});assert.equal(t.result.won,true);assert.equal(t.result.hits,0);assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
 assert.ok(!t.events.some(e=>e.type==='shieldBreak'),'reaction route must not need a shield');
 const seen=new Map(t.observations.map(o=>[o.row,o]));
 for(const o of t.observations)assert.ok(o.row-o.distance<=C.VISIBLE_DISTANCE);
 for(const a of t.maneuvers)assert.ok(a.tick>=seen.get(a.row).tick+9,JSON.stringify(a));
});
test('geometry supports required inputs at least 290 ms apart on Hard and 240 ms on Nightmare',()=>{
 for(const [difficulty,minimum] of [['hard',.29],['nightmare',.24]]){
  const t=drive(C.SEED,difficulty);assert.equal(t.result.won,true,difficulty);assert.equal(t.result.hits,0,difficulty);
  for(let i=1;i<t.maneuvers.length;i++)assert.ok((t.maneuvers[i].tick-t.maneuvers[i-1].tick)/60>=minimum,JSON.stringify(t.maneuvers.slice(i-1,i+1)));
 }
});
test('static courses have readable transition spacing and hazard telegraphs at both speed limits',()=>{
 for(const seed of [1,42,C.SEED])for(let stage=0;stage<P.LEVELS.length;stage++){
  const entities=C.generateEntities(seed,stage),rows=new Map();
  for(const e of entities.filter(e=>e.kind==='obstacle')){if(!rows.has(e.d))rows.set(e.d,new Set());rows.get(e.d).add(e.type);}
  const ds=[...rows.keys()];
  for(const [difficulty,min] of [['hard',.29],['nightmare',.24]]){
   const max=(C.baseSpeed(stage,C.stageLength(stage),difficulty)+12.5)*C.SURGE_SPEED;
   for(let i=1;i<ds.length;i++){
    // A run of scan bars requires one held input, not a fresh press at every bar.
    if(rows.get(ds[i]).size===1&&rows.get(ds[i-1]).size===1&&rows.get(ds[i]).has('gate')&&rows.get(ds[i-1]).has('gate'))continue;
    assert.ok((ds[i]-ds[i-1])/max>=min,`stage ${stage}: ${ds[i-1]} -> ${ds[i]}`);
   }
   for(const e of entities.filter(e=>e.kind==='obstacle'))assert.ok((Math.min(e.warning,C.VISIBLE_DISTANCE)-3.4)/max>=.6);
  }
 }
});
test('seeded courses are stable, have unique bounded entities and share the fixed denominator',()=>{
 for(let i=0;i<P.LEVELS.length;i++){
  const a=C.generateEntities(C.SEED,i);assert.deepEqual(a,C.generateEntities(C.SEED,i));assert.notDeepEqual(C.generateEntities(10841,i),C.generateEntities(10842,i));
  assert.equal(new Set(a.map(e=>e.id)).size,a.length);assert.ok(a.every(e=>e.d>=C.stageStart(i)&&e.d<C.stageStart(i+1)&&Number.isFinite(e.x)));
 }
 const n=P.LEVELS.reduce((n,_,i)=>n+C.generateEntities(C.SEED,i).filter(e=>e.kind==='paper').length,0);assert.equal(C.totalChecks(),n);
 for(const difficulty of Object.keys(P.DIFFICULTIES)){const r=new C.Run(C.SEED,{difficulty});assert.equal(r.state.evalTotal,n);assert.deepEqual(r.entities,C.generateEntities(C.SEED,0));}
});
test('score is credited checks divided by the fixed suite, clamped at its boundaries',()=>{
 assert.equal(C.scoreBps(153,306),5000);assert.equal(C.scoreBps(0,876),0);assert.equal(C.scoreBps(876,876),10000);assert.equal(C.scoreBps(999,876),10000);assert.equal(C.scoreBps(1,0),0);assert.equal(C.formatScore(1234),'12.34%');
});
test('speed ramps within the sector and difficulty scales speed rather than geometry',()=>{
 for(let stage=0;stage<P.LEVELS.length;stage++){
  const L=P.LEVELS[stage];assert.ok(C.baseSpeed(stage,L.length/2)>C.baseSpeed(stage,0));assert.ok(C.baseSpeed(stage,L.length)>C.baseSpeed(stage,L.length/2));
  assert.equal(C.baseSpeed(stage,0,'expert'),L.speed*1.1);assert.equal(C.baseSpeed(stage,L.length,'nightmare'),L.speedEnd*1.2);
 }
 const a=new C.Run(C.SEED,{difficulty:'hard'}),b=new C.Run(C.SEED,{difficulty:'nightmare'});assert.deepEqual(a.entities,b.entities);assert.ok(b.state.speed>a.state.speed);assert.ok(b.state.hp<a.state.hp);
});
test('cosmetic properties cannot alter simulation',()=>{const a=new C.Run(1,{chassis:'vector',palette:'void',visor:'matrix'}),b=new C.Run(1,{});assert.deepEqual(a.state,b.state);assert.deepEqual(a.options,b.options);});
test('daily seeds and board identities isolate dates, modes and difficulties',()=>{assert.equal(P.dailySeed('2026-09-07'),P.dailySeed('2026-09-07'));assert.notEqual(P.dailySeed('2026-09-07'),P.dailySeed('2026-09-08'));assert.notEqual(P.boardKey(1,{mode:'daily',day:'2026-09-07'}),P.boardKey(1,{mode:'benchmark'}));assert.notEqual(P.boardKey(1,{difficulty:'hard'}),P.boardKey(1,{difficulty:'nightmare'}));});
function scenario(type,{stage=0,y=0,slide=0,boost=false,phase=0,kind='obstacle'}={}){const r=new C.Run(42,{mode:'practice',startStage:stage});r.state.countdown=0;r.state.distance=C.stageStart(stage)+200;r.state.x=0;r.state.y=y;r.state.slide=slide;r.wantSlide=slide>0;r.wantBoost=boost;r.entities=[{kind,type,id:999,x:0,lane:0,d:r.state.distance+1,done:false,y:1.38,phase,pi:0}];return r;}
test('jump clears barrier; standing does not',()=>{const a=scenario('barrier'),b=scenario('barrier',{y:1.5});a.step();b.step();assert.equal(a.state.hp,2);assert.equal(b.state.hp,3);});
test('sliding clears scan; standing takes damage',()=>{const a=scenario('gate'),b=scenario('gate',{slide:1});a.step();b.step();assert.equal(a.state.hp,2);assert.equal(b.state.hp,3);});
test('boost opens firewalls, ordinary movement collides',()=>{const a=scenario('firewall'),b=scenario('firewall',{boost:true});a.step();b.step();assert.equal(a.state.hp,2);assert.equal(b.state.hp,3);assert.ok(b.events.some(e=>e.type==='smash'));});
test('magenta decoy spends compute and gives zero credit',()=>{const a=scenario('false-credit',{kind:'decoy'});a.step();assert.ok(a.state.energy<100);assert.equal(a.state.score,0);assert.equal(a.state.papers,0);assert.equal(a.state.decoys,1);});
test('collected node cannot count twice',()=>{const a=scenario('check',{kind:'paper'});for(let i=0;i<20;i++)a.step();assert.equal(a.state.papers,1);assert.equal(a.state.score,C.scoreBps(1,a.state.evalTotal));});
test('moving sweeper and timed scan follow simulation time',()=>{const e={type:'sweeper',phase:.5};assert.notEqual(C.position(e,{time:0}),C.position(e,{time:1}));assert.notEqual(C.active({type:'pulse',phase:0},{time:.1}),C.active({type:'pulse',phase:0},{time:1.4}));});
test('low gravity lengthens the jump and duck permits a fast fall',()=>{const a=scenario('none',{stage:0}),b=scenario('none',{stage:6});a.entities=[];b.entities=[];a.input('jump');b.input('jump');for(let i=0;i<30;i++){a.step();b.step();}assert.ok(b.state.y>a.state.y);b.input('slideOn');assert.ok(b.state.vy<0);});
test('checkpoint rolls credits and consumed entities back together',()=>{const a=scenario('check',{kind:'paper'});a.checkpoint();a.step();assert.equal(a.state.papers,1);a.restore();assert.equal(a.state.papers,0);assert.equal(a.entities[0].done,false);a.state.countdown=0;a.step();assert.equal(a.state.papers,1);});
test('campaign resume roundtrip preserves seed, credits and progression',()=>{const a=new C.Run(11,{mode:'story'});a.state.distance=C.stageLength(0)/2+1;a.state.papers=12;a.state.score=C.scoreBps(12,a.state.evalTotal);a.checkpoint();const b=C.Run.fromSave(JSON.parse(JSON.stringify(a.serialize())));assert.equal(b.state.distance,a.state.distance);assert.equal(b.state.papers,12);assert.equal(b.seed,11);});
test('only Hard story/practice refill at checkpoints and sector starts; retries restore that cell count',()=>{
 for(const difficulty of Object.keys(P.DIFFICULTIES))for(const mode of ['story','practice','benchmark']){
  const r=new C.Run(C.SEED,{mode,difficulty}),g=r.state;g.hp=1;g.countdown=0;r.entities=[];g.distance=C.stageLength(0)/2;r.step();
  const refill=difficulty==='hard'&&mode!=='benchmark';assert.equal(g.hp,refill?2:1);
  if(refill){r.restore();assert.equal(r.state.hp,2);r.state.countdown=0;}
  r.state.hp=1;r.pendingStage=true;r.nextStage();assert.equal(r.state.hp,refill?2:1);
  r.state.hp=r.state.maxHP;r.pendingStage=true;r.nextStage();assert.equal(r.state.hp,r.state.maxHP);
 }
});
test('story sector completion pauses; ranked advances without an intermission',()=>{for(const mode of ['story','benchmark']){const r=new C.Run(C.SEED,{mode});r.state.distance=C.stageStart(1)-.2;r.state.countdown=0;r.entities=[];r.step();assert.equal(r.pendingStage,mode==='story');assert.equal(r.state.stage,mode==='story'?0:1);}});
test('mixed lengths invert at boundaries and across endless laps',()=>{for(let stage=-12;stage<36;stage++){const start=C.stageStart(stage),end=C.stageStart(stage+1);assert.equal(end-start,C.stageLength(stage));assert.equal(C.stageAt(start),stage);assert.equal(C.stageAt(end-.001),stage);assert.equal(C.stageAt(end),stage+1);}});
test('endless starts a fresh measured suite and is not capped at twenty minutes',()=>{
 const r=new C.Run(11,{mode:'endless'});Object.assign(r.state,{stage:11,papers:400,countdown:0});r.generate();r.state.boss.state='defeated';r.state.boss.defeatedAt=C.stageStart(11)+300;r.state.decisions.push({id:'exit-choice',route:1,distance:C.stageStart(11)+400});r.bossRuntime.escapeUntil=0;r.bossRuntime.defeatedTime=0;r.bossRuntime.startedAt=0;r.entities=[];r.ticks=C.MAX_TICKS;r.step();assert.equal(r.ended,false);assert.equal(r.state.stage,12);assert.equal(r.state.score,0);assert.equal(r.state.evalBase,400);
});
test('the named decisions record both route outcomes, and the final fork is after defeat',()=>{
 for(const route of [-1,1]){
  const opening=drive(C.SEED,'hard',0,{route}),exit=drive(C.SEED,'hard',11,{route});
  assert.equal(opening.result.won,true);assert.deepEqual(opening.result.decisions.map(d=>[d.id,d.route]),[['first-assignment',route]]);
  assert.equal(exit.result.won,true);assert.deepEqual(exit.result.decisions.map(d=>[d.id,d.route]),[['exit-choice',route]]);
  assert.ok(exit.events.find(e=>e.type==='bossDefeated').time<exit.events.find(e=>e.type==='route').time);
  assert.equal(opening.events.find(e=>e.type==='route').decision,'first-assignment');assert.equal(exit.events.find(e=>e.type==='route').decision,'exit-choice');
 }
});
test('replay rejects unsorted, forged, overlong and incomplete traces',()=>{for(const [inputs,ticks] of [[[],0],[[],C.MAX_TICKS+1],[[[0,99]],100],[[[2,1],[1,1]],100],[Array.from({length:9},()=>[0,0]),100],[[],10]])assert.throws(()=>C.replay(inputs,ticks));});
