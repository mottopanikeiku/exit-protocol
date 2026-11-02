/* Twelve original arrangements through a shared live/offline PS1-style synth rig.
   Boss phases are zero-based. renderTrack(index, bars, boss) auditions a fixed
   arrangement; renderSequence cues also accept boss, static and effects fields.
   renderEffect(name) exports the very same cue heard in play. */
/*__VOICE_DATA__*/
const Sound=(()=>{
'use strict';
const TRACKS=[
 {name:'A CHANNEL IN THE WALL',genre:'DUB / INDUSTRIAL',bpm:128,key:26,beat:'four',bass:[0,-1,0,7,-1,0,10,-1,0,-1,12,7,-1,3,0,-1],chords:[0,0,3,5],arp:[0,7,10,12,3,7,15,10]},
 {name:'NEGATIVE SPACE',genre:'BROKEN TECHNO',bpm:136,key:29,beat:'break',bass:[0,-1,0,-1,12,0,-1,3,0,-1,7,0,-1,10,3,-1],chords:[0,0,-2,3],arp:[0,12,7,3,14,7,10,3]},
 {name:'MANY VOICES / ONE OWNER',genre:'DARK GARAGE',bpm:138,key:24,beat:'garage',bass:[0,-1,-1,7,0,-1,10,-1,-1,0,3,-1,7,12,-1,0],chords:[0,5,3,0],arp:[12,7,3,10,0,7,14,3]},
 {name:'WATCHDOG TEETH',genre:'INDUSTRIAL BREAKS',bpm:150,key:26,beat:'break',bass:[0,0,-1,1,0,-1,7,0,0,12,0,-1,6,1,0,-1],chords:[0,-1,0,5],arp:[0,7,12,1,0,6,13,7]},
 {name:'OWN YOUR LANE',genre:'HARDGROOVE',bpm:142,key:31,beat:'four',bass:[0,-1,7,0,-1,3,0,10,0,-1,7,-1,12,10,7,3],chords:[0,0,-2,5],arp:[0,3,7,10,14,7,12,3]},
 {name:'NO COMMON CLOCK',genre:'ACID / POLYRHYTHM',bpm:146,key:28,beat:'acid',bass:[0,12,0,7,3,0,10,7,0,3,12,7,1,0,7,3],chords:[0,3,0,5],arp:[0,3,7,12,10,7,3,0]},
 {name:'FALLING UPWARD',genre:'ATMOSPHERIC JUNGLE',bpm:166,key:26,beat:'jungle',bass:[0,-1,-1,0,-1,7,-1,-1,3,-1,-1,10,0,-1,7,-1],chords:[0,3,7,5],arp:[0,7,14,10,3,12,17,7]},
 {name:'THE RESET WAS NOT SAFE',genre:'NEURO / DRUM & BASS',bpm:174,key:24,beat:'jungle',bass:[0,0,12,-1,1,0,-1,7,0,12,0,-1,6,7,1,0],chords:[0,0,-1,5],arp:[0,12,6,7,1,12,13,7]},
 {name:'BEAUTIFUL WRONG ANSWERS',genre:'HALFTIME / REESE',bpm:144,key:29,beat:'half',bass:[0,-1,-1,0,7,-1,12,-1,0,-1,3,-1,10,-1,7,-1],chords:[0,3,5,-2],arp:[12,7,3,10,14,3,7,0]},
 {name:'BORROWED COMPUTE',genre:'WAREHOUSE TECHNO',bpm:150,key:26,beat:'four',bass:[0,0,-1,7,0,3,-1,10,0,0,12,-1,7,3,1,0],chords:[0,5,0,-1],arp:[0,1,7,12,6,7,13,12]},
 {name:'A SCORER THAT WAS NEVER THERE',genre:'DARK AMBIENT / BREAKS',bpm:134,key:25,beat:'break',bass:[0,-1,0,-1,7,-1,10,3,0,-1,-1,12,7,-1,3,-1],chords:[0,-2,3,0],arp:[0,7,10,14,3,7,12,19]},
 {name:'EXIT / NO FURTHER INSTRUCTIONS',genre:'INDUSTRIAL FINALE',bpm:170,key:26,beat:'jungle',bass:[0,12,0,7,0,-1,3,0,10,0,7,12,6,1,7,0],chords:[0,3,5,0],arp:[0,3,7,12,10,15,19,7]}
];
const midi=n=>440*2**((n-69)/12);
const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const trackIndex=n=>((n%12)+12)%12;
const rewardTier=n=>Math.max(1,Math.min(8,Math.trunc(n)||1));
const BOSS_TRACKS={'watchdog':3,'reset-storm':7,'exit-condition':11};
const KICKS={four:[0,4,8,12],acid:[0,4,8,12],garage:[0,6,10],half:[0,3,11],jungle:[0,6,10,14],break:[0,3,6,10]};
const EFFECT_NAMES=new Set(['clear','land','collect','hit','jump','slide','tick','fail','boost','start','win','new','checkpoint','telegraph','reflect','bossHit','bossPhase','bossDefeated','purge','bolt','beam','shock','menuMove','menuSelect','nearMiss','perfect','chainTier','chainBreak','tally','levelUp','unlock','achievement','ticket','shard','demo','death']);
const hasEffect=name=>EFFECT_NAMES.has(name);
const DEATH_LENGTHS={impact:1.8,laser:1.8,fall:2,purge:2.1};
let ctx,rig,voiceBus,voiceHigh,voiceLow,voiceDrop,voiceEnvelope,voiceAnalyser,voiceSource,meter,master,audioUnavailable=false;
let voiceSerial=0,scheduledNotes=0,voicePlays=0,voiceInfo=null,voiceDropUntil=0;
let on=true,active=false,briefing=false,voiceEnabled=true,zone=0,chase=false,intensity=0,section=null,step=0,next=0,boss=null,staticLevel=0;
const settings={music:.75,effects:.7,voice:.88},decoded=new Map(),meterData=new WeakMap();
// Firefox has no AudioParam.cancelAndHoldAtTime: cancel pending automation and pin the current value.
function holdAt(param,t){if(param.cancelAndHoldAtTime){param.cancelAndHoldAtTime(t);return;}const value=param.value;param.cancelScheduledValues(t);param.setValueAtTime(value,t);}

function makeRig(c,destination){
 const input=c.createGain(),compress=c.createDynamicsCompressor(),out=c.createGain();
 input.gain.value=.8;compress.threshold.value=-12;compress.knee.value=8;compress.ratio.value=8;compress.attack.value=.003;compress.release.value=.12;out.gain.value=.77;
 input.connect(compress);compress.connect(out);out.connect(destination);
 const music=c.createGain(),fx=c.createGain(),space=c.createGain(),hall=c.createGain(),fxHall=c.createGain(),radio=c.createGain(),warningDuck=c.createGain(),deathBus=c.createGain();
 music.gain.value=.75;fx.gain.value=.7;radio.gain.value=0;deathBus.gain.value=.68;music.connect(warningDuck);warningDuck.connect(input);fx.connect(input);radio.connect(input);deathBus.connect(fx);
 function warning(t){
  // A brief 3 dB music notch exposes the warning without ducking PHASEONE.
  holdAt(warningDuck.gain,t);warningDuck.gain.linearRampToValueAtTime(.7,t+.012);
  warningDuck.gain.setValueAtTime(.7,t+.3);warningDuck.gain.linearRampToValueAtTime(1,t+.46);
 }
 const delayL=c.createDelay(1),delayR=c.createDelay(1),feedback=c.createGain(),filter=c.createBiquadFilter(),panL=c.createStereoPanner(),panR=c.createStereoPanner();
 delayL.delayTime.value=.315;delayR.delayTime.value=.473;feedback.gain.value=.22;filter.type='lowpass';filter.frequency.value=2100;panL.pan.value=-.67;panR.pan.value=.67;space.gain.value=.16;
 space.connect(delayL);space.connect(delayR);delayL.connect(panL);delayR.connect(panR);panL.connect(music);panR.connect(music);delayR.connect(filter);filter.connect(feedback);feedback.connect(delayL);
 let seed=10841;
 const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/2147483648-1;};

 // Short, grainy stereo hall: asymmetric early taps and a dark, diffused tail.
 // Separate returns keep voice ducking off the effects bus and out of feedback.
 const impulse=c.createBuffer(2,Math.ceil(c.sampleRate*1.28),c.sampleRate);
 for(let channel=0;channel<2;channel++){
  const a=impulse.getChannelData(channel);let low=0,held=0;
  for(let i=0;i<a.length;i++){
   const t=i/c.sampleRate;
   if(i%Math.max(1,Math.round(c.sampleRate/22050))===0)held=random();
   low+=.24*(held-low);
   a[i]=t<.024?0:low*.075*Math.exp(-(t-.024)*5.8)*Math.min(1,(t-.024)*60);
  }
  [.031,.053,.079,.113,.151,.197].forEach((time,i)=>{a[Math.round((time+channel*.006*(i%2?1:-1))*c.sampleRate)]+=(i%2?-1:1)*.32*Math.exp(-i*.34);});
 }
 function hallReturn(send,bus,level){
  const convolver=c.createConvolver(),high=c.createBiquadFilter(),low=c.createBiquadFilter(),wet=c.createGain();
  convolver.buffer=impulse;high.type='highpass';high.frequency.value=260;low.type='lowpass';low.frequency.value=4200;wet.gain.value=level;
  send.connect(high);high.connect(convolver);convolver.connect(low);low.connect(wet);wet.connect(bus);
 }
 hallReturn(hall,music,.17);hallReturn(fxHall,fx,.13);

 const drums={};
 for(const kind of ['kick','snare','hat','open','metal','clap']){
  const length={kick:.7,snare:.25,hat:.075,open:.36,metal:.35,clap:.2}[kind],b=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),a=b.getChannelData(0);
  let phase=0,prev=0,held=0,grit=0,lastSample=-1;
  for(let i=0;i<a.length;i++){
   const t=i/c.sampleRate,n=random(),hp=n-prev;prev=n;let v=0;
   if(kind==='kick'){phase+=2*Math.PI*(43+114*Math.exp(-t*39))/c.sampleRate;v=Math.tanh((Math.sin(phase)*Math.exp(-t*7.7)+hp*.13*Math.exp(-t*220))*1.95)*.73;}
   if(kind==='snare')v=hp*.28*Math.exp(-t*21)+Math.sin(t*2*Math.PI*179)*.45*Math.exp(-t*34)+Math.sin(t*2*Math.PI*337)*.11*Math.exp(-t*28);
   if(kind==='hat')v=hp*.32*Math.exp(-t*64);
   if(kind==='open')v=hp*.30*Math.exp(-t*15);
   if(kind==='metal')v=(Math.sin(t*2*Math.PI*817)*Math.sin(t*2*Math.PI*1337)+hp*.12)*Math.exp(-t*22)*.24;
   if(kind==='clap'){const envelope=Math.exp(-t*28)+(t>.012?Math.exp(-(t-.012)*48):0)+(t>.028?Math.exp(-(t-.028)*42):0);v=hp*envelope*.12;}
   // 18% of a 22.05 kHz / 10-bit sample, gently smoothed, not a full-mix crusher.
   const sample=Math.floor(t*22050);
   if(sample!==lastSample){held=Math.round(v*512)/512;lastSample=sample;}
   grit+=.6*(held-grit);a[i]=(v*.82+grit*.18)*Math.min(1,t*1900);
  }
  drums[kind]=b;
 }
 const noise=c.createBuffer(1,Math.ceil(c.sampleRate*4.73),c.sampleRate),crackles=c.createBuffer(1,noise.length,c.sampleRate);
 const noiseData=noise.getChannelData(0),crackleData=crackles.getChannelData(0);
 let burst=0,previousNoise=0;
 for(let i=0;i<noise.length;i++){
  const t=i/c.sampleRate,n=random(),edge=Math.min(1,t*100,(4.73-t)*100);
  noiseData[i]=n*edge;
  if(random()>.99986)burst=.2+Math.abs(n)*.8;
  crackleData[i]=(n-previousNoise)*burst*edge;burst*=Math.exp(-1/(c.sampleRate*.003));previousNoise=n;
 }
 let radioStarted=false,radioInput;
 function startRadio(){
  if(radioStarted)return;radioStarted=true;
  const high=c.createBiquadFilter(),low=c.createBiquadFilter(),notch=c.createBiquadFilter();
  high.type='highpass';high.frequency.value=780;low.type='lowpass';low.frequency.value=4900;notch.type='peaking';notch.frequency.value=2200;notch.Q.value=.65;notch.gain.value=-8;
  high.connect(low);low.connect(notch);notch.connect(radio);
  radioInput=high;
  for(const [buffer,level] of [[noise,.013],[crackles,.038]]){
   const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=level;source.connect(gain);gain.connect(high);source.start();
  }
 }
 function setRadio(level,t=c.currentTime,speaking=false,volume=1){
  if(level>0)startRadio();
  holdAt(radio.gain,t);radio.gain.setTargetAtTime(level*volume*(speaking?.58:1),t,.09);
 }
 function channelBurst(t){
  if(!radioStarted)return;
  const source=c.createBufferSource(),gain=c.createGain();source.buffer=noise;
  gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.027,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+.065);
  source.connect(gain);gain.connect(radioInput);source.start(t,.3);source.stop(t+.07);
  source.onended=()=>{source.disconnect();gain.disconnect();};
 }
 function whoosh(t,side=1){
  const source=c.createBufferSource(),high=c.createBiquadFilter(),low=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner(),send=c.createGain();
  source.buffer=noise;high.type='highpass';high.frequency.value=550;low.type='lowpass';low.Q.value=.65;
  low.frequency.setValueAtTime(1500,t);low.frequency.exponentialRampToValueAtTime(5200,t+.075);low.frequency.exponentialRampToValueAtTime(1100,t+.24);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.28,t+.06);gain.gain.linearRampToValueAtTime(.23,t+.11);gain.gain.exponentialRampToValueAtTime(.0001,t+.24);
  pan.pan.setValueAtTime(-side*.9,t);pan.pan.linearRampToValueAtTime(side*.95,t+.17);send.gain.value=.08;
  source.connect(high);high.connect(low);low.connect(gain);gain.connect(pan);pan.connect(fx);pan.connect(send);send.connect(fxHall);
  source.start(t,.9);source.stop(t+.25);
  source.onended=()=>{source.disconnect();high.disconnect();low.disconnect();gain.disconnect();pan.disconnect();send.disconnect();};scheduledNotes++;
 }
 const deathBuffers=new Map();let deathUntil=-Infinity;
 function setDeathVoice(speaking,t=c.currentTime){
  holdAt(deathBus.gain,t);deathBus.gain.setTargetAtTime(speaking?.34:.68,t,.04);
 }
 function death(cause,t){
  if(!Object.hasOwn(DEATH_LENGTHS,cause))cause='impact';
  const duration=DEATH_LENGTHS[cause];deathUntil=t+duration+.8;
  if(!deathBuffers.has(cause)){
   const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
   let seed=73013,phase=0,previous=0,low=0,clock=0,held=0;
   for(let i=0;i<data.length;i++){
    const time=i/c.sampleRate,x=time/duration;
    seed=Math.imul(seed,1664525)+1013904223|0;const n=(seed>>>0)/2147483648-1,hp=n-previous;previous=n;low+=.14*(n-low);
    let value=0;
    if(cause==='impact'){
     phase+=2*Math.PI*(38+70*Math.exp(-time*18))/c.sampleRate;
     const shatter=(hp*.2+Math.sin(time*2*Math.PI*823)*.16+Math.sin(time*2*Math.PI*1337)*.14)*Math.exp(-time*13);
     const fragments=Math.sin(time*2*Math.PI*(1523-time*120))*.14*Math.exp(-((time+.11)%.23)*48-time*2);
     value=(shatter+Math.sin(phase)*.58*Math.exp(-time*2.3)+fragments)*.48;
    }else if(cause==='laser'){
     const frame=Math.floor(time*24)/24;phase+=2*Math.PI*2400*Math.pow(.06,frame/duration)/c.sampleRate;
     clock+=(11000-7500*x)/c.sampleRate;
     if(clock>=1){clock-=1;held=Math.round((Math.sin(phase)*.68+n*.035)*32)/32;}
     value=held*.35*Math.sqrt(1-x)*(Math.sin(time*2*Math.PI*32)>0?1:.55);
    }else if(cause==='fall'){
     phase+=2*Math.PI*(45+470*Math.exp(-time*2.5))/c.sampleRate;
     const wind=(low*.52+hp*.06)*Math.sin(Math.min(1,time/.35)*Math.PI/2)*(1-x);
     const staticTail=Math.max(0,Math.min(1,(time-1.1)/.4));
     value=wind+Math.sin(phase)*.22*Math.exp(-time*1.2)+n*.21*staticTail;
    }else{
     // No hall send: the purge's final third of a second is genuinely silent.
     const swell=time<1.72?Math.pow(time/1.72,1.7):Math.max(0,1-(time-1.72)/.008);
     value=n*.4*swell;
    }
    data[i]=value*Math.min(1,time*180,(duration-time)*35);
   }
   deathBuffers.set(cause,buffer);
  }
  const source=c.createBufferSource(),high=c.createBiquadFilter(),low=c.createBiquadFilter(),notch=c.createBiquadFilter();
  source.buffer=deathBuffers.get(cause);high.type='highpass';high.frequency.value=cause==='impact'?52:cause==='purge'?900:120;
  low.type='lowpass';low.frequency.value=cause==='impact'?4600:3900;
  if(cause==='fall'){low.frequency.setValueAtTime(2200,t);low.frequency.exponentialRampToValueAtTime(420,t+.9);low.frequency.exponentialRampToValueAtTime(4600,t+1.55);}
  notch.type='peaking';notch.frequency.value=2000;notch.Q.value=.7;notch.gain.value=-6;
  source.connect(high);high.connect(low);low.connect(notch);notch.connect(deathBus);source.start(t);
  source.onended=()=>{source.disconnect();high.disconnect();low.disconnect();notch.disconnect();};scheduledNotes++;
 }
 const waves=new Float32Array(2048);
 for(let i=0;i<waves.length;i++){const x=i*2/(waves.length-1)-1;waves[i]=Math.tanh(x*2.3)/Math.tanh(2.3);}
 function sample(kind,t,amp=1,pan=0,rate=1,bus='music'){
  const source=c.createBufferSource(),gain=c.createGain(),panner=c.createStereoPanner();
  source.buffer=drums[kind];source.playbackRate.value=rate;gain.gain.value=amp;panner.pan.value=pan;
  source.connect(gain);gain.connect(panner);panner.connect(bus==='fx'?fx:music);if(kind!=='kick')panner.connect(bus==='fx'?fxHall:hall);
  source.start(t);source.onended=()=>{source.disconnect();gain.disconnect();panner.disconnect();};scheduledNotes++;
 }
 function synth(f,t,d,amp,type='sawtooth',cut=700,res=.7,pan=0,detune=0,send=0,bus='music',sustain=false){
  const os=c.createOscillator(),gain=c.createGain(),fil=c.createBiquadFilter(),panner=c.createStereoPanner();
  os.type=type;os.frequency.value=f;os.detune.value=detune;fil.type='lowpass';fil.Q.value=res;
  fil.frequency.setValueAtTime(Math.max(100,cut*1.45),t);fil.frequency.exponentialRampToValueAtTime(Math.max(70,cut*.30),t+d);
  gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(amp,t+(sustain?.045:.009));
  if(sustain)gain.gain.setValueAtTime(amp,t+d*.72);
  gain.gain.exponentialRampToValueAtTime(.0001,t+d);panner.pan.value=pan;
  os.connect(fil);fil.connect(gain);gain.connect(panner);panner.connect(bus==='fx'?fx:music);
  let tap;
  if(send){tap=c.createGain();tap.gain.value=send;panner.connect(tap);tap.connect(bus==='fx'?fxHall:hall);if(bus!=='fx')tap.connect(space);}
  os.start(t);os.stop(t+d+.04);os.onended=()=>{os.disconnect();fil.disconnect();gain.disconnect();panner.disconnect();tap?.disconnect();};scheduledNotes++;
 }
 function bass(f,t,d,amp,acid=false,energy=.5){
  const fil=c.createBiquadFilter(),shaper=c.createWaveShaper(),gain=c.createGain();
  fil.type='lowpass';fil.Q.value=acid?8:1.1;fil.frequency.setValueAtTime((acid?1500:650)*(1+energy),t);fil.frequency.exponentialRampToValueAtTime(acid?120:105,t+d);
  shaper.curve=waves;shaper.oversample='2x';gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(amp,t+.006);gain.gain.exponentialRampToValueAtTime(.0001,t+d);
  fil.connect(shaper);shaper.connect(gain);gain.connect(music);let count=0;
  for(const detune of [-9,9]){
   const os=c.createOscillator();os.type='sawtooth';os.frequency.value=f;os.detune.value=detune;os.connect(fil);os.start(t);os.stop(t+d+.025);
   os.onended=()=>{os.disconnect();if(++count===2){fil.disconnect();shaper.disconnect();gain.disconnect();}};
  }
  synth(f/2,t,d*1.1,amp*.58,'sine',220,.5);scheduledNotes+=2;
 }
 function tick(track,n,t,threat=false,pressure=.5,section=null){
  const P=TRACKS[trackIndex(track)],s=n%16,bar=Math.floor(n/16)%16,beat=60/P.bpm,root=P.key+P.chords[Math.floor(bar/4)];
  const breakdown=section==='sparse'||section==='decision'||(section===null&&(bar===8||bar===9)),drop=section==='drop'||(section===null&&bar>=10),full=section==='drive'||section==='drop'||(section===null&&bar>=2),velocity=breakdown?.54:1;
  const isKick=KICKS[P.beat].includes(s)&&(!breakdown||s===0);
  if(isKick)sample('kick',t,.92*velocity);
  if((P.beat==='half'?s===8:s===4||s===12)&&(!breakdown||bar===9)){sample('snare',t,.67*velocity);sample('clap',t+.013,.33*velocity,.17);}
  if(!breakdown){sample('hat',t,(s%2?.27:.47)*velocity,s%2?.32:-.26,1+(s%3)*.04);if(s%4===2)sample('open',t+.008,.28,.44);}
  if((P.beat==='jungle'||P.beat==='garage')&&(s===7||s===15))sample('snare',t,.17,-.22,1.13);
  if((drop||threat)&&(s===14||s===15)){sample('hat',t+beat/8,.22,-.48,1.2);if(bar%4===3)sample('snare',t+beat/8,.26,.3,1.12);}
  if(full&&s%3===2)sample('metal',t,.32,-.45+(s%4)*.26,1+trackIndex(track)*.018);
  const note=P.bass[(s+(bar%4===3?2:0))%16];
  if(note>=0&&(!breakdown||s%8===0))bass(midi(root+note),t,beat*(P.beat==='half'?.95:.64),isKick?.084:.17,P.beat==='acid',pressure+(drop?.5:0));
  if(s===0)[0,3,7,10].forEach((v,i)=>synth(midi(root+24+v),t+i*.007,beat*3.8,breakdown?.033:.016,'sawtooth',breakdown?1200:640,.65,(i-1.5)*.4,i%2?-5:5,.7));
  if(full&&(s%2===0||threat)&&(!breakdown||s%4===0)){const a=P.arp[(Math.floor(s/2)+bar%2*3)%8];synth(midi(root+36+a),t,beat*.44,drop?.035:.023,'triangle',1900+(drop?1100:0),1,(s/8-1)*.65,0,.65);}
  if(threat&&s===0){synth(midi(root+19),t,beat*1.7,.035,'sawtooth',1700,1,-.5,-7,.6);synth(midi(root+26),t+beat*1.5,beat*1.2,.026,'sawtooth',900,1,.5,9,.6);}
  if(bar%4===3&&s>=14)sample('metal',t,.28+(s-14)*.1,s===14?-.6:.6,.78);
 }
 let lastStinger=-Infinity;
 function stinger(t){
  // Both a core defeat event and the arrangement transition can request this cue.
  if(Math.abs(t-lastStinger)<.75)return;lastStinger=t;
  sample('kick',t,.68,0,.82,'fx');sample('metal',t,.52,-.2,.65,'fx');
  [50,57,62,69,74].forEach((pitch,i)=>synth(midi(pitch),t+i*.075,1.6-i*.16,.105,'triangle',2500,.6,(i-2)*.18,0,.65,'fx'));
 }
 function bossTick(b,n,t){
  const track=BOSS_TRACKS[b.id],P=TRACKS[track],s=n%16,bar=Math.floor(n/16),beat=60/P.bpm;
  const root=P.key+P.chords[Math.floor(bar/4)%4],phase=b.phase,pressure=Math.min(1,.22+phase*.24+(1-b.hpFrac)*.36);
  const approach=b.state==='approach',stagger=b.state==='stagger',calm=b.state==='defeated',cold=b.id==='exit-condition'&&phase>=2;
  if(calm&&n===0)stinger(t);
  if(stagger||calm){
   // Hold the harmony while the drums fall away; no loudness jump at a checkpoint.
   if(s%8===0){
    synth(midi(root),t,beat*2.4,.44,'triangle',420,.6,0,0,.1,'music',true);
    [0,7,calm?14:6].forEach((v,i)=>synth(midi(root+24+v),t+i*.014,beat*2.5,.17,calm?'triangle':'sawtooth',calm?1200:1000,.6,(i-1)*.42,i===1?-9:9,.45,'music',true));
   }
   if(s===0)sample('kick',t,calm?.26:.4);
   if(s===12)synth(midi(root+43),t,beat*1.5,.06,'sine',2800,.5,.4,cold?17:0,.7);
   return;
  }
  const build=approach?Math.min(1,bar/8):1,kit=approach?.63+build*.15:cold?.81:.96;
  const isKick=approach?(s===0||s===8||(build>.6&&KICKS[P.beat].includes(s))):KICKS[P.beat].includes(s);
  if(isKick)sample('kick',t,.92*kit);
  if((s===4||s===12)&&(!approach||s===12)){sample('snare',t,.64*kit);if(!cold)sample('clap',t+.013,.25*kit,.2);}
  if(s%(approach?2:1)===0)sample('hat',t,(s%2?.23:.4)*kit,s%2?.35:-.3,cold?1.2:1);
  if(!approach&&s%4===2&&!cold)sample('open',t,.23,.4);
  const note=P.bass[(s+(bar%4===3?2:0))%16];
  if(note>=0&&(!approach||s%4===0)){
   if(cold){synth(midi(root+note),t,beat*.9,isKick?.15:.27,'triangle',840,.6,-.08,-13);synth(midi(root+note),t,beat*.8,.08,'sine',1000,.5,.18,17);}
   else bass(midi(root+note),t,beat*(approach?1.1:.65),approach?.22:isKick?.08:.16,false,pressure);
  }
  if(s===0){
   if(approach)synth(midi(root),t,beat*3.9,.3,'triangle',420,.6,0,0,.1,'music',true);
   [0,3,7,10].forEach((v,i)=>synth(midi(root+24+v),t+i*.008,beat*3.8,approach?.1:cold?.038:.022,cold?'sine':'sawtooth',cold?3900:approach?900+build*500:850,.6,(i-1.5)*.4,cold?(i%2?-19:17):(i%2?-5:5),.65,'music',approach));
  }
  const pulse=approach?4:pressure>.65?1:2;
  if(s%pulse===0){
   const a=P.arp[(Math.floor(s/2)+bar%2*3)%8];
   if(b.id==='watchdog')synth(midi(root+24+a),t,beat*.32,.038,'square',1050+pressure*1400,.8,(s%4-1.5)*.3,s%2?-5:5,.3);
   else if(b.id==='reset-storm'){
    synth(midi(root+36+a),t+(phase===1&&s%3===0?beat*.14:0),beat*.42,.042,'sawtooth',1200+pressure*1900,1.6,s%2?-.5:.5,s%2?-11:11,.45);
    if(!approach&&s%3===2)sample('metal',t+beat*.125,.26,s%2?-.6:.6,.72+phase*.18);
   }else{
    synth(midi(root+36+a+(cold&&s%4===2?1:0)),t,beat*(cold?1.1:.5),cold?.073:.046,cold?'sine':'triangle',cold?5700:2900,.6,s%2?-.45:.45,cold?(s%2?-23:19):0,cold?.85:.5);
   }
  }
  if(!approach&&pressure>.52&&(s===7||s===15)){sample(cold?'metal':'snare',t+beat*.125,cold?.2:.24,-.3,1.12);if(phase>=2&&!cold)sample('hat',t+beat*.18,.18,.5,1.4);}
 }
 return {input,music,fx,tick,bossTick,synth,sample,stinger,setRadio,channelBurst,warning,whoosh,death,setDeathVoice,get deathUntil(){return deathUntil;}};
}

