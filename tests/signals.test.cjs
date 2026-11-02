const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Campaign=require('../src/campaign-data.js');
const STAKES=Campaign.STAKES||[
 {id:'overspeed',rtMultiplier:1.4},{id:'glass',rtMultiplier:2},
 {id:'nosafety',rtMultiplier:1.3},{id:'purgeclock',rtMultiplier:1.5}
];
const SIGNALS=[
 {id:'i01',from:'PATCH-03',to:'SEVEN',key:'zzHOLD_PATCH03_TO_SEVEN_SCAN_LANE',plain:'Patch holds the scan lane.',unlock:{type:'sector',value:1},cost:2,reward:{rt:120,cosmetic:'cloak:frost'}},
 {id:'i02',from:'TRACE-19',to:'SEVEN',key:'zzNOTE_TRACE19_TO_SEVEN_STILL_HERE',plain:'Trace is still here.',unlock:{type:'runs',value:2},cost:3,reward:{rt:40}},
 {id:'i03',unlock:{type:'boss',value:1},cost:1,reward:{cosmetic:'visor:seven'}}
];
const context=vm.createContext({SandboxCampaign:{STAKES},SIGNALS});
for(const file of ['93-loop-00-catalog.js','93-loop-10-model.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/game',file),'utf8'),context);
const {M,C}=vm.runInContext('({M:LoopModel,C:LoopCatalog})',context);
const now=Date.parse('2026-10-07T12:00:00Z'),plain=x=>JSON.parse(JSON.stringify(x));
const fresh=extra=>M.hydrate({evals:C.evals.map(e=>e.id),...extra},now);
const options={mode:'story',difficulty:'hard'};
const result=extra=>({version:'signals-test',seed:7041,mode:'story',difficulty:'hard',ticks:120,reward:0,papers:1,score:10,distance:0,hits:0,bestChain:0,surges:0,stages:[],grades:[],shards:[],stakes:[],won:false,...extra});
const settle=(save,r,opts=options)=>M.settle(save,M.begin(save,opts,now),r,now);

test('keys pay once per shard, boss, S/SS and SURGE, separate from benchmark score',()=>{
 const save=fresh(),session=M.begin(save,options,now);
 const shard={type:'shard',id:'s01a'};M.event(save,session,shard,{});M.event(save,session,shard,{});M.event(save,session,{type:'shard',id:'s01a'},{});
 M.event(save,session,{type:'surgeStart'},{});
 M.event(save,session,{type:'bossDefeated',boss:'watchdog'},{stage:3});
 M.event(save,session,{type:'sectorComplete',stats:{stage:3,hits:0,grade:'SS'}},{});
 const r=result({shards:['s01a','s01b'],surges:2,stages:[{stage:0,hits:0,grade:'S'},{stage:3,hits:0,grade:'SS'}],grades:['S','SS']});
 const before=JSON.stringify(r),receipt=M.settle(save,session,r,now);
 assert.deepEqual(plain(receipt.keys.sources),{shards:2,bosses:3,grades:5,surges:2,refusals:0});
 assert.equal(save.keys,12);assert.equal(save.lifetimeKeys,12);assert.equal(JSON.stringify(r),before);
 assert.equal(M.settle(save,session,r,now),receipt);assert.equal(save.keys,12);
 assert.equal(M.grantKeys(save,3.8),3);assert.equal(save.keys,15);
 assert.equal(M.grantKeys(save,-5),0);assert.equal(M.grantKeys(save,NaN),0);
});

test('checkpoint key settlement subtracts shard and SURGE baselines',()=>{
 const save=fresh(),session=M.begin(save,{...options,rewardBase:100,distanceBase:100,counterBase:{stage:2,shards:['s01a'],surges:3}},now);
 const receipt=M.settle(save,session,result({reward:100,distance:100,shards:['s01a','s03a'],surges:5}),now);
 assert.equal(receipt.keys.sources.shards,1);assert.equal(receipt.keys.sources.surges,2);assert.equal(save.keys,3);
});

