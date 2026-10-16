import fs from 'node:fs';
import crypto from 'node:crypto';

// Prints Subresource Integrity hashes for the published dist files.
// Paste the output into release notes so CDN consumers can pin.
const files = ['dist/laghu.min.js', 'dist/morph.min.js', 'dist/router.min.js'];
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log(f + ' MISSING (run node scripts/size.mjs first)');
    continue;
  }
  const b = fs.readFileSync(f);
  const sum = crypto.createHash('sha384').update(b).digest('base64');
  console.log(f + '\n  integrity="sha384-' + sum + '"');
}
