export interface ReExport {
  module: string; // Absolute path to module being re-exported
  exportAll: boolean; // export * from ...
  names?: { local: string; exported: string }[]; // export { A as B }
}

export interface ModuleDefinition {
  name?: string;
  providers: any[]; // Raw provider objects/tokens
  adapters?: any; // Raw adapter config
  imports: Record<string, string>; // Imports used in module definition
}

export interface ParseResult {
  classes: import('./interfaces').ClassMetadata[];
  reExports: ReExport[];
  exports: string[]; // Names of things exported from this file (classes, consts, etc)
  imports?: Record<string, string>;
  moduleDefinition?: ModuleDefinition;
}
