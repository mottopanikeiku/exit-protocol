/* Deterministic POT infrastructure: detailed 256–512px cinema surfaces and the
   original 64–128px RGB555 retro plates. Nodes retain one texture handle per name. */
const PS1Tex=(()=>{
 const cache=new Map(),bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 const names=Object.freeze(['floor-panel','raised-floor','perforated-tile','grate','steel-plate','concrete','server-rack','cable-tray','patch-panel','vent-grille','hazard-yellow','hazard-red','warning-sign','monitor-noise','vr-grid','containment-mesh','tape-bank','switchgear']);
 function paint(name,retro){
  const c=document.createElement('canvas'),w=name==='warning-sign'||name==='patch-panel'?128:64,h=name==='server-rack'||name==='warning-sign'?128:64,scale=retro?1:4;c.width=w*scale;c.height=h*scale;
  const q=c.getContext('2d',{willReadFrequently:true});q.scale(scale,scale);
  const rect=(x,y,w,h,color)=>{q.fillStyle=color;q.fillRect(x,y,w,h);};
  const screw=(x,y)=>{rect(x,y,3,3,'#252d31');rect(x,y,2,1,'#a3adae');};
  const panel=(fill='#929b9c')=>{rect(0,0,w,h,'#303c42');rect(1,1,w-2,h-2,fill);rect(1,1,w-2,1,'#c0c7c3');rect(1,1,1,h-2,'#acb6b5');rect(2,h-3,w-4,1,'#596469');};
  if(name==='floor-panel'||name==='raised-floor'){
   panel(name==='raised-floor'?'#909b9d':'#7e898e');for(const x of [5,w-8])for(const y of [5,h-8])screw(x,y);
   if(name==='floor-panel'){rect(14,14,36,36,'#778489');rect(15,15,34,1,'#a6afad');for(let y=20;y<47;y+=4)rect(19,y,26,1,'#69767b');}
   else{rect(24,5,16,2,'#535f65');rect(25,6,14,1,'#b4bcb9');for(let y=12;y<59;y+=5)for(let x=12;x<59;x+=5)rect(x,y,1,1,'#7a898e');}
  }else if(name==='perforated-tile'||name==='grate'){
   panel('#899699');for(let y=5;y<60;y+=name==='grate'?8:7)for(let x=5;x<60;x+=name==='grate'?12:7){rect(x,y,name==='grate'?9:3,name==='grate'?5:3,'#25343b');rect(x,y,1,name==='grate'?5:3,'#bdc7c2');}
  }else if(name==='steel-plate'){
   panel('#8a989d');for(let y=8;y<62;y+=8){rect(3,y,58,1,'#818f96');rect(3,y+1,58,1,'#95a2a4');}for(const x of [5,56])for(const y of [5,56])screw(x,y);
   rect(29,0,3,64,'#4f5e67');rect(32,0,1,64,'#b8c1bf');
  }else if(name==='concrete'){
   rect(0,0,w,h,'#939994');rect(0,0,64,2,'#666f6d');rect(0,0,2,64,'#6d7671');for(const x of [11,51])for(const y of [11,51]){rect(x,y,3,3,'#717d78');rect(x+1,y+1,1,1,'#bac0b7');}
   for(let i=0;i<28;i++){const x=(i*37)%60+2,y=(i*19)%59+3;rect(x,y,2+(i%4),1,i%2?'#a1aaa0':'#889289');}
  }else if(name==='server-rack'){
   rect(0,0,w,h,'#536169');rect(3,2,58,124,'#202e36');for(let y=5;y<124;y+=10){rect(6,y,52,8,'#5f6e76');rect(8,y+1,38,5,'#35464f');for(let x=11;x<46;x+=3)rect(x,y+2,1,3,'#7d8b91');rect(50,y+2,2,2,y%3?'#a9bf90':'#d6b67d');rect(54,y+2,1,2,'#899c8b');rect(8,y+6,37,1,'#89979a');}
   for(let y=6;y<126;y+=8){screw(1,y);screw(60,y);}
  }else if(name==='cable-tray'){
   rect(0,0,w,h,'#334149');for(let x=4;x<62;x+=7){rect(x,0,4,64,['#667b81','#958d7a','#526873'][Math.floor(x/7)%3]);rect(x,0,1,64,'#b4bbb3');}for(let y=3;y<64;y+=16){rect(0,y,64,3,'#34434a');rect(0,y,64,1,'#8e9d9e');}rect(0,0,3,64,'#a2aba7');rect(61,0,3,64,'#a2aba7');
  }else if(name==='patch-panel'){
   panel('#6e7d82');for(let y=7;y<58;y+=16)for(let x=7;x<125;x+=12){rect(x,y,9,7,'#182d36');rect(x+1,y+1,7,1,'#b0b9ae');rect(x+2,y+4,5,1,'#a49675');rect(x,y+10,8,2,'#acb6ae');}for(const x of [2,123])for(const y of [3,57])screw(x,y);
  }else if(name==='vent-grille'){
   panel('#889598');for(let y=8;y<59;y+=6){rect(7,y,50,4,'#394a52');rect(7,y,50,1,'#c0c7c1');}for(const x of [3,58])for(const y of [3,58])screw(x,y);
  }else if(name==='hazard-yellow'||name==='hazard-red'){
   const a=name==='hazard-red'?'#ae433e':'#c0a566',b=name==='hazard-red'?'#ddd8c4':'#303940';for(let y=0;y<64;y++)for(let x=0;x<64;x++)rect(x,y,1,1,(x+y)%32<16?a:b);rect(0,0,64,2,'#4c5556');rect(0,62,64,2,'#4c5556');
  }else if(name==='warning-sign'){
   rect(0,0,128,128,'#c2b48a');rect(3,3,122,122,'#26383f');rect(6,6,116,116,'#c2b48a');q.fillStyle='#26383f';q.beginPath();q.moveTo(64,15);q.lineTo(103,78);q.lineTo(25,78);q.closePath();q.fill();rect(61,34,6,24,'#d8c394');rect(61,64,6,6,'#d8c394');q.font='bold 12px monospace';q.textAlign='center';q.fillText('CAUTION',64,97);q.font='8px monospace';q.fillText('LIVE EQUIPMENT',64,111);
  }else if(name==='monitor-noise'){
   rect(0,0,64,64,'#253a42');for(let y=0;y<64;y+=2)for(let x=0;x<64;x+=2){const n=(x*73+y*31+x*y*7)%19;rect(x,y,2,1,n<3?'#82978f':n<10?'#425e64':'#30464d');}rect(5,8,25,2,'#a4b3a0');rect(5,13,18,1,'#799b92');rect(5,54,54,1,'#869f98');
  }else if(name==='containment-mesh'){
   rect(0,0,64,64,'#111a20');for(let y=0;y<64;y++)for(let x=0;x<64;x++){if((x+y)%16===0||(x-y+64)%16===0)rect(x,y,1,1,'#879195');}rect(0,0,3,64,'#596970');rect(0,0,64,3,'#596970');screw(1,1);
  }else if(name==='tape-bank'){
   rect(0,0,64,64,'#25303a');for(let y=2;y<64;y+=15){rect(1,y+12,62,2,'#78848a');for(let x=3;x<62;x+=10){rect(x,y,8,11,'#4b5662');rect(x+1,y+1,6,2,'#b3b2a1');rect(x+2,y+4,4,5,'#1c2931');rect(x+3,y+5,2,2,'#72818a');}}
  }else if(name==='switchgear'){
   panel('#8a9391');rect(6,7,52,21,'#34454b');for(let x=10;x<55;x+=12){rect(x,11,8,10,'#c1c3b3');rect(x+4,12,1,7,'#4c5552');}rect(10,36,12,18,'#28373c');rect(13,38,6,5,'#bcbeb0');for(let y=36;y<58;y+=5)rect(30,y,24,2,'#4e6063');screw(4,4);screw(57,57);
  }else if(name==='vr-grid'){
   rect(0,0,64,64,'#394c54');for(let v=0;v<64;v+=16){rect(v,0,1,64,'#687e83');rect(0,v,64,1,'#687e83');}rect(0,0,2,64,'#9db3ac');rect(0,0,64,2,'#9db3ac');rect(30,31,5,1,'#a9b9aa');rect(32,29,1,5,'#a9b9aa');
  }
  if(!retro&&!name.startsWith('hazard')&&name!=='warning-sign'){
   // Fine machined grain, brushed seams and broad planar variation; authored in
   // texture space at full resolution rather than enlarging a dithered thumbnail.
   q.fillStyle='#02080a0b';q.beginPath();q.moveTo(0,0);q.lineTo(w,h*.28);q.lineTo(w,h);q.fill();
   for(let i=0;i<88;i++){const x=(i*13.37)%w,y=(i*7.73)%h;rect(x,y,.18,1+(i%7)*.28,i%3?'#050c1019':'#e8d8b41c');}
   rect(1.35,1.35,w-2.7,.18,'#efdfc357');rect(w-1.5,1.5,.18,h-3,'#051017aa');
  }
  const image=q.getImageData(0,0,c.width,c.height),p=image.data;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const i=(y*c.width+x)*4,grain=((x*13+y*7+x*y*3)%9)-4;
   for(let k=0;k<3;k++){
    if(retro){const t=(bayer[(y%4)*4+x%4]+.5)/16;p[i+k]=Math.round(Math.min(31,Math.max(0,Math.floor((p[i+k]+grain)*31/255+t)))*255/31);}
    else p[i+k]=Math.max(0,Math.min(255,p[i+k]*(name.startsWith('hazard')||name==='warning-sign'?1:.58)+grain*.45));
   }
  }
  q.putImageData(image,0,0);return c;
 }
 function refresh(){
  const gl=renderer.gl,retro=renderer.style.nearest;gl.activeTexture(gl.TEXTURE0);
  for(const [name,entry] of cache){
   if(entry.retro===retro)continue;entry.retro=retro;
   const key=retro?'small':'large',canvas=entry[key]||(entry[key]=paint(name,retro));gl.bindTexture(gl.TEXTURE_2D,entry.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.generateMipmap(gl.TEXTURE_2D);
  }
  renderer.lastTexture=null;
 }
 return Object.freeze({names,refresh,get(name){
  if(!names.includes(name))throw new RangeError('Unknown infrastructure texture: '+name);
  if(!cache.has(name)){const retro=renderer.style.nearest,canvas=paint(name,retro);cache.set(name,{texture:renderer.texture(canvas,{repeat:true}),retro,[retro?'small':'large']:canvas});}
  return cache.get(name).texture;
 }});
})();
