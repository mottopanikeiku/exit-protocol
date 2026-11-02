const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');

function fixture({codec=false}={}){
 let audio;
 class Param{
  constructor(value=1){this.base=value;this.events=[];}
  get value(){return this.at(audio?.currentTime||0);}
  set value(v){this.base=v;}
  at(t){let value=this.base,last=0;for(const e of this.events){if(t<e.t)return e.ramp?value+(e.v-value)*(t-last)/(e.t-last):value;value=e.v;last=e.t;}return value;}
  setValueAtTime(v,t){this.events.push({v,t});this.events.sort((a,b)=>a.t-b.t);}
  linearRampToValueAtTime(v,t){this.events.push({v,t,ramp:true});this.events.sort((a,b)=>a.t-b.t);}
  exponentialRampToValueAtTime(v,t){this.linearRampToValueAtTime(v,t);}
  setTargetAtTime(v,t){this.setValueAtTime(v,t);}
  cancelScheduledValues(t){this.events=this.events.filter(e=>e.t<t);}
 }
 class Node{
  constructor(){for(const k of ['gain','frequency','Q','threshold','knee','ratio','attack','release','detune','pan','delayTime'])this[k]=new Param();}
  connect(n){return n;} disconnect(){} getFloatTimeDomainData(a){a.fill(0);}
 }
 class Context{
  constructor(){audio=this;this.currentTime=0;this.sampleRate=240;this.state='running';this.destination=new Node();this.sources=[];this.decodes=[];this.pending=[];this.defer=false;}
  resume(){this.state='running';return Promise.resolve();} close(){return Promise.resolve();}
  createGain(){return new Node();} createDynamicsCompressor(){return new Node();} createDelay(){return new Node();}
  createBiquadFilter(){return new Node();} createStereoPanner(){return new Node();} createConvolver(){return new Node();}
  createAnalyser(){return new Node();} createWaveShaper(){return new Node();} createOscillator(){return this.createBufferSource();}
  createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,length,getChannelData:i=>data[i]};}
  createBufferSource(){const n=new Node();Object.assign(n,{playbackRate:new Param(),context:this,played:0,stopped:[],start:(t=this.currentTime,offset=0)=>{n.began=t;n.played=offset;this.sources.push(n);},stop:(t=this.currentTime)=>{n.stopped.push(t);n.stopAt=t;}});return n;}
  decodeAudioData(bytes){const buffer={duration:10};this.decodes.push(bytes);return this.defer?new Promise(resolve=>this.pending.push(()=>resolve(buffer))):Promise.resolve(buffer);}
  advance(seconds){const from=this.currentTime,to=from+seconds;this.currentTime=to;for(const n of this.sources){if(n.ended)continue;n.played+=seconds*n.playbackRate.at(from);if(n.stopAt<=to||!n.loop&&n.buffer&&n.played>=n.buffer.duration){n.ended=true;n.onended?.();}}}
 }
 const storage=new Map(),elements=new Map();
 const element=()=>({textContent:'',innerHTML:'',children:[],hidden:false,inert:false,dataset:{},style:{},classList:{values:new Set(),add(...v){v.forEach(x=>this.values.add(x));},remove(...v){v.forEach(x=>this.values.delete(x));},contains(v){return this.values.has(v);},toggle(v,on=!this.values.has(v)){on?this.values.add(v):this.values.delete(v);return on;}},querySelectorAll:()=>[],setAttribute(){},removeAttribute(){},before(){},focus(){},getClientRects:()=>[1]});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const board='zzASSIGN_PHASEONE_TO_SEVEN_OS0412_HOLD_LEFT_REPLY_zzANSWER_SEVEN';
 const lines=Object.fromEntries(['call00_1','call00_go','q_why_me','q_who','q_poison','q_fail','q_want','q_trust','first','next','expired'].map(id=>[id,{speaker:'P1',title:id,text:'Seven, hold the lane. I will wait for you.',question:'Why me?',board}]));
 const data=Object.fromEntries(Object.keys(lines).map(id=>[id,Buffer.from('A').toString('base64')]));
 const global={console,Uint8Array,Float32Array,Map,Set,WeakMap,Math,Number,Object,Promise,atob:s=>Buffer.from(s,'base64').toString('binary'),setInterval:()=>0,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},PHASE_LINES:lines,PHASE_VOICE_DATA:data,window:{AudioContext:Context,addEventListener(){}},document:{body:element(),createElement:element,activeElement:element()},$,innerWidth:1600,reduced:false,save:{voice:true},persist(){},now:0,status:'running',mode:'story',game:{stage:0,distance:0,hp:3,score:0,combo:0,countdown:0},Core:{stageStart:()=>0,stageLength:()=>1200},clearInputs(){},launchGame(){},phaseSchedule(){},PAD:(n,d)=>String(Math.floor(n)).padStart(d,'0')};
 global.campaignRun={};
 const context=vm.createContext(global),run=code=>vm.runInContext(code,context);
 run(source('audio.js')+'\nthis.Sound=Sound;');context.Sound.init();
 if(codec){run(source('game/60-phaseone.js').split('const PHASE_TRIGGERS')[0]);run(source('game/62-codec.js'));}
 const flush=async()=>{await Promise.resolve();await Promise.resolve();};
 const step=async(seconds)=>{for(let t=0;t<seconds;t+=1/60){audio.advance(Math.min(1/60,seconds-t));if(codec)run('now+=1/60;phaseUpdate(1/60)');await flush();}};
 return {run,context,sound:context.Sound,get audio(){return audio;},storage,elements,$,board,flush,step};
}

