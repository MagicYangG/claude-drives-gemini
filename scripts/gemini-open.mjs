// 用 GUID browser-ws 开 Gemini 后台 tab(替代坏掉的 cdp-proxy /new),等编辑器水合后把 targetId 打到 stdout。
// 彻底脱离 proxy。用法: node gemini-open.mjs <wsUrl> [url=https://gemini.google.com/app] [maxSec=40]
// stdout 只输出 targetId;诊断信息一律走 stderr,确保 TID=$(node gemini-open.mjs "$WS") 干净。
const [WSURL, URL0, MAXSEC] = process.argv.slice(2);
const URL = URL0 || 'https://gemini.google.com/app';
const max = parseInt(MAXSEC || '40', 10);
const ws = new WebSocket(WSURL);
let id = 0; const pending = new Map(); let sid = null;
const raw = (method, params, withSession) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify(withSession ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
const cmd = (m, p) => raw(m, p, true);
const evalp = (expr) => cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then(r => r.result && r.result.value);
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
});
ws.addEventListener('error', () => { console.error('WSERR'); process.exit(4); });
ws.addEventListener('open', async () => {
  try {
    const t = await raw('Target.createTarget', { url: URL }, false);
    const tid = t.targetId;
    const a = await raw('Target.attachToTarget', { targetId: tid, flatten: true }, false); sid = a.sessionId;
    await cmd('Page.enable', {}); await cmd('Runtime.enable', {}); await cmd('Page.bringToFront', {}); // 后台 tab 必须激活,否则 Angular 不水合
    // 等 SPA 水合:轮询 ql-editor 出现
    const t0 = Date.now(); let ready = false;
    while ((Date.now() - t0) / 1000 < max) {
      await sleep(1000);
      const r = await evalp(`!!(document.querySelector('div.ql-editor[contenteditable=true]')||document.querySelector('[contenteditable=true]'))`).catch(() => false);
      if (r) { ready = true; break; }
    }
    process.stdout.write(tid); // 唯一 stdout 输出 = targetId
    if (!ready) console.error('WARN editor-not-ready-after-' + max + 's (tab 已开,后续步骤会重试水合)');
    await sleep(100);
    ws.close(); process.exit(0);
  } catch (e) { console.error('ERR ' + e.message); try { ws.close(); } catch (_) {} process.exit(3); }
});
setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, (max + 10) * 1000);
