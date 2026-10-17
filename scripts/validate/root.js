import fs from 'node:fs';
import path from 'node:path';
import { readTextOrFail } from './io.js';
import { evaluateParityTarget, createLowercaseParityLink } from './parity.js';

function reportAgentsLineBudget(agentsText, ctx) {
  const lines = agentsText.split('\n').length;
  if (lines <= 120) ctx.pass(`AGENTS.md line count is lean: ${lines} lines (<= 120).`);
  else if (lines <= 150) ctx.warn(`AGENTS.md line count is getting large: ${lines} lines (warn > 120).`);
  else ctx.fail(`AGENTS.md exceeds maximum line limit: ${lines} lines (max 150).`);
}

function checkAgentsFile(ctx, agentsFile) {
  if (!fs.existsSync(agentsFile)) {
    ctx.fail(`Missing root AGENTS.md at ${agentsFile}`);
    return null;
  }
  ctx.pass('AGENTS.md exists.');
  const agentsText = readTextOrFail(agentsFile, 'AGENTS.md', ctx.fail);
  if (agentsText === null) return null;
  // A 0-byte root contract passed the line budget (''.split('\n').length
  // is 1). Progressive disclosure with an empty root file discloses nothing.
  if (agentsText.trim().length === 0) {
    ctx.fail('AGENTS.md is empty; the root agent contract must define its operating rules.');
    return agentsText;
  }
  reportAgentsLineBudget(agentsText, ctx);
  return agentsText;
}

function readParityLink(filePath, stat) {
  if (stat.isSymbolicLink()) {
    try {
      return { isSymlink: true, linkTarget: fs.readlinkSync(filePath) };
    } catch (err) {
      // A symlink that lstat sees but readlink cannot resolve (dangling on
      // Windows, or a race) must be reported, never silently downgraded to a
      // regular file that might then "pass" as a valid pointer.
      return { readlinkError: err.message };
    }
  }
  if (stat.isFile()) {
    try {
      return { isFile: true, content: fs.readFileSync(filePath, 'utf-8') };
    } catch (err) {
      return { readError: err.message };
    }
  }
  return { neither: true };
}

function observeParityEntry(filePath, workspaceRoot) {
  let stat = null;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    return { missing: true };
  }
  let entries = [];
  try {
    entries = fs.readdirSync(workspaceRoot);
  } catch {
    // Verdict degrades to a plain fail.
  }
  return { ...readParityLink(filePath, stat), entries };
}

function applyParityVerdict(label, verdict, ctx) {
  if (verdict.kind === 'pass') ctx.pass(verdict.message);
  else if (verdict.kind === 'warn') ctx.warn(verdict.message);
  else ctx.fail(verdict.message);
}

function checkParity(filePath, target, ctx) {
  const observed = observeParityEntry(filePath, ctx.workspaceRoot);
  if (observed.missing) {
    ctx.fail(`${target.label} is missing.`);
    return;
  }
  if (observed.readlinkError) {
    ctx.fail(`${target.label} readlink failed: ${observed.readlinkError}`);
    return;
  }
  if (observed.readError) {
    ctx.fail(`${target.label} could not be read: ${observed.readError}`);
    return;
  }
  const verdict = evaluateParityTarget({
    label: target.label,
    allowCopyFallback: target.allowCopyFallback,
    agentsContent: ctx.agentsContent,
    agentsContentMissing: !ctx.agentsContent,
    agentsFile: ctx.agentsFile,
    entries: observed.entries,
    isSymlink: Boolean(observed.isSymlink),
    linkTarget: observed.linkTarget || null,
    isFile: Boolean(observed.isFile),
    content: observed.content || ''
  });
  applyParityVerdict(target.label, verdict, ctx);
}

function parityTarget(label) {
  return { label, allowCopyFallback: true };
}

function restoreLowercaseParity(lowerPath, ctx) {
  const outcome = createLowercaseParityLink(lowerPath, fs);
  if (outcome.created) {
    ctx.pass('Created agents.md parity link to AGENTS.md (case-sensitive filesystem).');
  } else {
    ctx.warn(`Could not restore agents.md parity: ${outcome.reason}`);
  }
  checkParity(lowerPath, parityTarget('agents.md'), ctx);
}

function checkLowercaseParity(ctx) {
  const lowerPath = path.join(ctx.workspaceRoot, 'agents.md');
  // An unreadable root degrades to an empty listing, which routes every file
  // through checkParity and reports each one individually.
  let rootEntries = [];
  try {
    rootEntries = fs.readdirSync(ctx.workspaceRoot);
  } catch {
    rootEntries = [];
  }
  if (rootEntries.includes('AGENTS.md') && !rootEntries.includes('agents.md')) {
    // No exact 'agents.md' in the listing. On a case-insensitive filesystem the
    // lower-cased path resolves to AGENTS.md itself, so the invariant already
    // holds and MUST NOT be "restored": writing here would overwrite the very
    // file it is trying to point at. Only repair on a genuinely
    // case-sensitive filesystem, where the two paths are distinct entries.
    if (fs.existsSync(lowerPath)) {
      ctx.pass('agents.md is satisfied natively by AGENTS.md (case-insensitive filesystem).');
    } else {
      restoreLowercaseParity(lowerPath, ctx);
    }
    return;
  }
  checkParity(lowerPath, parityTarget('agents.md'), ctx);
}

function checkHarnessParity(ctx) {
  const { workspaceRoot } = ctx;
  checkParity(path.join(workspaceRoot, 'CLAUDE.md'), parityTarget('CLAUDE.md'), ctx);
  checkLowercaseParity(ctx);
  checkParity(path.join(workspaceRoot, 'GEMINI.md'), parityTarget('GEMINI.md'), ctx);
  checkParity(path.join(workspaceRoot, '.cursorrules'), parityTarget('.cursorrules'), ctx);
  checkParity(path.join(workspaceRoot, '.windsurfrules'), parityTarget('.windsurfrules'), ctx);
}

function checkGithubParity(ctx) {
  const githubDir = path.join(ctx.workspaceRoot, '.github');
  if (!fs.existsSync(githubDir) || !fs.statSync(githubDir).isDirectory()) return;
  const copilot = path.join(githubDir, 'copilot-instructions.md');
  if (fs.existsSync(copilot)) {
    checkParity(copilot, parityTarget('.github/copilot-instructions.md'), ctx);
  } else {
    ctx.warn('.github/copilot-instructions.md is missing (run scaffold to restore harness parity).');
  }
  if (!fs.existsSync(path.join(githubDir, 'workflows'))) {
    ctx.warn('.github/workflows is missing (CI will not run in scaffolded projects).');
  }
}

function checkGitignore(ctx) {
  if (fs.existsSync(path.join(ctx.workspaceRoot, '.gitignore'))) ctx.pass('.gitignore exists.');
  else ctx.fail('Missing .gitignore');
}

function phaseRootConfig(ctx) {
  ctx.heading('1. Checking Root Configuration & Symlinks...');
  const agentsFile = path.join(ctx.workspaceRoot, 'AGENTS.md');
  const agentsText = checkAgentsFile(ctx, agentsFile);
  ctx.agentsFile = agentsFile;
  ctx.agentsContent = agentsText === null ? '' : agentsText;
  checkHarnessParity(ctx);
  checkGithubParity(ctx);
  checkGitignore(ctx);
}

export { phaseRootConfig, checkParity, checkAgentsFile };
export default { phaseRootConfig, checkParity, checkAgentsFile };
