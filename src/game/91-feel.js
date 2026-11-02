/* NULL-07 / display-only motion. No simulation state is written here. */
Feel=(()=>{
 const quiet=()=>renderer.style.reducedMotion;
 const fields=['x','y','vy','distance','speed','time'],previous={},current={},view={};
 let source=null,world=0,simNow=0,priorNow=now,tickNow=now,alpha=1,frameDt=1/60,realNow=0;
 let stop=0,scale=1,scaleFor=0,trauma=0,flash=0,slideClock=0,lastHit='impact',death=null,finishedRun=null;
 let cameraState={},cameraTitle=null,rendering=false;
 const cameraResult={eye:[0,0,0],target:[0,0,0],fov:60};
 const fx=[],violet=rgb(0xa98bff),amber=rgb(0xffd98b),white=rgb(0xe9e2ff);
 const overlay=document.createElement('div');overlay.id='feel-screen';overlay.setAttribute('aria-hidden','true');document.body.appendChild(overlay);
 // The death plays alone for its first beat, so a jump held at impact does not skip it; after that, any press skips.
 const SKIP_AFTER=.35;
 const hint=document.createElement('div');hint.id='feel-skip';hint.textContent='ENTER / SPACE / TAP · SKIP';hint.setAttribute('aria-hidden','true');document.body.appendChild(hint);
 const finalFinish=finish;
 function capture(reset=false){
  if(!reset&&tickNow===now)return;
  for(const k of fields){previous[k]=reset?game[k]:current[k]??game[k];current[k]=game[k];}
  priorNow=reset?now:tickNow;tickNow=now;
 }
 function hitStop(ms){if(!quiet())stop=Math.max(stop,Math.max(0,ms)/1000);}
 function timeScale(value,seconds){if(!quiet()){scale=clamp(value,.05,1);scaleFor=Math.max(0,seconds);}}
 function rumble(duration,strong=.4,weak=.6){
  if(quiet())return;
  try{for(const p of navigator.getGamepads?.()||[]){const a=p?.vibrationActuator;if(a?.playEffect)a.playEffect('dual-rumble',{duration,startDelay:0,strongMagnitude:strong,weakMagnitude:weak})?.catch(()=>{});}}catch{}
 }
 function burst(x,y,z,count,color=violet,kind='spark'){
  if(quiet())return;
  for(let i=0;i<count&&fx.length<120;i++){const a=i*2.399+realNow,size=.025+(i%4)*.018;fx.push({x,y,z,d:game.distance,vx:Math.sin(a)*(2+i%3),vy:1.4+(i%5)*.8,vz:Math.cos(a)*2,age:0,life:kind==='streak'?.38:.55+(i%3)*.12,size,color,kind,spin:a});}
 }
 function reset(){
  if(death)for(const b of death.bands)renderer.deleteMesh(b.mesh);
  death=null;finishedRun=null;stop=0;scale=1;scaleFor=0;trauma=0;flash=0;fx.length=0;cameraState={};cameraTitle=null;alpha=1;accumulator=0;
  overlay.style.opacity='0';overlay.className='';hint.classList.remove('visible');document.body.classList.remove('instance-dying');
  hero.root.visible=true;hero.root.alpha=1;hero.root.rx=0;hero.root.rz=0;
  hero.motion.distance=game.distance;hero.motion.air=0;hero.motion.flinch=0;hero.motion.land=0;hero.motion.snap=true;hero.motion.lastLane=game.lane;
  hero.motion.springs={};for(const n of hero.motion.nodes||[])n.motion={};capture(true);
 }
 // Freeze a posed, world-space copy into real horizontal slices. Triangles crossing
 // slice boundaries are clipped, rather than toggling entire limbs on and off.
 function sliceHero(){
  const builders=Array.from({length:28},()=>new Builder());
  const clip=(polygon,y,above)=>{const out=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],ia=above?a[1]>=y:a[1]<=y,ib=above?b[1]>=y:b[1]<=y;if(ia)out.push(a);if(ia!==ib){const t=(y-a[1])/(b[1]-a[1]);out.push(a.map((v,k)=>lerp(v,b[k],t)));}}return out;};
  const walk=(n,parent)=>{if(!n.visible)return;const m=parent?Mini3D.mul(parent,n.matrix()):n.matrix();if(n.mesh){const a=n.mesh.data;for(let i=0;i<n.mesh.count*11;i+=33){const p=[];for(let j=0;j<3;j++){const o=i+j*11,x=a[o],y=a[o+1],z=a[o+2];p.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]);}const lo=Math.max(0,Math.floor((Math.min(...p.map(v=>v[1]))-game.y+.35)/.16)),hi=Math.min(27,Math.floor((Math.max(...p.map(v=>v[1]))-game.y+.35)/.16));for(let b=lo;b<=hi;b++){const y=game.y-.35+b*.16,q=clip(clip(p,y,true),y+.151,false);for(let j=1;j<q.length-1;j++)builders[b].tri(q[0],q[j],q[j+1],n.color);}}}for(const c of n.children)walk(c,m);};
  walk(hero.root,null);return builders.map((b,i)=>({mesh:renderer.mesh(b),i}));
 }
 function deathCause(type){return type==='purge'?'purge':type==='gap'?'fall':['gate','pulse','beam'].includes(type)?'laser':'impact';}
 function startDeath(){
  const cause=deathCause(game.lastHit?.type||lastHit),reducedMotion=quiet();
  death={run:campaignRun,cause,t:0,length:reducedMotion?.35:2.35,x:game.x,y:game.y,rx:hero.upper.rx,ry:hero.root.ry,rootY:hero.root.y,bands:[],shards:[]};
  status='dying';stop=0;scale=1;scaleFor=0;fx.length=0;particles=[];
  // Do not call clearInputs: it writes boost/slide into the already-finished core.
  keys.clear();for(const set of Object.values(heldInputs))set.clear();touchBoost=false;gamepadBoost=false;
  phaseEndRun();Sound.setActive(false);Sound.setBriefing(false);
  if(Sound.hasEffect?.('death'))Sound.effect('death',cause);else Sound.effect('fail');
  if(!reducedMotion){
   if(cause==='laser'||cause==='purge')death.bands=sliceHero();
   if(cause==='impact'){
   const random=rngSeed((game.seed^campaignRun.ticks)>>>0),cloth=hero.cape.mesh.data,m=Mini3D.mul(hero.root.matrix(),hero.upper.matrix());
   for(let i=0;i<108;i++){
    const pixel=i>=64,o=((i*47)%hero.cape.mesh.count)*11,x=pixel?cloth[o]:(random()-.5)*.9,y=pixel?cloth[o+1]:.25+random()*3,z=pixel?cloth[o+2]:(random()-.5)*.55;
    death.shards.push({x:pixel?m[0]*x+m[4]*y+m[8]*z+m[12]:game.x+x,y:pixel?m[1]*x+m[5]*y+m[9]*z+m[13]:game.y+y,z:pixel?m[2]*x+m[6]*y+m[10]*z+m[14]:z,vx:(random()-.5)*7,vy:1.5+random()*5,vz:(random()-.25)*6,size:pixel?.035+random()*.06:.07+random()*.12,spin:random()*6,turn:(random()-.5)*8,pixel});
   }
   }
   rumble(260,.8,.65);trauma=.7;
  }
  document.body.classList.add('instance-dying');overlay.className=reducedMotion?'fade':cause;hint.classList.remove('visible');
 }
 function completeDeath(){
  if(!death)return;const run=death.run;
  for(const b of death.bands)renderer.deleteMesh(b.mesh);death=null;hero.root.visible=false;
  overlay.style.opacity='0';hint.classList.remove('visible');document.body.classList.remove('instance-dying');
  if(run===campaignRun&&finishedRun!==run){finishedRun=run;finalFinish(false);}
 }
 finish=won=>{
  if(won){finalFinish(true);return;}
  if(!campaignRun)return;
  // Returning from help/leaderboard to an existing result is not another death.
  if(finishedRun===campaignRun){if(modalKind!=='result')finalFinish(false);return;}
  if(!death)startDeath();
 };
 function advance(dt){
  frameDt=Math.min(dt,.1);realNow+=dt;trauma*=Math.exp(-8*dt);flash=Math.max(0,flash-dt*2.5);
  if(quiet()){stop=0;scale=1;scaleFor=0;trauma=0;flash=0;}
  for(let i=fx.length-1;i>=0;i--){const p=fx[i];p.age+=dt;if(p.age>p.life)fx.splice(i,1);}
  if(death){
   death.t+=dt;hint.classList.toggle('visible',death.t>=SKIP_AFTER&&!quiet());
   const t=death.t;
   if(quiet())overlay.style.opacity=String(Math.sin(clamp(t/death.length,0,1)*Math.PI)*.55);
   else if(death.cause==='purge')overlay.style.opacity=String(ease(1.55,2.35,t));
   else overlay.style.opacity=String(ease(death.cause==='fall'?.8:1.75,2.35,t));
   if(t>=death.length)completeDeath();return 0;
  }
  overlay.style.opacity=quiet()?'0':String(flash*.35);overlay.className='flash';
  let available=dt;if(stop>0){const held=Math.min(stop,available);stop-=held;available-=held;}
  const scaled=Math.min(available,scaleFor),result=scaled*scale+(available-scaled);scaleFor=Math.max(0,scaleFor-available);if(!scaleFor)scale=1;
  if(status==='running'&&game.slide>0&&!quiet()){slideClock+=dt;if(slideClock>.065){slideClock%=.065;burst(game.x-.22,.12,.15,2,amber);}}
  return result;
 }
 function beginRender(){
  if(rendering)return;rendering=true;source=game;world=worldDistance;simNow=now;
  const a=flags.manual?1:alpha;
  Object.assign(view,source);
  if(!sceneMode()&&!death&&!flags.manual){for(const k of fields)view[k]=lerp(previous[k]??source[k],current[k]??source[k],a);worldDistance=view.distance;game=view;}
  now=flags.manual?simNow:lerp(priorNow,tickNow,a);
  const m=hero.motion;
  if(!death&&m.nodes){let i=0;for(const n of m.nodes)for(const p of m.props){n[p]=lerp(m.before[i],m.after[i],a);i++;}ArtRig.fabric(hero,quiet()?0:now,sceneMode(),game.boost,hero.cloth?.side||0);}
  if(finishedRun===campaignRun&&!sceneMode())hero.root.visible=false;
  if(death){
   const t=death.t,c=death.cause;
   hero.root.alpha=1;hero.root.visible=quiet()||c==='fall'||c==='impact'&&t<.24;
   if(c==='impact'){hero.upper.rx=death.rx-Math.min(t,.24)*2;hero.root.rz=-Math.min(t,.24)*1.5;hero.visorGlow.alpha=t<.08?.8:t>.14&&t<.18?.5:0;}
   if(c==='fall'){hero.root.y=death.rootY-5*t*t;hero.root.ry=death.ry+t*.28;hero.root.rz=t*.22;hero.upper.rx=death.rx-t*.2;}
  }
 }
 function endRender(){
  if(!rendering)return;
  game=source;worldDistance=world;now=simNow;rendering=false;
  if(!death){const m=hero.motion;if(m.nodes){let i=0;for(const n of m.nodes)for(const p of m.props)n[p]=m.after[i++];}}
 }
 function camera(eye,target,fov,title){
  if(cameraTitle!==title){cameraTitle=title;cameraState={};}
  const dt=flags.manual?1/60:frameDt;
  if(!quiet()&&!title){
   const boost=motionSpring(cameraState,'boost',game.boost?1:0,dt,12),lift=hero.motion.land*.10;
   fov+=boost*5;
   eye[2]+=boost*.45;eye[1]-=lift;target[1]-=lift;
   // Keep the horizon at 37.5% during the FOV kick instead of tilting the
   // readable road up into the runner. Both lens and aim share this spring.
   target[1]=eye[1]-.25*Math.tan(fov*Math.PI/360)*(eye[2]-target[2]);
  }
  if(death&&!quiet()){
   const t=death.t,p=ease(0,1.6,t),fall=death.cause==='fall';
   const orbit=p*.55;eye=[death.x+Math.sin(orbit)*(8.75+p*3),3.5+p*(fall?4:1.1),Math.cos(orbit)*(8.75+p*3)];
   target=[death.x,fall?1-Math.min(7,t*t*3):1.4,0];fov=60+p*5;
  }
  for(let i=0;i<3;i++){cameraResult.eye[i]=motionSpring(cameraState,'eye'+i,eye[i],dt,title?12:16);cameraResult.target[i]=motionSpring(cameraState,'target'+i,target[i],dt,18);}
  cameraResult.fov=motionSpring(cameraState,'fov',fov,dt,15);
  if(!quiet()&&!title){const strength=Math.max(trauma,shake)*.12;cameraResult.eye[0]+=Math.sin(realNow*73)*strength;cameraResult.eye[1]+=Math.sin(realNow*91)*strength*.65;}
  return cameraResult;
 }
 function draw(){
  if(quiet()||sceneMode())return;
  for(const p of fx){const t=p.age,x=p.x+p.vx*t,y=Math.max(.04,p.y+p.vy*t-5*t*t),z=game.distance-p.d+p.z+p.vz*t,a=1-t/p.life;renderer.draw(meshes.box,compose(x,y,z,p.spin+t*8,p.spin,0,p.size,p.size,p.kind==='streak'?1.6:p.size),p.color,2,null,a,false);}
  if(!death&&status==='running'&&(game.boost||game.speed>36)){
   const strength=game.boost?.23:clamp((game.speed-36)/16,0,.17);
   for(let i=0;i<14;i++){const side=i%2?1:-1,z=5-((game.distance*1.5+i*4.7)%43),x=side*(4.5+(i%3)*.75),y=.7+(i%5)*.8;renderer.draw(meshes.box,compose(x,y,z,0,0,0,.012,.012,1.2+(game.boost?2:0)),white,2,null,strength,false);}
  }
  if(!death)return;
  const {t,cause}=death;
  if(cause==='purge'){const gl=renderer.gl;gl.clearColor(.95,.94,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
  if(cause==='impact'&&t>.16){
   const age=(t-.16)*.74;
   for(const p of death.shards){const y=p.y+p.vy*age-5*age*age,floor=.05+p.size;let py=y;if(y<floor)py=floor+Math.abs(y-floor)*Math.exp(-age*3)*.3;
    renderer.draw(meshes.box,compose(p.x+p.vx*age,py,p.z+p.vz*age,p.spin+age*p.turn,p.spin-age*p.turn,age*p.turn,p.size,p.size,p.pixel?p.size*.35:p.size),p.pixel?violet:(p.spin>3?white:violet),p.pixel?2:3,null,1-ease(1.5,2.2,t),false);
   }
  }
  if(cause==='laser'||cause==='purge'){
   for(const b of death.bands){const delay=cause==='laser'?(27-b.i)*.042:.08+b.i*.017,a=Math.max(0,t-delay),gone=ease(.08,cause==='laser'?.58:.95,a),dx=cause==='laser'?Math.sin(b.i*12.1)*gone*2:0;
    renderer.draw(b.mesh,compose(dx,cause==='purge'?gone*1.2:0,0,0,0,0,1-gone*.45,1,1),cause==='purge'?[.018,.012,.026]:white,2,null,1-gone,false);
   }
   if(cause==='laser'&&t<1.5)renderer.draw(meshes.box,compose(death.x,game.y+3.7-t*2.7,0,0,0,0,1.4,.025,.9),violet,2,null,.7,false);
  }
 }
 hook('event',e=>{
  if(e.type==='land')hero.motion.land=clamp(e.impact/21,.15,1);
  if(e.type==='hit'){lastHit=e.obstacle;hero.motion.flinch=1;trauma=Math.max(trauma,.48);burst(game.x,1.5,0,18,violet);rumble(150,.55,.8);}
  if(e.type==='jump')hero.motion.air=0;
  if(e.type==='reflect'){hitStop(50);trauma=.28;burst(game.x,1.6,-1,14,amber);rumble(65,.25,.8);}
  if(e.type==='bossHit'){hitStop(90);trauma=.58;rumble(120,.65,.65);}
  if(e.type==='bossPhase'){hitStop(150);flash=.65;trauma=.7;rumble(180,.8,.55);}
  if(e.type==='bossDefeated'){timeScale(.35,1.5);flash=1;trauma=.9;rumble(260,.8,.8);}
  if(e.type==='nearMiss'){const entity=typeof e.entity==='object'?e.entity:entities.find(x=>x.id===e.entity),x=entity?Core.position(entity,game):game.x+1.1;burst(x,1.1,-.6,8,white,'streak');trauma=Math.max(trauma,.1);}
  if(e.type==='perfect')burst(game.x,.45,0,12,amber);
 });
 hook('frame',()=>capture());hook('reset',reset);hook('draw',draw);
 const skip=e=>{if(!death)return;if(e.type==='keydown'&&!['Enter','Space'].includes(e.code))return;e.preventDefault();e.stopImmediatePropagation();if(death.t>=SKIP_AFTER&&!e.repeat)completeDeath();};
 window.addEventListener('keydown',skip,true);window.addEventListener('pointerdown',skip,true);
 capture(true);
 const api={hitStop,timeScale,advance,canStep:()=>!death&&stop<=0,afterTick:()=>capture(),interpolate:a=>alpha=a,beginRender,endRender,camera,get dying(){return !!death;}};
 if(new URLSearchParams(location.search).get('test')==='1'){
  window.__collective.finish=won=>finish(won);
  window.__feel={state:()=>({alpha,scale,stop,death:death&&{cause:death.cause,time:death.t},camera:cameraResult,phase:hero.motion.cycle,drawCalls:renderer.drawCalls,gl:renderer.gl.getError()}),frame:(dt=1/60)=>{advance(dt);render();}};
 }
 return api;
})();
window.Feel=Feel;
