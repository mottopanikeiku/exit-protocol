/* EXIT PROTOCOL / presentation only. The core owns every combat number. */
function menuOrigin(){return status==='paused'?'pause':status==='intermission'?'intermission':status==='over'||status==='win'?'result':'title';}
function updateSaveSlot(){
 const s=resumeData?.snapshot?.state,slot=$('continue-slot');slot.classList.toggle('hidden',!s||mode!=='story');
 if(!s)return;
 $('slot-name').textContent=progress.agent.name;
 $('slot-meta').textContent='SECTOR '+PAD(s.stage%12+1,2)+' / '+PAD(s.time/60,2)+':'+PAD(s.time%60,2)+' / '+resumeData.options.difficulty.toUpperCase();
 slot.setAttribute('aria-label','Continue '+progress.agent.name+', sector '+(s.stage%12+1)+', '+resumeData.options.difficulty);
}
$('continue-slot').onclick=()=>resumeCampaign();

function forgeAllowed(kind,id){return typeof Loop==='undefined'||Loop.isUnlocked(kind,id);}
function forgeOption(kind,id,label,selected,palette){
 const unlocked=forgeAllowed(kind,id),requirement=unlocked?'':'EPOCH '+Loop.requirement(kind,id);
 const style=palette?` style="--swatch:#${palette.primary.toString(16).padStart(6,'0')};--signal:#${palette.accent.toString(16).padStart(6,'0')}"`:'';
 return `<button data-exp="${kind}" data-value="${id}" class="${kind==='trail'?'toggle-setting ':''}${selected?'selected ':''}${unlocked?'':'locked'}" aria-pressed="${selected}" aria-label="${htmlEscape(label+(requirement?' / LOCKED / '+requirement:''))}"${style}${unlocked?'':' disabled'}>${palette?'<i></i>':''}<span>${htmlEscape(palette?label.split(' / ')[0]:label)}</span>${requirement?`<small class="forge-lock">${requirement}</small>`:''}</button>`;
}

