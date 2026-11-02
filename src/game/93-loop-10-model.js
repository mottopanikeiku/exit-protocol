/* Pure meta-progression. Pending bonuses are RT already weighted at the earning
   run's multiplier; core scores, state and result objects are never modified. */
const LoopModel=(()=>{
 const VERSION=1,KEY='exit-protocol-loop-v1',DAY=86400000,MAX=Number.MAX_SAFE_INTEGER,MAX_RT=MAX/100;
 const metrics=['checks','clears','barriers','gates','gaps','smashes','nearMisses','perfects','fourFrames','reflects','bossHits','bossKills','surges','refusals','jumps','boosts','decoys','hits','checkpoints','sectors','cleanSectors','sSectors','ssSectors','routes','distance','reward','bestChain','wins','runs','zeroChecks','goodhart','watchdog','resetStorm','exitCondition','cleanWatchdog','cleanResetStorm','cleanExitCondition','expertWins','nightmareWins','reportEndings','dailyRuns'];
 const bonusKinds=['tickets','evals','firstClears','bosses'],grades=['D','C','B','A','S','SS'];
 const bossMetrics={'watchdog':'watchdog','reset-storm':'resetStorm','exit-condition':'exitCondition'};
 const sectorBoss={3:'watchdog',7:'reset-storm',11:'exit-condition'};
 const cleanBoss={3:'cleanWatchdog',7:'cleanResetStorm',11:'cleanExitCondition'};
 const countEvents={paper:'checks',clear:'clears',smash:'smashes',nearMiss:'nearMisses',perfect:'perfects',reflect:'reflects',bossHit:'bossHits',surgeStart:'surges',giftRefused:'refusals',jump:'jumps',boost:'boosts',decoy:'decoys',decoyPayload:'decoys',hit:'hits',checkpoint:'checkpoints',route:'routes'};
 const resultFields={checks:'papers',nearMisses:'nearMisses',perfects:'perfects',reflects:'reflects',surges:'surges',refusals:'refusals',hits:'hits',decoys:'decoys',routes:'forks'};
 const ticketById=new Map(LoopCatalog.tickets.map(t=>[t.id,t]));
 const evalIds=new Set(LoopCatalog.evals.map(e=>e.id));
 const tierOne=LoopCatalog.tickets.filter(t=>t.tier===1);
 const thresholds=[0,0];
 for(let n=1;n<40;n++)thresholds[n+1]=thresholds[n]+Math.ceil(100*Math.pow(n,1.6));
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 const number=v=>Number.isFinite(v)?Math.max(0,Math.min(MAX,v)):0;
 const integer=v=>Math.floor(number(v));
 const money=v=>Math.round(Math.min(MAX_RT,number(v))*100)/100;
 const add=(a,b)=>number(number(a)+number(b));
 const counters=()=>Object.fromEntries(metrics.map(k=>[k,0]));
 const bonuses=()=>({tickets:0,evals:0,firstClears:0,bosses:0});
 const shardId=id=>typeof id==='string'&&/^s(?:0[1-9]|1[0-2])[abc]$/.test(id);
 const dossierId=id=>typeof id==='string'&&/^d(?:0[1-9]|1[0-2])$/.test(id);
 const lineId=id=>typeof id==='string'&&/^[xg]_[a-z0-9_]{1,60}$/.test(id);
 const pad=n=>String(n).padStart(2,'0');
 const time=ms=>Number.isFinite(ms)?Math.max(0,Math.min(253402300799999,Math.floor(ms))):0;
 function utcDay(ms){return new Date(Number.isFinite(ms)?Math.max(-62135596800000,Math.min(253402300799999,ms)):0).toISOString().slice(0,10);}
 function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&utcDay(Date.parse(day+'T00:00:00Z'))===day;}
 const dayNumber=day=>Date.parse(day+'T00:00:00Z')/DAY;
 function threshold(epoch){return thresholds[Math.max(1,Math.min(40,integer(epoch)))];}
 function epochFor(rt){let epoch=1;rt=number(rt);while(epoch<40&&rt>=thresholds[epoch+1])epoch++;return epoch;}
 function progress(rt){rt=number(rt);const epoch=epochFor(rt),start=threshold(epoch),end=threshold(Math.min(40,epoch+1));return {epoch,start,end,remaining:epoch===40?0:Math.max(0,end-rt),fraction:epoch===40?1:Math.max(0,Math.min(1,(rt-start)/(end-start)))};}
 function requirement(kind,id){
  if(kind==='modifier'&&id==='none'||own(LoopCatalog.defaults,kind)&&LoopCatalog.defaults[kind]===id)return 1;
  const row=LoopCatalog.unlocks.find(u=>u.kind===kind&&u.id===id);return row?row.epoch:null;
 }
 function isUnlocked(save,kind,id){if(LoopCatalog.cosmetics.some(c=>c.kind===kind&&c.id===id))return Array.isArray(save.cosmetics)&&save.cosmetics.includes(kind+':'+id);const epoch=requirement(kind,id);return epoch!==null&&epochFor(object(save).lifetimeRT)>=epoch;}
 function derive(save){save.epoch=epochFor(save.lifetimeRT);save.multiplier=Math.min(30,1+save.sprints);save.unlocks=LoopCatalog.unlocks.filter(u=>u.epoch<=save.epoch).map(u=>({...u}));}
 function hash(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
 function draw(sprint,previous=[]){
  // Catalog draws do not share a random stream with sealed run packets.
  // Start with the authored onboarding three, then expand the tier pool every
  // three sprints. Hash ordering is a deterministic draw, not a random source.
  const tier=Math.min(3,1+Math.floor(sprint/3));
  const pool=sprint===0?tierOne:LoopCatalog.tickets.filter(t=>t.tier<=tier&&!previous.includes(t.id)).sort((a,b)=>hash(sprint+':'+a.id)-hash(sprint+':'+b.id)||(a.id<b.id?-1:1));
  return pool.slice(0,3).map(t=>({id:t.id,progress:0,done:false}));
 }
 function normalizeTicket(raw,def){raw=object(raw);const done=raw.done===true;return {id:def.id,progress:done?def.target:Math.min(def.target,number(raw.progress)),done};}
 function dailyFor(day){const def=tierOne[hash(day)%tierOne.length];return {day,id:def.id,progress:0,done:false};}
 function touchDaily(save,nowMs){
  const day=utcDay(nowMs);
  if(save.daily.day!==day)save.daily=dailyFor(day);
  if(save.streak.day&&dayNumber(day)-dayNumber(save.streak.day)>1)save.streak.count=0;
  return save.daily;
 }
 function stampDaily(save,day){
  const previous=save.streak.day;
  if(previous&&dayNumber(day)<=dayNumber(previous))return;
  save.streak.count=previous&&dayNumber(day)-dayNumber(previous)===1?add(save.streak.count,1):1;
  save.streak.day=day;save.streak.best=Math.max(save.streak.best,save.streak.count);
 }
 function dossiers(save){
  const found=new Set(Array.isArray(object(save).shards)?save.shards:[]),out=[];
  for(let n=1;n<=12;n++)if(['a','b','c'].every(letter=>found.has('s'+pad(n)+letter)))out.push(n);
  return out;
 }
 function options(save,input){const out={...object(input)};out.report=out.mode==='story'&&dossiers(save).length===12;return out;}
 const cosmeticByKey=new Map(LoopCatalog.cosmetics.map(c=>[c.key,c]));
 const signalDefs=()=>typeof SIGNALS!=='undefined'&&Array.isArray(SIGNALS)?SIGNALS:[];
 const signalId=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(id);
 const unique=(value,valid)=>[...new Set((Array.isArray(value)?value:[]).filter(valid))];
 function stakesMultiplier(ids,mode){
  if(mode==='daily'||mode==='benchmark')return 1;
  const stakes=typeof SandboxCampaign!=='undefined'?SandboxCampaign.STAKES:undefined;
  if(!Array.isArray(stakes))return 1;
  return unique(ids,id=>typeof id==='string').reduce((mult,id)=>{const rate=stakes.find(s=>s.id===id)?.rtMultiplier;return mult*(Number.isFinite(rate)&&rate>=1?rate:1);},1);
 }
 function grantKeys(save,n){const before=save.keys;save.keys=integer(add(before,integer(n)));const gained=save.keys-before;save.lifetimeKeys=integer(add(save.lifetimeKeys,gained));return gained;}
 function grantRT(save,n){const before=save.lifetimeRT;save.lifetimeRT=money(add(before,money(n)));derive(save);return money(save.lifetimeRT-before);}
 function grantCosmetic(save,key){if(!cosmeticByKey.has(key)||save.cosmetics.includes(key))return false;save.cosmetics.push(key);return true;}
 function equip(save,key){
  const c=cosmeticByKey.get(key);if(!c||!save.cosmetics.includes(key))return false;
  save.equipped[c.kind]=save.equipped[c.kind]===c.id?'':c.id;return true;
 }
 function signalUnlocked(save,entry){
  const gate=object(entry?.unlock),n=integer(gate.value),totals=save.totals;
  switch(gate.type){
   case 'always':return true;
   case 'sector':return n>=1&&n<=12&&(save.reachedSector>=n||Object.keys(save.firstClears).some(k=>Number(k.split(':')[1])+1>=n));
   case 'runs':return totals.runs>=n;
   case 'shards':return save.shards.length>=n;
   case 'boss':return own(bossMetrics,gate.value)?totals[bossMetrics[gate.value]]>0:typeof gate.value==='number'&&totals.bossKills>=n;
   case 'surge':return totals.surges>=n;
   case 'grade':return (gate.value==='S'||gate.value==='SS')&&Object.values(save.bestGrades).some(g=>grades.indexOf(g)>=grades.indexOf(gate.value));
   case 'decrypted':return save.decrypted.length>=n;
   default:return false;
  }
 }
 function availableSignals(save,entries=signalDefs()){return entries.filter(e=>signalId(e?.id)&&signalUnlocked(save,e));}
 function claimSignal(save,entry){
  if(save.decrypted.includes(entry.id))return null;
  save.decrypted.push(entry.id);
  return {id:entry.id,rt:grantRT(save,object(entry.reward).rt),cosmetic:grantCosmetic(save,object(entry.reward).cosmetic)?entry.reward.cosmetic:null};
 }
 function decrypt(save,id,entries=signalDefs()){
  const entry=entries.find(e=>e.id===id);if(!entry||!signalUnlocked(save,entry)||save.decrypted.includes(id)||save.keys<integer(entry.cost))return null;
  save.keys-=integer(entry.cost);return claimSignal(save,entry);
 }
 // A per-id substitution is cosmetic ciphertext, never a security mechanism.
 function cipher(id,text,step=0,revealed=0){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',salt=hash(id+':'+step);
  return String(text).split('').map((c,i)=>i<revealed||c==='_'||c===' '?c:alphabet[(hash(c+':'+i)+salt)%alphabet.length]).join('');
 }
 function packetReward(raw){
  raw=object(raw);const reward={rt:money(raw.rt),keys:integer(raw.keys)};
  if(cosmeticByKey.has(raw.cosmetic))reward.cosmetic=raw.cosmetic;
  if(signalId(raw.lore))reward.lore=raw.lore;
  return reward;
 }
 function packetClaim(raw){const reward=packetReward(raw);return {...reward,cosmetic:reward.cosmetic||null,lore:reward.lore||null,loreCosmetic:cosmeticByKey.has(object(raw).loreCosmetic)?raw.loreCosmetic:null};}
 function hydrateEconomy(save,raw){
  save.keys=integer(raw.keys);save.lifetimeKeys=Math.max(save.keys,integer(raw.lifetimeKeys));
  save.cosmetics=unique(raw.cosmetics,id=>cosmeticByKey.has(id));save.decrypted=unique(raw.decrypted,signalId);
  save.signalSeen=unique(raw.signalSeen,signalId);save.equipped={cloak:'',trail:'',visor:'',title:''};
  for(const kind of Object.keys(save.equipped)){const id=object(raw.equipped)[kind];if(save.cosmetics.includes(kind+':'+id))save.equipped[kind]=id;}
  save.reachedSector=Math.min(12,integer(raw.reachedSector));
  save.packetCounter=integer(raw.packetCounter);save.pity={rare:Math.min(3,integer(object(raw.pity).rare)),epic:Math.min(11,integer(object(raw.pity).epic))};
  save.packets=[];const seen=new Set();
  for(const p of Array.isArray(raw.packets)?raw.packets:[]){
   if(!p||!Number.isSafeInteger(p.serial)||p.serial<1||seen.has(p.serial)||!LoopCatalog.rarities.includes(p.rarity)||typeof p.source!=='string')continue;
   seen.add(p.serial);save.packetCounter=Math.max(save.packetCounter,p.serial);
   save.packets.push({serial:p.serial,source:p.source.slice(0,16),rarity:p.rarity,reward:packetReward(p.reward),opened:p.opened===true,...(p.opened===true&&p.claim?{claim:packetClaim(p.claim)}:{})});
  }
 }
 function resultSeed(result){
  // Explicit fields keep property insertion order, wall time and UI state out.
  return hash(JSON.stringify([result.version,result.seed,result.mode||result.options?.mode,result.difficulty||result.options?.difficulty,result.ticks,result.durationMs,result.reward,result.score,result.distance,result.won,result.hits,result.bestChain,result.surges,Array.isArray(result.shards)?[...result.shards].sort():[],result.grades||[],Array.isArray(result.stakes)?[...result.stakes].sort():[]]));
 }
 function sealPackets(save,result,count=1){
  const source=resultSeed(object(result)).toString(16),sealed=[];
  const reserved=new Set(save.cosmetics),lore=new Set(save.decrypted);
  for(const p of save.packets)if(!p.opened){if(p.reward.cosmetic)reserved.add(p.reward.cosmetic);if(p.reward.lore)lore.add(p.reward.lore);}
  // Retain all unopened packets; only old opened display history is expendable.
  const history=save.packets.filter(p=>p.opened).slice(-24);
  save.packets=save.packets.filter(p=>!p.opened).concat(history);
  for(let i=0;i<Math.max(1,Math.min(3,integer(count)));i++){
   const serial=++save.packetCounter;let seed=hash(source+':'+serial);
   const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   const roll=random();let rank=roll<.015?3:roll<.10?2:roll<.35?1:0;
   if(save.pity.epic>=11)rank=Math.max(2,rank);else if(save.pity.rare>=3)rank=Math.max(1,rank);
   save.pity.rare=rank>=1?0:save.pity.rare+1;save.pity.epic=rank>=2?0:save.pity.epic+1;
   const reward={rt:[20,60,150,360][rank]+Math.floor(random()*[21,41,101,201][rank]),keys:[1,2,4,8][rank]};
   let pool=[];
   for(let tier=rank;tier>=0&&!pool.length;tier--)pool=LoopCatalog.cosmetics.filter(c=>!reserved.has(c.key)&&c.rarity===LoopCatalog.rarities[tier]);
   if(pool.length&&(rank>0||random()<.28)){reward.cosmetic=pool[Math.floor(random()*pool.length)].key;reserved.add(reward.cosmetic);}
   const messages=availableSignals(save).filter(e=>!lore.has(e.id));
   if(messages.length&&(rank>=2||random()<.13)){reward.lore=messages[Math.floor(random()*messages.length)].id;lore.add(reward.lore);}
   const packet={serial,source,rarity:LoopCatalog.rarities[rank],reward,opened:false};save.packets.push(packet);sealed.push(serial);
  }
  return sealed;
 }
 function openPacket(save,serial){
  const packet=save.packets.find(p=>p.serial===serial);if(!packet||packet.opened)return null;
  packet.opened=true;const reward=packet.reward,cosmetic=grantCosmetic(save,reward.cosmetic);
  const rt=grantRT(save,reward.rt+(reward.cosmetic&&!cosmetic?60:0)),keys=grantKeys(save,reward.keys);
  const entry=signalDefs().find(e=>e.id===reward.lore),lore=entry?claimSignal(save,entry):null;
  packet.claim={rt:money(rt+(lore?.rt||0)),keys,cosmetic:cosmetic?reward.cosmetic:null,lore:lore?.id||null,loreCosmetic:lore?.cosmetic||null};
  return {serial,rarity:packet.rarity,...packet.claim};
 }
 function hydrate(raw,nowMs){
  if(typeof raw==='string'){try{raw=JSON.parse(raw);}catch{raw={};}}
  raw=object(raw);
  const save={version:VERSION,lifetimeRT:money(raw.lifetimeRT),epoch:1,unlocks:[],sprints:integer(raw.sprints),multiplier:1,tickets:[],evals:[],streak:{day:'',count:0,best:0},daily:dailyFor(utcDay(nowMs)),bestGrades:{},shards:[],read:{},lines:{},lastSession:time(raw.lastSession),lastNight:validDay(raw.lastNight)?raw.lastNight:'',totals:counters(),firstClears:{},prefs:{modifier:'none',title:'protocol'},pendingRT:0,pendingBonuses:bonuses()};
  hydrateEconomy(save,raw);
  derive(save);
  save.evals=[...new Set((Array.isArray(raw.evals)?raw.evals:[]).filter(id=>evalIds.has(id)))];
  save.shards=[...new Set((Array.isArray(raw.shards)?raw.shards:[]).filter(shardId))].sort();
  const read=object(raw.read),lines=object(raw.lines),firstClears=object(raw.firstClears),bestGrades=object(raw.bestGrades),totals=object(raw.totals),streak=object(raw.streak),prefs=object(raw.prefs);
  for(const sector of dossiers(save)){const id='d'+pad(sector);if(read[id]===true)save.read[id]=true;}
  for(const id of Object.keys(lines))if(lineId(id)&&lines[id]===true)save.lines[id]=true;
  for(const difficulty of ['hard','expert','nightmare'])for(let stage=0;stage<12;stage++){
   const key=difficulty+':'+stage;if(firstClears[key]===true)save.firstClears[key]=true;
   if(grades.includes(bestGrades[key]))save.bestGrades[key]=bestGrades[key];
  }
  for(const metric of metrics)save.totals[metric]=number(totals[metric]);
  if(validDay(streak.day)){save.streak.day=streak.day;save.streak.count=integer(streak.count);}
  save.streak.best=Math.max(save.streak.count,integer(streak.best));
  const selected=new Set();
  for(const value of Array.isArray(raw.tickets)?raw.tickets:[]){
   const row=object(value),def=ticketById.get(row.id);
   if(def&&!selected.has(def.id)){selected.add(def.id);save.tickets.push(normalizeTicket(row,def));if(save.tickets.length===3)break;}
  }
  for(const row of [...draw(save.sprints),...LoopCatalog.tickets])if(save.tickets.length<3&&!selected.has(row.id)){selected.add(row.id);save.tickets.push({id:row.id,progress:0,done:false});}
  const daily=object(raw.daily),expected=dailyFor(utcDay(nowMs));
  if(daily.day===expected.day&&daily.id===expected.id)save.daily={day:expected.day,...normalizeTicket(daily,ticketById.get(expected.id))};
  // Old ledgers did not retain finished ticket identities. Recover only identities
  // still evidenced by a closed active/daily ticket; never invent past completions.
  save.ticketsClosed=unique([...(Array.isArray(raw.ticketsClosed)?raw.ticketsClosed:[]),...save.tickets.filter(t=>t.done).map(t=>t.id),...(daily.done===true&&validDay(daily.day)?[daily.id]:[])],id=>ticketById.has(id));
  const archiveBase=object(raw.archiveBaseline);
  save.archiveBaseline={earned:integer(archiveBase.earned),total:integer(archiveBase.total)};
  touchDaily(save,nowMs);
  if(typeof prefs.modifier==='string'&&isUnlocked(save,'modifier',prefs.modifier))save.prefs.modifier=prefs.modifier;
  if(typeof prefs.title==='string'&&isUnlocked(save,'title',prefs.title))save.prefs.title=prefs.title;
  const pending=object(raw.pendingBonuses);
  for(const kind of bonusKinds){const value=money(Math.min(MAX_RT-save.pendingRT,number(pending[kind])));save.pendingBonuses[kind]=value;save.pendingRT=money(save.pendingRT+value);}
  // Preserve scalar-only saves too; the category was not recoverable, the RT is.
  const extra=money(Math.max(0,money(raw.pendingRT)-save.pendingRT));
  save.pendingBonuses.tickets=money(save.pendingBonuses.tickets+extra);save.pendingRT=money(save.pendingRT+extra);
  return save;
 }
 function context(save,input,nowMs){
  const opts=options(save,input),base=object(opts.counterBase),counterBase={};
  for(const [metric,field] of Object.entries(resultFields))if(Number.isFinite(base[metric])||Number.isFinite(base[field]))counterBase[metric]=number(Number.isFinite(base[metric])?base[metric]:base[field]);
  if(Number.isFinite(base.bestChain))counterBase.bestChain=number(base.bestChain);
  const stage=Number.isFinite(base.stage)?integer(base.stage):integer(opts.startStage);
  // Do not retain a caller's mutable core state as part of the model session.
  const shardBase=new Set((Array.isArray(base.shards)?base.shards:[]).filter(shardId));
  delete opts.counterBase;
  return {options:opts,demo:opts.demo===true,multiplier:Math.min(30,1+integer(save.sprints)),stakesMultiplier:stakesMultiplier(opts.stakes,opts.mode),startedAt:time(nowMs),day:utcDay(nowMs),rewardBase:number(opts.rewardBase),distanceBase:number(opts.distanceBase),restored:number(opts.rewardBase)>0||number(opts.distanceBase)>0,counterBase,shardBase,runShards:new Set(),counters:counters(),observed:counters(),bestBefore:number(save.totals.bestChain),stage,startStage:stage,sectors:new Set(),bosses:new Set(),seen:new WeakSet(),tickets:[],evals:[],sprints:0,bonuses:bonuses(),carryover:number(save.pendingRT),grade:'D',receipt:null};
 }
 function begin(save,input,nowMs){
  const session=context(save,input,nowMs);if(session.demo)return session;
  save.reachedSector=Math.max(save.reachedSector,Math.min(12,session.startStage%12+1));
  touchDaily(save,nowMs);save.lastSession=time(nowMs);
  for(const row of save.tickets)if(!row.done&&ticketById.get(row.id).scope==='run')row.progress=0;
  if(!save.daily.done&&ticketById.get(save.daily.id).scope==='run')save.daily.progress=0;
  if(session.options.mode==='daily')stampDaily(save,session.day);
  return session;
 }
 function grant(save,session,kind,rt){
  rt=number(rt);const weight=session.multiplier*session.stakesMultiplier,value=money(Math.min(MAX_RT-save.pendingRT,rt*weight));
  session.bonuses[kind]=add(session.bonuses[kind],value/weight);
  save.pendingBonuses[kind]=money(save.pendingBonuses[kind]+value);save.pendingRT=money(save.pendingRT+value);
 }
 function setMetric(save,session,metric,value,delta){
  value=number(value);const previous=session.counters[metric];if(value===previous)return;
  session.counters[metric]=value;delta[metric]=(delta[metric]||0)+value-previous;
  // Distance/reward accumulate run deltas; a best chain is a lifetime maximum.
  save.totals[metric]=metric==='bestChain'?Math.max(session.bestBefore,value):number(save.totals[metric]+value-previous);
 }
 function bump(save,session,metric,delta,amount=1){session.observed[metric]=add(session.observed[metric],amount);setMetric(save,session,metric,Math.max(session.counters[metric],session.observed[metric]),delta);}
 function peak(save,session,metric,value,delta){if(Number.isFinite(value))setMetric(save,session,metric,Math.max(session.counters[metric],number(value)),delta);}
 function collectShard(save,id,notices){
  if(!shardId(id)||save.shards.includes(id))return;
  save.shards.push(id);save.shards.sort();const sector=Number(id.slice(1,3)),unlocked=['a','b','c'].every(letter=>save.shards.includes('s'+pad(sector)+letter));
  notices.push({type:'shard',id,unlocked:unlocked?sector:null,all:save.shards.length===36});
 }
 function defeatBoss(save,session,id,stage,delta){
  if(!own(bossMetrics,id))return;
  const key=Math.floor(stage/12)+':'+id;if(session.bosses.has(key))return;session.bosses.add(key);
  bump(save,session,'bossKills',delta);bump(save,session,bossMetrics[id],delta);grant(save,session,'bosses',25);
 }
 function completeSector(save,session,value,delta,notices){
  const stats=object(value);if(!Number.isInteger(stats.stage)||stats.stage<0)return;
  const stage=stats.stage;if(session.sectors.has(stage))return;session.sectors.add(stage);
  const sector=stage%12,key=(['hard','expert','nightmare'].includes(session.options.difficulty)?session.options.difficulty:'hard')+':'+sector;
  save.reachedSector=Math.max(save.reachedSector,Math.min(12,sector+2));
  bump(save,session,'sectors',delta);
  if(stats.hits===0){bump(save,session,'cleanSectors',delta);if(own(cleanBoss,sector))bump(save,session,cleanBoss[sector],delta);}
  if(stats.grade==='S'||stats.grade==='SS')bump(save,session,'sSectors',delta);
  if(stats.grade==='SS')bump(save,session,'ssSectors',delta);
  if(grades.includes(stats.grade)){
   if(grades.indexOf(stats.grade)>grades.indexOf(session.grade))session.grade=stats.grade;
   const previous=save.bestGrades[key];if(!previous||grades.indexOf(stats.grade)>grades.indexOf(previous)){save.bestGrades[key]=stats.grade;notices.push({type:'grade',stage:sector,sector:sector+1,grade:stats.grade,previous:previous||null,difficulty:session.options.difficulty||'hard'});}
  }
  if(!save.firstClears[key]){save.firstClears[key]=true;grant(save,session,'firstClears',50);notices.push({type:'firstClear',stage:sector,difficulty:session.options.difficulty||'hard',rt:50});}
  if(own(sectorBoss,sector))defeatBoss(save,session,sectorBoss[sector],stage,delta);
 }
 function saveMetric(save,metric){
  switch(metric){
   case 'shards':return save.shards.length;
   case 'filesRead':return dossiers(save).reduce((n,sector)=>n+(save.read['d'+pad(sector)]===true?1:0),0);
   case 'dossiers':return dossiers(save).length;
   case 'streak':return save.streak.count;
   case 'sprints':return save.sprints;
   case 'epoch':return save.epoch;
   case 'evals':return save.evals.length;
   default:return 0;
  }
 }
 function evaluate(save,session,notices){
  let changed;
  do{
   changed=false;
   for(const def of LoopCatalog.evals){
    if(save.evals.includes(def.id))continue;
    const value=def.scope==='save'?saveMetric(save,def.metric):def.scope==='total'?save.totals[def.metric]:session.counters[def.metric];
    if(Number.isFinite(value)&&value>=def.target){save.evals.push(def.id);session.evals.push({...def});grant(save,session,'evals',def.rt);notices.push({...def,type:'eval'});changed=true;}
   }
  }while(changed);
 }
 function advanceTickets(save,session,delta,chain,notices){
  function advance(row,daily){
   if(row.done)return;const def=ticketById.get(row.id);if(!def)return;
   if(def.metric==='bestChain'){
    const sample=Number.isFinite(chain)?number(chain):delta.bestChain>0?session.counters.bestChain:0;
    row.progress=Math.min(def.target,Math.max(row.progress,sample));
   }else row.progress=Math.max(0,Math.min(def.target,row.progress+(delta[def.metric]||0)));
   if(row.progress<def.target)return;
   row.done=true;const rt=def.rt*(daily?3:1),notice={type:'ticket',id:def.id,title:def.title,rt,daily:!!daily,...(daily?{day:row.day}:{})};
   if(!save.ticketsClosed.includes(def.id))save.ticketsClosed.push(def.id);
   grant(save,session,'tickets',rt);session.tickets.push(notice);notices.push(notice);
  }
  // Exactly one pass over the old sprint. A closing event never reaches its
  // replacement tickets, even when several metrics changed in this event.
  for(const row of save.tickets)advance(row,false);
  if(session.options.mode==='daily'&&save.daily.day===session.day)advance(save.daily,true);
  if(save.tickets.every(row=>row.done)){
   save.sprints=Math.min(MAX,save.sprints+1);save.multiplier=Math.min(30,1+save.sprints);session.sprints++;
   save.tickets=draw(save.sprints,save.tickets.map(t=>t.id));notices.push({type:'sprint',multiplier:save.multiplier,sprints:save.sprints});
  }
 }
 function sampleState(save,session,state,delta){
  if(Number.isFinite(state.stage))session.stage=integer(state.stage);
  if(Number.isFinite(state.reward))peak(save,session,'reward',Math.max(0,state.reward-session.rewardBase),delta);
  if(Number.isFinite(state.distance))peak(save,session,'distance',Math.max(0,state.distance-session.distanceBase),delta);
  if(Number.isFinite(state.chain))peak(save,session,'bestChain',state.chain,delta);
  if(!session.restored||Number.isFinite(session.counterBase.bestChain)&&state.bestChain>session.counterBase.bestChain)peak(save,session,'bestChain',state.bestChain,delta);
  if(Number.isFinite(state.score)&&state.score>=10000)peak(save,session,'goodhart',1,delta);
 }
 function event(save,session,input,state){
  const e=object(input);state=object(state);
  if(session?.demo)return [];
  // Reading is also supported at the title/results screen. It does not begin a
  // run, reset tickets, change the streak, or invalidate a settled receipt.
  if(!session||session.receipt){if(e.type!=='read')return [];session=context(save,{},save.lastSession);}
  if(session.seen.has(e))return [];session.seen.add(e);
  const notices=[],delta={};
  if(Number.isFinite(state.stage))session.stage=integer(state.stage);
  if(own(countEvents,e.type))bump(save,session,countEvents[e.type],delta);
  switch(e.type){
   case 'clear':{
    const obstacle=typeof e.obstacle==='string'?e.obstacle:object(e.obstacle).type;
    const metric=obstacle==='barrier'?'barriers':obstacle==='gate'?'gates':obstacle==='gap'?'gaps':null;if(metric)bump(save,session,metric,delta);break;
   }
   case 'perfect':if(Number.isFinite(e.frames)&&e.frames>=0&&e.frames<=4)bump(save,session,'fourFrames',delta);break;
   case 'bossDefeated':defeatBoss(save,session,typeof e.boss==='string'?e.boss:object(e.boss).id,session.stage,delta);break;
   case 'shard':if(shardId(e.id)&&!session.shardBase.has(e.id))session.runShards.add(e.id);collectShard(save,e.id,notices);break;
   case 'sectorComplete':completeSector(save,session,e.stats,delta,notices);break;
   case 'score':case 'reward':
    if(Number.isFinite(e.points))bump(save,session,'reward',delta,number(e.points));
    else if(Number.isFinite(e.reward))peak(save,session,'reward',Math.max(0,e.reward-session.rewardBase),delta);
    break;
   case 'chain':case 'chainBreak':peak(save,session,'bestChain',e.chain,delta);break;
   case 'read':if(dossierId(e.id)&&dossiers(save).includes(Number(e.id.slice(1))))save.read[e.id]=true;break;
  }
  sampleState(save,session,state,delta);
  const chain=Number.isFinite(e.chain)?e.chain:Number.isFinite(state.chain)?state.chain:undefined;
  advanceTickets(save,session,delta,chain,notices);evaluate(save,session,notices);
  return notices;
 }
 function reconcile(save,session,result,delta,notices){
  for(const [metric,field] of Object.entries(resultFields)){
   const value=Number.isFinite(result[metric])?result[metric]:result[field];
   if(Number.isFinite(value)&&(!session.restored||own(session.counterBase,metric))){
    const attempt=Math.max(0,value-(session.counterBase[metric]||0));
    // Core's endless `papers` is only the current suite, unlike event checks.
    setMetric(save,session,metric,metric==='checks'&&session.options.mode==='endless'&&!Number.isFinite(result.checks)?Math.max(session.counters.checks,attempt):attempt,delta);
   }
  }
  if(Number.isFinite(result.reward))setMetric(save,session,'reward',Math.max(0,result.reward-session.rewardBase),delta);
  if(Number.isFinite(result.distance))setMetric(save,session,'distance',Math.max(0,result.distance-session.distanceBase),delta);
  if(Number.isFinite(result.bestChain)&&(!session.restored||Number.isFinite(session.counterBase.bestChain)&&result.bestChain>session.counterBase.bestChain))setMetric(save,session,'bestChain',result.bestChain,delta);
  for(const stats of Array.isArray(result.stages)?result.stages:[])if(!session.restored||object(stats).stage>=session.startStage)completeSector(save,session,stats,delta,notices);
  for(const id of Array.isArray(result.shards)?result.shards:[]){if(shardId(id)&&!session.shardBase.has(id))session.runShards.add(id);collectShard(save,id,notices);}
  for(const grade of Array.isArray(result.grades)?result.grades:[])if(grades.includes(grade)&&grades.indexOf(grade)>grades.indexOf(session.grade))session.grade=grade;
  setMetric(save,session,'runs',1,delta);
  setMetric(save,session,'zeroChecks',(Number.isFinite(result.papers)?result.papers:session.counters.checks)===0?1:0,delta);
  if(Number.isFinite(result.score))setMetric(save,session,'goodhart',result.score>=10000?1:0,delta);
  const won=result.won===true;
  setMetric(save,session,'wins',won?1:0,delta);
  setMetric(save,session,'expertWins',won&&session.options.difficulty==='expert'?1:0,delta);
  setMetric(save,session,'nightmareWins',won&&session.options.difficulty==='nightmare'?1:0,delta);
  setMetric(save,session,'dailyRuns',session.options.mode==='daily'?1:0,delta);
  const report=won&&session.options.mode==='story'&&session.options.report&&(Array.isArray(result.decisions)?result.decisions:[]).some(d=>object(d).id==='exit-choice'&&d.route===0);
  setMetric(save,session,'reportEndings',report?1:0,delta);
 }
 function nearest(save){
  const next=progress(save.lifetimeRT);if(next.epoch<40)return {kind:'epoch',epoch:next.epoch+1,remaining:next.remaining};
  let goal=null;
  for(const row of save.tickets){const def=ticketById.get(row.id);if(!row.done&&(!goal||(def.target-row.progress)/def.target<goal.fraction))goal={kind:'ticket',id:row.id,remaining:def.target-row.progress,fraction:(def.target-row.progress)/def.target};}
  return goal;
 }
 function settle(save,session,input,nowMs){
  if(session.receipt)return session.receipt;
  const result=object(input),beforeRT=money(save.lifetimeRT),beforeEpoch=epochFor(beforeRT);
  if(session.demo){
   const grade=(Array.isArray(result.grades)?result.grades:[]).reduce((best,value)=>grades.includes(value)&&grades.indexOf(value)>grades.indexOf(best)?value:best,'D');
   session.receipt={beforeRT,afterRT:beforeRT,gained:0,base:0,bonuses:bonuses(),multiplier:session.multiplier,beforeEpoch,epoch:beforeEpoch,unlocks:[],tickets:[],evals:[],sprints:0,grade,notices:[]};return session.receipt;
  }
  // The recorded result is authoritative. Reweight only this attempt's bonuses;
  // carryover RT was already weighted by the run that earned it.
  const stakes=stakesMultiplier(result.stakes,session.options.mode),difference=stakes-session.stakesMultiplier;
  for(const kind of bonusKinds){const extra=session.bonuses[kind]*session.multiplier*difference;save.pendingBonuses[kind]=money(save.pendingBonuses[kind]+extra);save.pendingRT=money(save.pendingRT+extra);}
  session.stakesMultiplier=stakes;
  // A run keeps the UTC ticket it accepted, even if its final tick crosses midnight.
  const notices=[],delta={};if(save.daily.day!==session.day)touchDaily(save,nowMs);
  reconcile(save,session,result,delta,notices);advanceTickets(save,session,delta,undefined,notices);evaluate(save,session,notices);
  const base=session.counters.reward/100;
  // Epoch/eval-count evals can themselves cross an epoch. Each definition is
  // awarded once, so this fixed point terminates after at most catalog.length.
  let previous;
  do{
   previous=save.evals.length;
   save.lifetimeRT=money(beforeRT+base*session.multiplier*stakes+save.pendingRT);save.epoch=epochFor(save.lifetimeRT);
   evaluate(save,session,notices);
  }while(save.evals.length!==previous);
  derive(save);
  const rates=LoopCatalog.keyRates,keysBefore=save.keys,keySources={shards:session.runShards.size*rates.shard,bosses:session.counters.bossKills*rates.boss,grades:session.counters.sSectors*rates.s+session.counters.ssSectors*(rates.ss-rates.s),surges:session.counters.surges*rates.surge,refusals:session.counters.refusals*rates.refusal};
  const keysGained=grantKeys(save,Object.values(keySources).reduce((n,v)=>n+v,0));
  const packets=sealPackets(save,result,1+(result.won===true?1:0)+(session.counters.bossKills>0||session.counters.sSectors>=3?1:0));
  const paid=Object.fromEntries(bonusKinds.map(kind=>[kind,save.pendingBonuses[kind]/session.multiplier]));
  session.receipt={beforeRT,afterRT:save.lifetimeRT,gained:money(save.lifetimeRT-beforeRT),base,bonuses:paid,multiplier:session.multiplier,stakesMultiplier:stakes,keys:{before:keysBefore,after:save.keys,gained:keysGained,sources:keySources},packets,beforeEpoch,epoch:save.epoch,unlocks:LoopCatalog.unlocks.filter(u=>u.epoch>beforeEpoch&&u.epoch<=save.epoch).map(u=>({...u})),tickets:session.tickets.slice(),evals:session.evals.slice(),sprints:session.sprints,grade:session.grade,nearest:nearest(save),carryover:session.carryover,notices};
  save.pendingRT=0;save.pendingBonuses=bonuses();save.lastSession=time(nowMs);
  return session.receipt;
 }
 function markLine(save,id){if(!lineId(id)||save.lines[id]===true)return false;save.lines[id]=true;return true;}
 return {VERSION,KEY,hydrate,epochFor,threshold,progress,utcDay,touchDaily,dossiers,options,begin,event,settle,requirement,isUnlocked,markLine,stakesMultiplier,grantKeys,grantRT,grantCosmetic,equip,signalUnlocked,availableSignals,decrypt,cipher,resultSeed,sealPackets,openPacket};
})();
