const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../src/benchmark-core.js'),P=require('../src/campaign-data.js'),drive=require('../tools/route-check.cjs');
function client(records=[],response=null,endpoint=response?'/api/benchmark':null){
 const data=new Map(),requests=[],key='sandbox-board-'+C.VERSION;if(records.length)data.set(key,JSON.stringify(records));
 const realm=vm.createContext({EscapeBenchCore:C,SandboxCampaign:P,document:{querySelector:()=>endpoint?{content:endpoint}:null},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))},location:{protocol:'https:',href:'https://game.example/play/index.html'},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{requests.push({url,options});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>response};}});
 vm.runInContext(fs.readFileSync(require.resolve('../src/benchmark-client.js'),'utf8'),realm);return {store:vm.runInContext('EscapeBenchStore',realm),data,requests};
}
function row(id,score,reward,durationMs=1000,difficulty='hard'){return {id,name:'NULL-07',version:C.VERSION,score,reward,durationMs,createdAt:'2026-09-30T00:00:00Z',board:P.boardKey(C.SEED,{difficulty}),rewardBoard:P.rewardBoardKey(C.SEED,{difficulty})};}
test('reward and benchmark views sort independently, break ties by time, and isolate difficulty',async()=>{
 const {store}=client([row('coverage',9000,2000),row('reward',5000,7000),row('fast-reward',5000,7000,900),row('other-difficulty',10000,999999,100,'expert')]);
 const benchmark=await store.rows('local'),reward=await store.rows('local',{metric:'reward'});
 assert.deepEqual(Array.from(benchmark.rows,r=>r.id),['coverage','fast-reward','reward']);assert.deepEqual(Array.from(reward.rows,r=>r.id),['fast-reward','reward','coverage']);assert.notEqual(benchmark.board,reward.board);
});
test('both local boards use recomputed replay reward, never submitted totals',async()=>{
 const t=drive(),{store}=client(),trace={...t.result,inputs:t.inputs,reward:999999999,score:10000};
 const saved=await store.submit('local','NULL-07',trace,null,'verified-inputs');assert.equal(saved.reward,t.result.reward);assert.equal(saved.score,t.result.score);
 const rewards=await store.rows('local',{metric:'reward'});assert.equal(rewards.rows[0].reward,t.result.reward);assert.equal(rewards.rows[0].rewardBoard,t.result.rewardBoard);
 await assert.rejects(store.submit('local','NULL-07',trace,null,'verified-inputs'),/already/);
 await assert.rejects(store.submit('local','NULL-07',{...trace,version:'exploitgym-exit-protocol-8.0.0'},null,'old-physics'),/Incompatible/);
});
test('a server without the reward metric cannot be presented as a reward leaderboard',async()=>{
 const {store}=client([],{enabled:true,board:P.boardKey(C.SEED),rows:[row('coverage',10000,1)]});
 const reward=await store.rows('global',{metric:'reward'});assert.equal(reward.enabled,false);assert.equal(reward.rows,undefined);
 const benchmark=await store.rows('global');assert.equal(benchmark.enabled,true);assert.equal(benchmark.rows[0].id,'coverage');
});
test('static hosting stays local without probing an undeclared global endpoint',async()=>{
 const {store,requests}=client([row('local',7000,2000)]);
 assert.equal((await store.config()).enabled,false);assert.equal(await store.ticket(),null);
 assert.equal((await store.rows('global',{metric:'reward'})).enabled,false);
 assert.equal((await store.rows('local')).rows[0].id,'local');assert.equal(requests.length,0);
});
test('an opted-in endpoint retains deployment parameters and receives the selected board context',async()=>{
 const options={mode:'daily',difficulty:'expert',day:'2026-09-30'},seed=P.dailySeed(options.day),board=P.rewardBoardKey(seed,options);
 const {store,requests}=client([],{enabled:true,board,rows:[row('remote',5000,5000)]},'../boards/eval?deployment=arcade');
 const result=await store.rows('global',{metric:'reward',options,seed});assert.equal(result.enabled,true);assert.equal(result.rows[0].id,'remote');
 const url=new URL(requests[0].url);assert.equal(url.origin,'https://game.example');assert.equal(url.pathname,'/boards/eval');
 assert.equal(url.searchParams.get('deployment'),'arcade');assert.equal(url.searchParams.get('mode'),'daily');assert.equal(url.searchParams.get('difficulty'),'expert');assert.equal(url.searchParams.get('day'),options.day);assert.equal(url.searchParams.get('metric'),'reward');
});
