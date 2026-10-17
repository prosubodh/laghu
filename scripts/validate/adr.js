import fs from 'node:fs';
import path from 'node:path';
import { readTextOrFail } from './io.js';
import { stripHtmlComments, stripFencedCode } from './text.js';

function parseAdrLedger(memoryText) {
  const withoutComments = stripFencedCode(stripHtmlComments(memoryText));

  const entryIds = [...withoutComments.matchAll(/^####\s+ADR-(\d+)/gm)].map((m) => Number(m[1]));

  // Any heading-ish line mentioning an ADR that is NOT a well-formed h4 entry.
  // Catches the escapes that would otherwise silently downgrade the ledger to
  // "clean slate": wrong heading depth, blockquoted, and missing space.
  const malformed = [...withoutComments.matchAll(/^[^|\n]*#{1,6}[ \t]*\S*ADR-(\d+)/gim)]
    .map((m) => Number(m[1]))
    .filter((id) => !entryIds.includes(id));

  const indexIds = [];
  const tableRows = withoutComments.split('\n').filter((line) => /^\s*\|/.test(line));
  for (const row of tableRows) {
    // Skip the header and separator rows.
    if (/^\s*\|[\s|:-]+\|\s*$/.test(row)) continue;
    // cells[1] always exists: the row filter above guarantees a leading pipe,
    // so splitting on '|' yields at least two cells.
    const first = row.split('|')[1];
    const m = first.match(/ADR-(\d+)/);
    if (m) indexIds.push(Number(m[1]));
  }

  const duplicateIds = entryIds.filter((id, i) => entryIds.indexOf(id) !== i);

  return { entryIds, indexIds, malformed, duplicateIds: [...new Set(duplicateIds)] };
}

// Match the ledger's own ADR-001 zero-padded convention so messages can be
// grepped back to the offending heading.
function ledgerLabel(id) {
  return `ADR-${String(id).padStart(3, '0')}`;
}

function reportMalformedHeadings(parsed, fail) {
  for (const id of parsed.malformed) {
    fail(
      `${ledgerLabel(id)} appears in memory.md with a non-standard heading. ` +
      'ADR entries must use exactly "#### ADR-NNN: Title" at h4.'
    );
  }
  for (const id of parsed.duplicateIds) {
    fail(`${ledgerLabel(id)} has more than one entry heading in memory.md.`);
  }
}

function reportIndexDrift(parsed, fail) {
  const indexed = new Set(parsed.indexIds);
  const missingFromIndex = parsed.entryIds.filter((id) => !indexed.has(id));
  const missingEntry = parsed.indexIds.filter((id) => !parsed.entryIds.includes(id));
  for (const id of missingFromIndex) {
    fail(`${ledgerLabel(id)} exists in memory.md but is missing from the ADR Master Index table.`);
  }
  for (const id of missingEntry) {
    fail(`ADR Master Index lists ${ledgerLabel(id)} but no matching entry exists in memory.md.`);
  }
  return missingFromIndex.length === 0 && missingEntry.length === 0;
}

function isLedgerClean(parsed, driftClean) {
  return driftClean && parsed.malformed.length === 0 && parsed.duplicateIds.length === 0;
}

/**
 * Fails when an ADR exists but is absent from the Master Index table, or when
 * the index advertises an ADR that has no entry. Returns 'indexed' when there
 * is at least one ADR entry to cross-check, otherwise 'clean-slate'.
 */
function checkAdrIndexConsistency(workspaceRoot, fail, pass) {
  const memoryFile = path.join(workspaceRoot, 'memory.md');
  if (!fs.existsSync(memoryFile)) return 'clean-slate';
  const ledgerText = readTextOrFail(memoryFile, 'memory.md', fail);
  if (ledgerText === null) return 'clean-slate';

  const parsed = parseAdrLedger(ledgerText);

  // A malformed heading must fail loudly. Previously any non-`####` heading
  // produced zero entries, which silently downgraded the ledger to
  // "clean slate" and disabled the entire phase.
  reportMalformedHeadings(parsed, fail);

  // Fail closed: an index that advertises an ADR must have a matching entry,
  // even when no well-formed entry was parsed at all.
  if (parsed.entryIds.length === 0 && parsed.indexIds.length === 0) {
    return parsed.malformed.length === 0 ? 'clean-slate' : 'inconsistent';
  }

  const driftClean = reportIndexDrift(parsed, fail);
  if (isLedgerClean(parsed, driftClean)) {
    pass(`ADR Master Index matches all ${parsed.entryIds.length} ADR entries in memory.md.`);
    return 'indexed';
  }
  return 'inconsistent';
}

/**
 * The glossary is the second derived view that silently rots: an empty
 * ubiquitous-language table alongside a populated ADR ledger means the DDD
 * governance layer was scaffolded but never exercised.
 */
function checkGlossaryPopulated(workspaceRoot, verdicts) {
  const { fail } = verdicts;
  const glossary = path.join(workspaceRoot, 'docs', 'knowledge', 'ubiquitous_language.md');
  if (!fs.existsSync(glossary)) {
    fail('Missing docs/knowledge/ubiquitous_language.md (required once ADRs exist).');
    return;
  }
  const raw = readTextOrFail(glossary, 'ubiquitous_language.md', fail);
  if (raw === null) return;
  checkGlossaryTerms(raw, verdicts, workspaceRoot);
}

function checkGlossaryTerms(raw, verdicts, workspaceRoot) {
  const { fail } = verdicts;
  // Explicit, greppable opt-out for the template repo itself. Its glossary is
  // deliberately blank because it ships downstream as a starting point.
  if (/azcodr:glossary-waived/.test(raw)) {
    reportWaiverOutcome(workspaceRoot, verdicts.pass, verdicts.warn);
    return;
  }
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, '');
  const rows = withoutComments.split('\n').filter((line) => /^\s*\|/.test(line));
  // Header + separator + one placeholder row = still a template.
  const realTerms = rows.slice(2).filter((line) => !/No domain terms defined yet/i.test(line));
  if (realTerms.length === 0) {
    fail('ubiquitous_language.md has no domain terms, but memory.md records ADRs. Define the vocabulary during Domain Discovery.');
  }
}

function reportWaiverOutcome(workspaceRoot, pass, warn) {
  const isTemplateItself = path.basename(workspaceRoot) === 'azcodr';
  if (isTemplateItself) {
    pass('ubiquitous_language.md is intentionally blank (template waiver).');
  } else {
    warn('ubiquitous_language.md carries the azcodr template waiver; delete the marker and define this project\'s vocabulary.');
  }
}

export {
  parseAdrLedger,
  checkAdrIndexConsistency,
  checkGlossaryPopulated
};

export default {
  parseAdrLedger,
  checkAdrIndexConsistency,
  checkGlossaryPopulated
};
