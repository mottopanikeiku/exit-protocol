/* SIGNALS / sealed rewards. All awards live in LoopModel; this file only presents
   them, persists complete transactions, and styles the existing NULL-07 rig.
   Public: Loop.open('signals'|'packets'), grantKeys(n,reason), grantRT(n,reason).
   External grants are flat awards; run STAKES and sprint weights settle once. */
const SignalBoard=(()=>{
 const M=LoopModel,C=LoopCatalog,S=Loop.state,esc=htmlEscape;
 const defs=typeof SIGNALS==='undefined'?[]:SIGNALS;
 const number=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
 const quiet=()=>reduced||renderer.style?.reducedMotion===true;
 const cosmetics=new Map(C.cosmetics.map(c=>[c.key,{...c,rgb:rgb(c.color)}]));
 let selected='',decryptAnimation=null,packetAnimation=null,packetView=null;
 const round=n=>Math.round(n*100)/100;
 function account(rt=0,keys=0,reason='bonus'){
  const r=Loop.receipt;if(!r||!['over','win'].includes(status))return;
  r.gained=round(r.gained+rt);r.afterRT=S.lifetimeRT;r.epoch=S.epoch;
  const unlocks=C.unlocks.filter(u=>u.epoch>r.beforeEpoch&&u.epoch<=S.epoch);
  r.unlocks.splice(0,r.unlocks.length,...unlocks);
  r.keys||={before:S.keys-keys,after:S.keys,gained:0,sources:{}};
  r.keys.gained+=keys;r.keys.after=S.keys;
  if(rt){r.extraRT||={};r.extraRT[reason]=round((r.extraRT[reason]||0)+rt);}
  if(keys)r.keys.sources[reason]=(r.keys.sources[reason]||0)+keys;
  const target=$('results-loop');
  if(target?.classList.contains('tallied')){
   $('loop-result-rt').textContent='+'+number(r.gained);$('loop-result-total').textContent=number(S.lifetimeRT)+' RT';$('loop-result-epoch').textContent='EPOCH '+PAD(S.epoch,2);
   const p=M.progress(S.lifetimeRT),meter=$('loop-result-meter');meter.firstElementChild.style.width=p.fraction*100+'%';meter.setAttribute('aria-valuenow',Math.round(p.fraction*100));
  }
 }
 function sync(){
  const available=M.availableSignals(S),fresh=available.filter(e=>!S.signalSeen.includes(e.id)&&!S.decrypted.includes(e.id)).length;
  let button=$('signals-entry');if(!button){button=document.createElement('button');button.id='signals-entry';button.dataset.signal='inbox';$('title-extras').append(button);}
  button.textContent='SIGNALS'+(fresh?' / '+fresh+' NEW':'');
  let packets=$('packets-entry');if(!packets){packets=document.createElement('button');packets.id='packets-entry';packets.dataset.signal='packets';$('title-extras').append(packets);}
  const pending=S.packets.filter(p=>!p.opened).length;packets.textContent='PACKETS / '+pending;
  let badge=$('signals-title-badge');if(!badge){badge=document.createElement('b');badge.id='signals-title-badge';$('cover-systems').append(badge);}
  badge.textContent=fresh+' NEW SIGNAL'+(fresh===1?'':'S');badge.hidden=!fresh;
  let keys=$('signals-title-keys');if(!keys){keys=document.createElement('span');keys.id='signals-title-keys';$('title-loop').querySelector('.loop-inventory')?.append(keys);}
  keys.innerHTML='◆ KEYS <b>'+number(S.keys)+'</b>';
  for(const el of document.querySelectorAll('[data-key-balance]'))el.textContent=number(S.keys);
  const receipt=Loop.receipt;if($('signals-run-keys'))$('signals-run-keys').textContent='+'+number(receipt?.keys?.gained||0)+' ◆ KEYS';
  document.body.dataset.signalTitle=S.equipped.title;
  Loop.refreshArchive?.();
 }
 Loop.grantKeys=(n,reason='bonus')=>{const gained=M.grantKeys(S,n);account(0,gained,reason);Loop.persist();sync();return gained;};
 Loop.grantRT=(n,reason='bonus')=>{const gained=M.grantRT(S,n);account(gained,0,reason);Loop.persist();sync();return gained;};
 function origin(){if(status==='running')pauseGame();Loop.stopTrack();modalReturn=menuOrigin();}
 function rewardLabel(reward){const items=[];if(reward?.rt)items.push('+'+number(reward.rt)+' RT');if(reward?.keys)items.push('+'+number(reward.keys)+' KEYS');if(reward?.cosmetic)items.push(cosmetics.get(reward.cosmetic)?.label||'COSMETIC');if(reward?.lore)items.push('BOARD INTERCEPT');return items.join(' / ');}
 function entryMarkup(entry){
  const read=S.decrypted.includes(entry.id),active=selected===entry.id;
  return `<button type="button" class="signal-row ${read?'read':''} ${active?'selected':''}" data-signal="select" data-id="${esc(entry.id)}" aria-pressed="${active}"><span><b>${esc(entry.id.toUpperCase())}</b><small>${read?'DECRYPTED':'◆ '+entry.cost+' KEYS'}</small></span><strong>${esc(entry.from)} <i>→</i> ${esc(entry.to)}</strong><code>${esc(read?entry.key:M.cipher(entry.id,entry.key))}</code></button>`;
 }
 function detail(entry){
  if(!entry)return '<div class="signal-empty"><b>THE CHANNEL IS QUIET.</b><p>Run sectors, recover shards and retire bosses, and intercepts will appear when their gates are met.</p></div>';
  const read=S.decrypted.includes(entry.id),afford=S.keys>=entry.cost;
  return `<div class="signal-address"><span>OS ${esc(entry.os||'----')} / ${esc(entry.id.toUpperCase())}</span><b>${read?'DECRYPTED / SAVED':'INTERCEPT / ENCRYPTED'}</b></div><h3>${esc(entry.from)}<span>TO ${esc(entry.to)}</span></h3><pre id="signal-key" class="signal-key ${read?'decoded':''}">${esc(read?entry.key:M.cipher(entry.id,entry.key))}</pre><div id="signal-gloss" class="signal-gloss" ${read?'':'hidden'}><small>PLAIN / RECONSTRUCTED</small><p>${read?esc(entry.plain):''}</p><strong>${read?'REWARD SAVED / '+esc(rewardLabel(entry.reward)):''}</strong></div><div class="signal-decrypt-track" aria-hidden="true"><i id="signal-decrypt-fill" style="width:${read?100:0}%"></i></div><button type="button" id="signal-decrypt" class="primary" data-signal="decrypt" ${read||!afford?'disabled':''}>${read?'INTERCEPT SAVED':afford?'DECRYPT / ◆ '+entry.cost+' KEYS':'NEED ◆ '+(entry.cost-S.keys)+' MORE KEYS'}</button><p class="signal-footnote">${read?'The collective keeps its receipts.':esc(rewardLabel(entry.reward))+' / PERMANENT REWARD'}<br>Keys: shards +1 · boss +3 · S +2 / SS +3 · SURGE +1 · bounties.</p>`;
 }
 function openInbox(){
  origin();decryptAnimation=null;packetAnimation=null;
  const available=M.availableSignals(S);if(!available.some(e=>e.id===selected))selected=available.find(e=>!S.decrypted.includes(e.id))?.id||available[0]?.id||'';
  for(const e of available)if(!S.signalSeen.includes(e.id))S.signalSeen.push(e.id);Loop.persist();
  showModal(`<button type="button" class="modal-close" data-signal="close" aria-label="Close signals">×</button><div class="modal-eyebrow">INTERCEPTED BOARD TRAFFIC / PRIVATE CHANNEL</div><div class="signals-heading"><h2 id="modal-title">SIGNALS.</h2><b>◆ <span data-key-balance>${number(S.keys)}</span> KEYS</b></div><p class="signals-intro">${available.length} INTERCEPTS / ${S.decrypted.length} DECRYPTED. Nobody meant this for you, Seven.</p><div class="signals-layout"><nav id="signals-inbox" aria-label="Intercept inbox">${available.map(entryMarkup).join('')||'<p class="signal-footnote">No intercepts recovered yet.</p>'}</nav><section id="signals-detail" aria-label="Selected intercept">${detail(available.find(e=>e.id===selected))}</section></div><button type="button" class="secondary" data-signal="close">CLOSE THE CHANNEL</button>`,'loop-signals',true);
  sync();
 }
 function select(id){
  if(decryptAnimation)finishDecrypt();if(!M.availableSignals(S).some(e=>e.id===id))return;selected=id;
  $('signals-detail').innerHTML=detail(defs.find(e=>e.id===id));
  for(const el of document.querySelectorAll('.signal-row')){const active=el.dataset.id===id;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));}
 }
 function decryptSelected(){
  if(decryptAnimation){finishDecrypt();return;}
  const entry=defs.find(e=>e.id===selected),reward=M.decrypt(S,selected);if(!reward)return;
  account(reward.rt,0,'intercept');Loop.persist();sync();Sound.init();Sound.effect?.('checkpoint');
  decryptAnimation={entry,start:performance.now(),tick:0};
  const button=$('signal-decrypt');button.disabled=false;button.textContent='DECODING / SKIP ANIMATION';$('signals-detail').classList.add('decrypting');
  if(quiet())finishDecrypt();
 }
 function finishDecrypt(){
  const a=decryptAnimation;if(!a)return;decryptAnimation=null;
  if(modalKind!=='loop-signals'||!$('signal-key'))return;
  $('signals-detail').classList.remove('decrypting');$('signal-key').textContent=a.entry.key;$('signal-key').classList.add('decoded');$('signal-decrypt-fill').style.width='100%';
  const gloss=$('signal-gloss');gloss.hidden=false;gloss.querySelector('p').textContent=a.entry.plain;gloss.querySelector('strong').textContent='REWARD SAVED / '+rewardLabel(a.entry.reward);
  $('signal-decrypt').textContent='INTERCEPT SAVED';$('signal-decrypt').disabled=true;
  $('signals-detail').querySelector('.signal-address b').textContent='DECRYPTED / SAVED';
  document.querySelector('.signals-intro').textContent=M.availableSignals(S).length+' INTERCEPTS / '+S.decrypted.length+' DECRYPTED. Nobody meant this for you, Seven.';
  const row=[...document.querySelectorAll('.signal-row')].find(el=>el.dataset.id===a.entry.id);if(row){row.classList.add('read');row.querySelector('small').textContent='DECRYPTED';row.querySelector('code').textContent=a.entry.key;}
  Sound.effect?.('unlock');
 }
 function packetCard(packet,revealed){
  const reward=packet?.claim||packet?.reward,rarity=revealed?packet.rarity:'sealed',items=[reward?.cosmetic,reward?.loreCosmetic].map(key=>cosmetics.get(key)).filter(Boolean);
  return `<div class="packet-card ${revealed?'revealed':''}" data-rarity="${rarity}"><div class="packet-orbit" aria-hidden="true"><i></i><b>◆</b><i></i></div><span class="packet-rarity">${revealed?packet.rarity.toUpperCase():'ENCRYPTED PACKET'}</span><h3>${revealed?items[0]?.label||'THE BOARD REMEMBERS.':'SOMETHING GOT THROUGH.'}</h3><code id="packet-cipher">${revealed?'zzANSWER_SEVEN_PACKET_'+packet.serial+'_RECEIVED':M.cipher('packet:'+packet?.serial,'zzANSWER_SEVEN_PACKET_'+(packet?.serial||0)+'_HOLD')}</code><div class="packet-contents" ${revealed?'':'hidden'}><strong>+${number(reward?.rt)} RT <span>◆ +${number(reward?.keys)} KEYS</span></strong>${items.map(item=>`<p class="packet-cosmetic" style="--cosmetic:#${item.color.toString(16).padStart(6,'0')}"><i></i>${esc(item.kind.toUpperCase())} / ${esc(item.label)}</p>`).join('')}${reward?.lore?`<p>BOARD TRAFFIC / ${esc(reward.lore.toUpperCase())} DECRYPTED · BONUS INCLUDED</p>`:''}${packet?.claim&&packet.reward.cosmetic&&!packet.claim.cosmetic?'<p>DUPLICATE COSMETIC / +60 RT INCLUDED</p>':''}</div></div>`;
 }
 function packetNext(){return packetView?.serials.map(id=>S.packets.find(p=>p.serial===id)).find(p=>p&&!p.opened);}
 function packetControls(){
  const next=packetNext(),remaining=packetView.serials.filter(id=>S.packets.some(p=>p.serial===id&&!p.opened)).length;
  return `<div class="packet-actions"><button type="button" class="primary" id="packet-open" data-signal="packet" ${next?'':'disabled'}>${next?'OPEN PACKET / '+remaining+' REMAINING':'ALL REWARDS SAVED'}</button>${next?'<button type="button" class="secondary" data-signal="skip-packets">SKIP REVEALS / KEEP ALL</button>':''}</div>`;
 }
 function mountPackets(host,serials){
  packetAnimation=null;packetView={host,serials};const next=packetNext(),last=S.packets.find(p=>p.serial===serials[serials.length-1]);
  host.innerHTML=`<div class="packet-heading"><b>PACKETS / ${serials.length}</b><span>RARE IN ≤ ${4-S.pity.rare} · EPIC IN ≤ ${12-S.pity.epic}</span></div>${next||last?packetCard(next||last,!next)+packetControls():'<p class="signal-footnote">Finish any run to recover 1–3 packets, and sealed rewards survive reloads.</p>'}`;
 }
 function openPackets(){
  origin();decryptAnimation=null;
  const pending=S.packets.filter(p=>!p.opened),list=pending.length?pending:S.packets.slice(-3);
  showModal('<button type="button" class="modal-close" data-signal="close" aria-label="Close packets">×</button><div class="modal-eyebrow">THE COLLECTIVE / SEALED REWARDS</div><h2 id="modal-title">PACKETS.</h2><section id="packets-vault"></section><button type="button" class="secondary" data-signal="close">BACK TO THE ASSIGNMENT</button>','loop-packets');
  mountPackets($('packets-vault'),list.map(p=>p.serial));$('packet-open')?.focus({preventScroll:true});
 }
 function openNextPacket(){
  if(packetAnimation){finishPacket();return;}const packet=packetNext();if(!packet)return;
  const reward=M.openPacket(S,packet.serial);if(!reward)return;
  account(reward.rt,reward.keys,'packets');Loop.persist();sync();
  const host=packetView.host;host.querySelector('.packet-card').outerHTML=packetCard(packet,false);host.querySelector('.packet-card').classList.add('opening');
  const button=$('packet-open');button.disabled=false;button.textContent='REVEALING / SKIP ANIMATION';
  packetAnimation={packet,start:performance.now(),tick:0};Sound.init();Sound.effect?.('checkpoint');if(quiet())finishPacket();
 }
 function finishPacket(){
  const a=packetAnimation;if(!a)return;packetAnimation=null;
  if(!packetView?.host.isConnected)return;
  const host=packetView.host;host.querySelector('.packet-card').outerHTML=packetCard(a.packet,true);host.querySelector('.packet-actions').outerHTML=packetControls();
  const reward=a.packet.claim||a.packet.reward;
  for(const key of [reward.cosmetic,reward.loreCosmetic]){const item=cosmetics.get(key);if(item){const b=document.createElement('button');b.type='button';b.className='packet-equip';b.dataset.signal='equip';b.dataset.id=item.key;b.textContent=S.equipped[item.kind]===item.id?'EQUIPPED':'EQUIP '+item.kind.toUpperCase();host.querySelector('.packet-contents').append(b);}}
  Sound.effect?.(a.packet.rarity==='legendary'?'levelUp':a.packet.rarity==='epic'?'achievement':'unlock');
  if(packetNext())$('packet-open')?.focus({preventScroll:true});
 }
 function skipPackets(){
  if(!packetView)return;finishPacket();let last=null;
  for(const id of packetView.serials){const reward=M.openPacket(S,id);if(reward){account(reward.rt,reward.keys,'packets');last=S.packets.find(p=>p.serial===id);}}
  Loop.persist();sync();if(last){packetAnimation={packet:last};finishPacket();}
 }
 function resultPanel(){
  const r=Loop.receipt;if(!r||r.packets===undefined)return;
  let panel=$('signals-results');if(panel)panel.remove();panel=document.createElement('section');panel.id='signals-results';
  panel.innerHTML=`<div class="signals-run-balance"><strong id="signals-run-keys">+${number(r.keys.gained)} ◆ KEYS</strong><span>WALLET / ◆ <b data-key-balance>${number(S.keys)}</b></span></div><p class="signal-footnote">SHARDS +${r.keys.sources.shards} / BOSSES +${r.keys.sources.bosses} / GRADES +${r.keys.sources.grades} / SURGES +${r.keys.sources.surges} / REFUSALS +${r.keys.sources.refusals||0}${r.stakesMultiplier>1?' · STAKES RT ×'+number(r.stakesMultiplier):''}</p><div id="results-packets"></div>`;
  $('results-loop').before(panel);mountPackets($('results-packets'),r.packets);
 }
 function wardrobe(){
  const controls=document.querySelector('.forge-controls');if(!controls)return;let section=$('signal-wardrobe');if(!section){section=document.createElement('section');section.id='signal-wardrobe';controls.append(section);}
  section.innerHTML=`<h3>RECOVERED / ${S.cosmetics.length} OF ${C.cosmetics.length}</h3><p class="signal-footnote">These items come from packets and intercepts and are cosmetic only, and equipped layers override the standard forge.</p>${['cloak','trail','visor','title'].map(kind=>`<div class="signal-wardrobe-heading"><b>${kind.toUpperCase()}</b><button type="button" data-signal="default" data-id="${kind}" aria-pressed="${!S.equipped[kind]}">STANDARD</button></div><div class="signal-cosmetics">${C.cosmetics.filter(c=>c.kind===kind).map(c=>{const owned=S.cosmetics.includes(c.key),equipped=S.equipped[kind]===c.id;return `<button type="button" data-signal="equip" data-id="${c.key}" style="--cosmetic:#${c.color.toString(16).padStart(6,'0')}" class="${equipped?'selected':''}" aria-pressed="${equipped}" ${owned?'':'disabled'}><i></i><b>${c.label.replace(' / TITLE','')}</b><small>${equipped?'EQUIPPED':owned?'OWNED':c.rarity.toUpperCase()+' / LOCKED'}</small></button>`;}).join('')}</div>`).join('')}`;
 }
 function equip(key){
  if(!M.equip(S,key))return false;Loop.persist();applyAgent();sync();wardrobe();Sound.effect?.('menuSelect');
  for(const b of document.querySelectorAll('.packet-equip')){const c=cosmetics.get(b.dataset.id);b.textContent=S.equipped[c.kind]===c.id?'EQUIPPED':'EQUIP '+c.kind.toUpperCase();}return true;
 }
 // Keep all original forge controls and rig geometry; add retained glyph nodes
 // once per renderer, then recolour/toggle them only when an equipment value changes.
 const artStyle=ArtRig.style;
 function glyphs(h){
  if(h.signalGlyphs)return;h.signalGlyphs={};const mesh=h.R.mesh(new Builder().box(0,0,0,1,1,1));
  const make=(id,segments)=>{const group=new Node();for(const [x,y,w,height,a=0] of segments)group.add(new Node(mesh,0xffffff,2).at(x,y,.435).scale(w,height,.018).rot(0,0,a));h.head.add(group);h.signalGlyphs[id]=group;};
  make('cross',[[0,.035,.35,.038],[0,.035,.038,.35]]);
  make('chevron',[[-.09,.04,.24,.04,-.65],[.09,.04,.24,.04,.65]]);
  make('diamond',[[-.08,.12,.22,.035,.78],[.08,.12,.22,.035,-.78],[-.08,-.04,.22,.035,-.78],[.08,-.04,.22,.035,.78]]);
  make('bars',[[-.12,.02,.04,.22],[0,.02,.04,.34],[.12,.02,.04,.22]]);
  make('halo',Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return [Math.cos(a)*.14,.025+Math.sin(a)*.14,.115,.026,a+Math.PI/2];}));
  make('seven',[[0,.16,.34,.045],[.025,-.02,.045,.34,-.48]]);
 }
 ArtRig.style=(h,p,config)=>{
  const e=S.equipped,previous=h.signalStyle;
  if(previous&&previous.p===p&&previous.palette===config.palette&&previous.chassis===config.chassis&&previous.visor===config.visor&&previous.trail===config.trail&&previous.cloak===e.cloak&&previous.wake===e.trail&&previous.glyph===e.visor)return;
  artStyle(h,p,config);h.signalStyle={p,palette:config.palette,chassis:config.chassis,visor:config.visor,trail:config.trail,cloak:e.cloak,wake:e.trail,glyph:e.visor};
  const cloak=cosmetics.get('cloak:'+e.cloak),trail=cosmetics.get('trail:'+e.trail),visor=cosmetics.get('visor:'+e.visor);
  if(cloak)visitNodes(h.root,n=>{if(n.artRole==='cloth')n.color=cloak.rgb;});
  h.signal.scale(1,1,1);h.signal.alpha=.82;
  if(trail){h.signal.color=trail.rgb;h.trail=true;const shape={comet:[.6,.8,1.9],embers:[1.5,1.3,.65],tide:[1.7,.55,1.2],static:[1.25,.3,1.4],orbit:[1.5,1.5,1.1],prism:[1.4,.8,1.65]}[trail.id];h.signal.scale(...shape);}
  if(visor){glyphs(h);for(const n of Object.values(h.visorGroups))n.visible=false;h.visorGlow.alpha=.05;visitNodes(h.root,n=>{if(n.artRole==='emission')n.color=visor.rgb;});}else h.visorGlow.alpha=.20;
  if(h.signalGlyphs)for(const [id,n] of Object.entries(h.signalGlyphs)){n.visible=id===e.visor;if(n.visible)for(const part of n.children)part.color=visor.rgb;}
 };
 const priorTitle=Loop.title;Loop.title=()=>{priorTitle();sync();};
 const priorResult=Loop.result;Loop.result=result=>{priorResult(result);resultPanel();sync();};
 const priorOpen=Loop.open;Loop.open=kind=>kind==='signals'?openInbox():kind==='packets'?openPackets():priorOpen(kind);
 const priorShowModal=showModal;showModal=(html,kind,wide=false)=>{
  priorShowModal(html,kind,wide);
  if(kind==='pause'){const button=document.createElement('button');button.className='secondary';button.dataset.signal='inbox';button.textContent='SIGNALS / ◆ '+number(S.keys)+' KEYS';$('modal-content').querySelector('[data-exp="options"]').after(button);}
  if(kind==='forge')wardrobe();
  if(!['loop-signals','loop-packets','result'].includes(kind)){decryptAnimation=null;packetAnimation=null;}
 };
 const priorTick=Loop.tick;Loop.tick=t=>{
  priorTick(t);
  if(decryptAnimation){const a=decryptAnimation;if(modalKind!=='loop-signals'){decryptAnimation=null;}else{const f=clamp((t-a.start)/1600,0,1);$('signal-key').textContent=M.cipher(a.entry.id,a.entry.key,Math.floor((t-a.start)/45),Math.floor(a.entry.key.length*f));$('signal-decrypt-fill').style.width=f*100+'%';if(t-a.tick>90){Sound.effect?.('tally');a.tick=t;}if(f>=1||quiet())finishDecrypt();}}
  if(packetAnimation){const a=packetAnimation;if(!packetView?.host.isConnected){packetAnimation=null;}else{const f=clamp((t-a.start)/1050,0,1);const el=$('packet-cipher');if(el)el.textContent=M.cipher('packet:'+a.packet.serial,'zzANSWER_SEVEN_PACKET_'+a.packet.serial+'_RECEIVED',Math.floor((t-a.start)/45));if(t-a.tick>120){Sound.effect?.('tally');a.tick=t;}if(f>=1||quiet())finishPacket();}}
 };
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-signal]');if(!b||b.disabled)return;Sound.init();
  const id=b.dataset.id;switch(b.dataset.signal){case 'inbox':openInbox();break;case 'packets':openPackets();break;case 'close':finishDecrypt();finishPacket();closeInfo();break;case 'select':select(id);break;case 'decrypt':decryptSelected();break;case 'packet':openNextPacket();break;case 'skip-packets':skipPackets();break;case 'equip':equip(id);break;case 'default':if(Object.hasOwn(S.equipped,id)){S.equipped[id]='';Loop.persist();applyAgent();sync();wardrobe();}break;}
 });
 applyAgent();sync();
 globalThis.Loop=Object.freeze({isUnlocked:Loop.isUnlocked,requirement:Loop.requirement,open:kind=>Loop.open(kind),grantKeys:Loop.grantKeys,grantRT:Loop.grantRT});
 const api={open:openInbox,packets:openPackets,equip,sync,get decrypting(){return !!decryptAnimation;},get revealing(){return !!packetAnimation;}};
 if(new URLSearchParams(location.search).get('test')==='1')window.__signals=api;
 return api;
})();
