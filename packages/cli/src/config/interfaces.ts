export type BunnerConfigSourceFormat = 'json' | 'jsonc';

export interface BunnerConfigSource {
  path: string;
  format: BunnerConfigSourceFormat;
}

export interface ResolvedBunnerConfigModule {
  fileName: string;
}

export interface ResolvedBunnerConfigCard {
  relations: string[];
}

export interface ResolvedBunnerConfigMcp {
  card: ResolvedBunnerConfigCard;
  exclude: string[];
}

export interface ResolvedBunnerConfig {
  module: ResolvedBunnerConfigModule;
  sourceDir: string;
  entry: string;
  mcp: ResolvedBunnerConfigMcp;
}

export interface ConfigLoadResult {
  config: ResolvedBunnerConfig;
  source: BunnerConfigSource;
}

export type JsonPrimitive = string | number | boolean | null;

export interface JsonRecord {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export type JsonValue = JsonPrimitive | JsonRecord | JsonArray;
