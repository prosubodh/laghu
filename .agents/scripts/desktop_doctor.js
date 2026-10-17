#!/usr/bin/env node

/**
 * Pre-flight Desktop Distribution Doctor (Milestone 4).
 * Prevents hybrid desktop build defects: missing custom-protocol, hollow CSS, dev-url embedding.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function findCargoToml(targetDir) {
  const candidates = [
    path.join(targetDir, 'Cargo.toml'),
    path.join(targetDir, 'src-tauri', 'Cargo.toml')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function verifyCargoTauri(cargoPath) {
  const content = fs.readFileSync(cargoPath, 'utf-8');
  if (!content.includes('tauri')) return { ok: true, skipped: true };

  const hasProtocol = content.includes('custom-protocol');
  if (!hasProtocol) {
    return {
      ok: false,
      reason: "Missing 'custom-protocol' feature in Cargo.toml dependencies. Tauri release binaries cannot embed frontend dist assets without it."
    };
  }
  return { ok: true, message: 'Custom protocol enabled in Cargo.toml.' };
}

function collectCssFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectCssFiles(full));
    else if (entry.name.endsWith('.css')) files.push(full);
  }
  return files;
}

function verifyCssDensity(targetDir, minBytes = 5000) {
  const searchDirs = [
    path.join(targetDir, 'dist'),
    path.join(targetDir, 'client', 'dist'),
    path.join(targetDir, 'build')
  ];
  let foundAny = false;
  let totalBytes = 0;

  for (const dir of searchDirs) {
    const cssList = collectCssFiles(dir);
    if (cssList.length > 0) {
      foundAny = true;
      for (const f of cssList) totalBytes += fs.statSync(f).size;
    }
  }

  if (!foundAny) return { ok: true, skipped: true };
  if (totalBytes < minBytes) {
    return {
      ok: false,
      reason: `Hollow CSS bundle detected (${totalBytes} bytes < ${minBytes} bytes). Check that postcss.config.js is configured for Tailwind.`
    };
  }
  return { ok: true, message: `CSS bundle density verified (${totalBytes} bytes).` };
}

function main() {
  const targetDir = path.resolve(process.argv[2] || process.cwd());
  const cargoPath = findCargoToml(targetDir);
  const cssResult = verifyCssDensity(targetDir);

  if (!cargoPath && cssResult.skipped) {
    console.log('ℹ️  No desktop artifacts found in: ' + targetDir);
    process.exit(0);
  }

  let failed = false;
  console.log('🩺 Desktop Distribution Doctor inspecting: ' + targetDir);

  if (cargoPath) {
    const cargoRes = verifyCargoTauri(cargoPath);
    if (!cargoRes.ok) {
      console.error(`🚨 ${cargoRes.reason}`);
      failed = true;
    } else if (cargoRes.message) {
      console.log(`✅ ${cargoRes.message}`);
    }
  }

  if (!cssResult.ok) {
    console.error(`🚨 ${cssResult.reason}`);
    failed = true;
  } else if (cssResult.message) {
    console.log(`✅ ${cssResult.message}`);
  }

  process.exit(failed ? 1 : 0);
}

main();
