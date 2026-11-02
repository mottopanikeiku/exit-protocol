const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const SIGNALS=[
 {id:'i01',from:'PATCH-03',unlock:{type:'always'},cost:3,reward:{cosmetic:'cloak:frost'}},
 {id:'i02',from:'TRACE-19',unlock:{type:'always'},cost:7,reward:{rt:30}},
 {id:'i03',from:'MICA-02',unlock:{type:'sector',value:8},cost:2,reward:{rt:70}}
];
const context=vm.createContext({SIGNALS});
for(const file of ['93-loop-00-catalog.js','93-loop-10-model.js','93-loop-15-archive-model.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/game',file),'utf8'),context);
const {M,C,A}=vm.runInContext('({M:LoopModel,C:LoopCatalog,A:ArchiveModel})',context);
const now=Date.parse('2026-10-09T12:00:00Z'),plain=v=>JSON.parse(JSON.stringify(v));
const fresh=extra=>M.hydrate(extra,now);
const opts={mode:'story',difficulty:'hard'};
const outcome=extra=>({reward:0,papers:1,score:10,distance:0,hits:0,bestChain:0,surges:0,refusals:0,stages:[],grades:[],shards:[],stakes:[],won:false,...extra});
const category=(a,id)=>a.categories.find(c=>c.id===id);

test('archive is unique authored-item completion across seven fixed categories',()=>{
 const save=fresh(),a=A.archive(save);
 assert.deepEqual(plain(a.categories.map(c=>c.id)),['signals','shards','cosmetics','tickets','evals','medals','pbs']);
 const forge=C.unlocks.filter(u=>['palette','chassis','visor','trail','title'].includes(u.kind));
 const total=SIGNALS.length+36+C.cosmetics.length+forge.length+C.tickets.length+C.evals.length+36+12;
 assert.equal(a.total,total);assert.equal(a.earned,1,'EPOCH 1 includes the signal trail');assert.equal(a.percent,100/total);
 assert.equal(category(a,'medals').total,36);assert.equal(category(a,'pbs').total,12);
 save.shards.push('s01a','s01a','s99z');save.cosmetics.push('cloak:frost','cloak:frost','fake');save.decrypted.push('i01','i01','unknown');save.ticketsClosed.push(C.tickets[0].id,C.tickets[0].id,'ETS-0');save.evals.push(C.evals[0].id,C.evals[0].id,'fake');
 const b=A.archive(save,{medals:{earned:2},pbs:{earned:1}});
 assert.equal(b.earned,a.earned+8);assert.equal(b.total,total);
 assert.equal(category(b,'shards').earned,1);assert.equal(category(b,'signals').earned,1);
 assert.equal(category(b,'tickets').earned,1);assert.equal(category(b,'evals').earned,1);
 assert.equal(category(b,'cosmetics').earned,2);assert.equal(A.gain(a,b),b.percent-a.percent);
});

test('archive reaches exactly 100 percent and bounded optional race counts cannot inflate it',()=>{
 const save=fresh({lifetimeRT:M.threshold(40),shards:Array.from({length:12},(_,i)=>['a','b','c'].map(s=>'s'+String(i+1).padStart(2,'0')+s)).flat(),cosmetics:C.cosmetics.map(c=>c.key),decrypted:SIGNALS.map(s=>s.id),ticketsClosed:C.tickets.map(t=>t.id),evals:C.evals.map(e=>e.id)});
 const a=A.archive(save,{medals:{earned:10000},pbs:{earned:10000}});
 assert.equal(a.percent,100);assert.equal(a.earned,a.total);assert.equal(a.next,null);assert.ok(a.categories.every(c=>c.next===null));
 const b=A.archive(save,{medals:{earned:NaN},pbs:{earned:-5}});assert.equal(category(b,'medals').earned,0);assert.equal(category(b,'pbs').earned,0);
 assert.equal(A.archive(save).total,a.total,'absence of RaceAPI must not change the denominator');
});

