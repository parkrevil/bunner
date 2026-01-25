import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUTFILE = 'dist/firebat.js';

mkdirSync('dist', { recursive: true });

await Bun.$`bun build index.ts --production --sourcemap=inline --target=bun --packages=external --outdir dist --entry-naming firebat.js`;

let content = readFileSync(OUTFILE, 'utf8');

if (!content.startsWith('#!')) {
  content = `#!/usr/bin/env bun\n${content}`;

  writeFileSync(OUTFILE, content);
}

chmodSync(OUTFILE, 0o755);
