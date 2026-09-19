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
const failurePath = path.join(artifacts, 'qa-p2-failure.json');
fs.mkdirSync(artifacts, { recursive: true });
fs.rmSync(failurePath, { force: true });
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

function run(label, command, args, cwd = root, env = process.env) {
  return new Promise((resolve, reject) => {
    append(`\n--- ${label} ---\n`);
    const resolved = invocation(command, args);
    const child = spawn(resolved.command, resolved.args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => append(String(chunk)));
    child.stderr.on('data', chunk => append(String(chunk)));
    child.on('error', error => reject(Object.assign(error, { qaStage: label })));
    child.on('close', code => {
      const exitCode = Number.isInteger(code) ? code : 1;
      append(`\n${label} exit=${exitCode}\n`);
      if (exitCode === 0) resolve();
      else reject(Object.assign(new Error(`${label} falhou com exit ${exitCode}`), { exitCode, qaStage: label }));
    });
  });
}

async function runWithRetry(label, command, args, { attempts = 2, cwd = root, env = process.env } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (attempt > 1) append(`\n${label}: retry ${attempt}/${attempts}\n`);
      await run(label, command, args, cwd, env);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
  }
  throw lastError;
}

function createAskPass() {
  const token = String(process.env.GITHUB_REPORT_TOKEN || '').trim();
  if (!token) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artisys-git-askpass-'));
  const file = path.join(dir, process.platform === 'win32' ? 'askpass.cmd' : 'askpass.sh');
  if (process.platform === 'win32') {
    fs.writeFileSync(file, '@echo off\r\necho %~1 | findstr /I "Username" >nul\r\nif %errorlevel%==0 (echo x-access-token) else (echo %GITHUB_REPORT_TOKEN%)\r\n', 'utf8');
  } else {
    fs.writeFileSync(file, '#!/bin/sh\ncase "$1" in *Username*) printf "%s\\n" "x-access-token" ;; *) printf "%s\\n" "$GITHUB_REPORT_TOKEN" ;; esac\n', { encoding: 'utf8', mode: 0o700 });
  }
  return { dir, file };
}

const worktree = path.join(os.tmpdir(), `artisys-qa-source-${process.pid}-${Date.now()}`);
let worktreeCreated = false;
let askPass = null;
let exitCode = 0;
try {
  askPass = createAskPass();
  const gitEnv = askPass
    ? { ...process.env, GIT_ASKPASS: askPass.file, GIT_TERMINAL_PROMPT: '0' }
    : process.env;
  append(`Git auth mode: ${askPass ? 'GITHUB_REPORT_TOKEN' : 'runner credential manager'}\n`);
  await runWithRetry('utilidades-fetch', 'git', ['-C', utilidades, 'fetch', '--force', 'origin', 'main'], root, gitEnv);
  await run('utilidades-worktree', 'git', ['-C', utilidades, 'worktree', 'add', '--detach', worktree, 'FETCH_HEAD']);
  worktreeCreated = true;
  const source = path.join(worktree, 'modules', 'artisys-qa');
  const packagePath = path.join(source, 'package.json');
  const productReportPath = path.join(source, 'src', 'product-report.js');
  if (!fs.existsSync(packagePath)) throw Object.assign(new Error(`Runtime source ausente: ${source}`), { qaStage: 'runtime-validate' });
  const runtimePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  append(`Runtime source: @artisys/qa ${runtimePackage.version || 'unknown'}\n`);
  if (runtimePackage.version !== '2.6.0') throw Object.assign(new Error(`Runtime esperado 2.6.0, recebido ${runtimePackage.version || 'unknown'}.`), { qaStage: 'runtime-validate' });
  if (!fs.existsSync(productReportPath)) throw Object.assign(new Error(`Runtime 2.6 incompleto: ${productReportPath} ausente.`), { qaStage: 'runtime-validate' });
  await run('runtime-sync', process.execPath, ['scripts/sync-artisys-qa.mjs', '--source', source]);
  const runtimeInstallArgs = fs.existsSync(path.join(root, 'qa', 'runtime', 'package-lock.json'))
    ? ['ci', '--prefix', 'qa/runtime', '--no-audit', '--no-fund']
    : ['install', '--prefix', 'qa/runtime', '--no-audit', '--no-fund'];
  await runWithRetry('runtime-install', process.platform === 'win32' ? 'npm.cmd' : 'npm', runtimeInstallArgs, { attempts: 2 });
  await runWithRetry('chromium-install', process.execPath, ['qa/runtime/node_modules/playwright/cli.js', 'install', 'chromium'], { attempts: 2 });
  await run('qa-p2-release', process.execPath, ['scripts/qa-p2-release.mjs']);
} catch (error) {
  exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  const stage = error?.qaStage || 'qa-p2-wrapper';
  const message = error?.message || String(error);
  fs.writeFileSync(failurePath, `${JSON.stringify({ stage, exitCode, message }, null, 2)}\n`, 'utf8');
  append(`\nQA P2 wrapper error [${stage}]: ${error?.stack || error}\n`);
} finally {
  if (worktreeCreated) {
    try { await run('utilidades-worktree-cleanup', 'git', ['-C', utilidades, 'worktree', 'remove', '--force', worktree]); }
    catch (error) { append(`cleanup warning: ${error?.message || error}\n`); }
  }
  if (askPass) fs.rmSync(askPass.dir, { recursive: true, force: true });
  fs.writeFileSync(exitPath, `${exitCode}\n`, 'ascii');
}
process.exitCode = exitCode;
