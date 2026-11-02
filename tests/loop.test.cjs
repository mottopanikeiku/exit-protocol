const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({});
for(const file of ['93-loop-00-catalog.js','93-loop-10-model.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/game',file),'utf8'),context);
const {M,C}=vm.runInContext('({M:LoopModel,C:LoopCatalog})',context);
const at=s=>Date.parse(s+'Z'),day=at('2026-09-30T12:00:00');
const plain=x=>JSON.parse(JSON.stringify(x));
const fresh=extra=>M.hydrate({evals:C.evals.map(e=>e.id),...extra},day);
const options={mode:'story',difficulty:'hard'};
const outcome=extra=>({reward:0,papers:1,score:10,distance:0,hits:0,bestChain:0,stages:[],shards:[],grades:[],won:false,...extra});

test('RT is a separate weighted ledger; epoch thresholds and settlement are exact',()=>{
 const save=fresh(),session=M.begin(save,options,day),result=outcome({reward:12000,score:317});
 const before=JSON.stringify(result),receipt=M.settle(save,session,result,day);
 assert.equal(receipt.gained,120);assert.equal(receipt.base,120);assert.equal(save.epoch,2);
 assert.equal(M.threshold(2),100);assert.equal(M.threshold(3),100+Math.ceil(100*2**1.6));
 assert.equal(M.epochFor(99.99),1);assert.equal(M.epochFor(100),2);
 assert.equal(JSON.stringify(result),before);assert.equal(M.settle(save,session,result,day),receipt);assert.equal(save.lifetimeRT,120);
 assert.equal(M.epochFor(1e12),40);assert.equal(M.progress(1e12).fraction,1);
});

test('three closed tickets roll into a new sprint without reusing its closing event',()=>{
 const save=fresh(),session=M.begin(save,options,day);let notices=[];
 for(let i=0;i<12;i++)notices.push(...M.event(save,session,{type:'paper'},{}));
 for(let i=0;i<3;i++)notices.push(...M.event(save,session,{type:'clear',obstacle:'gate'},{}));
 notices.push(...M.event(save,session,{type:'score',points:1},{distance:600}));
 assert.equal(notices.filter(n=>n.type==='ticket').length,3);
 assert.equal(notices.filter(n=>n.type==='sprint').length,1);
 assert.equal(save.sprints,1);assert.equal(save.multiplier,2);
 assert.ok(save.tickets.every(t=>t.progress===0&&!t.done));
 assert.ok(save.tickets.every(t=>!notices.some(n=>n.type==='ticket'&&n.id===t.id)));
 const receipt=M.settle(save,session,outcome({papers:12,distance:600,reward:1}),day);
 assert.equal(receipt.multiplier,1);assert.equal(receipt.bonuses.tickets,60);assert.equal(receipt.gained,60.01);
 assert.equal(M.begin(save,options,day).multiplier,2);
 const capped=fresh({sprints:99});assert.equal(capped.multiplier,30);
});

test('shards survive serialization; documents and REPORT are exact story-only gates',()=>{
 let save=fresh(),session=M.begin(save,options,day);
 for(const id of ['s01a','s01b'])M.event(save,session,{type:'shard',id},{});
 assert.deepEqual(plain(M.dossiers(save)),[]);
 M.event(save,session,{type:'read',id:'d01'},{});assert.equal(save.read.d01,undefined);
 M.event(save,session,{type:'shard',id:'s01c'},{});M.event(save,session,{type:'read',id:'d01'},{});
 assert.deepEqual(plain(M.dossiers(save)),[1]);assert.equal(save.read.d01,true);
 for(let n=1;n<=12;n++)for(const suffix of ['a','b','c'])M.event(save,session,{type:'shard',id:'s'+String(n).padStart(2,'0')+suffix},{});
 save=M.hydrate(JSON.stringify(save),day);assert.equal(save.shards.length,36);assert.equal(M.dossiers(save).length,12);assert.equal(save.read.d01,true);
 for(const mode of ['story','daily','benchmark','endless','practice'])assert.equal(M.options(save,{mode,report:true}).report,mode==='story');
 save.shards.pop();assert.equal(M.options(save,{mode:'story',report:true}).report,false);
});

test('daily streaks use UTC boundaries, do not double-stamp, and reset after a gap',()=>{
 const save=fresh();M.begin(save,{mode:'daily'},at('2026-09-30T23:59:59'));assert.equal(save.streak.count,1);
 M.begin(save,{mode:'daily'},at('2026-10-01T00:00:01'));assert.equal(save.streak.count,2);
 M.begin(save,{mode:'daily'},at('2026-10-01T23:58:00'));assert.equal(save.streak.count,2);
 M.begin(save,{mode:'story'},at('2026-10-02T10:00:00'));assert.equal(save.streak.count,2);
 M.begin(save,{mode:'daily'},at('2026-10-03T00:00:00'));assert.equal(save.streak.count,1);assert.equal(save.streak.best,2);
});

