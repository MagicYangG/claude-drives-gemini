// 确保 gwr 去水印 CLI 就位;缺失则走 VPN 代理 clone 并装依赖。幂等。
// 用法: node setup-gwr.mjs [dir] [proxy]
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {GWR_DIR,PROXY as CFG_PROXY} from './config.mjs';
const DIR=process.argv[2]||GWR_DIR;
const PROXY=process.argv[3]||CFG_PROXY; // 空 = 直连
if(existsSync(DIR+'/bin/gwr.mjs')){console.log('gwr 已就位:',DIR);process.exit(0);}
console.log('clone gwr',PROXY?('via '+PROXY):'(直连)','->',DIR);
try{
  const proxyArgs=PROXY?['-c','http.proxy='+PROXY,'-c','https.proxy='+PROXY]:[];
  execFileSync('git',[...proxyArgs,'clone','--depth','1','https://github.com/GargantuaX/gemini-watermark-remover.git',DIR],{stdio:'inherit'});
  console.log('npm install sharp mediabunny ...');
  // Windows 上没有裸 'npm' 可执行文件(只有 npm.cmd),且 Node>=22 spawn .cmd 必须 shell:true,否则 ENOENT
  execFileSync(process.platform==='win32'?'npm.cmd':'npm',['install','sharp','mediabunny'],{stdio:'inherit',cwd:DIR,shell:process.platform==='win32'});
  console.log(existsSync(DIR+'/bin/gwr.mjs')?'gwr 安装完成: '+DIR:'WARN: bin/gwr.mjs 仍缺失');
}catch(e){console.log('SETUP-ERR',e.message);console.log('手动: 见 references/dewatermark.md');process.exit(1);}
