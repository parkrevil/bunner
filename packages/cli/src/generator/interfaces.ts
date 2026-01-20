import type { ModuleGraph } from '../analyzer/graph/module-graph';
import type { BunnerConfigSource, ResolvedBunnerConfig } from '../common/interfaces';

export interface GenerateConfig {
  workers?: number | string[] | string;
  [key: string]: unknown;
}

export interface ManifestJsonParams {
  graph: ModuleGraph;
  projectRoot: string;
  source: BunnerConfigSource;
  resolvedConfig: ResolvedBunnerConfig;
}
