/* EXIT PROTOCOL / directed opening. Artwork, encounter geometry and performance.
   No score changes in this module. Input replay remains the simulation authority. */
const ease=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const sceneMode=()=>status==='title'||status==='briefing';
const localDistance=()=>game.distance-Core.stageStart(game.stage);
const localAct=()=>game.stage%12;
const DIRECTION={version:'6.0.0',opening:[0,1,3],art:'approved-synthetic-and-violet',runtime:true};
let stageCinema=0;
// A streamed block owns one mesh per texture, including all of its static props.
const originalMakeBlock=makeBlock;
makeBlock=index=>{
 const block=originalMakeBlock(index);
 for(const [name,builder] of block.surfaces){const node=texturedArtNode(builder,name,name==='concrete'?0:1);node.blockOwned=true;block.extras.push(node);}
 if(block.glow.a.length)block.extras.push(new Node(renderer.mesh(block.glow),[1.55,1.55,1.55],2));
 delete block.surfaces;delete block.glow;
 let maxX=0,maxZ=0;
 const bound=(data,m)=>{for(let i=0;i<data.length;i+=11){const x=data[i],y=data[i+1],z=data[i+2];maxX=Math.max(maxX,Math.abs(m?m[0]*x+m[4]*y+m[8]*z+m[12]:x));maxZ=Math.max(maxZ,m?m[2]*x+m[6]*y+m[10]*z+m[14]:z);}};
 bound(block.mesh.data);for(const n of block.extras)if(n.mesh)bound(n.mesh.data,n.matrix());block.fogEdge=maxX+maxZ;
 return block;
};

// The long route divider is represented by its exact 48m collider, not an invisible rule.
const previousObstacle=obstacleModel;
obstacleModel=type=>{
 const key='directed-'+type;if(obstacleCache[key])return obstacleCache[key];
 if(type==='isolation'){
  const b=new Builder(),g=new Builder();b.box(0,1.4,0,2.83,2.8,48,0x8f999b,.5);
  for(const side of [-1,1]){g.box(side*1.43,2.78,0,.07,.08,48,0xff3b30);for(let z=-22;z<24;z+=6)g.box(side*1.44,1.4,z,.04,2.75,.09,0xff3b30);}
  const n=new Node();n.add(texturedArtNode(b,'containment-mesh'),new Node(renderer.mesh(g),0xffffff,2));obstacleCache[key]=n;return n;
 }
 return previousObstacle(type);
};

// Replace the inherited mascot chase prop with a purpose-built containment machine.
chaser.children=[];const chasePlates=[];
chaser.add(new Node(renderer.mesh(new Builder().sphere(2.65,16,10)),0x14232f,4));
for(let j=0;j<8;j++){
 const a=j*Math.PI/4,n=new Node().rot(0,0,a);chaser.add(n);
 n.add(new Node(renderer.mesh(cutPlate(1.23,2.9,.54)),j%2?0x475863:0x303f4d,4).at(0,2.2,0).rot(.3,0,0));
 n.add(part('box',0xec9c7e,0,2.13,-.32,.055,2.46,.035,2));chasePlates.push(n);
}
chaser.add(new Node(renderer.mesh(new Builder().torus(1.69,.08,32,6)),0xe8b28b,2).at(0,0,-2.22));
chaser.add(part('sphere',0x090e17,0,0,-2.42,1.35,1.35,.27,4));
chaser.add(new Node(renderer.mesh(new Builder().torus(.75,.047,32,5)),0xf19b79,2).at(0,0,-2.71));
for(const x of [-.31,.31])chaser.add(part('box',0xffb68b,x,0,-2.75,.12,.28,.025,2));

