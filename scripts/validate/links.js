import fs from 'node:fs';
import path from 'node:path';
import { readTextOrFail } from './io.js';
import { stripFencedCode } from './text.js';

function normalizeLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target) return null;
  // Link titles: [x](./a.md "Title") and 'Title' / (Title).
  target = target.replace(/\s+(?:"[^"]*"|'[^']*'|\([^)]*\))$/, '').trim();
  // Angle-bracket destinations: [x](<./a.md>)
  const angled = target.match(/^<([^>]*)>$/);
  if (angled) target = angled[1].trim();
  // Strip a query string; strip a fragment.
  const display = target.split('#')[0].split('?')[0];
  if (!display) return null;
  // Schemes, case-insensitively. Protocol-relative and Windows absolute
  // paths are external too.
  if (/^[a-z][a-z0-9+.-]*:/i.test(display)) return null;
  if (display.startsWith('//')) return null;
  // Percent-decode so ./exists%2emd resolves like a renderer would.
  try {
    return { target: decodeURIComponent(display), display };
  } catch {
    return { target: display, display };
  }
}

function recordLinkTarget(link, ctx) {
  const normalized = normalizeLinkTarget(link.rawTarget);
  if (normalized === null) return;
  ctx.linkCount += 1;
  const resolved = path.normalize(path.join(link.dir, normalized.target));
  if (!fs.existsSync(resolved)) {
    ctx.broken.push(`${path.relative(ctx.workspaceRoot, link.filePath)} -> ${normalized.display}`);
  }
}

function collectInlineLinks(job, ctx) {
  // Inline links: [text](target). Tolerates nested brackets in the link text,
  // which previously made `[click [here] now](./x)` unmatchable.
  const inline = /\[((?:[^\][]|\[[^\][]*\])*)\]\(([^)]*)\)/g;
  let m;
  while ((m = inline.exec(job.live)) !== null) {
    const display = m[2].trim() || '(empty target)';
    recordLinkTarget({ rawTarget: m[2], display, dir: job.dir, filePath: job.filePath }, ctx);
  }
}

function collectReferenceLinks(job, ctx) {
  // Reference-style definitions: [ref]: ./target
  const reference = /^\s{0,3}\[[^\]]+\]:\s*(\S+)/gm;
  let m;
  while ((m = reference.exec(job.live)) !== null) {
    recordLinkTarget({ rawTarget: m[1], display: m[1], dir: job.dir, filePath: job.filePath }, ctx);
  }
}

function collectHtmlAnchors(job, ctx) {
  // HTML anchors: <a href="./target">
  const html = /<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = html.exec(job.live)) !== null) {
    recordLinkTarget({ rawTarget: m[1], display: m[1], dir: job.dir, filePath: job.filePath }, ctx);
  }
}

function checkFile(filePath, ctx) {
  // An unreadable markdown file must be reported, not allowed to abort the
  // entire validation run: the remaining files still need checking.
  const content = readTextOrFail(filePath, `markdown file ${path.relative(ctx.workspaceRoot, filePath)}`, ctx.fail);
  if (content === null) return;
  const job = {
    live: stripFencedCode(content),
    dir: path.dirname(filePath),
    filePath
  };
  collectInlineLinks(job, ctx);
  collectReferenceLinks(job, ctx);
  collectHtmlAnchors(job, ctx);
}

function reportUnreadableDir(dir, err, ctx) {
  // A silently-skipped subtree yields "0 broken links" derived from zero
  // coverage, which is the worst outcome a checker can produce: a green
  // result that proves nothing. Report what could not be read instead.
  if (err instanceof RangeError) {
    // Stack exhaustion (needs a tree thousands of levels deep -- not
    // reproducible portably). Abort loudly rather than pretending clean.
    ctx.fail(`Directory traversal exhausted the stack at ${path.relative(ctx.workspaceRoot, dir) || '.'}; link validation is incomplete.`);
    return;
  }
  ctx.warn(`Skipped unreadable directory ${path.relative(ctx.workspaceRoot, dir) || '.'}: ${err.code || err.message}`);
}

function followSymlinkEntry(full, ctx) {
  let real = null;
  try {
    real = fs.realpathSync(full);
  } catch {
    real = null;
  }
  if (real === null) {
    ctx.warn(`Skipped dangling symlink ${path.relative(ctx.workspaceRoot, full)}`);
    return;
  }
  if (ctx.visitedRealPaths.has(real)) return;
  ctx.visitedRealPaths.add(real);
  let st = null;
  try {
    st = fs.statSync(full);
  } catch {
    st = null;
  }
  if (st && st.isDirectory()) walk(full, ctx);
  else if (full.endsWith('.md')) checkFile(full, ctx);
}

function visitEntry(entry, full, ctx) {
  if (entry.isDirectory()) {
    walk(full, ctx);
    return;
  }
  // Symlink following is unreachable on Windows without Developer Mode, so the
  // isSymbolicLink() arm is covered only on hosts that allow it.
  if (entry.isSymbolicLink()) {
    followSymlinkEntry(full, ctx);
    return;
  }
  if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) checkFile(full, ctx);
}

function walk(dir, ctx) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    reportUnreadableDir(dir, err, ctx);
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    visitEntry(entry, path.join(dir, entry.name), ctx);
  }
}

function seedVisitedPaths(ctx) {
  try {
    ctx.visitedRealPaths.add(fs.realpathSync(ctx.workspaceRoot));
  } catch {
    // Unresolvable root: the walk reports each missing file individually.
  }
}

function phaseLinks(ctx) {
  ctx.log('');
  ctx.heading('4. Checking Markdown Internal Links & Cross-References...');
  seedVisitedPaths(ctx);
  walk(ctx.workspaceRoot, ctx);
  if (ctx.broken.length === 0) ctx.pass(`Validated ${ctx.linkCount} internal links across workspace (0 broken links).`);
  else for (const b of ctx.broken) ctx.fail(`Broken markdown link: ${b}`);
}

export { phaseLinks, checkFile, normalizeLinkTarget };
export default { phaseLinks, checkFile, normalizeLinkTarget };
