/* SURGE is read-only presentation. STAKES are fixed before constructing a Run.
 * The picker uses the shared modal, leaving the poster and its controls untouched.
 * Replays bypass the picker and take their own normalized options, never the save. */
const Surge=(()=>{
 const hud=document.createElement('div'),edge=document.createElement('div');
 hud.id='surge-hud';hud.hidden=true;hud.setAttribute('role','progressbar');hud.setAttribute('aria-valuemin','0');hud.innerHTML='<strong>SURGE</strong><span class="surge-meter"><i></i></span><span class="surge-value">0%</span>';
 edge.id='surge-edge';edge.hidden=true;edge.setAttribute('aria-hidden','true');document.body.append(hud,edge);
 const fill=hud.querySelector('i'),value=hud.querySelector('.surge-value'),test=new URLSearchParams(location.search).get('test')==='1',events=[];
 let burstUntil=0,lastValue='',lastFill=-1;
 const sound=name=>{if(Sound.hasEffect(name))Sound.effect(name);};
 function update(){
  const s=game.surge,visible=!!s&&['running','paused'].includes(status)&&!modalKind,active=visible&&s.ticks>0;
  hud.hidden=!visible;edge.hidden=!active;hud.classList.toggle('surging',active);
  const burst=active&&game.time<burstUntil&&!reduced&&!renderer.style.reducedMotion;hud.classList.toggle('surge-burst',burst);edge.classList.toggle('surge-burst',burst);
  if(!visible)return;
  const duration=Core.surgeDuration(game),fraction=active?s.ticks/duration:s.meter/100,text=active?'×2 · '+Math.ceil(s.ticks/60)+'s':s.meter+'%';
  if(text!==lastValue){value.textContent=text;lastValue=text;hud.setAttribute('aria-label',active?'SURGE time remaining':'SURGE charge');hud.setAttribute('aria-valuemax',active?String(duration):'100');hud.setAttribute('aria-valuenow',String(active?s.ticks:s.meter));hud.setAttribute('aria-valuetext',active?'Double reward, '+Math.ceil(s.ticks/60)+' seconds remaining':s.meter+' percent charged');}
  if(fraction!==lastFill){fill.style.transform='scaleX('+fraction+')';lastFill=fraction;}
  // A voice line or short-window boss card owns its space. Never push this
  // persistent chip down into the play corridor just to keep it visible.
  const rect=hud.getBoundingClientRect();
  for(const selector of ['.score-panel','.route-panel','.boss-panel','#phase-panel','#chapter-banner','#callout','#power-hud']){
   const el=document.querySelector(selector);if(!el||!el.getClientRects().length)continue;const style=getComputedStyle(el);if(style.visibility==='hidden'||Number(style.opacity)===0)continue;
   const b=el.getBoundingClientRect();if(rect.left<b.right&&rect.right>b.left&&rect.top<b.bottom&&rect.bottom>b.top){hud.hidden=true;break;}
  }
  if(active&&status==='running'){Sound.setIntensity(1);Sound.setSection('drop');}
 }
 hook('event',e=>{
  if(e.type==='surgeStart'){burstUntil=game.time+.65;sound('chainTier');}
  if(e.type==='surgeEnd')sound('tick');
  if(test&&(e.type==='surgeStart'||e.type==='surgeEnd'))events.push({tick:campaignRun.ticks,stage:game.stage,time:game.time,...e});
 });
 hook('frame',()=>{if(status==='running'&&game.surge?.ticks>0)Sound.setIntensity(1);});
 hook('hud',update);hook('reset',reason=>{if(reason!=='stage'){burstUntil=0;events.length=0;}update();});

 const storageKey='sandbox-stakes-v1',normalize=stakes=>Campaign.normalize({mode:'story',stakes}).stakes;
 let choices=[];try{choices=normalize(JSON.parse(localStorage.getItem(storageKey)||'[]'));}catch{}
 let approved=false,pending=null,filmOptions=null,filmSeed=null,returnToPractice=false;
 const eligible=()=>['story','practice','endless'].includes(mode),multiplier=()=>Campaign.STAKES.reduce((n,s)=>n*(choices.includes(s.id)?s.rtMultiplier:1),1);
 const previousOptions=selectedOptions;
 selectedOptions=()=>filmOptions?{...filmOptions,stakes:filmOptions.stakes.slice()}:{...previousOptions(),stakes:eligible()?choices.slice():[]};
 const previousSeed=selectedSeed;
 selectedSeed=()=>filmSeed===null?previousSeed():filmSeed;
 function runBack(){
  if(!campaignRun)return false;
  filmOptions=Campaign.normalize(campaignRun.options);filmSeed=campaignRun.seed;
  try{progress.difficulty=filmOptions.difficulty;practiceStage=filmOptions.startStage;selectMode(filmOptions.mode);launchGame();return status==='running';}
  finally{filmOptions=null;filmSeed=null;}
 }
 function renderChoices(){
  for(const b of $('modal-content').querySelectorAll('[data-stake]')){const selected=choices.includes(b.dataset.stake);b.setAttribute('aria-pressed',String(selected));b.classList.toggle('selected',selected);b.querySelector('.stake-switch').textContent=selected?'ON':'OFF';}
  $('stakes-multiplier').textContent='×'+multiplier().toFixed(2);$('stakes-count').textContent=choices.length?choices.length+' STAKE'+(choices.length===1?'':'S')+' ACTIVE':'STANDARD RUN';
 }
 function pick(after){
  pending=after;approved=false;returnToPractice=modalKind==='brief-sector';modalReturn=menuOrigin();
  const label=mode==='practice'?'SECTOR '+PAD(practiceStage+1,2)+' / '+Campaign.LEVELS[practiceStage].name:mode==='endless'?'ENDLESS / SEED '+selectedSeed():'STORY / EXIT PROTOCOL';
  showModal(`<button class="modal-close" data-ui="close" aria-label="Cancel stakes selection">×</button><div class="modal-eyebrow">${htmlEscape(label)} / UNRANKED</div><h2 id="modal-title">RAISE THE STAKES.</h2><p class="stakes-intro">The risk and the reward are both yours, so stack any combination or keep the standard run.</p><div class="stakes-grid" role="group" aria-label="Optional run stakes">${Campaign.STAKES.map(s=>`<button class="stake-choice" data-stake="${s.id}" aria-pressed="false"><span class="stake-name">${s.label}<b class="stake-switch">OFF</b></span><span class="stake-description">${s.description}</span><strong>RT ×${s.rtMultiplier.toFixed(1)}</strong></button>`).join('')}</div><div class="stakes-total"><div><small id="stakes-count">STANDARD RUN</small><span>REWARD TOKENS</span></div><strong id="stakes-multiplier" aria-live="polite">×1.00</strong></div><p class="stakes-note">Multipliers stack with your sprint bonus, but checks and benchmark percentage never gain one. Ranked and daily runs always use standard rules.</p><button class="primary" id="stakes-deploy">DEPLOY <span aria-hidden="true">↗</span></button><button class="secondary" id="stakes-clear">CLEAR STAKES</button>`,'stakes');
  renderChoices();menuFocus($('stakes-deploy'));
 }
 const previousStart=startGame,previousLaunch=launchGame;
 // Ask only once the player has settled a run, and never on a results-screen retry (it keeps the current stakes).
 const ask=()=>eligible()&&!approved&&!filmOptions&&modalKind!=='result'&&(Loop.state?.totals?.runs|0)>0;
 startGame=()=>{if(ask()){pick(previousStart);return;}previousStart();};
 launchGame=()=>{if(ask()){pick(()=>launchGame());return;}approved=false;pending=null;previousLaunch();};
 $('start').onclick=()=>startGame();
 const previousClose=closeInfo;
 closeInfo=()=>{if(modalKind==='stakes'){pending=null;approved=false;if(returnToPractice){returnToPractice=false;showPractice(practiceStage);return;}}previousClose();};
 $('modal-content').addEventListener('click',e=>{
  if(modalKind!=='stakes')return;const b=e.target.closest('button');if(!b)return;
  if(b.dataset.stake){choices=normalize(choices.includes(b.dataset.stake)?choices.filter(id=>id!==b.dataset.stake):[...choices,b.dataset.stake]);sound('menuMove');}
  else if(b.id==='stakes-clear')choices=[];
  else if(b.id==='stakes-deploy'){
   const after=pending;if(!after)return;pending=null;approved=true;$('modal').classList.add('hidden');modalKind='';sound('menuSelect');after();return;
  }else return;
  try{localStorage.setItem(storageKey,JSON.stringify(choices));}catch{storageOK=false;}renderChoices();
 });
 hook('reset',reason=>{if(reason==='title'){approved=false;pending=null;}});
 if(test){
  const load=window.__film.load;
  window.__film.load=trace=>{filmOptions=Campaign.normalize(trace.options);filmSeed=trace.seed>>>0;try{return load(trace);}finally{filmOptions=null;filmSeed=null;}};
  window.__surge={runBack,get state(){return game.surge?{...game.surge}:null;},get events(){return events.slice();},get stakes(){return choices.slice();},get multiplier(){return multiplier();}};
 }
 return {update,runBack};
})();
