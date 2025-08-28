export interface HppOptions {
  target?: 'body' | 'queryParams';
  depth?: number;
  keepValue?: 'first' | 'last';
  whitelist?: string[];
}

export interface ProcessHPPOptions extends Required<Omit<HppOptions, 'whitelist'>> {
  whitelist: Set<string>;
}