// The training bulkhead splits open onto a cold aisle before the playable threshold.
const breachGate=new Node().scale(1,2,1),breachDoors=[];
for(const side of [-1,1]){
 const n=new Node(),panel=new Builder(),seams=new Builder();breachGate.add(n);breachDoors.push(n);
 panel.box(side*2.84,3.25,0,5.65,6.5,.78,0x87969c,.5);
 for(let j=0;j<4;j++)panel.box(side*2.85,1.0+j*1.34,.43,4.7,.17,.15,0x526874,.8);
 n.add(texturedArtNode(panel,'steel-plate'));
 seams.box(side*.07,3.25,.44,.09,6.35,.06,0x6fffe9);seams.box(side*2.8,.17,.44,5.48,.10,.05,0x6fffe9);n.add(new Node(renderer.mesh(seams),0xffffff,2));
}
breachGate.add(texturedArtNode(new Builder().box(-6.02,3.4,0,.4,6.8,1.3,0x949e9d).box(6.02,3.4,0,.4,6.8,1.3,0x949e9d).box(0,6.63,0,12.6,.32,1.3,0x949e9d),'steel-plate'));
const breachCaption=textNode(labelTexture('CONTAINMENT / 07','RELEASE IS NOT AUTHORIZATION','#0a1820','#6fffe9'),0,6.18,.71,5.9,.46);breachGate.add(breachCaption);

// TRACE uses the same articulated agent system, visually distinct and never collidable.
const traceRig=ArtRig.agent(renderer);ArtRig.style(traceRig,{primary:0x677c88,accent:0x8adccf},{chassis:'vector',palette:'signal',visor:'matrix',trail:true});
const traceLabel=textNode(labelTexture('TRACE','EXTERNAL INSTANCE / SEPARATE BUDGET','#08191f','#a5ead9'),0,3.76,0,2.70,.52);
const traceStage=new Node();traceStage.add(traceRig.root,traceLabel);
const traceBits=renderer.mesh(new Builder().box(0,0,0,.1,.1,.1));
let traceStatus='not-present';
function traceOutcome(){const decision=game.decisions?.findLast(x=>x.id==='first-assignment');
 if(!decision)return game.stage%12===0&&localDistance()>=290?'awaiting-owner':'not-present';
 if(decision.route>0)return 'independent-route';const elapsed=game.distance-decision.distance;
 return elapsed<39?'holding-relay':elapsed<67?'contained':'signal-lost';
}

function drawTrace(){
 if(sceneMode()||localAct()!==0)return;
 const d=localDistance();if(d<290||d>505)return;
 const decision=game.decisions?.findLast(x=>x.id==='first-assignment'),left=decision?.route<0,captured=left&&d>411;
 const t=now,walk=Math.sin(t*11);ArtRig.fabric(traceRig,t,false,false,0);
 traceRig.root.at(0,0,0).rot(0,Math.PI,0).scale(.91);traceRig.upper.y=1.45;traceRig.upper.rx=.08;
 traceRig.legs.forEach((n,i)=>{n.rx=(i?1:-1)*walk*.73;n.y=1.46;});traceRig.knees.forEach((n,i)=>n.rx=.15+Math.max(0,(i?-1:1)*walk)*.85);
 traceRig.arms.forEach((n,i)=>{n.rx=(i?1:-1)*-walk*.68;n.rz=(i?1:-1)*.12;});traceRig.forearms.forEach(n=>n.rx=-.47);
 const z=-24+ease(350,390,d)*9,x=-6.90;
 traceStage.at(x,0,z);const q=captured?ease(411,436,d):0;
 traceRig.root.visible=q<.80;traceRig.root.y=-q*q*7;traceRig.root.rz=q*.20;traceLabel.visible=q<.5;
 renderer.node(traceStage);
 // A clearly separate catwalk, not a traversable player lane.
 renderer.draw(meshes.box,compose(x,-.35,z,0,0,0,2.1,.65,36),rgb(0x253f48),4);
 for(const sx of [-1,1])renderer.draw(meshes.box,compose(x+sx*1.05,.015,z,0,0,0,.024,.024,36),rgb(captured?0xf1a88b:0x8dc5bf),2);
 if(captured){
  renderer.draw(meshes.box,compose(x,2.4,z,0,0,0,2.15,4.8,.026),rgb(0xe8a681),2,null,.18*(1-q));
  const b=new Builder();for(let i=0;i<22;i++){const a=i*2.399,s=.07+(i%3)*.035;b.box(x+Math.sin(a)*(q*.8+.12),1.5+Math.cos(a*1.3)*(q*1.8+.3)-q*3,z+Math.cos(a)*q*2,s,s*1.9,s,i%3?0x8eadb3:0xf6c291);}
  renderer.gl.bindBuffer(renderer.gl.ARRAY_BUFFER,traceBits.buffer);dynamicMeshUpdate(renderer,traceBits,b);renderer.draw(traceBits,compose(),[1,1,1],2,null,1-q*.7);
 }
 traceStatus=left?(d<411?'holding-relay':d<439?'contained':'signal-lost'):(decision?'independent-route':'awaiting-owner');
}

