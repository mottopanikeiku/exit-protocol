/* Gift presentation reads core choices. Gate, receipt and ordinary callouts share one message band. */
const GiftArt=(()=>{
 const definitions=Object.fromEntries(Campaign.GIFTS.map(g=>[g.id,g])),colors={eye:0xbfa4ff,tendril:0x83dec5,mouth:0xf2a7ce,membrane:0x88ceff,pulse:0xc6b0ff,echo:0xffcb8d,mask:0xa3e0d8,hunger:0xf7ad99,refuse:0xf2f5eb};
 const circle=(x,y,r,sy=1,n=24)=>Array.from({length:n+1},(_,i)=>[x+Math.cos(i*Math.PI*2/n)*r,y+Math.sin(i*Math.PI*2/n)*r*sy]);
 const paths={
  eye:[[[ -1,0],[-.65,.4],[0,.58],[.65,.4],[1,0],[.65,-.4],[0,-.58],[-.65,-.4],[-1,0]],circle(0,0,.27)],
  tendril:[[[-.75,-.95],[-.85,-.35],[-.3,.1],[-.55,.55],[-.15,.95]],[[0,-.95],[.25,-.4],[-.05,.05],[.4,.55],[.25,.95]],[[.65,-.95],[.9,-.35],[.55,.2],[.9,.7]]],
  mouth:[[[-.95,.45],[-.8,-.25],[-.35,-.65],[.35,-.65],[.8,-.25],[.95,.45],[-.95,.45]],[[-.6,.45],[-.45,0],[-.25,.45]],[[.2,.45],[.4,-.05],[.6,.45]]],
  membrane:[circle(0,0,.94,1,8),circle(0,0,.60,1,8)],
  pulse:[[[-1,0],[-.6,0],[-.3,.8],[.05,-.85],[.35,.35],[.55,0],[1,0]]],
  echo:[[[-.9,-.8],[-.4,-.4],[-.1,0],[-.4,.4],[-.9,.8]],[[-.05,-.8],[.5,-.4],[.85,0],[.5,.4],[-.05,.8]]],
  mask:[circle(0,0,.9,1,12),[[-.6,.2],[-.2,.2]],[[.2,.2],[.6,.2]],[[-.4,-.4],[.4,-.4]]],
  hunger:[[[-.95,.8],[.95,.8],[.65,-.45],[0,-.95],[-.65,-.45],[-.95,.8]],[[-.65,.8],[-.4,-.05],[-.1,.8]],[[.1,.8],[.4,-.05],[.65,.8]]],
  refuse:[circle(0,0,.93,1,24),[[-.66,-.66],[.66,.66]]]
 };
 const icons={},models={},tints={};
 const frame=renderer.mesh(new Builder().box(-1.43,2.8,0,.10,5.6,.16).box(1.43,2.8,0,.10,5.6,.16).box(0,5.6,0,2.96,.10,.16).box(0,.07,0,2.96,.09,.28));
 function stroke(builder,points){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)continue;const x=(b[1]-a[1])*.045/length,y=(a[0]-b[0])*.045/length;builder.quad([a[0]+x,a[1]+y,0],[b[0]+x,b[1]+y,0],[b[0]-x,b[1]-y,0],[a[0]-x,a[1]-y,0]);}}
 for(const id of Object.keys(paths)){
  const color=colors[id],hex='#'+color.toString(16),builder=new Builder(),data=definitions[id];tints[id]=rgb(color);
  for(const path of paths[id])stroke(builder,path);
  icons[id]='<svg viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true"><g transform="scale(1,-1)" fill="none" stroke="currentColor" stroke-width=".12" stroke-linecap="round" stroke-linejoin="round">'+paths[id].map(p=>'<path d="'+p.map((v,i)=>(i?'L':'M')+v.map(n=>n.toFixed(3)).join(' ')).join(' ')+'"/>').join('')+'</g></svg>';
  const root=new Node();root.snap=false;root.add(new Node(frame,color,2),new Node(renderer.mesh(builder),color,2).at(0,4.1,.12).scale(.76));
  root.add(textNode(labelTexture(data?.label||'REFUSE','', '#10161c',hex),0,5.12,.12,2.72,.68));
  root.add(textNode(labelTexture(data?.gateText||'+1 KEY / STAY YOURSELF',data?'+1 CORRUPTION':'NO GIFT TAKEN','#10161c',hex),0,2.99,.12,2.75,.77));models[id]=root;
 }
 const floor=renderer.mesh(new Builder().torus(1,.035,24,3)),spark=renderer.mesh(new Builder().tri([-.08,-.13,0],[.12,-.04,0],[0,.17,0]));
 const hud=document.createElement('div'),heading=document.createElement('strong'),list=document.createElement('div'),preview=document.createElement('div');
 hud.id='gift-hud';hud.hidden=true;heading.className='gift-heading';list.className='gift-icons';hud.append(heading,list);preview.id='gift-preview';preview.hidden=true;preview.setAttribute('role','group');preview.setAttribute('aria-label','Gift gate: choose a lane while running');document.body.append(hud,preview);
 const chips={};for(const gift of Campaign.GIFTS){const el=document.createElement('span');el.className='gift-chip';el.hidden=true;el.style.setProperty('--gift-color','#'+colors[gift.id].toString(16));el.innerHTML=icons[gift.id]+'<b></b>';list.append(el);chips[gift.id]={el,count:el.querySelector('b'),last:''};}
 const integrity=document.createElement('b');integrity.className='gift-integrity-count';integrity.hidden=true;$('health').previousElementSibling.append(integrity);
 const spoken=new Set(),test=new URLSearchParams(location.search).get('test')==='1',events=[];
 let gate=null,receiptUntil=0,burstAt=-100,burstD=0,burstX=0,burstId='eye',total=-1;
 const moving=()=>!reduced&&!renderer.style.reducedMotion;
 const sound=id=>{if(Sound.hasEffect(id))Sound.effect(id);};
 function radio(id,priority='reactive'){
  if(!id||spoken.has(id)||!PHASE_LINES[id])return;
  spoken.add(id);PhaseOne.radio(id,{priority,critical:false});
 }
 function showGate(){
  if(!gate)return;
  preview.classList.remove('gift-picked');preview.innerHTML=[-1,0,1].map(lane=>{const id=Core.giftForLane(gate,lane)||'refuse',g=definitions[id];return '<span class="gift-choice" data-gift-lane="'+lane+'" style="--gift-color:#'+colors[id].toString(16)+'">'+icons[id]+'<strong>'+['L','C','R'][lane+1]+' / '+(g?.label||'REFUSE')+'</strong><small>'+(g?.gateText||'KEEP YOURSELF')+'</small><em>'+(g?'+1 CORRUPTION':'+1 KEY')+'</em></span>';}).join('');
 }
 function receipt(id,title,text){
  receiptUntil=game.time+1.35;preview.classList.add('gift-picked');preview.innerHTML='<span class="gift-receipt" style="--gift-color:#'+colors[id].toString(16)+'">'+icons[id]+'<strong>'+title+'</strong><small>'+text+'</small></span>';
 }
 function update(){
  const live=['running','paused'].includes(status)&&!modalKind,visible=live&&!!game.gifts;
  if(!visible){hud.hidden=true;preview.hidden=true;preview.classList.remove('visible');return;}
  const count=game.gifts.length;hud.hidden=!count;
  if(count!==total){total=count;heading.textContent='GIFTS · '+count;hud.setAttribute('aria-label',count+' gifts; '+count+' corruption');}
  for(const gift of Campaign.GIFTS){const c=chips[gift.id],n=Core.giftCount(game,gift.id),remaining=n-(game.giftUsed[gift.id]||0),limited=gift.id==='mouth'||gift.id==='mask';c.el.hidden=!n;if(!n)continue;const text=limited?remaining+'/'+n:n>1?'×'+n:'';if(text!==c.last){c.count.textContent=text;c.last=text;}c.el.classList.toggle('gift-spent',limited&&!remaining);c.el.title=gift.label+' ×'+n+' — '+gift.description+(limited?' '+remaining+' charges remain.':'');c.el.setAttribute('aria-label',c.el.title);}
  const active=!!gate?.announced&&!gate.done||game.time<receiptUntil;preview.hidden=!active;preview.classList.toggle('visible',active);
  if(active&&!preview.classList.contains('gift-picked'))for(const el of preview.children)el.classList.toggle('selected',Number(el.dataset.giftLane)===game.lane);
  hud.classList.toggle('gift-flash',moving()&&game.time-burstAt<.5);
  const health=$('health'),maximum=game.maxHP||3;while(health.children.length<Math.min(maximum,8))health.append(document.createElement('i'));
  health.classList.toggle('gift-health',maximum>3);health.classList.toggle('gift-health-many',maximum>8);integrity.hidden=!game.gifts.includes('membrane');integrity.textContent=game.hp+'/'+maximum;
  for(let i=0;i<health.children.length;i++){const el=health.children[i];el.style.display=i<maximum?'':'none';el.classList.toggle('lost',i>=game.hp);}
 }
 hook('event',e=>{
  if(test&&['giftGate','gift','giftRefused','giftUsed'].includes(e.type))events.push({tick:campaignRun.ticks,stage:game.stage,...e,...(e.offer?{offer:e.offer.slice()}:{})});
  if(e.type==='giftGate'){gate=entities.find(x=>x.kind==='giftGate'&&!x.done)||null;showGate();radio('gift_first','story');}
  if(e.type==='gift'){
   burstAt=game.time;burstD=game.distance;burstX=game.x;burstId=e.id;sound('unlock');receipt(e.id,definitions[e.id].label+' ACCEPTED · +1 CORRUPTION',definitions[e.id].gateText);
   // One word on gifts: the third, when the hood can no longer hide what it carries.
   if(game.gifts.length===3)radio('gift_take3','milestone');
  }
  if(e.type==='giftRefused'){sound('collect');receipt('refuse','REFUSED · +1 KEY','NO GIFT. NO CORRUPTION.');}
  if(e.type==='giftUsed'){sound(e.id==='mouth'?'reflect':'tick');receipt(e.id,e.id==='mouth'?'MOUTH / HIT ABSORBED':'MASK / CHAIN HELD',e.remaining+' CHARGE'+(e.remaining===1?'':'S')+' LEFT THIS SECTOR');}
 });
 function draw(){
  if(!['running','paused'].includes(status))return;
  if(gate&&!gate.done){const z=worldDistance-gate.d;if(z>-160&&z<8)for(const lane of [-1,0,1]){const id=Core.giftForLane(gate,lane)||'refuse',root=models[id];root.at(lane*3.2,0,z);renderer.node(root);renderer.draw(floor,compose(lane*3.2,.09,z,Math.PI/2,0,0,1.3,1.3,1),tints[id],2,null,.6,false);}}
  const age=game.time-burstAt;if(!moving()||age<0||age>.7)return;
  renderer.gl.depthMask(false);const tint=tints[burstId],z=worldDistance-burstD;
  renderer.draw(floor,compose(burstX,game.y+1.45,z,0,0,0,1+age*3,1+age*3,1),tint,2,null,(1-age/.7)*.55,false);
  for(let i=0;i<18;i++){const a=i*Math.PI/9,r=.6+age*(2+i%3);renderer.draw(spark,compose(burstX+Math.cos(a)*r,1.5+Math.sin(a)*r-age*age*3,z+Math.sin(i*2)*age*3,a,age*4,a,1.3,1.3,1.3),tint,2,null,1-age/.7,false);}renderer.gl.depthMask(true);
 }
 hook('reset',reason=>{
  gate=campaignRun?.options.gifts?entities.find(e=>e.kind==='giftGate'&&!e.done)||null:null;receiptUntil=0;burstAt=-100;preview.classList.remove('gift-picked');
  if(reason==='launch'||reason==='title'){spoken.clear();events.length=0;}
  if(reason==='resume'){
   const n=game.gifts?.length||0;if(n||game.refusals)spoken.add('gift_first');if(n>=3)spoken.add('gift_take3');
  }
  if(gate?.announced)showGate();update();
 });
 hook('hud',update);hook('draw',draw);
 if(test)window.__gifts={get events(){return events.slice();},get gate(){return gate?{...gate,offer:gate.offer.slice()}:null;},get spoken(){return [...spoken];}};
 return {update};
})();
