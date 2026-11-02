/* Power presentation reads the deterministic core; it never awards credit or changes a timer. */
const PowerArt=(()=>{
 const colors={cache:0xffb347,snapshot:0x6fffe9,overclock:0xa98bff},tints={cache:rgb(colors.cache),snapshot:rgb(colors.snapshot),overclock:rgb(colors.overclock)};
 const models={},flights=Array.from({length:64},()=>({live:false,at:0,x:0,y:0,d:0}));
 let flightIndex=0,breakAt=-100,breakX=0,breakY=0,breakD=0;
 const motion=()=>!reduced&&!renderer.style.reducedMotion;
 const mesh=(builder,color=0xffffff,material=2)=>new Node(renderer.mesh(builder),color,material);
 function arc(builder,r,from,to,width,color){for(let i=0;i<12;i++){const a=from+(to-from)*i/12,b=from+(to-from)*(i+1)/12;builder.quad([Math.cos(a)*r,Math.sin(a)*r,.03],[Math.cos(b)*r,Math.sin(b)*r,.03],[Math.cos(b)*(r+width),Math.sin(b)*(r+width),.03],[Math.cos(a)*(r+width),Math.sin(a)*(r+width),.03],color);}return builder;}
 function bolt(){const b=new Builder(),p=[[.18,1.05],[-.68,-.09],[-.09,-.09],[-.30,-1.05],[.70,.22],[.09,.22]];
  for(const [a,c,d] of [[0,1,2],[0,2,5],[2,3,4],[2,4,5]]){b.tri([...p[a],.14],[...p[c],.14],[...p[d],.14]);b.tri([...p[d],-.14],[...p[c],-.14],[...p[a],-.14]);}
  for(let i=0;i<p.length;i++){const a=p[i],beyond=p[(i+1)%p.length];b.quad([...a,-.14],[...beyond,-.14],[...beyond,.14],[...a,.14]);}return b;
 }
 const chip=new Builder().box(0,0,0,1.05,1.05,.30,0x574425).box(0,0,.18,.77,.77,.08,colors.cache).box(0,0,.24,.40,.40,.06,0xffefd0);
 for(const side of [-1,1])for(let i=0;i<4;i++){const p=-.36+i*.24;chip.box(side*.63,p,0,.25,.10,.18,colors.cache).box(p,side*.63,0,.10,.25,.18,colors.cache);}
 models.cache=new Node().add(mesh(chip),mesh(arc(arc(new Builder(),1.00,-1.18,1.18,.075,colors.cache),1.17,Math.PI-1.18,Math.PI+1.18,.06,colors.cache)));
 const hex=renderer.mesh(new Builder().torus(.97,.055,6,4));
 models.snapshot=new Node().add(new Node(hex,colors.snapshot,2),new Node(hex,colors.snapshot,2).rot(0,Math.PI/3),new Node(hex,colors.snapshot,2).rot(0,-Math.PI/3),mesh(new Builder().torus(.60,.035,6,3),0xe6fff9));
 const boltMesh=renderer.mesh(bolt());models.overclock=new Node().add(new Node(boltMesh,colors.overclock,2),new Node(boltMesh,0xf2eaff,2).at(0,0,.17).scale(.54,.66,.3));
 const floorRing=renderer.mesh(new Builder().torus(1,.025,24,3)),bubble=renderer.mesh(new Builder().sphere(1,12,6)),shieldWire=renderer.mesh(new Builder().torus(1.25,.018,6,3)),shard=renderer.mesh(new Builder().tri([-.11,-.16,0],[.15,-.08,0],[0,.20,0]));
 for(const type of Object.keys(models)){const root=models[type];root.snap=false;root.add(textNode(labelTexture(type.toUpperCase(),'','#111920','#'+colors[type].toString(16)),0,1.60,0,2.4,.55));}
 const style=document.createElement('style');style.textContent=`
 #power-hud{position:fixed;z-index:19;top:min(var(--power-top,108px),calc(35vh - 32px));right:12px;max-width:calc(100vw - 24px);display:flex;gap:var(--space-1);pointer-events:none}
 #power-hud[hidden],#power-hud .power-chip[hidden]{display:none}
 #power-hud .power-chip{box-sizing:border-box;display:flex;align-items:center;gap:var(--space-1);height:28px;padding:var(--space-1) var(--space-2);background:var(--color-panel);border:1px solid var(--color-line);border-left:3px solid var(--power-color);color:var(--power-color);white-space:nowrap}
 #power-hud strong{font:700 11px var(--font-display);letter-spacing:.02em}
 #power-hud .power-time{font:13px var(--font-mono);font-variant-numeric:tabular-nums;color:var(--color-text);min-width:2ch;text-align:right}
 @media(max-width:400px){#power-hud .power-chip{padding:var(--space-1);gap:var(--space-1)}}
 `;document.head.appendChild(style);
 const hud=document.createElement('div');hud.id='power-hud';hud.hidden=true;hud.setAttribute('aria-label','Active power-ups');document.body.appendChild(hud);
 const chips={};for(const [type,token] of [['cache','amber'],['snapshot','signal'],['overclock','player']]){const chip=document.createElement('div'),name=document.createElement('strong'),time=document.createElement('span');chip.className='power-chip';chip.style.setProperty('--power-color',`var(--color-${token})`);name.textContent=type.toUpperCase();time.className='power-time';chip.append(name,time);hud.appendChild(chip);chips[type]={chip,time,seconds:-1};}
 function updateHUD(){let active=false;for(const type of Object.keys(chips)){const c=chips[type],ticks=game.power?.[type]||0;c.chip.hidden=!ticks;if(ticks){active=true;const seconds=Math.ceil(ticks/60);if(seconds!==c.seconds){c.time.textContent=seconds+'s';c.seconds=seconds;}}}hud.hidden=!active||!['running','paused'].includes(status)||!!modalKind;}
 function sound(name){if(Sound.hasEffect(name))Sound.effect(name);}
 hook('event',e=>{
  if(e.type==='power'&&e.power!=='overclock')sound({cache:'collect',snapshot:'checkpoint'}[e.power]);
  if(e.type==='powerEnd'&&e.power!=='snapshot')sound('tick');
  if(e.type==='paper'&&e.magnet&&motion()){const p=flights[flightIndex++%flights.length];p.live=true;p.at=game.time;p.x=e.entity.x;p.y=e.entity.y;p.d=e.entity.d;}
  if(e.type==='shieldBreak'){breakAt=game.time;breakX=game.x;breakY=game.y;breakD=game.distance;sound('reflect');}
 });
 function draw(){if(!['running','paused'].includes(status))return;const t=game.time,moving=motion();
  for(const e of entities){if(e.done||e.kind!=='power')continue;const z=worldDistance-e.d;if(z<-160)break;if(z>8)continue;const root=models[e.type];root.at(e.x,e.y+(moving?Math.sin(t*2.8+e.id)*.12:0),z).rot(0,moving?Math.sin(t*1.6+e.id)*.25:0,0);renderer.node(root);renderer.draw(floorRing,compose(e.x,.08,z,Math.PI/2,0,0,.9,.9,.9),tints[e.type],2,null,.65,false);}
  const power=game.power;if(!power)return;
  renderer.gl.depthMask(false);
  for(const e of entities)if(!e.done&&e.kind==='power'&&e.type==='snapshot'&&e.d-worldDistance<160&&e.d-worldDistance>-8)renderer.draw(bubble,compose(e.x,e.y,worldDistance-e.d,0,0,0,1.02,1.02,1.02),tints.snapshot,2,null,.09,false);
  if(power.snapshot>0){const y=game.y+1.75;renderer.draw(bubble,compose(game.x,y,0,0,0,0,1.36,1.94,1.36),tints.snapshot,2,null,.07,false);for(let i=0;i<3;i++)renderer.draw(shieldWire,compose(game.x,y,0,0,i*Math.PI/3,0,1,1.48,1),tints.snapshot,2,null,.62,false);}
  if(power.overclock>0){for(let i=0;i<3;i++){const a=moving?t*3+i*2.1:i*2.1;renderer.draw(floorRing,compose(game.x,game.y+.12+i*.40,0,Math.PI/2,.10*Math.sin(a),0,1.35+i*.1,1.35+i*.1,1),tints.overclock,2,null,.65-i*.16,false);}
   for(let i=0;i<6;i++){const z=moving?(t*7+i*.63)%4:i*.6,side=i%2?1:-1;renderer.draw(boltMesh,compose(game.x+side*(.70+z*.12),game.y+.7+z*.12,z,.1,0,-side*.18,.14,.30,.14),tints.overclock,2,null,(1-z/5)*.65,false);}}
  if(moving){
   for(const p of flights){if(!p.live)continue;const age=(t-p.at)/.38;if(age>=1){p.live=false;continue;}const q=clamp(age,0,1);for(let i=0;i<3;i++){const k=Math.max(0,q-i*.10),ease=k*k*(3-2*k),x=lerp(p.x,game.x,ease),y=lerp(p.y,game.y+1.6,ease)+Math.sin(k*Math.PI)*.6,z=lerp(worldDistance-p.d,0,ease);renderer.draw(meshes.box,compose(x,y,z,0,0,-.2,.13-i*.025,.08, .40-i*.08),tints.cache,2,null,(1-q*.4)*(1-i*.25),false);}}
   const age=t-breakAt;if(age>=0&&age<.75)for(let i=0;i<18;i++){const a=i*Math.PI/9,r=1.25+age*4,x=breakX+Math.cos(a)*r,y=breakY+1.75+Math.sin(a)*(1.7+age*2)-age*age*5,z=worldDistance-breakD+Math.sin(i*2.4)*(.5+age*3);renderer.draw(shard,compose(x,y,z,a+age*4,a*2,age*3,1.6,1.6,1.6),tints.snapshot,2,null,1-age/.75,false);}
  }
  renderer.gl.depthMask(true);
 }
 hook('hud',updateHUD);hook('draw',draw);hook('reset',()=>{for(const p of flights)p.live=false;breakAt=-100;updateHUD();});
 return {updateHUD};
})();
