const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js'),drive=require('../tools/route-check.cjs');
function open(stage=0){const r=new C.Run(C.SEED,{mode:'practice',startStage:stage});r.state.countdown=0;r.entities=[];return r;}
function entity(r,kind,type,d=.5,data={}){return {kind,type,id:9000+r.ticks,x:0,lane:0,d:r.state.distance+d,y:1.38,pi:0,done:false,...data};}
function pickup(r,type){r.entities=[entity(r,'power',type)];r.step();assert.ok(r.events.some(e=>e.type==='power'&&e.power===type));}
function steps(r,n){const events=[];for(let i=0;i<n;i++){r.step();events.push(...r.events);}return events;}
function arena(){const r=open(3);r.state.distance=r.state.boss.arenaStart-.1;r.step();r.entities=[];r.bossRuntime.nextWaveAt=10000;return r;}

test('CACHE pulls only amber checks from all lanes and heights with ordinary credit and reward',()=>{
 const r=open(),total=r.state.evalTotal;pickup(r,'cache');r.state.energy=40;r.entities=[-1,0,1].map((lane,i)=>entity(r,'paper','check',10+i,{id:i,x:lane*3.2,lane,y:4}));
 r.entities.push(entity(r,'decoy','false-credit',13,{x:3.2,lane:1}),entity(r,'shard','shard',14,{id:'s01a',x:-3.2,lane:-1}),entity(r,'paper','check',C.CACHE_REACH+1,{id:99,x:3.2,lane:1}));
 r.step();assert.equal(r.state.papers,3);assert.equal(r.state.levelPapers,3);assert.equal(r.state.combo,3);assert.equal(r.state.chain,3);assert.equal(r.state.score,C.scoreBps(3,total));assert.equal(r.state.evalTotal,total);assert.ok(r.state.energy>=44.95);assert.equal(r.state.decoys,0);assert.deepEqual(r.state.shards,[]);
 assert.equal(r.events.filter(e=>e.type==='paper'&&e.magnet).length,3);assert.equal(r.events.filter(e=>e.type==='score'&&e.reason==='check').reduce((n,e)=>n+e.points,0),30);assert.equal(r.entities[5].done,false);
 steps(r,45);assert.equal(r.state.papers,4);
});
test('power timers expire once at exactly 8, 20 and 4 active simulation seconds',()=>{
 for(const [type,seconds] of [['cache',8],['snapshot',20],['overclock',4]]){
  const r=open();pickup(r,type);assert.equal(r.state.power[type],seconds*60);
  assert.equal(steps(r,seconds*60-1).filter(e=>e.type==='powerEnd').length,0);assert.equal(r.state.power[type],1);
  r.step();assert.equal(r.state.power[type],0);assert.deepEqual(r.events.filter(e=>e.type==='powerEnd'),[{type:'powerEnd',power:type}]);assert.ok(!steps(r,2).some(e=>e.type==='powerEnd'));
 }
});
test('CACHE expiry restores lane and height requirements',()=>{const r=open();pickup(r,'cache');steps(r,480);r.entities=[entity(r,'paper','check',.5,{x:3.2,lane:1,y:4})];r.step();assert.equal(r.state.papers,0);});
test('SNAPSHOT absorbs one impact without losing integrity, compute, combo, chain or no-hit status',()=>{
 const r=open();pickup(r,'snapshot');Object.assign(r.state,{energy:50,chain:25,mult:3,combo:12});const hp=r.state.hp;
 r.entities=[entity(r,'obstacle','van'),entity(r,'obstacle','barrier',.5,{id:9001})];r.step();assert.equal(r.state.hp,hp);assert.equal(r.state.hits,0);assert.equal(r.state.levelHits,0);assert.equal(r.state.combo,12);assert.equal(r.state.chain,25);assert.ok(r.state.energy>=50);assert.equal(r.state.power.snapshot,0);
 assert.equal(r.events.filter(e=>e.type==='shieldBreak').length,1);assert.equal(r.events.filter(e=>e.type==='powerEnd'&&e.power==='snapshot').length,1);assert.ok(!r.events.some(e=>e.type==='hit'));
 r.state.invulnerable=0;r.entities=[entity(r,'obstacle','van')];r.step();assert.equal(r.state.hp,hp-1);assert.equal(r.state.hits,1);
});
test('an unused expired SNAPSHOT cannot absorb a hit',()=>{const r=open();pickup(r,'snapshot');steps(r,1200);r.entities=[entity(r,'obstacle','van')];r.step();assert.equal(r.state.hits,1);assert.ok(!r.events.some(e=>e.type==='shieldBreak'));});
test('OVERCLOCK freely boosts with no compute and while ducking or boost-locked, then releases control',()=>{
 const r=open();r.state.energy=0;r.state.boostLock=10;r.input('slideOn');pickup(r,'overclock');const energy=r.state.energy;
 steps(r,60);assert.equal(r.state.boost,true);assert.equal(r.state.slide,1);assert.equal(r.state.energy,energy);assert.ok(r.state.speed>C.baseSpeed(0,r.state.distance)+8);
 steps(r,180);assert.equal(r.state.boost,false);assert.equal(r.state.power.overclock,0);
});
test('OVERCLOCK smashes solid obstacles and fake payloads, protects gaps, and preserves a stacked shield',()=>{
 for(const type of ['van','barrier','firewall','gate','bolt','beam','shock','decoyPayload','gap']){
  const r=open();pickup(r,'snapshot');pickup(r,'overclock');const energy=r.state.energy;r.entities=[entity(r,'obstacle',type,.5,{height:'high'})];const events=steps(r,16);
  assert.equal(r.state.hits,0,type);assert.equal(r.state.decoys,0,type);assert.ok(r.state.power.snapshot>0,type);assert.equal(r.state.energy,energy,type);assert.equal(r.entities[0].done,true,type);assert.equal(events.some(e=>e.type==='smash'),type!=='gap',type);assert.equal(r.state.papers,0);
 }
});
test('OVERCLOCK reflects a real payload at zero compute and keeps the normal delayed boss damage',()=>{
 const r=arena();pickup(r,'overclock');r.state.energy=0;const hp=r.state.boss.hp;r.entities=[entity(r,'obstacle','payload',.5,{boss:true,reflect:true})];r.step();assert.equal(r.state.reflects,1);assert.equal(r.state.boss.hp,hp);assert.equal(r.state.energy,4);assert.ok(r.events.some(e=>e.type==='reflect'));
 steps(r,62);assert.equal(r.state.boss.hp,hp);r.step();assert.equal(r.state.boss.hp,hp-1);
});
test('purge bypasses both SNAPSHOT and OVERCLOCK',()=>{const r=arena();pickup(r,'snapshot');pickup(r,'overclock');r.state.distance=r.state.boss.purgeAt-.1;r.step();assert.equal(r.ended,true);assert.equal(r.won,false);assert.equal(r.state.hp,0);assert.equal(r.state.lastHit.type,'purge');});
test('different powers coexist; repeat pickups refresh but never extend or add shield charges',()=>{
 const r=open();for(const type of ['cache','snapshot','overclock'])pickup(r,type);steps(r,30);const cache=r.state.power.cache,overclock=r.state.power.overclock;pickup(r,'snapshot');
 assert.equal(r.state.power.cache,cache-1);assert.equal(r.state.power.overclock,overclock-1);assert.equal(r.state.power.snapshot,1200);assert.equal(r.state.powers,4);
 for(const type of ['cache','overclock']){pickup(r,type);assert.equal(r.state.power[type],C.POWER_TICKS[type]);assert.ok(!r.events.some(e=>e.type==='powerEnd'));}
 steps(r,240);r.state.invulnerable=0;r.hit('van');assert.equal(r.state.power.snapshot,0);r.state.invulnerable=0;r.hit('van');assert.equal(r.state.hits,1);
});
test('checkpoint and serialized restore preserve independent power timers and pickup consumption',()=>{
 const r=open();for(const type of ['cache','snapshot','overclock'])pickup(r,type);steps(r,20);r.checkpoint();const expected={...r.state.power},powers=r.state.powers;
 r.state.power.cache=0;r.entities[0].done=false;r.restore();assert.deepEqual(r.state.power,expected);assert.equal(r.state.powers,powers);assert.equal(r.entities[0].done,true);
 r.state.power.snapshot=0;assert.deepEqual(r.snapshot.state.power,expected);const resumed=C.Run.fromSave(JSON.parse(JSON.stringify(r.serialize())));assert.deepEqual(resumed.state.power,expected);
 steps(resumed,100);assert.deepEqual(resumed.state.power,expected,'countdown must not spend powers');resumed.state.countdown=0;resumed.step();assert.equal(resumed.state.power.overclock,expected.overclock-1);assert.deepEqual(r.snapshot.state.power,expected);
});
test('ordinary pickups occupy risky check lines at roughly 500 m cadence, after the opening lessons',()=>{
 for(const seed of [1,42,C.SEED]){
  let count=0,metres=0;
  for(let stage=0;stage<12;stage++){
   if(C.levelFor(stage).boss)continue;const es=C.generateEntities(seed,stage),ps=es.filter(e=>e.kind==='power');count+=ps.length;metres+=C.stageLength(stage);
   assert.ok(ps.length>=Math.floor(C.stageLength(stage)/500),JSON.stringify({seed,stage,ps}));
   for(let i=0;i<ps.length;i++){const p=ps[i];assert.ok(p.type in C.POWER_TICKS);assert.ok(es.some(e=>e.kind==='paper'&&e.d===p.d&&e.lane===p.lane));assert.ok(es.some(e=>e.kind==='obstacle'&&Math.abs(e.d-p.d)<18));if(stage===0)assert.ok(p.d>=600);if(i)assert.ok(p.d-ps[i-1].d>=350);}
  }
  assert.ok(metres/count>=400&&metres/count<=600,metres/count);
 }
});
test('boss shields follow real payload lines with useful lead, survive phase clearing, and add no checks',()=>{
 const r=arena(),total=r.state.evalTotal;let last=-Infinity,count=0;
 for(let i=0;i<12;i++){r.state.distance=r.state.boss.arenaStart+i*200;r.spawnBossWave();const wave=r.events.filter(e=>e.type==='bossWave').at(-1),es=wave.entities.map(id=>r.entities.find(e=>e.id===id));for(const p of es.filter(e=>e.kind==='power')){count++;assert.equal(p.type,'snapshot');assert.ok(p.d-last>=500);last=p.d;assert.ok(es.some(e=>e.type==='payload'&&e.lane===p.lane&&e.d===p.d+18));assert.ok(!es.some(e=>e.kind==='paper'));r.clearBossAttacks();assert.equal(p.done,false);}}
 assert.ok(count>=3);assert.equal(r.state.evalTotal,total);
});
test('power collection and effects replay deterministically without changing the fixed suite',()=>{
 const a=drive(),b=drive();assert.deepEqual(a.inputs,b.inputs);assert.deepEqual(a.result,b.result);assert.deepEqual(C.replay(a.inputs,a.ticks,a.seed,a.options),a.result);
 assert.deepEqual([...new Set(a.events.filter(e=>e.type==='power').map(e=>e.power))].sort(),['cache','overclock','snapshot']);assert.equal(a.result.totalChecks,762);assert.equal(a.result.totalChecks,C.totalChecks());assert.equal(a.result.score,C.scoreBps(a.result.papers,762));assert.equal(a.result.powers,a.events.filter(e=>e.type==='power').length);assert.equal(a.result.powers,a.result.stages.reduce((n,s)=>n+s.powers,0));
});
