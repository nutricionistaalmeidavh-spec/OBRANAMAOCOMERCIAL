#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const utilidades = process.env.ARTISYS_UTILIDADES_PATH;
if (!utilidades) throw new Error('ARTISYS_UTILIDADES_PATH ausente.');

const artifacts = path.join(root, 'artifacts');
const logPath = path.join(artifacts, 'woodpecker-qa.log');
const exitPath = path.join(artifacts, 'qa-p2-exit.txt');
fs.mkdirSync(artifacts, { recursive: true });
fs.appendFileSync(logPath, '=== qa-p2 wrapper ===\n', 'utf8');

function append(text) {
  if (!text) return;
  process.stdout.write(text);
  fs.appendFileSync(logPath, text, 'utf8');
}

function invocation(command, args) {
  if (process.platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(command)) return { command, args };
  const comspec = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
  const quote = value => /[\s&()^|<>\"]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value);
  return { command: comspec, args: ['/d', '/s', '/c', [command, ...args].map(quote).join(' ')] };
}

function run(label, command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    append(`\n--- ${label} ---\n`);
    const resolved = invocation(command, args);
    const child = spawn(resolved.command, resolved.args, {
      cwd,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => append(String(chunk)));
    child.stderr.on('data', chunk => append(String(chunk)));
    child.on('error', reject);
    child.on('close', code => {
      const exitCode = Number.isInteger(code) ? code : 1;
      append(`\n${label} exit=${exitCode}\n`);
      if (exitCode === 0) resolve();
      else reject(Object.assign(new Error(`${label} falhou com exit ${exitCode}`), { exitCode }));
    });
  });
}

const worktree = path.join(os.tmpdir(), `artisys-qa-source-${process.pid}-${Date.now()}`);
let worktreeCreated = false;
let exitCode = 0;
try {
  await run('utilidades-fetch', 'git', ['-C', utilidades, 'fetch', 'origin', 'main']);
  await run('utilidades-worktree', 'git', ['-C', utilidades, 'worktree', 'add', '--detach', worktree, 'FETCH_HEAD']);
  worktreeCreated = true;
  const source = path.join(worktree, 'modules', 'artisys-qa');
  if (!fs.existsSync(path.join(source, 'package.json'))) throw new Error(`Runtime source ausente: ${source}`);
  await run('runtime-sync', process.execPath, ['scripts/sync-artisys-qa.mjs', '--source', source]);
  await run('runtime-install', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--prefix', 'qa/runtime', '--no-audit', '--no-fund']);
  await run('chromium-install', process.execPath, ['qa/runtime/node_modules/playwright/cli.js', 'install', 'chromium']);
  await run('qa-p2-release', process.execPath, ['scripts/qa-p2-release.mjs']);
} catch (error) {
  exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  append(`\nQA P2 wrapper error: ${error?.stack || error}\n`);
} finally {
  if (worktreeCreated) {
    try { await run('utilidades-worktree-cleanup', 'git', ['-C', utilidades, 'worktree', 'remove', '--force', worktree]); }
    catch (error) { append(`cleanup warning: ${error?.message || error}\n`); }
  }
  fs.writeFileSync(exitPath, `${exitCode}\n`, 'ascii');
}
process.exitCode = exitCode;
