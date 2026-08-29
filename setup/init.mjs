// 首跑向导(非交互,适合人和 Agent):探测 Chrome → 写 config.json → 按模板生成本机启动器 → 打印播种登录指引。幂等。
// 用法: node setup/init.mjs [--port 9223] [--proxy http://127.0.0.1:7897] [--profile DIR] [--gwr DIR] [--chrome PATH] [--locales zh-CN,en]
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here);
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const isWin = process.platform === 'win32';
const first = list => { for (const p of list) if (p && existsSync(p)) return p; return null; };

function detectChrome() {
  if (isWin) return first([
    (process.env['PROGRAMFILES'] || 'C:/Program Files') + '/Google/Chrome/Application/chrome.exe',
    (process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)') + '/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
  ]);
  if (process.platform === 'darwin') return first(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']);
  return first(['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/snap/bin/chromium']);
}

// 读旧 config 合并(幂等再跑不丢手改项)
const cfgPath = join(ROOT, 'config.json');
let cfg = {};
try { if (existsSync(cfgPath)) cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { }
cfg.port = parseInt(val('--port', cfg.port || 9223), 10);
cfg.proxy = val('--proxy', cfg.proxy !== undefined ? cfg.proxy : '');
cfg.profileDir = val('--profile', cfg.profileDir || join(homedir(), '.gemini-automation-chrome'));
cfg.gwrDir = val('--gwr', cfg.gwrDir || join(homedir(), 'gemini-watermark-remover'));
cfg.locales = val('--locales', cfg.locales || 'zh-CN,en');
const chrome = val('--chrome', cfg.chrome || detectChrome());
if (!chrome) { console.log(JSON.stringify({ ok: false, error: '未找到 Chrome,可用 --chrome 指定完整路径' })); process.exit(1); }
cfg.chrome = chrome;
// snap Chromium 的 AppArmor home 禁闭拒写 $HOME 下点开头目录:默认 profile 换可见目录;显式点目录直接报错(否则启动静默失败、端口永不监听)
if (!isWin && String(chrome).includes('/snap/')) {
  if (cfg.profileDir === join(homedir(), '.gemini-automation-chrome')) cfg.profileDir = join(homedir(), 'gemini-automation-chrome');
  else if (cfg.profileDir.startsWith(homedir() + '/') && /[\\/]\.[^\\/]/.test(cfg.profileDir.slice(homedir().length)))
    { console.log(JSON.stringify({ ok: false, error: 'snap Chromium 无法写 $HOME 下隐藏(点开头)目录的 profile,请换路径: ' + cfg.profileDir })); process.exit(1); }
}
// 配置值进启动器模板前校验(模板是裸占位符替换,坏值会把生成的 cmd/sh 变成任意命令)
if (cfg.proxy) {
  let bad = /["'\s&|;`$]/.test(cfg.proxy);
  try { const u = new URL(cfg.proxy); if (!/^(https?|socks5h?):$/.test(u.protocol)) bad = true; } catch { bad = true; }
  if (bad) { console.log(JSON.stringify({ ok: false, error: 'proxy 须为 http(s)/socks5 URL 且不含引号/空白/shell 字符: ' + cfg.proxy })); process.exit(1); }
}
for (const [k, v] of [['profileDir', cfg.profileDir], ['chrome', chrome]])
  if (/["&|;`$\r\n%]/.test(v)) { console.log(JSON.stringify({ ok: false, error: k + ' 路径含非法字符(" & | ; ` $ % 或换行): ' + v })); process.exit(1); }
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

// 渲染启动器(占位符替换;unix 版补执行位)
const render = (tplName, outName) => {
  const tpl = readFileSync(join(ROOT, 'launchers', tplName), 'utf8');
  const proxyArg = cfg.proxy ? ('--proxy-server=' + cfg.proxy) : '';
  const outP = join(ROOT, 'launchers', outName);
  writeFileSync(outP, tpl
    .replaceAll('{{PORT}}', String(cfg.port))
    .replaceAll('{{PROFILE}}', cfg.profileDir)
    .replaceAll('{{CHROME}}', chrome)
    .replaceAll('{{PROXY_ARG}}', proxyArg));
  if (!isWin) { try { chmodSync(outP, 0o755); } catch { } }
  return outP;
};
const ext = isWin ? 'cmd' : 'sh';
const startP = render('start-chrome.' + ext + '.tpl', 'start-chrome.' + ext);
const loginP = render('login-chrome.' + ext + '.tpl', 'login-chrome.' + ext);
try { mkdirSync(cfg.profileDir, { recursive: true }); } catch { }

console.log(JSON.stringify({ ok: true, config: cfgPath, start: startP, login: loginP, chrome, port: cfg.port, proxy: cfg.proxy || '(直连)' }));
process.stderr.write([
  '',
  '下一步:',
  '  1) 播种登录(一次性): 运行 ' + loginP + ' → 手动登录 Google/Gemini → 关窗',
  '     (该窗口无调试端口,Google 不拦;绝不要在带调试端口的窗口里登录)',
  '  2) 起自动化 Chrome:    运行 ' + startP,
  '  3) 冒烟验证(零额度):  node scripts/smoke.mjs',
  '',
].join('\n'));
