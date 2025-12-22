export interface BunnerConfig {
  entry: string;
  workers?: string[];
  port?: number;
  compiler?: {
    strictValidation?: boolean;
    minify?: boolean;
  };
  scanPaths?: string[];
}
