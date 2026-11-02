/* THE POSTER, LIVE. Offline depth + authored masks; no inference at runtime.
 * The world renderer checks SandboxCover.active() before beginning a frame.
 * Two retained draws: a depth-reprojected plate and instanced-by-point debris.
 */
const Cover=(()=>{
 const title=$('title-screen'),canvas=$('cover-canvas'),still=$('cover-still'),drawer=$('cover-drawer');
 // Keep the real-world citation action reachable when the title footer is hidden.
 drawer.querySelector('.title-links').append($('case-notes'));
 const active=()=>status==='title'&&!title.classList.contains('hidden');
 let opener=$('cover-systems');
 function closeDrawer(focus=false){
  drawer.classList.add('hidden');$('cover-systems').setAttribute('aria-expanded','false');$('cover-progress').setAttribute('aria-expanded','false');
  if(focus)menuFocus(opener);
 }
 function openDrawer(button){
  if(!drawer.classList.contains('hidden')){closeDrawer(true);return;}
  opener=button;drawer.classList.remove('hidden');$('cover-systems').setAttribute('aria-expanded','true');$('cover-progress').setAttribute('aria-expanded','true');
  menuFocus($('cover-close'));
  if(button.id==='cover-progress')$('title-loop').scrollIntoView({block:'nearest'});
 }
 $('cover-systems').onclick=e=>openDrawer(e.currentTarget);$('cover-progress').onclick=e=>openDrawer(e.currentTarget);$('cover-close').onclick=()=>closeDrawer(true);
 const progressLabel=()=>{const epoch=$('title-loop').querySelector('.loop-epoch>strong');if(epoch)$('cover-progress').firstChild.nodeValue=epoch.textContent.trim()+' ';};
 new MutationObserver(progressLabel).observe($('title-loop'),{childList:true,subtree:true,characterData:true});progressLabel();
 new MutationObserver(()=>{if(!$('modal').classList.contains('hidden'))closeDrawer();}).observe($('modal'),{attributes:true,attributeFilter:['class']});
 hook('reset',()=>closeDrawer());
 const api=Object.freeze({active,back:()=>{if(!active()||modalKind||drawer.classList.contains('hidden'))return false;closeDrawer(true);return true;}});
 window.SandboxCover=api;
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
 const images=[],textures=[],frame=new Float32Array(4),motion=new Float32Array(2),points=new Float32Array(128*6);
 let plate,particles,quadBuffer,pointBuffer,ready=false,lost=false,portrait=false,width=0,height=0,ratio=0,elapsed=0,previous=performance.now(),frames=0,lastActive=false,lastQuiet=false,dirty=true;
 let aimX=0,aimY=0,lookX=0,lookY=0;
 const vertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=vec2(aPosition.x*.5+.5,.5-aPosition.y*.5);gl_Position=vec4(aPosition,0.,1.);}`;
 const fragment=`precision highp float;
 varying vec2 vUV;uniform sampler2D uArt,uDepth,uFX;uniform vec4 uFrame;uniform vec2 uMotion,uPixels;uniform float uTime,uQuiet,uPortrait;
 float box(vec2 p,vec2 a,vec2 b,float f){vec2 e=smoothstep(a,a+f,p)*(1.-smoothstep(b-f,b,p));return e.x*e.y;}
 float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){
  vec2 uv=(vUV-uFrame.xy)/uFrame.zw;
  float inside=box(uv,vec2(0.),vec2(1.),.004);
  float lettering=mix(box(uv,vec2(.025,.19),vec2(.401,.415),.018),box(uv,vec2(.025,.055),vec2(.975,.237),.018),uPortrait);
  float edge=box(uv,vec2(0.),vec2(1.),.055);
  vec2 p=clamp(uv,0.,1.);float depth=texture2D(uDepth,p).r;
  vec2 drift=uMotion*(1.-lettering)*edge;
  p+=drift*(depth-.30);
  depth=texture2D(uDepth,p).r;
  p=clamp(uv+drift*(depth-.30)+(uv-.5)*sin(uTime*.15)*.0018*(1.-lettering)*(1.-uQuiet),0.,1.);
  vec3 fx=texture2D(uFX,p).rgb;
  float glitch=(1.-smoothstep(.075,.17,mod(uTime+4.,13.7)))*(1.-uQuiet);
  float slice=step(.42,fract(p.y*185.))*step(fract(p.y*185.),.72);
  vec3 color=texture2D(uArt,p+vec2(glitch*fx.r*slice*.006,0.)).rgb;
  float pulse=.5+.5*sin(uTime*1.65);
  color+=fx.r*vec3(.12,.46,.34)*(.17+pulse*.43);
  color+=fx.g*vec3(.19,.105,.035)*(.22+.25*sin(uTime*.82));
  color+=fx.b*vec3(.06,.021,.12)*(.18+.15*sin(p.y*37.-uTime*1.3));
  // Travelling highlights follow the gold already painted into the poster.
  float gold=smoothstep(.06,.28,color.r-color.b)*smoothstep(.16,.65,color.r)*(1.-lettering);
  float current=.5+.5*sin(p.x*43.+p.y*15.-uTime*1.4);
  color+=gold*vec3(.075,.043,.009)*pow(current,5.);
  // Fine, independently flowing filaments continue the coordinator's signal.
  float ribbonY=mix(.357+.036*sin(p.x*19.+uTime*.19),.337+.033*sin(p.x*11.+uTime*.19),uPortrait);
  float ribbonWindow=mix(smoothstep(.45,.51,p.x)*(1.-smoothstep(.86,.93,p.x)),1.-smoothstep(.38,.54,p.x),uPortrait);
  float ribbons=0.;
  for(int i=0;i<3;i++){float k=float(i),d=abs(p.y-ribbonY-k*.0055-.004*sin(p.x*29.-uTime*.28+k));ribbons+=(1.-smoothstep(.0006,.0015,d))*.13+exp(-d*230.)*.012;}
  color+=vec3(1.,.66,.26)*ribbons*ribbonWindow*(.35+.65*pow(.5+.5*sin(p.x*23.-uTime*.8),2.))*(1.-uQuiet);
  float sweep=exp(-pow((p.x+p.y*.31-fract(uTime*.025)*1.7)*16.,2.));
  color+=vec3(.085,.066,.035)*sweep*color*(1.-lettering)*(1.-uQuiet);
  float vignette=1.-.20*dot((vUV-.5)*vec2(1.1,1.),(vUV-.5)*vec2(1.1,1.));
  color*=vignette;
  color+=(hash(floor(vUV*uPixels)+floor(uTime*12.))-.5)*.008*(1.-uQuiet);
  color=mix(vec3(.012,.023,.030),color,inside);
  gl_FragColor=vec4(color,1.);
 }`;
 const pointVertex=`precision highp float;
 attribute vec3 aPoint,aStyle;uniform vec4 uFrame;uniform vec2 uMotion;uniform float uTime,uScale;
 varying float vKind,vAlpha,vSeed;
 void main(){
  float seed=aStyle.x,kind=aStyle.y,depth=aPoint.z;
  vec2 p=aPoint.xy;float alpha=1.;
  if(kind<.5){p=fract(p+vec2(uTime*(.001+depth*.003),-uTime*(.002+depth*.004)));alpha=.30+.25*sin(seed*19.+uTime*.6);}
  else if(kind<1.5){float life=fract(seed+uTime*(.095+depth*.035));p+=vec2(-.19*life,.035*life+.005*sin(life*9.+seed*17.));alpha=sin(life*3.14159)*.68;}
  else{p.y+=sin(uTime*(.24+seed*.3)+seed*21.)*.009;p.x+=cos(uTime*.22+seed*13.)*.003;alpha=.64;}
  p-=uMotion*(depth-.3);p=uFrame.xy+p*uFrame.zw;
  gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);
  gl_PointSize=aStyle.z*uScale*(.6+depth*.6);vAlpha=alpha;vKind=kind;vSeed=seed;
 }`;
 const pointFragment=`precision mediump float;varying float vKind,vAlpha,vSeed;
 void main(){vec2 p=gl_PointCoord*2.-1.;float alpha=vAlpha;vec3 color;
  if(vKind<.5){alpha*=1.-smoothstep(.12,1.,dot(p,p));color=mix(vec3(.39,.54,.58),vec3(1.,.69,.30),vSeed);}
  else if(vKind<1.5){alpha*=1.-smoothstep(.65,1.,max(abs(p.x),abs(p.y)));color=vec3(.65,.38,1.);}
  else{float rim=1.-abs(p.x)*.52;alpha*=1.-smoothstep(rim-.10,rim,abs(p.y));alpha*=1.-smoothstep(.82,.95,abs(p.x));color=p.y<-.33*abs(p.x)?vec3(.38,.33,.23):p.x>0.?vec3(.055,.10,.13):vec3(.13,.19,.20);}
  gl_FragColor=vec4(color*alpha,alpha);
 }`;
 function program(vs,fs,attributes,uniforms){
  const p=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Cover shader: '+gl.getShaderInfoLog(shader));gl.attachShader(p,shader);gl.deleteShader(shader);}
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Cover program: '+gl.getProgramInfoLog(p));
  const result={id:p};for(const name of attributes)result[name]=gl.getAttribLocation(p,name);for(const name of uniforms)result[name]=gl.getUniformLocation(p,name);return result;
 }
 function seedPoints(){
  const random=rngSeed(7041);
  for(let i=0;i<128;i++){
   const kind=i<78?0:i<114?1:2,j=i*6,seed=random(),depth=.1+random()*.9;
   let x=random(),y=random();
   if(kind===1){x=portrait?.28+random()*.20:.20+random()*.17;y=portrait?.557+random()*.072:.525+random()*.07;}
   if(kind===2){x=i%2?.82+random()*.16:.02+random()*.15;y=.52+random()*.41;}
   points[j]=x;points[j+1]=y;points[j+2]=depth;points[j+3]=seed;points[j+4]=kind;points[j+5]=kind===2?9+random()*14:kind===1?2+random()*4:1.2+random()*3;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,pointBuffer);gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);
 }
 function initGL(){
  if(!gl)return;
  plate=program(vertex,fragment,['aPosition'],['uArt','uDepth','uFX','uFrame','uMotion','uPixels','uTime','uQuiet','uPortrait']);
  particles=program(pointVertex,pointFragment,['aPoint','aStyle'],['uFrame','uMotion','uTime','uScale']);
  quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  pointBuffer=gl.createBuffer();seedPoints();
  textures.length=0;
  for(const image of images){const texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);}
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);dirty=true;
 }
 function size(){
  const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2560/Math.max(w,h));
  if(w===width&&h===height&&ratio===dpr)return;
  width=w;height=h;ratio=dpr;portrait=w<=h;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const iw=portrait?780:1672,ih=portrait?1400:941;
  // Contain all three focal points. Tall landscapes reserve the dock below the
  // art; short landscapes put negative space at the left. The portrait's boot
  // ends at ~.86 of its plate, above the reserved greeting/menu rail.
  const stacked=!portrait&&w/h<1.6;
  const available=portrait?Math.max(180,Math.min(h-145,(h-253)/.86)):stacked?Math.max(180,$('cover-menu-dock').offsetTop-16):h;
  const scale=Math.min(w/iw,available/ih)*(portrait||stacked?1:1.008);
  const fw=iw*scale,fh=ih*scale,left=!portrait&&h<=620?w-fw:(w-fw)/2,top=portrait||stacked?0:(h-fh)/2;
  frame[0]=left/w;frame[1]=top/h;frame[2]=fw/w;frame[3]=fh/h;
  still.src=SandboxArt[portrait?'cover-portrait':'key'];still.style.cssText=`left:${left}px;top:${top}px;width:${fw}px;height:${fh}px`;
  if(gl&&ready&&!lost)seedPoints();dirty=true;
 }
 function draw(quiet){
  if(!gl||lost)return;
  gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.BLEND);gl.useProgram(plate.id);
  gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.enableVertexAttribArray(plate.aPosition);gl.vertexAttribPointer(plate.aPosition,2,gl.FLOAT,false,0,0);
  const first=portrait?3:0;for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[first+i]);}
  gl.uniform1i(plate.uArt,0);gl.uniform1i(plate.uDepth,1);gl.uniform1i(plate.uFX,2);gl.uniform4fv(plate.uFrame,frame);gl.uniform2fv(plate.uMotion,motion);gl.uniform2f(plate.uPixels,canvas.width,canvas.height);gl.uniform1f(plate.uTime,quiet?0:elapsed);gl.uniform1f(plate.uQuiet,quiet?1:0);gl.uniform1f(plate.uPortrait,portrait?1:0);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(plate.aPosition);
  if(!quiet){
   gl.enable(gl.BLEND);gl.useProgram(particles.id);gl.bindBuffer(gl.ARRAY_BUFFER,pointBuffer);
   gl.enableVertexAttribArray(particles.aPoint);gl.vertexAttribPointer(particles.aPoint,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(particles.aStyle);gl.vertexAttribPointer(particles.aStyle,3,gl.FLOAT,false,24,12);
   gl.uniform4fv(particles.uFrame,frame);gl.uniform2fv(particles.uMotion,motion);gl.uniform1f(particles.uTime,elapsed);gl.uniform1f(particles.uScale,ratio*Math.min(1.8,width/1200));gl.drawArrays(gl.POINTS,0,128);gl.disableVertexAttribArray(particles.aPoint);gl.disableVertexAttribArray(particles.aStyle);
  }
  frames++;
 }
 function tick(t){
  const dt=Math.min(.05,Math.max(0,(t-previous)/1000));previous=t;
  const visible=active(),quiet=reduced||progress.reducedMotion===true||renderer.style?.reducedMotion===true;
  if(visible&&ready&&!document.hidden&&!systemBootActive){
   size();
   if(!lastActive||quiet!==lastQuiet)dirty=true;
   if(!quiet){elapsed+=dt;const follow=1-Math.exp(-dt*2.8);lookX+=(aimX-lookX)*follow;lookY+=(aimY-lookY)*follow;motion[0]=Math.sin(elapsed*.19)*.006+lookX*.005;motion[1]=Math.cos(elapsed*.15)*.003+lookY*.003;}
   else{motion[0]=motion[1]=0;}
   if(!quiet||dirty){draw(quiet);dirty=false;}
   title.classList.add('cover-ready');
  }else if(!visible){title.classList.remove('cover-ready');}
  lastActive=visible;lastQuiet=quiet;requestAnimationFrame(tick);
 }
 window.addEventListener('pointermove',e=>{if(!active()||e.pointerType==='touch')return;aimX=(e.clientX/innerWidth-.5)*2;aimY=(e.clientY/innerHeight-.5)*2;},{passive:true});
 window.addEventListener('pointerout',e=>{if(!e.relatedTarget)aimX=aimY=0;},{passive:true});
 document.addEventListener('visibilitychange',()=>{dirty=true;previous=performance.now();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;canvas.style.visibility='hidden';});
 canvas.addEventListener('webglcontextrestored',()=>{lost=false;initGL();canvas.style.visibility='';});
 size();
 Promise.all(['key','cover-depth','cover-fx','cover-portrait','cover-portrait-depth','cover-portrait-fx'].map(key=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Cover art failed to decode: '+key));image.src=SandboxArt[key];}))).then(loaded=>{images.push(...loaded);initGL();ready=true;dirty=true;});
 requestAnimationFrame(tick);
 if(new URLSearchParams(location.search).get('test')==='1')window.__cover={info:()=>({active:active(),ready,lost,portrait,frames,quiet:lastQuiet,width:canvas.width,height:canvas.height,frame:Array.from(frame),glError:gl?.getError(),renderer:gl?gl.getParameter(gl.RENDERER):'static',drawer:!drawer.classList.contains('hidden')})};
 return api;
})();
