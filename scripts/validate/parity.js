import fs from 'node:fs';

/**
 * Harness-parity verdicts, kept free of filesystem I/O.
 *
 * Callers pass in what lstat/readlink/readFile observed, because symlink
 * creation is unavailable on some hosts -- Windows without Developer Mode
 * returns EPERM -- so the symlink verdicts would otherwise be unreachable in
 * CI on the platform matrix that matters most.
 */

/**
 * The three target spellings a harness-parity file may legitimately use.
 * Pure so it can be unit-tested without touching the filesystem.
 */
export function isValidAgentsTarget(target, agentsFile) {
  const normalized = target.replace(/\\/g, '/');
  const rootNormalized = agentsFile.replace(/\\/g, '/');
  return normalized === 'AGENTS.md' || normalized === './AGENTS.md' || normalized === rootNormalized;
}

function symlinkVerdict(ctx) {
  const { label, linkTarget, agentsFile } = ctx;
  const normalized = linkTarget.replace(/\\/g, '/');
  const isCopilot = label.endsWith('copilot-instructions.md');
  const ok = isCopilot
    ? (normalized === '../AGENTS.md'
      || normalized === agentsFile.replace(/\\/g, '/')
      || normalized === 'AGENTS.md')
    : isValidAgentsTarget(linkTarget, agentsFile);
  if (ok) return { kind: 'pass', message: `${label} is a valid symlink to AGENTS.md.` };
  return { kind: 'fail', message: `${label} points to '${linkTarget}' instead of 'AGENTS.md'.` };
}

function textPointerVerdict(ctx) {
  const { label, agentsFile, content } = ctx;
  const trimmed = content.trim();
  if (trimmed === 'AGENTS.md' || trimmed === './AGENTS.md' || trimmed === agentsFile) {
    return { kind: 'pass', message: `${label} is a text pointer to AGENTS.md (symlink fallback).` };
  }
  const isCopilot = label.endsWith('copilot-instructions.md');
  if (isCopilot && content.includes('AGENTS.md')) {
    return { kind: 'pass', message: `${label} references AGENTS.md (symlink fallback).` };
  }
  return null;
}

function copyFallbackVerdict(ctx) {
  const { label, allowCopyFallback, agentsContent, agentsContentMissing, content } = ctx;
  if (allowCopyFallback && !agentsContentMissing && agentsContent && content === agentsContent) {
    return {
      kind: 'warn',
      message: `${label} is a byte-identical copy of AGENTS.md (Windows symlink fallback; drift risk).`
    };
  }
  return null;
}

function caseInsensitiveVerdict(ctx) {
  const { label, entries } = ctx;
  if (label === 'agents.md' && !entries.includes('agents.md') && entries.includes('AGENTS.md')) {
    return {
      kind: 'pass',
      message: 'agents.md is satisfied natively by AGENTS.md (case-insensitive filesystem).'
    };
  }
  return null;
}

function fileVerdict(ctx) {
  const pointer = textPointerVerdict(ctx);
  if (pointer !== null) return pointer;
  const copy = copyFallbackVerdict(ctx);
  if (copy !== null) return copy;
  const native = caseInsensitiveVerdict(ctx);
  if (native !== null) return native;
  return { kind: 'fail', message: `${ctx.label} is not a symbolic link.` };
}

/**
 * Decides whether a harness-parity entry is healthy, drifted, or outright wrong.
 */
export function evaluateParityTarget(ctx) {
  if (ctx.isSymlink) return symlinkVerdict(ctx);
  if (ctx.isFile) return fileVerdict(ctx);
  // Anything lstat saw that is neither a symlink nor a regular file (a
  // directory sitting in a parity slot, a socket, a device node).
  return { kind: 'fail', message: `${ctx.label} is neither a symlink nor a regular file.` };
}

/**
 * Creates the lowercase parity link, preferring a real symlink and falling back
 * to a text pointer. Never throws: an unrecoverable workspace is reported so
 * the caller can surface it.
 *
 * @returns {{created: boolean, strategy: 'symlink'|'pointer'|null, reason: string|null}}
 */
export function createLowercaseParityLink(lowerPath, fsImpl = fs) {
  try {
    fsImpl.symlinkSync('AGENTS.md', lowerPath);
    return { created: true, strategy: 'symlink', reason: null };
  } catch (symlinkErr) {
    // Symlinks unavailable (Windows without Developer Mode): a text pointer
    // preserves the invariant without duplicating content.
    try {
      fsImpl.writeFileSync(lowerPath, 'AGENTS.md\n', 'utf-8');
      return { created: true, strategy: 'pointer', reason: null };
    } catch (writeErr) {
      return {
        created: false,
        strategy: null,
        reason: `symlink failed (${symlinkErr.code || symlinkErr.message}); pointer write failed (${writeErr.code || writeErr.message})`
      };
    }
  }
}

export default {
  isValidAgentsTarget,
  evaluateParityTarget,
  createLowercaseParityLink
};