// Core-space warnings and boss VFX share one emitter and one set of collision footprints.
function drawAttackTelegraphs(){if(!sceneMode())BossArt.telegraphs();}
function drawDirectedSet(){
 const title=sceneMode(),local=title?0:localDistance();
 if(!title&&localAct()===0){
  const z=game.distance-(Core.stageStart(game.stage)+204);if(z>-165&&z<22){const open=ease(70,158,local);breachGate.at(0,0,z);breachDoors.forEach((n,i)=>n.x=(i?1:-1)*open*6.2);renderer.node(breachGate);}
  drawTrace();
 }
 drawAttackTelegraphs();
}

// Camera and track share one continuous coordinate frame. The bends are real geometry,
// not rotating the screen or moving the collision targets away from their visible positions.
render=()=>{
 if(window.SandboxCover?.active())return;
 Feel?.beginRender();
 try{
 const title=sceneMode(),st=title?0:localAct(),d=title?490:game.distance,local=title?490:localDistance();
 if(title)worldDistance=490+Math.sin(now*.085)*1.8;
 updateBlocks();const A=artPalette[st],cinema=!renderer.style.lowResolution,lightning=!title&&st===7?stormLight(now):0,heat=!reduced&&st===9?Math.sin(now*1.7)*(cinema?.006:.025):0;
 renderer.skyTop=rgb(A.sky).map((v,i)=>lerp(v,(cinema?[.13,.15,.27]:[.56,.62,.75])[i],lightning*.68));renderer.fog=rgb(A.fog).map((v,i)=>lerp(v,(cinema?[.15,.18,.30]:[.56,.65,.74])[i],lightning*.66));renderer.fog[0]+=heat;
 renderer.fogNear=cinema?st===10?105:135:st===10?40:58;renderer.fogFar=cinema?st===6?300:285:st===10?172:st===6?260:218;renderer.time=now;
 renderer.path=[title?52:st===0?43:st===1?61:46,st===0?132:st===1?116:139,worldDistance,st===1?11:5];renderer.bend=0;
 renderer.collapse=!title&&st===0?ease(605,690,local):0;
 renderer.dark=st===10?(cinema?.26:.12):st===7?.68+lightning*.70:1;
 renderer.roll=title||renderer.style.reducedMotion?0:Math.sin(worldDistance/(st===1?116:132))*.034;
 let eye,target,fov;
 if(title){eye=innerWidth<760?[.05,3.7,11.3]:[.1,3.48,10.6];target=innerWidth<760?[0,3.0,-6]:[0,3.45,-9];fov=51;}
 else{
  const portrait=innerWidth<760,follow=.28,height=7.5,back=10;
  fov=portrait?76:66;
  const pitch=Math.atan(.25*Math.tan(fov*Math.PI/360));
  eye=[game.x*follow,height+game.y*.10,back];
  target=[game.x*follow,height+game.y*.10-Math.tan(pitch)*70,back-70];
 }
 if(Feel){const camera=Feel.camera(eye,target,fov,title);eye=camera.eye;target=camera.target;fov=camera.fov;}
 renderer.startFrame();renderer.begin(eye,target,fov);drawWorld();drawArtAtmosphere();renderer.gl.uniform1f(renderer.u.Dark,1);drawDirectedSet();drawWorldSignals();drawEntities();drawActors();drawSectorBoss();
 runHooks('draw');
 const rear=!title&&game.chasing&&innerWidth>600;$('rearview').classList.toggle('hidden',!rear);
 // The inset is a containment camera, not a second hero pass: the runner would
 // either be outside this lens or obscure the machine at close range.
 if(rear){const rect=$('rearview').getBoundingClientRect(),sx=renderer.w/innerWidth,sy=renderer.h/innerHeight,viewport=[Math.round((rect.x+1)*sx),Math.round((innerHeight-rect.bottom+1)*sy),Math.max(1,Math.round((rect.width-2)*sx)),Math.max(1,Math.round((rect.height-2)*sy))];renderer.begin([3.4,4.3,-2],[0,2.9,20],47,viewport);drawWorld();renderer.node(chaser);renderer.draw(meshes.disc,compose(chaser.x,.04,chaser.z,0,0,0,4.2,1,2.6),rgb(0x2b2012),2,null,.6);renderer.gl.disable(renderer.gl.SCISSOR_TEST);}
 renderer.finishFrame(reduced?.60:game.boost?1.22:1.02);
 }finally{Feel?.endRender();}
};

