// 出图后取无损 PNG(canvas→toDataURL,GUID ws returnByValue 直接进 node,不进上下文),可选 gwr 去水印。
// 用法: node gemini-image-grab.mjs <wsUrl> <tid> <outFile> [--dewatermark]
import {execFileSync} from 'node:child_process';
import {writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {GWR_DIR} from './config.mjs';
const [WSURL,TID,OUT,...flags]=process.argv.slice(2);
const deW=flags.includes('--dewatermark');
const GWR=GWR_DIR+'/bin/gwr.mjs';
const ws=new WebSocket(WSURL);let id=0;const pending=new Map();let sid=null;
const raw=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify(s?{id:i,method:m,params:p,sessionId:sid}:{id:i,method:m,params:p}));});
const cmd=(m,p)=>raw(m,p,true);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const{res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}});
ws.addEventListener('error',e=>{console.log('WSERR',e.type||'err');process.exit(4);});
ws.addEventListener('open',async()=>{try{
  const a=await raw('Target.attachToTarget',{targetId:TID,flatten:true},false);sid=a.sessionId;
  await cmd('Runtime.enable',{});await cmd('Page.enable',{});await cmd('Page.bringToFront',{});
  let dataUrl=null;
  for(let i=0;i<20;i++){
    const r=await cmd('Runtime.evaluate',{expression:"(()=>{const im=[...document.querySelectorAll('img')].filter(x=>x.naturalWidth>=256).sort((a,b)=>b.naturalWidth-a.naturalWidth)[0];if(!im)return '';const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/png');})()",returnByValue:true});
    const v=r.result&&r.result.value;
    if(v&&v.startsWith('data:')){dataUrl=v;break;}
    await sleep(2000);
  }
  try{ws.close();}catch(e){}
  if(!dataUrl){console.log('NOIMG');process.exit(1);}
  const buf=Buffer.from(dataUrl.split(',')[1],'base64');
  const dim=buf.length>24?buf.readUInt32BE(16)+'x'+buf.readUInt32BE(20):'?';
  if(deW&&existsSync(GWR)){
    const tmp=OUT+'.raw.png';writeFileSync(tmp,buf);
    try{execFileSync('node',[GWR,'remove',tmp,'--output',OUT],{stdio:'ignore'});unlinkSync(tmp);console.log('WROTE(clean)',OUT,dim);}
    catch(e){writeFileSync(OUT,buf);try{unlinkSync(tmp);}catch(_){}console.log('WROTE(raw, gwr失败)',OUT,dim);}
  }else{writeFileSync(OUT,buf);console.log('WROTE'+(deW?'(raw, gwr缺)':'(raw)'),OUT,dim,(buf.length/1024/1024).toFixed(2)+'MB');}
  process.exit(0);
}catch(e){console.log('ERR',e.message);process.exit(3);}});
setTimeout(()=>{console.log('TIMEOUT');process.exit(2);},90000);
