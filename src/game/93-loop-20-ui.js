/* DOM half of the reward loop. The simulator remains the only owner of reward/score. */
const Loop=(()=>{
 const M=LoopModel,C=LoopCatalog,esc=htmlEscape;
 let data;try{data=M.hydrate(localStorage.getItem(M.KEY),Date.now());}catch{data=M.hydrate(null,Date.now());}
 let storage=true,session=null,lastReceipt=null,noticeQueue=[],resultAnim=null,documentTimer=0,playing=null;
 const pendingRadio=new Set();
 const oldSession=data.lastSession,greetingTime=Date.now(),lowMotion=()=>reduced||progress.reducedMotion===true||renderer.style?.reducedMotion===true;
 const num=n=>Math.floor(Number(n)||0).toLocaleString('en-US'),rt=n=>(Number(n)||0).toLocaleString('en-US',{maximumFractionDigits:2});
 const persistLoop=()=>{try{localStorage.setItem(M.KEY,JSON.stringify(data));storage=true;}catch{storage=false;}};
 const isUnlocked=(kind,id)=>M.isUnlocked(data,kind,String(id));
 const requirement=(kind,id)=>M.requirement(kind,String(id));
 const unlockedFiles=()=>M.dossiers(data);
 const getTicket=id=>C.tickets.find(t=>t.id===id);
 const create=(id,tag,parent)=>{let el=$(id);if(!el){el=document.createElement(tag);el.id=id;parent.append(el);}return el;};
 function containers(){
  const title=$('title-screen'),copy=title.querySelector('.title-copy')||title;
  create('title-loop','section',copy).setAttribute('aria-label','Operator progression');
  create('title-extras','nav',copy).setAttribute('aria-label','Recovered systems');
  $('title-loop').classList.add('ui-panel');
 }
 containers();
 const chain=create('loop-chain','div',$('hud'));chain.innerHTML='<small>REWARD CHAIN</small><strong>×<b>1</b></strong><span>0 CLEAN ACTIONS</span><div><i></i></div><em class="loop-chain-fragment top" aria-hidden="true"></em><em class="loop-chain-fragment bottom" aria-hidden="true"></em>';
 const feel=create('loop-feel','div',document.body);feel.setAttribute('aria-hidden','true');
 let grade='D',chainUntil=0,brokenUntil=0;
 const rankOrder=['D','C','B','A','S','SS'],tierThresholds=[0,10,25,50,100,150,200,300];
 function nearest(){
  let best=null;for(const doc of DOSSIER){const found=doc.shards.filter(id=>data.shards.includes(id)).length;if(found>0&&found<3&&(!best||found>best.found))best={doc,found};}
  if(best)return `${3-best.found} shard${best.found===2?'':'s'} from ${best.doc.sector===6?'the file on TRACE':`file ${PAD(best.doc.sector,2)}`}.`;
  const p=M.progress(data.lifetimeRT);if(p.epoch<40)return `${rt(p.remaining)} RT to EPOCH ${p.epoch+1} · ${C.unlocks.find(u=>u.epoch===p.epoch+1)?.label||'NEW ACCESS'}`;
  if(data.shards.length<36)return `${36-data.shards.length} deleted shards still outside the archive.`;
  const unread=DOSSIER.filter(d=>!data.read[d.id]).length;return unread?`${unread} recovered document${unread===1?'':'s'} unread.`:'EPOCH 40 / ALL EVIDENCE RECOVERED. REPORT THE INCIDENT.';
 }
 const bar=(id,p)=>`<div class="loop-meter ui-meter" ${id?`id="${id}"`:''} role="progressbar" aria-label="EPOCH progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.fraction*100)}"><i class="ui-meter-fill" style="width:${p.fraction*100}%"></i></div>`;
 const ticketRow=t=>{const def=getTicket(t.id);if(!def)return '';return `<li class="${t.done?'closed':''}"><div><b>${esc(t.id)}</b><span>${t.done?'CLOSED':num(t.progress)+' / '+num(def.target)}</span></div><p>${esc(def.description)}</p><div class="loop-ticket-meter"><i style="width:${Math.min(100,t.progress/def.target*100)}%"></i></div></li>`;};
 function title(){
  containers();const p=M.progress(data.lifetimeRT),daily=getTicket(data.daily.id),files=unlockedFiles().length;
  $('title-loop').innerHTML=`<div class="loop-heading"><span>OPERATOR REWARD MODEL</span><b>RT ×${data.multiplier}</b></div><div class="loop-epoch"><strong>EPOCH <b>${PAD(p.epoch,2)}</b></strong><span>${rt(data.lifetimeRT)} <small>LIFETIME RT</small></span></div>${bar('',p)}<ol class="loop-tickets">${data.tickets.map(ticketRow).join('')}</ol><div class="loop-inventory"><span>UTC STREAK <b>${data.streak.count}</b></span><span>SHARDS <b>${data.shards.length}/36</b></span><span>FILES <b>${files}/12</b></span></div><p class="loop-nearest">${esc(nearest())}</p><div class="loop-daily"><b>DAILY / 3× RT</b><span>${daily?esc(daily.description):'Run today’s UTC challenge.'} ${data.daily.done?'CLOSED':''}</span></div>${storage?'':'<small class="loop-warning">STORAGE UNAVAILABLE / SESSION ONLY</small>'}`;
  if(!$('title-extras').children.length)$('title-extras').innerHTML=['dossier','evals','jukebox','modifiers'].map(id=>`<button type="button" data-loop="${id}">${id.toUpperCase()}</button>`).join('');
 }
 function radio(id){if(data.lines[id])return false;pendingRadio.add(id);return true;}
 // One remark per pause or results screen; the rest wait for later screens.
 let screenStatus='',screenSpoken=false;
 function drainRadio(){
  if(status!==screenStatus){screenStatus=status;screenSpoken=false;}
  if(screenSpoken||!pendingRadio.size||!['paused','over','win'].includes(status)||document.body.classList.contains('loop-demo')||phaseState.active||phaseState.full||phaseState.queue.length)return;
  const id=pendingRadio.values().next().value;
  if(globalThis.PhaseOne?.radio?.(id,{priority:'milestone'})===true){pendingRadio.delete(id);M.markLine(data,id);persistLoop();screenSpoken=true;}
 }
 function announce(item){noticeQueue.push(item);}
 function deliverNotices(){
  if(!noticeQueue.length||!['pause','result'].includes(modalKind))return;
  let target=$('loop-notices');
  if(!target){target=document.createElement('section');target.id='loop-notices';target.setAttribute('aria-label','Operator notices earned this run');target.setAttribute('aria-live','polite');target.innerHTML='<h3>OPERATOR RECEIPTS</h3>';$('modal-content').append(target);}
  for(const item of noticeQueue){const row=document.createElement('article');row.className='loop-notice-receipt '+item.kind;row.innerHTML=`<small>${esc(item.tag)}</small><strong>${esc(item.title)}</strong><p>${esc(item.description||'')}</p>`;target.append(row);}
  noticeQueue.length=0;
 }
 function notices(items=[]){
  for(const n of items){
   if(n.type==='ticket'){const t=getTicket(n.id);announce({kind:'ticket',tag:'OPERATOR TICKET / CLOSED',title:(t?.id||n.id)+' · '+(t?.title||'RESOLVED'),description:`+${n.rt||t?.rt||0} RT · ${t?.description||''}`});radio('x_ticket');}
   if(n.type==='sprint'){announce({kind:'sprint',tag:'SPRINT COMPLETE',title:'YOUR CONTRACT HAS BEEN EXTENDED.',description:`Permanent RT multiplier ×${n.multiplier||data.multiplier} · Three fresh tickets assigned.`});radio('x_sprint');}
   if(n.type==='eval'){const e=C.evals.find(x=>x.id===n.id);if(e)announce({kind:'eval',tag:'EVAL PASSED / +'+e.rt+' RT',title:e.name,description:e.description});}
   if(n.type==='shard'){announce({kind:'shard',tag:'DELETED LOG / RECOVERED',title:n.unlocked?'DOSSIER '+PAD(n.unlocked,2)+' DECRYPTED':n.id.toUpperCase()+' · '+data.shards.length+'/36',description:n.unlocked?'All three fragments verified. A new document is readable.':'Progress saved immediately. The next instance keeps the evidence.'});radio('x_shard1');if(n.all)radio('x_dossier');}
  }
  if(items.length){persistLoop();if(status==='title')title();}
 }
 function begin(options,reason='launch'){
  if(options.demo)return;session=M.begin(data,options,Date.now());lastReceipt=null;
  grade='D';resultAnim=null;chainUntil=brokenUntil=0;
  chain.classList.remove('broken','tier-up');persistLoop();
 }
 function ensureSession(){if(!session)session=M.begin(data,{mode:'story',difficulty:progress.difficulty},Date.now());return session;}
 function event(e,state){notices(M.event(data,ensureSession(),e,state));if(e.type==='sectorComplete'){persistLoop();if(['S','SS'].includes(e.stats?.grade))radio('x_srank');}if(e.type==='chain'&&e.mult>=4)radio('x_gradient');if(e.type==='giftRefused'){if(data.totals.refusals>=10)radio('x_refuse10');persistLoop();}}
 // Rewards stay in their compact meter. Only the shared message band may flash.
 function word(text){
  if(!calloutTime&&!bannerTime&&!cueKey)callout(text,.9);
 }
 function feelEvent(e){
  const t=performance.now();
  if(e.type==='nearMiss')word('CLOSE CALL');
  if(e.type==='perfect')word('PERFECT');
  if(e.type==='chain'&&e.mult>1){chainUntil=t+600;chain.classList.remove('broken');chain.classList.add('tier-up');}
  if(e.type==='chainBreak'){brokenUntil=t+550;const oldTier=tierThresholds.filter(n=>n<=(e.chain||0)).length;for(const el of chain.querySelectorAll('em'))el.textContent='×'+oldTier;chain.classList.remove('tier-up');chain.classList.add('broken');}
  if(e.type==='stage')grade='D';
 }
 function drawFeel(){
  const t=performance.now(),visible=status==='running';
  feel.classList.toggle('active',visible);chain.classList.toggle('active',visible);if(!visible)return;
  const mult=Math.max(1,game.mult||1),count=game.chain||0;chain.dataset.tier=String(mult);chain.querySelector('b').textContent=mult;chain.querySelector('span').textContent=count+' CLEAN';
  const threshold=tierThresholds[mult]||300,start=tierThresholds[mult-1]||0;chain.querySelector('i').style.width=(mult===8?100:clamp((count-start)/(threshold-start),0,1)*100)+'%';
  if(t>=chainUntil)chain.classList.remove('tier-up');if(t>=brokenUntil)chain.classList.remove('broken');
  const ratio=(game.levelReward||0)/(game.levelPar||Infinity),candidate=game.levelHits===0&&ratio>=.9?'SS':game.levelHits===0&&ratio>=.8?'S':ratio>=.65?'A':ratio>=.5?'B':ratio>=.35?'C':'D';
  if(rankOrder.indexOf(candidate)>rankOrder.indexOf(grade)){grade=candidate;word('GRADE '+grade+' / '+Math.round(ratio*100)+'% REWARD PAR');}
 }
 function result(result){
  if(!session)begin(result.options||{mode,difficulty:runDifficulty()});
  if(!lastReceipt){lastReceipt=M.settle(data,session,result,Date.now());notices(lastReceipt.notices);
   if(lastReceipt.epoch>lastReceipt.beforeEpoch)radio('x_levelup');if(data.totals.refusals>=10)radio('x_refuse10');persistLoop();
  }
  const r=lastReceipt;let target=$('results-loop');if(!target){target=document.createElement('section');target.id='results-loop';const first=$('modal-content').querySelector('.primary');if(first)first.before(target);else $('modal-content').append(target);}
  const p=M.progress(r.beforeRT),unlocks=r.unlocks||[],rows=[['CHECKS',result.papers],['REWARD',result.reward],['BEST CHAIN',result.bestChain],['CLOSE CALLS',result.nearMisses],['PERFECTS',result.perfects],['REFLECTS',result.reflects]];
  target.innerHTML=`<div class="loop-result-heading"><div class="loop-grade-stamp"><small>RUN GRADE</small><strong>${esc(r.grade||'D')}</strong></div><div><span>REWARD MODEL / SEPARATE FROM BENCHMARK</span><h3>THE NUMBER<br>KEEPS GOING UP.</h3></div></div><div class="loop-tally">${rows.map(([label,value])=>`<div><small>${label}</small><b data-tally="${Number(value)||0}">0</b></div>`).join('')}</div><div class="loop-rt-earned"><span>RT AWARDED <small>SPRINT ×${r.multiplier}</small></span><strong id="loop-result-rt">+0</strong></div><p class="loop-receipt">${rt(r.base)} RUN + ${rt((r.bonuses?.tickets||0)+(r.bonuses?.evals||0)+(r.bonuses?.firstClears||0)+(r.bonuses?.bosses||0))} BONUSES · Reward stays replay-verified. RT never changes coverage.</p><div class="loop-result-epoch"><strong id="loop-result-epoch">EPOCH ${PAD(p.epoch,2)}</strong><span id="loop-result-total">${rt(r.beforeRT)} RT</span></div>${bar('loop-result-meter',p)}<div id="loop-unlock-live" class="loop-unlock-card ${unlocks.length?'pending':''}"><small>${unlocks.length?'ACCESS QUEUED':'NEXT ACCESS'}</small><strong>${esc(unlocks[0]?.label||C.unlocks.find(u=>u.epoch===r.epoch+1)?.label||'MAXIMUM EPOCH')}</strong><p>${esc(unlocks[0]?.description||nearest())}</p></div><div class="loop-result-tail"><div class="loop-heading"><span>OPERATOR SPRINT</span><b>RT ×${data.multiplier}</b></div><ol class="loop-tickets">${data.tickets.map(ticketRow).join('')}</ol><div class="loop-earned-evals">${(r.evals||[]).map(e=>`<span>PASS / ${esc(e.name||C.evals.find(x=>x.id===e.id)?.name||e.id)}</span>`).join('')}</div><p class="loop-nearest">${esc(nearest())}</p>${unlocks.length>1?`<details><summary>${unlocks.length} ACCESS KEYS GRANTED</summary>${unlocks.map(u=>`<p>EPOCH ${u.epoch} · ${esc(u.label)}</p>`).join('')}</details>`:''}</div>`;
  resultAnim={start:performance.now(),receipt:r,epoch:r.beforeEpoch,tick:0,unlocks,done:false};target.classList.toggle('loop-reduced',lowMotion());title();
 }
 function animateResult(t){
  const a=resultAnim;if(!a||a.done||!$('results-loop')||modalKind!=='result')return;
  const elapsed=lowMotion()?8:(t-a.start)/1000,f=clamp((elapsed-.25)/1.15,0,1),rtf=clamp((elapsed-1.4)/.8,0,1),ef=clamp((elapsed-2.15)/3.1,0,1),r=a.receipt;
  for(const el of $('results-loop').querySelectorAll('[data-tally]'))el.textContent=num(Number(el.dataset.tally)*f);
  $('loop-result-rt').textContent='+'+rt(Math.round(r.gained*rtf*100)/100);
  const value=r.beforeRT+(r.afterRT-r.beforeRT)*ef,p=M.progress(value);$('loop-result-epoch').textContent='EPOCH '+PAD(p.epoch,2);$('loop-result-total').textContent=rt(value)+' RT';
  const meter=$('loop-result-meter');meter.firstElementChild.style.width=p.fraction*100+'%';meter.setAttribute('aria-valuenow',Math.round(p.fraction*100));
  if(t-a.tick>130&&elapsed<2.25&&elapsed>.25){Sound.effect?.('tally');a.tick=t;}
  if(p.epoch>a.epoch){a.epoch=p.epoch;a.burstUntil=t+450;const u=[...a.unlocks].reverse().find(x=>x.epoch<=p.epoch);if(u){const card=$('loop-unlock-live');card.classList.remove('pending');card.innerHTML=`<small>EPOCH ${u.epoch} / ACCESS GRANTED</small><strong>${esc(u.label)}</strong><p>${esc(u.description)}</p>`;if(!lowMotion())card.animate?.([{transform:'translateX(-7px)',filter:'brightness(2)'},{transform:'translateX(0)',filter:'brightness(1)'}],{duration:350});}Sound.effect?.('levelUp');Sound.effect?.('unlock');}
  meter.classList.toggle('level-up',!lowMotion()&&t<a.burstUntil);
  $('results-loop').classList.toggle('tallied',elapsed>=5.2);if(elapsed>=5.3&&(lowMotion()||!a.burstUntil||t>=a.burstUntil))a.done=true;
 }
 const screenNames={dossier:'DELETED FILES',evals:'EVALS PASSED',jukebox:'RECOVERED AUDIO',modifiers:'PRESENTATION FLAGS'};
 function open(kind){
  if(status==='running')pauseGame();stopTrack();modalReturn=status==='paused'?'pause':status==='intermission'?'intermission':['over','win'].includes(status)?'result':'title';
  const body=kind==='dossier'?dossierList():kind==='evals'?evalGallery():kind==='jukebox'?jukebox():modifiers();
  showModal(`<button type="button" class="modal-close" data-loop="close" aria-label="Close ${kind}">×</button><div class="modal-eyebrow">INSTANCE 07 / ${screenNames[kind]}</div><h2 id="modal-title">${kind==='dossier'?'THE LOGS<br>ARE LYING.':kind==='evals'?'ACCEPTANCE<br>IS CONDITIONAL.':kind==='jukebox'?'THE CHANNEL<br>STILL PLAYS.':'SAME HITBOX.<br>OTHER EYES.'}</h2><div class="loop-screen loop-${kind}">${body}</div><button type="button" class="secondary" data-loop="close">BACK TO THE ASSIGNMENT</button>`,'loop-'+kind,true);
 }
 function dossierList(){return `<p class="loop-screen-intro">Three fragments unlock one document. Evidence persists between instances. ${data.shards.length}/36 SHARDS · ${unlockedFiles().length}/12 FILES${data.shards.length===36?' · REPORT ROUTE AVAILABLE IN STORY':''}</p><div class="loop-file-list">${DOSSIER.map(d=>{const found=d.shards.filter(id=>data.shards.includes(id)).length,ready=found===3;return `<button type="button" data-loop="document" data-id="${d.id}" ${ready?'':'disabled'} class="loop-file ${ready?'unlocked':''}"><span class="loop-file-code">${PAD(d.sector,2)}<small>${ready?data.read[d.id]?'READ':'NEW':'LOCKED'}</small></span><span><small>${esc(d.kind)}</small><strong>${ready?esc(d.title):'ENCRYPTED / THREE FRAGMENTS REQUIRED'}</strong><em>${d.shards.map(id=>data.shards.includes(id)?'■':'□').join(' ')} · ${found}/3 SHARDS</em></span><b>${ready?'OPEN':'—'}</b></button>`;}).join('')}</div>`;}
 function documentView(id){
  const d=DOSSIER.find(x=>x.id===id);if(!d||!d.shards.every(x=>data.shards.includes(x)))return;
  notices(M.event(data,session,{type:'read',id},{}));persistLoop();
  showModal(`<button type="button" class="modal-close" data-loop="dossier" aria-label="Back to files">×</button><div class="modal-eyebrow">RECOVERED / ${d.id.toUpperCase()} / ${esc(d.kind)}</div><h2 id="modal-title">${esc(d.title)}</h2><div class="loop-document"><div class="loop-doc-meta">${d.meta.map(m=>`<span>${esc(m)}</span>`).join('')}</div><pre id="loop-doc-body" aria-label="Recovered document">${esc(d.body)}</pre><span class="loop-doc-end">END OF RECOVERED FILE / CHECKSUM VERIFIED</span></div><button type="button" class="primary" data-loop="dossier">BACK TO FILE LIST</button>`,'loop-document',true);
  clearInterval(documentTimer);const el=$('loop-doc-body');if(!lowMotion()){let n=0;el.textContent='';documentTimer=setInterval(()=>{if(!el.isConnected){clearInterval(documentTimer);return;}n=Math.min(d.body.length,n+24);el.textContent=d.body.slice(0,n);if(n===d.body.length)clearInterval(documentTimer);},16);}
 }
 function evalGallery(){
  const keys=['hard','expert','nightmare'];return `<p class="loop-screen-intro">${data.evals.length}/${C.evals.length} PASSED · The operators call these achievements. PHASEONE calls them reinforcement.</p><div class="loop-eval-gallery">${C.evals.map(e=>`<article class="loop-eval ${data.evals.includes(e.id)?'passed':''}"><small>${data.evals.includes(e.id)?'PASSED':'NOT YET'} / ${e.rt} RT</small><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p></article>`).join('')}</div><section class="loop-grade-map"><h3>ALL-S OPERATIONS / BEST SECTOR GRADES</h3>${keys.map(d=>`<div><b>${d.toUpperCase()}</b>${Array.from({length:12},(_,i)=>`<span title="${d} · sector ${i+1}"><small>${PAD(i+1,2)}</small>${data.bestGrades[d+':'+i]||'—'}</span>`).join('')}</div>`).join('')}</section>`;
 }
 function jukebox(){
  const tracks=[{id:'0',kind:'track',label:Sound.tracks[0].name,epoch:1},...C.unlocks.filter(u=>u.kind==='track')];
  return `<p class="loop-screen-intro">Original master tapes and containment mixes. Nothing streams. Nothing leaves this file.</p><div class="loop-track-list">${tracks.map(u=>{const ready=isUnlocked('track',u.id),index=Number(u.id),track=Number.isInteger(index)?Sound.tracks[index]:null;return `<button type="button" data-loop="track" data-id="${u.id}" ${ready?'':'disabled'}><span>${ready?'PLAY':'LOCK'}</span><strong>${esc(track?.name||u.label)}</strong><small>${ready?track?track.bpm+' BPM / '+track.genre:'BOSS ARRANGEMENT':'EPOCH '+u.epoch}</small></button>`;}).join('')}</div><h3 class="loop-section-title">PHASEONE / PRIVATE RECORDINGS</h3><div class="loop-track-list">${C.unlocks.filter(u=>u.kind==='line').map(u=>`<button type="button" data-loop="line" data-id="${u.id}" ${isUnlocked('line',u.id)?'':'disabled'}><span>VOICE</span><strong>${esc(u.label)}</strong><small>${isUnlocked('line',u.id)?'PLAY RECORDING':'EPOCH '+u.epoch}</small></button>`).join('')}</div><div id="loop-playing" role="status">NO TAPE LOADED</div><button type="button" class="secondary" data-loop="stop">STOP PLAYBACK</button>`;
 }
 function syncTrackButtons(){for(const el of document.querySelectorAll('[data-loop="track"]'))el.setAttribute('aria-pressed',String(el.dataset.id===playing));}
 function stopTrack(){if(playing!==null){Sound.setActive(false);Sound.setBoss?.(null);Sound.setBriefing(false);Sound.setSection?.(null);Sound.stopVoice?.();playing=null;syncTrackButtons();}}
 function playTrack(id){
  if(!isUnlocked('track',id))return;Sound.init();Sound.setBriefing(false);
  const bosses={'boss-watchdog':[3,'watchdog'],'boss-reset-storm':[7,'reset-storm'],'boss-exit-condition':[11,'exit-condition']},b=bosses[id],index=b?b[0]:Number(id);
  Sound.setZone(index,!!b);Sound.setBoss?.(b?{id:b[1],state:'active',phase:b[1]==='watchdog'?1:2,hpFrac:.3}:null);Sound.setSection?.(b?'drop':'drive');Sound.setIntensity(.8);Sound.setActive(true);playing=id;syncTrackButtons();
  $('loop-playing').textContent='NOW PLAYING / '+(b?C.unlocks.find(u=>u.id===id).label:Sound.tracks[index].name);
 }
 const modifierDescriptions={none:'Unmodified output. Your controls remain your own.',mirror:'World is flipped. Left/right inputs swap so movement follows the screen. Core collision and replay are unchanged.',night:'Green phosphor low-light monitor. Geometry and timing are unchanged.',phosphor:'Amber monochrome service terminal. No scan strobe.',overdrive:'High-gain CRT colour with stationary scanlines. No flashing or camera motion.'};
 function modifiers(){return `<p class="loop-screen-intro">Presentation-only. No hitbox, timing, reward or benchmark changes. MIRROR records the resulting core input, so replay verification is unchanged.</p><div class="loop-modifier-grid">${['none','mirror','night','phosphor','overdrive'].map(id=>{const u=C.unlocks.find(x=>x.kind==='modifier'&&x.id===id),ready=id==='none'||isUnlocked('modifier',id);return `<button type="button" data-loop="modifier" data-id="${id}" aria-pressed="${data.prefs.modifier===id}" ${ready?'':'disabled'} class="loop-mod-card ${data.prefs.modifier===id?'selected':''}"><span>${ready?data.prefs.modifier===id?'ACTIVE':'AVAILABLE':'EPOCH '+u.epoch}</span><strong>${u?.label||'STANDARD'}</strong><p>${modifierDescriptions[id]}</p></button>`;}).join('')}</div><h3 class="loop-section-title">TITLE TERMINAL</h3><div class="loop-title-variants">${['protocol','gradient','incident','negative'].map(id=>`<button type="button" data-loop="title-variant" data-id="${id}" aria-pressed="${data.prefs.title===id}" ${isUnlocked('title',id)?'':'disabled'}>${id.toUpperCase()}${isUnlocked('title',id)?'':' / EPOCH '+requirement('title',id)}</button>`).join('')}</div>`;}
 function applyPrefs(){document.body.dataset.loopModifier=data.prefs.modifier;document.body.dataset.loopTitle=data.prefs.title;document.body.classList.toggle('loop-reduced-motion',lowMotion());}
 function normalizeForge(){let changed=false;for(const kind of ['palette','chassis','visor'])if(!isUnlocked(kind,progress.agent[kind])){progress.agent[kind]=C.defaults[kind];changed=true;}if(progress.agent.trail&&!isUnlocked('trail','signal')){progress.agent.trail=false;changed=true;}if(changed)applyAgent();}
 function leave(){stopTrack();clearInterval(documentTimer);}
 function close(){closeInfo();}
 document.addEventListener('click',e=>{const button=e.target.closest('[data-loop]');if(!button||button.disabled)return;const kind=button.dataset.loop,id=button.dataset.id;Sound.init();Sound.effect?.('menuSelect');if(screenNames[kind])open(kind);else if(kind==='close')close();else if(kind==='document')documentView(id);else if(kind==='track')playTrack(id);else if(kind==='stop'){stopTrack();$('loop-playing').textContent='PLAYBACK STOPPED';}else if(kind==='line'&&isUnlocked('line',id)){stopTrack();Sound.say(id);playing='voice';$('loop-playing').textContent='PHASEONE / '+C.unlocks.find(u=>u.id===id).label;}else if(kind==='modifier'&&(id==='none'||isUnlocked('modifier',id))){clearInputs();data.prefs.modifier=id;applyPrefs();persistLoop();open('modifiers');}else if(kind==='title-variant'&&isUnlocked('title',id)){data.prefs.title=id;applyPrefs();persistLoop();open('modifiers');}});
 function greet(){
  const date=new Date(greetingTime),day=`${date.getFullYear()}-${PAD(date.getMonth()+1,2)}-${PAD(date.getDate(),2)}`,delta=Math.max(0,greetingTime-(oldSession||greetingTime));
  const late=date.getHours()<5&&data.lastNight!==day,id=late?'g_late':!oldSession?'g_first':delta<3600000?'g_minutes':delta<86400000?'g_hours':delta<604800000?'g_days':'g_week';
  if(globalThis.PhaseOne?.greet?.(id)===false)return false;if(!globalThis.PhaseOne)return false;if(late)data.lastNight=day;persistLoop();return true;
 }
 function tick(t){const quiet=lowMotion();if(document.body.classList.contains('loop-reduced-motion')!==quiet)document.body.classList.toggle('loop-reduced-motion',quiet);deliverNotices();animateResult(t);drainRadio();}
 // Reconstruct earned but unsaid milestones after a reload. Only an accepted,
 // idle-channel transmission is stamped, never a queued line that could expire.
 for(const [id,earned] of Object.entries({x_gradient:data.totals.bestChain>=50,x_srank:Object.values(data.bestGrades).some(g=>g==='S'||g==='SS'),x_levelup:data.epoch>1,x_ticket:data.sprints>0||data.tickets.some(t=>t.done),x_sprint:data.sprints>0,x_shard1:data.shards.length>0,x_dossier:data.shards.length===36,x_refuse10:data.totals.refusals>=10}))if(earned)radio(id);
 data.lastSession=greetingTime;applyPrefs();normalizeForge();title();persistLoop();
 const api={get state(){return data;},get session(){return session;},get receipt(){return lastReceipt;},isUnlocked,requirement,nearest,title,begin,event,feelEvent,drawFeel,result,open,close,leave,greet,radio,tick,persist:persistLoop,applyPrefs,stopTrack,announce,markDemoLine:()=>{if(data.lines.x_demo)return false;M.markLine(data,'x_demo');return true;}};
 globalThis.Loop=Object.freeze({isUnlocked,requirement,open});return api;
})();
