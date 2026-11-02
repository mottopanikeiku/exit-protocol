/* Pure archive arithmetic and honest near-goal selection. Completion is a count
   of unique authored items, not an average of unequal category percentages.
   Race owns its persistent medal/PB identities; only bounded counts enter here. */
const ArchiveModel=(()=>{
 const C=LoopCatalog,M=LoopModel;
 const number=n=>Number.isFinite(n)?Math.max(0,n):0;
 const array=v=>Array.isArray(v)?v:[];
 const count=(values,valid)=>new Set(array(values).filter(valid)).size;
 const text=n=>number(n).toLocaleString('en-US',{maximumFractionDigits:2});
 const seconds=ms=>(number(ms)/1000).toFixed(2)+' s';
 const fraction=(value,target)=>target>0?Math.min(1,number(value)/target):0;
 const signals=()=>typeof SIGNALS==='undefined'?[]:SIGNALS;
 const forge=C.unlocks.filter(u=>['palette','chassis','visor','trail','title'].includes(u.kind));
 const kinds=['signal','bounty','rival','pb','epoch','pity'];
 function goal(kind,id,label,detail,value,target,action){
  if(!Number.isFinite(value)||!Number.isFinite(target)||target<=0)return null;
  const current=Math.min(target,number(value));return {kind,id,label,detail,current,target,progress:fraction(current,target),remaining:Math.max(0,target-current),action};
 }
 function selectNudges(candidates,limit=3){
  const seen=new Set();return array(candidates).filter(g=>g&&typeof g.id==='string'&&Number.isFinite(g.progress)&&g.progress>=0&&g.progress<=1&&Number.isFinite(g.remaining)&&g.remaining>=0)
   .sort((a,b)=>b.progress-a.progress||kinds.indexOf(a.kind)-kinds.indexOf(b.kind)||a.id.localeCompare(b.id))
   .filter(g=>{if(seen.has(g.kind))return false;seen.add(g.kind);return true;}).slice(0,Math.min(3,Math.max(0,Math.floor(number(limit)))));
 }
 function signalGoal(save){
  const rows=M.availableSignals(save).filter(e=>!save.decrypted.includes(e.id)).sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id));
  const e=rows[0];if(!e)return null;
  const left=Math.max(0,e.cost-save.keys);
  return goal('signal',e.id,left?text(left)+' KEY'+(left===1?'':'S')+' TO '+e.id.toUpperCase():'DECRYPT '+e.id.toUpperCase()+' NOW','◆ '+text(save.keys)+' / '+e.cost+' KEYS · '+e.from,save.keys,Math.max(1,e.cost),'signals');
 }
 function nudges(save,race={}){
  const goals=[],pb=race?.pb,rival=race?.rival;
  if(pb&&Number.isFinite(pb.currentMs)&&pb.currentMs>0&&Number.isFinite(pb.previousMs)&&pb.previousMs>0&&pb.currentMs>=pb.previousMs){
   const delta=pb.currentMs-pb.previousMs;goals.push(goal('pb','pb-'+pb.stage,delta?seconds(delta)+' FROM YOUR PB':'LEVEL WITH YOUR PB','SECTOR '+String(pb.stage+1).padStart(2,'0')+' · '+seconds(pb.currentMs)+' / PB '+seconds(pb.previousMs),pb.previousMs,pb.currentMs,'runback'));
  }
  if(rival&&Number.isFinite(rival.playerMs)&&rival.playerMs>0&&Number.isFinite(rival.timeMs)&&rival.timeMs>0&&rival.playerMs>=rival.timeMs){
   goals.push(goal('rival','rival-'+rival.id,seconds(rival.playerMs-rival.timeMs)+' FROM '+rival.name,'SECTOR '+String(rival.stage+1).padStart(2,'0')+' · '+seconds(rival.playerMs)+' / '+seconds(rival.timeMs),rival.timeMs,rival.playerMs,'runback'));
  }
  for(const b of array(race?.bounties))if(!b.done&&b.target-b.value===1)goals.push(goal('bounty','bounty-'+b.id,'ONE MORE / '+b.label,text(b.value)+' / '+text(b.target)+' THIS RUN',b.value,b.target,'runback'));
  const signal=signalGoal(save);if(signal)goals.push(signal);
  const p=M.progress(save.lifetimeRT),unlock=C.unlocks.find(u=>u.epoch===p.epoch+1);
  if(p.epoch<40)goals.push(goal('epoch','epoch-'+(p.epoch+1),text(p.remaining)+' RT TO EPOCH '+(p.epoch+1),unlock?.label||'NEXT EPOCH',save.lifetimeRT-p.start,p.end-p.start,'runback'));
  const epic=Math.min(11,number(save.pity?.epic));goals.push(goal('pity','epic-pity','EPIC GUARANTEED IN '+(12-epic)+' PACKET'+(12-epic===1?'':'S'),text(epic)+' / 12 NEW PACKETS SEALED SINCE EPIC OR BETTER',epic,12,'packets'));
  return selectNudges(goals);
 }
 function evalProgress(save,def,run){
  if(def.scope==='total')return number(save.totals[def.metric]);
  if(def.scope==='run')return number(run?.[def.metric]);
  return number(({shards:save.shards.length,filesRead:Object.keys(save.read).length,dossiers:M.dossiers(save).length,streak:save.streak.count,sprints:save.sprints,epoch:save.epoch,evals:save.evals.length})[def.metric]);
 }
 function archive(save,race={},run={}){
  const defs=signals(),signalIds=new Set(defs.map(e=>e.id)),cosmeticIds=new Set(C.cosmetics.map(c=>c.key)),ticketIds=new Set(C.tickets.map(t=>t.id)),evalIds=new Set(C.evals.map(e=>e.id));
  const categories=[];
  const add=(id,label,earned,total,next)=>{earned=Math.min(total,Math.floor(number(earned)));categories.push({id,label,earned,total,progress:fraction(earned,total),next:earned<total?next:null});};
  const signal=signalGoal(save),lockedSignal=defs.find(e=>!save.decrypted.includes(e.id));
  add('signals','SIGNALS',count(save.decrypted,id=>signalIds.has(id)),defs.length,signal||{label:lockedSignal?'Unlock '+lockedSignal.id.toUpperCase():'No locked intercepts',detail:lockedSignal?'GATE / '+lockedSignal.unlock.type.toUpperCase()+' '+lockedSignal.unlock.value:'',progress:0,action:'signals'});
  const shardIds=new Set(array(save.shards).filter(id=>/^s(?:0[1-9]|1[0-2])[abc]$/.test(id)));
  const shardSectors=Array.from({length:12},(_,stage)=>({stage,found:['a','b','c'].filter(c=>shardIds.has('s'+String(stage+1).padStart(2,'0')+c)).length})).filter(s=>s.found<3).sort((a,b)=>b.found-a.found||a.stage-b.stage);
  const shard=shardSectors[0];
  add('shards','SHARDS',shardIds.size,36,shard?{label:'SECTOR '+String(shard.stage+1).padStart(2,'0')+' / NEXT SHARD',detail:shard.found+' / 3 RECOVERED IN THIS SECTOR',progress:shard.found/3,action:'dossier'}:null);
  const epochCosmetics=forge.filter(u=>M.isUnlocked(save,u.kind,u.id)),lockedForge=forge.find(u=>!M.isUnlocked(save,u.kind,u.id));
  const missingCosmetic=C.cosmetics.find(c=>!save.cosmetics.includes(c.key));
  const giftSignal=M.availableSignals(save).filter(e=>cosmeticIds.has(e.reward?.cosmetic)&&!save.cosmetics.includes(e.reward.cosmetic)&&!save.decrypted.includes(e.id)).sort((a,b)=>a.cost-b.cost)[0];
  const cosmeticNext=giftSignal?{label:C.cosmetics.find(c=>c.key===giftSignal.reward.cosmetic).label,detail:giftSignal.id.toUpperCase()+' / ◆ '+text(save.keys)+' OF '+giftSignal.cost+' KEYS',progress:fraction(save.keys,Math.max(1,giftSignal.cost)),action:'signals'}:lockedForge?{label:lockedForge.label,detail:text(Math.max(0,M.threshold(lockedForge.epoch)-save.lifetimeRT))+' RT TO EPOCH '+lockedForge.epoch,progress:fraction(save.lifetimeRT,M.threshold(lockedForge.epoch)),action:lockedForge.kind==='title'?'modifiers':'forge'}:missingCosmetic?{label:missingCosmetic.label,detail:missingCosmetic.rarity.toUpperCase()+' PACKET POOL / NOT A GUARANTEED DROP',progress:0,action:'forge'}:null;
  add('cosmetics','COSMETICS',count(save.cosmetics,id=>cosmeticIds.has(id))+epochCosmetics.length,C.cosmetics.length+forge.length,cosmeticNext);
  const tickets=new Set(array(save.ticketsClosed)),active=[...save.tickets,save.daily].filter(t=>t&&!tickets.has(t.id)&&!t.done).map(t=>({row:t,def:C.tickets.find(d=>d.id===t.id)})).filter(t=>t.def).sort((a,b)=>fraction(b.row.progress,b.def.target)-fraction(a.row.progress,a.def.target));
  const ticket=active[0],undoneTicket=C.tickets.find(t=>!tickets.has(t.id));
  add('tickets','TICKETS',count(save.ticketsClosed,id=>ticketIds.has(id)),C.tickets.length,ticket?{label:ticket.def.id+' / '+ticket.def.title,detail:text(ticket.row.progress)+' / '+ticket.def.target+' · '+ticket.def.description,progress:fraction(ticket.row.progress,ticket.def.target),action:'runback'}:undoneTicket?{label:undoneTicket.id+' / '+undoneTicket.title,detail:'CLOSE THE CURRENT SPRINT FOR FRESH TICKETS',progress:0,action:'runback'}:null);
  const evaluations=C.evals.filter(e=>!save.evals.includes(e.id)).map(def=>({def,value:evalProgress(save,def,run)})).sort((a,b)=>fraction(b.value,b.def.target)-fraction(a.value,a.def.target));
  const evaluation=evaluations[0];
  add('evals','EVALS',count(save.evals,id=>evalIds.has(id)),C.evals.length,evaluation?{label:evaluation.def.name,detail:text(Math.min(evaluation.value,evaluation.def.target))+' / '+evaluation.def.target+' · '+evaluation.def.description,progress:fraction(evaluation.value,evaluation.def.target),action:'evals'}:null);
  const medal=race?.medals?.next,pb=race?.pbs?.next;
  add('medals','RIVAL MEDALS',number(race?.medals?.earned),36,{label:medal?medal.name+' / SECTOR '+String(medal.stage+1).padStart(2,'0'):'BEAT YOUR NEXT RIVAL',detail:medal?seconds(medal.timeMs)+' TO BEAT':'ONE MEDAL PER RIVAL PER SECTOR',progress:0,action:'sectors'});
  add('pbs','SECTOR PBs',number(race?.pbs?.earned),12,{label:pb?'RECORD SECTOR '+String(pb.stage+1).padStart(2,'0'):'RECORD A NEW SECTOR',detail:'FINISH THE WHOLE SECTOR IN STORY OR PRACTICE',progress:0,action:'sectors'});
  const earned=categories.reduce((n,c)=>n+c.earned,0),total=categories.reduce((n,c)=>n+c.total,0),next=categories.filter(c=>c.next).sort((a,b)=>b.next.progress-a.next.progress)[0];
  return {earned,total,percent:total?earned/total*100:0,categories,next:next?{category:next.id,...next.next}:null};
 }
 function gain(before,after){return before?.total>0&&after?.total>0?Math.max(0,after.percent-number(before.earned)/before.total*100):0;}
 return {archive,nudges,selectNudges,gain};
})();
