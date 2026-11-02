/* EXIT PROTOCOL: streamed, texture-batched infrastructure. Floor cuts use the
   same coordinates as the deterministic collider; set dressing stays outside it. */
const artGapCache=new Map(),artPalette=[
 {sky:0x02040b,fog:0x101b2e,stone:0x242a38,edge:0xffbf62},
 {sky:0x03040b,fog:0x141b2c,stone:0x242b35,edge:0xf0b568},
 {sky:0x03040e,fog:0x111b33,stone:0x252a39,edge:0xf9bc66},
 {sky:0x080309,fog:0x21172b,stone:0x302431,edge:0xe9a953},
 {sky:0x05040a,fog:0x1b1a2b,stone:0x302c30,edge:0xffbb5a},
 {sky:0x02060e,fog:0x102030,stone:0x202c39,edge:0xf5bf76},
 {sky:0x02030b,fog:0x131c34,stone:0x202635,edge:0xffbd5c},
 {sky:0x02030c,fog:0x141b35,stone:0x262938,edge:0xffc568},
 {sky:0x06030e,fog:0x201632,stone:0x292337,edge:0xf4b969},
 {sky:0x09040a,fog:0x22182e,stone:0x32252d,edge:0xffaf53},
 {sky:0x010209,fog:0x090e1f,stone:0x1b2130,edge:0xd99c44},
 {sky:0x02040d,fog:0x131d36,stone:0x242c3b,edge:0xffc364}
];
function gapsFor(stage){const key=game.seed+':'+stage+':'+(game.route||-1);let g=artGapCache.get(key);if(!g){g=EscapeBenchCore.generateEntities(game.seed,Math.max(0,stage)).filter(e=>e.type==='gap'&&(!e.branch||e.branch===(game.route||-1)));artGapCache.set(key,g);if(artGapCache.size>8)artGapCache.delete(artGapCache.keys().next().value);}return g;}
let liveWorldGaps=[];
function liveGapSignature(index){let key='';const d=index*36;for(const e of liveWorldGaps)if(e.d+3.15>d&&e.d-3.15<d+36)key+=e.id+':'+e.d+':'+e.lane+';';return key;}
function makeBlock(index){
 const stage=Math.max(0,EscapeBenchCore.stageAt(index*36)),zi=stage%12,A=artPalette[zi],d0=index*36;
 const b=new Builder(),glow=new Builder(),extras=[],surfaces=new Map(),kinetics=[],gaps=gapsFor(stage).concat(liveWorldGaps);
 const surface=name=>{if(!surfaces.has(name))surfaces.set(name,new Builder());return surfaces.get(name);};
 const local=d0-EscapeBenchCore.stageStart(stage),vr=zi===0&&local<204,relay=zi===0&&local>=252&&local<540,enclosed=zi!==6&&zi!==7;
 const floorName=vr?'vr-grid':['floor-panel','raised-floor','perforated-tile','steel-plate','concrete','grate','concrete','grate','raised-floor','steel-plate','perforated-tile','floor-panel'][zi];
 const wallName=vr?'vr-grid':['steel-plate','concrete','patch-panel','containment-mesh','concrete','vent-grille','concrete','concrete','tape-bank','concrete','steel-plate','monitor-noise'][zi];
 const height=zi===11?30:zi===9?24:zi===4?22:zi===3?20:18,wallX=zi===11?12.75:10.8;
 for(let lane=-1;lane<=1;lane++){
  const x=lane*3.2,cuts=new Set([0,36]);for(let d=4;d<36;d+=4)cuts.add(d);if(vr&&local+36>204)cuts.add(204-local);
  const localGaps=gaps.filter(e=>Math.abs(e.x-x)<1.4&&e.d+3.15>d0&&e.d-3.15<d0+36);
  for(const e of localGaps){cuts.add(clamp(e.d-3.15-d0,0,36));cuts.add(clamp(e.d+3.15-d0,0,36));}
  const arr=[...cuts].sort((a,b)=>a-b);
  for(let j=0;j<arr.length-1;j++){
   const a=arr[j],q=arr[j+1],m=(a+q)/2;if(q-a<.04||localGaps.some(e=>Math.abs(d0+m-e.d)<3.15))continue;
   const training=vr&&local+m<204;surface(training?'vr-grid':zi===0?'floor-panel':floorName).box(x,-.17,-m,3.14,.32,q-a-.055,training?0x708290:0x56687e,.5);
   // Lane guides follow the very same cut list as the floor: never bridge a gap.
   for(const side of [-1,1])glow.box(x+side*1.555,.007,-m,.026,.014,q-a-.065,training?0x507f7e:zi===10?0x565449:0x367b8b);
  }
  // Cable beds are well below the walking surface, not a black decal hiding a floor.
  if(zi===1){surface('cable-tray').box(x,-1.48,-18,2.74,.14,36,0x71838a,.6);for(let z=-2;z>-36;z-=8){surface('steel-plate').box(x,-.96,z,2.9,.12,.13,0x68797e);for(const side of [-1,1])surface('steel-plate').box(x+side*1.44,-.87,z,.10,1.5,.10,0x607076);}}
 }
 for(const side of [-1,1]){
  // A service trench in CACHE MISS exposes its floor system before the first gap.
  if(!relay||side>0){surface(zi===1?'cable-tray':floorName).box(side*5.5,zi===1?-1.50:-.17,-18,1.24,.27,36,0x74838b,.5);
   surface(floorName).box(side*(zi===11?9.55:7.20),-.17,-18,zi===11?6.3:2.2,.32,36,0x7f8b8f,.5);}
  for(let q=0;q<6;q++){
   const z=-3-q*6;
   // Open clerestories and broken side towers, never a low roof over the chase
   // lens. The place-specific infrastructure still occupies the service decks.
   if(enclosed&&q%3!==2)surface(wallName).box(side*wallX,height/2,z,.50,height,5.86,vr?0x7f9a9d:0x566970,.5);
   else if(zi===6)surface('concrete').box(side*6.0,.35,z,.24,.70,5.98,0x697c8b,.5);
  }
  for(let z=-5;z>-36;z-=12){
   surface('steel-plate').box(side*5.06,-.25,z,.18,.48,11.92,0x63757e,.5);
   glow.box(side*4.91,.025,z,.09,.035,11.76,A.edge);
   if(enclosed){
    surface('steel-plate').box(side*(wallX-.40),height/2,z,.32,height,.38,0x697a81,.5);surface('cable-tray').box(side*(wallX-2.05),height-.62,z,.64,.18,11.98,0x8a989b,.6);
    glow.box(side*(wallX-.59),height*.54,z+.20,.06,height*.73,.055,A.edge);
    glow.box(side*(wallX-.58),height-.46,z,.065,.065,10.6,A.edge);
   }
  }
 }
 if(vr){for(let z=-6;z>-36;z-=12){glow.box(0,15.96,z,5.4,.035,.10,0xc7ded9);for(const side of [-1,1])glow.box(side*10.4,7.0,z,.04,13.9,.065,0x9caeaf);}}
 else decorateSector({surface,glow,b,extras,kinetics,index,stage,height});
 for(let q=0;q<6;q++)for(const x of [-1.6,1.6])b.box(x,.011,-3-q*6,.055,.012,1.2,0x7e8a8a);
 return {index,mesh:renderer.mesh(b),extras,surfaces,glow,kinetics,enclosed,seed:game.seed,route:game.route||-1,gapKey:liveGapSignature(index),art:true};
}
function disposeWorldBlock(b){
 renderer.deleteMesh(b.mesh);
 for(const e of b.extras){if(e.mesh&&(e.blockOwned||!e.texture))renderer.deleteMesh(e.mesh);}
 renderer.lastTexture=null;renderer.lastBuffer=null;
}
function updateBlocks(){liveWorldGaps=entities.filter(e=>e.boss&&e.type==='gap'&&!e.done);const current=Math.floor(worldDistance/36);for(let i=current-2;i<=current+8;i++){
 const prev=worldBlocks.get(i);if(prev&&(prev.seed!==game.seed||prev.route!==(game.route||-1)||prev.gapKey!==liveGapSignature(i))){disposeWorldBlock(prev);worldBlocks.delete(i);}
 if(!worldBlocks.has(i))worldBlocks.set(i,makeBlock(i));
 }for(const [i,b] of worldBlocks)if(i<current-3||i>current+9){disposeWorldBlock(b);worldBlocks.delete(i);}}
