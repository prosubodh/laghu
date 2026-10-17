import fs from 'node:fs';
import path from 'node:path';
import { readTextOrFail, walkMarkdown } from './io.js';
import { stripFencedCode } from './text.js';

export function checkOneRule(fp, name, ctx) {
  const content = readTextOrFail(fp, `Rule ${name}`, ctx.fail);
  if (content === null) return;
  const stat = fs.statSync(fp);
  // Strip fenced code so a documentation example cannot satisfy either
  // structural check.
  const structural = stripFencedCode(content);
  if (!/^# /m.test(structural)) ctx.fail(`Rule ${name} missing H1 header (# Title)`);
  if (!/^> \*\*Core Mandate:\*\*/m.test(structural)) ctx.warn(`Rule ${name} missing standardized '> **Core Mandate:**' summary`);
  if (stat.size > 24000) ctx.warn(`Rule ${name} exceeds 24KB token-economy cap (${stat.size} bytes)`);
}

export function phaseRules(ctx) {
  ctx.log('');
  ctx.heading('2. Checking Progressive Disclosure Rules...');
  const rulesDir = path.join(ctx.workspaceRoot, 'docs', 'rules');
  if (!fs.existsSync(rulesDir) || !fs.statSync(rulesDir).isDirectory()) {
    ctx.fail(`Missing docs/rules directory at ${rulesDir}`);
    return 0;
  }
  // Recurse, and match the extension case-insensitively. The previous flat
  // readdir missed docs/rules/sub/*.md and *.MD entirely, so the reported
  // count could be a lie and a 200KB rule could go unvalidated.
  const files = walkMarkdown(rulesDir, 'rule', ctx.fail);
  let count = 0;
  for (const fp of files) {
    count += 1;
    checkOneRule(fp, path.relative(rulesDir, fp), ctx);
  }
  // Progressive disclosure with zero rules defeats the purpose of the
  // directory, so an empty one is a failure, not a pass.
  if (count === 0) ctx.fail('docs/rules contains no .md rule files; progressive disclosure has nothing to disclose.');
  ctx.pass(`Validated ${count} modular rule files in docs/rules/.`);
  return count;
}

export default { phaseRules, checkOneRule };