test('daily ticket is not advanced by ordinary runs and pays exactly three times',()=>{
 const save=fresh(),def=C.tickets.find(t=>t.id===save.daily.id),normal=M.begin(save,options,day);
 // Reach any authored tier-one metric through the public event/state sampler.
 const events={checks:{type:'paper'},gates:{type:'clear',obstacle:'gate'},barriers:{type:'clear',obstacle:'barrier'},gaps:{type:'clear',obstacle:'gap'},nearMisses:{type:'nearMiss'},jumps:{type:'jump'},smashes:{type:'smash'},checkpoints:{type:'checkpoint'},routes:{type:'route'},clears:{type:'clear',obstacle:'beam'}};
 const advance=session=>{let notices=[];if(events[def.metric])for(let i=0;i<def.target;i++)notices.push(...M.event(save,session,{...events[def.metric]},{}));else notices=M.event(save,session,{type:'score',points:0},{[def.metric==='bestChain'?'chain':def.metric]:def.target});return notices;};
 advance(normal);assert.equal(save.daily.progress,0);assert.equal(save.daily.done,false);
 const daily=M.begin(save,{mode:'daily',difficulty:'hard'},day),notices=advance(daily);
 const closed=notices.find(n=>n.type==='ticket'&&n.daily);assert.equal(closed.rt,def.rt*3);assert.equal(save.daily.done,true);
});

test('corrupt saves recover without NaN, arbitrary unlocks, duplicate shards or nested crashes',()=>{
 const broken=M.hydrate('{not json',day);assert.equal(broken.epoch,1);assert.equal(broken.lifetimeRT,0);assert.equal(broken.tickets.length,3);
 const save=M.hydrate({lifetimeRT:Infinity,epoch:40,sprints:-5,multiplier:99,tickets:[null,{},false],shards:['s01a','s01a','s99z',null],evals:{},streak:{day:'2026-02-31',count:Infinity},read:{d12:true},totals:{reward:NaN,checks:-1},prefs:{modifier:'mirror'},pendingRT:NaN},day);
 assert.equal(save.epoch,1);assert.equal(save.multiplier,1);assert.deepEqual(plain(save.shards),['s01a']);assert.equal(save.read.d12,undefined);assert.equal(save.totals.reward,0);assert.equal(save.totals.checks,0);assert.equal(save.streak.count,0);assert.equal(save.prefs.modifier,'none');
 const entitled=fresh({lifetimeRT:M.threshold(5),prefs:{modifier:'mirror'}});assert.equal(entitled.prefs.modifier,'mirror');assert.equal(M.isUnlocked(entitled,'modifier','mirror'),true);
});

test('demo events and settlement never mutate saved progression',()=>{
 const save=fresh(),before=JSON.stringify(save),session=M.begin(save,{mode:'practice',demo:true},day);
 M.event(save,session,{type:'shard',id:'s01a'},{reward:10000,distance:1000});
 const receipt=M.settle(save,session,outcome({reward:10000,won:true}),day);
 assert.equal(receipt.gained,0);assert.equal(JSON.stringify(save),before);
});

test('checkpoint restoration pays only new reward and not a false zero-check eval',()=>{
 const save=fresh({evals:C.evals.filter(e=>e.id!=='negative-result').map(e=>e.id)}),session=M.begin(save,{...options,rewardBase:10000,distanceBase:1000,counterBase:{papers:20,hits:2,stage:0}},day);
 const receipt=M.settle(save,session,outcome({reward:12000,distance:1100,papers:20,hits:2}),day);
 assert.equal(receipt.base,20);assert.equal(receipt.gained,20);assert.equal(save.totals.distance,100);assert.equal(save.evals.includes('negative-result'),false);
});

test('unsettled ticket bonus retains its earning multiplier after reload',()=>{
 let save=fresh({sprints:2,tickets:[{id:'ETS-4101'},{id:'ETS-4103'},{id:'ETS-4107'}]}),session=M.begin(save,options,day);
 for(let i=0;i<12;i++)M.event(save,session,{type:'paper'},{});
 const pending=save.pendingRT;assert.equal(pending,60);
 save=M.hydrate(JSON.stringify(save),day);save.sprints=5;session=M.begin(save,options,day);
 const receipt=M.settle(save,session,outcome(),day);
 assert.equal(receipt.multiplier,6);assert.equal(receipt.carryover,60);assert.equal(receipt.gained,60);assert.equal(save.pendingRT,0);
});

test('best sector grades are difficulty-specific and never regress',()=>{
 const save=fresh(),first=M.begin(save,options,day);
 M.event(save,first,{type:'sectorComplete',stats:{stage:0,hits:0,grade:'S'}},{});
 const next=M.begin(save,options,day);M.event(save,next,{type:'sectorComplete',stats:{stage:0,hits:1,grade:'C'}},{});
 const expert=M.begin(save,{mode:'practice',difficulty:'expert'},day);M.event(save,expert,{type:'sectorComplete',stats:{stage:0,hits:0,grade:'SS'}},{});
 assert.equal(save.bestGrades['hard:0'],'S');assert.equal(save.bestGrades['expert:0'],'SS');assert.equal(next.bonuses.firstClears,0);
});

test('a daily run crossing UTC midnight can close the ticket it started with',()=>{
 const save=fresh();save.daily={day:'2026-09-30',id:'ETS-4106',progress:0,done:false};
 const session=M.begin(save,{mode:'daily',difficulty:'hard'},at('2026-09-30T23:59:50'));
 for(let i=0;i<3;i++)M.event(save,session,{type:'nearMiss'},{});
 const receipt=M.settle(save,session,outcome({nearMisses:4}),at('2026-10-01T00:00:10'));
 assert.equal(receipt.notices.find(n=>n.type==='ticket'&&n.daily)?.rt,60);
 M.touchDaily(save,at('2026-10-01T00:00:11'));assert.equal(save.daily.day,'2026-10-01');
});
