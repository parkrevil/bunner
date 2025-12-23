export interface BunnerConfig {
  entry: string;
  workers?: string[] | number | 'full' | 'half';
  port?: number;
  compiler?: {
    strictValidation?: boolean;
    minify?: boolean;
  };
  scanPaths?: string[];
}