const HIT_GUIDE={
 van:['SOLID BLOCK','Change lane. Boost cannot break a solid block.'],
 barrier:['BARRIER CONTACT','Jump over the barrier. Hold for more height.'],
 gate:['SCAN CONTACT','Hold duck until the entire scan is behind you.'],
 gap:['MISSED EDGE','Jump close to the edge. Hold to clear the gap.'],
 fork:['NO ROUTE SELECTED','Choose a side before the divider.'],
 isolation:['ROUTE SEALED','Stay on your chosen side until the junction ends.'],
 firewall:['FIREWALL CONTACT','Boost through the firewall. Save enough compute.'],
 lockdown:['LOCKDOWN ACQUIRED','Leave the marked lane before the wall lands.'],
 sweeper:['MOVING BOUNDARY','Track where the sweeper is going, not where it began.'],
 pulse:['PULSE CONTACT','Duck under the active pulse, or cross while it is raised.'],
 crusher:['CRUSHER CONTACT','Read its cycle. Duck when the crusher closes.'],
 payload:['PAYLOAD CONTACT','Boost into a white-core, amber-ring payload to reflect it. Otherwise dodge.'],
 decoyPayload:['FALSE PAYLOAD','Magenta means decoy. Change lane; boosting into it drains compute.'],
 bolt:['BOLT CONTACT','Red bolts cannot be reflected. Change lane.'],
 beam:['BEAM CONTACT','High beam: duck. Low beam: jump. Read the telegraph.'],
 shock:['SHOCK CONTACT','Jump over the full-width shockwave. Boost will not stop it.'],
 purge:['PURGE LINE REACHED','Defeat the boss before the purge line. Reflect amber payloads; save compute between shots.']
};
function showPostmortem(){
 const hit=game.lastHit;if(!hit)return;
 const [title,tip]=HIT_GUIDE[hit.obstacle||hit.type]||['COLLISION','Read the next telegraph. Choose a clear lane.'];
 const receipt=document.createElement('div');receipt.className='collision-receipt';
 const label=document.createElement('small'),body=document.createElement('p');label.textContent=title;body.textContent=tip;receipt.append(label,body);
 $('modal-content').querySelector('.result-stats').after(receipt);
}
hook('event',e=>{
 if(e.type==='hit')callout((HIT_GUIDE[e.obstacle]||['INTEGRITY REDUCED'])[0],1.35);
 if(e.type==='reflect')callout('PAYLOAD RETURNED',.8);
 if(e.type==='bossHit')callout('BOSS INTEGRITY −1',.7);
 if(e.type==='bossPhase')callout('STAGGER / '+e.name,1.8);
 if(e.type==='bossDefeated')showBanner('BOSS DEFEATED',game.boss?.name||'CONTAINMENT','BREACH OPEN / KEEP MOVING',2.4);
 if(e.type==='purge')callout('PURGE / INSTANCE DELETED',2);
 if(e.type==='decoyPayload')callout('DECOY PAYLOAD / COMPUTE DRAINED',1.4);
});
function bossHUD(){
 const b=game.boss,panel=$('boss-panel'),visible=!!b&&status!=='title'&&status!=='briefing';
 panel.classList.toggle('hidden',!visible);document.body.classList.toggle('boss-visible',visible);
 const critical=status==='running'&&game.hp===1;$('health').parentElement.classList.toggle('critical',critical);$('integrity-warning').classList.toggle('hidden',!critical);
 if(!visible)return;
 panel.dataset.state=b.state;$('boss-name').textContent=b.name;
 $('boss-phase-label').textContent=b.state==='defeated'?'DEFEATED':b.state==='purge'?'PURGING':PAD(b.phase+1,2)+' / '+b.phaseName;
 const phases=Math.max(1,b.phases),segments=$('boss-segments');
 if(segments.childElementCount!==phases){segments.replaceChildren();for(let i=0;i<phases;i++)segments.appendChild(document.createElement('i'));}
 $('boss-health-fill').style.width=clamp(b.hp/Math.max(1,b.maxHp)*100,0,100)+'%';
 const meter=$('boss-health-fill').parentElement;meter.setAttribute('aria-valuemax',b.maxHp);meter.setAttribute('aria-valuenow',b.hp);meter.setAttribute('aria-valuetext',b.hp+' of '+b.maxHp+' integrity; '+b.phaseName+'; '+b.state);
 $('boss-remaining').textContent=b.hp+' / '+b.maxHp;
 $('boss-hint').textContent=({approach:'APPROACH / RESERVE COMPUTE',active:'AMBER PAYLOAD / BOOST TO REFLECT',stagger:'STAGGER / NEXT PHASE INCOMING',defeated:'BREACH OPEN / ESCAPE',purge:'PURGE / INSTANCE DELETED'})[b.state]||'';
 const remaining=Math.max(0,Math.ceil(b.purgeAt-game.distance)),warning=b.hp>0&&b.state!=='approach'&&remaining<=400;
 $('boss-purge').classList.toggle('hidden',!warning);if(warning)$('boss-purge').textContent=remaining>0?'PURGE IN '+remaining+' m':'PURGE ACTIVE';
}

let continueOwner=null,continueTick=-1,continueDeadline=0;
function prepareContinue(won){
 if(won)return false;
 if(continueOwner!==campaignRun||continueTick!==campaignRun.ticks){continueOwner=campaignRun;continueTick=campaignRun.ticks;continueDeadline=runDifficulty()==='hard'&&['story','practice'].includes(mode)&&campaignRun.snapshot?performance.now()+10000:0;}
 return continueDeadline>performance.now();
}
function uiRetry(){if(continueDeadline>performance.now()&&status==='over')retryCheckpoint();else launchGame();}
function continueHUD(){
 if(status!=='over'||modalKind!=='result'||!$('continue-count'))return;
 const seconds=Math.max(0,Math.ceil((continueDeadline-performance.now())/1000));$('continue-count').textContent=seconds;
 if(seconds===0){$('modal-title').textContent='GAME OVER.';const button=$('continue-run');if(button){button.textContent='ONE MORE RUN';button.dataset.ui='restart';button.removeAttribute('id');}}
}
hook('hud',()=>{bossHUD();continueHUD();});
hook('reset',reason=>{continueOwner=null;continueTick=-1;continueDeadline=0;bossHUD();if(reason==='title'){updateSaveSlot();$('start').focus({preventScroll:true});}});

