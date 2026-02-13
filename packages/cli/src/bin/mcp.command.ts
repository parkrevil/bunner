import type { CommandOptions } from './types';

import { buildDiagnostic, reportDiagnostics } from '../diagnostics';
import { ConfigLoader } from '../common/config-loader';
import { verifyProject } from '../mcp/verify/verify-project';

function reportInvalidSubcommand(value: string | undefined): void {
  const commandValue = value ?? '(missing)';
  const diagnostic = buildDiagnostic({
    code: 'INVALID_COMMAND',
    severity: 'fatal',
    summary: 'Unknown command.',
    reason: `Unsupported command: mcp ${commandValue}.`,
    file: '.',
  });

  reportDiagnostics({ diagnostics: [diagnostic] });
}

export async function mcp(positionals: string[], _commandOptions: CommandOptions): Promise<void> {
  const subcommand = positionals[0];

  switch (subcommand) {
    case 'verify': {
      const projectRoot = process.cwd();
      const { config } = await ConfigLoader.load(projectRoot);

      const result = await verifyProject({ projectRoot, config });

      const diagnostics = [
        ...result.errors.map((issue) =>
          buildDiagnostic({
            code: `MCP_VERIFY_${issue.code}`,
            severity: 'error',
            summary: issue.message,
            reason: issue.message,
            file: issue.filePath ?? issue.cardKey ?? '.',
          }),
        ),
        ...result.warnings.map((issue) =>
          buildDiagnostic({
            code: `MCP_VERIFY_${issue.code}`,
            severity: 'warning',
            summary: issue.message,
            reason: issue.message,
            file: issue.filePath ?? issue.cardKey ?? '.',
          }),
        ),
      ];

      if (diagnostics.length > 0) {
        reportDiagnostics({ diagnostics });
      }

      process.exitCode = result.ok ? 0 : 1;
      return;
    }

    default:
      reportInvalidSubcommand(subcommand);
      process.exitCode = 1;
  }
}
