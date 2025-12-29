#!/usr/bin/env bun
import { parseArgs } from 'util';
import { dev, build } from '../commands';

const { positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
});

const command = positionals[0];

const printUsage = (): void => {
  console.info('Usage: bunner <command>');
  console.info('Commands:');
  console.info('  dev    Generate AOT artifacts and watch');
  console.info('  build  Generate build output');
};

try {
  switch (command) {
    case 'dev':
      await dev();
      break;
    case 'build':
      await build();
      break;
    default:
      printUsage();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error);

  process.exitCode = 1;
}