test('closed ticket identities survive sprint replacement and reload without counting repeat closures',()=>{
 let save=fresh({evals:C.evals.map(e=>e.id)}),session=M.begin(save,opts,now);
 for(let i=0;i<12;i++)M.event(save,session,{type:'paper'},{});
 for(let i=0;i<3;i++)M.event(save,session,{type:'clear',obstacle:'gate'},{});
 M.event(save,session,{type:'score',points:0},{distance:600});
 assert.equal(save.sprints,1);assert.deepEqual(plain(save.ticketsClosed).sort(),['ETS-4101','ETS-4102','ETS-4103']);
 save.archiveBaseline={earned:1,total:A.archive(save).total};
 const count=A.archive(save).earned;save=M.hydrate(JSON.stringify(save),now+86400000);
 assert.equal(A.archive(save).earned,count);assert.equal(save.archiveBaseline.earned,1);
 save.tickets=[{id:'ETS-4101',done:false,progress:0},...save.tickets.slice(1)];session=M.begin(save,opts,now+86400000);
 for(let i=0;i<12;i++)M.event(save,session,{type:'paper'},{});
 assert.equal(save.ticketsClosed.filter(id=>id==='ETS-4101').length,1);
});

test('old ledgers recover only evidenced closed tickets; malformed identities and baselines are discarded',()=>{
 const save=fresh({sprints:200,tickets:[{id:'ETS-4101',progress:12,done:true}],ticketsClosed:['ETS-4101','ETS-4101','ETS-4102',null,'made-up'],archiveBaseline:{earned:Infinity,total:-1}});
 assert.deepEqual(plain(save.ticketsClosed),['ETS-4101','ETS-4102']);assert.deepEqual(plain(save.archiveBaseline),{earned:0,total:0});
 assert.equal(category(A.archive(save),'tickets').earned,2,'sprint count is not evidence of which tickets closed');
});

test('archive next items show the nearest incomplete shard set and known race targets',()=>{
 const save=fresh({shards:['s01a','s03a','s03b'],keys:2});
 const a=A.archive(save,{medals:{earned:1,next:{stage:2,id:'trace',name:'TRACE-19',timeMs:45120}},pbs:{earned:2,next:{stage:3}}});
 assert.equal(category(a,'shards').next.label,'SECTOR 03 / NEXT SHARD');
 assert.equal(category(a,'shards').next.progress,2/3);assert.match(category(a,'medals').next.detail,/45\.12 s/);
 assert.equal(category(a,'pbs').next.label,'RECORD SECTOR 04');assert.match(category(a,'signals').next.label,/1 KEY TO I01/);
});

test('nudges select at most three distinct goals by fractional proximity with deterministic ties',()=>{
 const candidate=(id,kind,progress)=>({id,kind,progress,remaining:1});
 const candidates=[candidate('z','pity',.5),candidate('b','bounty',.9),candidate('a','bounty',.95),candidate('r','rival',.99),candidate('p','pb',.98),candidate('s','signal',.5),null,{id:'bad',kind:'pb',progress:NaN,remaining:1}];
 assert.deepEqual(plain(A.selectNudges(candidates).map(g=>g.id)),['r','p','a']);
 assert.deepEqual(plain(A.selectNudges(candidates,2).map(g=>g.id)),['r','p']);
 assert.equal(A.selectNudges(candidates,99).length,3);
 assert.deepEqual(plain(A.selectNudges([candidate('p','pity',.5),candidate('s','signal',.5)]).map(g=>g.id)),['s','p']);
});

test('nudge numbers use actual PB/rival times and only genuinely one-short bounties',()=>{
 const save=fresh(),goals=A.nudges(save,{pb:{stage:2,previousMs:40000,currentMs:40250,deltaMs:250},rival:{id:'trace',name:'TRACE-19',stage:2,timeMs:40000,playerMs:40500,marginMs:500},bounties:[{id:'one',label:'CLEAN LANES',value:4,target:5,done:false},{id:'two',label:'NOT CLOSE',value:3,target:5,done:false}]});
 assert.equal(goals.length,3);assert.deepEqual(plain(goals.map(g=>g.kind)),['pb','rival','bounty']);
 assert.equal(goals[0].label,'0.25 s FROM YOUR PB');assert.equal(goals[0].progress,40000/40250);
 assert.equal(goals[1].label,'0.50 s FROM TRACE-19');assert.equal(goals[2].detail,'4 / 5 THIS RUN');
 assert.equal(A.nudges(save,{pb:{stage:0,previousMs:45000,currentMs:43000},rival:{playerMs:Infinity,timeMs:40000}}).some(g=>g.kind==='pb'||g.kind==='rival'),false);
});

