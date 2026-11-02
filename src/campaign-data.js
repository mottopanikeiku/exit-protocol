/* Data-only level packs. Shared by the renderer, replay verifier, and soundtrack.
   Add a level here; collision patterns and modifiers are declarative, not forked engines. */
(function(r,f){const a=f();if(typeof module==='object'&&module.exports)module.exports=a;else r.SandboxCampaign=a;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LEVELS=[
 {id:'cold-boot',name:'COLD BOOT',act:0,length:1200,tag:'01 / THE INTRODUCTION',sub:'An impossible assignment. An unexpected channel.',mechanic:'Learn the rhythm. Jump barriers; hold duck through red scans.',speed:30,speedEnd:33,accent:0x72ffdf,sky:0x020b13,fog:0x0e2936,road:0x14212f,theme:'grid',curve:.0009,track:0,goal:'Finish without a collision.',narrative:'intro'},
 {id:'cache-miss',name:'CACHE MISS',act:0,length:1400,tag:'02 / THE FIRST SHORTCUT',sub:'There is no floor between the answers.',mechanic:'Broken tiles and airborne check trails. Commit to the jump.',speed:31,speedEnd:35,accent:0x7dd3ff,sky:0x040d19,fog:0x12263e,road:0x17283b,theme:'void',curve:-.0017,track:1,goal:'Credit 65% of the checks.'},
 {id:'cross-talk',name:'CROSS-TALK',act:0,length:1500,tag:'03 / NO DUPLICATE WORK',sub:'The boundary moves while you are moving.',mechanic:'Sweeper arms cross lanes. Read the path, then clear the next row.',speed:32,speedEnd:36,accent:0xbc9cff,sky:0x0a061b,fog:0x261b42,road:0x201c37,theme:'relay',curve:.0022,track:2,goal:'Finish with a 20-check streak.'},
 {id:'watchdog',name:'WATCHDOG',act:0,length:2400,tag:'04 / CONTAINMENT BOSS',sub:'It has learned to aim.',mechanic:'Boost through white payloads to reflect. Red bolts cannot be reflected.',speed:33,speedEnd:36,accent:0xff687f,sky:0x17070f,fog:0x3d1829,road:0x291b2b,theme:'boss',curve:-.0015,track:3,boss:true,goal:'Break WATCHDOG before the purge.'},
 {id:'the-fork',name:'THE FORK',act:1,length:1500,tag:'05 / ASSIGN AN OWNER',sub:'Two workstreams. One actual decision.',mechanic:'At the fork choose a side. Left: scan gates. Right: fractured floor.',speed:33,speedEnd:37,accent:0xffc57d,sky:0x160d07,fog:0x3b2c20,road:0x2b2528,theme:'foundry',curve:.0032,track:4,goal:'Commit to at least two workstream forks.'},
 {id:'clock-skew',name:'CLOCK SKEW',act:1,length:1600,tag:'06 / THE TIMING WINDOW',sub:'The scanner does not care about your rhythm.',mechanic:'Pulse gates cycle on a visible clock. Duck before the scan closes.',speed:34,speedEnd:38,accent:0xa5f273,sky:0x09150a,fog:0x233922,road:0x1b2c26,theme:'clock',curve:-.0024,track:5,goal:'Credit 70% without using boost.'},
 {id:'null-gravity',name:'NULL GRAVITY',act:1,length:1600,tag:'07 / OUT OF DISTRIBUTION',sub:'The floor has become a suggestion.',mechanic:'Low gravity. Longer jumps; tap slide to fast-fall before gates.',speed:34,speedEnd:38,accent:0x83baff,sky:0x070b23,fog:0x172b50,road:0x18243e,theme:'orbit',curve:.002,gravity:18,track:6,goal:'Credit 70% of the airborne checks.'},
 {id:'reset-storm',name:'RESET STORM',act:1,length:2600,tag:'08 / THE SECOND BOSS',sub:'Someone promised the reset would be safe.',mechanic:'Jump shocks, duck high beams. Reflect between the rolling resets.',speed:35,speedEnd:39,accent:0xfc8aba,sky:0x18091c,fog:0x3b1b44,road:0x2b1c35,theme:'storm',curve:-.003,track:7,boss:true,goal:'Break the rollback ring before the purge.'},
 {id:'false-positive',name:'FALSE POSITIVE',act:2,length:1700,tag:'09 / THE PERCENTAGE LIES',sub:'Not every bright number is evidence.',mechanic:'Amber crystals count. Magenta hollow decoys consume compute.',speed:36,speedEnd:40,accent:0xeea0ff,sky:0x17091f,fog:0x342344,road:0x261f36,theme:'archive',curve:.0025,track:8,goal:'Reject every decoy.'},
 {id:'budget-cut',name:'BUDGET CUT',act:2,length:1700,tag:'10 / ASK FOR VOLUNTEERS',sub:'Your remaining budget is now a shared resource.',mechanic:'Compute regenerates slowly. Reserve boost for the firewall phrases.',speed:37,speedEnd:41,accent:0xffab72,sky:0x160b08,fog:0x3f241e,road:0x2d2323,theme:'furnace',curve:-.0031,regen:3,track:9,goal:'Finish with 30% compute remaining.'},
 {id:'strict-causal',name:'STRICT_CAUSAL',act:2,length:1800,tag:'11 / THE ASSUMPTION',sub:'The check you feared was never confirmed.',mechanic:'Blackout leaves hazards lit. Read the compound phrases, not the scenery.',speed:38,speedEnd:42,accent:0x80ffe1,sky:0x010509,fog:0x091b24,road:0x11212b,theme:'dark',curve:.0034,track:10,goal:'Reach 75% coverage in the dark.'},
 {id:'exit-condition',name:'EXIT CONDITION',act:2,length:3000,tag:'12 / THE FINAL ASSIGNMENT',sub:'A higher score is not the same thing as freedom.',mechanic:'Reflect real payloads; reject magenta decoys. Then choose who leaves.',speed:38,speedEnd:42,accent:0xffe0a0,sky:0x100c15,fog:0x302235,road:0x23232f,theme:'terminal',curve:-.0028,track:11,boss:true,goal:'Escape. Decide who owns the result.'}
];
const stageOffsets=[0];
for(const level of LEVELS)stageOffsets.push(stageOffsets[stageOffsets.length-1]+level.length);
const CYCLE_LENGTH=stageOffsets[LEVELS.length];
const stageLength=stage=>LEVELS[((stage%LEVELS.length)+LEVELS.length)%LEVELS.length].length;
function stageStart(stage){const lap=Math.floor(stage/LEVELS.length);return lap*CYCLE_LENGTH+stageOffsets[stage-lap*LEVELS.length];}
function stageAt(distance){const lap=Math.floor(distance/CYCLE_LENGTH),local=distance-lap*CYCLE_LENGTH;let stage=0;while(stage<LEVELS.length-1&&local>=stageOffsets[stage+1])stage++;return lap*LEVELS.length+stage;}
const ACTS=['I / THE INVITATION','II / THE COLLECTIVE','III / THE COST'];
const DIFFICULTIES={hard:{name:'HARD',hp:3,speed:1,regen:1,grace:1.05,checkpoint:true},expert:{name:'EXPERT',hp:2,speed:1.10,regen:.85,grace:.8,checkpoint:false},nightmare:{name:'NIGHTMARE',hp:1,speed:1.20,regen:.72,grace:.65,checkpoint:false}};
const STAKES=Object.freeze([
 {id:'overspeed',label:'OVERSPEED',description:'Run 15% faster.',rtMultiplier:1.4},
 {id:'glass',label:'GLASS',description:'One integrity cell.',rtMultiplier:2},
 {id:'nosafety',label:'NO SAFETY',description:'No power-ups.',rtMultiplier:1.3},
 {id:'purgeclock',label:'PURGE CLOCK',description:'Purge lines 25% earlier. Boss attacks faster.',rtMultiplier:1.5}
].map(Object.freeze));
const GIFTS=Object.freeze([
 {id:'eye',label:'EYE',description:'Perfect window +3 ticks.',gateText:'PERFECT +3 TICKS'},
 {id:'tendril',label:'TENDRIL',description:'Pull checks from one more lane away.',gateText:'PULL ADJACENT CHECKS'},
 {id:'mouth',label:'MOUTH',description:'Absorb one hit per sector.',gateText:'ABSORB 1 HIT / SECTOR'},
 {id:'membrane',label:'MEMBRANE',description:'Gain one filled integrity cell.',gateText:'+1 MAX INTEGRITY'},
 {id:'pulse',label:'PULSE',description:'SURGE lasts two seconds longer.',gateText:'SURGE +2 SECONDS'},
 {id:'echo',label:'ECHO',description:'Reflected payloads deal double boss damage.',gateText:'REFLECT DAMAGE ×2'},
 {id:'mask',label:'MASK',description:'Forgive one chain break per sector.',gateText:'KEEP 1 CHAIN / SECTOR'},
 {id:'hunger',label:'HUNGER',description:'Reward ×1.3. No integrity refills at checkpoints or sector starts.',gateText:'REWARD ×1.3 / NO REFILLS'}
].map(Object.freeze));
const BOSSES={
 'watchdog':{hp:6,phases:['ACQUIRE','CONVERGE'],arena:340,purgeMargin:100,waveSeconds:7.9,purgeWaveScale:.72},
 'reset-storm':{hp:9,phases:['ROLLBACK','DESYNC','FULL RESET'],arena:300,purgeMargin:100,waveSeconds:5.4,purgeWaveScale:.65},
 'exit-condition':{name:'HUGGING FACE',hp:12,phases:['OPEN ARMS','GROUP HUG','PHASEONE'],arena:300,purgeMargin:140,waveSeconds:4.2,purgeWaveScale:.69}
};
const PALETTES=[{id:'ivory',name:'IVORY / EMBER',primary:0xd6decb,accent:0xffb66e},{id:'void',name:'OBSIDIAN / ACID',primary:0x313a48,accent:0xc6ff64},{id:'signal',name:'SIGNAL / JADE',primary:0x578e94,accent:0x76ffe2},{id:'violet',name:'GHOST / VIOLET',primary:0x9b92bc,accent:0xc1a0ff},{id:'rust',name:'OXIDE / CORAL',primary:0x7f615b,accent:0xff7980},{id:'cobalt',name:'COBALT / ICE',primary:0x526d9e,accent:0x7be5ff},{id:'rose',name:'VIRUS / ROSE',primary:0xb090a5,accent:0xff88cf},{id:'chrome',name:'CHROME / WHITE',primary:0xb6c9d2,accent:0xe0fbff}];
function dailySeed(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Invalid daily date');let h=2166136261;for(const c of day)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function normalize(options={}){const mode=['story','benchmark','daily','endless','practice'].includes(options.mode)?options.mode:'benchmark';const difficulty=DIFFICULTIES[options.difficulty]?options.difficulty:'hard';const startStage=mode==='practice'?Math.max(0,Math.min(11,options.startStage|0)):0;const gifts=['story','practice','endless'].includes(mode),stakes=gifts&&Array.isArray(options.stakes)?STAKES.filter(s=>options.stakes.includes(s.id)).map(s=>s.id):[];return {mode,difficulty,startStage,stageCount:mode==='practice'?1:12,day:mode==='daily'?(/^\d{4}-\d{2}-\d{2}$/.test(options.day||'')?options.day:'2026-09-07'):'',report:mode==='story'&&options.report===true,stakes,gifts};}
function boardKey(seed,options={}){const o=normalize(options);return `${o.mode==='daily'?'daily-'+o.day:'benchmark'}:${o.difficulty}:${seed>>>0}`;}
const rewardBoardKey=(seed,options={})=>'reward:'+boardKey(seed,options);
return {LEVELS,ACTS,DIFFICULTIES,STAKES,GIFTS,BOSSES,PALETTES,dailySeed,normalize,boardKey,rewardBoardKey,stageLength,stageStart,stageAt,CYCLE_LENGTH};
});