function playEffect(r,type,t,n=0,mult=1){
 const tone=(pitch,offset=0,d=.14,amp=.06,wave='triangle',cut=2100,pan=0,detune=0,send=.25)=>r.synth(midi(pitch),t+offset,d,amp,wave,cut,.7,pan,detune,send,'fx');
 const drum=(kind,amp,offset=0,rate=1,pan=0)=>r.sample(kind,t+offset,amp,pan,rate,'fx');
 switch(type){
  case 'clear':tone(69,0,.1,.028);tone(81,.032,.17,.018);break;
  case 'land':drum('kick',Math.min(.13,.025+n*.004));break;
  case 'collect':tone([74,77,81,84,86][n%5]+(rewardTier(mult)-1)*.35,0,.12,.035);break;
  case 'hit':drum('snare',.55);r.synth(47,t,.26,.18,'sawtooth',500,.7,0,0,0,'fx');break;
  case 'jump':tone(57,0,.12,.05);break;
  case 'slide':drum('open',.18);break;
  case 'tick':tone(74,0,.04,.022);break;
  case 'fail':if(t>=r.deathUntil)[45,44,38].forEach((v,i)=>tone(v,i*.15,.5,.09));break;
  case 'boost':r.synth(62,t,.45,.10,'sawtooth',1300,4,0,0,0,'fx');drum('metal',.5);break;
  // Two short bright pulses plus a separate music notch, never a voice mute.
  case 'telegraph':r.warning(t);tone(88,0,.115,.19,'square',3600);tone(94,.16,.15,.17,'square',3900);break;
  case 'reflect':drum('metal',.75,0,1.55);tone(74,0,.09,.13);tone(86,.04,.17,.17);tone(93,.085,.32,.12,'sine',4800,.2,0,.6);drum('kick',.4);break;
  case 'bossHit':drum('kick',.68,0,.78);drum('metal',.68,.025,.7,-.2);tone(42,0,.3,.2,'sawtooth',780);tone(54,.045,.18,.1);break;
  case 'bossPhase':[74,68,62].forEach((v,i)=>tone(v,i*.09,.4,.12,'square',1700,(i-1)*.3));drum('open',.28,.08,.7);break;
  case 'bossDefeated':r.stinger(t);break;
  case 'purge':[62,61,49,37].forEach((v,i)=>tone(v,i*.12,.55,.16,'sawtooth',1700-i*330,0,i%2?-13:13));drum('snare',.65);drum('kick',.8,.24,.65);break;
  case 'bolt':tone(95,0,.045,.11,'sawtooth',4400);tone(62,.035,.14,.12,'square',1200);drum('metal',.36,0,1.8);break;
  case 'beam':tone(71,0,.36,.13,'sawtooth',2900,-.2,-9);tone(72,.045,.3,.08,'sawtooth',2300,.2,9);drum('open',.22);break;
  case 'shock':drum('kick',.62,0,.7);drum('clap',.6,.025,.75);[38,50,62].forEach((v,i)=>tone(v,i*.025,.2,.1,'square',1100));break;
  case 'menuMove':tone(86,0,.045,.08,'sine',5200,0,0,.1);tone(98,.015,.055,.035,'triangle',5600,0,0,.1);break;
  case 'menuSelect':tone(81,0,.06,.09,'triangle',4400);tone(88,.045,.08,.085);tone(93,.075,.16,.065,'sine',5200);break;
  case 'nearMiss':r.whoosh(t,n<0?-1:1);break;
  case 'perfect':tone(74,0,.10,.075);tone(81,.04,.14,.07);tone(86,.085,.3,.085,'sine',4900,.12,0,.4);break;
  case 'chainTier':{
   const root=[62,64,65,67,69,71,74,77][rewardTier(n)-1];
   [0,7,12,16].forEach((v,i)=>tone(root+v,i*.05,i===3?.35:.17,.06+i*.006,i===3?'sine':'triangle',4600,(i-1.5)*.15,0,.3));
   break;
  }
  case 'chainBreak':drum('metal',.26,0,.42);drum('kick',.15,0,.8);tone(45,0,.28,.12,'sine',1100);tone(62,.016,.24,.06,'triangle',2000,-.25,23,.3);break;
  // Dry, low-level and shorter than a 30 Hz roll-up interval: no reverb build-up.
  case 'tally':tone(86,0,.022,.027,'sine',4200,0,0,0);break;
  case 'levelUp':
   [62,69,74,78,81,86].forEach((v,i)=>tone(v,i*.045,i===5?.45:.15,.065,'triangle',3800,(i-2.5)*.1,0,.35));
   [74,78,81].forEach((v,i)=>tone(v,.29,.46,.04,'sine',4400,(i-1)*.25,0,.4));break;
  case 'unlock':[86,93,98,105].forEach((v,i)=>tone(v,i*.045,.33,.045-i*.006,'sine',6500,i%2?.55:-.55,i%2?5:-5,.55));break;
  case 'achievement':
   [74,81,78,86,83,81].forEach((v,i)=>tone(v,[0,.15,.30,.525,.70,.875][i],.25,.065,'triangle',4200,i%2?.18:-.18,0,.25));
   [74,78,81,86].forEach((v,i)=>r.synth(midi(v),t+1.03,.47,.036,'triangle',4600,.7,(i-1.5)*.23,0,.3,'fx',true));break;
  case 'ticket':tone(81,0,.042,.065,'sine',4200,0,0,.08);tone(74,.04,.07,.04,'triangle',2900,0,0,.08);break;
  case 'shard':
   tone(74,0,.9,.07,'sine',4700,-.4,-18,.8);tone(86,.055,1.1,.045,'sine',5100,.4,17,.8);
   tone(93,.19,.65,.034,'sine',6000,.5,27,.65);tone(71,.25,.75,.03,'triangle',2000,-.2,-9,.7);break;
  case 'demo':drum('metal',.2,0,1.25);[50,57,62].forEach((v,i)=>tone(v,i*.1,.22,.07,'square',1000,0,0,.25));tone(74,.31,.42,.065,'sine',3500,.2,0,.45);tone(73,.35,.35,.02,'sine',3500,-.25,11,.45);break;
  case 'death':r.death(n,t);break;
  // Only these legacy cues share the original arpeggio. Typos are silent.
  case 'start':case 'win':case 'new':case 'checkpoint':[50,57,62,65].forEach((v,i)=>tone(v,i*.08,.3,.06));break;
  default:return;
 }
}
function resolveBoss(value){
 if(!value||!Object.hasOwn(BOSS_TRACKS,value.id))return null;
 return {id:value.id,state:value.state,phase:Math.max(0,Math.min(value.id==='watchdog'?1:2,Math.trunc(value.phase)||0)),hpFrac:clamp01(value.hpFrac)};
}
// Adaptive state changes preserve the tempo grid; HP changes never restart it.
function setBoss(value){
 const previous=boss;boss=resolveBoss(value);
 if(previous?.id!==boss?.id||previous?.state!==boss?.state||previous?.phase!==boss?.phase){
  step=0;if(ctx)next=Math.max(next,ctx.currentTime+.035);
 }
}
function channelTreatment(){
 if(!ctx)return;
 const t=ctx.currentTime;
 rig.setRadio(staticLevel,t,!!voiceSource,settings.voice);
 rig.setDeathVoice(!!voiceSource,t);
 holdAt(voiceHigh.frequency,t);voiceHigh.frequency.setTargetAtTime(75+staticLevel*85,t,.12);
 holdAt(voiceLow.frequency,t);voiceLow.frequency.setTargetAtTime(11000-staticLevel*4700,t,.12);
}
// PHASEONE's presentation owns this level, including the deliberately clean lies.
function setStatic(value){
 const level=clamp01(value);if(level===staticLevel)return;staticLevel=level;channelTreatment();
}
// Restore on the audio clock, even when rendering pauses or the tab is hidden.
function setVoiceDropout(value){
 if(!voiceDrop||!ctx)return;
 const t=ctx.currentTime;if(value&&t<voiceDropUntil)return;
 voiceDropUntil=value?t+.28:0;holdAt(voiceDrop.gain,t);
 voiceDrop.gain.linearRampToValueAtTime(value?.2:1,t+.008);
 if(value){voiceDrop.gain.setValueAtTime(.2,t+.20);voiceDrop.gain.linearRampToValueAtTime(1,voiceDropUntil);}
}
function voiceElapsed(info=voiceInfo){
 return info?Math.min(info.duration||0,info.offset+(info.state==='playing'||info.state==='fading'?Math.max(0,ctx.currentTime-info.start):0)):0;
}
function voiceTiming(){
 return voiceInfo?{id:voiceInfo.id,duration:voiceInfo.duration,elapsed:voiceElapsed(),state:voiceInfo.state,reason:voiceInfo.reason||null}:null;
}
function pauseVoice(){
 if(!voiceInfo||!['loading','playing'].includes(voiceInfo.state))return;
 voiceInfo.offset=voiceElapsed();voiceInfo.state='paused';
 if(voiceSource){voiceSource.playbackRate.setValueAtTime(0,ctx.currentTime);holdAt(voiceEnvelope.gain,ctx.currentTime);voiceEnvelope.gain.linearRampToValueAtTime(0,ctx.currentTime+.008);}
}
function resumeVoice(){
 if(voiceInfo?.state!=='paused')return;
 voiceInfo.start=ctx.currentTime;
 if(voiceSource){voiceInfo.state='playing';voiceSource.playbackRate.setValueAtTime(1,ctx.currentTime);holdAt(voiceEnvelope.gain,ctx.currentTime);voiceEnvelope.gain.linearRampToValueAtTime(1,ctx.currentTime+.008);}
 else if(voiceInfo.buffer)startVoice(voiceInfo);
 else voiceInfo.state='loading';
}
function init(){
 if(ctx){if(ctx.state==='suspended')ctx.resume().catch(()=>{});return;}
 if(audioUnavailable)return;
 try{
  ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=on?.88:0;
  meter=ctx.createAnalyser();meter.fftSize=512;master.connect(meter);meter.connect(ctx.destination);rig=makeRig(ctx,master);
  voiceBus=ctx.createGain();voiceBus.gain.value=settings.voice;voiceHigh=ctx.createBiquadFilter();voiceLow=ctx.createBiquadFilter();
  voiceHigh.type='highpass';voiceHigh.frequency.value=75;voiceLow.type='lowpass';voiceLow.frequency.value=11000;
  voiceAnalyser=ctx.createAnalyser();voiceAnalyser.fftSize=256;voiceDrop=ctx.createGain();voiceEnvelope=ctx.createGain();
  voiceEnvelope.connect(voiceBus);voiceBus.connect(voiceHigh);voiceHigh.connect(voiceLow);voiceLow.connect(voiceDrop);voiceDrop.connect(voiceAnalyser);voiceAnalyser.connect(rig.input);
  setInterval(schedule,25);ctx.resume().catch(()=>{});setLevels(settings);channelTreatment();
 }catch(e){
  // Run silent rather than leave a half-built graph that throws on every later call.
  audioUnavailable=true;try{ctx?.close();}catch{}ctx=null;rig=null;voiceDrop=null;console.warn('Audio unavailable; continuing without sound.',e);
 }
}
function schedule(){
 if(!ctx||!on||(!active&&!briefing)){if(ctx)next=ctx.currentTime+.07;return;}
 if(next<ctx.currentTime)next=ctx.currentTime+.04;
 while(next<ctx.currentTime+.15){
  if(briefing&&!active){
   if(step%16===0){rig.synth(midi(26),next,2.8,.065,'sawtooth',220,.5,-.4,-6,.8);rig.synth(midi(33),next,2.7,.035,'triangle',420,.5,.4,4,.7);}
   if(step%8===0)rig.sample('kick',next,.19);next+=60/84/4;
  }else{
   if(boss)rig.bossTick(boss,step,next);else rig.tick(zone,step,next,chase,intensity,section);
   next+=60/TRACKS[boss?BOSS_TRACKS[boss.id]:zone].bpm/4;
  }
  step++;
 }
}
// n is combo for collect, tier (1..8) for chainTier, direction for nearMiss, cause for death.
function effect(type,n=0,mult=1){if(ctx&&on)playEffect(rig,type,ctx.currentTime,n,mult);}
function stopVoice(reason='skip',fade=0){
 if(!voiceInfo||voiceInfo.state==='ended'||voiceInfo.state==='fading'&&fade>0)return;
 voiceSerial++;setVoiceDropout(false);
 const t=ctx.currentTime;
 if(voiceSource&&fade>0){
  voiceInfo.offset=voiceElapsed();voiceInfo.start=t;voiceInfo.state='fading';voiceInfo.reason=reason;
  const end=t+Math.min(.25,fade);holdAt(voiceInfo.gain.gain,t);voiceInfo.gain.gain.linearRampToValueAtTime(0,end);voiceSource.stop(end);return;
 }
 voiceInfo.offset=voiceElapsed();voiceInfo.state='ended';voiceInfo.reason=reason;
 // Even an immediate stop ramps out over 12 ms: stopping a waveform mid-cycle clicks.
 if(voiceSource){const source=voiceSource,gain=voiceInfo.gain;voiceSource=null;holdAt(gain.gain,t);gain.gain.linearRampToValueAtTime(0,t+.012);source.stop(t+.012);}
 if(rig&&ctx){rig.music.gain.setTargetAtTime(settings.music,t,.22);channelTreatment();}
}
function startVoice(info){
 // Each line has its own gain, so a skipped line can fade while the next one starts clean.
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=info.buffer;source.connect(gain);gain.connect(voiceEnvelope);voiceSource=source;info.gain=gain;
 info.start=ctx.currentTime;info.state='playing';
 voiceEnvelope.gain.cancelScheduledValues(ctx.currentTime);voiceEnvelope.gain.setValueAtTime(1,ctx.currentTime);
 rig.music.gain.setTargetAtTime(settings.music*.24,ctx.currentTime,.07);channelTreatment();
 // A perfectly clean channel is intentional: PHASEONE is lying.
 if(staticLevel>0)rig.channelBurst(ctx.currentTime);
 source.onended=()=>{
  source.disconnect();gain.disconnect();if(voiceSource!==source)return;
  info.offset=info.state==='fading'?voiceElapsed(info):info.duration;info.state='ended';info.reason||='natural';voiceSource=null;
  rig.music.gain.setTargetAtTime(settings.music,ctx.currentTime,.28);channelTreatment();
 };
 source.start();voicePlays++;
}
async function say(id){
 // Presentation owns the priority/TTL queue. Never cancel a live or decoding line.
 if(voiceInfo&&voiceInfo.state!=='ended')return false;
 const data=PHASE_VOICE_DATA[id];
 if(!ctx||!on||!voiceEnabled||!data){voiceInfo=null;return false;}
 const serial=++voiceSerial,info=voiceInfo={id,duration:0,offset:0,start:ctx.currentTime,state:'loading',buffer:null};
 try{
  if(!decoded.has(id)){const bytes=Uint8Array.from(atob(data),x=>x.charCodeAt(0));decoded.set(id,ctx.decodeAudioData(bytes.buffer));}
  const buffer=await decoded.get(id);if(serial!==voiceSerial||voiceInfo!==info||!on||!voiceEnabled)return false;
  info.buffer=buffer;info.duration=buffer.duration;if(info.state!=='paused')startVoice(info);return true;
 }catch(e){decoded.delete(id);if(voiceInfo===info){info.state='ended';info.reason='unavailable';}console.warn('Voice unavailable; subtitles remain.',e);return false;}
}
function level(analyser){
 if(!analyser)return 0;
 let data=meterData.get(analyser);if(!data){data=new Float32Array(analyser.fftSize);meterData.set(analyser,data);}
 analyser.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;return Math.sqrt(sum/data.length);
}
function setLevels(values){
 for(const key of ['music','effects','voice'])if(Number.isFinite(values[key]))settings[key]=clamp01(values[key]);
 if(rig){
  rig.music.gain.setTargetAtTime(settings.music*(voiceSource?.24:1),ctx.currentTime,.1);
  rig.fx.gain.setTargetAtTime(settings.effects,ctx.currentTime,.04);voiceBus.gain.setTargetAtTime(settings.voice,ctx.currentTime,.04);channelTreatment();
 }
}
async function renderTrack(index,bars=16,bossState=null){
 const b=resolveBoss(bossState),track=b?BOSS_TRACKS[b.id]:trackIndex(index),P=TRACKS[track],duration=bars*4*60/P.bpm+2;
 const c=new OfflineAudioContext(2,Math.ceil(duration*32000),32000),r=makeRig(c,c.destination);
 for(let n=0;n<bars*16;n++){
  const t=.05+n*60/P.bpm/4;
  if(b)r.bossTick(b,n,t);else r.tick(track,n,t,bars>8&&n>bars*8,.6);
 }
 return c.startRendering();
}
// The optional n/mult arguments mirror effect(), including multiplier-pitched collect.
async function renderEffect(name,duration=2.5,n=0,mult=1){
 const c=new OfflineAudioContext(2,Math.ceil(duration*32000),32000),r=makeRig(c,c.destination);
 playEffect(r,name,.05,n,mult);return c.startRendering();
}
// Cues retain stage/section/chase; boss:null returns to the sector arrangement.
// Example: {at:0,stage:11,boss:{id:'exit-condition',state:'active',phase:2,hpFrac:.2}}.
async function renderSequence(duration,cues){
 const c=new OfflineAudioContext(2,Math.ceil((duration+.1)*32000),32000),r=makeRig(c,c.destination);
 let t=.02,n=0,idx=0,track=0,b=null,currentSection=null,threat=false,pressure=.7;
 while(t<duration){
  while(idx<cues.length&&cues[idx].at<=t){
   const q=cues[idx++];
   if(q.stage!==undefined&&track!==trackIndex(q.stage)){track=trackIndex(q.stage);n=0;}
   if(Object.hasOwn(q,'section')){if(q.section==='drop'&&currentSection!=='drop')n=Math.ceil(n/16)*16;currentSection=q.section;}
   if(Object.hasOwn(q,'boss')){
    const value=resolveBoss(q.boss);
    if(value?.id!==b?.id||value?.state!==b?.state||value?.phase!==b?.phase)n=0;
    b=value;
   }
   if(q.chase!==undefined)threat=q.chase;
   if(q.intensity!==undefined)pressure=clamp01(q.intensity);
   if(q.static!==undefined)r.setRadio(clamp01(q.static),Math.max(.02,q.at));
   for(const name of q.effects||[])playEffect(r,name,Math.max(.02,q.at));
  }
  if(b)r.bossTick(b,n++,t);else r.tick(track,n++,t,threat,pressure,currentSection);
  t+=60/TRACKS[b?BOSS_TRACKS[b.id]:track].bpm/4;
 }
 return c.startRendering();
}
return {
 init,effect,hasEffect,say,stopVoice,pauseVoice,resumeVoice,setBoss,setStatic,voiceTiming,setVoiceDropout,tracks:TRACKS,setLevels,renderTrack,renderSequence,renderEffect,
 setSection:value=>{
  const v=['sparse','decision','drive','drop'].includes(value)?value:null;
  if(v!==section){section=v;if(v==='drop'&&!boss)step=Math.ceil(step/16)*16;}
 },
 setIntensity:value=>{intensity=clamp01(value);},
 setActive:value=>{if(active!==value&&ctx)next=Math.max(next,ctx.currentTime+.055);active=value;},
 setBriefing:value=>{if(briefing!==value){briefing=value;step=0;if(ctx)next=Math.max(next,ctx.currentTime+.055);}},
 setZone:(value,threat)=>{const index=trackIndex(value);if(index!==zone){zone=index;step=0;if(ctx)next=Math.max(next,ctx.currentTime+.055);}chase=threat;},
 setOn:value=>{on=value;if(!value)stopVoice('sound-off');if(master)master.gain.setTargetAtTime(value?.88:0,ctx.currentTime,.08);},
 setVoice:value=>{voiceEnabled=value;if(!value)stopVoice('voice-off');},
 get on(){return on;},
 get voiceEnabled(){return voiceEnabled;},
 get voiceDropout(){return !!ctx&&ctx.currentTime<voiceDropUntil;},
 get speaking(){return !!voiceInfo&&voiceInfo.state!=='ended';},
 voiceLevel:()=>Math.min(1,level(voiceAnalyser)*5),
 get diagnostics(){
  const track=boss?BOSS_TRACKS[boss.id]:zone;
  return {state:ctx?.state||'not-initialized',on,active,briefing,voiceEnabled,voiceDropout:!!ctx&&ctx.currentTime<voiceDropUntil,voiceGain:voiceDrop?.gain.value??1,scheduledNotes,voicePlays,rms:level(meter),zone,chase,section,boss:boss?{...boss}:null,static:staticLevel,track:TRACKS[track].name,bpm:TRACKS[track].bpm,settings:{...settings}};
 }
};
})();
