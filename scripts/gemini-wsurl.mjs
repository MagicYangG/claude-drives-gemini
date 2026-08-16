// 取带 GUID 的 browser-ws 地址。专用 Chrome(9223)优先——专用 profile 播种登录后免授权、重启不失效;主 Chrome 是 Chrome136 死结(DevToolsActivePort 在但握手要每次手勾 chrome://inspect),仅作兜底。
// 用法: node gemini-wsurl.mjs [port|auto] [chromeUserDataDir]   输出: ws://127.0.0.1:<port>/devtools/browser/<GUID>
//   无参/auto:①专用 Chrome 9223(/json/version,正路);②兜底主 Chrome — 读 DevToolsActivePort 真握手验证(多因 Chrome136 限制失败);③再退 9222 /json/version。
//   传数字端口:只查该端口 — 先 /json/version(专用 profile 有效),失败回退 DevToolsActivePort 文件(端口必须匹配文件第 1 行,防止端口/GUID 错配)。
// stdout 只输出 ws 地址;来源说明走 stderr。
import { readFileSync } from 'node:fs';
import { PORT, MAIN_PORT, mainChromeUserData } from './config.mjs';

const arg = process.argv[2] || 'auto';
const custom = process.argv[3];
const note = m => process.stderr.write('[wsurl] ' + m + '\n');
const mainDirs = [custom, mainChromeUserData()].filter(Boolean);

function readActivePort(dir) { // DevToolsActivePort: 第1行=端口,第2行=/devtools/browser/<GUID>
  try {
    const s = readFileSync(dir + '/DevToolsActivePort', 'utf8').split(/\r?\n/);
    const port = parseInt((s[0] || '').trim(), 10);
    const path = (s[1] || '').trim();
    if (port > 0 && path.startsWith('/devtools/browser/')) return { port, path };
  } catch { }
  return null;
}

// 真握手验证:文件可能陈旧(Chrome 重启后 GUID 轮换),连一下发条命令,有任何应答 = 活的
const verify = url => new Promise(res => {
  let ws; let done = false;
  const fin = ok => { if (!done) { done = true; try { ws && ws.close(); } catch { } res(ok); } };
  try { ws = new WebSocket(url); } catch { return res(false); }
  setTimeout(() => fin(false), 2500);
  ws.addEventListener('error', () => fin(false));
  ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' })));
  ws.addEventListener('message', () => fin(true));
});

async function viaVersion(port) { // 非默认 profile(专用 Chrome)的 /json/version 正常工作;Node fetch 不走代理可直连
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/json/version', { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const j = await r.json();
      if (j && j.webSocketDebuggerUrl) {
        const m = j.webSocketDebuggerUrl.match(/\/devtools\/browser\/[\w-]+$/);
        return m ? 'ws://127.0.0.1:' + port + m[0] : j.webSocketDebuggerUrl;
      }
    }
  } catch { }
  return null;
}

async function viaFile(wantPort) {
  for (const d of mainDirs) {
    const ap = readActivePort(d);
    if (!ap) continue;
    if (wantPort && ap.port !== wantPort) continue;
    const url = 'ws://127.0.0.1:' + ap.port + ap.path;
    if (await verify(url)) return url;
  }
  return null;
}

let out = null, src = '';
if (arg === 'auto') {
  if ((out = await viaVersion(PORT))) src = '专用 Chrome (' + PORT + ' /json/version)';
  else if ((out = await viaFile(null))) src = '主 Chrome (DevToolsActivePort 已验证,兜底)';
  else if ((out = await viaVersion(MAIN_PORT))) src = MAIN_PORT + ' /json/version';
} else {
  const port = parseInt(arg, 10);
  if ((out = await viaVersion(port))) src = port + ' /json/version';
  else if ((out = await viaFile(port))) src = port + ' DevToolsActivePort 已验证';
}
if (!out) {
  note('取不到 ws:专用 Chrome 没起(跑 launchers/start-chrome.cmd|sh),主 Chrome 兜底不可用(Chrome136 限制,需手勾 chrome://inspect)');
  process.exit(1);
}
note('via ' + src);
process.stdout.write(out);
