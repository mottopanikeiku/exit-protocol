/* SIGNAL EDITION / original real-time geometry, built to the approved art direction.
   The approved key art and character sheets are separate, embedded image assets.
   No generated screenshots, remote assets, physics overrides or mesh dependencies. */
const ArtRig = (()=>{
 const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
 const graphite=0x19202b,shadow=0x080e17,slate=0x343d4b,cyan=0x95eee2;
 // A closed convex plate, with a narrow chamfer and separately shaded facets.
 function plate(points,z=.1,depth=.06,tint=0xffffff,bevel=.12){
  points=points.slice();let area=0;for(let i=0;i<points.length;i++){const q=points[(i+1)%points.length];area+=points[i][0]*q[1]-q[0]*points[i][1];}if(area<0)points.reverse();
  const b=new Builder(),n=points.length,c=points.reduce((a,p)=>[a[0]+p[0]/n,a[1]+p[1]/n],[0,0]);
  const outer=points.map(p=>[p[0],p[1],z-depth*.30]);
  const inner=points.map(p=>[p[0]*(1-bevel)+c[0]*bevel,p[1]*(1-bevel)+c[1]*bevel,z]);
  const rgbc=rgb(tint),shade=f=>rgbc.map(x=>x*f);
  for(let i=0;i<n;i++){
   const j=(i+1)%n;
   b.tri([c[0],c[1],z+.008],inner[i],inner[j],shade([1,.94,1.06,.91,1.01,.97][i%6]));
   b.quad(inner[i],outer[i],outer[j],inner[j],shade([.65,.84,.57,.70][i%4]));
   b.quad(outer[i],[outer[i][0],outer[i][1],z-depth],[outer[j][0],outer[j][1],z-depth],outer[j],shade(.48));
   b.tri([c[0],c[1],z-depth],[outer[j][0],outer[j][1],z-depth],[outer[i][0],outer[i][1],z-depth],shade(.48));
  }return b;
 }
 function shell(rings,segments=8){
  const b=new Builder();
  const p=(j,i)=>{const a=i/segments*Math.PI*2;return [Math.sin(a)*rings[j][1],rings[j][0],Math.cos(a)*rings[j][2]];};
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
   const a=p(j,i),d=p(j+1,i),c=p(j+1,(i+1)%segments),q=p(j,(i+1)%segments);
   const col=[0xc5cbd0,0xa7b0ba,0xe3e4e1,0x8b929e,0xb9bec4,0x808b96,0xced3d8,0xabb3bc][(i+j)%8];
   b.tri(a,d,q,col);b.tri(d,c,q,col);
  }
  for(const j of [0,rings.length-1])for(let i=0;i<segments;i++)b.tri([0,rings[j][0],0],p(j,i),p(j,(i+1)%segments),0x9eabb7);
  return b;
 }
 function agent(R){
  const box=R.mesh(new Builder().box(0,0,0,1,1,1)),cyl=R.mesh(new Builder().cylinder(.86,1,1,7));
  const root=new Node(),upper=new Node().at(0,1.45,0);root.add(upper);root.snap=false;
  // Armor is graphite, not a tiled building texture. The faceted geometry and
  // metallic lighting remain identical in the chase view and the forge.
  const mesh=(b,col=0xffffff,material=4,role)=>{const n=new Node(R.mesh(b),col,material);if(role)n.artRole=role;return n;};
  const blk=(c,x,y,z,w,h,d,m=4,role)=>{const n=new Node(box,c,m).at(x,y,z).scale(w,h,d);if(role)n.artRole=role;return n;};
  const joint=(x,y,z,w,h,d)=>new Node(cyl,shadow,3).at(x,y,z).scale(w,h,d);
  const faceplate=(pts,z,d,col,role,mat=3)=>mesh(plate(pts,z,d),col,mat,role);
  // Dark flexure under floating, bevelled ceramic armor. No skin or cloth hood.
  upper.add(joint(0,.61,0,.37,.88,.255));
  const chest=mesh(shell([[1.16,.48,.27],[.87,.47,.32],[.34,.29,.23]],8),0xb5aebe,3,'primary');upper.add(chest);
  upper.add(faceplate([[-.38,1.05],[-.045,1.14],[-.06,.65],[-.29,.61]],.313,.09,0x222531,'dark'),
    faceplate([[.025,1.12],[.38,1.02],[.28,.63],[.025,.63]],.327,.08,0x505566,'secondary'));
  upper.add(faceplate([[-.27,.54],[.28,.54],[.24,.34],[-.23,.34]],.255,.09,0x6b727c,'secondary'));
  for(let j=0;j<3;j++)upper.add(blk(0x38414d,0,.48-j*.10,-.265,.44-j*.04,.043,.06));
  upper.add(blk(0x09121b,0,.20,0,.65,.19,.47));
  for(const side of [-1,1]){
   upper.add(blk(0x586473,side*.245,.22,.28,.13,.14,.12,4,'primary'));
   const harness=blk(0x11141d,side*.29,.86,.352,.082,.71,.035);harness.rz=side*.11;upper.add(harness);
  }
  upper.add(blk(cyan,.24,.78,.385,.016,.18,.013,2,'emission'));
  // A compact faceted helmet; the black visor is cut away from the outer shell.
  const head=new Node().at(0,1.62,0);upper.add(head);
  head.add(mesh(shell([[.47,.11,.12],[.32,.295,.27],[.03,.325,.30],[-.30,.21,.20]],8),0xaca4ba,3,'primary'));
  head.add(faceplate([[-.24,.20],[0,.32],[.26,.19],[.22,-.20],[0,-.36],[-.23,-.19]],.345,.10,shadow,'visor',4));
  head.add(faceplate([[-.29,.20],[-.06,.33],[-.04,.40],[-.26,.33],[-.36,.08],[-.30,-.18]],.326,.075,0xb2a6c2,'primary'));
  head.add(faceplate([[.07,.39],[.26,.31],[.34,.1],[.29,-.17],[.235,-.22],[.27,.15]],.325,.07,0xb2a6c2,'primary'));
  for(const s of [-1,1])head.add(blk(0x273440,s*.345,.05,-.05,.11,.27,.29),blk(cyan,s*.388,.08,.018,.038,.14,.18,2,'emission'));
  const visorGroups={};for(const k of ['slit','matrix','split','signal']){visorGroups[k]=new Node();head.add(visorGroups[k]);}
  const vs=(grp,x,y,w,h,a=0)=>{const n=blk(cyan,x,y,.404,w,h,.015,2,'emission');n.rz=a;visorGroups[grp].add(n);};
  // VECTOR, GRID, GHOST and SIGNAL arrays are built once; cosmetics only toggle nodes.
  vs('slit',-.09,.095,.21,.035,-.37);vs('slit',.10,.088,.215,.035,.42);vs('slit',.015,-.078,.035,.29,.10);
  for(let j=0;j<3;j++)for(let i=-2;i<=2;i++){if(j===2&&Math.abs(i)===2)continue;vs('matrix',i*.066,.12-j*.074,.023,.021);}
  vs('split',-.10,.063,.21,.045,-.33);vs('split',.10,.063,.21,.045,.33);
  vs('signal',.045,.15,.026,.13,-.16);vs('signal',.060,.032,.024,.13,.35);vs('signal',.030,-.095,.024,.13,-.28);
  const visorGlow=blk(cyan,0,.07,.409,.46,.09,.019,2,'emission');visorGlow.alpha=.20;head.add(visorGlow);
  upper.add(joint(0,1.28,0,.17,.20,.17));
  // Folded signal collar: sculptural asymmetric facets, not a fabric hoodie.
  upper.add(mesh(new Builder().cylinder(.26,.48,.21,7),0xb8a0d9,3,'cloth').at(-.045,1.25,0).scale(1,1,.80));
  upper.add(faceplate([[-.40,1.34],[.32,1.21],[.20,1.10],[-.42,1.21]],.32,.03,0xbca5ed,'cloth'));
  // Additional silhouette cues: a swept crest and asymmetric mantle fins, to read from distance.
  head.add(faceplate([[-.04,.46],[.14,.68],[.20,.56],[.07,.34]],.29,.045,0xd4c8e8,'primary'));
  head.add(faceplate([[-.15,.48],[-.03,.71],[.02,.60],[-.08,.37]],.27,.035,0x8087a0,'secondary'));
  upper.add(faceplate([[-.54,1.36],[-.06,1.29],[-.22,.94],[-.62,1.03]],.21,.05,0xc2b0e3,'cloth').rot(0,0,-.16));
  upper.add(faceplate([[.16,1.19],[.47,1.22],[.45,1.10],[.22,.99]],.16,.045,0x9d98b0,'primary'));
  const shoulders=[],arms=[],forearms=[],legs=[],knees=[],panels=[];
  for(const side of [-1,1]){
   const arm=new Node().at(side*.52,1.1,0);upper.add(arm);arms.push(arm);
   arm.add(joint(0,-.10,0,.17,.31,.18),joint(0,-.35,0,.135,.52,.14));
   const pauldron=mesh(shell([[.09,.16,.16],[-.07,.235,.23],[-.30,.155,.17]],6),0xb8adbd,3,'primary').at(side*.025,0,0);arm.add(pauldron);shoulders.push(pauldron);
   arm.add(blk(0xa98bff,side*.16,-.32,-.045,.045,.26,.30,2,'rim'));
   const forearm=new Node().at(0,-.63,0);arm.add(forearm);forearms.push(forearm);
   forearm.add(joint(0,0,0,.14,.17,.14),joint(0,-.24,0,.12,.43,.13));
   forearm.add(faceplate([[-.14,-.04],[.15,-.06],[.11,-.43],[-.1,-.45]],.15,.11,0xb5aebe,'primary'));
   forearm.add(blk(0xa98bff,side*.142,-.22,-.09,.045,.30,.30,2,'rim'));
   forearm.add(blk(graphite,0,-.52,.012,.20,.19,.17));
   for(let j=0;j<4;j++)forearm.add(blk(0x464b59,(j-1.5)*.047,-.64,.047,.037,.09,.093,3));
   forearm.add(blk(0x3e4855,side*.125,-.545,.03,.085,.13,.1).rot(0,0,-side*.25));
   const leg=new Node().at(side*.235,1.46,0);root.add(leg);legs.push(leg);
   leg.add(joint(0,-.07,0,.185,.26,.18),joint(0,-.33,0,.155,.60,.17));
   leg.add(faceplate([[-.17,-.11],[.16,-.10],[.13,-.49],[-.12,-.52]],.182,.08,0x666b77,'secondary'));
   const thigh=blk(0x9d98b0,side*.17,-.30,-.025,.063,.40,.20,3,'primary');thigh.rz=side*.09;leg.add(thigh);
   const knee=new Node().at(0,-.68,0);leg.add(knee);knees.push(knee);
   knee.add(joint(0,0,0,.145,.20,.15));
   knee.add(faceplate([[-.17,.09],[.17,.09],[.19,-.07],[.08,-.19],[-.12,-.15]],.23,.10,0xb5aebe,'primary'));
   knee.add(joint(0,-.29,0,.125,.54,.135));
   knee.add(faceplate([[-.12,-.20],[.12,-.18],[.12,-.47],[-.10,-.53]],.155,.055,0x586271,'secondary'));
   knee.add(blk(0xa98bff,side*.14,-.31,-.015,.035,.27,.28,2,'rim'));
   const boot=mesh(shell([[.08,.135,.20],[-.10,.17,.25],[-.17,.16,.245]],6),0x38404c,3).at(0,-.60,.06);knee.add(boot);
   knee.add(blk(0x0a141c,0,-.70,.10,.32,.065,.50));
   knee.add(faceplate([[-.16,-.59],[.15,-.59],[.15,-.67],[-.15,-.67]],.292,.11,0xada6b9,'primary'));
   knee.add(blk(cyan,0,-.718,.34,.12,.016,.02,2,'emission'));
   const tasset=new Node().at(side*.30,.23,-.14);upper.add(tasset);panels.push(tasset);
   tasset.add(faceplate([[-.10,0],[.12,0],[.17,-.48],[-.14,-.54]],.025,.055,0x8f8b9f,'secondary'));
   tasset.rz=side*.12;
  }
  // Back armor matters: this is a third-person runner.
  upper.add(faceplate([[-.31,1.09],[.31,1.09],[.24,.66],[-.25,.63]],.06,.06,0x6c7184,'secondary').at(0,0,-.37).rot(0,Math.PI,0));
  upper.add(blk(0x0c1420,0,.88,-.401,.15,.40,.055));
  upper.add(mesh(new Builder().box(0,1.055,-.455,.62,.045,.025).box(.25,.84,-.425,.04,.35,.025).box(0,.25,-.265,.54,.035,.03),0xa98bff,2,'rim'));
  // One retained mesh for the signal wake, not one draw per fragment.
  const signal=mesh(new Builder().box(0,0,0,1,1,1),0xa98bff,2,'signal');signal.alpha=.82;upper.add(signal);
  const cape=new Node(R.mesh(new Builder().tri([0,0,0],[.1,0,0],[0,.1,0])),0xbba0e7,3);cape.artRole='cloth';upper.add(cape);
  return {R,cape,signal,rig:'null07-fluid-v8',root,upper,head,arms,forearms,legs,knees,panels,shoulders,visorGroups,visorGlow,design:'null',trail:true};
 }
 function style(h,p,config){
  const primary=rgb(p.primary),accent=rgb(p.accent);
  const colors={primary:config.palette==='violet'?rgb(0x48515f):mix(primary,rgb(0x8d949d),.15),secondary:config.palette==='violet'?rgb(0x26313d):mix(primary,rgb(0x16222c),.60),dark:rgb(0x111a23),visor:rgb(0x030a0e),cloth:config.palette==='violet'?rgb(0xb397db):mix(accent,rgb(0x8c839c),.25),emission:config.palette==='violet'?rgb(0x6fffe9):accent,rim:config.palette==='violet'?rgb(0x7960b6):mix(accent,rgb(0x8d80a3),.2),signal:config.palette==='violet'?rgb(0xa98bff):accent,accent};
  const walk=n=>{if(n.artRole&&colors[n.artRole])n.color=colors[n.artRole].slice();if(n.artRole==='cloth')n.material=0;for(const c of n.children)walk(c);};walk(h.root);
  h.design=config.chassis;h.trail=config.trail!==false;
  for(const [k,n] of Object.entries(h.visorGroups))n.visible=k===config.visor;
  h.panels.forEach(n=>n.visible=config.chassis!=='vector');
  h.shoulders.forEach((n,i)=>n.scale(config.chassis==='proxy'?1.23:config.chassis==='vector'?.80:.94,config.chassis==='proxy'?1.12:1,1));
 }
 function fabric(h,t,title=false,boost=false,lean=0){
  const quiet=h.R.style.reducedMotion,stream=quiet?0:h.cloth?.stream??(title?0:boost?1.25:.8),side=quiet?0:h.cloth?.side??lean,lift=quiet?0:h.cloth?.lift??0;
  if(quiet)t=0;
  const rows=10,columns=4,escape=Math.max(0,Math.min(1,(stream-.85)/.4));
  // A short, single-shoulder drape keeps the spine, hips and opposite arm exposed.
  // Both cloth and the voxel wake retain their topology/storage across frames.
  if(!h.fabricData){
   const indices=[],shade=[0xd4bff2,0x9384b4,0xc4ade5,0xe5d3fa,0xa594c5].map(rgb);
   for(let j=0;j<rows;j++)for(let k=0;k<columns;k++){if(j===rows-1&&(k===1||k===3))continue;const a=j*(columns+1)+k;indices.push(a,a+columns+1,a+columns+2,a,a+columns+2,a+1);}
   const data=new Float32Array(indices.length*11);
   for(let i=0;i<indices.length;i++){const n=indices[i];data.set(shade[(Math.floor(i/6)+Math.floor(i/(columns*6)))%shade.length],i*11+6);data[i*11+9]=(n%(columns+1))/columns;data[i*11+10]=Math.floor(n/(columns+1))/rows;}
   h.fabricData={indices,data,points:new Float32Array((rows+1)*(columns+1)*3),cuts:[.07,0,.17,.045,.22]};
   h.R.gl.bindBuffer(h.R.gl.ARRAY_BUFFER,h.cape.mesh.buffer);h.R.gl.bufferData(h.R.gl.ARRAY_BUFFER,data,h.R.gl.DYNAMIC_DRAW);
   h.cape.mesh.data=data;h.cape.mesh.count=indices.length;
   const unit=h.signal.mesh.data,wake=new Float32Array(unit.length*32);
   for(let i=0;i<32;i++){const offset=i*unit.length;wake.set(unit,offset);for(let j=0;j<unit.length;j+=11){const shade=.72+unit[j+4]*.16+unit[j+3]*.08;wake.fill(shade,offset+j+6,offset+j+9);}}
   h.signalData={unit,data:wake};h.signal.mesh.data=wake;
   h.R.gl.bindBuffer(h.R.gl.ARRAY_BUFFER,h.signal.mesh.buffer);h.R.gl.bufferData(h.R.gl.ARRAY_BUFFER,wake,h.R.gl.DYNAMIC_DRAW);
  }
  const {indices,data,points,cuts}=h.fabricData,thin=h.design==='vector',sn=Math.sin(h.upper.rx),cs=Math.cos(h.upper.rx);
  for(let j=0;j<=rows;j++)for(let k=0;k<=columns;k++){
   let u=j/rows;u-=Math.max(0,(u-.65)/.35)*cuts[k];u*=1-escape*.16;
   const v=k/columns-.5,sway=Math.sin(t*(1.2+stream*2)-u*4+k*.4)*u*.035;
   const dy=-u*(1.57-stream*.18)+sway+lift*u*.4,dz=-u*(.15+stream*.62),p=(j*(columns+1)+k)*3;
   points[p]=-.36-u*.17+v*(thin?.43:.58)*(1-u*.22)+side*u*.10;
   points[p+1]=1.24+cs*dy+sn*dz;points[p+2]=-.35-sn*dy+cs*dz;
  }
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,ux=points[b]-points[a],uy=points[b+1]-points[a+1],uz=points[b+2]-points[a+2],vx=points[c]-points[a],vy=points[c+1]-points[a+1],vz=points[c+2]-points[a+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
   for(let k=0;k<3;k++){const p=indices[i+k]*3,o=(i+k)*11;data[o]=points[p];data[o+1]=points[p+1];data[o+2]=points[p+2];data[o+3]=nx/len;data[o+4]=ny/len;data[o+5]=nz/len;}
  }
  const gl=h.R.gl;gl.bindBuffer(gl.ARRAY_BUFFER,h.cape.mesh.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);h.cape.visible=h.design!=='proxy';
  h.signal.visible=h.trail&&h.design!=='proxy'&&!quiet;
  if(h.signal.visible){
   const {unit,data:wake}=h.signalData,count=Math.min(32,Math.round(3+stream*14+escape*10));
   for(let i=0;i<count;i++){
    const age=(t*(.12+stream*.32)+i*.61803399)%1,p=(rows*(columns+1)+i%(columns+1))*3;
    const dy=-age*.12+Math.sin(t*1.8+i)*age*.025,dz=-age*(.24+stream*1.6+escape*.8);
    const x=points[p]-age*.13+Math.sin(i*2.4)*age*.10+side*age*.12,y=points[p+1]+cs*dy+sn*dz,z=points[p+2]-sn*dy+cs*dz;
    const size=(.04+(i%5)*.012)*(.65+stream*.35)*Math.sin(Math.PI*age),a=t*.7+i*2.4,co=Math.cos(a),si=Math.sin(a);
    for(let j=0;j<unit.length;j+=11){const o=i*unit.length+j,ux=unit[j]*size,uz=unit[j+2]*size;wake[o]=x+ux*co+uz*si;wake[o+1]=y+unit[j+1]*size;wake[o+2]=z-ux*si+uz*co;}
   }
   h.signal.mesh.count=count*unit.length/11;gl.bindBuffer(gl.ARRAY_BUFFER,h.signal.mesh.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,wake);
  }
  h.R.lastBuffer=null;
  h.panels.forEach((p,i)=>{p.rx=.03+stream*.15+Math.sin(t*7+i)*stream*.035;p.rz=(i?1:-1)*.13+side*.06+Math.sin(t*2+i)*.02;});
 }
 function idle(h,t){
  h.root.at(0,0,0).scale(.95,1.055,.96);h.upper.y=1.45+Math.sin(t*1.4)*.012;h.upper.rx=0;h.upper.rz=0;
  h.head.ry=Math.sin(t*.37)*.06;h.head.rx=.035;
  h.arms.forEach((a,i)=>{a.rx=i?.07:-.08;a.rz=i?.10:-.10;});h.forearms.forEach(a=>a.rx=-.21);
  h.legs.forEach((l,i)=>{l.y=1.46;l.rx=i?-.06:.06;});h.knees.forEach(a=>a.rx=.075);
  fabric(h,t,true);
 }
 return {agent,style,fabric,idle,plate,shell};
})();