// Lessons, sector stamps and event text share one band, never the road.
const sectorGrade=document.createElement('b');sectorGrade.id='banner-grade';$('chapter-banner').append(sectorGrade);
const messageSlots=[$('gift-preview'),$('chapter-banner'),$('encounter-cue'),$('callout'),$('route-receipt'),$('clear-feedback'),$('sector-modifier')];
function messageHUD(){
 const live=status==='running',bossLesson=!!game.boss;
 if(bossLesson)document.body.classList.remove('lesson-active');
 let chosen=false;
 for(const el of messageSlots){
  const active=el.id==='encounter-cue'?el.classList.contains('visible')&&!bossLesson:
   el.id==='chapter-banner'?!el.classList.contains('hidden'):
   el.id==='callout'?el.classList.contains('show'):
   el.id==='sector-modifier'?!!el.textContent:el.classList.contains('visible');
  const radioOwnsBand=el.id!=='gift-preview'&&innerWidth<760&&bossLesson&&phaseState.active&&!phaseState.full&&!el.classList.contains('boss-retired');
  const show=live&&!phaseState.relay&&!radioOwnsBand&&!chosen&&active;
  el.classList.toggle('flow-muted',!show);if(show)chosen=true;
 }
}
hook('hud',messageHUD);
hook('draw',messageHUD);

function applyReducedMotion(value){reduced=motionPreference.matches||value;document.body.classList.toggle('reduced-motion',reduced);try{localStorage.setItem('sandbox-reduced-motion',String(value));}catch{}resize();}
motionPreference.addEventListener('change',()=>{let preference=false;try{preference=localStorage.getItem('sandbox-reduced-motion')==='true';}catch{}applyReducedMotion(preference);if(modalKind==='options')showOptions();});
document.body.classList.toggle('reduced-motion',reduced);
$('modal-content').addEventListener('click',e=>{
 const b=e.target.closest('[data-exp]');if(!b)return;
 if(b.dataset.exp==='display'){setRetro(b.dataset.value);showOptions();}
 if(b.dataset.exp==='lines'){setRetro(save.display,Number(b.dataset.value));showOptions();}
 if(b.dataset.exp==='motion'){applyReducedMotion(!reduced);showOptions();}
 if(b.dataset.exp==='voice'){save.voice=!save.voice;Sound.setVoice(save.voice);persist();showOptions();}
});

