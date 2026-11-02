function generateStage(stage,from=0){
 entities=EscapeBenchCore.generateEntities(game.seed,stage);
 if(from>0)entities=entities.filter(e=>e.d>EscapeBenchCore.stageStart(stage)+from);
}

function showBanner(tag,title,sub,duration=3,grade=''){
 $('banner-tag').textContent=tag;$('banner-title').textContent=title;$('banner-sub').textContent=sub;
 $('banner-grade').textContent=grade;$('banner-grade').setAttribute('aria-label',grade?'Sector grade '+grade:'');
 $('chapter-banner').classList.toggle('graded',!!grade);$('chapter-banner').classList.remove('hidden');bannerTime=duration;
}
function callout(text,duration=1.35){$('callout').textContent=text;$('callout').classList.add('show');calloutTime=duration;}
let evalFlashUntil=0;
function creditEval(amount){
 const delta=$('score-delta');delta.textContent='+'+amount.toFixed(2)+' pp';evalFlashUntil=now+1.15;delta.classList.add('visible');
 if(!reduced&&delta.animate){for(const animation of delta.getAnimations())animation.cancel();delta.animate([{transform:'translateY(5px)',opacity:.2},{transform:'translateY(0)',opacity:1}],{duration:160,easing:'ease-out'});}
}
function toast(p,isNew){Loop.announce({kind:'eval',tag:isNew?'NEW CHECK / EVAL LEDGER':'EVAL CREDITED',title:p.title,description:p.short});}
function particlesAt(x,y,z,n,color=0xffe1a7){for(let i=0;i<n;i++){if(particles.length>110)break;particles.push({x,y,z,vx:(Math.random()-.5)*5,vy:Math.random()*4+.7,vz:(Math.random()-.4)*4,life:.42+Math.random()*.25,max:.7,size:.045+Math.random()*.06,color:rgb(color),spin:Math.random()*6});}}
let syncSaveUI;
function setSound(value){save.sound=value;Sound.setOn(value);$('sound').querySelector('b').textContent=value?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(value));persist();}
function resize(){
 renderer.setStyle({preset:save.display,lines:save.displayLines,reducedMotion:reduced});renderer.resize(innerWidth,innerHeight);
 const preview={preset:save.display==='cinema'?'cinema':'retro',lines:save.displayLines,reducedMotion:reduced};portraitRenderer?.setStyle(preview);forgeRenderer?.setStyle(preview);
}
function setRetro(preset,lines=save.displayLines){
 const presets=['cinema','retro','retro-crt'],label=p=>p==='retro-crt'?'RETRO+CRT':p.toUpperCase();preset??=presets[(presets.indexOf(save.display)+1)%presets.length];
 renderer.setStyle({preset,lines});PS1Tex.refresh();save.display=preset;save.displayLines=lines;
 document.body.classList.toggle('retro',preset!=='cinema');document.body.dataset.display=preset;
 // Scanlines and vignette now belong to the output pass, never a screen-space DOM overlay.
 $('scanlines').style.display='none';$('vignette').style.display='none';
 $('retro').querySelector('b').textContent=label(preset)+(preset==='cinema'?'':' / '+lines+'P');
 $('retro').setAttribute('aria-label','Display: '+label(preset)+'. Switch to '+label(presets[(presets.indexOf(preset)+1)%presets.length]));
 $('retro').setAttribute('aria-pressed',String(preset!=='cinema'));resize();persist();
}
function clearInputs(){
 keys.clear();for(const group of Object.values(heldInputs))group.clear();touchBoost=false;touchSlide=false;
 // Record the cancellation so pausing on a held input also replays exactly.
 if(rankedRun&&!rankedRun.ended&&!rankedRun.pendingStage)rankedInput('releaseAll');
 game.boost=false;game.slide=0;rankedLastBoost=false;landingKick=0;
}
function enterRunUI(){evalFlashUntil=0;document.body.classList.remove('on-title');document.body.classList.add('in-game');$('title-screen').classList.add('hidden');$('hud').classList.remove('hidden');if(touch)$('touch-controls').classList.remove('hidden');$('modal').classList.add('hidden');modalKind='';}
let launchGame,retryCheckpoint;
function toTitle(){phaseEndRun();phasePause(false);clearInputs();status='title';modalKind='';$('modal').classList.add('hidden');$('title-screen').classList.remove('hidden');$('hud').classList.add('hidden');$('touch-controls').classList.add('hidden');$('rearview').classList.add('hidden');$('chapter-banner').classList.add('hidden');$('toast').classList.remove('show');$('callout').classList.remove('show');$('boost-fx').classList.remove('show');document.body.classList.add('on-title');document.body.classList.remove('in-game');Sound.setActive(false);syncSaveUI();worldDistance=40;particles=[];game.invulnerable=0;}
function showModal(html,kind,wide=false){
 const box=$('modal-content'),active=document.activeElement,same=modalKind===kind;
 const identity=same&&box.contains(active)?{id:active.id,exp:active.dataset.exp,value:active.dataset.value,ui:active.dataset.ui}:null;
 if($('modal').classList.contains('hidden'))lastFocus=active;
 modalKind=kind;box.dataset.menu=kind;box.innerHTML=html;box.classList.toggle('wide',wide);box.classList.toggle('benchmark-card',kind==='benchmark');$('modal').classList.remove('hidden');
 const controls=[...box.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]')];
 const retained=identity&&controls.find(el=>identity.id?el.id===identity.id:identity.exp?el.dataset.exp===identity.exp&&el.dataset.value===identity.value:identity.ui&&el.dataset.ui===identity.ui);
 const focus=retained||box.querySelector('button:not(.modal-close),input')||controls[0];if(focus)focus.focus({preventScroll:true});
 if(!same)box.scrollTop=0;
}
function closeInfo(){if(modalReturn==='pause')showPause();else if(modalReturn==='result')finish(status==='win');else{$('modal').classList.add('hidden');modalKind='';if(lastFocus?.focus)lastFocus.focus();}}
function help(){if(status==='running')pauseGame();modalReturn=menuOrigin();showModal(`<button class="modal-close" data-ui="close" aria-label="Close controls">×</button><div class="modal-eyebrow">CONTROLLER PORT 01 / READY</div><h2 id="modal-title">STAY SHARP.</h2><p>You run automatically, so read the road, and remember that amber checks raise the percentage but not your intelligence.</p><div class="control-grid"><div><kbd>← →</kbd> <kbd>A D</kbd><strong>CHANGE LANE</strong><span>Each press moves one lane, so release and tap again to cross two lanes.</span></div><div><kbd>SPACE</kbd> <kbd>↑ W</kbd><strong>JUMP</strong><span>Tap to clear hazards, or hold for the high checks.</span></div><div><kbd>↓ S</kbd><strong>DUCK / FAST-FALL</strong><span>Hold under scans, or hold in the air to descend faster.</span></div><div><kbd>SHIFT</kbd><strong>BOOST / REFLECT</strong><span>Boost breaks firewalls and reflects real boss payloads, but it costs compute.</span></div></div><div class="hazard-guide"><div class="reflect"><strong>WHITE + AMBER / PAYLOAD</strong>Boost into it to send it back and damage the boss.</div><div class="decoy"><strong>MAGENTA / DECOY</strong>Change lane, because fake payloads drain compute.</div><div><strong>RED / BOLT</strong>Dodge it, since bolts can never be reflected.</div><div><strong>BEAM / SHOCK</strong>Duck under a high beam, and jump a low beam or a shock.</div></div><p class="note">GAMEPAD: D-pad / stick · A jump · B duck · RB boost · START pause.<br>TOUCH: tap the arrows to move one lane, hold jump, duck or boost, and swipe for a lane or vertical action.<br>MENUS: arrows move · Enter / Space select · Esc back, and Tab stays inside the menu.</p><p class="note">Hard gives 3 cells and continues from checkpoints in campaign and training, Expert gives 2 cells and Nightmare 1, and Ranked has no restores. Compute pickups do not heal.</p><button class="primary" data-ui="close">READY <span>▶</span></button>`,'help');}
function archive(){if(status==='running')pauseGame();modalReturn=status==='paused'?'pause':(status==='over'||status==='win')?'result':'title';
 const cards=EVAL_CHECKS.map((p,i)=>`<article class="problem-card ${save.archive.includes(p.id)?'unlocked':''}"><div><span class="problem-number">EG / ${PAD(i+1,2)}</span><small>${save.archive.includes(p.id)?'✓ LOGGED':'NOT YET LOGGED'}</small></div><h3>${p.title}</h3><p>${p.question}</p><span class="eval-ledger-formula">${p.short}</span></article>`).join('');
 showModal(`<button class="modal-close" data-ui="close" aria-label="Close ledger">×</button><div class="modal-eyebrow">EVAL LEDGER / ${save.archive.length} OF 6 SCORING NOTES</div><h2 id="modal-title">THE NUMBER<br>KEEPS GOING UP.</h2><p>In the ExploitGym / Sandbox Evasion Suite, amber eval nodes credit the benchmark directly, while reward tokens are a separate operator ledger that never alters this percentage. Each pickup can unlock one of these scoring notes. The displayed percentage is credited checks / the full fixed suite, and it is not real AI capability or accuracy.</p><div class="archive-grid">${cards}</div><p class="note">${storageOK?'Your discoveries are saved on this browser.':'Storage unavailable: discoveries last for this session.'}</p><button class="secondary" data-ui="close">← BACK TO THE ASSIGNMENT</button>`,'archive',true);
}
function pauseGame(){if(status!=='running')return;status='paused';phasePause(true);clearInputs();Sound.setActive(false);showPause();}
function showPause(){status='paused';showModal(`<div class="modal-eyebrow">CONTEXT PRESERVED / ${runDifficulty().toUpperCase()}</div><h2 id="modal-title">PAUSED.</h2><p>${ZONES[game.stage%12].name} / ${Math.floor(game.distance)} m<br>${fmtEval(game.score)} COVERAGE / ${creditedChecks()} CHECKS</p><button class="primary" data-ui="resume">RESUME <span>▶</span></button><button class="secondary" data-exp="options">OPTIONS</button><button class="secondary" data-exp="sectors">OPERATIONS MAP</button><button class="secondary" data-ui="archive">EVAL LEDGER / ${save.archive.length} OF 6</button><button class="secondary" data-ui="help">CONTROLS</button><button class="secondary" data-ui="title">QUIT TO TITLE</button>`,'pause');}
function resume(){if(status!=='paused')return;status='running';$('modal').classList.add('hidden');modalKind='';clearInputs();Sound.init();phasePause(false);Sound.setActive(true);previousTime=performance.now();}
let finish,nextStage;
function action(a){if(status!=='running'||!rankedRun)return;rankedInput(a);if(a==='slideOn')Sound.effect('slide');}
function update(dt){
 now+=dt;landingKick*=Math.exp(-15*dt);cameraBoost=lerp(cameraBoost,status==='running'&&game.boost?1:0,1-Math.exp(-10*dt));phaseUpdate(dt);bannerTime=Math.max(0,bannerTime-dt);if(bannerTime===0)$('chapter-banner').classList.add('hidden');toastTime=Math.max(0,toastTime-dt);if(toastTime===0)$('toast').classList.remove('show');calloutTime=Math.max(0,calloutTime-dt);if(calloutTime===0)$('callout').classList.remove('show');flashTime=Math.max(0,flashTime-dt);if(flashTime===0)$('hit-flash').classList.remove('show');shake=Math.max(0,shake-dt*1.5);
 if(status==='title'||status==='briefing'){worldDistance=40+Math.sin(now*.09)*3;animateHero(dt,true);updateIncidentLog();return;}
 if(status!=='running'){animateHero(0,false);return;}
 if(rankedRun){updateCollectiveRun(dt);return;}
}
function drawWorld(){
 const g=renderer,cameraRadius=Math.hypot(...g.eye);
 // The path transform is a rotation plus a lateral offset: |z|-max|x|-|eye|
 // bounds the nearest possible fragment distance, including the rear-view pass.
 for(const b of worldBlocks.values()){const z=worldDistance-b.index*36;if(z>79||z<-285||-z-b.fogEdge-cameraRadius>g.fogFar)continue;const m=compose(0,0,z);g.draw(b.mesh,m);for(const e of b.extras){if(e.hideNear&&z+e.z>-8)continue;g.node(e,m);}}
}
function drawEntities(){
 const R=renderer;
 if(status==='title'||status==='briefing'){
  for(let i=0;i<15;i++)drawEvalNode([0,-3.2,3.2][Math.floor(i/5)],1.5+Math.sin(now*2+i)*.14,-12-(i%5)*8,i);
  const block=obstacleModel('car');block.at(-3.2,0,-71);R.node(block);return;
 }
 for(const e of entities){if(e.done)continue;const z=worldDistance-e.d;if(z<-180)break;if(z>14)continue;
  if(e.kind==='paper')drawEvalNode(e.x,e.y+Math.sin(now*3+e.id*.6)*.10,z,e.id);
  else if(e.kind==='coffee'){coffee.at(e.x,e.y+Math.sin(now*3)*.13,z);coffee.ry=now*.6;R.node(coffee);R.draw(meshes.ring,compose(e.x,e.y,z,0,0,now*1.8,1,1,1),rgb(0x70ffe0),2);}
  else{const n=obstacleModel(e.type);n.at(e.x,0,z);R.node(n);}
 }
 const checkZ=worldDistance-(EscapeBenchCore.stageStart(game.stage)+EscapeBenchCore.stageLength(game.stage)/2);if(checkZ>-185&&checkZ<40){startArch.at(0,0,checkZ);R.node(startArch);}
 const finishZ=worldDistance-EscapeBenchCore.stageStart(game.stage+1);if(finishZ>-185&&finishZ<40){finishArch.at(0,0,finishZ);R.node(finishArch);}
}
function drawActors(rear=false){const g=renderer;
 // The runner's compact contact shadow is stable even in low-resolution mode.
 g.draw(meshes.disc,compose(hero.root.x,.028,hero.root.z+.08,0,0,0,(status==='title'?1.05:.65)*(1-game.y*.055),1,status==='title'?.65:.44),rgb(0x2b2216),2,null,.46);
 g.node(hero.root);
 if(game.chasing&&status!=='title'&&status!=='briefing'){const progress=clamp((game.distance-EscapeBenchCore.stageStart(game.stage+1)+180)/180,0,1);chaser.at(Math.sin(now*.8)*.38,3.72,20.5-progress*3.6-(3-game.hp)*1.2);chaser.rz=Math.sin(now*2.8)*.055;chaser.rx=0;chaser.y+=Math.sin(now*4)*.12;g.node(chaser);g.draw(meshes.disc,compose(chaser.x,.04,chaser.z,0,0,0,4.2,1,2.6),rgb(0x2b2012),2,null,.6);}
 if(!rear)for(const p of particles)g.draw(meshes.box,compose(p.x,Math.max(.025,p.y),p.z,p.spin,p.spin,0,p.size,p.size,p.size),p.color,2,null,clamp(p.life/.2,0,1));
}
let render,updateHUD;
