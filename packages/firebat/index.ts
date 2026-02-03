import { runCli } from './src/adapters/cli/entry';
import { runMcp } from './src/adapters/mcp/entry';

const main = async (): Promise<void> => {
	const argv = Bun.argv.slice(2);
	const subcommand = argv[0];

	try {
		if (subcommand === 'mcp') {
			await runMcp();

			return;
		}

		const scanArgv = subcommand === 'scan' ? argv.slice(1) : argv;
		const exitCode = await runCli(scanArgv);

		process.exit(exitCode);
	} catch (error) {
		// MCP process constraints: do not write to stdout.
		// When MCP startup fails, persist diagnostics to a file so callers can inspect.
		const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);

		try {
			await Bun.write('./.firebat-mcp-error.log', `[${new Date().toISOString()}]\n${message}\n`);
		} catch {
			// ignore
		}

		process.exit(1);
	}
};

void main();
