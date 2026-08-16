// 冒烟测试(零生成额度):环境→Chrome→ws→开 tab→编辑器/模式按钮/工具菜单按钮探测→关 tab。只回一行 JSON。
// 用法: node smoke.mjs   (只读检测,不自动拉起 Chrome;没起会提示跑启动器)
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, LAUNCHER, LOGIN_LAUNCHER, PROXY, GWR_DIR, LOCALES, labels, rx } from './config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const S = n => join(here, n);
const run = (a) => execFileSync('node', a, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
const res = { ok: false, node: process.version, port: PORT, proxy: PROXY || '(直连)', locales: LOCALES.join(','), launcher: LAUNCHER || null, loginLauncher: LOGIN_LAUNCHER || null, gwr: GWR_DIR, checks: {} };
const fail = (why) => { res.error = why; console.log(JSON.stringify(res)); process.exit(1); };

if (parseInt(process.version.slice(1), 10) < 22) fail('Node 需 >=22');
if (!LAUNCHER) res.checks.launcher = 'MISSING(跑 node setup/init.mjs 生成)';
else res.checks.launcher = 'ok';

let alive = false;
try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(2500) }); alive = r.ok; } catch { }
res.checks.chrome = alive ? 'ok' : ('未运行(先跑启动器' + (LAUNCHER ? ': ' + LAUNCHER : '') + ')');
if (!alive) fail('专用 Chrome ' + PORT + ' 未运行');

let WS = '', TID = '';
try { WS = run([S('gemini-wsurl.mjs'), String(PORT)]).trim(); res.checks.ws = 'ok'; } catch { fail('取不到 GUID ws'); }
try { TID = run([S('gemini-open.mjs'), WS]).trim(); res.checks.tab = 'ok(editor 就绪)'; } catch (e) { fail('开 tab/编辑器失败(多半登录过期→跑 login 启动器,或代理不通): ' + String(e.message || e).slice(0, 80)); }

try {
  const L = labels();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const probe = async (name, src) => { // 控件可能晚于编辑器渲染(模式按钮实测有竞态),轮询最多 8s
    const expr = '(()=>{const re=new RegExp(' + JSON.stringify(src) + ',"i");return [...document.querySelectorAll("button")].some(b=>re.test((b.getAttribute("aria-label")||"")+(b.textContent||"")));})()';
    for (let i = 0; i < 16; i++) {
      let out = ''; try { out = run([S('cdp-eval.mjs'), TID, expr, WS]).trim(); } catch { }
      if (out === 'true') { res.checks[name] = 'ok'; return true; }
      await sleep(500);
    }
    res.checks[name] = 'NOT-FOUND(改版?按 gemini-ui.md 自愈)';
    return false;
  };
  const okMode = await probe('modeButton', rx(L.modeButton).source);
  const okTool = await probe('toolMenuButton', rx(L.toolMenuButton).source);
  res.ok = okMode && okTool;
} catch (e) { res.checks.labels = 'ERR ' + String(e.message || e).slice(0, 60); }
finally {
  try {
    execFileSync('node', ['-e', "const ws=new WebSocket(process.argv[1]);ws.addEventListener('open',()=>{ws.send(JSON.stringify({id:1,method:'Target.closeTarget',params:{targetId:process.argv[2]}}));setTimeout(()=>process.exit(0),500)});ws.addEventListener('error',()=>process.exit(0));", WS, TID], { stdio: 'ignore', timeout: 6000 });
  } catch { }
}
console.log(JSON.stringify(res));
process.exit(res.ok ? 0 : 1);