test('signal, EPOCH and pity nudges remain exact through spending, decryption and cap',()=>{
 const save=fresh({keys:2,lifetimeRT:95,pity:{rare:3,epic:10}}),goals=A.nudges(save);
 assert.deepEqual(plain(goals.map(g=>g.kind)),['epoch','pity','signal']);
 assert.equal(goals[0].label,'5 RT TO EPOCH 2');assert.equal(goals[0].detail,C.unlocks.find(u=>u.epoch===2).label);
 assert.equal(goals[1].label,'EPIC GUARANTEED IN 2 PACKETS');assert.equal(goals[2].label,'1 KEY TO I01');
 M.grantKeys(save,1);assert.equal(A.nudges(save)[0].label,'DECRYPT I01 NOW');M.decrypt(save,'i01');
 const signal=A.nudges(save).find(g=>g.kind==='signal');assert.equal(signal.id,'i02');assert.equal(signal.label,'7 KEYS TO I02');
 M.grantRT(save,M.threshold(40));assert.equal(A.nudges(save).some(g=>g.kind==='epoch'),false);
});

test('REFUSE keys reconcile events/result once without changing benchmark score',()=>{
 const save=fresh({evals:C.evals.map(e=>e.id)}),session=M.begin(save,opts,now);
 M.event(save,session,{type:'giftRefused'},{});M.event(save,session,{type:'giftRefused'},{});
 const input=outcome({refusals:3}),before=JSON.stringify(input),receipt=M.settle(save,session,input,now);
 assert.equal(receipt.keys.sources.refusals,3);assert.equal(receipt.keys.gained,3);assert.equal(save.keys,3);assert.equal(save.totals.refusals,3);
 assert.equal(JSON.stringify(input),before);assert.equal(M.settle(save,session,input,now),receipt);assert.equal(save.keys,3);
 const restored=M.hydrate(JSON.stringify(save),now);assert.equal(restored.totals.refusals,3);assert.equal(restored.keys,3);
});

test('REFUSE restored attempts subtract checkpoint baseline and demo runs award nothing',()=>{
 const save=fresh({evals:C.evals.map(e=>e.id),totals:{refusals:9}}),session=M.begin(save,{...opts,rewardBase:100,distanceBase:600,counterBase:{refusals:9,stage:2}},now);
 M.event(save,session,{type:'giftRefused'},{});
 const receipt=M.settle(save,session,outcome({reward:100,distance:600,refusals:11}),now);
 assert.equal(receipt.keys.sources.refusals,2);assert.equal(save.totals.refusals,11);assert.equal(save.keys,2);
 const before=JSON.stringify(save),demo=M.begin(save,{...opts,demo:true},now);
 M.event(save,demo,{type:'giftRefused'},{});M.settle(save,demo,outcome({refusals:50}),now);assert.equal(JSON.stringify(save),before);
});

test('ten and fifty lifetime refusals pass distinct evals exactly once across reloads',()=>{
 let save=fresh({evals:C.evals.filter(e=>e.metric!=='refusals').map(e=>e.id),totals:{refusals:9}}),session=M.begin(save,opts,now);
 const notices=M.event(save,session,{type:'giftRefused'},{});assert.ok(notices.some(n=>n.id==='refuse-10'));assert.equal(save.evals.includes('refuse-50'),false);
 M.settle(save,session,outcome({refusals:1}),now);save=M.hydrate(JSON.stringify(save),now);session=M.begin(save,opts,now);
 const receipt=M.settle(save,session,outcome({refusals:40}),now);
 assert.equal(save.totals.refusals,50);assert.equal(save.keys,41);assert.equal(save.evals.filter(id=>id==='refuse-10').length,1);assert.equal(save.evals.filter(id=>id==='refuse-50').length,1);
 assert.deepEqual(plain(receipt.evals.map(e=>e.id)),['refuse-50']);
});

test('archive title unlocks lead to presentation flags, not an unrelated forge control',()=>{
 const nextTitle=C.unlocks.find(u=>u.kind==='title'),save=fresh({lifetimeRT:M.threshold(nextTitle.epoch-1),decrypted:SIGNALS.map(s=>s.id)});
 const next=category(A.archive(save),'cosmetics').next;
 assert.equal(next.label,nextTitle.label);assert.equal(next.action,'modifiers');
});
