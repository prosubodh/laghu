import fs from 'node:fs';
import path from 'node:path';

export const TOOLCHAIN_FILES = {
  typescript: ['eslint.config.js'],
  javascript: ['eslint.config.js'],
  deno: ['eslint.config.js'],
  bun: ['eslint.config.js'],
  python: ['ruff.toml'],
  rust: ['clippy.toml'],
  go: ['.golangci.yml'],
  java: ['checkstyle.xml'],
  csharp: ['.editorconfig'],
  cpp: ['.clang-tidy'],
  c: ['.clang-tidy'],
  generic: []
};

export function readProfileLanguage(workspaceRoot) {
  const profile = path.join(workspaceRoot, '.azcodr', 'workspace-profile.env');
  if (!fs.existsSync(profile)) return null;
  const match = /^language=(.+)$/m.exec(fs.readFileSync(profile, 'utf-8'));
  return match ? match[1].trim() : null;
}

export function expectedToolchainFiles(language) {
  if (!language) return [];
  return TOOLCHAIN_FILES[language] || [];
}

function reportMissing(ctx, language, expected) {
  let missing = 0;
  for (const name of expected) {
    if (!fs.existsSync(path.join(ctx.workspaceRoot, name))) {
      ctx.fail(`Missing toolchain gate '${name}' for language '${language}'; re-run bootstrap or restore the config.`);
      missing += 1;
    }
  }
  return missing;
}

export function phaseToolchain(ctx) {
  ctx.log('');
  ctx.heading('7. Checking Toolchain Enforcement...');
  const language = readProfileLanguage(ctx.workspaceRoot);
  if (language === null) {
    ctx.pass('No workspace profile; toolchain check skipped.');
    return;
  }
  const expected = expectedToolchainFiles(language);
  if (expected.length === 0) {
    ctx.pass(`Language '${language}' declares no toolchain configs; nothing to enforce.`);
    return;
  }
  if (reportMissing(ctx, language, expected) === 0) {
    ctx.pass(`Toolchain gates present for language '${language}' (${expected.join(', ')}).`);
  }
}

export default { TOOLCHAIN_FILES, readProfileLanguage, expectedToolchainFiles, phaseToolchain };
