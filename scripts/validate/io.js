import fs from 'node:fs';
import path from 'node:path';

/**
 * Reporter seam. Tests inject a collector so assertions can read the exact
 * pass/warn/fail outcome instead of scraping stdout.
 */
export function createReporter(sink = console) {
  return {
    pass: (msg) => sink.log(`  ✅ ${msg}`),
    warn: (msg) => sink.log(`  ⚠️  ${msg}`),
    fail: (msg) => sink.log(`  ❌ ${msg}`),
    log: (msg) => sink.log(msg),
    heading: (msg) => sink.log(msg)
  };
}

/**
 * Reads a UTF-8 text file, reporting rather than throwing on failure.
 *
 * Unguarded readFileSync calls crashed the whole run on a directory named
 * `*.md`, an unreadable file, or a broken symlink, aborting every later phase
 * and emitting a stack trace instead of a verdict.
 */
export function readTextOrFail(filePath, label, fail) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) {
      fail(`${label} is not a regular file (${st.isDirectory() ? 'it is a directory' : 'special file'}).`);
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    fail(`Could not read ${label}: ${err.code || err.message}`);
    return null;
  }
}

/** Recursively collects markdown files under `root`. */
export function walkMarkdown(root, label, fail) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      fail(`Could not list ${label} directory ${dir}: ${err.code || err.message}`);
      continue;
    }
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

/** Lists skill directories, skipping symlinks that cannot be resolved. */
export function readSkillFolders(skillsDir, fail) {
  let entries = [];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (err) {
    fail(`Could not list skills directory: ${err.code || err.message}`);
    return [];
  }
  const folders = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    folders.push(entry.name);
  }
  return folders;
}

export default { createReporter, readTextOrFail, walkMarkdown, readSkillFolders };
