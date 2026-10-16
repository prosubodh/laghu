import fs from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { minify } from 'terser';

// Budget note: core grew 7.1kB -> ~9kB gzip for the security baseline
// (default sanitizer, URL policy, pollution guards, error isolation,
// effect unsubscribe) plus the expression grammar (ternary,
// arithmetic, calls with args, indexing). Still under half of htmx
// alone (~16kB gzip) and below Alpine core. Router and morph stay
// opt-in files so the default drop-in stays minimal.
async function build(src, dist, budget) {
  const code = fs.readFileSync(src, 'utf8');
  const out = await minify(code, { compress: true, mangle: true });
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(dist, out.code);
  const raw = Buffer.from(out.code);
  const gz = gzipSync(raw, { level: 9 }).length;
  const br = brotliCompressSync(raw).length;
  console.log(dist, 'min', raw.length, 'gzip', gz, 'brotli', br, gz <= budget ? 'OK' : 'OVER');
  if (gz > budget) process.exitCode = 1;
}

await build('src/laghu.js', 'dist/laghu.min.js', 10 * 1024);
await build('src/morph.js', 'dist/morph.min.js', 3 * 1024);
await build('src/router.js', 'dist/router.min.js', 2.5 * 1024);
