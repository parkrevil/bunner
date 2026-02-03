/* oxlint-disable typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-argument, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unsafe-return, typescript-eslint/no-redundant-type-constituents, typescript-eslint/no-explicit-any, firebat/no-any, firebat/no-unknown, firebat/no-inline-object-type, firebat/no-non-null-assertion, firebat/no-double-assertion, firebat/member-ordering, typescript-eslint/strict-boolean-expressions, typescript-eslint/require-await */

import * as path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

interface TsgoTraceRequest {
  readonly entryFile: string;
  readonly symbol: string;
  readonly tsconfigPath?: string;
  readonly maxDepth?: number;
}

interface TsgoTraceResult {
  readonly ok: boolean;
  readonly tool: 'tsgo';
  readonly error?: string;
  readonly structured?: unknown;
}

type SourceSpan = {
  readonly start: { readonly line: number; readonly column: number };
  readonly end: { readonly line: number; readonly column: number };
};

type TraceNode = {
  readonly id: string;
  readonly kind: 'file' | 'symbol' | 'type' | 'reference' | 'unknown';
  readonly label: string;
  readonly filePath?: string;
  readonly span?: SourceSpan;
};

type TraceEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: 'references' | 'imports' | 'exports' | 'calls' | 'type-of' | 'unknown';
  readonly label?: string;
};

type TraceGraph = {
  readonly nodes: ReadonlyArray<TraceNode>;
  readonly edges: ReadonlyArray<TraceEdge>;
};

type TraceEvidenceSpan = {
  readonly filePath: string;
  readonly span: SourceSpan;
  readonly text?: string;
};

type LspPosition = { readonly line: number; readonly character: number };

type LspRange = { readonly start: LspPosition; readonly end: LspPosition };

type LspLocation = { readonly uri: string; readonly range: LspRange };

type LspLocationLink = {
  readonly targetUri: string;
  readonly targetRange: LspRange;
  readonly targetSelectionRange?: LspRange;
  readonly originSelectionRange?: LspRange;
};

type TsgoLspSession = {
  readonly lsp: LspConnection;
  readonly cwd: string;
  readonly rootUri: string;
  readonly initializeResult: unknown;
  readonly note?: string;
};

const fileUrlToPathSafe = (uri: string): string => {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri.replace(/^file:\/\//, '');
  }
};

const readFileText = async (filePath: string): Promise<string> => {
  try {
    return await Bun.file(filePath).text();
  } catch {
    return '';
  }
};

const splitLines = (text: string): string[] => text.split(/\r?\n/);

const findSymbolPositionInText = (text: string, symbol: string): { line: number; character: number } | null => {
  const lines = splitLines(text);
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates: Array<{ score: number; line: number; character: number }> = [];
  // Prefer likely declarations.
  const declPatterns = [
    new RegExp(`\\b(class|interface|type|enum|function)\\s+${escaped}\\b`),
    new RegExp(`\\b(const|let|var)\\s+${escaped}\\b`),
    new RegExp(`\\bexport\\s+(class|interface|type|enum|function)\\s+${escaped}\\b`),
  ];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i] ?? '';
    // Skip comments quickly (best-effort).
    const trimmed = lineText.trimStart();

    if (trimmed.startsWith('//')) {continue;}

    for (let p = 0; p < declPatterns.length; p++) {
      const m = declPatterns[p]!.exec(lineText);

      if (m && m.index >= 0) {
        const idx = lineText.indexOf(symbol, m.index);

        if (idx >= 0) {
          candidates.push({ score: 100 - p * 10, line: i, character: idx });
        }
      }
    }

    // Fallback: first identifier-like occurrence.
    const any = new RegExp(`\\b${escaped}\\b`).exec(lineText);

    if (any && any.index >= 0) {
      candidates.push({ score: 10, line: i, character: any.index });
    }
  }

  if (candidates.length === 0) {return null;}

  candidates.sort((a, b) => b.score - a.score || a.line - b.line || a.character - b.character);

  return { line: candidates[0]!.line, character: candidates[0]!.character };
};

const toSpanFromRange = (range: LspRange): SourceSpan => {
  return {
    start: { line: range.start.line + 1, column: range.start.character + 1 },
    end: { line: range.end.line + 1, column: range.end.character + 1 },
  };
};

const extractEvidenceText = async (filePath: string, span: SourceSpan): Promise<string | undefined> => {
  const text = await readFileText(filePath);

  if (text.length === 0) {return undefined;}

  const lines = splitLines(text);
  const lineIdx = Math.max(0, Math.min(lines.length - 1, span.start.line - 1));
  const lineText = lines[lineIdx] ?? '';

  return lineText.trim().slice(0, 300);
};