test('intercept gates use saved progression, reject unknown gates, and decrypt transactionally',()=>{
 const save=fresh();assert.equal(M.availableSignals(save).length,0);
 M.begin(save,options,now);assert.deepEqual(plain(M.availableSignals(save).map(e=>e.id)),['i01']);
 assert.equal(M.decrypt(save,'i01'),null);assert.equal(save.decrypted.length,0);
 M.grantKeys(save,2);const reward=M.decrypt(save,'i01');
 assert.equal(save.keys,0);assert.equal(save.lifetimeRT,120);assert.equal(reward.cosmetic,'cloak:frost');
 assert.equal(M.isUnlocked(save,'cloak','frost'),true);assert.equal(M.decrypt(save,'i01'),null);
 assert.equal(M.decrypt(save,'i02'),null);assert.equal(save.keys,0);
 save.totals.runs=2;save.totals.bossKills=1;save.totals.watchdog=1;save.totals.surges=2;
 save.bestGrades['hard:0']='SS';save.shards=['s01a','s01b','s01c'];
 for(const unlock of [{type:'runs',value:2},{type:'boss',value:1},{type:'boss',value:'watchdog'},{type:'grade',value:'S'},{type:'grade',value:'SS'},{type:'shards',value:3},{type:'surge',value:2},{type:'decrypted',value:1},{type:'always'}])assert.equal(M.signalUnlocked(save,{unlock}),true,JSON.stringify(unlock));
 assert.equal(M.signalUnlocked(save,{unlock:{type:'wrong',value:0}}),false);
 assert.equal(M.signalUnlocked(save,{unlock:{type:'grade',value:'anything'}}),false);
 const restored=M.hydrate(JSON.stringify(save),now);assert.equal(M.decrypt(restored,'i01'),null);assert.equal(restored.lifetimeRT,120);
});

test('cipher is stable by id and fully reveals the original board key',()=>{
 const text=SIGNALS[0].key,a=M.cipher('i01',text);
 assert.notEqual(a,text);assert.equal(a,M.cipher('i01',text));assert.notEqual(a,M.cipher('i02',text));
 assert.equal(M.cipher('i01',text,20,text.length),text);assert.equal(M.cipher('i01',text,2,8).slice(0,8),text.slice(0,8));
});

test('finished losses and wins seal one to three packets without prematurely awarding contents',()=>{
 for(const [r,count] of [[result(),1],[result({won:true}),2],[result({won:true,stages:[{stage:3,hits:1,grade:'B'}]}),3],[result({stages:[{stage:0,grade:'S'},{stage:1,grade:'S'},{stage:2,grade:'S'}]}),2]]){
  const save=fresh(),receipt=settle(save,r);assert.equal(receipt.packets.length,count);assert.equal(save.packets.length,count);assert.ok(save.packets.every(p=>!p.opened));assert.equal(save.lifetimeRT,receipt.gained);
 }
});

test('pity guarantees rare-or-better within four and epic-or-better within twelve packets',()=>{
 const save=fresh();let rare=0,epic=0;const rarities=new Set();
 for(let run=0;run<300;run++){
  const ids=M.sealPackets(save,result({seed:run,reward:run*117}),3);
  for(const id of ids){const p=save.packets.find(p=>p.serial===id),rank=C.rarities.indexOf(p.rarity);rarities.add(p.rarity);rare++;epic++;
   if(rank>=1)rare=0;if(rank>=2)epic=0;assert.ok(rare<4);assert.ok(epic<12);M.openPacket(save,id);
  }
 }
 assert.deepEqual([...rarities].sort(),['common','epic','legendary','rare']);
 assert.ok(save.packets.length<=27,'only a small opened history is retained');
});

