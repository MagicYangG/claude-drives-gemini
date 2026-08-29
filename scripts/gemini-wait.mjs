// 轮询直到媒体就绪 / Gemini 明确拒绝(2026-07-19 v2:失败文案检测 + 超时带 gen 状态;文案来自 locales 并集)。
// 传输二选一(第4参):
//   GUID ws(推荐,脱离 proxy): node gemini-wait.mjs <tid> <video|music|image> [maxSec=300] <ws://127.0.0.1:9223/devtools/browser/GUID> [failBase=0]
//   proxy(向后兼容):          node gemini-wait.mjs <tid> <video|music|image> [maxSec=300] [http://localhost:3456] [failBase=0]
// failBase:忽略页面里前 N 条「无法生成」失败文案(同 tab 重发场景,传上一轮 GENFAIL 的 fc)。
// 退出码: 0=READY  2=超时(末行 `TIMEOUT gen=true|false`,gen=true 表示仍在生成勿重提交)
//         3=异常(含连续 eval 失败=tab 已死,末行 DEADTAB) 4=ws错误  5=Gemini 明确拒绝(末行 `GENFAIL fc=N`,可安全重发——未产出不烧额度)
import { labels, rx } from './config.mjs';
const [TID, TYPE, MAXSEC, TRANSPORT, FAILBASE] = process.argv.slice(2);
const max = parseInt(MAXSEC || '300', 10);
const failBase = parseInt(FAILBASE || '0', 10);
const L = labels();
const GENSRC = JSON.stringify(rx(L.generating).source);
const FAILSRC = JSON.stringify(rx(L.genFail).source);
const FCPART = "gen:new RegExp(" + GENSRC + ",'i').test(t),fc:(t.match(new RegExp(" + FAILSRC + ",'gi'))||[]).length";
const expr = TYPE === 'image'
  ? "(()=>{const i=[...document.querySelectorAll('img')].filter(x=>x.naturalWidth>=256)[0];const t=document.body.innerText;return JSON.stringify({ready:!!i,w:i?i.naturalWidth:0," + FCPART + "});})()"
  : "(()=>{const v=document.querySelector('video');const t=document.body.innerText;return JSON.stringify({ready:!!(v&&v.readyState>=1&&(v.src||v.currentSrc)),rs:v?v.readyState:0," + FCPART + "});})()";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const done = c => setTimeout(() => process.exit(c), 60); // 延迟退出,避开 Windows libuv/undici 关闭竞态
const useWs = (TRANSPORT || '').startsWith('ws://');
let lastGen = false;
const judge = s => { // 返回 'ready' | 'genfail:N' | null
  if (!s) return null;
  if (typeof s.gen === 'boolean') lastGen = s.gen;
  if (s.ready) return 'ready';
  if (typeof s.fc === 'number' && s.fc > failBase && !s.gen) return 'genfail:' + s.fc; // 仍显示"正在生成"时不判拒绝,防在途误重发烧双倍额度
  return null;
};

if (useWs) {
  // ── GUID browser-ws 轮询(脱离 proxy)──
  const ws = new WebSocket(TRANSPORT);
  let id = 0; const pending = new Map(); let sid = null;
  const raw = (method, params, withSession) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify(withSession ? { id: i, method, params, sessionId: sid } : { id: i, method, params })); });
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } });
  ws.addEventListener('error', () => { console.log('WSERR'); process.exit(4); });
  ws.addEventListener('open', async () => {
    try {
      const a = await raw('Target.attachToTarget', { targetId: TID, flatten: true }, false); sid = a.sessionId;
      await raw('Runtime.enable', {}, true);
      const t0 = Date.now(); let errStreak = 0;
      while ((Date.now() - t0) / 1000 < max) {
        let s; try { const r = await raw('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, true); s = JSON.parse(r.result.value); } catch (e) { s = { err: e.message }; }
        console.log(Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(s));
        if (s && s.err) { if (++errStreak >= 3) { console.log('DEADTAB ' + String(s.err).slice(0, 80)); try { ws.close(); } catch (_) {} return done(3); } } else errStreak = 0; // tab 死了快速失败,别空转到超时
        const j = judge(s);
        if (j === 'ready') { console.log('READY'); try { ws.close(); } catch (_) {} return done(0); }
        if (j && j.startsWith('genfail')) { console.log('GENFAIL fc=' + j.split(':')[1]); try { ws.close(); } catch (_) {} return done(5); }
        await sleep(8000);
      }
      console.log('TIMEOUT gen=' + lastGen); try { ws.close(); } catch (_) {} done(2);
    } catch (e) { console.log('ERR', e.message); process.exit(3); }
  });
} else {
  // ── proxy /eval 轮询(向后兼容)──
  const base = TRANSPORT || 'http://localhost:3456';
  (async () => {
    const t0 = Date.now(); let errStreak = 0;
    while ((Date.now() - t0) / 1000 < max) {
      let s; try { const r = await fetch(base + '/eval?target=' + TID, { method: 'POST', body: expr, signal: AbortSignal.timeout(10000) }); s = JSON.parse((await r.json()).value); } catch (e) { s = { err: e.message }; }
      console.log(Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(s));
      if (s && s.err) { if (++errStreak >= 3) { console.log('DEADTAB ' + String(s.err).slice(0, 80)); return done(3); } } else errStreak = 0;
      const j = judge(s);
      if (j === 'ready') { console.log('READY'); return done(0); }
      if (j && j.startsWith('genfail')) { console.log('GENFAIL fc=' + j.split(':')[1]); return done(5); }
      await sleep(8000);
    }
    console.log('TIMEOUT gen=' + lastGen); done(2);
  })();
}
setTimeout(() => { console.log('HARD-TIMEOUT gen=' + lastGen); process.exit(2); }, (max + 25) * 1000); // 全局硬看门狗(两分支通用)
