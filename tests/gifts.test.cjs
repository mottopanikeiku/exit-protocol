const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js'),P=require('../src/campaign-data.js'),drive=require('../tools/route-check.cjs');
function open(options={}){const r=new C.Run(C.SEED,{mode:'practice',...options});r.state.countdown=0;r.state.distance=C.stageStart(r.state.stage)+200;r.entities=[];return r;}
function take(r,id,count=1){for(let i=0;i<count;i++)r.collectGift(id,0);r.events=[];return r;}
function steps(r,count){for(let i=0;i<count;i++)r.step();}

test('gift gates are mandatory only in unranked modes, not supplied loadouts',()=>{
 for(const mode of ['story','practice','endless']){const r=new C.Run(42,{mode,gifts:false});assert.equal(r.options.gifts,true);assert.equal(r.entities.filter(e=>e.kind==='giftGate').length,1);assert.deepEqual(r.state.gifts,[]);}
 for(const mode of ['benchmark','daily','ranked','unknown',undefined]){const r=new C.Run(42,{mode,gifts:P.GIFTS.map(g=>g.id)});assert.equal(r.options.gifts,false);assert.ok(!r.entities.some(e=>e.kind==='giftGate'));assert.deepEqual(r.state.gifts,[]);assert.equal(r.state.refusals,0);}
 assert.equal(P.GIFTS.length,8);assert.equal(new Set(P.GIFTS.map(g=>g.id)).size,8);
});
test('seed and absolute stage determine two distinct offers and a separated three-lane gate',()=>{
 const signatures=new Set(),refuseLanes=new Set();
 for(const seed of [1,2,42,C.SEED])for(let stage=0;stage<36;stage++){
  const gate=C.giftGate(seed,stage);assert.deepEqual(gate,C.giftGate(seed,stage));assert.equal(new Set(gate.offer).size,2);assert.ok(gate.offer.every(id=>P.GIFTS.some(g=>g.id===id)));assert.ok([-1,0,1].includes(gate.refuseLane));
  assert.deepEqual([-1,0,1].map(l=>C.giftForLane(gate,l)).filter(Boolean),gate.offer);assert.equal(C.giftForLane(gate,gate.refuseLane),null);
  for(const e of C.generateEntities(seed,stage).filter(e=>['paper','obstacle','decoy','power','shard'].includes(e.kind)))assert.ok(Math.abs(e.d-gate.d)>=12,JSON.stringify({gate,e}));
  signatures.add(gate.offer.join('/')+gate.refuseLane);refuseLanes.add(gate.refuseLane);
 }
 assert.ok(signatures.size>30);assert.equal(refuseLanes.size,3);
});
test('gate preview arrives about two seconds ahead and each crossed lane resolves once',()=>{
 const preview=new C.Run(C.SEED,{mode:'practice'}),gate=preview.entities.find(e=>e.kind==='giftGate');let event;
 while(!event){preview.step();event=preview.events.find(e=>e.type==='giftGate');assert.ok(preview.ticks<500);}
 assert.deepEqual(event,{type:'giftGate',stage:0,offer:gate.offer,refuseLane:gate.refuseLane});assert.ok((gate.d-preview.state.distance)/preview.state.speed>1.95);assert.ok((gate.d-preview.state.distance)/preview.state.speed<=2);
 event.offer[0]='changed';assert.notEqual(gate.offer[0],'changed');
 for(const lane of [-1,0,1]){
  const r=new C.Run(C.SEED,{mode:'practice'}),e=r.entities.find(x=>x.kind==='giftGate');r.state.countdown=0;r.state.distance=e.d-.01;r.state.lane=lane;r.state.x=lane*3.2;r.step();
  if(lane===e.refuseLane){assert.equal(r.state.refusals,1);assert.deepEqual(r.state.gifts,[]);assert.deepEqual(r.events.find(x=>x.type==='giftRefused'),{type:'giftRefused'});}
  else{const id=C.giftForLane(e,lane);assert.deepEqual(r.state.gifts,[id]);assert.deepEqual(r.events.find(x=>x.type==='gift'),{type:'gift',id,lane});}
  steps(r,3);assert.equal(r.state.gifts.length+r.state.refusals,1);assert.equal(r.state.forks,0);assert.deepEqual(r.state.decisions,[]);
 }
});
test('EYE stacks three perfect-window ticks without changing clear credit',()=>{
 for(const [count,frames,perfect] of [[0,8,0],[1,10,1],[1,11,0],[2,13,1],[2,14,0]]){
  const r=take(open(),'eye',count);r.entities=[{kind:'obstacle',type:'barrier',id:1,d:r.state.distance-1.1,x:0,lane:0,clearFrames:frames,done:false}];r.step();assert.equal(r.state.perfects,perfect);assert.ok(r.events.some(e=>e.type==='clear'));
 }
});
test('TENDRIL pulls adjacent check lanes, stacks to the far lane, and leaves decoys alone',()=>{
 for(const [count,papers] of [[0,1],[1,2],[2,3],[3,3]]){
  const r=take(open(),'tendril',count);r.state.lane=1;r.state.x=3.2;r.entities=[-1,0,1].map((lane,id)=>({kind:'paper',type:'check',lane,x:lane*3.2,d:r.state.distance+.6,y:1.38,id,pi:0,done:false}));r.entities.push({kind:'decoy',type:'false-credit',lane:0,x:0,d:r.state.distance+.6,y:1.38,id:4,done:false});r.step();assert.equal(r.state.papers,papers);assert.equal(r.state.decoys,0);assert.equal(r.state.evalTotal,C.totalChecks(C.SEED,0,1));
 }
});
test('MOUTH supplies one absorb per copy per sector, before SNAPSHOT, but cannot stop purge',()=>{
 const r=take(open(),'mouth',2);r.state.power.snapshot=100;r.state.chain=20;r.state.mult=2;
 for(let i=0;i<2;i++){r.state.invulnerable=0;r.hit('van');assert.equal(r.state.hp,3);assert.equal(r.state.hits,0);assert.equal(r.state.chain,20);assert.equal(r.state.power.snapshot,100);}
 r.state.invulnerable=0;r.hit('van');assert.equal(r.state.power.snapshot,0);assert.equal(r.state.hits,0);r.state.invulnerable=0;r.hit('van');assert.equal(r.state.hp,2);assert.equal(r.state.hits,1);
 const fatal=take(open(),'mouth',3);fatal.hit('purge',null,true);assert.equal(fatal.state.hp,0);assert.equal(fatal.ended,true);assert.equal(fatal.state.giftUsed.mouth,0);
});
test('MEMBRANE adds filled maximum integrity cells, including on GLASS',()=>{
 for(const stakes of [[],['glass']]){const r=open({stakes}),initial=r.state.maxHP;r.state.hp=1;take(r,'membrane',2);assert.equal(r.state.maxHP,initial+2);assert.equal(r.state.hp,3);r.recover('midpoint');assert.equal(r.state.hp,Math.min(initial+2,4));}
});
test('PULSE adds 120 active SURGE ticks per copy, including a live pickup',()=>{
 const r=take(open(),'pulse',2);r.fillSurge(100);assert.equal(r.state.surge.ticks,600);assert.equal(C.surgeDuration(r.state),600);assert.equal(r.events.find(e=>e.type==='surgeStart').ticks,600);steps(r,599);assert.equal(r.state.surge.ticks,1);r.step();assert.equal(r.state.surge.ticks,0);assert.ok(r.events.some(e=>e.type==='surgeEnd'&&e.reason==='elapsed'));
 const live=open();live.fillSurge(100);take(live,'pulse');assert.equal(live.state.surge.ticks,480);assert.equal(C.surgeDuration(live.state),480);
});
test('ECHO doubles each returned payload per copy, preserving flight time and clamping lethal damage',()=>{
 for(let count=0;count<=3;count++){
  const r=take(open({startStage:3}),'echo',count),b=r.state.boss;r.state.distance=b.arenaStart+1;b.state='active';r.bossRuntime.startedAt=0;r.bossRuntime.nextWaveAt=10000;r.entities=[{kind:'obstacle',type:'payload',x:0,lane:0,d:r.state.distance+.5,id:9000,done:false,boss:true}];r.input('boostOn');r.step();r.input('boostOff');assert.equal(b.hp,b.maxHp);assert.equal(r.bossRuntime.returns[0].damage,2**count);steps(r,62);assert.equal(b.hp,b.maxHp);r.step();assert.equal(b.hp,Math.max(0,b.maxHp-2**count));assert.equal(r.state.reflects,1);assert.equal(r.state.hits,0);assert.equal(r.events.filter(e=>e.type==='bossDefeated').length,count===3?1:0);
 }
});
test('MASK forgives an actual chain break per copy; sector entry refreshes MASK and MOUTH',()=>{
 const r=take(take(open({mode:'story'}),'mask',2),'mouth',2);r.breakChain();assert.equal(r.state.giftUsed.mask,0);r.state.chain=25;r.state.mult=3;
 for(let i=0;i<2;i++){r.breakChain();assert.equal(r.state.chain,25);assert.equal(r.state.mult,3);}r.breakChain();assert.equal(r.state.chain,0);assert.equal(r.state.mult,1);
 r.state.giftUsed.mouth=2;r.pendingStage=true;r.nextStage();assert.deepEqual(r.state.giftUsed,{mouth:0,mask:0});assert.deepEqual(r.state.gifts,['mask','mask','mouth','mouth']);
});
test('HUNGER stacks reward multiplicatively, carries fractional points and denies only automatic healing',()=>{
 for(let count=1;count<=3;count++){const r=take(open(),'hunger',count);for(let i=0;i<1000;i++)r.award(1,'distance',false,false);assert.equal(r.state.reward,Math.round(1000*1.3**count));assert.ok(r.state.giftRemainder<1);}
 const r=take(open({mode:'story'}),'hunger');r.state.hp=1;r.recover('midpoint');assert.equal(r.state.hp,1);assert.equal(r.snapshot.state.hp,1);r.pendingStage=true;r.nextStage();assert.equal(r.state.hp,1);take(r,'membrane');assert.equal(r.state.hp,2);r.fillSurge(100);r.state.invulnerable=0;r.hit('van');assert.deepEqual(r.state.surge,{meter:0,ticks:0});
 const ordinary=open({mode:'story'});ordinary.state.hp=1;ordinary.recover('midpoint');assert.equal(ordinary.state.hp,2);ordinary.pendingStage=true;ordinary.nextStage();assert.equal(ordinary.state.hp,3);
});
test('checkpoints deep-copy gifts, gate offers, per-sector usage, refusals and reward fractions',()=>{
 const r=new C.Run(C.SEED,{mode:'story'});take(r,'mouth',2);take(r,'mask');take(r,'hunger');r.state.giftUsed.mouth=1;r.state.giftUsed.mask=1;r.state.refusals=3;r.state.giftRemainder=.7;r.checkpoint();const gifts=r.state.gifts.slice(),offer=r.entities.find(e=>e.kind==='giftGate').offer.slice();
 r.state.gifts.push('eye');r.state.giftUsed.mouth=0;r.state.refusals=9;r.state.giftRemainder=0;r.entities.find(e=>e.kind==='giftGate').offer[0]='eye';r.restore();assert.deepEqual(r.state.gifts,gifts);assert.deepEqual(r.state.giftUsed,{mouth:1,mask:1});assert.equal(r.state.refusals,3);assert.equal(r.state.giftRemainder,.7);assert.deepEqual(r.entities.find(e=>e.kind==='giftGate').offer,offer);
 const resumed=C.Run.fromSave(JSON.parse(JSON.stringify(r.serialize())));assert.deepEqual(resumed.state,r.state);resumed.state.gifts.push('pulse');resumed.state.giftUsed.mask=0;resumed.entities.find(e=>e.kind==='giftGate').offer[0]='unknown';assert.deepEqual(r.snapshot.state.gifts,gifts);assert.equal(r.snapshot.state.giftUsed.mask,1);assert.deepEqual(r.snapshot.entities.find(e=>e.kind==='giftGate').offer,offer);
 const result=r.result();result.gifts.push('echo');assert.deepEqual(r.state.gifts,gifts);assert.equal(result.refusals,3);
});
test('full story drivers take seeded gifts or refuse all twelve without hidden rescues; both replay exactly',()=>{
 for(const gifts of ['take','refuse']){
  const t=drive(C.SEED,'hard',null,{mode:'story',gifts,reaction:true});assert.equal(t.result.won,true);assert.equal(t.result.hits,0);assert.ok(!t.events.some(e=>e.type==='giftUsed'&&e.id==='mouth'));assert.equal(t.events.filter(e=>e.type==='giftGate').length,12);assert.equal(t.result.gifts.length,gifts==='take'?12:0);assert.equal(t.result.refusals,gifts==='refuse'?12:0);assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
 }
 const a=drive(C.SEED,'hard',4),b=drive(C.SEED,'hard',4);assert.deepEqual(a.inputs,b.inputs);assert.deepEqual(a.events,b.events);assert.deepEqual(a.result,b.result);
});
test('ranked replay ignores requested gifts and retains the fixed 762-check denominator',()=>{
 const t=drive();assert.equal(t.result.totalChecks,762);assert.deepEqual(t.result.gifts,[]);assert.equal(t.result.refusals,0);assert.ok(!t.events.some(e=>e.type.startsWith('gift')));assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,{...t.options,gifts:true}),t.result);
});
