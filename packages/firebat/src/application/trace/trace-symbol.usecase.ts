import * as path from 'node:path';

import { initHasher } from '../../engine/hasher';
import { getOrmDb } from '../../infrastructure/sqlite/firebat.db';
import { createSqliteArtifactRepository } from '../../infrastructure/sqlite/artifact.repository';
import { createSqliteFileIndexRepository } from '../../infrastructure/sqlite/file-index.repository';
import { createInMemoryArtifactRepository } from '../../infrastructure/memory/artifact.repository';
import { createInMemoryFileIndexRepository } from '../../infrastructure/memory/file-index.repository';
import { runTsgoTraceSymbol } from '../../infrastructure/tsgo/tsgo-runner';
import type { SourceSpan } from '../../types';
import { indexTargets } from '../indexing/file-indexer';
import { computeInputsDigest } from '../scan/inputs-digest';
import { computeProjectKey, computeTraceArtifactKey } from '../scan/cache-keys';

type TraceNodeKind = 'file' | 'symbol' | 'type' | 'reference' | 'unknown';

type TraceNode = {
  readonly id: string;
  readonly kind: TraceNodeKind;
  readonly label: string;
  readonly filePath?: string;
  readonly span?: SourceSpan;
};

type TraceEdgeKind = 'references' | 'imports' | 'exports' | 'calls' | 'type-of' | 'unknown';

type TraceEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: TraceEdgeKind;
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

type TraceSymbolInput = {
  readonly entryFile: string;
  readonly symbol: string;
  readonly tsconfigPath?: string;
  readonly maxDepth?: number;
};

type TraceSymbolOutput = {
  readonly ok: boolean;
  readonly tool: 'tsgo';
  readonly graph: TraceGraph;
  readonly evidence: ReadonlyArray<TraceEvidenceSpan>;
  readonly error?: string;
  readonly raw?: unknown;
};

const normalizeTrace = (input: { structured: unknown }): { graph: TraceGraph; evidence: TraceEvidenceSpan[]; raw?: unknown } => {
  const empty: TraceGraph = { nodes: [], edges: [] };

  if (!input.structured || typeof input.structured !== 'object') {
    return { graph: empty, evidence: [], raw: input.structured };
  }

  // Best-effort: if caller already returns {graph, evidence}
  const asAny = input.structured as any;

  if (asAny.graph && typeof asAny.graph === 'object' && Array.isArray(asAny.graph.nodes) && Array.isArray(asAny.graph.edges)) {
    return {
      graph: { nodes: asAny.graph.nodes as TraceNode[], edges: asAny.graph.edges as TraceEdge[] },
      evidence: Array.isArray(asAny.evidence) ? (asAny.evidence as TraceEvidenceSpan[]) : [],
      raw: input.structured,
    };
  }

  return { graph: empty, evidence: [], raw: input.structured };
};

const resolveRelatedFiles = async (input: TraceSymbolInput): Promise<string[]> => {
  const files: string[] = [path.resolve(process.cwd(), input.entryFile)];

  if (input.tsconfigPath) {
    const tsconfig = path.resolve(process.cwd(), input.tsconfigPath);
    try {
      await Bun.file(tsconfig).stat();
      files.push(tsconfig);
    } catch {
      // ignore
    }
  }

  return files;
};

const traceSymbolUseCase = async (input: TraceSymbolInput): Promise<TraceSymbolOutput> => {
  await initHasher();

  const baseToolVersion = '2.0.0-strict';
  const defaultCacheVersion = '2026-02-02-tsgo-lsp-v1';
  const cacheBuster = (process.env.FIREBAT_CACHE_BUSTER ?? '').trim();
  const toolVersion = cacheBuster.length > 0 ? `${baseToolVersion}+${cacheBuster}` : `${baseToolVersion}+${defaultCacheVersion}`;
  const projectKey = computeProjectKey({ toolVersion });

  const storageMode = (process.env.FIREBAT_STORAGE_MODE ?? '').toLowerCase();

  const artifactRepository =
    storageMode === 'memory' || storageMode === 'in-memory'
      ? createInMemoryArtifactRepository()
      : createSqliteArtifactRepository(await getOrmDb());

  const fileIndexRepository =
    storageMode === 'memory' || storageMode === 'in-memory'
      ? createInMemoryFileIndexRepository()
      : createSqliteFileIndexRepository(await getOrmDb());

  const relatedFiles = await resolveRelatedFiles(input);

  await indexTargets({ projectKey, targets: relatedFiles, repository: fileIndexRepository, concurrency: 4 });

  const inputsDigest = await computeInputsDigest({
    projectKey,
    targets: relatedFiles,
    fileIndexRepository,
  });

  const artifactKey = computeTraceArtifactKey({
    entryFile: relatedFiles[0] ?? input.entryFile,
    symbol: input.symbol,
    ...(input.tsconfigPath !== undefined ? { tsconfigPath: input.tsconfigPath } : {}),
    ...(input.maxDepth !== undefined ? { maxDepth: input.maxDepth } : {}),
  });

  const cached = await artifactRepository.getArtifact<TraceSymbolOutput>({
    projectKey,
    kind: 'tsgo:traceSymbol',
    artifactKey,
    inputsDigest,
  });

  if (cached) {
    return cached;
  }

  const tsgoRequest: Parameters<typeof runTsgoTraceSymbol>[0] = {
    entryFile: relatedFiles[0] ?? input.entryFile,
    symbol: input.symbol,
    ...(input.tsconfigPath !== undefined ? { tsconfigPath: input.tsconfigPath } : {}),
    ...(input.maxDepth !== undefined ? { maxDepth: input.maxDepth } : {}),
  };

  const result = await runTsgoTraceSymbol(tsgoRequest);

  const normalized = normalizeTrace({ structured: result.structured });

  const outputBase = {
    ok: result.ok,
    tool: 'tsgo' as const,
    graph: normalized.graph,
    evidence: normalized.evidence,
  };

  const output: TraceSymbolOutput = {
    ...outputBase,
    ...(result.error !== undefined ? { error: result.error } : {}),
    ...(normalized.raw !== undefined ? { raw: normalized.raw } : {}),
  };

  await artifactRepository.setArtifact({
    projectKey,
    kind: 'tsgo:traceSymbol',
    artifactKey,
    inputsDigest,
    value: output,
  });

  return output;
};

export { traceSymbolUseCase };
export type { TraceSymbolInput, TraceSymbolOutput };
