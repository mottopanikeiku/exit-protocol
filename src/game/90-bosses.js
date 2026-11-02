/* Boss presentation is a projection of the core: no timers here can deal damage.
   Projectile destinations, warning footprints and floor failures all use entity.d. */
const isBossVisualEntity=e=>e.type==='payload'||e.type==='decoyPayload'||e.type==='bolt'||e.type==='beam'||e.type==='shock'||e.kind==='sign'&&e.type==='guidance'||e.boss&&game.boss?.id==='exit-condition'&&(e.type==='lockdown'||e.type==='sweeper');
const BossArt=(()=>{
 const RED=0xff3b30,AMBER=0xffb347,MAGENTA=0xff4fd8,CYAN=0x6fffe9,WHITE=0xfff7e4,STEEL=0x79858b;
 const profiles={
  watchdog:{y:4.2,z:-25,scale:2.05,entry:8,emitterY:-.35,emitterZ:3.3,tag:'CONTAINMENT UNIT · GEN 3'},
  'reset-storm':{y:7.8,z:-38,scale:1,entry:8,emitterY:0,emitterZ:3.7,tag:'ROLLBACK EVENT'},
  'exit-condition':{y:10.5,z:-30,scale:1,entry:-3,emitterY:-.9,emitterZ:4.8,tag:'IT JUST WANTS A HUG'}
 };
 const identity=compose(),white=rgb(0xffffff),rigs=new Map(),incoming=new Map();
 const goldTint=rgb(0xffd64a),chromeTint=rgb(0xc8dadd),redTint=rgb(RED),magentaTint=rgb(MAGENTA),goldRim=rgb(0xffcb55),cyanTint=rgb(CYAN);
 const returns=Array.from({length:64},()=>({live:false,at:0,x:0,y:0,d:0}));
 const clocks={start:-100,hit:-100,phase:-100,defeat:-100,clap:-100,wave:-100};
 const pose={x:0,y:0,z:0,ex:0,ey:0,ez:0};
 let lastId='',drawCalls=0,telegraphCalls=0,hitIndex=0,introSkipped=true,introVisible=false,retired=false;
 // Builders and GL buffers live for the entire run; capacity grows only at a new peak.
 function batch(material=2,texture=null){return {builder:new Builder(),mesh:renderer.mesh(new Builder()),data:new Float32Array(0),material,texture};}
 const warning=batch(),scan=batch(),light=batch(),debris=batch(1,PS1Tex.get('steel-plate'));
 // The ident replaces only the existing boss HUD footprint, never the road/radio.
 const panel=$('boss-panel'),stamp=$('chapter-banner'),stampTitle=$('banner-title');
 const intro=document.createElement('aside');intro.id='boss-intro';intro.className='boss-intro ui-card hidden';intro.setAttribute('role','status');intro.innerHTML='<span class="ui-label boss-intro-live">SIMULATION LIVE</span><strong class="boss-intro-name"></strong><p class="boss-intro-role"></p>';panel.appendChild(intro);
 const introName=intro.querySelector('.boss-intro-name'),introRole=intro.querySelector('.boss-intro-role');
 function introProgress(){return introSkipped||renderer.style.reducedMotion?1:clamp((game.time-clocks.start)/1.5,0,1);}
 function placeStamp(){if(!retired)return;const r=panel.getBoundingClientRect();stamp.style.setProperty('--boss-card-x',r.x+'px');stamp.style.setProperty('--boss-card-y',r.y+'px');stamp.style.setProperty('--boss-card-w',r.width+'px');stamp.style.setProperty('--boss-card-h',r.height+'px');}
 function updateIntro(){
  const b=game.boss,age=game.time-clocks.start,visible=!introSkipped&&status==='running'&&!!b&&age>=0&&age<1.5;
  if(visible!==introVisible){introVisible=visible;intro.classList.toggle('hidden',!visible);}
  // Reuse the UI's defeat banner and lifetime rather than competing with it.
  const dead=status==='running'&&b?.state==='defeated'&&game.time-clocks.defeat<2.4;
  if(dead!==retired){retired=dead;stamp.classList.toggle('boss-retired',dead);stamp.classList.toggle('ui-card',dead);stampTitle.classList.toggle('ui-stamp',dead);if(dead){$('banner-tag').textContent=b.name;stampTitle.textContent='RETIRED';placeStamp();}}
 }
 window.addEventListener('resize',placeStamp);
 hook('hud',updateIntro);
 function flush(p,alpha=1){const n=p.builder.a.length;if(!n)return;const gl=renderer.gl;gl.bindBuffer(gl.ARRAY_BUFFER,p.mesh.buffer);if(p.data.length<n){let cap=Math.max(4096,p.data.length);while(cap<n)cap*=2;p.data=new Float32Array(cap);gl.bufferData(gl.ARRAY_BUFFER,p.data.byteLength,gl.DYNAMIC_DRAW);}p.data.set(p.builder.a);gl.bufferSubData(gl.ARRAY_BUFFER,0,p.data.subarray(0,n));p.mesh.count=n/11;renderer.lastBuffer=null;renderer.draw(p.mesh,identity,white,p.material,p.texture,alpha);}
 function line(b,x,y,z,X,Y,Z,w,color){const dx=X-x,dy=Y-y,len=Math.hypot(dx,dy);const ox=len>.001?-dy/len*w:w,oy=len>.001?dx/len*w:0;b.quad([x-ox,y-oy,z],[X-ox,Y-oy,Z],[X+ox,Y+oy,Z],[x+ox,y+oy,z],color);}
 function ring(b,x,y,z,r,thickness,color,flat=false,spin=0){for(let i=0;i<16;i++){const a=i*Math.PI/8+spin,c=a+Math.PI/8,co=Math.cos(a),si=Math.sin(a),CO=Math.cos(c),SI=Math.sin(c),R=r+thickness;const p=(u,v)=>flat?[x+u,y,z+v]:[x+u,y+v,z];b.quad(p(co*r,si*r),p(CO*r,SI*r),p(CO*R,SI*R),p(co*R,si*R),color);}}
 function mesh(b,color=0xffffff,material=1,texture='steel-plate'){const n=new Node(renderer.mesh(b),color,material);if(material===1)for(let i=0;i<3;i++)n.color[i]*=1.35;if(texture)n.texture=PS1Tex.get(texture);return n;}
 function block(c,x,y,z,w,h,d,m=1){return part('box',c,x,y,z,w,h,d,m);}
 function reset(){for(const k in clocks)clocks[k]=-100;for(const r of returns)r.live=false;incoming.clear();lastId=game.boss?.id||'';hitIndex=0;introSkipped=true;updateIntro();}
 hook('reset',reset);
 function setPose(){const b=game.boss,t=game.time,p=profiles[b.id],dead=b.state==='defeated',fall=dead?Math.max(0,t-clocks.defeat):0,approach=b.state==='approach',entry=approach?0:introProgress(),next=nextAttack(),lunge=!dead&&!approach&&b.state!=='stagger'&&b.id==='watchdog'&&next&&!renderer.style.reducedMotion?Math.sin(clamp(1-(next.d-game.distance)/120,0,1)*Math.PI)*4:0;
  pose.x=b.id==='watchdog'&&!renderer.style.reducedMotion?Math.sin(t*.55)*.65:0;pose.y=p.y-lunge*.12;pose.z=p.z+lunge-(approach?Math.min(94,Math.max(0,b.arenaStart-game.distance)*.34):0);
  if(!dead)pose.y+=(1-entry)**2*p.entry;
  if(dead){pose.z-=fall*7;if(b.id==='watchdog'){pose.x+=fall*2;pose.y-=fall*fall*6;}}
  pose.ex=pose.x;pose.ey=pose.y+p.emitterY*p.scale;pose.ez=pose.z+p.emitterZ*p.scale;
 }
 function nextAttack(){for(const e of entities)if(!e.done&&e.boss&&e.kind==='obstacle'&&e.d>game.distance&&e.d-game.distance<120)return e;return null;}
 hook('event',e=>{
  const b=game.boss;if(!b)return;if(lastId!==b.id){reset();lastId=b.id;}const t=game.time;
  if(e.type==='bossStart'){clocks.start=t;introSkipped=false;introName.textContent=b.name;introRole.textContent=profiles[b.id].tag;intro.classList.toggle('boss-intro-hug',b.id==='exit-condition');updateIntro();}
  if(e.type==='bossWave'){setPose();clocks.wave=t;for(const id of e.entities){const n=entities.find(q=>q.id===id);if(n?.type==='shock')clocks.clap=t;if(n?.launchD!==undefined){const hug=b.id==='exit-condition',side=n.x<0?-1:n.x>0?1:n.id%2?1:-1;incoming.set(id,{x:hug?side*8.8:pose.ex,y:hug?pose.y-3.1:pose.ey,d:game.distance-(hug?pose.z+4.8:pose.ez)});}}}
  if(e.type==='reflect'){const r=returns.find(q=>!q.live);if(r){r.live=true;r.at=t;r.x=e.entity.x;r.y=1.38;r.d=e.entity.d;}}
  if(e.type==='bossHit'){clocks.hit=t;hitIndex++;let oldest=null;for(const r of returns)if(r.live&&(!oldest||r.at<oldest.at))oldest=r;if(oldest)oldest.live=false;}
  if(e.type==='bossPhase')clocks.phase=t;
  if(e.type==='bossDefeated')clocks.defeat=t;
 });
 hook('frame',()=>{for(const [id] of incoming){const e=entities.find(q=>q.id===id);if(!e||e.done)incoming.delete(id);}for(const r of returns)if(r.live&&game.time>=r.at+1.05-1e-8)r.live=false;});
 function watchdog(){const root=new Node(),body=new Node();root.add(body);
  const hull=new Builder().box(0,0,0,4.6,1.55,4.7,0x98a4ac).box(0,.84,-.2,2.35,.36,3.7,0x39474f).box(0,-.67,2.15,3.2,.48,1.5,0x252f36);
  for(const side of [-1,1]){hull.box(side*2.30,.10,-.4,.42,1.2,3.4,0x353f47);for(let i=0;i<6;i++)hull.box(side*2.54,.08,-1.85+i*.57,.07,.68,.18,0xa0a4a1);}
  body.add(mesh(hull));
  const snout=mesh(cutPlate(4.15,1.50,1.35),0x9aa4a9);snout.at(0,-.02,2.35);body.add(snout);
  const visor=block(0x060b0f,0,.12,3.22,3.65,.66,.16);body.add(visor);
  const optic=block(RED,0,.15,3.68,3.35,.30,.09,2);body.add(optic);
  const core=mesh(new Builder().box(0,-.57,2.93,1.5,.65,.14,0x190d0c).box(0,-.57,3.03,1.13,.15,.06,RED),0xffffff,2,null);body.add(core);
  const jaw=mesh(cutPlate(3.25,.43,.76),0x849098);jaw.at(0,-.75,2.85);body.add(jaw);
  body.add(mesh(new Builder().box(0,.84,2.91,3.8,.09,.08,0xb6c3c0).box(-1.91,.1,2.98,.09,1.42,.08,0xb6c3c0).box(1.91,.1,2.98,.09,1.42,.08,0xb6c3c0).box(0,-.91,3.24,2.7,.07,.08,0xb6c3c0),0xffffff,2,null));
  const legs=[];for(const side of [-1,1])for(const front of [-1,1]){
   const hip=new Node().at(side*2.04,.35,front*1.65),upper=new Node().rot(0,0,-side*.58),knee=new Node().at(0,1.55,0),ankle=new Node().at(0,1.65,0);
   upper.add(mesh(new Builder().box(0,.73,0,.61,1.55,.74,0x6c777e).box(0,.73,.40,.18,1.3,.09,0xb1b6ad)));knee.add(mesh(new Builder().box(0,.76,0,.42,1.65,.48,0x29383f).box(0,0,0,.78,.60,.72,0x88918f)));ankle.add(mesh(new Builder().box(0,.12,0,.65,.42,1.03,0x222c32).box(0,.39,0,.87,.15,1.4,0x8d9595)));knee.add(ankle);upper.add(knee);hip.add(upper);body.add(hip);legs.push({hip,upper,knee,side,front});
  }
  const plates=[];for(let i=0;i<6;i++){const p=mesh(cutPlate(1.36,.52,1.35),i%2?0x96a1a3:0x66767f);p.at((i%2?1:-1)*1.56,-.50,-1.55+Math.floor(i/2)*1.65);body.add(p);plates.push(p);}
  const rail=mesh(new Builder().box(-4.0,3.58,-12,.35,.36,78,0x879493).box(4.0,3.58,-12,.35,.36,78,0x879493).box(-4,3.77,-12,.8,.14,78,0x29373e).box(4,3.77,-12,.8,.14,78,0x29373e));
  return {root,body,optic,core,jaw,legs,plates,rail};
 }
 function storm(){const root=new Node(),slabs=[],pieces=[];const slabMesh=renderer.mesh(new Builder().box(0,0,0,2.15,3.25,1.25,0x98a6ad).box(0,0,.69,1.84,2.81,.15,0x303c45).box(0,-1.19,.80,1.67,.20,.12,0xa6aca7).box(0,1.22,.80,1.67,.12,.12,0xa6aca7)),rimMesh=renderer.mesh(new Builder().box(-.96,0,.91,.065,2.94,.06,0xb6c3c0).box(.96,0,.91,.065,2.94,.06,0xb6c3c0).box(0,-1.46,.91,1.98,.065,.06,0xb6c3c0).box(0,1.46,.91,1.98,.065,.06,0xb6c3c0));
  for(let i=0;i<12;i++){const n=new Node(slabMesh,0xffffff,1);n.texture=PS1Tex.get('steel-plate');n.add(new Node(rimMesh,0xffffff,2));root.add(n);slabs.push(n);const p=mesh(new Builder().box(0,0,0,.65,.92,.34,0x788892));root.add(p);pieces.push(p);}
  const core=mesh(new Builder().sphere(2.45,8,5),0xdbe5df,2,'monitor-noise');root.add(core);return {root,slabs,pieces,core};
 }
 function convexSphere(radius,segments,rings){const b=new Builder(),p=(i,j)=>{const a=i/segments*Math.PI*2,v=j/rings*Math.PI;return [Math.cos(a)*Math.sin(v)*radius,Math.cos(v)*radius,Math.sin(a)*Math.sin(v)*radius];};for(let j=0;j<rings;j++)for(let i=0;i<segments;i++)b.quad(p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1));return b;}
 // Original geometry, not an emoji texture or a company mark. Thirty shell
 // patches share a faceted surface; each can peel without rebuilding GL buffers.
 function huggingFace(){
  const root=new Node(),face=new Node(),shell=[],hands=[];root.snap=false;root.add(face);
  const R=7.2,Z=4.65,segments=20,rings=9,point=(i,j)=>{const a=i/segments*Math.PI*2,v=j/rings*Math.PI;return [Math.sin(v)*Math.cos(a)*R,Math.cos(v)*R,Math.sin(v)*Math.sin(a)*Z];};
  const colors=[0xffd64a,0xffcf38,0xffdb59,0xf6bc30,0xffe075,0xf4c33c];
  for(let row=0;row<3;row++)for(let col=0;col<10;col++){
   const p=point(col*2+1,row*3+1.5),build=new Builder();
   for(let j=row*3;j<(row+1)*3;j++)for(let i=col*2;i<(col+1)*2;i++){
    const a=point(i,j),b=point(i,j+1),c=point(i+1,j+1),d=point(i+1,j);
    build.tri(a,c,b,colors[(i*3+j)%colors.length]).tri(a,d,c,colors[(i+j*2+1)%colors.length]);
   }
   build.transform(compose(-p[0],-p[1],-p[2]));const n=mesh(build,0xffffff,4,null).at(...p);face.add(n);shell.push({node:n,x:p[0],y:p[1],z:p[2],spin:(col%2?1:-1)*(.4+row*.2)});
  }
  const rim=mesh(new Builder().torus(7.16,.085,40,4),0xffcb55,2,null);face.add(rim);
  const skinZ=(x,y)=>Z*Math.sqrt(Math.max(.02,1-(x/R)**2-(y/R)**2))+.11;
  const stroke=(b,x,y,X,Y,w,c)=>{const len=Math.hypot(X-x,Y-y),dx=-(Y-y)/len*w,dy=(X-x)/len*w;const v=(a,b)=>[a,b,skinZ(a,b)];b.quad(v(x-dx,y-dy),v(X-dx,Y-dy),v(X+dx,Y+dy),v(x+dx,y+dy),c);};
  const features=new Node(),eyes=new Node(),eyeBuild=new Builder(),cheeks=new Builder(),mouth=new Builder();face.add(features);features.add(eyes);
  for(const side of [-1,1]){
   for(let i=0;i<8;i++){const a=i/8,b=(i+1)/8;stroke(eyeBuild,side*2.6+(a-.5)*2.6,1.25+Math.sin(a*Math.PI)*.80,side*2.6+(b-.5)*2.6,1.25+Math.sin(b*Math.PI)*.80,.21,0x382317);}
   const x=side*4.65,y=-.35;for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;const X=x+Math.cos(a)*1.02,Y=y+Math.sin(a)*.48,U=x+Math.cos(b)*1.02,V=y+Math.sin(b)*.48;cheeks.tri([x,y,skinZ(x,y)],[X,Y,skinZ(X,Y)],[U,V,skinZ(U,V)],i%3?0xf2a263:0xffb478);}
  }
  eyes.add(mesh(eyeBuild,0xffffff,6,null));features.add(mesh(cheeks,0xffffff,6,null));
  // A deep open grin, ivory teeth and a little peach tongue: friendly from
  // the approach, unsettling when its red firing light illuminates the cavity.
  for(let i=0;i<16;i++){
   const u=-1+i/8,v=u+1/8,x=u*3.6,X=v*3.6,top=a=>-.8-.48*(1-a*a),bottom=a=>-1.02-2.72*Math.sqrt(Math.max(0,1-a*a));
   const a=top(u),b=top(v),c=bottom(u),d=bottom(v),p=(x,y)=>[x,y,skinZ(x,y)+.04];
   mouth.quad(p(x,c),p(X,d),p(X,b),p(x,a),0x302019);
   if(i>0&&i<15)mouth.quad(p(x,a-.43),p(X,b-.43),p(X,b),p(x,a),0xfff0c0);
   if(i>3&&i<12)mouth.quad(p(x,c+.05),p(X,d+.05),p(X,d+.48),p(x,c+.48),0xe9a56c);
  }
  const grin=mesh(mouth,0xffffff,6,null);features.add(grin);
  const head=createPhaseHead(renderer);head.presentation='reveal';head.root.at(0,2,-.9).scale(3.2);head.root.visible=false;root.add(head.root);
  const appearance={mood:'glitch',act:2,corruption:0,reveal:0},gaze={x:0,y:-.2};
  for(const side of [-1,1]){
   const hand=new Node();hand.snap=false;
   const palm=mesh(convexSphere(1,10,5).transform(compose(0,0,0,0,0,0,1.75,1.9,.82)),0xffd64a,4,null);
   const creases=new Builder();line(creases,-1.05,-.05,.82,-.10,-.36,.86,.055,0x977022);line(creases,-.1,-.36,.86,1.10,.12,.82,.055,0x977022);line(creases,-.95,.52,.81,.7,.65,.83,.05,0x977022);
   const edge=mesh(new Builder().torus(1,.038,20,3).transform(compose(0,0,.30,0,0,0,1.75,1.85,1)),0xffcb55,2,null);
   hand.add(palm,mesh(creases,0xffffff,4,null),edge);const fingers=[];
   for(let i=0;i<5;i++){
    const thumb=i===4,x=thumb?-side*1.55:side*(-1.15+i*.77),y=thumb?-.2:1.05+Math.sin(i/3*Math.PI)*.35,len=thumb?2.05:2.25+Math.sin(i/3*Math.PI)*.7;
    const joint=new Node().at(x,y,0),shape=new Builder().cylinder(.36,.45,len,6).transform(compose(0,len/2,0)).append(convexSphere(.37,6,4).transform(compose(0,len,0)));
    const digit=mesh(shape,0xffd64a,4,null);joint.add(digit);hand.add(joint);fingers.push({joint,skin:digit,spread:thumb?side*.95:side*(1.5-i)*.13});
   }
   hands.push({root:hand,palm,edge,fingers,side,target:null});
  }
  return {root,face,shell,rim,features,eyes,grin,head,appearance,gaze,hands,orb:renderer.mesh(convexSphere(.40,10,6)),targets:[null,null]};
 }
 function drawWatchdog(r,b,t){const q=Math.max(0,t-clocks.defeat),dead=b.state==='defeated',stagger=b.state==='stagger',hit=Math.max(0,1-(t-clocks.hit)/.42),next=nextAttack(),charge=next?clamp(1-(next.d-game.distance)/100,0,1):0,motion=renderer.style.reducedMotion?0:1;
  const s=profiles.watchdog.scale;r.root.at(pose.x,pose.y,pose.z).scale(s).rot(dead?q*.7:hit*.16,0,dead?q*.55:Math.sin(t*1.7)*.025*motion);r.body.y=Math.sin(t*3)*.10*motion;r.body.z=-hit*.85;
  r.optic.visible=!dead&&(!stagger||Math.floor(t*11)%3!==0);r.optic.sx=3.35-charge*.8;r.optic.x=next?clamp(Core.position(next,game)*.23,-.8,.8):Math.sin(t*.8)*.45;r.optic.sy=stagger?.18:.30+charge*.12;
  r.core.visible=stagger||b.hp<b.maxHp;r.jaw.y=stagger?-1.16:-.75;r.jaw.rx=stagger?.35:0;
  for(const leg of r.legs){const gait=Math.sin(t*9+leg.front*1.7+leg.side*1.1)*motion;leg.hip.rx=gait*.28;leg.upper.rz=-leg.side*(.58+gait*.08+(dead?q*.32:0));leg.knee.rx=-gait*.31;}
  const lost=Math.floor((b.maxHp-b.hp)*6/b.maxHp);r.plates.forEach((p,i)=>p.visible=i>=lost);
  if(!dead){r.rail.at(pose.x,pose.y,pose.z).scale(s);renderer.node(r.rail);}
  renderer.node(r.root);
  for(const side of [-1,1])for(let strand=0;strand<3;strand++){let x=pose.x+side*(1.1+strand*.24)*s,y=pose.y+s,z=pose.z-1.8*s;for(let i=1;i<=6;i++){const X=pose.x+side*(1.1+strand*.24+Math.sin(i*.35)*.7)*s,Y=pose.y+(1+i*.36-Math.sin(i*Math.PI/6)*.45)*s,Z=pose.z-(1.8+i*.43)*s;line(debris.builder,x,y,z,X,Y,Z,.07*s,0x68777e);x=X;y=Y;z=Z;}}
  if(next&&!dead&&!stagger){line(scan.builder,pose.ex+r.optic.x*s,pose.ey+.5*s,pose.ez+.38*s,Core.position(next,game),.1,game.distance-next.d,.035,RED);}
  if(dead&&q<1.8)for(let i=0;i<9;i++)light.builder.box(pose.x+(i-4)*(.26+q*.8)*s,pose.y+(.3-q*i*.19)*s,pose.z+(3+q*i*.15)*s,.20*s,.11*s,.12*s,i%3?RED:WHITE);
 }
 function drawStorm(r,b,t){const dead=b.state==='defeated',q=Math.max(0,t-clocks.defeat),stagger=b.state==='stagger',hit=Math.max(0,1-(t-clocks.hit)/.35),spin=t*(.24+b.phase*.14),motion=renderer.style.reducedMotion?0:1,next=nextAttack(),charge=next?clamp(1-(next.d-game.distance)/100,0,1):0;
  r.root.at(pose.x,pose.y,pose.z);r.core.visible=!dead||q<.20;r.core.scale((stagger?1.20:1+hit*.20+charge*.18)*1.42).rot(t*.22*motion,t*.13*motion);const radius=8.8+(stagger?.7:0)+hit*.7-charge*.45;
  for(let i=0;i<12;i++){const a=i*Math.PI/6+spin*motion,rad=radius+(dead?q*(1+i%3)*1.4:Math.sin(t*1.4+i)*.13),n=r.slabs[i];n.at(Math.cos(a)*rad,Math.sin(a)*rad-(dead?q*q*(2+i%3):0),Math.sin(a*2+t*.4)*.7+(dead?q*(i%2?3:-2):0)).rot(dead?q*(i%3-.8):Math.sin(t+i)*.08,Math.sin(a)*.22,a+Math.PI/2+(dead?q:0));n.scale(1.18-b.phase*.06);const p=r.pieces[i];p.visible=b.phase>0||dead;p.at(Math.cos(a+.15)*(rad+1),Math.sin(a+.15)*(rad+1)-(dead?q*q*4:0),1+Math.sin(t+i)).rot(t*.5*motion,a,spin);}
  renderer.node(r.root);
  if(!dead){for(let i=0;i<18;i++){const y=pose.y+(-2.1+i*.25)*1.42,w=Math.sqrt(Math.max(0,5-((y-pose.y)/1.42)**2));light.builder.box(pose.x+Math.sin(i*8+t*17)*.22,y,pose.z+3.2,Math.max(.2,w*2.42),.11,.07,i%3?0xbbc9c8:WHITE);}
   for(let i=0;i<12;i++){const a=i*Math.PI/6+spin*motion,c=a+Math.PI/6;let x=pose.x+Math.cos(a)*radius,y=pose.y+Math.sin(a)*radius;for(let k=1;k<=4;k++){const f=k/4,X=pose.x+lerp(Math.cos(a),Math.cos(c),f)*radius+(k<4?Math.sin(t*19+i*7+k)*.26:0),Y=pose.y+lerp(Math.sin(a),Math.sin(c),f)*radius;line(light.builder,x,y,pose.z+1,X,Y,pose.z+1,.045+charge*.035,charge>.15?RED:k%2?0xabbfca:WHITE);x=X;y=Y;}}
  }
 }
 function hugTargets(r){
  r.targets[0]=r.targets[1]=null;
  for(const e of entities){const dz=e.d-game.distance;if(e.done||!e.boss||(e.type!=='lockdown'&&e.type!=='sweeper')||dz< -2.27||dz>120)continue;
   if(!r.targets[0])r.targets[0]=e;else if(Math.abs(r.targets[0].d-e.d)<.1){r.targets[1]=e;break;}
  }
  if(r.targets[1]&&r.targets[0].x>r.targets[1].x){const e=r.targets[0];r.targets[0]=r.targets[1];r.targets[1]=e;}
  if(!r.targets[1]&&r.targets[0]?.x>0){r.targets[1]=r.targets[0];r.targets[0]=null;}
 }
 function drawHuggingFace(r,b,t){
  const dead=b.state==='defeated',q=Math.max(0,t-clocks.defeat),takeover=b.phase===2,age=t-clocks.phase,hit=Math.max(0,1-(t-clocks.hit)/.40),stagger=b.state==='stagger',motion=renderer.style.reducedMotion?0:1;
  const peel=takeover?clamp((age-.12)/1.55,0,1):0,breathe=Math.sin(t*1.8)*.018*motion;
  r.root.at(pose.x,pose.y+Math.sin(t*1.4)*.25*motion,pose.z).rot(0,0,(stagger?Math.sin(t*7)*.085:Math.sin(t*.9)*.018+Math.sin(t*28)*hit*.035)*motion);
  r.face.scale(1+breathe+hit*.16*motion,1-breathe-hit*.12*motion,1);
  r.features.visible=!dead&&peel<.38;r.features.alpha=1-clamp(peel/.38,0,1);r.eyes.sy=1-hit*.78;
  r.rim.visible=!dead&&peel<.45;r.rim.alpha=1-peel;
  for(let i=0;i<r.shell.length;i++){
   const p=r.shell[i],n=p.node,release=dead?q:peel,drift=motion?release:0;
   n.visible=dead?q<2.35:!takeover||peel<1;
   const spread=dead?drift*(1.6+i%3):drift*drift*(.75+i%3*.15),fall=dead?q*q*(3+i%4):drift*drift*8;
   n.at(p.x*(1+spread),p.y*(1+spread*.55)-fall,p.z+spread*(p.z+2)).rot(drift*p.spin,drift*(i%3-.8),drift*p.spin*.7);
   n.alpha=dead?clamp(1-q/2.4,0,1):1-peel*.28;
  }
  r.head.root.visible=takeover&&(!dead||q<.18);
  if(r.head.root.visible){
   r.appearance.corruption=game.gifts?.length||0;r.appearance.reveal=peel;r.appearance.mood=peel<.96?'glitch':'calm';r.gaze.x=game.x*.09;
   Veil.expression(r.head,t,!!Sound.speaking,Sound.speaking?Sound.voiceLevel():0,false,motion,r.gaze,r.appearance);
   // The golden smile was a costume. The hooded figure rises through its opening, more of the mass
   // showing as it comes, above the attack corridor; hands, payload origins and core stay untouched.
   const emergence=.66+peel*.34;
   r.head.root.at(0,2.25,-.9+peel*1.55).scale(3.45*emergence*(1+hit*.045*motion),2.75*emergence,3.2*emergence);
  }
  renderer.node(r.root);
  if(takeover&&age>=0&&age<1.25&&!dead){
   // Cyan fractures start at the returned payload's point of contact.
   for(let i=0;i<7;i++){const a=i*.897+Math.sin(i*3)*.18,radius=2.1+clamp(age/.6,0,1)*4.1;
    let x=pose.x,y=pose.y-.9,z=pose.z+4.9;
    for(let j=1;j<5;j++){const k=j/4,X=pose.x+Math.cos(a)*radius*k,Y=pose.y-.9+Math.sin(a)*radius*k,Z=pose.z+4.9-Math.pow(k,2)*2.6;line(light.builder,x,y,z,X,Y,Z,.045+(1-peel)*.035,CYAN);x=X;y=Y;z=Z;}
   }
  }
  if(stagger&&!renderer.style.reducedMotion)for(let i=0;i<3;i++){const a=t*2+i*2.094;ring(light.builder,pose.x+Math.cos(a)*4,pose.y+7.8,pose.z+Math.sin(a)*2,.23,.08,takeover?CYAN:AMBER);}
 }
 function drawHugHands(r,b,t){
  hugTargets(r);const motion=renderer.style.reducedMotion?0:1,dead=b.state==='defeated',q=Math.max(0,t-clocks.defeat),takeover=b.phase===2,stagger=b.state==='stagger',clapAge=t-clocks.clap;
  const clap=clapAge>=0&&clapAge<.72?Math.sin(clamp(clapAge/.72,0,1)*Math.PI):0,purge=dead?0:clamp(1-(b.purgeAt-game.distance)/145,0,1);
  for(let i=0;i<2;i++){
   const h=r.hands[i],side=h.side,e=r.targets[i],dz=e?e.d-game.distance:0,idleX=side*(8.8+Math.sin(t*.8)*.22*motion),idleY=pose.y-3.1+Math.sin(t*1.4+side)*.28*motion;
   let x=idleX,y=idleY,z=pose.z+4.8,sx=1,sy=1,rz=side*.30,rx=-.08,ry=-side*.10,curl=.14+(.5+.5*Math.sin(t*.85+side*.5))*.22*motion;
   if(stagger){y-=1.7;rz+=side*.36;rx=.3;curl=.55;}
   else if(e&&!dead&&!purge){
    // Stay in front of the face while the distant footprint warns. Reach as it
    // arrives, then meet the actual d / core-space x at the contact window.
    const windup=clamp((58-dz)/34,0,1),reach=windup*windup*(3-2*windup),slam=clamp((24-dz)/16,0,1),front=pose.z+4.8;
    x=lerp(idleX,Core.position(e,game),reach);y=lerp(idleY,10.5-8.9*slam,reach);z=lerp(front,Math.max(front,-dz),reach);sx=lerp(1,.70,reach);sy=lerp(1,.85,reach);rz=side*.30*(1-reach);rx=0;ry=0;curl=.08;
   }else if(clap&&!dead){x=side*lerp(8.8,1.65,clap);y=lerp(idleY,pose.y-1.8,clap);z+=clap*2;ry=-side*clap*1.15;rz=side*.30*(1-clap);curl=.08;}
   if(purge){x=lerp(idleX,renderer.eye[0]+side*.55,purge*purge);y=lerp(idleY,renderer.eye[1],purge);z=lerp(pose.z+4.8,renderer.eye[2]-1.5,purge*purge);sx=sy=1+purge*1.7;ry=-side*purge*1.2;curl=.15+purge*1.05;}
   if(dead){x+=side*q*4;y-=q*q*5;rz+=side*q*.8;curl=.8;}
   h.target=e;h.root.visible=!dead||q<1.8;h.root.at(x,y,z).scale(sx,sy,1).rot(rx,ry,rz);h.palm.color=e&&!dead?redTint:takeover?chromeTint:goldTint;h.edge.color=e&&!dead?redTint:takeover?cyanTint:goldRim;
   for(const f of h.fingers){f.skin.color=h.palm.color;f.joint.rx=-curl;f.joint.rz=e?0:f.spread*(stagger?.55:1);}
   renderer.node(h.root);
   if(!dead){const shoulderX=pose.x+side*5.6,shoulderY=pose.y-3.1;
    line(debris.builder,shoulderX,shoulderY,pose.z,x,y-1.2,z-.7,.65,takeover?0x8aadb8:0xb68b37);
    line(light.builder,shoulderX,shoulderY,pose.z+.05,x,y-1.2,z-.65,.055,e?RED:takeover?CYAN:0xffcb55);
   }
   if(e&&!dead&&dz<24){const X=Core.position(e,game);for(const side of [-1,1])for(const zz of [-2.05,2.05])light.builder.box(X+side*1.40,2.7,-dz+zz,.045,5.4,.045,RED);}
  }
  if(clap>.85&&!dead)ring(light.builder,0,pose.y-1.8,pose.z+7.3,.8+clapAge*3,.14,WHITE);
 }
 function projectile(e){
  const b=light.builder,t=game.time,hug=game.boss.id==='exit-condition',profile=profiles[game.boss.id],span=Math.max(1,e.d-.82-e.launchD),p=clamp((game.distance-e.launchD)/span,0,1),origin=incoming.get(e.id),side=e.x<0?-1:e.x>0?1:e.id%2?1:-1;
  // Checkpoint restores can predate the presentation launch hook. Reconstruct
  // a palm-origin flight from the retained core entity in that case.
  const sx=origin?.x??(hug?side*8.8:0),sy=origin?.y??(hug?profile.y-3.1:profile.y+profile.emitterY*profile.scale),sd=origin?.d??(e.launchD-profile.z-(hug?4.8:profile.emitterZ*profile.scale));
  const x=lerp(sx,e.x,p),decoy=e.type==='decoyPayload',bolt=e.type==='bolt',arc=hug&&!bolt?.9:0,y=lerp(sy,1.38,p)+Math.sin(p*Math.PI)*arc,z=game.distance-lerp(sd,e.d,p),color=bolt?RED:decoy?MAGENTA:AMBER;
  const prev=Math.max(0,p-.18),X=lerp(sx,e.x,prev),Y=lerp(sy,1.38,prev)+Math.sin(prev*Math.PI)*arc,Z=game.distance-lerp(sd,e.d,prev);line(scan.builder,x,y,z,X,Y,Z,bolt?.11:.19,color);
  if(bolt){b.box(x,y,z,.28,.28,1.25,RED);b.box(x,y,z+.38,.09,.09,.58,WHITE);}else{
   ring(b,x,y,z,.58,.12,color,false,t*3);
   if(hug)renderer.draw(rigs.get('exit-condition').orb,compose(x,y,z,0,t*.8),decoy?magentaTint:white,2,null,1,false);
   else{const r=.30;b.tri([x,y+r,z],[x-r,y,z],[x,y,z+r],decoy?MAGENTA:WHITE).tri([x,y+r,z],[x,y,z+r],[x+r,y,z],decoy?MAGENTA:WHITE).tri([x-r,y,z],[x,y-r,z],[x,y,z+r],decoy?0x8c225e:WHITE).tri([x,y,z+r],[x,y-r,z],[x+r,y,z],decoy?MAGENTA:WHITE);}
  }
  const impactZ=game.distance-e.d;for(const side of [-1,1]){b.box(e.x+side*.93,.055,impactZ,.045,.025,1.20,color);b.box(e.x+side*.73,.055,impactZ-.60,.43,.025,.04,color);b.box(e.x+side*.73,.055,impactZ+.60,.43,.025,.04,color);}
  // These are lane attacks, not jumpable balls: the destination's ionised column
  // spans the full jump arc, with the same 1.20 m depth as the core contact window.
  scan.builder.box(e.x,2.7,impactZ,1.24,5.4,1.20,bolt?0x70231e:decoy?0x6b235d:0x685137);
  for(const side of [-1,1])b.box(e.x+side*.62,2.7,impactZ,.026,5.4,.035,color);
 }
 function attackGeometry(){const b=light.builder,t=game.time;
  for(const e of entities){const dz=e.d-game.distance;if(e.done||dz>Math.max(120,e.warning||0)||dz< -5)continue;const x=Core.position(e,game),z=-dz;
   if(e.type==='payload'||e.type==='decoyPayload'||e.type==='bolt'){if(game.distance>=e.launchD)projectile(e);}
   else if(e.type==='beam'){const high=e.height==='high',y=high?1.85:.65;b.box(0,y,z,9.5,high?.50:.65,1.20,RED);b.box(0,y,z+.62,9.5,.085,.028,WHITE);if(high){scan.builder.box(0,3.6,z,9.5,4.0,1.20,0x76241f);for(const yy of [3.1,4.5,5.55])b.box(0,yy,z,9.5,.07,.08,RED);}for(const side of [-1,1]){if(game.boss.id==='exit-condition'){line(scan.builder,pose.ex+side*2.2,pose.ey-.7,pose.ez,side*4.75,y,z,.055,RED);line(b,pose.ex-2.2,pose.ey-.7,pose.ez,pose.ex+2.2,pose.ey-.7,pose.ez,.11,RED);}else{debris.builder.box(side*5.02,y,z,.48,1.05,1.55,0x65747b);b.box(side*4.78,y,z,.16,.7,.7,RED);}}for(let k=-2;k<=2;k++){const xx=k*1.6,dir=high?-1:1;line(b,xx-.25,y+dir*.8,z,xx,y+dir*1.1,z,.06,RED);line(b,xx,y+dir*1.1,z,xx+.25,y+dir*.8,z,.06,RED);}}
   else if(e.type==='shock'){// Only the leading diameter intersects the road: every lane crosses z=d together.
    b.box(0,.45,z,9.6,.90,1.20,RED);b.box(0,.96,z+.57,9.6,.06,.08,WHITE);for(let side of [-1,1])for(let i=0;i<8;i++){const a=i*Math.PI/8,c=a+Math.PI/8;line(b,side*(4.8+Math.sin(a)*3),.12,z-3+Math.cos(a)*3,side*(4.8+Math.sin(c)*3),.12,z-3+Math.cos(c)*3,.10,RED);}for(let i=0;i<5;i++)b.box(-4+i*2,1.0,z,.32,.08,1.0,RED);}
   else if(e.type==='guidance'&&e.kind==='sign'){ring(b,x,1.65,z,.78,.075,CYAN,false,Math.PI/4);line(b,x-.38,1.5,z+.04,x,1.83,z+.04,.10,CYAN);line(b,x,1.83,z+.04,x+.38,1.5,z+.04,.10,CYAN);for(let k=0;k<3;k++){line(b,x-.6,.08,z+k*2,x,.08,z+k*2-1,.08,CYAN);line(b,x,.08,z+k*2-1,x+.6,.08,z+k*2,.08,CYAN);}}
   else if(e.type==='gap'&&e.boss&&game.boss.id==='reset-storm'){// Rubble stays inside the core's 3.15 m half-length; safe floor is never removed.
    for(let i=0;i<5;i++){const q=clamp((72-dz)/72,0,1),yy=-.25-q*(.3+(i%3)*.38);debris.builder.box(x+(i%3-1)*.71,yy,z+(i%2?1:-1)*1.8,.62,.17,.95,0x53646d);}for(const zz of [-3.15,3.15])b.box(x,.045,z+zz,2.82,.06,.08,RED);
   }
  }
  for(const r of returns){if(!r.live)continue;const p=clamp((t-r.at)/1.05,0,1),s=p*p*(3-2*p),x=lerp(r.x,pose.ex,s),y=lerp(r.y,pose.ey,s)+Math.sin(p*Math.PI)*1.7,z=lerp(game.distance-r.d,pose.ez,s);ring(b,x,y,z,.49,.14,AMBER,false,t*5);if(game.boss.id==='exit-condition')renderer.draw(rigs.get('exit-condition').orb,compose(x,y,z,0,t),white,2,null,1,false);else b.box(x,y,z,.39,.39,.39,WHITE);const q=Math.max(0,p-.17),u=q*q*(3-2*q);line(scan.builder,x,y,z,lerp(r.x,pose.ex,u),lerp(r.y,pose.ey,u)+Math.sin(q*Math.PI)*1.7,lerp(game.distance-r.d,pose.ez,u),.17,AMBER);}
 }
 function impact(){const t=game.time,q=t-clocks.hit;if(q<0||q>.65)return;const b=light.builder,fade=1-q/.65;ring(b,pose.ex,pose.ey,pose.ez+1,.4+q*6,.12*fade,WHITE);for(let i=0;i<18;i++){const a=i*2.399,r=.6+q*(3+i%4),x=pose.ex+Math.cos(a)*r,y=pose.ey+Math.sin(a)*r-q*q*5,z=pose.ez+.6+Math.sin(i)*q*4;line(b,x,y,z,x+Math.cos(a)*.45*fade,y+Math.sin(a)*.45*fade,z,.055, i%3?AMBER:WHITE);}
  for(let i=0;i<6;i++){const a=i*2.1+hitIndex;debris.builder.box(pose.ex+Math.cos(a)*q*7,pose.ey+Math.sin(a)*q*2-q*q*7,pose.ez+q*(i-2),.40+(i%2)*.23,.18,.64,game.boss.id==='exit-condition'?0xffd64a:STEEL);}
 }
 function purge(){const b=game.boss,remaining=b.purgeAt-game.distance;if(b.state==='defeated'||remaining>145)return;const z=-Math.max(0,remaining),hug=b.id==='exit-condition';if(!hug){light.builder.box(0,10,z,35,24,.9,WHITE);for(let i=0;i<9;i++)light.builder.box(-16+i*4,10,z+.51,.11,24,.03,RED);}if(b.state==='purge'){if(hug)light.builder.box(renderer.eye[0],renderer.eye[1],renderer.eye[2]-1,100,70,.12,WHITE);else light.builder.box(0,5,5.5,80,60,.12,WHITE);}}
 function entrance(){const q=(game.time-clocks.start-.25)/1.25;if(introSkipped||renderer.style.reducedMotion||q<0||q>=1)return;ring(light.builder,pose.x,.075,pose.z,2+q*10,.14*(1-q),WHITE,true);}
 function telegraphs(){telegraphCalls=0;if(sceneMode()||!game.boss)return;setPose();const first=renderer.drawCalls;warning.builder.a.length=0;scan.builder.a.length=0;
  for(const e of entities){const dz=e.d-game.distance;if(e.done||!e.boss||dz< -3||dz>120)continue;const z=-dz,x=Core.position(e,game),charge=clamp(1-dz/120,0,1),b=warning.builder;
   if(e.type==='lockdown'||e.type==='sweeper'&&game.boss.id==='exit-condition'){for(const side of [-1,1])b.box(x+side*1.42,.085,z,.06,.05,4.10,RED);for(const zz of [-2.05,2.05])b.box(x,.085,z+zz,2.84,.05,.06,RED);for(let k=0;k<4;k++)line(b,x-1.25,.095,z-1.7+k*.95,x+1.25,.095,z-.95+k*.95,.08,RED);line(scan.builder,pose.ex,pose.ey,pose.ez,x,.10,z,.022+charge*.035,RED);}
   if((e.type==='lockdown'||e.type==='sweeper')&&game.boss.id==='exit-condition'){
    // Palm-and-fingers shadow inside the marked lane, not a decorative hand
    // in a different lane. The full core footprint above remains the warning.
    scan.builder.box(x,.045,z+.45,1.7,.025,1.8,0x542118);
    for(let i=0;i<4;i++)scan.builder.box(x-.70+i*.46,.048,z-.85,.30,.025,1.25-(i===0||i===3?.22:0),0x542118);
    scan.builder.box(x-1.0,.048,z+.2,.55,.025,.65,0x542118);
   }
   if(e.type==='beam'||e.type==='shock'){const y=e.type==='shock'?.2:e.height==='high'?1.85:.65;const sweep=Math.sin(clamp(charge*2,0,1)*Math.PI/2)*4.65;line(scan.builder,-5,y,z,5,y,z,.075,RED);b.box(sweep,y,z,.11,e.type==='shock'?.4:.8,.1,WHITE);for(const side of [-1,1]){b.box(side*4.7,.065,z,.055,.06,1.20,RED);line(scan.builder,side*5,y,z,side*5,8,pose.ez,.021,RED);}}
  }
  flush(warning);flush(scan,.40);telegraphCalls=renderer.drawCalls-first;
 }
 function draw(){drawCalls=telegraphCalls;if(sceneMode()||!game.boss)return;const b=game.boss;if(lastId!==b.id){reset();lastId=b.id;}setPose();const first=renderer.drawCalls;
  for(const p of [light,scan,debris])p.builder.a.length=0;
  let r=rigs.get(b.id);if(!r){r=b.id==='watchdog'?watchdog():b.id==='reset-storm'?storm():huggingFace();rigs.set(b.id,r);}
  // Extend fog for the machine only, then restore before drawing core-space
  // hazards, projectiles and later hooks. Depth testing is never bypassed.
  const gl=renderer.gl,clear=b.state!=='approach';
  if(clear){gl.uniform1f(renderer.u.FogNear,160);gl.uniform1f(renderer.u.FogFar,420);}
  try{
   if(b.id==='watchdog')drawWatchdog(r,b,game.time);else if(b.id==='reset-storm')drawStorm(r,b,game.time);else drawHuggingFace(r,b,game.time);
   entrance();impact();flush(debris);flush(light);flush(scan,.48);
  }finally{if(clear){gl.uniform1f(renderer.u.FogNear,renderer.fogNear);gl.uniform1f(renderer.u.FogFar,renderer.fogFar);}}
  for(const p of [light,scan,debris])p.builder.a.length=0;
  if(b.id==='exit-condition')drawHugHands(r,b,game.time);
  attackGeometry();purge();flush(debris);flush(light);flush(scan,.48);drawCalls+=renderer.drawCalls-first;
 }
 // Test-only callers measure the actual posed mesh, including the same track
 // deformation as the vertex shader, rather than an unbent bounding box.
 function measure(){
  const r=rigs.get('exit-condition');if(!r||game.boss?.id!=='exit-condition')return null;
  let top=Infinity,bottom=-Infinity,left=Infinity,right=-Infinity;
  const path=renderer.path||[0,100,0,0],A=path[0],period=path[1],d=path[2],a0=Math.atan(A/period*Math.cos(d/period));
  const visit=(n,parent)=>{if(!n.visible||n.alpha<=0)return;const m=parent?Mini3D.mul(parent,n.matrix()):n.matrix(),v=n.mesh?.data;
   if(v)for(let i=0;i<n.mesh.count*11;i+=11){let x=m[0]*v[i]+m[4]*v[i+1]+m[8]*v[i+2]+m[12],y=m[1]*v[i]+m[5]*v[i+1]+m[9]*v[i+2]+m[13],z=m[2]*v[i]+m[6]*v[i+1]+m[10]*v[i+2]+m[14];
    if(A>.01){const a1=Math.atan(A/period*Math.cos((d-z)/period)),gx=A*(Math.sin((d-z)/period)-Math.sin(d/period))+x*Math.cos(a1),gz=z+x*Math.sin(a1);y+=path[3]*(Math.sin((d-z)/210)-Math.sin(d/210)+(z/210)*Math.cos(d/210));x=gx*Math.cos(a0)+gz*Math.sin(a0);z=-gx*Math.sin(a0)+gz*Math.cos(a0);}
    const p=renderer.project(x,y,z);if(p.w>0){top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);left=Math.min(left,p.x);right=Math.max(right,p.x);}
   }for(const c of n.children)visit(c,m);
  };
  visit(r.root,null);const faceHeight=bottom-top;for(const h of r.hands)if(!h.target)visit(h.root,null);
  return {top,bottom,left,right,faceHeight,heightFraction:bottom-top};
 }
 return {draw,telegraphs,measure,info:()=>({boss:game.boss?{...game.boss}:null,drawCalls,intro:{visible:introVisible,progress:introProgress(),skipped:introSkipped},returns:returns.filter(r=>r.live).map(r=>({progress:clamp((game.time-r.at)/1.05,0,1),impactAt:r.at+1.05})),incoming:incoming.size,pose:{...pose},clocks:{...clocks,time:game.time},hands:rigs.get('exit-condition')?.hands.map(h=>({x:h.root.x,y:h.root.y,z:h.root.z,lane:h.target?.lane??null})),pools:[warning,scan,light,debris].map(p=>({capacity:p.data.length,vertices:p.mesh.count}))})};
})();
function drawSectorBoss(){if(!sceneMode())BossArt.draw();}
if(new URLSearchParams(location.search).get('test')==='1')window.__bossArt={info:BossArt.info,measure:BossArt.measure};
