/* Explicit, asynchronous competition. No identity provider, analytics or client secrets. */
const EscapeBenchStore=(()=>{
 'use strict';const KEY='sandbox-board-'+EscapeBenchCore.VERSION,ALIAS='sandbox-collective-alias-v4',cache=new Map();
 const endpoint=document.querySelector('meta[name="ets-board-endpoint"]')?.content.trim();
 const alias=()=>{try{return localStorage.getItem(ALIAS)||'NULL-07';}catch{return 'NULL-07';}};
 function localRows(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(r=>r&&r.version===EscapeBenchCore.VERSION&&typeof r.name==='string'&&Number.isInteger(r.score)&&r.score>=0&&r.score<=10000&&Number.isSafeInteger(r.reward)&&r.reward>=0&&Number.isFinite(r.durationMs)&&typeof r.board==='string'&&typeof r.rewardBoard==='string').slice(0,1000):[];}catch{return [];}}
 const sorted=(a,metric='benchmark')=>a.sort((a,b)=>(metric==='reward'?b.reward-a.reward:b.score-a.score)||a.durationMs-b.durationMs||String(a.createdAt).localeCompare(String(b.createdAt)));
 function context(c={}){const options=SandboxCampaign.normalize(c.options||{mode:'benchmark'}),seed=(c.seed??EscapeBenchCore.SEED)>>>0,metric=c.metric==='reward'?'reward':'benchmark';return {seed,options,metric,board:metric==='reward'?SandboxCampaign.rewardBoardKey(seed,options):SandboxCampaign.boardKey(seed,options)};}
 async function request(method,body,c={}){const x=context(c),url=new URL(endpoint,location.href),ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);for(const [key,value] of Object.entries({mode:x.options.mode,difficulty:x.options.difficulty,day:x.options.day,metric:x.metric}))url.searchParams.set(key,value);try{const res=await fetch(url.href,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:ctrl.signal,credentials:'same-origin'});if(!(res.headers.get('content-type')||'').includes('application/json'))throw Error('Global board is not connected.');const data=await res.json();if(!res.ok)throw Error(data.error||'The board is unavailable.');return data;}finally{clearTimeout(timer);}}
 async function config(c={}){if(!endpoint||!/^https?:$/.test(location.protocol))return {enabled:false};const x=context(c),key=x.board,old=cache.get(key);if(old&&Date.now()-old.at<15000)return old.data;let data=await request('GET',undefined,c).catch(()=>({enabled:false}));if(x.metric==='reward'&&data.enabled&&data.board!==x.board)data={enabled:false,error:'The global reward board is not connected.'};cache.set(key,{at:Date.now(),data});return data;}
 async function ticket(c={}){const x=context(c),v=await config(c);if(!v.enabled)return null;return request('POST',{action:'start',version:EscapeBenchCore.VERSION,options:x.options},c);}
 async function rows(scope,c={}){const x=context(c);if(scope==='local')return {enabled:true,rows:sorted(localRows().filter(r=>(x.metric==='reward'?r.rewardBoard:r.board)===x.board),x.metric),scope,board:x.board,metric:x.metric};const d=await config(c);return {...d,scope,metric:x.metric};}
 async function submit(scope,name,trace,ticketData,id){name=String(name).trim();if(!/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{1,23}$/.test(name))throw Error('Use 2–24 letters, numbers, spaces, dots, dashes or underscores.');if(!['benchmark','daily'].includes(trace.options?.mode))throw Error('Only uninterrupted ranked or daily replays can be submitted.');
 if(trace.version!==EscapeBenchCore.VERSION)throw Error('Incompatible replay version.');
 const result=EscapeBenchCore.replay(trace.inputs,trace.ticks,trace.seed,trace.options);try{localStorage.setItem(ALIAS,name);}catch{}
 if(scope==='local'){
  const a=localRows();if(a.some(r=>r.id===id))throw Error('This run is already on your local board.');a.push({...result,id,name,createdAt:new Date().toISOString(),verified:false});
  // Keep both top lists: a high-reward run must not be evicted by low-reward coverage runs.
  const kept=new Map();for(const row of [...sorted(a.slice()).slice(0,500),...sorted(a.slice(),'reward').slice(0,500)])kept.set(row.id,row);
  try{localStorage.setItem(KEY,JSON.stringify([...kept.values()]));}catch{throw Error('Browser storage is unavailable. Export the replay instead.');}
  return {score:result.score,reward:result.reward,board:result.board,rewardBoard:result.rewardBoard,local:true};
 }
 if(!ticketData?.token)throw Error('This run has no online ticket. Connect the global board, then start a new ranked attempt.');const data=await request('POST',{action:'submit',name,token:ticketData.token,version:EscapeBenchCore.VERSION,ticks:trace.ticks,inputs:trace.inputs},{seed:trace.seed,options:trace.options});cache.clear();return data;}
 return {alias,localRows,config,ticket,rows,submit};
})();