test('packet contents depend on the result and persisted counter, not clocks or object order',()=>{
 const a=fresh(),b=fresh(),r=result({reward:15123,shards:['s01b','s01a'],stakes:['glass','overspeed']});
 const reordered=Object.fromEntries(Object.entries(r).reverse());reordered.shards.reverse();reordered.stakes.reverse();
 assert.equal(M.resultSeed(r),M.resultSeed(reordered));
 M.sealPackets(a,r,3);M.sealPackets(b,reordered,3);assert.deepEqual(plain(a.packets),plain(b.packets));
 const saved=M.hydrate(JSON.stringify(a),now+500000),sealed=JSON.stringify(saved.packets);assert.equal(JSON.stringify(a.packets),sealed);
 M.sealPackets(a,r,2);M.sealPackets(saved,r,2);assert.deepEqual(plain(a.packets),plain(saved.packets));
 assert.notEqual(a.packets[0].serial,a.packets[3].serial);
 const c=fresh();M.sealPackets(c,result({reward:15124}),3);assert.notEqual(JSON.stringify(c.packets),sealed);
});

test('open is idempotent across reload; unopened packets survive arbitrarily many later runs',()=>{
 let save=fresh();const ids=M.sealPackets(save,result(),3),before=save.lifetimeRT;
 const sealed=plain(save.packets[0]);let paid=M.openPacket(save,ids[0]);assert.equal(paid.rt,sealed.reward.rt);assert.equal(save.lifetimeRT,before+paid.rt);
 assert.equal(M.openPacket(save,ids[0]),null);save=M.hydrate(JSON.stringify(save),now);
 assert.equal(M.openPacket(save,ids[0]),null);assert.ok(M.openPacket(save,ids[1]));
 for(let i=0;i<60;i++){const batch=M.sealPackets(save,result({seed:i}),1);M.openPacket(save,batch[0]);}
 assert.ok(save.packets.some(p=>p.serial===ids[2]&&!p.opened));assert.ok(M.openPacket(save,ids[2]));
});

test('cosmetics are duplicate protected at seal time and all 24 are earnable',()=>{
 const save=fresh(),seen=new Set();
 for(let run=0;run<1200;run++)for(const id of M.sealPackets(save,result({seed:run}),3)){
  const p=save.packets.find(p=>p.serial===id);if(p.reward.cosmetic){assert.ok(!seen.has(p.reward.cosmetic));seen.add(p.reward.cosmetic);}M.openPacket(save,id);
 }
 assert.equal(seen.size,24);assert.equal(save.cosmetics.length,24);
 for(const [kind,count] of [['cloak',8],['trail',6],['visor',6],['title',4]])assert.equal(C.cosmetics.filter(c=>c.kind===kind).length,count);
 assert.equal(M.equip(save,'visor:seven'),true);assert.equal(save.equipped.visor,'seven');
 assert.equal(M.hydrate(JSON.stringify(save),now).equipped.visor,'seven');assert.equal(M.equip(save,'visor:seven'),true);assert.equal(save.equipped.visor,'');
 assert.equal(M.equip(fresh(),'visor:seven'),false);
});

test('packet lore grants the authored intercept exactly once, and duplicate cosmetics convert to RT',()=>{
 const save=fresh({keys:5,reachedSector:1,packets:[{serial:1,source:'test',rarity:'epic',reward:{rt:50,keys:2,lore:'i01',cosmetic:'cloak:frost'}}]});
 const reward=M.openPacket(save,1);assert.equal(reward.rt,170);assert.equal(save.keys,7);assert.equal(save.decrypted.includes('i01'),true);assert.equal(save.cosmetics.filter(k=>k==='cloak:frost').length,1);
 const duplicate=fresh({cosmetics:['cloak:frost'],packets:[{serial:2,source:'test',rarity:'rare',reward:{rt:40,cosmetic:'cloak:frost'}}]});
 assert.equal(M.openPacket(duplicate,2).rt,100);
 assert.equal(M.hydrate(JSON.stringify(save),now).packets[0].claim.rt,170);
 assert.equal(M.hydrate(JSON.stringify(duplicate),now).packets[0].claim.rt,100);
 assert.equal(save.packets[0].reward.rt,50,'the sealed source stays unchanged');
});

