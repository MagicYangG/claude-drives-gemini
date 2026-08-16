// 跨平台完成通知:win→PowerShell 气泡(notify.ps1),mac→osascript,linux→notify-send;全部失败静默(通知不值得让流水线崩)。
// 用法: node notify.mjs "标题" "正文"
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [title = 'claude-drives-gemini', body = ''] = process.argv.slice(2);
try {
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'notify.ps1'), title, body], { stdio: 'ignore' });
  else if (process.platform === 'darwin') execFileSync('osascript', ['-e', 'display notification ' + JSON.stringify(body) + ' with title ' + JSON.stringify(title)], { stdio: 'ignore' });
  else execFileSync('notify-send', [title, body], { stdio: 'ignore' });
} catch { }
