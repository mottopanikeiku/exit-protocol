// PHASEONE speaks through this channel: the codec portrait, the radio thumbnail and the terminal in the building.
const relayFrame=new Builder();
for(const side of [-1,1]){relayFrame.box(side*1.55,.52,-.72,.014,3.2,.018,0x326d68);relayFrame.box(side*1.55,2.12,-.72,.24,.016,.019,0x6fffe9);}
worldTerminal.add(new Node(renderer.mesh(relayFrame),0xffffff,2));
const relayName=textNode(labelTexture('PHASEONE[big]','140.07 / UNLISTED CHANNEL','#061916','#6fffe9'),0,-1.12,-.38,3.2,.48);worldTerminal.add(relayName);
const channelStrands=[];
for(let j=0;j<5;j++){
 const b=new Builder();
 for(let i=0;i<64;i++){
  const point=t=>[-23+t*50,13+j*.045+Math.sin(t*8.8)*(1+.12*Math.sin(t*11+j*.18)),-93+Math.sin(t*5)*.8];
  const p=point(i/64),q=point((i+1)/64);b.quad(p,q,[q[0],q[1]+.016,q[2]],[p[0],p[1]+.016,p[2]],0x6fffe9);
 }
 channelStrands.push(new Node(renderer.mesh(b),0xffffff,2));
}
let portraitRenderer=null,portraitHead=null,portraitError=null;
try{
 portraitRenderer=new Renderer($('phase-face'));portraitHead=createPhaseHead(portraitRenderer);
 portraitRenderer.skyTop=rgb(0x02090e);portraitRenderer.fog=rgb(0x051415);portraitRenderer.fogNear=20;portraitRenderer.fogFar=90;
 portraitRenderer.setStyle?.({preset:save.display==='cinema'?'cinema':'retro',lines:save.displayLines,reducedMotion:reduced});
}catch(e){portraitError=String(e);$('phase-face').insertAdjacentHTML('afterend','<div class="portrait-fallback">PHASEONE<br><b>[big]</b><span>VISUAL FEED UNAVAILABLE</span></div>');}
const phaseGaze={x:0,y:0};
phasePanel.addEventListener('pointermove',e=>{const r=phasePanel.getBoundingClientRect();phaseGaze.x=clamp((e.clientX-r.left)/r.width-.5,-.5,.5);phaseGaze.y=clamp((e.clientY-r.top)/r.height-.5,-.5,.5);});
phasePanel.addEventListener('pointerleave',()=>{phaseGaze.x=phaseGaze.y=0;});
function phaseAmplitude(){return Sound.voiceLevel?.()||0;}
const phaseAppearance={mood:'calm',act:0,corruption:0,reveal:0,static:0};
let phaseAppearanceTest=null;
function animatePhase(head,t,speaking=false){
 const effect=PHASE_EFFECTS[phaseState.id]||phaseState.mood;
 phaseAppearance.mood=effect==='clean'?'lying':effect==='glitch'||phaseState.glitch?'glitch':'calm';
 phaseAppearance.act=clamp(Math.floor((game.stage||0)/4),0,2);phaseAppearance.corruption=game.gifts?.length||0;
 // More eyes open under the hood on the first glimpse, and the hood slips back in act III.
 phaseAppearance.reveal=phaseState.id==='veil_glimpse'?.22:phaseState.id==='veil_torn'?.55:0;phaseAppearance.static=phaseState.staticLevel;
 const opts=head===portraitHead&&phaseAppearanceTest?phaseAppearanceTest:phaseAppearance;
 Veil.expression(head,t,speaking,speaking?phaseAmplitude():0,effect==='guarded',reduced?0:1,phaseGaze,opts);
}
function drawWorldSignals(){
 const title=status==='title'||status==='briefing',level=phaseAmplitude(),transmitting=Sound.speaking&&phaseState.active&&PHASE_LINES[phaseState.id]?.speaker==='P1';
 worldHead.presentation='radio';
 if(worldTerminal.visible&&(title||phaseState.active))animatePhase(worldHead,now,transmitting);
 if(title)worldTerminal.at(innerWidth<760?2.3:4.35,innerWidth<760?7.4:7.75,-14).rot(0,-.20,0).scale(innerWidth<760?2.2:2.85);
 else{const side=game.stage%2?-1:1;worldTerminal.at(side*9.2,13.8,-68).rot(0,-side*.22,0).scale(4.2);}
 relayName.alpha=transmitting?.6+level*.4:.28;
 if(title||phaseState.active)renderer.node(worldTerminal);
 for(const [j,strand] of channelStrands.entries()){
  strand.alpha=transmitting?.18+level*.7:.045;strand.y=reduced?0:Math.sin(now*.48+j*.1)*.22;strand.z=title?65:0;
  renderer.node(strand);
 }
}
let portraitWidth=0,portraitHeight=0;
function phaseRender(){
 if(!portraitRenderer||!phaseState.active)return;
 const rect=$('phase-face').getBoundingClientRect();if(rect.width<2||rect.height<2)return;
 const w=Math.round(rect.width),h=Math.round(rect.height);
 if(w!==portraitWidth||h!==portraitHeight){portraitRenderer.resize(w,h);portraitWidth=w;portraitHeight=h;}
 const compact=!phaseState.full,aspect=rect.width/rect.height;
 portraitHead.presentation=compact?'radio':'portrait';
 portraitRenderer.time=now;animatePhase(portraitHead,now,Sound.speaking);portraitHead.root.at(0,0,0);
 // Hood to chest in the codec; the radio thumbnail keeps the hood and its eyes readable at 54 px.
 const height=Math.max(compact?3.12:4.2,(compact?2.45:3.4)/aspect),z=height/(2*Math.tan(39*Math.PI/360));
 portraitRenderer.startFrame();portraitRenderer.begin([.06,compact?.3:.1,z],[0,compact?.25:.05,0],39);portraitRenderer.node(portraitHead.root);portraitRenderer.finishFrame(.55);
 const level=phaseAmplitude();
 for(const [i,bar] of phaseWave.entries())bar.style.height=(3+(reduced?level*12:level*(6+Math.abs(Math.sin(now*16+i*1.9))*18)))+'px';
 $('phase-signal').textContent=phaseState.glitch?'SIGNAL LOST':phaseState.mood==='clean'?'PERFECT SIGNAL':Sound.speaking?'TRANSMITTING':'LINK ESTABLISHED';
}
// Visual-only posing for repeatable captures; never writes campaign state.
if(new URLSearchParams(location.search).get('test')==='1')window.__veil={
 pose:opts=>{phaseAppearanceTest=opts?{mood:'calm',act:0,corruption:0,reveal:0,static:0,...opts}:null;if(portraitHead)portraitHead.lastUpdate=-Infinity;phaseRender();},
 state:()=>({rig:portraitHead?.rig,portrait:{...portraitHead?.anatomy},projection:cinemaHead?{...cinemaHead.anatomy}:null,error:portraitError,gl:portraitRenderer?.gl.getError(),worldGL:renderer.gl.getError(),draws:portraitRenderer?.drawCalls,vertices:portraitRenderer?.vertexCount})
};

