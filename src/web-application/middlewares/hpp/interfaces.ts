export interface HppOptions {
  target?: 'body' | 'queryParams';
  depth?: number;
  keepValue?: 'first' | 'last';
  whitelist?: string[];
}
