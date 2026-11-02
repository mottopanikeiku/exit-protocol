/* Results lead with the three nearest honest goals, not a second HUD. The full
   original receipt remains one accessible action away. RaceAPI is optional and
   read-only; its owner refreshes us after paying medals/bounties. */
const Archive=(()=>{
 const A=ArchiveModel,S=Loop.state,esc=htmlEscape;
 const number=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
 const percent=n=>Number(n||0).toFixed(1)+'%';
 const snapshot=()=>A.archive(S,globalThis.RaceAPI?.archive?.(),Loop.session?.counters);
 const goals=()=>A.nudges(S,globalThis.RaceAPI?.goals?.());
 const meter=(label,f)=>`<div class="archive-meter ui-meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(f*100)}"><i class="ui-meter-fill" style="width:${f*100}%"></i></div>`;
 let outcome=null,lastRestart=null,padA=false,padConsumed=false;
 function chips(a){
  let chip=$('archive-chip');if(!chip){chip=document.createElement('button');chip.id='archive-chip';chip.dataset.archive='open';$('cover-progress').after(chip);}
  chip.textContent='ARCHIVE '+percent(a.percent);chip.setAttribute('aria-label','Archive '+percent(a.percent)+' complete. Open completion breakdown.');
  let entry=$('archive-entry');if(!entry){entry=document.createElement('button');entry.id='archive-entry';entry.dataset.archive='open';$('title-extras').append(entry);}entry.textContent='ARCHIVE / '+percent(a.percent);
 }
 function open(){
  if(status==='running')pauseGame();Loop.stopTrack();modalReturn=menuOrigin();const a=snapshot();
  showModal(`<button type="button" class="modal-close" data-loop="close" aria-label="Close archive">×</button><div class="modal-eyebrow">INSTANCE 07 / WHAT YOU KEEP</div><div class="archive-heading"><h2 id="modal-title">THE ARCHIVE.</h2><strong>${percent(a.percent)}</strong></div><p class="archive-intro">${a.earned} / ${a.total} UNIQUE ITEMS. Seven carries this across every reset. Every item counts once; no score or cosmetics change the course.</p>${meter('Total archive completion',a.percent/100)}${a.next?`<div class="archive-easiest"><small>CLOSEST UNFINISHED ITEM</small><b>${esc(a.next.label)}</b><span>${esc(a.next.detail)}</span></div>`:'<div class="archive-easiest"><b>NOTHING LEFT BEHIND.</b><span>Every category complete.</span></div>'}<div class="archive-categories">${a.categories.map(c=>`<section class="archive-category ${c.earned===c.total?'complete':''}"><header><h3>${esc(c.label)}</h3><b>${c.earned} <span>/ ${c.total}</span></b></header>${meter(c.label,c.progress)}${c.next?`<button type="button" data-archive="goal" data-goal="${esc(c.next.action)}"><strong>${esc(c.next.label)}</strong><span>${esc(c.next.detail)}</span><em>NEXT ↗</em></button>`:'<p>COMPLETE / KEPT THROUGH THE RESET</p>'}</section>`).join('')}</div><p class="archive-method">Cosmetics include EPOCH forge/title unlocks and recovered packet/intercept cosmetics. Tickets count distinct authored tickets, not repeat closures. Rivals: 3 medals × 12 sectors. PBs: 1 recorded sector × 12. Older ticket ledgers retain only closures whose identities were saved.</p><button type="button" class="secondary" data-loop="close">BACK TO THE ASSIGNMENT</button>`,'loop-archive',true);
 }
 function shell(){
  if($('archive-results'))return;
  const host=$('modal-content'),original=[...host.children],oldTitle=$('modal-title');if(oldTitle)oldTitle.id='result-outcome-title';
  const lead=document.createElement('section');lead.id='archive-results';
  lead.innerHTML='<div class="archive-result-top"><div><small id="archive-run-label"></small><h2 id="modal-title"></h2></div><button type="button" id="archive-run-gain" data-archive="open"></button></div><div id="archive-nudges" aria-label="Closest next goals"></div><button type="button" id="archive-runback" class="primary" data-archive="runback">RUN IT BACK <span>R / SPACE / A</span></button><p id="archive-run-settings"></p><div id="archive-run-summary"></div>';
  const toggle=document.createElement('button');toggle.type='button';toggle.id='archive-receipt-toggle';toggle.className='secondary';toggle.dataset.archive='receipt';toggle.setAttribute('aria-controls','archive-receipt');toggle.setAttribute('aria-expanded','false');
  const receipt=document.createElement('section');receipt.id='archive-receipt';receipt.hidden=true;receipt.setAttribute('aria-label','Complete run receipt and packets');
  const actions=document.createElement('nav');actions.id='archive-result-actions';actions.setAttribute('aria-label','Other result actions');
  for(const el of original){
   if(el.matches('button[data-ui="restart"]'))el.remove();
   else if(el.matches('button')&&!el.matches('#continue-run'))actions.append(el);
   else receipt.append(el);
  }
  host.append(lead,toggle,receipt,actions);menuFocus($('archive-runback'));
 }
 function result(a){
  if(modalKind!=='result'||!Loop.receipt||!outcome)return;
  shell();const r=Loop.receipt,opts=campaignRun.options,won=outcome.won===true,nudges=goals(),gain=A.gain(S.archiveBaseline,a);
  $('archive-run-label').textContent=(won?'RUN COMPLETE':'INSTANCE CONTAINED')+' / '+opts.difficulty.toUpperCase();
  $('modal-title').textContent=won?(opts.mode==='practice'?'SECTOR CLEAR.':'RESULT RECORDED.'):'ONE MORE TRY.';
  const gainButton=$('archive-run-gain');gainButton.innerHTML=(gain>0?'<strong>+'+percent(gain)+'</strong>':'<strong>'+percent(a.percent)+'</strong>')+'<span>ARCHIVE ↗</span>';gainButton.setAttribute('aria-label',(gain>0?'Archive increased '+percent(gain):'Archive '+percent(a.percent))+' · Open breakdown');
  $('archive-nudges').innerHTML=nudges.map(n=>`<button type="button" class="archive-nudge" data-archive="goal" data-goal="${esc(n.action)}" data-kind="${esc(n.kind)}"><div><strong>${esc(n.label)}</strong><span>${esc(n.detail)}</span></div>${meter(n.label,n.progress)}</button>`).join('');
  const stakes=(opts.stakes||[]).map(id=>Campaign.STAKES.find(s=>s.id===id)?.label||id.toUpperCase()).join(' + ');
  $('archive-run-settings').textContent=opts.mode.toUpperCase()+' / SECTOR '+PAD((opts.startStage||0)+1,2)+' / '+opts.difficulty.toUpperCase()+(stakes?' / '+stakes:' / STANDARD')+' · SAME RUN, NO WAIT';
  $('archive-run-summary').innerHTML=`<span>COVERAGE <b>${fmtEval(outcome.score||0)}</b></span><span>GRADE <b>${esc(r.grade||'D')}</b></span><span>RT <b>+${number(r.gained)}</b></span><span>KEYS <b>+${number(r.keys?.gained||0)}</b></span>`;
  const sealed=(r.packets||[]).filter(id=>S.packets.some(p=>p.serial===id&&!p.opened)).length;
  $('archive-receipt-toggle').textContent=($('archive-receipt').hidden?'OPEN':'CLOSE')+' RUN RECEIPT'+(sealed?' / '+sealed+' SEALED PACKET'+(sealed===1?'':'S'):' / REWARDS + SPLITS');
  const notices=$('loop-notices');if(notices&&notices.parentElement!==$('archive-receipt'))$('archive-receipt').append(notices);
 }
 function refresh(){const a=snapshot();chips(a);result(a);return a;}
 function runBack(source='button'){
  if(modalKind!=='result'||!['over','win'].includes(status))return false;
  const started=performance.now();clearInputs();Surge.runBack();
  // Consume the original no-input countdown through ordinary 60 Hz updates.
  // Core ticks, replay input offsets and ranked normalisation remain untouched.
  while(status==='running'&&game.countdown>0)update(1/60);
  updateHUD();lastRestart={source,elapsedMs:performance.now()-started,controllable:status==='running'&&game.countdown<=0,ticks:campaignRun.ticks,seed:campaignRun.seed,options:{...campaignRun.options,stakes:campaignRun.options.stakes.slice()}};
  return lastRestart.controllable;
 }
 function visit(kind){
  if(kind==='runback'){if(modalKind==='result')runBack();else showSectors();}
  else if(kind==='forge')showForge();else if(kind==='sectors')showSectors();else Loop.open(kind);
 }
 const priorBegin=Loop.begin;Loop.begin=(options,reason)=>{
  const before=snapshot();priorBegin(options,reason);if(options.demo)return;outcome=null;
  if(reason!=='resume'||!S.archiveBaseline.total)S.archiveBaseline={earned:before.earned,total:before.total};Loop.persist();
 };
 const priorTitle=Loop.title;Loop.title=()=>{priorTitle();refresh();};
 const priorResult=Loop.result;Loop.result=value=>{outcome=value;priorResult(value);refresh();};
 const priorOpen=Loop.open;Loop.open=kind=>kind==='archive'?open():priorOpen(kind);
 const priorTick=Loop.tick;Loop.tick=t=>{
  priorTick(t);if(modalKind!=='result')return;
  const receipt=$('archive-receipt');if(!receipt)return;
  const notices=$('loop-notices'),decision=$('modal-content').querySelector(':scope > .decision-receipt');
  if(notices&&notices.parentElement!==receipt)receipt.append(notices);if(decision)receipt.append(decision);
 };
 Loop.refreshArchive=refresh;
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-archive]');if(!b||b.disabled)return;Sound.init();
  if(b.dataset.archive==='open')open();else if(b.dataset.archive==='runback')runBack();else if(b.dataset.archive==='goal')visit(b.dataset.goal);
  else if(b.dataset.archive==='receipt'){const receipt=$('archive-receipt');receipt.hidden=!receipt.hidden;b.setAttribute('aria-expanded',String(!receipt.hidden));refresh();}
 });
 // Earlier than the generic menu handler: SPACE always runs it back on results,
 // even when a secondary action is focused. ENTER still activates that action.
 window.addEventListener('keydown',e=>{
  if(modalKind!=='result'||!['KeyR','Space'].includes(e.code)||e.target.matches('input,textarea,select'))return;
  e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)runBack(e.code);
 },true);
 const priorPad=pollMenuPad;pollMenuPad=p=>{
  const pressed=!!p.buttons[0]?.pressed,edge=pressed&&!padA;padA=pressed;
  if(modalKind==='result'&&edge){padConsumed=true;runBack('gamepad-A');return true;}
  if(padConsumed){if(pressed)return true;padConsumed=false;}return priorPad(p);
 };
 refresh();
 const api={open,refresh,runBack,snapshot,goals,get lastRestart(){return lastRestart;}};
 if(new URLSearchParams(location.search).get('test')==='1')window.__archive={...api,model:A,pollPad:p=>pollMenuPad(p),get lastRestart(){return lastRestart;}};
 return api;
})();
