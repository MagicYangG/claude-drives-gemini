// [薄壳兜底] 功能已并入 gemini-download.mjs 的 image 模式(2026-07-19 消灭 90% 重复实现);本壳仅保持旧签名兼容。
// 用法(旧签名): node gemini-image-hires.mjs <wsUrl> <tid> <out> [--dewatermark] [--downloadDir DIR] [--profileDir DIR]
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [ws, tid, out, ...rest] = process.argv.slice(2);
if (!ws || !tid || !out) { console.log('用法: node gemini-image-hires.mjs <wsUrl> <tid> <out> [--dewatermark] [--downloadDir DIR] [--profileDir DIR]'); process.exit(1); }
try { execFileSync('node', [join(here, 'gemini-download.mjs'), ws, tid, 'image', out, ...rest], { stdio: 'inherit' }); }
catch (e) { process.exit(e.status == null ? 3 : e.status); }