const buildLspMessage = (payload: unknown): Uint8Array => {
  const json = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;

  return new TextEncoder().encode(header + json);
};

class LspConnection {
  private readonly proc: ReturnType<typeof Bun.spawn>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private readonly readerLoop: Promise<void>;

  private constructor(proc: ReturnType<typeof Bun.spawn>) {
    this.proc = proc;

    if (!proc.stdin || typeof proc.stdin === 'number') {
      throw new Error('tsgo stdin is not available');
    }

    const stdin: unknown = proc.stdin;

    if (typeof (stdin as any)?.getWriter !== 'function') {
      throw new Error('tsgo stdin does not support getWriter()');
    }

    this.writer = (stdin as WritableStream<Uint8Array>).getWriter();
    this.readerLoop = this.startReadLoop();
  }

  static async start(opts: { cwd: string; command: string; args: string[] }): Promise<LspConnection> {
    const proc = Bun.spawn({
      cmd: [opts.command, ...opts.args],
      cwd: opts.cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'pipe',
    });

    return new LspConnection(proc);
  }

  private async startReadLoop(): Promise<void> {
    if (!this.proc.stdout || typeof this.proc.stdout === 'number') {
      throw new Error('tsgo stdout is not available');
    }

    const stream = this.proc.stdout as unknown as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const readMore = async (): Promise<boolean> => {
      const { value, done } = await reader.read();

      if (done) {return false;}

      buffer += decoder.decode(value, { stream: true });

      return true;
    };

    const parseOne = (): any | null => {
      const headerEnd = buffer.indexOf('\r\n\r\n');

      if (headerEnd === -1) {return null;}

      const header = buffer.slice(0, headerEnd);
      const m = /Content-Length:\s*(\d+)/i.exec(header);

      if (!m) {
        // Can't parse header; drop until after headerEnd.
        buffer = buffer.slice(headerEnd + 4);

        return null;
      }

      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;

      if (buffer.length < bodyStart + len) {return null;}

      const body = buffer.slice(bodyStart, bodyStart + len);

      buffer = buffer.slice(bodyStart + len);

      try {
        return JSON.parse(body);
      } catch {
        return null;
      }
    };

    while (true) {
      let msg = parseOne();

      while (msg) {
        if (msg && typeof msg === 'object' && 'id' in msg) {
          const id = Number((msg).id);
          const pending = this.pending.get(id);

          if (pending) {
            this.pending.delete(id);

            if ('error' in msg && (msg).error) {
              const err = (msg).error;

              pending.reject(new Error(typeof err?.message === 'string' ? err.message : 'LSP error'));
            } else {
              pending.resolve((msg).result);
            }
          }
        }

        msg = parseOne();
      }

      const ok = await readMore();

      if (!ok) {break;}
    }

    // Process ended; reject pending requests.
    for (const [, pending] of this.pending) {
      pending.reject(new Error('LSP connection closed'));
    }

    this.pending.clear();
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as any, reject });
    });

    await this.writer.write(buildLspMessage(payload));

    return  p;
  }

  async notify(method: string, params?: unknown): Promise<void> {
    const payload = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined ? { params } : {}),
    };

    await this.writer.write(buildLspMessage(payload));
  }

  async close(): Promise<void> {
    try {
      await this.request('shutdown');
      await this.notify('exit');
    } catch {
      // ignore
    }

    try {
      await this.writer.close();
    } catch {
      // ignore
    }

    try {
      this.proc.kill();
    } catch {
      // ignore
    }

    try {
      await this.readerLoop;
    } catch {
      // ignore
    }
  }

  async waitForExit(): Promise<number> {
    return  this.proc.exited;
  }

  async readStderr(): Promise<string> {
    if (!this.proc.stderr || typeof this.proc.stderr === 'number') {return '';}

    return  new Response(this.proc.stderr as any).text();
  }
}

const tryResolveTsgoCommand = async (cwd: string): Promise<{ command: string; args: string[]; note?: string } | null> => {
  const localBin = path.join(cwd, 'node_modules', '.bin', 'tsgo');

  try {
    await Bun.file(localBin).stat();

    return { command: localBin, args: ['--lsp', '--stdio'] };
  } catch {
    // ignore
  }

  // If running from a nested dir, also try workspace root node_modules.
  try {
    const rootBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsgo');

    await Bun.file(rootBin).stat();

    return { command: rootBin, args: ['--lsp', '--stdio'] };
  } catch {
    // ignore
  }

  // Fall back to PATH resolution (best-effort)
  if (typeof Bun.which === 'function') {
    const resolved = Bun.which('tsgo');

    if (resolved) {
      return { command: resolved, args: ['--lsp', '--stdio'] };
    }
  }

  // Last resort: npx package that provides tsgo
  const npx = typeof Bun.which === 'function' ? Bun.which('npx') : null;

  if (npx) {
    // `npx -y @typescript/native-preview --lsp --stdio`
    // This mirrors the typical usage in tools like lsmcp.
    return { command: npx, args: ['-y', '@typescript/native-preview', '--lsp', '--stdio'], note: 'npx fallback' };
  }

  return null;
};