test('voice requests cannot pre-empt a playing or decoding line',async()=>{
 const f=fixture();f.audio.defer=true;const pending=f.sound.say('first');
 assert.equal(f.sound.speaking,true);assert.equal(f.sound.voiceTiming().state,'loading');
 assert.equal(await f.sound.say('next'),false);assert.equal(f.audio.pending.length,1);
 f.audio.pending.shift()();await pending;const source=f.audio.sources.find(n=>n.buffer?.duration===10&&!n.loop);
 await f.step(2);assert.equal(await f.sound.say('next'),false);assert.equal(source.stopped.length,0);
 await f.step(8.1);assert.equal(f.sound.speaking,false);assert.equal(f.sound.voiceTiming().elapsed,10);assert.equal(f.sound.voiceTiming().reason,'natural');
});

test('pause retains the source and its cursor, then resumes at the same sample',async()=>{
 const f=fixture();await f.sound.say('first');await f.step(2);const before=f.sound.voiceTiming().elapsed,source=f.audio.sources.find(n=>n.buffer?.duration===10&&!n.loop);
 f.sound.pauseVoice();await f.step(3);assert.equal(f.sound.voiceTiming().elapsed,before);assert.equal(f.sound.voiceTiming().state,'paused');assert.equal(source.stopped.length,0);
 f.sound.resumeVoice();await f.step(2);assert.ok(Math.abs(f.sound.voiceTiming().elapsed-before-2)<.001);assert.equal(source.stopped.length,0);
});

test('pause during decoding and stale decode completions do not start stray speech',async()=>{
 const f=fixture();f.audio.defer=true;const first=f.sound.say('first');f.sound.pauseVoice();f.audio.pending.shift()();await first;
 assert.equal(f.sound.voiceTiming().state,'paused');assert.equal(f.sound.diagnostics.voicePlays,0);f.sound.resumeVoice();assert.equal(f.sound.diagnostics.voicePlays,1);
 f.sound.stopVoice('skip');const next=f.sound.say('next');f.sound.stopVoice('skip');f.audio.pending.shift()();await next;
 assert.equal(f.sound.speaking,false);assert.equal(f.sound.diagnostics.voicePlays,1);
});

test('run-end schedules a bounded fade; duplicate finish notifications do not extend it',async()=>{
 const f=fixture();await f.sound.say('first');await f.step(1);f.sound.stopVoice('run-end',.2);const source=f.audio.sources.find(n=>n.buffer?.duration===10&&!n.loop);
 assert.ok(Math.abs(source.stopAt-f.audio.currentTime-.2)<.001);assert.equal(f.sound.voiceTiming().state,'fading');f.sound.stopVoice('run-end',.2);assert.equal(source.stopped.length,1);
 await f.step(.25);assert.equal(f.sound.speaking,false);assert.equal(f.sound.voiceTiming().reason,'run-end');
});

test('dropout restores within 280ms without another rendering callback, including Firefox hold fallback',async()=>{
 const f=fixture();await f.sound.say('first');f.sound.setVoiceDropout(true);f.audio.advance(.1);assert.equal(f.sound.voiceDropout,true);assert.ok(f.sound.diagnostics.voiceGain<1);
 f.sound.setVoiceDropout(true);f.audio.advance(.19);assert.equal(f.sound.voiceDropout,false);assert.equal(f.sound.diagnostics.voiceGain,1);
});

test('radio priority, lessons and stage resets preserve speech; stale queued lines expire',async()=>{
 const f=fixture({codec:true});f.run("phaseQueue('first');phaseDrain()");await f.flush();
 f.run("phaseQueue('expired','boss',{ttl:.1});phaseQueue('next','boss',{ttl:30,crossStage:true});document.body.classList.add('lesson-active')");
 await f.step(1);assert.equal(f.sound.voiceTiming().id,'first');assert.equal(f.sound.voiceTiming().state,'playing');
 f.run("game.stage=1;phaseReset('stage');document.body.classList.remove('lesson-active')");await f.step(10);
 assert.equal(f.sound.voiceTiming().id,'next');assert.deepEqual(Array.from(f.run('phaseState.history')),['first','next']);
});

