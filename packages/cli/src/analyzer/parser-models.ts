export interface ReExport {
  module: string;
  exportAll: boolean;
  names?: { local: string; exported: string }[];
}

export interface ModuleDefinition {
  name?: string;
  nameDeclared?: boolean;
  providers: unknown[];
  adapters?: unknown;
  imports: Record<string, string>;
}

export interface ParseResult {
  classes: import('./interfaces').ClassMetadata[];
  reExports: ReExport[];
  exports: string[];
  imports?: Record<string, string>;
  moduleDefinition?: ModuleDefinition;
}
