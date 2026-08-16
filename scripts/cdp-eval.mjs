// Evaluate a JS expression inside a tab over the browser-level CDP ws (clean UTF-8 — no proxy latin1 mojibake).
// Good for clicking buttons by Chinese aria-label and reading menus. Prints the returned value as JSON/string.
// Usage: node cdp-eval.mjs <targetId> "<jsExpression>" [wsUrl]
// wsUrl 省略时自动走 /json/version 取真 GUID(裸 /devtools/browser 不路由→卡 CONNECTING,故必须带 GUID)。
import { PORT } from './config.mjs';
const [, , TID, EXPR, WSARG] = process.argv;
async function wsUrl() {
  if (WSARG && WSARG.startsWith('ws://')) return WSARG;
  try {
    const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    if (j && j.webSocketDebuggerUrl) { const m = j.webSocketDebuggerUrl.match(/\/devtools\/browser\/[\w-]+$/); return m ? 'ws://127.0.0.1:' + PORT + m[0] : j.webSocketDebuggerUrl; }
  } catch (e) {}
  return 'ws://127.0.0.1:' + PORT + '/devtools/browser'; // 兜底(可能连不上,仅向后兼容)
}
const ws = new WebSocket(await wsUrl());
const wd = setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 30000); wd.unref(); // 看门狗:CDP 无响应不再永久挂起(unref 不阻正常退出)
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg));
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('ws open failed'))); });
try {
  const { sessionId } = await send('Target.attachToTarget', { targetId: TID, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  const r = await send('Runtime.evaluate', { expression: EXPR, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) { console.log('EXC ' + JSON.stringify((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)); process.exitCode = 1; }
  else console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value));
} catch (e) { console.log('ERR ' + e.message); process.exitCode = 3; } finally { clearTimeout(wd); ws.close(); }
