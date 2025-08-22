import { $ } from "bun";
import packageJson from '../package.json' with { type: 'json' };

async function build() {
  const outDir = "./dist";
  const externals = Object.keys(packageJson.dependencies || []);
  const buildCmd = [
    "bun", "build", "./src/index.ts",
    "--target", "bun",
    "--minify",
  ];

  for (const external of externals) {
    buildCmd.push("--external");
    buildCmd.push(external);
  }

  console.log(`🗑️ Removing ${outDir}...`);
  await $`rm -rf ${outDir}`;

  console.log(`🔨 Building ESM...`);
  const esmResult = await $`${buildCmd} --format esm --outfile ${outDir}/index.mjs`;

  if (esmResult.exitCode !== 0) {
    console.error(esmResult.stderr.toString());
    process.exit(1);
  }

  console.log(`🔨 Building CJS...`);
  const cjsResult = await $`${buildCmd} --format cjs --outfile ${outDir}/index.cjs`;

  if (cjsResult.exitCode !== 0) {
    console.error(cjsResult.stderr.toString());
    process.exit(1);
  }

  console.log(`🔨 Building Declaration...`);
  const declarationResult = await $`bun tsc --project tsconfig.build.json --outDir ${outDir}`;

  if (declarationResult.exitCode !== 0) {
    console.error(declarationResult.stderr.toString());
    process.exit(1);
  }
}

build().then(() => {
  console.log("Build completed successfully.");
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});