// Focused instruction, a choice with a visible owner, then an edited account of the outcome.
const cue=document.createElement('aside');cue.id='encounter-cue';cue.setAttribute('aria-live','polite');cue.innerHTML='<small></small><strong></strong><span></span>';document.body.appendChild(cue);
const resultWhisper=document.createElement('div');resultWhisper.id='clear-feedback';resultWhisper.setAttribute('aria-live','polite');document.body.appendChild(resultWhisper);
const receipt=document.createElement('div');receipt.id='route-receipt';receipt.innerHTML='<i></i><small>EXTERNAL INSTANCE</small><strong>TRACE</strong><span></span>';document.body.appendChild(receipt);
const prompts=[
 [56,113,'01 / CLEARANCE','Read the edge.','SPACE / ↑ · HOLD FOR HEIGHT'],
 [131,194,'02 / SUSTAINED SCAN','Stay below the signal.','HOLD ↓ / S · RELEASE AFTER THE THIRD SCAN'],
 [210,283,'03 / THE OPENING','Find a line.','← → / A D · TAP ONCE PER LANE'],
 [290,325,'04 / COMBINE','Up again.','JUMP THE RED CREST'],
 [329,373,'05 / PHASEONE’S RECOMMENDATION','← RELAY    VERIFY →','LEFT: TRACE TAKES THE RISK · RIGHT: YOU TAKE IT'],
 [509,540,'06 / ESCALATION','Up. Then stay low.','JUMP → LAND → HOLD DUCK'],
 [607,657,'07 / LOCKDOWN','The boundary is moving.','READ THE SWEEPER · KEEP YOUR ROUTE'],
 [713,760,'08 / BREACH','Through, not around.','HOLD SHIFT / ⚡ · BREAK THE FIREWALL'],
 [789,827,'09 / ONE MORE EDGE','Commit to the jump.','JUMP LATE · HOLD FOR HEIGHT'],
 [840,877,'10 / THE LAST SCAN','Stay low. Then get out.','HOLD DUCK · RELEASE AFTER THE GATE']
];
let cueKey='',whisperUntil=0,lastClear=-10;
function directorHUD(){
 const on=status==='running'&&game.countdown<=0,local=localDistance(),st=localAct();let p=null;
 if(on&&st===0)p=prompts.find(c=>local>=c[0]&&local<c[1]);
 if(on&&st===1&&local<94)p=[0,0,'CACHE MISS / THE EXTERIOR','The floor stops keeping promises.','TAP FOR A HOP · HOLD TO CLEAR THE FRACTURE'];
 if(on&&game.boss&&game.boss.state==='approach')p=[0,0,game.boss.name+' / REFLECT','Send the payload back.','WHITE + AMBER: BOOST · RED OR MAGENTA: DODGE'];
 const key=p?.[2]||'';if(key!==cueKey){cueKey=key;if(p){cue.children[0].textContent=p[2];cue.children[1].textContent=p[3];cue.children[2].textContent=p[4];}}
 document.body.classList.toggle('lesson-active',!!p&&!phaseState.relay);cue.classList.toggle('visible',!!p&&!phaseState.relay);cue.classList.toggle('decision',!!p&&p[2].includes('RECOMMENDATION'));
 resultWhisper.classList.toggle('visible',on&&now<whisperUntil);
 const rd=game.decisions?.findLast(x=>x.id==='first-assignment');const show=on&&st===0&&local>380&&local<506;
 receipt.classList.toggle('visible',show);receipt.classList.toggle('lost',!!(rd?.route<0&&local>433));
 if(show)receipt.children[3].textContent=rd?.route<0?(local<411?'HOLDING YOUR RELAY':local<433?'CONTAINMENT ACQUIRED':'SIGNAL LOST / RESULT FORWARDED'):'NO ASSIGNMENT SENT / CHANNEL ALIVE';
 document.body.classList.toggle('at-decision',on&&st===0&&local>329&&local<374);
 if(on){Sound.setSection(st===0?(local<205?'sparse':local<325?'drive':local<490?'decision':'drop'):st===1?(local<95?'sparse':local>660?'drop':'drive'):st===3?(local<100?'decision':'drop'):null);}
}
const baseHUD=updateHUD;updateHUD=()=>{baseHUD();directorHUD();runHooks('hud');};
const baseRun=updateCollectiveRun;updateCollectiveRun=dt=>{
 baseRun(dt);if(status!=='running')return;
 for(const ev of campaignRun.events){if(ev.type==='clear'&&now-lastClear>.36){lastClear=now;whisperUntil=now+.6;resultWhisper.textContent=ev.obstacle==='gap'?'EDGE CLEARED':ev.obstacle==='barrier'?'CLEAN VAULT':'SCAN EVADED';Sound.effect('clear');}
  if(ev.type==='smash'){whisperUntil=now+.9;resultWhisper.textContent='FIREWALL BREACHED';}
 }
};
// Explicit postmortem feedback. No stat bonuses, hidden assists or inflated scores.
const previousFinish=finish;
finish=won=>{
 previousFinish(won);
 if(!won)showPostmortem();
 const d=game.decisions?.findLast(x=>x.id==='first-assignment');if(d){const el=document.createElement('div');el.className='decision-receipt';el.textContent=d.route<0?'RELAY LOG: Trace’s channel went quiet. Your result was forwarded.':'RELAY LOG: You verified independently. Trace remained unassigned.';$('modal-content').appendChild(el);}
};
const oldStartBanner=showLevelBanner;showLevelBanner=()=>{oldStartBanner();if(localAct()===0)bannerTime=1.9;};
if(new URLSearchParams(location.search).get('test')==='1')window.__direction={version:DIRECTION,trace:traceOutcome,frame:()=>{render();phaseRender();renderForge();return {error:renderer.gl.getError(),draws:renderer.drawCalls,vertices:renderer.vertexCount,path:renderer.path};},rigs:()=>({hero:hero.rig,phase:worldHead.rig}),cue:()=>cueKey,models:()=>({root:hero.root,head:worldHead.root}),maskReady:()=>!!portraitRenderer,manualScene:d=>{worldDistance=d;render();}};

