import fs from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { minify } from 'terser';

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

await build('src/laghu.js', 'dist/laghu.min.js', 7.5 * 1024);
await build('src/morph.js', 'dist/morph.min.js', 3 * 1024);