const runTsgoTraceSymbol = async (req: TsgoTraceRequest): Promise<TsgoTraceResult> => {
  try {
    const entryFile = path.resolve(process.cwd(), req.entryFile);
    const cwd = req.tsconfigPath
      ? path.dirname(path.resolve(process.cwd(), req.tsconfigPath))
      : process.cwd();
    const resolved = await tryResolveTsgoCommand(cwd);

    if (!resolved) {
      return {
        ok: false,
        tool: 'tsgo',
        error:
          'tsgo is not available. Install @typescript/native-preview (devDependency) or ensure `tsgo` is on PATH (or `npx` is available).',
      };
    }

    const entryText = await readFileText(entryFile);

    if (entryText.length === 0) {
      return { ok: false, tool: 'tsgo', error: `failed to read entryFile: ${entryFile}` };
    }

    const pos = findSymbolPositionInText(entryText, req.symbol);

    if (!pos) {
      return { ok: false, tool: 'tsgo', error: `symbol not found in entryFile text: ${req.symbol}` };
    }

    const lsp = await LspConnection.start({ cwd, command: resolved.command, args: resolved.args });

    try {
      const rootUri = pathToFileURL(cwd).toString();
      const entryUri = pathToFileURL(entryFile).toString();

      await lsp.request('initialize', {
        processId: null,
        rootUri,
        capabilities: {},
        workspaceFolders: [{ uri: rootUri, name: path.basename(cwd) }],
      });
      await lsp.notify('initialized', {});

      await lsp.notify('textDocument/didOpen', {
        textDocument: {
          uri: entryUri,
          languageId: 'typescript',
          version: 1,
          text: entryText,
        },
      });

      // Give tsgo a moment to process the opened document.
      await new Promise<void>((r) => setTimeout(r, 500));

      const definitionResult = await lsp
        .request<LspLocation | LspLocation[] | LspLocationLink[] | null>('textDocument/definition', {
          textDocument: { uri: entryUri },
          position: pos,
        })
        .catch(() => null);
      const references = await lsp.request<LspLocation[]>('textDocument/references', {
        textDocument: { uri: entryUri },
        position: pos,
        context: { includeDeclaration: true },
      });
      const nodes: TraceNode[] = [];
      const edges: TraceEdge[] = [];
      const evidence: TraceEvidenceSpan[] = [];
      const nodeIds = new Set<string>();
      const edgeIds = new Set<string>();

      const addNode = (node: TraceNode): void => {
        if (nodeIds.has(node.id)) {return;}

        nodeIds.add(node.id);
        nodes.push(node);
      };

      const addEdge = (edge: TraceEdge): void => {
        const id = `${edge.from}->${edge.to}:${edge.kind}:${edge.label ?? ''}`;

        if (edgeIds.has(id)) {return;}

        edgeIds.add(id);
        edges.push(edge);
      };

      const symbolNodeId = `symbol:${req.symbol}`;

      addNode({ id: symbolNodeId, kind: 'symbol', label: req.symbol, filePath: entryFile });

      const entryFileNodeId = `file:${entryFile}`;

      addNode({ id: entryFileNodeId, kind: 'file', label: path.basename(entryFile), filePath: entryFile });
      addEdge({ from: symbolNodeId, to: entryFileNodeId, kind: 'references' });

      const normalizeLocations = (value: unknown): LspLocation[] => {
        if (!value) {return [];}

        if (Array.isArray(value)) {
          // Location[] or LocationLink[]
          const out: LspLocation[] = [];

          for (const item of value) {
            if (!item || typeof item !== 'object') {continue;}

            if ('uri' in (item) && 'range' in (item)) {
              out.push(item as LspLocation);
            } else if ('targetUri' in (item) && 'targetRange' in (item)) {
              const link = item as LspLocationLink;

              out.push({ uri: link.targetUri, range: link.targetRange });
            }
          }

          return out;
        }

        if (typeof value === 'object' && value && 'uri' in (value as any) && 'range' in (value as any)) {
          return [value as LspLocation];
        }

        return [];
      };

      const defLocations = normalizeLocations(definitionResult);

      if (defLocations.length > 0) {
        const def = defLocations[0]!;
        const defPath = fileUrlToPathSafe(def.uri);
        const defSpan = toSpanFromRange(def.range);
        const defNodeId = `ref:def:${defPath}:${def.range.start.line}:${def.range.start.character}`;

        addNode({
          id: defNodeId,
          kind: 'reference',
          label: `definition:${path.basename(defPath)}:${defSpan.start.line}`,
          filePath: defPath,
          span: defSpan,
        });
        addEdge({ from: symbolNodeId, to: defNodeId, kind: 'references', label: 'definition' });

        const defFileNodeId = `file:${defPath}`;

        addNode({ id: defFileNodeId, kind: 'file', label: path.basename(defPath), filePath: defPath });
        addEdge({ from: defNodeId, to: defFileNodeId, kind: 'references' });

        const text = await extractEvidenceText(defPath, defSpan);

        evidence.push({ filePath: defPath, span: defSpan, ...(text !== undefined ? { text } : {}) });
      }

      const maxRefs = Math.max(1, req.maxDepth ?? 200);
      const refsToUse = references.slice(0, maxRefs);

      for (const ref of refsToUse) {
        const filePath = fileUrlToPathSafe(ref.uri);
        const span = toSpanFromRange(ref.range);
        const fileNodeId = `file:${filePath}`;

        addNode({ id: fileNodeId, kind: 'file', label: path.basename(filePath), filePath });

        const refNodeId = `ref:${filePath}:${ref.range.start.line}:${ref.range.start.character}`;

        addNode({ id: refNodeId, kind: 'reference', label: `${path.basename(filePath)}:${span.start.line}`, filePath, span });

        addEdge({ from: symbolNodeId, to: refNodeId, kind: 'references' });
        addEdge({ from: refNodeId, to: fileNodeId, kind: 'references' });

        const text = await extractEvidenceText(filePath, span);

        evidence.push({ filePath, span, ...(text !== undefined ? { text } : {}) });
      }

      const structured = { graph: { nodes, edges } satisfies TraceGraph, evidence, meta: resolved.note };

      return { ok: true, tool: 'tsgo', structured };
    } finally {
      await lsp.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { ok: false, tool: 'tsgo', error: message };
  }
};

export { runTsgoTraceSymbol };
export type { TsgoTraceRequest, TsgoTraceResult };

export type { LspPosition, LspRange, LspLocation, LspLocationLink, TsgoLspSession };

export const withTsgoLspSession = async <T>(
  input: { root: string; tsconfigPath?: string },
  fn: (session: TsgoLspSession) => Promise<T>,
): Promise<{ ok: true; value: T; note?: string } | { ok: false; error: string } > => {
  try {
    const cwd = input.tsconfigPath
      ? path.dirname(path.resolve(process.cwd(), input.tsconfigPath))
      : path.isAbsolute(input.root)
        ? input.root
        : path.resolve(process.cwd(), input.root);
    const resolved = await tryResolveTsgoCommand(cwd);

    if (!resolved) {
      return {
        ok: false,
        error:
          'tsgo is not available. Install @typescript/native-preview (devDependency) or ensure `tsgo` is on PATH (or `npx` is available).',
      };
    }

    const lsp = await LspConnection.start({ cwd, command: resolved.command, args: resolved.args });

    try {
      const rootUri = pathToFileURL(cwd).toString();
      const initializeResult = await lsp.request('initialize', {
        processId: null,
        rootUri,
        capabilities: {},
        workspaceFolders: [{ uri: rootUri, name: path.basename(cwd) }],
      });

      await lsp.notify('initialized', {});

      const session: TsgoLspSession = {
        lsp,
        cwd,
        rootUri,
        initializeResult,
        ...(resolved.note !== undefined ? { note: resolved.note } : {}),
      };
      const value = await fn(session);

      return { ok: true, value, ...(resolved.note ? { note: resolved.note } : {}) };
    } finally {
      await lsp.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { ok: false, error: message };
  }
};

export const openTsDocument = async (input: {
  lsp: LspConnection;
  filePath: string;
  languageId?: string;
  version?: number;
  text?: string;
}): Promise<{ uri: string; text: string }> => {
  const text = input.text ?? (await readFileText(input.filePath));
  const uri = pathToFileURL(input.filePath).toString();

  await input.lsp.notify('textDocument/didOpen', {
    textDocument: {
      uri,
      languageId: input.languageId ?? 'typescript',
      version: input.version ?? 1,
      text,
    },
  });

  return { uri, text };
};

export const lspUriToFilePath = fileUrlToPathSafe;
