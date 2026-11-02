/* Late bindings: UI/feel may capture finish, so observe the actual result modal. */
const loopSelectedOptions=selectedOptions;
selectedOptions=()=>LoopModel.options(Loop.state,loopSelectedOptions());
const loopShowModal=showModal;
showModal=(html,kind,wide=false)=>{loopShowModal(html,kind,wide);if(kind==='result')Loop.result(campaignRun.result());};
const loopCloseInfo=closeInfo;
closeInfo=()=>{if(modalKind.startsWith('loop-'))Loop.leave();loopCloseInfo();};
const loopAction=action;
action=a=>{if(Loop.state.prefs.modifier==='mirror'){if(a.startsWith('left'))a='right'+a.slice(4);else if(a.startsWith('right'))a='left'+a.slice(5);}loopAction(a);};
let loopDemo=null,loopIdleAt=performance.now(),loopGreeted=false,loopTitleSince=performance.now(),loopLastTitle=status==='title',loopClickBlock=0;
const loopDemoOverlay=document.createElement('div');loopDemoOverlay.id='loop-demo';loopDemoOverlay.innerHTML='<strong>DEMO</strong><span>PRERECORDED INSTANCE / NO PROGRESS SAVED<br>ANY INPUT RETURNS TO TITLE</span>';document.body.append(loopDemoOverlay);
hook('reset',reason=>{
 if(loopDemo)return;
 if(reason==='launch'||reason==='retry'||reason==='resume'){
  Loop.stopTrack();const restore=reason!=='launch';
  Loop.begin({...campaignRun.options,rewardBase:restore?game.reward||0:0,distanceBase:restore?game.distance:Core.stageStart(campaignRun.options.startStage||0),counterBase:restore?game:null},reason);
 }
 if(reason==='stage')Loop.feelEvent({type:'stage'});
 if(reason==='title'){Loop.title();loopIdleAt=performance.now();loopTitleSince=loopIdleAt;}
});
hook('event',e=>{if(loopDemo)return;Loop.event(e,game);Loop.feelEvent(e);});
hook('draw',()=>Loop.drawFeel());
function startLoopDemo(){
 if(loopDemo||status!=='title'||modalKind||typeof ATTRACT_TRACE==='undefined'||!ATTRACT_TRACE.inputs.length)return false;
 Loop.stopTrack();clearInputs();
 loopDemo={run:campaignRun,ranked:rankedRun,game,entities,mode,cursor:0,trace:ATTRACT_TRACE};
 campaignRun=new Core.Run(ATTRACT_TRACE.seed,ATTRACT_TRACE.options);rankedRun=campaignRun;game=campaignRun.state;entities=campaignRun.entities;mode='practice';status='running';worldDistance=game.distance;
 particles=[];resetBlocks();enterRunUI();document.body.classList.add('loop-demo');$('chapter-banner').classList.add('hidden');
 Sound.init();Sound.setZone(game.stage,false);Sound.setActive(true);Sound.effect?.('demo');
 updateHUD();return true;
}
function stopLoopDemo(){
 if(!loopDemo)return;const before=loopDemo;loopDemo=null;
 phaseEndRun();clearInputs();campaignRun=before.run;rankedRun=before.ranked;game=before.game;entities=before.entities;mode=before.mode;
 Sound.setBoss?.(null);document.body.classList.remove('loop-demo');toTitle();loopIdleAt=performance.now();loopTitleSince=loopIdleAt;
}
const loopUpdate=update;
update=dt=>{
 if(!loopDemo){loopUpdate(dt);return;}
 const d=loopDemo,run=campaignRun;
 if(run.ended||run.ticks>=d.trace.ticks){stopLoopDemo();return;}
 while(d.cursor<d.trace.inputs.length&&d.trace.inputs[d.cursor][0]===run.ticks)run.input(d.trace.inputs[d.cursor++][1]);
 run.step();game=run.state;entities=run.entities;worldDistance=game.distance;now+=dt;
 // Announce the recording only when the countdown can drain the channel. The
 // ordinary sector coaching is lower priority than this demo-only introduction.
 if(!Loop.state.lines.x_demo&&game.countdown<=0&&!phaseState.active&&globalThis.PhaseOne?.radio?.('x_demo',{priority:'boss',critical:true})===true)Loop.markDemoLine();
 phaseUpdate(dt);animateHero(dt,false);
 for(const e of run.events){Loop.feelEvent(e);const sound={jump:'jump',paper:'collect',reflect:'reflect',bossHit:'bossHit',bossDefeated:'bossDefeated',smash:'slide',hit:'hit',nearMiss:'nearMiss',perfect:'perfect',chain:'chainTier',chainBreak:'chainBreak',shard:'shard'}[e.type];if(sound)Sound.effect(sound,e.mult||0);}
 if(run.pendingStage)run.nextStage();
 if(game.boss)Sound.setBoss?.({...game.boss,hpFrac:game.boss.hp/game.boss.maxHp});
 Sound.setZone(game.stage,game.chasing);Sound.setIntensity(Math.min(1,(game.chain||0)/60));
};
function loopInput(e){
 loopIdleAt=performance.now();
 if(loopDemo){e.preventDefault();e.stopImmediatePropagation();loopClickBlock=performance.now()+450;stopLoopDemo();}
 else if(e.type==='click'&&performance.now()<loopClickBlock){e.preventDefault();e.stopImmediatePropagation();}
}
for(const type of ['keydown','pointerdown','pointermove','wheel','touchstart','click'])window.addEventListener(type,loopInput,{capture:true,passive:false});
window.addEventListener('blur',e=>{if(e.target!==window)return;if(loopDemo)stopLoopDemo();loopIdleAt=performance.now();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&loopDemo)stopLoopDemo();loopIdleAt=performance.now();},true);
window.addEventListener('pagehide',()=>{if(loopDemo)return;Loop.state.lastSession=Date.now();Loop.persist();});
const loopPollGamepad=pollGamepad;let loopPadBlocked=false;
pollGamepad=()=>{
 let pad;try{pad=navigator.getGamepads?.()[0];}catch{}
 const input=pad&&(pad.buttons.some(b=>b.pressed)||pad.axes.some(a=>Math.abs(a)>.45));
 if(input)loopIdleAt=performance.now();
 if(loopDemo){if(input){loopPadBlocked=true;stopLoopDemo();}return;}
 if(loopPadBlocked){if(!input)loopPadBlocked=false;return;}
 loopPollGamepad();
};
function loopTick(t){
 Loop.tick(t);const onTitle=status==='title'&&!modalKind&&!systemBootActive;
 if(onTitle&&!loopLastTitle){loopTitleSince=t;loopIdleAt=t;}loopLastTitle=onTitle;
 if(onTitle&&LoopModel.utcDay(Date.now())!==Loop.state.daily.day){LoopModel.touchDaily(Loop.state,Date.now());Loop.title();Loop.persist();}
 if(onTitle&&!document.hidden){if(!loopGreeted&&t-loopTitleSince>3000)loopGreeted=Loop.greet();if(t-loopIdleAt>=30000)startLoopDemo();}
 requestAnimationFrame(loopTick);
}
requestAnimationFrame(loopTick);
// Deliberately opt-in; production has only the cosmetic/menu API on window.Loop.
if(new URLSearchParams(location.search).get('test')==='1')window.__loop={
 get state(){return Loop.state;},get receipt(){return Loop.receipt;},model:LoopModel,catalog:LoopCatalog,
 open:Loop.open,document:id=>document.querySelector(`[data-loop="document"][data-id="${id}"]`)?.click(),
 selectedOptions:()=>selectedOptions(),startDemo:startLoopDemo,stopDemo:stopLoopDemo,get demo(){return !!loopDemo;},
 idle:()=>{loopIdleAt=performance.now()-31000;},event:e=>{Loop.event(e,game);Loop.feelEvent(e);},
 showResult:()=>finish(campaignRun.won),showNotice:item=>Loop.announce(item),render:()=>{render();Loop.drawFeel();updateHUD();},
 stateSummary:()=>({status,mode,modifier:Loop.state.prefs.modifier,report:selectedOptions().report,chain:game.chain,reward:game.reward,score:game.score,grade:game.levelReward/(game.levelPar||1)}),
};
