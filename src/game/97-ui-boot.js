/* Four-second original console ident. No run state or simulation is advanced. */
const systemBoot=$('system-boot');
let bootFrame=0;
function endSystemBoot(){
 if(!systemBootActive)return;
 systemBootActive=false;
 cancelAnimationFrame(bootFrame);
 systemBoot.classList.add('hidden');
 window.removeEventListener('keydown',skipSystemBoot,true);
 window.removeEventListener('pointerdown',skipSystemBoot,true);
 $('start').focus({preventScroll:true});
}
function skipSystemBoot(e){
 if(!systemBootActive)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 endSystemBoot();
}
let bootSeen=false;
try{bootSeen=sessionStorage.getItem('sandbox-system-boot-v8')==='1';sessionStorage.setItem('sandbox-system-boot-v8','1');}catch{}
if(bootSeen){
 systemBoot.classList.add('hidden');
}else{
 systemBootActive=true;
 $('boot-skip').onclick=endSystemBoot;
 $('boot-skip').focus({preventScroll:true});
 window.addEventListener('keydown',skipSystemBoot,true);
 window.addEventListener('pointerdown',skipSystemBoot,true);
 const started=performance.now();
 const advanceBoot=time=>{
  if(!systemBootActive)return;
  const elapsed=time-started;
  if(elapsed>=4000){endSystemBoot();return;}
  systemBoot.dataset.step=elapsed<250?'black':elapsed<1500?'mark':elapsed<2600?'name':'legal';
  bootFrame=requestAnimationFrame(advanceBoot);
 };
 bootFrame=requestAnimationFrame(advanceBoot);
}
