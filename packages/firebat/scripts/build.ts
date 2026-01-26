const outdir = 'dist';
const naming = 'firebat.js';
const distFilePath = `${outdir}/${naming}`;
const logPrefix = '🔥 firebat:build';

console.info(`${logPrefix} start`);

const buildResult = await Bun.build({
  entrypoints: ['index.ts'],
  outdir,
  target: 'bun',
  minify: true,
  sourcemap: 'inline',
  packages: 'external',
  naming,
});

if (!buildResult.success) {
  console.error(`${logPrefix} failed`);
  console.error(buildResult.logs);
  process.exit(1);
}

let content = await Bun.file(distFilePath).text();

if (!content.startsWith('#!')) {
  content = `#!/usr/bin/env bun\n${content}`;
  await Bun.write(distFilePath, content);
}

const chmodResult = Bun.spawnSync(['chmod', '755', distFilePath]);
if (chmodResult.exitCode !== 0) {
  console.error(`${logPrefix} chmod failed (${chmodResult.exitCode})`);
  process.exit(1);
}

console.info(`${logPrefix} done`);