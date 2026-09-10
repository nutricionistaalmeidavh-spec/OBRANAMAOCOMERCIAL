#!/usr/bin/env node
import path from 'node:path';
import { loadQaManifest, resolveEnvironment, resolveFlow, resolveViewport, resolveDemo } from './manifest.js';
import { runQaFlow } from './runner.js';
import { runDemoFlow } from './demo.js';

function parseArgs(argv) {
  const [command = 'run', ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
    args[key] = value;
  }
  return args;
}

function usage() {
  console.log(`ArtiSys QA\n\nCommands:\n  validate --config qa/artisys-qa.config.json\n  list --config qa/artisys-qa.config.json\n  run --config qa/artisys-qa.config.json [--flow name] [--environment name] [--viewport desktop|tablet|mobile] [--output qa-artifacts]\n  demo --config qa/artisys-qa.config.json [--demo quick-30s] [--preset reels-9x16] [--environment name] [--output qa-artifacts]`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.command === 'help') {
  usage();
  process.exit(0);
}

if (!args.config) {
  console.error('Missing --config');
  usage();
  process.exit(2);
}

try {
  const { manifest, rootDir } = await loadQaManifest(args.config);
  if (args.command === 'validate') {
    console.log(`valid ${manifest.systemId} (${manifest.mode})`);
  } else if (args.command === 'list') {
    console.log(JSON.stringify({
      systemId: manifest.systemId,
      mode: manifest.mode,
      environments: Object.keys(manifest.environments),
      flows: Object.keys(manifest.flows || {}),
      demos: Object.keys(manifest.demos || {}),
      viewports: ['desktop', 'tablet', 'mobile'],
      demoPresets: ['landscape-16x9', 'square-1x1', 'reels-9x16'],
    }, null, 2));
  } else if (args.command === 'run') {
    const { name: environmentName, environment } = resolveEnvironment(manifest, args.environment);
    const { name: flowName, file: flowFile } = resolveFlow(manifest, args.flow, rootDir);
    const viewport = resolveViewport(manifest, args.viewport);
    const result = await runQaFlow({
      manifest,
      rootDir,
      environmentName,
      environment,
      flowName,
      flowFile,
      viewport,
      outputRoot: args.output ? path.resolve(args.output) : path.resolve('qa-artifacts'),
    });
    console.log(JSON.stringify(result.summary, null, 2));
    console.log(`ARTISYS_QA_OUTPUT=${result.outputDir}`);
  } else if (args.command === 'demo') {
    const { name: environmentName, environment } = resolveEnvironment(manifest, args.environment);
    const demo = resolveDemo(manifest, args.demo, rootDir);
    const result = await runDemoFlow({
      manifest,
      rootDir,
      environmentName,
      environment,
      demoName: demo.name,
      demoFile: demo.file,
      presetName: args.preset || demo.preset,
      durationTargetSec: demo.durationTargetSec,
      captureViewport: demo.captureViewport,
      outputRoot: args.output ? path.resolve(args.output) : path.resolve('qa-artifacts'),
    });
    console.log(JSON.stringify(result.summary, null, 2));
    console.log(`ARTISYS_QA_OUTPUT=${result.outputDir}`);
  } else {
    throw new Error(`Unknown command: ${args.command}`);
  }
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
}
