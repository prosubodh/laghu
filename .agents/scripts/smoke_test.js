#!/usr/bin/env node

/**
 * Cross-platform Boundary & Environment Smoke Test (Milestone 3).
 * Verifies boundaries and diagnoses port occupancy before dev launch.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function parseMonitoredPorts(argv) {
  const customIndex = argv.indexOf('--ports');
  if (customIndex !== -1 && argv[customIndex + 1]) {
    return argv[customIndex + 1].split(',').map((p) => parseInt(p.trim(), 10)).filter(Boolean);
  }
  return [5173, 3000, 4000, 8080];
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve({ port, available: false, error: err.code });
    });
    server.once('listening', () => {
      server.close(() => resolve({ port, available: true }));
    });
    server.listen(port, host);
  });
}

async function runPortDoctor(ports) {
  console.log('🩺 Port doctor inspecting local dev ports...');
  const results = await Promise.all(ports.map((p) => checkPort(p)));
  for (const r of results) {
    if (!r.available) {
      console.log(`⚠️  Port ${r.port} is occupied (${r.error}). Check for background services to prevent collisions.`);
    } else {
      console.log(`✅ Port ${r.port} is free.`);
    }
  }
}

function runBoundaryGuard(targetDir) {
  const guardPath = path.resolve(process.cwd(), '.agents', 'scripts', 'boundary_guard.js');
  if (!fs.existsSync(guardPath)) {
    console.log('ℹ️  Boundary guard script not found, skipping static graph check.');
    return true;
  }
  console.log('🔍 Boundary smoke verification running on: ' + targetDir);
  const res = spawnSync('node', [guardPath, targetDir], { stdio: 'inherit', shell: true });
  return res.status === 0;
}

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const targetDir = path.resolve(positional[0] || process.cwd());
  const ports = parseMonitoredPorts(process.argv);

  console.log('🚀 Running Full-Stack Smoke Verification...');
  const boundaryPassed = runBoundaryGuard(targetDir);
  await runPortDoctor(ports);

  if (!boundaryPassed) {
    console.error('🚨 Boundary verification failed!');
    process.exit(1);
  }

  console.log('✅ Smoke verification passed cleanly!');
  process.exit(0);
}

main().catch((err) => {
  console.error(`🚨 Smoke verification crashed: ${err?.message || err}`);
  process.exit(2);
});
