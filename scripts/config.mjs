// 单一真相源:路径/端口/代理/区域标签。
// 优先级:环境变量 > <skill根>/config.json > 自动探测默认(开箱即用的推荐值)。
// 环境变量:GEMINI_STUDIO_PORT / MAIN_PORT / PROXY / PROFILE / DOWNLOAD_DIR / LOCALES / LAUNCHER / LOGIN
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = dirname(here);
let fileCfg = {};
try { const p = join(SKILL_DIR, 'config.json'); if (existsSync(p)) fileCfg = JSON.parse(readFileSync(p, 'utf8')); } catch { }
const env = process.env;
const pick = (envKey, fileKey, dflt) => env[envKey] !== undefined ? env[envKey] : (fileCfg[fileKey] !== undefined ? fileCfg[fileKey] : dflt);
const isWin = process.platform === 'win32';

const num = (envKey, fileKey, dflt) => { const n = parseInt(pick(envKey, fileKey, dflt), 10); return Number.isNaN(n) ? dflt : n; }; // env 空串/非法值回落默认,不产出 NaN
export const PORT = num('GEMINI_STUDIO_PORT', 'port', 9223);            // 专用自动化 Chrome
export const MAIN_PORT = num('GEMINI_STUDIO_MAIN_PORT', 'mainPort', 9222); // 主 Chrome(兜底)
export const PROXY = pick('GEMINI_STUDIO_PROXY', 'proxy', '');                            // 空 = 直连(仅 fallback 下载脚本用)
export const PROFILE_DIR = pick('GEMINI_STUDIO_PROFILE', 'profileDir', join(homedir(), '.gemini-automation-chrome'));
export const DOWNLOAD_DIR = pick('GEMINI_STUDIO_DOWNLOAD_DIR', 'downloadDir', '');        // 空 = 按 ws 端口自动判断
const _lc = String(pick('GEMINI_STUDIO_LOCALES', 'locales', 'zh-CN,en')).split(',').map(s => s.trim()).filter(Boolean);
export const LOCALES = _lc.length ? _lc : ['zh-CN', 'en']; // 空列表回落默认,防全部匹配退化为 NOMATCH

const firstExisting = list => { for (const p of list) if (p && existsSync(p)) return p; return null; };
export const LAUNCHER = pick('GEMINI_STUDIO_LAUNCHER', 'launcher', '') || firstExisting([
  join(SKILL_DIR, 'launchers', isWin ? 'start-chrome.cmd' : 'start-chrome.sh'),            // setup/init.mjs 生成
]);
export const LOGIN_LAUNCHER = pick('GEMINI_STUDIO_LOGIN', 'loginLauncher', '') || firstExisting([
  join(SKILL_DIR, 'launchers', isWin ? 'login-chrome.cmd' : 'login-chrome.sh'),
]);

// 系统默认下载目录:Linux 上 Chrome 跟随 xdg-user-dirs(zh_CN 桌面是 ~/下载,不是 ~/Downloads),其余平台 ~/Downloads
export function sysDownloadDir() {
  if (process.platform === 'linux') {
    try {
      const txt = readFileSync(join(homedir(), '.config', 'user-dirs.dirs'), 'utf8');
      const m = txt.match(/^XDG_DOWNLOAD_DIR="?([^"\n]+)"?/m);
      if (m) { const p = m[1].replace('$HOME', homedir()); if (existsSync(p)) return p; }
    } catch { }
  }
  return join(homedir(), 'Downloads');
}

// 主 Chrome 用户数据目录(读 Preferences / DevToolsActivePort;三平台)
export function mainChromeUserData() {
  if (isWin) return (env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')) + '/Google/Chrome/User Data';
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  return join(homedir(), '.config', 'google-chrome');
}

// 区域标签:locales/*.json 按 LOCALES 顺序合并为并集(多语言 UI 一套代码通吃;错的猜测不影响命中正确的)
let _labels = null;
export function labels() {
  if (_labels) return _labels;
  const merged = {};
  for (const lc of LOCALES) {
    try {
      const j = JSON.parse(readFileSync(join(SKILL_DIR, 'locales', lc + '.json'), 'utf8'));
      for (const [k, v] of Object.entries(j)) { if (k.startsWith('_')) continue; merged[k] = (merged[k] || []).concat(v); }
    } catch { }
  }
  _labels = merged;
  return merged;
}
// 数组 → 正则;空数组给必不命中的占位(防 new RegExp('') 匹配一切)
export const rx = (arr, flags = 'i') => new RegExp((arr && arr.length ? arr : ['\\u0000NOMATCH']).join('|'), flags);
