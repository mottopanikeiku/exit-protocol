/* EXIT PROTOCOL / realtime art direction. All geometry is original; no poster planes.
   Faceted shells, continuous ragged cloth, stage masonry and layered signal architecture. */
function facetedShell(rings,colors=[0xffffff],sides=8,offset=Math.PI/8){
 const b=new Builder();const p=(r,i)=>{const a=(i/sides)*Math.PI*2+offset;return [Math.cos(a)*r[1]+(r[3]||0),r[0],Math.sin(a)*r[2]+(r[4]||0)];};
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
  const a=p(rings[j],i),c=p(rings[j+1],(i+1)%sides),q=p(rings[j+1],i),d=p(rings[j],(i+1)%sides);
  b.tri(a,q,c,colors[(i+j)%colors.length]);b.tri(a,c,d,colors[(i+j+1)%colors.length]);
 }
 for(let i=0;i<sides;i++){b.tri([rings[0][3]||0,rings[0][0],rings[0][4]||0],p(rings[0],i),p(rings[0],(i+1)%sides),colors[i%colors.length]);const r=rings.at(-1);b.tri([r[3]||0,r[0],r[4]||0],p(r,(i+1)%sides),p(r,i),colors[i%colors.length]);}
 return b;
}
function cutPlate(w,h,d,cut=.2){
 const b=new Builder(),v=[[-w*.5+cut*w,h*.5], [w*.5-cut*w,h*.5],[w*.5,h*(.5-cut)],[w*.5,-h*(.5-cut)],[w*.5-cut*w,-h*.5],[-w*.5+cut*w,-h*.5],[-w*.5,-h*(.5-cut)],[-w*.5,h*(.5-cut)]];
 const shades=[0xffffff,0xc9d0d5,0x8b9aab,0xe8edf1,0x738392,0xafbfcc,0xc8d0d8,0x93a2b1];
 for(let i=0;i<8;i++){const a=v[i],n=v[(i+1)%8];b.tri([0,0,d*.63],[...a,d*.4],[...n,d*.4],shades[i]);b.quad([...a,d*.4],[...a,-d*.5],[...n,-d*.5],[...n,d*.4],0x8795a3);b.tri([0,0,-d*.5],[...n,-d*.5],[...a,-d*.5],0x8f99a6);}return b;
}
function dynamicMeshUpdate(R,mesh,b){const data=new Float32Array(b.a);if(mesh.data.length!==data.length)R.gl.bufferData(R.gl.ARRAY_BUFFER,data,R.gl.DYNAMIC_DRAW);else R.gl.bufferSubData(R.gl.ARRAY_BUFFER,0,data);mesh.data=data;mesh.count=data.length/11;R.lastBuffer=null;}
// Exact critically damped integration stays stable at both fixed and display cadence.
var Feel;
function motionSpring(s,key,target,dt,omega=22){
 let p=s[key];if(!p)p=s[key]={x:target,v:0};
 const x=p.x-target,b=p.v+omega*x,e=Math.exp(-omega*dt);
 p.x=target+(x+b*dt)*e;p.v=(p.v-omega*b*dt)*e;return p.x;
}
function buildHero(){const h=ArtRig.agent(renderer);h.motion={springs:{},distance:null,cycle:0,air:0,flinch:0,land:0,lastLane:0};return h;}
function animateFabric(h,title,dt=0){
 const m=h.motion,s=m.springs;
 const cloth=h.cloth||(h.cloth={});
 cloth.stream=motionSpring(s,'clothStream',title?0:game.boost?1.25:clamp(game.speed/42,.4,1),dt,8);
 cloth.side=motionSpring(s,'clothSide',title?-.15:clamp((game.lane*3.2-game.x)*.6,-1.7,1.7),dt,7);
 cloth.lift=motionSpring(s,'clothLift',title?0:clamp(game.vy*.035,-.35,.45),dt,10);
 if(!Feel)ArtRig.fabric(h,renderer.style.reducedMotion?0:now,title,game.boost,cloth.side);
}


let hero=buildHero();


function hugTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#ffcf56';x.beginPath();x.arc(128,120,110,0,Math.PI*2);x.fill();x.strokeStyle='#564133';x.lineWidth=11;x.lineCap='round';for(const a of [88,168]){x.beginPath();x.arc(a,104,14,Math.PI*1.08,Math.PI*1.92);x.stroke();}x.beginPath();x.arc(128,123,37,.17,Math.PI-.17);x.stroke();x.fillStyle='#fb9062';for(const a of [57,199]){x.beginPath();x.ellipse(a,134,18,10,0,0,Math.PI*2);x.fill();}return renderer.texture(c);}
const hugLogo=hugTexture();
function animateHero(dt,title=false){
 const h=hero,m=h.motion,s=m.springs,quiet=renderer.style.reducedMotion;
 if(status==='dying')return;
 if(m.title!==title){m.title=title;m.distance=game.distance;m.lastLane=game.lane;m.snap=true;}
 if(!m.nodes){m.nodes=[h.root,h.upper,h.head,...h.arms,...h.forearms,...h.legs,...h.knees];m.props=['x','y','z','rx','ry','rz','sx','sy','sz'];m.before=new Float32Array(m.nodes.length*9);m.after=new Float32Array(m.before.length);}
 m.before.set(m.after);
 const joint=(n,k,v,w=26)=>{n[k]=motionSpring(n.motion||(n.motion={}),k,v,dt,w);};
 const traveled=m.distance===null?0:clamp(game.distance-m.distance,0,game.speed*.12);m.distance=game.distance;
 if(!title&&game.countdown<=0)m.cycle=(m.cycle+traveled/(game.boost?13.2:11.8))%1;
 phase=m.cycle*Math.PI*2;
 const wave=Math.sin(phase),bob=(1-Math.cos(phase*2))*.034,run=game.countdown<=0?1:0;
 const lane=clamp((game.lane*3.2-game.x)*.13,-.25,.25);
 // A lateral velocity impulse provides a tiny overshoot after the hips arrive.
 if(game.lane!==m.lastLane){const p=s.hip||(s.hip={x:0,v:0});p.v+=(game.lane-m.lastLane)*1.35;m.lastLane=game.lane;}
 const hip=motionSpring(s,'hip',lane,dt,13);
 m.land=Math.max(0,m.land-dt*2.8);m.flinch=Math.max(0,m.flinch-dt*3.8);
 m.air=game.y>.015?m.air+dt:0;
 const slide=motionSpring(s,'slide',!title&&game.slide>0?1:0,dt,32);
 const air=motionSpring(s,'air',!title&&game.y>.015?1:0,dt,30);
 const boost=motionSpring(s,'boost',!title&&game.boost?1:0,dt,17);
 const squash=motionSpring(s,'squash',m.land,dt,28);
 const flinch=motionSpring(s,'flinch',m.flinch,dt,35);
 h.root.visible=true;h.root.alpha=!title&&game.invulnerable>0&&!quiet?.62+.38*(.5+.5*Math.sin(now*34)):1;
 // Presentation scale only: core jump heights and collision volumes stay unchanged.
 h.root.scale(title?(innerWidth<760?1.13:1.45):.9);h.root.at(title?(innerWidth<760?1.30:3.50):game.x,title?-.02:game.y+bob*run*(1-slide)*(1-air)-squash*.14, title?1.5:0);
 h.root.ry=title?-.57+Math.sin(now*.25)*.045:Math.PI;
 joint(h.root,'rz',title?0:(quiet?0:hip*.8),18);
 joint(h.upper,'y',title?1.45+Math.sin(now*1.6)*.018:1.45-slide*.72-squash*.15,30);
 joint(h.upper,'rx',title?.018*Math.sin(now*1.3):.08+boost*.22+slide*.75+flinch*.36-squash*.12,27);
 joint(h.upper,'ry',title?.02*Math.sin(now*.7):-wave*.07*run*(1-air)*(1-slide)+hip*.38,24);
 joint(h.upper,'rz',title?0:wave*.027*run*(1-slide)+hip*.35+flinch*.12,22);
 joint(h.head,'ry',title?-.20+Math.sin(now*.36)*.10:-lane*.9-h.upper.ry*.48,17);
 joint(h.head,'rx',title?.025:-h.upper.rx*.55-air*.08,20);
 joint(h.head,'rz',title?0:-h.upper.rz*.65-h.root.rz*.7,18);
 for(let i=0;i<2;i++){
  const side=i?1:-1,u=(m.cycle+i*.5)%1,plant=.27;
  const t=u<plant?u/plant:(u-plant)/(1-plant),smooth=t*t*(3-2*t);
  const stride=u<plant?lerp(-.88,.85,t):lerp(.85,-.88,smooth);
  const knee=u<plant?.10+Math.sin(t*Math.PI)*.13:.10+Math.sin(t*Math.PI)*1.30;
  const takeoff=1-clamp(m.air/.16,0,1),rise=clamp(game.vy/12,0,1),fall=clamp(-game.vy/12,0,1);
  const airLeg=i? .34+rise*.1-fall*.63 : -.62-takeoff*.25+fall*.28;
  const airKnee=i?.70+rise*.55-fall*.50:.50+takeoff*.38+rise*.18-fall*.37;
  let thigh=lerp(stride*(1+boost*.13)*run,airLeg,air),bend=lerp(knee*run+.04,airKnee,air);
  thigh=lerp(thigh,i?-1.35:-1.04,slide);bend=lerp(bend,i?1.94:.28,slide);
  joint(h.legs[i],'y',1.46-slide*.76-squash*.15,30);
  joint(h.legs[i],'rx',title?(i?-.08:.04):thigh+squash*.25,46);
  joint(h.legs[i],'ry',title?0:wave*.055*side*(1-air)*(1-slide)+hip*.32,25);
  joint(h.legs[i],'rz',title?side*.02:side*.02-hip*.28,22);
  joint(h.knees[i],'rx',title?.10:bend+squash*.42,42);
  const arm=-stride*.74*(1+boost*.22)*run-.20;
  joint(h.arms[i],'rx',title?(i?.12:-.18):lerp(lerp(arm,i?-.46:-.80,air),i?-.28:-.88,slide)-flinch*(i?.65:.2),33);
  joint(h.arms[i],'rz',side*(title?.12:.10+air*.09)+hip*.20,23);
  joint(h.forearms[i],'rx',title?-.26:-.64-Math.max(0,-stride)*.28-boost*.17+slide*.18,20);
 }
 h.visorGlow.alpha=.20+(title?.04:boost*.10);
 animateFabric(h,title,dt);
 let k=0;for(const n of m.nodes)for(const p of m.props)m.after[k++]=n[p];
 if(m.snap||dt===0){m.before.set(m.after);m.snap=false;}
}
function addStaticCylinder(b,x,y,z,rt,rb,h,col,n=8){b.append(new Builder().cylinder(rt,rb,h,n,col).transform(compose(x,y,z)));}
