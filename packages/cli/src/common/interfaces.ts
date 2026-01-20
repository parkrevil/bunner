export type BunnerConfigSourceFormat = 'ts' | 'json';

export interface BunnerConfigSource {
  path: string;
  format: BunnerConfigSourceFormat;
}

export interface ResolvedBunnerConfigModule {
  fileName: string;
}

export interface ResolvedBunnerConfig {
  module: ResolvedBunnerConfigModule;
  entry?: string;
  workers?: string[] | number | 'full' | 'half';
  port?: number;
  compiler?: {
    strictValidation?: boolean;
    minify?: boolean;
    profile?: 'minimal' | 'standard' | 'full';
  };
  scanPaths?: string[];
}

export interface ConfigLoadResult {
  config: ResolvedBunnerConfig;
  source: BunnerConfigSource;
}

export interface ConfigModule {
  default?: ResolvedBunnerConfig;
}
