/* These gates must run after the collective and director reassign the lifecycle. */
const phaseNextSector=nextStage;
nextStage=()=>{
 const id=PHASE_CALLS[game.stage%12],key='call:'+game.stage;
 if(mode==='story'&&campaignRun?.pendingStage&&id&&!phaseState.sent.has(key)){
  phaseState.sent.add(key);phaseOpenCall([id],'transfer',()=>phaseNextSector());return;
 }
 phaseNextSector();
};
const phaseFinishRun=finish;
finish=won=>{
 const decision=phaseDecision('exit-choice');
 if(won&&game.stage%12===11&&decision&&!phaseState.sent.has('ending')){
  chosenEnding=decision.route===0?'report':decision.route<0?'return':'cut';phaseState.sent.add('ending');
  phaseEndRun();
  phaseOpenCall(['end_'+chosenEnding],'ending',()=>phaseFinishRun(true));return;
 }
 phaseFinishRun(won);
};
if(new URLSearchParams(location.search).get('test')==='1')window.__phase={
 emit:e=>runHooks('event',e),
 triggers:()=>({...PHASE_TRIGGERS}),
 state:()=>({id:phaseState.id,active:phaseState.active,full:phaseState.full,queue:phaseState.queue.map(q=>q.id),history:phaseState.history.slice(),
  effect:phaseState.mood,static:phaseState.staticLevel,glitch:phaseState.glitch,deaths:phaseState.deaths,relay:phaseState.relay?.id||null,
  text:phaseState.text,shown:phaseState.shown,duration:phaseState.duration,speaking:Sound.speaking,timing:Sound.voiceTiming?.()||null,influence:relayName.alpha}),
 opening:()=>{flags.manual=true;phaseOpenCall(BRIEFING,'opening',()=>launchGame());},
 page:phaseShowPage,question:index=>{phaseState.question=index;phaseQuestion();},
 line:(id,kind='story')=>{phaseQueue(id,kind,{key:'test:'+phaseState.serial,critical:kind==='boss',ttl:30});phaseDrain();},
 relay:index=>{offerRelay(RELAYS[index]);phaseDrain();},
 advance:seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++){now+=1/60;phaseUpdate(1/60);}phaseRender();},
 clear:()=>{phaseStopLine('skip');phaseClose();phaseState.queue.length=0;phaseState.relay=null;},
 scene:(stage,fraction=.2)=>{
  phaseStopLine('skip');phaseClose();flags.manual=true;practiceStage=stage;mode='practice';launchGame();game.countdown=0;
  game.distance=Core.stageStart(stage)+Core.stageLength(stage)*fraction;worldDistance=game.distance;
  phaseState.lastDistance=game.distance;phaseState.lastStage=stage;phaseClose();phaseState.queue.length=0;bannerTime=0;$('chapter-banner').classList.add('hidden');animateHero(0,false);render();updateHUD();
 },
 transfer:stage=>{mode='story';phaseOpenCall([PHASE_CALLS[stage]],'transfer',()=>{status='running';enterRunUI();});},
 ending:route=>{game.decisions=[...(game.decisions||[]).filter(d=>d.id!=='exit-choice'),{id:'exit-choice',route,distance:game.distance}];game.stage=11;phaseState.sent.delete('ending');finish(true);},
 reset:phaseReset,
 gl:()=>({world:renderer.gl.getError(),portrait:portraitRenderer?.gl.getError(),portraitError})
};
