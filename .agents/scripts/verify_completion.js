#!/usr/bin/env node

/**
 * Cross-platform Stop hook in pure Node.js.
 * Blocks premature agent exit when verification gates (validate, coverage, test, lint) fail.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function loadPackageJson() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

function runNpmScript(name, label) {
  console.error(label);
  const result = spawnSync('npm', ['run', name, '--silent'], {
    stdio: 'inherit',
    shell: true
  });
  return result.status === 0;
}

function verifyCoverageGate() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  const eligible = (major > 22 || (major === 22 && minor >= 8));
  if (!eligible) {
    console.error(`⚠️  Skipping coverage gate: needs Node >= 22.8 (current: ${process.version})`);
    return true;
  }
  return runNpmScript('test:coverage', '📈 Running coverage gate...');
}

function main() {
  const pkg = loadPackageJson();
  if (!pkg || !pkg.scripts) {
    console.error('⚠️  Stop Verifier: no verifiable package.json found -- nothing checked.');
    process.exit(0);
  }

  const scripts = pkg.scripts;
  let ranAny = false;
  let failed = false;

  if (typeof scripts.validate === 'string') {
    ranAny = true;
    if (!runNpmScript('validate', '🔍 Running architecture validation...')) failed = true;
  }
  if (typeof scripts['test:coverage'] === 'string') {
    ranAny = true;
    if (!verifyCoverageGate()) failed = true;
  }
  if (typeof scripts.test === 'string') {
    ranAny = true;
    if (!runNpmScript('test', '🧪 Running test suite...')) failed = true;
  }
  if (typeof scripts.lint === 'string') {
    ranAny = true;
    if (!runNpmScript('lint', '🔎 Running lint...')) failed = true;
  }

  if (!ranAny) {
    console.error('⚠️  Stop Verifier: no verifiable scripts found in package.json.');
  }

  process.exit(failed ? 1 : 0);
}

main();