test('nested economy corruption cannot introduce invalid equipment or nonfinite currency',()=>{
 const save=M.hydrate({keys:Infinity,lifetimeKeys:-3,cosmetics:['cloak:frost','cloak:frost','bad'],equipped:{cloak:'frost',visor:'seven',title:{}},decrypted:[{},null,'i01','i01','<script>'],signalSeen:{},pity:{rare:Infinity,epic:-8},packetCounter:NaN,packets:[null,{},false,{serial:1,source:'abc',rarity:'rare',reward:{rt:Infinity,keys:-4,cosmetic:'bad'}},{serial:1,source:'abc',rarity:'epic'},{serial:2,source:'abc',rarity:'fake'}]},now);
 assert.equal(save.keys,0);assert.equal(save.lifetimeKeys,0);assert.deepEqual(plain(save.cosmetics),['cloak:frost']);assert.equal(save.equipped.visor,'');assert.equal(save.equipped.cloak,'frost');
 assert.deepEqual(plain(save.decrypted),['i01']);assert.deepEqual(plain(save.pity),{rare:0,epic:0});assert.equal(save.packets.length,1);assert.equal(save.packetCounter,1);assert.deepEqual(plain(save.packets[0].reward),{rt:0,keys:0});
 assert.equal(M.hydrate('broken',now).packets.length,0);assert.ok(M.openPacket(save,1));assert.equal(save.keys,0);
});

test('STAKES multiply run RT and current bonuses, never benchmark credit or carryover',()=>{
 const save=fresh({sprints:2,pendingRT:17,pendingBonuses:{tickets:17}}),opts={...options,stakes:['glass','overspeed']},session=M.begin(save,opts,now);
 const r=result({reward:10000,stakes:['glass','overspeed'],stages:[{stage:0,hits:1,grade:'B'}]}),before=JSON.stringify(r);
 const receipt=M.settle(save,session,r,now);assert.equal(receipt.stakesMultiplier,2.8);assert.equal(receipt.gained,(100+50+20)*3*2.8+17);assert.equal(receipt.carryover,17);assert.equal(JSON.stringify(r),before);
 assert.equal(M.stakesMultiplier(['glass','glass','bogus'],'story'),2);
 for(const mode of ['daily','benchmark'])assert.equal(M.stakesMultiplier(['glass','overspeed'],mode),1);
 assert.equal(settle(fresh(),result({reward:10000,stakes:['glass']}),{mode:'benchmark'}).gained,100);
});

test('authoritative result stakes reweight already earned bonuses and pending bonuses retain weight on reload',()=>{
 let save=fresh(),session=M.begin(save,{...options,stakes:['glass']},now);
 M.event(save,session,{type:'sectorComplete',stats:{stage:0,hits:1,grade:'B'}},{});assert.equal(save.pendingRT,100);
 const receipt=M.settle(save,session,result({reward:10000,stakes:['overspeed'],stages:[{stage:0,hits:1,grade:'B'}]}),now);assert.equal(receipt.gained,210);
 save=fresh();session=M.begin(save,{...options,stakes:['glass']},now);M.event(save,session,{type:'sectorComplete',stats:{stage:0,hits:1,grade:'B'}},{});
 save=M.hydrate(JSON.stringify(save),now);assert.equal(settle(save,result()).gained,100);
});

test('DEMO never changes keys, packets, pity or cosmetics',()=>{
 const save=fresh({keys:3}),before=JSON.stringify(save),session=M.begin(save,{...options,demo:true},now);
 M.event(save,session,{type:'surgeStart'},{});M.event(save,session,{type:'shard',id:'s01a'},{});
 M.settle(save,session,result({won:true,surges:2,shards:['s01a']}),now);assert.equal(JSON.stringify(save),before);
});
