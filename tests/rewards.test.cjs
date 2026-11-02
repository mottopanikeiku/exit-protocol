const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js'),P=require('../src/campaign-data.js'),drive=require('../tools/route-check.cjs');
function open(options={}){const r=new C.Run(42,{mode:'practice',...options});r.state.countdown=0;r.entities=[];return r;}
function hazard(r,type,x=0,d=20,data={}){const e={kind:'obstacle',type,id:9000,lane:0,x,d:r.state.distance+d,y:1.38,done:false,...data};r.entities=[e];return e;}
function pass(r,e){const events=[];for(let i=0;i<240&&!e.done;i++){r.step();events.push(...r.events);}return events;}

test('check actions cross the specified chain tiers without changing benchmark arithmetic',()=>{
 const r=open(),tiers=new Map([[10,2],[25,3],[50,4],[100,5],[150,6],[200,7],[300,8]]),seen=[];
 r.state.evalTotal=r.state.levelTotal=300;r.entities=Array.from({length:300},(_,i)=>({kind:'paper',type:'check',id:i,x:0,lane:0,d:2+i*3,y:1.38,pi:0,done:false}));
 while(r.state.papers<300){r.step();for(const e of r.events.filter(e=>e.type==='chain')){seen.push([e.chain,e.mult]);assert.equal(tiers.get(e.chain),e.mult);}}
 assert.deepEqual(seen,[...tiers]);assert.equal(r.state.chain,300);assert.equal(r.state.bestChain,300);assert.equal(r.state.mult,8);assert.equal(r.state.score,10000);
});
test('distance reward is unmultiplied and does not grow the clean-action chain',()=>{
 const r=open();Object.assign(r.state,{chain:100,mult:5,bestChain:100});const from=r.state.distance;let points=0;
 for(let i=0;i<60;i++){r.step();for(const e of r.events.filter(e=>e.type==='score')){assert.equal(e.reason,'distance');assert.equal(e.mult,1);points+=e.points;}}
 assert.equal(points,Math.floor(r.state.distance)-Math.floor(from));assert.equal(r.state.reward,points);assert.equal(r.state.chain,100);
});
test('a hit or either kind of decoy breaks the chain but does not erase banked reward',()=>{
 for(const kind of ['hit','decoy','decoyPayload']){
  const r=open();Object.assign(r.state,{chain:25,mult:3,bestChain:25,reward:5000,levelReward:5000});
  if(kind==='hit')r.hit('van');else{hazard(r,kind==='decoy'?'false-credit':kind,0,.5,{kind:kind==='decoy'?'decoy':'obstacle'});if(kind==='decoyPayload')r.input('boostOn');r.step();}
  assert.equal(r.state.chain,0);assert.equal(r.state.mult,1);assert.equal(r.state.bestChain,25);assert.equal(r.state.reward,5000);assert.ok(r.events.some(e=>e.type==='chainBreak'&&e.chain===25));
 }
});
test('near miss counts only the tight lateral band outside the wall hitbox',()=>{
 const width=1.32*C.HIT_WIDTH_SCALE,edge=width+C.NEAR_MISS_MARGIN;
 for(const [x,hit,near] of [[width-.001,1,0],[width+.001,0,1],[edge-.001,0,1],[edge+.001,0,0],[3.2,0,0]]){
  const r=open(),e=hazard(r,'van',x),events=pass(r,e);assert.equal(r.state.hits,hit,'x='+x);assert.equal(r.state.nearMisses,near,'x='+x);assert.equal(events.filter(e=>e.type==='nearMiss').length,near);
  assert.equal(events.filter(e=>e.type==='score'&&e.reason==='nearMiss').reduce((n,e)=>n+e.points,0),near*50);assert.equal(r.state.papers,0);assert.equal(r.state.score,0);
 }
});
test('a near-miss candidate is not rewarded if the same obstacle subsequently hits',()=>{
 const r=open(),e=hazard(r,'van',1.5);while(!e.near)r.step();assert.equal(r.state.nearMisses,0);e.x=0;r.step();assert.equal(r.state.hits,1);assert.equal(r.state.nearMisses,0);assert.ok(!r.events.some(e=>e.type==='nearMiss'));
});
test('full-width beams cannot manufacture a lateral near miss',()=>{const r=open(),e=hazard(r,'beam',1.5,20,{height:'high'});pass(r,e);assert.equal(r.state.hits,1);assert.equal(r.state.nearMisses,0);});
test('perfect jumps and ducks use first-contact timing and award the bonus only once',()=>{
 for(const [type,action,window] of [['gate','slideOn',[1,4,7,8,15]],['barrier','jump',[6,7,8,15]]]){
  const reference=open(),ref=hazard(reference,type,0,30);let contact;
  while(!ref.done){reference.step();if(reference.events.some(e=>e.type==='hit'))contact=reference.ticks;}
  for(const frames of window){
   const r=open(),e=hazard(r,type,0,30),events=[];
   while(!e.done){if(r.ticks===contact-frames)r.input(action);r.step();events.push(...r.events);}
   assert.equal(r.state.hits,0);assert.equal(r.state.perfects,frames<=7?1:0);assert.equal(events.filter(e=>e.type==='clear').length,1);
   const points=events.filter(e=>e.type==='score'&&e.reason!=='distance').reduce((n,e)=>n+e.points,0);assert.equal(points,frames<=7?100:25);assert.equal(r.state.chain,1);assert.equal(r.state.papers,0);
   if(frames<=7)assert.equal(events.find(e=>e.type==='perfect').frames,frames);
  }
 }
});
test('duck re-press spam cannot turn an early clear into a perfect',()=>{const r=open(),e=hazard(r,'gate',0,30);r.input('slideOn');let perfects=0;while(!e.done){r.input('slideOn');r.step();perfects+=r.events.filter(e=>e.type==='perfect').length;}assert.equal(perfects,0);});
test('grade thresholds distinguish no-hit top ranks and include exact boundaries',()=>{
 for(const [reward,grade] of [[900,'SS'],[899,'S'],[800,'S'],[799,'A'],[650,'A'],[649,'B'],[500,'B'],[499,'C'],[350,'C'],[349,'D']])assert.equal(C.gradeFor(reward,1000,0),grade);
 assert.equal(C.gradeFor(2000,1000,1),'A');assert.equal(C.gradeFor(0,0,0),'D');
});
test('36 shard identities are stable across seeds and loops, and bosses keep them in the approach',()=>{
 const expected=Array.from({length:12},(_,i)=>'abc'.split('').map(s=>'s'+String(i+1).padStart(2,'0')+s)).flat();
 for(const seed of [1,2,42,C.SEED]){
  const ids=[];
  for(let stage=0;stage<12;stage++){
   const es=C.generateEntities(seed,stage),shards=es.filter(e=>e.kind==='shard');ids.push(...shards.map(e=>e.id));assert.equal(shards.length,3);
   assert.deepEqual(C.generateEntities(seed,stage+12).filter(e=>e.kind==='shard').map(e=>e.id).sort(),shards.map(e=>e.id).sort());
   if(P.LEVELS[stage].boss)assert.ok(shards.every(e=>e.d<C.stageStart(stage)+P.BOSSES[P.LEVELS[stage].id].arena));
  }
  assert.deepEqual(ids.sort(),expected);
 }
});
test('shards give reward once, never credit, and checkpoint restores all reward state independently',()=>{
 const r=open(),total=r.state.evalTotal;hazard(r,'shard',0,.5,{kind:'shard',id:'s01a'});r.checkpoint();r.step();
 assert.deepEqual(r.state.shards,['s01a']);assert.equal(r.state.reward,1000);assert.equal(r.state.chain,1);assert.equal(r.state.papers,0);assert.equal(r.state.evalTotal,total);assert.equal(r.state.score,0);
 hazard(r,'shard',0,.5,{kind:'shard',id:'s01a'});r.step();assert.deepEqual(r.state.shards,['s01a']);assert.equal(r.state.chain,1);assert.equal(r.events.filter(e=>e.type==='shard').length,0);
 r.restore();assert.deepEqual(r.state.shards,[]);assert.equal(r.state.reward,0);assert.equal(r.state.chain,0);r.state.shards.push('s01b');assert.deepEqual(r.snapshot.state.shards,[]);r.restore();r.state.countdown=0;r.step();assert.equal(r.state.reward,1000);assert.deepEqual(r.state.shards,['s01a']);
});
test('report is strictly story-only and only opens the exit-choice centre lane',()=>{
 for(const mode of ['story','practice','benchmark','daily','endless'])for(const report of [false,true,'true'])assert.equal(P.normalize({mode,report}).report,mode==='story'&&report===true);
 for(const [mode,report,decision,expected] of [['story',true,'exit-choice',0],['story',false,'exit-choice',1],['practice',true,'exit-choice',1],['benchmark',true,'exit-choice',1],['story',true,'first-assignment',1]]){
  const r=open({mode,report});hazard(r,'fork',0,.5,{decision});r.step();assert.equal(r.state.decisions[0].route,expected);assert.equal(r.state.hits,expected===0?0:1);
 }
});
test('story REPORT ending and its rewards replay across intermissions without changing the fork id',()=>{
 const t=drive(C.SEED,'hard',null,{mode:'story',report:true,route:{'exit-choice':0}});assert.equal(t.result.won,true);assert.equal(t.result.hits,0);assert.equal(t.result.decisions.find(d=>d.id==='exit-choice').route,0);assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
});
test('reward has a separate board identity and no effect on fixed-suite credit',()=>{
 const a=P.boardKey(42,{difficulty:'hard'}),b=P.rewardBoardKey(42,{difficulty:'hard'});assert.notEqual(a,b);assert.notEqual(b,P.rewardBoardKey(42,{difficulty:'expert'}));assert.notEqual(b,P.rewardBoardKey(42,{mode:'daily',day:'2026-09-30'}));
 const r=open();r.award(5000,'bossDefeated',false);assert.equal(r.state.score,0);assert.equal(r.state.papers,0);assert.equal(r.result().rewardBoard,P.rewardBoardKey(r.seed,r.options));
});
test('clean driver earns skill rewards and tuned A-or-better grades, without SS everywhere',()=>{
 const t=drive();assert.equal(t.result.won,true);assert.equal(t.result.hits,0);assert.equal(t.result.decoys,0);assert.equal(t.result.reflects,P.LEVELS.filter(l=>l.boss).reduce((n,l)=>n+P.BOSSES[l.id].hp,0));
 assert.ok(t.result.grades.every(g=>['A','S','SS'].includes(g)));assert.ok(t.result.grades.some(g=>g!=='SS'));
 assert.equal(t.result.reward,t.result.stages.reduce((n,s)=>n+s.reward,0));assert.deepEqual(t.result.grades,t.result.stages.map(s=>s.grade));assert.deepEqual(C.replay(t.inputs,t.ticks,t.seed,t.options),t.result);
});
