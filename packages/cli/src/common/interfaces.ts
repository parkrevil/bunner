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
  compiler?: CompilerOptions;
  scanPaths?: string[];
}

export interface CompilerOptions {
  strictValidation?: boolean;
  minify?: boolean;
  profile?: 'minimal' | 'standard' | 'full';
}

export interface ConfigLoadResult {
  config: ResolvedBunnerConfig;
  source: BunnerConfigSource;
}

export interface ConfigModule {
  bunnerConfig?: ResolvedBunnerConfig;
}

export type JsonPrimitive = string | number | boolean | null;

export interface JsonRecord {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export type JsonValue = JsonPrimitive | JsonRecord | JsonArray;
