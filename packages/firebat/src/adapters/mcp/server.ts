import * as z from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { FirebatCliOptions } from '../../interfaces';
import type { FirebatDetector, FirebatReport, MinSizeOption } from '../../types';

import { scanUseCase } from '../../application/scan/scan.usecase';
import { discoverDefaultTargets } from '../../target-discovery';
import { findPatternUseCase } from '../../application/find-pattern/find-pattern.usecase';
import { traceSymbolUseCase } from '../../application/trace/trace-symbol.usecase';
import { runOxlint } from '../../infrastructure/oxlint/oxlint-runner';

type ScanToolInput = {
  readonly targets?: ReadonlyArray<string>;
  readonly detectors?: ReadonlyArray<string>;
  readonly minSize?: number | 'auto';
  readonly maxForwardDepth?: number;
};

type FindPatternToolInput = {
  readonly targets?: ReadonlyArray<string>;
  readonly rule?: unknown;
  readonly matcher?: unknown;
  readonly ruleName?: string;
};

type TraceSymbolToolInput = {
  readonly entryFile: string;
  readonly symbol: string;
  readonly tsconfigPath?: string;
  readonly maxDepth?: number;
};

type LintToolInput = {
  readonly targets: ReadonlyArray<string>;
  readonly configPath?: string;
};

const ALL_DETECTORS: ReadonlyArray<FirebatDetector> = [
  'duplicates',
  'waste',
  'typecheck',
  'dependencies',
  'coupling',
  'duplication',
  'nesting',
  'early-return',
  'noop',
  'api-drift',
  'forwarding',
];

const asDetectors = (values: ReadonlyArray<string> | undefined): ReadonlyArray<FirebatDetector> => {
  if (!values || values.length === 0) {
    return ALL_DETECTORS;
  }

  const picked = values.filter((v): v is FirebatDetector => (ALL_DETECTORS as ReadonlyArray<string>).includes(v));
  return picked.length > 0 ? picked : ALL_DETECTORS;
};

const nowMs = (): number => {
  // Bun supports performance.now()
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
};

