#!/usr/bin/env node

/**
 * Cross-platform PreToolUse safety guard in pure Node.js.
 * Blocks high-severity destructive shell commands (rm -rf, force push, drop db).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const selfDir = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  process.env.AZCODR_GUARD_ENGINE,
  path.resolve(selfDir, '../lib/agent-guard-command.js'),
  path.resolve(selfDir, '../../lib/agent-guard-command.js')
].filter(Boolean);

async function getCommandModule() {
  const tried = [];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      tried.push(candidate);
      continue;
    }
    try {
      return await import(pathToFileURL(candidate).href);
    } catch (err) {
      tried.push(`${candidate} (${err.message})`);
    }
  }
  console.error(
    '🚨 Safety Guard misconfigured: command engine not found. Tried:\n' +
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

  const { inspectCommand } = await getCommandModule();
  const decision = inspectCommand(rawInput);

  if (decision.blocked) {
    console.error(`🚨 Safety Guard: ${decision.reason}`);
    console.error(`   command: ${decision.command || rawInput.slice(0, 300)}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`🚨 Safety Guard crashed: ${err?.message || err}`);
  process.exit(2);
});
