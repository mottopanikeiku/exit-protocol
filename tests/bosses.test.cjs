const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js'),P=require('../src/campaign-data.js'),drive=require('../tools/route-check.cjs');
function arena(stage=3,options={}){
 const r=new C.Run(C.SEED,{mode:'practice',startStage:stage,...options});
 if(r.state.stage!==stage){r.state.stage=stage;r.generate();}
 r.state.countdown=0;r.entities=[];r.state.distance=r.state.boss.arenaStart-.1;r.step();r.entities=[];r.bossRuntime.nextWaveAt=r.state.time+10000;return r;
}
function impact(type,boost=false,data={}){
 const r=arena();r.state.energy=50;r.input(boost?'boostOn':'boostOff');r.entities=[{kind:'obstacle',type,x:0,lane:0,d:r.state.distance+.5,id:9000,done:false,boss:true,launchD:r.state.distance-100,...data}];return r;
}
function advance(r,n){for(let i=0;i<n;i++)r.step();}

test('payload reflection refunds compute but damages the boss only after the return flight',()=>{
 const r=impact('payload',true,{reflect:true}),hp=r.state.boss.hp;r.step();const reflectedAt=r.state.time;
 assert.equal(r.state.hits,0);assert.equal(r.state.boss.hp,hp);assert.ok(r.events.some(e=>e.type==='reflect'&&e.entity.id===9000));assert.ok(r.state.energy>50);assert.ok(!r.events.some(e=>e.type==='bossHit'));
 r.input('boostOff');advance(r,Math.round(C.REFLECT_SECONDS*60)-1);assert.equal(r.state.boss.hp,hp);r.step();
 assert.equal(r.state.boss.hp,hp-1);assert.ok(r.state.time-reflectedAt>=C.REFLECT_SECONDS-1e-8);assert.deepEqual(r.events.find(e=>e.type==='bossHit'),{type:'bossHit',hp:hp-1,maxHp:hp});
});
test('standing in a payload hurts; bolts cannot be reflected even while boosting',()=>{
 for(const [type,boost] of [['payload',false],['bolt',true]]){const r=impact(type,boost),hp=r.state.boss.hp;r.step();assert.equal(r.state.hits,1);assert.equal(r.state.boss.hp,hp);assert.ok(r.events.some(e=>e.type==='hit'&&e.obstacle===type));assert.ok(!r.events.some(e=>e.type==='reflect'));assert.equal(r.bossRuntime.returns.length,0);}
});
test('decoy payload consumes compute on boost, gives no credit, and hurts a standing player',()=>{
 const r=impact('decoyPayload',true),total=r.state.evalTotal;r.step();assert.ok(r.state.energy<=15);assert.equal(r.state.hits,0);assert.equal(r.state.papers,0);assert.equal(r.state.evalTotal,total);assert.equal(r.state.boss.hp,r.state.boss.maxHp);assert.ok(r.events.some(e=>e.type==='decoyPayload'&&e.entity.id===9000));
 const standing=impact('decoyPayload');standing.step();assert.equal(standing.state.hits,1);
});
test('beam and shock collisions cover all lanes and require the advertised vertical action',()=>{
 for(const [type,height,action] of [['beam','high','slideOn'],['beam','low','jump'],['shock',undefined,'jump']]){
  const r=impact(type,false,{height}),bad=impact(type,false,{height});r.state.x=bad.state.x=3.2;r.state.lane=bad.state.lane=1;
  if(action==='jump'){r.state.y=1.5;r.state.vy=0;}else r.input(action);
  r.step();bad.step();assert.equal(r.state.hits,0,type+'/'+height);assert.equal(bad.state.hits,1,type+'/'+height);
 }
});
test('purge is lethal even with full integrity and invulnerability, and emits finish after purge',()=>{
 const r=arena();r.state.distance=r.state.boss.purgeAt-.1;r.state.invulnerable=10;r.step();assert.equal(r.ended,true);assert.equal(r.won,false);assert.equal(r.state.hp,0);assert.equal(r.state.boss.state,'purge');assert.equal(r.state.lastHit.type,'purge');
 const purge=r.events.findIndex(e=>e.type==='purge'),finish=r.events.findIndex(e=>e.type==='finish');assert.ok(purge>=0&&finish>purge);assert.equal(r.events[finish].won,false);
});
test('phase threshold starts a two-second stagger that clears attacks and spawns nothing',()=>{
 const r=arena(),b=r.state.boss;b.hp=b.maxHp/2+1;r.bossRuntime.nextWaveAt=r.state.time;r.bossRuntime.returns.push({at:r.state.time,entity:9000});r.entities=[{kind:'obstacle',type:'bolt',boss:true,d:r.state.distance+40,id:9,done:false}];r.step();
 assert.equal(b.state,'stagger');assert.equal(b.phase,1);assert.ok(r.events.some(e=>e.type==='bossPhase'&&e.name===b.phaseName));assert.equal(r.entities[0].done,true);
 for(let i=0;i<Math.floor(C.STAGGER_SECONDS*60)-1;i++){r.step();assert.equal(b.state,'stagger');assert.ok(!r.events.some(e=>e.type==='bossWave'));}
 advance(r,2);assert.equal(b.state,'active');assert.ok(r.entities.some(e=>e.boss&&!e.done));
});
test('checkpoint and restore independently copy boss state, returns, decisions and entity branches',()=>{
 const r=arena();r.state.decisions.push({id:'first-assignment',route:-1,distance:356});r.bossRuntime.returns.push({at:r.state.time+C.REFLECT_SECONDS,entity:9000});r.entities=[{kind:'paper',id:77,branchHeights:{left:.8,right:2.5},done:false}];r.checkpoint();const hp=r.state.boss.hp,at=r.bossRuntime.returns[0].at;
 r.state.boss.hp=1;r.bossRuntime.returns[0].at=999;r.state.decisions[0].route=1;r.entities[0].branchHeights.left=9;r.restore();assert.equal(r.state.boss.hp,hp);assert.equal(r.bossRuntime.returns[0].at,at);assert.equal(r.state.decisions[0].route,-1);assert.equal(r.entities[0].branchHeights.left,.8);
 r.state.boss.hp=2;r.bossRuntime.returns[0].at=88;r.state.decisions[0].route=1;assert.equal(r.snapshot.state.boss.hp,hp);assert.equal(r.snapshot.bossRuntime.returns[0].at,at);assert.equal(r.snapshot.state.decisions[0].route,-1);
});
test('Hard story checkpoints arena and each phase; Expert does not gain phase checkpoints',()=>{
 for(const difficulty of ['hard','expert']){
  const r=arena(3,{mode:'story',difficulty}),arenaSnapshot=r.snapshot.state.boss;
  if(difficulty==='hard'){assert.equal(arenaSnapshot.state,'active');assert.ok(r.events.some(e=>e.type==='checkpoint'&&e.reason==='boss-arena'));}
  r.state.hp=1;r.state.boss.hp=r.state.boss.maxHp/2+1;r.bossRuntime.returns.push({at:r.state.time,entity:1});r.step();
  if(difficulty==='hard'){assert.equal(r.snapshot.state.boss.phase,1);assert.equal(r.snapshot.state.boss.state,'stagger');assert.equal(r.state.hp,2);assert.ok(r.events.some(e=>e.type==='checkpoint'&&e.reason==='boss-phase'));r.restore();assert.equal(r.state.boss.phase,1);}
  else{assert.equal(r.snapshot.state.boss,arenaSnapshot);assert.equal(r.state.hp,1);}
 }
});
test('serialized mid-fight checkpoints preserve delayed damage on resumption',()=>{
 const r=impact('payload',true,{reflect:true});r.step();r.input('boostOff');r.checkpoint();const saved=JSON.parse(JSON.stringify(r.serialize())),restored=C.Run.fromSave(saved);
 r.restore();r.state.countdown=restored.state.countdown=0;advance(r,90);advance(restored,90);assert.deepEqual(restored.state,r.state);assert.deepEqual(restored.bossRuntime,r.bossRuntime);
});
test('boss death provides an escape beat, then uses the ordinary sector completion path',()=>{
 const r=arena();r.state.boss.hp=1;r.bossRuntime.returns.push({at:r.state.time,entity:1});r.step();const defeat=r.state.time;assert.equal(r.state.boss.state,'defeated');assert.ok(r.events.some(e=>e.type==='bossDefeated'));assert.equal(r.ended,false);
 while(r.state.time-defeat<C.ESCAPE_SECONDS-C.DT*2){r.step();assert.equal(r.ended,false);}
 advance(r,3);assert.equal(r.won,true);assert.equal(r.state.distance,C.stageStart(4));assert.equal(r.result().stages.length,1);assert.ok(r.events.some(e=>e.type==='sectorComplete'));
});
test('endless bosses recur with twenty-five percent more max HP per campaign loop',()=>{
 const r=new C.Run(C.SEED,{mode:'endless'});
 for(const stage of [3,7,11])for(const loop of [0,1,2]){r.state.stage=stage+12*loop;r.generate();const b=r.state.boss;assert.equal(b.loop,loop);assert.equal(b.maxHp,Math.ceil(P.BOSSES[b.id].hp*(1+.25*loop)));assert.equal(b.hp,b.maxHp);assert.equal(b.arenaStart,C.stageStart(r.state.stage)+P.BOSSES[b.id].arena);}
 r.state.stage=12;r.generate();assert.equal(r.state.boss,null);
});
test('the second endless cycle has enough reflect opportunities to beat its scaled bosses before purge',()=>{
 const t=drive(C.SEED,'hard',null,{mode:'endless',gifts:'refuse'});
 assert.equal(t.result.hits,0);assert.ok(!t.events.some(e=>e.type==='purge'));
 assert.deepEqual(t.events.filter(e=>e.type==='bossDefeated'&&e.boss.loop===1).map(e=>e.boss.id),['watchdog','reset-storm','exit-condition']);
});
test('JIT waves are replay-deterministic, have flight/telegraph lead, never add credit, and never chase',()=>{
 for(const difficulty of ['hard','nightmare'])for(const stage of [3,7,11]){
  const t=drive(C.SEED,difficulty,stage,{gifts:'refuse'}),r=new C.Run(t.seed,t.options),denominator=r.state.evalTotal;let i=0,waves=0;
  assert.ok(r.entities.filter(e=>e.kind==='paper').every(e=>e.d<r.state.boss.arenaStart));assert.ok(!r.entities.some(e=>e.decision==='exit-choice'));
  for(let tick=0;tick<t.ticks;tick++){
   while(i<t.inputs.length&&t.inputs[i][0]===tick)r.input(t.inputs[i++][1]);r.step();assert.equal(r.state.evalTotal,denominator);assert.equal(r.state.chasing,false);
   for(const event of r.events.filter(e=>e.type==='bossWave')){
    waves++;const spawned=event.entities.map(id=>r.entities.find(e=>e.id===id));assert.ok(spawned.every(e=>e.boss&&e.kind!=='paper'));
    const max=(C.baseSpeed(stage,C.stageLength(stage),difficulty)+10)*C.SURGE_SPEED;
    for(const e of spawned.filter(e=>e.kind==='obstacle')){
     assert.ok((Math.min(e.d-r.state.distance,C.VISIBLE_DISTANCE)-3.4)/max>=.6,JSON.stringify(e));
     if(['payload','decoyPayload','bolt'].includes(e.type))assert.ok((Math.min(e.d-e.launchD,C.VISIBLE_DISTANCE)-.82)/max>=.8,JSON.stringify(e));
    }
   }
  }
  assert.ok(waves>=P.BOSSES[P.LEVELS[stage].id].hp);assert.deepEqual(r.result(),t.result);
  const start=t.events.find(e=>e.type==='bossStart'),defeat=t.events.find(e=>e.type==='bossDefeated');assert.ok(defeat.boss.purgeAt-defeat.distance>5*C.baseSpeed(stage,0,difficulty));assert.ok(start.time<defeat.time);
 }
});