const runMcpServer = async (): Promise<void> => {
  // MCP process constraints:
  // - No `process.exit()` calls (transport stability)
  // - No stdout logs (reserved for protocol messages)

  const server = new McpServer({
    name: 'firebat',
    version: '2.0.0-strict',
  });

  let lastReport: FirebatReport | null = null;

  // NOTE:
  // The MCP SDK supports both Zod raw shapes and Zod schemas.
  // However, mixing Zod versions (v3/v4) in the type system can cause massive
  // generic instantiation (TS2589) and slow/oom typechecking under tsgo.
  // We keep runtime validation via Zod, but intentionally cast schema types
  // to avoid compile-time blowups.
  server.registerTool(
    'firebat.scan',
    {
      title: 'Firebat Scan',
      description: 'Analyze targets and return FirebatReport (with cache metadata when available).',
      inputSchema: z
        .object({
          targets: z.array(z.string()).optional(),
          detectors: z.array(z.string()).optional(),
          minSize: z.union([z.number().int().nonnegative(), z.literal('auto')]).optional(),
          maxForwardDepth: z.number().int().nonnegative().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          report: z.any(),
          timings: z.object({ totalMs: z.number() }),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const t0 = nowMs();

      const args = input as ScanToolInput;

      const targets =
        args.targets && args.targets.length > 0 ? args.targets : await discoverDefaultTargets(process.cwd());

      const options: FirebatCliOptions = {
        targets,
        format: 'json',
        minSize: (args.minSize ?? 'auto') as MinSizeOption,
        maxForwardDepth: args.maxForwardDepth ?? 0,
        exitOnFindings: false,
        detectors: asDetectors(args.detectors),
        help: false,
      };

      const report = await scanUseCase(options);
      lastReport = report;

      const totalMs = nowMs() - t0;
      const structured = { report, timings: { totalMs } };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'firebat.findPattern',
    {
      title: 'Find Pattern',
      description: 'Run ast-grep rule matching across targets (structured rule/matcher).',
      inputSchema: z
        .object({
          targets: z.array(z.string()).optional(),
          rule: z.any().optional(),
          matcher: z.any().optional(),
          ruleName: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          matches: z.array(
            z.object({
              filePath: z.string(),
              ruleId: z.string(),
              text: z.string(),
              span: z.object({
                start: z.object({ line: z.number(), column: z.number() }),
                end: z.object({ line: z.number(), column: z.number() }),
              }),
            }),
          ),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as FindPatternToolInput;

      const hasRule = args.rule !== undefined;
      const hasMatcher = args.matcher !== undefined;

      if (!hasRule && !hasMatcher) {
        throw new Error('firebat.findPattern requires one of: rule, matcher');
      }

      const request: Parameters<typeof findPatternUseCase>[0] = {
        ...(args.targets !== undefined ? { targets: args.targets } : {}),
        ...(args.rule !== undefined ? { rule: args.rule } : {}),
        ...(args.matcher !== undefined ? { matcher: args.matcher } : {}),
        ...(args.ruleName !== undefined ? { ruleName: args.ruleName } : {}),
      };

      const matches = await findPatternUseCase(request);
      const structured = { matches };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'firebat.traceSymbol',
    {
      title: 'Trace Symbol',
      description: 'Type-aware symbol tracing via tsgo.',
      inputSchema: z
        .object({
          entryFile: z.string(),
          symbol: z.string(),
          tsconfigPath: z.string().optional(),
          maxDepth: z.number().int().nonnegative().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          ok: z.boolean(),
          tool: z.literal('tsgo'),
          graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
          evidence: z.array(z.any()),
          error: z.string().optional(),
          raw: z.any().optional(),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as TraceSymbolToolInput;

      const request: Parameters<typeof traceSymbolUseCase>[0] = {
        entryFile: args.entryFile,
        symbol: args.symbol,
        ...(args.tsconfigPath !== undefined ? { tsconfigPath: args.tsconfigPath } : {}),
        ...(args.maxDepth !== undefined ? { maxDepth: args.maxDepth } : {}),
      };

      const structured = await traceSymbolUseCase(request);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'firebat.lint',
    {
      title: 'Lint',
      description: 'Run oxlint and return normalized diagnostics (best-effort).',
      inputSchema: z
        .object({
          targets: z.array(z.string()),
          configPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          ok: z.boolean(),
          tool: z.literal('oxlint'),
          diagnostics: z.array(z.any()).optional(),
          error: z.string().optional(),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as LintToolInput;

      const request: Parameters<typeof runOxlint>[0] = {
        targets: args.targets,
        ...(args.configPath !== undefined ? { configPath: args.configPath } : {}),
      };

      const result = await runOxlint(request);
      const structured = {
        ok: result.ok,
        tool: result.tool,
        diagnostics: result.diagnostics ?? [],
        error: result.error,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerResource(
    'last-report',
    'firebat://report/last',
    {
      title: 'Last Firebat Report',
      description: 'The last FirebatReport produced by firebat.scan during this MCP session.',
      mimeType: 'application/json',
    },
    async uri => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(lastReport),
        },
      ],
    }),
  );

  server.registerPrompt(
    'firebat.review',
    {
      title: 'Firebat Review',
      description: 'Review a Firebat report and propose prioritized fixes.',
      argsSchema: {
        reportJson: z.string().describe('JSON string of FirebatReport'),
      } as any,
    },
    (args: any) => {
      const { reportJson } = args as { reportJson: string };

      return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'You are reviewing a Firebat report.',
              '1) Summarize top risks in priority order.',
              '2) Propose minimal fixes with file-level guidance.',
              '3) Call out anything that looks like a false positive.',
              '',
              reportJson,
            ].join('\n'),
          },
        },
      ],
    };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

export { runMcpServer };
