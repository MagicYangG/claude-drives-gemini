// 点 Gemini 原生下载钮落盘(图/视频/乐通用)→ 轮询下载目录 → 可选 gwr 去水印(仅图)。字节不进上下文,只回路径/尺寸。GUID ws 全程。
// 用法: node gemini-download.mjs <wsUrl> <tid> <image|video|music> <out> [--dewatermark] [--downloadDir DIR] [--profileDir DIR]
// 机制:image=点「下载完整尺寸的图片」直接落盘;music/video=点「下载音乐作品/下载视频」常弹格式菜单→真鼠标自动选(乐=纯音频MP3;视频=含音频MP4)。无菜单则直接下载。
// 取代旧 cookie+curl(那是被去水印扩展拦下载逼出来的绕路;专用 profile 无扩展→原生下载即可)。
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DOWNLOAD_DIR, GWR_DIR, labels, rx, mainChromeUserData, sysDownloadDir } from './config.mjs';

const args = process.argv.slice(2);
const [WSURL, TID, TYPE, OUT] = args;
const flag = n => args.includes(n);
const val = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const DEWM = flag('--dewatermark');
const PROFILE = val('--profileDir') || mainChromeUserData();

function resolveDownloadDir() {
  const explicit = val('--downloadDir'); if (explicit) return explicit;
  if (DOWNLOAD_DIR) return DOWNLOAD_DIR; // config 覆盖
  try {
    // 按 ws 端口判断:连的不是主 Chrome(专用 profile)→ 落系统默认 ~/Downloads,别读主 Chrome 的 Preferences
    const mainPort = parseInt((readFileSync(join(PROFILE, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0] || '').trim(), 10);
    const wsPort = parseInt((String(WSURL).match(/^ws:\/\/[^:/]+:(\d+)\//) || [])[1], 10);
    if (!mainPort || wsPort !== mainPort) return sysDownloadDir();
    const pref = JSON.parse(readFileSync(join(PROFILE, 'Default', 'Preferences'), 'utf8')); const d = pref && pref.download && pref.download.default_directory; if (d && existsSync(d)) return d;
  } catch { }
  return sysDownloadDir();
}
const DLDIR = resolveDownloadDir();
const EXTRE = { image: /\.(png|jpe?g|webp)$/i, video: /\.(mp4|webm|mov)$/i, music: /\.(mp3|m4a|wav|mp4)$/i }[TYPE] || /./; // 按类型白名单,防并发无关文件被错认(2026-07-19)
const startTs = Date.now();
const listAll = () => { try { return readdirSync(DLDIR).filter(f => !f.endsWith('.crdownload')); } catch { return []; } };
const before = new Set(listAll());
const pngDims = buf => (buf.length > 24 && buf.toString('ascii', 12, 16) === 'IHDR') ? buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20) : '';

const L = labels(); // 各类型主下载钮/格式菜单项:文案来自 locales/*.json 并集(容错匹配,兼容改版与多语言 UI)
const BTN = { image: rx(L.dlImage).source, video: rx(L.dlVideo).source, music: rx(L.dlMusic).source };
const MENUPICK = { music: rx(L.pickMusic).source, video: rx(L.pickVideo).source, image: null }; // image 无菜单
const DLGEN = rx((L.download || []).concat(['download'])).source; // 兜底"任意下载钮"

const ws = new WebSocket(WSURL); let id = 0; const pending = new Map(); let sid = null;
const raw = (m, p, s) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify(s ? { id: i, method: m, params: p, sessionId: sid } : { id: i, method: m, params: p })); });
const cmd = (m, p) => raw(m, p, true);
const evalp = e => cmd('Runtime.evaluate', { expression: e, returnByValue: true }).then(r => r.result && r.result.value);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function realClick(x, y) {
  await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1 });
}
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } });
ws.addEventListener('error', () => { console.log('WSERR'); process.exit(4); });
ws.addEventListener('open', async () => {
  try {
    const a = await raw('Target.attachToTarget', { targetId: TID, flatten: true }, false); sid = a.sessionId;
    await cmd('Runtime.enable', {}); await cmd('Page.enable', {}); await cmd('Page.bringToFront', {});
    await sleep(400);
    const btnRe = JSON.stringify(BTN[TYPE]);
    // 点主下载钮(合成 click 足以开菜单 / 触发图片下载)
    // 多轮对话里同名下载钮会有多个,取最后一个=最新产物(2026-08-08 自愈:原 .find() 永远抓第一张旧图)
    const clicked = await evalp(`(()=>{const re=new RegExp(${btnRe},'i');const bs=[...document.querySelectorAll('button')];const hit=bs.filter(x=>re.test((x.getAttribute('aria-label')||'')+(x.textContent||''))).pop();const b=hit||bs.filter(x=>new RegExp(${JSON.stringify(DLGEN)},'i').test((x.getAttribute('aria-label')||'')+(x.textContent||''))).pop();if(b){b.scrollIntoView({block:'center'});b.click();return b.getAttribute('aria-label')||'clicked';}return null;})()`);
    if (!clicked) { console.log('NOBTN — 改版了,重探选择器'); try { ws.close(); } catch { } process.exit(1); }
    console.log('CLICK', clicked);
    await sleep(900);
    // 若弹格式菜单,真鼠标选目标格式
    const pickRe = MENUPICK[TYPE];
    if (pickRe) {
      const mi = await evalp(`(()=>{if(!document.querySelector('[role=menu],[role=listbox]'))return 'NOMENU';const re=new RegExp(${JSON.stringify(pickRe)},'i');const items=[...document.querySelectorAll('[role=menuitem],[role=menuitemradio],[role=option],button')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&re.test((x.getAttribute('aria-label')||'')+(x.textContent||''));});const t=items[0];if(!t)return 'NOITEM';const r=t.getBoundingClientRect();return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),label:(t.getAttribute('aria-label')||t.textContent||'').trim().slice(0,30)});})()`);
      if (mi && mi !== 'NOMENU' && mi !== 'NOITEM') { const o = JSON.parse(mi); await realClick(o.x, o.y); console.log('MENU-PICK', o.label); await sleep(500); }
      else console.log('MENU', mi, '(无菜单则直接下载)');
    }
    try { ws.close(); } catch { }
    // 轮询新文件(无 .crdownload 且大小连续两次稳定 = 完成)
    let found = null;
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const news = listAll().filter(f => !before.has(f) && EXTRE.test(f));
      if (news.length) {
        const cands = [];
        for (const f of news) { try { const p = join(DLDIR, f); const st = statSync(p); if (st.mtimeMs >= startTs - 10000) cands.push({ f, p, t: st.mtimeMs }); } catch { } } // statSync 竞态(Chrome 改名瞬间)跳过本轮,不再整轮中止
        const cand = cands.sort((a, b) => b.t - a.t)[0];
        if (cand && !existsSync(cand.p + '.crdownload')) {
          let s1 = -1, s2 = -2;
          try { s1 = statSync(cand.p).size; await sleep(600); s2 = statSync(cand.p).size; } catch { }
          if (s1 === s2 && s1 > 0) { found = cand.p; break; }
        }
      }
    }
    if (!found) { console.log('TIMEOUT-NOFILE dir=' + DLDIR + ' — 查 download.default_directory'); process.exit(2); }
    // 实际容器与 OUT 扩展名不符时(如 Lyria 落 .mp4 而调用方要 .mp3)按真实容器改写扩展,真实路径经 DONEJSON.file 回传
    let outPath = OUT;
    const fext = (found.match(/\.[A-Za-z0-9]+$/) || [''])[0].toLowerCase();
    const oext = (OUT.match(/\.[A-Za-z0-9]+$/) || [''])[0].toLowerCase();
    if (fext && oext && fext !== oext) { outPath = OUT.slice(0, OUT.length - oext.length) + fext; console.log('EXT-FIX ' + oext + '→' + fext); }
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(found, outPath);
    let dewm = false;
    if (DEWM && TYPE === 'image') {
      const clean = outPath.replace(/\.(png|jpg|jpeg)$/i, '') + '.clean.png';
      try { execFileSync('node', [join(GWR_DIR, 'bin', 'gwr.mjs'), 'remove', outPath, '--output', clean, '--json'], { stdio: 'ignore' }); if (existsSync(clean)) { copyFileSync(clean, outPath); dewm = true; } } catch (e) { console.log('GWR-FAIL', e.message); }
    }
    const buf = readFileSync(outPath);
    console.log('WROTE', outPath, TYPE === 'image' ? pngDims(buf) : '', (buf.length / 1024 / 1024).toFixed(2) + 'MB', 'from=' + found, 'dewm=' + dewm);
    console.log('DONEJSON ' + JSON.stringify({ file: outPath, dims: TYPE === 'image' ? pngDims(buf) : '', mb: +(buf.length / 1024 / 1024).toFixed(2), from: found, dewm })); // 机读行,路径含空格也不怕(gen 优先解析)
    process.exit(0);
  } catch (e) { try { ws.close(); } catch { } console.log('ERR', e.message); process.exit(3); }
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 150000); // ≥ 轮询最坏耗时+余量,保住 TIMEOUT-NOFILE 诊断行
