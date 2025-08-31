#!/usr/bin/env bun

import { BunnerCLI } from './src/cli';

const cli = new BunnerCLI();
cli.run().catch((e: Error) => {
    console.error(e);

    process.exit(1);
});

