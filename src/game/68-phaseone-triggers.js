/* Trigger inputs are read-only: core events, named decisions, score and sector position. */
function phaseDecision(id){return game.decisions?.findLast(d=>d.id===id);}
function phaseWindow(id,at,options={}){
 const d=game.distance,late=Math.max(12,game.speed||32)*4;
 if(d<at||d>at+(options.window??late))return false;
 return phaseQueue(id,options.kind||'story',{...options,ttl:options.ttl??Math.max(0,4-(d-at)/Math.max(12,game.speed||32))});
}
function phaseCalmLine(id,from,to,local,options={}){
 if(!id||local<from||local>=to||phaseState.active||phaseState.queue.some(q=>q.priority>=PHASE_PRIORITY.story)||document.body.classList.contains('lesson-active'))return;
 const ahead=Math.max(30,game.speed*1.2);
 if(entities.some(e=>!e.done&&e.kind==='obstacle'&&e.d>game.distance&&e.d-game.distance<ahead))return;
 phaseQueue(id,'story',{ttl:2,...options});
}
// PHASEONE speaks rarely in a run: the two fork instructions, the relay offers, and two looks at
// what wears the hood. Calls, boss entrances, gifts and the first reset own the other moments.
function phaseSchedule(){
 if(game.countdown>0)return;
 const stage=game.stage%12,start=Core.stageStart(game.stage),length=Core.stageLength(game.stage),local=game.distance-start;
 if(phaseState.lastStage!==game.stage){
  phaseState.queue=phaseState.queue.filter(q=>q.crossStage);phaseState.lastStage=game.stage;phaseState.bossId=game.boss?.id||'';
 }
 if(stage===0)phaseWindow('r01_fork',start+195,{critical:true,ttl:5,until:start+329,window:20});
 if(stage===4){
  const fork=entities.find(e=>e.type==='fork');
  if(fork&&!fork.done&&fork.d-game.distance>0&&fork.d-game.distance<=230)phaseQueue('r05_fork','story',{critical:true,ttl:7,until:fork.d});
 }
 for(const relay of RELAYS)if(relay.stage===stage&&local>=length*relay.at&&local<length*(relay.at+.12))offerRelay(relay);
 if(mode==='story'&&!game.boss&&!phaseState.relay&&!phaseState.queue.some(q=>q.kind==='relay')){
  const id=stage===4||stage===5?'veil_glimpse':stage===8||stage===9?'veil_torn':null;
  if(id&&PHASE_LINES[id])phaseCalmLine(id,length*.22,length*.82,local,{key:'run:'+id});
 }
 phaseState.lastDistance=game.distance;
}
function phaseEvent(e){
 const eventBoss=typeof e.boss==='string'?e.boss:e.boss?.id;
 const bossId=eventBoss||game.boss?.id||phaseState.bossId||({3:'watchdog',7:'reset-storm',11:'exit-condition'}[game.stage%12]);
 const boss=PHASE_BOSSES[bossId];
 if(e.type==='bossStart'){
  phaseState.bossId=bossId;
  if(boss)phaseQueue(boss.prefix+'_start','boss',{critical:true,ttl:10});
 }
 if(e.type==='bossPhase'){
  phaseState.bossId=bossId;
  const id=boss?.phases[e.phase];if(id)phaseQueue(id,'boss',{critical:true,ttl:18});
 }
 if(e.type==='route'&&e.decision==='exit-choice'){
  const d=phaseDecision('exit-choice');if(d)chosenEnding=d.route===0?'report':d.route<0?'return':'cut';
 }
 if(e.type==='finish'&&!e.won&&!phaseState.deathPending){phaseState.deaths++;phaseState.deathPending=true;}
}
hook('event',phaseEvent);
hook('reset',phaseReset);
