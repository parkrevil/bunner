/* oxlint-disable firebat/no-any, firebat/no-inline-object-type, typescript-eslint/no-explicit-any, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-argument, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/strict-boolean-expressions, typescript-eslint/require-await */
import * as z from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { FirebatCliOptions } from '../../interfaces';
import type { FirebatDetector, FirebatReport, MinSizeOption } from '../../types';

import { scanUseCase } from '../../application/scan/scan.usecase';
import { discoverDefaultTargets } from '../../target-discovery';
import { findPatternUseCase } from '../../application/find-pattern/find-pattern.usecase';
import {
  deleteMemoryUseCase,
  listMemoriesUseCase,
  readMemoryUseCase,
  writeMemoryUseCase,
} from '../../application/memory/memory.usecases';
import {
  clearIndexUseCase,
  getIndexStatsFromIndexUseCase,
  indexSymbolsUseCase,
  searchSymbolFromIndexUseCase,
} from '../../application/symbol-index/symbol-index.usecases';
import {
  checkCapabilitiesUseCase,
  deleteSymbolUseCase,
  findReferencesUseCase,
  formatDocumentUseCase,
  getAllDiagnosticsUseCase,
  getAvailableExternalSymbolsInFileUseCase,
  getCodeActionsUseCase,
  getCompletionUseCase,
  getDefinitionsUseCase,
  getDiagnosticsUseCase,
  getDocumentSymbolsUseCase,
  getHoverUseCase,
  getSignatureHelpUseCase,
  getTypescriptDependenciesUseCase,
  getWorkspaceSymbolsUseCase,
  indexExternalLibrariesUseCase,
  parseImportsUseCase,
  renameSymbolUseCase,
  resolveSymbolUseCase,
  searchExternalLibrarySymbolsUseCase,
} from '../../application/lsp/lsp.usecases';
import {
  insertAfterSymbolUseCase,
  insertBeforeSymbolUseCase,
  replaceRangeUseCase,
  replaceRegexUseCase,
  replaceSymbolBodyUseCase,
} from '../../application/editor/edit.usecases';
import { getSymbolsOverviewUseCase, querySymbolsUseCase } from '../../application/symbols/symbol-tools.usecases';
import { traceSymbolUseCase } from '../../application/trace/trace-symbol.usecase';
import { runOxlint } from '../../infrastructure/oxlint/oxlint-runner';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';

