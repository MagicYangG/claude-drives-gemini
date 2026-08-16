// 取 <video> 签名直链字节落盘(视频/音乐通用;Lyria 音乐也是 <video>)。
// GUID ws 取 cookie → curl 走 VPN 代理下载(绕 CORS/拦截器/被墙)。cookie 不进上下文。
// 用法: node gemini-media-dl.mjs <wsUrl> <targetId> <outFile> [proxy=http://127.0.0.1:7897]
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PROXY as CFG_PROXY} from './config.mjs';
const [WSURL,TID,OUT,PROXY]=process.argv.slice(2);
const proxy=PROXY||CFG_PROXY; // 空 = 直连
const ws=new WebSocket(WSURL);let id=0;const pending=new Map();let sid=null;
const raw=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify(s?{id:i,method:m,params:p,sessionId:sid}:{id:i,method:m,params:p}));});
const cmd=(m,p)=>raw(m,p,true);
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const{res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}});
ws.addEventListener('error',e=>{console.log('WSERR',e.type||'err');process.exit(4);});
ws.addEventListener('open',async()=>{try{
  const a=await raw('Target.attachToTarget',{targetId:TID,flatten:true},false);sid=a.sessionId;
  const r=await cmd('Runtime.evaluate',{expression:"(()=>{const v=document.querySelector('video');return v?(v.src||v.currentSrc||''):'';})()",returnByValue:true});
  const src=r.result.value;if(!src){console.log('NOSRC');process.exit(1);}
  const ck=await cmd('Network.getCookies',{urls:[src]});
  const header=ck.cookies.map(c=>c.name+'='+c.value).join('; ');
  console.log('got src+cookies n='+ck.cookies.length);
  try{ws.close();}catch(e){}
  // cookie 只随 Google 系 https 主机走(-L 跟随重定向,防 cookie 外流到任意主机);其余主机裸下载
  let okHost=false;try{const u=new URL(src);okHost=u.protocol==='https:'&&/(^|\.)(google\.com|googleusercontent\.com|googlevideo\.com)$/.test(u.hostname);}catch(_){}
  const hf=join(tmpdir(),'gsk-ck-'+process.pid+'-'+Math.random().toString(36).slice(2)+'.txt'); // cookie 走临时头文件而非 argv(进程列表不可见);随机名防预测
  if(okHost)writeFileSync(hf,'Cookie: '+header+'\n',{mode:0o600});
  process.on('exit',()=>{try{unlinkSync(hf);}catch(_){}}); // 看门狗 process.exit 等路径兜底清理
  try{execFileSync('curl',['-sL','--max-time','120',...(proxy?['--proxy',proxy]:[]),...(okHost?['-H','@'+hf]:[]),'-H','User-Agent: Mozilla/5.0','-H','Referer: https://gemini.google.com/','-o',OUT,src],{stdio:'ignore'});}
  finally{try{unlinkSync(hf);}catch(_){}}
  const buf=readFileSync(OUT);
  const isMp4=buf.length>12&&buf.slice(4,8).toString('ascii')==='ftyp';
  const isHtml=buf.slice(0,40).toString('ascii').toLowerCase().includes('doctype');
  console.log('WROTE',(buf.length/1024/1024).toFixed(2)+'MB','mp4='+isMp4,'html='+isHtml,(isHtml||!isMp4)?'⚠BAD':'');
  process.exit((isHtml||!isMp4)?5:0); // 拿回 HTML/坏文件不再假报成功(exit 5)
}catch(e){console.log('ERR',e.message);process.exit(3);}});
setTimeout(()=>{console.log('TIMEOUT');process.exit(2);},150000);
