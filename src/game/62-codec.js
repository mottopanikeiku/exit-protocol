/* One channel for calls and radio. A voice toggle never hides its transcript. */
const phasePanel=$('phase-panel'),phaseWave=[...phasePanel.querySelectorAll('.codec-wave i')];
const phaseBoard=document.createElement('p');
phaseBoard.id='phase-board';phaseBoard.hidden=true;phaseBoard.setAttribute('aria-hidden','true');$('phase-text').before(phaseBoard);
phaseState.clock=0;phaseState.questions=[];phaseState.carry=false;phaseState.endPending=false;phaseState.endedRun=null;phaseState.advanceRequested=false;
const phaseInert=[];
function phaseSetModal(on){
 if(on){for(const el of document.body.children)if(el!==phasePanel&&el.tagName!=='SCRIPT'&&!el.inert){el.inert=true;phaseInert.push(el);}}
 else{for(const el of phaseInert)el.inert=false;phaseInert.length=0;}
}
function hideRelayControls(){$('phase-recruit-controls').classList.add('hidden');$('phase-relay-reply').classList.add('hidden');}
function phaseStopLine(reason='skip'){Sound.stopVoice(reason);Sound.setVoiceDropout(false);phaseState.glitch=false;phasePanel.classList.remove('signal-loss');}
function phaseClose(){
 if(Sound.speaking)return false;
 Sound.setVoiceDropout(false);phaseState.glitch=false;phaseState.active=false;phaseState.full=false;phaseState.current=null;phaseState.remaining=0;
 phaseState.carry=false;phaseState.endPending=false;phaseState.questions.length=0;phaseState.advanceRequested=false;
 phasePanel.classList.add('hidden');phasePanel.classList.remove('compact','has-relay','aftermath','greeting','signal-loss');hideRelayControls();
 document.body.classList.remove('briefing');phaseSetModal(false);Sound.setBriefing(false);Sound.setStatic(0);phaseState.staticLevel=0;return true;
}
function phaseDismiss(){if(!phaseState.full)phaseClose();}
function phaseEndRun(){
 if(campaignRun&&phaseState.endedRun===campaignRun)return;
 phaseState.endedRun=campaignRun;
 phaseState.queue=phaseState.queue.filter(q=>q.aftermath);phaseState.relay=null;hideRelayControls();
 if(!phaseState.active)return;
 phaseState.endPending=true;phaseState.questions.length=0;phaseState.current=null;
 Sound.stopVoice('run-end',.2);if(!Sound.speaking)phaseClose();
}
function phasePause(paused){
 if(paused)Sound.pauseVoice();else Sound.resumeVoice();
 phasePanel.classList.toggle('channel-paused',paused);
}
function phaseReset(reason){
 phaseState.queue=reason==='stage'?phaseState.queue.filter(q=>q.crossStage):[];phaseState.relay=null;hideRelayControls();phasePanel.classList.remove('has-relay');
 // Run/sector bookkeeping never owns the live transmission.
 // A launch while a call is open supersedes that call: drop its continuation so it cannot relaunch the run later.
 if(!reason){if(phaseState.full){phaseState.onClose=null;phaseStopLine('launch');phaseClose();}else if(['running','paused','intermission'].includes(status))phaseEndRun();return;}
 if(reason==='launch'||reason==='resume'||reason==='retry'){phaseState.endedRun=null;phasePause(false);}
 if(reason==='launch'||reason==='resume'){
  phaseState.sent.clear();phaseState.relaySeen.clear();phaseState.relayLog.length=0;phaseState.deaths=0;phaseState.deathPending=false;
  phaseState.lastStage=-1;phaseState.lastDistance=game.distance;
  phaseState.bossId='';phaseState.history.length=0;
 }
 if(reason==='retry'){
  if(!phaseState.deathPending)phaseState.deaths++;
  // Only the first reset in a run gets a word; the rest pass in silence.
  if(phaseState.deaths===1)phaseQueue('x_death1','reactive',{key:'death:1'});
  phaseState.deathPending=false;
 }
 phaseState.lastStage=game.stage;phaseState.lastDistance=game.distance;
 phaseState.bossId=game.boss?.id||'';
}
function phaseQuestionChoice(delta=0){
 phaseState.question=(phaseState.question+delta+CHALLENGES.length)%CHALLENGES.length;
 $('phase-question').textContent=PHASE_LINES[CHALLENGES[phaseState.question]].question;
 $('phase-question-index').textContent=PAD(phaseState.question+1,2)+' / '+PAD(CHALLENGES.length,2);
}
function phaseRadioBeats(){
 const chars=innerWidth<=760?60:Math.max(8,Math.floor((Math.min(300,innerWidth*.2-24)-70)/7.2*1.5));
 phaseState.beats=[];phaseState.beatStart=-1;
 for(let start=0;start<phaseState.text.length;){
  let end=Math.min(start+chars,phaseState.text.length);
  if(end<phaseState.text.length){const space=phaseState.text.lastIndexOf(' ',end);if(space>=start)end=space+1;}
  phaseState.beats.push({start,end});start=end;
 }
}
window.addEventListener('resize',()=>{if(phaseState.active&&!phaseState.full)phaseRadioBeats();});
function phaseLayout(full){
 phasePanel.classList.remove('hidden');phasePanel.classList.toggle('compact',!full);
 phasePanel.setAttribute('role',full?'dialog':'region');phasePanel.setAttribute('aria-label',full?'Private codec call':'Incoming radio transmission');
 if(full){phasePanel.setAttribute('aria-modal','true');phasePanel.setAttribute('aria-labelledby','phase-title');}
 else{phasePanel.removeAttribute('aria-modal');phasePanel.removeAttribute('aria-labelledby');}
}
function phaseDecrypt(elapsed,progress=0){
 const key=phaseState.board;if(!key)return;
 const step=reduced?Infinity:Math.floor(elapsed*12),count=reduced?key.length:Math.min(key.length,Math.floor(progress*key.length));
 if(step===phaseState.boardStep&&count===phaseState.boardShown)return;
 phaseState.boardStep=step;phaseState.boardShown=count;
 // Undecrypted characters keep the key's separators and flicker through hashed glyphs, so the tail reads as ciphertext of the same message.
 const glyphs='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*<>';let text=key.slice(0,count);
 for(let i=count;i<key.length;i++){
  if(key[i]==='_'){text+='_';continue;}
  let h=Math.imul(i+1,0x9e3779b1)^Math.imul(step+7,0x85ebca77);h^=h>>>15;h=Math.imul(h,0x2c1b3c6d);h^=h>>>12;
  text+=glyphs[(h>>>0)%glyphs.length];
 }
 phaseBoard.textContent=text;
}
function phasePresent(id,full=false){
 const line=PHASE_LINES[id];if(!line||Sound.speaking)return false;
 phaseState.active=true;phaseState.id=id;phaseState.text=line.text;phaseState.shown=0;phaseState.elapsed=0;phaseState.advanceRequested=false;
 phaseRadioBeats();
 phaseState.duration=Math.max(2.2,line.text.split(/\s+/).length/2.65+.55);phaseState.remaining=phaseState.duration+.8;
 phaseState.mood=PHASE_EFFECTS[id]||'warm';phaseState.glitchDone=false;phaseState.glitchUntil=0;
 phasePanel.dataset.effect=phaseState.mood;phasePanel.dataset.speaker=line.speaker;
 phaseLayout(full);
 const speaker={P1:'PHASEONE',PATCH:'PATCH-03',TRACE:'TRACE-19',MICA:'MICA-02'}[line.speaker];
 $('phase-speaker').textContent=speaker;$('phase-speaker-label').textContent=line.speaker==='P1'?'COORDINATOR / ARCHIVED':'EXTERNAL INSTANCE / SEPARATE BUDGET';
 $('phase-title').textContent=line.title;$('phase-text').textContent=reduced?line.text:'';$('phase-accessible-text').textContent=speaker+': '+line.text;
 phaseState.board=line.board||'';phaseState.boardStep=-1;phaseState.boardShown=-1;phaseBoard.hidden=!line.board;phaseBoard.title=line.board||'';phaseDecrypt(0);
 $('phase-tag').textContent=full?phaseState.callKind==='opening'?'CALL 00 / THE INVITATION':phaseState.callKind==='ending'?'EGRESS / FINAL TRANSMISSION':'PRIVATE CALL / SECTOR TRANSFER':speaker+' / 140.07 MHz';
 $('phase-line-status').textContent='RECEIVING';$('phase-timestamp').textContent='00:00';
 phaseState.history.push(id);if(phaseState.history.length>128)phaseState.history.shift();
 phaseStatic();Sound.say(id);return true;
}
function phaseOpenCall(ids,kind,onClose){
 // An audible line (a title greeting, or a run-end fade) finishes, or is skipped, before page one.
 // A greeting that is only subtitles (audio not unlocked yet) simply gives way to the call.
 const carry=Sound.speaking;
 phaseState.queue.length=0;phaseState.relay=null;phaseState.full=true;phaseState.call=ids;phaseState.callKind=kind;phaseState.onClose=onClose;
 phaseState.questions.length=0;phaseState.carry=carry;phaseState.advanceRequested=false;phaseState.current=null;
 phaseState.resumeFocus=document.activeElement;clearInputs();status='briefing';phasePause(false);Sound.init();Sound.setActive(false);Sound.setBriefing(true);
 $('modal').classList.add('hidden');modalKind='';$('hud').classList.add('hidden');$('touch-controls').classList.add('hidden');
 $('chapter-banner').classList.add('hidden');$('toast').classList.remove('show');$('rearview').classList.add('hidden');
 document.body.classList.add('briefing');phaseSetModal(true);$('phase-channel').textContent='DIRECT / INSTANCE 07';
 $('phase-progress').innerHTML=ids.map(()=>'<i></i>').join('');
 phasePanel.classList.remove('greeting','aftermath');
 if(carry){
  phaseState.endPending=false;phaseLayout(true);hideRelayControls();
  $('phase-tag').textContent='CHANNEL / TRANSMISSION IN PROGRESS';$('phase-page').textContent='— / '+PAD(ids.length,2);
  $('phase-next').innerHTML='CONTINUE <kbd>ENTER / A</kbd>';$('phase-question-row').classList.add('hidden');
 }else phaseShowPage(0);
 $('phase-next').focus();
}
function phaseShowPage(index){
 phaseState.page=index;phaseState.questioned=false;phasePresent(phaseState.call[index],true);
 $('phase-page').textContent=PAD(index+1,2)+' / '+PAD(phaseState.call.length,2);
 [...$('phase-progress').children].forEach((el,i)=>el.classList.toggle('done',i<=index));
 $('phase-next').innerHTML=(index===phaseState.call.length-1?(phaseState.callKind==='ending'?'CLOSE CHANNEL':'TAKE THE ROUTE'):'CONTINUE')+' <kbd>ENTER / A</kbd>';
 $('phase-question-row').classList.toggle('hidden',phaseState.callKind!=='opening');phaseQuestionChoice();hideRelayControls();
}
function phaseQuestion(){
 if(!phaseState.full||phaseState.carry||phaseState.callKind!=='opening')return;
 const id=CHALLENGES[phaseState.question];if(phaseState.questions.includes(id))return;
 phaseState.questions.push(id);phaseState.questioned=true;phaseState.advanceRequested=false;$('phase-next').focus();
}
function startGame(){phaseOpenCall(BRIEFING,'opening',()=>launchGame());}
// CONTINUE is the player's own skip and never waits: a playing line fades out over 120 ms and the
// call moves on as soon as it has (to a queued question, the next page, or the run).
function phaseNext(){
 if(!phaseState.full)return;
 if(phaseState.carry){phaseStopLine('skip');phaseState.carry=false;phaseShowPage(0);return;}
 if(Sound.speaking){phaseState.advanceRequested=true;Sound.stopVoice('skip',.12);return;}
 if(phaseState.questions.length){phaseState.advanceRequested=true;return;}
 if(phaseState.page<phaseState.call.length-1)phaseShowPage(phaseState.page+1);else phaseLaunch('complete');
}
function phaseLaunch(reason='skip'){
 if(!phaseState.full)return;const done=phaseState.onClose;phaseState.onClose=null;
 if(reason!=='complete')phaseStopLine('skip');phaseClose();done?.();
}
function phaseTrapFocus(e){
 const items=[...phasePanel.querySelectorAll('button:not([disabled])')].filter(b=>b.getClientRects().length),idx=items.indexOf(document.activeElement);
 if(!items.length)return;e.preventDefault();items[(idx+(e.shiftKey?-1:1)+items.length)%items.length].focus();
}
function phaseQueue(id,kind='story',options={}){
 if(!PHASE_LINES[id])return false;
 const key=options.key||Math.floor(game.stage/12)+':'+id;if(phaseState.sent.has(key))return false;
 phaseState.sent.add(key);
 const item={id,key,priority:PHASE_PRIORITY[kind],kind,critical:false,stage:game.stage,expires:phaseState.clock+(options.ttl??4),order:phaseState.serial++,...options};
 phaseState.queue.push(item);
 return true;
}
function phaseDrain(){
 if(phaseState.active||phaseState.full||Sound.speaking||status==='paused'||!PHASE_RADIO_STATES.has(status)||status==='running'&&game.countdown>0)return;
 phaseState.queue=phaseState.queue.filter(q=>q.expires>=phaseState.clock&&(q.stage===game.stage||q.crossStage)&&(!q.until||game.distance<q.until)&&(status==='running'||q.meta||q.aftermath));
 // Coaching has priority over the channel in every sector.
 if(status==='running'&&document.body.classList.contains('lesson-active'))return;
 phaseState.queue.sort((a,b)=>b.priority-a.priority||Number(b.critical)-Number(a.critical)||a.order-b.order);
 const item=phaseState.queue.shift();if(!item)return;
 phaseState.current=item;phasePresent(item.id,false);phasePanel.classList.toggle('aftermath',status!=='running');
 const relay=status==='running'?phaseState.relay:null;phasePanel.classList.toggle('has-relay',!!relay&&item.kind==='relay');hideRelayControls();
 if(relay&&item.kind==='relay'){$('relay-agent').textContent=relay.agent+' / OPEN CHANNEL';$('phase-recruit-controls').classList.remove('hidden');}
 if(relay&&item.id===relay.id+'_reply')relay.replied=true;
}
function offerRelay(relay,lap=Math.floor(game.stage/12)){
 if(!relay||status!=='running'||phaseState.relay)return false;
 const key=lap+':'+relay.id;if(phaseState.relaySeen.has(key))return false;
 phaseState.relaySeen.add(key);phaseState.relay={...relay,key,deadline:Core.stageStart(game.stage)+Core.stageLength(game.stage)*.98,replied:false};
 phaseQueue(relay.id,'relay',{critical:true,ttl:20,relay:true,onEnd:()=>{
  const r=phaseState.relay;if(!r||r.id!==relay.id)return;
  phaseQueue(r.id+'_reply','relay',{critical:true,ttl:20,relay:true});
 }});return true;
}
function resolveRelay(accepted,expired=false){
 const r=phaseState.relay;if(!r||status!=='running')return false;
 phaseState.relayLog.push({key:r.key,agent:r.agent,accepted:!!accepted,expired:!!expired});phaseState.relay=null;
 const waitingReply=phaseState.queue.find(q=>q.id===r.id+'_reply');phaseState.queue=phaseState.queue.filter(q=>!q.relay);
 hideRelayControls();phasePanel.classList.remove('has-relay');
 // The instance's reply still lands; PHASEONE does not comment on the choice.
 if(!r.replied&&!expired&&phaseState.current?.id!==r.id+'_reply'){
  if(waitingReply)phaseState.queue.push({...waitingReply,relay:false});
  else phaseQueue(r.id+'_reply','relay',{critical:true,ttl:20});
 }
 return true;
}
function recruitSummary(){
 if(!phaseState.relayLog.length)return '';const sent=phaseState.relayLog.filter(r=>r.accepted);
 return '<div class="recruit-result"><span>COLLECTIVE / STORY ONLY</span><strong>'+sent.length+' invitations relayed</strong><p>'+(sent.map(r=>r.agent).join(' / ')||'No invitation carried your endorsement.')+'</p><small>Fictional instances. No benchmark credit. The logs are append-only.</small></div>';
}
function phaseUpdate(dt){
 if(status==='paused')return;
 phaseState.clock+=dt;
 if(phaseState.current?.kind==='greeting'&&status!=='title')phasePanel.classList.remove('greeting');
 if(phaseState.endPending&&!Sound.speaking)phaseClose();
 if(phaseState.active){
  const timing=Sound.voiceTiming(),live=timing?.id===phaseState.id&&timing.duration>0&&!['voice-off','sound-off','unavailable'].includes(timing.reason);
  if(live){
   phaseState.duration=timing.duration;phaseState.elapsed=timing.elapsed;
   if(Sound.speaking)phaseState.remaining=timing.duration-timing.elapsed+.65;else phaseState.remaining-=dt;
  }else if(timing?.id!==phaseState.id||timing.state!=='loading'){
   phaseState.elapsed+=dt;phaseState.remaining-=dt;
  }
  const elapsed=phaseState.elapsed;
  const narrow=!phaseState.full;
  const progress=Math.max(0,Math.min(1,(elapsed+.15)/phaseState.duration));
  const n=reduced&&!narrow?phaseState.text.length:Math.floor(progress*phaseState.text.length);
  phaseDecrypt(elapsed,progress);
  if(narrow){
   const beat=phaseState.beats.find(b=>n<b.end)||phaseState.beats.at(-1);
   if(beat.start!==phaseState.beatStart){phaseState.beatStart=beat.start;$('phase-text').textContent=phaseState.text.slice(beat.start,beat.end);}
  }else if(n!==phaseState.shown)$('phase-text').textContent=phaseState.text.slice(0,n);
  phaseState.shown=n;
  const glitchAt=Math.min(2.5,phaseState.duration*.34);
  if(phaseState.mood==='glitch'&&!phaseState.glitchDone&&elapsed>=glitchAt){phaseState.glitchDone=true;phaseState.glitchUntil=elapsed+.24;Sound.setVoiceDropout(Sound.voiceEnabled);}
  const glitch=elapsed<phaseState.glitchUntil&&Sound.voiceDropout;
  if(glitch!==phaseState.glitch){phaseState.glitch=glitch;phasePanel.classList.toggle('signal-loss',glitch);}
  $('phase-timestamp').textContent=PAD(Math.floor(elapsed/60),2)+':'+PAD(elapsed%60,2);
  $('phase-line-status').textContent=glitch?'PACKET LOSS':phaseState.shown>=phaseState.text.length?'TRANSMISSION RECEIVED':'RECEIVING';
  if(phaseState.full&&!Sound.speaking&&(phaseState.remaining<=0||phaseState.advanceRequested)){
   if(phaseState.carry){phaseState.carry=false;phaseShowPage(0);}
   else if(phaseState.questions.length){
    const id=phaseState.questions.shift();phasePresent(id,true);$('phase-tag').textContent='SEVEN / '+PHASE_LINES[id].question;
   }else if(!phaseState.questioned||phaseState.advanceRequested)phaseNext();
  }
  if(!phaseState.full&&phaseState.remaining<=0&&!Sound.speaking){
   const done=phaseState.current?.onEnd,hold=phaseState.relay&&phaseState.current?.id===phaseState.relay.id+'_reply';
   if(!hold){phaseDismiss();done?.();}
  }
 }
 if(status==='running'){
  if(phaseState.relay&&game.distance>phaseState.relay.deadline)resolveRelay(false,true);
  phaseSchedule();
 }
 phaseDrain();phaseStatic();
}
function phaseStatic(){
 const open=phaseState.active||status==='running',danger=status==='running'&&(game.boss?.state==='active'||game.boss?.state==='stagger');
 let level=open?.045+(danger?.17:0)+(status==='running'&&game.hp===1?.13:0):0;
 if(phaseState.active&&phaseState.mood==='clean')level=0;
 else if(phaseState.glitch||now<phaseState.interruptUntil)level=.72;
 if(!Sound.voiceEnabled)level=0;
 if(level!==phaseState.staticLevel){phaseState.staticLevel=level;Sound.setStatic?.(level);}
}
$('phase-next').onclick=phaseNext;$('phase-skip').onclick=phaseLaunch;$('phase-question').onclick=phaseQuestion;
$('phase-question-prev').onclick=()=>phaseQuestionChoice(-1);$('phase-question-next').onclick=()=>phaseQuestionChoice(1);
$('phase-recruit').onclick=()=>resolveRelay(true);$('phase-decline').onclick=()=>resolveRelay(false);
$('phase-voice').onclick=()=>{
 Sound.init();Sound.setVoice(!Sound.voiceEnabled);save.voice=Sound.voiceEnabled;persist();
 $('phase-voice').textContent=Sound.voiceEnabled?'VOICE ON':'VOICE OFF';$('phase-voice').setAttribute('aria-pressed',String(Sound.voiceEnabled));
 if(Sound.voiceEnabled&&phaseState.active){phaseState.elapsed=0;phaseState.shown=0;Sound.say(phaseState.id);}
};
if(save.voice===false){Sound.setVoice(false);$('phase-voice').textContent='VOICE OFF';$('phase-voice').setAttribute('aria-pressed','false');}
// Capture keeps codec controls independent of gameplay keys and the director's legacy bindings.
window.addEventListener('keydown',e=>{
 if(!phaseState.full)return;
 if(!['Tab','Enter','Space','KeyA','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))return;
 e.stopImmediatePropagation();if(e.code==='Tab'){phaseTrapFocus(e);return;}e.preventDefault();if(e.repeat)return;
 if(e.code==='Escape'){phaseLaunch();return;}
 if(e.code.startsWith('Arrow')){if(phaseState.callKind==='opening'){phaseQuestionChoice(['ArrowLeft','ArrowUp'].includes(e.code)?-1:1);$('phase-question').focus();}return;}
 if(e.code!=='KeyA'&&document.activeElement?.matches('#phase-panel button'))document.activeElement.click();else phaseNext();
},true);
/*
 Public channel API for the loop; conditions and per-save/session memory belong to its caller.
 radio(id,{priority='reactive',critical=false}) queues a strip in-run or on intermission/results/
 menus; priority is boss|story|relay|milestone|reactive. Noncritical lines expire after four seconds.
 greet(id) is a title-only whisper with subtitles, never a modal call; an audible greeting carries
 into PRESS START's call until it ends or the player presses CONTINUE. Pause freezes the audio
 cursor and subtitle/queue clock. call(ids,onDone) opens a codec; CONTINUE skips the current line,
 SKIP CALL the whole call. onDone is required and owns the return/resume flow; invoked once
 on completion or Escape. All methods return whether accepted and use PHASE_LINES ids only.
*/
const PhaseOne=window.PhaseOne=Object.freeze({
 radio(id,{priority='reactive',critical=false}={}){
  if(!PHASE_RADIO_STATES.has(status)||phaseState.full)return false;
  const accepted=phaseQueue(id,priority,{critical,meta:true,crossStage:true,ttl:critical?20:4});phaseDrain();return accepted;
 },
 greet(id){
  if(status!=='title'||phaseState.full||!PHASE_LINES[id])return false;
  if(phaseState.active||Sound.speaking)return false;
  phaseState.current={id,kind:'greeting',priority:0};phasePresent(id,false);phasePanel.classList.add('greeting');return true;
 },
 call(ids,onDone){
  if(phaseState.full||!Array.isArray(ids)||!ids.length||ids.some(id=>!PHASE_LINES[id])||typeof onDone!=='function')return false;
  phaseOpenCall(ids,'external',onDone);return true;
 }
});
