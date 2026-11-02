/* GPT-MAN miniature WebGL engine. Original code, no runtime dependencies. */
'use strict';
const Mini3D = (() => {
  const I = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const mul = (a,b) => { const o=new Float32Array(16); for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return o; };
  const compose = (x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1) => {
    const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz),m=I();
    m[0]=c*e*sx;m[1]=(a*f+b*e*d)*sx;m[2]=(b*f-a*e*d)*sx;
    m[4]=-c*f*sy;m[5]=(a*e-b*f*d)*sy;m[6]=(b*e+a*f*d)*sy;
    m[8]=d*sz;m[9]=-b*c*sz;m[10]=a*c*sz;m[12]=x;m[13]=y;m[14]=z;return m;
  };
  const norm = a => {const k=Math.hypot(...a)||1;return a.map(v=>v/k)};
  const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  function lookAt(eye,target,up=[0,1,0]) {const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
  function perspective(fov,aspect,near=.1,far=400){const f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m;}
  function normals(m){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],u=cross(b,c),v=cross(c,a),w=cross(a,b),d=dot(a,u)||1;return new Float32Array([...u.map(x=>x/d),...v.map(x=>x/d),...w.map(x=>x/d)]);}
  function rgb(h){if(Array.isArray(h))return h;if(typeof h==='number')return [(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];h=h.replace('#','');return rgb(parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16));}
  class Builder {
    constructor(){this.a=[];}
    tri(a,b,c,color=0xffffff,uvs=[[0,0],[1,0],[1,1]]){const n=norm(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i]))),co=rgb(color);[a,b,c].forEach((p,i)=>this.a.push(...p,...n,...co,...uvs[i]));return this;}
    quad(a,b,c,d,color=0xffffff,uvs=[[0,1],[1,1],[1,0],[0,0]]){this.tri(a,b,c,color,[uvs[0],uvs[1],uvs[2]]);this.tri(a,c,d,color,[uvs[0],uvs[2],uvs[3]]);return this;}
    // uvScale is repeats per world metre; omitted means one texture per face.
    box(x,y,z,w,h,d,color=0xffffff,uvScale=null){const X=w/2,Y=h/2,Z=d/2;const p=[[-X,-Y,Z],[X,-Y,Z],[X,Y,Z],[-X,Y,Z],[-X,-Y,-Z],[X,-Y,-Z],[X,Y,-Z],[-X,Y,-Z]].map(p=>[p[0]+x,p[1]+y,p[2]+z]);const faces=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]],sizes=[[w,h],[w,h],[d,h],[d,h],[w,d],[w,d]];faces.forEach((f,i)=>{const u=uvScale===null?1:sizes[i][0]*uvScale,v=uvScale===null?1:sizes[i][1]*uvScale;this.quad(...f.map(i=>p[i]),color,[[0,v],[u,v],[u,0],[0,0]]);});return this;}
    cylinder(rt,rb,h,n=10,color=0xffffff){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,p=[Math.cos(a)*rb,-h/2,Math.sin(a)*rb],q=[Math.cos(b)*rb,-h/2,Math.sin(b)*rb],r=[Math.cos(b)*rt,h/2,Math.sin(b)*rt],s=[Math.cos(a)*rt,h/2,Math.sin(a)*rt];this.quad(p,s,r,q,color);this.tri([0,h/2,0],r,s,color);this.tri([0,-h/2,0],p,q,color);}return this;}
    sphere(radius=1,segments=10,rings=7,color=0xffffff){const p=(i,j)=>{let a=i/segments*Math.PI*2,b=j/rings*Math.PI;return [Math.sin(b)*Math.cos(a)*radius,Math.cos(b)*radius,Math.sin(b)*Math.sin(a)*radius]};for(let j=0;j<rings;j++)for(let i=0;i<segments;i++)this.quad(p(i,j),p(i,j+1),p(i+1,j+1),p(i+1,j),color);return this;}
    disc(r=1,n=24,color=0xffffff){for(let i=0;i<n;i++)this.tri([0,0,0],[Math.cos(i/n*2*Math.PI)*r,0,Math.sin(i/n*2*Math.PI)*r],[Math.cos((i+1)/n*2*Math.PI)*r,0,Math.sin((i+1)/n*2*Math.PI)*r],color);return this;}
    torus(R=.7,r=.12,n=18,k=5,color=0xffffff){const p=(i,j)=>{let a=i/n*Math.PI*2,b=j/k*Math.PI*2;return [(R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b)]};for(let i=0;i<n;i++)for(let j=0;j<k;j++)this.quad(p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1),color);return this;}
    transform(m){const ns=normals(m);for(let i=0;i<this.a.length;i+=11){const a=this.a,x=a[i],y=a[i+1],z=a[i+2],nx=a[i+3],ny=a[i+4],nz=a[i+5];a[i]=m[0]*x+m[4]*y+m[8]*z+m[12];a[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];a[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];const n=norm([ns[0]*nx+ns[3]*ny+ns[6]*nz,ns[1]*nx+ns[4]*ny+ns[7]*nz,ns[2]*nx+ns[5]*ny+ns[8]*nz]);a[i+3]=n[0];a[i+4]=n[1];a[i+5]=n[2];}return this;}
    append(b){for(const v of b.a)this.a.push(v);return this;}
  }
  class Node {
    constructor(mesh=null,color=0xffffff,material=0){Object.assign(this,{mesh,color:rgb(color),material,x:0,y:0,z:0,rx:0,ry:0,rz:0,sx:1,sy:1,sz:1,children:[],visible:true,texture:null,alpha:1});}
    add(...nodes){this.children.push(...nodes);return this;}
    at(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
    scale(x,y=x,z=x){this.sx=x;this.sy=y;this.sz=z;return this;}
    rot(x,y=0,z=0){this.rx=x;this.ry=y;this.rz=z;return this;}
    matrix(){return compose(this.x,this.y,this.z,this.rx,this.ry,this.rz,this.sx,this.sy,this.sz);}
  }
  const VS=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;attribute vec2 aUV;
    uniform mat4 uModel,uVP;uniform mat3 uNormal;uniform float uSnap,uAffine,uBend,uCollapse;uniform vec4 uPath;uniform vec2 uResolution;
    varying highp vec3 vWorld,vLocal,vTex;varying mediump vec3 vNormal,vColor;
    void main(){vLocal=aPosition;vec4 w=uModel*vec4(aPosition,1.);vec3 n=normalize(uNormal*aNormal);
    if(uCollapse>.01&&w.z>6.&&w.y<.06&&abs(w.x)<5.2){float q=min(18.,w.z-6.);w.y-=q*q*.037*uCollapse;w.x+=sin(floor(w.z/4.)*2.1)*q*.047*uCollapse;}
    if(uPath.x>.01){float d=uPath.z,period=uPath.y,A=uPath.x,z=w.z,x=w.x;float a0=atan(A/period*cos(d/period)),a1=atan(A/period*cos((d-z)/period));float dx=A*(sin((d-z)/period)-sin(d/period));
      float gx=dx+x*cos(a1),gz=z+x*sin(a1);w.x=gx*cos(a0)+gz*sin(a0);w.z=-gx*sin(a0)+gz*cos(a0);
      float angle=a1-a0;n=vec3(cos(angle)*n.x-sin(angle)*n.z,n.y,sin(angle)*n.x+cos(angle)*n.z);
      w.y+=uPath.w*(sin((d-z)/210.)-sin(d/210.)+(z/210.)*cos(d/210.));
    }else w.x+=uBend*w.z*w.z/(1.+abs(w.z)*.008);
    vWorld=w.xyz;vNormal=n;vColor=aColor;vec4 p=uVP*w;
    // Multiplying UV and a companion varying by clip W cancels perspective interpolation.
    float affineW=mix(1.,p.w,uAffine);vTex=vec3(aUV*affineW,affineW);
    if(uSnap>.5&&p.w>.1){vec2 pixel=(p.xy/p.w*.5+.5)*uResolution;p.xy=(floor(pixel+.5)/uResolution*2.-1.)*p.w;}gl_Position=p;}`;
  const DITHER=`float bayer2(vec2 p){return 2.*p.x+3.*p.y-4.*p.x*p.y;}
    vec3 rgb555(vec3 c,vec2 pixel){vec2 p=mod(floor(pixel),4.);float b=4.*bayer2(mod(p,2.))+bayer2(floor(p*.5));return floor(clamp(c,0.,1.)*31.+(b+.5)/16.)/31.;}`;
  const FS=`precision highp float;varying highp vec3 vWorld,vLocal,vTex;varying mediump vec3 vNormal,vColor;
    uniform vec3 uTint,uCamera,uFog;uniform float uMaterial,uUseTexture,uAlpha,uRetro,uCinema,uEmission,uFogNear,uFogFar,uDark;uniform sampler2D uTexture;
    ${DITHER}
    float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,47.21)))*43758.54);}
    void main(){vec3 n=normalize(vNormal),key=normalize(vec3(-.63,.84,.55)),fill=normalize(vec3(.8,.3,.7)),view=normalize(uCamera-vWorld);
      float k=max(dot(n,key),0.),f=max(dot(n,fill),0.);vec3 base=vColor*uTint;vec4 tex=vec4(1.);
      if(uUseTexture>.5){tex=texture2D(uTexture,vTex.xy/vTex.z);if(tex.a<.08)discard;base*=tex.rgb;}
      float rim=pow(1.-max(dot(n,view),0.),3.);float spec=pow(max(dot(normalize(view+key),n),0.),uMaterial>3.5?60.:30.);
      vec3 c=base*(vec3(.25,.30,.36)+k*vec3(1.01,.89,.70)+f*vec3(.13,.24,.31));
      if(uMaterial<.5&&uUseTexture<.5){float grit=hash(floor(vLocal*92.));c*=.965+grit*.058;c*=.68+.32*smoothstep(-4.,2.,vWorld.y);}
      if((uMaterial>.5&&uMaterial<1.5)||uMaterial>2.5){
       vec3 r=reflect(-view,n);float band=smoothstep(-.18,.63,r.y);
       c=base*(vec3(.19,.25,.30)+k*vec3(.83,.78,.64)+f*vec3(.11,.17,.22)+band*.20);
       c+=vec3(.99,.84,.66)*spec*(uMaterial>3.5?.67:.51);c+=rim*(vec3(.07,.18,.20)*f+vec3(.22,.17,.12)*k);
      }
      if(uCinema>.5){
       // A low blue-violet hemisphere leaves the key-facing facets and real
       // emissive edges in charge. Do not paint a Fresnel glow over the floor.
       vec3 hemi=mix(vec3(.045,.050,.095),vec3(.15,.18,.29),n.y*.5+.5);
       c=base*(hemi+pow(k,1.45)*vec3(1.70,1.14,.60)+f*vec3(.028,.047,.090));
       float metal=uMaterial>.5?.7:.25;
       c+=vec3(1.08,.65,.23)*spec*metal;
       float silhouette=rim*(1.-smoothstep(.35,.88,abs(n.y)))*(uUseTexture>.5?.40:1.);
       c+=silhouette*(vec3(.035,.055,.13)*f+vec3(.62,.37,.12)*k);
       c*=.80+.20*smoothstep(-1.,2.8,vWorld.y);
       c=min(c,vec3(.92));
      }
      if(uMaterial>5.5)c=base*(.91+.095*k)+vec3(.035,.062,.059)*rim;
      // Living oil: restrained self-light and a view-dependent teal/violet film.
      // Material 7 belongs to PHASEONE, never to hazards or the track.
      if(uMaterial>6.5){
       float oil=.5+.5*sin(dot(n,view)*11.+n.y*4.+n.x*2.);
       vec3 film=mix(vec3(.025,.15,.13),vec3(.12,.045,.18),oil);
       c=base*(.38+k*.72+f*.22)+film*(.07+rim*.55)+vec3(.25,.52,.47)*spec*.36;
      }
      if(uMaterial>1.5&&uMaterial<2.5)c=base*(uCinema>.5?uEmission:1.17);else c*=uDark;
      float distance=length(vWorld-uCamera),fog=smoothstep(uFogNear,uFogFar,distance);
      if(uCinema>.5){
       float layer=exp(-max(vWorld.y,0.)*.19)*(.55+.45*sin(vWorld.y*.43+distance*.024));
       fog=max(fog,(1.-exp(-distance*.0022))*layer*.40);
      }
      c=mix(c,uFog,fog);
      if(uRetro>.5)c=rgb555(c,gl_FragCoord.xy);
      gl_FragColor=vec4(c,uAlpha*tex.a);}`;
  const SKYVS=`attribute vec2 aPosition;varying mediump vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,.999,1.);}`;
  const SKYFS=`precision highp float;varying mediump vec2 vUV;uniform vec3 uTop,uBottom;uniform float uTime,uRetro,uCinema;
  ${DITHER}
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){vec3 c=mix(uBottom,uTop,smoothstep(.02,.96,vUV.y));
   float haze=exp(-pow((vUV.y-.33)*5.,2.));c+=vec3(.004,.004,.009)*haze;
   if(uCinema>.5){
    float t=uTime*.018;float rays=0.;
    for(int i=0;i<4;i++){float f=float(i),centre=.17+f*.255+(vUV.y-.5)*(.16+f*.045);
     float shaft=exp(-pow((vUV.x-centre-sin(t+f)*.009)*(18.+f*3.),2.));
     rays+=shaft*(.4+.6*vUV.y)*(.75+.25*sin(vUV.y*8.+f+t));}
    c+=vec3(.092,.052,.018)*rays;
    c+=vec3(.013,.008,.031)*exp(-pow((vUV.y-.45)*7.,2.));
   }else{float shaft=pow(max(0.,1.-abs(vUV.x-(.70+(vUV.y-.5)*.37))*4.),5.);c+=vec3(.034,.025,.014)*shaft;}
   if(uRetro>.5)c=rgb555(c,gl_FragCoord.xy);gl_FragColor=vec4(c,1.);}`;
  // A four-level tent pyramid: each downsample removes high-frequency aliasing,
  // then each upsample gathers the wider halo into the next finer level.
  const BLOOMFS=`precision highp float;varying mediump vec2 vUV;uniform sampler2D uSource,uBase;uniform vec2 uTexel;uniform float uFirst,uUp,uThreshold;
   vec3 emissive(vec2 p){vec3 c=texture2D(uSource,p).rgb;float peak=max(c.r,max(c.g,c.b));return c*max(peak-uThreshold,0.)/max(peak,.001);}
   void main(){vec2 d=uTexel;vec3 c;
    // Extract before reducing: a one-pixel gold strip must not disappear just
    // because its dark neighbours pull an averaged pixel below the threshold.
    if(uFirst>.5){d*=.5;c=(emissive(vUV+d)+emissive(vUV-d)+emissive(vUV+vec2(d.x,-d.y))+emissive(vUV+vec2(-d.x,d.y)))*.25;}
    else{
     c=texture2D(uSource,vUV).rgb*4.;
     c+=texture2D(uSource,vUV+vec2(d.x,0.)).rgb*2.+texture2D(uSource,vUV-vec2(d.x,0.)).rgb*2.;
     c+=texture2D(uSource,vUV+vec2(0.,d.y)).rgb*2.+texture2D(uSource,vUV-vec2(0.,d.y)).rgb*2.;
     c+=texture2D(uSource,vUV+d).rgb+texture2D(uSource,vUV-d).rgb+texture2D(uSource,vUV+vec2(d.x,-d.y)).rgb+texture2D(uSource,vUV+vec2(-d.x,d.y)).rgb;c*=.0625;
    }
    if(uUp>.5)c=texture2D(uBase,vUV).rgb+c*.66;gl_FragColor=vec4(c,1.);}`;
  const POSTFS=`precision highp float;varying mediump vec2 vUV;uniform sampler2D uScene,uBloom;uniform vec2 uTexel;uniform float uGlow,uAA,uCRT,uCinema,uTime;
  vec3 antialias(vec2 p){
   vec3 c=texture2D(uScene,p).rgb;if(uAA<.5)return c;
   vec3 nw=texture2D(uScene,p+uTexel*vec2(-1.,-1.)).rgb,ne=texture2D(uScene,p+uTexel*vec2(1.,-1.)).rgb;
   vec3 sw=texture2D(uScene,p+uTexel*vec2(-1.,1.)).rgb,se=texture2D(uScene,p+uTexel*vec2(1.,1.)).rgb;
   vec3 l=vec3(.299,.587,.114);float m=dot(c,l),a=dot(nw,l),b=dot(ne,l),d=dot(sw,l),e=dot(se,l);
   float lo=min(m,min(min(a,b),min(d,e))),hi=max(m,max(max(a,b),max(d,e)));
   if(hi-lo<max(.018,hi*.12))return c;
   vec2 dir=vec2(-((a+b)-(d+e)),((a+d)-(b+e)));
   float red=max((a+b+d+e)*.03125,.0078125),inv=1./(min(abs(dir.x),abs(dir.y))+red);
   dir=clamp(dir*inv,vec2(-6.),vec2(6.))*uTexel;
   vec3 q=.5*(texture2D(uScene,p+dir*(-.1667)).rgb+texture2D(uScene,p+dir*.1667).rgb);
   vec3 h=q*.5+.25*(texture2D(uScene,p-dir*.5).rgb+texture2D(uScene,p+dir*.5).rgb);float lum=dot(h,l);
   return (lum<lo||lum>hi)?q:h;
  }
  vec3 bright(vec2 p){vec3 c=texture2D(uScene,p).rgb;return c*max(0.,max(c.r,max(c.g,c.b))-.59);}
  void main(){vec2 p=vUV;
   if(uCRT>.5){vec2 q=p*2.-1.;q*=1.+.018*dot(q,q);p=q*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}}
   vec3 c=antialias(p);
   if(uCinema>.5){
    c+=texture2D(uBloom,p).rgb*.40*uGlow;
    // ACES shoulder applied predominantly to peak luminance preserves semantic
    // red / amber / cyan hues instead of bleaching every emissive to white.
    float peak=max(c.r,max(c.g,c.b));
    vec3 fitted=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);
    float shoulder=(peak*(2.51*peak+.03))/(peak*(2.43*peak+.59)+.14);
    c=mix(fitted,c*(shoulder/max(peak,.0001)),.85);
    float lum=dot(c,vec3(.2126,.7152,.0722));
    c=mix(c,c*vec3(.84,.86,1.12),.38*(1.-lum));
    c=mix(c,c*vec3(1.055,1.012,.94),lum*.28);
    c*=mix(.84,1.035,smoothstep(.015,.65,lum));
    c*=1.-.14*pow(length((p-.5)*vec2(1.,.8)),1.6);
    float grain=fract(sin(dot(gl_FragCoord.xy+uTime*17.,vec2(12.9898,78.233)))*43758.5453);
    c+=(grain-.5)*.004;
   }else if(uGlow>0.){
    vec2 d=uTexel;vec3 b=bright(p+vec2(d.x,0.))+bright(p-vec2(d.x,0.))+bright(p+vec2(0.,d.y))+bright(p-vec2(0.,d.y));
    b+=bright(p+d*2.)*.7+bright(p-d*2.)*.7+bright(p+vec2(d.x,-d.y)*2.)*.7+bright(p+vec2(-d.x,d.y)*2.)*.7;c+=b*.085*uGlow;
   }
   if(uCRT>.5){
    c.r=mix(c.r,texture2D(uScene,p+vec2(uTexel.x*.32,0.)).r,.12);c.b=mix(c.b,texture2D(uScene,p-vec2(uTexel.x*.32,0.)).b,.12);
    c*=.91+.09*cos(p.y/uTexel.y*6.2831853);
    float mask=mod(floor(gl_FragCoord.x),3.);c*=vec3(mask<1.?1.:.966,mask>=1.&&mask<2.?1.:.966,mask>=2.?1.:.966);
   }
   if(uCRT>.5)c*=1.-.20*pow(length((p-.5)*vec2(1.,.8)),1.6);
   gl_FragColor=vec4(c,1.);}`;
  function program(gl,vs,fs,webgl2){
    function compile(type,source){
      if(webgl2){
        source=source.replace(/\battribute\b/g,'in').replace(/\bvarying\b/g,type===gl.VERTEX_SHADER?'out':'in').replace(/\btexture2D\b/g,'texture');
        if(type===gl.FRAGMENT_SHADER)source='out highp vec4 fragColor;\n'+source.replace(/\bgl_FragColor\b/g,'fragColor');
        source='#version 300 es\n'+source;
      }
      const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;
    }
    const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
  }
  const motionMedia=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  class Renderer {
    constructor(canvas){
      this.canvas=canvas;const options={alpha:false,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:false};
      let gl=canvas.getContext('webgl2',options);this.webgl2=!!gl;gl=this.gl=gl||canvas.getContext('webgl',options);
      if(!gl)throw Error('WebGL is unavailable. Enable hardware acceleration in your browser and reload.');
      this.hdr=this.webgl2&&!!gl.getExtension('EXT_color_buffer_float');
      this.colorFormat=this.hdr?gl.RGBA16F:this.webgl2?gl.RGBA8:gl.RGBA;
      const supportedSamples=this.webgl2?gl.getInternalformatParameter(gl.RENDERBUFFER,this.colorFormat,gl.SAMPLES):[];
      this.samples=supportedSamples.includes(2)?2:supportedSamples.includes(4)?4:0;
      this.prog=program(gl,VS,FS,this.webgl2);this.skyprog=program(gl,SKYVS,SKYFS,this.webgl2);this.postprog=program(gl,SKYVS,POSTFS,this.webgl2);this.bloomprog=program(gl,SKYVS,BLOOMFS,this.webgl2);
      this.u={};for(const s of ['Model','VP','Normal','Retro','Cinema','Emission','Snap','Affine','Resolution','Tint','Camera','Fog','Material','UseTexture','Alpha','Texture','FogNear','FogFar','Bend','Dark','Path','Collapse'])this.u[s]=gl.getUniformLocation(this.prog,'u'+s);
      this.a={};for(const s of ['Position','Normal','Color','UV'])this.a[s]=gl.getAttribLocation(this.prog,'a'+s);
      this.attributes=Object.values(this.a);this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.skyLoc=gl.getAttribLocation(this.skyprog,'aPosition');this.skyU={};for(const s of ['Top','Bottom','Time','Retro','Cinema'])this.skyU[s]=gl.getUniformLocation(this.skyprog,'u'+s);
      this.postA=gl.getAttribLocation(this.postprog,'aPosition');this.postU={};for(const s of ['Scene','Bloom','Texel','Glow','AA','CRT','Cinema','Time'])this.postU[s]=gl.getUniformLocation(this.postprog,'u'+s);
      this.bloomA=gl.getAttribLocation(this.bloomprog,'aPosition');this.bloomU={};for(const s of ['Source','Base','Texel','First','Up','Threshold'])this.bloomU[s]=gl.getUniformLocation(this.bloomprog,'u'+s);
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      this.textures=new Map();this.drawCalls=0;this.vertexCount=0;this.skyTop=rgb(0x070e16);this.fog=rgb(0x253b48);this.fogNear=100;this.fogFar=300;
      this.renderScale=1;this.frameAverage=16.67;this.scaleFrames=0;
      this.setStyle({preset:'cinema',lines:240});this.resize(canvas.width,canvas.height);
    }
    get style(){
      const reducedMotion=this.reduceMotion||!!motionMedia?.matches;
      if(this._style.reducedMotion!==reducedMotion)this._style=Object.freeze({...this._style,reducedMotion,snap:this._style.lowResolution&&!reducedMotion});
      return this._style;
    }
    get retro(){return this._style.lowResolution;}
    set retro(value){this.setStyle({preset:value?'retro':'cinema'});}
    setStyle({preset=this._style?.preset??'cinema',lines=this._style?.lines??240,reducedMotion=this.reduceMotion??false}={}){
      if(!['cinema','retro','retro-crt'].includes(preset)||![240,480].includes(lines))throw new RangeError('Renderer style requires cinema, retro or retro-crt and 240 or 480 lines.');
      this.reduceMotion=!!reducedMotion;reducedMotion=this.reduceMotion||!!motionMedia?.matches;const lowResolution=preset!=='cinema',filterChanged=this._style?.nearest!==lowResolution;
      this._style=Object.freeze({preset,lines,lowResolution,snap:lowResolution&&!reducedMotion,affine:lowResolution,dither:lowResolution,nearest:lowResolution,crt:preset==='retro-crt',fxaa:!lowResolution&&!this.samples,msaa:lowResolution?0:this.samples,bloom:preset!=='retro',reducedMotion});
      this.canvas.style.imageRendering=lowResolution?'pixelated':'auto';
      if(filterChanged){const gl=this.gl;for(const [texture,mipmaps] of this.textures){gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,lowResolution?gl.NEAREST:mipmaps?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,lowResolution?gl.NEAREST:gl.LINEAR);}this.lastTexture=null;}
      if(this.w)this.resize(this.w,this.h);return this.style;
    }
    resize(w,h){
      this.w=Math.max(1,Math.round(w));this.h=Math.max(1,Math.round(h));this.aspect=this.w/this.h;
      const dpr=Math.min(globalThis.devicePixelRatio||1,2560/Math.max(this.w,this.h));
      // Adapt the output as well as the scene: otherwise a full-size tone-map
      // pass and compositor copy remain the bottleneck on integrated GPUs.
      const style=this.style,scale=style.lowResolution?1:this.renderScale;
      const width=Math.max(1,Math.round(this.w*dpr*scale)),height=Math.max(1,Math.round(this.h*dpr*scale));
      if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
      this.internalH=style.lowResolution?Math.min(height,style.lines):height;
      this.internalW=style.lowResolution?Math.max(2,Math.round(this.internalH*this.aspect/2)*2):width;
    }
    deleteTarget(target){
      if(!target)return;const gl=this.gl;gl.deleteFramebuffer(target.fb);gl.deleteTexture(target.tex);if(target.depth)gl.deleteRenderbuffer(target.depth);
      if(target.msfb){gl.deleteFramebuffer(target.msfb);gl.deleteRenderbuffer(target.color);gl.deleteRenderbuffer(target.msdepth);}
    }
    target(w,h,depth=false,samples=0,nearest=false){
      const gl=this.gl,fb=gl.createFramebuffer(),tex=gl.createTexture(),filter=nearest?gl.NEAREST:gl.LINEAR;
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,this.colorFormat,w,h,0,gl.RGBA,this.hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
      const t={fb,tex,w,h,samples,nearest};
      if(depth&&!samples){t.depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,t.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.depth);}
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('WebGL scene framebuffer is incomplete.');
      if(samples){
        t.msfb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,t.msfb);
        t.color=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,t.color);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,this.colorFormat,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,t.color);
        t.msdepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,t.msdepth);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.msdepth);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('WebGL multisample framebuffer is incomplete.');
      }
      return t;
    }
    startFrame(){
      const gl=this.gl,style=this.style,stamp=performance.now(),interval=stamp-(this.frameStamp||stamp);this.frameStamp=stamp;
      // Lower scale only after sustained missed refreshes, never during tab return
      // or initialization. Slow recovery avoids oscillation at the threshold.
      if(!style.lowResolution&&interval>0&&interval<80&&!document.hidden){
        this.frameAverage+=(interval-this.frameAverage)*.025;this.scaleFrames++;
        if(this.scaleFrames>=180&&this.frameAverage>20.5&&this.renderScale>.65){this.renderScale=Math.max(.65,this.renderScale*.9);this.scaleFrames=0;this.resize(this.w,this.h);}
        else if(this.scaleFrames>=900&&this.frameAverage<17.2&&this.renderScale<1){this.renderScale=Math.min(1,this.renderScale+.05);this.scaleFrames=0;this.resize(this.w,this.h);}
      }
      const w=this.internalW,h=this.internalH,t=this.postTarget;
      if(!t||t.w!==w||t.h!==h||t.samples!==style.msaa||t.nearest!==style.nearest){
        this.deleteTarget(t);for(const level of this.bloomLevels||[]){this.deleteTarget(level.down);this.deleteTarget(level.up);}
        this.postTarget=this.target(w,h,true,style.msaa,style.nearest);this.bloomLevels=[];
        if(!style.lowResolution)for(let i=0;i<4;i++){const bw=Math.max(1,w>>(i+1)),bh=Math.max(1,h>>(i+1));this.bloomLevels.push({down:this.target(bw,bh),up:i<3?this.target(bw,bh):null});}
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.postTarget.msfb||this.postTarget.fb);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);this.lastTexture=null;this.lastBuffer=null;this.drawCalls=0;this.vertexCount=0;
    }
    screenPass(prog,attribute){
      const gl=this.gl;if(this.webgl2)gl.bindVertexArray(null);gl.useProgram(prog);for(const i of this.attributes)gl.disableVertexAttribArray(i);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,8,0);
    }
    bloomPass(source,target,base=null,first=false){
      const gl=this.gl,u=this.bloomU;gl.bindFramebuffer(gl.FRAMEBUFFER,target.fb);gl.viewport(0,0,target.w,target.h);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,source.tex);gl.uniform1i(u.Source,0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,(base||source).tex);gl.uniform1i(u.Base,1);gl.uniform2f(u.Texel,1/source.w,1/source.h);gl.uniform1f(u.First,first?1:0);gl.uniform1f(u.Up,base?1:0);gl.uniform1f(u.Threshold,this.hdr?.96:.72);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    finishFrame(glow=1){
      const gl=this.gl,style=this.style,t=this.postTarget;if(!t)return;gl.disable(gl.SCISSOR_TEST);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
      if(t.msfb){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,t.msfb);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,t.fb);gl.blitFramebuffer(0,0,t.w,t.h,0,0,t.w,t.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);}
      let bloom=t;
      if(!style.lowResolution){
        this.screenPass(this.bloomprog,this.bloomA);let source=t;
        for(let i=0;i<this.bloomLevels.length;i++){const level=this.bloomLevels[i];this.bloomPass(source,level.down,null,i===0);source=level.down;}
        for(let i=this.bloomLevels.length-2;i>=0;i--){const level=this.bloomLevels[i];this.bloomPass(source,level.up,level.down);source=level.up;}bloom=source;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);this.screenPass(this.postprog,this.postA);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.uniform1i(this.postU.Scene,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,bloom.tex);gl.uniform1i(this.postU.Bloom,1);
      gl.uniform2f(this.postU.Texel,1/t.w,1/t.h);gl.uniform1f(this.postU.Glow,style.bloom?glow:0);gl.uniform1f(this.postU.AA,style.fxaa?1:0);gl.uniform1f(this.postU.CRT,style.crt?1:0);gl.uniform1f(this.postU.Cinema,style.lowResolution?0:1);gl.uniform1f(this.postU.Time,style.reducedMotion?0:this.time||0);gl.drawArrays(gl.TRIANGLES,0,6);
      gl.activeTexture(gl.TEXTURE0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);this.lastBuffer=null;this.lastTexture=null;
    }
    vertexLayout(buffer){
      const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(this.a.Position);gl.vertexAttribPointer(this.a.Position,3,gl.FLOAT,false,44,0);
      gl.enableVertexAttribArray(this.a.Normal);gl.vertexAttribPointer(this.a.Normal,3,gl.FLOAT,false,44,12);
      gl.enableVertexAttribArray(this.a.Color);gl.vertexAttribPointer(this.a.Color,3,gl.FLOAT,false,44,24);
      gl.enableVertexAttribArray(this.a.UV);gl.vertexAttribPointer(this.a.UV,2,gl.FLOAT,false,44,36);
    }
    mesh(builder){
      const gl=this.gl,b=gl.createBuffer(),data=new Float32Array(builder.a);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      let vao=null;if(this.webgl2){vao=gl.createVertexArray();gl.bindVertexArray(vao);this.vertexLayout(b);gl.bindVertexArray(null);}
      this.lastBuffer=null;return {buffer:b,vao,count:data.length/11,data};
    }
    deleteMesh(mesh){this.gl.deleteBuffer(mesh.buffer);if(mesh.vao)this.gl.deleteVertexArray(mesh.vao);}
    texture(canvas,{repeat=false}={}){
      const gl=this.gl;if(repeat&&((canvas.width&(canvas.width-1))||(canvas.height&(canvas.height-1))))throw new RangeError('Repeating textures must have power-of-two dimensions.');
      const t=gl.createTexture(),nearest=this.style.nearest,mipmaps=!(canvas.width&(canvas.width-1))&&!(canvas.height&(canvas.height-1));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);if(mipmaps)gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,nearest?gl.NEAREST:mipmaps?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,nearest?gl.NEAREST:gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
      this.textures.set(t,mipmaps);this.lastTexture=null;return t;
    }
    begin(eye,target,fov=60,viewport=null){
      const gl=this.gl,style=this.style;let vw=this.internalW,vh=this.internalH;
      if(viewport){const sx=this.internalW/this.w,sy=this.internalH/this.h,x=Math.round(viewport[0]*sx),y=Math.round(viewport[1]*sy);vw=Math.max(1,Math.round((viewport[0]+viewport[2])*sx)-x);vh=Math.max(1,Math.round((viewport[1]+viewport[3])*sy)-y);gl.enable(gl.SCISSOR_TEST);gl.scissor(x,y,vw,vh);gl.viewport(x,y,vw,vh);}
      else{gl.disable(gl.SCISSOR_TEST);gl.viewport(0,0,vw,vh);}
      gl.clearColor(...this.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);this.screenPass(this.skyprog,this.skyLoc);
      gl.uniform3fv(this.skyU.Top,this.skyTop);gl.uniform3fv(this.skyU.Bottom,this.fog);gl.uniform1f(this.skyU.Time,style.reducedMotion?0:this.time||0);gl.uniform1f(this.skyU.Retro,style.dither?1:0);gl.uniform1f(this.skyU.Cinema,style.lowResolution?0:1);gl.drawArrays(gl.TRIANGLES,0,6);
      gl.enable(gl.DEPTH_TEST);gl.useProgram(this.prog);this.eye=eye;const aspect=viewport?viewport[2]/viewport[3]:this.aspect,roll=style.reducedMotion?0:this.roll||0;
      this.vp=mul(perspective(fov*Math.PI/180,aspect),lookAt(eye,target,[Math.sin(roll),Math.cos(roll),0]));
      gl.uniformMatrix4fv(this.u.VP,false,this.vp);gl.uniform3fv(this.u.Camera,eye);gl.uniform3fv(this.u.Fog,this.fog);gl.uniform1f(this.u.FogNear,this.fogNear);gl.uniform1f(this.u.FogFar,this.fogFar);gl.uniform1f(this.u.Bend,this.bend||0);gl.uniform4fv(this.u.Path,this.path||[0,100,0,0]);gl.uniform1f(this.u.Collapse,this.collapse||0);gl.uniform1f(this.u.Dark,this.dark??1);
      gl.uniform1f(this.u.Retro,style.dither?1:0);gl.uniform1f(this.u.Cinema,style.lowResolution?0:1);this.frameSnap=style.snap;this.lastSnap=style.snap?1:0;gl.uniform1f(this.u.Snap,this.lastSnap);gl.uniform1f(this.u.Affine,style.affine?1:0);gl.uniform2f(this.u.Resolution,vw,vh);gl.uniform1i(this.u.Texture,0);this.lastBuffer=null;this.lastTexture=null;
      gl.uniform1f(this.u.Emission,this.hdr?2.5:1.17);
      this.lastMaterial=null;this.lastAlpha=null;this.lastTextured=null;
    }
    // snap=false keeps close articulated meshes stable; undefined inherits the scene style.
    draw(mesh,m=I(),color=[1,1,1],material=0,texture=null,alpha=1,snap=true){
      if(!mesh)return;const gl=this.gl,s=this.frameSnap&&snap?1:0;
      if(s!==this.lastSnap){gl.uniform1f(this.u.Snap,s);this.lastSnap=s;}
      if(mesh.buffer!==this.lastBuffer){if(mesh.vao)gl.bindVertexArray(mesh.vao);else this.vertexLayout(mesh.buffer);this.lastBuffer=mesh.buffer;}
      gl.uniformMatrix4fv(this.u.Model,false,m);gl.uniformMatrix3fv(this.u.Normal,false,normals(m));gl.uniform3fv(this.u.Tint,color);
      if(material!==this.lastMaterial){gl.uniform1f(this.u.Material,material);this.lastMaterial=material;}
      const textured=!!texture;if(textured!==this.lastTextured){gl.uniform1f(this.u.UseTexture,textured?1:0);this.lastTextured=textured;}
      if(alpha!==this.lastAlpha){gl.uniform1f(this.u.Alpha,alpha);this.lastAlpha=alpha;}
      if(texture&&texture!==this.lastTexture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);this.lastTexture=texture;}
      gl.drawArrays(gl.TRIANGLES,0,mesh.count);this.drawCalls++;this.vertexCount+=mesh.count;
    }
    node(n,parent=null,snap=true,alpha=1){if(!n.visible)return;const m=parent?mul(parent,n.matrix()):n.matrix();snap=n.snap??snap;alpha*=n.alpha;if(n.mesh)this.draw(n.mesh,m,n.color,n.material,n.texture,alpha,snap);for(const c of n.children)this.node(c,m,snap,alpha);}
    project(x,y,z){const m=this.vp,w=m[3]*x+m[7]*y+m[11]*z+m[15];return {x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5,y:.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5,w};}
  }
  return {Renderer,Builder,Node,I,mul,compose,rgb,norm,cross};
})();