type ScanToolInput = {
  readonly targets?: ReadonlyArray<string>;
  readonly detectors?: ReadonlyArray<string>;
  readonly minSize?: number | 'auto';
  readonly maxForwardDepth?: number;
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonValue>
  | { readonly [k: string]: JsonValue };

type FindPatternToolInput = {
  readonly targets?: ReadonlyArray<string>;
  readonly rule?: JsonValue;
  readonly matcher?: JsonValue;
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

type ListDirToolInput = {
  readonly root?: string;
  readonly relativePath: string;
};

type MemoryKeyToolInput = {
  readonly root?: string;
  readonly memoryKey: string;
};

type WriteMemoryToolInput = {
  readonly root?: string;
  readonly memoryKey: string;
  readonly value: JsonValue;
};

type IndexSymbolsToolInput = {
  readonly root?: string;
  readonly targets?: ReadonlyArray<string>;
};

type SearchSymbolFromIndexToolInput = {
  readonly root?: string;
  readonly query: string;
  readonly limit?: number;
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

  server.registerTool(
    'scan',
    {
      title: 'Scan',
      description: 'Analyze targets and return FirebatReport (JSON).',
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
    'find_pattern',
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
        throw new Error('find_pattern requires one of: rule, matcher');
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
    'trace_symbol',
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
    'lint',
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

  // ----
  // LSMCP serenity-style tools: filesystem + memory
  // ----

  server.registerTool(
    'list_dir',
    {
      title: 'List Dir',
      description: 'List directory entries (best-effort, non-recursive).',
      inputSchema: z
        .object({
          root: z.string().optional(),
          relativePath: z.string(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          entries: z.array(
            z.object({
              name: z.string(),
              isDir: z.boolean(),
            }),
          ),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as ListDirToolInput;
      const cwd = process.cwd();
      const root = args.root && args.root.trim().length > 0 ? args.root.trim() : cwd;
      const absRoot = path.isAbsolute(root) ? root : path.resolve(cwd, root);
      const absPath = path.resolve(absRoot, args.relativePath);
      const dirents = await readdir(absPath, { withFileTypes: true });
      const entries = dirents.map(d => ({ name: d.name, isDir: d.isDirectory() }));
      const structured = { entries };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'list_memories',
    {
      title: 'List Memories',
      description: 'List stored memory keys for the given root.',
      inputSchema: z
        .object({
          root: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          memories: z.array(z.object({ memoryKey: z.string(), updatedAt: z.number() })),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as { root?: string };
      const memories = await listMemoriesUseCase((args.root !== undefined ? { root: args.root } : {}));
      const structured = { memories };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'read_memory',
    {
      title: 'Read Memory',
      description: 'Read a memory record by key.',
      inputSchema: z
        .object({
          root: z.string().optional(),
          memoryKey: z.string(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          found: z.boolean(),
          memoryKey: z.string(),
          value: z.any().optional(),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as MemoryKeyToolInput;
      const rec = await readMemoryUseCase({
        ...(args.root !== undefined ? { root: args.root } : {}),
        memoryKey: args.memoryKey,
      });
      const structured = rec ? { found: true, memoryKey: args.memoryKey, value: rec.value } : { found: false, memoryKey: args.memoryKey };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'write_memory',
    {
      title: 'Write Memory',
      description: 'Write a memory record (JSON).',
      inputSchema: z
        .object({
          root: z.string().optional(),
          memoryKey: z.string(),
          value: z.any(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), memoryKey: z.string() })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as WriteMemoryToolInput;

      await writeMemoryUseCase({
        ...(args.root !== undefined ? { root: args.root } : {}),
        memoryKey: args.memoryKey,
        value: args.value,
      });

      const structured = { ok: true, memoryKey: args.memoryKey };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'delete_memory',
    {
      title: 'Delete Memory',
      description: 'Delete a memory record by key.',
      inputSchema: z
        .object({
          root: z.string().optional(),
          memoryKey: z.string(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), memoryKey: z.string() })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as MemoryKeyToolInput;

      await deleteMemoryUseCase({
        ...(args.root !== undefined ? { root: args.root } : {}),
        memoryKey: args.memoryKey,
      });

      const structured = { ok: true, memoryKey: args.memoryKey };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  // ----
  // LSMCP Index & Project (subset): symbol index/search
  // ----

  server.registerTool(
    'index_symbols',
    {
      title: 'Index Symbols',
      description: 'Index symbols for the given targets (best-effort).',
      inputSchema: z
        .object({
          root: z.string().optional(),
          targets: z.array(z.string()).optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          ok: z.boolean(),
          indexedFiles: z.number(),
          skippedFiles: z.number(),
          symbolsIndexed: z.number(),
          parseErrors: z.number(),
          timings: z.object({ totalMs: z.number() }),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const t0 = nowMs();
      const args = input as IndexSymbolsToolInput;
      const result = await indexSymbolsUseCase({
        ...(args.root !== undefined ? { root: args.root } : {}),
        ...(args.targets !== undefined ? { targets: args.targets } : {}),
      });
      const totalMs = nowMs() - t0;
      const structured = { ...result, timings: { totalMs } };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'search_symbol_from_index',
    {
      title: 'Search Symbol From Index',
      description: 'Search indexed symbols by substring match on name.',
      inputSchema: z
        .object({
          root: z.string().optional(),
          query: z.string(),
          limit: z.number().int().positive().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          matches: z.array(
            z.object({
              filePath: z.string(),
              kind: z.string(),
              name: z.string(),
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
      const args = input as SearchSymbolFromIndexToolInput;
      const matches = await searchSymbolFromIndexUseCase({
        ...(args.root !== undefined ? { root: args.root } : {}),
        query: args.query,
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      });
      const structured = { matches };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  // LSMCP name drift: provide `search_symbols` as an alias of `search_symbol_from_index`.
  server.registerTool(
    'search_symbols',
    {
      title: 'Search Symbols',
      description: 'Alias of search_symbol_from_index (name drift compatibility).',
      inputSchema: z
        .object({
          root: z.string().optional(),
          query: z.string(),
          limit: z.number().int().positive().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          matches: z.array(
            z.object({
              filePath: z.string(),
              kind: z.string(),
              name: z.string(),
              span: z.object({
                start: z.object({ line: z.number(), column: z.number() }),
                end: z.object({ line: z.number(), column: z.number() }),
              }),
            }),
          ),
        })
        .strict() as any,
    },
    async (input: any) => {
      const args = input as SearchSymbolFromIndexToolInput;
      const matches = await searchSymbolFromIndexUseCase({
        ...(args.root !== undefined ? { root: args.root } : {}),
        query: args.query,
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
      });
      const structured = { matches };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'get_index_stats_from_index',
    {
      title: 'Get Index Stats From Index',
      description: 'Get basic stats for the symbol index.',
      inputSchema: z
        .object({
          root: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          indexedFileCount: z.number(),
          symbolCount: z.number(),
          lastIndexedAt: z.number().nullable(),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as { root?: string };
      const structured = await getIndexStatsFromIndexUseCase((args.root !== undefined ? { root: args.root } : {}));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'clear_index',
    {
      title: 'Clear Index',
      description: 'Delete all symbol index data for the given root.',
      inputSchema: z
        .object({
          root: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean() })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as { root?: string };

      await clearIndexUseCase((args.root !== undefined ? { root: args.root } : {}));

      const structured = { ok: true };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'get_project_overview',
    {
      title: 'Get Project Overview',
      description: 'Return basic project overview information (currently: symbol index stats).',
      inputSchema: z
        .object({
          root: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({
          symbolIndex: z.object({
            indexedFileCount: z.number(),
            symbolCount: z.number(),
            lastIndexedAt: z.number().nullable(),
          }),
        })
        .strict() as any,
    },
    async (input: any, _extra: any) => {
      const args = input as { root?: string };
      const symbolIndex = await getIndexStatsFromIndexUseCase((args.root !== undefined ? { root: args.root } : {}));
      const structured = { symbolIndex };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(structured) }],
        structuredContent: structured,
      };
    },
  );

  // ----
  // LSP-common tools (via tsgo LSP)
  // ----

  server.registerTool(
    'get_hover',
    {
      title: 'Get Hover',
      description: 'Get hover/type information at a position or for a target string (tsgo LSP).',
      inputSchema: z
        .object({
          root: z.string(),
          filePath: z.string(),
          line: z.union([z.number(), z.string()]),
          character: z.number().int().nonnegative().optional(),
          target: z.string().optional(),
          tsconfigPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), hover: z.any().optional(), error: z.string().optional(), note: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; line: any; character?: number; target?: string; tsconfigPath?: string };
      const structured = await getHoverUseCase({
        root: args.root,
        filePath: args.filePath,
        line: args.line,
        ...(args.character !== undefined ? { character: args.character } : {}),
        ...(args.target !== undefined ? { target: args.target } : {}),
        ...(args.tsconfigPath !== undefined ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'find_references',
    {
      title: 'Find References',
      description: 'Find all references to a symbol (tsgo LSP).',
      inputSchema: z
        .object({
          root: z.string(),
          filePath: z.string(),
          line: z.union([z.number(), z.string()]),
          symbolName: z.string(),
          tsconfigPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), references: z.array(z.any()).optional(), error: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; line: any; symbolName: string; tsconfigPath?: string };
      const structured = await findReferencesUseCase({
        root: args.root,
        filePath: args.filePath,
        line: args.line,
        symbolName: args.symbolName,
        ...(args.tsconfigPath !== undefined ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_definitions',
    {
      title: 'Get Definitions',
      description: 'Go to definition with preview (tsgo LSP).',
      inputSchema: z
        .object({
          root: z.string(),
          filePath: z.string(),
          line: z.union([z.number(), z.string()]),
          symbolName: z.string(),
          before: z.number().int().nonnegative().optional(),
          after: z.number().int().nonnegative().optional(),
          include_body: z.boolean().optional(),
          tsconfigPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), definitions: z.array(z.any()).optional(), error: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input as {
        root: string;
        filePath: string;
        line: any;
        symbolName: string;
        before?: number;
        after?: number;
        include_body?: boolean;
        tsconfigPath?: string;
      };
      const structured = await getDefinitionsUseCase({
        root: args.root,
        filePath: args.filePath,
        line: args.line,
        symbolName: args.symbolName,
        ...(args.before !== undefined ? { before: args.before } : {}),
        ...(args.after !== undefined ? { after: args.after } : {}),
        ...(args.include_body !== undefined ? { include_body: args.include_body } : {}),
        ...(args.tsconfigPath !== undefined ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_diagnostics',
    {
      title: 'Get Diagnostics',
      description: 'Get diagnostics for a file (pull diagnostics; server dependent).',
      inputSchema: z
        .object({
          root: z.string(),
          filePath: z.string(),
          timeoutMs: z.number().int().positive().optional(),
          forceRefresh: z.boolean().optional(),
          tsconfigPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), diagnostics: z.any().optional(), error: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; timeoutMs?: number; forceRefresh?: boolean; tsconfigPath?: string };
      const structured = await getDiagnosticsUseCase({
        root: args.root,
        filePath: args.filePath,
        ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
        ...(args.forceRefresh !== undefined ? { forceRefresh: args.forceRefresh } : {}),
        ...(args.tsconfigPath !== undefined ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_all_diagnostics',
    {
      title: 'Get All Diagnostics',
      description: 'Project-wide diagnostics (workspace/diagnostic; server dependent).',
      inputSchema: z.object({ root: z.string(), tsconfigPath: z.string().optional() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), diagnostics: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; tsconfigPath?: string };
      const structured = await getAllDiagnosticsUseCase({ root: args.root, ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_document_symbols',
    {
      title: 'Get Document Symbols',
      description: 'List all symbols in a document (tsgo LSP).',
      inputSchema: z.object({ root: z.string(), filePath: z.string(), tsconfigPath: z.string().optional() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), symbols: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; tsconfigPath?: string };
      const structured = await getDocumentSymbolsUseCase({ root: args.root, filePath: args.filePath, ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_workspace_symbols',
    {
      title: 'Get Workspace Symbols',
      description: 'Workspace symbol search (tsgo LSP).',
      inputSchema: z.object({ root: z.string(), query: z.string().optional(), tsconfigPath: z.string().optional() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), symbols: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; query?: string; tsconfigPath?: string };
      const structured = await getWorkspaceSymbolsUseCase({ root: args.root, ...(args.query ? { query: args.query } : {}), ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_completion',
    {
      title: 'Get Completion',
      description: 'Completion at a position (tsgo LSP).',
      inputSchema: z
        .object({ root: z.string(), filePath: z.string(), line: z.union([z.number(), z.string()]), character: z.number().int().nonnegative().optional(), tsconfigPath: z.string().optional() })
        .strict() as any,
      outputSchema: z.object({ ok: z.boolean(), completion: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; line: any; character?: number; tsconfigPath?: string };
      const structured = await getCompletionUseCase({ root: args.root, filePath: args.filePath, line: args.line, ...(args.character !== undefined ? { character: args.character } : {}), ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_signature_help',
    {
      title: 'Get Signature Help',
      description: 'Signature help at a position (tsgo LSP).',
      inputSchema: z
        .object({ root: z.string(), filePath: z.string(), line: z.union([z.number(), z.string()]), character: z.number().int().nonnegative().optional(), tsconfigPath: z.string().optional() })
        .strict() as any,
      outputSchema: z.object({ ok: z.boolean(), signatureHelp: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; line: any; character?: number; tsconfigPath?: string };
      const structured = await getSignatureHelpUseCase({ root: args.root, filePath: args.filePath, line: args.line, ...(args.character !== undefined ? { character: args.character } : {}), ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'format_document',
    {
      title: 'Format Document',
      description: 'Format the entire document (tsgo LSP).',
      inputSchema: z.object({ root: z.string(), filePath: z.string(), tsconfigPath: z.string().optional() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), changed: z.boolean().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; tsconfigPath?: string };
      const structured = await formatDocumentUseCase({ root: args.root, filePath: args.filePath, ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_code_actions',
    {
      title: 'Get Code Actions',
      description: 'Get available code actions for a line range (tsgo LSP).',
      inputSchema: z
        .object({
          root: z.string(),
          filePath: z.string(),
          startLine: z.union([z.number(), z.string()]),
          endLine: z.union([z.number(), z.string()]).optional(),
          includeKinds: z.array(z.string()).optional(),
          tsconfigPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z.object({ ok: z.boolean(), actions: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as {
        root: string;
        filePath: string;
        startLine: any;
        endLine?: any;
        includeKinds?: string[];
        tsconfigPath?: string;
      };
      const structured = await getCodeActionsUseCase({
        root: args.root,
        filePath: args.filePath,
        startLine: args.startLine,
        ...(args.endLine !== undefined ? { endLine: args.endLine } : {}),
        ...(args.includeKinds !== undefined ? { includeKinds: args.includeKinds } : {}),
        ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'rename_symbol',
    {
      title: 'Rename Symbol',
      description: 'Rename a symbol project-wide (tsgo LSP).',
      inputSchema: z
        .object({
          root: z.string(),
          filePath: z.string(),
          line: z.union([z.number(), z.string()]).optional(),
          symbolName: z.string(),
          newName: z.string(),
          tsconfigPath: z.string().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), changedFiles: z.array(z.string()).optional(), error: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; line?: any; symbolName: string; newName: string; tsconfigPath?: string };
      const structured = await renameSymbolUseCase({
        root: args.root,
        filePath: args.filePath,
        ...(args.line !== undefined ? { line: args.line } : {}),
        symbolName: args.symbolName,
        newName: args.newName,
        ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'delete_symbol',
    {
      title: 'Delete Symbol',
      description: 'Delete symbol definition (best-effort, via LSP definition lookup).',
      inputSchema: z
        .object({ root: z.string(), filePath: z.string(), line: z.union([z.number(), z.string()]), symbolName: z.string(), tsconfigPath: z.string().optional() })
        .strict() as any,
      outputSchema: z.object({ ok: z.boolean(), changed: z.boolean().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; filePath: string; line: any; symbolName: string; tsconfigPath?: string };
      const structured = await deleteSymbolUseCase({ root: args.root, filePath: args.filePath, line: args.line, symbolName: args.symbolName, ...(args.tsconfigPath ? { tsconfigPath: args.tsconfigPath } : {}) });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'check_capabilities',
    {
      title: 'Check Capabilities',
      description: 'Report supported LSP capabilities (tsgo LSP).',
      inputSchema: z.object({ root: z.string(), tsconfigPath: z.string().optional() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), capabilities: z.any().optional(), error: z.string().optional(), note: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string; tsconfigPath?: string };
      const structured = await checkCapabilitiesUseCase({
        root: args.root,
        ...(args.tsconfigPath !== undefined ? { tsconfigPath: args.tsconfigPath } : {}),
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  // ----
  // Serenity-style edit tools
  // ----

  server.registerTool(
    'replace_range',
    {
      title: 'Replace Range',
      description: 'Replace a specific 1-based line/column range in a file.',
      inputSchema: z
        .object({
          root: z.string(),
          relativePath: z.string(),
          startLine: z.number().int().positive(),
          startColumn: z.number().int().positive(),
          endLine: z.number().int().positive(),
          endColumn: z.number().int().positive(),
          newText: z.string(),
        })
        .strict() as any,
      outputSchema: z.object({ ok: z.boolean(), filePath: z.string(), changed: z.boolean(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await replaceRangeUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'replace_regex',
    {
      title: 'Replace Regex',
      description: 'Regex-based replacement (gms).',
      inputSchema: z
        .object({
          root: z.string(),
          relativePath: z.string(),
          regex: z.string(),
          repl: z.string(),
          allowMultipleOccurrences: z.boolean().optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), filePath: z.string(), changed: z.boolean(), matchCount: z.number().optional(), error: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await replaceRegexUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'replace_symbol_body',
    {
      title: 'Replace Symbol Body',
      description: 'Replace the block body of a symbol by namePath (best-effort; TS/JS only).',
      inputSchema: z.object({ root: z.string(), namePath: z.string(), relativePath: z.string(), body: z.string() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), filePath: z.string(), changed: z.boolean(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await replaceSymbolBodyUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'insert_before_symbol',
    {
      title: 'Insert Before Symbol',
      description: 'Insert text before a symbol definition by namePath (best-effort).',
      inputSchema: z.object({ root: z.string(), namePath: z.string(), relativePath: z.string(), body: z.string() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), filePath: z.string(), changed: z.boolean(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await insertBeforeSymbolUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'insert_after_symbol',
    {
      title: 'Insert After Symbol',
      description: 'Insert text after a symbol definition by namePath (best-effort).',
      inputSchema: z.object({ root: z.string(), namePath: z.string(), relativePath: z.string(), body: z.string() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), filePath: z.string(), changed: z.boolean(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await insertAfterSymbolUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  // ----
  // Symbol overview helpers
  // ----

  server.registerTool(
    'get_symbols_overview',
    {
      title: 'Get Symbols Overview',
      description: 'Summarize the current symbol index for the project root.',
      inputSchema: z.object({ root: z.string().optional() }).strict() as any,
      outputSchema: z.object({ root: z.string(), index: z.any() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root?: string };
      const structured = await getSymbolsOverviewUseCase((args.root !== undefined ? { root: args.root } : {}));

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'query_symbols',
    {
      title: 'Query Symbols',
      description: 'Query symbols from the index (best-effort filter).',
      inputSchema: z
        .object({
          root: z.string().optional(),
          query: z.string(),
          kind: z.union([z.string(), z.array(z.string())]).optional(),
          file: z.string().optional(),
          limit: z.number().int().positive().optional(),
        })
        .strict() as any,
      outputSchema: z.object({ matches: z.array(z.any()) }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await querySymbolsUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  // ----
  // TypeScript-specific tools (best-effort)
  // ----

  server.registerTool(
    'index_external_libraries',
    {
      title: 'Index External Libraries',
      description: 'Index .d.ts files in node_modules for basic external symbol search.',
      inputSchema: z
        .object({
          root: z.string(),
          maxFiles: z.number().int().positive().optional(),
          includePatterns: z.array(z.string()).optional(),
          excludePatterns: z.array(z.string()).optional(),
        })
        .strict() as any,
      outputSchema: z
        .object({ ok: z.boolean(), indexedFiles: z.number(), symbols: z.number(), error: z.string().optional() })
        .strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await indexExternalLibrariesUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_typescript_dependencies',
    {
      title: 'Get TypeScript Dependencies',
      description: 'List dependencies that appear to provide TypeScript declarations.',
      inputSchema: z.object({ root: z.string() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), dependencies: z.array(z.string()).optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input as { root: string };
      const structured = await getTypescriptDependenciesUseCase({ root: args.root });

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'search_external_library_symbols',
    {
      title: 'Search External Library Symbols',
      description: 'Search indexed external symbols (requires index_external_libraries first).',
      inputSchema: z
        .object({ root: z.string(), libraryName: z.string().optional(), symbolName: z.string().optional(), kind: z.string().optional(), limit: z.number().int().positive().optional() })
        .strict() as any,
      outputSchema: z.object({ ok: z.boolean(), matches: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await searchExternalLibrarySymbolsUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'resolve_symbol',
    {
      title: 'Resolve Symbol',
      description: 'Resolve a symbol definition using LSP definition lookup.',
      inputSchema: z.object({ root: z.string(), filePath: z.string(), symbolName: z.string(), tsconfigPath: z.string().optional() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), definition: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await resolveSymbolUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_available_external_symbols',
    {
      title: 'Get Available External Symbols',
      description: 'List imported symbol names in a file (best-effort import parser).',
      inputSchema: z.object({ root: z.string(), filePath: z.string() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), symbols: z.array(z.string()), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await getAvailableExternalSymbolsInFileUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'parse_imports',
    {
      title: 'Parse Imports',
      description: 'Parse and summarize imports (best-effort).',
      inputSchema: z.object({ root: z.string(), filePath: z.string() }).strict() as any,
      outputSchema: z.object({ ok: z.boolean(), imports: z.any().optional(), error: z.string().optional() }).strict() as any,
    },
    async (input: any) => {
      const args = input;
      const structured = await parseImportsUseCase(args);

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  // ----
  // Onboarding / guidance tools (text-only)
  // ----

  server.registerTool(
    'index_onboarding',
    {
      title: 'Index Onboarding',
      description: 'Explain the recommended indexing + symbol search workflow for this server.',
      inputSchema: z.object({}).strict() as any,
      outputSchema: z.object({ text: z.string() }).strict() as any,
    },
    async () => {
      const structured = {
        text: [
          'Recommended workflow:',
          '1) `index_symbols` to build the local symbol index (optionally provide `targets`).',
          '2) Use `search_symbol_from_index` (or `search_symbols`) to find symbols by name substring.',
          '3) Use LSP tools like `get_definitions` / `find_references` for precision navigation.',
          '4) Use edit tools (`replace_range`, `replace_regex`, `replace_symbol_body`, `insert_before_symbol`, `insert_after_symbol`) and re-run `index_symbols` if needed.',
        ].join('\n'),
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_symbol_search_guidance',
    {
      title: 'Get Symbol Search Guidance',
      description: 'Guidance for choosing between index search vs. LSP-based lookup.',
      inputSchema: z.object({}).strict() as any,
      outputSchema: z.object({ text: z.string() }).strict() as any,
    },
    async () => {
      const structured = {
        text: [
          'Use `search_symbol_from_index` / `search_symbols` when you only have a name hint or want a broad scan.',
          'Use `get_definitions` / `find_references` when you have a concrete location (file + line) and want precise results.',
          'For TypeScript imports, `parse_imports` and `get_available_external_symbols` can help identify names quickly.',
        ].join('\n'),
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerTool(
    'get_compression_guidance',
    {
      title: 'Get Compression Guidance',
      description: 'Guidance for keeping outputs compact and tool-friendly.',
      inputSchema: z.object({}).strict() as any,
      outputSchema: z.object({ text: z.string() }).strict() as any,
    },
    async () => {
      const structured = {
        text: [
          'Tips to keep outputs compact:',
          '- Prefer `get_index_stats_from_index` / `get_project_overview` for summaries.',
          '- Use `limit` for `search_symbol_from_index` / `search_symbols` when you expect many matches.',
          '- For definitions, tune `before`/`after` and `include_body` in `get_definitions` as needed.',
        ].join('\n'),
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(structured) }], structuredContent: structured };
    },
  );

  server.registerResource(
    'last-report',
    'report://last',
    {
      title: 'Last Firebat Report',
      description: 'The last FirebatReport produced by scan during this MCP session.',
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
    'review',
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
