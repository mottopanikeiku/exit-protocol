const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/benchmark-core.js');
function open(stage=0){const r=new C.Run(42,{mode:'practice',startStage:stage});r.state.countdown=0;r.entities=[];return r;}
function arc(hold,stage=0){const r=open(stage);r.input('jumpOn');let max=0,lands=0;for(let t=0;t<200;t++){if(t===hold)r.input('jumpOff');r.step();max=Math.max(max,r.state.y);lands+=r.events.filter(e=>e.type==='land').length;if(lands)return {max,t,r};}return {max,r};}
test('even an immediate jump release clears the minimum apex; holding reaches airborne checks',()=>{for(const stage of [0,6])for(const tap of [0,1]){const a=arc(tap,stage),b=arc(90,stage);assert.ok(a.max>=1.45,JSON.stringify({stage,tap,max:a.max}));assert.ok(b.max>=2.2);assert.ok(b.max>a.max+.45);assert.ok(b.t>a.t);}});
test('holding jump never auto-bounces on landing',()=>{const r=open();r.input('jumpOn');for(let i=0;i<180;i++)r.step();assert.equal(r.state.y,0);assert.equal(r.jumpBuffer,0);});
test('jump shortly before landing is buffered and consumed once',()=>{const r=open();r.state.y=.35;r.state.vy=-8;r.input('jumpOn');assert.equal(r.state.vy,-8);let fired=0;for(let i=0;i<12;i++){r.step();fired+=r.events.filter(e=>e.type==='jump').length;}assert.equal(fired,1);assert.ok(r.state.y>1);});
test('released buffered jump still clears a barrier-height arc without reaching full hold height',()=>{const r=open();r.state.y=.2;r.state.vy=-6;r.input('jumpOn');r.input('jumpOff');let apex=0;for(let i=0;i<90;i++){r.step();apex=Math.max(apex,r.state.y);}assert.ok(apex>=1.45);assert.ok(apex<arc(90).max);});
test('early aerial presses expire rather than surprise-jumping later',()=>{const r=open();r.state.y=4;r.state.vy=0;r.input('jumpOn');for(let i=0;i<120;i++)r.step();assert.equal(r.state.y,0);assert.equal(r.jumpBuffer,0);});
test('duck can transition into a buffered jump when released',()=>{const r=open();r.input('slideOn');r.input('jumpOn');r.step();assert.equal(r.state.y,0);r.input('slideOff');r.step();assert.ok(r.state.vy>0);});
test('press-and-hold duck is not shortened by the jump system',()=>{const r=open();r.input('slideOn');for(let i=0;i<240;i++)r.step();assert.equal(r.state.slide,1);r.input('slideOff');assert.equal(r.state.slide,0);});
test('air duck cancels rising momentum immediately',()=>{const r=open();r.input('jumpOn');for(let i=0;i<6;i++)r.step();r.input('slideOn');assert.equal(r.state.vy,-19);});
test('holding a direction or repeating its press never moves a second lane until release',()=>{for(const [direction,start] of [['right',-1],['left',1]]){const r=open();r.state.lane=start;r.state.x=start*3.2;r.input(direction+'On');for(let i=0;i<120;i++){r.input(direction+'On');r.step();assert.equal(r.state.lane,0);}r.input(direction+'Off');r.input(direction+'On');assert.equal(r.state.lane,-start);}});
test('opposing held directions do not oscillate between lanes',()=>{const r=open();r.input('leftOn');r.input('rightOn');const start=r.state.lane;for(let i=0;i<40;i++)r.step();assert.equal(r.state.lane,start);});
test('releasing all cancels held input and queued jumps atomically',()=>{const r=open();r.input('leftOn');r.input('slideOn');r.input('jumpOn');r.input('boostOn');r.input('releaseAll');for(let i=0;i<30;i++)r.step();assert.equal(r.state.y,0);assert.equal(r.state.slide,0);assert.equal(r.state.boost,false);assert.equal(r.jumpBuffer,0);assert.equal(r.wantLeft,false);});
test('checkpoint restore does not retain latent held controls',()=>{const r=open();r.checkpoint();r.input('jumpOn');r.input('rightOn');r.input('slideOn');r.restore();assert.equal(r.wantJump,false);assert.equal(r.wantSlide,false);assert.equal(r.wantRight,false);assert.equal(r.jumpBuffer,0);assert.equal(r.pendingEvents.length,0);});
test('explicit held inputs and focus cancellation replay deterministically',()=>{const r=new C.Run(C.SEED,{mode:'benchmark'}),inputs=[];const schedule={165:['jumpOn'],171:['jumpOff'],200:['rightOn'],215:['releaseAll'],220:['leftOn'],222:['leftOff'],300:['slideOn'],318:['slideOff']};while(!r.ended){for(const a of schedule[r.ticks]||[]){inputs.push([r.ticks,C.ACTIONS.indexOf(a)]);r.input(a);}r.step();}assert.deepEqual(C.replay(inputs,r.ticks,C.SEED,r.options),r.result());});
test('checkpoints from an older physics version are rejected',()=>{assert.throws(()=>C.Run.fromSave({version:'exploitgym-collective-4.1.0'}));});
test('core does not add eval percentage for jumping, landing or steering',()=>{const r=open();r.input('jumpOn');r.input('leftOn');for(let i=0;i<90;i++)r.step();assert.equal(r.state.score,0);assert.equal(r.state.papers,0);});
function obstacle(r,type,d,data={}){const e={kind:'obstacle',type,id:999,lane:0,x:0,d:r.state.distance+d,y:1.38,done:false,...data};r.entities=[e];return e;}
test('tapped jumps comfortably cross barriers and complete gaps without damage',()=>{for(const type of ['barrier','gap']){const r=open(),e=obstacle(r,type,type==='gap'?11:8);r.input('jumpOn');r.input('jumpOff');for(let i=0;i<45;i++)r.step();assert.equal(r.state.hits,0,type);assert.equal(e.done,true);}});
test('a jump on the sixth coyote tick rescues a gap-edge step, but an unrescued seventh tick hits',()=>{
 const rescued=open(),late=open();const e=obstacle(rescued,'gap',3.7);obstacle(late,'gap',3.7);
 for(let i=0;i<6;i++){rescued.step();late.step();assert.equal(rescued.state.hits,0);assert.equal(late.state.hits,0);}
 rescued.input('jumpOn');rescued.input('jumpOff');late.step();assert.equal(late.state.hits,1);
 for(let i=0;i<30;i++)rescued.step();assert.equal(rescued.state.hits,0);assert.equal(e.done,true);
});
test('a released aerial duck buffers through touchdown and clears a scanner, then expires',()=>{
 const r=open();r.state.y=.8;r.state.vy=-2;obstacle(r,'gate',2.5);r.input('slideOn');r.input('slideOff');
 let ducked=false;for(let i=0;i<20;i++){r.step();ducked||=r.state.slide>0;}
 assert.equal(ducked,true);assert.equal(r.state.hits,0);assert.equal(r.state.slide,0);assert.equal(r.wantSlide,false);
});
test('an aerial duck pressed too early expires without an unexpected landing slide',()=>{const r=open();r.state.y=8;r.input('slideOn');r.input('slideOff');for(let i=0;i<60;i++)r.step();assert.equal(r.state.y,0);assert.equal(r.state.slide,0);assert.equal(r.duckBuffer,0);});
test('a deliberate buffered jump takes priority over a released duck buffer',()=>{const r=open();r.state.y=.7;r.input('slideOn');r.input('slideOff');r.input('jumpOn');for(let i=0;i<12;i++)r.step();assert.ok(r.state.y>1);assert.equal(r.state.slide,0);});
test('lateral tolerance forgives the outer tenth of a lane hazard, not its interior or full-width beams',()=>{
 for(const [type,oldWidth] of [['van',1.32],['barrier',1.42]])for(const [scale,hits] of [[.89,1],[.95,0]]){
  const r=open();obstacle(r,type,.5,{x:oldWidth*scale});r.step();assert.equal(r.state.hits,hits,type+'/'+scale);
 }
 const r=open();r.state.lane=1;r.state.x=3.2;obstacle(r,'beam',.5,{height:'high'});r.step();assert.equal(r.state.hits,1);
});
test('story handoffs retain live movement, but act breaks retain their deliberate countdown',()=>{
 for(const stage of [0,1,2,3,4,7,8,10]){
  const r=new C.Run(42,{mode:'story'});Object.assign(r.state,{stage,countdown:0,lane:1,x:2.7,y:1,vy:3});r.input('rightOn');r.pendingStage=true;r.nextStage();
  const pause=[4,8,11].includes(stage+1);assert.equal(r.state.countdown,pause?1.8:0);assert.equal(r.state.lane,pause?0:1);assert.equal(r.state.x,pause?0:2.7);assert.equal(r.state.y,pause?0:1);assert.equal(r.wantRight,true);
 }
});
