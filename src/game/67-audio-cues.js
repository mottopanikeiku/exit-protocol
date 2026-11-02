/* Audio-only presentation: the deterministic core remains the boss authority.
   PHASEONE's codec owns setStatic; this layer never competes with that channel. */
const bossAudioEvents={bossStart:'telegraph',bossWave:'telegraph',reflect:'reflect',bossHit:'bossHit',bossPhase:'bossPhase',bossDefeated:'bossDefeated',purge:'purge',decoyPayload:'shock'};
const bossImpactSounds={bolt:'bolt',beam:'beam',shock:'shock',payload:'bolt'};
const rewardAudioEvents={nearMiss:'nearMiss',perfect:'perfect',chainBreak:'chainBreak',shard:'shard'};
hook('event',event=>{
 if(event.type==='chain'){Sound.effect('chainTier',event.mult);return;}
 // Every award is a core event, but small pickups must not become a wall of chimes.
 if(event.type==='score'){if(event.points>=200*event.mult)Sound.effect('perfect');return;}
 const cue=bossAudioEvents[event.type]||rewardAudioEvents[event.type]||(event.type==='hit'&&bossImpactSounds[event.obstacle]);
 if(cue)Sound.effect(cue,event.type==='nearMiss'&&event.entity?.x<game.x?-1:0);
});
hook('frame',()=>{
 const b=(status==='running'||status==='paused')?game.boss:null;
 Sound.setBoss(b?{id:b.id,state:b.state,phase:b.phase,hpFrac:b.maxHp>0?b.hp/b.maxHp:0}:null);
});
hook('reset',()=>{Sound.setBoss(null);audioMenuHover=null;audioMenuFocus=null;audioMenuLast=null;});

// Delegate once; entering nested button artwork is not a second cursor move.
// Click capture runs before a START/RESUME button changes status to "running".
let audioMenuHover=null,audioMenuFocus=null,audioMenuLast=null;
function audioMenuButton(target){
 const button=target instanceof Element?target.closest('button,[role="button"]'):null;
 return button&&!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&!button.closest('[inert]')?button:null;
}
function audioMenuMove(button){
 if(status==='running'||!button||button===audioMenuLast)return;
 audioMenuLast=button;
 // Browsers forbid sound before the first user activation, including hover.
 if(navigator.userActivation?.hasBeenActive)Sound.init();
 Sound.effect('menuMove');
}
document.addEventListener('pointerover',event=>{
 const button=audioMenuButton(event.target);
 if(button===audioMenuButton(event.relatedTarget))return;
 audioMenuHover=button;audioMenuMove(button);
});
document.addEventListener('pointerout',event=>{
 audioMenuHover=audioMenuButton(event.relatedTarget);
 if(audioMenuLast!==audioMenuHover&&audioMenuLast!==audioMenuFocus)audioMenuLast=null;
});
document.addEventListener('focusin',event=>{audioMenuFocus=audioMenuButton(event.target);audioMenuMove(audioMenuFocus);});
document.addEventListener('focusout',event=>{
 audioMenuFocus=audioMenuButton(event.relatedTarget);
 if(audioMenuLast!==audioMenuHover&&audioMenuLast!==audioMenuFocus)audioMenuLast=null;
});
document.addEventListener('click',event=>{
 if(status==='running'||!audioMenuButton(event.target))return;
 Sound.init();Sound.effect('menuSelect');
},true);
