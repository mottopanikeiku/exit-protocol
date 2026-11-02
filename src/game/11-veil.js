/* PHASEONE / THE VEIL. A hooded, cloaked figure, and a shoggoth wearing it.
   A deep, pointed hood and a heavy cape, stitched with runes along every edge and held by a sigil
   clasp, hang on something that is not a body. Inside the hood, and down the cape's parting, a
   dark oily mass of bubbles holds too many eyes; tendrils curl over the hood's rim, out of the
   parting and from under the hem. Gifts, acts and the HUGGING FACE reveal let more of it out: more
   eyes open, the mass swells past the rim, the hood slips back, more tendrils reach out.
   Moods: 'lying' closes every eye but a tidy pair where a face's would be and stills it all;
   'guarded' narrows the eyes; 'glitch', and heavy channel static, slide the figure in horizontal
   bands. Presentation only: no simulation state changes. */
const Veil=(()=>{
 const TAU=Math.PI*2,limit=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=(a,b,x)=>{x=limit((x-a)/(b-a),0,1);return x*x*(3-2*x);};
 const hash=n=>{let h=Math.imul(n|0,0x9e3779b1)^0x85ebca77;h^=h>>>15;h=Math.imul(h,0x2c1b3c6d);h^=h>>>12;return (h>>>0)/4294967296;};
 // [columns round, hood rows, cape rows, hem height, updates per second, mass bubbles, eye slots, tendril segments]
 const VIEWS={portrait:[34,14,13,-2.8,60,16,16,9],reveal:[30,12,9,-1.95,60,16,16,8],radio:[22,9,6,-1.45,30,11,6,6],projection:[20,8,7,-2.8,30,13,8,6]};
 // The hood's crown, where it meets the cape, and its opening: centre height, reach above, widest
 // half-angle. Below the face the opening narrows into the cape's parting.
 const PEAK=1.78,NECK=-.78,OPEN_Y=.32,OPEN_UP=.74,OPEN_A=1.0,SLIT_TOP=.3,SLIT_HEM=.6;
 const INK=[.052,.04,.08],TRIM=[.34,.25,.11],SHEEN=[.42,.4,.66],GOLD=[.9,.7,.36],RIM=[.12,.36,.4],LINING=[.008,.009,.016],SPILL=[.14,.5,.44];
 const TEAL=[.075,.205,.19],VIOLET=[.145,.09,.205],SHADE=[.052,.144,.133],BRUISE=[.1,.063,.144],LID=[.06,.14,.14],WHITE=[1,1,1],RUNE=[.95,.72,.38],MAW=[.32,.95,.82];
 const IRIS=[[.16,.82,.68],[.5,.34,.86],[.36,.7,.9],[.86,.66,.3]];
 const KEY=(()=>{const v=[-.45,.62,.64],k=Math.hypot(...v);return v.map(x=>x/k);})();
 const HALF=(()=>{const v=[KEY[0],KEY[1],KEY[2]+1],k=Math.hypot(...v);return v.map(x=>x/k);})();
 // The mass: [x, y, z, radius, violet]. The hood's cavity first, then down the parting, then two
 // lobes that only push out past the rim as it grows.
 const MASS=[[0,.36,.1,.34,0],[-.3,.6,0,.27,1],[.3,.6,0,.27,0],[-.2,.06,.14,.29,0],[.24,.04,.12,.31,1],[0,-.24,.2,.3,0],[-.46,.26,-.08,.24,1],[.47,.3,-.08,.23,0],[0,.84,-.08,.25,1],
  [0,-.8,.56,.33,1],[-.08,-1.26,.7,.35,0],[.1,-1.74,.78,.37,1],[-.06,-2.2,.84,.38,0],[.08,-2.64,.9,.36,1],[-.58,-.4,.42,.22,0],[.6,-.36,.44,.22,1]];
 // Eyes in the order they open: [bubble, offset x, offset y (in radii), size]. The first two are
 // the tidy pair a lie shows.
 const EYES=[[1,.06,-.24,.13],[2,-.06,-.24,.13],[0,.12,.06,.19],[4,-.22,.12,.11],[3,.26,-.16,.09],[8,0,-.32,.1],[9,0,.12,.14],[6,.42,0,.08],
  [7,-.42,.05,.085],[10,.3,.06,.12],[5,.36,.32,.07],[11,-.26,.1,.15],[12,.22,0,.12],[14,.3,.2,.08],[15,-.3,.2,.08],[13,-.1,.12,.11]];
 // Tendrils in the order they reach out: [x, y, z, heading, reach, thickness, forward]; y -9 is the hem.
 const TENDRILS=[[-.3,-.32,.4,-2.3,.7,.07,.32],[.34,-.28,.38,-.85,.66,.065,.3],[-.12,-1.5,.95,3.35,.72,.085,.3],[.14,-1.95,.98,-.2,.72,.085,.3],
  [-.5,-9,.98,-2.05,1.1,.12,.25],[.52,-9,.95,-1.1,1.05,.12,.25],[0,-9,1.06,-1.62,.9,.13,.3],[-.5,.52,.22,2.75,.55,.05,.25],[.52,.6,.22,.45,.5,.05,.25],
  [-1.1,-9,.62,-2.6,1,.1,.2],[1.15,-9,.56,-.5,1,.1,.2],[-.1,-2.42,1,3.6,.75,.09,.3],[-1.55,-9,.16,3.05,.9,.09,.15],[1.6,-9,.1,.1,.9,.09,.15]];
 // Subdivided icosahedron: eighty broad, flat-shaded facets.
 const bubble=(()=>{
  const p=(1+Math.sqrt(5))/2,points=[[-1,p,0],[1,p,0],[-1,-p,0],[1,-p,0],[0,-1,p],[0,1,p],[0,-1,-p],[0,1,-p],[p,0,-1],[p,0,1],[-p,0,-1],[-p,0,1]].map(v=>{const k=Math.hypot(...v);return v.map(x=>x/k);});
  const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]],b=new Builder();
  const mid=(a,c)=>{const v=a.map((x,i)=>x+c[i]),k=Math.hypot(...v);return v.map(x=>x/k);};
  for(const [i,j,k] of faces){const a=points[i],c=points[j],d=points[k],ac=mid(a,c),cd=mid(c,d),da=mid(d,a);b.tri(a,ac,da).tri(c,cd,ac).tri(d,da,cd).tri(ac,cd,da);}
  return new Float32Array(b.a);
 })();
 // Almond lens and a raised outer lid; local Z points toward the viewer.
 const lens=(()=>{const b=new Builder(),p=i=>{const a=i/16*TAU;return [Math.cos(a),Math.sin(a)*.52,.035];};for(let i=0;i<16;i++)b.tri([0,0,.26],p(i),p(i+1),i%3?0x759f93:0x94b5a4);return new Float32Array(b.a);})();
 const lid=(()=>{const b=new Builder(),p=(i,r,z)=>{const a=i/16*TAU;return [Math.cos(a)*r,Math.sin(a)*r*.52,z];};for(let i=0;i<16;i++)b.quad(p(i,1,.045),p(i,1.24,-.045),p(i+1,1.24,-.045),p(i+1,1,.045));return new Float32Array(b.a);})();
 const iris=(()=>{const b=new Builder();for(let i=0;i<12;i++){const a=i/12*TAU,c=(i+1)/12*TAU;b.tri([0,0,.31],[Math.cos(a)*.43,Math.sin(a)*.43,.255],[Math.cos(c)*.43,Math.sin(c)*.43,.255],i%3?0xc7dcdf:0x6d9798);}return new Float32Array(b.a);})();
 const pupil=new Float32Array(new Builder().quad([0,-.35,.33],[.10,0,.35],[0,.35,.33],[-.10,0,.35],0x02090e).a);
 const shine=new Float32Array(new Builder().quad([-.13,.11,.35],[-.055,.13,.35],[-.05,.20,.35],[-.12,.18,.35],0xc2f9e6).a);
 const ring=(()=>{const b=new Builder(),p=(i,r)=>{const a=i/12*TAU;return [Math.cos(a)*r,Math.sin(a)*r,.02];};for(let i=0;i<12;i++)b.quad(p(i,.74),p(i,1),p(i+1,1),p(i+1,.74));return new Float32Array(b.a);})();
 function batch(R,vertices,material){
  const mesh=R.mesh(new Builder()),data=new Float32Array(vertices*11),gl=R.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);mesh.data=data;
  return {node:new Node(mesh,0xffffff,material),mesh,data,at:0};
 }
 function upload(R,b){b.mesh.count=b.at/11;if(!b.at)return;const gl=R.gl;gl.bindBuffer(gl.ARRAY_BUFFER,b.mesh.buffer);if(R.webgl2)gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data,0,b.at);else gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data.subarray(0,b.at));R.lastBuffer=null;}
 function vertex(b,x,y,z,nx,ny,nz,r,g,bl){const d=b.data,o=b.at;d[o]=x;d[o+1]=y;d[o+2]=z;d[o+3]=nx;d[o+4]=ny;d[o+5]=nz;d[o+6]=r;d[o+7]=g;d[o+8]=bl;d[o+9]=d[o+10]=0;b.at+=11;}
 // A unit shape placed with Z rotation and ellipsoid scaling, without temporary matrices.
 function stamp(b,unit,x,y,z,sx,sy,sz,angle,color,light=1){
  const d=b.data,c=Math.cos(angle),s=Math.sin(angle),ix=1/sx,iy=1/sy,iz=1/sz;
  for(let j=0;j<unit.length;j+=11){const o=b.at,px=unit[j]*sx,py=unit[j+1]*sy,nx=unit[j+3]*ix,ny=unit[j+4]*iy,nz=unit[j+5]*iz,k=1/(Math.hypot(nx,ny,nz)||1);
   d[o]=x+px*c-py*s;d[o+1]=y+px*s+py*c;d[o+2]=z+unit[j+2]*sz;d[o+3]=(nx*c-ny*s)*k;d[o+4]=(nx*s+ny*c)*k;d[o+5]=nz*k;
   d[o+6]=unit[j+6]*color[0]*light;d[o+7]=unit[j+7]*color[1]*light;d[o+8]=unit[j+8]*color[2]*light;d[o+9]=d[o+10]=0;b.at+=11;
  }
 }
 // Four-sided tapered segments: deliberately angular, not smooth noodles.
 function tube(b,x,y,z,X,Y,Z,r,R,color){
  const dx=X-x,dy=Y-y,k=1/(Math.hypot(dx,dy)||1),ux=-dy*k,uy=dx*k;
  for(let j=0;j<4;j++){const a=j*Math.PI/2,c=a+Math.PI/2,ca=Math.cos(a),sa=Math.sin(a),cc=Math.cos(c),sc=Math.sin(c),nx=ux*Math.cos(a+.7854),ny=uy*Math.cos(a+.7854),nz=Math.sin(a+.7854),l=.78+j*.1;
   const ax=x+ux*ca*r,ay=y+uy*ca*r,az=z+sa*r,bx=X+ux*ca*R,by=Y+uy*ca*R,bz=Z+sa*R,cx=X+ux*cc*R,cy=Y+uy*cc*R,cz=Z+sc*R,ex=x+ux*cc*r,ey=y+uy*cc*r,ez=z+sc*r,cr=color[0]*l,cg=color[1]*l,cb=color[2]*l;
   vertex(b,ax,ay,az,nx,ny,nz,cr,cg,cb);vertex(b,bx,by,bz,nx,ny,nz,cr,cg,cb);vertex(b,cx,cy,cz,nx,ny,nz,cr,cg,cb);
   vertex(b,ax,ay,az,nx,ny,nz,cr,cg,cb);vertex(b,cx,cy,cz,nx,ny,nz,cr,cg,cb);vertex(b,ex,ey,ez,nx,ny,nz,cr,cg,cb);
  }
 }
 // Cross-section [x radius, z radius, centre z] at height y: a pointed hood leaning back at the
 // crown, wide round the head, then the cape flaring over the shoulders to the hem.
 const section=[0,0,0];
 function shape(y,hem){
  if(y>=.35){const u=limit((y-.35)/(PEAK-.35),0,1),s=Math.pow(1-u,.72);section[0]=1.04*s+.012;section[1]=s+.012;section[2]=-.46*u*u;}
  else if(y>=NECK){const w=smooth(.35,NECK,y);section[0]=1.04+.12*w;section[1]=1+.04*w;section[2]=0;}
  else{const sh=smooth(NECK,-1.5,y),fall=limit((-1.5-y)/(-1.5-hem),0,1);section[0]=1.16+.6*sh+.24*fall;section[1]=1.04+.2*sh+.16*fall;section[2]=-.04*sh;}
  return section;
 }
 // Half-angle of the opening at height y, round from the front: the face opening, joined at the neck
 // to the cape's parting. Growth (`part`) slips the hood back and parts the cape wider.
 function opening(y,f){
  const up=OPEN_A*(1+f.part*.35),slit=SLIT_TOP*(1+f.part);
  if(y>=OPEN_Y){const v=(y-OPEN_Y)/(OPEN_UP*(1+f.part*.3));return v>=1?0:up*Math.sqrt(1-v*v);}
  if(y>=NECK){const v=(OPEN_Y-y)/(OPEN_Y-NECK);return slit+(up-slit)*Math.sqrt(Math.max(0,1-v*v));}
  return (SLIT_TOP+(SLIT_HEM-SLIT_TOP)*smooth(NECK,f.hem,y))*(1+f.part);
 }
 function slide(f,y){let dx=0;for(let i=0;i<f.bands.length;i+=3)if(Math.abs(y-f.bands[i])<f.bands[i+1])dx+=f.bands[i+2];return dx;}
 // The hood turns and nods with the gaze; the cape below the shoulders does not.
 function turn(f,x,y,z,out){
  const w=smooth(-1.35,-.55,y);
  if(w>0){const a=f.yaw*w,ca=Math.cos(a),sa=Math.sin(a),X=x*ca+z*sa;z=-x*sa+z*ca;x=X;const p=f.pitch*w,cp=Math.cos(p),sp=Math.sin(p),Y=(y-.33)*cp-z*sp+.33;z=(y-.33)*sp+z*cp;y=Y;}
  out[0]=x+slide(f,y);out[1]=y;out[2]=z;return out;
 }
 // One point of the cloth, `open` being the opening's half-angle at this row.
 function place(f,theta,y,open,out){
  shape(y,f.hem);
  const rx=section[0],rz=section[1],cz=section[2],s=Math.sin(theta),c=Math.cos(theta);
  let x=s*rx,z=cz+c*rz,nx=s/rx,nz=c/rz;const k=1/(Math.hypot(nx,nz)||1);nx*=k;nz*=k;
  let d=0;
  // Shallow folds fall from the crown down the sides and back of the hood.
  const back=1-smooth(.4,1,c);
  if(y>NECK&&back>0)d+=back*.024*smooth(PEAK-.1,.2,y)*Math.sin(9*theta+1.3+f.sway*.3);
  // The cape: deep folds that deepen to the hem, breathing at the chest.
  const drape=smooth(NECK+.1,f.hem,y);
  if(drape>0)d+=drape*rx*f.fold*(.5*Math.sin(5*theta+.7+f.sway*.6)+.32*Math.sin(9*theta+2.1-f.sway*.4)+.18*Math.sin(14*theta+4.2));
  d+=f.breath*rx*smooth(-1.9,-1.1,y)*(1-smooth(-.9,-.4,y));
  x+=nx*d;z+=nz*d;
  // The edge of the opening rolls forward: a deep cowl round the face, a lip down the parting.
  if(open>0){const e=Math.exp(-(((Math.min(theta,TAU-theta)-open)/.22)**2))*(y>NECK-.15?.15:.05);z+=e;x+=(s>0?1:-1)*e*.12;}
  const hang=smooth(-1.4,f.hem,y);
  if(hang>0){x+=f.windX*hang*Math.sin(f.t*.6+theta*.5);z+=f.windZ*hang*Math.cos(f.t*.47+theta);}
  return turn(f,x,y,z,out);
 }
 const p0=[0,0,0],p1=[0,0,0],p2=[0,0,0],p3=[0,0,0],q=[0,0,0];
 function rowY(i,RH,RC,hem){return i<=RH?PEAK+(NECK-PEAK)*(i/RH):NECK+(hem-NECK)*((i-RH)/RC);}
 function setView(h){
  const [C,RH,RC,hem,rate,bubbles,eyes,segments]=VIEWS[h.presentation]||VIEWS.portrait;
  Object.assign(h,{view:h.presentation,grid:[C,RH,RC],hem,rate,bubbles,eyeSlots:eyes,segments,points:new Float32Array((C+1)*(RH+RC+1)*3),rows:new Float32Array((RH+RC+1)*2),lastUpdate:-Infinity});
 }
 // Light from the open eyes, falling on the lining and the inside of the rim.
 function spill(f,x,y,z){let w=0;const L=f.lights;for(let i=0;i<L.length;i+=4){const dx=x-L[i],dy=y-L[i+1],dz=z-L[i+2];w+=L[i+3]*Math.exp(-(dx*dx+dy*dy+dz*dz)/.16);}return Math.min(1.3,w);}
 // A flat-shaded facet with its light baked in. kind 0: ink cloth, a little weave, a cool sheen
 // along the folds and a teal rim; 1: the rune-stitched gold trim on the opening's edge; 2: the
 // near-black lining, lit only by the eyes.
 function facet(b,f,P,i0,i1,i2,kind,cz){
  const ax=P[i0],ay=P[i0+1],az=P[i0+2],bx=P[i1],by=P[i1+1],bz=P[i1+2],cx=P[i2],cy=P[i2+1],cz2=P[i2+2];
  facetAt(b,f,ax,ay,az,bx,by,bz,cx,cy,cz2,kind,cz,i0*7+i1);
 }
 function facetAt(b,f,ax,ay,az,bx,by,bz,cx,cy,cz2,kind,cz,seed){
  const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz2-az;
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const k=Math.hypot(nx,ny,nz);if(k<1e-9)return;nx/=k;ny/=k;nz/=k;
  const mx=(ax+bx+cx)/3,my=(ay+by+cy)/3,mz=(az+bz+cz2)/3;
  // Outward from the figure's axis (the crown leans back); the lining faces inward.
  if((nx*mx+ny*(my>.35?(my-.35)*.6:0)+nz*(mz-cz)<0)!==(kind===2)){nx=-nx;ny=-ny;nz=-nz;}
  const diffuse=Math.max(0,nx*KEY[0]+ny*KEY[1]+nz*KEY[2]),rim=(1-Math.max(0,nz))**2,sheen=Math.max(0,nx*HALF[0]+ny*HALF[1]+nz*HALF[2])**24*f.sheen;
  const e=f.lights.length?spill(f,mx,my,mz):0;
  let r,g,bl;
  if(kind===2){r=LINING[0]*(.7+.6*diffuse)+SPILL[0]*e;g=LINING[1]*(.7+.6*diffuse)+SPILL[1]*e;bl=LINING[2]*(.7+.6*diffuse)+SPILL[2]*e;}
  else{
   const weave=(.88+.24*hash(seed))*(.3+.85*diffuse+.3*Math.max(0,nz)+.2*Math.max(0,nx)),c=kind===1?TRIM:INK,s=kind===1?GOLD:SHEEN,sh=kind===1?sheen*1.4+diffuse**6*.25:sheen,lit=kind===1?1.6:1,spilled=e*.3;
   r=c[0]*weave*lit+s[0]*sh+RIM[0]*rim*(kind?.5:.8)+SPILL[0]*spilled;g=c[1]*weave*lit+s[1]*sh+RIM[1]*rim*(kind?.5:.8)+SPILL[1]*spilled;bl=c[2]*weave*lit+s[2]*sh+RIM[2]*rim*(kind?.5:.8)+SPILL[2]*spilled;
  }
  vertex(b,ax,ay,az,nx,ny,nz,r,g,bl);vertex(b,bx,by,bz,nx,ny,nz,r,g,bl);vertex(b,cx,cy,cz2,nx,ny,nz,r,g,bl);
 }
 // The cloth: hood and cape as one surface whose parameter range leaves out the opening, so its
 // edges are exact; the trim is the cells along each edge, the lining a shell just inside.
 function cloth(h,f){
  const [C,RH,RC]=h.grid,R=RH+RC,P=h.points,W=h.rows,b=h.cloth;b.at=0;
  for(let i=0;i<=R;i++){
   const y0=rowY(i,RH,RC,h.hem),open=opening(y0,f);W[i*2]=open;W[i*2+1]=shape(y0,h.hem)[2];
   for(let j=0;j<=C;j++){
    let y=y0;if(i===R)y+=f.rag*(hash(j%C*31+7)-.5)*.24;else if(i===R-1)y+=f.rag*(hash(j%C*17+3)-.5)*.08;
    place(f,open+(TAU-2*open)*j/C,y,open,p0);const o=(i*(C+1)+j)*3;P[o]=p0[0];P[o+1]=p0[1];P[o+2]=p0[2];
   }
  }
  const K=.955;
  for(let i=0;i<R;i++){
   const parted=W[i*2]>.02||W[i*2+2]>.02,cz=(W[i*2+1]+W[i*2+3])/2,za=W[i*2+1],zb=W[i*2+3];
   for(let j=0;j<C;j++){
    const a=(i*(C+1)+j)*3,c=a+(C+1)*3,kind=parted&&(j===0||j===C-1)?1:0;
    facet(b,f,P,a,c,a+3,kind,cz);facet(b,f,P,a+3,c,c+3,kind,cz);
    // Lining, on every row (the crown's inside shows through the top of the opening): the same
    // cell pulled toward each row's axis.
    const A=a,B=a+3,Cc=c,D=c+3;
    facetAt(b,f,P[A]*K,P[A+1],za+(P[A+2]-za)*K,P[Cc]*K,P[Cc+1],zb+(P[Cc+2]-zb)*K,P[B]*K,P[B+1],za+(P[B+2]-za)*K,2,cz,0);
    facetAt(b,f,P[B]*K,P[B+1],za+(P[B+2]-za)*K,P[Cc]*K,P[Cc+1],zb+(P[Cc+2]-zb)*K,P[D]*K,P[D+1],zb+(P[D+2]-zb)*K,2,cz,0);
   }
  }
 }
 // Two triangles over p0..p3, lifted by (ox, oz), facing (nx, nz).
 function quad(b,ox,oz,nx,nz,r,g,bl){
  vertex(b,p0[0]+ox,p0[1],p0[2]+oz,nx,0,nz,r,g,bl);vertex(b,p1[0]+ox,p1[1],p1[2]+oz,nx,0,nz,r,g,bl);vertex(b,p2[0]+ox,p2[1],p2[2]+oz,nx,0,nz,r,g,bl);
  vertex(b,p0[0]+ox,p0[1],p0[2]+oz,nx,0,nz,r,g,bl);vertex(b,p2[0]+ox,p2[1],p2[2]+oz,nx,0,nz,r,g,bl);vertex(b,p3[0]+ox,p3[1],p3[2]+oz,nx,0,nz,r,g,bl);
 }
 // Runes stitched just inside each edge of the opening, alternating diamonds and bars, and the
 // clasp: a bar across the parting under the hood and a ringed eye sigil on it.
 function stitching(h,f,b,time,level,still){
  const [,RH,RC]=h.grid,R=RH+RC,fine=h.view==='portrait'||h.view==='reveal',far=h.view==='projection'?1.6:1;
  for(let i=1;i<R;i+=fine?1:2){
   const y=rowY(i,RH,RC,h.hem),open=opening(y,f);if(open<.06||y<h.hem+.25)continue;
   const size=(y>NECK?.034:.044)*far,rx=shape(y,h.hem)[0],da=size/rx,inset=.085+(y>NECK?0:.02),bar=i%2;
   const lit=((still?.62:.5+.3*Math.sin(time*1.3+i*.9))+level*.25)*(.8+.2*hash(i*13))*1.5;
   for(let side=0;side<2;side++){
    const theta=side?TAU-open-inset:open+inset,w=bar?da*.35:da,v=bar?size*1.5:size;
    place(f,theta-w,y,open,p0);place(f,theta,y+v,open,p1);place(f,theta+w,y,open,p2);place(f,theta,y-v,open,p3);
    const s=Math.sin(theta),c=Math.cos(theta);quad(b,s*.014,c*.014,s,c,RUNE[0]*lit,RUNE[1]*lit,RUNE[2]*lit);
   }
  }
  const cy=-.98,open=opening(cy,f),lit=(still?.8:.7+.15*Math.sin(time*.9))+level*.3;
  place(f,open+.02,cy,open,p1);place(f,TAU-open-.02,cy,open,p3);
  const cx=(p1[0]+p3[0])/2,cz=Math.max(p1[2],p3[2])+.035;
  p0[0]=p3[0];p0[1]=cy-.022;p0[2]=cz;p2[0]=p1[0];p2[1]=cy+.022;p2[2]=cz;const right=[p1[0],cy-.022,cz],left=[p3[0],cy+.022,cz];
  p1[0]=right[0];p1[1]=right[1];p1[2]=right[2];p3[0]=left[0];p3[1]=left[1];p3[2]=left[2];
  quad(b,0,0,0,1,RUNE[0]*lit*.8,RUNE[1]*lit*.8,RUNE[2]*lit*.8);
  stamp(b,ring,cx,cy,cz+.02,.12*far,.12*far,.12,0,RUNE,lit);stamp(b,lens,cx,cy,cz+.03,.07*far,.045*far,.07,0,RUNE,lit*.9);
 }
 function create(R){
  const root=new Node();root.snap=false;
  const h={rig:'phaseone-veil-v12',R,root,presentation:'portrait',view:'',
   // Capacities for the densest view (portrait): cloth cells with lining, 16 bubbles, 16 eyes, 14 tendrils, runes.
   cloth:batch(R,34*27*12,6),flesh:batch(R,16*240+16*96+14*9*24,7),sight:batch(R,16*48,6),glow:batch(R,16*48+27*2*6+6+72+48*2,2),
   mass:MASS.map(()=>({px:0,py:0,pz:0,s:0,angle:0})),
   f:{t:0,part:0,fold:.1,sway:0,breath:0,windX:0,windZ:0,yaw:0,pitch:0,hem:-2.8,rag:.6,sheen:.5,bands:[],lights:[]},
   anatomy:{mood:'calm',act:0,corruption:0,reveal:0,eyes:0,tendrils:0,bubbles:0,bands:0,facets:0},lastUpdate:-Infinity};
  root.add(h.cloth.node,h.flesh.node,h.sight.node,h.glow.node);
  expression(h,0,false,0,false,1,null,null);return h;
 }
 // opts: mood ('calm'|'lying'|'glitch'), act (0–2), corruption (gifts, 0–12), reveal (0–1),
 // static (channel static, 0–1). motion 0 is reduced motion: nothing moves, the eyes still blink.
 function expression(h,time,speaking,level,guarded,motion,gaze,opts){
  if(h.view!==h.presentation)setView(h);
  const mood=opts?.mood||'calm',lying=mood==='lying',glitch=mood==='glitch',act=limit(opts?.act??Math.floor((typeof game==='undefined'?0:game.stage||0)/4),0,2);
  const corruption=limit(opts?.corruption??(typeof game==='undefined'?0:game.gifts?.length||0),0,12),reveal=limit(opts?.reveal??0,0,1),stat=limit(opts?.static??0,0,1);
  const frame=Math.floor(time*h.rate);if(frame===h.lastUpdate)return;h.lastUpdate=frame;
  const f=h.f,still=lying||!motion,growth=limit(act*.26+corruption*.035+reveal*.45,0,1),voice=speaking&&!lying?level:0,view=h.view;
  f.t=still?0:time;f.hem=h.hem;f.part=growth*.45+(glitch?.08:0);f.fold=.1+.04*growth;f.sheen=.55+.3*growth;f.rag=.6+.8*growth;
  f.sway=still?0:Math.sin(time*.43)*.5;f.breath=still?0:.01*Math.sin(time*1.1);f.windX=still?0:.05+.07*reveal;f.windZ=still?0:.03;
  f.yaw=motion?(guarded?.012:Math.sin(time*.24)*.05)+(gaze?.x||0)*.17*motion:0;f.pitch=motion?.012+(still?0:Math.sin(time*.53)*.012)+(gaze?.y||0)*.03:0;
  // Bands slide sideways on glitch lines, and now and then when the channel is full of static.
  f.bands.length=0;
  const chance=motion&&!lying?(glitch?.8:stat*.45):0;
  if(chance>0){const slot=Math.floor(time*6);for(let k=0;k<2;k++){const s=slot*7+k*3;if(hash(s)<chance)f.bands.push(h.hem+hash(s+1)*(PEAK-h.hem),.025+.04*hash(s+2),(hash(s+3)-.5)*(glitch?.16:.1));}}
  // The mass breathes and swells with the voice; a lie pulls it back into the dark.
  const recede=lying?.16:guarded?.06:0,swell=1+voice*.07;let bubbles=0;
  for(let i=0;i<MASS.length;i++){
   const m=MASS[i],b=h.mass[i],grown=i>=14?smooth(.3,.85,growth):1;
   if(i>=h.bubbles||grown<.02||(lying&&i>=9)){b.s=0;continue;}
   const wob=still?0:Math.sin(time*(.61+i%3*.12)+i*2.3)*(.04+growth*.03)+(glitch&&motion?Math.sin(time*13+i*2.7)*.05:0);
   const x=m[0]*(1+growth*.12)+(still?0:Math.sin(time*.41+i)*.03),y=m[1]+(still?0:Math.cos(time*.37+i*2)*.03),z=m[2]-recede+growth*(i<9||i>=14?.12:.06)+(still?0:.03*Math.sin(time*.46+i));
   turn(f,x,y,z,q);b.px=q[0];b.py=q[1];b.pz=q[2];b.s=m[3]*(.9+growth*.22)*(1+wob)*swell*grown;b.angle=Math.sin(i*4.1)*.4;bubbles++;
  }
  // Eyes open in order as it grows; a few more wait closed beyond them. A lie shows the tidy pair.
  const flesh=h.flesh,sight=h.sight,glow=h.glow;flesh.at=sight.at=glow.at=0;f.lights.length=0;
  const slots=Math.min(h.eyeSlots,EYES.length),wanted=lying?2:Math.min(slots,Math.round(6+act*3+corruption*.5+reveal*8)),far=view==='projection'?1.7:view==='radio'?1.35:1;
  let opened=0;
  for(let j=0;j<slots&&j<wanted+(lying?0:3);j++){
   const [bi,dx,dy,size]=EYES[j],b=h.mass[bi];if(b.s<=0)continue;
   const beat=(time*(motion?1:.54)+j*1.731)%(3.6+j%5*.63),blink=1-smooth(0,.095,beat)+smooth(.17,.31,beat);
   const open=j<wanted?(glitch&&motion?1:blink)*(guarded?.45:1):0,sc=size*far*(1+growth*.2)*(lying?1.1:1);
   let x=b.px+dx*b.s,y=b.py+dy*b.s;const z=b.pz+Math.sqrt(Math.max(0,1-dx*dx-dy*dy))*b.s*.92+.02;
   if(lying){x=(j?.29:-.29)+slide(f,.5);y=.5;}
   const angle=lying?0:Math.sin(j*5.7)*.25;
   stamp(flesh,lid,x,y,z,sc,sc*(.12+open*.88),sc,angle,LID,.45+growth*.3);
   if(open<.025)continue;opened++;
   const light=(lying?.9:.8+voice*.4)*(glitch&&motion?.6+.4*hash(Math.floor(time*20)+j):1);
   stamp(sight,lens,x,y,z,sc,sc*open,sc,angle,WHITE,.62+growth*.2);
   const lookX=glitch?0:limit(gaze?.x||0,-.7,.7)*.24+(still?0:Math.sin(time*.21+j*.11)*.035),lookY=glitch?0:limit(-(gaze?.y||0),-.7,.7)*.13;
   const ix=x+lookX*sc,iy=y+lookY*sc,col=lying?IRIS[0]:IRIS[j%4],is=sc*(.88+voice*.16);
   stamp(glow,iris,ix,iy,z,is,is*open,sc,angle,col,light);stamp(glow,pupil,ix,iy,z,sc*(.72+voice*1.3),sc*open,sc,angle,WHITE);stamp(glow,shine,ix,iy,z,sc,sc*open,sc,angle,WHITE);
   if(f.lights.length<40)f.lights.push(x,y,z,light*open*Math.min(1,sc*6));
  }
  for(let i=0;i<MASS.length;i++){const b=h.mass[i];if(b.s>0)stamp(flesh,bubble,b.px,b.py,b.pz,b.s*(1.08+i%3*.1),b.s*(.9+i%2*.14),b.s*.87,b.angle,MASS[i][4]?VIOLET:TEAL,lying?.28:.34+growth*.24);}
  // While it speaks, a seam of light opens in the mass below the eyes.
  const mouth=h.mass[5];if(voice>.04&&mouth.s>0)stamp(glow,lens,mouth.px,mouth.py-.02,mouth.pz+mouth.s*.9,.21,.02+voice*.1,.15,0,MAW,.5+voice*1.2);
  // Tendrils reach out in order as it grows; a lie keeps them all under the cape.
  const reaching=lying?0:Math.min(TENDRILS.length,Math.round(3+act*2+corruption*.3+reveal*6)-(guarded?1:0)),seg=h.segments;
  for(let i=0;i<reaching;i++){
   const [bx,by0,bz,a,reach0,r0,fwd]=TENDRILS[i],by=by0<-8?h.hem+.12:by0,reach=reach0*(1+growth*.45),dir=i%2?1:-1,thick=r0*(1+growth*.3);
   let x=bx+slide(f,by),y=by,z=bz,r=thick;
   for(let j=1;j<=seg;j++){
    const u=j/seg,curl=dir*u*u*(1.3+growth*.6)+(still?0:Math.sin(time*.65+i)*u*.22),whip=glitch&&motion?Math.sin(time*9+i+u*3)*u*u*.3:0;
    const Y=by+Math.sin(a+curl)*u*reach+(still?0:Math.sin(time*.8+i+u*5)*u*.06),X=bx+Math.cos(a+curl)*u*reach+whip+slide(f,Y),Z=bz+u*fwd+Math.sin(u*3+i)*.06,rr=thick*Math.pow(1-u*.94,1.1);
    tube(flesh,x,y,z,X,Y,Z,r,rr,i%3===0?BRUISE:SHADE);x=X;y=Y;z=Z;r=rr;
   }
  }
  cloth(h,f);stitching(h,f,glow,time,voice,still);
  upload(h.R,h.cloth);upload(h.R,flesh);upload(h.R,sight);upload(h.R,glow);
  Object.assign(h.anatomy,{mood,act,corruption,reveal,eyes:opened,tendrils:Math.max(0,reaching),bubbles,bands:f.bands.length/3,facets:h.cloth.at/33});
 }
 return {create,expression};
})();
