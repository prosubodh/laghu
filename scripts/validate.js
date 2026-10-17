#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createReporter, readTextOrFail, walkMarkdown } from './validate/io.js';
import * as textHelpers from './validate/text.js';
import * as parityHelpers from './validate/parity.js';
import { parseAdrLedger, checkAdrIndexConsistency, checkGlossaryPopulated } from './validate/adr.js';
import { phaseRootConfig } from './validate/root.js';
import { phaseRules } from './validate/rules.js';
import { phaseSkills } from './validate/skills.js';
import { phaseLinks } from './validate/links.js';
import { phaseToolchain, readProfileLanguage, expectedToolchainFiles, TOOLCHAIN_FILES } from './validate/toolchain.js';

/**
 * NOTE: this module is a library. It never self-executes, so importing it from
 * a test or another tool cannot trigger validation or call process.exit().
 * The CLI entry point lives in `scripts/validate-cli.js`.
 */

function parseArgs(argv) {
  let root = '';
  for (const arg of argv) {
    if (arg === '--fix') continue;
    if (!root) root = arg;
  }
  return root || process.cwd();
}

function reportMemoryLedger(mem, ctx) {
  const { entryIds } = parseAdrLedger(mem);
  if (!/^# /m.test(mem)) ctx.fail('memory.md missing H1 header');
  // Uses the same parser as phase 6. The previous unanchored
  // `/#### ADR-/` disagreed with phase 6's anchored form, so the validator
  // contradicted itself within a single run.
  else if (entryIds.length > 0) ctx.pass('memory.md contains ADR entries with valid envelope.');
  else ctx.pass('memory.md is a clean slate (no ADRs yet; record ADR-001 during /lets-build).');
  // Template ADRs start well past ADR-024. Match any ID >= 25 regardless of
  // zero padding.
  const highestAdr = Math.max(0, ...entryIds);
  if (highestAdr >= 25 && /azcodr/i.test(mem)) {
    ctx.warn('memory.md may contain template-internal ADRs; fresh projects must start at ADR-001.');
  }
}

function phaseMemory(ctx) {
  ctx.log('');
  ctx.heading('5. Checking Memory & ADR Ledger...');
  const memoryFile = path.join(ctx.workspaceRoot, 'memory.md');
  if (!fs.existsSync(memoryFile)) {
    ctx.fail('Missing memory.md ADR ledger.');
    return;
  }
  // readTextOrFail already reported any read failure; skip the analysis.
  const mem = readTextOrFail(memoryFile, 'memory.md', ctx.fail);
  if (mem !== null) reportMemoryLedger(mem, ctx);
}

function phaseLedger(ctx) {
  ctx.log('');
  ctx.heading('6. Checking ADR Index Consistency...');
  const consistency = checkAdrIndexConsistency(ctx.workspaceRoot, ctx.fail, ctx.pass);
  if (consistency === 'indexed' || consistency === 'inconsistent') {
    checkGlossaryPopulated(ctx.workspaceRoot, { fail: ctx.fail, pass: ctx.pass, warn: ctx.warn });
  }
}

function buildValidationContext(workspaceRoot, reporter, counts) {
  return {
    workspaceRoot,
    agentsFile: '',
    agentsContent: '',
    pass: reporter.pass,
    warn: (msg) => { counts.warnings += 1; reporter.warn(msg); },
    fail: (msg) => { counts.errors += 1; reporter.fail(msg); },
    log: reporter.log,
    heading: reporter.heading,
    broken: [],
    linkCount: 0,
    visitedRealPaths: new Set()
  };
}

function reportSummary(counts, reporter) {
  reporter.log('');
  reporter.log('--------------------------------------------------------------');
  if (counts.errors === 0) {
    reporter.log(`🎉 SUCCESS: All agentic configurations are valid and healthy! (${counts.warnings} warnings)`);
  } else {
    reporter.log(`🚨 FAILURE: Found ${counts.errors} error(s) and ${counts.warnings} warning(s) in agentic configurations.`);
  }
}

function runValidation(workspaceRoot, reporter = createReporter()) {
  // Counters live here, not on the reporter: an injected reporter only needs
  // pass/warn/fail to observe outcomes, and the tally must not depend on the
  // reporter's shape.
  const counts = { errors: 0, warnings: 0 };
  const ctx = buildValidationContext(workspaceRoot, reporter, counts);
  reporter.heading(`🔍 Validating Agentic Architecture in: ${workspaceRoot}`);
  reporter.log('--------------------------------------------------------------');
  phaseRootConfig(ctx);
  const validatedRules = phaseRules(ctx);
  const validatedSkills = phaseSkills(ctx);
  phaseLinks(ctx);
  phaseMemory(ctx);
  phaseLedger(ctx);
  phaseToolchain(ctx);
  reportSummary(counts, reporter);
  return {
    errors: counts.errors,
    warnings: counts.warnings,
    validatedRules,
    validatedSkills,
    totalLinks: ctx.linkCount,
    brokenLinks: ctx.broken
  };
}

function main(argv = process.argv.slice(2), exit = process.exit) {
  const workspaceRoot = path.resolve(parseArgs(argv));
  const result = runValidation(workspaceRoot);
  return exit(result.errors === 0 ? 0 : 1);
}

const { evaluateParityTarget, isValidAgentsTarget, createLowercaseParityLink } = parityHelpers;
const { stripHtmlComments, stripFencedCode } = textHelpers;

export {
  runValidation,
  parseArgs,
  createReporter,
  main,
  parseAdrLedger,
  checkAdrIndexConsistency,
  checkGlossaryPopulated,
  evaluateParityTarget,
  isValidAgentsTarget,
  createLowercaseParityLink,
  stripHtmlComments,
  stripFencedCode,
  walkMarkdown,
  phaseToolchain,
  readProfileLanguage,
  expectedToolchainFiles,
  TOOLCHAIN_FILES
};

export default {
  runValidation,
  parseArgs,
  createReporter,
  main,
  parseAdrLedger,
  checkAdrIndexConsistency,
  checkGlossaryPopulated,
  evaluateParityTarget,
  isValidAgentsTarget,
  createLowercaseParityLink,
  stripHtmlComments,
  stripFencedCode,
  walkMarkdown,
  phaseToolchain,
  readProfileLanguage,
  expectedToolchainFiles,
  TOOLCHAIN_FILES
};