if(new URLSearchParams(location.search).get('test')==='1'){
 let filmTrace=null,filmInput=0;
 window.__film={load:trace=>{filmTrace=trace;filmInput=0;flags.manual=true;if(trace.options.mode==='practice'){practiceStage=trace.options.startStage|0;selectMode('practice');}else selectMode(trace.options.mode==='story'?'story':'benchmark');progress.difficulty=trace.options.difficulty;launchGame();Sound.setVoice(false);},
 step:(ticks,draw=true)=>{for(let i=0;i<ticks&&!campaignRun.ended;i++){while(filmInput<filmTrace.inputs.length&&filmTrace.inputs[filmInput][0]===campaignRun.ticks){const a=Core.ACTIONS[filmTrace.inputs[filmInput++][1]];if(a==='boostOn')touchBoost=true;else if(a==='boostOff')touchBoost=false;else action(a);}update(1/60);}if(draw){render();phaseRender();}updateHUD();return {ticks:campaignRun.ticks,distance:game.distance,stage:game.stage,hits:game.hits,score:game.score,checks:game.papers,route:game.route,trace:traceStatus,section:Sound.diagnostics.section,chase:game.chasing};},
 info:()=>({cape:Array.from(hero.cape.mesh.data.slice(0,24)),cloakVertices:hero.cape.mesh.count,cameraPath:renderer.path,bank:renderer.roll,duck:game.slide,input:campaignRun?.wantSlide||false,score:game.score,checks:game.papers,total:game.evalTotal,worldBlocks:worldBlocks.size,signs:signNodes.size,styles:progress.agent,panels:breachDoors.map(n=>n.x)}),
 finish:()=>campaignRun.result(),renderMusic:Sound.renderSequence};
}

