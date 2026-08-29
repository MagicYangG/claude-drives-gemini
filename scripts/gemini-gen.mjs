// 一条龙出图/视频/乐(2026-07-19 v2):preflight→open→直发提交→wait(阶段感知重试)→原生下载(→gwr)。只回一行 JSON;媒体字节绝不进上下文。
// 用法: node gemini-gen.mjs <image|video|music> "<prompt>" <outFile> [--dewatermark] [--use-tool] [--downloadDir DIR] [--maxSec N] [--ws WS] [--keep] [--no-preflight]
//   默认纯提示词直发(三模态 2026-07-18 真机实测可自动路由;提示词必须带明确生成动词,见 SKILL.md 提示词契约)。
//   --use-tool 走 + 菜单勾选(要视频宽高比/风格模板面板时);视频直发被连拒 2 次会自动降级工具路径再试(新 tab;拒绝=零产出,量额安全)。
//   preflight(默认开;--ws 或 --no-preflight 跳过):查专用 Chrome 9223,没起自动跑启动器拉起——Claude 出活只需这一条命令。
//   阶段感知重试(取代旧 --attempts 整链重试,杜绝双倍烧额度):
//     提交失败(什么都没发出)→ 重开 tab 再试 1 次;Gemini 明确拒绝「无法生成」→ 同 tab 安全重发 1 次(真机验证:未产出不烧额度);
//     wait 超时但仍在生成 → 只延长等待,绝不重提交;下载失败 → 产物已在页面,同 tab 重试下载,仍败保留 tab 供补捞。
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, LAUNCHER as CFG_LAUNCHER, DOWNLOAD_DIR, GWR_DIR, labels, rx, mainChromeUserData, sysDownloadDir } from './config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const S = n => join(here, n);
const args = process.argv.slice(2);
const [TYPE, PROMPT, OUT] = args;
const flag = n => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
if (!['image', 'video', 'music'].includes(TYPE) || !PROMPT || !OUT) {
  console.log('用法: node gemini-gen.mjs <image|video|music> "<prompt>" <out> [--dewatermark] [--use-tool] [--downloadDir DIR] [--maxSec N] [--ws WS] [--keep] [--no-preflight]');
  process.exit(1);
}
const MAXSEC = parseInt(val('--maxSec', TYPE === 'image' ? '180' : '300'), 10); // Pro+扩展思考的思考期比 Flash 慢数倍(图实测 ~150s+),120s 会误杀
const DEWM = flag('--dewatermark');
// prompt 本身若含「无法生成」等词会回显进页面,被 wait 的 fc 误计 → 预扫 prompt 命中数计入 failBase(与 gemini-wait.mjs 同一 locales 来源)
const FAILRE = rx(labels().genFail, 'gi');
const PROMPT_HITS = (PROMPT.match(FAILRE) || []).length;
const LAUNCHER = CFG_LAUNCHER; // config 解析链:env/config.json → 技能 launchers/(setup/init.mjs 生成)
const t0 = Date.now();
let WSV = '', TIDV = '', keepTab = flag('--keep');
const run = (a, opts = {}) => execFileSync('node', a, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...opts });
const runCap = a => { try { return { code: 0, out: run(a) }; } catch (e) { return { code: e.status == null ? -1 : e.status, out: String(e.stdout || '') }; } };
const log = m => process.stderr.write('[gen] ' + m + '\n'); // 过程走 stderr,stdout 只留最终 JSON
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (DEWM && !existsSync(join(GWR_DIR, 'bin', 'gwr.mjs'))) log('警告: gwr 未装,--dewatermark 本次无效(产物带角标)——一次性安装: node scripts/setup-gwr.mjs');

async function alive() { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(2500) }); return r.ok; } catch { return false; } }
async function preflight() {
  if (val('--ws', '') || flag('--no-preflight')) return;
  if (await alive()) { log('preflight: ' + PORT + ' alive'); return; }
  if (!LAUNCHER || !existsSync(LAUNCHER)) throw Object.assign(new Error('专用 Chrome 未起且找不到启动器(先跑 node setup/init.mjs 生成,或在 config.json 指定 launcher)'), { stage: 'chrome' });
  log('preflight: 拉起专用 Chrome…');
  if (process.platform === 'win32') spawn('cmd', ['/c', LAUNCHER], { detached: true, stdio: 'ignore' }).unref();
  else spawn('sh', [LAUNCHER], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await alive()) { log('preflight: Chrome up'); return; } }
  throw Object.assign(new Error('拉起专用 Chrome 30s 未就绪(查启动器/代理;页面打不开多半是本地代理没开)'), { stage: 'chrome' });
}

