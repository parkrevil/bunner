export interface ReExport {
  module: string; // Absolute path to module being re-exported
  exportAll: boolean; // export * from ...
  names?: { local: string; exported: string }[]; // export { A as B }
}

export interface ParseResult {
  classes: import('./interfaces').ClassMetadata[];
  reExports: ReExport[];
  exports: string[]; // Names of things exported from this file (classes, consts, etc)
}