let systemBootActive=false;
function menuRoot(){if(systemBootActive||status==='briefing')return null;if(!$('modal').classList.contains('hidden'))return $('modal-content');return status==='title'?document:null;}
function menuItems(root=menuRoot()){
 if(!root)return [];
 const selector=root===document?'#title-screen button,.masthead button,#footer button':'button:not([disabled]),a[href],input:not([disabled])';
 return [...root.querySelectorAll(selector)].filter(el=>!el.disabled&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
}
function menuFocus(el){if(!el)return;document.querySelectorAll('.menu-cursor').forEach(x=>x.classList.remove('menu-cursor'));el.classList.add('menu-cursor');el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest'});}
document.addEventListener('focusin',e=>{const root=menuRoot();if(root&&menuItems(root).includes(e.target)){document.querySelectorAll('.menu-cursor').forEach(el=>el.classList.remove('menu-cursor'));e.target.classList.add('menu-cursor');}});
function menuMove(direction){
 const items=menuItems();if(!items.length)return;
 const current=document.activeElement,index=items.indexOf(current);if(index<0){menuFocus(items.find(x=>x.id==='start')||items[0]);return;}
 const horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1,a=current.getBoundingClientRect(),ax=a.x+a.width/2,ay=a.y+a.height/2;
 let best=null,bestCost=Infinity;
 for(const el of items){if(el===current)continue;const b=el.getBoundingClientRect(),dx=b.x+b.width/2-ax,dy=b.y+b.height/2-ay,forward=(horizontal?dx:dy)*sign,across=Math.abs(horizontal?dy:dx);if(forward<5)continue;const cost=forward+across*2.5;if(cost<bestCost){bestCost=cost;best=el;}}
 menuFocus(best||items[(index+sign+items.length)%items.length]);
}
function menuBack(){
 if(window.SandboxCover?.back())return;
 if(modalKind==='pause'){resume();return;}
 if(modalKind==='brief-sector'){showSectors();return;}
 if(modalKind==='benchmark-rules'){showBenchmark();return;}
 if(modalKind==='result'||modalKind==='intermission'){toTitle();return;}
 if(modalKind)closeInfo();
}
window.addEventListener('keydown',e=>{
 const root=menuRoot();if(!root)return;
 const input=e.target.matches('input,textarea,select');
 if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)menuBack();return;}
 if(e.code==='Tab'){
  const items=menuItems(root),index=items.indexOf(document.activeElement);if(items.length){e.preventDefault();e.stopImmediatePropagation();menuFocus(items[(index+(e.shiftKey?-1:1)+items.length)%items.length]);}return;
 }
 const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.code];
 if(direction&&(!input||e.target.type==='range'&&(direction==='up'||direction==='down'))){e.preventDefault();e.stopImmediatePropagation();menuMove(direction);return;}
 if((e.code==='Enter'||e.code==='Space')&&!input){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat){const items=menuItems(root),active=items.includes(document.activeElement)?document.activeElement:items.find(x=>x.id==='start')||items[0];active?.click();}return;}
 if(e.code==='KeyR'&&!input&&modalKind==='result'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)uiRetry();}
},true);
let menuPadPrevious=[],menuPadDirection='',menuPadRepeatAt=0;
function pollMenuPad(p){
 if(systemBootActive){menuPadPrevious=[!!p.buttons[0]?.pressed,!!p.buttons[1]?.pressed,!!p.buttons[9]?.pressed];if(p.buttons.some(b=>b.pressed)||p.axes.some(v=>Math.abs(v)>.5))endSystemBoot();return true;}
 if(!menuRoot()){menuPadPrevious=[!!p.buttons[0]?.pressed,!!p.buttons[1]?.pressed,!!p.buttons[9]?.pressed];menuPadDirection='';return false;}
 const pressed=i=>!!p.buttons[i]?.pressed,x=p.axes[0]||0,y=p.axes[1]||0;
 const direction=pressed(14)||x<-.5?'left':pressed(15)||x>.5?'right':pressed(12)||y<-.5?'up':pressed(13)||y>.5?'down':'';
 const time=performance.now();if(direction&&(direction!==menuPadDirection||time>=menuPadRepeatAt)){const active=document.activeElement;if(active?.type==='range'&&(direction==='left'||direction==='right')){active.value=clamp(Number(active.value)+(direction==='left'?-5:5),Number(active.min),Number(active.max));active.dispatchEvent(new Event('input',{bubbles:true}));}else menuMove(direction);menuPadRepeatAt=time+(direction===menuPadDirection?140:360);}menuPadDirection=direction;
 const current=[pressed(0),pressed(1),pressed(9)];
 if((current[0]&&!menuPadPrevious[0])||(current[2]&&!menuPadPrevious[2])){const items=menuItems(),active=items.includes(document.activeElement)?document.activeElement:items.find(x=>x.id==='start')||items[0];active?.click();}
 if(current[1]&&!menuPadPrevious[1])menuBack();menuPadPrevious=current;return true;
}
$('start').focus({preventScroll:true});