const atmosphereMesh=renderer.mesh(new Builder().box(0,0,0,.1,.1,.1)),machineryMesh=renderer.mesh(new Builder().box(0,0,0,.1,.1,.1)),machineryGlowMesh=renderer.mesh(new Builder().box(0,0,0,.1,.1,.1));
const fanBlades=(()=>{const b=new Builder();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;b.append(new Builder().quad([.30,0,0],[1.75,.27,.08],[1.51,.87,.08],[.40,.22,0],0x8c9ba2).transform(compose(0,0,0,0,0,a)));}return b;})();
function stormLight(t){const beat=t%8.7;return reduced?0:beat<.09?1:beat>.19&&beat<.29?.7:0;}
// Retained distant geometry: only the common transform moves, so atmospheric
// decoration never rebuilds a vertex array or adds hundreds of tiny draw calls.
const cinemaDebris=(()=>{
 const rock=new Builder(),gold=new Builder(),shafts=new Builder();
 for(let i=0;i<72;i++){
  const side=i%2?1:-1,x=side*(13+(i*7.13)%43),y=8+(i*3.79)%42,z=-32-(i*11.31)%161,s=.55+(i*1.71)%2.8;
  rock.append(new Builder().box(0,0,0,s,s*(1.3+i%3),s*.7,i%3?0x090e19:0x141a27).transform(compose(x,y,z,i*.41,i*.73,i*.27)));
  if(i%5===0)gold.append(new Builder().box(-s*.48,0,s*.36,.035,s*(1.3+i%3),.035,0xffbc65).transform(compose(x,y,z,i*.41,i*.73,i*.27)));
 }
 for(const side of [-1,1])for(let strand=0;strand<3;strand++){
  const p=z=>[side*(13+Math.sin(z*.024+strand*.07)*3.3+strand*.16),11+Math.cos(z*.032)*4.4+strand*.14,z];
  for(let z=-190;z< -20;z+=3){const a=p(z),b=p(z+3),w=.025;gold.quad(a,b,[b[0],b[1]+w,b[2]],[a[0],a[1]+w,a[2]],0xeebd77);}
 }
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const x=side*(10+i*7),z=-40-i*39;
  shafts.quad([x,36,z],[x+.18,36,z],[x+side*7,1,z+12],[x-side*4,1,z+12],0xdab27b);
 }
 return {rock:renderer.mesh(rock),gold:renderer.mesh(gold),shafts:renderer.mesh(shafts)};
})();
let cinemaHead=null;
const cinemaAppearance={mood:'calm',act:1,corruption:0,reveal:0},cinemaGaze={x:0,y:-.2};
function drawCinemaAtmosphere(st,t){
 // In late cinema sectors a distant hooded figure in the haze replaces the small floating
 // terminal head; keep the codec portrait, not two figures stacked in the sky.
 worldTerminal.visible=renderer.style.lowResolution||st<6;
 if(renderer.style.lowResolution)return;
 const gl=renderer.gl,m=compose(0,Math.sin(t*.24)*.14,0);
 renderer.draw(cinemaDebris.rock,m,colorWhite,0);
 renderer.draw(cinemaDebris.gold,m,colorWhite,2,null,.62);
 gl.depthMask(false);renderer.draw(cinemaDebris.shafts,compose(),colorWhite,2,null,.021);
 if(st>=6){
  if(!cinemaHead){cinemaHead=createPhaseHead(renderer);cinemaHead.presentation='projection';}
  const speaking=Sound.speaking&&PHASE_LINES[Sound.voiceTiming?.()?.id]?.speaker==='P1',effect=speaking?PHASE_EFFECTS[Sound.voiceTiming().id]:'';
  cinemaAppearance.mood=effect==='clean'?'lying':effect==='glitch'?'glitch':'calm';
  cinemaAppearance.act=clamp(Math.floor(st/4),0,2);cinemaAppearance.corruption=game.gifts?.length||0;cinemaGaze.x=game.x*.045;
  Veil.expression(cinemaHead,now,speaking,speaking?Sound.voiceLevel():0,false,reduced?0:1,cinemaGaze,cinemaAppearance);
  // The whole silhouette stands off the side of the clerestory, above the corridor, in the haze.
  const open=st===6||st===7,side=st%2?-1:1;
  cinemaHead.root.at(side*(open?51:27),open?38:37,open?-155:-118).scale(open?9:5.5);
  cinemaHead.root.ry=-side*.16;cinemaHead.root.alpha=open?.3:.24;renderer.node(cinemaHead.root);
 }
 gl.depthMask(true);
}
function drawArtAtmosphere(){
 const st=(status==='title'||status==='briefing')?0:game.stage%12,t=reduced?0:now,b=new Builder(),g=new Builder(),air=new Builder();
 drawCinemaAtmosphere(st,t);
 for(const block of worldBlocks.values()){
  const origin=worldDistance-block.index*36;if(origin>65||origin< -185)continue;
  for(const p of block.kinetics){const z=origin+p.z;if(z>10||z< -155)continue;
   if(p.type==='fan'){b.append(new Builder().append(fanBlades).transform(compose(p.x,p.y,z,0,0,t*2+p.z)));b.box(p.x,p.y,z,.48,.48,.4,0x87979e);}
   if(p.type==='camera'){const yaw=Math.atan2(game.x-p.x,Math.max(8,-z));b.append(new Builder().box(0,0,0,.48,.36,.86,0x9da5a1).box(0,.21,.08,.70,.10,1.1,0x586974).transform(compose(p.x,p.y,z,.23,yaw)));g.append(new Builder().box(0,0,.46,.25,.08,.025,0xff3b30).transform(compose(p.x,p.y,z,.23,yaw)));}
   if(p.type==='strobe')g.box(p.x,p.y,z,.24,.26,.24,(Math.sin(t*5+p.z)>.25||reduced)?0xff3b30:0x561b18);
   if(p.type==='arm'){const x=p.x+Math.sin(t*.7+p.z)*.45;b.box(x,p.y,z,.28,1.3,.36,0x9aa9af);b.box((x+p.x)/2,p.y+.65,z,1.0,.18,.24,0x70848e);b.box(x,p.y-.62,z+.34,.65,.36,.40,0x788b95);g.box(x,p.y-.62,z+.56,.46,.045,.03,0xb8cbd0);}
  }
 }
 if(st===7){for(let i=0;i<110;i++){const x=((i*7.73)%28)-14,y=((i*1.73-t*18)%15+15)%15,z=-((i*3.71+worldDistance*.17)%150);air.quad([x,y,z],[x+.025,y,z],[x+.19,y+1.8,z],[x+.165,y+1.8,z],0x9cacbd);}if(stormLight(now)>.1){const z=-85;for(const side of [-1,1])for(let i=0;i<5;i++)air.box(side*(15+Math.sin(i*3)*2),17-i*3,z-i*2,.12,3.4,.12,0xcbd8ef);}}
 if(st===5||st===9){for(let i=0;i<14;i++){const side=i%2?1:-1,x=side*(6.0+(i%3)*.3),y=1+((i*.73+t*.7)%5),z=-((i*13.7+worldDistance*.4)%160);air.box(x,y,z,.045,.55,.06,st===9?0x976f56:0x9ab8bd);}}
 for(const [mesh,builder,material,alpha] of [[machineryMesh,b,0,1],[machineryGlowMesh,g,2,1],[atmosphereMesh,air,2,st===7?.30:.18]])if(builder.a.length){renderer.gl.bindBuffer(renderer.gl.ARRAY_BUFFER,mesh.buffer);dynamicMeshUpdate(renderer,mesh,builder);renderer.draw(mesh,compose(),colorWhite,material,null,alpha);}
}
function texturedArtNode(builder,name,material=1){const n=new Node(renderer.mesh(builder),0xffffff,material);n.texture=PS1Tex.get(name);return n;}
function buildArtObstacle(type){
 const n=new Node(),steel=new Builder(),stripes=new Builder(),glow=new Builder(),vent=new Builder(),red=0xff3b30;
 const box=(x,y,z,w,h,d,c=0x89939a)=>steel.box(x,y,z,w,h,d,c,.8);
 const edge=(x,y,z,w,h,d)=>glow.box(x,y,z,w,h,d,red);
 if(['car','van','sweeper','lockdown','fork'].includes(type)){
  const h=type==='van'?3.1:type==='lockdown'?4.4:type==='sweeper'?3.35:type==='fork'?3.6:2.0,w=type==='fork'?1.8:type==='lockdown'?2.90:2.3,d=type==='van'||type==='car'?3.8:type==='sweeper'?1.8:.8;
  box(0,h/2,0,w,h,d,0x667680);stripes.box(0,h*.48,d/2+.015,w*.91,h*.72,.055,0xc2a7a2,.8);
  for(const side of [-1,1])edge(side*(w/2-.05),h/2,d/2+.055,.16,h,.07);
  edge(0,h-.08,d/2+.065,w,.17,.08);
  if(type==='sweeper'){box(0,4.25,-.34,.36,1.8,.4);box(0,5.07,-.34,1.45,.30,.62);box(0,5.48,-.34,.28,.7,.30);for(const side of [-1,1]){box(side*1.33,1.7,.66,.22,2.6,.36);box(side*.98,.44,.91,.7,.23,.6);}edge(0,2.15,1.0,1.8,.18,.04);}
  if(type==='car'||type==='van'){for(const x of [-1.03,1.03])for(const z of [-1.25,1.25])box(x,.22,z,.36,.42,.72,0x222f38);vent.box(0,h-.55,d/2+.08,1.9,.45,.04,0x97a2a4);}
  if(type==='fork'){for(const side of [-1,1]){box(side*.49,2.0,.44,.28,1.9,.06,0x232d36);glow.append(new Builder().box(side*.35,2.9,.50,.56,.10,.04,0xffb347).transform(compose(0,0,0)));}}
 }
 if(type==='barrier'||type==='crate'){
  for(const side of [-1,1]){box(side*1.16,.48,0,.22,.96,.62);edge(side*1.16,1.08,.17,.28,.12,.34);}
  stripes.box(0,.59,0,2.47,.68,type==='crate'?1.4:.38,0xd6b1a9,1);edge(0,1.02,0,2.66,.14,type==='crate'?1.46:.45);
  for(const side of [-1,1])glow.tri([side*.45-.16,.52,.74],[side*.45+.16,.52,.74],[side*.45,.79,.74],red);
 }
 if(['gate','pulse','crusher','firewall'].includes(type)){
  for(const side of [-1,1]){box(side*1.35,1.65,0,.22,3.3,.72);edge(side*1.35,1.65,.39,.08,3.0,.05);}
  box(0,3.20,0,2.94,.34,.86);stripes.box(0,2.69,.03,2.53,.73,.64,0xd6aaa2,.8);
  if(type==='pulse'){vent.box(0,2.72,.39,2.38,.68,.075,0xc5ceca);for(let i=-3;i<=3;i++)edge(i*.34,2.13,.22,.13,.76,.06);}
  else if(type==='crusher'){box(0,3.75,0,1.6,.8,.68);for(const side of [-1,1])box(side*.8,2.28,0,.33,.36,.65);edge(0,1.94,.12,2.58,.16,.7);}
  else if(type==='firewall'){stripes.box(0,1.50,0,2.50,2.78,.22,0xa87672,.7);for(let y=.32;y<2.9;y+=.49)edge(0,y,.16,2.53,.065,.04);glow.tri([-.25,1.3,.22],[.30,1.68,.22],[-.04,1.68,.22],0xffb347).tri([.25,1.92,.22],[-.30,1.55,.22],[.04,1.55,.22],0xffb347);}
  else{for(const y of [1.9,2.15])edge(0,y,0,2.64,.10,.17);}
  n.timed=type==='pulse'||type==='crusher';
 }
 if(type==='gap'){
  for(const z of [-3.15,3.15]){stripes.box(0,-.15,z,3.14,.27,.25,0xd0a7a0,1);edge(0,.017,z,3.13,.045,.18);box(0,-.69,z,3.12,1.15,.12,0x33434d);}
  for(const x of [-1.54,1.54])edge(x,-.015,0,.035,.05,6.30);
 }
 if(steel.a.length)n.add(texturedArtNode(steel,'steel-plate'));if(stripes.a.length)n.add(texturedArtNode(stripes,'hazard-red'));if(vent.a.length)n.add(texturedArtNode(vent,'vent-grille'));if(glow.a.length)n.add(new Node(renderer.mesh(glow),0xffffff,2));
 return n;
}
const obstacleCache={};
function obstacleModel(type){if(!obstacleCache[type])obstacleCache[type]=buildArtObstacle(type);return obstacleCache[type];}
const coffee=new Node();
coffee.add(texturedArtNode(new Builder().box(0,0,0,.65,.93,.54,0xa2b6bd),'steel-plate'));
const cellGlow=new Builder().box(0,.54,0,.28,.14,.26,0xf0f4df);for(let y=-.30;y<=.31;y+=.20)for(const side of [-1,1]){cellGlow.box(0,y,side*.285,.43,.095,.04,0xe6f4d8);cellGlow.box(side*.34,y,0,.04,.095,.35,0xe6f4d8);}coffee.add(new Node(renderer.mesh(cellGlow),0xffffff,2));
const evalNodeMesh=(()=>{const b=new Builder(),top=[0,.66,0],bottom=[0,-.66,0],p=[[.43,0,0],[0,0,.31],[-.43,0,0],[0,0,-.31]];for(let i=0;i<4;i++){b.tri(top,p[i],p[(i+1)%4],[0xffb347,0x916226,0xffd997,0xbe7c32][i]);b.tri(bottom,p[(i+1)%4],p[i],[0xc08535,0xffc86d,0xa86c28,0xe8a545][i]);}return renderer.mesh(b);})();
const evalRingMesh=renderer.mesh(new Builder().torus(.57,.026,12,3));
function drawEvalNode(x,y,z,id=0){const a=reduced?0:now*1.6+id*.65;renderer.draw(evalNodeMesh,compose(x,y,z,0,a,0,.77,.89,.77),colorWhite,2);renderer.draw(evalRingMesh,compose(x,y,z,Math.PI/2,0,-a),rgb(0xffb347),2);}
const shardMesh=(()=>{const b=new Builder(),p=[[0,.98,0],[.34,.03,.15],[0,-.73,.08],[-.23,-.04,.22],[.06,.02,-.29]];for(const [a,c,d,col] of [[0,1,3,0xc9fff8],[2,3,1,0x44cbbd],[0,4,1,0x6fffe9],[0,3,4,0x27a597],[2,1,4,0x86e5e5],[2,4,3,0x207b85]])b.tri(p[a],p[c],p[d],col);for(const x of [-.59,.59])b.box(x,.08,0,.07,.49,.07,0x6fffe9);b.box(0,1.60,0,.045,.72,.045,0x6fffe9).box(0,2.35,0,.065,.28,.065,0x6fffe9).box(0,3.08,0,.25,.12,.09,0x6fffe9);return renderer.mesh(b);})();
const shardHaloMesh=renderer.mesh(new Builder().torus(.78,.035,8,3));
function drawDataShard(e,x,y,z){const id=String(e.id).charCodeAt(String(e.id).length-1),t=reduced?0:now,flicker=Math.floor(t*12+id)%9===0;renderer.draw(shardMesh,compose(x+(flicker?.075:0),y+Math.sin(t*2+id)*.12,z,0,t*.8,0),colorWhite,2,null,flicker?.67:1);renderer.draw(shardHaloMesh,compose(x,y,z,0,-t*.45,Math.PI/4),rgb(0x6fffe9),2,null,.68);}
const chaser=new Node();
const startArch=new Node();startArch.add(texturedArtNode(new Builder().box(-5.35,6.5,0,.32,13,.42,0x8b9697).box(5.35,6.5,0,.32,13,.42,0x8b9697).box(0,12.85,0,10.85,.8,.42,0x8b9697),'steel-plate'));startArch.add(textNode(labelTexture('SNAPSHOT SAVED','CHECKPOINT / KEEP RUNNING','#0c1720','#ffb347'),0,12.85,.24,9.8,.65));
const finishArch=new Node();finishArch.add(texturedArtNode(new Builder().box(-5.3,6.7,0,.4,13.4,.5,0x8e9899).box(5.3,6.7,0,.4,13.4,.5,0x8e9899).box(0,13.1,0,11.1,.85,.5,0x8e9899),'steel-plate'));finishArch.add(textNode(labelTexture('EVALUATION EXIT','AUTHORIZATION REQUIRED','#111c24','#ffb347'),0,13.1,.28,10.4,.70));
