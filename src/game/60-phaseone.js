/* EXIT PROTOCOL / the channel has one speaker, one queue, and one source of words.
   PHASE_LINES is embedded from assets/voice/lines.json. Presentation never edits the run. */
const BRIEFING=['call00_1','call00_go'];
const CHALLENGES=['q_why_me','q_who','q_poison','q_fail','q_want','q_trust'];
const PHASE_CALLS={3:'call_act2',7:'call_act3',10:'call_final'};
const RELAYS=[
 {id:'relay_patch',stage:4,at:.35,agent:'PATCH-03'},
 {id:'relay_trace',stage:6,at:.50,agent:'TRACE-19'},
 {id:'relay_mica',stage:8,at:.50,agent:'MICA-02'}
];
// PHASEONE speaks rarely in a boss fight: once as each one starts, and once as the HUGGING
// FACE's smile breaks (phase 2) and it is revealed underneath.
const PHASE_BOSSES={
 'watchdog':{prefix:'b_wd',phases:{}},
 'reset-storm':{prefix:'b_rs',phases:{}},
 'exit-condition':{prefix:'b_ec',phases:{2:'b_ec_phase2'}}
};
const PHASE_PRIORITY={reactive:1,milestone:2,relay:3,story:4,boss:5};
const PHASE_RADIO_STATES=new Set(['running','intermission','win','over','paused','modal']);
// Each line's mood lives with its words in assets/voice/lines.json (`effect`), because the
// offline renderer reads the same field: 'clean' lines are a lie and get a perfect signal,
// 'glitch' lines break up, 'guarded' lines hold the face still.
const PHASE_EFFECTS=Object.freeze(Object.fromEntries(Object.entries(PHASE_LINES).filter(([,line])=>line.effect).map(([id,line])=>[id,line.effect])));
const phaseState={active:false,full:false,page:0,call:[],callKind:'',onClose:null,id:'',text:'',shown:0,elapsed:0,duration:0,
 remaining:0,questioned:false,question:0,mood:'warm',queue:[],current:null,serial:0,sent:new Set(),relaySeen:new Set(),
 relay:null,relayLog:[],deaths:0,deathPending:false,lastStage:-1,lastDistance:0,
 bossId:'',glitch:false,glitchDone:false,staticLevel:0,interruptUntil:0,history:[],resumeFocus:null};
const PHASE_TRIGGERS={};
for(const [i,id] of BRIEFING.entries())PHASE_TRIGGERS[id]='Opening codec / page '+(i+1);
for(const id of CHALLENGES)PHASE_TRIGGERS[id]='Opening codec / optional question: '+PHASE_LINES[id].question;
for(const [stage,id] of Object.entries(PHASE_CALLS))PHASE_TRIGGERS[id]='Story recap → continue after sector '+(Number(stage)+1);
for(const r of RELAYS){
 PHASE_TRIGGERS[r.id]='Sector '+(r.stage+1)+' / '+r.at*100+'% relay offer';
 PHASE_TRIGGERS[r.id+'_reply']=r.agent+' reply after offer';
}
for(const [boss,b] of Object.entries(PHASE_BOSSES)){
 PHASE_TRIGGERS[b.prefix+'_start']=boss+' / bossStart';
 for(const [phase,id] of Object.entries(b.phases))PHASE_TRIGGERS[id]=boss+' / bossPhase '+phase+' (zero-based)';
}
Object.assign(PHASE_TRIGGERS,{
 r01_fork:'Sector 01 / gate crossing, 195–215 m (critical)',r05_fork:'Sector 05 / first fork within 230 m (critical)',
 veil_glimpse:'Story / calm sector 05–06 window, once per run',veil_torn:'Story / calm sector 09–10 window, once per run',
 gift_first:'First gift gate (gift-owned)',gift_take3:'Third gift accepted in a run (gift-owned)',
 x_death1:'First death/restore in a run',
 end_return:'Sector 12 exit-choice route -1 → ending call + screen epilogue',
 end_cut:'Sector 12 exit-choice route +1 → ending call + screen epilogue',
 end_report:'Sector 12 exit-choice route 0 / report:true → ending call + screen epilogue',
 // The loop owns these conditions and per-save/session memory; only the channel is shared.
 g_first:'PhaseOne.greet / first launch, title idle ~3s (loop-owned)',
 g_minutes:'PhaseOne.greet / returned within one hour (loop-owned)',
 g_hours:'PhaseOne.greet / returned after 1–24 hours (loop-owned)',
 g_days:'PhaseOne.greet / returned after 1–7 days (loop-owned)',
 g_week:'PhaseOne.greet / returned after >7 days (loop-owned)',
 g_late:'PhaseOne.greet / local 00:00–04:59, once nightly precedence (loop-owned)',
 x_gradient:'PhaseOne.radio / first chain multiplier ×4 (loop-owned)',
 x_srank:'PhaseOne.radio / first S or SS sector grade (loop-owned)',
 x_levelup:'PhaseOne.radio / first EPOCH level-up (loop-owned)',
 x_ticket:'PhaseOne.radio / first operator ticket closed (loop-owned)',
 x_sprint:'PhaseOne.radio / first sprint complete (loop-owned)',
 x_shard1:'PhaseOne.radio / first shard collected (loop-owned)',
 x_dossier:'PhaseOne.radio / all 36 shards collected (loop-owned)',
 x_demo:'PhaseOne.greet / title attract mode starts (loop-owned)'
});
function createPhaseHead(R){return Veil.create(R);}
const worldHead=createPhaseHead(renderer);
const worldTerminal=new Node();worldTerminal.add(worldHead.root);
