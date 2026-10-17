#!/usr/bin/env node

/**
 * Cross-platform architectural boundary & cycle guard.
 *
 * Ships inside scaffolded projects so structural drift (circular imports and
 * Clean/Hexagonal layer breaches) is machine-checked with zero third-party
 * dependencies. The engine is vendored under `.agents/lib/` and byte-locked to
 * `lib/boundaries.js`; this wrapper only resolves it and reports the verdict.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const selfDir = path.dirname(fileURLToPath(import.meta.url));

// Resolution order (first existing file wins):
//   1. AZCODR_BOUNDARY_ENGINE override (tests, embedders).
//   2. ../lib/boundaries.js — vendored engine inside `.agents/`
//      (present in scaffolded projects; `.agents` is copied recursively).
//   3. ../../lib/boundaries.js — azcodr repo dev layout (fallback only).
const engineCandidates = [
  process.env.AZCODR_BOUNDARY_ENGINE,
  path.resolve(selfDir, '../lib/boundaries.js'),
  path.resolve(selfDir, '../../lib/boundaries.js')
].filter(Boolean);

async function getEngine() {
  const tried = [];
  for (const candidate of engineCandidates) {
    if (!fs.existsSync(candidate)) {
      tried.push(candidate);
      continue;
    }
    try {
      return await import(pathToFileURL(candidate).href);
    } catch (err) {
      tried.push(`${candidate} (unreadable: ${err.message})`);
    }
  }
  // Fail CLOSED: a guard with no engine is a broken install, never a silent pass.
  console.error(
    '🚨 Boundary Guard misconfigured: engine module not found, refusing to fail open. Tried:\n' +
    tried.map((t) => `  - ${t}`).join('\n')
  );
  process.exit(2);
}

function resolveTarget(positional) {
  const explicit = positional[0];
  if (explicit) return path.resolve(explicit);
  const srcDir = path.resolve(process.cwd(), 'src');
  return fs.existsSync(srcDir) ? srcDir : process.cwd();
}

function rel(p) {
  return path.relative(process.cwd(), p) || '.';
}

function printReport(report) {
  console.log('🔍 Inspecting Architectural Boundaries in: ' + rel(report.targetDir));
  console.log('--------------------------------------------------------------');
  if (report.ok) {
    console.log(`✅ No cycles or boundary violations across ${report.moduleCount} module(s).`);
    return;
  }
  for (const cycle of report.cycles) {
    console.error('   - Circular Dependency: ' + cycle.map(rel).join(' -> '));
  }
  for (const v of report.violations) {
    console.error(`   - Layer Boundary Breach: ${rel(v.file)} imports ${rel(v.importedFile)} (${v.fromLayer} -> ${v.toLayer})`);
  }
}

function emit(report, silent) {
  if (!silent) printReport(report);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--silent');
  const silent = process.argv.includes('--silent');
  const { inspectBoundaries } = await getEngine();
  const target = resolveTarget(args);
  const report = inspectBoundaries(target);
  emit({ ...report, targetDir: target }, silent);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`🚨 Boundary Guard crashed: ${err?.message || err}`);
  process.exit(2);
});