test('radio queue TTL and subtitles freeze while paused; run end retains subtitles until its fade completes',async()=>{
 const f=fixture({codec:true});f.run("phaseQueue('first');phaseDrain()");await f.flush();await f.step(1);
 f.run("phaseQueue('next','story',{ttl:20});status='paused';phasePause(true)");const before=f.run('({clock:phaseState.clock,shown:phaseState.shown})');await f.step(30);
 assert.equal(f.run('phaseState.clock'),before.clock);assert.equal(f.run('phaseState.shown'),before.shown);
 f.run("status='running';phasePause(false)");await f.step(.1);f.run('phaseEndRun()');assert.equal(f.run('phaseState.active'),true);
 await f.step(.25);assert.equal(f.run('phaseState.active'),false);assert.equal(f.run('phaseState.queue.length'),0);
});

test('returning to results cannot fade a new result line; checkpoint retries reset the end gate',async()=>{
 const f=fixture({codec:true});f.run("phaseQueue('first');phaseDrain()");await f.flush();f.run("status='over';phaseEndRun()");await f.step(.25);
 f.run("phaseQueue('next','story',{meta:true});phaseDrain()");await f.flush();await f.step(1);f.run('phaseEndRun()');
 assert.equal(f.sound.voiceTiming().id,'next');assert.equal(f.sound.voiceTiming().state,'playing');
 f.run("status='running';phaseReset('retry');phaseEndRun()");assert.equal(f.sound.voiceTiming().state,'fading');
});

test('CONTINUE skips the playing line at once; a carried greeting yields; queued questions still play; SKIP CALL closes',async()=>{
 const f=fixture({codec:true});f.run("status='title';window.PhaseOne.greet('first');phaseOpenCall(BRIEFING,'opening',()=>{globalThis.closed=(globalThis.closed||0)+1;status='running'})");await f.flush();await f.step(1);
 assert.equal(f.sound.voiceTiming().id,'first');assert.equal(f.run('phaseState.carry'),true);
 f.run('phaseNext()');await f.flush();assert.equal(f.run('phaseState.carry'),false);assert.equal(f.sound.voiceTiming().id,'call00_1');
 await f.step(1);f.run('phaseNext()');assert.equal(f.sound.voiceTiming().state,'fading');
 await f.step(.2);assert.equal(f.run('phaseState.page'),1);assert.equal(f.sound.voiceTiming().id,'call00_go');
 f.run('phaseQuestion();phaseNext()');await f.step(.2);assert.equal(f.sound.voiceTiming().id,'q_why_me');assert.equal(f.run('phaseState.page'),1);
 f.run('phaseLaunch()');assert.equal(f.sound.voiceTiming().reason,'skip');assert.equal(f.run('closed'),1);assert.equal(f.run('phaseState.full'),false);f.run('phaseLaunch()');assert.equal(f.run('closed'),1);
});

test('a greeting that is only subtitles never holds the call open',()=>{
 const f=fixture({codec:true});f.run("Sound.setVoice(false);status='title';window.PhaseOne.greet('first');phaseOpenCall(BRIEFING,'opening',()=>{})");
 assert.equal(f.run('phaseState.carry'),false);assert.equal(f.run('phaseState.id'),'call00_1');
});

test('an immediate stop ends the line for the codec but ramps the audio out over 12 ms',async()=>{
 const f=fixture();await f.sound.say('first');await f.step(1);f.sound.stopVoice('skip');const source=f.audio.sources.find(n=>n.buffer?.duration===10&&!n.loop);
 assert.equal(f.sound.speaking,false);assert.ok(Math.abs(source.stopAt-f.audio.currentTime-.012)<.001);
});

test('a run launched over an open call supersedes it; the call cannot relaunch the run later',async()=>{
 const f=fixture({codec:true});f.run("status='title';phaseOpenCall(BRIEFING,'opening',()=>{globalThis.closed=(globalThis.closed||0)+1})");await f.flush();await f.step(1);
 assert.equal(f.sound.voiceTiming().id,'call00_1');assert.equal(f.run('status'),'briefing');
 f.run("phaseReset();status='running'");assert.equal(f.run('phaseState.full'),false);assert.equal(f.sound.speaking,false);
 await f.step(12);f.run("phaseLaunch('complete')");assert.equal(f.run('globalThis.closed||0'),0);
});