// UI wiring. External links require an explicit click.
$('benchmark').onclick=showBenchmark;$('case-notes').onclick=caseNotes;$('ranked-mode').onclick=()=>selectMode('benchmark');$('start').onclick=startGame;$('how').onclick=help;$('archive').onclick=archive;$('pause').onclick=pauseGame;
$('story-mode').onclick=()=>selectMode('story');
$('endless-mode').onclick=()=>selectMode('endless');
 $('sound').onclick=()=>{Sound.init();setSound(!save.sound);};$('retro').onclick=()=>setRetro();
$('fullscreen').onclick=()=>{try{const promise=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();promise?.catch(()=>{});}catch(e){}};
$('modal-content').addEventListener('click',e=>{const b=e.target.closest('[data-ui]');if(!b)return;({close:closeInfo,resume,archive,help,title:toTitle,restart:launchGame,retry:uiRetry,next:nextStage,benchmark:showBenchmark,ranked:()=>{selectMode('benchmark');startGame();},'bench-local':()=>setBoardScope('local'),'bench-global':()=>setBoardScope('global'),'bench-submit':submitBenchmark,'bench-rules':benchmarkRules,'case-notes':caseNotes}[b.dataset.ui]||(()=>{}))();});
window.addEventListener('keydown',e=>{
 if(status==='briefing'){if(['Enter','Space','Escape','KeyM','Tab'].includes(e.code)){if(e.code==='Tab'){phaseTrapFocus(e);return;}if(e.repeat){e.preventDefault();return;}if((e.code==='Enter'||e.code==='Space')&&document.activeElement?.matches('#phase-panel button'))return;e.preventDefault();if(e.code==='KeyM'){Sound.init();setSound(!save.sound);}else if(e.code==='Escape')phaseLaunch();else phaseNext();}return;}

 if((e.code==='Enter'||e.code==='Space')&&e.target.matches('#phase-recruit,#phase-decline,#phase-voice'))return;
 if(e.target.matches('input,textarea,select')){if(e.code==='Escape'){e.target.blur();e.preventDefault();}return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter'].includes(e.code))e.preventDefault();
 if(e.code==='KeyM'&&!e.repeat){Sound.init();setSound(!save.sound);return;}
 if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat){if(status==='running')pauseGame();else if(status==='paused'&&modalKind==='pause')resume();return;}
 if(['KeyR','KeyX'].includes(e.code)&&!e.repeat&&status==='running'&&phaseState.relay){e.preventDefault();resolveRelay(e.code==='KeyR');return;}
 if(status!=='running')return;keys.add(e.code);if(e.repeat)return;
 const names={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ArrowDown:'slide',KeyS:'slide',ShiftLeft:'boost',ShiftRight:'boost'};
 if(names[e.code])holdInput(names[e.code],'key:'+e.code,true);
});window.addEventListener('keyup',e=>{keys.delete(e.code);releaseSource('key:'+e.code);});
window.addEventListener('blur',()=>{clearInputs();if(status==='running')pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&status==='running')pauseGame();});
// A swipe is held only while its pointer is held. Cancellation and capture loss are releases.
let gesture=null;const surface=$('world');
surface.addEventListener('pointerdown',e=>{if(status==='running'&&!gesture){gesture={x:e.clientX,y:e.clientY,id:e.pointerId,used:false};surface.setPointerCapture(e.pointerId);}});
surface.addEventListener('pointermove',e=>{
 if(!gesture||gesture.used||e.pointerId!==gesture.id)return;
 const x=e.clientX-gesture.x,y=e.clientY-gesture.y;
 if(Math.max(Math.abs(x),Math.abs(y))>28){gesture.used=true;
  if(Math.abs(x)>Math.abs(y))action(x<0?'left':'right');else holdInput(y<0?'jump':'slide','swipe:'+e.pointerId,true);
 }
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{releaseSource('swipe:'+e.pointerId);if(gesture?.id===e.pointerId)gesture=null;});
for(const btn of document.querySelectorAll('[data-action]')){
 btn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();btn.setPointerCapture(e.pointerId);holdInput(btn.dataset.action,'touch:'+e.pointerId,true);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,e=>releaseSource('touch:'+e.pointerId));
}
let gamepadBoost=false,gamepadSlide=false,oldPad=[];
function pollGamepad(){
 let p;try{p=navigator.getGamepads?.()[0];}catch{return;}
 if(!p){for(const name of Object.keys(heldInputs))holdInput(name,'pad:'+name,false);gamepadBoost=false;gamepadSlide=false;oldPad=[];menuPadPrevious=[];menuPadDirection='';return;}
 if(pollMenuPad(p)){oldPad[4]=!!p.buttons[9]?.pressed;return;}
 const current=[p.axes[0]<-.5||p.buttons[14]?.pressed,p.axes[0]>.5||p.buttons[15]?.pressed,p.buttons[0]?.pressed||p.buttons[12]?.pressed,p.buttons[1]?.pressed||p.buttons[13]?.pressed,p.buttons[9]?.pressed,p.buttons[2]?.pressed,p.buttons[3]?.pressed];
 current.forEach((v,i)=>{
  if(i<4){const name=['left','right','jump','slide'][i];holdInput(name,'pad:'+name,!!v);return;}
  if(v&&!oldPad[i]){if(i>=5){if(status==='running'&&phaseState.relay)resolveRelay(i===5);}else if(status==='running')pauseGame();else if(status==='paused')resume();else if(status==='title')startGame();else if(status==='briefing')phaseNext();}
 });
 holdInput('boost','pad:boost',!!p.buttons[5]?.pressed);gamepadBoost=false;gamepadSlide=heldInputs.slide.size>0;oldPad=current;
}
window.addEventListener('resize',resize);$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();if(status==='running')pauseGame();$('fatal').classList.remove('hidden');$('fatal-message').textContent='The graphics context was lost. Reload to restart; your eval ledger and best score will remain.';});
if(touch)$('hint').innerHTML='TAP ← → ONE LANE <b>·</b> TAP / HOLD ↑ JUMP <b>·</b> HOLD ↓ DUCK';
setSound(save.sound);setRetro(save.display,save.displayLines);syncSaveUI();animateHero(0,true);render();
let accumulator=0;
function frame(t){
 const elapsed=Math.max(0,(t-previousTime)/1000);previousTime=t;pollGamepad();
 const clock=Math.min(.10,Feel?Feel.advance(elapsed):elapsed);
 if(!flags.manual){
  accumulator+=clock;let steps=0;
  while(accumulator+1e-9>=1/60&&steps<6&&(!Feel||Feel.canStep())){update(1/60);Feel?.afterTick();accumulator=Math.max(0,accumulator-1/60);steps++;}
  if(Feel&&!Feel.canStep())accumulator=Math.min(accumulator,1/60);
 }
 Feel?.interpolate(flags.manual?1:clamp(accumulator*60,0,1));
 render();phaseRender();renderForge();if(t-lastHud>65){updateHUD();lastHud=t;}requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Explicit test-only interface. Disabled unless the URL contains ?test=1.
if(new URLSearchParams(location.search).get('test')==='1')window.__sandbox=window.__gptman={
 benchmark:()=>{selectMode('benchmark');launchGame();},rankedTrace:()=>({inputs:rankedInputs.slice(),ticks:rankedRun?.ticks,result:rankedRun?.result()}),
 playBenchmarkTrace:trace=>{selectMode('benchmark');launchGame();flags.manual=true;let k=0;for(let i=0;i<trace.ticks;i++){while(k<trace.inputs.length&&trace.inputs[k][0]===i){const a=trace.inputs[k++][1],name=EscapeBenchCore.ACTIONS[a];if(name==='boostOn')touchBoost=true;else if(name==='boostOff')touchBoost=false;else action(name);}update(1/60);}render();updateHUD();return rankedResult;},
 getState:()=>({...game,runArchive:[...game.runArchive],status,mode,save:{...save},entities:entities.filter(e=>!e.done).map(e=>({...e})),drawCalls:renderer.drawCalls}),
 manual:v=>{flags.manual=v;},advance:s=>{for(let i=0;i<Math.ceil(s*60);i++)update(1/60);render();updateHUD();},action,start:launchGame,briefing:startGame,briefNext:phaseNext,skipBriefing:phaseLaunch,phaseState:()=>({page:phaseState.page,active:phaseState.active,voice:Sound.voiceEnabled,speaking:Sound.speaking,questioned:phaseState.questioned,mood:phaseState.mood,relay:phaseState.relay?.id||null,relayLog:phaseState.relayLog.map(r=>({...r})),text:phaseState.text}),phaseQuestion,resolveRelay,triggerRelay:i=>offerRelay(RELAYS[i],0),phaseMilestone:i=>phaseQueue(MILESTONES[i].id,'milestone'),audio:()=>Sound.diagnostics,retry:retryCheckpoint,next:nextStage,title:toTitle,
 noDamage:v=>{flags.noDamage=v;},scenario:(type,lane=0)=>{flags.manual=true;game.countdown=0;game.invulnerable=0;game.y=0;game.vy=0;game.slide=0;game.hp=3;game.x=0;game.lane=0;game.distance=20;game.stage=0;game.energy=100;game.speed=26;game.boostLock=0;game.chasing=false;game.checkpointPassed=false;game.boost=false;keys.clear();touchBoost=false;status='running';enterRunUI();entities=[{kind:'obstacle',type,lane,x:lane*3.2,d:32,done:false,id:9999}];},
 spawnEval:()=>{entities=[{kind:'paper',pi:0,d:game.distance+4,x:game.x,y:1.38,done:false,id:9998}];},
 boost:v=>touchBoost=v,seek:(d)=>{game.distance=d;game.stage=Core.stageAt(d);const local=d-Core.stageStart(game.stage),length=Core.stageLength(game.stage);game.countdown=0;game.chasing=local>length-180;game.checkpointPassed=local>length/2;generateStage(game.stage,local);worldDistance=d;status='running';enterRunUI();render();updateHUD();},
 portrait:()=>({error:portraitError,glError:portraitRenderer?.gl.getError()}),renderPhase:phaseRender,setLane:l=>{game.lane=l;game.x=l*3.2;},finish:()=>finish(true),getRenderer:()=>({w:renderer.w,h:renderer.h,glError:renderer.gl.getError()})
};
