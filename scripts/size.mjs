import fs from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { minify } from 'terser';
import * as esbuild from 'esbuild';

// Build dist from TypeScript sources: bundle each global entry to a
// plain-JS IIFE (the zero-build artifact consumers load), minify it,
// and enforce gzip budgets. Declarations come from
// `tsc -p tsconfig.build.json` (see npm run build).
// Budgets: core 7.1kB -> 9.2kB for the security baseline plus the
// expression grammar, then -> ~10.3kB for the declarative push
// (display filters, scope API, trigger combining, transition
// baseline). Each move is recorded here with its cause. Still
// roughly a third of htmx alone (~16kB gzip).
const targets = [
  ['src/laghu.global.ts', 'dist/laghu.js', 'dist/laghu.min.js', 10.5 * 1024],
  ['src/morph.global.ts', 'dist/morph.js', 'dist/morph.min.js', 3 * 1024],
  ['src/router.global.ts', 'dist/router.js', 'dist/router.min.js', 2.5 * 1024],
  ['src/validate.global.ts', 'dist/validate.js', 'dist/validate.min.js', 2 * 1024],
];

fs.mkdirSync('dist', { recursive: true });
for (const [entry, unmin, min, budget] of targets) {
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    outfile: unmin,
    logLevel: 'silent',
  });
  const out = await minify(fs.readFileSync(unmin, 'utf8'), {
    compress: { passes: 2 },
    mangle: { toplevel: true },
  });
  fs.writeFileSync(min, out.code);
  const raw = Buffer.from(out.code);
  const gz = gzipSync(raw, { level: 9 }).length;
  const br = brotliCompressSync(raw).length;
  console.log(min, 'min', raw.length, 'gzip', gz, 'brotli', br, gz <= budget ? 'OK' : 'OVER');
  if (gz > budget) process.exitCode = 1;
}