// 下载目录按 ws 端口自动判断:连的是主 Chrome → 读主 profile Preferences 的真实下载目录;
// 连专用 Chrome → 该 profile 无自定义目录,落系统默认 ~/Downloads。
function autoDownloadDir(wsUrl) {
  try {
    const base = mainChromeUserData();
    const mainPort = parseInt((readFileSync(base + '/DevToolsActivePort', 'utf8').split(/\r?\n/)[0] || '').trim(), 10);
    const wsPort = parseInt((wsUrl.match(/^ws:\/\/[^:/]+:(\d+)\//) || [])[1], 10);
    if (mainPort && wsPort === mainPort) {
      const pref = JSON.parse(readFileSync(base + '/Default/Preferences', 'utf8'));
      const d = pref && pref.download && pref.download.default_directory;
      if (d && existsSync(d)) return d;
    }
  } catch { }
  return sysDownloadDir();
}

function closeTab(WS, TID) {
  execFileSync('node', ['-e', `const ws=new WebSocket(process.argv[1]);let i=0;ws.addEventListener('open',()=>{ws.send(JSON.stringify({id:++i,method:'Target.closeTarget',params:{targetId:process.argv[2]}}));setTimeout(()=>process.exit(0),500)});ws.addEventListener('error',()=>process.exit(0));`, WS, TID], { stdio: 'ignore', timeout: 6000 });
}

(async () => {
  try {
    await preflight();
    const WS = (val('--ws', '') || run([S('gemini-wsurl.mjs')])).trim(); WSV = WS;
    const DL = val('--downloadDir', '') || DOWNLOAD_DIR || autoDownloadDir(WS); // 与 gemini-download 同优先级:显式 > config > 自动判断
    log('WS ok, downloadDir=' + DL);
    const submit = (TID, useTool) => { const a = [S('gemini-select-type.mjs'), WS, TID, TYPE, PROMPT]; if (useTool) a.push('--use-tool'); return runCap(a); };
    const submitted = sub => sub.code === 0 || /(^|\n)SUBMITTED/.test(sub.out); // 输出含 SUBMITTED 即已发出——即便退出码异常也绝不再重提交
    const mkDl = tid => { const a = [S('gemini-download.mjs'), WS, tid, TYPE, OUT, '--downloadDir', DL]; if (DEWM) a.push('--dewatermark'); return a; };
    let predl = null; // 超时"最后一搏"若已落盘,存这里跳过下载段重跑

    // 模式序列:显式 --use-tool 只走工具;视频直发被连拒 2 次自动降级工具路径(实测直发视频偶发连拒、工具路径稳;拒绝=零产出,量额安全)
    const modes = flag('--use-tool') ? ['tool'] : (TYPE === 'video' ? ['direct', 'tool'] : ['direct']);
    let TID = '', ready = false, totalResubmits = 0, modeVal = '';
    for (let mi = 0; mi < modes.length && !ready; mi++) {
      const useTool = modes[mi] === 'tool';

      // ── 提交(select-type 失败 = 什么都没发出,重开 tab 再试 1 次是安全的)──
      for (let att = 1; att <= 2; att++) {
        TID = run([S('gemini-open.mjs'), WS]).trim(); TIDV = TID;
        log('tab ' + TID + ',提交 mode=' + modes[mi] + '(attempt ' + att + '/2)…');
        const sub = submit(TID, useTool);
        const mm = sub.out.match(/(^|\n)MODE (.+)/); if (mm && mm[2].trim() !== 'unknown') modeVal = mm[2].trim();
        if (submitted(sub)) break;
        log('提交失败 code=' + sub.code + '(未发出),重开 tab');
        try { closeTab(WS, TID); } catch { } TIDV = ''; TID = '';
        if (att === 2) throw Object.assign(new Error('两次提交失败(select-type,mode=' + modes[mi] + ')'), { stage: 'submit' });
      }

      // ── 等待(阶段感知:明确拒绝→同 tab 重发 1 次;超时仍在生成→延长 1 次;绝不盲目重提交)──
      let resubmits = 0, extended = 0, failBase = PROMPT_HITS, maxNow = MAXSEC;
      try {
        while (!ready) {
          const w = runCap([S('gemini-wait.mjs'), TID, TYPE, String(maxNow), WS, String(failBase)]);
          if (/(^|\n)READY/.test(w.out)) { ready = true; break; }
          if (w.code === 5) { // Gemini 明确拒绝(「无法生成」文案)= 未产出不烧额度,可安全重发
            const m = w.out.match(/GENFAIL fc=(\d+)/); failBase = (m ? parseInt(m[1], 10) : failBase + 1) + PROMPT_HITS; // 重发会再回显一次 prompt
            if (resubmits >= 1) throw Object.assign(new Error('Gemini 两次明确拒绝生成(内容政策或服务抖动)'), { stage: 'genfail' });
            resubmits++; totalResubmits++; log('Gemini 拒绝,同 tab 安全重发 1 次…');
            const sub = submit(TID, useTool); // 保持当前模式重发(select-type 有 ALREADY-CHECKED 短路,重复勾选无害)
            if (!submitted(sub)) throw Object.assign(new Error('重发失败(select-type code ' + sub.code + ')'), { stage: 'submit' });
            continue;
          }
          if (w.code !== 2) { // wait 自身异常(WSERR/崩溃):非"生成慢",按基础设施错误处理,正常关 tab
            throw Object.assign(new Error('wait 基础设施错误(code ' + w.code + '):' + (w.out.trim().split('\n').pop() || '').slice(0, 80)), { stage: 'wait-infra' });
          }
          const genOn = /TIMEOUT gen=true/.test(w.out);
          if (extended < 1) { extended++; maxNow = Math.min(MAXSEC, 180); log('超时(' + (genOn ? '仍在生成' : 'Pro 扩展思考期可无任何迹象,再等一轮') + '),延长 ' + maxNow + 's(不重提交)…'); continue; }
          // 最后一搏:Pro 思考期零迹象的产物常在超时后才悄然出现,先试一次下载再宣告失败(实测多次靠这救回)
          const lc = runCap(mkDl(TID));
          if (lc.code === 0) { log('最后一搏:产物已在页面,直接落盘'); predl = lc; ready = true; break; }
          keepTab = true; // 产物可能稍后仍出现在该对话(Gemini 历史也能找回),保留 tab
          throw Object.assign(new Error('等待超时' + (genOn ? '(仍在生成,额度可能已消耗;tab 已保留,稍后可在页面/Gemini 历史找回)' : '(无生成迹象——若是直发,检查提示词是否带明确「生成/制作」动词)') + ' tid=' + TID), { stage: 'wait' });
        }
      } catch (e) {
        if ((e && e.stage) === 'genfail' && mi < modes.length - 1) { // 直发被连拒且还有工具模式可退 → 新 tab 降级重来
          log('直发两拒,自动降级 --use-tool 重来(新 tab)…');
          try { closeTab(WS, TID); } catch { } TIDV = ''; TID = '';
          continue;
        }
        throw e;
      }
    }

    // ── 下载(失败 = 产物已在页面,重试下载而非重生;仍败保留 tab 供补捞)──
    log('ready(resubmits=' + totalResubmits + '),downloading…');
    let dl = predl || runCap(mkDl(TID));
    if (dl.code !== 0) { log('下载失败 code=' + dl.code + ',5s 后原 tab 重试(不重新生成)…'); await sleep(5000); dl = runCap(mkDl(TID)); }
    if (dl.code !== 0) {
      keepTab = true;
      throw Object.assign(new Error('下载两次未落盘(产物仍在页面,tab 已保留 tid=' + TID + '):' + (dl.out.trim().split('\n').pop() || '').slice(0, 80)), { stage: 'download' });
    }

    const sec = Math.round((Date.now() - t0) / 1000);
    const dj = dl.out.split('\n').find(l => l.startsWith('DONEJSON '));
    const legacy = dl.out.split('\n').find(l => l.startsWith('WROTE'));
    let res;
    if (dj) { const o = JSON.parse(dj.slice(9)); res = { ok: true, type: TYPE, file: o.file, dims: o.dims || null, mb: o.mb, dewm: !!o.dewm, resubmits: totalResubmits, seconds: sec }; }
    else if (legacy) { const m = legacy.match(/^WROTE\s+(.+?)\s+(\S*)\s+([\d.]+)MB/); res = m ? { ok: true, type: TYPE, file: m[1], dims: m[2] || null, mb: parseFloat(m[3]), resubmits: totalResubmits, seconds: sec } : { ok: false, type: TYPE, stage: 'download', raw: legacy.slice(0, 200), seconds: sec }; }
    else res = { ok: false, type: TYPE, stage: 'download', raw: dl.out.slice(-200), seconds: sec };
    if (res.ok && modeVal) res.mode = modeVal.replace(/^打开模式选择器[,，]?\s*当前模式为\s*/, '').replace(/[“”"]/g, ''); // 回执实际生成模式,质量可见
    if (!keepTab) { try { closeTab(WS, TID); } catch { } } else if (res.ok) res.tid = TID; // --keep 时回传 tid 便于续用
    TIDV = '';
    process.stdout.write(JSON.stringify(res));
    process.exit(res.ok ? 0 : 2);
  } catch (e) {
    if (TIDV && !keepTab) { try { closeTab(WSV, TIDV); } catch { } } // 失败也关 tab(除非留作补捞),杜绝孤儿
    const res = { ok: false, type: TYPE, stage: (e && e.stage) || 'run', error: String((e && e.message) || e).slice(0, 300), seconds: Math.round((Date.now() - t0) / 1000) };
    if (keepTab && TIDV) res.tid = TIDV;
    process.stdout.write(JSON.stringify(res));
    process.exit(3);
  }
})();
