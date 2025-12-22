#!/usr/bin/env bun
import { parseArgs } from 'util';
import { dev, build } from '../commands';

const { positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
});

const command = positionals[0];

switch (command) {
  case 'dev':
    await dev();
    break;
  case 'build':
    await build();
    break;
  default:
    console.log('Usage: bunner <command>');
    console.log('Commands:');
    console.log('  dev    Start development server');
    console.log('  build  Build for production');
    process.exit(1);
}
