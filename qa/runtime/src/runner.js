import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, _electron as electron } from 'playwright';
import { attachPageTelemetry } from './telemetry.js';
import { executeStep } from './steps.js';
import { createFrameRecorder } from './video.js';
import { startConsumerProcess } from './process.js';
import { ensureDir, sanitizeName, writeJson } from './helpers.js';

async function loadFlow(file) {
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) throw new TypeError(`Flow must contain steps: ${file}`);
  return parsed;
}

function runId({ systemId, flowName, viewportName }) {
  return `${sanitizeName(systemId)}-${sanitizeName(flowName)}-${sanitizeName(viewportName || 'viewport')}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

export async function runQaFlow({ manifest, rootDir, environmentName, environment, flowName, flowFile, viewport, outputRoot = 'qa-artifacts' }) {
  const id = runId({ systemId: manifest.systemId, flowName, viewportName: viewport.name });
  const outputDir = path.resolve(outputRoot, id);
  const screenshotsDir = await ensureDir(path.join(outputDir, 'screenshots'));
  const traceFile = path.join(outputDir, 'trace.zip');
  const telemetry = [];
  const stepsLog = [];
  const startedAt = new Date().toISOString();
  const flow = await loadFlow(flowFile);
  let status = 'passed';
  let failure = null;
  let browser;
  let context;
  let page;
  let electronApp;
  let frameRecorder;
  let nativeVideo;
  let consumerProcess;
  let videoFile = null;

  try {
    if (environment.startCommand) {
      consumerProcess = await startConsumerProcess({
        command: environment.startCommand,
        cwd: rootDir,
        env: environment.env,
        readyUrl: environment.readyUrl,
        timeoutMs: environment.readyTimeoutMs || 30000,
      });
    }

    if (manifest.mode === 'electron') {
      const entry = path.resolve(rootDir, manifest.electron.entry);
      const executablePath = manifest.electron.executablePath ? path.resolve(rootDir, manifest.electron.executablePath) : undefined;
      electronApp = await electron.launch({
        args: [entry, ...(manifest.electron.args || [])],
        executablePath,
        cwd: rootDir,
        env: { ...process.env, ...(manifest.electron.env || {}), ...(environment.env || {}) },
        timeout: manifest.launchTimeoutMs || 30000,
      });
      context = electronApp.context();
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      page = await electronApp.firstWindow();
      await page.setViewportSize({ width: viewport.width, height: viewport.height }).catch(() => {});
      if (manifest.capture?.video !== false) {
        frameRecorder = createFrameRecorder(page, { dir: path.join(outputDir, '.video-frames'), fps: manifest.capture?.fps || 4 });
        await frameRecorder.start();
      }
    } else {
      browser = await chromium.launch({ headless: manifest.headless ?? true });
      context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        recordVideo: manifest.capture?.video === false ? undefined : { dir: path.join(outputDir, '.native-video'), size: { width: viewport.width, height: viewport.height } },
        storageState: environment.storageState ? path.resolve(rootDir, environment.storageState) : undefined,
      });
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      page = await context.newPage();
      nativeVideo = page.video?.() || null;
    }

    attachPageTelemetry(page, telemetry);
    if (environment.baseURL && manifest.mode === 'web' && flow.autoGoto !== false) {
      await page.goto(environment.baseURL, { waitUntil: flow.waitUntil || 'domcontentloaded' });
    }

    for (let index = 0; index < flow.steps.length; index++) {
      const step = flow.steps[index];
      const stepStart = Date.now();
      try {
        const label = await executeStep({ page, step, index, screenshotsDir, baseURL: environment.baseURL, env: process.env });
        if (manifest.capture?.screenshotEachStep) {
          await page.screenshot({ path: path.join(screenshotsDir, `${label}-after.png`), fullPage: false });
        }
        stepsLog.push({ index, action: step.action, name: step.name || null, status: 'passed', durationMs: Date.now() - stepStart });
      } catch (error) {
        stepsLog.push({ index, action: step.action, name: step.name || null, status: 'failed', durationMs: Date.now() - stepStart, error: error.message });
        throw error;
      }
    }
  } catch (error) {
    status = 'failed';
    failure = { message: error.message, stack: error.stack };
    if (page) await page.screenshot({ path: path.join(screenshotsDir, 'failure.png'), fullPage: false }).catch(() => {});
  } finally {
    if (context) await context.tracing.stop({ path: traceFile }).catch(() => {});
    if (frameRecorder) videoFile = await frameRecorder.stop(path.join(outputDir, 'video.mp4'));
    if (electronApp) await electronApp.close().catch(() => {});
    if (manifest.mode === 'web' && context) await context.close().catch(() => {});
    if (nativeVideo) {
      try {
        videoFile = path.join(outputDir, 'video.webm');
        await nativeVideo.saveAs(videoFile);
      } catch {
        videoFile = null;
      }
    }
    if (browser) await browser.close().catch(() => {});
    if (consumerProcess) {
      await fs.writeFile(path.join(outputDir, 'process.log'), consumerProcess.logs.join(''), 'utf8').catch(() => {});
      await consumerProcess.stop().catch(() => {});
    }
    await fs.rm(path.join(outputDir, '.native-video'), { recursive: true, force: true }).catch(() => {});
  }

  const summary = {
    schemaVersion: 1,
    runId: id,
    systemId: manifest.systemId,
    mode: manifest.mode,
    environment: environmentName,
    flow: flowName,
    viewport: { width: viewport.width, height: viewport.height, name: viewport.name || null },
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    video: videoFile ? path.relative(outputDir, videoFile) : null,
    trace: 'trace.zip',
    screenshots: 'screenshots',
    telemetryCount: telemetry.length,
    steps: stepsLog,
    failure,
  };
  await writeJson(path.join(outputDir, 'telemetry.json'), telemetry);
  await writeJson(path.join(outputDir, 'run-summary.json'), summary);
  if (status !== 'passed') {
    const error = new Error(`QA flow failed: ${manifest.systemId}/${flowName}`);
    error.summary = summary;
    throw error;
  }
  return { outputDir, summary };
}
