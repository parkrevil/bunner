import type { ModuleGraph } from '../analyzer/graph/module-graph';
import type { AdapterStaticSpec, HandlerIndexEntry } from '../analyzer/interfaces';
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
  adapterStaticSpecs: Record<string, AdapterStaticSpec>;
  handlerIndex: HandlerIndexEntry[];
}
