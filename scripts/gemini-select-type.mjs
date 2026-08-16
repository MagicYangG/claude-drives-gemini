// 输入提示词并提交(2026-07-19 v2:默认纯提示词直发;locale 化选择器);--use-tool 时先勾创作工具。全程 GUID browser-ws。
// 用法: node gemini-select-type.mjs <wsUrl> <targetId> <video|music|image> "<prompt>" [--use-tool]
//   默认(直发):三模态实测均可由提示词自动路由(2026-07-18 真机),跳过 + 菜单 = 避开最脆弱的真鼠标勾选环节。
//   --use-tool:走 + 菜单勾选(需要视频宽高比 16:9/9:16 / 风格模板面板时用);勾选失败【直接退出、绝不提交】。
//   UI 文案匹配来自 locales/*.json 并集(见 config.mjs),多语言 UI 一套代码。
// 退出码: 0=已提交 1=失败且未提交(NOEDITOR/SELECT-FAIL/NOTEXT) 2=超时 3=异常 4=ws错误
// stdout 只留 MODE/最终状态行;过程诊断走 stderr。
import { labels, rx } from './config.mjs';
const args = process.argv.slice(2);
const [WSURL, TID, TOOL, PROMPT] = args;
const USETOOL = args.includes('--use-tool');
const L = labels();
const TOOLSRC = rx(TOOL === 'video' ? L.toolVideo : TOOL === 'music' ? L.toolMusic : L.toolImage).source;
const OPENSRC = rx(L.toolMenuButton).source;
const MODESRC = rx(L.modeButton).source;
const PROSRC = rx(L.modePro).source;
const THINKSRC = rx(L.modeThinking).source;
const note = m => process.stderr.write('[select] ' + m + '\n');
let submitted = false; // 一旦按下 Enter 即置位:之后任何异常/超时都不得再以非零码退出(防上游误判"未提交"而重复提交烧额度)
const ws = new WebSocket(WSURL);
let id = 0; const pending = new Map(); let sid = null;
const raw = (method, params, withSession) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify(withSession ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
const cmd = (m, p) => raw(m, p, true);
const evalp = (expr) => cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then(r => r.result && r.result.value);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bye = (line, code) => { console.log(line); try { ws.close(); } catch { } setTimeout(() => process.exit(code), 60); };
async function realClick(cx, cy) {
  await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
}
async function key(k, code, vk) {
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk });
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
}
const openMenuExpr = `(()=>{if(document.querySelector('[role=menu]'))return 'menu-open';const re=new RegExp(${JSON.stringify(OPENSRC)},'i');const b=[...document.querySelectorAll('button')].find(x=>re.test(x.getAttribute('aria-label')||''));if(b){b.click();return b.getAttribute('aria-label');}return null;})()`; // 已开的菜单不再点 +(避免 toggle 关闭空转)
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
});
ws.addEventListener('error', e => { if (submitted) { console.log('SUBMITTED ws-err'); process.exit(0); } console.log('WSERR', e.type || 'err'); process.exit(4); });
ws.addEventListener('open', async () => {
  try {
    const a = await raw('Target.attachToTarget', { targetId: TID, flatten: true }, false); sid = a.sessionId;
    await cmd('Runtime.enable', {}); await cmd('Page.enable', {}); await cmd('Page.bringToFront', {});
    // 等编辑器水合(新 tab / 同 tab 重发通用;最多 15s)
    let hasEditor = false;
    for (let i = 0; i < 30 && !hasEditor; i++) {
      hasEditor = await evalp(`!!(document.querySelector('div.ql-editor[contenteditable=true]')||document.querySelector('[contenteditable=true]'))`).catch(() => false);
      if (!hasEditor) await sleep(500);
    }
    if (!hasEditor) return bye('NOEDITOR', 1);

    // 模式确保(2026-07-19,质量优先):新 tab 偶为「Flash 扩展」→ 提交前确保 Pro(+扩展思考)。失败只告警不阻断生成。
    let modeLabel = '';
    try {
      const readMode = `(()=>{const re=new RegExp(${JSON.stringify(MODESRC)},'i');const b=[...document.querySelectorAll('button')].find(x=>re.test(x.getAttribute('aria-label')||''));return b?(b.getAttribute('aria-label')||''):'';})()`;
      const openMode = `(()=>{const re=new RegExp(${JSON.stringify(MODESRC)},'i');const b=[...document.querySelectorAll('button')].find(x=>re.test(x.getAttribute('aria-label')||''));if(b){b.click();return true;}return false;})()`;
      const findItem = src => `(()=>{const re=new RegExp(${JSON.stringify(src)},'i');const items=[...document.querySelectorAll('[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=option]')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&re.test(x.textContent||'');});const t=items[0];if(!t)return null;const r=t.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()`;
      const pick = async src => { await evalp(openMode); await sleep(700); const it = await evalp(findItem(src)); if (it) { await realClick(it.x, it.y); await sleep(900); return true; } await key('Escape', 'Escape', 27); await sleep(300); return false; };
      const proRe = new RegExp(PROSRC, 'i'), thinkRe = new RegExp(THINKSRC, 'i');
      for (let i = 0; i < 12 && !modeLabel; i++) { modeLabel = (await evalp(readMode)) || ''; if (!modeLabel) await sleep(500); } // 模式按钮晚于编辑器渲染,轮询等它出现
      if (modeLabel && !proRe.test(modeLabel)) { await pick(PROSRC); modeLabel = (await evalp(readMode)) || ''; }
      if (proRe.test(modeLabel) && !thinkRe.test(modeLabel)) { await pick(THINKSRC); modeLabel = (await evalp(readMode)) || ''; }
      if (await evalp(`!!document.querySelector('[role=menu]')`)) { await key('Escape', 'Escape', 27); await sleep(300); } // 不把菜单留开
      note('mode=' + (modeLabel || 'unknown'));
    } catch (e) { note('mode-ensure skipped: ' + e.message); }
    console.log('MODE ' + (modeLabel || 'unknown'));

    if (USETOOL) {
      const findExpr = `(()=>{const re=new RegExp(${JSON.stringify(TOOLSRC)},'i');const items=[...document.querySelectorAll('[role=menuitemcheckbox],[role=menuitem]')];const t=items.find(x=>re.test(x.textContent||''));if(!t)return null;const r=t.getBoundingClientRect();return {checked:t.getAttribute('aria-checked'),x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),vis:r.width>0};})()`;
      const recheckExpr = `(()=>{const re=new RegExp(${JSON.stringify(TOOLSRC)},'i');const items=[...document.querySelectorAll('[role=menuitemcheckbox],[role=menuitem]')];const t=items.find(x=>re.test(x.textContent||''));return t?t.getAttribute('aria-checked'):'gone';})()`;
      const verifyExpr = `(()=>{const re=new RegExp(${JSON.stringify(TOOLSRC)},'i');const items=[...document.querySelectorAll('[role=menuitemcheckbox]')];const t=items.find(x=>re.test(x.textContent||''));return t?t.getAttribute('aria-checked'):'noreopen';})()`;
      let selected = false;
      for (let att = 0; att < 5 && !selected; att++) {
        const opened = await evalp(openMenuExpr);
        await sleep(700);
        const info = await evalp(findExpr);
        if (!info || !info.vis) { note((info ? 'HIDDEN' : 'NOITEM') + ' att=' + att + ' opened=' + opened); await sleep(400); continue; } // 隐藏残留节点 rect=0,点下去是视口左上角
        if (info.checked === 'true') { selected = true; note('ALREADY-CHECKED'); break; }
        await realClick(info.x, info.y);
        await sleep(800);
        const recheck = await evalp(recheckExpr);
        note('att=' + att + ' recheck=' + recheck);
        if (recheck === 'true') { selected = true; }
        else if (recheck === 'gone') {
          // 'gone' 双义(点选成功→菜单自动关 vs 点丢了→菜单被关)→ 重开菜单二次校验 aria-checked
          await evalp(openMenuExpr); await sleep(700);
          const verify = await evalp(verifyExpr);
          note('gone-verify=' + verify);
          if (verify === 'true') selected = true;
          await key('Escape', 'Escape', 27); await sleep(300);
        }
      }
      if (!selected) return bye('SELECT-FAIL', 1); // 明知没勾上,绝不提交废对话
      await key('Escape', 'Escape', 27); await sleep(300);
    }

    await evalp(`(()=>{const e=document.querySelector('div.ql-editor[contenteditable=true]')||document.querySelector('[contenteditable=true]');if(e)e.focus();return !!e;})()`);
    await sleep(200);
    await cmd('Input.insertText', { text: PROMPT });
    await sleep(700);
    const len = await evalp(`(()=>{const e=document.querySelector('div.ql-editor[contenteditable=true]')||document.querySelector('[contenteditable=true]');return e?(e.innerText||'').trim().length:0;})()`);
    if (!len) return bye('NOTEXT', 1); // insertText 没落进编辑器,不按 Enter
    submitted = true;
    await key('Enter', 'Enter', 13);
    await sleep(400);
    return bye('SUBMITTED ' + (USETOOL ? 'tool' : 'direct'), 0);
  } catch (e) {
    if (submitted) { note('post-submit error(忽略): ' + e.message); return bye('SUBMITTED after-error', 0); }
    console.log('ERR', e.message); try { ws.close(); } catch { } process.exit(3);
  }
});
setTimeout(() => { console.log(submitted ? 'SUBMITTED late-timeout' : 'TIMEOUT'); process.exit(submitted ? 0 : 2); }, 60000);
