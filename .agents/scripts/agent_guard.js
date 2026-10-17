#!/usr/bin/env node

/**
 * Cross-platform PreToolUse safety & architectural enforcement hook.
 *
 * Enforces:
 *  1. Command safety (blocks destructive rm, force-push, drop db, etc.)
 *  2. Refactor-Before-Add (blocks adding lines to files over line budget)
 *  3. Test-First / RED-before-GREEN (when enabled)
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const selfDir = path.dirname(fileURLToPath(import.meta.url));

// Resolution order (first existing file wins):
//   1. AZCODR_GUARD_ENGINE override (tests, embedders).
//   2. ../lib/agent-guard.js — vendored engine shipped inside `.agents/`
//      (present in scaffolded projects; `.agents` is copied recursively).
//   3. ../../lib/agent-guard.js — azcodr repo dev layout (fallback only).
const guardCandidates = [
  process.env.AZCODR_GUARD_ENGINE,
  path.resolve(selfDir, '../lib/agent-guard.js'),
  path.resolve(selfDir, '../../lib/agent-guard.js')
].filter(Boolean);

async function getGuardModule() {
  const tried = [];
  for (const candidate of guardCandidates) {
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
  // Fail CLOSED: a guard with no engine must be loud, never a silent allow.
  // (Unparseable tool payloads still fail open inside inspectPreTool per
  // ADR-005; a missing engine is a broken install, not an ambiguous input.)
  console.error(
    '🚨 Architectural Guard misconfigured: engine module not found, refusing to fail open. Tried:\n' +
    tried.map((t) => `  - ${t}`).join('\n')
  );
  process.exit(2);
}

async function readStdin(timeoutMs = 1500) {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let acc = '';
    const timer = setTimeout(() => resolve(acc), timeoutMs);
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { acc += chunk; });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(acc);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(acc);
    });
  });
}

async function main() {
  const argvInput = process.argv.slice(2).join(' ').trim();
  const stdinInput = (await readStdin()).trim();
  const rawInput = argvInput || stdinInput;

  if (!rawInput) {
    process.exit(0);
  }

  const { inspectPreTool } = await getGuardModule();
  const decision = inspectPreTool(rawInput, {
    workspaceRoot: process.cwd()
  });

  if (!decision.allowed) {
    console.error(`🚨 Architectural Guard: ${decision.reason}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`🚨 Architectural Guard crashed: ${err?.message || err}`);
  process.exit(2);
});