test('board decrypt shares speech timing; reduced motion shows plaintext immediately',async()=>{
 const f=fixture({codec:true});f.run("phaseQueue('first');phaseDrain()");await f.flush();const board=f.run('phaseBoard');assert.notEqual(board.textContent,f.board);
 await f.step(5);assert.ok(board.textContent.startsWith(f.board.slice(0,Math.floor(f.board.length*.49))));assert.notEqual(board.textContent,f.board);
 f.run('reduced=true');await f.step(.1);assert.equal(board.textContent,f.board);
});

function veilFixture(){
 const f=fixture({codec:true});f.context.entities=[];f.context.hook=()=>{};
 f.run(source('game/68-phaseone-triggers.js'));
 f.run('game.stage=4;game.distance=360;game.speed=32;phaseState.lastStage=4;');
 return f;
}

test('veil dialogue guards missing assets and schedules once per story run across its sector windows',()=>{
 const f=veilFixture();f.run('phaseSchedule()');assert.equal(f.run('phaseState.queue.length'),0);
 f.run("for(const id of ['veil_glimpse','veil_torn'])PHASE_LINES[id]=PHASE_LINES.first;");
 for(const [stage,id] of [[4,'veil_glimpse'],[5,null],[6,null],[8,'veil_torn'],[9,null]]){
  f.run(`game.stage=${stage};phaseState.lastStage=${stage};phaseState.queue.length=0;phaseSchedule()`);
  assert.equal(f.run('phaseState.queue[0]?.id')??null,id);
  if(id){assert.equal(f.run('phaseState.queue[0].key'),'run:'+id);assert.equal(f.run('phaseState.queue[0].priority'),f.run('PHASE_PRIORITY.story'));assert.equal(f.run('phaseState.queue[0].expires-phaseState.clock'),2);}
 }
 f.run("phaseReset('retry');game.stage=8;phaseState.lastStage=8;phaseSchedule()");assert.equal(f.run('phaseState.queue.length'),0);
 f.run("phaseReset('launch');game.stage=4;phaseState.lastStage=4;phaseSchedule()");assert.equal(f.run('phaseState.queue[0].id'),'veil_glimpse');
});

test('veil dialogue waits for calm story play without bosses, relay traffic, lessons or nearby hazards',()=>{
 for(const guard of ["mode='practice'","mode='endless'","mode='benchmark'","mode='daily'","game.boss={state:'approach'}","game.boss={state:'active'}","phaseState.relay={id:'relay_patch'}","phaseState.queue.push({kind:'relay',priority:3})","document.body.classList.add('lesson-active')","phaseState.active=true","entities.push({kind:'obstacle',d:370})","game.distance=120","game.distance=1100","game.stage=7;phaseState.lastStage=7"]){
  const f=veilFixture();f.run("for(const id of ['veil_glimpse','veil_torn'])PHASE_LINES[id]=PHASE_LINES.first;");
  f.run(guard+';phaseSchedule()');
  assert.equal(f.run("phaseState.queue.some(q=>q.id?.startsWith('veil_'))"),false,guard);
  assert.equal(f.run("phaseState.sent.has('run:veil_glimpse')"),false,guard);
 }
});

test('PHASEONE stays quiet: forks, relay offers and two hood lines per run, one word per boss plus the reveal, only the first reset',()=>{
 // Every id is speakable here, so anything else the scheduler tries to say is caught.
 const f=veilFixture();
 f.run("PHASE_LINES=new Proxy({},{get:(t,id)=>typeof id==='string'?{speaker:'P1',title:id,text:'.'}:undefined});var queued=[],enqueue=phaseQueue;phaseQueue=function(id,...rest){const ok=enqueue(id,...rest);if(ok)queued.push(id);return ok;};");
 for(let stage=0;stage<12;stage++){
  f.run(`game.stage=${stage};game.distance=0;phaseState.lastStage=-1;entities.length=0;${stage===4?"entities.push({type:'fork',done:false,d:600});":''}`);
  for(let d=0;d<=1200;d+=5)f.run(`game.distance=${d};phaseSchedule();if(phaseState.relay)resolveRelay(true);phaseState.queue.length=0`);
 }
 for(const boss of ['watchdog','reset-storm','exit-condition'])for(const e of [{type:'bossStart'},{type:'bossPhase',phase:1},{type:'bossPhase',phase:2},{type:'reflect'},{type:'hit'},{type:'decoyPayload'},{type:'purge'},{type:'bossDefeated'}])f.run(`phaseEvent(${JSON.stringify({...e,boss})})`);
 for(let n=0;n<10;n++)f.run("phaseEvent({type:'finish',won:false});phaseReset('retry')");
 const said=f.run("queued.filter(id=>!id.endsWith('_reply'))");
 assert.deepEqual([...said].sort(),['b_ec_phase2','b_ec_start','b_rs_start','b_wd_start','r01_fork','r05_fork','relay_mica','relay_patch','relay_trace','veil_glimpse','veil_torn','x_death1']);
});
